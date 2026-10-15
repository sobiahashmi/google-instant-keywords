import { describe, expect, it } from 'vitest';
import { buildQueries, MAX_QUERIES } from '../src/queries.js';

const ALL_RIGHT = { includeSingle: true, includeDouble: true, includeLeft: false };

describe('buildQueries', () => {
  it('runs the seed first, then a-z, then aa-zz (53 queries)', () => {
    const queries = buildQueries('boho earrings', ALL_RIGHT);
    expect(queries).toHaveLength(53);
    expect(queries[0]).toEqual({ text: 'boho earrings', side: 'seed', letters: '' });
    expect(queries[1]).toEqual({ text: 'boho earrings a', side: 'right', letters: 'a' });
    expect(queries[26].text).toBe('boho earrings z');
    expect(queries[27]).toEqual({ text: 'boho earrings aa', side: 'right', letters: 'aa' });
    expect(queries[52].text).toBe('boho earrings zz');
  });

  it('adds the left side after the right side when chosen (105 queries)', () => {
    const queries = buildQueries('boho earrings', { ...ALL_RIGHT, includeLeft: true });
    expect(queries).toHaveLength(105);
    expect(queries[53]).toEqual({ text: 'a boho earrings', side: 'left', letters: 'a' });
    expect(queries[104]).toEqual({ text: 'zz boho earrings', side: 'left', letters: 'zz' });
    expect(queries.length).toBeLessThanOrEqual(MAX_QUERIES);
  });

  it('can use only a-z or only aa-zz', () => {
    expect(buildQueries('x', { includeSingle: true, includeDouble: false, includeLeft: false })).toHaveLength(27);
    const doubles = buildQueries('x', { includeSingle: false, includeDouble: true, includeLeft: false });
    expect(doubles).toHaveLength(27);
    expect(doubles[1].text).toBe('x aa');
  });

  it('tidies the seed before using it', () => {
    expect(buildQueries('  Boho   Earrings ', ALL_RIGHT)[1].text).toBe('boho earrings a');
  });

  it('refuses an empty seed', () => {
    expect(() => buildQueries('   ', ALL_RIGHT)).toThrow(/seed/);
  });
});
