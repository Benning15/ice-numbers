# Ice Numbers

A browser-based 16-team hockey league simulator focused on long-term statistics and history. Current version: **1.3.18**.

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


## Hidden goal-versus-assist scoring styles (V1.3.18)

**Replaces the individual 25–40 goal-target system.** Team winners and final realistic scores continue to be determined by the original 0–12 rolls, capped win bonuses, uncapped Offensive Depth extra scoring, goalie score caps and overtime rules. The player allocation layer has changed: **every actual team goal awards one goal plus zero, one or two assists** (defaults: 6% / 19% / 75%). Each named player may receive at most one of those points on any goal; unnamed skaters can score or be assigned assists.

Each newly spawned or drafted player receives a random, **permanent and hidden goal tendency of 20–80**, with assist tendency equal to `100 − goalTendency`. This is a **selection weight rather than a goal/assist statistical target or guaranteed points ratio**. For a goal, the player's weight combines `((max(0,rating+Motivation)+1)/9)^goalExponent × 8 × (goalTendency/50)`. For an assist, the weight is `(max(0,rating+Motivation)+1)^assistExponent × ((100−goalTendency)/50)`. Unnamed skaters receive a total goal-selection weight of `2 × unnamedWeight` and an assist-selection weight of `unnamedWeight`. The original Goal talent curve, Assist star strength and Unnamed skater weight remain independently adjustable. A player's Hidden Motivation still rerolls annually within their permanent range and affects how often their name appears on a scoring play; it does not affect team wins.

The Settings **Live Scoring Calculator** now offers example **20–80% goal-versus-assist style sliders** for each occupied roster slot instead of goal-target sliders. These are examples only and never display or edit an actual player's hidden tendency. The existing automatic team-goal estimate, manual override and Empty slot choices all remain. The old **Maximum yearly goal-target change** setting is removed.

**Existing universes, player history and backups are preserved.** Previous goal-event archives and career totals are untouched. Older players without scoring tendencies use the neutral 50/50 style for remaining games in any already-active season and receive their permanent randomized hidden style at the next season start. At that boundary their obsolete hidden `goalTarget` fields are discarded. Earlier historical goal-target behavior in the version notes below is obsolete as of 1.3.18.

## One-, two-, and three-player Live Scoring Calculator rosters (V1.3.17)

The Live Scoring Calculator's three player-rating drop-downs now each include **Empty slot (no player)**. At least one featured player must be selected. Empty slots are *absent players*, not +0-rating featured players: they contribute no team rating/Offensive Depth bonus and have zero featured goal/assist probability. Empty players are omitted from the resulting scoring table, and their example goal/assist style sliders are disabled. The automatic projected team goals use only the actual selected players and respond immediately to changes. This allows modelling one or two named featured players alongside the existing three-player preview, while unnamed skaters continue to receive goals and assists as usual. The game's regular simulation, saved players, league settings and archives are unchanged.

## Live Scoring Calculator estimates team goals (V1.3.16)

The Settings **Live Scoring Calculator** now automatically projects a team's expected total goals from the selected example roster ratings instead of always assuming 3 goals per game. The projection uses a **deterministic 6,000-game sample** of the same rolls, winning-bonus cap, score-margin noise, overtime coin flips, goal ceilings, rare goal surges, and Offensive Depth bonuses as real regular-season games. The preview team faces a **representative +8/+1/+1 opponent**, so this is an approximate matchup-based team-goal forecast, **not** a guarantee of how many goals the actual league or another particular opponent will allow. It uses the current unsaved scoring settings and season length, updates instantly when example player ratings or rules change, and never advances the live universe's RNG or edits games.

An **Auto-estimate from ratings and rules** checkbox is on by default. In automatic mode the team-goals field is read-only and reflects the projection. Uncheck it for a manual team-goals override (preserved while editing player ratings); check it again to resume automatic estimates. The estimated team goals feed into the existing goal/assist probability preview, including the example hidden goal-versus-assist style sliders. No real scoring mechanics, saved league settings, or archived statistics are changed by this calculator.

## Set as Default settings (V1.3.15)

The Settings page has a **Set as Default** button next to **Save All Settings** in the sticky toolbar. It validates and saves all current Settings-page values to the **current league**, then stores a separate copy as the preferred **default for future new universes in this browser**. The current league's players, statistics, history, and schedule remain intact. You cannot edit settings mid-playoffs, including setting defaults.

Browser-local default settings are kept in a separate IndexedDB `meta` record (`customSettingsDefaults`) and applied when a new league is created through **Start a new universe**, or when the application creates its initial league in that browser. Resetting a league or importing a backup preserves the local defaults record. Existing saved leagues and imported universes retain their own settings instead of being overwritten. These preferences are **not shared automatically across browsers or devices**, and are not embedded in full-league backup JSON files. Saving with **Set as Default** again replaces the previous preferred settings. Built-in defaults remain unchanged in `js/core.js`.

## Historical: retired personal goal targets (V1.3.13–1.3.14)

Those releases introduced and later expanded per-player 25–40 goal targets with annual ±2 movement. **This entire feature and its settings controls were replaced by permanent 20/80–80/20 goal-versus-assist tendencies in V1.3.18.** Saved historical goals and assists remain unchanged.

## Default scoring calibration (V1.3.12)

**New universes** now default to **Offensive Depth Strength 3.0** and a **15-goal maximum per team per game**—the settings used for offensive scoring calibration. The maximum Offensive Depth strength remains 3.0 (in 0.25 increments), and players can still select lower settings or switch the depth mechanic off.

**Saved universes are not changed.** Their stored strength and cap remain as selected. For much older saves that predate these two settings, the pre-existing fallback of strength 1.0 and cap 9 is explicitly preserved on load, while new universes start with 3.0 and 15.

## Historical: former +8 goal-rate calibration (V1.3.11)

V1.3.11 experimented with approximately 30 goals per 30-game season for a neutral +8. This was later replaced by individual goal targets, then **fully retired in V1.3.18**. Current featured scorers are selected by player rating, Hidden Motivation and permanent goal/assist style; no explicit 30-goal target remains.

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
