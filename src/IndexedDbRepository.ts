import ListenableRepository from './ListenableRepository';

type Predicate<V> = (value: V) => boolean;

export default interface IndexedDbRepository<Key extends IDBValidKey, Value>
  extends ListenableRepository {

  readonly database: IDBDatabase;
  readonly findById: (id: Key) => Promise< Value | undefined >;
  readonly findByIds: (ids: Key[]) => Promise< (Value | undefined)[] >;
  readonly objectStoreName: string;

  close: () => void;

  count: () => Promise<number>;

  deleteAll: () => Promise<void>;

  findAll: () => Promise<Value[]>;

  findByPredicate: (predicate: Predicate<Value>) => Promise< Value[] >;

  deleteById: (key: Key) => Promise< void >;

  getKeyToIndexValueMap: (indexName: string) => Promise< Map< Key, IDBValidKey > >;

  /**
   * Delete all records from object store that does NOT match specified predicate
   *
   * @return Keys of removed elements
   */
  retain: (preservePredicate: Key[] | Set<Key> | ((key: Key, value: Value) => boolean)) => Promise< Key[] >;

  onChange: () => unknown;

}
