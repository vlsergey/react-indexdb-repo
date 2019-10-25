// @flow

import assert from 'assert';
import IndexedDbRepository from 'IndexedDbRepository';

const OBJECT_STORE_NAME : string = 'TestObjectStore';
const DATABASE_NAME : string = 'TestDatabase';

async function testDbConnection( ) {
  return new Promise( ( resolve, reject ) => {
    const dbOpenRequest = window.indexedDB.open( DATABASE_NAME, 1 );

    dbOpenRequest.onblocked = () => reject( 'onblocked' );
    dbOpenRequest.onerror = err => reject( err );
    dbOpenRequest.onsuccess = () => resolve( dbOpenRequest.result );
    dbOpenRequest.onupgradeneeded = event => {
      try {
        const db = event.target.result;
        try { db.deleteObjectStore( OBJECT_STORE_NAME ); } catch ( err ) { /* NOOP */ }
        db.createObjectStore( OBJECT_STORE_NAME, { keyPath: 'id' } );
      } catch ( err ) {
        reject( err );
      }
    };
  } );
}

async function buildTestRepo() {
  const db = await testDbConnection( );
  const repo = new IndexedDbRepository( db, OBJECT_STORE_NAME, 'id' );
  await repo.saveAll( [
    { id: 1, name: 'First' },
    { id: 2, name: 'Second' },
    { id: 3, name: 'Third' },
  ] );
  return repo;
}

describe( 'IndexedDbRepository', () => {

  describe( 'findById', () => {

    it( 'Return null for incorrect keys', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();
      const value = await repo.findById( 'a' );
      assert.equal( value, null );
    } );

    it( 'Return correct result for correct key', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();
      const value = await repo.findById( 1 );
      assert.equal( value.name, 'First' );
    } );

    it( 'Return correct result for correct keys (two batches)', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const toFetch = [ 1, 2, 3, 1, 2, 3, 3, 2, 1 ];
      const promises = toFetch.map( i => repo.findById( i ) );
      const values = await Promise.all( promises );
      const names = values.map( ( { name } ) => name );
      assert.deepEqual( names, [
        'First',
        'Second',
        'Third',
        'First',
        'Second',
        'Third',
        'Third',
        'Second',
        'First',
      ] );
    } );

  } );

  describe( 'findByIds', () => {

    it( 'Return empty array for empty input', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();
      const values = await repo.findByIds( [ ] );
      assert.deepEqual( values, [ ] );
    } );

    it( 'Return array with nulls for incorrect keys', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();
      const values = await repo.findByIds( [ 'a', 'b', 'c' ] );
      assert.deepEqual( values, [ null, null, null ] );
    } );

    it( 'Return correct result for correct keys', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();
      const values = await repo.findByIds( [ 3, 2 ] );
      const names = values.map( ( { name } ) => name );
      assert.deepEqual( names, [ 'Third', 'Second' ] );
    } );

    it( 'Return correct result for correct keys (two batches)', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const toFetch = [ [ 3, 2 ], [ 1, 2 ], [ 2, 3 ] ];
      const promises = toFetch.map( ids => repo.findByIds( ids ) );
      const values = await Promise.all( promises );
      const names = values.map( arr => arr.map( ( { name } ) => name ) );
      assert.deepEqual( names, [ [ 'Third', 'Second' ], [ 'First', 'Second' ], [ 'Second', 'Third' ] ] );
    } );

  } );

} );