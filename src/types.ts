import Webpack from 'webpack';

export type EntryDescriptionNormalized = Webpack.DynamicEntryPlugin['entry'] extends () => Promise<infer EntryStaticNormalized>
  ? EntryStaticNormalized[keyof EntryStaticNormalized]
  : never;

export type EntryObject = Exclude<
  Exclude<Webpack.Entry, string | string[] | Function>[string],
  string | string[]
>

export type GlobFunction = (patterns: string | string[], options?: { cwd?: string; }) => PromiseLike<Array<string>> & AsyncIterable<string>;

export type EntriesFactoryContext = {
  context: string;
  glob: GlobFunction;
};

export type ExtraEntryMeta = {
  context?: string;
};

export type EntryMeta = ExtraEntryMeta & EntryObject;
export type NamedEntryMeta = { name: string } & EntryMeta;

export type Entries =
  | Record<string, string | EntryMeta>
  | Iterable<NamedEntryMeta>
  | AsyncIterable<NamedEntryMeta>
  | Generator<NamedEntryMeta>
  | AsyncGenerator<NamedEntryMeta>;

export type EntriesFactory = (context: EntriesFactoryContext) => Entries | Promise<Entries>;
