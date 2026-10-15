// Builds the list of texts to type into Google, in the order they are typed.

import type { Query } from './types.js';
import { normalizeKeyword } from './clean.js';

/** Safety limit from the PRD: never more than this many searches in one run. */
export const MAX_QUERIES = 110;

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export interface QueryOptions {
  /** "seed a" ... "seed z" */
  includeSingle: boolean;
  /** "seed aa" ... "seed zz" */
  includeDouble: boolean;
  /** Also put the letters in front: "a seed" ... "zz seed" */
  includeLeft: boolean;
}

/** The letter groups to use: a-z and/or aa-zz (doubled letters, not every pair). */
function letterGroups(options: QueryOptions): string[] {
  const groups: string[] = [];
  if (options.includeSingle) groups.push(...ALPHABET);
  if (options.includeDouble) groups.push(...ALPHABET.map((letter) => letter + letter));
  return groups;
}

/**
 * Returns every query for a run: the seed on its own first, then the right side,
 * then (if chosen) the left side.
 */
export function buildQueries(rawSeed: string, options: QueryOptions): Query[] {
  const seed = normalizeKeyword(rawSeed);
  if (!seed) throw new Error('Please type a seed keyword.');

  const groups = letterGroups(options);
  const queries: Query[] = [{ text: seed, side: 'seed', letters: '' }];

  for (const letters of groups) {
    queries.push({ text: `${seed} ${letters}`, side: 'right', letters });
  }
  if (options.includeLeft) {
    for (const letters of groups) {
      queries.push({ text: `${letters} ${seed}`, side: 'left', letters });
    }
  }

  if (queries.length > MAX_QUERIES) {
    throw new Error(`This run would need ${queries.length} searches; the limit is ${MAX_QUERIES}.`);
  }
  return queries;
}
