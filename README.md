# Ice Numbers — V1.4 (goal-driven engine)

A browser-based, 16-team hockey league simulator focused on unpredictable results, rare superstars, long-term league history, dynasties and droughts.

## Core game rules

- Teams have at most **three named players**, rated +1 through +8 at generation, plus an **unidentified roster**.
- Players have permanent hidden motivation ranges and roll a new seasonal motivation value (−2 through +2); their **effective rating is 0–10**.
- At the default setting, all players have a 50/50 goal/playmaking tendency. You can introduce permanent individual differences with **Tendency Spread**; these are *relative tendencies*, not guaranteed point ratios.
- Games start **0–0**. Each named player rolls for independent goals and for successful playmaking opportunities. Unidentified players also roll for independent goals based on available ice time.
- Each successful playmaking opportunity creates **one additional goal** scored by another named player or an unidentified player, and awards the creator a primary assist. A possible secondary assist does **not** create another goal.
- Existing goals and the overtime winner can also have 0–2 assists. Nobody can assist on their own goal.
- **Actual goals decide regulation results**, including playoffs. There is no separate 0–12 winner roll, regular-season bonus cap, or playoff seeding bonus.
- If regulation ends tied, **an even 50/50 coin flip decides the winner** independent of team strength, followed by exactly one scored overtime goal with eligible assists. The losing regular-season team earns one standings point.
- Players' ratings improve scoring *odds*, but goals are not guaranteed and 4-, 5-, 6-goal games remain possible.
- A base +8 player with a temporary effective rating of +9 displays **silver +8**; effective +10 displays **gold +8**. Their base +8 rating never changes.

## Settings and Testing Information

The **Settings** page allows tuning goal and playmaking rates around a +9 effective-rating benchmark, talent curves, Poisson scoring volatility, unidentified roster scoring/ice-time share, assist distribution, individual tendency variation, and +1 to +8 spawn/draft probabilities. **Set as Default** saves preferences for future universes in the same browser.

The **Testing Information** tab tracks measured team and player scoring, combined team base and effective rating, average players/team, goals/game, production by effective rating, unidentified scoring by roster size, spawn/draft frequency, and unusual single-game and season performances. Cumulative snapshots appear after **100 and 1,000** completed test seasons. Testing counters can be reset without clearing the league history.

An ordinary new league uses the V1.4 database (`IceNumbersV14`), separate from previous V1.3 saves. Old saves are not automatically migrated. Export/import handles V1.4 backups.

## Project structure

- `index.html` and `styles.css` — existing dashboard, navigation and styles
- `js/core.js` — default teams and rules, random source and league state
- `js/storage.js` — local browser IndexedDB persistence
- `js/scoring.js` — player ratings, motivation, independent goals, assists, overtime and diagnostics
- `js/simulation.js` — schedule, regulation, best-of-seven playoffs and franchise/player records
- `js/season-actions.js` — resumable season saves and playoff controls
- `js/views.js`, `js/v13.js` — existing team, player and championship interfaces
- `js/testing-view.js` — long-term testing statistics
- `js/customization.js` — names and team logos
- `js/app.js` — settings, saved defaults, backups, navigation and startup
- `tests/smoke.test.mjs` — simulation/regression checks

## Local verification

Run `node tests/smoke.test.mjs` and `for file in js/*.js; do node --check "$file"; done`.

The app is static HTML and JavaScript, with no build step. GitHub Actions checks JavaScript syntax and simulation tests on pull requests and changes to `main`.
