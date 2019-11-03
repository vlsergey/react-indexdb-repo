// @flow

export default async function deleteDatabase(
    databaseName : string
) : Promise< IDBDatabase > {
  return new Promise( ( resolve, reject ) => {
    const request : IDBOpenDBRequest = window.indexedDB.deleteDatabase( databaseName );
    request.onsuccess = resolve;
    request.onerror = reject;
  } );
}
