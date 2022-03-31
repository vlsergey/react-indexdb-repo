import BaseIndexedDbRepository from './BaseIndexedDbRepository';
import {putPromise} from './ObjectStorePromises';
import OutOfLineKeyIndexedDbRepository from './OutOfLineKeyIndexedDbRepository';

export default class OutOfLineKeyIndexedDbRepositoryImpl<
  KeyPath extends string,
  KeyType extends IDBValidKey,
  DbValueType extends {[K in KeyPath]: IDBValidKey},
  ValueType
> extends BaseIndexedDbRepository<KeyType, DbValueType, ValueType>
  implements OutOfLineKeyIndexedDbRepository<KeyType, ValueType> {

  constructor (database: IDBDatabase, objectStoreName: string) {
    super(database, objectStoreName);
  }

  save = (key: KeyType, item: ValueType): Promise<KeyType> => this.inTx('readwrite', objectStore =>
    putPromise<KeyType, DbValueType>(objectStore, this.transformBeforeIndexDb(item), key)
  );

}
