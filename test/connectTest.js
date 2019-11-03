import React, { PureComponent } from 'react';
import assert from 'assert';
import connect from '../src/connect';
import deleteDatabase from './deleteDatabase';
import IndexedDbRepository from '../src/IndexedDbRepository';
import openDatabase from './openDatabase';
import ReactTestUtils from 'react-dom/test-utils';

const OBJECT_STORE_NAME : string = 'TestObjectStore';
const DATABASE_NAME : string = 'TestDatabase';

async function buildTestRepo() {
  const db = await openDatabase( DATABASE_NAME, db => {
    try { db.deleteObjectStore( OBJECT_STORE_NAME ); } catch ( err ) { /* NOOP */ }
    db.createObjectStore( OBJECT_STORE_NAME, { keyPath: 'id' } );
  } );

  const repo = new IndexedDbRepository( db, OBJECT_STORE_NAME, 'id' );
  await repo.saveAll( [
    { id: 1, name: 'First' },
  ] );
  return repo;
}

type ContainerPropsType = {
  children : any,
};

class Container extends PureComponent<ContainerPropsType> {
  render() {
    return this.props.children;
  }
}

type TestContainerPropsType = {
  data? : ?{
    id : number,
    name : string
  },
  doUpdate : any => any,
};

class TestComponent extends PureComponent<TestContainerPropsType> {
  constructor() {
    super( ...arguments );
    this.handleRepoUpdate = () => this.forceUpdate();
  }

  render() {
    const { data, doUpdate } = this.props;
    return !data
      ? <span>No data</span>
      : <span onClick={doUpdate}>{data.name}</span>;
  }
}

let testSavePromise = null;

const mapPropsToRepo = ( { repo } ) => repo;
const mapRepoToProps = ( repo, { id } ) => ( {
  data: repo.findById( id ),
} );
const mapRepoToActions = ( repo, { id } ) => ( {
  doUpdate: () => { testSavePromise = repo.save( { id, name: 'First Updated' } ); },
} );

const TestComponentConnected = connect( mapPropsToRepo )( mapRepoToProps, mapRepoToActions )( TestComponent );

describe( 'RepositoryListener', () => {

  let repo : IndexedDbRepository;
  beforeEach( async() => {
    repo = await buildTestRepo();
  } );
  afterEach( async() => {
    if ( repo != null ) {
      repo.close();
      await deleteDatabase( DATABASE_NAME );
    }
  } );

  it( 'Can be used to retrive data from IndexedDbRepository and update it with actions', async() => {
    const rendered = ReactTestUtils.renderIntoDocument( <Container>
      <TestComponentConnected id={1} repo={repo} />
    </Container> );
    assert.ok( rendered );

    assert.equal( ReactTestUtils.findRenderedDOMComponentWithTag( rendered, 'span' ).textContent, 'No data' );

    // since single queue of find() is used, we can use find as thread-barrier
    await repo.findById( 0 );

    assert.equal( ReactTestUtils.findRenderedDOMComponentWithTag( rendered, 'span' ).textContent, 'First' );

    // click on element to trigger update action
    await ReactTestUtils.Simulate.click( ReactTestUtils.findRenderedDOMComponentWithTag( rendered, 'span' ) );
    await testSavePromise;

    // we triggered findById() call, but it may not be completed yet,
    // and TestComponent is still populated with old data, so...
    // since single queue of find() is used, we can use find as thread-barrier
    await repo.findById( 0 );

    assert.equal( ReactTestUtils.findRenderedDOMComponentWithTag( rendered, 'span' ).textContent, 'First Updated' );
  } );

} );
