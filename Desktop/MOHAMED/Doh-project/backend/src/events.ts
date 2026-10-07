import { randomUUID } from 'node:crypto';
import type { ConfirmChannel } from 'amqplib';

export const eventExchange = 'ondoa.events.v1';

export type DomainEvent<T = unknown> = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  schemaVersion: 1;
  correlationId: string;
  data: T;
};

export async function publishEvent<T>(
  channel: ConfirmChannel,
  eventType: string,
  correlationId: string,
  data: T,
) {
  const event: DomainEvent<T> = {
    eventId: randomUUID(),
    eventType,
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    correlationId,
    data,
  };

  channel.publish(eventExchange, eventType, Buffer.from(JSON.stringify(event)), {
    contentType: 'application/json',
    messageId: event.eventId,
    correlationId,
    persistent: true,
  });
  await channel.waitForConfirms();

  return event.eventId;
}