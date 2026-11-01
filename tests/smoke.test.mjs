import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Classic scripts share one global lexical scope in the browser.
// Load them in the same order, but don't start the IndexedDB-backed UI in Node.
const files = [
  'js/core.js',
  'js/storage.js',
  'js/scoring.js',
  'js/simulation.js',
  'js/season-actions.js',
  'js/views.js',
  'js/customization.js',
  'js/app.js'
];
const sandbox = vm.createContext({console});
for (const file of files) {
  let source = readFileSync(file, 'utf8');
  if (file === 'js/app.js') {
    assert.match(source, /\nboot\(\);\s*$/);
    source = source.replace(/\nboot\(\);\s*$/, '\n');
  }
  new vm.Script(source, {filename: file}).runInContext(sandbox);
}

const evaluate = code => vm.runInContext(code, sandbox);
const teamNames = evaluate('TEAM_NAMES.slice()');
assert.equal(teamNames.length, 16);
assert.equal(teamNames[0], 'Estevan Bruins');
assert.equal(teamNames[15], 'Prince Albert Eagles');

for (const gamesPerTeam of [30, 45, 60]) {
  const results = evaluate(`state=initialState();state.settings.gamesPerTeam=${gamesPerTeam};var reports=[];for(let n=0;n<12;n++){const sim=simulateSeason();reports.push({season:state.season,records:sim.result.standings.map(x=>({played:x.played,w:x.w,l:x.l,otl:x.otl,points:x.points})),games:sim.games.map(x=>({stage:x.stage,aId:x.aId,bId:x.bId,winnerId:x.winnerId,rollA:x.rollA,rollB:x.rollB,coin:x.coin,scoreA:x.scoreA,scoreB:x.scoreB,bonusA:x.bonusA,bonusB:x.bonusB,goalCount:(x.goalEvents||[]).length})),champion:sim.result.championId});}reports`);
  assert.equal(results.length, 12);
  for (const report of results) {
    assert.equal(report.records.length, 16);
    assert.equal(report.games.filter(g=>g.stage==='regular').length, gamesPerTeam*8);
    assert.ok(report.games.filter(g=>g.stage==='playoff').length>=12);
    assert.ok(report.champion>=0 && report.champion<16);
    for (const row of report.records) {
      assert.equal(row.played, gamesPerTeam);
      assert.equal(row.w+row.l+row.otl, gamesPerTeam);
      assert.equal(row.points, 2*row.w+row.otl);
    }
    for (const game of report.games) {
      assert.ok(game.scoreA>=0 && game.scoreB>=0);
      assert.notEqual(game.scoreA, game.scoreB);
      assert.equal(game.goalCount, game.scoreA+game.scoreB);
      assert.equal(game.winnerId, game.scoreA>game.scoreB?game.aId:game.bId);
      if (game.rollA===game.rollB || game.rollA+game.bonusA===game.rollB+game.bonusB) {
        assert.equal(game.coin, true);
      }
    }
  }
  console.log(`PASS: 12 seasons at ${gamesPerTeam} games/team`);
}

const dashboard = evaluate('state=initialState();runButtons()');
assert.match(dashboard, /run-league-layout/);
assert.match(dashboard, /run-league-bulk/);
assert.match(dashboard, /Simulate Regular Season/);
assert.match(dashboard, /Simulate 1,000 Full Seasons/);

const saved = evaluate('state=initialState();beginSeason();JSON.stringify({active:!!state.activeSeason,teams:state.activeSeason.standings.length})');
assert.deepEqual(JSON.parse(saved), {active:true,teams:16});
console.log('PASS: default teams, dashboards, player scoring, playoffs and resumable seasons');
