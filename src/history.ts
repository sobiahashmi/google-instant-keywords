// Remembers when runs were started, so the page can warn about starting too many in one hour.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ONE_HOUR_MS = 60 * 60 * 1000;
/** From the PRD: warn if more than this many runs are started within one hour. */
export const RUNS_PER_HOUR_BEFORE_WARNING = 3;

export class RunHistory {
  constructor(private readonly filePath: string) {}

  private async readStarts(): Promise<number[]> {
    try {
      return (JSON.parse(await readFile(this.filePath, 'utf8')) as number[]).filter(Number.isFinite);
    } catch {
      return [];
    }
  }

  /** How many runs were started in the last hour. */
  async startsInLastHour(now = Date.now()): Promise<number> {
    return (await this.readStarts()).filter((time) => now - time < ONE_HOUR_MS).length;
  }

  /** True if starting one more run now would be more than 3 in one hour. */
  async shouldWarn(now = Date.now()): Promise<boolean> {
    return (await this.startsInLastHour(now)) >= RUNS_PER_HOUR_BEFORE_WARNING;
  }

  /** Notes that a run was started now. Only the last hour is kept. */
  async recordStart(now = Date.now()): Promise<void> {
    const recent = (await this.readStarts()).filter((time) => now - time < ONE_HOUR_MS);
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify([...recent, now]), 'utf8');
  }
}
