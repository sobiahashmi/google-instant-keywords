import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RunHistory } from '../src/history.js';

let folder: string;
beforeEach(async () => (folder = await mkdtemp(path.join(os.tmpdir(), 'history-test-'))));
afterEach(() => rm(folder, { recursive: true, force: true }));

describe('RunHistory', () => {
  it('warns only after 3 starts within one hour', async () => {
    const history = new RunHistory(path.join(folder, 'starts.json'));
    const now = Date.now();
    expect(await history.shouldWarn(now)).toBe(false);

    await history.recordStart(now - 70 * 60 * 1000); // more than an hour ago: does not count
    await history.recordStart(now - 30 * 60 * 1000);
    await history.recordStart(now - 10 * 60 * 1000);
    expect(await history.shouldWarn(now)).toBe(false);

    await history.recordStart(now - 60 * 1000);
    expect(await history.startsInLastHour(now)).toBe(3);
    expect(await history.shouldWarn(now)).toBe(true);
  });
});
