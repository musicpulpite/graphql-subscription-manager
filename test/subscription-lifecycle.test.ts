import GraphQLSubscriptionManager from '../src/graphql-subscription-manager';
import MockPubSubEngine from './mock-pubsub-engine';

type MockPayload = {
  type?: string;
  message: string;
};

type MockResult = {
  subscriptionType: string;
  message: string;
};

type MockSubscription = {
  type: string;
};

const INITIAL_MESSAGE = 'Initial payloads';

const PREPROCESSOR_TRIGGER = 'Preprocessor trigger';
const PREPROCESSOR_MESSAGE = 'Contains data from payloads preprocessor';

describe('GraphQLSubscriptionManager lifecycle', () => {
  const mockPubSub = new MockPubSubEngine();
  const subscriptionManager = new GraphQLSubscriptionManager<MockPayload, MockResult>(mockPubSub, {
    initPayloads: async ({ subscription }) => {
      return {
        subscriptionType: subscription.type,
        message: INITIAL_MESSAGE
      };
    },
    beforeProcessPayloads: async ({ payload: { type } }) => {
      if (type === PREPROCESSOR_TRIGGER) {
        return {
          message: PREPROCESSOR_MESSAGE
        };
      }
    },
    processPayloads: async ({ subscription, payload, context }) => {
      return {
        subscriptionType: subscription.type,
        message: context?.message || payload.message // Potentially overwrite with data from payload preprocessing
      };
    }
  });

  const type = 'sub1';
  const channel = 'channel1';
  const subscription: MockSubscription = { type };
  const asyncIterator = subscriptionManager.getAsyncIteratorForSubscription(subscription, channel);

  it('Dispatches initial payloads on the subscribe event', async () => {
    const { value, done } = await asyncIterator.next();
    expect(value.subscriptionType).toBe(type);
    expect(value.message).toBe(INITIAL_MESSAGE);
    expect(done).toBe(false);
  });

  it('Dispatches subscription payloads triggered by a publication event', async () => {
    const payload = { message: `Message transmitted over channel: ${channel}` };
    await mockPubSub.publish(channel, payload);

    const { value, done } = await asyncIterator.next();
    expect(value.subscriptionType).toBe(type);
    expect(value.message).toBe(payload.message);
    expect(done).toBe(false);
  });

  it('Allows for payload preprocessing and passes any values as context to the subscription processor', async () => {
    const payload = { type: PREPROCESSOR_TRIGGER };
    await mockPubSub.publish(channel, payload);

    const { value, done } = await asyncIterator.next();
    expect(value.subscriptionType).toBe(type);
    expect(value.message).toBe(PREPROCESSOR_MESSAGE);
    expect(done).toBe(false);
  });

  it('Tracks subscription state and cleans up automatically after being unsubscribed from (iterator return)', async () => {
    expect(subscriptionManager.getActiveSubscriptions().length).toBe(1);

    const { done } = await asyncIterator.return();
    expect(done).toBe(true);

    expect(subscriptionManager.getActiveSubscriptions().length).toBe(0);
  });
});
