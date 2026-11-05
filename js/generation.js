'use strict';
// Post-draft offseason generation. Choices are drawn only on button clicks and
// stored with the league, so refreshes cannot reroll teams or newly created players.
function startGenerationStage(){
 if(state.activeSeason||state.draft||state.generation)throw Error('Player generation is not ready.');
 const year=state.season+1;
 if(state.generatedForSeason===year)throw Error('This season has already received generated players.');
 state.generation={
  year,phase:'ranking',count:state.settings.generatedPlayersPerSeason??DEFAULTS.generatedPlayersPerSeason,
  ranked:state.teams.map(t=>({teamId:t.id,base:bonusOf(t),rosterCount:t.roster.length}))
   .sort((a,b)=>b.base-a.base||a.teamId-b.teamId),
  selected:null,results:null
 };
}
function drawGenerationTeams(){
 const g=state.generation;
 if(!g||g.phase!=='ranking')throw Error('Generation selection is not ready.');
 const eligible=state.teams.filter(t=>t.roster.length<state.settings.maxRoster).map(t=>t.id);
 g.selected=shuffleDraft(eligible).slice(0,g.count);
 g.phase='chosen';
}
function viewGenerationWinners(){
 if(!state.generation||state.generation.phase!=='chosen')throw Error('Team selection must finish first.');
 state.generation.phase='teams';
}
function generateOffseasonPlayers(){
 const g=state.generation;
 if(!g||g.phase!=='teams'||!Array.isArray(g.selected)||g.results)throw Error('Player generation is not ready.');
 const updated=[];
 g.results=[];
 state.upcomingDraftNotes??=[];
 for(const teamId of g.selected){
  const t=state.teams[teamId];
  if(!t||t.roster.length>=state.settings.maxRoster)throw Error('Selected team has no roster space.');
  const before=bonusOf(t),p=makeNewPlayer(teamId,'spawn',g.year);
  t.roster.push(p);
  updated.push(p);
  const after=bonusOf(t);
  g.results.push({teamId,playerId:p.id,name:p.name,bonus:p.bonus,year:p.year,before,after});
  state.upcomingDraftNotes.push(t.name+' generated '+p.name+' (+'+p.bonus+', Year '+p.year+')');
 }
 g.phase='results';
 return updated;
}
function finishGenerationStage(){
 const g=state.generation;
 if(!g||g.phase!=='results')throw Error('Generation results must be revealed first.');
 state.generatedForSeason=g.year;
 state.generation=null;
 state.seasonComplete=false;
}
function completeGenerationAutomatically(){
 if(!state.generation)return [];
 const g=state.generation;
 if(g.phase==='ranking')drawGenerationTeams();
 if(g.phase==='chosen')viewGenerationWinners();
 let changed=[];
 if(g.phase==='teams')changed=generateOffseasonPlayers();
 if(g.phase==='results')finishGenerationStage();
 return changed;
}
function generationTeamTile(row,selected,showPicked){
 const id=row.teamId,team=state.teams[id];
 const canReceive=row.rosterCount<state.settings.maxRoster;
 const isPicked=selected?.includes(id);
 return '<div class="generation-team '+(showPicked&&isPicked?'generation-picked':!canReceive?'generation-full':'')+
  '" style="--generation-order:'+(showPicked&&isPicked?selected.indexOf(id):0)+'">'+
  '<span class="generation-team-main">'+teamMark(id)+'<b>'+esc(team.name)+'</b></span>'+
  '<span class="generation-team-total">+'+row.base+'</span>'+
  (showPicked&&isPicked?'<span class="generation-team-status">SELECTED</span>':
   !canReceive?'<span class="generation-team-status muted">FULL</span>':'')+
  '</div>';
}
function generationView(){
 const g=state.generation;
 if(!g){titlebar('Player Generation','No generation currently pending.');$('app').innerHTML='<div class="panel"><button data-nav="dashboard">Dashboard</button></div>';return}
 const count=(g.selected||[]).length;
 titlebar('Offseason Player Generation','Season '+g.year+' · Random player generation');
 const summary='<div class="panel"><h2>Season '+g.year+' · Player generation</h2><p class="sub tiny">Every team is ranked by its combined permanent base + (0 to +24). Up to '+g.count+' teams with open roster spots receive one new player each. The selection is random, not based on ranking.</p></div>';
 if(g.phase==='ranking'||g.phase==='chosen'){
  const chosen=g.phase==='chosen';
  const cards=g.ranked.map(row=>generationTeamTile(row,g.selected,chosen)).join('');
  const label=chosen?'View '+count+' Selected Teams':'Select Up to '+g.count+' Teams';
  $('app').innerHTML=summary+'<div class="panel"><div class="stickybar"><h2>All 16 teams · Highest + first</h2><span class="pill">'+(chosen?count+' selected':'Selection pending')+'</span></div><div class="generation-team-grid">'+cards+'</div><div class="buttonrow"><button class="primary" data-generation-action="'+(chosen?'teams':'select')+'">'+label+'</button></div></div>';
  return;
 }
 const selectedRows=(g.selected||[]).map(id=>g.ranked.find(r=>r.teamId===id));
 if(g.phase==='teams'){
  $('app').innerHTML=summary+'<div class="panel"><h2>'+count+' Teams Selected</h2><p class="sub tiny">These teams will each receive one randomly generated player. Existing team + shown below.</p><div class="generation-team-grid">'+selectedRows.map(r=>generationTeamTile(r,g.selected,true)).join('')+'</div><div class="buttonrow"><button class="primary" data-generation-action="generate">Generate '+count+' Players</button></div></div>';
  return;
 }
 if(g.phase==='results'){
  const rows=(g.results||[]).map((r,i)=>'<div class="generation-result" style="--generation-order:'+i+'"><div class="generation-result-team">'+teamMark(r.teamId)+'<b>'+esc(state.teams[r.teamId].name)+'</b></div><div class="generation-result-player"><b>'+esc(r.name)+'</b><span class="sub tiny">+'+r.bonus+' · Career Year '+r.year+'</span></div><div class="generation-result-plus"><span class="sub tiny">TEAM +</span><strong>+'+r.before+' → +'+r.after+'</strong></div></div>').join('');
  $('app').innerHTML=summary+'<div class="panel"><h2>Generated Players · Season '+g.year+'</h2><div class="generation-results">'+(rows||'<p class="sub">No eligible teams were selected. No players generated.</p>')+'</div><div class="buttonrow"><button class="primary" data-generation-action="finish">Continue to Season '+g.year+'</button></div></div>';
 }
}
async function performGenerationAction(action){
 if(busy||!state.generation)return;
 busy=true;
 const previous=clone(state);
 try{
  let players=[];
  if(action==='select')drawGenerationTeams();
  else if(action==='teams')viewGenerationWinners();
  else if(action==='generate')players=generateOffseasonPlayers();
  else if(action==='finish')finishGenerationStage();
  else throw Error('Unknown generation action.');
  if(players.length)await commitProgress([],players);
  else await commitState();
  view=state.generation?'generation':'dashboard';
  notice='';
 }catch(err){state=previous;setBanner('Could not save player generation: '+err.message,true)}
 finally{busy=false;await render()}
}
