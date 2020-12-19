import { PubSubEngine } from 'graphql-subscriptions'; 

type ListNode = {
    subId: number,
    onMessage: Function,
    next: ListNode | null;
}

export default class MockPubSubEngine extends PubSubEngine {
    private subId: number;
    private activeSubscriptions: { [subId: number]: string};
    private channels: { [triggerName: string]: ListNode };

    constructor() {
        super();
        this.subId = 1;
        this.activeSubscriptions = {};
        this.channels = {};
    }

    public publish(triggerName: string, payload: any): Promise<void> {
        return new Promise(resolve => {
            let subscriber = this.channels[triggerName];
    
            while (subscriber) {
                subscriber.onMessage(payload);
                subscriber = subscriber.next;
            }

            resolve();
        })
    };

    public subscribe(triggerName: string, onMessage: Function, options: Object): Promise<number> {
        return new Promise(resolve => {
            const subId = this.subId++;
    
            if (!this.channels[triggerName]) {
                this.channels[triggerName] = {
                    subId,
                    onMessage,
                    next: null
                }
            } else {
                const next = this.channels[triggerName];
                this.channels[triggerName] = {
                    subId,
                    onMessage,
                    next
                }
            }

            return subId;
        })
    };

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
    };
}