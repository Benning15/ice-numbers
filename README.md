# Ice Numbers

A browser-based 16-team hockey league simulator focused on long-term statistics and history. Current version: **1.3.7**.

## Project files

- `index.html` – HTML page and script references
- `styles.css` – page layout, tables, and team logos
- `js/core.js` – default team names, settings, state, seeded randomness, and utilities
- `js/storage.js` – IndexedDB storage operations
- `js/scoring.js` – players, hidden annual Motivation, game rolls, goals, assists, and hockey scores
- `js/simulation.js` – schedule, standings, regular season, and playoff rules
- `js/season-actions.js` – save and resume a season, and advance playoffs
- `js/views.js` – dashboard, standings, team/player history, FAQ, and bracket
- `js/v13.js` – championship celebration/history, player career profiles, and generation-odds feedback
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


## Hidden Motivation (V1.3.7)

Every featured player receives a hidden, permanent Motivation interval bounded by -2 and +2 when generated. Most intervals are narrow and centered near zero; unusual consistently positive/negative ranges and wide ranges are less common. Once at the start of each new season, a value is rolled within the permanent interval. Goal and assist scoring weights use `Math.max(0, rating + seasonalMotivation)` before applying the existing exponent; regular-season winning bonuses, playoff results, and team-goal generation are unchanged. Neither the permanent interval nor the season's rolled value appears in player pages, standings, or archived rosters. The Settings calculator deliberately uses neutral (zero) Motivation as an illustration.

Legacy league players without Motivation receive a permanent range and a season value at their *next new season*; already active playoffs finish under their existing scoring weights. Historical player stats and game records are never rewritten. Motivation is stored privately in the existing saved player records and is included in complete exported backups.

## Saving league history

League data is stored in the current browser's IndexedDB database, **IceNumbersV1**. Restructuring the code does **not** change its database name or records.

V1.3 adds a season-complete championship screen, championship archive, clickable season-by-season player careers reconstructed from saved game records, a searchable/paged Player History archive, and live player generation odds totals. Existing saved universes require no reset.

The website is public but your league data is not uploaded to GitHub. Use the built-in backup export before resetting a universe or clearing browser data.
