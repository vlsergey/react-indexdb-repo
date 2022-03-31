import {assert} from 'chai';
import React, {PureComponent, ReactNode} from 'react';
import ReactTestUtils from 'react-dom/test-utils';

import {connect, InlineKeyIndexedDbRepository, InlineKeyIndexedDbRepositoryImpl} from '../src';
import deleteDatabase from './deleteDatabase';
import openDatabase from './openDatabase';

const OBJECT_STORE_NAME = 'TestObjectStore';
const DATABASE_NAME = 'TestDatabase';

interface Value {
  id: number;
  name: string;
}

async function buildTestRepo (): Promise<InlineKeyIndexedDbRepository<number, Value>> {
  const db = await openDatabase(DATABASE_NAME, db => {
    try { db.deleteObjectStore(OBJECT_STORE_NAME); } catch (err) { /* NOOP */ }
    db.createObjectStore(OBJECT_STORE_NAME, {keyPath: 'id'});
  });

  const repo = new InlineKeyIndexedDbRepositoryImpl<'id', number, Value, Value>(db, OBJECT_STORE_NAME);
  await repo.save({id: 1, name: 'First'});
  return repo;
}

interface ContainerPropsType {
  children: ReactNode;
}

class Container extends PureComponent<ContainerPropsType> {
  override render () {
    return this.props.children;
  }
}

interface TestContainerPropsType {
  // eslint-disable-next-line react/no-unused-prop-types
  id: number;
  data?: {id: number; name: string} | null | undefined;
  doUpdate?: () => unknown;
  // eslint-disable-next-line react/no-unused-prop-types
  repo: InlineKeyIndexedDbRepository<number, Value>;
}

class TestComponent extends PureComponent<TestContainerPropsType> {

  handleRepoUpdate = () => { this.forceUpdate(); };

  override render () {
    const {data, doUpdate} = this.props;
    return !data
      ? <span>No data</span>
      : <span onClick={doUpdate}>{data.name}</span>;
  }
}

let testSavePromise: Promise<unknown> | null = null;

const mapPropsToRepo = ({repo}: TestContainerPropsType) => repo;
const extractMemoArgs = ({id}: TestContainerPropsType) => ({id});
const mapRepoToProps = (repo: InlineKeyIndexedDbRepository<number, Value>, {id}: TestContainerPropsType) => ({
  data: repo.findById(id),
});
const mapRepoToActions = (repo: InlineKeyIndexedDbRepository<number, Value>, {id}: TestContainerPropsType) => ({
  doUpdate: () => { testSavePromise = repo.save({id, name: 'First Updated'}); },
});

const TestComponentConnected = connect(mapPropsToRepo, extractMemoArgs, mapRepoToProps, mapRepoToActions)(TestComponent);

describe('connect()', () => {

  let repo: InlineKeyIndexedDbRepository<number, Value>;
  beforeEach(async () => {
    repo = await buildTestRepo();
  });
  afterEach(async () => {
    if (repo != null) {
      repo.close();
      await deleteDatabase(DATABASE_NAME);
    }
  });

  it('Can be used to retrive data from IndexedDbRepository and update it with actions', async () => {
    const rendered = ReactTestUtils.renderIntoDocument(<Container>
      <TestComponentConnected id={1} repo={repo} />
    </Container>) as unknown as Container;
    assert.ok(rendered);

    assert.equal(ReactTestUtils.findRenderedDOMComponentWithTag(rendered, 'span').textContent, 'No data');

    // since single queue of find() is used, we can use find as thread-barrier
    await repo.findById(0);

    assert.equal(ReactTestUtils.findRenderedDOMComponentWithTag(rendered, 'span').textContent, 'First');

    // click on element to trigger update action
    ReactTestUtils.Simulate.click(ReactTestUtils.findRenderedDOMComponentWithTag(rendered, 'span'));
    await testSavePromise;

    // we triggered findById() call, but it may not be completed yet,
    // and TestComponent is still populated with old data, so...
    // since single queue of find() is used, we can use find as thread-barrier
    await repo.findById(0);

    assert.equal(ReactTestUtils.findRenderedDOMComponentWithTag(rendered, 'span').textContent, 'First Updated');
  });

});
