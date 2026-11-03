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
function renderNav(){ $('nav').innerHTML=Object.entries(TAB_NAMES).map(([k,label])=>`<button class="navbtn ${(view===k||(view==='playerDetail'&&k==='players'))?'active':''}" data-nav="${k}">${label}</button>`).join('')}
function seasonRows(s){return s.standings.map(r=>`<tr class="${r.seed===8?'cutoff':''}"><td>${r.seed}</td><td>${teamLink(r.id)}</td><td>${r.played}</td><td>${r.w}</td><td>${r.l}</td><td>${r.otl||0}</td><td><b>${r.points}</b></td><td>+${r.bonus}</td><td>${r.gf??'—'}</td><td>${r.ga??'—'}</td><td>${r.seed<=8?'<span class="pill">Playoffs</span>':''}</td></tr>`)}
function standingsTable(s){return `<div class="standings-layout">${table(['#','Team','GP','W','L','OTL','PTS','Roster +','GF','GA',''],seasonRows(s))}</div>`}
function runButtons(){const current=state.activeSeason;return `<div class="run-league-layout"><div class="run-league-regular">${current?`<button class="primary" data-nav="playoffs">Continue Season ${current.season} playoffs</button>`:state.seasonComplete?'<button class="primary" data-nav="playoffs">View Championship Celebration</button>':`<button class="primary" data-regular="1" ${busy?'disabled':''}>Simulate Regular Season</button>`}</div><div class="run-league-bulk"><div class="run-league-label">Full-season simulations</div>${[1,10,100,1000].map(n=>`<button data-run="${n}" ${busy?'disabled':''}>${n===1?'Simulate Full Season':`Simulate ${fmt(n)} Full Seasons`}</button>`).join('')}<button id="stopbtn" class="danger ${busy?'':'hide'}">Stop after current season</button></div></div>${busy?`<div class="progress"><div style="width:${progressPercent}%"></div></div><p class="sub tiny">${esc(progressText)}</p>`:''}`}
async function dashboard(){titlebar('League Dashboard','Build dynasties, endure droughts, discover history.');const active=state.activeSeason,last=active|| (state.season?await get('seasons',state.season):null),leader=[...state.teams].sort((a,b)=>b.titles-a.titles)[0];$('app').innerHTML=`<div class="cards"><div class="stat"><div class="sub tiny">Completed seasons</div><div class="big mono">${fmt(state.season)}</div></div><div class="stat"><div class="sub tiny">Games archived</div><div class="big mono">${fmt(state.totalGames)}</div></div><div class="stat"><div class="sub tiny">Current stage</div><div class="big">${active?'Playoffs':state.seasonComplete?'Season Complete':'Offseason'}</div><div class="sub tiny">${active?'Season '+active.season:state.seasonComplete?'Season '+state.season+' champions crowned':'Ready for Season '+(state.season+1)}</div></div><div class="stat"><div class="sub tiny">Most championships</div><div class="big mono">${fmt(leader.titles)}</div><div class="sub tiny">${teamLabel(leader.id)}</div></div></div><div class="panel"><h2>Run the league</h2><p class="sub">Simulate regular season only, finish playoffs game-by-game, or fast-forward full seasons.</p>${runButtons()}</div><div class="panel"><div class="stickybar"><h2>${active?'Season '+active.season+' — Final Regular-Season Standings':last?'Season '+last.season+' — Final Standings':'League Standings'}</h2>${active?'<button data-nav="playoffs">Go to Playoff Bracket</button>':''}</div>${last?standingsTable(last):'<p class="empty">Simulate a regular season to see all 16 teams here.</p>'}<p class="sub tiny" style="margin-top:9px">The line after 8th place marks the playoff cutoff.</p></div><div class="panel"><h3>Latest championship</h3>${state.season?`<p class="sub">Browse all finished championships and game-by-game playoff results in Season History.</p><div class="buttonrow"><button data-nav="history">Season History</button></div>`:'<p class="empty">Your league’s first championship is still waiting to happen.</p>'}</div>`}
async function standings(){const last=state.activeSeason||(state.season?await get('seasons',state.season):null);titlebar('Standings',last?`Final regular season — Season ${last.season}`:'Waiting for Season 1');$('app').innerHTML=`<div class="panel"><h2>Full 16-team standings</h2>${last?standingsTable(last):'<p class="empty">No regular season played yet.</p>'}</div><div class="notice">Top eight make the playoffs. 16th place gets the next special draft pick. W = 2 points; OTL = 1 point; L = 0.</div>`}
function currentSeriesBlock(m,round,i){const done=m.winnerId!==null;return `<div class="series"><div class="stickybar"><span><b>${teamLabel(m.aId)}</b> <strong class="mono">${m.winsA}</strong></span><span class="pill ${done?'gold':''}">${done?'FINAL':'LIVE'}</span></div><div class="stickybar"><span><b>${teamLabel(m.bId)}</b> <strong class="mono">${m.winsB}</strong></span><span class="sub tiny">Goals decide games</span></div><p class="sub tiny" style="margin-top:8px">${done?`Winner: ${esc(state.teams[m.winnerId].name)}`:`Next: Game ${m.gameIds.length+1}`}</p>${m.gameIds.length?`<button class="linkbtn" data-live-series="${round}-${i}">View ${m.gameIds.length} game results</button><div id="live-games-${round}-${i}" class="hide"></div>`:''}</div>`}
async function playoffs(){const a=state.activeSeason;titlebar('Playoff Bracket',a?`Season ${a.season} — ${['Quarterfinals','Semifinals','Championship Final'][a.round]}`:'No playoffs in progress');if(!a){if(state.seasonComplete){await championshipView();return}$('app').innerHTML=`<div class="panel"><h2>Playoffs</h2><p class="sub">Simulate the regular season on the Dashboard to create a live playoff bracket.</p><div class="buttonrow"><button data-nav="dashboard">Go to Dashboard</button></div></div>`;return}
$('app').innerHTML=`<div class="panel"><h2>Simulate playoffs</h2><p class="sub">Each click on the next-game button plays one game in every unfinished series of the current round. The first team to four wins advances.</p><div class="buttonrow"><button class="primary" data-next-playoff="next" ${busy?'disabled':''}>Simulate Next Game in Every Series</button><button data-next-playoff="round" ${busy?'disabled':''}>Finish Current Round</button><button data-next-playoff="all" ${busy?'disabled':''}>Finish Entire Playoffs</button></div><p class="help" style="margin-top:10px">Saved after every click. You can safely close the browser and return to this bracket.</p></div><div class="rounds">${a.rounds.map((round,i)=>`<div class="panel"><h3>${['Quarterfinals','Semifinals','Championship Final'][i]} ${i===a.round?'• In progress':'• Complete'}</h3>${round.map((m,k)=>currentSeriesBlock(m,i,k)).join('')}</div>`).join('')}</div><div class="panel"><h3>Regular-season seeding</h3>${standingsTable(a)}</div>`}
function faq(){
 titlebar('FAQ — Game Rules','How goal-driven Ice Numbers decides games, points and championships.');
 $('app').innerHTML='<div class="panel"><h2>Games and overtime</h2>'+
 '<p class="record">Sixteen teams play 30, 45 or 60 regular-season games. Every game begins 0–0. Named players and unidentified teammates independently roll for goals. Strong named players also roll for playmaking goals credited to teammates.</p>'+
 '<p class="record">Actual goals decide who wins in regulation. Any tied score is decided by a completely fair 50/50 coin flip, with no advantage for talent or playoff seed. The winner receives one additional overtime goal plus 0–2 eligible assists. A regular-season overtime loss earns one point.</p>'+
 '<p class="record">Every successful playmaking roll adds exactly one goal; the creator gets a primary assist. Additional secondary assists never generate another goal. No player can assist their own goal.</p>'+
 '<p class="record">Individual goal/assist tendencies start at 50/50 by default and can be varied for newly generated players in Settings. Ratings and annual hidden motivation affect goal and playmaking chances. A +8 base-rated player with a +9 or +10 effective rating gets a silver or gold +8 marker.</p></div>'+
 '<div class="panel"><h2>Playoffs</h2><p class="record">The top eight qualify for three best-of-seven rounds. Playoff matches use the same scoring engine as the regular season. There are no playoff seeding bonuses. Ties always use a 50/50 overtime coin flip, followed by a scored overtime goal.</p></div>'+
 '<div class="panel"><h2>Players and history</h2><p class="record">Teams can have up to three named players (+1 to +8 base), plus an unidentified roster. Unidentified players have more independent opportunities when named stars take less ice time. The last-place team gets an improved draft, and incomplete rosters can spawn one player per season. Named player careers are limited to the configured maximum.</p>'+
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
function teamDetail(){let t=state.teams[selectedTeam];titlebar(t.name,'Roster and franchise history — names and logos can be changed in Team Customization');$('app').innerHTML=`<div class="buttonrow" style="margin:0 0 15px"><select id="team-select" class="select">${state.teams.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="cards"><div class="stat"><span class="sub tiny">All-time W–L–OTL</span><div class="big">${fmt(t.regW)}–${fmt(t.regL)}–${fmt(t.regOTL||0)}</div></div><div class="stat"><span class="sub tiny">Championships</span><div class="big">${fmt(t.titles)}</div></div><div class="stat"><span class="sub tiny">Playoff appearances</span><div class="big">${fmt(t.playoffApps)}</div></div><div class="stat"><span class="sub tiny">Longest drought</span><div class="big">${fmt(t.longestTitleDrought)}</div></div></div><div class="split"><div class="panel"><h2>Active roster (${t.roster.length}/${state.settings.maxRoster})</h2>${t.roster.length?table(['Player','Rating','Year','Origin'],t.roster.map(p=>`<tr><td>${playerLink(p)}</td><td>+${p.bonus}</td><td>${p.year}/${state.settings.careerLength}</td><td>${p.origin}</td></tr>`)):'<p class="empty">No active players</p>'}<p class="sub tiny">Combined team rating: +${bonusOf(t)} (uncapped)</p></div><div class="panel"><h2>Franchise streaks</h2>${[['Current playoff streak',t.currentPlayoffStreak],['Longest playoff streak',t.bestPlayoffStreak],['Current missed-playoff streak',t.currentMissStreak],['Longest missed-playoff streak',t.bestMissStreak],['Longest championship streak',t.bestTitleStreak],['Current title drought',t.titleDrought],['Most consecutive last places',t.bestFirstStreak],['Longest regular-season win streak',t.bestRegWinStreak],['Longest regular-season loss streak',t.bestRegLossStreak]].map(([k,v])=>`<p class="record">${k}: <b class="mono">${fmt(v)}</b></p>`).join('')}</div></div><div class="panel"><details class="team-history-section" open><summary>Season-by-season franchise history</summary><div id="team-seasons" class="sub">Loading archive…</div></details></div><div class="panel"><h2>Head-to-head records (regular season)</h2><div id="team-h2h" class="sub">Loading individual game results…</div></div>`;loadTeamRecords(t.id)}
async function loadTeamRecords(id){let seasons=await getAll('seasons');if(view!=='teams'||selectedTeam!==id)return;let records=seasons.map(s=>{let r=s.standings.find(x=>x.id===id);return {season:s.season,seed:r.seed,w:r.w,l:r.l,otl:r.otl||0,points:r.points,bonus:r.bonus,playoffs:r.seed<=8,champ:s.championId===id}}).reverse();$('team-seasons').innerHTML=records.length?`<p class="sub tiny" style="margin:10px 0 8px">${fmt(records.length)} archived season${records.length===1?'':'s'}${records.length>10?' · scroll to see earlier seasons':''}</p><div class="team-season-scroll">${table(['Year','Finish','W','L','OTL','PTS','Roster +','Playoffs','Title'],records.map(r=>`<tr><td><button class="linkbtn" data-year="${r.season}">${r.season}</button></td><td>${r.seed}</td><td>${r.w}</td><td>${r.l}</td><td>${r.otl}</td><td>${r.points}</td><td>+${r.bonus}</td><td>${r.playoffs?'Yes':'No'}</td><td>${r.champ?'🏆':''}</td></tr>`))}</div>`:'No history yet.';
let games=await getIndexAll('games','byTeam',id);if(view!=='teams'||selectedTeam!==id)return;let vs=state.teams.filter(t=>t.id!==id).map(t=>({id:t.id,w:0,l:0,otl:0,coinW:0,coinL:0}));let map=Object.fromEntries(vs.map(x=>[x.id,x]));for(let g of games){if(g.stage!=='regular')continue;let opp=g.aId===id?g.bId:g.aId,item=map[opp];if(!item)continue;if(g.winnerId===id)item.w++;else if(g.coin)item.otl++;else item.l++;if(g.coin){g.winnerId===id?item.coinW++:item.coinL++}}$('team-h2h').innerHTML=table(['Opponent','W','L','OTL','Win %','Coin W-L'],vs.sort((a,b)=>b.w-a.w).map(r=>`<tr><td>${teamLink(r.id)}</td><td>${r.w}</td><td>${r.l}</td><td>${r.otl}</td><td>${pct(r.w,r.w+r.l+r.otl)}</td><td>${r.coinW}-${r.coinL}</td></tr>`))}
function teams(){teamDetail()}
let playerSortDescending=true;
let playerHistoryMode='career',singleSeasonSort='regPoints',singleSeasonDescending=true;
let individualSeasonCache=null;
const INDIVIDUAL_SEASON_COLUMNS=[
 ['season','Season'],['name','Player'],['teamId','Team'],['bonus','+'],['year','Career Yr'],
 ['regGames','GP'],['regGoals','G'],['regAssists','A'],['regPoints','PTS'],['pointsPerGame','P/GP'],
 ['playoffGames','PO GP'],['playoffGoals','PO G'],['playoffAssists','PO A'],['playoffPoints','PO PTS'],['champion','Title']
];
const INDIVIDUAL_SEASON_OPTIONS=[
 ['regPoints','Regular-season points'],['regGoals','Regular-season goals'],['regAssists','Regular-season assists'],
 ['pointsPerGame','Regular-season P/GP'],['regGames','Games played'],['playoffPoints','Playoff points'],
 ['playoffGoals','Playoff goals'],['playoffAssists','Playoff assists'],['season','Season'],
 ['name','Player'],['teamId','Team'],['bonus','Rating'],['year','Career year'],['champion','Championships']
];
function playerHistoryModeSelect(){
 return '<label class="sub tiny" for="player-history-mode">View</label><select class="select" id="player-history-mode"><option value="career" '+(playerHistoryMode==='career'?'selected':'')+'>Combined Seasons (Career)</option><option value="season" '+(playerHistoryMode==='season'?'selected':'')+'>Individual Seasons</option></select>';
}
function individualSeasonValue(r,key){
 if(key==='name')return r.name;
 if(key==='teamId')return state.teams[r.teamId]?.name||'';
 if(key==='regPoints')return r.regular.complete?r.regular.g+r.regular.a:null;
 if(key==='regGoals')return r.regular.complete?r.regular.g:null;
 if(key==='regAssists')return r.regular.complete?r.regular.a:null;
 if(key==='pointsPerGame')return r.regular.complete&&r.regular.gp?(r.regular.g+r.regular.a)/r.regular.gp:null;
 if(key==='regGames')return r.regular.gp;
 if(key==='playoffPoints')return r.playoff.complete?r.playoff.g+r.playoff.a:null;
 if(key==='playoffGoals')return r.playoff.complete?r.playoff.g:null;
 if(key==='playoffAssists')return r.playoff.complete?r.playoff.a:null;
 if(key==='playoffGames')return r.playoff.gp;
 if(key==='champion')return r.champion?1:0;
 return r[key]??0;
}
function individualSeasonCompare(a,b){
 const x=individualSeasonValue(a,singleSeasonSort),y=individualSeasonValue(b,singleSeasonSort);
 if(x===null||y===null)return x===null&&y===null?(b.season-a.season||a.id-b.id):(x===null?1:-1);
 const cmp=typeof x==='string'?x.localeCompare(y):x-y;
 return (singleSeasonDescending?-cmp:cmp)||b.season-a.season||a.id-b.id;
}
function individualSeasonHeading(key,label){
 const active=singleSeasonSort===key;
 return '<th class="sort" data-single-season-sort="'+key+'" tabindex="0" role="button" aria-sort="'+(active?(singleSeasonDescending?'descending':'ascending'):'none')+'">'+esc(label)+(active?(singleSeasonDescending?' ▼':' ▲'):'')+'</th>';
}
function individualSeasonStatCell(r,key){
 const value=individualSeasonValue(r,key);
 return '<td>'+(value===null?'—':key==='pointsPerGame'?value.toFixed(2):fmt(value))+'</td>';
}
// Compute single-season performances from the actual stored scoring plays,
// rather than current career totals. Works on old archives without migration.
// Only the currently examined season's games are loaded into memory at once.
async function rebuildIndividualSeasonCache(key){
 const archives=await getAll('seasons');
 const active=state.activeSeason;
 const seasons=archives.slice();
 if(active&&!seasons.some(s=>s.season===active.season))seasons.push(active);
 seasons.sort((a,b)=>a.season-b.season);
 const all=[];
 for(let i=0;i<seasons.length;i++){
  if(view!=='players'||playerHistoryMode!=='season')return null;
  const season=seasons[i],byId=new Map(),byTeam=new Map();
  for(const [id,list] of Object.entries(season.rosters||{})){
   const teamId=Number(id),team=[];
   for(const p of list){
    const row={id:p.id,name:p.name||'Player '+p.id,season:season.season,teamId,
     bonus:p.bonus??0,year:p.year??'—',champion:!active||active.season!==season.season?season.championId===teamId:false,
     partial:!!(active&&active.season===season.season),
     regular:{gp:0,g:0,a:0,complete:true},playoff:{gp:0,g:0,a:0,complete:true}};
    byId.set(p.id,row);team.push(row);all.push(row);
   }
   byTeam.set(teamId,team);
  }
  const games=await getIndexAll('games','bySeason',season.season);
  for(const game of games){
   const stage=game.stage==='playoff'?'playoff':'regular';
   const aId=game.aId??game.teamIds?.[0],bId=game.bId??game.teamIds?.[1];
   const participants=[...(byTeam.get(aId)||[]),...(byTeam.get(bId)||[])];
   for(const r of participants)r[stage].gp++;
   if(!Array.isArray(game.goalEvents)){
    for(const r of participants)r[stage].complete=false;
    continue;
   }
   for(const play of game.goalEvents){
    const scorer=byId.get(play.scorerId);
    if(scorer&&scorer.teamId===play.teamId)scorer[stage].g++;
    for(const id of play.assistIds||[]){
     const assister=byId.get(id);
     if(assister&&assister.teamId===play.teamId)assister[stage].a++;
    }
   }
  }
  if(i%20===0&&i>0){const el=$('individual-season-loading');if(el)el.textContent='Reading archived scoring plays: '+fmt(i+1)+' / '+fmt(seasons.length)+' seasons…'}
 }
 individualSeasonCache={key,rows:all};
 return all;
}
async function individualSeasonRecords(){
 const key=state.season+':'+state.totalGames+':'+(state.activeSeason?.gameCount??0)+':'+state.nextPlayerId;
 if(individualSeasonCache?.key===key)return individualSeasonCache.rows;
 return await rebuildIndividualSeasonCache(key);
}
async function playerIndividualSeasons(){
 titlebar('Player History','Discover the greatest individual seasons, including unexpected statistical outliers.');
 $('app').innerHTML='<div class="panel"><h2>Individual Seasons</h2><p class="sub" id="individual-season-loading">Loading archived season performances…</p></div>';
 const rows=await individualSeasonRecords();
 if(!rows||view!=='players'||playerHistoryMode!=='season')return;
 const search=playerQuery.trim().toLowerCase();
 rows.sort(individualSeasonCompare);
 const top=rows.slice(0,1000);
 const pool=search?rows.filter(r=>r.name.toLowerCase().includes(search)||(state.teams[r.teamId]?.name||'').toLowerCase().includes(search)):top;
 const perPage=100,pages=Math.max(1,Math.ceil(pool.length/perPage));
 playerPage=Math.max(0,Math.min(playerPage,pages-1));
 const start=playerPage*perPage;
 const shown=pool.slice(start,start+perPage);
 const data=shown.map(r=>'<tr><td>'+(r.partial?'<span class="sub">Season '+fmt(r.season)+' (live)</span>':'<button class="linkbtn" data-year="'+r.season+'">Season '+fmt(r.season)+'</button>')+'</td><td><button class="linkbtn" data-player="'+r.id+'">'+esc(r.name)+'</button></td><td>'+teamLink(r.teamId)+'</td><td>+'+fmt(r.bonus)+'</td><td>'+esc(r.year)+'</td>'+['regGames','regGoals','regAssists','regPoints','pointsPerGame','playoffGames','playoffGoals','playoffAssists','playoffPoints'].map(k=>individualSeasonStatCell(r,k)).join('')+'<td>'+(r.champion?'🏆':r.partial?'<span class="sub tiny">Live</span>':'')+'</td></tr>');
 const pagination='<div class="player-pages"><span class="sub tiny">Showing '+(pool.length?fmt(start+1):'0')+'–'+fmt(Math.min(start+perPage,pool.length))+' of '+fmt(pool.length)+(search?' matching records':' highest-ranked seasons')+'</span><div class="flex"><button data-player-page="'+(playerPage-1)+'" '+(playerPage===0?'disabled':'')+'>← Previous</button><span class="sub tiny">Page '+fmt(playerPage+1)+' / '+fmt(pages)+'</span><button data-player-page="'+(playerPage+1)+'" '+(playerPage>=pages-1?'disabled':'')+'>Next →</button></div></div>';
 $('app').innerHTML='<div class="panel"><div class="stickybar"><h2>Individual Seasons: '+fmt(rows.length)+' performances</h2><div class="flex">'+playerHistoryModeSelect()+'<label class="sub tiny" for="single-season-sort">Sort by</label><select class="select" id="single-season-sort">'+INDIVIDUAL_SEASON_OPTIONS.map(([v,l])=>'<option value="'+v+'" '+(v===singleSeasonSort?'selected':'')+'>'+l+'</option>').join('')+'</select></div></div><div class="player-search"><input id="player-search" type="search" placeholder="Search any player or team" value="'+esc(playerQuery)+'" aria-label="Search individual seasons"><button id="search-players" class="primary">Search</button><button id="clear-player-search" '+(!search?'disabled':'')+'>Clear</button></div><p class="sub tiny">Regular-season scoring ranks seasons; playoff scoring is shown separately. A player can appear more than once. Browse the top 1,000 for your selected sort, or search all archived seasons. Click a season or player to open its history.</p>'+pagination+(shown.length?table(INDIVIDUAL_SEASON_COLUMNS.map(([k,l])=>individualSeasonHeading(k,l)),data,true):'<p class="empty">No matching seasons yet.</p>')+pagination+(rows.some(r=>!r.regular.complete||!r.playoff.complete)?'<p class="sub tiny">Some older games lack individual scoring plays; affected statistics are shown as — rather than zero.</p>':'')+'</div>';
}

const PLAYER_SORT_OPTIONS=[["careerPoints","Total career points"],["name","Player name"],["teamId","Team"],["bonus","Rating"],["origin","Origin"],["startingYear","Starting year"],["seasons","Seasons played"],["regGames","Regular-season games"],["regGoals","Regular-season goals"],["regAssists","Regular-season assists"],["regPoints","Regular-season points"],["playoffGames","Playoff games"],["playoffGoals","Playoff goals"],["playoffAssists","Playoff assists"],["playoffPoints","Playoff points"],["pointsPerGame","Regular-season P/GP"],["titles","Championships"],["status","Status"]];
const PLAYER_SORT_COLUMNS=[["name","Player"],["teamId","Team"],["bonus","+"],["origin","Origin"],["startingYear","Yr start"],["seasons","Seasons"],["regGames","GP"],["regGoals","G"],["regAssists","A"],["regPoints","PTS"],["playoffGames","PO GP"],["playoffGoals","PO G"],["playoffAssists","PO A"],["playoffPoints","PO PTS"],["pointsPerGame","P/GP"],["titles","Titles"],["status","Status"]];
function playerHistoryValue(p,key){if(key==='regPoints')return (p.regGoals||0)+(p.regAssists||0);if(key==='playoffPoints')return (p.playoffGoals||0)+(p.playoffAssists||0);if(key==='careerPoints')return playerHistoryValue(p,'regPoints')+playerHistoryValue(p,'playoffPoints');if(key==='pointsPerGame')return (p.regGames||0)?playerHistoryValue(p,'regPoints')/p.regGames:0;if(key==='teamId')return state.teams[p.teamId]?.name||'';if(key==='status')return p.retireSeason!==null?'Retired':'Active';if(key==='name'||key==='origin')return p[key]||'';return p[key]||0;}
function playerHistoryCompare(a,b){const av=playerHistoryValue(a,playerSort),bv=playerHistoryValue(b,playerSort),cmp=typeof av==='string'?av.localeCompare(bv):av-bv;return (playerSortDescending?-cmp:cmp)||(a.id-b.id)}
function playerHeading(key,label){const active=playerSort===key;return '<th class="sort" data-player-sort="'+key+'" tabindex="0" role="button" aria-sort="'+(active?(playerSortDescending?'descending':'ascending'):'none')+'" title="Sort by '+esc(label)+'">'+esc(label)+(active?(playerSortDescending?' ▼':' ▲'):'')+'</th>'}
async function players(){
 if(playerHistoryMode==='season')return playerIndividualSeasons();
 titlebar('Player History','Search every archived player and sort complete career records.');
 $('app').innerHTML='<div class="panel"><h2>Player archive</h2><p class="sub">Loading player records…</p></div>';
 const ps=await getAll('players');if(view!=='players')return;
 ps.sort(playerHistoryCompare);
 const search=playerQuery.trim().toLowerCase();
 const topIds=new Set(ps.slice(0,1000).map(p=>p.id));
 const pool=search?ps.filter(p=>p.name.toLowerCase().includes(search)||(state.teams[p.teamId]?.name||'').toLowerCase().includes(search)):ps.filter(p=>topIds.has(p.id)||p.retireSeason===null||p.retireSeason===undefined);
 const perPage=100,totalPages=Math.max(1,Math.ceil(pool.length/perPage));
 playerPage=Math.max(0,Math.min(playerPage,totalPages-1));
 const start=playerPage*perPage,subset=pool.slice(start,start+perPage);
 const rows=subset.map(p=>'<tr><td>'+playerLink(p)+'</td><td>'+teamLink(p.teamId)+'</td><td>+'+p.bonus+'</td><td>'+p.origin+'</td><td>'+p.startingYear+'</td><td>'+(p.seasons||0)+'</td><td>'+(p.regGames||0)+'</td><td>'+(p.regGoals||0)+'</td><td>'+(p.regAssists||0)+'</td><td><b>'+playerHistoryValue(p,'regPoints')+'</b></td><td>'+(p.playoffGames||0)+'</td><td>'+(p.playoffGoals||0)+'</td><td>'+(p.playoffAssists||0)+'</td><td><b>'+playerHistoryValue(p,'playoffPoints')+'</b></td><td>'+(p.regGames?(playerHistoryValue(p,'regPoints')/p.regGames).toFixed(2):'—')+'</td><td>'+(p.titles||0)+'</td><td>'+(p.retireSeason!==null&&p.retireSeason!==undefined?'Retired':'Active')+'</td></tr>');
 const pages='<div class="player-pages"><span class="sub tiny">Showing '+(pool.length?fmt(start+1):'0')+'–'+fmt(Math.min(start+perPage,pool.length))+' of '+fmt(pool.length)+'</span><div class="flex"><button data-player-page="'+(playerPage-1)+'" '+(playerPage===0?'disabled':'')+'>← Previous</button><span class="sub tiny">Page '+fmt(playerPage+1)+' / '+fmt(totalPages)+'</span><button data-player-page="'+(playerPage+1)+'" '+(playerPage>=totalPages-1?'disabled':'')+'>Next →</button></div></div>';
 $('app').innerHTML='<div class="panel"><div class="stickybar"><h2>All players: '+fmt(ps.length)+'</h2><div class="flex">'+playerHistoryModeSelect()+'<label class="sub tiny" for="player-sort">Sort by</label><select class="select" id="player-sort">'+PLAYER_SORT_OPTIONS.map(([v,l])=>'<option value="'+v+'" '+(v===playerSort?'selected':'')+'>'+l+'</option>').join('')+'</select></div></div><div class="player-search"><input id="player-search" type="search" placeholder="Search any player or team" value="'+esc(playerQuery)+'" aria-label="Search players"><button id="search-players" class="primary">Search</button><button id="clear-player-search" '+(!search?'disabled':'')+'>Clear</button></div><p class="sub tiny">Browse the top 1,000 by this sort, plus all active players. Search checks every saved player, including retired players outside the top 1,000. Click a player to view their entire career.</p>'+pages+(pool.length?table(PLAYER_SORT_COLUMNS.map(([k,l])=>playerHeading(k,l)),rows,true):'<p class="empty">No matching players found.</p>')+pages+'</div>';
}
