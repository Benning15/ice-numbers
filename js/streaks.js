'use strict';
// All-Time Records: reconstruct season-by-season streaks from archived seasons.
// Do not infer historical start/end dates from franchise "best" counters.
let alltimeSection='records',streakCategory='missed',streakRowsVisible=25;
const STREAK_TYPES=[
 {key:'made',label:'Made playoffs',title:'Consecutive playoff appearances',help:'Every season the team qualified for the top-eight playoff field.'},
 {key:'missed',label:'Missed playoffs',title:'Consecutive missed playoffs',help:'Every season the team finished outside the top eight.'},
 {key:'titles',label:'Championship streaks',title:'Consecutive championships',help:'Back-to-back league titles, including longer dynasties.'},
 {key:'titleDrought',label:'Title droughts',title:'Seasons without a championship',help:'Championship-free seasons, including before a team ever wins a title.'},
 {key:'finals',label:'Finals streaks',title:'Consecutive Finals appearances',help:'Consecutive seasons reaching the championship series, win or lose.'},
 {key:'finalDrought',label:'Finals droughts',title:'Seasons without a Finals appearance',help:'Consecutive seasons missing the championship series.'},
 {key:'first',label:'First-place streaks',title:'Consecutive regular-season first-place finishes',help:'Consecutive seasons finishing first in the regular-season standings.'},
 {key:'last',label:'Last-place streaks',title:'Consecutive regular-season last-place finishes',help:'Consecutive seasons finishing last in the regular-season standings.'}
];
function seasonStreakData(seasons){
 const keys=STREAK_TYPES.map(x=>x.key);
 const all=Object.fromEntries(keys.map(k=>[k,[]]));
 const active=state.teams.map(()=>Object.fromEntries(keys.map(k=>[k,null])));
 let lastYear=null;
 const finish=(id,key,ongoing)=>{
  const run=active[id]?.[key];
  if(!run)return;
  all[key].push({teamId:id,start:run.start,end:run.end,length:run.length,ongoing});
  active[id][key]=null;
 };
 // Require complete archived seasons: incomplete records must never create fake streaks.
 const ordered=(seasons||[]).filter(s=>Number.isInteger(s.season)&&s.season>0&&
  Array.isArray(s.standings)&&s.standings.length===state.teams.length&&
  Number.isInteger(s.championId)&&Number.isInteger(s.runnerUpId))
  .slice().sort((a,b)=>a.season-b.season);
 for(const season of ordered){
  if(lastYear!==null&&season.season!==lastYear+1){
   for(const t of state.teams)for(const key of keys)finish(t.id,key,false);
  }
  const qualified=new Set(season.standings.slice(0,8).map(row=>row.id));
  const firstId=season.standings[0].id;
  const lastId=Number.isInteger(season.lastId)?season.lastId:season.standings[season.standings.length-1].id;
  for(const t of state.teams){
   const id=t.id,inFinal=id===season.championId||id===season.runnerUpId;
   const flags={made:qualified.has(id),missed:!qualified.has(id),
    titles:id===season.championId,titleDrought:id!==season.championId,
    finals:inFinal,finalDrought:!inFinal,first:id===firstId,last:id===lastId};
   for(const key of keys){
    if(flags[key]){
     const run=active[id][key];
     if(run){run.length++;run.end=season.season}
     else active[id][key]={start:season.season,end:season.season,length:1};
    }else finish(id,key,false);
   }
  }
  lastYear=season.season;
 }
 for(const t of state.teams)for(const key of keys)finish(t.id,key,true);
 for(const key of keys)all[key].sort((a,b)=>b.length-a.length||b.end-a.end||a.teamId-b.teamId);
 return {records:all,latestYear:lastYear,seasonCount:ordered.length};
}
function streaksPage(seasons){
 const {records,latestYear,seasonCount}=seasonStreakData(seasons);
 if(!seasonCount)return '<div class="panel"><h2>Streaks &amp; Droughts</h2><p class="sub">Complete a season to start recording consecutive-season streaks and droughts.</p></div>';
 const chosen=STREAK_TYPES.find(x=>x.key===streakCategory)||STREAK_TYPES[0];
 const selected=records[chosen.key],current=selected.filter(x=>x.ongoing);
 const range=r=>'Season '+r.start+(r.start===r.end?'':'–'+r.end);
 const spotlight=[
  ['missed','Longest playoff drought'],
  ['titleDrought','Longest title drought'],
  ['made','Longest playoff streak'],
  ['titles','Longest title streak']
 ].map(([key,label])=>{
  const r=records[key][0];
  return '<div class="stat"><div class="sub tiny">'+label+'</div>'+
   (r?'<div class="big mono">'+fmt(r.length)+' seasons</div><p class="record">'+teamLink(r.teamId)+'</p><p class="sub tiny">'+range(r)+'</p>':
   '<div class="big">—</div>')+'</div>';
 }).join('');
 const categories=STREAK_TYPES.map(c=>'<button '+(chosen.key===c.key?'class="primary" ':'')+
  'data-streak-category="'+c.key+'" aria-pressed="'+(chosen.key===c.key?'true':'false')+'">'+c.label+'</button>').join('');
 const listing=selected.slice(0,streakRowsVisible).map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+teamLink(r.teamId)+
  '</td><td><b>'+fmt(r.length)+'</b></td><td>'+r.start+'</td><td>'+r.end+'</td><td>'+
  (r.ongoing?'<span class="pill">Active</span>':'Ended')+'</td></tr>');
 const activeRows=current.map(r=>'<tr><td>'+teamLink(r.teamId)+'</td><td><b>'+fmt(r.length)+
  '</b></td><td>'+range(r)+'</td></tr>');
 return '<div class="panel"><h2>Streaks &amp; Droughts</h2>'+
  '<p class="sub tiny">Rankings are rebuilt from completed season archives. All streak lengths are measured in consecutive seasons. Active means ongoing through the most recently completed season (Season '+
  fmt(latestYear)+'), even when the next season is underway.</p></div>'+
  '<div class="cards">'+spotlight+'</div>'+
  '<div class="panel"><h2>Explore records</h2><div class="buttonrow" style="margin-top:0">'+categories+'</div></div>'+
  '<div class="panel"><div class="stickybar"><h2>'+chosen.title+'</h2><span class="pill gold">'+
  fmt(selected.length)+' recorded streaks</span></div><p class="sub tiny" style="margin-bottom:12px">'+chosen.help+
  ' Showing '+fmt(Math.min(selected.length,streakRowsVisible))+' of '+fmt(selected.length)+'.</p>'+
  (listing.length?table(['Rank','Team','Seasons','Start','End','Status'],listing):
   '<p class="sub">No qualifying streaks recorded.</p>')+
  (selected.length>streakRowsVisible?'<div class="buttonrow"><button data-streak-more="1">Show next '+fmt(Math.min(50,selected.length-streakRowsVisible))+' records</button></div>':'')+
  '</div>'+
  '<div class="panel"><h2>Currently active — '+chosen.label+'</h2>'+
  '<p class="sub tiny" style="margin-bottom:12px">Active through Season '+fmt(latestYear)+
  '. These streaks are also included in the all-time rankings above.</p>'+
  (activeRows.length?table(['Team','Consecutive seasons','Span'],activeRows):
   '<p class="sub">No active streaks in this category.</p>')+'</div>';
}
