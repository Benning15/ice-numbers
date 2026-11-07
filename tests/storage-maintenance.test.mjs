import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// No external dependencies. This small IndexedDB transaction stand-in executes
// requests asynchronously, stages writes, and commits only on tx.oncomplete.
function makeMemoryDB(old, failAt=Infinity){
 let saved=Object.fromEntries(Object.entries(old).map(([store,entries])=>[store,new Map(entries)]));
 const read=name=>new Map(saved[name]);
 const db={
  read,
  transaction(){
   const staged=Object.fromEntries(Object.entries(saved).map(([name,map])=>[name,new Map(map)]));
   const queue=[];
   let stopped=false,step=0;
   const tx={oncomplete:null,onerror:null,onabort:null,error:null,
    objectStore(name){
     const store=staged[name];
     if(!store)throw Error('Bad store: '+name);
     return {
      clear:()=>push(()=>store.clear()),
      delete:key=>push(()=>store.delete(key)),
      put:value=>push(()=>{const key=name==='meta'?value.key:name==='seasons'?value.season:value.id;store.set(key,value)})
     };
    },
    abort(){abort(Error('Aborted by caller'))}
   };
   const push=operation=>{if(stopped)throw Error('Transaction no longer active');const request={onsuccess:null,error:null};queue.push({operation,request});return request};
   const abort=error=>{if(stopped)return;stopped=true;tx.error=error;tx.onabort?.()};
   const work=()=>{
    if(stopped)return;
    const task=queue.shift();
    if(!task){stopped=true;saved=staged;tx.oncomplete?.();return;}
    if(++step===failAt){abort(Error('Injected write failure'));return;}
    try{task.operation();task.request.onsuccess?.()}catch(error){abort(error);return;}
    queueMicrotask(work);
   };
   queueMicrotask(work);
   return tx;
  }
 };
 return db;
}
function baseStores(){
 return {meta:[['main',{key:'main',value:{season:77}}],['customSettingsDefaults',{key:'customSettingsDefaults',value:{testValue:9}}]],
  seasons:[[77,{season:77}]],games:[['original-game',{id:'original-game',season:77}]],
  players:[[5,{id:5,name:'Original Player'}]]};
}
const backup={
 seasons:[{season:1},{season:2}],
 games:Array.from({length:451},(_,i)=>({id:'S1-regular-'+i,season:1})),
 players:[{id:100,name:'Imported Player'}]
};
const importedState={season:2,teams:[],nextPlayerId:101};
const sandbox=vm.createContext({console,clone:x=>JSON.parse(JSON.stringify(x))});
new vm.Script(readFileSync('js/storage.js','utf8'),{filename:'js/storage.js'}).runInContext(sandbox);
const apply=(db)=>{sandbox.db=db;return vm.runInContext('replaceLeagueAtomically',sandbox)(backup,importedState)};
const success=makeMemoryDB(baseStores());
await apply(success);
assert.equal(success.read('meta').get('main').value.season,2);
assert.equal(success.read('meta').get('customSettingsDefaults').value.testValue,9);
assert.equal(success.read('seasons').size,2);
assert.equal(success.read('games').size,451);
assert.equal(success.read('players').size,1);
assert.equal(success.read('games').has('original-game'),false);
assert.equal(success.read('players').has(5),false);
const failed=makeMemoryDB(baseStores(),225);
await assert.rejects(apply(failed),/Injected write failure/);
assert.equal(failed.read('meta').get('main').value.season,77,'old universe survives mid-import failure');
assert.equal(failed.read('games').size,1);
assert.equal(failed.read('games').has('original-game'),true);
assert.equal(failed.read('players').get(5).name,'Original Player');
assert.equal(failed.read('seasons').get(77).season,77);
console.log('PASS: single-transaction import of 451 games and rollback after injected partial failure');

// Cursor read mock models the byTeam multiEntry index without collecting
// every saved game record in the UI. Playoff results must not affect H2H.
const fakeGames=[
 {aId:0,bId:1,winnerId:0,stage:'regular',coin:false},
 {aId:1,bId:0,winnerId:1,stage:'regular',coin:true},
 {aId:0,bId:2,winnerId:0,stage:'regular',coin:true},
 {aId:2,bId:0,winnerId:2,stage:'regular',coin:false},
 {aId:0,bId:1,winnerId:1,stage:'playoff',coin:false}
];
let reads=0;
sandbox.state={teams:Array.from({length:16},(_,id)=>({id}))};
sandbox.db={
 transaction(){
  const tx={onabort:null,error:null,objectStore:()=>({
   index:()=>({
    openCursor:id=>{
     assert.equal(id,0);
     let i=0;
     const request={onsuccess:null,error:null,result:null};
     const next=()=>{
      queueMicrotask(()=>{
       request.result=i<fakeGames.length?{value:fakeGames[i++],continue:next}:null;
       if(request.result)reads++;
       request.onsuccess?.();
      });
     };
     next();
     return request;
    }
   })
  })};
  return tx;
 }
};
const headToHead=await vm.runInContext('getTeamHeadToHeadSummary(0)',sandbox);
const vs1=headToHead.find(r=>r.id===1),vs2=headToHead.find(r=>r.id===2);
assert.equal(reads,5);
assert.equal(vs1.w,1);
assert.equal(vs1.otl,1);
assert.equal(vs1.l,0);
assert.equal(vs1.coinL,1);
assert.equal(vs2.w,1);
assert.equal(vs2.l,1);
assert.equal(vs2.coinW,1);
console.log('PASS: by-team cursor computes W/L/OTL and coin wins without game-array allocation');
