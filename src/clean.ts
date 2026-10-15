// Tidies up the raw suggestion texts and builds the de-duplicated keyword list.

import type { Query, SuggestionRow, UniqueKeyword } from './types.js';

/** Trim, lowercase and turn any run of spaces into a single space. */
export function normalizeKeyword(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Number of words in a keyword. */
export function countWords(keyword: string): number {
  return keyword ? keyword.split(' ').length : 0;
}

/**
 * Turns the texts Google showed for one query into clean rows.
 * Drops empty texts, the seed itself, and repeats within this same list.
 * The position is the place in Google's list (1 = top), so it is kept even
 * when an earlier entry was dropped.
 */
export function cleanSuggestions(
  query: Query,
  rawTexts: string[],
  seed: string,
  collectedAt: Date = new Date(),
): SuggestionRow[] {
  const cleanSeed = normalizeKeyword(seed);
  const seen = new Set<string>();
  const rows: SuggestionRow[] = [];

  rawTexts.forEach((raw, index) => {
    const suggestion = normalizeKeyword(raw);
    if (!suggestion || suggestion === cleanSeed || seen.has(suggestion)) return;
    seen.add(suggestion);
    rows.push({
      query: query.text,
      side: query.side,
      letters: query.letters,
      position: index + 1,
      suggestion,
      words: countWords(suggestion),
      collectedAt: collectedAt.toISOString(),
    });
  });
  return rows;
}

/**
 * One entry per keyword, with how many times it showed up across all queries
 * and the first query that found it. Sorted A-Z.
 */
export function buildUniqueKeywords(rows: SuggestionRow[]): UniqueKeyword[] {
  const byKeyword = new Map<string, UniqueKeyword>();
  for (const row of rows) {
    const existing = byKeyword.get(row.suggestion);
    if (existing) {
      existing.timesSeen += 1;
    } else {
      byKeyword.set(row.suggestion, { keyword: row.suggestion, timesSeen: 1, firstQuery: row.query });
    }
  }
  return [...byKeyword.values()].sort((a, b) => a.keyword.localeCompare(b.keyword));
}
