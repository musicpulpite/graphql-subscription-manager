import PubSubAsyncIterator from './pubsub-async-iterator';

export default abstract class PubSubEngine {
    public abstract publish(triggerName: string, payload: any): Promise<void>;
    public abstract subscribe(triggerName: string, onMessage: () => Promise<void>, options: object): Promise<number>;
    public abstract unsubscribe(subId: number);
    public asyncIterator<T>(triggers: string | string[]): AsyncIterableIterator<T> {
      return new PubSubAsyncIterator<T>(this, triggers);
    }
  }