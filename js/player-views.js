// Player history, individual season records, searching, and sorting.
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
 const active=state.regularSeason||state.activeSeason;
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
     bonus:p.bonus??0,ratingTier:p.ratingTier||null,year:p.year??'—',champion:!active||active.season!==season.season?season.championId===teamId:false,
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
function playerStatus(p){return p.cutSeason!=null?'Cut':p.retireSeason!=null?'Retired':'Active'}
function playerHistoryValue(p,key){if(key==='regPoints')return (p.regGoals||0)+(p.regAssists||0);if(key==='playoffPoints')return (p.playoffGoals||0)+(p.playoffAssists||0);if(key==='careerPoints')return playerHistoryValue(p,'regPoints')+playerHistoryValue(p,'playoffPoints');if(key==='pointsPerGame')return (p.regGames||0)?playerHistoryValue(p,'regPoints')/p.regGames:0;if(key==='teamId')return state.teams[p.teamId]?.name||'';if(key==='status')return playerStatus(p);if(key==='name'||key==='origin')return p[key]||'';return p[key]||0;}
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
 const rows=subset.map(p=>'<tr><td>'+playerLink(p)+'</td><td>'+teamLink(p.teamId)+'</td><td>+'+p.bonus+'</td><td>'+p.origin+'</td><td>'+p.startingYear+'</td><td>'+(p.seasons||0)+'</td><td>'+(p.regGames||0)+'</td><td>'+(p.regGoals||0)+'</td><td>'+(p.regAssists||0)+'</td><td><b>'+playerHistoryValue(p,'regPoints')+'</b></td><td>'+(p.playoffGames||0)+'</td><td>'+(p.playoffGoals||0)+'</td><td>'+(p.playoffAssists||0)+'</td><td><b>'+playerHistoryValue(p,'playoffPoints')+'</b></td><td>'+(p.regGames?(playerHistoryValue(p,'regPoints')/p.regGames).toFixed(2):'—')+'</td><td>'+(p.titles||0)+'</td><td>'+playerStatus(p)+'</td></tr>');
 const pages='<div class="player-pages"><span class="sub tiny">Showing '+(pool.length?fmt(start+1):'0')+'–'+fmt(Math.min(start+perPage,pool.length))+' of '+fmt(pool.length)+'</span><div class="flex"><button data-player-page="'+(playerPage-1)+'" '+(playerPage===0?'disabled':'')+'>← Previous</button><span class="sub tiny">Page '+fmt(playerPage+1)+' / '+fmt(totalPages)+'</span><button data-player-page="'+(playerPage+1)+'" '+(playerPage>=totalPages-1?'disabled':'')+'>Next →</button></div></div>';
 $('app').innerHTML='<div class="panel"><div class="stickybar"><h2>All players: '+fmt(ps.length)+'</h2><div class="flex">'+playerHistoryModeSelect()+'<label class="sub tiny" for="player-sort">Sort by</label><select class="select" id="player-sort">'+PLAYER_SORT_OPTIONS.map(([v,l])=>'<option value="'+v+'" '+(v===playerSort?'selected':'')+'>'+l+'</option>').join('')+'</select></div></div><div class="player-search"><input id="player-search" type="search" placeholder="Search any player or team" value="'+esc(playerQuery)+'" aria-label="Search players"><button id="search-players" class="primary">Search</button><button id="clear-player-search" '+(!search?'disabled':'')+'>Clear</button></div><p class="sub tiny">Browse the top 1,000 by this sort, plus all active players. Search checks every saved player, including retired players outside the top 1,000. Click a player to view their entire career.</p>'+pages+(pool.length?table(PLAYER_SORT_COLUMNS.map(([k,l])=>playerHeading(k,l)),rows,true):'<p class="empty">No matching players found.</p>')+pages+'</div>';
}
