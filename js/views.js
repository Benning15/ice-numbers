'use strict';
function titlebar(s,sub){$('title').textContent=s;$('subtitle').textContent=sub||'';$('season-label').textContent=state?'Next: Season '+fmt(state.season+1):'Loading'}
function setBanner(text,warning=false){notice=text;$('banner').innerHTML=text?`<div class="notice ${warning?'warn':''}">${esc(text)}</div>`:''}
function table(headers,rows,headersAreCells=false){return `<div class="tablewrap"><table><thead><tr>${headersAreCells?headers.join(''):headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function teamMark(id,large=false){const t=state.teams[id];const initials=t.name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();const logo=typeof t.logo==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(t.logo)?t.logo:null;return `<span class="team-mark ${large?'large':''}" aria-hidden="true">${logo?`<img src="${logo}" alt="">`:esc(initials)}</span>`}
function teamLabel(id){return `<span class="team-inline">${teamMark(id)}<span>${esc(state.teams[id].name)}</span></span>`}
function ratingHtml(p){
 const tone=p.ratingTier||(p.bonus===8&&effectiveRating(p)===10?'gold':p.bonus===8&&effectiveRating(p)===9?'silver':null);
 return '<span class="'+(tone==='gold'?'rating-gold':tone==='silver'?'rating-silver':'')+'">+'+fmt(p.bonus)+'</span>';
}
function teamLink(id){return `<button class="linkbtn" data-team="${id}">${teamLabel(id)}</button>`}
function renderNav(){ $('nav').innerHTML=Object.entries(TAB_NAMES).filter(([k])=>(k!=='draft'||!!state.draft)&&(k!=='generation'||!!state.generation)&&(k!=='preview'||preseasonPreviewAvailable())).map(([k,label])=>`<button class="navbtn ${(view===k||(view==='playerDetail'&&k==='players'))?'active':''}" data-nav="${k}">${label}</button>`).join('')}
function seasonRows(s){return s.standings.map(r=>`<tr class="${r.seed===8?'cutoff':''}"><td>${r.seed}${s.phase==='regular'&&r.move?'<span class="rank-move '+(r.move>0?'up':'down')+'">'+(r.move>0?'▲':'▼')+Math.abs(r.move)+'</span>':''}</td><td>${teamLink(r.id)}</td><td>${r.played}</td><td>${r.w}</td><td>${r.l}</td><td>${r.otl||0}</td><td><b>${r.points}</b></td><td>+${r.bonus}</td><td>${r.gf??'—'}</td><td>${r.ga??'—'}</td><td>${r.seed<=8?'<span class="pill">'+(s.phase==='regular'?'Top 8':'Playoffs')+'</span>':''}</td></tr>`)}
function standingsTable(s){return `<div class="standings-layout">${table(['#','Team','GP','W','L','OTL','PTS','Roster +','GF','GA',''],seasonRows(s))}</div>`}
function regularSeasonControls(){
 const r=state.regularSeason,n=r?r.nextGame:0,total=r?r.schedule.length:state.settings.gamesPerTeam*8;
 return '<div class="buttonrow regular-game-controls">'+
  '<button class="primary" data-regular="1" '+(busy?'disabled':'')+'>Sim 1 Game / Team</button>'+
  '<button class="primary" data-regular="10" '+(busy?'disabled':'')+'>Sim 10 Games / Team</button>'+
  '<button data-regular="all" '+(busy?'disabled':'')+'>Finish Regular Season</button>'+
  '<button data-nav="scoring">Player Scoring</button></div>'+
  (r?'<p class="sub tiny">League games played: '+fmt(n)+' / '+fmt(total)+'. Each click completes 1 or 10 scheduled rounds (8 or 80 total league games), giving every team the same number of games played.</p>':'<p class="sub tiny">Start with 1 or 10 games per team (8 or 80 total league games). You can also finish the regular season immediately.</p>');
}
function runButtons(){
 const current=state.activeSeason,regular=state.regularSeason;
 const primary=current?`<button class="primary" data-nav="playoffs">Continue Season ${current.season} playoffs</button><button data-nav="scoring">Season Scoring</button>`:
  regular?regularSeasonControls():
  state.seasonComplete?'<button class="primary" data-nav="playoffs">View Championship Celebration</button>':
  state.draft?'<button class="primary" data-nav="draft">Continue Draft Lottery</button>':
  state.generation?'<button class="primary" data-nav="generation">Continue Player Generation</button>':
  preseasonPreviewRequired()?'<button class="primary" data-nav="preview">View Preseason Team Preview</button>':
  regularSeasonControls();
 return `<div class="run-league-layout"><div class="run-league-regular">${primary}</div><div class="run-league-bulk"><div class="run-league-label">Full-season simulations</div>${[1,10,100,1000].map(n=>`<button data-run="${n}" ${busy?'disabled':''}>${n===1?'Simulate Full Season':`Simulate ${fmt(n)} Full Seasons`}</button>`).join('')}<button id="stopbtn" class="danger ${busy?'':'hide'}">Stop after current season</button></div></div>${busy?`<div class="progress"><div style="width:${progressPercent}%"></div></div><p class="sub tiny">${esc(progressText)}</p>`:''}`;
}
async function dashboard(){titlebar('League Dashboard','Build dynasties, endure droughts, discover history.');const active=state.regularSeason||state.activeSeason,last=active|| (state.season?await get('seasons',state.season):null),leader=[...state.teams].sort((a,b)=>b.titles-a.titles)[0];$('app').innerHTML=`<div class="cards"><div class="stat"><div class="sub tiny">Completed seasons</div><div class="big mono">${fmt(state.season)}</div></div><div class="stat"><div class="sub tiny">Games archived</div><div class="big mono">${fmt(state.totalGames)}</div></div><div class="stat"><div class="sub tiny">Current stage</div><div class="big">${active?(active.phase==='regular'?'Regular Season':'Playoffs'):state.draft?'Draft Lottery':state.generation?'Player Generation':preseasonPreviewRequired()?'Preseason Preview':state.seasonComplete?'Season Complete':'Offseason'}</div><div class="sub tiny">${active?'Season '+active.season:state.draft?'Three lottery teams will draft for Season '+(state.season+1):state.generation?'Generate players for Season '+(state.season+1):preseasonPreviewRequired()?'Review all 16 teams before Season '+(state.season+1):state.seasonComplete?'Season '+state.season+' champions crowned':'Ready for Season '+(state.season+1)}</div></div><div class="stat"><div class="sub tiny">Most championships</div><div class="big mono">${fmt(leader.titles)}</div><div class="sub tiny">${teamLabel(leader.id)}</div></div></div><div class="panel"><h2>Run the league</h2><p class="sub">Simulate regular season only, finish playoffs game-by-game, or fast-forward full seasons.</p>${runButtons()}</div><div class="panel"><div class="stickybar"><h2>${active?'Season '+active.season+(active.phase==='regular'?' — Live Standings':' — Final Regular-Season Standings'):last?'Season '+last.season+' — Final Standings':'League Standings'}</h2>${active?'<button data-nav="'+(active.phase==='regular'?'standings':'playoffs')+'">'+(active.phase==='regular'?'Live Standings':'Go to Playoff Bracket')+'</button>':''}</div>${last?standingsTable(last):'<p class="empty">Simulate a regular season to see all 16 teams here.</p>'}<p class="sub tiny" style="margin-top:9px">The line after 8th place marks the playoff cutoff.</p></div><div class="panel"><h3>Latest championship</h3>${state.season?`<p class="sub">Browse all finished championships and game-by-game playoff results in Season History.</p><div class="buttonrow"><button data-nav="history">Season History</button></div>`:'<p class="empty">Your league’s first championship is still waiting to happen.</p>'}</div>`}
async function standings(){
 const live=state.regularSeason,playoff=state.activeSeason;
 const current=live||playoff;
 const last=current||(state.season?await get('seasons',state.season):null);
 const sub=live?'Season '+live.season+' — '+live.nextGame+' / '+live.schedule.length+' league games played':
  last?'Final regular-season standings — Season '+last.season:'Waiting for Season 1';
 titlebar('Standings',sub);
 const recent=live?.lastGames?.length?'<div class="panel"><h3>Latest simulated games</h3>'+
  table(['Matchup','Final','Result'],live.lastGames.map(g=>'<tr><td>'+teamLabel(g.aId)+' vs '+teamLabel(g.bId)+'</td><td><b>'+g.scoreA+'–'+g.scoreB+'</b></td><td>'+(g.coin?'OT':'Regulation')+'</td></tr>'))+'</div>':'';
 $('app').innerHTML='<div class="panel"><div class="stickybar"><h2>'+(live?'Live standings · Season '+live.season:'Full 16-team standings')+'</h2>'+
  '<button data-nav="scoring">View Player Scoring</button></div>'+
  (live?regularSeasonControls():(playoff?'<div class="buttonrow"><button class="primary" data-nav="playoffs">Continue to Playoffs</button></div>':''))+
  (last?standingsTable(last):'<p class="empty">No regular season played yet.</p>')+'</div>'+recent+
  '<div class="notice">Top eight teams qualify for the playoffs when all regular-season games are complete. W = 2 points; OTL = 1 point; L = 0.</div>';
}
function currentSeriesBlock(m,round,i){const done=m.winnerId!==null;return `<div class="series"><div class="stickybar"><span><b>${teamLabel(m.aId)}</b> <strong class="mono">${m.winsA}</strong></span><span class="pill ${done?'gold':''}">${done?'FINAL':'LIVE'}</span></div><div class="stickybar"><span><b>${teamLabel(m.bId)}</b> <strong class="mono">${m.winsB}</strong></span><span class="sub tiny">Goals decide games</span></div><p class="sub tiny" style="margin-top:8px">${done?`Winner: ${esc(state.teams[m.winnerId].name)}`:`Next: Game ${m.gameIds.length+1}`}</p>${m.gameIds.length?`<button class="linkbtn" data-live-series="${round}-${i}">View ${m.gameIds.length} game results</button><div id="live-games-${round}-${i}" class="hide"></div>`:''}</div>`}
async function playoffs(){const a=state.activeSeason;titlebar('Playoff Bracket',a?`Season ${a.season} — ${['Quarterfinals','Semifinals','Championship Final'][a.round]}`:'No playoffs in progress');if(!a){if(state.regularSeason){$('app').innerHTML='<div class="panel"><h2>Regular season still in progress</h2><button class="primary" data-nav="standings">Live Standings</button></div>';return}if(state.seasonComplete){await championshipView();return}$('app').innerHTML=`<div class="panel"><h2>Playoffs</h2><p class="sub">Simulate the regular season on the Dashboard to create a live playoff bracket.</p><div class="buttonrow"><button data-nav="dashboard">Go to Dashboard</button></div></div>`;return}
$('app').innerHTML=`<div class="panel"><h2>Simulate playoffs</h2><p class="sub">Each click on the next-game button plays one game in every unfinished series of the current round. The first team to four wins advances.</p><div class="buttonrow"><button class="primary" data-next-playoff="next" ${busy?'disabled':''}>Simulate Next Game in Every Series</button><button data-next-playoff="round" ${busy?'disabled':''}>Finish Current Round</button><button data-next-playoff="all" ${busy?'disabled':''}>Finish Entire Playoffs</button></div><p class="help" style="margin-top:10px">Saved after every click. You can safely close the browser and return to this bracket.</p></div><div class="rounds">${a.rounds.map((round,i)=>`<div class="panel"><h3>${['Quarterfinals','Semifinals','Championship Final'][i]} ${i===a.round?'• In progress':'• Complete'}</h3>${round.map((m,k)=>currentSeriesBlock(m,i,k)).join('')}</div>`).join('')}</div><div class="panel"><h3>Regular-season seeding</h3>${standingsTable(a)}</div>`}
function faq(){
 titlebar('FAQ — Game Rules','How goal-driven Ice Numbers decides games, points and championships.');
 $('app').innerHTML='<div class="panel"><h2>Games and overtime</h2>'+
 '<p class="record">Sixteen teams play 30, 45 or 60 regular-season games. Every game begins 0–0. Named players and unidentified teammates independently roll for goals. Strong named players also roll for playmaking goals credited to teammates.</p>'+
 '<p class="record">Actual goals decide who wins in regulation. Any tied score is decided by a completely fair 50/50 coin flip, with no advantage for talent or playoff seed. The winner receives one additional overtime goal plus 0–2 eligible assists. A regular-season overtime loss earns one point.</p>'+
 '<p class="record">Every successful playmaking roll adds exactly one goal; the creator gets a primary assist. Additional secondary assists never generate another goal. No player can assist their own goal.</p>'+
 '<p class="record">Individual goal/assist tendencies start at 50/50 by default and can be varied for newly generated players in Settings. Ratings and annual hidden motivation affect goal and playmaking chances. A +8 base-rated player with a +9 or +10 effective rating gets a silver or gold +8 marker.</p></div>'+
 '<div class="panel"><h2>Playoffs</h2><p class="record">The top eight qualify for three best-of-seven rounds. Playoff matches use the same scoring engine as the regular season. There are no playoff seeding bonuses. Ties always use a 50/50 overtime coin flip, followed by a scored overtime goal.</p></div>'+
 '<div class="panel"><h2>Players and history</h2><p class="record">Teams can have up to five named players (+1 to +8 base), plus an unidentified roster. Unidentified players have more independent opportunities when named stars take less ice time. Three of the eight non-playoff teams win equal-odds lottery picks. Four prospects appear, one completely concealed; selected ratings are revealed after each pick. After the draft, all 16 teams are ranked by base +. Every team, including teams with full rosters, is eligible for random generation. A Settings toggle determines whether an original team can be drawn multiple times in the same offseason. A full team replaces its weakest player if the generated player has a higher base +, or is younger with the same +; the loser is marked Cut. Hidden Motivation does not affect roster decisions. Commissioner Mode lets you transfer players to teams with space, swap one player for another between teams, or mark a player Cut during the offseason. All changes are saved in player and league transaction histories. Named player careers are limited to the configured maximum.</p>'+
 '<p class="record">All goals, primary and secondary assists, player careers, regular-season records and championships are archived. The Testing Information tab shows the real measured averages from your simulations and 100/1,000-season checkpoints.</p></div>';
}
const ALL_KEYS=[['regW','Regular wins'],['regL','Regular losses'],['regOTL','Regular OTL'],['pointsFor','Goals for'],['pointsAgainst','Goals against'],['regPoints','Regular points'],['winpct','Win %'],['titles','Championships'],['finals','Finals'],['playoffApps','Playoff appearances'],['missedPlayoffs','Missed playoffs'],['bestPlayoffStreak','Longest playoff streak'],['bestMissStreak','Longest missed-playoff streak'],['bestTitleStreak','Longest title streak'],['longestTitleDrought','Longest title drought'],['lastPlaces','Last-place finishes'],['regCoinW','Coin wins'],['regCoinL','Coin losses'],['playoffSeriesW','Playoff series wins'],['playoffSeriesL','Playoff series losses'],['teamBonusTotal','Total Team +']];
function av(t,key){return key==='winpct'?t.regW/(t.regW+t.regL+(t.regOTL||0)||1):t[key]||0}
// Add each season's effective, capped regular-season roster bonus. Archived
// standings already hold this number, so old saves work without migration.
function teamBonusTotals(seasons,active){
 const totals=state.teams.map(()=>0);
 const recorded=new Set();
 for(const season of seasons){
  recorded.add(season.season);
  for(const row of season.standings||[])if(Number.isFinite(row.bonus)&&totals[row.id]!==undefined)totals[row.id]+=row.bonus;
 }
 // Regular season results are in the franchise totals even before the playoffs
 // finish. Count the in-progress season once, never twice.
 if(active&&!recorded.has(active.season)){
  for(const row of active.standings||[])if(Number.isFinite(row.bonus)&&totals[row.id]!==undefined)totals[row.id]+=row.bonus;
 }
 return totals;
}
async function alltime(){
 titlebar('All-Time Franchise Records','Sort any column. Every season adds to the historical totals.');
 $('app').innerHTML='<div class="panel"><p class="sub">Loading franchise history…</p></div>';
 const seasons=await getAll('seasons');
 if(view!=='alltime')return;
 const bonusTotals=teamBonusTotals(seasons,state.activeSeason);
 const items=state.teams.map(t=>({...t,teamBonusTotal:bonusTotals[t.id]})).sort((a,b)=>sortBy==='name'?(sortDescending?b.name.localeCompare(a.name):a.name.localeCompare(b.name)):(sortDescending?1:-1)*(av(b,sortBy)-av(a,sortBy))||a.id-b.id);
 const columns=['name',...ALL_KEYS.map(x=>x[0])];
 const heads=columns.map(key=>`<th class="sort" data-sort="${key}" tabindex="0" role="button">${key==='name'?'Team':ALL_KEYS.find(x=>x[0]===key)?.[1]}${sortBy===key?(sortDescending?' ▼':' ▲'):''}</th>`);
 const rows=items.map(t=>`<tr><td>${teamLink(t.id)}</td>${ALL_KEYS.map(([key])=>`<td>${key==='winpct'?pct(t.regW,t.regW+t.regL+(t.regOTL||0)):key==='teamBonusTotal'?'+'+fmt(t[key]):fmt(t[key])}</td>`).join('')}</tr>`);
 $('app').innerHTML=`<div class="panel"><div class="stickybar"><h2>Complete league comparison</h2><span class="pill gold">${fmt(state.season)} seasons</span></div><p class="sub tiny" style="margin-bottom:12px">Scroll sideways for every record. Clicking any heading sorts the table. Total Team + adds each season's capped regular-season roster bonus, including a regular season currently in playoffs.</p><div class="tablewrap"><table><thead><tr>${heads.join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div></div>`;
}
function gameTable(gs){
 return table(['Game','Team +','Final score','Result','Winner','Goal scorers'],
  gs.map(g=>'<tr><td>'+g.gameNo+'</td><td>+'+g.bonusA+' / +'+g.bonusB+'</td><td>'+g.scoreA+'–'+g.scoreB+
  '</td><td>'+(g.coin?'OT coin flip':'Regulation')+'</td><td>'+teamLabel(g.winnerId)+
  '</td><td><details><summary>Goals / Assists</summary>'+(g.goalEvents||[]).map(p=>'<p class="record">'+
   esc(state.teams[p.teamId]?.name||'Team')+': '+scoringPlayerLinks(p)+(p.otGoal?' <b>(OT)</b>':'')+'</p>').join('')+
  '</details></td></tr>'));
}
function seriesBlock(m,round,i){let w=state.teams[m.winnerId].name;return `<div class="series"><div><b>${teamLabel(m.aId)}</b> (${m.winsA}) <span class="sub">vs</span> <b>${teamLabel(m.bId)}</b> (${m.winsB})</div><div class="sub tiny">Winner: ${esc(w)} · Goals decide games</div><button class="linkbtn" data-series="${round}-${i}">View ${m.gameIds.length} games</button><div id="series-games-${round}-${i}" class="hide"></div></div>`}
async function history(){titlebar('Season History','Every champion, standings table and playoff series permanently archived.');let n=selectedSeason||state.season;if(n>state.season)n=state.season;selectedSeason=n;let s=n?await get('seasons',n):null;let opts='';const championshipSeasons=await getAll('seasons');if(view!=='history')return;if(state.season<=400){for(let i=state.season;i>=1;i--)opts+=`<option value="${i}" ${i===n?'selected':''}>Season ${i}</option>`}else{let choices=new Set([n,1,...Array.from({length:60},(_,i)=>state.season-i)]);opts=[...choices].filter(x=>x>0).sort((a,b)=>b-a).map(i=>`<option value="${i}" ${i===n?'selected':''}>Season ${i}</option>`).join('')}
$('app').innerHTML=`<div class="panel"><details class="championship-history-details"><summary>All Championships &amp; Runners-Up (${fmt(championshipSeasons.length)})</summary><p class="sub tiny" style="margin:10px 0">Browse all champions and consecutive finals appearances.</p>${championshipHistoryTable(championshipSeasons)}</details></div><div class="panel"><div class="stickybar"><h2>Archived seasons</h2><div class="seasonpick"><button data-year="${Math.max(1,n-1)}" ${n<=1?'disabled':''}>←</button><select id="season-select" class="select">${opts}</select><button data-year="${Math.min(state.season,n+1)}" ${n>=state.season?'disabled':''}>→</button></div></div>${s?`<div class="cards" style="margin-top:14px"><div class="stat"><div class="sub tiny">Champion</div>${teamLabel(s.championId)}</div><div class="stat"><div class="sub tiny">Runner-up</div>${teamLabel(s.runnerUpId)}</div><div class="stat"><div class="sub tiny">Last place</div>${teamLabel(s.lastId)}</div><div class="stat"><div class="sub tiny">Coin-flip games</div><div class="big">${s.coinCount}</div></div></div>`:'<p class="empty">No archived seasons yet.</p>'}</div>${s?`<div class="panel"><h2>Season ${s.season} standings</h2>${table(['#','Team','GP','W','L','OTL','PTS','Roster +','GF','GA',''],seasonRows(s))}</div><div class="panel"><h2>Playoff bracket</h2><div class="rounds">${s.rounds.map((round,i)=>`<div><h3>${['Quarterfinals','Semifinals','Championship Final'][i]}</h3>${round.map((m,k)=>seriesBlock(m,i,k)).join('')}</div>`).join('')}</div></div>${seasonRosterPanel(s)}<div class="panel"><details><summary>Player generation, drafts, and retirements (${s.events.length})</summary><div style="padding-top:12px">${s.events.map(x=>`<p class="record">${esc(x)}</p>`).join('')}</div></details></div>`:''}`}
