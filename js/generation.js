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
function revealGenerationPick(all=false){
 const g=state.generation;
 if(!g||!['ranking','chosen'].includes(g.phase))throw Error('Generation selection is not ready.');
 if(!g.selected){
  // The chosen teams are drawn once; subsequent clicks only reveal them.
  g.selected=shuffleDraft(state.teams.map(t=>t.id)).slice(0,g.count);
  g.revealed=0;
 }
 const shown=g.revealed??(g.phase==='chosen'?g.selected.length:0);
 if(!all&&shown>=g.selected.length)throw Error('All generated teams have been revealed.');
 g.revealed=all?g.selected.length:shown+1;
 g.phase='chosen';
}
function drawGenerationTeams(){revealGenerationPick(true)}
function viewGenerationWinners(){
 const g=state.generation;
 if(!g||g.phase!=='chosen'||!g.selected|| (g.revealed??g.selected.length)!==g.selected.length)throw Error('Reveal all selected teams first.');
 g.phase='teams';
}
function generatedPlayerBeatsWeakest(p,weakest){
 // Only permanent + and career year count: a lower career year is younger.
 return p.bonus>weakest.bonus||(p.bonus===weakest.bonus&&p.year<weakest.year);
}
function weakestRosterPlayer(roster){
 return roster.reduce((a,b)=>b.bonus<a.bonus||(b.bonus===a.bonus&&b.year>a.year)?b:a);
}
function markPlayerCut(p,season){
 p.cutSeason=season;
 p.retireSeason=season-1;
}
function generateOffseasonPlayers(){
 const g=state.generation;
 if(!g||g.phase!=='teams'||!Array.isArray(g.selected)||g.results)throw Error('Player generation is not ready.');
 const updated=[];
 g.results=[];
 state.upcomingDraftNotes??=[];
 for(const teamId of g.selected){
  const t=state.teams[teamId];
  if(!t)throw Error('Unknown team selected for generation.');
  const before=bonusOf(t),p=makeNewPlayer(teamId,'spawn',g.year);
  let cut=null,kept=true;
  if(t.roster.length<state.settings.maxRoster){
   t.roster.push(p);
  }else{
   const weakest=weakestRosterPlayer(t.roster);
   if(generatedPlayerBeatsWeakest(p,weakest)){
    t.roster=t.roster.filter(x=>x.id!==weakest.id);
    markPlayerCut(weakest,g.year);
    updated.push(weakest);
    cut={playerId:weakest.id,name:weakest.name,bonus:weakest.bonus,year:weakest.year,newPlayer:false};
    t.roster.push(p);
   }else{
    kept=false;
    markPlayerCut(p,g.year);
    cut={playerId:p.id,name:p.name,bonus:p.bonus,year:p.year,newPlayer:true};
   }
  }
  // Even a rejected generated prospect is saved in Player History as Cut.
  updated.push(p);
  const after=bonusOf(t);
  g.results.push({teamId,playerId:p.id,name:p.name,bonus:p.bonus,year:p.year,before,after,kept,cut});
  state.upcomingDraftNotes.push(t.name+' generated '+p.name+' (+'+p.bonus+', Year '+p.year+')'+(kept?'':' — CUT'));
  if(cut&&!cut.newPlayer)state.upcomingDraftNotes.push(t.name+' cut '+cut.name+' (+'+cut.bonus+', Year '+cut.year+')');
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
 if(g.phase==='chosen'){if((g.revealed??g.selected.length)<g.selected.length)drawGenerationTeams();viewGenerationWinners();}
 let changed=[];
 if(g.phase==='teams')changed=generateOffseasonPlayers();
 if(g.phase==='results')finishGenerationStage();
 return changed;
}
function generationTeamTile(row,selected,showPicked){
 const id=row.teamId,team=state.teams[id];
 const isPicked=selected?.includes(id);
 return '<div class="generation-team '+(showPicked&&isPicked?'generation-picked':'')+
  '" style="--generation-order:'+(showPicked&&isPicked?selected.indexOf(id):0)+'">'+
  '<span class="generation-team-main">'+teamMark(id)+'<b>'+esc(team.name)+'</b></span>'+
  '<span class="generation-team-total">+'+row.base+'</span>'+
  (showPicked&&isPicked?'<span class="generation-team-status">SELECTED</span>':'')+
  '</div>';
}
function generationView(){
 const g=state.generation;
 if(!g){titlebar('Player Generation','No generation currently pending.');$('app').innerHTML='<div class="panel"><button data-nav="dashboard">Dashboard</button></div>';return}
 const count=(g.selected||[]).length;
 titlebar('Offseason Player Generation','Season '+g.year+' · Random player generation');
 const summary='<div class="panel"><h2>Season '+g.year+' · Player generation</h2><p class="sub tiny">Every team is ranked by its combined permanent base + (0 to +24). Exactly '+g.count+' of the 16 teams are randomly selected (unless the setting is 0). Full rosters can be selected: a generated player replaces the weakest only if stronger, or if equally rated and younger. Hidden Motivation never counts.</p></div>';
 if(g.phase==='ranking'||g.phase==='chosen'){
  const shown=g.selected?g.selected.slice(0,g.revealed??g.selected.length):[];
  const complete=g.selected&&shown.length===g.selected.length;
  const cards=g.ranked.map(row=>generationTeamTile(row,shown,true)).join('');
  const controls=complete?
   '<button class="primary" data-generation-action="teams">View '+shown.length+' Selected Teams</button>':
   (g.count===0?'<button class="primary" data-generation-action="select-all">Continue (0 picks)</button>':
   '<button class="primary" data-generation-action="select-one">Generation Pick '+(shown.length+1)+'/'+g.count+'</button><button data-generation-action="select-all">Sim All</button>');
  $('app').innerHTML=summary+'<div class="panel"><div class="stickybar"><h2>All 16 teams · Highest + first</h2><span class="pill">'+shown.length+' / '+g.count+' selected</span></div><div class="generation-team-grid">'+cards+'</div><div class="buttonrow">'+controls+'</div></div>';
  return;
 }
 const selectedRows=(g.selected||[]).map(id=>g.ranked.find(r=>r.teamId===id));
 if(g.phase==='teams'){
  $('app').innerHTML=summary+'<div class="panel"><h2>'+count+' Teams Selected</h2><p class="sub tiny">Each team generates one player. A full roster keeps its best three, using base + and career year only. Current team + shown below.</p><div class="generation-team-grid">'+selectedRows.map(r=>generationTeamTile(r,g.selected,true)).join('')+'</div><div class="buttonrow"><button class="primary" data-generation-action="generate">Generate '+count+' Players</button></div></div>';
  return;
 }
 if(g.phase==='results'){
  const rows=(g.results||[]).map((r,i)=>{
   const cut=r.cut?'<div class="generation-cut">CUT: '+esc(r.cut.name)+' (+'+r.cut.bonus+', Year '+r.cut.year+')</div>':'';
   return '<div class="generation-result" style="--generation-order:'+i+'"><div class="generation-result-team">'+teamMark(r.teamId)+'<b>'+esc(state.teams[r.teamId].name)+'</b></div><div class="generation-result-player"><b>'+esc(r.name)+'</b><span class="sub tiny">+'+r.bonus+' · Career Year '+r.year+'</span>'+cut+'</div><div class="generation-result-plus"><span class="sub tiny">TEAM +</span><strong>+'+r.before+' → +'+r.after+'</strong></div></div>';
  }).join('');
  $('app').innerHTML=summary+'<div class="panel"><h2>Generated Players · Season '+g.year+'</h2><div class="generation-results">'+(rows||'<p class="sub">No teams were selected. No players generated.</p>')+'</div><div class="buttonrow"><button class="primary" data-generation-action="finish">Continue to Season '+g.year+'</button></div></div>';
 }
}
async function performGenerationAction(action){
 if(busy||!state.generation)return;
 busy=true;
 const previous=clone(state);
 try{
  let players=[];
  if(action==='select'||action==='select-all')drawGenerationTeams();
  else if(action==='select-one')revealGenerationPick();
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
