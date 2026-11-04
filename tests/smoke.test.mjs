import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const files=['js/core.js','js/storage.js','js/scoring.js','js/draft.js','js/simulation.js',
'js/season-actions.js','js/views.js','js/v13.js','js/customization.js',
'js/testing-view.js','js/scoring-estimator.js','js/app.js'];
const sandbox=vm.createContext({console});
for(const file of files){
 let source=readFileSync(file,'utf8');
 if(file==='js/app.js')source=source.replace(/\nboot\(\);\s*$/,'\n');
 new vm.Script(source,{filename:file}).runInContext(sandbox);
}
const evaluate=code=>vm.runInContext(code,sandbox);
const parsed=code=>JSON.parse(evaluate('JSON.stringify('+code+')'));
assert.equal(evaluate('TEAM_NAMES.length'),16);
assert.equal(evaluate('TEAM_NAMES[0]'),'Estevan Bruins');
assert.equal(evaluate('DEFAULTS.goalRateAt9'),.85);
assert.equal(evaluate('DEFAULTS.playmakingRateAt9'),.35);
assert.equal(evaluate('DEFAULTS.tendencySpread'),0);
assert.equal(evaluate('DEFAULTS.maxRoster'),3);
assert.equal(evaluate('DEFAULTS.generatedPlayersPerSeason'),8);
assert.equal(evaluate('DEFAULTS.unassistedPct'),6);
assert.equal(evaluate('DEFAULTS.oneAssistPct'),19);
assert.equal(evaluate('typeof scoringWeight'),'undefined');
assert.equal(evaluate('typeof generateScore'),'undefined');
assert.equal(evaluate('TAB_NAMES.testing'),'Testing Information');
assert.equal(evaluate('effectiveRating({bonus:1,motivation:-2})'),0);
assert.equal(evaluate('effectiveRating({bonus:8,motivation:2})'),10);
assert.equal(evaluate('bonusOf({roster:[{bonus:8},{bonus:8},{bonus:8}]})'),24);
evaluate('state=initialState()');
const rates=parsed('[1,3,5,7,8,9,10].map(bonus=>goalRate({bonus,goalTendency:50}))');
assert.ok(rates.every((v,i)=>i===0||v>rates[i-1]));
assert.ok(evaluate('goalRate({bonus:8,goalTendency:75})>goalRate({bonus:8,goalTendency:25})'));
assert.ok(evaluate('playmakingRate({bonus:8,goalTendency:25})>playmakingRate({bonus:8,goalTendency:75})'));
console.log('PASS: defaults, +24 rosters, effective 0–10 ratings and goal/playmaking styles');

const poissonMean=evaluate('state=initialState();Array.from({length:12000},()=>poisson(1)).reduce((a,b)=>a+b,0)/12000');
assert.ok(poissonMean>.94&&poissonMean<1.06);
const styles=parsed("(function(){state=initialState();beginSeason();return state.teams.flatMap(t=>t.roster.map(p=>({style:p.goalTendency,m:p.motivation,min:p.motivationMin,max:p.motivationMax})))})()");
assert.ok(styles.length>=0&&styles.length<=48);
assert.ok(styles.every(p=>p.style===50&&p.m>=p.min&&p.m<=p.max));
const spread=parsed("(function(){state=initialState();state.settings.tendencySpread=25;beginSeason();return state.teams.flatMap(t=>t.roster.map(p=>p.goalTendency))})()");
assert.ok(spread.every(x=>x>=25&&x<=75)&&new Set(spread).size>1);
const rosterCheck=parsed("(function(){state=initialState();const none=unidentifiedRate({roster:[]});const weak={bonus:1,goalTendency:50,motivation:0};const one=unidentifiedRate({roster:[weak]})+goalRate(weak)+playmakingRate(weak);const great=[8,8,8].map((bonus,id)=>({id,bonus,goalTendency:50,motivation:0}));return {none,one,starDepth:unidentifiedRate({roster:great})}})()");
assert.ok(rosterCheck.one>=rosterCheck.none,'adding a low-rated named player must not reduce expected team offence');
assert.ok(rosterCheck.starDepth<rosterCheck.none,'elite lineups displace unidentified ice time');
console.log('PASS: Poisson and motivation, default 50/50 and editable styles');

const ot=parsed("(function(){state=initialState();state.settings.unnamedGoalsPerGame=0;const a=state.teams[0],b=state.teams[1],w={0:0,1:0};for(let i=0;i<500;i++){const gs=[],g=playGame(a,b,0,0,1,'regular',0,0,i,gs,new Map());if(!g.coin||g.scoreA+g.scoreB!==1||!g.goalEvents.at(-1).otGoal)throw Error('Bad OT');w[g.winnerId]++}return w})()");
assert.ok(ot[0]>170&&ot[0]<330);
assert.equal(ot[0]+ot[1],500);
const assist=parsed("(function(){state=initialState();const t=state.teams[0];t.roster=[makeNewPlayer(0,'spawn',1),makeNewPlayer(0,'spawn',1),makeNewPlayer(0,'spawn',1)];const a=t.roster[0],b=t.roster[1];const g=addGoal(t,'regular',new Map(),b.id,a.id,'playmaking');return {event:g,goals:b.regGoals,assists:a.regAssists}})()");
assert.equal(assist.goals,1);
assert.equal(assist.assists,1);
assert.ok(!assist.event.assistIds.includes(assist.event.scorerId));
assert.equal(new Set(assist.event.assistIds).size,assist.event.assistIds.length);
console.log('PASS: 50/50 overtime adds one goal; playmaking adds one goal and one primary assist');

for(const length of [30,45,60]){
 const seasons=parsed("(function(){state=initialState();state.settings.gamesPerTeam="+length+";const out=[];for(let i=0;i<8;i++){const x=simulateSeason();out.push({games:x.games,standings:x.result.standings,champion:x.result.championId})}return out})()");
 assert.equal(seasons.length,8);
 for(const season of seasons){
  assert.equal(season.standings.length,16);
  assert.equal(season.games.filter(x=>x.stage==='regular').length,8*length);
  assert.ok(season.games.some(x=>x.stage==='playoff'));
  assert.ok(season.champion>=0&&season.champion<16);
  for(const row of season.standings){
   assert.equal(row.played,length);
   assert.equal(row.w+row.l+row.otl,length);
   assert.equal(row.points,row.w*2+row.otl);
   assert.ok(row.bonus>=0&&row.bonus<=24);
  }
  for(const g of season.games){
   assert.notEqual(g.scoreA,g.scoreB);
   assert.equal(g.winnerId,g.scoreA>g.scoreB?g.aId:g.bId);
   assert.equal(g.goalEvents.length,g.scoreA+g.scoreB);
   if(g.coin){
    assert.equal(Math.abs(g.scoreA-g.scoreB),1);
    assert.equal(g.goalEvents.filter(e=>e.otGoal).length,1);
   }
   for(const play of g.goalEvents){
    assert.ok(play.assistsCount>=0&&play.assistsCount<=2);
    assert.equal(play.assistIds.length+play.anonymousAssists,play.assistsCount);
    assert.equal(new Set(play.assistIds).size,play.assistIds.length);
    assert.ok(!play.assistIds.includes(play.scorerId));
    if(play.source==='playmaking')assert.ok(play.assistIds.length>=1);
   }
  }
 }
 console.log('PASS: eight seasons at '+length+' games/team, scores, goals and assists reconcile');
}
const resumed=parsed("(function(){state=initialState();beginSeason();const previous=state.activeSeason.gameCount;playNextGames();return {previous,now:state.activeSeason.gameCount}})()");
assert.ok(resumed.now>resumed.previous);
console.log('PASS: incremental playoff simulation');
const lottery=parsed("(function(){state=initialState();beginSeason();while(state.activeSeason){const x=playNextGames();if(x.completed)finishSeason()}const before=state.draft.eligible.slice(),season=state.season;drawDraftLottery();const winners=state.draft.lottery.slice();revealDraftProspects();const prospects=JSON.parse(JSON.stringify(state.draft.prospects)),chosen=[];for(let i=0;i<3;i++){const item=prospects[i];const drafted=applyDraftPick(item.index);const p=drafted.find(x=>x.name===item.name);chosen.push({team:p.teamId,bonus:p.bonus,year:p.year,expected:item,origin:p.origin});advanceDraftPickReveal()}const phase=state.draft.phase;finishDraft();return {before,winners,prospects,chosen,season,phase,remaining:state.draft,notes:state.upcomingDraftNotes}})()");
assert.equal(lottery.before.length,8);
assert.equal(new Set(lottery.before).size,8);
assert.equal(lottery.winners.length,3);
assert.equal(new Set(lottery.winners).size,3);
assert.ok(lottery.winners.every(id=>lottery.before.includes(id)));
assert.equal(lottery.prospects.length,4);
assert.equal(lottery.prospects.filter(p=>p.mystery).length,1);
assert.ok(lottery.prospects.every(p=>p.bonus>=p.rangeMin&&p.bonus<=p.rangeMax&&p.year>=1&&p.year<=3));
assert.equal(lottery.chosen.length,3);
lottery.chosen.forEach((p,i)=>{assert.equal(p.team,lottery.winners[i]);assert.equal(p.bonus,p.expected.bonus);assert.equal(p.year,p.expected.year);assert.equal(p.origin,'draft')});
assert.equal(lottery.phase,'summary');
assert.equal(lottery.remaining,null);
assert.equal(lottery.notes.filter(x=>x.includes(' drafted ')).length,3);
const generation=parsed("(function(){state=initialState();simulateSeason();state.settings.generatedPlayersPerSeason=0;beginSeason();const first=state.activeSeason.events.filter(x=>x.includes(' generated ')).length;while(state.activeSeason){let x=playNextGames();if(x.completed)finishSeason()}completeDraftAutomatically();state.settings.generatedPlayersPerSeason=2;beginSeason();const second=state.activeSeason.events.filter(x=>x.includes(' generated ')).length;return {first,second}})()");
assert.equal(generation.first,0);
assert.ok(generation.second>=0&&generation.second<=2);
console.log('PASS: equal-odds lottery, 4 pre-rolled prospects, 1 concealed card, 3 revealed picks and configurable random generation');

const stats=parsed("(function(){state=initialState();for(let i=0;i<100;i++)simulateSeason();const t=testingData();return {s:t.seasons,n:t.teamSeasons,p:t.playerSeasons,games:t.games,goals:t.goals,checkpoint:t.checkpoints[100],groups:t.byStrength,generated:t.generation,counts:state.teams.map(x=>x.roster.length)}})()");
assert.equal(stats.s,100);
assert.equal(stats.n,1600);
assert.ok(stats.p>0);
assert.equal(stats.games,24000);
assert.ok(stats.goals>0);
assert.equal(stats.checkpoint.seasons,100);
assert.ok(stats.checkpoint.teamPlus>=0);
assert.ok(Object.keys(stats.groups).length>1);
assert.ok(stats.counts.every(n=>n<=3));
assert.ok(Object.values(stats.generated.spawn).reduce((a,b)=>a+b,0)>0);
const checkpoint1000=parsed("(function(){state=initialState();testingData().seasons=999;simulateSeason();return testingData().checkpoints[1000]})()");
assert.equal(checkpoint1000.seasons,1000);
console.log('PASS: 100/1000-season checkpoints and cumulative testing information');

if(process.env.ICE_NUMBERS_STRESS==='1'){
const benchmark=parsed("(function(){state=initialState();for(let i=0;i<1000;i++)simulateSeason();const t=testingData(),x=t.checkpoints[1000];return {season:x.seasons,teamPlus:x.teamPlus/x.teamSeasons,players:x.playerSeasons/x.teamSeasons,individual:x.individualPlus/x.playerSeasons,goalsPerGame:x.goals/x.games,highest:x.highestTeamPlus,highEffective:x.highestEffectiveTeamPlus,goalSeasons:t.goalSeasons,multigoal:t.multiGoalGames,twos:t.teamsWithTwoEight,threes:t.teamsWithThreeEight}})()");
assert.equal(benchmark.season,1000);
assert.ok(benchmark.goalsPerGame>1&&benchmark.goalsPerGame<25);
assert.ok(benchmark.teamPlus>0&&benchmark.teamPlus<=24);
console.log('PASS: 1,000 consecutive seasons measured: '+JSON.stringify(benchmark));
}
const nodes={};
sandbox.document={getElementById:id=>(nodes[id]??={innerHTML:'',textContent:''})};
evaluate('state=initialState();testingInformation()');
assert.match(nodes.app.innerHTML,/Average team \+/);
assert.match(nodes.app.innerHTML,/Checkpoint after 100 seasons/);
assert.match(nodes.app.innerHTML,/Reset Testing Information/);
evaluate('settings()');
assert.match(nodes.app.innerHTML,/\+9 player: independent goals\/game/);
assert.match(nodes.app.innerHTML,/Lottery draft/);
assert.match(nodes.app.innerHTML,/Random generated players across league\/year/);
assert.match(nodes.app.innerHTML,/Live Scoring Estimator/);
assert.doesNotMatch(nodes.app.innerHTML,/Goal talent exponent/);
assert.match(evaluate('ratingHtml({bonus:8,motivation:2})'),/rating-gold/);
assert.match(evaluate('ratingHtml({bonus:8,motivation:1})'),/rating-silver/);
assert.match(readFileSync('js/storage.js','utf8'),/IceNumbersV14/);
assert.match(readFileSync('index.html','utf8'),/js\/testing-view\.js/);
assert.match(readFileSync('index.html','utf8'),/js\/draft\.js/);
console.log('PASS: Settings, Testing Information, old save isolation and silver/gold ratings');
console.log('All V1.4 smoke tests passed.');
