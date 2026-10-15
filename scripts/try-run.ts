// Tries a real run from the terminal (a-z only, Slow speed), before the web page exists.
// Run it with: npm run try -- "boho earrings"
// Close the Chrome window in the middle and run it again to see it resume.

import path from 'node:path';
import { GoogleSession } from '../src/google.js';
import { Runner } from '../src/runner.js';
import { RunStore } from '../src/store.js';
import { validateSettings } from '../src/settings.js';

const seed = process.argv.slice(2).join(' ') || 'boho earrings';
const settings = validateSettings({
  seed,
  domain: 'google.com',
  language: 'en',
  includeSingle: true,
  includeDouble: false,
  includeLeft: false,
  speed: 'slow',
});

const store = new RunStore(path.resolve('runs'));
const runner = new Runner({
  store,
  openSession: (s) =>
    GoogleSession.open({ domain: s.domain, language: s.language, profileFolder: path.resolve('.browser-profile') }),
});

let lastLine = '';
runner.on('update', (snap) => {
  const line = `[${snap.done}/${snap.total}] ${snap.message}`;
  if (line !== lastLine) console.log(line);
  lastLine = line;
  if (snap.state === 'waiting') console.log('   (When done in Chrome, press Enter here to continue.)');
  if (['finished', 'stopped', 'browser-closed', 'error'].includes(snap.state)) {
    console.log(`\nKeywords found: ${snap.keywords.length}. Saved in: ${store.filePath(settings.seed)}`);
    process.exit(0);
  }
});

// In this terminal version, pressing Enter means "Continue".
process.stdin.on('data', () => runner.continue());

const saved = await store.findResumable(settings.seed);
runner.start(saved?.settings ?? settings, saved);
