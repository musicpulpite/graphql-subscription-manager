import { PubSubEngine } from 'graphql-subscriptions';

import Simplex from './simplex';

import { InitPayloadsFunc, BeforeProcessPayloadsFunc, ProcessPayloadsFunc, Nullable } from './types';

interface PayloadProcessFunctions<PayloadType, ResultType> {
    initPayloads?: InitPayloadsFunc<ResultType>,
    beforeProcessPayloads?: BeforeProcessPayloadsFunc<PayloadType>,
    processPayloads: ProcessPayloadsFunc<PayloadType, ResultType>
};

const emptyFunc = async () => null;

export default class GraphQLSubscriptionManager<PayloadType, ResultType> {
    private pubsub: PubSubEngine;
    private initPayloads: PayloadProcessFunctions<PayloadType, ResultType>["initPayloads"];
    private beforeProcessPayloads: PayloadProcessFunctions<PayloadType, ResultType>["beforeProcessPayloads"];
    private processPayloads: PayloadProcessFunctions<PayloadType, ResultType>["processPayloads"];
    private options: any;

    private pubSubIteratorMap: { [channel: string]: AsyncIterator<PayloadType> };
    private activeSubsMap: {
      [channel: string]: any[];
    };
    private subChannelsMap: {
      [subscriptionId: string]: string[];
    };
    private simplexMap: {
        [subscriptionId: string]: Simplex<ResultType>
    };

    private subscriptionId: number;

    constructor(pubsub: PubSubEngine, { initPayloads, beforeProcessPayloads, processPayloads }: PayloadProcessFunctions<PayloadType, ResultType>, options?: any) {
        this.pubsub = pubsub;
        this.initPayloads = initPayloads || emptyFunc;
        this.beforeProcessPayloads = beforeProcessPayloads || emptyFunc;
        this.processPayloads = processPayloads;
        this.options = options;

        this.pubSubIteratorMap = {};
        this.activeSubsMap = {};
        this.subChannelsMap = {};
        this.simplexMap = {};

        this.subscriptionId = 1;
    }

    public getActiveSubscriptions(channel?: string): any[] {
        if (channel) {
            return [...(this.activeSubsMap[channel] || [])];
        }

        return Object.values(this.activeSubsMap).reduce((activeSubscriptions, subscriptionsForChannel) => {
            subscriptionsForChannel.forEach(subscription => {
                if (!activeSubscriptions.includes(subscription)) {
                    activeSubscriptions.push(subscription);
                }
            });

            return activeSubscriptions;
        }, []);
    }

    public getAsyncIteratorForSubscription(subscription: any, channels: string | string[]): AsyncIterator<ResultType> {
        const subscriptionId = this.subscriptionId++;
        subscription._id = subscriptionId; // Might do some encapsulation here

        if (!Array.isArray(channels)) channels = [channels];
        this.subChannelsMap[subscriptionId] = channels;
    
        channels.forEach(channel => {
          if (!this.pubSubIteratorMap[channel]) {
            // Graphql-subscriptions' mistake: the asyncIterator method returns a class that implements $$asyncIterator (Symbol.asyncIterator)
            // So this cast shouldn't be necessary
            const pubsubIterator = this.pubsub.asyncIterator<PayloadType>(channel) as AsyncIterableIterator<PayloadType>;
            this.pubSubIteratorMap[channel] = pubsubIterator;
            this.initializePubSubAsyncIterator(channel, pubsubIterator);
          }
    
          if (this.activeSubsMap[channel]) {
            this.activeSubsMap[channel].push(subscription);
          } else {
            this.activeSubsMap[channel] = [subscription];
          }
        });
    
        this.initPayloads({
          subscription,
        })
          .then(initPayloads => {
            this.dispatchPayloads(subscriptionId, initPayloads);
          })
    
        return this.buildAsyncIteratorForSubscription(subscriptionId);
    }

    private buildAsyncIteratorForSubscription(subscriptionId: number): AsyncIterableIterator<ResultType> {
        const simplex = new Simplex<ResultType>();
        this.simplexMap[subscriptionId] = simplex;
    
        const cleanupSubscription = async () => await this.cleanupSubscription(subscriptionId);
    
        return {
          // Note !! Double check this if we intend to batch in the simplex
          async next(): Promise<IteratorResult<ResultType | ResultType[]>> {
            try {
              const value = await simplex.read();
              return { value, done: false };
            } catch {
              return { value: undefined, done: true };
            }
          },
          async return(): Promise<IteratorResult<ResultType>> {
            await simplex.destroy();
            await cleanupSubscription();
            return Promise.resolve({ value: undefined, done: true });
          },
          [Symbol.asyncIterator](): AsyncIterator<ResultType> {
            return this;
          },
        } as AsyncIterableIterator<ResultType>;
    }

    private async initializePubSubAsyncIterator(channel: string, pubsubAsyncIterator: AsyncIterableIterator<PayloadType>): Promise<void> {
        for await (const payload of pubsubAsyncIterator) {
            const subscriptions = this.getActiveSubscriptions(channel);

            const context = await this.beforeProcessPayloads({ payload, subscriptions, channel });

            subscriptions.forEach(subscription => {
                this.processPayloads({
                    payload,
                    subscription,
                    channel,
                    context
                }).then(resultPayloads => this.dispatchPayloads(subscription._id, resultPayloads))
            })
        }
    }

    private dispatchPayloads(subscriptionId: number, payloads: Nullable<ResultType | ResultType[]>) {
        if (!payloads) return;
        if (!Array.isArray(payloads)) payloads = [payloads];

        payloads.forEach(payload => this.simplexMap[subscriptionId].write(payload));
    }

    private async cleanupSubscription(subscriptionId: number): Promise<void> {
        delete this.simplexMap[subscriptionId];

        const subscribedChannels = this.subChannelsMap[subscriptionId];
        delete this.subChannelsMap[subscriptionId];
    
        subscribedChannels.forEach(async channel => {
          let idx = -1;
          // Requires downlevelIteration flag: https://mariusschulz.com/blog/downlevel-iteration-for-es3-es5-in-typescript
          for (const [i, subscription] of this.activeSubsMap[channel].entries()) {
            if (subscription._id === subscriptionId) {
                idx = i;
                break;
            }
          }

          if (idx > -1) {
            this.activeSubsMap[channel].splice(idx, 1);
          }
    
          if (this.activeSubsMap[channel].length === 0) {
            const pubSubAsyncIterator = this.pubSubIteratorMap[channel];
            await pubSubAsyncIterator.return();
    
            delete this.activeSubsMap[channel];
            delete this.pubSubIteratorMap[channel];
          }
        });
    }
}