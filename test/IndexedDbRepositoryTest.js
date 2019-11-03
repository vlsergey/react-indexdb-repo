// @flow

import assert from 'assert';
import IndexedDbRepository from 'IndexedDbRepository';
import openIDBDatabase from './openIDBDatabase';

const OBJECT_STORE_NAME : string = 'TestObjectStore';
const DATABASE_NAME : string = 'TestDatabase';

async function buildTestRepo() {
  const db = await openIDBDatabase( DATABASE_NAME, db => {
    try { db.deleteObjectStore( OBJECT_STORE_NAME ); } catch ( err ) { /* NOOP */ }
    const objectStore = db.createObjectStore( OBJECT_STORE_NAME, { keyPath: 'id' } );
    objectStore.createIndex( 'name_index', 'name', {
      multiEntry: true,
      locale: 'auto', // Firefox-only (43+)
    } );
  } );

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

  describe( 'findByPredicate', () => {
    it( 'Returns all elements with "always true" predicate', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const actual : number[] = ( await repo.findByPredicate( () => true ) )
        .map( ( { id } ) => id );
      assert.deepEqual( actual, [ 1, 2, 3 ] );
    } );
    it( 'Returns correct elements with predicate', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const actual : number[] = ( await repo.findByPredicate( ( { name } ) => name.length === 5 ) )
        .map( ( { id } ) => id );
      assert.deepEqual( actual, [ 1, 3 ] );
    } );
    it( 'Returns none elements with "always false" predicate', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const actual : number[] = ( await repo.findByPredicate( () => false ) )
        .map( ( { id } ) => id );
      assert.deepEqual( actual, [ ] );
    } );
  } );

  describe( 'getKeyToIndexValueMap', () => {
    it( 'Returns correct map for existing index', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();
      const result = await repo.getKeyToIndexValueMap( 'name_index' );

      assert.deepEqual( [ ...result.entries() ], [ [ 1, 'First' ], [ 2, 'Second' ], [ 3, 'Third' ] ] );
    } );
  } );

  describe( 'retain', () => {
    it( 'Correctly cleanup repository with Set argument', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const deleted = await repo.retain( new Set( [ 3, 1 ] ) );
      const preserved : number[] = ( await repo.findAll( ) ).map( ( { id } ) => id );

      assert.deepEqual( deleted, [ 2 ] );
      assert.deepEqual( preserved, [ 1, 3 ] );
    } );
    it( 'Correctly cleanup repository with Array argument', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const deleted = await repo.retain( [ 3, 1 ] );
      const preserved : number[] = ( await repo.findAll( ) ).map( ( { id } ) => id );

      assert.deepEqual( deleted, [ 2 ] );
      assert.deepEqual( preserved, [ 1, 3 ] );
    } );
    it( 'Deletes all elements on empty input', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const deleted = await repo.retain( [] );
      const preserved : number[] = ( await repo.findAll( ) ).map( ( { id } ) => id );

      assert.deepEqual( deleted, [ 1, 2, 3 ] );
      assert.deepEqual( preserved, [ ] );
    } );
    it( 'Deletes all elements on input with incorrect keys', async() => {
      const repo : IndexedDbRepository = await buildTestRepo();

      const deleted = await repo.retain( [ 4, 5, 6 ] );
      const preserved : number[] = ( await repo.findAll( ) ).map( ( { id } ) => id );

      assert.deepEqual( deleted, [ 1, 2, 3 ] );
      assert.deepEqual( preserved, [ ] );
    } );
  } );

} );
