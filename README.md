# @vlsergey/react-indexdb-repo

React Components to work with IndexDB repositories.

[![Build Status](https://travis-ci.org/vlsergey/react-indexdb-repo.svg?branch=master)](https://travis-ci.org/vlsergey/react-indexdb-repo)

# Main classes
`IndexDbRepository` -- wrapper around IDBObjectStore. Supports:
* `findAll()` -- returns all elements from IDBObjectStore
* `findById( id )` -- returns element by key from IDBObjectStore.
* `findByIds( ids )` -- returns an array of elements by keys from IDBObjectStore.

All `findId()` and `findIds()` calls are placed into single queue and optimized by using cursor over sorted ids.

## Properties and settings
* `this.transformAfterIndexDb` -- method will be called after retrivieing element from IDBObjectStore and before returning it to user code. It's a good place for custom deserialization (`Date` handling, for example).
* `this.transformBeforeIndexDb` -- method will be called before placing element in IDBObjectStore.  It\`s a good place for custom `object` => `string` serialization.
* `stamp` -- indicates the sequence number of changes in IDBObjectStore. Can be used for memoization cache cleanup (I.e. pass it to memoize function as argument of memoization to reread data from IDBObjectStore on changes).

# Misc Classes
* `Batcher` -- organizes multiple calls to `findId()` and `findIds()` into single queue.
