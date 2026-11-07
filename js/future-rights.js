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
