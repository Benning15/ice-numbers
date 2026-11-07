'use strict';
function roundRobin(ids){let arr=ids.slice(),n=arr.length,rounds=[];for(let r=0;r<n-1;r++){let pairs=[];for(let i=0;i<n/2;i++)pairs.push([arr[i],arr[n-1-i]]);rounds.push(pairs);arr=[arr[0],arr[n-1],...arr.slice(1,n-1)]}return rounds}
function standingsSort(a,b){return b.points-a.points||b.w-a.w||b.diff-a.diff||a.tieBreaker-b.tieBreaker}
function snapshotRow(team,seasonStats,seed){return {id:team.id,name:team.name,seed,played:seasonStats.games,w:seasonStats.w,l:seasonStats.l,otl:seasonStats.otl,points:seasonStats.points,coinW:seasonStats.coinW,coinL:seasonStats.coinL,gf:seasonStats.gf,ga:seasonStats.ga,diff:seasonStats.diff,bonus:seasonStats.bonus,tieBreaker:seasonStats.tieBreaker}}
function makeMatch(a,b,bonusA,bonusB){return {aId:a,bId:b,bonusA,bonusB,winsA:0,winsB:0,winnerId:null,gameIds:[]}}
function firstRound(season){const rows=season.standings,pairs=[[1,8],[4,5],[2,7],[3,6]];return pairs.map(([a,b])=>makeMatch(rows[a-1].id,rows[b-1].id,0,0))}
function nextRound(season){
 const round=season.rounds.length,prev=season.rounds[round-1];
 if(round===1)return [[prev[0].winnerId,prev[1].winnerId],[prev[2].winnerId,prev[3].winnerId]]
  .map(([a,b])=>makeMatch(a,b,0,0));
 if(round===2)return [makeMatch(prev[0].winnerId,prev[1].winnerId,0,0)];
 throw Error('Unknown playoff round');
}
// Start an actual resumable regular season. No games are played until requested.
function startRegularSeason(){
 if(state.activeSeason||state.regularSeason)throw Error('Finish the current season before starting another.');
 if(state.draft)throw Error('Complete the offseason draft before starting a regular season.');
 if(state.generation)throw Error('Complete offseason player generation before starting a regular season.');
 if(state.season>0&&state.generatedForSeason!==state.season+1)throw Error('Complete player generation before starting a new season.');
 state.seasonComplete=false;
 const s=clone(state.settings),year=state.season+1,gs=[],changed=new Map(),events=(state.upcomingDraftNotes||[]).slice(),rosterStart={};
 state.upcomingDraftNotes=[];
 // Reset display-only current-season scoring counters.
 for(const t of state.teams){t.scoringGF=0;t.scoringGP=0;}
 // Opening rosters have a 0–3 player distribution averaging exactly two.
 // This runs once at the first Season 1 simulation, not when the empty state
 // is created, so the initial teams/settings are still editable beforehand.
 const openingRosters=year===1&&state.openingRostersPending===true&&
   state.teams.every(t=>t.roster.length===0);
 state.openingRostersPending=false;
 if(openingRosters){
  for(const t of state.teams){
   const target=Math.min(s.maxRoster,weighted([10,15,40,35])-1);
   for(let i=0;i<target;i++){
    const p=makeNewPlayer(t.id,'spawn',year);
    t.roster.push(p);
    changed.set(p.id,p);
    events.push(`${t.name} started with ${p.name} (+${p.bonus}, Year ${p.year})`);
   }
  }
 }
 // Offseason generation is completed before this season starts. Never
 // generate a second set of players when the regular season begins.
 for(const t of state.teams){for(const p of t.roster){if(rollPlayerMotivation(p,year))changed.set(p.id,p);if(ensureScoringTendency(p))changed.set(p.id,p);if('goalTarget' in p||'goalTargetSeason' in p){delete p.goalTarget;delete p.goalTargetSeason;changed.set(p.id,p)}}rosterStart[t.id]=t.roster.map(p=>({id:p.id,name:p.name,bonus:p.bonus,year:p.year,origin:p.origin,ratingTier:p.bonus===8&&effectiveRating(p)===10?'gold':p.bonus===8&&effectiveRating(p)===9?'silver':null}))}
 // Capture strength and initial player scoring once per season, after generation and Motivation.
 trackTeamStrength();
 state.seasonGoalStart=Object.fromEntries(state.teams.flatMap(t=>t.roster.map(p=>[p.id,p.regGoals||0])));
 const before=state.teams.map(t=>({w:t.regW,l:t.regL,otl:t.regOTL||0,points:t.regPoints,coinW:t.regCoinW,coinL:t.regCoinL,gf:t.pointsFor,ga:t.pointsAgainst}));
 const rr=roundRobin(state.teams.map(t=>t.id)),legs=s.gamesPerTeam/15,schedule=[];
 for(let leg=0;leg<legs;leg++)for(const round of rr)for(let i=0;i<round.length;i++){
  const [x,y]=round[i];schedule.push({aId:leg%2?y:x,bId:leg%2?x:y});
 }
 const tieBreakers=state.teams.map(()=>random());
 state.regularSeason={season:year,settings:s,schedule,nextGame:0,events,rosters:rosterStart,before,tieBreakers,
  standings:[],phase:'regular',gameCount:0,coinCount:0,lastGames:[]};
 updateLiveStandings();
 return {games:[],players:[...changed.values()]};
}
function updateLiveStandings(){
 const r=state.regularSeason;if(!r)return;
 const oldRanks=new Map((r.standings||[]).map(row=>[row.id,row.seed]));
 const rows=state.teams.map((t,i)=>{
  const old=r.before[i],w=t.regW-old.w,l=t.regL-old.l,otl=(t.regOTL||0)-old.otl;
  const gf=t.pointsFor-old.gf,ga=t.pointsAgainst-old.ga;
  return snapshotRow(t,{w,l,otl,points:t.regPoints-old.points,coinW:t.regCoinW-old.coinW,coinL:t.regCoinL-old.coinL,
   gf,ga,diff:gf-ga,games:w+l+otl,bonus:bonusOf(t),tieBreaker:r.tieBreakers[i]},0);
 }).sort(standingsSort);
 rows.forEach((row,i)=>{row.seed=i+1;row.move=(oldRanks.get(row.id)??row.seed)-row.seed});
 r.standings=rows;
}
function playRegularGames(count){
 const r=state.regularSeason;
 if(!r)throw Error('No regular season in progress.');
 const limit=count===Infinity?r.schedule.length:Math.max(0,Math.floor(count));
 if(!Number.isFinite(limit)&&count!==Infinity)throw Error('Invalid number of games.');
 const games=[],changed=new Map();
 while(games.length<limit&&r.nextGame<r.schedule.length){
  const {aId,bId}=r.schedule[r.nextGame],a=state.teams[aId],b=state.teams[bId];
  playGame(a,b,bonusOf(a),bonusOf(b),r.season,'regular',0,0,r.nextGame+1,games,changed);
  r.nextGame++;
 }
 r.gameCount+=games.length;
 r.coinCount+=games.filter(g=>g.coin).length;
 r.lastGames=games.slice(-10).map(g=>({aId:g.aId,bId:g.bId,scoreA:g.scoreA,scoreB:g.scoreB,coin:g.coin}));
 updateLiveStandings();
 const completed=r.nextGame===r.schedule.length;
 if(completed){
  const active={season:r.season,settings:r.settings,standings:r.standings,events:r.events,rosters:r.rosters,
   seedById:Object.fromEntries(r.standings.map(row=>[row.id,row.seed])),lastId:r.standings.at(-1).id,
   rounds:[],round:0,phase:'playoffs',gameCount:r.gameCount,coinCount:r.coinCount};
  active.rounds=[firstRound(active)];
  state.activeSeason=active;
  state.regularSeason=null;
  state.pendingDraftTeam=null;
 }
 return {games,players:[...changed.values()],completed};
}
// Preserve beginSeason for full-season simulations and existing save/test workflows.
function beginSeason(){
 const started=startRegularSeason();
 const played=playRegularGames(Infinity);
 const changed=new Map([...started.players,...played.players].map(p=>[p.id,p]));
 return {games:played.games,players:[...changed.values()]};
}
function playNextGames(){
 const active=state.activeSeason;if(!active)throw Error('No playoffs in progress');
 const round=active.round,series=active.rounds[round],games=[],changed=new Map();
 for(let i=0;i<series.length;i++){
  const m=series[i];if(m.winnerId!==null)continue;
  let g=playGame(state.teams[m.aId],state.teams[m.bId],m.bonusA,m.bonusB,active.season,'playoff',round+1,i+1,m.gameIds.length+1,games,changed);
  m.gameIds.push(g.id);if(g.winnerId===m.aId)m.winsA++;else m.winsB++;
  if(m.winsA===4||m.winsB===4){m.winnerId=m.winsA===4?m.aId:m.bId;state.teams[m.winnerId].playoffSeriesW++;state.teams[m.winnerId===m.aId?m.bId:m.aId].playoffSeriesL++}
 }
 active.gameCount+=games.length;active.coinCount+=games.filter(g=>g.coin).length;
 const roundFinished=series.every(m=>m.winnerId!==null);
 if(roundFinished&&round<2){active.round++;active.rounds.push(nextRound(active))}
 return {games,players:[...changed.values()],completed:roundFinished&&round===2};
}
function finishSeason(){
 const active=state.activeSeason;if(!active||active.rounds.length!==3||active.rounds[2][0].winnerId===null)throw Error('Playoffs have not finished');
 const year=active.season,s=active.settings,last=active.lastId,final=active.rounds[2][0],champion=final.winnerId,runnerUp=final.aId===champion?final.bId:final.aId,qualified=new Set(active.standings.slice(0,8).map(r=>r.id)),changed=new Map();
 for(const t of state.teams){const isChamp=t.id===champion,qualifies=qualified.has(t.id);
  if(qualifies){t.playoffApps++;t.currentPlayoffStreak++;t.currentMissStreak=0;t.bestPlayoffStreak=Math.max(t.bestPlayoffStreak,t.currentPlayoffStreak)}
  else{t.missedPlayoffs++;t.currentMissStreak++;t.currentPlayoffStreak=0;t.bestMissStreak=Math.max(t.bestMissStreak,t.currentMissStreak)}
  if(t.id===runnerUp||isChamp)t.finals++;
  if(isChamp){t.titles++;t.currentTitleStreak++;t.bestTitleStreak=Math.max(t.bestTitleStreak,t.currentTitleStreak);t.titleDrought=0;if(!t.firstSeasonTitle)t.firstSeasonTitle=year}
  else{t.currentTitleStreak=0;t.titleDrought++;t.longestTitleDrought=Math.max(t.longestTitleDrought,t.titleDrought)}
  if(t.id===last){t.lastPlaces++;t.currentFirstStreak++;t.bestFirstStreak=Math.max(t.bestFirstStreak,t.currentFirstStreak)}else t.currentFirstStreak=0;
  for(const p of t.roster){ensurePlayer(p);p.seasons++;if(isChamp)p.titles++;p.history.push({season:year,year:p.year,team:t.id,bonus:p.bonus,ratingTier:p.bonus===8&&effectiveRating(p)===10?'gold':p.bonus===8&&effectiveRating(p)===9?'silver':null,champion:isChamp});if(p.year>=s.careerLength){p.retireSeason=year;active.events.push(`${t.name}: ${p.name} retired (+${p.bonus})`)}else p.year++;changed.set(p.id,p)}
  t.roster=t.roster.filter(p=>!p.retireSeason);
 }
 const stats=testingData();
 trackTeamOutcomes(active.standings,champion);
 for(const p of changed.values()){
  const goals=(p.regGoals||0)-(state.seasonGoalStart?.[p.id]||0);
  if(goals>=40)stats.goalSeasons.forty++;
  if(goals>=50)stats.goalSeasons.fifty++;
  if(goals>=60)stats.goalSeasons.sixty++;
  if(goals>=70)stats.goalSeasons.seventy++;
 }
 delete state.seasonGoalStart;
 stats.seasons++;
 if(stats.seasons===100||stats.seasons===1000)stats.checkpoints[stats.seasons]=testingSnapshot();
 state.season=year;state.activeSeason=null;state.seasonComplete=true;
 state.draft={season:year,phase:'lottery',eligible:active.standings.slice(8).map(r=>r.id),lottery:null,lotteryRevealed:0,
  originalTeamPlus:Object.fromEntries(active.standings.slice(8).map(r=>[r.id,bonusOf(state.teams[r.id])])),prospects:null,picks:[]};
 return {result:{season:year,settings:clone(s),standings:active.standings,rounds:active.rounds,championId:champion,runnerUpId:runnerUp,lastId:last,rosters:active.rosters,events:active.events,gameCount:active.gameCount,coinCount:active.coinCount},players:[...changed.values()]}
}
function simulateSeason(){let all=[],changes=new Map();
 if(state.draft)for(const p of completeDraftAutomatically())changes.set(p.id,p);
 if(!state.activeSeason&&state.season>0&&!state.generation&&state.generatedForSeason!==state.season+1)startGenerationStage();
 if(state.generation)for(const p of completeGenerationAutomatically())changes.set(p.id,p);
 if(!state.activeSeason){
  if(!state.regularSeason){const started=startRegularSeason();for(const p of started.players)changes.set(p.id,p)}
  const played=playRegularGames(Infinity);all.push(...played.games);for(const p of played.players)changes.set(p.id,p);
 }
 while(state.activeSeason){const a=playNextGames();all.push(...a.games);for(let p of a.players)changes.set(p.id,p);if(a.completed){const done=finishSeason();for(let p of done.players)changes.set(p.id,p);
  for(const p of completeDraftAutomatically())changes.set(p.id,p);
  for(const p of completeGenerationAutomatically())changes.set(p.id,p);
  return {result:done.result,games:all,players:[...changes.values()]}}}
 throw Error('Season simulation interrupted');
}
