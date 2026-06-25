import type { BatchConfig, StorageBackend, UsageEvent } from './types.js';

export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxSize: 100,
  flushInterval: 5000,
};

export class BatchProcessor {
  private buffer: UsageEvent[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly backend: StorageBackend;
  private readonly config: BatchConfig;
  private closed = false;

  constructor(backend: StorageBackend, config?: Partial<BatchConfig>) {
    this.backend = backend;
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
    this.startTimer();
  }

  async add(event: UsageEvent): Promise<void> {
    if (this.closed) return;
    this.buffer.push(event);
    if (this.buffer.length >= this.config.maxSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    await this.backend.write(batch);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.stopTimer();
    await this.flush();
    await this.backend.close();
  }

  get pending(): number {
    return this.buffer.length;
  }

  private startTimer(): void {
    if (this.config.flushInterval > 0) {
      this.timer = setInterval(() => {
        this.flush().catch(() => {
          // Swallow flush errors in background timer
        });
      }, this.config.flushInterval);
      // Unref so the timer doesn't keep the process alive
      if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
        this.timer.unref();
      }
    }
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
