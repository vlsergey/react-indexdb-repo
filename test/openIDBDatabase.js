export default async function openIDBDatabase( databaseName : string, onUpgradeNeeded : ( IDBDatabase => any ) ) : Promise< IDBDatabase > {
  return new Promise( ( resolve, reject ) => {
    const dbOpenRequest = window.indexedDB.open( databaseName, 1 );

    dbOpenRequest.onblocked = () => reject( 'onblocked' );
    dbOpenRequest.onerror = err => reject( err );
    dbOpenRequest.onsuccess = () => resolve( dbOpenRequest.result );
    dbOpenRequest.onupgradeneeded = event => {
      try {
        const db = event.target.result;
        onUpgradeNeeded( db );
      } catch ( err ) {
        reject( err );
      }
    };
  } );
}
