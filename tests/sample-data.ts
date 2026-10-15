// Made-up suggestions that look like what Google returns, used by tests and the sample script.

import type { RunSettings, SuggestionRow } from '../src/types.js';
import { buildQueries } from '../src/queries.js';
import { cleanSuggestions } from '../src/clean.js';

export const SAMPLE_SETTINGS: RunSettings = {
  seed: 'boho earrings',
  domain: 'google.com',
  language: 'en',
  includeSingle: true,
  includeDouble: true,
  includeLeft: false,
  speed: 'slow',
};

/** Raw texts per typed query, exactly as they might appear under the search box. */
export const SAMPLE_RAW: Record<string, string[]> = {
  'boho earrings': ['Boho Earrings', 'boho earrings gold', 'boho earrings  silver', 'boho earrings handmade'],
  'boho earrings a': ['boho earrings amazon', 'boho earrings aesthetic', 'boho earrings gold'],
  'boho earrings b': ['boho earrings black', 'boho earrings bulk', 'Boho Earrings Black'],
  'boho earrings aa': ['boho earrings aaa', ' boho earrings amazon '],
};

/** Turns the raw sample texts into cleaned rows, as a real run would. */
export function sampleRows(): SuggestionRow[] {
  const queries = buildQueries(SAMPLE_SETTINGS.seed, SAMPLE_SETTINGS);
  const collectedAt = new Date(2026, 9, 15, 10, 30, 0);
  return queries
    .filter((query) => SAMPLE_RAW[query.text])
    .flatMap((query) => cleanSuggestions(query, SAMPLE_RAW[query.text], SAMPLE_SETTINGS.seed, collectedAt));
}
