import {PureComponent, ReactNode} from 'react';

import ListenableRepository from './ListenableRepository';

interface PropsType {
  children?: ReactNode;
  onChange: (stamp: number) => unknown;
  repository: ListenableRepository;
}

export default class RepositoryListener
  extends PureComponent<PropsType> {

  prevRepository: ListenableRepository | null;
  repositoryListener: (stamp: number) => unknown;

  constructor (props: PropsType | Readonly<PropsType>) {
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
