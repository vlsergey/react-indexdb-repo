// @flow

export default function installFromPrefixes() {
  if ( !window.indexedDB ) window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
  if ( !window.IDBTransaction ) window.IDBTransaction = window.webkitIDBTransaction || window.msIDBTransaction;
  if ( !window.IDBKeyRange ) window.IDBKeyRange = window.webkitIDBKeyRange || window.msIDBKeyRange;
  if ( !window.indexedDB ) throw new Error( 'IndexedDB is not awailable' );
}
