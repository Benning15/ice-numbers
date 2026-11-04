'use strict';
// V1.5 offseason: three equal-odds lottery winners from eight non-playoff teams,
// four predetermined prospects (one fully concealed), and three revealed picks.
function shuffleDraft(items){
 const out=items.slice();
 for(let i=out.length-1;i>0;i--){const j=randint(0,i);[out[i],out[j]]=[out[j],out[i]]}
 return out;
}
function drawDraftLottery(){
 const d=state.draft;
 if(!d||d.lottery||d.eligible.length!==8)throw Error('Draft lottery is not ready.');
 d.lottery=shuffleDraft(d.eligible).slice(0,3);
 d.phase='lottery-results';
}
function prospectRange(actual){
 // Width is determined independently of the actual rating; the generated
 // interval always contains the pre-rolled player rating.
 const width=weighted([24,27,22,14,8,4,1]);
 const lo=randint(Math.max(1,actual-width),Math.min(actual,8-width));
 return [lo,lo+width];
}
function revealDraftProspects(){
 const d=state.draft;
 if(!d||!d.lottery||d.prospects)throw Error('Prospects cannot be revealed yet.');
 const mystery=randint(0,3);
 d.prospects=Array.from({length:4},(_,i)=>{
  const bonus=weighted(state.settings.draftWeights),year=randint(1,Math.min(3,state.settings.careerLength));
  const [rangeMin,rangeMax]=prospectRange(bonus);
  return {index:i,name:FIRST[randint(0,FIRST.length-1)]+' '+LAST[randint(0,LAST.length-1)],
   bonus,year,rangeMin,rangeMax,mystery:i===mystery};
 });
 d.phase='picking';
}
function applyDraftPick(index){
 const d=state.draft;
 if(!d||d.phase!=='picking'||!d.lottery||!d.prospects||d.picks.length>=3)throw Error('Draft pick is not available.');
 const prospect=d.prospects.find(p=>p.index===index);
 if(!prospect||d.picks.some(p=>p.prospectIndex===index))throw Error('That prospect is no longer available.');
 const teamId=d.lottery[d.picks.length],team=state.teams[teamId],changed=new Map();
 const p=makeNewPlayer(teamId,'draft',state.season+1,{bonus:prospect.bonus,name:prospect.name,year:prospect.year});
 let released=null;
 if(team.roster.length>=state.settings.maxRoster){
  released=team.roster.reduce((a,b)=>a.bonus<b.bonus||a.bonus===b.bonus&&a.year>=b.year?a:b);
  team.roster=team.roster.filter(x=>x.id!==released.id);
  released.retireSeason=state.season;
  changed.set(released.id,released);
 }
 team.roster.push(p);
 changed.set(p.id,p);
 d.picks.push({pick:d.picks.length+1,teamId,prospectIndex:index,playerId:p.id,
  name:p.name,bonus:p.bonus,year:p.year,releasedId:released?.id??null});
 state.upcomingDraftNotes??=[];
 if(released)state.upcomingDraftNotes.push(team.name+' released '+released.name+' (+'+released.bonus+') to make room for a draft pick');
 state.upcomingDraftNotes.push(team.name+' drafted '+p.name+' (+'+p.bonus+', Year '+p.year+')');
 d.phase='pick-reveal';
 return [...changed.values()];
}
function advanceDraftPickReveal(){
 if(!state.draft||state.draft.phase!=='pick-reveal')throw Error('No pick is awaiting reveal.');
 state.draft.phase=state.draft.picks.length===3?'summary':'picking';
}
function finishDraft(){
 const d=state.draft;
 if(!d||d.phase!=='summary'||d.picks.length!==3)throw Error('Draft has not finished.');
 state.pendingDraftTeam=null; // obsolete V1.4 field; never generate a fourth automatic pick.
 state.draft=null;
 state.seasonComplete=false;
}
function autoDraftChoice(d){
 const team=state.teams[d.lottery[d.picks.length]];
 const candidates=d.prospects.filter(p=>!d.picks.some(x=>x.prospectIndex===p.index));
 const weights=state.settings.draftWeights;
 let best=null,bestScore=-Infinity;
 for(const p of candidates){
  // Draft AI sees only public range and year. Never read the true hidden
  // rating/year while evaluating prospects, even for the mystery candidate.
  const visible= p.mystery?Array.from({length:8},(_,i)=>i+1):
   Array.from({length:p.rangeMax-p.rangeMin+1},(_,i)=>p.rangeMin+i);
  const total=visible.reduce((sum,r)=>sum+weights[r-1],0);
  const expected=total?visible.reduce((sum,r)=>sum+r*weights[r-1],0)/total:4.5;
  const age=p.mystery?2:p.year;
  const score=expected+.38*(4-age)+random()*2.5+
    (team.roster.length>=state.settings.maxRoster?-.05:0);
  if(score>bestScore){bestScore=score;best=p}
 }
 return best.index;
}
function completeDraftAutomatically(){
 if(!state.draft)return [];
 const d=state.draft,changed=new Map();
 if(!d.lottery)drawDraftLottery();
 if(!d.prospects)revealDraftProspects();
 while(d.picks.length<3){
  if(d.phase==='pick-reveal')advanceDraftPickReveal();
  const index=autoDraftChoice(d);
  for(const p of applyDraftPick(index))changed.set(p.id,p);
 }
 if(d.phase==='pick-reveal')advanceDraftPickReveal();
 finishDraft();
 return [...changed.values()];
}
// Pure HTML UI; animation has no effect on RNG or hidden scouting values.
function draftView(){
 const d=state.draft;
 if(!d){titlebar('Draft Lottery','No draft currently pending.');$('app').innerHTML='<div class="panel"><p class="empty">Finish a championship to begin the next lottery.</p><button data-nav="dashboard">Dashboard</button></div>';return}
 titlebar('Offseason Draft','Season '+d.season+' — three lottery teams, four prospects, three picks.');
 const head='<div class="panel"><h2>Season '+d.season+' Draft</h2><p class="sub tiny">Eight non-playoff teams have equal lottery odds. Three different teams receive one selection each.</p></div>';
 if(d.phase==='lottery'){
  $('app').innerHTML=head+'<div class="panel"><h2>Draft lottery</h2><div class="draft-lottery-grid">'+d.eligible.map(id=>'<div class="draft-team-card">'+teamMark(id)+'<span>'+esc(state.teams[id].name)+'</span></div>').join('')+'</div><div class="buttonrow"><button class="primary" data-draft-action="lottery">Start Lottery</button></div></div>';
  return;
 }
 const winnerStrip='<div class="panel"><h2>Lottery results</h2><div class="draft-winner-grid">'+d.lottery.map((id,i)=>'<div class="draft-winner" style="--draft-delay:'+(i*.65)+'s"><span class="pill">Pick '+(i+1)+'</span>'+teamMark(id,true)+'<b>'+esc(state.teams[id].name)+'</b></div>').join('')+'</div></div>';
 if(d.phase==='lottery-results'){
  $('app').innerHTML=head+'<div class="panel"><h2>Eight eligible teams</h2><div class="draft-lottery-grid">'+d.eligible.map(id=>'<div class="draft-team-card '+(d.lottery.includes(id)?'selected':'')+'">'+teamMark(id)+'<span>'+esc(state.teams[id].name)+'</span></div>').join('')+'</div></div>'+winnerStrip+'<div class="buttonrow"><button class="primary" data-draft-action="prospects">Reveal Four Prospects</button></div>';
  return;
 }
 const results=d.picks.length?'<div class="panel"><h3>Selections so far</h3>'+d.picks.map(p=>'<p class="record">Pick '+p.pick+' · '+esc(state.teams[p.teamId].name)+' · '+esc(p.name)+' · <b>+'+p.bonus+' · Year '+p.year+'</b></p>').join('')+'</div>':'';
 if(d.phase==='pick-reveal'){
  const picked=d.picks.at(-1);
  $('app').innerHTML=head+'<div class="panel"><h2>Pick '+picked.pick+' — '+esc(state.teams[picked.teamId].name)+'</h2><div class="draft-reveal-card"><span class="sub tiny">SELECTED PROSPECT</span><h2>'+esc(picked.name)+'</h2><div class="draft-true-rating">+'+picked.bonus+'</div><p>Career Year '+picked.year+'</p></div><div class="buttonrow"><button class="primary" data-draft-action="next">'+(d.picks.length===3?'View Draft Summary':'Continue to Pick '+(d.picks.length+1))+'</button></div></div>'+results;
  return;
 }
 if(d.phase==='summary'){
  $('app').innerHTML=head+'<div class="panel"><h2>Draft results</h2><div class="draft-summary-grid">'+d.picks.map(p=>'<div class="draft-summary-card"><span class="pill">Pick '+p.pick+'</span>'+teamMark(p.teamId,true)+'<b>'+esc(state.teams[p.teamId].name)+'</b><span>'+esc(p.name)+'</span><strong>+'+p.bonus+' · Year '+p.year+'</strong></div>').join('')+'</div><p class="sub tiny">The undrafted fourth prospect leaves the board.</p><div class="buttonrow"><button class="primary" data-draft-action="finish">Continue to Next Season</button></div></div>';
  return;
 }
 const used=new Set(d.picks.map(p=>p.prospectIndex));
 const turn=d.lottery[d.picks.length];
 const cards=d.prospects.map((p,i)=>'<button class="draft-prospect-card '+(used.has(i)?'draft-taken':'')+'" style="--draft-delay:'+(i*.16)+'s" data-draft-pick="'+i+'" '+(used.has(i)?'disabled':'')+'><span class="sub tiny">PROSPECT '+(i+1)+'</span><b>'+esc(p.name)+'</b><span class="draft-scout-rating">'+(p.mystery?'UNKNOWN':'+'+p.rangeMin+' to +'+p.rangeMax)+'</span><span class="sub">'+(p.mystery?'Career year unknown':'Career Year '+p.year)+'</span>'+(used.has(i)?'<span class="pill">Drafted</span>':'')+'</button>').join('');
 $('app').innerHTML=head+'<div class="panel"><h2>Draft board</h2><div class="draft-current-pick"><span class="pill">Pick '+(d.picks.length+1)+' of 3</span>'+teamMark(turn)+'<b>'+esc(state.teams[turn].name)+'</b></div><p class="sub tiny">Select a prospect. The real rating and career year are already determined and will be revealed after the pick.</p><div class="draft-prospect-grid">'+cards+'</div></div>'+results;
}
async function performDraftAction(action,index){
 if(busy||!state.draft)return;
 busy=true;
 const previous=clone(state);
 try{
  let players=[];
  if(action==='lottery')drawDraftLottery();
  else if(action==='prospects')revealDraftProspects();
  else if(action==='pick')players=applyDraftPick(index);
  else if(action==='next')advanceDraftPickReveal();
  else if(action==='finish')finishDraft();
  else throw Error('Unknown draft action.');
  if(players.length)await commitProgress([],players);
  else await commitState();
  view=state.draft?'draft':'dashboard';
  notice='';
 }catch(err){state=previous;setBanner('Draft could not be saved: '+err.message,true)}
 finally{busy=false;await render()}
}
