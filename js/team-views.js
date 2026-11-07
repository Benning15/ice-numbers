// Team records, game results, scoring history, and all-time franchise leaders.
// Team-specific season selector; games are already loaded for the head-to-head records.
let teamGamesYear=null,teamGamesTeam=null,teamGamesCache=null;
function teamGameOutcome(g,teamId){
 const won=g.winnerId===teamId;
 return won?(g.coin?'W (OT)':'W'):(g.coin?(g.stage==='regular'?'OTL':'L (OT)'):'L');
}
function teamSeasonGameRows(teamId,year,games){
 const selected=games.filter(g=>g.season===year&&(g.stage==='regular'||g.stage==='playoff'));
 const regular=selected.filter(g=>g.stage==='regular').sort((a,b)=>a.gameNo-b.gameNo);
 const playoffs=selected.filter(g=>g.stage==='playoff').sort((a,b)=>a.round-b.round||a.seriesNo-b.seriesNo||a.gameNo-b.gameNo);
 return [...regular,...playoffs].map((g,i)=>{
  const ownIsA=g.aId===teamId,opponent=ownIsA?g.bId:g.aId;
  const own=ownIsA?g.scoreA:g.scoreB,against=ownIsA?g.scoreB:g.scoreA;
  const result=teamGameOutcome(g,teamId);
  const stage=g.stage==='regular'?'Regular Season':(['Quarterfinals','Semifinals','Finals'][g.round-1]||'Playoffs');
  const number=g.stage==='regular'?regular.indexOf(g)+1:'Game '+g.gameNo;
  const details=Array.isArray(g.goalEvents)?
   (g.goalEvents.length?g.goalEvents.map(p=>'<p class="record">'+esc(state.teams[p.teamId]?.name||'Team')+': '+scoringPlayerLinks(p)+(p.otGoal?' <b>(OT)</b>':'')+'</p>').join(''):
    '<p class="sub tiny">No goals recorded.</p>'):
   '<p class="sub tiny">Individual scoring details are unavailable for this archived game.</p>';
  return '<tr><td>'+number+'</td><td>'+stage+'</td><td>'+teamLink(opponent)+'</td>'+
   '<td><b>'+own+'–'+against+'</b></td>'+
   '<td><span class="team-game-result '+(g.winnerId===teamId?'won':'lost')+'">'+result+'</span></td>'+
   '<td><details><summary>Goals / Assists</summary><div class="team-game-scoring">'+details+'</div></details></td></tr>';
 });
}
function renderTeamGameResults(){
 const id=selectedTeam,el=$('team-games');
 if(!el||!teamGamesCache||teamGamesCache.id!==id)return;
 const {years,games}=teamGamesCache;
 const year=years.includes(teamGamesYear)?teamGamesYear:years[0];
 if(year==null){el.innerHTML='<p class="empty">Simulate a season to see its game-by-game scores.</p>';return}
 teamGamesYear=year;
 const rows=teamSeasonGameRows(id,year,games);
 const active=state.regularSeason||state.activeSeason;
 const inProgress=active?.season===year;
 const reg=games.filter(g=>g.season===year&&g.stage==='regular').length;
 const po=games.filter(g=>g.season===year&&g.stage==='playoff').length;
 const options=years.map(n=>'<option value="'+n+'" '+(n===year?'selected':'')+'>Season '+n+(active?.season===n?' · Live':'')+'</option>').join('');
 el.innerHTML='<div class="team-game-picker"><label for="team-game-season" class="sub tiny">Select season</label>'+
  '<select id="team-game-season" class="select">'+options+'</select></div>'+
  '<p class="sub tiny">Season '+year+(inProgress?' · In progress':'')+' · '+reg+' regular-season game'+(reg===1?'':'s')+
  (po?' · '+po+' playoff game'+(po===1?'':'s'):'')+'</p>'+
  (rows.length?table(['#','Stage','Opponent','Score','Result','Scoring'],rows):'<p class="empty">No games played yet in this season.</p>');
}
// Season rosters come from the saved opening lineups, not today's team roster.
// Goal/assist totals are rebuilt from that season's actual archived game events.
function teamSeasonPlayerRows(teamId,season,games,stage){
 const roster=season?.rosters?.[teamId]||[];
 const players=calculateSeasonScoring({[teamId]:roster},games.filter(g=>g.season===season.season),stage);
 return players.map((p,i)=>'<tr><td>'+(i+1)+'</td><td>'+playerLink(p)+'</td><td>+'+fmt(p.bonus)+'</td>'+
  '<td>'+p.gp+'</td><td>'+(p.incomplete?'—':p.g)+'</td><td>'+(p.incomplete?'—':p.a)+'</td>'+
  '<td><b>'+(p.incomplete?'—':p.points)+'</b></td>'+
  '<td>'+(p.incomplete?'—':p.gp?(p.points/p.gp).toFixed(2):'0.00')+'</td></tr>');
}
function renderTeamSeasonPlayerStats(){
 const id=selectedTeam,el=$('team-player-stats');
 if(!el||!teamGamesCache||teamGamesCache.id!==id)return;
 const {years,games,seasons=[]}=teamGamesCache;
 const year=years.includes(teamGamesYear)?teamGamesYear:years[0];
 if(year==null){el.innerHTML='<p class="empty">Start a season to see individual player statistics.</p>';return}
 teamGamesYear=year;
 const season=seasons.find(s=>s.season===year);
 const active=state.regularSeason||state.activeSeason;
 const options=years.map(n=>'<option value="'+n+'" '+(n===year?'selected':'')+'>Season '+n+(active?.season===n?' · Live':'')+'</option>').join('');
 const picker='<div class="team-game-picker"><label for="team-player-season" class="sub tiny">Select season</label>'+
  '<select id="team-player-season" class="select">'+options+'</select></div>';
 if(!season||!season.rosters?.[id]){
  el.innerHTML=picker+'<p class="empty">Player roster information is unavailable for Season '+year+'.</p>';
  return;
 }
 const roster=season.rosters[id],selectedGames=games.filter(g=>g.season===year);
 if(!roster.length){
  el.innerHTML=picker+'<p class="empty">This team had no named players in Season '+year+'. Unidentified skater goals are not attributed to individual players.</p>';
  return;
 }
 const columns=['#','Player','Base +','GP','G','A','PTS','P/GP'];
 const section=(stage,label)=>{
  const played=selectedGames.filter(g=>g.stage===stage).length;
  const rows=teamSeasonPlayerRows(id,season,selectedGames,stage);
  const missing=rows.some(row=>row.includes('<td>—</td>'));
  return '<div class="team-player-stage"><h3>'+label+'</h3>'+
   '<p class="sub tiny">'+played+' team game'+(played===1?'':'s')+' played'+(active?.season===year?' · Live':'')+'</p>'+
   (played?table(columns,rows):'<p class="empty">No '+label.toLowerCase()+' games played.</p>')+
   (missing?'<p class="sub tiny">Some older games do not contain scorer/assist details. Their missing totals appear as —.</p>':'')+
   '</div>';
 };
 el.innerHTML=picker+'<p class="sub tiny">Named players on '+esc(state.teams[id].name)+' in Season '+year+
  '. Goals, assists and points are for this season only, not career totals.</p>'+
  section('regular','Regular Season')+section('playoff','Playoffs');
}
// Aggregate named-player scoring earned for one franchise, using each year's
// actual season roster. Player ID is the key so trades never transfer a player's
// totals from another team, and retired / cut players remain on the leaderboard.
let teamAllTimeMode='combined';
function franchiseAllTimeScorers(teamId,seasons,games){
 const byId=new Map(),rosters=new Map();
 for(const season of seasons){
  if(!Number.isInteger(season.season))continue;
  const roster=season.rosters?.[teamId];
  if(!Array.isArray(roster))continue;
  const ids=new Set();
  for(const p of roster){
   if(!Number.isInteger(p.id)||ids.has(p.id))continue;
   ids.add(p.id);
   if(!byId.has(p.id))byId.set(p.id,{id:p.id,name:p.name||'Player '+p.id,seasons:0,
    regular:{gp:0,g:0,a:0,incomplete:false},playoff:{gp:0,g:0,a:0,incomplete:false}});
   const player=byId.get(p.id);player.name=p.name||player.name;player.seasons++;
  }
  rosters.set(season.season,ids);
 }
 for(const game of games){
  if(game.aId!==teamId&&game.bId!==teamId)continue;
  if(game.stage!=='regular'&&game.stage!=='playoff')continue;
  const ids=rosters.get(game.season);
  if(!ids)continue;
  for(const id of ids)byId.get(id)[game.stage].gp++;
  if(!Array.isArray(game.goalEvents)){
   for(const id of ids)byId.get(id)[game.stage].incomplete=true;
   continue;
  }
  for(const goal of game.goalEvents){
   // Scoring can only be credited to the team for which it happened.
   // Where old archives omitted teamId, a matching roster player ID is
   // the fallback; do not import points earned for other franchises.
   if(goal.teamId!=null&&goal.teamId!==teamId)continue;
   if(ids.has(goal.scorerId))byId.get(goal.scorerId)[game.stage].g++;
   for(const assistId of goal.assistIds||[])if(ids.has(assistId))byId.get(assistId)[game.stage].a++;
  }
 }
 return [...byId.values()];
}
function franchiseAllTimeStage(player,mode){
 const r=player.regular,p=player.playoff;
 const gp=mode==='combined'?r.gp+p.gp:player[mode].gp;
 const g=mode==='combined'?r.g+p.g:player[mode].g;
 const a=mode==='combined'?r.a+p.a:player[mode].a;
 const incomplete=mode==='combined'?r.incomplete||p.incomplete:player[mode].incomplete;
 return {gp,g,a,points:g+a,incomplete,ppg:gp?(g+a)/gp:0};
}
function renderTeamAllTimeScorers(){
 const el=$('team-alltime');
 if(!el||!teamGamesCache||teamGamesCache.id!==selectedTeam)return;
 const {games,seasons=[]}=teamGamesCache;
 if(!teamGamesCache.franchiseScorers)teamGamesCache.franchiseScorers=franchiseAllTimeScorers(selectedTeam,seasons,games);
 const players=teamGamesCache.franchiseScorers;
 const mode=['combined','regular','playoff'].includes(teamAllTimeMode)?teamAllTimeMode:'combined';
 const ranked=players.map(p=>({...p,stats:franchiseAllTimeStage(p,mode)}))
  .sort((a,b)=>Number(a.stats.incomplete)-Number(b.stats.incomplete)||
   b.stats.points-a.stats.points||b.stats.g-a.stats.g||b.stats.ppg-a.stats.ppg||a.name.localeCompare(b.name)||a.id-b.id);
 const modes=[['combined','Regular + Playoffs'],['regular','Regular Season'],['playoff','Playoffs']];
 const select='<div class="team-game-picker"><label for="team-alltime-mode" class="sub tiny">Scoring</label>'+
  '<select id="team-alltime-mode" class="select">'+modes.map(([val,label])=>
   '<option value="'+val+'" '+(mode===val?'selected':'')+'>'+label+'</option>').join('')+'</select></div>';
 const rows=ranked.map((p,i)=>{
  const st=p.stats,missing=st.incomplete;
  return '<tr><td>'+fmt(i+1)+'</td><td>'+playerLink(p)+'</td><td>'+fmt(p.seasons)+'</td>'+
   '<td>'+fmt(st.gp)+'</td><td>'+(missing?'—':fmt(st.g))+'</td><td>'+(missing?'—':fmt(st.a))+'</td>'+
   '<td><b>'+(missing?'—':fmt(st.points))+'</b></td>'+
   '<td>'+(missing?'—':st.ppg.toFixed(2))+'</td></tr>';
 });
 el.innerHTML=select+
  '<p class="sub tiny">'+fmt(players.length)+' named players in franchise history. Includes active, retired, cut, and traded players. Each point counts only for '+
  esc(state.teams[selectedTeam].name)+'.</p>'+
  (rows.length?'<div class="team-alltime-scroll">'+
   table(['#','Player','Seasons','GP','G','A','PTS','P/GP'],rows)+'</div>':
   '<p class="empty">No historical named players yet. Simulate a season to begin the scoring records.</p>')+
  (ranked.some(p=>p.stats.incomplete)?'<p class="sub tiny">Some older games do not have individual scoring details; those players appear at the bottom with unknown totals (—).</p>':'');
}
function teamDetail(){if(teamGamesTeam!==selectedTeam){teamGamesTeam=selectedTeam;teamGamesYear=null;teamGamesCache=null;}let t=state.teams[selectedTeam];titlebar(t.name,'Roster and franchise history — names and logos can be changed in Team Customization');$('app').innerHTML=`<div class="buttonrow" style="margin:0 0 15px"><select id="team-select" class="select">${state.teams.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="cards"><div class="stat"><span class="sub tiny">All-time W–L–OTL</span><div class="big">${fmt(t.regW)}–${fmt(t.regL)}–${fmt(t.regOTL||0)}</div></div><div class="stat"><span class="sub tiny">Championships</span><div class="big">${fmt(t.titles)}</div></div><div class="stat"><span class="sub tiny">Playoff appearances</span><div class="big">${fmt(t.playoffApps)}</div></div><div class="stat"><span class="sub tiny">Longest drought</span><div class="big">${fmt(t.longestTitleDrought)}</div></div></div><div class="split"><div class="panel"><h2>Active roster (${t.roster.length}/${state.settings.maxRoster})</h2>${t.roster.length?table(['Player','Rating','Year','Origin'],t.roster.map(p=>`<tr><td>${playerLink(p)}</td><td>+${p.bonus}</td><td>${p.year}/${state.settings.careerLength}</td><td>${p.origin}</td></tr>`)):'<p class="empty">No active players</p>'}<p class="sub tiny">Combined team rating: +${bonusOf(t)} (uncapped)</p></div><div class="panel"><h2>Franchise streaks</h2>${[['Current playoff streak',t.currentPlayoffStreak],['Longest playoff streak',t.bestPlayoffStreak],['Current missed-playoff streak',t.currentMissStreak],['Longest missed-playoff streak',t.bestMissStreak],['Longest championship streak',t.bestTitleStreak],['Current title drought',t.titleDrought],['Most consecutive last places',t.bestFirstStreak],['Longest regular-season win streak',t.bestRegWinStreak],['Longest regular-season loss streak',t.bestRegLossStreak]].map(([k,v])=>`<p class="record">${k}: <b class="mono">${fmt(v)}</b></p>`).join('')}</div></div><div class="panel"><details class="team-history-section" open><summary>Season-by-season franchise history</summary><div id="team-seasons" class="sub">Loading archive…</div></details></div><div class="panel"><details id="team-game-details" class="team-game-history"><summary>Game Results — By Season</summary><div id="team-games" class="sub">Loading game results…</div></details></div><div class="panel"><details id="team-player-details" class="team-player-history"><summary>Player Stats — By Season</summary><div id="team-player-stats" class="sub">Loading player stats…</div></details></div><div class="panel"><details id="team-alltime-details" class="team-alltime-history"><summary id="team-alltime-summary">All-Time Team Scoring Leaders</summary><div id="team-alltime" class="sub">Expand to view the franchise scoring leaders.</div></details></div><div class="panel"><h2>Head-to-head records (regular season)</h2><div id="team-h2h" class="sub">Loading individual game results…</div></div>`;loadTeamRecords(t.id)}
// The team page initially reads only archived season summaries. Loading every
// goal event from hundreds of seasons is deferred until a detailed panel opens.
function loadTeamGameArchive(){
 const cache=teamGamesCache,id=selectedTeam;
 if(!cache||cache.id!==id||view!=='teams')return Promise.resolve();
 if(Array.isArray(cache.games)){
  renderTeamGameResults();renderTeamSeasonPlayerStats();renderTeamAllTimeScorers();
  return Promise.resolve();
 }
 if(cache.loading)return cache.loading;
 cache.loading=getIndexAll('games','byTeam',id).then(games=>{
  if(teamGamesCache!==cache||view!=='teams'||selectedTeam!==id)return;
  cache.games=games;
  renderTeamGameResults();renderTeamSeasonPlayerStats();renderTeamAllTimeScorers();
 }).catch(err=>{
  if(teamGamesCache!==cache||view!=='teams'||selectedTeam!==id)return;
  console.error(err);
  for(const elId of ['team-games','team-player-stats','team-alltime']){
   const el=$(elId);if(el)el.textContent='Could not load archived games: '+err.message;
  }
 }).finally(()=>{cache.loading=null});
 return cache.loading;
}
async function loadTeamRecords(id){
 const seasons=await getAll('seasons');
 if(view!=='teams'||selectedTeam!==id)return;
 const records=seasons.map(s=>{
  const r=s.standings.find(x=>x.id===id);
  return {season:s.season,seed:r.seed,w:r.w,l:r.l,otl:r.otl||0,points:r.points,bonus:r.bonus,playoffs:r.seed<=8,champ:s.championId===id};
 }).reverse();
 $('team-seasons').innerHTML=records.length?
  '<p class="sub tiny" style="margin:10px 0 8px">'+fmt(records.length)+' archived season'+(records.length===1?'':'s')+
  (records.length>10?' · scroll to see earlier seasons':'')+'</p><div class="team-season-scroll">'+
  table(['Year','Finish','W','L','OTL','PTS','Roster +','Playoffs','Title'],records.map(r=>
   '<tr><td><button class="linkbtn" data-year="'+r.season+'">'+r.season+'</button></td><td>'+r.seed+'</td><td>'+
   r.w+'</td><td>'+r.l+'</td><td>'+r.otl+'</td><td>'+r.points+'</td><td>+'+r.bonus+'</td><td>'+
   (r.playoffs?'Yes':'No')+'</td><td>'+(r.champ?'🏆':'')+'</td></tr>'))+'</div>':'No history yet.';
 const current=state.regularSeason||state.activeSeason;
 const years=[...new Set([...seasons.map(s=>s.season),...(current?[current.season]:[])])].sort((a,b)=>b-a);
 teamGamesCache={id,years,games:null,seasons:[...seasons,...(current?[current]:[])]};
 if($('team-game-details')?.open||$('team-player-details')?.open||$('team-alltime-details')?.open)
  loadTeamGameArchive();
 try{
  const vs=await getTeamHeadToHeadSummary(id);
  if(view!=='teams'||selectedTeam!==id)return;
  $('team-h2h').innerHTML=table(['Opponent','W','L','OTL','Win %','Coin W-L'],
   vs.sort((a,b)=>b.w-a.w).map(r=>
    '<tr><td>'+teamLink(r.id)+'</td><td>'+r.w+'</td><td>'+r.l+'</td><td>'+r.otl+'</td><td>'+
    pct(r.w,r.w+r.l+r.otl)+'</td><td>'+r.coinW+'-'+r.coinL+'</td></tr>'));
 }catch(err){
  if(view==='teams'&&selectedTeam===id)$('team-h2h').textContent='Could not load head-to-head results: '+err.message;
 }
}
function teams(){teamDetail()}
