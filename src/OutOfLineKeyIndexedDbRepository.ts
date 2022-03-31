import IndexedDbRepository from './IndexedDbRepository';

export default interface OutOfLineKeyIndexedDbRepository<Key extends IDBValidKey, Value>
extends IndexedDbRepository<Key, Value> {

  save: (key: Key, item: Value) => Promise<Key>;

}
