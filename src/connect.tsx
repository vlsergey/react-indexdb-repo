import {PromisesComponent} from '@vlsergey/react-promise';
import React, {useCallback, useMemo, useState} from 'react';

import IndexedDbRepository from './IndexedDbRepository';
import RepositoryListener from './RepositoryListener';

type ActionsObject<ChildProps> = {[Key in keyof ChildProps]: ChildProps[Key]};
type PromisesObject<ChildProps> = {[Key in keyof ChildProps]: Promise<ChildProps[Key]>};

interface PropsType<
  Key extends IDBValidKey, Value,
  ChildProps,
  LimitedChildProps extends Partial<ChildProps>,
  ChildPropsFromPromises extends Partial<ChildProps>,
  Promises extends PromisesObject<ChildPropsFromPromises>,
  ChildPropsFromActions extends Partial<ChildProps>,
  Actions extends ActionsObject<ChildPropsFromActions>
> {
  childClass: React.ComponentClass<ChildProps>;
  childProps: ChildProps;
  extractMemoArgs?: (props: ChildProps) => LimitedChildProps;
  mapPropsToRepo: (props: ChildProps) => IndexedDbRepository<Key, Value> | undefined;
  mapRepoToActions?: (repo: IndexedDbRepository<Key, Value>, props: ChildProps) => Actions;
  mapRepoToPropsPromise?: (repo: IndexedDbRepository<Key, Value>, props: ChildProps) => Promises;
}

const EMPTY_OBJECT = Object.freeze({});

/*
Something alike redux connect() for retrieveing data from IndexedDbRepository.
*/
const Connected = <
  Key extends IDBValidKey,
  Value,
  ChildProps,
  LimitedChildProps extends Partial<ChildProps>,
  ChildPropsFromPromises extends Partial<ChildProps>,
  Promises extends PromisesObject<ChildPropsFromPromises>,
  ChildPropsFromActions extends Partial<ChildProps>,
  Actions extends ActionsObject<ChildPropsFromActions>
>({
    childClass,
    childProps,
    extractMemoArgs = (childProps: ChildProps): LimitedChildProps => childProps as unknown as LimitedChildProps,
    mapPropsToRepo,
    mapRepoToActions = () => EMPTY_OBJECT as Actions,
    mapRepoToPropsPromise = () => EMPTY_OBJECT as Promises,
  }: PropsType<Key, Value, ChildProps, LimitedChildProps, ChildPropsFromPromises, Promises, ChildPropsFromActions, Actions>) => {
  const [rerender, setRerender] = useState(false);
  const handleRepoChanged = useCallback(() => { setRerender(!rerender); }, [rerender, setRerender]);

  const limitedChildPropsArray = useMemo(() => Object.values(extractMemoArgs(childProps)), [extractMemoArgs, childProps]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const repository = useMemo(() => mapPropsToRepo(childProps), [mapPropsToRepo, ...limitedChildPropsArray]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const promises = useMemo(() => !repository ? {} as Promises : mapRepoToPropsPromise(repository, childProps), [repository?.stamp, ...limitedChildPropsArray]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const actions = useMemo(() => !repository ? {} as Actions : mapRepoToActions(repository, childProps), [repository?.stamp, ...limitedChildPropsArray]);

  if (!repository) return React.createElement(childClass, childProps);

  return <RepositoryListener onChange={handleRepoChanged} repository={repository}>
    <PromisesComponent<ChildPropsFromPromises, React.ReactNode> promises={promises}>
      { values => React.createElement(childClass, {
        ...childProps,
        ...values,
        ...actions,
      })}
    </PromisesComponent>
  </RepositoryListener>;
};

/* Since all props are arguments connect() can be used as class annotation */
export default function connect<
  Key extends IDBValidKey,
  Value,
  ChildProps
> (
    mapPropsToRepo: (props: ChildProps) => IndexedDbRepository<Key, Value> | undefined,
    extractMemoArgs: (props: ChildProps) => Partial<ChildProps>,
    mapRepoToPropsPromise: (repo: IndexedDbRepository<Key, Value>, ownProps: ChildProps) => PromisesObject<Partial<ChildProps>>,
    mapRepoToActions: (repo: IndexedDbRepository<Key, Value>, ownProps: ChildProps) => ActionsObject<Partial<ChildProps>>
) {
  // eslint-disable-next-line react/display-name
  return (childClass: React.ComponentClass<ChildProps>) => (props: ChildProps) => <Connected
    childClass={childClass}
    childProps={props}
    extractMemoArgs={extractMemoArgs}
    mapPropsToRepo={mapPropsToRepo}
    mapRepoToActions={mapRepoToActions}
    mapRepoToPropsPromise={mapRepoToPropsPromise} />;
}
