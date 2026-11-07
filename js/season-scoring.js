'use strict';
// Season-scoped scoring totals are rebuilt from saved game scoring events,
// never from lifetime player counters. This also supports older saved seasons.
function calculateSeasonScoring(rosters,games,stage){
 const byId=new Map();
 for(const [id,roster] of Object.entries(rosters||{})){
  for(const p of roster){
   byId.set(p.id,{id:p.id,name:p.name,teamId:Number(id),bonus:p.bonus,
    gp:0,g:0,a:0,points:0,incomplete:false});
  }
 }
 for(const game of games){
  if(game.stage!==stage)continue;
  const present=[game.aId,game.bId];
  for(const p of byId.values())if(present.includes(p.teamId))p.gp++;
  if(!Array.isArray(game.goalEvents)){
   for(const p of byId.values())if(present.includes(p.teamId))p.incomplete=true;
   continue;
  }
  for(const goal of game.goalEvents){
   if(goal.scorerId!=null&&byId.has(goal.scorerId))byId.get(goal.scorerId).g++;
   for(const aid of goal.assistIds||[])if(byId.has(aid))byId.get(aid).a++;
  }
 }
 const players=[...byId.values()];
 for(const p of players)p.points=p.g+p.a;
 return players.sort((a,b)=>b.points-a.points||b.g-a.g||b.a-a.a||a.name.localeCompare(b.name)||a.id-b.id);
}
async function seasonScoringView(){
 const current=state.regularSeason||state.activeSeason;
 const latest=current?.season??state.season;
 titlebar('Season Scoring','Track named-player goals, assists and points in the regular season or playoffs.');
 $('app').innerHTML='<div class="panel"><p class="sub">Loading season scoring…</p></div>';
 const archive=await getAll('seasons');
 if(view!=='scoring')return;
 const available=[...new Set([...archive.map(s=>s.season),...(current?[current.season]:[])])].sort((a,b)=>b-a);
 const year=available.includes(seasonScoringYear)?seasonScoringYear:latest;
 if(!available.includes(year)){
  $('app').innerHTML='<div class="panel"><h2>Regular Season Player Stats</h2><p class="empty">Simulate a regular-season game to start tracking player points.</p><button class="primary" data-nav="dashboard">Go to Dashboard</button></div>';
  return;
 }
 const season=(current?.season===year?current:archive.find(s=>s.season===year));
 if(!season){$('app').innerHTML='<div class="panel"><p class="empty">Season scoring is unavailable.</p></div>';return}
 const stage=seasonScoringStage==='playoff'?'playoff':'regular';
 const games=await getIndexAll('games','bySeason',year);
 if(view!=='scoring')return;
 const players=calculateSeasonScoring(season.rosters,games,stage);
 const stageGames=games.filter(g=>g.stage===stage);
 const completed=year<latest||(!current&&year===state.season)||stage==='regular'&&current?.season===year&&current.phase==='playoffs';
 const menu='<div class="season-scoring-filters">'+
  '<div><label class="sub tiny" for="scoring-stage-select">Scoring</label><select class="select" id="scoring-stage-select">'+
  '<option value="regular" '+(stage==='regular'?'selected':'')+'>Regular Season</option>'+
  '<option value="playoff" '+(stage==='playoff'?'selected':'')+'>Playoffs</option></select></div>'+
  '<div><label class="sub tiny" for="scoring-season-select">Season</label><select class="select" id="scoring-season-select">'+
  available.map(n=>'<option value="'+n+'" '+(n===year?'selected':'')+'>Season '+n+(current?.season===n?' · Current':'')+'</option>').join('')+
  '</select></div></div>';
 const columns=['#','Player','Team','Base +','GP','G','A','PTS','P/GP'];
 const rows=players.map((p,i)=>'<tr><td>'+(i+1)+'</td><td>'+playerLink(p)+'</td><td>'+teamLink(p.teamId)+'</td><td>+'+p.bonus+'</td><td>'+p.gp+'</td>'+
  '<td>'+(p.incomplete?'—':p.g)+'</td><td>'+(p.incomplete?'—':p.a)+'</td><td><b>'+(p.incomplete?'—':p.points)+'</b></td>'+
  '<td>'+(p.incomplete?'—':p.gp?(p.points/p.gp).toFixed(2):'0.00')+'</td></tr>');
 const controls=current?.phase==='regular'&&year===current.season?regularSeasonControls():'';
 $('app').innerHTML='<div class="panel"><div class="stickybar"><h2>'+ (stage==='regular'?'Regular Season':'Playoff')+
  ' Player Stats · Season '+year+'</h2><span class="pill">'+stageGames.length+' games '+(completed?'recorded':'so far')+'</span></div>'+
  menu+controls+'<p class="sub tiny">Points = goals + assists. Sorted by points, then goals. These are totals for this season only, not career totals. Includes named players with zero points.</p>'+
  (stageGames.length?table(columns,rows):'<p class="empty">No '+(stage==='regular'?'regular-season':'playoff')+' games have been played for this season yet.</p>')+
  (players.some(p=>p.incomplete)?'<p class="sub tiny">Some older game records lack individual scoring details, so their totals cannot be verified.</p>':'')+
  '</div>';
}
