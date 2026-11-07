'use strict';

// Ice Numbers 1.3: archive-only views; existing seasons and player records stay compatible.
function championshipScore(s){
 const m=s?.rounds?.[2]?.[0];
 if(!m||m.winnerId===null)return '—';
 const winner=m.winnerId===m.aId?m.winsA:m.winsB;
 const loser=m.winnerId===m.aId?m.winsB:m.winsA;
 return winner+'–'+loser;
}
function championshipHistoryTable(seasons){
 if(!seasons.length)return '<p class="empty">No championships have been played yet.</p>';
 const byYear=new Map(seasons.map(s=>[s.season,s]));
 const rows=[...seasons].sort((a,b)=>b.season-a.season).map(s=>{
  const last=byYear.get(s.season-1);
  const repeat=last&&last.championId===s.championId;
  const previousFinalists=last?[last.championId,last.runnerUpId]:[];
  const repeatFinalist=last&&[s.championId,s.runnerUpId].some(id=>previousFinalists.includes(id));
  return '<tr class="'+(repeat?'repeat-champion':'')+'"><td><button class="linkbtn" data-year="'+s.season+'">'+s.season+'</button></td><td>'+teamLink(s.championId)+'</td><td>'+teamLink(s.runnerUpId)+'</td><td>'+championshipScore(s)+'</td><td>'+(repeat?'<span class="pill gold">Repeat champion</span>':repeatFinalist?'<span class="pill">Repeat finalist</span>':'')+'</td></tr>';
 });
 return '<div class="championship-history-scroll">'+table(['Season','Champion','Runner-up','Series','Streak'],rows)+'</div>';
}
async function championshipView(){
 titlebar('Championship Celebration','The season has ended. Relive the championship and browse league history.');
 const current=state.season;
 $('app').innerHTML='<div class="panel"><p class="sub">Loading championship records…</p></div>';
 const seasons=await getAll('seasons');
 if(view!=='playoffs'||state.season!==current)return;
 const s=seasons.find(x=>x.season===current);
 if(!s){$('app').innerHTML='<div class="panel"><p class="empty">Championship results are unavailable.</p></div>';return}
 $('app').innerHTML='<div class="panel champion-celebration"><div class="champion-trophy" aria-hidden="true">🏆</div><p class="sub tiny">SEASON '+fmt(s.season)+' CHAMPIONS</p><div class="champion-name">'+teamMark(s.championId,true)+'<span>'+esc(state.teams[s.championId].name)+'</span></div><p class="champion-result">DEF. '+esc(state.teams[s.runnerUpId].name).toUpperCase()+' '+championshipScore(s)+'</p><div class="buttonrow champion-actions"><button data-year="'+s.season+'">View Championship Series</button><button class="primary" '+(state.draft?'data-open-draft="1">Continue to Draft Lottery':'data-continue-offseason="1">Continue to Offseason')+'</button></div></div><div class="panel"><div class="stickybar"><h2>Past Champions &amp; Runners-Up</h2><span class="sub tiny">'+fmt(seasons.length)+' seasons</span></div><p class="sub tiny" style="margin-bottom:12px">Newest first. Click a season for its complete playoff bracket. Consecutive championship and finals appearances are highlighted.</p>'+championshipHistoryTable(seasons)+'</div>';
}
function playerLink(p){
 return '<button class="linkbtn" data-player="'+p.id+'">'+esc(p.name)+'</button>';
}
function playerYearStats(p,entry,games){
 const teamId=entry.team??p.teamId;
 const result={season:entry.season,year:entry.year,teamId,rating:entry.bonus??p.bonus,ratingTier:entry.ratingTier||null,champion:!!entry.champion,partial:!!entry.partial,regular:{gp:0,g:0,a:0,w:0},playoff:{gp:0,g:0,a:0,w:0},complete:true};
 for(const g of games){
  if(!(g.teamIds||[g.aId,g.bId]).includes(teamId))continue;
  const dst=g.stage==='playoff'?result.playoff:result.regular;
  dst.gp++;
  if(g.winnerId===teamId)dst.w++;
  if(!Array.isArray(g.goalEvents)){result.complete=false;continue}
  for(const play of g.goalEvents){
   if(play.scorerId===p.id)dst.g++;
   if((play.assistIds||[]).includes(p.id))dst.a++;
  }
 }
 return result;
}
async function playerProfile(){
 const id=selectedPlayer;
 titlebar('Player Career','Season-by-season regular season and playoff statistics.');
 $('app').innerHTML='<div class="panel"><p class="sub">Loading career…</p></div>';
 const p=await get('players',id);
 if(view!=='playerDetail'||selectedPlayer!==id)return;
 if(!p){$('app').innerHTML='<div class="panel"><p class="empty">Player not found.</p><button data-nav="players">Back to Player History</button></div>';return}
 const entries=[...(p.history||[])];
 const a=state.activeSeason||state.regularSeason;
 if(a&&a.rosters?.[p.teamId]?.some(r=>r.id===p.id)&&!entries.some(e=>e.season===a.season)){
  entries.push({season:a.season,year:p.year,team:p.teamId,bonus:p.bonus,ratingTier:p.bonus===8&&effectiveRating(p)===10?'gold':p.bonus===8&&effectiveRating(p)===9?'silver':null,champion:false,partial:true});
 }
 entries.sort((x,y)=>x.season-y.season);
 const stats=await Promise.all(entries.map(async e=>playerYearStats(p,e,await getIndexAll('games','bySeason',e.season))));
 if(view!=='playerDetail'||selectedPlayer!==id)return;
 const totalG=(p.regGoals||0)+(p.playoffGoals||0),totalA=(p.regAssists||0)+(p.playoffAssists||0);
 const status=playerStatus(p);
 const transactions=(p.transactions||[]).slice().sort((a,b)=>a.id-b.id);
 const teamPath=[];
 if(transactions.length){
  // Transactions are an explicit, ordered source of the club changes.
  // Archived season rows continue to show the actual historic club each year.
  if(transactions[0].fromTeamId!=null)teamPath.push(transactions[0].fromTeamId);
  for(const tx of transactions)if(tx.toTeamId!=null&&teamPath.at(-1)!==tx.toTeamId)teamPath.push(tx.toTeamId);
 }else{
  for(const h of (p.history||[]).slice().sort((a,b)=>a.season-b.season))if(teamPath.at(-1)!==h.team)teamPath.push(h.team);
 }
 if(!teamPath.length)teamPath.push(p.teamId);
 const transactionPanel='<div class="panel"><h2>Team &amp; Transaction History</h2>'+
  '<p class="sub tiny">Teams represented: '+teamPath.map(id=>esc(state.teams[id]?.name||'Unknown')).join(' → ')+'</p>'+
  (transactions.length?transactions.map(tx=>{
   const from=state.teams[tx.fromTeamId]?.name||'Unknown';
   const to=tx.toTeamId==null?'Cut':state.teams[tx.toTeamId]?.name||'Unknown';
   return '<p class="record">Season '+tx.season+' · '+(tx.type==='trade'?'Traded':tx.type==='cut'?'Cut':'Moved')+
    ' · '+esc(from)+' → '+esc(to)+'</p>';
  }).join(''):'<p class="sub tiny">No commissioner transactions recorded for this player.</p>')+'</div>';
 const statCells=(r,stage)=>{const x=r[stage];return '<td>'+fmt(x.gp)+'</td><td>'+(r.complete?fmt(x.g):'—')+'</td><td>'+(r.complete?fmt(x.a):'—')+'</td><td>'+(r.complete?fmt(x.g+x.a):'—')+'</td>'};
 const rows=stats.map(r=>'<tr><td><button class="linkbtn" data-year="'+r.season+'">'+r.season+'</button></td><td>'+teamLink(r.teamId)+'</td><td>+'+r.rating+'</td>'+statCells(r,'regular')+statCells(r,'playoff')+'<td>'+(r.champion?'🏆':r.partial?'<span class="sub tiny">In progress</span>':'')+'</td></tr>');
 const cards=[['Regular GP',p.regGames],['Regular G',p.regGoals],['Regular A',p.regAssists],['Regular PTS',(p.regGoals||0)+(p.regAssists||0)],['Playoff GP',p.playoffGames],['Playoff G',p.playoffGoals],['Playoff A',p.playoffAssists],['Playoff PTS',(p.playoffGoals||0)+(p.playoffAssists||0)],['Career PTS',totalG+totalA],['Championships',p.titles]].map(([k,v])=>'<div class="stat"><span class="sub tiny">'+k+'</span><div class="big mono">'+fmt(v)+'</div></div>').join('');
 $('app').innerHTML='<div class="buttonrow" style="margin:0 0 16px"><button data-nav="players">← Back to Player History</button></div><div class="panel"><div class="stickybar"><div><h2 style="margin:0">'+esc(p.name)+'</h2><p class="sub">Current/final rating '+ratingHtml(p)+' · '+status+' · '+(p.origin==='draft'?'Drafted':'Generated')+' · Joined Season '+p.joinSeason+'</p></div><div>'+teamLink(p.teamId)+'</div></div></div><div class="career-cards">'+cards+'</div><div class="panel"><h2>Season-by-Season Career</h2><p class="sub tiny" style="margin-bottom:12px">Each season shows the team, rating, regular-season scoring and playoff scoring. A player’s statistics follow them across teams.</p>'+ (rows.length?table(['Season','Team','Rating','GP','G','A','PTS','PO GP','PO G','PO A','PO PTS','Champion'],rows):'<p class="empty">No completed season yet.</p>')+(stats.some(r=>!r.complete)?'<p class="sub tiny">Some older games have no individual scoring records; unavailable totals are shown as a dash.</p>':'')+'</div>'+transactionPanel;
}
function oddsTotal(weights){return weights.reduce((sum,n)=>sum+Number(n||0),0)}
function oddsStatusHtml(key,weights){
 const total=oddsTotal(weights),valid=Math.abs(total-100)<.001&&weights.every(n=>Number.isFinite(Number(n))&&Number(n)>=0);
 return '<p class="odds-status '+(valid?'odds-valid':'odds-invalid')+'" data-odds-total="'+key+'">Total: '+total.toFixed(1)+'% / 100% — '+(valid?'Valid':'Must equal 100%')+'</p>';
}
function updateOddsTotals(){
 for(const key of ['normalWeights','draftWeights']){
  const fields=[...document.querySelectorAll('[data-weight="'+key+'"]')];
  const el=document.querySelector('[data-odds-total="'+key+'"]');
  if(!el||!fields.length)continue;
  const values=fields.map(x=>x.value.trim()===''?NaN:Number(x.value));
  const valid=values.every(x=>Number.isFinite(x)&&x>=0)&&Math.abs(oddsTotal(values)-100)<.001;
  el.textContent='Total: '+(values.every(Number.isFinite)?oddsTotal(values).toFixed(1):'—')+'% / 100% — '+(valid?'Valid':'Must equal 100%');
  el.className='odds-status '+(valid?'odds-valid':'odds-invalid');
 }
}

function scoringPlayerLinks(play){
 const scorer=play.scorerId===null||play.scorerId===undefined?esc(play.scorerName||'Unnamed skater'):'<button class="linkbtn" data-player="'+play.scorerId+'">'+esc(play.scorerName||'Unknown')+'</button>';
 const ids=play.assistIds||[],names=play.assistNames||[];
 const assists=ids.map((id,i)=>'<button class="linkbtn" data-player="'+id+'">'+esc(names[i]||'Player')+'</button>');
 if(!ids.length&&names.length)assists.push(...names.map(esc));
 for(let i=0;i<(play.anonymousAssists||0);i++)assists.push('Unnamed skater');
 return scorer+(play.assistsCount?' — '+assists.join(', '):'');
}

function seasonRosterPanel(s){
 const rosters=s.rosters||{};
 const blocks=state.teams.map(t=>{
  const players=rosters[t.id]||[];
  return '<div class="season-roster-team"><h3>'+teamLink(t.id)+'</h3>'+(players.length?players.map(p=>'<p class="record">'+playerLink(p)+' <span class="sub tiny">+'+p.bonus+'</span></p>').join(''):'<p class="sub tiny">No featured players</p>')+'</div>';
 }).join('');
 return '<div class="panel"><details><summary>Featured player rosters — Season '+s.season+'</summary><p class="sub tiny" style="margin:10px 0">Rosters at the start of the season. Click any player for their complete career.</p><div class="season-roster-grid">'+blocks+'</div></details></div>';
}


// Two-assist goals are the remainder after unassisted and one-assist goals.
// Use the same green/red validation feedback as player-generation odds.
function assistDistribution(unassisted,oneAssist){
 const parse=x=>typeof x==='string'&&x.trim()===''?NaN:Number(x);
 const zero=parse(unassisted),one=parse(oneAssist);
 const valid=Number.isInteger(zero)&&Number.isInteger(one)&&zero>=0&&one>=0&&zero<=100&&one<=100&&zero+one<=100;
 return {valid,two:valid?100-zero-one:null};
}
function assistStatusText(result){
 return result.valid
  ?'Two-assist goals: '+result.two+'% · Total: 100% — Valid'
  :'Two-assist goals: — · Invalid — 0-assist and 1-assist percentages must add up to 100% or less.';
}
function assistStatusHtml(unassisted,oneAssist){
 const result=assistDistribution(unassisted,oneAssist);
 return '<p class="odds-status '+(result.valid?'odds-valid':'odds-invalid')+'" data-assist-status role="status">'+assistStatusText(result)+'</p>';
}
function updateAssistStatus(){
 const el=document.querySelector('[data-assist-status]');
 const zero=document.getElementById('cfg-unassistedPct'),one=document.getElementById('cfg-oneAssistPct');
 if(!el||!zero||!one)return;
 const result=assistDistribution(zero.value,one.value);
 el.className='odds-status '+(result.valid?'odds-valid':'odds-invalid');
 el.textContent=assistStatusText(result);
}
