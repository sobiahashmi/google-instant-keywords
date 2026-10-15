// Saves a run to a JSON file after every search, so nothing is lost if Chrome or the computer closes.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Query, RunSettings, RunStatus, SuggestionRow } from './types.js';
import { fileSafe, localDate } from './dates.js';

/** Everything about one run, exactly as saved in runs/<seed>-<date>.json */
export interface SavedRun {
  settings: RunSettings;
  /** ISO date-time of when the run was first started. */
  startedAt: string;
  queries: Query[];
  /** How many queries from the start of the list are finished. */
  doneCount: number;
  rows: SuggestionRow[];
  status: RunStatus;
}

export class RunStore {
  constructor(private readonly folder: string) {}

  /** runs/boho-earrings-2026-10-15.json */
  filePath(seed: string, date: Date = new Date()): string {
    return path.join(this.folder, `${fileSafe(seed)}-${localDate(date)}.json`);
  }

  /** Reads a saved run, or returns undefined if there is none (or it cannot be read). */
  async load(seed: string, date: Date = new Date()): Promise<SavedRun | undefined> {
    try {
      return JSON.parse(await readFile(this.filePath(seed, date), 'utf8')) as SavedRun;
    } catch {
      return undefined;
    }
  }

  /** A run for this seed from today that stopped before the end, if there is one. */
  async findResumable(seed: string, date: Date = new Date()): Promise<SavedRun | undefined> {
    const run = await this.load(seed, date);
    return run && run.doneCount < run.queries.length ? run : undefined;
  }

  /**
   * Writes the run to disk. It first writes a temporary file and then renames it,
   * so a crash in the middle of saving never leaves a half-written file behind.
   */
  async save(run: SavedRun): Promise<void> {
    await mkdir(this.folder, { recursive: true });
    const target = this.filePath(run.settings.seed, new Date(run.startedAt));
    const temporary = `${target}.tmp`;
    await writeFile(temporary, JSON.stringify(run, null, 2), 'utf8');
    await rename(temporary, target);
  }
}
