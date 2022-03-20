import {assert} from 'chai';
import React, {PureComponent} from 'react';
import ReactTestUtils from 'react-dom/test-utils';

import IndexedDbRepository from '../src/IndexedDbRepository';
import IndexedDbRepositoryImpl from '../src/IndexedDbRepositoryImpl';
import RepositoryListener from '../src/RepositoryListener';
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
    db.createObjectStore(OBJECT_STORE_NAME, {keyPath: 'id'});
  });

  const repo = new IndexedDbRepositoryImpl<number, Value, Value>(db, OBJECT_STORE_NAME, 'id');
  await repo.saveAll([
    {id: 1, name: 'First'},
    {id: 2, name: 'Second'},
    {id: 3, name: 'Third'},
  ]);
  return repo;
}

interface TestContainerPropsType {
  repo: IndexedDbRepository<number, Value>;
}

class TestContainer extends PureComponent<TestContainerPropsType> {

  handleRepoUpdate = () => { this.forceUpdate(); };

  override render () {
    const {repo} = this.props;
    return <RepositoryListener onChange={this.handleRepoUpdate} repository={repo}>
      <div>{ repo.stamp }</div>
    </RepositoryListener>;
  }
}

describe('RepositoryListener', () => {

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

  it('Can be rendered without children', () => {
    const onChange = () => { /* NOOP */ };
    const rendered = ReactTestUtils.renderIntoDocument(<RepositoryListener onChange={onChange} repository={repo} />);
    assert.ok(rendered);
  });

  it('Listens for changes', async () => {
    let changes = 0;
    const onChange = () => changes++;
    const rendered = ReactTestUtils.renderIntoDocument(<RepositoryListener onChange={onChange} repository={repo} />);
    assert.ok(rendered);
    assert.equal(changes, 0);

    await repo.save({id: 4, name: 'Forth'});
    assert.equal(changes, 1);
    assert.ok(rendered);
  });

  it('Can be used to update children on changes in repo', async () => {
    const rendered = ReactTestUtils.renderIntoDocument(<TestContainer repo={repo} />) as unknown as TestContainer;
    const oldStamp = repo.stamp;
    assert.equal(ReactTestUtils.findRenderedDOMComponentWithTag(rendered, 'div').textContent, String(oldStamp));

    await repo.save({id: 4, name: 'Forth'});
    const newStamp = repo.stamp;
    assert.equal(oldStamp + 1, newStamp);
    assert.equal(ReactTestUtils.findRenderedDOMComponentWithTag(rendered, 'div').textContent, String(newStamp));
  });

});
