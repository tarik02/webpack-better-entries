import { EntryDescriptionNormalized } from './types.js';

export class NormalizedEntry {
  constructor(
    public readonly context: string,
    public readonly name: string,
    public readonly desc: EntryDescriptionNormalized,
  ) {
  }
}
