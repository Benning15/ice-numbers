# Ice Numbers — V1.7 (stepwise lottery and generation draws)

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

## Offseason lottery and random generation

- After the championship screen, enter a **lottery involving all eight non-playoff teams**, each with equal odds. Each eligible team's pre-draft total base + is shown in descending order. Use **Lottery Pick** to reveal one winning team at a time, or **Sim All** to highlight all three winners together. The same predetermined lottery draw is saved on first click, regardless of reveal mode. **Three distinct teams** receive picks 1–3.
- As each draft pick is made, reveal the team's **original base + → new base +**, accounting for any player cut to make roster space. The draft summary preserves all three before/after values.
- The draft presents **four predetermined prospects**; their actual +1 to +8 ratings use your configurable draft odds. Three show a scouting range that includes the true rating and a known career year (1–3); the fourth hides both. After each pick, the true rating and career year appear on a silent, animated reveal.
- Drafted players join the selecting team for the following season. A full roster replaces its weakest player, so selecting a poor prospect is genuinely risky.
- Large (1/10/100/1,000-season) automatic runs skip animations and use an AI that evaluates only the visible scouting information, not secret ratings.
- **Random generated players across league/year** is editable from **0–16**, default **7**. During the generation draw, press **Generation Pick** to highlight one selected team per click or **Sim All** to reveal them all. All 16 teams still have equal eligibility; team tiles show only name and total base +, with no 3/3 badge. The selected team list is saved across refreshes and does not reroll as clicks continue. Following the three-pick draft, the player-generation ceremony ranks all 16 teams by combined base +, randomly selects up to 7 teams (including teams with a full roster), and highlights them. Selected teams are shown on a separate screen before each generated player's name, + rating, career year, and updated team + are revealed. Full teams compare a generated player to their weakest existing player: a higher base + wins, or an equal base + wins only when the new player is younger (lower career year); if ratings and years match the incumbent stays. The loser is marked **Cut** in the reveal and Player History, and generated players who fail to make a full roster are archived as Cut as well. **Hidden Motivation is never used in this decision.** Only three players may remain on any team. Each team can be selected only once per offseason. Previous balance estimates may change with this new replacement system.
- Starting teams are sampled from 0/1/2/3 players with 10%/15%/40%/35% chances. A zero-player team is allowed and is supported by unidentified-roster scoring.
- Draft and generation stages and newly created players are saved between page loads; existing V1.4/V1.5 games and player histories stay in the same IndexedDB database. A pre-existing pending last-place pick becomes a lottery when loaded. Older mid-offseason saves begin the new generation stage.

## Settings and Testing Information

The **Settings** page allows tuning goal and playmaking rates around a +9 effective-rating benchmark, talent curves, Poisson scoring volatility, unidentified roster scoring/ice-time share, assist distribution, individual tendency variation, and +1 to +8 generation/draft probabilities, plus yearly league-wide random generation count. **Set as Default** saves preferences for future universes in the same browser.

The **Testing Information** tab tracks measured team and player scoring, combined team base and effective rating, average players/team, goals/game, production by effective rating, unidentified scoring by roster size, spawn/draft frequency, and unusual single-game and season performances. Cumulative snapshots appear after **100 and 1,000** completed test seasons. Testing counters can be reset without clearing the league history.

An ordinary new league uses the V1.4 database (`IceNumbersV14`), separate from previous V1.3 saves. Old saves are not automatically migrated. Export/import handles V1.4 backups.

## Project structure

- `index.html` and `styles.css` — existing dashboard, navigation and styles
- `js/core.js` — default teams and rules, random source and league state
- `js/storage.js` — local browser IndexedDB persistence
- `js/scoring.js` — player ratings, motivation, independent goals, assists, overtime and diagnostics
- `js/draft.js` — equal-odds lottery, scouting and hidden ratings, three draft picks, animated UI, and automatic picks
- `js/generation.js` — post-draft ranking, random eligible team selection, highlighted cards, player reveals, automatic bulk-mode generation
- `js/simulation.js` — schedule, regulation, best-of-seven playoffs and franchise/player records
- `js/season-actions.js` — resumable season saves and playoff controls
- `js/views.js`, `js/v13.js` — existing team, player and championship interfaces
- `js/testing-view.js` — long-term testing statistics
- `js/customization.js` — names and team logos
- `js/app.js` — settings, saved defaults, backups, navigation and startup
- `tests/smoke.test.mjs` — simulation/regression checks

## Local verification

Run `node tests/smoke.test.mjs` for quick validation; run `ICE_NUMBERS_STRESS=1 node tests/smoke.test.mjs` for a real 1,000-season benchmark. Then run `for file in js/*.js; do node --check "$file"; done`.

The app is static HTML and JavaScript, with no build step. GitHub Actions checks JavaScript syntax and simulation tests on pull requests and changes to `main`.
