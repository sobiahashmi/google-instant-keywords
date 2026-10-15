// Builds the Excel file with three sheets: All Suggestions, Unique Keywords and Summary.

import ExcelJS from 'exceljs';
import type { RunSettings, RunStatus, SuggestionRow } from './types.js';
import { buildUniqueKeywords } from './clean.js';
import { fileSafe, localDate, localDateTime } from './dates.js';

export interface ExcelInput {
  settings: RunSettings;
  rows: SuggestionRow[];
  queriesRun: number;
  status: RunStatus;
  /** The day the run started. */
  date: Date;
}

const SIDE_LABELS = { seed: 'Seed', right: 'Right', left: 'Left' } as const;

const STATUS_LABELS: Record<RunStatus, string> = {
  finished: 'Finished',
  stopped: 'Stopped before the end',
  running: 'Not finished yet',
};

/** "boho-earrings-google-instant-2026-10-15.xlsx" */
export function excelFileName(seed: string, date: Date): string {
  return `${fileSafe(seed)}-google-instant-${localDate(date)}.xlsx`;
}

/**
 * Adds a sheet with a bold header row, a filter on the header,
 * the first row frozen and columns sized to fit their contents.
 */
function addTable(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: (string | number)[][]) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.addRow(headers).font = { bold: true };
  sheet.addRows(rows);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };

  headers.forEach((header, i) => {
    const longest = Math.max(header.length, ...rows.map((row) => String(row[i] ?? '').length));
    // A little padding so the filter arrow does not cover the text; capped so huge cells stay readable.
    sheet.getColumn(i + 1).width = Math.min(longest + 4, 80);
  });
  return sheet;
}

/** Creates the whole workbook in memory. */
export function buildWorkbook(input: ExcelInput): ExcelJS.Workbook {
  const { settings, rows, queriesRun, status, date } = input;
  const unique = buildUniqueKeywords(rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Google Instant Keyword Collector';
  workbook.created = date;

  addTable(
    workbook,
    'All Suggestions',
    ['Typed Query', 'Side', 'Letter', 'Position', 'Suggestion', 'Words', 'Collected At'],
    rows.map((r) => [
      r.query,
      SIDE_LABELS[r.side],
      r.letters,
      r.position,
      r.suggestion,
      r.words,
      localDateTime(new Date(r.collectedAt)),
    ]),
  );

  addTable(
    workbook,
    'Unique Keywords',
    ['Keyword', 'Times Seen', 'First Found By'],
    unique.map((u) => [u.keyword, u.timesSeen, u.firstQuery]),
  );

  addTable(workbook, 'Summary', ['Item', 'Value'], [
    ['Seed', settings.seed],
    ['Google domain', settings.domain],
    ['Language', settings.language],
    ['Date', localDate(date)],
    ['Queries run', queriesRun],
    ['Total suggestions', rows.length],
    ['Unique keywords', unique.length],
    ['Run status', STATUS_LABELS[status]],
  ]);

  return workbook;
}

/** The finished .xlsx file as bytes, ready to save or download. */
export async function buildExcelBuffer(input: ExcelInput): Promise<Buffer> {
  const data = await buildWorkbook(input).xlsx.writeBuffer();
  return Buffer.from(data);
}
