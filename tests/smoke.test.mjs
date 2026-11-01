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


const playerFixture = [
  {id:1, name:'Alex Alpha',teamId:0,regGoals:6,regAssists:2,playoffGoals:1,playoffAssists:1,regGames:10,titles:2,retireSeason:null},
  {id:2, name:'Ben Bravo',teamId:1,regGoals:3,regAssists:6,playoffGoals:1,playoffAssists:4,regGames:20,titles:0,retireSeason:9},
  {id:3, name:'Chris Charlie',teamId:2,regGoals:1,regAssists:1,playoffGoals:0,playoffAssists:0,regGames:5,titles:1,retireSeason:null}
];
sandbox.playerFixture = playerFixture;

const sortPlayers = (key, descending) => evaluate(
  '(function(){playerSort='+JSON.stringify(key)+';playerSortDescending='+descending+';return playerFixture.slice().sort(playerHistoryCompare).map(p=>p.id).join(",")})()'
);
assert.equal(sortPlayers('regGoals',true), '1,2,3');
assert.equal(sortPlayers('regGoals',false), '3,2,1');
assert.equal(sortPlayers('regPoints',true), '2,1,3');
assert.equal(sortPlayers('careerPoints',true), '2,1,3');
assert.equal(sortPlayers('pointsPerGame',true), '1,2,3');
assert.equal(sortPlayers('name',false), '1,2,3');
assert.equal(sortPlayers('titles',true), '1,3,2');
assert.equal(sortPlayers('status',false), '1,3,2');
assert.equal(evaluate('PLAYER_SORT_COLUMNS.length'),17);
assert.match(evaluate("playerHeading('regGoals','G')"), /data-player-sort="regGoals"/);

evaluate("render=()=>{};playerSort='regGoals';playerSortDescending=true;handleClick({target:{closest:(selector)=>selector==='th[data-player-sort]'?{dataset:{playerSort:'regGoals'}}:null}})");
assert.equal(evaluate('playerSortDescending'), false);
evaluate("handleClick({target:{closest:(selector)=>selector==='th[data-player-sort]'?{dataset:{playerSort:'regAssists'}}:null}})");
assert.equal(evaluate('playerSort'), 'regAssists');
assert.equal(evaluate('playerSortDescending'), true);
console.log('PASS: all Player History sort fields, both directions, and heading click handlers');


// Regression: Player History headers must be a single row of real <th> cells.
// The previous bug wrapped already-rendered <th> markup in additional <th> cells.
const playerHeaders = evaluate("table(PLAYER_SORT_COLUMNS.map(([k,l])=>playerHeading(k,l)), ['<tr>'+PLAYER_SORT_COLUMNS.map(()=>'<td>1</td>').join('')+'</tr>'],true)");
assert.equal((playerHeaders.match(/<th\b/g)||[]).length, 17);
assert.equal((playerHeaders.match(/<\/th>/g)||[]).length, 17);
assert.equal((playerHeaders.match(/<td\b/g)||[]).length, 17);
assert.doesNotMatch(playerHeaders, /<th[^>]*>\s*<th\b/i);
assert.match(playerHeaders, /<th[^>]*data-player-sort="regGoals"/);
const ordinaryTable = evaluate("table(['Team','GP'],['<tr><td>A</td><td>2</td></tr>'])");
assert.equal((ordinaryTable.match(/<th\b/g)||[]).length,2);
assert.match(ordinaryTable, /<th>Team<\/th><th>GP<\/th>/);
console.log('PASS: Player History headings align with exactly 17 data columns');
