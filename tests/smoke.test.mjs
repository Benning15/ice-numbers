import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const files=['js/core.js','js/storage.js','js/scoring.js','js/draft.js','js/generation.js','js/simulation.js',
'js/future-rights.js','js/season-actions.js','js/preseason.js','js/views.js','js/team-views.js','js/player-views.js','js/v13.js','js/customization.js',
'js/testing-view.js','js/scoring-estimator.js','js/season-scoring.js','js/commissioner.js','js/app.js'];
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
assert.equal(evaluate('DEFAULTS.generatedPlayersPerSeason'),7);
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

const commissioner=parsed(`(function(){
 state=initialState();state.season=1;state.generatedForSeason=2;
 const a=state.teams[0],b=state.teams[1];
 const star=makeNewPlayer(0,'spawn',1,{name:'Original Star',bonus:8,year:2});
 const other=makeNewPlayer(0,'spawn',1,{name:'Other Skater',bonus:2,year:4});
 const partner=makeNewPlayer(1,'spawn',1,{name:'Trade Partner',bonus:3,year:3});
 a.roster=[star,other];
 b.roster=[partner,makeNewPlayer(1,'spawn',1,{bonus:4,year:1}),makeNewPlayer(1,'spawn',1,{bonus:1,year:5})];
 let blockedFull=false;try{commissionerMove(0,star.id,1)}catch(e){blockedFull=true}
 const noChange=star.teamId===0&&a.roster.length===2&&b.roster.length===3;
 const trade=commissionerSwap(0,star.id,1,partner.id);
 const traded={teamA:a.roster.map(p=>p.id),teamB:b.roster.map(p=>p.id),starTeam:star.teamId,partnerTeam:partner.teamId};
 const cut=commissionerRelease(1,star.id);
 const cutStatus=playerStatus(star),cutYear=star.cutSeason,cutRecord=cut.players[0].transactions.at(-1);
 const moved=commissionerMove(0,partner.id,1);
 const ledger=JSON.parse(JSON.stringify(state.transactions));
 const fromPlayer=JSON.parse(JSON.stringify(partner.transactions));
 let blockedDuringSeason=false;state.regularSeason={season:2};
 try{commissionerRelease(0,other.id)}catch(e){blockedDuringSeason=true}
 state.regularSeason=null;
 let blockedDraft=false;state.draft={phase:'lottery'};
 try{commissionerMove(1,partner.id,0)}catch(e){blockedDraft=true}
 state.draft=null;
 let blockedSameTeam=false;try{commissionerMove(1,partner.id,1)}catch(e){blockedSameTeam=true}
 const snap=clone(state);state=clone(snap);
 const future=simulateSeason();
 const player=state.teams.flatMap(t=>t.roster).find(p=>p.id===partner.id);
 return {blockedFull,noChange,traded,cutStatus,cutYear,cutRecord,ledger,fromPlayer,blockedDuringSeason,blockedDraft,blockedSameTeam,
  rosterCounts:state.teams.map(t=>t.roster.length),season:state.season,
  archivedTeam:future.result.rosters[1].some(p=>p.id===partner.id),
  archivedOld:future.result.rosters[0].some(p=>p.id===partner.id),
  futurePlayerHistory:player?.history?.filter(r=>r.season===2).map(r=>r.team)};
})()`);
assert.equal(commissioner.blockedFull,true,'moves cannot exceed 3 named players');
assert.equal(commissioner.noChange,true,'failed transfer must not change either roster');
assert.equal(commissioner.traded.starTeam,1);
assert.equal(commissioner.traded.partnerTeam,0);
assert.equal(commissioner.traded.teamA.length,2);
assert.equal(commissioner.traded.teamB.length,3);
assert.equal(commissioner.cutStatus,'Cut');
assert.equal(commissioner.cutYear,2);
assert.equal(commissioner.cutRecord.toTeamId,null);
assert.equal(commissioner.ledger.length,3);
assert.deepEqual(commissioner.ledger.map(tx=>tx.type),['trade','cut','move']);
assert.equal(commissioner.fromPlayer.length,2);
assert.equal(commissioner.fromPlayer[0].fromTeamId,1);
assert.equal(commissioner.fromPlayer[0].toTeamId,0);
assert.equal(commissioner.fromPlayer[1].toTeamId,1);
assert.equal(commissioner.blockedDuringSeason,true);
assert.equal(commissioner.blockedDraft,true);
assert.equal(commissioner.blockedSameTeam,true);
assert.ok(commissioner.rosterCounts.every(n=>n<=3));
assert.equal(commissioner.season,2);
assert.equal(commissioner.archivedTeam,true);
assert.equal(commissioner.archivedOld,false);
assert.ok(commissioner.futurePlayerHistory?.includes(1));
console.log('PASS: commissioner trades, moves, cuts, three-player limits, locked season and historical team continuity');


const liveRegular=parsed(`(function(){
 state=initialState();state.rngState=314159265;
 const opening=startRegularSeason(),total=state.regularSeason.schedule.length,initial=state.regularSeason.standings;
 const first=playRegularGames(1),afterOne=state.regularSeason.standings,original=clone(state);
 // Browser refresh: state is JSON-serializable and resumes without resimulating games.
 state=clone(original);
 const next=playRegularGames(10),afterEleven=state.regularSeason.standings;
 const stage=calculateSeasonScoring(state.regularSeason.rosters,[...first.games,...next.games],'regular');
 const gp=stage.reduce((sum,p)=>sum+p.gp,0);
 const goals=stage.reduce((sum,p)=>sum+p.g,0),assists=stage.reduce((sum,p)=>sum+p.a,0);
 const observedGoals=[...first.games,...next.games].flatMap(g=>g.goalEvents).filter(g=>g.scorerId!==null).length;
 const observedAssists=[...first.games,...next.games].flatMap(g=>g.goalEvents).reduce((sum,g)=>sum+(g.assistIds||[]).length,0);
 const remaining=playRegularGames(Infinity);
 const finished=state.activeSeason;
 const playoffGames=playNextGames().games;
 const playoff=calculateSeasonScoring(finished.rosters,[...first.games,...next.games,...remaining.games,...playoffGames],'playoff');
 const regular=calculateSeasonScoring(finished.rosters,[...first.games,...next.games,...remaining.games,...playoffGames],'regular');
 return {total,opened:opening.players.length,initialPlayed:initial.map(r=>r.played),
  first:first.games.length,afterOne:afterOne.reduce((sum,r)=>sum+r.played,0),
  next:next.games.length,afterEleven:afterEleven.reduce((sum,r)=>sum+r.played,0),
  saved:original.regularSeason.nextGame,nextIndex:state.regularSeason?.nextGame,
  last:remaining.games.length,active:!!finished,allPlayed:finished.standings.map(r=>r.played),
  playoffStarted:playoffGames.length>0,gp,goals,assists,observedGoals,observedAssists,
  fullSeasonGP:regular.reduce((sum,p)=>sum+p.gp,0),
  playoffG:playoff.reduce((sum,p)=>sum+p.g,0),
  playoffExpected:playoffGames.flatMap(g=>g.goalEvents).filter(g=>g.scorerId!=null).length};
})()`);
assert.equal(liveRegular.total,240);
assert.ok(liveRegular.initialPlayed.every(n=>n===0));
assert.equal(liveRegular.first,1);
assert.equal(liveRegular.afterOne,2);
assert.equal(liveRegular.next,10);
assert.equal(liveRegular.afterEleven,22);
assert.equal(liveRegular.saved,1);
assert.equal(liveRegular.last,229);
assert.equal(liveRegular.active,true);
assert.ok(liveRegular.allPlayed.every(n=>n===30));
assert.equal(liveRegular.playoffStarted,true);
assert.equal(liveRegular.goals,liveRegular.observedGoals);
assert.equal(liveRegular.assists,liveRegular.observedAssists);
assert.equal(liveRegular.playoffG,liveRegular.playoffExpected);
assert.ok(liveRegular.fullSeasonGP>0);
const resumeBulk=parsed("(function(){state=initialState();startRegularSeason();const one=playRegularGames(1);const p=one.games[0];const result=simulateSeason();return {first:p.id,played:result.games.filter(g=>g.stage==='regular').length,season:state.season,active:state.activeSeason,regular:state.regularSeason,draft:state.draft,generation:state.generation}})()");
assert.equal(resumeBulk.played,239);
assert.equal(resumeBulk.season,1);
assert.equal(resumeBulk.regular,null);
assert.equal(resumeBulk.active,null);
assert.equal(resumeBulk.draft,null);
assert.equal(resumeBulk.generation,null);
console.log('PASS: saved 1/10-game batches, live standings, scoring totals, end-of-season + playoffs and partial bulk resume');

const perTeamBatches=parsed(`(function(){
 const samples=[];
 for(const seasonLength of [30,45,60]){
  state=initialState();state.settings.gamesPerTeam=seasonLength;
  startRegularSeason();
  const oneCount=regularBatchGameCount(1);
  const first=playRegularGames(oneCount);
  const gp1=state.regularSeason.standings.map(r=>r.played);
  const tenCount=regularBatchGameCount(10);
  const second=playRegularGames(tenCount);
  const gp11=state.regularSeason.standings.map(r=>r.played);
  const end=playRegularGames(Infinity);
  samples.push({seasonLength,oneCount,oneGames:first.games.length,tenCount,tenGames:second.games.length,
    gp1,gp11,total:first.games.length+second.games.length+end.games.length,
    finalGp:state.activeSeason.standings.map(r=>r.played)});
 }
 // A V1.8 save could be in the middle of a round: don't duplicate games.
 state=initialState();startRegularSeason();
 playRegularGames(1);
 const partialCount=regularBatchGameCount(1);
 const partial=playRegularGames(partialCount);
 const balanced=state.regularSeason.standings.map(r=>r.played);
 const catchup=regularBatchGameCount(10);
 const advance=playRegularGames(catchup);
 const balancedEleven=state.regularSeason.standings.map(r=>r.played);
 // Near the end of a 30-game season, clamp a 10-game request to 9 games.
 playRegularGames(regularBatchGameCount(10));
 const lastCount=regularBatchGameCount(10);
 const last=playRegularGames(lastCount);
 return {samples,partialCount,partialPlayed:partial.games.length,balanced,catchup,
  afterCatchup:advance.games.length,balancedEleven,lastCount,lastPlayed:last.games.length,
  complete:!!state.activeSeason,finalGp:state.activeSeason.standings.map(r=>r.played)};
})()`);
for(const sample of perTeamBatches.samples){
 assert.equal(sample.oneCount,8);
 assert.equal(sample.oneGames,8);
 assert.ok(sample.gp1.every(n=>n===1),'all teams play exactly once per 1-game button');
 assert.equal(sample.tenCount,80);
 assert.equal(sample.tenGames,80);
 assert.ok(sample.gp11.every(n=>n===11),'all teams advance ten additional games');
 assert.equal(sample.total,sample.seasonLength*8);
 assert.ok(sample.finalGp.every(n=>n===sample.seasonLength));
}
assert.equal(perTeamBatches.partialCount,7);
assert.equal(perTeamBatches.partialPlayed,7);
assert.ok(perTeamBatches.balanced.every(n=>n===1));
assert.equal(perTeamBatches.catchup,80);
assert.equal(perTeamBatches.afterCatchup,80);
assert.ok(perTeamBatches.balancedEleven.every(n=>n===11));
assert.equal(perTeamBatches.lastCount,72);
assert.equal(perTeamBatches.lastPlayed,72);
assert.equal(perTeamBatches.complete,true);
assert.ok(perTeamBatches.finalGp.every(n=>n===30));
console.log('PASS: 1 and 10 games PER TEAM, 8/80 league games, even GP on 30/45/60 schedules, legacy partial saves');


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
assert.equal(evaluate('state.generation?.phase'),'ranking');
assert.equal(lottery.notes.filter(x=>x.includes(' drafted ')).length,3);

const stepwiseReveal=parsed("(function(){state=initialState();beginSeason();while(state.activeSeason){const r=playNextGames();if(r.completed)finishSeason()}const d=state.draft,original=JSON.parse(JSON.stringify(d.originalTeamPlus));const lotteryStart=state.rngState;revealDraftLotteryPick();const w=d.lottery.slice(),shown=[d.lotteryRevealed],rngAfterFirst=state.rngState;let guarded=false;try{revealDraftProspects()}catch(err){guarded=true}revealDraftLotteryPick();shown.push(d.lotteryRevealed);revealDraftLotteryPick();shown.push(d.lotteryRevealed);const rngAfterMore=state.rngState;revealDraftProspects();const drafted=[];for(let i=0;i<3;i++){const a=applyDraftPick(i);const p=d.picks.at(-1);drafted.push({before:p.before,after:p.after,actual:bonusOf(state.teams[p.teamId]),name:p.name,starting:original[p.teamId],teamId:p.teamId});advanceDraftPickReveal()}finishDraft();const g=state.generation;const initialCount=g.count;revealGenerationPick();const gSelected=g.selected.slice(),genStages=[g.revealed],rngAfterGenFirst=state.rngState;revealGenerationPick();genStages.push(g.revealed);const rngAfterGenSecond=state.rngState;const beforeAuto=gSelected.slice();completeGenerationAutomatically();return {shown,w,original,drafted,guarded,lotteryStart,rngAfterFirst,rngAfterMore,gSelected,beforeAuto,genStages,rngAfterGenFirst,rngAfterGenSecond,initialCount,generatedForSeason:state.generatedForSeason,phase:state.generation,rosters:state.teams.map(t=>t.roster.length)}})()");
assert.deepEqual(stepwiseReveal.shown,[1,2,3]);
assert.equal(stepwiseReveal.w.length,3);
assert.ok(stepwiseReveal.guarded,'prospect board must not be revealed before all lottery winners');
assert.equal(stepwiseReveal.rngAfterMore,stepwiseReveal.rngAfterFirst,'revealing stored winners should not consume random draws');
assert.ok(stepwiseReveal.drafted.every(p=>p.before===p.starting&&p.after===p.actual));
assert.equal(stepwiseReveal.genStages[0],1);
assert.equal(stepwiseReveal.genStages[1],2);
assert.equal(stepwiseReveal.rngAfterGenSecond,stepwiseReveal.rngAfterGenFirst,'revealing saved generation teams should not re-roll');
assert.deepEqual(stepwiseReveal.gSelected,stepwiseReveal.beforeAuto);
assert.equal(stepwiseReveal.initialCount,7);
assert.equal(stepwiseReveal.generatedForSeason,2);
assert.equal(stepwiseReveal.phase,null);
assert.ok(stepwiseReveal.rosters.every(x=>x<=3));
const revealAll=parsed("(function(){state=initialState();beginSeason();while(state.activeSeason){const x=playNextGames();if(x.completed)finishSeason()}revealDraftLotteryPick();const lottery=state.draft.lottery.slice();drawDraftLottery();const lotteryCount=state.draft.lotteryRevealed;const unchanged=lottery.every((id,i)=>id===state.draft.lottery[i]);const d=state.draft;revealDraftProspects();for(let i=0;i<3;i++){applyDraftPick(i);advanceDraftPickReveal()}finishDraft();revealGenerationPick();const chosen=state.generation.selected.slice();drawGenerationTeams();return {lotteryCount,unchanged,generationCount:state.generation.revealed,chosenUnchanged:chosen.every((id,i)=>id===state.generation.selected[i])}})()");
assert.equal(revealAll.lotteryCount,3);
assert.equal(revealAll.unchanged,true);
assert.equal(revealAll.generationCount,7);
assert.equal(revealAll.chosenUnchanged,true);
console.log('PASS: one-at-a-time and Sim All draws, fixed picks, draft before/after +, resume from partial generation');

const generation=parsed("(function(){state=initialState();state.settings.generatedPlayersPerSeason=0;simulateSeason();beginSeason();const first=state.activeSeason.events.filter(x=>x.includes(' generated ')).length;while(state.activeSeason){let x=playNextGames();if(x.completed)finishSeason()}state.settings.generatedPlayersPerSeason=2;completeDraftAutomatically();const before=JSON.stringify(state.teams.map(t=>t.roster.map(p=>p.id)));const sorted=state.generation.ranked.map(x=>x.base);drawGenerationTeams();const selected=state.generation.selected.slice();const eligible=state.generation.ranked.map(x=>x.teamId);viewGenerationWinners();const created=generateOffseasonPlayers();const after=state.generation.results.slice();const stage=state.generation.phase;finishGenerationStage();beginSeason();const second=state.activeSeason.events.filter(x=>x.includes(' generated ')).length;return {first,second,before,sorted,selected,eligible,created:created.map(p=>({id:p.id,bonus:p.bonus})),after,stage,year:state.generatedForSeason,rosters:state.teams.map(t=>t.roster.length)}})()");
assert.equal(generation.first,0);
assert.ok(generation.second>=0&&generation.second<=2);
assert.ok(generation.sorted.every((v,i,a)=>i===0||v<=a[i-1]),'team standings sorted descending by base +');
assert.equal(new Set(generation.selected).size,generation.selected.length);
assert.ok(generation.selected.every(id=>generation.eligible.includes(id)));
assert.equal(generation.after.length,generation.selected.length);
assert.ok(generation.created.length>=generation.selected.length&&generation.created.length<=generation.selected.length*2,'changed-player list can also include incumbents that were cut');
assert.ok(generation.after.every(r=>r.kept?(r.after===r.before+r.bonus-(r.cut?.bonus||0)):(r.after===r.before&&r.cut?.newPlayer)));
const fullSelection=parsed("(function(){state=initialState();state.season=1;state.settings.generatedPlayersPerSeason=16;for(const t of state.teams)t.roster=[makeNewPlayer(t.id,'spawn',1),makeNewPlayer(t.id,'spawn',1),makeNewPlayer(t.id,'spawn',1)];startGenerationStage();drawGenerationTeams();const chosen=state.generation.selected.slice();viewGenerationWinners();generateOffseasonPlayers();return {chosen,results:state.generation.results,counts:state.teams.map(t=>t.roster.length)}})()");
assert.equal(fullSelection.chosen.length,16,'every team remains eligible, including full rosters');
assert.equal(new Set(fullSelection.chosen).size,16);
assert.equal(fullSelection.results.length,16);
assert.ok(fullSelection.counts.every(n=>n===3));
const cutCases=parsed(`(function(){
 function scenario(roster,newBonus){
  state=initialState();state.season=1;state.settings.careerLength=1;
  state.settings.normalWeights=Array.from({length:8},(_,i)=>i+1===newBonus?100:0);
  const t=state.teams[0];
  t.roster=roster.map(([bonus,year],i)=>makeNewPlayer(0,'spawn',1,{bonus,year,name:'Incumbent '+i}));
  // Deliberately invert effective strength. Replacement must never use Motivation.
  for(const p of t.roster)p.motivation=p.bonus===roster[0][0]?2:-2;
  startGenerationStage();state.generation.selected=[0];state.generation.phase='teams';
  const changed=generateOffseasonPlayers(),r=state.generation.results[0];
  return {r,active:t.roster.map(p=>p.name),archived:changed.map(p=>({name:p.name,status:playerStatus(p),cutSeason:p.cutSeason}))};
 }
 return {
  better:scenario([[2,4],[6,2],[8,1]],4),
  youngerTie:scenario([[4,5],[4,3],[8,1]],4),
  sameYearTie:scenario([[4,1],[6,1],[8,1]],4),
  worse:scenario([[5,4],[6,2],[8,1]],4),
  open:scenario([[5,2],[8,1]],4)
 };
})()`);
assert.equal(cutCases.better.r.cut.name,'Incumbent 0');
assert.equal(cutCases.better.r.after,cutCases.better.r.before+2);
assert.equal(cutCases.better.archived.find(x=>x.name==='Incumbent 0').status,'Cut');
assert.equal(cutCases.youngerTie.r.cut.name,'Incumbent 0','the oldest equal-+ player must be cut');
assert.equal(cutCases.youngerTie.r.after,cutCases.youngerTie.r.before);
assert.ok(cutCases.youngerTie.r.kept);
assert.equal(cutCases.sameYearTie.r.kept,false,'do not displace an equally rated/equally aged incumbent');
assert.equal(cutCases.sameYearTie.r.cut.newPlayer,true);
assert.equal(cutCases.sameYearTie.archived.find(x=>x.status==='Cut').cutSeason,2);
assert.equal(cutCases.worse.r.kept,false);
assert.equal(cutCases.worse.r.after,cutCases.worse.r.before);
assert.equal(cutCases.open.r.cut,null);
assert.equal(cutCases.open.r.after,cutCases.open.r.before+4);
console.log('PASS: all 16 eligible including full rosters; higher base + wins and younger year breaks ties; Cut status is archived');
assert.equal(generation.stage,'results');
assert.equal(generation.year,3);
assert.ok(generation.rosters.every(n=>n<=3));
console.log('PASS: generation ceremony order, qualified team selection, one player per team, no double spawning');
console.log('PASS: equal-odds lottery, 4 pre-rolled prospects, 1 concealed card, 3 revealed picks and configurable random generation');

const stats=parsed("(function(){state=initialState();for(let i=0;i<100;i++)simulateSeason();const t=testingData();return {s:t.seasons,n:t.teamSeasons,p:t.playerSeasons,games:t.games,goals:t.goals,checkpoint:t.checkpoints[100],groups:t.byStrength,generated:t.generation,counts:state.teams.map(x=>x.roster.length)}})()");
assert.equal(stats.s,100);
assert.equal(stats.n,1600);
assert.ok(stats.p>0);
assert.equal(stats.games,24000);
assert.ok(stats.goals>0);
assert.equal(stats.checkpoint.seasons,100);
assert.ok(stats.checkpoint.teamPlus>=0);
assert.equal(stats.checkpoint.playoffTeamSeasons,800);
assert.equal(stats.checkpoint.missedTeamSeasons,800);
assert.equal(stats.checkpoint.championTeamSeasons,100);
assert.ok(stats.checkpoint.playoffTeamPlus>=0);
assert.ok(stats.checkpoint.missedTeamPlus>=0);
assert.ok(stats.checkpoint.championTeamPlus>=0);
const outcomeCheck=parsed("(function(){state=initialState();const expected=blankTeamOutcomes();for(let i=0;i<20;i++){let s=simulateSeason().result;accumulateTeamOutcomes(expected,s.standings,s.championId)}const actual=testingData();return {expected,actual:Object.fromEntries(TEAM_OUTCOME_KEYS.map(k=>[k,actual[k]]))}})()");
for(const key of ['playoffTeamPlus','playoffTeamSeasons','missedTeamPlus','missedTeamSeasons','championTeamPlus','championTeamSeasons'])
 assert.equal(outcomeCheck.actual[key],outcomeCheck.expected[key],'Outcome tally mismatch for '+key);
assert.equal(outcomeCheck.actual.playoffTeamSeasons,160);
assert.equal(outcomeCheck.actual.missedTeamSeasons,160);
assert.equal(outcomeCheck.actual.championTeamSeasons,20);
const resetOutcomes=parsed("(function(){state.testing=null;return Object.fromEntries(TEAM_OUTCOME_KEYS.map(k=>[k,testingData()[k]]))})()");
assert.equal(Object.keys(resetOutcomes).length,6);
assert.ok(Object.values(resetOutcomes).every(v=>v===0));
console.log('PASS: playoff, missed-playoff, champion team + averages reconcile with real season results and reset');
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
assert.match(nodes.app.innerHTML,/Playoff teams — average \+/);
assert.match(nodes.app.innerHTML,/Non-playoff teams — average \+/);
assert.match(nodes.app.innerHTML,/Champions — average \+/);
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
assert.ok(readFileSync('index.html','utf8').includes('js/season-scoring.js'));
assert.equal(evaluate('TAB_NAMES.scoring'),'Season Scoring');
assert.ok(readFileSync('index.html','utf8').includes('js/generation.js'));
evaluate("state=initialState();state.season=1;startGenerationStage();generationView()");
assert.match(nodes.app.innerHTML,/Generation Pick/);
assert.match(nodes.app.innerHTML,/Sim All/);
assert.ok(!nodes.app.innerHTML.includes('3/3'));
evaluate("state=initialState();state.draft={season:1,phase:'lottery',eligible:[0,1,2,3,4,5,6,7],lottery:null,lotteryRevealed:0,prospects:null,picks:[]};draftView()");
assert.match(nodes.app.innerHTML,/Lottery Pick/);
assert.match(nodes.app.innerHTML,/Sim All/);
assert.match(nodes.app.innerHTML,/draft-team-plus/);
assert.equal(evaluate('TAB_NAMES.generation'),'Player Generation');
console.log('PASS: Settings, Testing Information, old save isolation and silver/gold ratings');
assert.equal(evaluate('TAB_NAMES.commissioner'),'Commissioner Mode');
assert.ok(readFileSync('index.html','utf8').includes('js/commissioner.js'));
evaluate("state=initialState();state.season=1;state.generatedForSeason=2;state.teams[0].roster=[makeNewPlayer(0,'spawn',2,{bonus:6,year:2})];commissionerView()");
assert.match(nodes.app.innerHTML,/Manage rosters/);
assert.match(nodes.app.innerHTML,/Trade players \(swap\)/);
assert.match(nodes.app.innerHTML,/Transaction history/);
console.log('PASS: commissioner navigation and form render');

const teamGameLog=parsed(`(function(){
 state=initialState();
 const games=[
  {id:'g1',season:8,stage:'regular',aId:0,bId:1,gameNo:1,scoreA:4,scoreB:3,winnerId:0,coin:true,goalEvents:[]},
  {id:'g2',season:8,stage:'regular',aId:2,bId:0,gameNo:5,scoreA:2,scoreB:1,winnerId:2,coin:true,goalEvents:[]},
  {id:'g3',season:8,stage:'regular',aId:0,bId:3,gameNo:9,scoreA:5,scoreB:1,winnerId:0,coin:false,goalEvents:[]},
  {id:'g4',season:8,stage:'playoff',aId:4,bId:0,round:1,seriesNo:1,gameNo:1,scoreA:1,scoreB:3,winnerId:0,coin:false,goalEvents:[]},
  {id:'g5',season:8,stage:'playoff',aId:0,bId:4,round:1,seriesNo:1,gameNo:2,scoreA:2,scoreB:3,winnerId:4,coin:true,goalEvents:[]},
  {id:'g6',season:7,stage:'regular',aId:0,bId:5,gameNo:1,scoreA:0,scoreB:1,winnerId:5,coin:false}
 ];
 return {rows:teamSeasonGameRows(0,8,games),old:teamSeasonGameRows(0,7,games),
  outcomes:games.filter(g=>g.season===8).map(g=>teamGameOutcome(g,0))};
})()`);
assert.equal(teamGameLog.rows.length,5);
assert.ok(teamGameLog.rows[0].includes('4–3'));
assert.ok(teamGameLog.rows[0].includes('W (OT)'));
assert.ok(teamGameLog.rows[1].includes('1–2'));
assert.ok(teamGameLog.rows[1].includes('OTL'));
assert.ok(teamGameLog.rows[2].includes('5–1'));
assert.ok(teamGameLog.rows[3].includes('Quarterfinals'));
assert.ok(teamGameLog.rows[4].includes('L (OT)'));
assert.ok(teamGameLog.rows[4].includes('2–3'));
assert.equal(teamGameLog.old.length,1);
assert.deepEqual(teamGameLog.outcomes,['W (OT)','OTL','W','W','L (OT)']);
evaluate(`state=initialState();view='teams';selectedTeam=0;teamGamesTeam=0;teamGamesYear=null;
teamGamesCache={id:0,years:[8,7],games:[
 {id:'a',season:8,stage:'regular',aId:0,bId:1,gameNo:1,scoreA:2,scoreB:0,winnerId:0,coin:false,goalEvents:[]},
 {id:'b',season:7,stage:'regular',aId:0,bId:2,gameNo:1,scoreA:1,scoreB:3,winnerId:2,coin:false,goalEvents:[]}
]};renderTeamGameResults();`);
assert.match(nodes['team-games'].innerHTML,/Season 8/);
assert.match(nodes['team-games'].innerHTML,/2–0/);
assert.match(nodes['team-games'].innerHTML,/team-game-season/);
evaluate("teamGamesYear=7;renderTeamGameResults()");
assert.match(nodes['team-games'].innerHTML,/Season 7/);
assert.match(nodes['team-games'].innerHTML,/1–3/);
assert.doesNotMatch(nodes['team-games'].innerHTML,/2–0/);
assert.ok(readFileSync('js/team-views.js','utf8').includes('<summary>Game Results — By Season</summary>'));
console.log('PASS: collapsible team game log, W/OTL/playoff OT labels, final scores, seasonal filter and scoring detail fallback');


const teamSeasonStats=parsed(`(function(){
 state=initialState();
 const veteran={id:401,name:'Past Veteran',bonus:5};
 const rookie={id:402,name:'New Rookie',bonus:8};
 const setup={id:403,name:'Setup Specialist',bonus:3};
 const seasons=[
  {season:4,rosters:{0:[veteran]}},
  {season:5,rosters:{0:[rookie,setup]}}
 ];
 const games=[
  {id:'s4',season:4,stage:'regular',aId:0,bId:2,goalEvents:[{scorerId:401,assistIds:[]}]},
  {id:'s5r1',season:5,stage:'regular',aId:0,bId:1,goalEvents:[{scorerId:402,assistIds:[403]}]},
  {id:'s5r2',season:5,stage:'regular',aId:2,bId:0,goalEvents:[{scorerId:403,assistIds:[402]}]},
  {id:'s5po',season:5,stage:'playoff',aId:0,bId:3,goalEvents:[{scorerId:402,assistIds:[403]}]}
 ];
 const reg=calculateSeasonScoring({0:[rookie,setup]},games.filter(g=>g.season===5),'regular');
 const po=calculateSeasonScoring({0:[rookie,setup]},games.filter(g=>g.season===5),'playoff');
 const older=calculateSeasonScoring({0:[veteran]},games.filter(g=>g.season===4),'regular');
 const rows=teamSeasonPlayerRows(0,seasons[1],games,'regular');
 return {reg,po,older,rows,seasons,games};
})()`);
assert.equal(teamSeasonStats.reg.length,2);
assert.equal(teamSeasonStats.reg[0].name,'New Rookie');
assert.equal(teamSeasonStats.reg[0].gp,2);
assert.equal(teamSeasonStats.reg[0].g,1);
assert.equal(teamSeasonStats.reg[0].a,1);
assert.equal(teamSeasonStats.reg[0].points,2);
assert.equal(teamSeasonStats.reg[1].gp,2);
assert.equal(teamSeasonStats.reg[1].points,2);
assert.equal(teamSeasonStats.po[0].name,'New Rookie');
assert.equal(teamSeasonStats.po[0].gp,1);
assert.equal(teamSeasonStats.po[0].points,1);
assert.equal(teamSeasonStats.po[1].a,1);
assert.equal(teamSeasonStats.older[0].name,'Past Veteran');
assert.equal(teamSeasonStats.older[0].points,1);
assert.ok(teamSeasonStats.rows.join('').includes('New Rookie'));
assert.ok(!teamSeasonStats.rows.join('').includes('Past Veteran'));
evaluate(`state=initialState();view='teams';selectedTeam=0;teamGamesTeam=0;teamGamesYear=5;
 teamGamesCache={id:0,years:[5,4],seasons:${JSON.stringify(teamSeasonStats.seasons)},
 games:${JSON.stringify(teamSeasonStats.games)}};renderTeamSeasonPlayerStats();`);
assert.match(nodes['team-player-stats'].innerHTML,/Select season/);
assert.match(nodes['team-player-stats'].innerHTML,/Season 5/);
assert.match(nodes['team-player-stats'].innerHTML,/Regular Season/);
assert.match(nodes['team-player-stats'].innerHTML,/Playoffs/);
assert.match(nodes['team-player-stats'].innerHTML,/New Rookie/);
assert.doesNotMatch(nodes['team-player-stats'].innerHTML,/Past Veteran/);
evaluate("teamGamesYear=4;renderTeamSeasonPlayerStats()");
assert.match(nodes['team-player-stats'].innerHTML,/Past Veteran/);
assert.doesNotMatch(nodes['team-player-stats'].innerHTML,/New Rookie/);
assert.ok(readFileSync('js/team-views.js','utf8').includes('<summary>Player Stats — By Season</summary>'));
assert.ok(readFileSync('js/app.js','utf8').includes("e.target.id==='team-player-season'"));
console.log('PASS: team-specific regular/playoff player stats, live and archived years, stats isolated from current roster');


const franchiseLeaders=parsed(`(function(){
 state=initialState();
 const alpha={id:701,name:'Traded Star',bonus:8},beta={id:702,name:'Franchise Legend',bonus:6};
 const gamma={id:703,name:'Late Rookie',bonus:3},opp={id:704,name:'Rival Scorer',bonus:7};
 const seasons=[
  {season:1,rosters:{0:[alpha,beta],1:[opp]}},
  {season:2,rosters:{0:[beta,gamma],1:[alpha,opp]}}
 ];
 const goals=(...plays)=>plays;
 const games=[
  {season:1,stage:'regular',aId:0,bId:1,goalEvents:goals(
   {teamId:0,scorerId:701,assistIds:[702]},
   {teamId:0,scorerId:702,assistIds:[701]},
   {teamId:1,scorerId:704,assistIds:[]})},
  {season:1,stage:'playoff',aId:1,bId:0,goalEvents:goals({teamId:0,scorerId:701,assistIds:[702]})},
  {season:2,stage:'regular',aId:0,bId:1,goalEvents:goals(
   {teamId:0,scorerId:703,assistIds:[702]},
   {teamId:1,scorerId:701,assistIds:[]})},
  {season:2,stage:'playoff',aId:1,bId:0,goalEvents:goals({teamId:0,scorerId:703,assistIds:[702]})}
 ];
 const players=franchiseAllTimeScorers(0,seasons,games);
 const standings=Object.fromEntries(players.map(p=>[p.name,{
  seasons:p.seasons,regular:franchiseAllTimeStage(p,'regular'),
  playoff:franchiseAllTimeStage(p,'playoff'),combined:franchiseAllTimeStage(p,'combined')}]));
 return {standings,count:players.length,rows:players};
})()`);
assert.equal(franchiseLeaders.count,3);
assert.equal(franchiseLeaders.standings['Traded Star'].seasons,1);
assert.equal(franchiseLeaders.standings['Traded Star'].regular.gp,1);
assert.equal(franchiseLeaders.standings['Traded Star'].regular.points,2);
assert.equal(franchiseLeaders.standings['Traded Star'].playoff.points,1);
assert.equal(franchiseLeaders.standings['Traded Star'].combined.points,3,
 'Do not count games played for a different franchise after the trade');
assert.equal(franchiseLeaders.standings['Franchise Legend'].seasons,2);
assert.equal(franchiseLeaders.standings['Franchise Legend'].regular.gp,2);
assert.equal(franchiseLeaders.standings['Franchise Legend'].regular.points,3);
assert.equal(franchiseLeaders.standings['Franchise Legend'].playoff.points,2);
assert.equal(franchiseLeaders.standings['Franchise Legend'].combined.points,5);
assert.equal(franchiseLeaders.standings['Franchise Legend'].combined.gp,4);
assert.equal(franchiseLeaders.standings['Late Rookie'].combined.points,2);
assert.equal(franchiseLeaders.standings['Late Rookie'].combined.gp,2);
const incompleteAllTime=parsed(`(function(){
 const p={id:71,name:'Older Archive Star'};
 const seasons=[{season:1,rosters:{0:[p]}},{season:2,rosters:{0:[p]}}];
 const games=[{season:1,stage:'regular',aId:0,bId:1},{season:2,stage:'regular',aId:0,bId:1,goalEvents:[]}];
 const s=franchiseAllTimeScorers(0,seasons,games);
 return franchiseAllTimeStage(s[0],'regular');
})()`);
assert.equal(incompleteAllTime.gp,2);
assert.equal(incompleteAllTime.incomplete,true);
evaluate(`state=initialState();view='teams';selectedTeam=0;teamAllTimeMode='combined';
teamGamesCache={id:0,seasons:[
 {season:1,rosters:{0:[{id:701,name:'Traded Star'}, {id:702,name:'Franchise Legend'}]}},
 {season:2,rosters:{0:[{id:702,name:'Franchise Legend'}, {id:703,name:'Late Rookie'}]}}
],games:[
 {season:1,stage:'regular',aId:0,bId:1,goalEvents:[{teamId:0,scorerId:701,assistIds:[702]}]},
 {season:1,stage:'playoff',aId:0,bId:1,goalEvents:[{teamId:0,scorerId:701,assistIds:[]}]},
 {season:2,stage:'regular',aId:0,bId:1,goalEvents:[{teamId:0,scorerId:702,assistIds:[]}]}
]};renderTeamAllTimeScorers();`);
assert.match(nodes['team-alltime'].innerHTML,/Franchise Legend/);
assert.match(nodes['team-alltime'].innerHTML,/Traded Star/);
assert.match(nodes['team-alltime'].innerHTML,/Late Rookie/);
assert.match(nodes['team-alltime'].innerHTML,/Regular \+ Playoffs/);
assert.match(nodes['team-alltime'].innerHTML,/team-alltime-mode/);
assert.ok(nodes['team-alltime'].innerHTML.indexOf('Traded Star')<nodes['team-alltime'].innerHTML.indexOf('Franchise Legend'));
evaluate("teamAllTimeMode='regular';renderTeamAllTimeScorers()");
assert.match(nodes['team-alltime'].innerHTML,/Regular Season/);
assert.match(nodes['team-alltime'].innerHTML,/Franchise Legend/);
evaluate("teamAllTimeMode='playoff';renderTeamAllTimeScorers()");
assert.match(nodes['team-alltime'].innerHTML,/Playoffs/);
assert.ok(readFileSync('js/team-views.js','utf8').includes('<summary id="team-alltime-summary">All-Time Team Scoring Leaders</summary>'));
assert.ok(readFileSync('js/app.js','utf8').includes("e.target.id==='team-alltime-mode'"));
console.log('PASS: all-time franchise scorers, old teammates, trades, season isolation, stage dropdown and missing historic goal events');


// Maintenance regression: corrupted imports must fail before writing anything.
const backupMeta=parsed("initialState()");
const validBackup={format:'ice-numbers-v14',meta:backupMeta,seasons:[],games:[],players:[]};
assert.equal(evaluate("typeof validateLeagueBackup"),'function');
const validValidated=evaluate('validateLeagueBackup('+JSON.stringify(validBackup)+')');
assert.equal(validValidated.meta.teams.length,16);
assert.throws(()=>evaluate('validateLeagueBackup('+JSON.stringify({...validBackup,players:[{id:1},{id:1}]})+')'),/duplicate/);
assert.throws(()=>evaluate('validateLeagueBackup('+JSON.stringify({...validBackup,games:[{season:1}]})+')'),/game/);
assert.throws(()=>evaluate('validateLeagueBackup('+JSON.stringify({...validBackup,meta:{...backupMeta,teams:[]}})+')'),/team/);
assert.ok(readFileSync('js/storage.js','utf8').includes('replaceLeagueAtomically('));
assert.ok(readFileSync('index.html','utf8').includes('js/team-views.js'));
assert.ok(readFileSync('index.html','utf8').includes('js/player-views.js'));
assert.ok(readFileSync('js/team-views.js','utf8').includes('function loadTeamGameArchive()'));
assert.ok(readFileSync('js/player-views.js','utf8').includes('state.regularSeason||state.activeSeason'));
console.log('PASS: backup import validation, view separation and lazy team-history loading');


const htmlScripts=readFileSync('index.html','utf8');
assert.ok(htmlScripts.indexOf('js/views.js')<htmlScripts.indexOf('js/team-views.js'));
assert.ok(htmlScripts.indexOf('js/team-views.js')<htmlScripts.indexOf('js/player-views.js'));
assert.ok(htmlScripts.indexOf('js/player-views.js')<htmlScripts.indexOf('js/app.js'));
evaluate(`state=initialState();view='teams';selectedTeam=0;
teamGamesCache={id:0,years:[1],games:null,seasons:[{season:1,rosters:{0:[{id:901,name:'Cached Player',bonus:5}]}}]};
`);
sandbox.historyFetches=0;
evaluate(`getIndexAll=async function(store,index,key){historyFetches++;return [
 {id:'test-live',season:1,stage:'regular',aId:0,bId:1,scoreA:2,scoreB:1,gameNo:1,winnerId:0,coin:false,
 goalEvents:[{teamId:0,scorerId:901,assistIds:[]}]}
]}`);
await evaluate("loadTeamGameArchive()");
assert.equal(sandbox.historyFetches,1);
assert.match(nodes['team-games'].innerHTML,/2–1/);
assert.match(nodes['team-player-stats'].innerHTML,/Cached Player/);
await evaluate("loadTeamGameArchive()");
assert.equal(sandbox.historyFetches,1,'reopening uses the already loaded team game history');
await evaluate("view='settings';render()");
assert.equal(evaluate('teamGamesCache'),null,'leaving Team Records releases large game arrays');
console.log('PASS: deferred team archive fetch, one-time indexed lookup and cache release on navigation');


const rights=parsed(`(function(){
 state=initialState();state.season=1;state.generatedForSeason=2;
 const genTrade=futureRightTransfer('generation',1,0),draftTrade=futureRightTransfer('draft',1,0);
 let duplicateBlocked=false;try{futureRightTransfer('generation',1,0)}catch(err){duplicateBlocked=true}
 const pendingBefore={generation:futureRightOwner('generation',1),draft:futureRightOwner('draft',1),
  outstandingGen:Object.keys(state.futureRights.generation).length,outstandingDraft:Object.keys(state.futureRights.draft).length};
 // A right may be traded AGAIN to a third team, then back, but never duplicated.
 const relay=futureRightTransfer('generation',1,2);
 const ownerAfterRelay=futureRightOwner('generation',1);
 futureRightTransfer('generation',1,0);
 const history=state.transactions.map(tx=>({type:tx.type,kind:tx.right?.kind,origin:tx.right?.originId,
  from:tx.right?.fromId,to:tx.right?.toId}));
 // Year 3: originating team 1 was not selected; its owner keeps waiting.
 state.season=2;
 startGenerationStage();
 state.generation.phase='teams';state.generation.selected=[2];
 generateOffseasonPlayers();
 const afterSkipped=futureRightOwner('generation',1);
 finishGenerationStage();
 // Year 4: team 1 finally gets picked. The received player goes to team 0.
 state.season=3;
 startGenerationStage();
 state.generation.phase='teams';state.generation.selected=[1];
 const beforeEstevan=state.teams[0].roster.map(p=>p.id),beforeWeyburn=state.teams[1].roster.map(p=>p.id);
 generateOffseasonPlayers();
 const redeemed={...state.generation.results[0]};
 const genAfter=futureRightOwner('generation',1);
 const received=state.teams[0].roster.some(p=>p.id===redeemed.playerId);
 const originNotCredited=state.teams[1].roster.map(p=>p.id).join(',')===beforeWeyburn.join(',');
 const changed=state.teams[0].roster.map(p=>p.id).join(',')!==beforeEstevan.join(',');
 finishGenerationStage();
 // The NEXT opportunity returns to origin after the one traded chance is used.
 state.season=4;
 startGenerationStage();
 state.generation.phase='teams';state.generation.selected=[1];
 generateOffseasonPlayers();
 const nextOriginResult={...state.generation.results[0]};
 finishGenerationStage();
 // The draft asset is STILL outstanding because team 1 has not won a draft pick.
 const pendingDraft=futureRightOwner('draft',1);
 state.season=5;state.draft={season:5,phase:'picking',lottery:[1,2,3],
  prospects:[{index:0,name:'Right Prospect',bonus:6,year:1},
   {index:1,name:'Second Prospect',bonus:3,year:2},
   {index:2,name:'Third Prospect',bonus:2,year:1}],
  picks:[]};
 const beforeDraft=state.teams[0].roster.map(p=>p.id);
 const updated=applyDraftPick(0);
 const picked={...state.draft.picks[0]};
 const draftConsumed=futureRightOwner('draft',1);
 const draftPlayer=updated.find(p=>p.id===picked.playerId);
 const ledger=state.transactions.map(tx=>({type:tx.type,kind:tx.right?.kind,originId:tx.right?.originId}));
 const drawNoEffect={genCount:state.generation,otherOwner:futureRightOwner('draft',2)};
 return {genTrade,draftTrade,duplicateBlocked,pendingBefore,relay:relay.event.right,ownerAfterRelay,
  history,afterSkipped,redeemed,genAfter,received,originNotCredited,changed,nextOriginResult,
  pendingDraft,picked,draftConsumed,draftPlayerTeam:draftPlayer?.teamId,
  draftPlayerOnRoster:state.teams[0].roster.some(p=>p.id===picked.playerId),
  ledger,drawNoEffect,
  maxRoster:state.teams.every(t=>t.roster.length<=state.settings.maxRoster)};
})()`);
assert.equal(rights.duplicateBlocked,true,'the same future right cannot be assigned twice');
assert.equal(rights.pendingBefore.generation,0);
assert.equal(rights.pendingBefore.draft,0);
assert.equal(rights.pendingBefore.outstandingGen,1);
assert.equal(rights.pendingBefore.outstandingDraft,1);
assert.equal(rights.ownerAfterRelay,2);
assert.equal(rights.relay.fromId,0);
assert.equal(rights.relay.toId,2);
assert.equal(rights.afterSkipped,0,'right persists through unselected years');
assert.equal(rights.redeemed.originTeamId,1);
assert.equal(rights.redeemed.teamId,0);
assert.equal(rights.received,true);
assert.equal(rights.originNotCredited,true);
assert.equal(rights.changed,true);
assert.equal(rights.genAfter,1,'only one generation opportunity is traded');
assert.equal(rights.nextOriginResult.teamId,1,'next generation goes back to original owner');
assert.equal(rights.pendingDraft,0,'draft right persists independently until its origin wins lottery');
assert.equal(rights.picked.originTeamId,1);
assert.equal(rights.picked.teamId,0);
assert.equal(rights.draftPlayerTeam,0);
assert.equal(rights.draftPlayerOnRoster,true);
assert.equal(rights.draftConsumed,1,'draft right is redeemed once when pick is made');
assert.equal(rights.drawNoEffect.otherOwner,2);
assert.equal(rights.maxRoster,true);
assert.equal(rights.ledger.filter(x=>x.type==='right-used'&&x.kind==='generation').length,1);
assert.equal(rights.ledger.filter(x=>x.type==='right-used'&&x.kind==='draft').length,1);
assert.equal(evaluate('typeof futureRightsStore'),'function');
evaluate("state=initialState();view='commissioner';commissionerView()");
assert.match(nodes.app.innerHTML,/Trade Future Opportunities/);
assert.match(nodes.app.innerHTML,/Next winning lottery draft opportunity/);
assert.match(nodes.app.innerHTML,/Outstanding traded rights/);
console.log('PASS: one future right per source and type, re-trading, long waits, winner-to-owner generation/draft, single redemption and UI');


const preseasonCards=parsed(`(function(){
 state=initialState();state.season=6;state.generatedForSeason=7;
 state.teams[0].currentTitleStreak=3;state.teams[0].currentPlayoffStreak=4;state.teams[0].titles=4;
 state.teams[0].roster=[{id:380,name:'Bruins Star',bonus:8,year:2},{id:381,name:'Bruins Rookie',bonus:4,year:1}];
 state.teams[1].currentMissStreak=3;state.teams[1].currentTitleStreak=0;
 const championCard=preseasonTeamCard(state.teams[0]);
 const missedCard=preseasonTeamCard(state.teams[1]);
 const champs=preseasonTrophies(state.teams[0]);
 const checks={available:preseasonPreviewAvailable(),required:preseasonPreviewRequired(),
  championCard,missedCard,champs,streak:preseasonPlayoffStreak(state.teams[0])};
 state.previewConfirmedForSeason=7;
 checks.noLongerRequired=!preseasonPreviewRequired();
 return checks;
})()`);
assert.equal(preseasonCards.available,true);
assert.equal(preseasonCards.required,true);
assert.equal(preseasonCards.noLongerRequired,true);
assert.match(preseasonCards.championCard,/reigning-champion/);
assert.match(preseasonCards.championCard,/Reigning champion · 3 straight/);
assert.match(preseasonCards.championCard,/Bruins Star/);
assert.match(preseasonCards.championCard,/Year 2\/5/);
assert.match(preseasonCards.championCard,/\+12/);
assert.match(preseasonCards.championCard,/Made playoffs 4 consecutive seasons/);
assert.equal((preseasonCards.champs.match(/🏆/g)||[]).length,3);
assert.match(preseasonCards.missedCard,/Missed playoffs 3 consecutive seasons/);
assert.doesNotMatch(preseasonCards.missedCard,/reigning-champion/);
assert.ok(!preseasonCards.missedCard.includes('🏆'));
const unbeatenCard=parsed(`(function(){
 state=initialState();state.season=12;state.generatedForSeason=13;
 state.teams[3].currentTitleStreak=10;
 return {card:preseasonTeamCard(state.teams[3]),trophies:preseasonTrophies(state.teams[3])};
})()`);
assert.equal((unbeatenCard.trophies.match(/🏆/g)||[]).length,5);
assert.match(unbeatenCard.trophies,/\+5/);
assert.ok(readFileSync('styles.css','utf8').includes('.preseason-team-card.reigning-champion'));
assert.ok(readFileSync('index.html','utf8').includes('js/preseason.js'));
assert.equal(evaluate("TAB_NAMES.preview"),'Preseason Preview');
console.log('PASS: 16-team preseason preview UI, champion gold borders, repeated trophies, roster + and playoff streaks');

const openingBaseline=parsed(`(function(){
 state=initialState();state.rngState=92919;state.initialSeed=92919;
 const before=state.totalGames;
 startRegularSeason();
 return {before,after:state.totalGames,rosters:state.teams.map(t=>t.roster.map(p=>({id:p.id,bonus:p.bonus,year:p.year}))),
  rng:state.rngState,notes:state.regularSeason.events,
  next:state.regularSeason.nextGame,nextPlayer:state.nextPlayerId};
})()`);
const openingPreview=parsed(`(function(){
 state=initialState();state.rngState=92919;state.initialSeed=92919;
 const made=prepareOpeningRosters();
 const rng=state.rngState;
 const second=prepareOpeningRosters();
 const rngAgain=state.rngState;
 startRegularSeason();
 return {before:0,after:state.totalGames,rosters:state.teams.map(t=>t.roster.map(p=>({id:p.id,bonus:p.bonus,year:p.year}))),
  rng:state.rngState,notes:state.regularSeason.events,next:state.regularSeason.nextGame,
  nextPlayer:state.nextPlayerId,firstCount:made.length,secondCount:second.length,identicalRng:rng===rngAgain};
})()`);
assert.deepEqual(openingPreview.rosters,openingBaseline.rosters,'preview does not alter opening players or RNG draw order');
assert.deepEqual(openingPreview.notes,openingBaseline.notes);
assert.equal(openingPreview.rng,openingBaseline.rng);
assert.equal(openingPreview.nextPlayer,openingBaseline.nextPlayer);
assert.equal(openingPreview.next,0);
assert.equal(openingBaseline.after,0);
assert.equal(openingPreview.after,0);
assert.ok(openingPreview.firstCount>0);
assert.equal(openingPreview.secondCount,0);
assert.equal(openingPreview.identicalRng,true);
console.log('PASS: first-season preview prepares exactly one opening roster without rerolling or simulating any games');

sandbox.preseasonSavedPlayers=0;
evaluate(`commitProgress=async function(games,players){
 preseasonSavedPlayers+=players.length;return true;
};`);
evaluate("state=initialState();state.rngState=888;view='dashboard';busy=false");
await evaluate("runRegularSeason('1')");
assert.equal(evaluate('view'),'preview');
assert.equal(evaluate('state.regularSeason'),null,'manual game sim must stop at mandatory preview');
assert.equal(evaluate('state.totalGames'),0);
assert.equal((nodes.app.innerHTML.match(/class="preseason-team-card/g)||[]).length,16);
assert.match(nodes.app.innerHTML,/Final Team Preview/);
assert.ok(sandbox.preseasonSavedPlayers>0,'first-year players are saved before the user begins');
const savedCount=sandbox.preseasonSavedPlayers;
await evaluate("preseasonPreviewView()");
assert.equal(sandbox.preseasonSavedPlayers,savedCount,'refreshing the preview does not regenerate players');
await evaluate("startSeasonFromPreview()");
assert.equal(evaluate('view'),'standings');
assert.equal(evaluate('state.regularSeason.nextGame'),0);
assert.equal(evaluate('state.totalGames'),0);
assert.equal(evaluate('state.previewConfirmedForSeason'),1);
assert.equal(evaluate('preseasonPreviewAvailable()'),false);
assert.match(nodes.app.innerHTML,/Sim 1 Game \/ Team/);
evaluate(`state=initialState();state.season=1;state.generation={year:2,phase:'results'};view='generation';busy=false;
 commitState=async function(){return true};`);
await evaluate("performGenerationAction('finish')");
assert.equal(evaluate('view'),'preview','generation ceremony ends at the team preview');
assert.equal(evaluate('state.generatedForSeason'),2);
assert.equal(evaluate('state.regularSeason'),null);
assert.equal(evaluate('state.totalGames'),0);
console.log('PASS: manual games require preview, persisted opening roster, start without games, and post-generation preview');

console.log('All V1.9.7 smoke tests passed.');
