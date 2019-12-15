// @flow

import Batcher from './Batcher';

type KeyType = any;
type ExtValueType = any;
type DbValueType = any;
type Listener = number => any;
type PredicateType = ExtValueType => boolean;
type TxModeType = 'readonly' | 'readwrite';

function toPromise<T>( request : IDBRequest ) : Promise< T > {
  return new Promise< T >( ( resolve, reject ) => {
    // $FlowFixMe
    request.onsuccess = () => resolve( ( request.result : T ) );
    request.onerror = reject;
  } );
}

function withCursor( request : IDBRequest, callback : IDBCursorWithValue => any ) : Promise< void > {
  return new Promise< void >( ( resolve, reject ) => {
    request.onsuccess = event => {
      try {
        const cursor : ? IDBCursorWithValue = event.target.result;
        if ( cursor ) {
          callback( cursor );
          cursor.continue();
        } else {
          resolve();
        }
      } catch ( error ) {
        reject( error );
      }
    };
    request.onerror = reject;
  } );
}

// Wrap IDB functions into Promises
const deletePromise : ( IDBObjectStore, KeyType ) => Promise< void > =
  ( objectStore : IDBObjectStore, key : KeyType ) => toPromise< void >( objectStore.delete( key ) );
const getAllPromise : ( IDBObjectStore ) => Promise< DbValueType[] > =
  // Yes, we do have getAll() in IDBObjectStore
  // $FlowFixMe
  ( objectStore : IDBObjectStore ) => toPromise< DbValueType[] >( objectStore.getAll() );
const putPromise : ( IDBObjectStore, DbValueType ) => Promise< KeyType > =
  ( objectStore : IDBObjectStore, value : DbValueType ) => toPromise< KeyType >( objectStore.put( value ) );

export default class IndexedDbRepository {

  database : IDBDatabase;
  findById : KeyType => Promise< ?ExtValueType >;
  findByIds : KeyType[] => Promise< ( ?ExtValueType )[] >;
  keyPath : string;
  listeners : Set< Listener >;
  objectStoreName : string;
  // changes marker
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

  _tx<T>( txMode : TxModeType, callback : ( IDBObjectStore => T ) ) : T {
    try {
      const transaction : IDBTransaction = this.database.transaction( [ this.objectStoreName ], txMode );
      const objectStore : IDBObjectStore = transaction.objectStore( this.objectStoreName );
      const result : T = callback( objectStore );
      return result;
    } finally {
      // $FlowFixMe
      if ( txMode === 'readwrite' ) {
        this.onChange(); // notify listeners
      }
    }
  }

  close() : void {
    return this.database.close();
  }

  findAll() : Promise< ExtValueType[] > {
    return this._tx( 'readonly', async objectStore => {
      const dbResults : DbValueType[] = await getAllPromise( objectStore );
      const extResults = dbResults.map( i => this.transformAfterIndexDb( i ) );
      return extResults;
    } );
  }

  _findByIds( keys : KeyType[] ) : Promise< ( ?ExtValueType )[] > {
    if ( keys.length === 0 ) return Promise.resolve( [] );

    const sorted = [ ...new Set( keys ) ];
    sorted.sort( ( a, b ) => window.indexedDB.cmp( a, b ) );

    const minKey : KeyType = sorted[ 0 ];
    const maxKey : KeyType = sorted[ sorted.length - 1 ];
    // $FlowFixMe
    const keyRange : IDBKeyRange = IDBKeyRange.bound( minKey, maxKey );

    return this._tx( 'readonly', objectStore => new Promise<( ?ExtValueType )[] >( ( resolve, reject ) => {
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

  findByPredicate( predicate : PredicateType ) : Promise< ExtValueType[] > {
    return this._tx( 'readonly', async objectStore => {
      const result : ExtValueType[] = [];
      const request : IDBRequest = objectStore.openCursor();
      await withCursor( request, cursor => {
        const dbItem : DbValueType = cursor.value;
        const extItem : ExtValueType = this.transformAfterIndexDb( dbItem );
        if ( predicate( extItem ) ) {
          result.push( extItem );
        }
      } );
      return result;
    } );
  }

  deleteById( key : KeyType ) : Promise< void > {
    return this._tx< Promise< void > >( 'readwrite', objectStore => deletePromise( objectStore, key ) );
  }

  getKeyToIndexValueMap( indexName : string ) : Promise< Map< KeyType, any > > {
    return this._tx( 'readwrite', async objectStore => {
      const index : IDBIndex = objectStore.index( indexName );
      const request : IDBRequest = index.openCursor();

      const result : Map< KeyType, any > = new Map();
      await withCursor( request, cursor => {
        const primaryKey : KeyType = cursor.primaryKey;
        const indexValue : any = cursor.key;
        result.set( primaryKey, indexValue );
      } );

      return result;
    } );
  }

  /**
   * @return Keys of removed elements
   */
  async retain( idsToPreserve : ( KeyType[] | Set< KeyType > ) ) : Promise< KeyType[] > {
    const setToPreserve : Set< KeyType > = new Set( idsToPreserve );
    return this._tx( 'readwrite', async objectStore => {
      const request : IDBRequest = objectStore.openCursor();
      try {
        const result : KeyType[] = [];
        await withCursor( request, cursor => {
          const item = cursor.value;
          const id = item[ this.keyPath ];
          if ( !setToPreserve.has( id ) ) {
            result.push( id );
            cursor.delete();
          }
        } );
        return result;
      } finally {
        this.onChange();
      }
    } );
  }

  save( item : ExtValueType ) : Promise< KeyType > {
    return this._tx( 'readwrite', objectStore => putPromise( objectStore, item ) );
  }

  saveAll( items : ExtValueType[] ) : Promise< KeyType[] > {
    return this._tx< Promise< KeyType[] > >( 'readwrite', objectStore => {
      const promises : Promise< KeyType >[] = items
        .map( item => this.transformBeforeIndexDb( item ) )
        .map( item => putPromise( objectStore, item ) );
      const resultPromise : Promise< KeyType[] > = Promise.all< KeyType[] >( promises );
      return resultPromise;
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
