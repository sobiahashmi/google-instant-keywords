import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { PageCheck, SearchSession } from '../src/google.js';
import { MESSAGES, Runner, type RunnerSnapshot, type RunnerState } from '../src/runner.js';
import { RunStore } from '../src/store.js';
import { pickDelayMs, MIN_DELAY_MS } from '../src/settings.js';
import type { RunSettings } from '../src/types.js';

const SETTINGS: RunSettings = {
  seed: 'boho earrings',
  domain: 'google.com',
  language: 'en',
  includeSingle: true,
  includeDouble: false,
  includeLeft: false,
  speed: 'slow',
};

/** A pretend browser: returns two suggestions per query and can act out Google checks or a closed window. */
class FakeSession implements SearchSession {
  closed = false;
  typed: string[] = [];
  /** What prepare() reports next, one entry per call; "ready" once the list is empty. */
  checks: PageCheck[] = [];
  /** Close the window after this many searches. */
  closeAfter = Infinity;
  private listeners: (() => void)[] = [];

  async prepare(): Promise<PageCheck> {
    return this.checks.shift() ?? 'ready';
  }
  async collect(text: string): Promise<string[]> {
    if (this.closed) throw new Error('Target closed');
    this.typed.push(text);
    if (this.typed.length >= this.closeAfter) this.simulateUserClosingWindow();
    return [`${text} one`, `${text} two`];
  }
  onClosed(callback: () => void): void {
    this.listeners.push(callback);
  }
  async close(): Promise<void> {
    this.closed = true;
  }
  simulateUserClosingWindow(): void {
    this.closed = true;
    this.listeners.forEach((l) => l());
  }
}

let folder: string;
let store: RunStore;
let session: FakeSession;

function makeRunner() {
  return new Runner({ store, openSession: async () => session, delayMs: () => 5, tickMs: 1 });
}

/** Resolves when the runner reaches one of the given states. */
function waitForState(runner: Runner, ...states: RunnerState[]): Promise<RunnerSnapshot> {
  return new Promise((resolve) => {
    const check = (snap: RunnerSnapshot) => {
      if (states.includes(snap.state)) {
        runner.off('update', check);
        resolve(snap);
      }
    };
    runner.on('update', check);
    check(runner.snapshot());
  });
}

beforeEach(async () => {
  folder = await mkdtemp(path.join(os.tmpdir(), 'runner-test-'));
  store = new RunStore(folder);
  session = new FakeSession();
});
afterEach(() => rm(folder, { recursive: true, force: true }));

describe('pickDelayMs', () => {
  it('never goes below 2 seconds', () => {
    for (let i = 0; i < 200; i++) {
      expect(pickDelayMs('normal')).toBeGreaterThanOrEqual(MIN_DELAY_MS);
      const slow = pickDelayMs('slow');
      expect(slow).toBeGreaterThanOrEqual(4000);
      expect(slow).toBeLessThanOrEqual(7000);
    }
  });
});

describe('Runner', () => {
  it('runs every query, saves the run and marks it finished', async () => {
    const runner = makeRunner();
    runner.start(SETTINGS);
    const snap = await waitForState(runner, 'finished');

    expect(session.typed).toHaveLength(27);
    expect(session.typed[0]).toBe('boho earrings');
    expect(snap.done).toBe(27);
    expect(snap.totalSuggestions).toBe(54);
    expect(session.closed).toBe(true);

    const saved = await store.load('boho earrings');
    expect(saved?.status).toBe('finished');
    expect(saved?.rows).toHaveLength(54);
  });

  it('waits for the user when Google shows a check, and goes on after Continue', async () => {
    session.checks = ['blocked'];
    const runner = makeRunner();
    runner.start(SETTINGS);
    const waiting = await waitForState(runner, 'waiting');
    expect(waiting.message).toBe(MESSAGES.blocked);
    expect(session.typed).toHaveLength(0);

    runner.continue();
    await waitForState(runner, 'finished');
    expect(session.typed).toHaveLength(27);
  });

  it('asks the user to handle the cookie screen', async () => {
    session.checks = ['consent'];
    const runner = makeRunner();
    runner.start(SETTINGS);
    expect((await waitForState(runner, 'waiting')).message).toBe(MESSAGES.consent);
    runner.continue();
    await waitForState(runner, 'finished');
  });

  it('pauses, and Stop keeps what was collected', async () => {
    const runner = makeRunner();
    runner.start(SETTINGS);
    await new Promise<void>((resolve) => runner.on('update', (s) => s.done === 3 && resolve()));
    runner.pause();
    await new Promise((r) => setTimeout(r, 30));
    const pausedAt = session.typed.length;
    expect(runner.snapshot().state).toBe('paused');
    await new Promise((r) => setTimeout(r, 30));
    expect(session.typed.length).toBe(pausedAt); // nothing is typed while paused

    runner.stop();
    const snap = await waitForState(runner, 'stopped');
    expect(snap.done).toBe(pausedAt);
    expect((await store.load('boho earrings'))?.status).toBe('stopped');
  });

  it('resumes after the browser window was closed', async () => {
    session.closeAfter = 5;
    const runner = makeRunner();
    runner.start(SETTINGS);
    expect((await waitForState(runner, 'browser-closed')).message).toBe(MESSAGES.browserClosed);

    const saved = await store.findResumable('boho earrings');
    expect(saved?.doneCount).toBe(5);

    session = new FakeSession();
    runner.start(SETTINGS, saved);
    const snap = await waitForState(runner, 'finished');
    expect(session.typed[0]).toBe('boho earrings e'); // carries on with the 6th query
    expect(snap.done).toBe(27);
    expect(snap.totalSuggestions).toBe(54);
    expect(await store.findResumable('boho earrings')).toBeUndefined();
  });

  it('refuses to start twice at the same time', async () => {
    const runner = makeRunner();
    runner.start(SETTINGS);
    expect(() => runner.start(SETTINGS)).toThrow(/already/);
    runner.stop();
    await waitForState(runner, 'stopped');
  });
});
