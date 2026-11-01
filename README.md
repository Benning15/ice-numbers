# Ice Numbers

A browser-based 16-team hockey league simulator focused on long-term statistics and history.

## Project files

- `index.html` – HTML page and script references
- `styles.css` – page layout, tables, and team logos
- `js/core.js` – default team names, settings, state, seeded randomness, and utilities
- `js/storage.js` – IndexedDB storage operations
- `js/scoring.js` – players, game rolls, goals, assists, and hockey scores
- `js/simulation.js` – schedule, standings, regular season, and playoff rules
- `js/season-actions.js` – save and resume a season, and advance playoffs
- `js/views.js` – dashboard, standings, team/player history, FAQ, and bracket
- `js/customization.js` – rename teams and upload team logos
- `js/app.js` – settings, imports/exports, navigation events, and startup
- `tests/smoke.test.mjs` – automated rule and statistics regression checks

The JavaScript uses classic browser scripts (not ES modules); the order of the `<script defer>` tags in `index.html` is important. All scripts run in the same global lexical environment.

## Development and publishing

GitHub Pages serves the files directly from the repository's `main` branch. No build step, paid engine, or remote database is required.

Before publishing changes:
1. Run `node tests/smoke.test.mjs`.
2. Check each JavaScript file with `node --check`.
3. Make sure the dashboard and simulation controls work in a browser.

GitHub Actions automatically runs syntax and simulation tests on each push to `main`.

## Saving league history

League data is stored in the current browser's IndexedDB database, **IceNumbersV1**. Restructuring the code does **not** change its database name or records.

The website is public but your league data is not uploaded to GitHub. Use the built-in backup export before resetting a universe or clearing browser data.
