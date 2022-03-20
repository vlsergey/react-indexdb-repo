import {PureComponent, ReactNode} from 'react';

import IndexedDbRepository from './IndexedDbRepository';

interface PropsType<KeyType extends IDBValidKey, Value> {
  children?: ReactNode;
  onChange: (stamp: number) => unknown;
  repository: IndexedDbRepository<KeyType, Value>;
}

export default class RepositoryListener<KeyType extends IDBValidKey, Value>
  extends PureComponent<PropsType<KeyType, Value>> {

  prevRepository: IndexedDbRepository<KeyType, Value> | null;
  repositoryListener: (stamp: number) => unknown;

  constructor (props: PropsType<KeyType, Value> | Readonly<PropsType<KeyType, Value>>) {
    super(props);

    this.prevRepository = null;
    this.repositoryListener = (repositoryStamp: number) => this.props.onChange(repositoryStamp);
  }

  override componentDidMount () {
    this.subscribe();
  }

  override componentDidUpdate () {
    this.subscribe();
  }

  override componentWillUnmount () {
    this.unsubscribe();
  }

  subscribe () {
    const {repository} = this.props;
    if (repository !== null && repository !== undefined && this.prevRepository !== repository) {
      if (this.prevRepository) {
        this.prevRepository.removeListener(this.repositoryListener);
      }
      this.prevRepository = repository;
      repository.addListener(this.repositoryListener);
    }
  }

  unsubscribe () {
    if (this.prevRepository) {
      this.prevRepository.removeListener(this.repositoryListener);
      this.prevRepository = null;
    }
  }

  override render () {
    return this.props.children || null;
  }

}
