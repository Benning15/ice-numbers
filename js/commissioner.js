'use strict';
// V1.9 Commissioner Mode: explicit human-initiated offseason roster transactions.
// Active seasons and partially completed draft/generation screens remain locked
// to keep saved game schedules, scoring records and lottery snapshots consistent.
let commissionerForm={action:'move',fromTeam:0,fromPlayer:null,toTeam:1,toPlayer:null};
function commissionerIsLocked(){
 return !!(state.regularSeason||state.activeSeason||state.draft||state.generation);
}
function commissionerReady(){
 if(commissionerIsLocked())throw Error('Finish the regular season, playoffs, draft and player generation before making roster changes.');
}
function commissionerTeam(id){
 if(!Number.isInteger(id)||id<0||id>=state.teams.length)throw Error('Invalid team.');
 return state.teams[id];
}
function commissionerPlayer(teamId,playerId){
 const t=commissionerTeam(teamId);
 const p=t.roster.find(p=>p.id===playerId);
 if(!p)throw Error('Player is not on the selected team.');
 if(p.retireSeason!=null||p.cutSeason!=null)throw Error('That player is no longer active.');
 return p;
}
function commissionerLog(type,changes){
 state.transactions??=[];
 state.nextTransactionId??=1;
 const event={id:state.nextTransactionId++,season:state.season+1,type,
  players:changes.map(change=>({playerId:change.player.id,name:change.player.name,
   bonus:change.player.bonus,year:change.player.year,fromTeamId:change.from,toTeamId:change.to}))};
 state.transactions.push(event);
 for(const change of changes){
  change.player.transactions??=[];
  change.player.transactions.push({id:event.id,season:event.season,type,
   fromTeamId:change.from,toTeamId:change.to});
 }
 return event;
}
function commissionerMove(fromId,playerId,toId){
 commissionerReady();
 const from=commissionerTeam(fromId),to=commissionerTeam(toId);
 if(from.id===to.id)throw Error('Choose a different destination team.');
 const p=commissionerPlayer(fromId,playerId);
 if(to.roster.length>=state.settings.maxRoster)throw Error('The destination roster is full. Use Trade Players to swap instead.');
 if(to.roster.some(x=>x.id===p.id))throw Error('Player is already on the destination team.');
 from.roster=from.roster.filter(x=>x.id!==p.id);
 p.teamId=toId;
 to.roster.push(p);
 const event=commissionerLog('move',[{player:p,from:fromId,to:toId}]);
 return {event,players:[p]};
}
function commissionerSwap(teamA,playerA,teamB,playerB){
 commissionerReady();
 const a=commissionerTeam(teamA),b=commissionerTeam(teamB);
 if(teamA===teamB)throw Error('Trades require two different teams.');
 const p=commissionerPlayer(teamA,playerA),q=commissionerPlayer(teamB,playerB);
 if(p.id===q.id)throw Error('Choose two different players.');
 a.roster=a.roster.map(x=>x.id===p.id?q:x);
 b.roster=b.roster.map(x=>x.id===q.id?p:x);
 p.teamId=teamB;q.teamId=teamA;
 const event=commissionerLog('trade',[{player:p,from:teamA,to:teamB},{player:q,from:teamB,to:teamA}]);
 return {event,players:[p,q]};
}
function commissionerRelease(teamId,playerId){
 commissionerReady();
 const team=commissionerTeam(teamId),p=commissionerPlayer(teamId,playerId);
 team.roster=team.roster.filter(x=>x.id!==p.id);
 markPlayerCut(p,state.season+1);
 const event=commissionerLog('cut',[{player:p,from:teamId,to:null}]);
 return {event,players:[p]};
}
function commissionerPlayerOptions(teamId){
 const t=commissionerTeam(teamId);
 return t.roster.slice().sort((a,b)=>b.bonus-a.bonus||a.year-b.year||a.name.localeCompare(b.name));
}
function commissionerNormalizeForm(){
 const f=commissionerForm;
 if(!['move','trade','cut'].includes(f.action))f.action='move';
 if(!Number.isInteger(f.fromTeam)||f.fromTeam<0||f.fromTeam>15)f.fromTeam=0;
 if(!Number.isInteger(f.toTeam)||f.toTeam<0||f.toTeam>15)f.toTeam=1;
 const from=commissionerPlayerOptions(f.fromTeam),to=commissionerPlayerOptions(f.toTeam);
 if(!from.some(p=>p.id===f.fromPlayer))f.fromPlayer=from[0]?.id??null;
 if(!to.some(p=>p.id===f.toPlayer))f.toPlayer=to[0]?.id??null;
}
function commissionerSelect(options,selected,field,disabled=false){
 return '<select class="select" id="commissioner-'+field+'" '+(disabled?'disabled':'')+'>'+
  options.map(o=>'<option value="'+o.value+'" '+(o.value===selected?'selected':'')+'>'+esc(o.label)+'</option>').join('')+
  '</select>';
}
function commissionerTeamOptions(){
 return state.teams.map(t=>({value:t.id,label:t.name+' (+'+bonusOf(t)+', '+t.roster.length+' players)'}));
}
function commissionerPlayerSelect(teamId,id,field){
 const options=commissionerPlayerOptions(teamId).map(p=>({value:p.id,label:p.name+' · +'+p.bonus+' · Year '+p.year}));
 return options.length?commissionerSelect(options,id,field):'<div class="sub tiny">No active players on this team</div>';
}
function commissionerHistoryText(event){
 const lines=event.players.map(p=>{
  const from=state.teams[p.fromTeamId]?.name||'Unknown Team',to=p.toTeamId==null?'Cut':state.teams[p.toTeamId]?.name||'Unknown Team';
  return esc(p.name)+' (+'+p.bonus+', Year '+p.year+') · '+esc(from)+' → '+esc(to);
 }).join('<span class="commissioner-entry-break"></span>');
 return '<div class="commissioner-entry"><b>Season '+event.season+' · '+(event.type==='trade'?'Trade':event.type==='cut'?'Cut':'Move')+'</b><div class="sub tiny">'+lines+'</div></div>';
}
function commissionerView(){
 commissionerNormalizeForm();
 titlebar('Commissioner Mode','Manually transfer, trade and cut players between seasons.');
 const locked=commissionerIsLocked(),f=commissionerForm,from=state.teams[f.fromTeam],to=state.teams[f.toTeam];
 const rosterCards=state.teams.map(t=>'<div class="commissioner-team"><div class="commissioner-team-head">'+
  teamMark(t.id)+'<b>'+esc(t.name)+'</b><strong>+'+bonusOf(t)+'</strong></div>'+
  (t.roster.length?t.roster.map(p=>'<div class="commissioner-roster-player"><span>'+esc(p.name)+'</span><span>+'+p.bonus+' · Year '+p.year+'</span></div>').join(''):'<div class="sub tiny">No named players</div>')+
  '</div>').join('');
 const teamOptions=commissionerTeamOptions();
 const actionOptions=[{value:'move',label:'Move player'},{value:'trade',label:'Trade players (swap)'},{value:'cut',label:'Release / Cut player'}];
 const fromBox='<div><label class="sub tiny" for="commissioner-fromTeam">From team</label>'+commissionerSelect(teamOptions,f.fromTeam,'fromTeam')+'</div>'+
  '<div><label class="sub tiny" for="commissioner-fromPlayer">Player</label>'+commissionerPlayerSelect(f.fromTeam,f.fromPlayer,'fromPlayer')+'</div>';
 const destination=f.action==='cut'?'':'<div><label class="sub tiny" for="commissioner-toTeam">'+(f.action==='trade'?'Other team':'Destination team')+'</label>'+
  commissionerSelect(teamOptions,f.toTeam,'toTeam')+'</div>'+
  (f.action==='trade'?'<div><label class="sub tiny" for="commissioner-toPlayer">Player to swap</label>'+commissionerPlayerSelect(f.toTeam,f.toPlayer,'toPlayer')+'</div>':'');
 const validPlayers=f.fromPlayer!=null&&(f.action!=='trade'||f.toPlayer!=null);
 const targetFull=f.action==='move'&&to.roster.length>=state.settings.maxRoster;
 const sameTeam=f.action!=='cut'&&f.fromTeam===f.toTeam;
 const blocked=locked||!validPlayers||targetFull||sameTeam;
 const reason=locked?'Roster changes are available only after the offseason draft and player generation are complete, and before starting the next regular season.':
  sameTeam?'Select two different teams.':targetFull?'Destination roster is full; use Trade Players to swap instead.':
  !validPlayers?'Choose a team with an active player.':'All transactions are saved in your league history. Existing season statistics remain unchanged.';
 const history=(state.transactions||[]).slice(-40).reverse();
 $('app').innerHTML='<div class="panel"><div class="stickybar"><h2>Manage rosters</h2><span class="pill">Season '+(state.season+1)+' offseason</span></div>'+
  '<div class="commissioner-form"><div><label class="sub tiny" for="commissioner-action">Transaction</label>'+commissionerSelect(actionOptions,f.action,'action')+'</div>'+
  fromBox+destination+'</div>'+
  '<p class="sub tiny">'+esc(reason)+'</p><div class="buttonrow"><button class="primary" data-commissioner-submit="1" '+(blocked?'disabled':'')+'>'+
  (f.action==='move'?'Move Player':f.action==='trade'?'Trade Players':'Cut Player')+'</button></div></div>'+
  '<div class="panel"><h2>Current rosters · All 16 teams</h2><div class="commissioner-team-grid">'+rosterCards+'</div></div>'+
  '<div class="panel"><div class="stickybar"><h2>Transaction history</h2><span class="sub tiny">'+(state.transactions||[]).length+' events</span></div>'+
  (history.length?history.map(commissionerHistoryText).join(''):'<p class="empty">No commissioner transactions yet.</p>')+'</div>';
}
function commissionerUpdateForm(field,value){
 if(field==='action')commissionerForm.action=['move','trade','cut'].includes(value)?value:'move';
 else if(['fromTeam','toTeam','fromPlayer','toPlayer'].includes(field)){
  const n=Number(value);if(!Number.isInteger(n))return;
  commissionerForm[field]=n;
  if(field==='fromTeam')commissionerForm.fromPlayer=null;
  if(field==='toTeam')commissionerForm.toPlayer=null;
 }
 if(view==='commissioner')commissionerView();
}
async function commissionerSubmit(){
 if(busy||commissionerIsLocked())return;
 commissionerNormalizeForm();
 const f={...commissionerForm};
 if(f.action==='cut'&&!confirm('Cut '+(state.teams[f.fromTeam]?.roster.find(p=>p.id===f.fromPlayer)?.name||'this player')+'? The player will be removed from the roster and recorded as Cut.'))return;
 busy=true;
 const previous=clone(state);
 try{
  let result;
  if(f.action==='move')result=commissionerMove(f.fromTeam,f.fromPlayer,f.toTeam);
  else if(f.action==='trade')result=commissionerSwap(f.fromTeam,f.fromPlayer,f.toTeam,f.toPlayer);
  else result=commissionerRelease(f.fromTeam,f.fromPlayer);
  await commitProgress([],result.players);
  commissionerForm.fromPlayer=null;commissionerForm.toPlayer=null;
  setBanner('Commissioner '+f.action+' saved. Player history and team rosters updated.');
 }catch(err){state=previous;setBanner('Transaction not saved: '+err.message,true)}
 finally{busy=false;await render()}
}
