import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildExcelBuffer, excelFileName } from '../src/excel.js';
import { SAMPLE_SETTINGS, sampleRows } from './sample-data.js';

const DATE = new Date(2026, 9, 15, 9, 0, 0);

/** Builds the Excel file from sample data and reads it back like Excel would. */
async function buildAndReopen() {
  const rows = sampleRows();
  const buffer = await buildExcelBuffer({ settings: SAMPLE_SETTINGS, rows, queriesRun: 53, status: 'finished', date: DATE });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return { workbook, rows };
}

/** All values of one sheet as plain arrays (row 1 = headers). */
function sheetValues(sheet: ExcelJS.Worksheet) {
  const values: unknown[][] = [];
  sheet.eachRow((row) => values.push((row.values as unknown[]).slice(1)));
  return values;
}

describe('excelFileName', () => {
  it('uses the seed and the date', () => {
    expect(excelFileName('Boho Earrings', DATE)).toBe('boho-earrings-google-instant-2026-10-15.xlsx');
  });
});

describe('buildExcelBuffer', () => {
  it('has the three sheets in order', async () => {
    const { workbook } = await buildAndReopen();
    expect(workbook.worksheets.map((s) => s.name)).toEqual(['All Suggestions', 'Unique Keywords', 'Summary']);
  });

  it('fills All Suggestions with one row per suggestion', async () => {
    const { workbook, rows } = await buildAndReopen();
    const values = sheetValues(workbook.getWorksheet('All Suggestions')!);
    expect(values[0]).toEqual(['Typed Query', 'Side', 'Letter', 'Position', 'Suggestion', 'Words', 'Collected At']);
    expect(values).toHaveLength(rows.length + 1);
    expect(values[1]).toEqual(['boho earrings', 'Seed', '', 2, 'boho earrings gold', 3, '2026-10-15 10:30:00']);
  });

  it('has no duplicates on Unique Keywords', async () => {
    const { workbook } = await buildAndReopen();
    const values = sheetValues(workbook.getWorksheet('Unique Keywords')!);
    expect(values[0]).toEqual(['Keyword', 'Times Seen', 'First Found By']);
    const keywords = values.slice(1).map((v) => v[0]);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it('fills the Summary sheet', async () => {
    const { workbook, rows } = await buildAndReopen();
    const summary = Object.fromEntries(sheetValues(workbook.getWorksheet('Summary')!).slice(1));
    expect(summary).toMatchObject({
      Seed: 'boho earrings',
      'Google domain': 'google.com',
      Language: 'en',
      Date: '2026-10-15',
      'Queries run': 53,
      'Total suggestions': rows.length,
      'Run status': 'Finished',
    });
  });

  it('has a bold header with a filter and a frozen first row on every sheet', async () => {
    const { workbook } = await buildAndReopen();
    for (const sheet of workbook.worksheets) {
      expect(sheet.getRow(1).font?.bold ?? sheet.getCell('A1').font?.bold).toBe(true);
      expect(sheet.autoFilter).toBeTruthy();
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
      expect(sheet.getColumn(1).width).toBeGreaterThan(5);
    }
  });
});
