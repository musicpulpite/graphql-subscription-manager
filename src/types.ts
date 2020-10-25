export type Nullable<T> = T | null | undefined;

interface InitPayloadArgs {
    subscription: any;
}

interface BeforeProcessPayloadArgs<PayloadType> {
    subscriptions: any[];
    payload: PayloadType;
}

interface ProcessPayloadArgs<PayloadType> {
    subscription: any;
    payload: PayloadType;
    channel: string;
    context?: any;
}

export type InitPayloadsFunc<ResultType> = (args: InitPayloadArgs) => Promise<Nullable<ResultType | ResultType[]>>;
export type BeforeProcessPayloadsFunc<PayloadType> = (args: BeforeProcessPayloadArgs<PayloadType>) => Promise<any>;
export type ProcessPayloadsFunc<PayloadType, ResultType> = (args: ProcessPayloadArgs<PayloadType>) => Promise<Nullable<ResultType | ResultType[]>>;