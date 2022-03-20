type Listener = (stamp: number) => unknown;
type Predicate<V> = (value: V) => boolean;

interface IndexedDbRepository<KeyType extends IDBValidKey, ValueType> {

  readonly database: IDBDatabase;
  readonly findById: (id: KeyType) => Promise< ValueType | undefined >;
  readonly findByIds: (ids: KeyType[]) => Promise< (ValueType | undefined)[] >;
  readonly keyPath: string;
  readonly objectStoreName: string;
  readonly stamp: number;

  close: () => void;

  findAll: () => Promise<ValueType[]>;

  findByPredicate: (predicate: Predicate<ValueType>) => Promise< ValueType[] >;

  deleteById: (key: KeyType) => Promise< void >;

  getKeyToIndexValueMap: (indexName: string) => Promise< Map< KeyType, IDBValidKey > >;

  /**
   * @return Keys of removed elements
   */
  retain: (idsToPreserve : (KeyType[] | Set< KeyType >)) => Promise< KeyType[] >;

  save: (item: ValueType) => Promise<KeyType>;

  saveAll: (items: ValueType[]) => Promise< KeyType[] >;

  addListener: (listener: Listener) => unknown;

  onChange: () => unknown;

  removeListener: (listener: Listener) => unknown;

}

export default IndexedDbRepository;
