'use strict';
function commitProgress(games,players){return new Promise((resolve,reject)=>{let tx=db.transaction(['meta','games','players'],'readwrite');tx.objectStore('meta').put({key:'main',value:clone(state)});for(const g of games)tx.objectStore('games').put(g);for(const p of players)tx.objectStore('players').put(p);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
// Regular-season schedule is arranged as eight non-overlapping matchups per round.
// Each "game per team" means one complete round (one appearance for every team).
// A V1.8 partial save may be mid-round; finish that round before counting more.
function regularBatchGameCount(gamesPerTeam){
 const r=state.regularSeason;
 if(!r)throw Error('No regular season in progress.');
 if(!Number.isInteger(gamesPerTeam)||gamesPerTeam<1)throw Error('Invalid batch size.');
 const perRound=state.teams.length/2;
 const intoRound=r.nextGame%perRound;
 return Math.min(r.schedule.length-r.nextGame,gamesPerTeam*perRound-intoRound);
}
async function runRegularSeason(mode='all'){
 if(busy||state.activeSeason)return;
 if(state.draft){view='draft';await render();return}
 if(state.generation){view='generation';await render();return}
 if(!['1','10','all'].includes(String(mode)))return;
 busy=true;
 const previous=clone(state);
 try{
  const updated=new Map(),games=[];
  if(!state.regularSeason){
   const started=startRegularSeason();
   for(const p of started.players)updated.set(p.id,p);
  }
  const count=mode==='all'?Infinity:regularBatchGameCount(Number(mode)),played=playRegularGames(count);
  games.push(...played.games);
  for(const p of played.players)updated.set(p.id,p);
  try{await commitProgress(games,[...updated.values()])}catch(e){state=previous;throw e}
  view='standings';
  setBanner(played.completed?
   'Regular season finished. Final standings and scoring are saved. The playoffs are ready.':
   'Simulated '+games.length+' league game'+(games.length===1?'':'s')+' (up to '+mode+' game'+(mode==='1'?'':'s')+' per team). Standings and player scoring updated.');
 }catch(e){console.error(e);state=previous;setBanner('Regular season simulation failed: '+e.message,true)}
 finally{busy=false;await render()}
}
async function advancePlayoffs(mode){if(busy||!state.activeSeason)return;busy=true;try{
  let initialRound=state.activeSeason.round,steps=0,allGames=[],changes=new Map(),completed=false;
  do{const prev=clone(state),sim=playNextGames();for(const g of sim.games)allGames.push(g);for(const p of sim.players)changes.set(p.id,p);steps++;
    if(mode==='next'){if(sim.completed){let done=finishSeason();for(const p of done.players)changes.set(p.id,p);await commitSeason(done.result,allGames,[...changes.values()]);completed=true}else await commitProgress(allGames,[...changes.values()]);break}
    if(sim.completed){let done=finishSeason();for(const p of done.players)changes.set(p.id,p);await commitSeason(done.result,allGames,[...changes.values()]);completed=true;break}
    if(mode==='round'&&state.activeSeason.round!==initialRound){await commitProgress(allGames,[...changes.values()]);break}
  }while(steps<35);
  if(!completed&&mode!=='next'&&state.activeSeason?.round===initialRound&&steps>=35)await commitProgress(allGames,[...changes.values()]);
  setBanner(completed?`Season ${state.season} completed and archived!`: `Simulated ${steps} playoff game${steps===1?'':' days'}; progress saved.`);
 }catch(e){console.error(e);setBanner('Playoff simulation stopped: '+e.message,true)}finally{busy=false;await render()}}

