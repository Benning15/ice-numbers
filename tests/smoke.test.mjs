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


// First year of a BRAND NEW universe initializes randomized opening rosters,
// not the old single-spawn format. Existing universes must not be affected.
assert.equal(evaluate('initialState().openingRostersPending'),true);
const opening=JSON.parse(evaluate("(function(){state=initialState();const sim=beginSeason();return JSON.stringify({counts:state.teams.map(t=>t.roster.length),archived:Object.values(state.activeSeason.rosters).map(r=>r.length),spawnEvents:state.activeSeason.events.filter(x=>x.includes('spawned')),openingEvents:state.activeSeason.events.filter(x=>x.includes('started with')).length,ids:state.teams.flatMap(t=>t.roster.map(p=>p.id)),persisted:state.openingRostersPending,years:state.teams.flatMap(t=>t.roster.map(p=>p.year)),motivation:state.teams.flatMap(t=>t.roster.map(p=>p.motivationSeason))})})()"));
assert.equal(opening.counts.length,16);
assert.ok(opening.counts.every(n=>n>=1&&n<=3));
assert.deepEqual(opening.counts,opening.archived);
assert.equal(opening.spawnEvents.length,0);
assert.equal(opening.openingEvents,opening.ids.length);
assert.equal(new Set(opening.ids).size,opening.ids.length);
assert.equal(opening.persisted,false);
assert.ok(opening.years.every(y=>y>=1&&y<=5));
assert.ok(opening.motivation.every(y=>y===1));
for(const maxRoster of [1,2,3]){
 const counts=JSON.parse(evaluate("(function(){state=initialState();state.settings.maxRoster="+maxRoster+";beginSeason();return JSON.stringify(state.teams.map(t=>t.roster.length))})()"));
 assert.ok(counts.every(n=>n>=1&&n<=maxRoster));
}
const oldUniverse=JSON.parse(evaluate("(function(){state=initialState();delete state.openingRostersPending;beginSeason();return JSON.stringify({sizes:state.teams.map(t=>t.roster.length),normal:state.activeSeason.events.filter(x=>x.includes('spawned')).length})})()"));
assert.ok(oldUniverse.sizes.every(n=>n===1));
assert.equal(oldUniverse.normal,16);
const manualFirstSeason=JSON.parse(evaluate("(function(){state=initialState();const p=makeNewPlayer(0,'spawn',1);state.teams[0].roster=[p];beginSeason();return JSON.stringify({first:state.teams[0].roster.length,others:state.teams.slice(1).map(t=>t.roster.length),opening:state.openingRostersPending})})()"));
assert.equal(manualFirstSeason.first,2);
assert.ok(manualFirstSeason.others.every(n=>n===1));
assert.equal(manualFirstSeason.opening,false);
// Verify that after Season 1, the legacy draft/normal annual spawning
// mechanics continue instead of running opening-roster generation again.
const seasonTwo=JSON.parse(evaluate("(function(){state=initialState();const first=simulateSeason(),rosterCount=Object.fromEntries(Object.entries(first.result.rosters).map(([id,r])=>[id,r.length]));const second=beginSeason();return JSON.stringify({flag:state.openingRostersPending,first:rosterCount,second:Object.values(state.activeSeason.rosters).map(r=>r.length),draftEvents:state.activeSeason.events.filter(x=>x.includes('drafted')).length,openingEvents:state.activeSeason.events.filter(x=>x.includes('started with')).length})})()"));
assert.equal(seasonTwo.flag,false);
assert.equal(seasonTwo.draftEvents,1);
assert.equal(seasonTwo.openingEvents,0);
// Distribution boundaries: a single RNG draw selects 1/2/3 at 15/50/35%.
const testBoundary=JSON.parse(evaluate("(function(){const saved=random;try{return JSON.stringify([0,.149999,.15,.64999,.65,.99999].map(x=>{random=()=>x;return weighted([15,50,35])}))}finally{random=saved}})()"));
assert.deepEqual(testBoundary,[1,1,2,2,3,3]);
console.log('PASS: new-universe 15/50/35 opening rosters, roster caps, archive logging, legacy state, later seasons');



// V1.3.18 scoring model: goals/assists are randomly assigned from
// actual team goal events using rating, Motivation and hidden scoring style.
assert.equal(evaluate('DEFAULTS.goalTargetAnnualChange'),undefined);
assert.equal(evaluate('typeof advancePersonalGoalTarget'),'undefined');
const stylesCreated=JSON.parse(evaluate("(function(){state=initialState();beginSeason();return JSON.stringify(state.teams.flatMap(t=>t.roster).map(p=>({style:p.goalTendency,target:p.goalTarget})))})()"));
assert.ok(stylesCreated.length>=16);
assert.ok(stylesCreated.every(p=>Number.isInteger(p.style)&&p.style>=20&&p.style<=80&&p.target===undefined));
assert.ok(new Set(stylesCreated.map(p=>p.style)).size>1);
const styleWeights=JSON.parse(evaluate("JSON.stringify([20,50,80].map(goalTendency=>({g:scoringWeight({bonus:8,goalTendency}),a:scoringWeight({bonus:8,goalTendency},true)})))"));
assert.ok(styleWeights[0].g<styleWeights[1].g&&styleWeights[1].g<styleWeights[2].g);
assert.ok(styleWeights[0].a>styleWeights[1].a&&styleWeights[1].a>styleWeights[2].a);
assert.equal(evaluate('scoringTendency({bonus:8})'),50);
const pointsSample=JSON.parse(evaluate("\n(function(){\n state=initialState();state.rngState=4893001;\n const team={id:0,roster:[\n  {id:1,name:'Shooter',bonus:8,goalTendency:80,motivation:0,regGoals:0,regAssists:0},\n  {id:2,name:'Playmaker',bonus:8,goalTendency:20,motivation:0,regGoals:0,regAssists:0},\n  {id:3,name:'Support',bonus:1,goalTendency:50,motivation:0,regGoals:0,regAssists:0}\n ]};\n let valid=true,totalAssists=0;\n for(let i=0;i<10000;i++){\n  const play=scoringPlay(team,'regular',null);\n  const ids=[play.scorerId,...play.assistIds].filter(id=>id!==null);\n  if(new Set(ids).size!==ids.length||play.assistsCount>2||\n     play.assistIds.length+play.anonymousAssists!==play.assistsCount)valid=false;\n  totalAssists+=play.assistsCount;\n }\n return JSON.stringify({valid,totalAssists,players:team.roster});\n})()"));
assert.equal(pointsSample.valid,true,'a player cannot occupy two point slots on one goal');
assert.ok(pointsSample.totalAssists>16000&&pointsSample.totalAssists<17700,'assist counts retain 6/19/75 rates');
assert.ok(pointsSample.players[0].regGoals>pointsSample.players[1].regGoals*2.5,'goal-oriented star scores more');
assert.ok(pointsSample.players[1].regAssists>pointsSample.players[0].regAssists*1.7,'playmaker assists more');
const stylePreview=JSON.parse(evaluate("JSON.stringify(scoringPreviewOdds([8,8,1],1.35,1.2,8,6,19,110,30,[80,20,50]))"));
assert.ok(stylePreview.goals[0]>stylePreview.goals[1]*2.5);
assert.ok(stylePreview.assists[1]>stylePreview.assists[0]*1.7);
assert.ok(Math.abs(stylePreview.goals.reduce((a,b)=>a+b,0)-1)<1e-10);
assert.ok(Math.abs(stylePreview.assists.reduce((a,b)=>a+b,0)-1.69)<1e-10);
const retained=JSON.parse(evaluate("(function(){state=initialState();const s=simulateSeason();const before=state.teams.flatMap(t=>t.roster).map(p=>({id:p.id,style:p.goalTendency}));beginSeason();return JSON.stringify({before,after:state.teams.flatMap(t=>t.roster).map(p=>({id:p.id,style:p.goalTendency})),publicRosters:s.result.rosters,activeRosters:state.activeSeason.rosters})})()"));
for(const p of retained.before){const current=retained.after.find(x=>x.id===p.id);if(current)assert.equal(p.style,current.style);}
assert.ok(Object.values(retained.publicRosters).flat().every(p=>!('goalTendency' in p)));
assert.ok(Object.values(retained.activeRosters).flat().every(p=>!('goalTendency' in p)));
const oldStyle=JSON.parse(evaluate("(function(){state=initialState();const p=makeNewPlayer(0,'spawn',1);delete p.goalTendency;p.goalTarget=35;p.goalTargetSeason=1;state.teams[0].roster=[p];beginSeason();return JSON.stringify(state.teams[0].roster.find(x=>x.id===p.id))})()"));
assert.ok(oldStyle.goalTendency>=20&&oldStyle.goalTendency<=80);
assert.equal(oldStyle.goalTarget,undefined);
assert.equal(oldStyle.goalTargetSeason,undefined);
const existingPlayoff=JSON.parse(evaluate("(function(){state=initialState();beginSeason();const p=state.teams[0].roster[0];delete p.goalTendency;p.goalTarget=34;playNextGames();return JSON.stringify({style:p.goalTendency,target:p.goalTarget,rate:scoringTendency(p)})})()"));
assert.equal(existingPlayoff.style,undefined);
assert.equal(existingPlayoff.target,34);
assert.equal(existingPlayoff.rate,50);
console.log('PASS: 20–80 hidden player styles, rating-weighted goals and assists, no double point credits, migration of old targets');

// Hidden Motivation: randomized per-player permanent ranges, annual rolls,
// save/resume safety, stats-archive secrecy, and both goal/assist weighting.
assert.equal(evaluate('MOTIVATION_RANGES.reduce((s,r)=>s+r[2],0)'),100);
assert.ok(evaluate('MOTIVATION_RANGES.every(([min,max])=>min>=-2&&max<=2&&min<=max)'));
const motCreated=JSON.parse(evaluate("(function(){state=initialState();beginSeason();return JSON.stringify(state.teams.flatMap(t=>t.roster).map(p=>({id:p.id,min:p.motivationMin,max:p.motivationMax,m:p.motivation,year:p.motivationSeason})))})()"));
assert.ok(motCreated.length>=16&&motCreated.length<=48);
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
assert.ok(evaluate('scoringWeight({bonus:1,motivation:-2})')>0);
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
assert.equal(evaluate('DEFAULTS.offensiveDepthStrength'),3);
assert.equal(evaluate('DEFAULTS.maxGoalsPerTeam'),15);

// The calibration settings now ship as defaults for newly created leagues,
// but the existing controls remain adjustable for existing leagues.
assert.equal(evaluate('initialState().settings.offensiveDepthStrength'),3);
assert.equal(evaluate('initialState().settings.maxGoalsPerTeam'),15);
assert.equal(evaluate("extraOffensiveGoals({roster:[{bonus:8},{bonus:8},{bonus:8}]},12)<=3"),true);
assert.equal(evaluate("offensiveDepthExpectation({roster:[{bonus:8},{bonus:8},{bonus:8}]},12,{...state.settings,offensiveDepthStrength:0})"),0);

const depthSamples=JSON.parse(evaluate("(function(){state=initialState();const f=(r,roll)=>offensiveDepthExpectation({roster:r.map(bonus=>({bonus}))},roll);return JSON.stringify({weak:f([8,1,1],12),deep:f([8,8,8],12),deepHalf:f([8,8,8],6),deepZero:f([8,8,8],0),off:offensiveDepthExpectation({roster:[{bonus:8},{bonus:8},{bonus:8}]},12,{...state.settings,offensiveDepthStrength:0})})})()"));
assert.deepEqual(depthSamples,{weak:.375,deep:3,deepHalf:1.5,deepZero:0,off:0});
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
const surgeTest=JSON.parse(evaluate("(function(){const original=random;try{let seq=[.999,.999,.01,.999];random=()=>seq.length?seq.shift():.5;state=initialState();state.settings.maxGoalsPerTeam=9;let a={id:0,roster:[]},b={id:1,roster:[]};let g={rollA:12,rollB:1,totalA:20,totalB:9,coin:false,winnerId:0,stage:'regular'};generateScore(a,b,g);return JSON.stringify({a:g.scoreA,b:g.scoreB,plays:g.goalEvents.length})}finally{random=original}})()"));
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
assert.match(settingsHtml,/id="cfg-offensiveDepthStrength"[^>]*step="0.25"[^>]*value="3"/);
assert.match(settingsHtml,/id="cfg-maxGoalsPerTeam"[^>]*value="15"/);
assert.doesNotMatch(settingsHtml,/goalTargetAnnualChange|preview-target-0/);
assert.match(settingsHtml,/Hidden player scoring styles/);
assert.match(settingsHtml,/id="preview-tendency-0"[^>]*min="20"[^>]*max="80"/);
assert.match(settingsHtml,/id="preview-tendency-1"/);
assert.match(settingsHtml,/id="preview-tendency-2"/);
assert.match(settingsHtml,/id="depth-preview"/);
assert.match(domNodes['depth-preview'].textContent,/\+8 \/ \+8 \/ \+8 adding ~3\.00/);
assert.match(settingsHtml,/Live scoring calculator/);
assert.match(settingsHtml,/id="strength-goalExponent"/);
assert.match(settingsHtml,/id="strength-assistExponent"/);
assert.match(settingsHtml,/data-scoring-preset="balanced"/);
assert.match(settingsHtml,/data-scoring-preset="moderate"/);
assert.match(settingsHtml,/data-scoring-preset="stars"/);
assert.match(settingsHtml,/id="preview-rating-2"/);
assert.equal((settingsHtml.match(/Empty slot \(no player\)/g)||[]).length,3);
assert.match(settingsHtml,/id="preview-team-goals"/);
assert.match(settingsHtml,/id="preview-auto-goals"[^>]*type="checkbox" checked/);
assert.match(settingsHtml,/Projected team goals in season/);


// A saved older league may still have 1.0 / 9 and should show those actual
// values instead of being silently changed to the latest new-league defaults.
evaluate("state=initialState();state.settings.offensiveDepthStrength=1;state.settings.maxGoalsPerTeam=9;settings()");
assert.match(domNodes.app.innerHTML,/id="cfg-offensiveDepthStrength"[^>]*value="1"/);
assert.match(domNodes.app.innerHTML,/id="cfg-maxGoalsPerTeam"[^>]*value="9"/);

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

// Ratings-aware automatic team-goal estimates use the real score-generation
// rules and an isolated PRNG (never advancing the live league RNG).
const autoGoals=JSON.parse(evaluate("(function(){state=initialState();const oldRng=state.rngState;const rules=state.settings;const weak=scoringPreviewTeamGoals([1,1,1],rules,30),mid=scoringPreviewTeamGoals([8,1,1],rules,30),elite=scoringPreviewTeamGoals([8,8,8],rules,30),off=scoringPreviewTeamGoals([8,8,8],{...rules,offensiveDepthStrength:0},30),half=scoringPreviewTeamGoals([8,8,8],rules,60),cap9=scoringPreviewTeamGoals([8,8,8],{...rules,maxGoalsPerTeam:9},30);return JSON.stringify({weak,mid,elite,off,half,cap9,unchanged:state.rngState===oldRng,repeated:elite===scoringPreviewTeamGoals([8,8,8],rules,30)})})()"));
assert.ok(autoGoals.weak<autoGoals.mid&&autoGoals.mid<autoGoals.elite,JSON.stringify(autoGoals));
assert.ok(autoGoals.elite>autoGoals.off+10,'additional offensive depth should produce additional goals');
assert.ok(Math.abs(autoGoals.half-2*autoGoals.elite)<=1,'goals forecast scales with season length');
assert.ok(autoGoals.cap9<=autoGoals.elite,'lower goal cap should not raise the expected team goals');
assert.equal(autoGoals.unchanged,true);
assert.equal(autoGoals.repeated,true);

for(const [k,value] of Object.entries({
 'cfg-gamesPerTeam':'30','cfg-maxBonus':'8','cfg-rollMax':'12','cfg-offensiveDepthStrength':'3','cfg-maxGoalsPerTeam':'15',
 'cfg-goalExponent':'1.35','cfg-assistExponent':'1.2','cfg-unnamedWeight':'8','cfg-unassistedPct':'6','cfg-oneAssistPct':'19',
 'preview-rating-0':'8','preview-rating-1':'8','preview-rating-2':'7',
 'preview-tendency-0':'50','preview-tendency-1':'50','preview-tendency-2':'30',
 'preview-team-goals':'90'
})){domNodes[k]??={innerHTML:'',textContent:''};domNodes[k].value=value;}
domNodes['preview-auto-goals']??={innerHTML:'',textContent:''};
domNodes['preview-auto-goals'].checked=true;
evaluate('state=initialState();updateScoringPreview()');
const initialAuto=Number(domNodes['preview-team-goals'].value);
assert.ok(initialAuto>0);
assert.match(domNodes['scoring-preview-results'].innerHTML,/Auto-estimated/);
assert.equal(domNodes['preview-team-goals'].readOnly,true);
domNodes['preview-rating-0'].value='1';
evaluate('updateScoringPreview()');
assert.ok(Number(domNodes['preview-team-goals'].value)<initialAuto,'preview should respond to a weaker rated player');
domNodes['preview-auto-goals'].checked=false;
domNodes['preview-team-goals'].value='101';
evaluate('updateScoringPreview()');
assert.equal(domNodes['preview-team-goals'].value,'101','manual override should stay exactly as entered');
assert.equal(domNodes['preview-team-goals'].readOnly,false);
assert.match(domNodes['scoring-preview-results'].innerHTML,/Manually assumed/);
domNodes['preview-auto-goals'].checked=true;
domNodes['preview-rating-0'].value='8';
evaluate('updateScoringPreview()');
assert.equal(Number(domNodes['preview-team-goals'].value),initialAuto);
console.log('PASS: Live scoring preview automatically forecasts GF from roster ratings, scoring rules and season length; optional manual override; no live RNG changes');

// A one- or two-player roster must not accidentally create fake +0 stars.
// The missing slots must carry zero scoring/assist weight, and be absent from
// the displayed forecast; they should never generate a featured scorer.
const partialScorers=JSON.parse(evaluate("(function(){state=initialState();const r=state.settings;return JSON.stringify({one:scoringPreviewOdds([8,0,0],1.35,1.2,8,6,19,90,30),two:scoringPreviewOdds([8,7,0],1.35,1.2,8,6,19,120,30),sameForecast:scoringPreviewTeamGoals([8,0,0],r,30)===scoringPreviewTeamGoals([8],r,30),weak:scoringPreviewTeamGoals([8,0,0],r,30),deep:scoringPreviewTeamGoals([8,8,8],r,30)})})()"));
assert.equal(partialScorers.one.goals[1],0);
assert.equal(partialScorers.one.goals[2],0);
assert.equal(partialScorers.one.assists[1],0);
assert.equal(partialScorers.one.assists[2],0);
assert.ok(Math.abs(partialScorers.one.goals.reduce((a,b)=>a+b,0)-1)<1e-10);
assert.ok(Math.abs(partialScorers.one.assists.reduce((a,b)=>a+b,0)-1.69)<1e-10);
assert.ok(Math.abs(partialScorers.one.goals[0]*90-30)<1e-9);
assert.equal(partialScorers.two.goals[2],0);
assert.equal(partialScorers.two.assists[2],0);
assert.ok(Math.abs(partialScorers.two.goals.reduce((a,b)=>a+b,0)-1)<1e-10);
assert.equal(partialScorers.sameForecast,true);
assert.ok(partialScorers.weak<partialScorers.deep);

for(const [k,value] of [['preview-rating-0','8'],['preview-rating-1','0'],['preview-rating-2','0']])domNodes[k].value=value;
domNodes['preview-auto-goals'].checked=true;
evaluate('updateScoringPreview()');
const soloPreview=domNodes['scoring-preview-results'].innerHTML;
assert.match(soloPreview,/Player A \(\+8, 50\/50\)/);
assert.doesNotMatch(soloPreview,/Player B \(/);
assert.doesNotMatch(soloPreview,/Player C \(/);
assert.match(soloPreview,/Unnamed skaters/);
assert.equal(domNodes['preview-tendency-1'].disabled,true);
assert.equal(domNodes['preview-tendency-2'].disabled,true);
assert.equal(domNodes['preview-tendency-label-2'].textContent,'—');
domNodes['preview-rating-1'].value='7';
evaluate('updateScoringPreview()');
const duoPreview=domNodes['scoring-preview-results'].innerHTML;
assert.match(duoPreview,/Player B \(\+7, 50\/50\)/);
assert.doesNotMatch(duoPreview,/Player C \(/);
assert.equal(domNodes['preview-tendency-1'].disabled,false);
domNodes['preview-rating-0'].value='0';
domNodes['preview-rating-1'].value='0';
evaluate('updateScoringPreview()');
assert.match(domNodes['scoring-preview-results'].innerHTML,/Select at least one featured player/);
console.log('PASS: empty calculator slots support real one- or two-player teams without ghost goals, assists or offensive depth');



assert.match(settingsHtml,/id="cfg-unassistedPct"[^>]*value="6"/);
assert.match(settingsHtml,/id="cfg-oneAssistPct"[^>]*value="19"/);
assert.match(settingsHtml,/Two-assist goals: 75%/);

assert.match(settingsHtml,/data-assist-status/);
assert.match(settingsHtml,/settings-savebar/);
assert.match(settingsHtml,/id="save-settings"/);
assert.match(settingsHtml,/id="set-default-settings"[^>]*>Set as Default<\/button>/);
assert.match(settingsHtml,/Save this league's rules, or save these values as your default/);
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
evaluate("saveSettings=async()=>{saveClicks++};handleClick({target:{closest:selector=>selector==='button'?{id:'',dataset:{saveSettings:''}}:null}})");
assert.equal(sandbox.saveClicks,1);

sandbox.defaultButtonClicks=[];
evaluate("saveSettings=async makeDefault=>{defaultButtonClicks.push(makeDefault)};handleClick({target:{closest:selector=>selector==='button'?{id:'set-default-settings',dataset:{}}:null}})");
assert.deepEqual(sandbox.defaultButtonClicks,[true]);
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


// V1.3.15: the saved preferred settings are browser-local preferences, not
// part of a universe; clearing/importing a league must NOT delete them.
const storeData={meta:new Map([['main',{key:'main',value:{season:45}}]]),seasons:new Map([[1,{season:1}]]),games:new Map([[1,{id:1}]]),players:new Map([[1,{id:1}]])};
sandbox.mockDefaultDB={
 transaction(name){
  const tx={
   objectStore(store){
    const rows=storeData[store];
    return {
     put(item){rows.set(item.key,item)},
     clear(){rows.clear()},
     delete(key){rows.delete(key)}
    };
   }
  };
  queueMicrotask(()=>tx.oncomplete?.());
  return tx;
 }
};
evaluate("db=mockDefaultDB");
await evaluate("commitDefaultSettings({...DEFAULTS,rollMax:29,offensiveDepthStrength:2.5,maxGoalsPerTeam:14,goalTargetAnnualChange:1})");
assert.equal(storeData.meta.get('customSettingsDefaults').value.rollMax,29);
assert.equal(storeData.meta.get('main').value.season,45,"the user's existing league remains unchanged when a default is stored");
await evaluate("clearAll()");
assert.equal(storeData.meta.has('main'),false);
assert.equal(storeData.meta.get('customSettingsDefaults').value.rollMax,29,'stored defaults survive new-league resets and backup import');
assert.ok(Object.values(storeData).slice(1).every(rows=>rows.size===0),'reset clears all old league data');
sandbox.savedPreference=storeData.meta.get('customSettingsDefaults');
evaluate("get=async (store,key)=>store==='meta'&&key==='customSettingsDefaults'?savedPreference:null");
const newLeagueSettings=JSON.parse(await evaluate("newUniverseState().then(next=>JSON.stringify(next.settings))"));
assert.equal(newLeagueSettings.rollMax,29);
assert.equal(newLeagueSettings.offensiveDepthStrength,2.5);
assert.equal(newLeagueSettings.maxGoalsPerTeam,14);
assert.equal(newLeagueSettings.goalTargetAnnualChange,1);
assert.equal(newLeagueSettings.gamesPerTeam,30);
sandbox.savedPreference=null;
const builtInSettings=JSON.parse(await evaluate("newUniverseState().then(next=>JSON.stringify(next.settings))"));
assert.equal(builtInSettings.rollMax,12);
assert.equal(builtInSettings.offensiveDepthStrength,3);
console.log('PASS: Set as Default saves the selected settings separately and survives universe reset/import without affecting past records');
