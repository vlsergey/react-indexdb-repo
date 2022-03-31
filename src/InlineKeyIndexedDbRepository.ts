import IndexedDbRepository from './IndexedDbRepository';

export default interface InLineKeyIndexedDbRepository<Key extends IDBValidKey, Value>
extends IndexedDbRepository<Key, Value> {

  save: (item: Value) => Promise<Key>;

  saveAll: (items: Value[]) => Promise< Key[] >;

}
