# GraphQL Subscription Manager

## Motivation  
The original motivation for this project was to establish a simpler abstraction to handle a subscription system that provided database-level reactivity to client subscribers.
In this system, there is not an easy one-to-one correspondence between PubSub messages and subscription payloads and, on top of that, several different subscriptions may be processing messages from the same topic/channel that all need to be aware of each other.
By providing a wrapper class around the PubSubEngine instance, we can process pubsub messages in unison for all active subscriptions and provide the semblances of a subscription lifecycle.

## Benefits
1. Initial payloads on subscribe (no more Apollo `subscribeToMore`: https://www.apollographql.com/docs/react/data/subscriptions/#subscribing-to-updates-for-a-query)
2. Optional payload batching (see `GraphQLSubscriptionManager::getBatchedAsyncIteratorForSubscription`)
3. A unified source of truth for your current subscription state anywhere within the GraphQL execution context (see `GraphQLSubscriptionManager::getActiveSubscriptions`)
## Example Usage

You have the option to instantiate a subscription manager for each client connection or to simply have one per server instance. For the per-connection approach, a skeleton implementation looks like:

index.ts
```ts
import { SubscriptionServer } from 'subscription-transport-ws';
import { GraphQLSubscriptionManager } from 'graphql-subscription-manager';

import { RedisPubSub as PubSubEngine } from 'graphql-redis-subscriptions';

...

SubscriptionServer.create({
    // ...
    onConnect: (payload: any, socket: WebSocket) => {
        // ...
        const subscriptionManager = new GraphQLSubscriptionManager(
            PubSubEngine,
            {
                processPayloads: async ({ payload, subscription }) => {
                    // ...
                }
            }
        );
        // ...

        return {
            // ...
            subscriptionManager,
            // ...
        }
    }
}, {
    server,
    path
});

```

subscriptions/resolvers.ts
```ts
const SOMETHING_UPDATED = 'something_updated';

export const subscriptionResolvers = {
    somethingChanged: {
        subscribe: (root, args, context, info) => {
            const { subscriptionManager } = context;

            const subscription = {
                ...args,
                // ...
            };

            return subscriptionManager.getAsyncIteratorForSubscription(subscription, SOMETHING_UPDATED);
        },
    },
}
```