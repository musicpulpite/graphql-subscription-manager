import debounce from 'lodash.debounce';

interface SimplexOptions {
  batchInterval?: number;
}

export default class BatchedSimplex<T> {
  private running: boolean;
  private pullQueue: { resolve: (value: T[]) => void; reject: (error: Error) => void }[];
  private pushQueue: T[];

  private options: SimplexOptions;
  private flushQueue?: () => {};

  constructor(options: SimplexOptions) {
    this.running = true;
    this.pullQueue = [];
    this.pushQueue = [];

    this.options = options;

    this.flushQueue = debounce(
      () => {
        if (this.running) {
          if (this.pullQueue.length !== 0) {
            const batchedPayloads = this.pushQueue.slice();
            this.pushQueue = [];

            const { resolve } = this.pullQueue.shift();
            resolve(batchedPayloads);
          }
        }
      },
      options.batchInterval,
      { maxWait: options.batchInterval, trailing: true, leading: false }
    );
  }

  public async read(): Promise<T | T[]> {
    return new Promise((resolve, reject) => {
      if (!this.running) {
        return reject(new Error('Cannot read from a destroyed Batched Simplex'));
      }

      this.pullQueue.push({ resolve, reject });
    });
  }

  public write(data: T) {
    if (!this.running) {
      throw new Error('Batched Simplex not destroyed properly');
    }

    this.pushQueue.push(data);
    this.flushQueue();
  }

  public async destroy() {
    if (this.running) {
      this.running = false;
      this.pushQueue = [];
      this.pullQueue.forEach(({ reject }) => reject(new Error('Batched Simplex destroyed')));
    }
  }
}
