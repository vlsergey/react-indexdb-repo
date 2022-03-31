function toPromise<T> (request: IDBRequest): Promise< T > {
  return new Promise< T >((resolve, reject) => {
    request.onsuccess = () => { resolve(request.result as T); };
    request.onerror = reject;
  });
}

// Wrap IDB functions into Promises

export const clearPromise = (objectStore: IDBObjectStore) => toPromise<void>(objectStore.clear());

export const countPromise = (objectStore: IDBObjectStore, query?: IDBValidKey | IDBKeyRange) => toPromise<number>(objectStore.count(query));

export const deletePromise = <Key extends IDBValidKey>(objectStore: IDBObjectStore, key: Key) => toPromise<void>(objectStore.delete(key));

export const getAllPromise = <DbValueType>(objectStore: IDBObjectStore) => toPromise< DbValueType[] >(objectStore.getAll());

export const putPromise = <Key extends IDBValidKey, DbValueType>(objectStore: IDBObjectStore, value: DbValueType, key?: Key) =>
  toPromise<Key>(objectStore.put(value, key));
