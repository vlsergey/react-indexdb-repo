// @flow

import React, { PureComponent } from 'react';
import assert from 'assert';
import IndexedDbRepository from 'IndexedDbRepository';
import openIDBDatabase from './openIDBDatabase';
import ReactTestUtils from 'react-dom/test-utils';
import RepositoryListener from 'RepositoryListener';

const OBJECT_STORE_NAME : string = 'TestObjectStore';
const DATABASE_NAME : string = 'TestDatabase';

async function buildTestRepo() {
  const db = await openIDBDatabase( DATABASE_NAME, db => {
    try { db.deleteObjectStore( OBJECT_STORE_NAME ); } catch ( err ) { /* NOOP */ }
    db.createObjectStore( OBJECT_STORE_NAME, { keyPath: 'id' } );
  } );

  const repo = new IndexedDbRepository( db, OBJECT_STORE_NAME, 'id' );
  await repo.saveAll( [
    { id: 1, name: 'First' },
    { id: 2, name: 'Second' },
    { id: 3, name: 'Third' },
  ] );
  return repo;
}

type TestContainerPropsType = {
  repo : IndexedDbRepository,
};

class TestContainer extends PureComponent<TestContainerPropsType> {
  constructor() {
    super( ...arguments );
    this.handleRepoUpdate = () => this.forceUpdate();
  }

  render() {
    const { repo } = this.props;
    return <RepositoryListener onChange={this.handleRepoUpdate} repository={repo}>
      <div>{ repo.stamp }</div>
    </RepositoryListener>;
  }
}

describe( 'RepositoryListener', () => {

  it( 'Can be rendered without children', async() => {
    const repo : IndexedDbRepository = await buildTestRepo();
    const onChange = () => {};
    const rendered = ReactTestUtils.renderIntoDocument( <RepositoryListener onChange={onChange} repository={repo} /> );
    assert.ok( rendered );
  } );

  it( 'Listens for changes', async() => {
    const repo : IndexedDbRepository = await buildTestRepo();

    let changes = 0;
    const onChange = () => changes++;
    const rendered = ReactTestUtils.renderIntoDocument( <RepositoryListener onChange={onChange} repository={repo} /> );
    assert.ok( rendered );
    assert.equal( changes, 0 );

    await repo.save( { id: 4, name: 'Forth' } );
    assert.equal( changes, 1 );
    assert.ok( rendered );
  } );

  it( 'Can be used to update children on changes in repo', async() => {
    const repo : IndexedDbRepository = await buildTestRepo();

    const rendered = ReactTestUtils.renderIntoDocument( <TestContainer repo={repo} /> );
    const oldStamp = repo.stamp;
    assert.equal( ReactTestUtils.findRenderedDOMComponentWithTag( rendered, 'div' ).textContent, String( oldStamp ) );

    await repo.save( { id: 4, name: 'Forth' } );
    const newStamp = repo.stamp;
    assert.equal( oldStamp + 1, newStamp );
    assert.equal( ReactTestUtils.findRenderedDOMComponentWithTag( rendered, 'div' ).textContent, String( newStamp ) );
  } );

} );
