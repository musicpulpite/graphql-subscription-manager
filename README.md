## Example Usage

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