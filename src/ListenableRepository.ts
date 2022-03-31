type Listener = (stamp: number) => unknown;

export default interface ListenableRepository {

  readonly stamp: number;

  addListener: (listener: Listener) => unknown;

  removeListener: (listener: Listener) => unknown;

}
