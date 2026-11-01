# Ice Numbers

A browser-based 16-team hockey league simulator focused on long-term statistics and history. Current version: **1.3.14**.

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


## Player career scoring ceiling (V1.3.14)

New players **still start with a hidden target of 25–35 goals per 30 games**, but each later season they may gain or lose up to 2 target goals (default drift). The target now has a **career ceiling of 40** instead of 35, allowing an elite scorer who starts at 35 to develop to 37, 39, and eventually 40. The floor remains 25. The Live Scoring Calculator's hypothetical player targets now allow 25–40, while actual player targets remain hidden and archived game outcomes are unchanged. Player movement and newly created targets continue to be randomized per player, not guaranteed improvements.

## Hidden individual goal targets (V1.3.13)

Every newly generated or drafted player receives a **permanent individual record of their current hidden goal-scoring target**, randomly initialized to **25–35 goals per 30 games** at +8 rating and neutral Motivation, with the population mean of 30. Lower ratings and hidden Motivation scale the goal-scoring rate using the existing Goal talent curve. Targets are probabilistic expectations, not guaranteed season results; game scores and winners remain unchanged.

**At the start of every later season**, each player's personal target moves independently by -2, -1, 0, +1 or +2, with a career range of 25–40 since V1.3.14 (originally capped at 35). The Settings page offers a **Maximum yearly target change** slider: 0 keeps individual targets fixed; 1 allows -1/0/+1; 2 (default) allows -2/-1/0/+1/+2. The target updates only once per season, not at every game, and is persisted in the saved player's hidden attributes. The per-player targets are not exposed in public player histories, annual rosters, or profiles.

A +8 with Motivation 0 and target 25, 30 or 35 has a proportional goal-rate target of 25/30, 1.0 or 35/30 per game before normalizing to the actual team goals available. When teams cannot generate enough total goals to fulfill all featured targets, they share the goals probabilistically. Individual game rolls, regular season scoring, offensive depth, playoffs, and goal-event archives keep their original rules; only attribution of scorers changes.

The Settings **Live Scoring Calculator** includes independent hypothetical target sliders (25–40) for three example players so the user can explore expected goals and assists without exposing or editing real hidden player targets. Newly created and active preexisting league players are supported: older players without these hidden attributes receive their first target at the next season boundary (not in the middle of saved playoffs); historical seasons are untouched.

## Default scoring calibration (V1.3.12)

**New universes** now default to **Offensive Depth Strength 3.0** and a **15-goal maximum per team per game**—the settings used when testing the +8 player goal target. The maximum Offensive Depth strength remains 3.0 (in 0.25 increments), and players can still select lower settings or switch the depth mechanic off.

**Saved universes are not changed.** Their stored strength and cap remain as selected. For much older saves that predate these two settings, the pre-existing fallback of strength 1.0 and cap 9 is explicitly preserved on load, while new universes start with 3.0 and 15.

## Goal distribution balancing (V1.3.11)

A player with a displayed **+8 rating and neutral (0) hidden Motivation** now targets about **1 goal per team game**: approximately 30 goals over a 30-game regular season, independent of whether their team features one +8 player or three. This is an expected goal rate, **not an enforced minimum or fixed 30-goal outcome**. Individual seasons vary through random scorer selections, hidden year-specific Motivation and team scoring opportunities.

Only the identity of the player credited with a goal changes. The original rolls, winning rules, score generation, Offensive Depth, goal ceiling and assist attribution algorithm remain untouched. The team cannot credit goals it did not actually score; if three +8 players are on a team that averages fewer than three goals/game, the combined target is mathematically impossible. These limitations are automatically reflected by normalizing scorer probabilities to available team goals.

The scoring pool uses relative individual goal rates `((max(0,rating+Motivation)+1)/9) ^ goalExponent`, anchored so a neutral +8 has relative rate 1. It assigns the remaining team goals to unnamed skaters, adjusting the share as the team's observed scoring pace changes during the season. A two-game prior prevents the earliest games from distorting estimated scoring pace. **Goal talent curve** controls scoring rates for other ratings relative to +8; **Assist star strength** retains the previous independent assist behavior; **Unnamed skater scoring weight** changes remaining goal shares relative to the default 8. Hidden Motivation continues to affect both goal and assist production.

The Live Scoring Calculator now uses these same neutral goal-rate allocations, with its manually entered assumed team goals per season providing the expected team goal pace. Existing history is never rewritten; new scoring applies only to games simulated after this release. The team's observed current-season scoring pace is stored in the normal league save and resets when a new season begins.

## Randomized starting rosters (V1.3.10)

In a **brand-new universe**, the first Season 1 simulation generates **1–3 players for every team** with 15% / 50% / 35% probability. Every starting player uses the existing regular player-generation rating odds (not boosted draft odds), randomly receives their starting career year, and gets the usual hidden Motivation range and annual roll. Starting rosters are capped by the configured maximum roster size, so a custom roster limit of 1 or 2 is honoured.

Season 1 **does not add another regular player spawn** after constructing opening rosters. Beginning with Season 2, annual player spawning and the usual last-place draft work as before. Player creation events and season rosters are archived as usual.

The feature uses an explicit, new-universe-only initialization flag, so existing saved leagues—including those still in Season 1 or already centuries old—keep their current rosters and past results. Nothing is added retroactively, and old saved states without the flag retain their former first-season behavior.

## Individual Seasons leaderboard (V1.3.9)

On **Player History**, use the **View** dropdown to switch between **Combined Seasons (Career)** and **Individual Seasons**. The original career leaderboard and its independent sorting remain available.

Individual Seasons ranks every archived player-season separately; the same player may appear multiple times. Sort columns or use the sort dropdown to rank single-season regular-season goals, assists, points, points per game, playoff production, and other fields. Each entry shows the player's team, displayed season rating, career year, regular-season games/goals/assists/points and P/GP, separate playoff games/goals/assists/points, and championships. Player names open career profiles; completed season numbers open that season's history. Live playoff seasons are labeled **live**.

Season performances are reconstructed from stored rosters and actual scoring-play events, including archives created before this release; no stored career or game statistics are rewritten. Missing old scoring play logs are explicitly shown as unavailable rather than zero. The top 1,000 performances for the chosen sort appear by default, 100 per page; a name/team search can find any archived performance. Browser-session caching avoids rereading every game when simply changing sorting or pages, with automatic refresh as the league advances.

## Offensive Depth (V1.3.8)

Uncapped roster bonuses above the configured team winning cap create *extra scoring opportunities*, especially on higher original team rolls. At Offensive Depth Strength 1 (the original default), each 16 uncapped points above the capped winning bonus is worth one expected extra goal on a maximum roll, or half a goal on a half-size roll, before the score ceiling. This affects final goal totals in both regular season and playoffs, but not the underlying adjusted rolls used to determine the winner.

The Settings page exposes **Offensive Depth Strength** from 0 (off / old scoring behavior) to 3 in 0.25 steps, with a live example of +8/+1/+1 vs +8/+8/+8. **Maximum team goals in a game** originally defaulted to 9 and is adjustable from 9 to 15; since V1.3.12, new universes start at 15. Non-overtime winners always have more goals, and coin-flip overtime finishes remain one-goal games. All goal events, assists, player totals and archives are recorded for extra goals normally. Previous seasons are unchanged; new settings apply to future seasons only.

## Hidden Motivation (V1.3.7)

Every featured player receives a hidden, permanent Motivation interval bounded by -2 and +2 when generated. Most intervals are narrow and centered near zero; unusual consistently positive/negative ranges and wide ranges are less common. Once at the start of each new season, a value is rolled within the permanent interval. Goal and assist scoring weights use `Math.max(0, rating + seasonalMotivation)` before applying the existing exponent; regular-season winning bonuses, playoff results, and team-goal generation are unchanged. Neither the permanent interval nor the season's rolled value appears in player pages, standings, or archived rosters. The Settings calculator deliberately uses neutral (zero) Motivation as an illustration.

Legacy league players without Motivation receive a permanent range and a season value at their *next new season*; already active playoffs finish under their existing scoring weights. Historical player stats and game records are never rewritten. Motivation is stored privately in the existing saved player records and is included in complete exported backups.

## Saving league history

League data is stored in the current browser's IndexedDB database, **IceNumbersV1**. Restructuring the code does **not** change its database name or records.

V1.3 adds a season-complete championship screen, championship archive, clickable season-by-season player careers reconstructed from saved game records, a searchable/paged Player History archive, and live player generation odds totals. Existing saved universes require no reset.

The website is public but your league data is not uploaded to GitHub. Use the built-in backup export before resetting a universe or clearing browser data.
