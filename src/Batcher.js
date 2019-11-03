// @flow

type KeyType = number | string;
type ValueType = any;

type BatchFunctionType = KeyType[] => Promise< ( ?ValueType )[] >;
type QueueItem = { key : KeyType, reject : any, resolve : ?ValueType => any };

/**
 * Uses single queue to fetch all items by key from repository.
 */
export default class Batcher {

  _batchFunction : BatchFunctionType;
  _inProgress : boolean;

  _queue : QueueItem[];

  constructor( batchFunction : BatchFunctionType ) {
    this._batchFunction = batchFunction;
    this._inProgress = false;
    this._queue = [];
  }

  queue( key : KeyType ) : Promise< ?ValueType > {
    const result = new Promise( ( resolve, reject ) => {
      this._queue.push( { key, resolve, reject } );
    } );
    this.process();
    return result;
  }

  queueAll( keys : KeyType[] ) : Promise< ?ValueType[] > {
    const allPromises = keys.map( key => new Promise( ( resolve, reject ) => {
      this._queue.push( { key, resolve, reject } );
    } ) );
    const result = Promise.all( allPromises );
    this.process();
    return result;
  }

  async process() {
    if ( this._inProgress ) return;

    this._inProgress = true;
    const _queueInProgress = this._queue;
    this._queue = [];
    try {
      const results : ValueType[] = await this._batchFunction( _queueInProgress.map( ( { key } ) => key ) );
      if ( results.length !== _queueInProgress.length ) {
        _queueInProgress.forEach( ( { reject } ) =>
          reject( new Error( 'Assertion error: Batcher function '
          + String( this._batchFunction )
          + ' result length is not the same as queue size' ) ) );
      }

      for ( let i = 0; i < _queueInProgress.length; i++ ) {
        _queueInProgress[ i ].resolve( results[ i ] );
      }
    } catch ( err ) {
      _queueInProgress.forEach( ( { reject } ) => reject( err ) );
    } finally {
      this._inProgress = false;
    }

    if ( this._queue.length > 0 ) {
      setTimeout( () => this.process(), 0 );
    }
  }

}
