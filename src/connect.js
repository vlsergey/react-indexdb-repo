// @flow

import React, { PureComponent } from 'react';
import IndexedDbRepository from './IndexedDbRepository';
import { PromisesComponent } from '@vlsergey/react-promise';
import RepositoryListener from './RepositoryListener';

type ChildPropsType = any;
type PromisesObject = { [string] : Promise< any > };
type ActionsObject = { [string] : any };

type MapRepoToActionsType = ?( ( IndexedDbRepository, ChildPropsType ) => ActionsObject );
type MapRepoToPropsType = ?( ( IndexedDbRepository, ChildPropsType ) => PromisesObject );

type PropsType = {
  childClass : any,
  childProps : ChildPropsType,
  mapPropsToRepo : ( ChildPropsType => ?IndexedDbRepository ),
  mapRepoToActions : MapRepoToActionsType,
  mapRepoToProps : MapRepoToPropsType,
};

/*
Something alike redux connect() for retrieveing data from IndexedDbRepository.
*/
class Connected extends PureComponent<PropsType> {

  handleRepoChanged : any => any;

  constructor() {
    super( ...arguments );
    this.handleRepoChanged = () => this.forceUpdate();
  }

  render() {
    const { childClass, childProps, mapPropsToRepo, mapRepoToActions, mapRepoToProps } = this.props;
    const repository : ?IndexedDbRepository = mapPropsToRepo( childProps );
    if ( !repository ) return React.createElement( childClass, childProps );

    const promises : PromisesObject = !mapRepoToProps ? {} : mapRepoToProps( repository, childProps );
    const actions : ActionsObject = !mapRepoToActions ? {} : mapRepoToActions( repository, childProps );

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

export default function connect(
    mapPropsToRepo : ( ChildPropsType => ?IndexedDbRepository )
) : ( MapRepoToPropsType, MapRepoToActionsType ) => any {
  /* eslint react/display-name: 0 */
  return ( mapRepoToProps, mapRepoToActions ) =>
    childClass => props => <Connected
      childClass={childClass}
      childProps={props}
      mapPropsToRepo={mapPropsToRepo}
      mapRepoToActions={mapRepoToActions}
      mapRepoToProps={mapRepoToProps} />;
}
