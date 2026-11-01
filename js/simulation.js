'use strict';
function roundRobin(ids){let arr=ids.slice(),n=arr.length,rounds=[];for(let r=0;r<n-1;r++){let pairs=[];for(let i=0;i<n/2;i++)pairs.push([arr[i],arr[n-1-i]]);rounds.push(pairs);arr=[arr[0],arr[n-1],...arr.slice(1,n-1)]}return rounds}
function standingsSort(a,b){return b.points-a.points||b.w-a.w||b.diff-a.diff||a.tieBreaker-b.tieBreaker}
function snapshotRow(team,seasonStats,seed){return {id:team.id,name:team.name,seed,played:seasonStats.games,w:seasonStats.w,l:seasonStats.l,otl:seasonStats.otl,points:seasonStats.points,coinW:seasonStats.coinW,coinL:seasonStats.coinL,gf:seasonStats.gf,ga:seasonStats.ga,diff:seasonStats.diff,bonus:seasonStats.bonus,tieBreaker:seasonStats.tieBreaker}}
function makeMatch(a,b,bonusA,bonusB){return {aId:a,bId:b,bonusA,bonusB,winsA:0,winsB:0,winnerId:null,gameIds:[]}}
function firstRound(season){const s=season.settings,rows=season.standings,pairs=[[1,8],[4,5],[2,7],[3,6]];return pairs.map(([a,b])=>makeMatch(rows[a-1].id,rows[b-1].id,s.firstRoundBonuses[a-1],0))}
function nextRound(season){
 const round=season.rounds.length,prev=season.rounds[round-1];if(round===1){
  const pairs=[[prev[0].winnerId,prev[1].winnerId],[prev[2].winnerId,prev[3].winnerId]],seed=id=>season.seedById[id],best=Math.min(...pairs.flat().map(seed));
  return pairs.map(([a,b])=>{let higher=seed(a)<seed(b)?a:b,adv=(seed(a)===best||seed(b)===best)?season.settings.semifinalBonuses[0]:season.settings.semifinalBonuses[1];return makeMatch(a,b,a===higher?adv:0,b===higher?adv:0)})
 }
 if(round===2){const [a,b]=prev.map(x=>x.winnerId),higher=season.seedById[a]<season.seedById[b]?a:b;return [makeMatch(a,b,a===higher?season.settings.finalBonus:0,b===higher?season.settings.finalBonus:0)]}
 throw Error('Unknown playoff round');
}
function beginSeason(){
 if(state.activeSeason)throw Error('Finish the current playoffs before starting another regular season.');
 state.seasonComplete=false;
 const s=clone(state.settings),year=state.season+1,gs=[],changed=new Map(),events=[],rosterStart={};
 // Last-place team drafts first, then may also spawn if its roster is not full.
 if(state.pendingDraftTeam!==null){let t=state.teams[state.pendingDraftTeam],pick=makeNewPlayer(t.id,'draft',year);if(t.roster.length>=s.maxRoster){let worst=t.roster.reduce((a,b)=>a.bonus<=b.bonus?a:b);t.roster=t.roster.filter(p=>p.id!==worst.id);worst.retireSeason=year-1;changed.set(worst.id,worst);events.push(`${t.name} released ${worst.name} (+${worst.bonus}) for a draft pick`)}t.roster.push(pick);changed.set(pick.id,pick);events.push(`${t.name} drafted ${pick.name} (+${pick.bonus}, Year 1)`)}
 for(const t of state.teams){if(t.roster.length<s.maxRoster){let p=makeNewPlayer(t.id,'spawn',year);t.roster.push(p);changed.set(p.id,p);events.push(`${t.name} spawned ${p.name} (+${p.bonus}, Year ${p.year})`)}for(const p of t.roster)if(rollPlayerMotivation(p,year))changed.set(p.id,p);rosterStart[t.id]=t.roster.map(p=>({id:p.id,name:p.name,bonus:p.bonus,year:p.year,origin:p.origin}))}
 const before=state.teams.map(t=>({w:t.regW,l:t.regL,otl:t.regOTL||0,points:t.regPoints,coinW:t.regCoinW,coinL:t.regCoinL,gf:t.pointsFor,ga:t.pointsAgainst}));
 const bonus=state.teams.map(bonusOf),rr=roundRobin(state.teams.map(t=>t.id)),legs=s.gamesPerTeam/15;
 for(let leg=0;leg<legs;leg++)for(const round of rr)for(let i=0;i<round.length;i++){
  const [x,y]=round[i],a=state.teams[leg%2?y:x],b=state.teams[leg%2?x:y];
  playGame(a,b,bonus[a.id],bonus[b.id],year,'regular',0,0,leg*rr.length+i+1,gs,changed)
 }
 const rows=state.teams.map((t,i)=>{let pre=before[i],now={w:t.regW-pre.w,l:t.regL-pre.l,otl:(t.regOTL||0)-pre.otl,points:t.regPoints-pre.points,coinW:t.regCoinW-pre.coinW,coinL:t.regCoinL-pre.coinL,gf:t.pointsFor-pre.gf,ga:t.pointsAgainst-pre.ga,diff:(t.pointsFor-pre.gf)-(t.pointsAgainst-pre.ga),games:s.gamesPerTeam,bonus:bonus[i],tieBreaker:random()};return snapshotRow(t,now,0)}).sort(standingsSort);
 rows.forEach((r,i)=>r.seed=i+1);
 const active={season:year,settings:s,standings:rows,events,rosters:rosterStart,seedById:Object.fromEntries(rows.map(r=>[r.id,r.seed])),lastId:rows.at(-1).id,rounds:[],round:0,phase:'playoffs',gameCount:gs.length,coinCount:gs.filter(g=>g.coin).length};
 active.rounds=[firstRound(active)];state.activeSeason=active;
 state.pendingDraftTeam=active.lastId;
 return {games:gs,players:[...changed.values()]};
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
  for(const p of t.roster){ensurePlayer(p);p.seasons++;if(isChamp)p.titles++;p.history.push({season:year,year:p.year,team:t.id,bonus:p.bonus,champion:isChamp});if(p.year>=s.careerLength){p.retireSeason=year;active.events.push(`${t.name}: ${p.name} retired (+${p.bonus})`)}else p.year++;changed.set(p.id,p)}
  t.roster=t.roster.filter(p=>!p.retireSeason);
 }
 state.season=year;state.activeSeason=null;state.seasonComplete=true;
 return {result:{season:year,settings:clone(s),standings:active.standings,rounds:active.rounds,championId:champion,runnerUpId:runnerUp,lastId:last,rosters:active.rosters,events:active.events,gameCount:active.gameCount,coinCount:active.coinCount},players:[...changed.values()]}
}
function simulateSeason(){let all=[],changes=new Map();if(!state.activeSeason){let a=beginSeason();all.push(...a.games);for(let p of a.players)changes.set(p.id,p)}
 while(state.activeSeason){const a=playNextGames();all.push(...a.games);for(let p of a.players)changes.set(p.id,p);if(a.completed){const done=finishSeason();for(let p of done.players)changes.set(p.id,p);return {result:done.result,games:all,players:[...changes.values()]}}}
 throw Error('Season simulation interrupted');
}
