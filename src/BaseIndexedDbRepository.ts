import Batcher from '@vlsergey/batcher';

import IndexedDbRepository from './IndexedDbRepository';
import {clearPromise, countPromise, deletePromise, getAllPromise} from './ObjectStorePromises';

type Listener = (stamp: number) => unknown;
type Predicate<V> = (value: V) => boolean;
type TxModeType = 'readonly' | 'readwrite';

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


export default class BaseIndexedDbRepository<Key extends IDBValidKey, DbValue, Value>
implements IndexedDbRepository<Key, Value> {

  database: IDBDatabase;
  findById: (id: Key) => Promise< Value | undefined >;
  findByIds: (ids: Key[]) => Promise< (Value | undefined)[] >;
  listeners: Set< Listener >;
  objectStoreName: string;
  // changes marker
  stamp: number;
  transformAfterIndexDb: (value: DbValue) => Value;
  transformBeforeIndexDb: (value: Value) => DbValue;

  constructor (database: IDBDatabase, objectStoreName: string) {
    this.database = database;
    this.listeners = new Set();
    this.objectStoreName = objectStoreName;
    this.stamp = 0;
    this.transformAfterIndexDb = x => x as unknown as Value;
    this.transformBeforeIndexDb = x => x as unknown as DbValue;

    const findByIdBatcher = new Batcher<Key, Value | undefined>(this._findByIds);
    this.findById = (key: Key) => findByIdBatcher.queue(key);
    this.findByIds = (keys: Key[]) => findByIdBatcher.queueAll(...keys);
  }

  protected readonly inTx = <T>(txMode: TxModeType, callback : ((objectStore: IDBObjectStore) => T)): T => {
    try {
      const transaction = this.database.transaction([this.objectStoreName], txMode);
      const objectStore = transaction.objectStore(this.objectStoreName);
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
    const dbResults: DbValue[] = await getAllPromise(objectStore);
    return dbResults.map(i => this.transformAfterIndexDb(i));
  });

  private readonly _findByIds = (keys: Key[]): Promise< (Value | undefined)[] > => {
    if (keys.length === 0) return Promise.resolve([]);

    const sorted = [...new Set(keys)];
    sorted.sort((a, b) => window.indexedDB.cmp(a, b));

    const minKey: Key = sorted[0]!;
    const maxKey: Key = sorted[sorted.length - 1]!;
    const keyRange = IDBKeyRange.bound(minKey, maxKey);

    type ResultValues = (Value | undefined)[];
    return this.inTx('readonly', (objectStore: IDBObjectStore) => new Promise< ResultValues >((resolve, reject) => {
      const request = objectStore.openCursor(keyRange, 'next');
      const result = new Map() as Map< Key, Value >;

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
            result.set(expectedKey, this.transformAfterIndexDb(cursor.value as DbValue));
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

  findByPredicate = (predicate: Predicate<Value>): Promise< Value[] > =>
    this.inTx('readonly', async objectStore => {
      const result: Value[] = [];
      const request = objectStore.openCursor();
      await withCursor(request, cursor => {
        const extItem = this.transformAfterIndexDb(cursor.value as DbValue);
        if (predicate(extItem)) {
          result.push(extItem);
        }
      });
      return result;
    });

  deleteAll = (): Promise<void> =>
    this.inTx('readwrite', objectStore => clearPromise(objectStore));

  deleteById = (key: Key): Promise< void > =>
    this.inTx< Promise< void > >('readwrite', objectStore => deletePromise(objectStore, key));

  getKeyToIndexValueMap = (indexName: string): Promise< Map< Key, IDBValidKey > > =>
    this.inTx('readwrite', async objectStore => {
      const index = objectStore.index(indexName);
      const request = index.openCursor();

      const result: Map< Key, IDBValidKey > = new Map();
      await withCursor(request, cursor => {
        const primaryKey = cursor.primaryKey as Key;
        const indexValue = cursor.key;
        result.set(primaryKey, indexValue);
      });

      return result;
    });

  retain = async (preservePredicate: Key[] | Set<Key> | ((key: Key, value: Value) => boolean)): Promise< Key[] > => {
    if (Array.isArray(preservePredicate)) {
      preservePredicate = new Set(preservePredicate);
    }
    if (preservePredicate instanceof Set) {
      const asSet = preservePredicate;
      preservePredicate = (key: Key) => asSet.has(key);
    }
    const actualPreservePredicate = preservePredicate as ((key: Key, value: Value) => boolean);

    return this.inTx('readwrite', async objectStore => {
      const request = objectStore.openCursor();
      try {
        const result: Key[] = [];
        await withCursor(request, cursor => {
          const key = cursor.primaryKey as Key;
          const dbValue = cursor.value as DbValue;
          const value = this.transformAfterIndexDb(dbValue);
          if (!actualPreservePredicate(key, value)) {
            result.push(key);
            cursor.delete();
          }
        });
        return result;
      } finally {
        this.onChange();
      }
    });
  };

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
