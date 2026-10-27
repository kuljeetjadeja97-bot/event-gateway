export type IngestedEvent = {
  id: string;
  type: string;
  payload: unknown;
  receivedAt: string;
  idempotencyKey?: string;
};

export class EventStore {
  private readonly byId = new Map<string, IngestedEvent>();
  private readonly byKey = new Map<string, string>();

  put(event: IngestedEvent): IngestedEvent {
    if (event.idempotencyKey) {
      const existingId = this.byKey.get(event.idempotencyKey);
      if (existingId) {
        return this.byId.get(existingId)!;
      }
      this.byKey.set(event.idempotencyKey, event.id);
    }
    this.byId.set(event.id, event);
    return event;
  }

  get(id: string): IngestedEvent | undefined {
    return this.byId.get(id);
  }

  count(): number {
    return this.byId.size;
  }
}
