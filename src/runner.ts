// Runs one keyword job from start to end: opens Chrome, goes through the query list,
// saves after every search, and obeys Pause / Continue / Stop.

import { EventEmitter } from 'node:events';
import type { RunSettings, SuggestionRow } from './types.js';
import type { PageCheck, SearchSession } from './google.js';
import type { RunStore, SavedRun } from './store.js';
import { buildQueries } from './queries.js';
import { cleanSuggestions } from './clean.js';
import { pickDelayMs } from './settings.js';

/** What the runner is doing right now, shown on the page. */
export type RunnerState =
  | 'idle'
  | 'running'
  | 'paused' // the user pressed Pause
  | 'waiting' // Google shows a check or cookie screen; the user must act, then press Continue
  | 'finished'
  | 'stopped'
  | 'browser-closed'
  | 'error';

/** A picture of the current progress, sent to the page after every change. */
export interface RunnerSnapshot {
  state: RunnerState;
  message: string;
  seed: string;
  done: number;
  total: number;
  currentQuery: string;
  totalSuggestions: number;
  /** Unique keywords found so far, in the order they were found. */
  keywords: string[];
}

export interface RunnerOptions {
  store: RunStore;
  /** Opens the browser. Tests pass a fake one. */
  openSession: (settings: RunSettings) => Promise<SearchSession>;
  /** How long to wait before the next search. Tests pass a tiny value. */
  delayMs?: (settings: RunSettings) => number;
  /** How often waits check for Pause/Stop, in milliseconds. */
  tickMs?: number;
}

export const MESSAGES = {
  blocked: 'Google wants a check. Please solve it in the browser window, then press Continue.',
  consent: 'Google is showing a cookie screen. Please click Accept or Reject in the browser window, then press Continue.',
  paused: 'Paused. Press Continue when you are ready.',
  browserClosed: 'The browser window was closed. Your progress is saved: press Start to resume.',
  stopped: 'Stopped. Everything collected so far is kept, and you can download the Excel file.',
  finished: 'Finished! You can download the Excel file now.',
  retry: 'Something went wrong in the browser. Check the Google window, then press Continue to try again.',
} as const;

/** Thrown inside the loop to leave it straight away when Stop is pressed or the browser closes. */
class StopSignal extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Runner extends EventEmitter {
  private run?: SavedRun;
  private session?: SearchSession;
  private state: RunnerState = 'idle';
  private message = '';
  private currentQuery = '';
  private stopRequested = false;
  /** Set while paused or waiting; calling it lets the run carry on. */
  private releasePause?: () => void;

  constructor(private readonly options: RunnerOptions) {
    super();
  }

  /** True while a run is in progress (including paused or waiting for the user). */
  get busy(): boolean {
    return ['running', 'paused', 'waiting'].includes(this.state);
  }

  /** The current run's saved data, used to build the Excel file. */
  get currentRun(): SavedRun | undefined {
    return this.run;
  }

  snapshot(): RunnerSnapshot {
    const rows = this.run?.rows ?? [];
    return {
      state: this.state,
      message: this.message,
      seed: this.run?.settings.seed ?? '',
      done: this.run?.doneCount ?? 0,
      total: this.run?.queries.length ?? 0,
      currentQuery: this.currentQuery,
      totalSuggestions: rows.length,
      keywords: [...new Set(rows.map((r: SuggestionRow) => r.suggestion))],
    };
  }

  /**
   * Starts a new run, or carries on a saved one if `resumeFrom` is given.
   * Returns straight away; progress is reported through 'update' events.
   */
  start(settings: RunSettings, resumeFrom?: SavedRun): void {
    if (this.busy) throw new Error('A run is already going. Stop it first.');
    this.run = resumeFrom
      ? { ...resumeFrom, status: 'running' }
      : {
          settings,
          startedAt: new Date().toISOString(),
          queries: buildQueries(settings.seed, settings),
          doneCount: 0,
          rows: [],
          status: 'running',
        };
    this.stopRequested = false;
    this.currentQuery = '';
    this.setState('running', resumeFrom ? `Resuming from search ${resumeFrom.doneCount + 1}.` : 'Opening Chrome…');
    void this.loop();
  }

  pause(): void {
    if (this.state !== 'running') return;
    this.setState('paused', MESSAGES.paused);
  }

  /** Continue after Pause, a Google check, or a cookie screen. */
  continue(): void {
    if (this.state !== 'paused' && this.state !== 'waiting') return;
    this.setState('running', 'Continuing…');
    this.releasePause?.();
  }

  /** Stop keeps everything collected so far. */
  stop(): void {
    if (!this.busy) return;
    this.stopRequested = true;
    this.releasePause?.();
  }

  private async loop(): Promise<void> {
    const run = this.run!;
    try {
      this.session = await this.options.openSession(run.settings);
      // If the window is closed while paused, wake up so the loop can notice it.
      this.session.onClosed(() => this.releasePause?.());
      while (run.doneCount < run.queries.length) {
        const query = run.queries[run.doneCount];
        this.currentQuery = query.text;
        await this.checkpoint();
        await this.waitUntilGoogleReady();
        this.showSearching(query.text);

        const texts = await this.collectWithRetry(query.text);
        run.rows.push(...cleanSuggestions(query, texts, run.settings.seed));
        run.doneCount += 1;
        await this.options.store.save(run);
        this.emitUpdate();

        if (run.doneCount < run.queries.length) await this.wait(this.delayMs(run.settings));
      }
      await this.finish('finished', MESSAGES.finished);
    } catch (error) {
      if (this.stopRequested) {
        await this.finish('stopped', MESSAGES.stopped);
      } else if (this.session?.closed) {
        // Keep the saved status as "running" so pressing Start again offers to resume.
        this.currentQuery = '';
        this.setState('browser-closed', MESSAGES.browserClosed);
      } else {
        await this.session?.close();
        this.setState('error', `Something went wrong: ${(error as Error).message}`);
      }
    }
  }

  private async finish(status: 'finished' | 'stopped', message: string): Promise<void> {
    const run = this.run!;
    run.status = status;
    await this.options.store.save(run);
    await this.session?.close();
    this.currentQuery = '';
    this.setState(status, message);
  }

  /** Leaves the loop if Stop was pressed or the browser closed; holds here while paused. */
  private async checkpoint(): Promise<void> {
    if (this.stopRequested || this.session?.closed) throw new StopSignal();
    if (this.state === 'paused' || this.state === 'waiting') {
      await new Promise<void>((resolve) => (this.releasePause = resolve));
      this.releasePause = undefined;
      if (this.stopRequested || this.session?.closed) throw new StopSignal();
    }
  }

  /** Waits for the user to do something in the browser, then press Continue. */
  private async waitForUser(message: string): Promise<void> {
    this.setState('waiting', message);
    await this.checkpoint();
  }

  /** Before each search, make sure Google shows its normal page. Never solves a check: only waits for the user. */
  private async waitUntilGoogleReady(): Promise<void> {
    let check: PageCheck = await this.session!.prepare();
    while (check !== 'ready') {
      await this.waitForUser(check === 'blocked' ? MESSAGES.blocked : MESSAGES.consent);
      check = await this.session!.prepare();
    }
  }

  /** Runs one search. If the browser hiccups, asks the user to look and press Continue, then tries again. */
  private async collectWithRetry(text: string): Promise<string[]> {
    for (;;) {
      try {
        return await this.session!.collect(text);
      } catch (error) {
        if (this.stopRequested || this.session!.closed) throw error;
        await this.waitForUser(MESSAGES.retry);
        await this.waitUntilGoogleReady();
        this.showSearching(text);
      }
    }
  }

  /** Waits between searches in small steps, so Pause and Stop react quickly. Paused time does not count. */
  private async wait(ms: number): Promise<void> {
    const tick = this.options.tickMs ?? 200;
    let remaining = ms;
    while (remaining > 0) {
      await this.checkpoint();
      await sleep(Math.min(tick, remaining));
      remaining -= tick;
    }
    await this.checkpoint();
  }

  private delayMs(settings: RunSettings): number {
    return this.options.delayMs ? this.options.delayMs(settings) : pickDelayMs(settings.speed);
  }

  /** Updates the message without undoing a Pause that was pressed a moment ago. */
  private showSearching(text: string): void {
    if (this.state === 'running') this.setState('running', `Searching: ${text}`);
  }

  private setState(state: RunnerState, message: string): void {
    this.state = state;
    this.message = message;
    this.emitUpdate();
  }

  private emitUpdate(): void {
    this.emit('update', this.snapshot());
  }
}
