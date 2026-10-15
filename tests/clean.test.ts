import { describe, expect, it } from 'vitest';
import { buildUniqueKeywords, cleanSuggestions, countWords, normalizeKeyword } from '../src/clean.js';
import type { Query } from '../src/types.js';
import { sampleRows } from './sample-data.js';

const QUERY: Query = { text: 'boho earrings b', side: 'right', letters: 'b' };

describe('normalizeKeyword', () => {
  it('trims, lowercases and collapses spaces', () => {
    expect(normalizeKeyword('  Boho   EARRINGS\tGold ')).toBe('boho earrings gold');
  });
});

describe('countWords', () => {
  it('counts words', () => {
    expect(countWords('boho earrings gold')).toBe(3);
    expect(countWords('')).toBe(0);
  });
});

describe('cleanSuggestions', () => {
  const when = new Date('2026-10-15T10:00:00Z');

  it('keeps all fields for each suggestion', () => {
    const [row] = cleanSuggestions(QUERY, ['Boho Earrings Black'], 'boho earrings', when);
    expect(row).toEqual({
      query: 'boho earrings b',
      side: 'right',
      letters: 'b',
      position: 1,
      suggestion: 'boho earrings black',
      words: 3,
      collectedAt: '2026-10-15T10:00:00.000Z',
    });
  });

  it('removes the seed, empty texts and repeats, but keeps Google positions', () => {
    const rows = cleanSuggestions(
      QUERY,
      ['Boho  Earrings', 'boho earrings black', '', 'BOHO EARRINGS BLACK', 'boho earrings bulk'],
      'boho earrings',
      when,
    );
    expect(rows.map((r) => [r.position, r.suggestion])).toEqual([
      [2, 'boho earrings black'],
      [5, 'boho earrings bulk'],
    ]);
  });
});

describe('buildUniqueKeywords', () => {
  it('has one row per keyword, sorted A-Z, with counts and first query', () => {
    const unique = buildUniqueKeywords(sampleRows());
    const keywords = unique.map((u) => u.keyword);
    expect(new Set(keywords).size).toBe(keywords.length);
    expect(keywords).toEqual([...keywords].sort((a, b) => a.localeCompare(b)));

    const gold = unique.find((u) => u.keyword === 'boho earrings gold');
    expect(gold).toEqual({ keyword: 'boho earrings gold', timesSeen: 2, firstQuery: 'boho earrings' });
    const amazon = unique.find((u) => u.keyword === 'boho earrings amazon');
    expect(amazon).toEqual({ keyword: 'boho earrings amazon', timesSeen: 2, firstQuery: 'boho earrings a' });
  });
});
