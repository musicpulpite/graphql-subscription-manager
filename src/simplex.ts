export default class Simplex<T> {
    private running: boolean;
    private pullQueue: { resolve: (value: T) => void; reject: (error: Error) => void }[];
    private pushQueue: T[];
  
    constructor() {
      this.running = true;
      this.pullQueue = [];
      this.pushQueue = [];
    }
  
    public async read(): Promise<T> {
      return new Promise((resolve, reject) => {
        if (this.running) {
          if (this.pushQueue.length !== 0) {
            resolve(this.pushQueue.shift());
          } else {
            this.pullQueue.push({ resolve, reject });
          }
        } else {
          reject(new Error('Cannot read from a destroyed Simplex'));
        }
      });
    }
  
    public write(data: T) {
      if (!this.running) {
        throw new Error('Simplex not destroyed properly');
      }
      if (this.pullQueue.length !== 0) {
        const { resolve } = this.pullQueue.shift() || {};
        if (typeof resolve === 'function') {
          resolve(data);
        }
      } else {
        this.pushQueue.push(data);
      }
    }
  
    public async destroy() {
      if (this.running) {
        this.running = false;
        this.pushQueue = [];
        this.pullQueue.forEach(({ reject }) => reject(new Error('Simplex destroyed')));
      }
    }
  }