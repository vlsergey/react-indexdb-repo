// @flow

import React, { PureComponent } from 'react';
import IndexedDbRepository from './IndexedDbRepository';
import memoizeOne from 'memoize-one';
import { PromisesComponent } from '@vlsergey/react-promise';
import RepositoryListener from './RepositoryListener';
import shallowCompare from './shallowCompare';

/* All child properties */
type ChildPropsType = any;
/* Props selected to calculate promises and actions (limited to simplify memoization) */
type LimitedChildPropsType = any;
type PromisesObject = { [string] : Promise< any > };
type ActionsObject = { [string] : any };

type MapPropsToRepoType = ChildPropsType => ?IndexedDbRepository;
type MapRepoToActionsType = ?( ( IndexedDbRepository, ChildPropsType ) => ActionsObject );
type MapRepoToPropsPromiseType = ?( ( IndexedDbRepository, ChildPropsType ) => PromisesObject );

type PropsType = {
  childClass : any,
  childProps : ChildPropsType,
  extractMemoArgs : ChildPropsType => LimitedChildPropsType,
  mapPropsToRepo : ( ChildPropsType => ?IndexedDbRepository ),
  mapRepoToActions : MapRepoToActionsType,
  mapRepoToPropsPromise : MapRepoToPropsPromiseType,
};

const EMPTY_OBJECT = Object.freeze( {} );

/* Special equation function to use with memoize-one that takes into account
that 3-rd argument is actually child props */
function equalsFn( newArgs : any[], lastArgs : any[] ) : boolean {
  if ( newArgs.length !== lastArgs.length ) return false;
  for ( let i = 0; i < newArgs.length; i++ ) {
    // childProps position: 2
    if ( i === 2 ) {
      if ( !shallowCompare( newArgs[ i ], lastArgs[ i ] ) ) return false;
    } else if ( newArgs[ i ] !== lastArgs[ i ] ) return false;
  }
  return true;
}

/*
Something alike redux connect() for retrieveing data from IndexedDbRepository.
*/
class Connected extends PureComponent<PropsType> {

  _promisesF : any;
  handleRepoChanged : any => any;

  constructor() {
    super( ...arguments );

    this.handleRepoChanged = () => this.forceUpdate();
    this._promisesF = memoizeOne( ( mapRepoToPropsPromise, repository, limitedChildProps ) =>
      !mapRepoToPropsPromise ? EMPTY_OBJECT : mapRepoToPropsPromise( repository, limitedChildProps ), equalsFn );
  }

  render() {
    const { childClass, childProps, extractMemoArgs, mapPropsToRepo,
      mapRepoToActions, mapRepoToPropsPromise } = this.props;
    const repository : ?IndexedDbRepository = mapPropsToRepo( childProps );
    if ( !repository ) return React.createElement( childClass, childProps );

    const limitedChildProps : LimitedChildPropsType = extractMemoArgs( childProps );
    const promises : PromisesObject = this._promisesF( mapRepoToPropsPromise, repository, limitedChildProps, repository.stamp );
    const actions : ActionsObject = !mapRepoToActions ? EMPTY_OBJECT : mapRepoToActions( repository, childProps );

    return <RepositoryListener onChange={this.handleRepoChanged} repository={repository}>
      <PromisesComponent promises={promises}>
        { values => React.createElement( childClass, {
          ...childProps,
          ...values,
          ...actions,
        } )}
      </PromisesComponent>
    </RepositoryListener>;
  }
}

/* Since all props are arguments connect() can be used as class annotation */
export default function connect(
    mapPropsToRepo : MapPropsToRepoType,
    extractMemoArgs : ChildPropsType => LimitedChildPropsType,
    mapRepoToPropsPromise : MapRepoToPropsPromiseType,
    mapRepoToActions : MapRepoToActionsType
) {
  return ( childClass : any ) => ( props : ChildPropsType ) => <Connected
    childClass={childClass}
    childProps={props}
    extractMemoArgs={extractMemoArgs}
    mapPropsToRepo={mapPropsToRepo}
    mapRepoToActions={mapRepoToActions}
    mapRepoToPropsPromise={mapRepoToPropsPromise} />;
}
