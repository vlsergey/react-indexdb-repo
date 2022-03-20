import {assert} from 'chai';

export default async function openDatabase (
    databaseName: string,
    onUpgradeNeeded: (db: IDBDatabase) => unknown
): Promise< IDBDatabase > {
  assert.ok(window.indexedDB, 'IndexDB is not present in window context');

  return new Promise((resolve, reject) => {
    const dbOpenRequest = window.indexedDB.open(databaseName, 1);

    dbOpenRequest.onblocked = () => { reject('onblocked'); };
    dbOpenRequest.onerror = err => { reject(err); };
    dbOpenRequest.onsuccess = () => { resolve(dbOpenRequest.result); };
    dbOpenRequest.onupgradeneeded = () => {
      try {
        onUpgradeNeeded(dbOpenRequest.result);
      } catch (err) {
        reject(err);
      }
    };
  });
}
