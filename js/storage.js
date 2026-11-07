'use strict';
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open('IceNumbersV14',1);req.onupgradeneeded=()=>{let d=req.result;d.createObjectStore('meta',{keyPath:'key'});d.createObjectStore('seasons',{keyPath:'season'});let gs=d.createObjectStore('games',{keyPath:'id'});gs.createIndex('bySeason','season');gs.createIndex('byTeam','teamIds',{multiEntry:true});let p=d.createObjectStore('players',{keyPath:'id'});p.createIndex('byTeam','teamId');};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function get(store,key){return new Promise((resolve,reject)=>{let req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function getAll(store){return new Promise((resolve,reject)=>{let req=db.transaction(store,'readonly').objectStore(store).getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function getIndexAll(store,index,key){return new Promise((resolve,reject)=>{let req=db.transaction(store,'readonly').objectStore(store).index(index).getAll(key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function commitSeason(season,games,players){return new Promise((resolve,reject)=>{let tx=db.transaction(['meta','seasons','games','players'],'readwrite');tx.objectStore('meta').put({key:'main',value:clone(state)});tx.objectStore('seasons').put(season);for(const g of games)tx.objectStore('games').put(g);for(const p of players)tx.objectStore('players').put(p);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
// Browser-local preferences are separate from any league's saved history.
// Keep this meta record when resetting a universe or importing a league.
function commitDefaultSettings(settings){return new Promise((resolve,reject)=>{let tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key:'customSettingsDefaults',value:clone(settings)});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function commitState(){return new Promise((resolve,reject)=>{let tx=db.transaction('meta','readwrite');tx.objectStore('meta').put({key:'main',value:clone(state)});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}

/**
 * Replace the entire saved league in ONE IndexedDB transaction.
 *
 * Clearing data and re-inserting records in separate transactions can destroy
 * the previous universe if an import fails midway. This queues small batches
 * during request callbacks to keep the one transaction active, while allowing
 * IndexedDB to roll back every clear and put if any operation fails.
 *
 * Keep the separate customSettingsDefaults meta record intact.
 */
function replaceLeagueAtomically(backup,nextState){
 return new Promise((resolve,reject)=>{
  let tx,error=null;
  try{
   tx=db.transaction(['meta','seasons','games','players'],'readwrite');
   tx.oncomplete=()=>resolve();
   tx.onerror=()=>{error??=tx.error||new Error('An IndexedDB import request failed.')};
   tx.onabort=()=>reject(error||tx.error||new Error('The import was cancelled; your existing league is unchanged.'));
   tx.objectStore('meta').delete('main');
   const names=['seasons','games','players'];
   for(const name of names)tx.objectStore(name).clear();
   let storeIndex=0,offset=0;
   const batchSize=200;
   const queueNextBatch=()=>{
    try{
     let last=null;
     for(let count=0;count<batchSize;count++){
      while(storeIndex<names.length&&offset>=backup[names[storeIndex]].length){storeIndex++;offset=0}
      if(storeIndex>=names.length)break;
      last=tx.objectStore(names[storeIndex]).put(backup[names[storeIndex]][offset++]);
     }
     if(last)last.onsuccess=queueNextBatch;
     else tx.objectStore('meta').put({key:'main',value:clone(nextState)});
    }catch(err){error=err;try{tx.abort()}catch(_){}}
   };
   queueNextBatch();
  }catch(err){
   if(tx)try{tx.abort()}catch(_){}
   reject(err);
  }
 });
}

/**
 * Stream a team's head-to-head scores without allocating every archived goal
 * event in a giant array. Useful for multi-thousand-season histories.
 */
function getTeamHeadToHeadSummary(teamId){
 return new Promise((resolve,reject)=>{
  const opponent=state.teams.filter(t=>t.id!==teamId)
   .map(t=>({id:t.id,w:0,l:0,otl:0,coinW:0,coinL:0}));
  const byId=new Map(opponent.map(row=>[row.id,row]));
  let tx,request;
  try{
   tx=db.transaction('games','readonly');
   request=tx.objectStore('games').index('byTeam').openCursor(teamId);
   request.onsuccess=()=>{
    const cursor=request.result;
    if(!cursor){resolve(opponent);return}
    const g=cursor.value;
    if(g.stage==='regular'){
     const other=g.aId===teamId?g.bId:g.aId,row=byId.get(other);
     if(row){
      if(g.winnerId===teamId)row.w++;
      else if(g.coin)row.otl++;
      else row.l++;
      if(g.coin)g.winnerId===teamId?row.coinW++:row.coinL++;
     }
    }
    cursor.continue();
   };
   request.onerror=()=>reject(request.error||new Error('Failed to read head-to-head records.'));
   tx.onabort=()=>reject(tx.error||new Error('Head-to-head query was cancelled.'));
  }catch(err){reject(err)}
 });
}
