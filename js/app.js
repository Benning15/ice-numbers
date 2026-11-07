'use strict';
function settings(){
 titlebar('League Settings','Control talent generation, actual goals, playmaking and randomness.');
 const s=state.settings,locked=!!(state.activeSeason||state.regularSeason);
 const val=(k,label,min,max,step=1,help='')=>number(k,label,min,max,false,step)+(help?'<p class="help">'+help+'</p>':'');
 $('app').innerHTML=
 '<div class="notice '+(locked?'warn':'')+'">'+(locked?'Finish the active season before changing settings.':'These settings apply to future games, not already archived results.')+' Players use individual goal and playmaking rolls. Ties always go to a 50/50 overtime coin flip.</div>'+
 '<div class="settings-savebar"><div><b>Save league balance</b><p class="sub tiny">Set as Default applies these values to all future fresh universes in this browser.</p></div><div class="buttonrow"><button class="primary" id="save-settings" '+(locked?'disabled':'')+'>Save All Settings</button><button id="set-default-settings" '+(locked?'disabled':'')+'>Set as Default</button></div></div>'+
 '<div class="formgrid">'+
 '<div class="panel"><h2>League and player generation</h2>'+
 sel('gamesPerTeam','Games per team',[[30,'30'],[45,'45'],[60,'60']])+
 val('generatedPlayersPerSeason','Random generated players across league/year',0,16,1,'After the draft, this many distinct teams are selected from all 16. Each generates one player; at 3/3, the weakest is cut only if the new player is better (+), or younger with the same +. Hidden Motivation does not matter. Draft picks are separate.')+
 val('careerLength','Maximum career years',1,15,1)+
 '<p class="help">Teams have up to three named players. Three non-playoff teams win lottery draft picks. All 16 teams, including full rosters, are eligible for random generation.</p>'+
 '<h3 class="mutedline">Base rating probabilities</h3><p class="help">Percentages must sum to exactly 100 for each source. +8 remains rare.</p>'+
 ['normalWeights','draftWeights'].map(k=>'<div class="mutedline"><b>'+(k==='normalWeights'?'Normal generation':'Lottery draft')+'</b>'+s[k].map((w,i)=>'<div class="control"><label>+ '+(i+1)+' chance (%)</label><input type="number" step="0.1" min="0" max="100" data-weight="'+k+'" data-index="'+i+'" value="'+w+'"></div>').join('')+oddsStatusHtml(k,s[k])+'</div>').join('')+
 '</div>'+
 '<div class="panel"><h2>Goals and playmaking</h2><p class="help">Actual goals decide the game. These are per-game expected roll rates before teammates contribute extra goals.</p>'+
 val('goalRateAt9','+9 player: independent goals/game',0,3,.05,'A +9 has this average on their own goal roll. Their final total can be higher through teammates.')+
 val('playmakingRateAt9','+9 player: goals created/game',0,3,.05,'Each successful playmaking roll adds exactly one goal to a teammate (named or unidentified) and awards the creator an assist.')+
 val('goalCurve','Goal talent curve',.2,5,.1,'Higher values make elite ratings stand out more.')+
 val('playmakingCurve','Playmaking talent curve',.2,5,.1)+
 val('goalVolatility','Game-to-game scoring volatility',0,1.5,.05,'0 = standard Poisson; higher values allow more unusually quiet or explosive games without raising the average.')+
 val('tendencySpread','New player goal/assist tendency spread',0,40,1,'0 = everyone 50/50. At 25, new players range from 25/75 through 75/25. Existing players keep their permanent tendency.')+
 '<h3 class="mutedline">Unidentified roster</h3>'+
 val('unnamedGoalsPerGame','Unidentified independent goals/team/game',0,6,.05)+
 val('unnamedIceTimeImpact','Star ice-time impact on unidentified scoring',0,1,.05,'0 = no reduction with named players; 1 = maximum reduction. Even superteams retain depth opportunities.')+
 val('unnamedRecipientWeight','Unidentified chance to finish a play',.1,15,.1)+
 val('unnamedAssistWeight','Unidentified chance to assist',.1,15,.1)+
 val('recipientCurve','Finishing talent curve',.2,4,.1)+
 '<h3 class="mutedline">Assists on goals</h3>'+
 val('unassistedPct','Unassisted independent/OT goals (%)',0,100,1)+
 val('oneAssistPct','One-assist independent/OT goals (%)',0,100,1)+assistStatusHtml(s.unassistedPct,s.oneAssistPct)+
 val('secondaryAssistPct','Second assist on playmaking goals (%)',0,100,1,'A playmaking goal always credits its creator with the primary assist; the secondary is optional and never creates a goal.')+
 '<p class="help">Overtime: goals tied after regulation always trigger a fair 50/50 coin flip, then exactly one additional goal and 0–2 assists.</p>'+
 scoringEstimatorMarkup()+
 '<div class="settings-bottom-save"><button class="primary" data-save-settings '+(locked?'disabled':'')+'>Save All Settings</button></div></div></div>'+
 '<div class="panel"><h2>League data and backups</h2><p class="sub">V1.4 uses a new local database. The old V1.3 records are separate and untouched; a fresh V1.4 universe starts from scratch.</p><div class="buttonrow"><button id="export">Export complete backup (.json)</button><button id="import">Import V1.4 backup</button><button class="danger" id="reset">Start a new universe</button></div><p class="help">Initial random seed: '+state.initialSeed+'. The Testing Information tab lets you monitor all long-term averages.</p></div>';
 updateScoringEstimator();
}
function number(key,label,min,max,disabled=false,step=1){return `<div class="control"><label for="cfg-${key}">${label}</label><input id="cfg-${key}" type="number" min="${min}" max="${max}" step="${step}" value="${state.settings[key]??DEFAULTS[key]}" ${disabled?'disabled':''}></div>`}
function sel(key,label,opts){return `<div class="control"><label for="cfg-${key}">${label}</label><select id="cfg-${key}" class="select">${opts.map(([v,l])=>`<option value="${v}" ${state.settings[key]===v?'selected':''}>${l}</option>`).join('')}</select></div>`}
async function saveSettings(makeDefault=false){
 if(state.activeSeason||state.regularSeason){setBanner('Finish the active season before editing rules.',true);return false}
 const s=clone(state.settings);
 const specs={gamesPerTeam:[30,60,true],generatedPlayersPerSeason:[0,16,true],careerLength:[1,15,true],goalRateAt9:[0,3,false],
  playmakingRateAt9:[0,3,false],goalCurve:[.2,5,false],playmakingCurve:[.2,5,false],
  goalVolatility:[0,1.5,false],tendencySpread:[0,40,true],unnamedGoalsPerGame:[0,6,false],
  unnamedIceTimeImpact:[0,1,false],unnamedRecipientWeight:[.1,15,false],
  unnamedAssistWeight:[.1,15,false],recipientCurve:[.2,4,false],
  unassistedPct:[0,100,true],oneAssistPct:[0,100,true],secondaryAssistPct:[0,100,true]};
 for(const [k,[lo,hi,integer]] of Object.entries(specs)){
  const e=$('cfg-'+k),v=Number(e?.value);
  if(!e||e.value.trim()===''||!Number.isFinite(v)||v<lo||v>hi||(integer&&!Number.isInteger(v))||
   (k==='gamesPerTeam'&&![30,45,60].includes(v))){
   setBanner('Invalid setting: '+k,true);return false;
  }
  s[k]=v;
 }
 if(s.unassistedPct+s.oneAssistPct>100){setBanner('0- and 1-assist percentages cannot exceed 100 together.',true);return false}
 for(const k of ['normalWeights','draftWeights']){
  const es=[...document.querySelectorAll('[data-weight="'+k+'"]')];
  s[k]=es.map(e=>e.value.trim()===''?NaN:Number(e.value));
  if(s[k].length!==8||s[k].some(v=>!Number.isFinite(v)||v<0)||
   Math.abs(s[k].reduce((a,b)=>a+b,0)-100)>.001){
   setBanner(k+' probabilities must total 100%.',true);return false;
  }
 }
 state.settings=s;await commitState();
 if(makeDefault){await commitDefaultSettings(s);setBanner('Settings saved and set as defaults for future new leagues.')}
 else setBanner('Settings saved for future seasons.');
 settings();return true;
}
async function runN(n){if(busy)return;if(n>=1000&&!confirm('Simulate 1,000 seasons? This stores every game and could take a little while.'))return;busy=true;cancelRun=false;let done=0;try{await render();for(let i=0;i<n;i++){let prev=clone(state);let sim=simulateSeason();state.seasonComplete=false;try{await commitSeason(sim.result,sim.games,sim.players)}catch(e){state=prev;throw e}done++;progressPercent=100*done/n;progressText=`Saved ${fmt(done)} / ${fmt(n)} seasons. Current: Season ${fmt(state.season)}`;if(i%5===0||i===n-1){if(view==='dashboard'){let bar=document.querySelector('.progress>div');if(bar)bar.style.width=progressPercent+'%';let label=document.querySelector('.progress+.sub');if(label)label.textContent=progressText}await new Promise(r=>setTimeout(r,0))}if(cancelRun)break}selectedSeason=state.season;setBanner(`Simulated and saved ${fmt(done)} season${done===1?'':'s'}. Full game and player histories have been archived.`)}catch(err){console.error(err);setBanner('Simulation stopped: '+err.message,true)}finally{busy=false;progressPercent=0;progressText='';await render()}}
async function exportBackup(){let exp={format:'ice-numbers-v14',savedAt:new Date().toISOString(),meta:state,seasons:await getAll('seasons'),games:await getAll('games'),players:await getAll('players')};let blob=new Blob([JSON.stringify(exp)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ice-numbers-season-${state.season}-backup.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);setBanner('Backup downloaded. Keep the JSON file somewhere safe.')}
function writeChunk(store,items){return new Promise((resolve,reject)=>{let tx=db.transaction(store,'readwrite'),os=tx.objectStore(store);for(let item of items)os.put(item);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function clearAll(){await Promise.all(['meta','seasons','games','players'].map(store=>new Promise((resolve,reject)=>{let tx=db.transaction(store,'readwrite');let os=tx.objectStore(store);if(store==='meta')os.delete('main');else os.clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})))}
// Reject malformed or duplicate keys BEFORE opening an IndexedDB write transaction.
function validateLeagueBackup(obj){
 if(!obj||obj.format!=='ice-numbers-v14'||!obj.meta||!Array.isArray(obj.meta.teams)||
   !Array.isArray(obj.games)||!Array.isArray(obj.seasons)||!Array.isArray(obj.players))
  throw Error('Not a valid Ice Numbers backup.');
 if(obj.meta.teams.length!==16||!Number.isInteger(obj.meta.season)||obj.meta.season<0)
  throw Error('Backup has invalid team or season information.');
 const ids=new Set();
 for(const team of obj.meta.teams){
  if(!team||!Number.isInteger(team.id)||team.id<0||team.id>15||ids.has(team.id)||!Array.isArray(team.roster))
   throw Error('Backup has an invalid team roster or identifier.');
  ids.add(team.id);
 }
 const unique=(items,key,store,check)=>{
  const seen=new Set();
  for(const row of items){
   if(!row||typeof row!=='object'||!check(row[key])||seen.has(row[key]))
    throw Error('Backup has invalid or duplicate '+store+' records.');
   seen.add(row[key]);
  }
 };
 unique(obj.seasons,'season','season',value=>Number.isInteger(value)&&value>0);
 unique(obj.games,'id','game',value=>typeof value==='string'&&value.length>0);
 unique(obj.players,'id','player',value=>Number.isInteger(value)&&value>0);
 return obj;
}
async function importBackup(file){
 if(busy||!confirm('Replace this entire league with the imported backup? Export your current league first if you want to keep it.'))return;
 busy=true;
 const previous=state;
 let committed=false;
 try{
  const backup=validateLeagueBackup(JSON.parse(await file.text()));
  // Build and validate the new meta BEFORE touching any currently saved data.
  // Restore in-memory state on failure; IndexedDB rolls the write back as a unit.
  state=clone(backup.meta);
  state.settings={...clone(DEFAULTS),...(state.settings||{})};
  state.activeSeason??=null;
  state.regularSeason??=null;
  state.draft??=null;state.generation??=null;state.generatedForSeason??=null;state.upcomingDraftNotes??=[];
  state.transactions??=[];
  state.nextTransactionId??=state.transactions.length?Math.max(...state.transactions.map(t=>t.id))+1:1;
  state.previewConfirmedForSeason??=0;
  if(state.season>0&&!state.activeSeason&&!state.regularSeason&&!state.draft&&!state.generation&&
     !state.seasonComplete&&state.generatedForSeason!==state.season+1)startGenerationStage();
  await replaceLeagueAtomically(backup,state);
  committed=true;
  individualSeasonCache=null;seasonScoringYear=null;seasonScoringStage='regular';
  teamGamesCache=null;teamGamesYear=null;teamGamesTeam=null;
  await hydrateTestingOutcomeHistory();
  await commitState();
  selectedSeason=state.season;view='dashboard';
  setBanner('Imported the league backup successfully.');
 }catch(err){
  if(!committed)state=previous;
  console.error(err);
  setBanner(committed?'League imported, but could not refresh optional statistics: '+err.message:
   'Import failed; your previous saved league was left unchanged: '+err.message,true);
 }finally{busy=false;await render()}
}
async function newUniverseState(){const next=initialState(),savedDefaults=await get('meta','customSettingsDefaults');if(savedDefaults?.value)next.settings={...clone(DEFAULTS),...clone(savedDefaults.value)};delete next.settings.goalTargetAnnualChange;return next}
async function resetAll(){if(!confirm('Delete this league and all its historical records? Download a backup first if you want to keep it.'))return;await clearAll();state=await newUniverseState();individualSeasonCache=null;teamGamesCache=null;teamGamesYear=null;teamGamesTeam=null;seasonScoringYear=null;seasonScoringStage='regular';await commitState();selectedSeason=null;view='dashboard';setBanner('New universe created. Your previous league was deleted.');await render()}
async function render(){if(view!=='teams')teamGamesCache=null;renderNav();$('banner').innerHTML=notice?`<div class="notice">${esc(notice)}</div>`:'';if(view==='dashboard')await dashboard();else if(view==='standings')await standings();else if(view==='playoffs')await playoffs();else if(view==='draft')draftView();else if(view==='generation')generationView();else if(view==='preview')await preseasonPreviewView();else if(view==='scoring')await seasonScoringView();else if(view==='commissioner')commissionerView();else if(view==='faq')faq();else if(view==='testing')testingInformation();else if(view==='alltime')await alltime();else if(view==='history')await history();else if(view==='teams')teams();else if(view==='players')await players();else if(view==='playerDetail')await playerProfile();else if(view==='customize')customize();else if(view==='settings')settings();$('season-label').textContent=state.regularSeason?'Regular: Season '+state.regularSeason.season:state.activeSeason?'Playoffs: Season '+state.activeSeason.season:(state.draft?'Draft: Season '+state.season:state.generation?'Generation: Season '+(state.season+1):preseasonPreviewRequired()?'Preview: Season '+(state.season+1):state.seasonComplete?'Season '+state.season+' Complete':'Next: Season '+fmt(state.season+1))}
function applyPlayerSearch(){playerQuery=$('player-search')?.value||'';playerPage=0;render()}
function handleClick(e){const singleTh=e.target.closest('th[data-single-season-sort]');if(singleTh){const k=singleTh.dataset.singleSeasonSort;if(singleSeasonSort===k)singleSeasonDescending=!singleSeasonDescending;else{singleSeasonSort=k;playerPage=0;singleSeasonDescending=!['name','teamId'].includes(k)}render();return}const playerTh=e.target.closest('th[data-player-sort]');if(playerTh){const k=playerTh.dataset.playerSort;if(playerSort===k)playerSortDescending=!playerSortDescending;else{playerSort=k;playerPage=0;playerSortDescending=!['name','teamId','origin','status'].includes(k)}render();return}const th=e.target.closest('th[data-sort]');if(th){const k=th.dataset.sort;if(sortBy===k)sortDescending=!sortDescending;else {sortBy=k;sortDescending=k!=='name'}render();return}if(e.target.closest('#team-game-details>summary, #team-player-details>summary, #team-alltime-summary')){loadTeamGameArchive();return}let btn=e.target.closest('button');if(!btn)return;if(btn.dataset.openDraft!==undefined){view='draft';notice='';render();return}if(btn.dataset.preseasonStart!==undefined){startSeasonFromPreview();return}if(btn.dataset.generationAction!==undefined){performGenerationAction(btn.dataset.generationAction);return}if(btn.dataset.draftAction!==undefined){performDraftAction(btn.dataset.draftAction);return}if(btn.dataset.draftPick!==undefined){performDraftAction('pick',Number(btn.dataset.draftPick));return}if(btn.dataset.continueOffseason!==undefined){state.seasonComplete=false;if(!state.draft&&!state.generation&&state.season>0&&state.generatedForSeason!==state.season+1)startGenerationStage();view=state.generation?'generation':'dashboard';commitState().then(()=>render()).catch(err=>setBanner('Could not save offseason: '+err.message,true));return}if(btn.dataset.player!==undefined){selectedPlayer=Number(btn.dataset.player);view='playerDetail';render();return}if(btn.dataset.playerPage!==undefined){playerPage=Math.max(0,Number(btn.dataset.playerPage));render();return}if(btn.id==='search-players'){applyPlayerSearch();return}if(btn.id==='clear-player-search'){playerQuery='';playerPage=0;render();return}if(btn.dataset.futureRightTransfer!==undefined){submitFutureRightTransfer();return}if(btn.dataset.commissionerSubmit!==undefined){commissionerSubmit();return}if(btn.dataset.regular!==undefined){runRegularSeason(btn.dataset.regular);return}if(btn.dataset.nextPlayoff){advancePlayoffs(btn.dataset.nextPlayoff);return}if(btn.dataset.liveSeries){const [round,i]=btn.dataset.liveSeries.split('-').map(Number);const div=$(`live-games-${round}-${i}`);if(!div)return;div.classList.toggle('hide');if(!div.classList.contains('hide')){const match=state.activeSeason?.rounds[round]?.[i];if(match)getIndexAll('games','bySeason',state.activeSeason.season).then(gs=>{let ids=new Set(match.gameIds);div.innerHTML=gameTable(gs.filter(g=>ids.has(g.id)))})}return}if(btn.dataset.saveTeam!==undefined){changeTeamName(Number(btn.dataset.saveTeam));return}if(btn.dataset.uploadLogo!==undefined){$('logo-input-'+btn.dataset.uploadLogo)?.click();return}if(btn.dataset.removeLogo!==undefined){removeTeamLogo(Number(btn.dataset.removeLogo));return}let nav=btn.dataset.nav;if(nav){view=nav;notice='';render();return}if(btn.dataset.team!==undefined){selectedTeam=Number(btn.dataset.team);view='teams';render();return}if(btn.dataset.run){runN(Number(btn.dataset.run));return}if(btn.id==='stopbtn'){cancelRun=true;btn.disabled=true;btn.textContent='Stopping after this season…';return}if(btn.dataset.year){selectedSeason=Number(btn.dataset.year);view='history';render();return}if(btn.dataset.series){let [r,i]=btn.dataset.series.split('-').map(Number),target=$(`series-games-${r}-${i}`);if(!target)return;target.classList.toggle('hide');if(!target.classList.contains('hide')){get('seasons',selectedSeason).then(s=>getIndexAll('games','bySeason',selectedSeason).then(gs=>{let ids=new Set(s.rounds[r][i].gameIds),matches=gs.filter(g=>ids.has(g.id));target.innerHTML=gameTable(matches)}));}return}if(btn.id==='reset-testing'){if(confirm('Reset Testing Information counters without deleting league results?')){state.testing=null;commitState().then(()=>render()).catch(err=>setBanner('Could not reset testing data: '+err.message,true))}return}if(btn.id==='set-default-settings'){saveSettings(true).catch(err=>setBanner('Could not set defaults: '+err.message,true));return}if(btn.id==='save-settings'||btn.dataset.saveSettings!==undefined){saveSettings().catch(err=>setBanner('Could not save settings: '+err.message,true));return}if(btn.id==='export'){exportBackup().catch(err=>setBanner('Export failed: '+err.message,true));return}if(btn.id==='import'){$('backup-input').click();return}if(btn.id==='reset'){resetAll();return}}
async function boot(){
 try{
  db=await openDB();
  const saved=await get('meta','main');
  state=saved?.value||await newUniverseState();
  state.settings={...clone(DEFAULTS),...(state.settings||{})};
  await hydrateTestingOutcomeHistory();
  state.version=3;state.activeSeason??=null;state.regularSeason??=null;state.transactions??=[];state.nextTransactionId??=state.transactions.length?Math.max(...state.transactions.map(t=>t.id))+1:1;futureRightsStore();
  futureRightsStore();state.seasonComplete??=false;state.previewConfirmedForSeason??=0;state.draft??=null;state.generation??=null;state.generatedForSeason??=null;state.upcomingDraftNotes??=[];
  // Upgrade a V1.4 pending guaranteed last-place draft to the new lottery.
  // Existing player histories and saved game scores remain unchanged.
  if(!state.draft&&!state.activeSeason&&Number.isInteger(state.pendingDraftTeam)&&state.season>0){
   const previous=await get('seasons',state.season);
   if(previous?.standings?.length===16){
    state.draft={season:state.season,phase:'lottery',eligible:previous.standings.slice(8).map(r=>r.id),lottery:null,prospects:null,picks:[]};
    state.pendingDraftTeam=null;
    await commitState();
   }
  }
  // V1.5 league imported/loaded mid-offseason: provide the new ceremony
  // instead of losing the players that old versions generated at season start.
  if(state.season>0&&!state.activeSeason&&!state.draft&&!state.generation&&
     !state.seasonComplete&&state.generatedForSeason!==state.season+1){
   startGenerationStage();
   await commitState();
  }
  if(!saved)await commitState();
  $('nav').addEventListener('click',handleClick);$('app').addEventListener('click',handleClick);$('app').addEventListener('change',e=>{
 if(e.target.dataset.logoInput!==undefined){
  const file=e.target.files?.[0];
  if(file)changeTeamLogo(Number(e.target.dataset.logoInput),file);
  e.target.value='';return;
 }
 if(e.target.id==='season-select'){selectedSeason=Number(e.target.value);render()}
 if(e.target.id==='team-select'){selectedTeam=Number(e.target.value);render()}
 if(e.target.id==='team-alltime-mode'){teamAllTimeMode=e.target.value;renderTeamAllTimeScorers();return}
 if(e.target.id==='team-game-season'||e.target.id==='team-player-season'){
  teamGamesYear=Number(e.target.value);renderTeamGameResults();renderTeamSeasonPlayerStats();return
 }
 if(e.target.id?.startsWith('future-right-')){futureRightFormChange(e.target.id.slice('future-right-'.length),e.target.value);return}
 if(e.target.id?.startsWith('commissioner-')){commissionerUpdateForm(e.target.id.slice('commissioner-'.length),e.target.value);return}
 if(e.target.id==='scoring-stage-select'){seasonScoringStage=e.target.value==='playoff'?'playoff':'regular';render();return}
 if(e.target.id==='scoring-season-select'){seasonScoringYear=Number(e.target.value);render();return}
 if(e.target.id==='player-history-mode'){playerHistoryMode=e.target.value==='season'?'season':'career';playerPage=0;render();return}
 if(e.target.id==='single-season-sort'){singleSeasonSort=e.target.value;playerPage=0;singleSeasonDescending=!['name','teamId'].includes(singleSeasonSort);render();return}
 if(e.target.id==='player-sort'){playerSort=e.target.value;playerPage=0;playerSortDescending=!['name','teamId','origin','status'].includes(playerSort);render()}
 if(e.target.id.startsWith('preview-effective-'))updateScoringEstimator();
});
$('app').addEventListener('input',e=>{
 if(e.target.dataset.weight!==undefined)updateOddsTotals();
 if(e.target.id==='cfg-unassistedPct'||e.target.id==='cfg-oneAssistPct')updateAssistStatus();
 if(e.target.id.startsWith('cfg-')||e.target.id.startsWith('preview-effective-'))updateScoringEstimator();
});
$('app').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('th[data-sort],th[data-player-sort],th[data-single-season-sort]')){e.preventDefault();e.target.click();return}if(e.key==='Enter'&&e.target.id==='player-search'){e.preventDefault();applyPlayerSearch();return}if(e.key==='Enter'&&e.target.dataset.teamName!==undefined){e.preventDefault();changeTeamName(Number(e.target.dataset.teamName))}});$('backup-input').addEventListener('change',e=>{let f=e.target.files[0];if(f)importBackup(f);e.target.value=''});await render()}catch(err){console.error(err);$('app').innerHTML=`<div class="notice warn">Unable to open local browser storage: ${esc(err.message)}. Try Chrome or Edge in a normal window, rather than private mode.</div>`}}
boot();
