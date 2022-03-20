/* eslint @typescript-eslint/no-unsafe-argument: 0 */
/* eslint @typescript-eslint/no-unsafe-assignment: 0 */

export default function installFromPrefixes () {
  // @ts-expect-error prefixed values
  if (!window.indexedDB) window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  // @ts-expect-error prefixed values
  if (!window.IDBTransaction) window.IDBTransaction = window.webkitIDBTransaction || window.msIDBTransaction;
  // @ts-expect-error prefixed values
  if (!window.IDBKeyRange) window.IDBKeyRange = window.webkitIDBKeyRange || window.msIDBKeyRange;
  if (!window.indexedDB) throw new Error('IndexedDB is not awailable');
}
