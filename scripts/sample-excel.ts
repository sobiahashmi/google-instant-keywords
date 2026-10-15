// Makes an example Excel file from made-up data, so the layout can be checked without a browser.
// Run it with: npm run sample

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildExcelBuffer, excelFileName } from '../src/excel.js';
import { SAMPLE_SETTINGS, sampleRows } from '../tests/sample-data.js';

const date = new Date();
const buffer = await buildExcelBuffer({
  settings: SAMPLE_SETTINGS,
  rows: sampleRows(),
  queriesRun: 4,
  status: 'finished',
  date,
});

const folder = path.resolve('exports');
await mkdir(folder, { recursive: true });
const filePath = path.join(folder, `SAMPLE-${excelFileName(SAMPLE_SETTINGS.seed, date)}`);
await writeFile(filePath, buffer);
console.log(`Sample Excel file saved here:\n${filePath}`);
