# Ice Numbers

A browser-based 16-team hockey league simulator focused on long-term statistics and history. Current version: **1.3.9**.

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


## Individual Seasons leaderboard (V1.3.9)

On **Player History**, use the **View** dropdown to switch between **Combined Seasons (Career)** and **Individual Seasons**. The original career leaderboard and its independent sorting remain available.

Individual Seasons ranks every archived player-season separately; the same player may appear multiple times. Sort columns or use the sort dropdown to rank single-season regular-season goals, assists, points, points per game, playoff production, and other fields. Each entry shows the player's team, displayed season rating, career year, regular-season games/goals/assists/points and P/GP, separate playoff games/goals/assists/points, and championships. Player names open career profiles; completed season numbers open that season's history. Live playoff seasons are labeled **live**.

Season performances are reconstructed from stored rosters and actual scoring-play events, including archives created before this release; no stored career or game statistics are rewritten. Missing old scoring play logs are explicitly shown as unavailable rather than zero. The top 1,000 performances for the chosen sort appear by default, 100 per page; a name/team search can find any archived performance. Browser-session caching avoids rereading every game when simply changing sorting or pages, with automatic refresh as the league advances.

## Offensive Depth (V1.3.8)

Uncapped roster bonuses above the configured team winning cap create *extra scoring opportunities*, especially on higher original team rolls. With Offensive Depth Strength at 1 (default), each 16 uncapped points above the capped winning bonus is worth one expected extra goal on a maximum roll, or half a goal on a half-size roll, before the score ceiling. This affects final goal totals in both regular season and playoffs, but not the underlying adjusted rolls used to determine the winner.

The Settings page exposes **Offensive Depth Strength** from 0 (off / old scoring behavior) to 3 in 0.25 steps, with a live example of +8/+1/+1 vs +8/+8/+8. **Maximum team goals in a game** defaults to 9 and is adjustable up to 15. Non-overtime winners always have more goals, and coin-flip overtime finishes remain one-goal games. All goal events, assists, player totals and archives are recorded for extra goals normally. Previous seasons are unchanged; new settings apply to future seasons only.

## Hidden Motivation (V1.3.7)

Every featured player receives a hidden, permanent Motivation interval bounded by -2 and +2 when generated. Most intervals are narrow and centered near zero; unusual consistently positive/negative ranges and wide ranges are less common. Once at the start of each new season, a value is rolled within the permanent interval. Goal and assist scoring weights use `Math.max(0, rating + seasonalMotivation)` before applying the existing exponent; regular-season winning bonuses, playoff results, and team-goal generation are unchanged. Neither the permanent interval nor the season's rolled value appears in player pages, standings, or archived rosters. The Settings calculator deliberately uses neutral (zero) Motivation as an illustration.

Legacy league players without Motivation receive a permanent range and a season value at their *next new season*; already active playoffs finish under their existing scoring weights. Historical player stats and game records are never rewritten. Motivation is stored privately in the existing saved player records and is included in complete exported backups.

## Saving league history

League data is stored in the current browser's IndexedDB database, **IceNumbersV1**. Restructuring the code does **not** change its database name or records.

V1.3 adds a season-complete championship screen, championship archive, clickable season-by-season player careers reconstructed from saved game records, a searchable/paged Player History archive, and live player generation odds totals. Existing saved universes require no reset.

The website is public but your league data is not uploaded to GitHub. Use the built-in backup export before resetting a universe or clearing browser data.
