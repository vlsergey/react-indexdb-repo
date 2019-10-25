// @flow

import Batcher from './Batcher';

type KeyType = number | string;
type ExtValueType = any;
type DbValueType = any;
type Listener = number => any;

// Оборачиваем функции от ObjectStore, поддерживающие интерфейс IDBRequest
// в вызов с использованием Promise
function wrap( methodName : string ) : any {
  return function() {
    const [ objectStore, ...etc ] = arguments;
    return new Promise( ( resolve, reject ) => {
      const request : IDBRequest = objectStore[ methodName ]( ...etc );
      request.onsuccess = () => resolve( request.result );
      request.onerror = reject;
    } );
  };
}
const deletePromise : ( IDBObjectStore, KeyType ) => Promise< any > = wrap( 'delete' );
const getAllPromise : ( IDBObjectStore ) => Promise< DbValueType[] > = wrap( 'getAll' );
const putPromise : ( IDBObjectStore, DbValueType ) => Promise< any > = wrap( 'put' );

export default class IndexedDbRepository {

  database : IDBDatabase;
  findById : KeyType => Promise< ?ExtValueType >;
  findByIds : KeyType[] => Promise< ( ?ExtValueType )[] >;
  keyPath : string;
  listeners : Set< Listener >;
  objectStoreName : string;
  stamp : number;
  transformAfterIndexDb : DbValueType => ExtValueType;
  transformBeforeIndexDb : ExtValueType => DbValueType;

  constructor( database : IDBDatabase, objectStoreName : string, keyPath : string ) {
    this.database = database;
    this.keyPath = keyPath;
    this.listeners = new Set();
    this.objectStoreName = objectStoreName;
    this.stamp = 0;
    this.transformAfterIndexDb = x => ( ( x : any ) : ExtValueType );
    this.transformBeforeIndexDb = x => ( ( x : any ) : DbValueType );

    const findByIdBatcher = new Batcher( this._findByIds.bind( this ) );
    this.findById = findByIdBatcher.queue.bind( findByIdBatcher );
    this.findByIds = findByIdBatcher.queueAll.bind( findByIdBatcher );
  }

  _tx( txMode : ( 'readonly' | 'readwrite' ), callback : ( IDBObjectStore => any ) ) : any {
    try {
      const transaction : IDBTransaction = this.database.transaction( [ this.objectStoreName ], txMode );
      const objectStore : IDBObjectStore = transaction.objectStore( this.objectStoreName );
      const result = callback( objectStore );
      return result;
    } finally {
      // $FlowFixMe
      if ( txMode === 'readwrite' ) {
        this.onChange(); // notify listeners
      }
    }
  }

  findAll() : Promise< ExtValueType[] > {
    return this._tx( 'readonly', async objectStore => {
      const dbResults : DbValueType[] = await getAllPromise( objectStore );
      const extResults = dbResults.map( i => this.transformAfterIndexDb( i ) );
      return extResults;
    } );
  }

  _findByIds( keys : KeyType[] ) : Promise< ExtValueType[] > {
    if ( keys.length === 0 ) return Promise.resolve( [] );

    const sorted = [ ...new Set( keys ) ];
    sorted.sort( ( a, b ) => window.indexedDB.cmp( a, b ) );

    const minKey : KeyType = sorted[ 0 ];
    const maxKey : KeyType = sorted[ sorted.length - 1 ];
    // $FlowFixMe
    const keyRange : IDBKeyRange = IDBKeyRange.bound( minKey, maxKey );

    return this._tx( 'readonly', objectStore => new Promise( ( resolve, reject ) => {
      const request : IDBRequest = objectStore.openCursor( keyRange, 'next' );
      const result : Map< KeyType, ExtValueType > = new Map();

      let currentIndex = 0;
      request.onsuccess = event => {
        const cursor : ?IDBCursorWithValue = event.target.result;

        while ( currentIndex < sorted.length ) {
          if ( !cursor ) {
            currentIndex++;
            continue;
          }

          const expectedKey : KeyType = sorted[ currentIndex ];
          const actualKey : KeyType = cursor.key;
          const cmp = window.indexedDB.cmp( expectedKey, actualKey );
          if ( cmp < 0 ) {
            currentIndex++;
            continue;
          }
          if ( cmp === 0 ) {
            result.set( expectedKey, this.transformAfterIndexDb( cursor.value ) );
            currentIndex++;
            continue;
          }
          if ( cmp > 0 ) {
            cursor.continue( expectedKey );
            return;
          }
        }

        // currentIndex === sorted.length
        const originalSortResults : ( ?ExtValueType )[] = keys.map( key => result.get( key ) );
        resolve( originalSortResults );
      };
      request.onerror = reject;
    } ) );
  }

  deleteById( key : KeyType ) : Promise< any > {
    return this._tx( 'readwrite', objectStore => deletePromise( objectStore, key ) );
  }

  save( item : ExtValueType ) : Promise< any > {
    return this._tx( 'readwrite', objectStore => putPromise( objectStore, item ) );
  }

  saveAll( items : ExtValueType[] ) : Promise< any > {
    return this._tx( 'readwrite', objectStore => {
      const promises : Promise< any >[] = items
        .map( item => this.transformBeforeIndexDb( item ) )
        .map( item => putPromise( objectStore, item ) );
      return Promise.all( promises );
    } );
  }

  addListener( listener : Listener ) {
    this.listeners.add( listener );
  }

  onChange() {
    this.stamp++;
    this.listeners.forEach( listener => listener( this.stamp ) );
  }

  removeListener( listener : Listener ) {
    this.listeners.delete( listener );
  }

}