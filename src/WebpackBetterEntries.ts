import Webpack from 'webpack';
import { EntriesResolver } from './EntriesResolver.js';
import { NormalizedEntry } from './NormalizedEntry.js';
import { EntriesFactory } from './types.js';

const PLUGIN_NAME = 'WebpackBetterEntries';

type Options = {
};

export class WebpackBetterEntries {
  protected readonly entriesFactory: EntriesFactory;
  protected readonly options: Options;

  constructor(options?: Options);
  constructor(entries: EntriesFactory, options?: Options);
  constructor(first?: EntriesFactory | Options, second?: Options) {
    if (typeof first === 'function') {
      this.entriesFactory = first as EntriesFactory;
      this.options = second ?? {};
    } else {
      this.entriesFactory = () => {
        return {};
      };
      this.options = first ?? {};
    }
  }

  apply(compiler: Webpack.Compiler): void {
    // adds EntryDependency
    (new Webpack.DynamicEntryPlugin(compiler.context, async () => ({}))).apply(compiler);

    const entriesResolver = new EntriesResolver(compiler.context, this.entriesFactory);
    const staticEntries: NormalizedEntry[] = [];
    let dynamicEntries: NormalizedEntry[] = [];
    let closeWatcher: (() => void) | undefined;

    if (
      Object.keys(compiler.options.entry).length === 1
      && 'main' in compiler.options.entry
      && Object.keys(compiler.options.entry.main).length === 0
    ) {
      // default empty config, just clear it
      compiler.options.entry = {};
    }

    compiler.hooks.entryOption.tap(PLUGIN_NAME, (context, entry) => {
      for (const [name, desc] of Object.entries(entry)) {
        staticEntries.push(
          new NormalizedEntry(
            context,
            name,
            desc
          )
        );
      }

      return true;
    });

    compiler.hooks.beforeRun.tapPromise(PLUGIN_NAME, async () => {
      const { entries } = await entriesResolver.update(false);

      dynamicEntries = entries;
    });

    compiler.hooks.watchRun.tapPromise(PLUGIN_NAME, async () => {
      closeWatcher?.();
      closeWatcher = undefined;

      const { entries, invalidatePromise, close } = await entriesResolver.update(true);

      dynamicEntries = entries;
      closeWatcher = close;

      invalidatePromise.then(
        () => compiler.watching?.invalidate(),
        () => { },
      );
    });

    compiler.hooks.watchClose.tap(PLUGIN_NAME, () => {
      closeWatcher?.();
    });

    compiler.hooks.make.tapPromise(PLUGIN_NAME, async compilation => {
      const promises = [];
      for (const { context, name, desc } of [...staticEntries, ...dynamicEntries]) {
        const options = Webpack.EntryOptionPlugin.entryDescriptionToOptions(
          compiler,
          name,
          desc
        );
        for (const entry of desc.import ?? []) {
          promises.push(
            new Promise<void>((resolve, reject) => {
              compilation.addEntry(
                context,
                Webpack.EntryPlugin.createDependency(entry, options),
                options,
                err => {
                  if (err) return reject(err);
                  resolve();
                }
              );
            })
          );
        }
      }
      await Promise.all(promises);
    });
  }
}
