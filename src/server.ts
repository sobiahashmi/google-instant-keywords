// The small local web server: serves the page at http://localhost:3000 (or the PORT in .env), receives the
// button presses, and pushes live progress to the page (Server-Sent Events).
// It only listens on this computer (127.0.0.1), never on the network.

import express, { type Request, type Response } from 'express';
import { exec } from 'node:child_process';
import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GoogleSession } from './google.js';
import { Runner, type RunnerSnapshot } from './runner.js';
import { RunStore } from './store.js';
import { RunHistory } from './history.js';
import { DOMAINS, LANGUAGES, validateSettings } from './settings.js';
import { buildExcelBuffer, excelFileName } from './excel.js';
import { loadPort } from './config.js';
import { isPortInUse } from './port.js';

const PORT = readPortOrExit();
const HOST = '127.0.0.1';
const ROOT = process.cwd();
const RUNS_FOLDER = path.join(ROOT, 'runs');
const EXPORTS_FOLDER = path.join(ROOT, 'exports');
const PROFILE_FOLDER = path.join(ROOT, '.browser-profile');

const store = new RunStore(RUNS_FOLDER);
const history = new RunHistory(path.join(RUNS_FOLDER, 'start-history.json'));
const runner = new Runner({
  store,
  openSession: (settings) =>
    GoogleSession.open({ domain: settings.domain, language: settings.language, profileFolder: PROFILE_FOLDER }),
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
// The Inter font is served from this computer, so the page loads nothing from the internet.
app.use('/fonts', express.static(path.join(ROOT, 'node_modules', '@fontsource', 'inter', 'files')));

/** Sends a plain-English error back to the page. */
function fail(res: Response, status: number, error: unknown) {
  res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
}

/** The choices for the dropdowns. */
app.get('/api/options', (_req, res) => {
  res.json({ domains: DOMAINS, languages: LANGUAGES });
});

/** Live progress: the page keeps this connection open and gets a message after every change. */
app.get('/api/events', (req: Request, res: Response) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (snapshot: RunnerSnapshot) => res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  send(runner.snapshot());
  runner.on('update', send);
  req.on('close', () => runner.off('update', send));
});

/**
 * Called before starting: checks the form, and tells the page whether there is an
 * unfinished run from today to resume, and whether to warn about too many runs.
 */
app.post('/api/check', async (req, res) => {
  try {
    const settings = validateSettings(req.body);
    const saved = await store.findResumable(settings.seed);
    res.json({
      resumable: saved ? { done: saved.doneCount, total: saved.queries.length } : null,
      tooManyRuns: await history.shouldWarn(),
    });
  } catch (error) {
    fail(res, 400, error);
  }
});

/** Starts a run. With { resume: true } it carries on today's unfinished run for this seed. */
app.post('/api/start', async (req, res) => {
  try {
    if (runner.busy) throw new Error('A run is already going. Stop it first.');
    const settings = validateSettings(req.body.settings ?? {});
    const saved = req.body.resume ? await store.findResumable(settings.seed) : undefined;
    await history.recordStart();
    runner.start(saved?.settings ?? settings, saved);
    res.json({ ok: true });
  } catch (error) {
    fail(res, 400, error);
  }
});

app.post('/api/pause', (_req, res) => {
  runner.pause();
  res.json({ ok: true });
});

app.post('/api/continue', (_req, res) => {
  runner.continue();
  res.json({ ok: true });
});

app.post('/api/stop', (_req, res) => {
  runner.stop();
  res.json({ ok: true });
});

/** Builds the Excel file, keeps a copy in exports/, and sends it to the browser as a download. */
app.get('/api/excel', async (_req, res) => {
  try {
    const run = runner.currentRun;
    if (!run || run.rows.length === 0) throw new Error('There is nothing to download yet. Run a keyword first.');

    const date = new Date(run.startedAt);
    const fileName = excelFileName(run.settings.seed, date);
    const buffer = await buildExcelBuffer({
      settings: run.settings,
      rows: run.rows,
      queriesRun: run.doneCount,
      status: run.status,
      date,
    });

    await mkdir(EXPORTS_FOLDER, { recursive: true });
    await writeFile(path.join(EXPORTS_FOLDER, fileName), buffer);

    res.attachment(fileName).send(buffer);
  } catch (error) {
    fail(res, 400, error);
  }
});

/** Reads PORT from .env; if it is not a valid number, explains why and stops. */
function readPortOrExit(): number {
  try {
    return loadPort();
  } catch (error) {
    console.error(`\n${(error as Error).message}\nOpen the .env file and set, for example: PORT=3000\n`);
    process.exit(1);
  }
}

/** Explains which port is busy and stops. The tool never moves to another port by itself. */
function exitPortBusy(): never {
  console.error(`\nPort ${PORT} is busy: another program is already using it.`);
  console.error(`If the tool is already running in another window, just open http://localhost:${PORT}`);
  console.error('Otherwise close the other program, or choose a different port in the .env file (for example PORT=3001).\n');
  process.exit(1);
}

if (await isPortInUse(PORT)) exitPortBusy();

const server = http.createServer(app);

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') exitPortBusy();
  if (error.code === 'EACCES') {
    console.error(`\nWindows does not allow the tool to use port ${PORT}. Choose another port in the .env file (for example PORT=3001).\n`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

// This runs only once the port is really ours.
server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\nGoogle Instant Keywords running at ${url}`);
  console.log('To turn it off, click in this window and press Ctrl+C.\n');
  // Open the page in the normal browser (Windows "start" command).
  if (process.platform === 'win32' && !process.env.NO_OPEN) exec(`start "" ${url}`);
});
