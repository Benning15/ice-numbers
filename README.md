# Ice Numbers — V1.9.7 (final preseason team preview)

A browser-based, 16-team hockey league simulator focused on unpredictable results, rare superstars, long-term league history, dynasties and droughts.

## V1.9.7 — Final preseason team preview

After the three-pick lottery and random player-generation ceremony, the game stops at a **Preseason Team Preview** page before playing any regular-season games. Season 1 also gets a preview: its opening rosters are generated and saved once when that page first opens, so they won't reroll on refresh.

- All **16 team cards** are ranked by combined permanent **team +** and display the complete named-player roster (name, permanent +, and **career year / maximum career years**).
- The **reigning champion** (winner of the immediately preceding season) has a **gold outline** and trophies at the bottom-right. There is one 🏆 per **consecutive championship**; for very long streaks, display five trophies and a +N remainder.
- Each card displays either the team's ongoing **made-the-playoffs streak** or its **missed-the-playoffs streak**, using the most recently completed seasons. Season 1 has no reigning champion or prior playoff streaks.
- Click a player name for the permanent player record. You may return to the preview and visit Commissioner Mode before starting games.
- **Start Season** locks in the schedule and takes you to live standings without playing a game. Then use **Sim 1 Game / Team**, **Sim 10 Games / Team**, or **Finish Regular Season**. The preview also offers **Simulate Full Season** after inspection.
- A manual regular-season simulation or single full-season simulation opens the preview first. Multi-season **10/100/1000** fast-forward skips these intermediate screens so large simulations can run unattended.
- Existing saves already playing a regular season or playoffs continue normally. Archived records, draft/generation probabilities, and game-scoring behavior do not change.

## V1.9.6 tradeable future opportunities

Commissioner Mode now has a **Trade Future Opportunities** section. Each team may transfer its **next random player-generation opportunity** and **next winning draft-lottery opportunity**. These are two separate, one-time assets per originating team: **only one outstanding right of each kind per original team**, never an unlimited stream of future chances.

- The **original team** stays in the lottery with unchanged odds (7 randomly selected generation teams, and 3 draft winners drawn from the 8 non-playoff teams by default). A future right is not an immediate guaranteed pick.
- The **current owner** receives the generated player or gets to choose a prospect **only when the original team eventually wins** the relevant selection. If that takes three, ten or more seasons, the right continues to wait.
- After the right is used **once**, the originating team's next opportunity belongs to the original team again. Draft and generation rights are independent: using one does not use the other.
- Rights can be transferred again before being used. Transferring an existing right changes its **current owner**, not the number of rights owed. A team can hold multiple rights originating from different teams and can receive its own opportunity in the same offseason.
- The receiving team applies normal three-player roster limits and generation comparison rules. The original team does not receive a second player or get an extra lottery entry.
- Trades and redemptions appear in Commissioner Mode's transaction history and persist in existing saves and exported JSON. Players may be moved separately in Commissioner Mode to complete player-for-right exchanges. Trading is permitted only when no season, draft or generation stage is in progress.
- Old leagues without future-right records default to everyone owning their own next opportunity. No save migration or game-balance changes are required.

## V1.9.5 maintenance

- **Safer backups:** imported files are validated (including unique record keys) before touching saved data. A full league restore now uses a single, batched IndexedDB transaction. Any failed write rolls back all changes rather than clearing or partially overwriting the original league. Your existing browser-local preferences are preserved.
- **Faster team history browsing:** opening Team Records no longer immediately loads every saved goal and assist from the franchise's entire history. Head-to-head results are streamed from an IndexedDB cursor without retaining all game records; full game logs, season stats, and all-time franchise leaders are loaded only when one of their sections is opened.
- **Cleaner code:** the previously growing `js/views.js` was divided into shared views, `js/team-views.js`, and `js/player-views.js`; gameplay/scoring logic, data formats and existing league histories remain unchanged.
- **Regression checks:** new tests cover storage rollback under a simulated partial import failure and streaming head-to-head accuracy; existing simulation tests still run.
- **Live records:** individual-season player history now includes the current, partially played regular season.
- Existing league saves and V1.4 JSON backups remain supported. We have not added cloud backups, and a browser's local data can still be deleted by clearing site storage—keep periodic exported JSON copies for important leagues.

## Core game rules

- Teams have at most **three named players**, rated +1 through +8 at generation, plus an **unidentified roster**.
- Players have permanent hidden motivation ranges and roll a new seasonal motivation value (−2 through +2); their **effective rating is 0–10**.
- At the default setting, all players have a 50/50 goal/playmaking tendency. You can introduce permanent individual differences with **Tendency Spread**; these are *relative tendencies*, not guaranteed point ratios.
- Games start **0–0**. Each named player rolls for independent goals and for successful playmaking opportunities. Unidentified players also roll for independent goals based on available ice time. Separately, they can set up additional goals for named players using the adjustable **Unidentified playmaking chances/team/game** setting (default **0.50**). Unconverted depth setups add no goal, and depth independent scoring is not reduced by this feature.
- Each successful playmaking opportunity creates **one additional goal** scored by another named player or an unidentified player, and awards the creator a primary assist. A possible secondary assist does **not** create another goal.
- Existing goals and the overtime winner can also have 0–2 assists. Nobody can assist on their own goal.
- **Actual goals decide regulation results**, including playoffs. There is no separate 0–12 winner roll, regular-season bonus cap, or playoff seeding bonus.
- If regulation ends tied, **an even 50/50 coin flip decides the winner** independent of team strength, followed by exactly one scored overtime goal with eligible assists. The losing regular-season team earns one standings point.
- Players' ratings improve scoring *odds*, but goals are not guaranteed and 4-, 5-, 6-goal games remain possible.
- A base +8 player with a temporary effective rating of +9 displays **silver +8**; effective +10 displays **gold +8**. Their base +8 rating never changes.

## Franchise all-time scoring leaders

- Expand **All-Time Team Scoring Leaders** in Team Records to browse every named player who has represented that franchise, including retired, cut and traded players. The full ranking is scrollable, not limited to the top 100.
- Switch the dropdown between **Regular + Playoffs** (combined), **Regular Season**, and **Playoffs**. Rankings sort by franchise points then goals, and display seasons represented, GP, goals, assists, points and P/GP; click players to see their complete career profiles.
- Each player's scoring is attributed only to games played with the **selected team**. Points from a later trade to another club never increase the original franchise's record. Data is calculated from saved season-opening lineups and per-game goal/assist events, and includes the currently active season.
- Older games missing complete scoring plays show unknown totals as **—** and are listed beneath fully verifiable franchise scoring records.
- This is a read-only historical view; it does not change saved league data or player career totals. Historical league saves remain compatible.

## Team season player statistics

- Every **Team Records** page now includes a collapsible **Player Stats — By Season** section alongside Game Results. Pick a season from either section's dropdown; both views stay synchronized.
- See the actual **named players who appeared on that team's roster for the selected season**, including players who later retired, were cut, or were traded in a subsequent offseason. The current roster is never substituted for an older season's lineup.
- Separate regular-season and playoff scoring tables display **GP, G, A, PTS and P/GP**, along with each player's permanent base rating. Click a player to open their career page.
- Stats update after each simulated batch and remain available for archived seasons, using saved individual scoring events rather than career cumulative totals. Missing scoring detail in older game archives is marked as unavailable, not incorrectly counted as zero.
- Existing league saves and simulation histories require no migration.

## Team season game-by-game results

- On **Team Records**, choose any of the 16 teams and expand **Game Results — By Season**. Select the active season or any archived season from the dropdown.
- See every game that team played that season, in order, including regular-season and playoff games, with opponent, final score (your team first), W/L/OTL, and overtime designation.
- Expand **Goals / Assists** for individual scoring events where the saved game record contains them. Older archives without event-level scoring still show their recorded final scores.
- The log updates as the regular season progresses and is read from saved game results; no game is simulated again. Scores are available after full-season simulations as well as 1/10-games-per-team simulations.

## Commissioner Mode (manual transactions)

- Open **Commissioner Mode** in the sidebar to see all 16 teams, current named-player rosters, and combined base + totals.
- **Move player:** send one active player to another team with an open roster slot. A full destination roster is rejected instead of silently releasing someone.
- **Trade players:** swap one active player from each of two different teams, including when both rosters are full. Each team still has at most three named players.
- **Release / Cut player:** manually remove an active player and mark their permanent record **Cut**. A confirmation appears before committing a cut.
- These actions are **offseason only**, outside active regular seasons, playoffs, draft lotteries and generation screens. This preserves saved game scores, current-year roster snapshots and lottery/generation results.
- All successful transactions are saved to the existing league's local database and backup JSON, with a league-wide transaction log and an individual player **Team & Transaction History** section. Historic scoring, player IDs, draft origins and former teams remain intact; a traded player plays for their new team in the following season.
- This feature is commissioner-controlled only: there is no AI trading or trading of future player-generation rights yet.

## Regular-season pace and scoring leaderboards

- A regular season has a saved game schedule. From Dashboard, Standings or Season Scoring, choose **Sim 1 Game**, **Sim 10 Games**, or **Finish Regular Season**. Each click plays **one or ten games for every team** (8 or 80 league games for a 16-team league), updates win/loss/OTL/points and goal differential, and saves the results immediately. Every click finishes complete scheduled rounds so teams remain even in games played; earlier V1.8 partial-round saves finish the incomplete round first.
- Standings show all 16 teams in current order, live games played, and up/down arrows indicating movement since the previous simulated batch. Recent games are also listed. The top eight are provisional until the final regular-season game; the playoffs then start with the final seeds.
- **Season Scoring** has a **Regular Season / Playoffs** dropdown and a season dropdown. It shows named-player GP, goals, assists, points and P/GP from actual saved game scoring events, including players with no points. Totals are for the selected season and competition only, never lifetime totals.
- Stats remain viewable after the regular season finishes, through the playoffs, and for archived historical seasons. Player profiles also include the live regular season.
- Bulk 1/10/100/1,000-season simulations remain available, including resuming and finishing a partly played regular season. Existing saved leagues, individual player records and the draft/generation logic remain compatible.

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

The **Settings** page allows tuning depth-player playmaking opportunities for named scorers (using the Finishing Talent Curve), goal and playmaking rates around a +9 effective-rating benchmark, talent curves, Poisson scoring volatility, unidentified roster scoring/ice-time share, assist distribution, individual tendency variation, and +1 to +8 generation/draft probabilities, plus yearly league-wide random generation count. **Set as Default** saves preferences for future universes in the same browser.

The **Testing Information** tab tracks measured team and player scoring, combined team base and effective rating, average players/team, goals/game, production by effective rating, unidentified scoring by roster size, spawn/draft frequency, and unusual single-game and season performances. Cumulative snapshots appear after **100 and 1,000** completed test seasons. Testing counters can be reset without clearing the league history.

An ordinary new league uses the V1.4 database (`IceNumbersV14`), separate from previous V1.3 saves. Old saves are not automatically migrated. Export/import handles V1.4 backups.

## Project structure

- `index.html` and `styles.css` — existing dashboard, navigation and styles
- `js/core.js` — default teams and rules, random source and league state
- `js/storage.js` — local browser IndexedDB persistence
- `js/scoring.js` — player ratings, motivation, independent goals, assists, overtime and diagnostics
- `js/draft.js` — equal-odds lottery, scouting and hidden ratings, three draft picks, animated UI, and automatic picks
- `js/generation.js` — post-draft ranking, random eligible team selection, highlighted cards, player reveals, automatic bulk-mode generation
- `js/season-scoring.js` — live/historical regular-season and playoff player scoring leaderboards
- `js/commissioner.js` — offseason player moves, swaps, cuts and combined transaction history
- `js/future-rights.js` — persistent one-time generation/draft rights, reassignment, redemption and Commissioner Mode controls
- `js/simulation.js` — resumable regular-season schedule, live standings, regulation, best-of-seven playoffs and franchise/player records
- `js/preseason.js` — manual pregame preview with team rosters, championship trophies, streaks and start-season controls
- `js/season-actions.js` — resumable season saves and playoff controls
- `js/views.js` — shared dashboard, standings, playoffs and season history views
- `js/team-views.js` — team rosters, franchise history, game logs, and season/all-time scoring
- `js/player-views.js` — player history, searching, sorting and individual seasons
- `js/v13.js` — player career details and scoring-era UI
- `js/testing-view.js` — long-term testing statistics
- `js/customization.js` — names and team logos
- `js/app.js` — settings, saved defaults, backups, navigation and startup
- `tests/smoke.test.mjs` — simulation/regression checks
- `tests/storage-maintenance.test.mjs` — atomic backup-restore and head-to-head cursor checks

## Local verification

Run `node tests/smoke.test.mjs` and `node tests/storage-maintenance.test.mjs` for validation; run `ICE_NUMBERS_STRESS=1 node tests/smoke.test.mjs` for a real 1,000-season benchmark. Then run `for file in js/*.js; do node --check "$file"; done`.

The app is static HTML and JavaScript, with no build step. GitHub Actions checks JavaScript syntax and simulation tests on pull requests and changes to `main`.
