// Shared shapes of data used across the tool.

/** Where the letters go: after the seed (right), before it (left), or the seed on its own. */
export type Side = 'seed' | 'right' | 'left';

/** One text that will be typed into the Google search box. */
export interface Query {
  text: string;
  side: Side;
  /** The added letter(s), e.g. "a" or "bb". Empty for the seed on its own. */
  letters: string;
}

/** One suggestion Google showed for one typed query, after cleaning. */
export interface SuggestionRow {
  query: string;
  side: Side;
  letters: string;
  /** Position in Google's list, 1 = top. */
  position: number;
  suggestion: string;
  words: number;
  /** When it was collected, as an ISO date-time string. */
  collectedAt: string;
}

/** One row of the "Unique Keywords" sheet. */
export interface UniqueKeyword {
  keyword: string;
  timesSeen: number;
  firstQuery: string;
}

/** Speed presets. The fastest still waits at least 2 seconds between searches. */
export type Speed = 'slow' | 'normal';

/** Everything chosen on the form before pressing Start. */
export interface RunSettings {
  seed: string;
  domain: string;
  language: string;
  includeSingle: boolean;
  includeDouble: boolean;
  includeLeft: boolean;
  speed: Speed;
}

/** Whether a run is done. "stopped" means Stop was pressed before the end. */
export type RunStatus = 'running' | 'finished' | 'stopped';
