# Google Instant Keyword Collector: project rules

The full requirements are in `ped.md` (the PRD). Read it before changing behaviour.

## Who this is for
The owner is not a software developer. Explain changes in simple words and always
say exactly what to click or type to try them.

## Code quality
- High-quality, clean and maintainable TypeScript. Small modules, one job each.
- Comments in plain English that explain *why*, readable by a non-developer.
- Keep unit tests passing (`npm test`). Add tests for query generation, cleaning and Excel export when they change.

## Tooling
- Use **npm**. Never use pnpm or yarn.
- Start with `npm start`, test with `npm test`.

## Browser and Google: hard rules
- **Never run the browser headless.** The Chrome window must always be visible.
- **Never solve, bypass or work around CAPTCHAs** or "unusual traffic" pages. Pause and let the owner solve it by hand.
- **Never use proxies** or rotate IP addresses.
- **Minimum delay between searches is 2 seconds** and must never be lowered.
- Maximum 110 queries per run. Default speed is Slow.
- Never press Enter in the Google search box: only read the suggestions.

## Decisions agreed with the owner (beyond the PRD)
- Browser: use the installed Google Chrome with a separate profile in `.browser-profile/`; fall back to Playwright's Chromium if Chrome is not found.
- Language dropdown: English (default), German, Slovenian, Urdu, French.
- Excel: downloaded by the browser to the Downloads folder, and a copy is saved in `exports/`.
- Duplicates: removed within the same typed query on "All Suggestions"; fully de-duplicated (with counts) on "Unique Keywords".

## Git
- Commit after every meaningful change, with a clear message.
- `runs/`, `exports/`, `.browser-profile/` and `node_modules/` are never committed.
