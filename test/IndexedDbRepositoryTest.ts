import {assert} from 'chai';

import IndexedDbRepository from '../src/IndexedDbRepository';
import IndexedDbRepositoryImpl from '../src/IndexedDbRepositoryImpl';
import deleteDatabase from './deleteDatabase';
import openDatabase from './openDatabase';

const OBJECT_STORE_NAME = 'TestObjectStore';
const DATABASE_NAME = 'TestDatabase';

interface Value {
  id: number;
  name: string;
}

async function buildTestRepo (): Promise<IndexedDbRepository<number, Value>> {
  const db = await openDatabase(DATABASE_NAME, db => {
    try { db.deleteObjectStore(OBJECT_STORE_NAME); } catch (err) { /* NOOP */ }
    const objectStore = db.createObjectStore(OBJECT_STORE_NAME, {keyPath: 'id'});
    objectStore.createIndex('name_index', 'name', {
      multiEntry: true,
      // @ts-expect-error Firefox-only (43+)
      locale: 'auto',
    });
  });

  const repo = new IndexedDbRepositoryImpl<number, Value, Value>(db, OBJECT_STORE_NAME, 'id');
  await repo.saveAll([
    {id: 1, name: 'First'},
    {id: 2, name: 'Second'},
    {id: 3, name: 'Third'},
  ]);
  return repo;
}

describe('IndexedDbRepository', () => {

  let repo: IndexedDbRepository<number, Value>;
  beforeEach(async () => {
    repo = await buildTestRepo();
  });
  afterEach(async () => {
    if (repo != null) {
      repo.close();
      await deleteDatabase(DATABASE_NAME);
    }
  });

  describe('findById', () => {

    it('Return null for incorrect keys', async () => {
      const value = await repo.findById('a' as unknown as number);
      assert.equal(value, null);
    });

    it('Return correct result for correct key', async () => {
      const value = await repo.findById(1);
      assert.equal(value?.name, 'First');
    });

    it('Return correct result for correct keys (two batches)', async () => {
      const toFetch = [1, 2, 3, 1, 2, 3, 3, 2, 1];
      const promises = toFetch.map(i => repo.findById(i));
      const values = await Promise.all(promises);
      const names = values.map(value => value?.name);
      assert.deepEqual(names, [
        'First',
        'Second',
        'Third',
        'First',
        'Second',
        'Third',
        'Third',
        'Second',
        'First',
      ]);
    });

  });

  describe('findByIds', () => {

    it('Return empty array for empty input', async () => {
      const values = await repo.findByIds([]);
      assert.deepEqual(values, []);
    });

    it('Return array with undefineds for incorrect keys', async () => {
      const values = await repo.findByIds(['a', 'b', 'c'] as unknown as number[]);
      assert.deepEqual(values, [undefined, undefined, undefined]);
    });

    it('Return correct result for correct keys', async () => {
      const values = await repo.findByIds([3, 2]);
      const names = values.map(value => value?.name);
      assert.deepEqual(names, ['Third', 'Second']);
    });

    it('Return correct result for correct keys (two batches)', async () => {
      const toFetch = [[3, 2], [1, 2], [2, 3]];
      const promises = toFetch.map(ids => repo.findByIds(ids));
      const values = await Promise.all(promises);
      const names = values.map(arr => arr.map(value => value?.name));
      assert.deepEqual(names, [['Third', 'Second'], ['First', 'Second'], ['Second', 'Third']]);
    });

  });

  describe('findByPredicate', () => {
    it('Returns all elements with "always true" predicate', async () => {
      const actual: number[] = (await repo.findByPredicate(() => true))
        .map(({id}) => id);
      assert.deepEqual(actual, [1, 2, 3]);
    });
    it('Returns correct elements with predicate', async () => {
      const actual: number[] = (await repo.findByPredicate(({name}) => name.length === 5))
        .map(({id}) => id);
      assert.deepEqual(actual, [1, 3]);
    });
    it('Returns none elements with "always false" predicate', async () => {
      const actual: number[] = (await repo.findByPredicate(() => false))
        .map(({id}) => id);
      assert.deepEqual(actual, []);
    });
  });

  describe('getKeyToIndexValueMap', () => {
    it('Returns correct map for existing index', async () => {
      const result = await repo.getKeyToIndexValueMap('name_index');

      assert.deepEqual([...result.entries()], [[1, 'First'], [2, 'Second'], [3, 'Third']]);
    });
  });

  describe('retain', () => {
    it('Correctly cleanup repository with Set argument', async () => {
      const deleted = await repo.retain(new Set([3, 1]));
      const preserved: number[] = (await repo.findAll()).map(({id}) => id);

      assert.deepEqual(deleted, [2]);
      assert.deepEqual(preserved, [1, 3]);
    });
    it('Correctly cleanup repository with Array argument', async () => {
      const deleted = await repo.retain([3, 1]);
      const preserved: number[] = (await repo.findAll()).map(({id}) => id);

      assert.deepEqual(deleted, [2]);
      assert.deepEqual(preserved, [1, 3]);
    });
    it('Deletes all elements on empty input', async () => {
      const deleted = await repo.retain([]);
      const preserved: number[] = (await repo.findAll()).map(({id}) => id);

      assert.deepEqual(deleted, [1, 2, 3]);
      assert.deepEqual(preserved, []);
    });
    it('Deletes all elements on input with incorrect keys', async () => {
      const deleted = await repo.retain([4, 5, 6]);
      const preserved: number[] = (await repo.findAll()).map(({id}) => id);

      assert.deepEqual(deleted, [1, 2, 3]);
      assert.deepEqual(preserved, []);
    });
  });

});
