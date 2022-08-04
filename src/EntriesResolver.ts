import { FSWatcher } from 'fs';
import watch from 'glob-watcher';
import { globbyStream } from 'globby';
import { NormalizedEntry } from './NormalizedEntry.js';
import { EntriesFactory, EntryMeta, NamedEntryMeta } from './types.js';

export class EntriesResolver {
  constructor(
    protected readonly context: string,
    protected readonly entriesFactory: EntriesFactory,
  ) {
  }

  async update(isWatch: false): Promise<{ entries: NormalizedEntry[] }>;
  async update(isWatch: true): Promise<{ entries: NormalizedEntry[], invalidatePromise: Promise<void>, close: () => void }>;
  async update(isWatch: boolean): Promise<{ entries: NormalizedEntry[], invalidatePromise: Promise<void>, close: () => void }> {
    const watchers: Array<FSWatcher> = [];

    let invalidate: (() => void) | undefined;
    let close!: () => void;

    const invalidatePromise = new Promise<void>((resolve, reject) => {
      invalidate = () => {
        if (invalidate === undefined) {
          return;
        }
        invalidate = undefined;
        for (const watcher of watchers) {
          watcher.close();
        }

        resolve();
      };

      close = () => {
        if (invalidate === undefined) {
          return;
        }
        invalidate = undefined;
        for (const watcher of watchers) {
          watcher.close();
        }

        reject(new Error('Closed'));
      };
    });

    const factoryResult = await this.entriesFactory({
      context: this.context,
      glob: (patterns, options = {}) => {
        const cwd = options.cwd ?? this.context;

        const stream = async function* (): AsyncGenerator<string> {
          if (isWatch) {
            watchers.push(watch(patterns, {
              cwd,
              ignoreInitial: true,
              events: ['add', 'unlink'],
            }, () => {
              invalidate?.();
            }));
          }

          for await (const item of globbyStream(patterns, {
            cwd,
          })) {
            yield item.toString('utf-8');
          }
        }();

        let promise: Promise<Array<string>> | undefined;
        const getPromise = () => {
          if (promise === undefined) {
            promise = (async () => {
              const acc: string[] = [];
              for await (const item of stream) {
                acc.push(item);
              }
              return acc;
            })();
          }
          return promise;
        };

        return {
          then: (onResolve, onReject) => getPromise().then(onResolve, onReject),
          catch: (onReject: any) => getPromise().catch(onReject),
          [Symbol.asyncIterator]: stream[Symbol.asyncIterator].bind(stream),
        };
      }
    }) as any;

    let entriesMap: Record<string, EntryMeta> = {};

    if (typeof factoryResult[Symbol.iterator] === 'function') {
      for (const { name, ...entry } of factoryResult as Iterable<NamedEntryMeta>) {
        entriesMap[name] = entry;
      }
    } else if (typeof factoryResult[Symbol.asyncIterator] === 'function') {
      for await (const { name, ...entry } of factoryResult as AsyncIterable<NamedEntryMeta>) {
        entriesMap[name] = entry;
      }
    } else {
      for (const [name, entryMeta] of Object.entries(factoryResult as Record<string, EntryMeta | string>)) {
        if (typeof entryMeta === 'string') {
          entriesMap[name] = { import: [entryMeta] };
        } else {
          entriesMap[name] = entryMeta;
        }
      }
    }

    const entries = Object.entries(entriesMap).map(([name, entry]) => new NormalizedEntry(
      entry.context ?? this.context,
      name,
      {
        ...entry,
        dependOn: typeof entry.dependOn === 'string' ? [entry.dependOn] : entry.dependOn,
        import: typeof entry.import === 'string' ? [entry.import] : entry.import,
      },
    ));

    return {
      entries,
      invalidatePromise,
      close,
    };
  }
}
