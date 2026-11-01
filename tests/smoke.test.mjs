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
  'js/v13.js',
  'js/customization.js',
  'js/scoring-preview.js',
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

// NHL-style assist defaults apply to newly created leagues.
assert.equal(evaluate('DEFAULTS.unassistedPct'),6);
assert.equal(evaluate('DEFAULTS.oneAssistPct'),19);
assert.equal(evaluate('initialState().settings.unassistedPct'),6);
assert.equal(evaluate('initialState().settings.oneAssistPct'),19);
assert.deepEqual(JSON.parse(evaluate('JSON.stringify(assistDistribution(6,19))')),{valid:true,two:75});


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

// Hidden Motivation: randomized per-player permanent ranges, annual rolls,
// save/resume safety, stats-archive secrecy, and both goal/assist weighting.
assert.equal(evaluate('MOTIVATION_RANGES.reduce((s,r)=>s+r[2],0)'),100);
assert.ok(evaluate('MOTIVATION_RANGES.every(([min,max])=>min>=-2&&max<=2&&min<=max)'));
const motCreated=JSON.parse(evaluate("(function(){state=initialState();beginSeason();return JSON.stringify(state.teams.flatMap(t=>t.roster).map(p=>({id:p.id,min:p.motivationMin,max:p.motivationMax,m:p.motivation,year:p.motivationSeason})))})()"));
assert.equal(motCreated.length,16);
assert.ok(motCreated.every(p=>p.min>=-2&&p.max<=2&&p.m>=p.min&&p.m<=p.max&&p.year===1));
const motNewSeason=JSON.parse(evaluate("(function(){state=initialState();var sim=simulateSeason();const old=state.teams.flatMap(t=>t.roster).map(p=>({id:p.id,min:p.motivationMin,max:p.motivationMax,season:p.motivationSeason}));beginSeason();return JSON.stringify({old,now:state.teams.flatMap(t=>t.roster).map(p=>({id:p.id,min:p.motivationMin,max:p.motivationMax,m:p.motivation,season:p.motivationSeason})),publicRosters:state.activeSeason.rosters,publicHistory:sim.result.rosters})})()"));
assert.ok(motNewSeason.old.length>0);
assert.ok(motNewSeason.old.every(p=>p.season===1));
for(const old of motNewSeason.old){
 const next=motNewSeason.now.find(p=>p.id===old.id);
 if(!next)continue; // The special draft can replace a player at full roster.
 assert.equal(next.min,old.min);
 assert.equal(next.max,old.max);
 assert.ok(next.m>=next.min&&next.m<=next.max);
 assert.equal(next.season,2);
}
assert.ok(Object.values(motNewSeason.publicRosters).flat().every(p=>!('motivation' in p)&&!('motivationMin' in p)&&!('motivationMax' in p)));
assert.ok(Object.values(motNewSeason.publicHistory).flat().every(p=>!('motivation' in p)&&!('motivationMin' in p)&&!('motivationMax' in p)));
const motWeights=JSON.parse(evaluate("(function(){state=initialState();return JSON.stringify([-2,0,2].map(m=>({goal:scoringWeight({bonus:8,motivation:m}),assist:scoringWeight({bonus:8,motivation:m},true)})))})()"));
assert.ok(motWeights[0].goal<motWeights[1].goal&&motWeights[1].goal<motWeights[2].goal);
assert.ok(motWeights[0].assist<motWeights[1].assist&&motWeights[1].assist<motWeights[2].assist);
assert.equal(evaluate('scoringWeight({bonus:1,motivation:-2})'),1);
assert.equal(evaluate('scoringWeight({bonus:8,motivation:0})'),evaluate('scoringWeight({bonus:8})'));
assert.equal(evaluate("bonusOf({roster:[{bonus:8,motivation:-2},{bonus:7,motivation:2}]})"),8);

// Legacy players get Motivation only at the NEXT season start, not during
// a saved season already in its playoffs.
const legacyPlayers=JSON.parse(evaluate("(function(){state=initialState();var p=makeNewPlayer(0,'spawn',1);for(const k of ['motivation','motivationMin','motivationMax','motivationSeason'])delete p[k];state.teams[0].roster=[p];beginSeason();return JSON.stringify(state.teams[0].roster.find(x=>x.id===p.id))})()"));
assert.ok(legacyPlayers.motivationMin>=-2&&legacyPlayers.motivationMax<=2);
assert.ok(legacyPlayers.motivation>=legacyPlayers.motivationMin&&legacyPlayers.motivation<=legacyPlayers.motivationMax);
assert.equal(legacyPlayers.motivationSeason,1);
const legacyActive=JSON.parse(evaluate("(function(){state=initialState();beginSeason();for(const p of state.teams.flatMap(t=>t.roster))for(const k of ['motivation','motivationMin','motivationMax','motivationSeason'])delete p[k];const before=state.totalGames;playNextGames();return JSON.stringify({before,after:state.totalGames,p:state.teams[0].roster[0]})})()"));
assert.ok(legacyActive.after>legacyActive.before);
assert.equal(legacyActive.p.motivation,undefined);
assert.equal(evaluate('scoringWeight({bonus:8,motivation:0})'),evaluate('scoringWeight({bonus:8})'));

const sameYear=JSON.parse(evaluate("(function(){state=initialState();var p=makeNewPlayer(0,'spawn',1);rollPlayerMotivation(p,1);const saved={rng:state.rngState,m:p.motivation,min:p.motivationMin,max:p.motivationMax};return JSON.stringify({rerolled:rollPlayerMotivation(p,1),rngUnchanged:state.rngState===saved.rng,stillSame:saved.m===p.motivation,rangeSame:saved.min===p.motivationMin&&saved.max===p.motivationMax})})()"));
assert.deepEqual(sameYear,{rerolled:false,rngUnchanged:true,stillSame:true,rangeSame:true});
console.log('PASS: Hidden Motivation -2..+2 ranges, annual persistent rolls, legacy saves, secret stats, goal/assist scaling');

// Offensive Depth: uncapped roster is used only for extra scoring
// opportunities; maxBonus still determines game outcomes.
assert.equal(evaluate('DEFAULTS.offensiveDepthStrength'),1);
assert.equal(evaluate('DEFAULTS.maxGoalsPerTeam'),9);
const depthSamples=JSON.parse(evaluate("(function(){state=initialState();const f=(r,roll)=>offensiveDepthExpectation({roster:r.map(bonus=>({bonus}))},roll);return JSON.stringify({weak:f([8,1,1],12),deep:f([8,8,8],12),deepHalf:f([8,8,8],6),deepZero:f([8,8,8],0),off:offensiveDepthExpectation({roster:[{bonus:8},{bonus:8},{bonus:8}]},12,{...state.settings,offensiveDepthStrength:0})})})()"));
assert.deepEqual(depthSamples,{weak:.125,deep:1,deepHalf:.5,deepZero:0,off:0});
assert.equal(evaluate("offensiveDepthExpectation({roster:[{bonus:5}]},12)"),0);
assert.equal(evaluate("offensiveDepthExpectation({roster:[{bonus:8},{bonus:8},{bonus:8}]},12,{...state.settings,offensiveDepthStrength:2})"),2);
const depthGameSample=JSON.parse(evaluate("(function(){\n state=initialState();state.settings.maxGoalsPerTeam=9;state.settings.offensiveDepthStrength=1;\n const create=(bonuses)=>({id:0,roster:bonuses.map((bonus,i)=>({id:100+i,bonus,motivation:0}))});\n const opponent={id:1,roster:[]};\n const run=(bonuses)=>{\n  const team=create(bonuses);let teamGF=0,oppGF=0,max=0,plays=0,otValid=true;\n  for(let i=0;i<2500;i++){\n   const g={rollA:10,rollB:5,totalA:18,totalB:13,coin:false,winnerId:0,stage:'regular'};\n   generateScore(team,opponent,g);\n   if(g.scoreA<=g.scoreB||g.scoreA>9||g.scoreB>9||g.goalEvents.length!==g.scoreA+g.scoreB)throw Error('Invalid depth score or game log');\n   teamGF+=g.scoreA;oppGF+=g.scoreB;max=Math.max(max,g.scoreA);plays+=g.goalEvents.length;\n  }\n  return {gf:teamGF/2500,ga:oppGF/2500,max,plays};\n };\n const low=run([8,1,1]),high=run([8,8,8]);\n const a=create([8,8,8]);let tied={rollA:12,rollB:12,totalA:20,totalB:20,coin:true,winnerId:1,stage:'regular'};\n generateScore(a,opponent,tied);const otValid=tied.scoreB-tied.scoreA===1;\n state.settings.maxGoalsPerTeam=15;\n let elevated={rollA:12,rollB:12,totalA:45,totalB:12,coin:false,winnerId:0,stage:'regular'};\n generateScore(a,opponent,elevated);\n return JSON.stringify({low,high,otValid,elevated:{a:elevated.scoreA,b:elevated.scoreB}});\n})()"));

assert.ok(depthGameSample.high.gf>depthGameSample.low.gf+.2,JSON.stringify(depthGameSample));
assert.equal(depthGameSample.otValid,true);
assert.ok(depthGameSample.elevated.a>=1&&depthGameSample.elevated.a<=15);
assert.ok(depthGameSample.elevated.a>depthGameSample.elevated.b);
assert.equal(depthGameSample.high.max<=9,true);
console.log('PASS: Offensive Depth boost scales with raw roster and roll, retains winners, goal logs, OT margin and ceiling');



// A rare scoring surge can create nine-goal games even between evenly
// rated teams, without ever changing the victor or OT's one-goal margin.
const surgeTest=JSON.parse(evaluate("(function(){const original=random;try{let seq=[.999,.999,.01,.999];random=()=>seq.length?seq.shift():.5;state=initialState();let a={id:0,roster:[]},b={id:1,roster:[]};let g={rollA:12,rollB:1,totalA:20,totalB:9,coin:false,winnerId:0,stage:'regular'};generateScore(a,b,g);return JSON.stringify({a:g.scoreA,b:g.scoreB,plays:g.goalEvents.length})}finally{random=original}})()"));
assert.deepEqual(surgeTest,{a:9,b:3,plays:12});
const overtimeScore=JSON.parse(evaluate("(function(){const original=random;try{random=()=>.999;let a={id:0,roster:[]},b={id:1,roster:[]};let g={rollA:12,rollB:12,totalA:20,totalB:20,coin:true,winnerId:1,stage:'playoff'};generateScore(a,b,g);return JSON.stringify({a:g.scoreA,b:g.scoreB,plays:g.goalEvents.length})}finally{random=original}})()"));
assert.equal(overtimeScore.b-overtimeScore.a,1);
assert.equal(overtimeScore.plays,overtimeScore.a+overtimeScore.b);
const upperCap=JSON.parse(evaluate("(function(){const original=random;try{random=()=>.999;let a={id:0,roster:[]},b={id:1,roster:[]};let g={rollA:50,rollB:0,totalA:80,totalB:0,coin:false,winnerId:0,stage:'regular'};generateScore(a,b,g);return JSON.stringify({a:g.scoreA,b:g.scoreB})}finally{random=original}})()"));
assert.equal(upperCap.a,9);
assert.ok(upperCap.a>upperCap.b);
console.log('PASS: rare nine-goal surges, hard nine-goal cap, preserved winners and OT margins');



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


// Regression: Team Records history can collapse and scroll while retaining every season.
const domNodes={};
sandbox.document={getElementById(id){return domNodes[id]??=( {innerHTML:'',textContent:''} );}};
sandbox.teamHistoryFixture=Array.from({length:23},(_,i)=>({
  season:i+1,
  standings:[{id:0,seed:1,w:10,l:12,otl:8,points:28,bonus:2}],
  championId:0
}));
evaluate("state=initialState();view='teams';selectedTeam=0;getAll=async()=>teamHistoryFixture;getIndexAll=async()=>[]");
evaluate("teamDetail()");
assert.match(domNodes.app.innerHTML, /<details class="team-history-section" open>/);
assert.match(domNodes.app.innerHTML, /<summary>Season-by-season franchise history<\/summary>/);
await evaluate("loadTeamRecords(0)");
const archiveMarkup=domNodes['team-seasons'].innerHTML;
assert.match(archiveMarkup, /class="team-season-scroll"/);
assert.match(archiveMarkup, /23 archived seasons/);
assert.match(archiveMarkup, /scroll to see earlier seasons/);
assert.equal((archiveMarkup.match(/<tr>/g)||[]).length,24);
assert.ok(archiveMarkup.indexOf('data-year="23"')<archiveMarkup.indexOf('data-year="1"'));
assert.match(archiveMarkup, /data-year="1"/);
console.log('PASS: 23 franchise seasons retained in collapsible scrollable section');

// All-time team strength adds every completed season's capped roster bonus.
evaluate("state=initialState()");
const historicalBonuses=JSON.parse(evaluate("JSON.stringify(teamBonusTotals([{season:1,standings:[{id:0,bonus:8},{id:1,bonus:1}]},{season:2,standings:[{id:0,bonus:8},{id:1,bonus:1}]}],null))"));
assert.equal(historicalBonuses[0],16);
assert.equal(historicalBonuses[1],2);
assert.equal(historicalBonuses.length,16);
const includesCurrent=JSON.parse(evaluate("JSON.stringify(teamBonusTotals([{season:1,standings:[{id:0,bonus:8}]}],{season:2,standings:[{id:0,bonus:5}]}))"));
assert.equal(includesCurrent[0],13);
const noDoubleCount=JSON.parse(evaluate("JSON.stringify(teamBonusTotals([{season:1,standings:[{id:0,bonus:8}]}],{season:1,standings:[{id:0,bonus:8}]}))"));
assert.equal(noDoubleCount[0],8);
sandbox.bonusFixture=[
 {season:1,standings:[{id:0,bonus:8},{id:1,bonus:1}]},
 {season:2,standings:[{id:0,bonus:8},{id:1,bonus:1}]}
];
evaluate("state=initialState();state.season=2;view='alltime';sortBy='teamBonusTotal';sortDescending=true;getAll=async store=>bonusFixture");
await evaluate("alltime()");
const alltimeBonusHtml=domNodes.app.innerHTML;
assert.match(alltimeBonusHtml,/data-sort="teamBonusTotal"[^>]*>Total Team \+ ▼<\/th><\/tr>/);
assert.match(alltimeBonusHtml,/capped regular-season roster bonus/);
assert.ok(alltimeBonusHtml.indexOf('data-team="0"')<alltimeBonusHtml.indexOf('data-team="1"'));
assert.match(alltimeBonusHtml,/<td>\+16<\/td><\/tr>/);
assert.match(alltimeBonusHtml,/<td>\+2<\/td><\/tr>/);
console.log('PASS: cumulative team bonuses display last, sort correctly, include active season and avoid double counting');



// V1.3 regression suite: championship stage, archive, player careers, pagination, odds.
evaluate("state=initialState();var v13sim=simulateSeason();view='playoffs'");
assert.equal(evaluate('state.seasonComplete'),true);
assert.equal(evaluate('state.activeSeason'),null);
assert.match(evaluate('runButtons()'),/View Championship Celebration/);
assert.match(evaluate('championshipScore(v13sim.result)'),/^4–[0-3]$/);

evaluate("getAll=async store=>store==='seasons'?[v13sim.result]:[]");
await evaluate("championshipView()");
assert.match(domNodes.app.innerHTML,/CHAMPIONS/);
assert.match(domNodes.app.innerHTML,/Continue to Offseason/);
assert.match(domNodes.app.innerHTML,/View Championship Series/);
assert.match(domNodes.app.innerHTML,/Past Champions &amp; Runners-Up/);
assert.match(domNodes.app.innerHTML,/data-year="1"/);

evaluate("view='history';get=async(store,id)=>v13sim.result");
await evaluate("history()");
assert.match(domNodes.app.innerHTML,/All Championships &amp; Runners-Up/);
assert.match(domNodes.app.innerHTML,/championship-history-scroll/);

const samplePlayer = evaluate('v13sim.players.find(p=>p.history?.length)');
assert.ok(samplePlayer);
const yearly = evaluate("playerYearStats(v13sim.players.find(p=>p.id==="+samplePlayer.id+"),v13sim.players.find(p=>p.id==="+samplePlayer.id+").history[0],v13sim.games)");
assert.equal(yearly.regular.g,samplePlayer.regGoals);
assert.equal(yearly.regular.a,samplePlayer.regAssists);
assert.equal(yearly.regular.gp,samplePlayer.regGames);
assert.equal(yearly.playoff.g,samplePlayer.playoffGoals);
assert.equal(yearly.playoff.a,samplePlayer.playoffAssists);
assert.equal(yearly.playoff.gp,samplePlayer.playoffGames);
evaluate("view='playerDetail';selectedPlayer="+samplePlayer.id+";get=async(store,id)=>v13sim.players.find(p=>p.id===id);getIndexAll=async(store,index,key)=>v13sim.games.filter(g=>g.season===key)");
await evaluate("playerProfile()");
assert.match(domNodes.app.innerHTML,/Season-by-Season Career/);
assert.match(domNodes.app.innerHTML,/Back to Player History/);
assert.match(domNodes.app.innerHTML,/<th>PO PTS<\/th>/);
assert.match(domNodes.app.innerHTML,/data-year="1"/);

// Old player records have the same basic history structure; no migration is required.
assert.ok(!('regGoals' in samplePlayer.history[0]));
assert.equal((domNodes.app.innerHTML.match(/<th>/g)||[]).length,12);

assert.equal(evaluate('oddsTotal([35,25,15,10,7,4,3,1])'),100);
assert.match(evaluate("oddsStatusHtml('normalWeights',[35,25,15,10,7,4,3,1])"),/odds-valid/);
assert.match(evaluate("oddsStatusHtml('normalWeights',[35,25,15,10,7,4,3,2])"),/odds-invalid/);
evaluate("view='settings';state=initialState();settings()");
assert.match(domNodes.app.innerHTML,/data-odds-total="normalWeights"/);
assert.match(domNodes.app.innerHTML,/data-odds-total="draftWeights"/);

// All active players are included beyond top 1,000. Search reaches all retirees.
sandbox.manyPlayers=Array.from({length:1005},(_,i)=>({id:i+1,name:i===1004?'Unique Legend':'Player '+(i+1),teamId:0,bonus:1,origin:'spawn',startingYear:1,seasons:1,retireSeason:i===1003?null:4}));
evaluate("getAll=async()=>manyPlayers;state=initialState();view='players';playerSort='bonus';playerPage=0;playerQuery=''");
await evaluate("players()");
assert.match(domNodes.app.innerHTML,/of 1,001/);
evaluate("playerPage=10");
await evaluate("players()");
assert.match(domNodes.app.innerHTML,/data-player="1004"/);
evaluate("playerQuery='Unique Legend';playerPage=0");
await evaluate("players()");
assert.match(domNodes.app.innerHTML,/data-player="1005"/);

// Starting a new regular season clears the ceremony without altering league history.
evaluate("state=initialState();simulateSeason();beginSeason()");
assert.equal(evaluate('state.seasonComplete'),false);
console.log('PASS: V1.3 celebration, archives, old player stats, pagination and odds');


// V1.3 clickable names also work in archived team rosters and goal/assist logs.
const linkedRosters=evaluate("seasonRosterPanel(v13sim.result)");
assert.match(linkedRosters,/Featured player rosters/);
assert.match(linkedRosters,/data-player="/);
const linkedPlay=evaluate("scoringPlayerLinks({scorerId:42,scorerName:'Test Scorer',assistIds:[77],assistNames:['Test Helper'],anonymousAssists:0,assistsCount:1})");
assert.match(linkedPlay,/data-player="42"/);
assert.match(linkedPlay,/data-player="77"/);
const unnamedPlay=evaluate("scoringPlayerLinks({scorerId:null,scorerName:'Unnamed skater',assistIds:[],assistNames:[],anonymousAssists:0,assistsCount:0})");
assert.doesNotMatch(unnamedPlay,/data-player/);
console.log('PASS: historical roster and scoring-play player links');


// V1.3 settings polish: live two-assist balance and save buttons for the entire page.
assert.deepEqual(JSON.parse(evaluate("JSON.stringify(assistDistribution(20,45))")),{valid:true,two:35});
assert.deepEqual(JSON.parse(evaluate("JSON.stringify(assistDistribution(6,19))")),{valid:true,two:75});
assert.deepEqual(JSON.parse(evaluate("JSON.stringify(assistDistribution(0,0))")),{valid:true,two:100});
for(const [a,b] of [[70,40],[100,1],[-1,10],['',45],[15.5,20]]) {
 assert.equal(evaluate('assistDistribution('+JSON.stringify(a)+','+JSON.stringify(b)+').valid'),false);
}
assert.match(evaluate("assistStatusHtml(6,19)"),/Two-assist goals: 75%.*Valid/);
assert.match(evaluate("assistStatusHtml(6,19)"),/odds-valid/);
assert.match(evaluate("assistStatusHtml(70,40)"),/odds-invalid/);

evaluate("view='settings';state=initialState();settings()");
const settingsHtml=domNodes.app.innerHTML;
assert.match(settingsHtml,/id="cfg-offensiveDepthStrength"[^>]*step="0.25"[^>]*value="1"/);
assert.match(settingsHtml,/id="cfg-maxGoalsPerTeam"[^>]*value="9"/);
assert.match(settingsHtml,/id="depth-preview"/);
assert.match(domNodes['depth-preview'].textContent,/\+8 \/ \+8 \/ \+8 adding ~1\.00/);
assert.match(settingsHtml,/Live scoring calculator/);
assert.match(settingsHtml,/id="strength-goalExponent"/);
assert.match(settingsHtml,/id="strength-assistExponent"/);
assert.match(settingsHtml,/data-scoring-preset="balanced"/);
assert.match(settingsHtml,/data-scoring-preset="moderate"/);
assert.match(settingsHtml,/data-scoring-preset="stars"/);
assert.match(settingsHtml,/id="preview-rating-2"/);
assert.match(settingsHtml,/id="preview-team-goals"/);

const previewOdds=JSON.parse(evaluate("JSON.stringify(scoringPreviewOdds([8,8,7],1.35,1.2,8,6,19))"));
assert.ok(Math.abs(previewOdds.goals.reduce((a,b)=>a+b,0)-1)<1e-10);
assert.ok(Math.abs(previewOdds.assists.reduce((a,b)=>a+b,0)-1.69)<1e-10);
assert.ok(Math.abs(previewOdds.goals[0]-previewOdds.goals[1])<1e-12);
assert.ok(previewOdds.goals[0]>previewOdds.goals[2]);
assert.ok(previewOdds.goals[2]>previewOdds.goals[3]);
assert.ok(previewOdds.assists.every(x=>x>=0));
const plainAssist=JSON.parse(evaluate("JSON.stringify(scoringPreviewOdds([8,8,7],1.35,1.2,8,0,100))"));
assert.ok(Math.abs(plainAssist.assists.reduce((a,b)=>a+b,0)-1)<1e-10);
const doubleAssist=JSON.parse(evaluate("JSON.stringify(scoringPreviewOdds([8,8,7],1.35,1.2,8,0,0))"));
assert.ok(Math.abs(doubleAssist.assists.reduce((a,b)=>a+b,0)-2)<1e-10);
// Preview presets modify the input fields only, without saving league state.
domNodes['cfg-goalExponent'].value='1.35';
domNodes['cfg-assistExponent'].value='1.2';
evaluate("applyScoringPreset('moderate')");
assert.equal(Number(domNodes['cfg-goalExponent'].value),1.15);
assert.equal(Number(domNodes['cfg-assistExponent'].value),1.2);
assert.equal(evaluate('state.settings.goalExponent'),1.35);
console.log('PASS: scoring preview sliders, presets, exact goal/assist expectations and non-mutating Settings');

assert.match(settingsHtml,/id="cfg-unassistedPct"[^>]*value="6"/);
assert.match(settingsHtml,/id="cfg-oneAssistPct"[^>]*value="19"/);
assert.match(settingsHtml,/Two-assist goals: 75%/);

assert.match(settingsHtml,/data-assist-status/);
assert.match(settingsHtml,/settings-savebar/);
assert.match(settingsHtml,/id="save-settings"/);
assert.match(settingsHtml,/data-save-settings/);
assert.equal((settingsHtml.match(/Save All Settings/g)||[]).length,2);
assert.ok(settingsHtml.indexOf('id="save-settings"')<settingsHtml.indexOf('Realistic scores and assists'));
assert.ok(settingsHtml.indexOf('data-save-settings')>settingsHtml.indexOf('Playoffs</h2>'));

const assistIndicator={className:'',textContent:''};
sandbox.document.querySelector=selector=>selector==='[data-assist-status]'?assistIndicator:null;
sandbox.document.getElementById('cfg-unassistedPct').value='6';
sandbox.document.getElementById('cfg-oneAssistPct').value='19';
evaluate('updateAssistStatus()');
assert.match(assistIndicator.textContent,/Two-assist goals: 75%/);
assert.match(assistIndicator.className,/odds-valid/);
sandbox.document.getElementById('cfg-unassistedPct').value='82';
evaluate('updateAssistStatus()');
assert.match(assistIndicator.className,/odds-invalid/);
assert.match(assistIndicator.textContent,/Invalid/);
sandbox.document.getElementById('cfg-unassistedPct').value='20';
sandbox.document.getElementById('cfg-oneAssistPct').value='45';
evaluate('updateAssistStatus()');
assert.match(assistIndicator.textContent,/Two-assist goals: 35%/);
assert.match(assistIndicator.className,/odds-valid/);

sandbox.saveClicks=0;
evaluate("saveSettings=()=>{saveClicks++};handleClick({target:{closest:selector=>selector==='button'?{id:'',dataset:{saveSettings:''}}:null}})");
assert.equal(sandbox.saveClicks,1);
console.log('PASS: live two-assist validation, both whole-page save controls, and save handler');
console.log('PASS: NHL-style 6/19/75 assist defaults for new universes');


// Individual Seasons derive per-year scoring from archived schedules and goal
// events. The same player can have multiple separate season performances.
evaluate("state=initialState();var singleSim1=simulateSeason();var singleSim2=simulateSeason();view='players';playerHistoryMode='season';individualSeasonCache=null;singleSeasonSort='regPoints';singleSeasonDescending=true;playerPage=0;playerQuery='';getAll=async store=>store==='seasons'?[singleSim1.result,singleSim2.result]:[];getIndexAll=async(store,index,year)=>[...singleSim1.games,...singleSim2.games].filter(g=>g.season===year)");
const singleRows=JSON.parse(await evaluate("individualSeasonRecords().then(rows=>JSON.stringify(rows))"));
const expectedRosterCount=Number(evaluate("Object.values(singleSim1.result.rosters).flat().length+Object.values(singleSim2.result.rosters).flat().length"));
assert.equal(singleRows.length,expectedRosterCount);
assert.ok(singleRows.some(r=>r.season===1));
assert.ok(singleRows.some(r=>r.season===2));
const singles=singleRows.find(r=>r.season===1&&r.regular.gp>0);
assert.ok(singles);
const expectedSingle=JSON.parse(evaluate("(function(){const id="+singles.id+";const relevant=singleSim1.games.filter(g=>g.stage==='regular');return JSON.stringify({g:relevant.flatMap(g=>g.goalEvents||[]).filter(x=>x.scorerId===id).length,a:relevant.flatMap(g=>g.goalEvents||[]).reduce((n,x)=>n+Number((x.assistIds||[]).includes(id)),0)});})()"));
assert.equal(singles.regular.g,expectedSingle.g);
assert.equal(singles.regular.a,expectedSingle.a);
assert.equal(singles.regular.gp,Number(evaluate("state.settings.gamesPerTeam")));
assert.ok(singleRows.some(r=>singleRows.filter(o=>o.id===r.id).length>1),'players should appear separately in multiple seasons');
assert.equal(singleRows.every(r=>r.regular.complete&&r.playoff.complete),true);
const sortedSingle=JSON.parse(evaluate("JSON.stringify(individualSeasonCache.rows.slice().sort(individualSeasonCompare).map(r=>({id:r.id,season:r.season,pts:r.regular.g+r.regular.a})))"));
assert.ok(sortedSingle.every((r,i)=>!i||r.pts<=sortedSingle[i-1].pts));
await evaluate("playerIndividualSeasons()");
const individualMarkup=domNodes.app.innerHTML;
assert.match(individualMarkup,/Individual Seasons:/);
assert.match(individualMarkup,/id="player-history-mode"/);
assert.match(individualMarkup,/Individual Seasons<\/option>/);
assert.match(individualMarkup,/id="single-season-sort"/);
assert.match(individualMarkup,/data-single-season-sort="regGoals"/);
assert.match(individualMarkup,/data-single-season-sort="regAssists"/);
assert.match(individualMarkup,/data-single-season-sort="pointsPerGame"/);
assert.match(individualMarkup,/data-year="1"/);
assert.match(individualMarkup,/data-player="\d+"/);
assert.match(individualMarkup,/data-player-page="1"/);
assert.equal((individualMarkup.match(/<th\b/g)||[]).length,15);
assert.equal((individualMarkup.match(/<\/th>/g)||[]).length,15);
assert.ok((individualMarkup.match(/<tr>/g)||[]).length>2);
const careerSortBefore=evaluate('playerSort');
evaluate("render=()=>{};handleClick({target:{closest:(sel)=>sel==='th[data-single-season-sort]'?{dataset:{singleSeasonSort:'regGoals'}}:null}})");
assert.equal(evaluate('singleSeasonSort'),'regGoals');
assert.equal(evaluate('singleSeasonDescending'),true);
evaluate("handleClick({target:{closest:(sel)=>sel==='th[data-single-season-sort]'?{dataset:{singleSeasonSort:'regGoals'}}:null}})");
assert.equal(evaluate('singleSeasonDescending'),false);
assert.equal(evaluate('playerSort'),careerSortBefore);

evaluate("playerQuery='unlikely_name_no_match_123';playerPage=0");
await evaluate("playerIndividualSeasons()");
assert.match(domNodes.app.innerHTML,/No matching seasons yet/);
evaluate("playerQuery='';playerPage=0;playerHistoryMode='career'");
evaluate("getAll=async store=>store==='players'?singleSim2.players:[]");
await evaluate("players()");
assert.match(domNodes.app.innerHTML,/Combined Seasons \(Career\)/);
assert.match(domNodes.app.innerHTML,/id="player-sort"/);
assert.doesNotMatch(domNodes.app.innerHTML,/id="single-season-sort"/);

// Older game archives without individual scoring plays are marked unavailable,
// not silently recorded as zero goal or assist seasons.
evaluate("view='players';playerHistoryMode='season';individualSeasonCache=null;getAll=async store=>store==='seasons'?[singleSim1.result]:[];getIndexAll=async()=>singleSim1.games.map((g,i)=>i===0?({...g,goalEvents:undefined}):g)");
const legacySingles=JSON.parse(await evaluate("individualSeasonRecords().then(rows=>JSON.stringify(rows))"));
assert.ok(legacySingles.some(r=>!r.regular.complete));
assert.equal(evaluate("individualSeasonValue(individualSeasonCache.rows.find(r=>!r.regular.complete),'regPoints')"),null);
await evaluate("playerIndividualSeasons()");
assert.match(domNodes.app.innerHTML,/shown as —/);
assert.match(domNodes.app.innerHTML,/<td>—<\/td>/);
console.log('PASS: Individual Seasons dropdown, scoring histories, columns, search, pagination and incomplete archives');
