export type ChangelogEntryType = 'feature' | 'fix' | 'improvement';

export interface ChangelogEntry {
  date: string;
  type: ChangelogEntryType;
  title: string;
  description: string;
}
