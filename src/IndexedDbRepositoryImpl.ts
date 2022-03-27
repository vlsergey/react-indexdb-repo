import Batcher from '@vlsergey/batcher';

import IndexedDbRepository from './IndexedDbRepository';

type Listener = (stamp: number) => unknown;
type Predicate<V> = (value: V) => boolean;
type TxModeType = 'readonly' | 'readwrite';

function toPromise<T> (request: IDBRequest): Promise< T > {
  return new Promise< T >((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result as T); };
    request.onerror = reject;
  });
}

function withCursor (
    request: IDBRequest<IDBCursorWithValue | null>,
    callback: (cursor: IDBCursorWithValue) => unknown
): Promise< void > {
  return new Promise< void >((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const cursor = request.result;
        if (cursor) {
          callback(cursor);
          cursor.continue();
        } else {
          resolve();
        }
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = reject;
  });
}

// Wrap IDB functions into Promises
const clearPromise = (objectStore: IDBObjectStore) => toPromise<void>(objectStore.clear());
const countPromise = (objectStore: IDBObjectStore, query?: IDBValidKey | IDBKeyRange) => toPromise<number>(objectStore.count(query));
const deletePromise = <KeyType extends IDBValidKey>(objectStore: IDBObjectStore, key: KeyType) => toPromise<void>(objectStore.delete(key));
const getAllPromise = <DbValueType>(objectStore: IDBObjectStore) => toPromise< DbValueType[] >(objectStore.getAll());
const putPromise = <KeyType, DbValueType>(objectStore: IDBObjectStore, value: DbValueType) => toPromise< KeyType >(objectStore.put(value));

export default class IndexedDbRepositoryImpl<KeyType extends IDBValidKey, DbValueType, ValueType>
implements IndexedDbRepository<KeyType, ValueType> {

  database: IDBDatabase;
  findById: (id: KeyType) => Promise< ValueType | undefined >;
  findByIds: (ids: KeyType[]) => Promise< (ValueType | undefined)[] >;
  keyPath: string;
  listeners: Set< Listener >;
  objectStoreName: string;
  // changes marker
  stamp: number;
  transformAfterIndexDb: (value: DbValueType) => ValueType;
  transformBeforeIndexDb: (value: ValueType) => DbValueType;

  constructor (database: IDBDatabase, objectStoreName: string, keyPath: string) {
    this.database = database;
    this.keyPath = keyPath;
    this.listeners = new Set();
    this.objectStoreName = objectStoreName;
    this.stamp = 0;
    this.transformAfterIndexDb = x => x as unknown as ValueType;
    this.transformBeforeIndexDb = x => x as unknown as DbValueType;

    const findByIdBatcher = new Batcher<KeyType, ValueType | undefined>(this._findByIds);
    this.findById = (key: KeyType) => findByIdBatcher.queue(key);
    this.findByIds = (keys: KeyType[]) => findByIdBatcher.queueAll(...keys);
  }

  private readonly inTx = <T>(txMode: TxModeType, callback : ((objectStore: IDBObjectStore) => T)): T => {
    try {
      const transaction: IDBTransaction = this.database.transaction([this.objectStoreName], txMode);
      const objectStore: IDBObjectStore = transaction.objectStore(this.objectStoreName);
      const result: T = callback(objectStore);
      return result;
    } finally {
      if (txMode === 'readwrite') {
        this.onChange(); // notify listeners
      }
    }
  };

  close = (): void => { this.database.close(); };

  count = (): Promise<number> => this.inTx('readonly', objectStore => countPromise(objectStore));

  findAll = () => this.inTx('readonly', async objectStore => {
    const dbResults: DbValueType[] = await getAllPromise(objectStore);
    return dbResults.map(i => this.transformAfterIndexDb(i));
  });

  private readonly _findByIds = (keys: KeyType[]): Promise< (ValueType | undefined)[] > => {
    if (keys.length === 0) return Promise.resolve([]);

    const sorted = [...new Set(keys)];
    sorted.sort((a, b) => window.indexedDB.cmp(a, b));

    const minKey: KeyType = sorted[0]!;
    const maxKey: KeyType = sorted[sorted.length - 1]!;
    const keyRange = IDBKeyRange.bound(minKey, maxKey);

    type ResultValues = (ValueType | undefined)[];
    return this.inTx('readonly', (objectStore: IDBObjectStore) => new Promise< ResultValues >((resolve, reject) => {
      const request = objectStore.openCursor(keyRange, 'next');
      const result = new Map() as Map< KeyType, ValueType >;

      let currentIndex = 0;
      request.onsuccess = () => {
        const cursor = request.result;

        while (currentIndex < sorted.length) {
          if (!cursor) {
            currentIndex++;
            continue;
          }

          const expectedKey = sorted[currentIndex]!;
          const actualKey = cursor.key;
          const cmp = window.indexedDB.cmp(expectedKey, actualKey);
          if (cmp < 0) {
            currentIndex++;
            continue;
          }
          if (cmp === 0) {
            result.set(expectedKey, this.transformAfterIndexDb(cursor.value as DbValueType));
            currentIndex++;
            continue;
          }
          if (cmp > 0) {
            cursor.continue(expectedKey);
            return;
          }
        }

        // currentIndex === sorted.length
        resolve(keys.map(key => result.get(key)));
      };
      request.onerror = reject;
    }));
  };

  findByPredicate = (predicate: Predicate<ValueType>): Promise< ValueType[] > =>
    this.inTx('readonly', async objectStore => {
      const result: ValueType[] = [];
      const request = objectStore.openCursor();
      await withCursor(request, cursor => {
        const extItem = this.transformAfterIndexDb(cursor.value as DbValueType);
        if (predicate(extItem)) {
          result.push(extItem);
        }
      });
      return result;
    });

  deleteAll = (): Promise<void> =>
    this.inTx('readwrite', objectStore => clearPromise(objectStore));

  deleteById = (key: KeyType): Promise< void > =>
    this.inTx< Promise< void > >('readwrite', objectStore => deletePromise(objectStore, key));

  getKeyToIndexValueMap = (indexName: string): Promise< Map< KeyType, IDBValidKey > > =>
    this.inTx('readwrite', async objectStore => {
      const index = objectStore.index(indexName);
      const request = index.openCursor();

      const result: Map< KeyType, IDBValidKey > = new Map();
      await withCursor(request, cursor => {
        const primaryKey = cursor.primaryKey as KeyType;
        const indexValue = cursor.key;
        result.set(primaryKey, indexValue);
      });

      return result;
    });

  /**
   * @return Keys of removed elements
   */
  retain = async (idsToPreserve : (KeyType[] | Set< KeyType >)): Promise< KeyType[] > => {
    const setToPreserve: Set< KeyType > = new Set(idsToPreserve);
    return this.inTx('readwrite', async objectStore => {
      const request = objectStore.openCursor();
      try {
        const result: KeyType[] = [];
        await withCursor(request, cursor => {
          const item = cursor.value as DbValueType;
          const id = (item as Record<string, unknown>)[this.keyPath] as KeyType;
          if (!setToPreserve.has(id)) {
            result.push(id);
            cursor.delete();
          }
        });
        return result;
      } finally {
        this.onChange();
      }
    });
  };

  save = (item: ValueType) =>
    this.inTx('readwrite', objectStore =>
      putPromise<KeyType, DbValueType>(objectStore, this.transformBeforeIndexDb(item))
    );

  saveAll = (items: ValueType[]): Promise< KeyType[] > =>
    this.inTx< Promise< KeyType[] > >('readwrite', (objectStore: IDBObjectStore) =>
      Promise.all(items
        .map(item => this.transformBeforeIndexDb(item))
        .map(item => putPromise<KeyType, DbValueType>(objectStore, item))
      )
    );

  addListener = (listener: Listener) => {
    this.listeners.add(listener);
  };

  onChange = () => {
    this.stamp++;
    this.listeners.forEach(listener => listener(this.stamp));
  };

  removeListener = (listener: Listener) => {
    this.listeners.delete(listener);
  };

}
