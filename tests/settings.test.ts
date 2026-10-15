import { describe, expect, it } from 'vitest';
import { validateSettings } from '../src/settings.js';

const FORM = {
  seed: '  Boho Earrings ',
  domain: 'google.com',
  language: 'en',
  includeSingle: true,
  includeDouble: true,
  includeLeft: false,
  speed: 'slow',
};

describe('validateSettings', () => {
  it('accepts a normal form and tidies the seed', () => {
    expect(validateSettings(FORM)).toEqual({ ...FORM, seed: 'boho earrings' });
  });

  it('rejects an empty seed, unknown domain or language, and no letters ticked', () => {
    expect(() => validateSettings({ ...FORM, seed: ' ' })).toThrow(/seed/);
    expect(() => validateSettings({ ...FORM, domain: 'bing.com' })).toThrow(/domain/);
    expect(() => validateSettings({ ...FORM, language: 'xx' })).toThrow(/language/);
    expect(() => validateSettings({ ...FORM, includeSingle: false, includeDouble: false })).toThrow(/tick/);
  });

  it('treats anything other than "normal" as slow', () => {
    expect(validateSettings({ ...FORM, speed: 'turbo' }).speed).toBe('slow');
  });
});
