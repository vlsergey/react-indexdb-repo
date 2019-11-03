# @vlsergey/react-indexdb-repo

React Components to work with IndexDB repositories.

[![Build Status](https://travis-ci.org/vlsergey/react-indexdb-repo.svg?branch=master)](https://travis-ci.org/vlsergey/react-indexdb-repo)

# Usage example

## Data access and update
```javascript
async function dbConnection( ) {
  return new Promise( ( resolve, reject ) => {
    const dbOpenRequest = window.indexedDB.open( 'TestDatabase', 1 );

    dbOpenRequest.onblocked = () => reject( 'onblocked' );
    dbOpenRequest.onerror = err => reject( err );
    dbOpenRequest.onsuccess = () => resolve( dbOpenRequest.result );
    dbOpenRequest.onupgradeneeded = event => {
      try {
        const db = event.target.result;
        try { db.deleteObjectStore( 'TestObjectStore' ); } catch ( err ) { /* NOOP */ }
        db.createObjectStore( 'TestObjectStore', { keyPath: 'id' } );
      } catch ( err ) {
        reject( err );
      }
    };
  } );
}

const db = await testDbConnection( );
const repo = new IndexedDbRepository( db, 'TestObjectStore', 'id' );
await repo.saveAll( [
  { id: 1, name: 'First' },
  { id: 2, name: 'Second' },
  { id: 3, name: 'Third' },
] );
console.log( ( await repo.findById( 1 ) ).name );
```

# Main classes

## IndexDbRepository
`IndexDbRepository` -- wrapper around IDBObjectStore.
Supports:
* `findAll()` -- returns all elements from IDBObjectStore
* `findById( id )` -- returns element by key from IDBObjectStore.
* `findByIds( ids )` -- returns an array of elements by keys from IDBObjectStore.
* `findByPredicate( predicate )` -- returns an array of elements filtered by predicate. Semantically the same as, but with memory usage optimization compared to `findAll( ).filter( predicate )`.
* `getKeyToIndexValueMap( indexName )` -- returns a map where key is primary key and value is index value. Used by sorting functions (where one need to sort items by label of linked dictionary entry).
* `retain( ids )` -- deletes all elements from IDBObjectStore except with keys specified in argument.

All `findId()` and `findIds()` calls are placed into single queue and optimized by using cursor over sorted ids.

### Properties and settings
* `stamp` -- indicates the sequence number of changes in IDBObjectStore. Can be used for memoization cache cleanup (I.e. pass it to memoize function as argument of memoization to reread data from IDBObjectStore on changes).
* `transformAfterIndexDb` -- method will be called after retrivieing element from IDBObjectStore and before returning it to user code. It's a good place for custom deserialization (`Date` handling, for example).
* `transformBeforeIndexDb` -- method will be called before placing element in IDBObjectStore.  It\`s a good place for custom `object` => `string` serialization.

## connect()
`connect` -- connects data from `IndexDbRepository` with component props. Automatically updates component props whenever `IndexDbRepository` is updated.

Usage:
```javascript
import React, { PureComponent } from 'react';
import connect from '@vlsergey/react-indexdb-repo';

type PropsType = {
  element: any,
}

class ElementName extends PureComponent<PropsType> {
  render() {
    const { element } = this.props;
    return !!element
      ? <div>Loading...</div>
      : <div>{element.name}</div>;
  }
}

const mapPropsToRepo = ( props ) => /* some way to obtain IndexDbRepository */
const mapRepoToProps = ( repo, props ) => ({
  element: repo.findById( props.elementId ),
})
const mapRepoToActions = (repo, props) => ({
  // can map repository to actions
});

export default connect( mapPropsToRepo )( mapRepoToProps, mapRepoToActions )( ElementName );
```
* `mapPropsToRepo` -- need to obtain `IndexDbRepository` from component `props`.
* `mapRepoToProps` -- build data calculation `Promise`'s from given `IndexDbRepository` and component `props`. Promises calculation results will be passes to wrapped component `props`.
* `mapRepoToActions` -- build actions using `IndexDbRepository` and component `props`. Will be passes to wrapped component `props` directly.

# Misc Classes

## Batcher
`Batcher` -- organizes multiple calls to `findId()` and `findIds()` into single queue.

Shall not be used directly. Used by `IndexDbRepository` to queue all `findId()` and `findIds()` calls.

## RepositoryListener.
`RepositoryListener` calls `onChange()` whenever repository is changed.

Usage:
```javascript
  <RepositoryListener repository={repository} onChange={ () => this.forceUpdate() }>
    <!-- components that need to be rerendered when data in repository are changed -->
  </RepositoryListener>
```

Shall not be used directly. Used by `connect()` function implementation to update wrapped component props.
