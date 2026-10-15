// The choices offered on the form, the speed limits, and a check that a form is valid.

import type { RunSettings, Speed } from './types.js';
import { buildQueries } from './queries.js';
import { normalizeKeyword } from './clean.js';

/** Never wait less than this between two searches (PRD section 7). Do not lower it. */
export const MIN_DELAY_MS = 2000;

/** Wait between searches, in milliseconds: a random value in this range is used each time. */
export const SPEED_RANGES: Record<Speed, [min: number, max: number]> = {
  slow: [4000, 7000],
  normal: [2000, 4000],
};

export const DOMAINS = ['google.com', 'google.co.uk', 'google.ca', 'google.de', 'google.si', 'google.com.pk'];

export const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'de', name: 'German' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fr', name: 'French' },
];

/** A random number between min and max (both included). */
export function randomBetween(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Picks the wait before the next search. It is never below MIN_DELAY_MS, whatever the speed. */
export function pickDelayMs(speed: Speed): number {
  const [min, max] = SPEED_RANGES[speed];
  return Math.max(MIN_DELAY_MS, randomBetween(min, max));
}

/**
 * Checks what the form sent and returns clean settings.
 * Throws an Error with a plain-English message if something is wrong.
 */
export function validateSettings(input: Partial<Record<keyof RunSettings, unknown>>): RunSettings {
  const seed = normalizeKeyword(String(input.seed ?? ''));
  if (!seed) throw new Error('Please type a seed keyword.');
  if (seed.length > 80) throw new Error('The seed keyword is too long (80 characters at most).');

  const domain = String(input.domain ?? 'google.com');
  if (!DOMAINS.includes(domain)) throw new Error(`Unknown Google domain: ${domain}`);

  const language = String(input.language ?? 'en');
  if (!LANGUAGES.some((l) => l.code === language)) throw new Error(`Unknown language: ${language}`);

  const speed = input.speed === 'normal' ? 'normal' : 'slow';
  const settings: RunSettings = {
    seed,
    domain,
    language,
    includeSingle: input.includeSingle === true,
    includeDouble: input.includeDouble === true,
    includeLeft: input.includeLeft === true,
    speed,
  };
  if (!settings.includeSingle && !settings.includeDouble) {
    throw new Error('Please tick a-z, aa-zz, or both.');
  }
  buildQueries(seed, settings); // throws if the run would be over the query limit
  return settings;
}
