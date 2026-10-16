# Google Instant Keywords

A small tool for **your own Windows computer** that finds keyword ideas from Google's search suggestions.

You type a keyword, for example `boho earrings`. The tool opens a Chrome window and types into Google like a person would: `boho earrings a`, `boho earrings b` … `boho earrings zz`. It writes down every suggestion Google shows under the search box. At the end you get an **Excel file** with all the keywords.

- Free: no accounts, no API keys, no paid tools.
- Runs only on your computer, on port 3000 (the page is at http://localhost:3000).
- You can watch it work in a normal, visible Chrome window.

> **Please use it gently.** This is for personal research at a human pace. Automated searches go against Google's terms of service, so keep runs few and slow. Do not use it to run a public service or to resell data.

---

## 1. Install (only once)

1. **Install Node.js.** Go to https://nodejs.org, click the big **LTS** button, open the downloaded file and click **Next** until it is finished.
2. **Download this tool.** On the GitHub page of this project, click the green **Code** button, then **Download ZIP**.
3. **Unzip it.** Right-click the downloaded ZIP file → **Extract All…** → **Extract**. Put the folder somewhere easy to find, such as your Desktop.

Google Chrome is used if you have it. If not, the tool downloads its own copy of Chromium the first time.

## 2. Start the tool

1. Open the tool's folder.
2. **Double-click `start.bat`.**
   - The **first time**, a black window installs everything the tool needs. This takes a few minutes; please wait.
   - When it is ready, the black window shows **Google Instant Keywords running at http://localhost:3000**, and the page opens in your browser.
3. If the page does not open by itself, type `http://localhost:3000` in your browser's address bar.

**Keep the black window open** while you use the tool. To turn the tool off, close the black window.

*(If you use Cursor or VS Code: open the folder, open **Terminal → New Terminal**, and type `npm start`. It does the same thing.)*

## 3. Run a keyword

1. In **Seed keyword**, type your keyword, for example `boho earrings`.
2. Choose the **Google domain** (google.com, google.co.uk, google.de, …) and the **Language**.
3. Choose the letters:
   - **a – z**: `boho earrings a` … `boho earrings z` (on by default)
   - **aa – zz**: `boho earrings aa` … `boho earrings zz` (on by default)
   - **Also in front**: `a boho earrings` … `zz boho earrings` (off by default)
4. Choose the **Speed**. **Slow** is the default and the safest.
5. Click **Start**. A Chrome window opens and starts typing. **Don't type or click in that Chrome window** while it works.
6. The page shows the progress, for example "18 of 53 · boho earrings r", and the keywords found so far.

With the normal choices, a run is 53 searches and takes about 8 minutes.

**Buttons while it runs:**
- **Pause**: waits after the current search. **Continue** carries on.
- **Stop**: ends the run early. Everything found so far is kept.

**If something stops a run** (you close Chrome, or the computer shuts down): nothing is lost, because the tool saves after every search. Start the tool again, type the same keyword and click **Start**. It asks whether to **Resume**; click it and the run carries on where it stopped. This works for runs started on the same day.

## 4. Get the Excel file

When the run says **Finished** (or after **Stop**), click **Download Excel**.

- The file goes to your normal **Downloads** folder.
- A copy is also kept in the **`exports`** folder inside the tool's folder.
- The name looks like `boho-earrings-google-instant-2026-10-15.xlsx`.

The file has three sheets:

| Sheet | What is in it |
|---|---|
| **All Suggestions** | Every suggestion, with the typed text, side, letter, position in Google's list, number of words and time. |
| **Unique Keywords** | Each keyword once, A-Z, with how many times it appeared and the first search that found it. |
| **Summary** | The keyword, domain, language, date, number of searches, totals, and whether the run finished. |

## 5. If Google shows a check ("I'm not a robot")

Sometimes Google asks you to prove you are a person, or shows an "unusual traffic" page. The tool **never** answers this for you.

1. The tool pauses by itself and the page shows a yellow box: *"Google wants a check. Please solve it in the browser window, then press Continue."*
2. Go to the **Chrome window** and solve the check (tick the box or pick the pictures).
3. Back on the tool's page, click **Continue**.

If Google keeps asking, stop for a while (an hour or more) and use **Slow** speed. The page also warns you if you start more than 3 runs in one hour.

**Cookie screen:** in some countries Google first asks about cookies. The tool tries to click it for you. If it can't, the page asks you to click **Accept** or **Reject** in Chrome, then press **Continue**. Chrome remembers your choice for next time.

## 6. Changing the port

The tool always uses **port 3000**, so the page is always at http://localhost:3000. It never quietly switches to a different port.

If you see **"Port 3000 is busy"** when starting:
- The tool is probably **already running** in another black window. Just open http://localhost:3000.
- Otherwise another program is using port 3000. Close that program, or choose a different port:
  1. Open the file `.env` in the tool's folder with Notepad. (If there is no `.env` file, copy `.env.example` and rename the copy to `.env`.)
  2. Change `PORT=3000` to another number, for example `PORT=3001`, and save.
  3. Double-click `start.bat` again. The page is now at http://localhost:3001.

## 7. Where things are saved

| Folder | What is in it |
|---|---|
| `exports` | Copies of your Excel files |
| `runs` | Progress files, saved after every search (used for Resume) |
| `.browser-profile` | The tool's own Chrome settings and cookies (separate from your normal Chrome) |

None of these are uploaded anywhere.

---

## For developers

- Node.js + TypeScript, Playwright, ExcelJS, Express, Vitest. Requirements: [`ped.md`](ped.md). Project rules: [`CLAUDE.md`](CLAUDE.md).
- `npm install` (also installs Playwright's Chromium), `npm start`, `npm test`, `npm run typecheck`.
- `npm run sample` writes an example Excel file from made-up data. `npm run try -- "keyword"` does a terminal-only run (a-z, Slow).
- The port comes from `PORT` in `.env` (default 3000). The server refuses to start if anything already answers on that port.
