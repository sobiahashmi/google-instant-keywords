# PRD: Google Instant Keyword Collector (personal, local tool)

Version 1.0 · Owner: Sobia Alamgir · Status: Ready to build

## 1. Summary

A small tool that runs **only on my own computer**. I give it a seed keyword. It opens a real Chrome browser window, goes to Google, and types into the Google search bar exactly like a person would:

1. `keyword a`, `keyword b`, `keyword c` ... `keyword z`
2. `keyword aa`, `keyword bb`, `keyword cc` ... `keyword zz`

After each typed text it reads the suggestions Google shows under the search bar (Google Instant / autocomplete), saves them, clears the box and types the next one. At the end it gives me an Excel file with all related keywords.

No paid tools, no API keys, no accounts.

## 2. Scope

**In scope (v1)**
- Local tool only. It is never deployed to a server or the internet.
- Google web search suggestions only.
- Right side of the keyword (keyword + letters), as listed above. Optional checkbox for the left side (`a keyword` ... `z keyword`, `aa keyword` ... `zz keyword`), off by default.
- Excel (.xlsx) export.

**Out of scope (v1)**
- Search volume, difficulty or any metrics.
- Running on a server, many users, or accounts.
- Any other website.

## 3. How I use it

1. Open the project folder in Cursor and run `npm start`.
2. A local page opens at `http://localhost:3000`.
3. I fill in:
   - Seed keyword (required)
   - Google domain: dropdown with google.com (default), google.co.uk, google.ca, google.de, google.si, google.com.pk
   - Language for the interface (`hl`), default English
   - Checkboxes: a-z (on), aa-zz (on), left side (off)
   - Speed: Slow (default, 4-7 seconds between searches), Normal (2-4 seconds)
4. I press **Start**. A visible Chrome window opens and I can watch it type.
5. The page shows progress: "18 of 52 · keyword r" and the keywords found so far.
6. When finished, I press **Download Excel**.

## 4. Functional requirements

### 4.1 Browser automation
- Use Playwright with the installed Chromium/Chrome, **headed** (visible window), not headless.
- Use a persistent browser profile in a local folder (`.browser-profile/`) so Google cookies and consent choice are remembered between runs.
- On first visit, if Google shows a cookie/consent screen, try to click the accept/reject button; if not possible, pause and ask me to click it, then continue.
- For each query:
  1. Click the search box, select all and delete.
  2. Type the query character by character with a small random delay per key (50-150 ms).
  3. Wait until the suggestion list is visible or 3 seconds pass.
  4. Read every suggestion text in the list (ignore "Report inappropriate predictions" and similar non-keyword rows).
  5. Clear the box. Do **not** press Enter.
  6. Wait the chosen delay (random within the range) before the next query.
- If Google shows a CAPTCHA or "unusual traffic" page: pause the run, show a clear message "Google wants a check. Please solve it in the browser window, then press Continue", and continue only after I press Continue. Never try to solve or bypass a CAPTCHA automatically.
- I can press **Pause**, **Continue** and **Stop** at any time. Stop keeps everything collected so far.

### 4.2 Query list
- Right side: `seed + " " + letter` for a-z, then `seed + " " + letter+letter` for aa-zz (52 queries).
- Left side (if checked): `letter + " " + seed` and `letter+letter + " " + seed` (52 more).
- Also run the seed on its own first.

### 4.3 Cleaning
- Trim, lowercase, collapse double spaces.
- Remove exact duplicates and the seed itself.
- Keep for every result: typed query, side (right/left/seed), letter(s), suggestion text, position in the list (1-10), word count, time collected.

### 4.4 Excel file
File name: `<seed>-google-instant-<YYYY-MM-DD>.xlsx`. Three sheets:
1. **All Suggestions**: Typed Query · Side · Letter · Position · Suggestion · Words · Collected At
2. **Unique Keywords**: one row per unique keyword, with how many times it appeared and the first query that found it, sorted A-Z
3. **Summary**: seed, Google domain, language, date, number of queries run, total suggestions, unique keywords, whether the run finished or was stopped

Header row bold with a filter, columns auto-sized, frozen first row.

### 4.5 Saving progress
- Save results to a local JSON file after every query (`runs/<seed>-<date>.json`), so nothing is lost if the browser or computer closes.
- If I start the same seed again on the same day, offer to resume from where it stopped.

## 5. Non-functional requirements

- Runs on Windows 10/11 (my machine) with Node.js LTS. Use **npm**, not pnpm.
- Runs locally on port 3000.
- Simple install: `npm install` then `npm start`. Playwright browser installs automatically on first run (`npx playwright install chromium` in a postinstall script).
- Clean, simple local page: Inter font, 15px border radius, mobile-friendly layout, clear buttons.
- Code: TypeScript, small clear modules, comments in plain English, unit tests for query generation, cleaning and Excel export.
- No secrets, no API keys, no data sent anywhere except normal Google searches from my own browser.

## 6. Tech choices

- Node.js + TypeScript
- Playwright (browser automation)
- ExcelJS (Excel file)
- A tiny local web server (Express or Fastify) serving one page, with progress pushed to the page by Server-Sent Events
- Vitest for tests

Project structure suggestion:
```
src/
  server.ts        local web server and routes
  runner.ts        controls the browser, pause/continue/stop
  queries.ts       builds the query list
  google.ts        types in Google and reads suggestions
  clean.ts         cleaning and de-duplication
  excel.ts         builds the .xlsx file
public/
  index.html       the form and progress page
runs/              saved progress (git-ignored)
.browser-profile/  saved browser profile (git-ignored)
```

## 7. Responsible use (built into the tool)

- Personal, low-volume use only. Default speed is Slow; minimum delay between searches is 2 seconds and cannot be set lower.
- Maximum 110 queries per run, and the page warns if I start more than 3 runs in one hour.
- The tool never solves CAPTCHAs, never rotates IPs or proxies, and never runs headless.
- Note: automated queries are against Google's terms of service; this tool is for my own manual-style research at a human pace, not for a public website or resale of data.

## 8. Milestones

1. **M1:** project setup, query list, cleaning, Excel export with unit tests (no browser yet, uses sample data).
2. **M2:** Playwright runner: type in Google, read suggestions, consent and CAPTCHA pause, progress saving.
3. **M3:** local page with form, progress, Pause/Continue/Stop, Download Excel, resume.
4. **M4:** test run with a real keyword, fix issues, write README with step-by-step instructions for a non-developer.

## 9. Acceptance test

With the seed `boho earrings` on google.com, Slow speed, right side only:
- 53 queries run (seed + 26 + 26) without me touching anything, unless Google asks for a check.
- The Excel file opens in Excel with 3 sheets, Unique Keywords has no duplicates, and every keyword contains related words.
- Closing the browser in the middle and pressing Start again resumes the run.