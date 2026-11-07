'use strict';
// V1.9.6 future opportunity rights. One outstanding next winning
// draft opportunity and one next random generation opportunity per ORIGIN team.
// A right may be assigned to another club and traded onward, but is consumed
// exactly once when its originating club is next selected for that event.
// Originating teams remain in the original lotteries; odds never change.
const FUTURE_RIGHT_KINDS=['generation','draft'];
function futureRightsStore(){
 state.futureRights??={generation:{},draft:{}};
 state.futureRights.generation??={};
 state.futureRights.draft??={};
 return state.futureRights;
}
function futureRightOwner(kind,originId){
 if(!FUTURE_RIGHT_KINDS.includes(kind))throw Error('Unknown future right.');
 if(!Number.isInteger(originId)||originId<0||originId>=state.teams.length)throw Error('Invalid originating team.');
 const holder=state.futureRights?.[kind]?.[originId];
 return Number.isInteger(holder)&&holder>=0&&holder<state.teams.length?holder:originId;
}
function futureRightLabel(kind){
 return kind==='generation'?'generation opportunity':'draft opportunity';
}
function futureRightTransfer(kind,originId,toId){
 commissionerReady(); // Only available between completed offseasons.
 commissionerTeam(originId);commissionerTeam(toId);
 const fromId=futureRightOwner(kind,originId);
 if(fromId===toId)throw Error('The selected team already owns that opportunity.');
 const store=futureRightsStore()[kind];
 if(toId===originId)delete store[originId];
 else store[originId]=toId;
 state.transactions??=[];
 state.nextTransactionId??=1;
 const event={id:state.nextTransactionId++,season:state.season+1,type:'right-transfer',players:[],
  right:{kind,originId,fromId,toId}};
 state.transactions.push(event);
 return {event,players:[]};
}
function futureRightRedeem(kind,originId,year){
 const ownerId=futureRightOwner(kind,originId);
 const store=futureRightsStore()[kind];
 if(ownerId!==originId){
  delete store[originId]; // The single future opportunity is now spent.
  state.transactions??=[];state.nextTransactionId??=1;
  state.transactions.push({id:state.nextTransactionId++,season:year,type:'right-used',
   players:[],right:{kind,originId,fromId:ownerId,toId:ownerId}});
 }
 return ownerId;
}

let futureRightForm={kind:'generation',originId:1,toId:0};
function futureRightsPanel(){
 const f=futureRightForm,kind=f.kind,origin=f.originId;
 const originTeam=state.teams[origin],ownerId=futureRightOwner(kind,origin);
 const kinds=[{value:'generation',label:'Next generation opportunity'},
  {value:'draft',label:'Next winning lottery draft opportunity'}];
 const teams=state.teams.map(t=>({value:t.id,label:t.name}));
 const rows=[];
 for(const type of FUTURE_RIGHT_KINDS)for(const team of state.teams){
  const owner=futureRightOwner(type,team.id);
  if(owner!==team.id)rows.push('<tr><td>'+esc(team.name)+'</td><td>'+
   (type==='draft'?'Draft':'Generation')+'</td><td>'+esc(state.teams[owner].name)+'</td></tr>');
 }
 const blocked=commissionerIsLocked()||ownerId===f.toId;
 const message=commissionerIsLocked()?'Finish the active season, draft and generation before trading rights.':
  ownerId===f.toId?'This team already owns the selected opportunity.':
  'The original team still enters each lottery. This one right stays traded until that team next wins, even if it takes years.';
 return '<div class="panel"><h2>Trade Future Opportunities</h2>'+
  '<p class="sub tiny">Each team has one next generation opportunity and one next winning draft opportunity available to trade. A right is used only once when its original team is selected. The same right can be traded again before then. Transfer a player separately if exchanging a player for a right.</p>'+
  '<div class="commissioner-form"><div><label class="sub tiny" for="future-right-kind">Opportunity</label>'+
  commissionerSelect(kinds,kind,'unused').replace('id="commissioner-unused"','id="future-right-kind"')+'</div>'+
  '<div><label class="sub tiny" for="future-right-origin">Original team</label>'+
  commissionerSelect(teams,origin,'unused').replace('id="commissioner-unused"','id="future-right-origin"')+'</div>'+
  '<div><label class="sub tiny" for="future-right-recipient">Trade to</label>'+
  commissionerSelect(teams,f.toId,'unused').replace('id="commissioner-unused"','id="future-right-recipient"')+'</div>'+
  '<div><span class="sub tiny">Current owner</span><b>'+esc(state.teams[ownerId].name)+'</b></div></div>'+
  '<p class="sub tiny">'+esc(message)+'</p>'+
  '<button class="primary" data-future-right-transfer="1" '+(blocked?'disabled':'')+'>Trade This Opportunity</button>'+
  '<details class="future-rights-outstanding"><summary>Outstanding traded rights ('+rows.length+')</summary>'+
  (rows.length?table(['Original team','Opportunity','Current owner'],rows):
   '<p class="sub tiny">No outstanding future rights have been traded.</p>')+'</details></div>';
}
function futureRightFormChange(field,value){
 if(field==='kind'&&FUTURE_RIGHT_KINDS.includes(value))futureRightForm.kind=value;
 if(['origin','recipient'].includes(field)){
  const id=Number(value);
  if(Number.isInteger(id)&&id>=0&&id<state.teams.length)futureRightForm[field==='origin'?'originId':'toId']=id;
 }
 if(view==='commissioner')commissionerView();
}
async function submitFutureRightTransfer(){
 if(busy||commissionerIsLocked())return;
 busy=true;
 const previous=clone(state);
 try{
  const f=futureRightForm;
  futureRightTransfer(f.kind,f.originId,f.toId);
  await commitProgress([],[]);
  setBanner('Traded '+state.teams[f.originId].name+'\'s next '+futureRightLabel(f.kind)+' to '+state.teams[f.toId].name+'. Right remains pending until selected.');
 }catch(err){state=previous;setBanner('Opportunity trade not saved: '+err.message,true)}
 finally{busy=false;await render()}
}
