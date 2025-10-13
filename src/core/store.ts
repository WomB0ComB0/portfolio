import { Schema, SchemaAST } from 'effect';

export const ConnectionAck = Schema.Struct({
  type: Schema.Literal('connection_ack'),
  connectionTimeoutMs: Schema.DurationFromMillis,
}).pipe(
  Schema.rename({
    connectionTimeoutMs: 'connectionTimeout',
  }),
);

export const KeepAlive = Schema.Struct({
  type: Schema.Literal('ka'),
});

export const SubscriptionId = Schema.String.pipe(Schema.brand('SubscriptionId'));
export type SubscriptionId = typeof SubscriptionId.Type;

export const Event = Schema.Struct({
  type: Schema.Literal('data'),
  id: SubscriptionId,
  event: Schema.Unknown,
});

export const SubscribeSuccess = Schema.Struct({
  type: Schema.Literal('subscribe_success'),
  id: SubscriptionId,
});

export const AppSyncMessage = Schema.parseJson(
  Schema.Union(ConnectionAck, KeepAlive, Event, SubscribeSuccess),
);
export type AppSyncMessage = typeof AppSyncMessage.Type;
