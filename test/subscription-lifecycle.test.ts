import GraphQLSubscriptionManager from '../src/graphql-subscription-manager';
import MockPubSubEngine from './mock-pubsub-engine';

describe('GraphQLSubscriptionManager lifecycle', () => {
    const subscriptionManager = new GraphQLSubscriptionManager(new MockPubSubEngine(), { initPayloads: () => {}, beforeProcessPayloads: () => {}, processPayloads: () => {}});
});