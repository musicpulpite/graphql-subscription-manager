import PubSubEngine from '../src/pubsub/pubsub-engine';

type ListNode = {
  subId: number;
  onMessage: Function;
  next: ListNode | null;
};

export default class MockPubSubEngine extends PubSubEngine {
  private subId: number;
  private activeSubscriptions: { [subId: number]: string };
  private channels: { [triggerName: string]: ListNode };

  constructor() {
    super();
    this.subId = 1;
    this.activeSubscriptions = {};
    this.channels = {};
  }

  public async publish(triggerName: string, payload: any): Promise<void> {
    let subscriber = this.channels[triggerName];

    while (subscriber) {
      await subscriber.onMessage(payload);
      subscriber = subscriber.next;
    }
  }

  public async subscribe(
    triggerName: string,
    onMessage: Function,
    options: Object
  ): Promise<number> {
    return new Promise((resolve) => {
      const subId = this.subId++;

      if (!this.channels[triggerName]) {
        this.channels[triggerName] = {
          subId,
          onMessage,
          next: null
        };
      } else {
        const next = this.channels[triggerName];
        this.channels[triggerName] = {
          subId,
          onMessage,
          next
        };
      }

      resolve(subId);
    });
  }

  public unsubscribe(subId: number) {
    const triggerName = this.activeSubscriptions[subId];
    delete this.activeSubscriptions[subId];

    let prev = null;
    let curr = this.channels[triggerName];
    while (curr.subId !== subId) {
      const temp = curr;
      prev = curr;
      curr = temp.next;
    }

    if (!prev && !curr.next) {
      delete this.channels[triggerName];
    } else if (!prev) {
      this.channels[triggerName] = curr.next;
    } else {
      prev.next = curr.next;
    }
  }
}
