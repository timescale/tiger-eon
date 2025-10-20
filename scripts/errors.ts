export class UninitializedConfigError extends Error {
  constructor() {
    super('Config is uninitialized, call collect() first');
  }
}
