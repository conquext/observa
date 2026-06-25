import type { ExtractedUsage, ProviderAdapter, TrackedStream } from './types.js';

export function defineAdapter(config: {
  name: string;
  instrumentedMethods: string[];
  extractUsage: (response: unknown) => ExtractedUsage;
  extractStreamUsage?: (stream: AsyncIterable<unknown>) => TrackedStream<unknown>;
}): ProviderAdapter {
  return {
    name: config.name,
    instrumentedMethods: config.instrumentedMethods,
    extractUsage: config.extractUsage,
    extractStreamUsage: config.extractStreamUsage ?? defaultStreamExtractor,
  };
}

function defaultStreamExtractor(stream: AsyncIterable<unknown>): TrackedStream<unknown> {
  throw new Error('Streaming not supported by this adapter. Implement extractStreamUsage.');
}

export function createTrackedStream<T>(
  source: AsyncIterable<T>,
  onComplete: (chunks: T[]) => ExtractedUsage,
): TrackedStream<T> {
  const chunks: T[] = [];
  let usage: ExtractedUsage | undefined;
  let done = false;

  const iterator: AsyncIterable<T> = {
    [Symbol.asyncIterator]() {
      const sourceIterator = source[Symbol.asyncIterator]();
      return {
        async next() {
          const result = await sourceIterator.next();
          if (result.done) {
            done = true;
            usage = onComplete(chunks);
            return result;
          }
          chunks.push(result.value);
          return result;
        },
      };
    },
  };

  return Object.assign(iterator, {
    getUsage(): Promise<ExtractedUsage> {
      if (done && usage) return Promise.resolve(usage);
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (done && usage) {
            clearInterval(check);
            resolve(usage);
          }
        }, 10);
        setTimeout(() => {
          clearInterval(check);
          reject(new Error('Stream usage not available — stream may not have been fully consumed'));
        }, 30000);
      });
    },
  });
}
