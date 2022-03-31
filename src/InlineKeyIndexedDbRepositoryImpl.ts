import BaseIndexedDbRepository from './BaseIndexedDbRepository';
import InlineKeyIndexedDbRepository from './InlineKeyIndexedDbRepository';
import {putPromise} from './ObjectStorePromises';

export default class InlineKeyIndexedDbRepositoryImpl<
  KeyPath extends string,
  Key extends IDBValidKey,
  DbValue extends {[K in KeyPath]: IDBValidKey},
  Value
> extends BaseIndexedDbRepository<Key, DbValue, Value>
  implements InlineKeyIndexedDbRepository<Key, Value> {

  constructor (database: IDBDatabase, objectStoreName: string) {
    super(database, objectStoreName);
  }

  save = (item: Value): Promise<Key> => this.inTx('readwrite', objectStore =>
    putPromise<Key, DbValue>(objectStore, this.transformBeforeIndexDb(item))
  );

  saveAll = (items: Value[]): Promise< Key[] > =>
    this.inTx< Promise< Key[] > >('readwrite', (objectStore: IDBObjectStore) =>
      Promise.all(items
        .map(item => this.transformBeforeIndexDb(item))
        .map(item => putPromise<Key, DbValue>(objectStore, item))
      )
    );

}
