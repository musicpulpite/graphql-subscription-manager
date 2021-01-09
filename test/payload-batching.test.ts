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

const THROTTLE_INTERVAL = 1000;

describe('GraphQLSubscriptionManager payload batching', () => {
  const mockPubSub = new MockPubSubEngine();
  const subscriptionManager = new GraphQLSubscriptionManager<MockPayload, MockResult>(mockPubSub, {
    processPayloads: async ({ subscription, payload }) => {
      return {
        subscriptionType: subscription.type,
        message: payload.message
      };
    }
  });

  const channel = 'channel1';

  const regularType = 'sub1';
  const subscription: MockSubscription = { type: regularType };
  const asyncIterator = subscriptionManager.getAsyncIteratorForSubscription(subscription, channel);

  const batchedType = 'sub2';
  const batchedSubscription: MockSubscription = { type: batchedType };
  const batchedAsyncIterator = subscriptionManager.getBatchedAsyncIteratorForSubscription(
    batchedSubscription,
    channel,
    THROTTLE_INTERVAL
  );

  it('Dispatches payloads separately for pubsub events that occur beyond the throttle interval', async () => {
    const payload1 = { message: `First message transmitted over channel: ${channel}` };
    await mockPubSub.publish(channel, payload1);

    // Sleep for an amount of time longer than the batching interval
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_INTERVAL + 100));

    // Validate result payloads for regular subscription
    const {
      value: { subscriptionType: subscriptionType1, message: message1 },
      done
    } = await asyncIterator.next();
    expect(subscriptionType1).toBe(regularType);
    expect(message1).toBe(payload1.message);
    expect(done).toBe(false);

    // Validate first results for batched subscription
    const { value: value3, done: done3 } = await batchedAsyncIterator.next();
    expect(value3.length).toBe(1);
    const [{ subscriptionType: subscriptionType3, message: message3 }] = value3;
    expect(subscriptionType3).toBe(batchedType);
    expect(message3).toBe(payload1.message);
    expect(done3).toBe(false);

    // Dispatch the second payload
    const payload2 = { message: `Second message transmitted over channel: ${channel}` };
    await mockPubSub.publish(channel, payload2);

    // Validate the second result payloads for regular subscription
    const {
      value: { subscriptionType: subscriptionType2, message: message2 },
      done: done2
    } = await asyncIterator.next();
    expect(subscriptionType2).toBe(regularType);
    expect(message2).toBe(payload2.message);
    expect(done2).toBe(false);

    // Validate the second results for batched subscription
    const { value: value4, done: done4 } = await batchedAsyncIterator.next();
    expect(value4.length).toBe(1);
    const [{ subscriptionType: subscriptionType4, message: message4 }] = value4;
    expect(subscriptionType4).toBe(batchedType);
    expect(message4).toBe(payload2.message);
    expect(done4).toBe(false);
  });

  it('Dispatches payloads in bulk for pubsub events that occur within the throttle interval', async () => {
    const payload1 = { message: `First message transmitted over channel: ${channel}` };
    await mockPubSub.publish(channel, payload1);

    // Sleep for an amount of time shorter than the batching interval
    await new Promise((resolve) => setTimeout(resolve, THROTTLE_INTERVAL - 100));

    // Validate result payloads for regular subscription
    const {
      value: { subscriptionType: subscriptionType1, message: message1 },
      done
    } = await asyncIterator.next();
    expect(subscriptionType1).toBe(regularType);
    expect(message1).toBe(payload1.message);
    expect(done).toBe(false);

    // Dispatch the second payload
    const payload2 = { message: `Second message transmitted over channel: ${channel}` };
    await mockPubSub.publish(channel, payload2);

    // Validate the second result payloads for regular subscription
    const {
      value: { subscriptionType: subscriptionType2, message: message2 },
      done: done2
    } = await asyncIterator.next();
    expect(subscriptionType2).toBe(regularType);
    expect(message2).toBe(payload2.message);
    expect(done2).toBe(false);

    // Validate the set of results for batched subscription
    const { value: value3, done: done3 } = await batchedAsyncIterator.next();
    expect(value3.length).toBe(2);
    const [
      { subscriptionType: subscriptionType3, message: message3 },
      { subscriptionType: subscriptionType4, message: message4 }
    ] = value3;
    expect(subscriptionType3).toBe(batchedType);
    expect(message3).toBe(payload1.message);
    expect(subscriptionType4).toBe(batchedType);
    expect(message4).toBe(payload2.message);
    expect(done3).toBe(false);
  });
});
