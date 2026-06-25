import type { StorageBackend, UsageEvent, UsageQuery } from './types.js';

export class MemoryBackend implements StorageBackend {
  private events: UsageEvent[] = [];

  async write(events: UsageEvent[]): Promise<void> {
    this.events.push(...events);
  }

  async query(query: UsageQuery): Promise<UsageEvent[]> {
    return this.events.filter((event) => {
      if (event.timestamp < query.from || event.timestamp > query.to) return false;
      if (query.user && event.context?.user?.id !== query.user) return false;
      if (query.task && event.context?.task?.id !== query.task) return false;
      if (query.session && event.context?.session?.id !== query.session) return false;
      if (query.model && event.model !== query.model) return false;
      if (query.provider && event.provider !== query.provider) return false;
      if (query.labels) {
        const eventLabels = event.context?.labels ?? {};
        for (const [key, value] of Object.entries(query.labels)) {
          if (eventLabels[key] !== value) return false;
        }
      }
      return true;
    });
  }

  async close(): Promise<void> {
    this.events = [];
  }

  getAll(): UsageEvent[] {
    return [...this.events];
  }

  get size(): number {
    return this.events.length;
  }
}
