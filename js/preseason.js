'use strict';
// V1.9.7 — Final offseason checkpoint: inspect every roster after draft and
// player generation, before any regular-season games are simulated.
// This is a deliberate manual-play stage. Bulk simulation is unchanged.
function preseasonPreviewAvailable(){
 if(state.regularSeason||state.activeSeason||state.draft||state.generation||state.seasonComplete)return false;
 return state.season===0||state.generatedForSeason===state.season+1;
}
function preseasonPreviewRequired(){
 return preseasonPreviewAvailable()&&state.previewConfirmedForSeason!==state.season+1;
}
function preseasonPlayoffStreak(t){
 const made=Math.max(0,t.currentPlayoffStreak||0);
 const missed=Math.max(0,t.currentMissStreak||0);
 if(made)return 'Made playoffs '+made+' consecutive season'+(made===1?'':'s');
 if(missed)return 'Missed playoffs '+missed+' consecutive season'+(missed===1?'':'s');
 return 'No previous playoff streak';
}
function preseasonTrophies(t){
 const straight=Math.max(0,Math.floor(t.currentTitleStreak||0));
 if(!state.season||!straight)return '';
 const shown=Math.min(straight,5);
 return '<div class="preseason-trophies" aria-label="'+straight+' consecutive championships" title="'+
  straight+' consecutive championships">'+Array.from({length:shown},()=>'<span aria-hidden="true">🏆</span>').join('')+
  (straight>shown?'<span class="preseason-more-trophies">+'+(straight-shown)+'</span>':'')+'</div>';
}
function preseasonTeamCard(t){
 const streak=Math.max(0,Math.floor(t.currentTitleStreak||0));
 const champion=state.season>0&&streak>0;
 const roster=t.roster.slice().sort((a,b)=>b.bonus-a.bonus||a.year-b.year||a.name.localeCompare(b.name));
 const players=roster.length?roster.map(p=>
  '<div class="preseason-player"><span class="preseason-player-name">'+playerLink(p)+'</span>'+
  '<span class="preseason-player-meta">+'+fmt(p.bonus)+' · Year '+fmt(p.year)+'/'+fmt(state.settings.careerLength)+'</span></div>').join(''):
  '<p class="preseason-empty">No named players — unidentified skaters still score</p>';
 return '<article class="preseason-team-card'+(champion?' reigning-champion':'')+'">'+
  '<div class="preseason-team-heading">'+teamMark(t.id,true)+
  '<div class="preseason-team-title"><h3>'+esc(t.name)+'</h3>'+
  (champion?'<span class="preseason-champion-label">Reigning champion'+(streak>1?' · '+streak+' straight':'')+'</span>':'')+
  '</div><span class="preseason-plus">+'+fmt(bonusOf(t))+'</span></div>'+
  '<div class="preseason-streak">'+esc(preseasonPlayoffStreak(t))+'</div>'+
  '<div class="preseason-roster">'+players+'</div>'+preseasonTrophies(t)+'</article>';
}
async function preseasonPreviewView(){
 titlebar('Preseason Team Preview','Final offseason check — all 16 team rosters, ratings, championship streaks and playoff streaks.');
 if(!preseasonPreviewAvailable()){
  const destination=state.generation?'generation':state.draft?'draft':state.regularSeason?'standings':state.activeSeason?'playoffs':'dashboard';
  $('app').innerHTML='<div class="panel"><p class="sub">A new preseason preview is not available at this stage.</p>'+
   '<div class="buttonrow"><button class="primary" data-nav="'+destination+'">Continue</button></div></div>';
  return;
 }
 if(state.season===0&&state.openingRostersPending===true){
  // Starting rosters used to be created on the first simulation click. Prepare
  // them here instead, once, and save all players so a refresh preserves them.
  const previous=clone(state);
  try{
   const created=prepareOpeningRosters();
   await commitProgress([],created);
  }catch(err){
   state=previous;
   $('app').innerHTML='<div class="notice warn">Could not save the opening rosters: '+esc(err.message)+
    '. Your original league remains unchanged. Try opening the preview again.</div>';
   return;
  }
  if(view!=='preview')return;
 }
 const teams=state.teams.slice().sort((a,b)=>bonusOf(b)-bonusOf(a)||a.name.localeCompare(b.name));
 const champ=state.season?state.teams.find(t=>(t.currentTitleStreak||0)>0):null;
 const subtitle=champ?'<p class="sub tiny">Defending champion: '+esc(champ.name)+
  ' · '+champ.currentTitleStreak+' consecutive title'+(champ.currentTitleStreak===1?'':'s')+'. Gold borders identify the reigning champion.</p>':
  '<p class="sub tiny">The first season starts with no defending champion. All rosters are ready to inspect.</p>';
 const total=state.teams.reduce((n,t)=>n+t.roster.length,0);
 const confirmed=state.previewConfirmedForSeason===state.season+1;
 $('app').innerHTML='<div class="panel preseason-intro"><div>'+
  '<h2>Season '+(state.season+1)+' — Final Team Preview</h2>'+
  '<p class="sub">Draft, generation and offseason moves are complete. Teams are ranked by combined base +; players show their permanent + and career year.</p>'+
  subtitle+'<p class="sub tiny">'+state.teams.length+' teams · '+total+' named players · 0 regular-season games played</p></div>'+
  '<div class="buttonrow"><button class="primary" data-preseason-start="1" '+(busy?'disabled':'')+'>'+
  (confirmed?'Continue to Regular Season':'Start Season '+(state.season+1))+'</button>'+
  '<button data-nav="commissioner">Commissioner Mode</button></div></div>'+
  '<div class="preseason-grid">'+teams.map(preseasonTeamCard).join('')+'</div>'+
  '<div class="panel"><div class="buttonrow"><button class="primary" data-preseason-start="1" '+(busy?'disabled':'')+
  '>Start Season '+(state.season+1)+'</button><button data-preseason-full="1">Simulate Full Season</button></div>'+
  '<p class="sub tiny">Starting the season saves its schedule but does not simulate any games. Afterward, use Sim 1 Game / Team, Sim 10 Games / Team or Finish Regular Season.</p></div>';
}
async function startSeasonFromPreview(full=false){
 if(busy||!preseasonPreviewAvailable())return;
 busy=true;
 const previous=clone(state);
 let startedSuccessfully=false;
 try{
  state.previewConfirmedForSeason=state.season+1;
  const started=startRegularSeason();
  await commitProgress([],started.players);
  view='standings';
  startedSuccessfully=true;
  setBanner('Season '+state.regularSeason.season+' is ready. Choose how many games to simulate.');
 }catch(err){
  state=previous;
  console.error(err);
  setBanner('Could not start the season: '+err.message,true);
 }finally{
  busy=false;
  await render();
 }
 if(startedSuccessfully&&full)await runN(1);
}
