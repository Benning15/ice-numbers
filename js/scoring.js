'use strict';
function newPlayer(teamId,origin,season){let s=state.settings;return {id:state.nextPlayerId++,teamId,name:FIRST[randint(0,FIRST.length-1)]+' '+LAST[randint(0,LAST.length-1)],bonus:weighted(origin==='draft'?s.draftWeights:s.normalWeights),startingYear:origin==='draft'?1:randint(1,s.careerLength),year:0,origin,joinSeason:season,retireSeason:null,seasons:0,regGames:0,regWins:0,regLosses:0,regOTL:0,regGoals:0,regAssists:0,playoffGoals:0,playoffAssists:0,playoffGames:0,playoffWins:0,playoffLosses:0,titles:0,history:[]}}
function makeNewPlayer(teamId,origin,season){let p=newPlayer(teamId,origin,season);p.year=p.startingYear;return p}
function bonusOf(team){return Math.min(state.settings.maxBonus,team.roster.reduce((a,p)=>a+p.bonus,0))}
// Ice Numbers 1.2: one source of truth for rolls, scores and scoring plays.
function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x))}
function ensurePlayer(p){for(const key of ['regGoals','regAssists','regOTL','playoffGoals','playoffAssists','regGames','regWins','regLosses','playoffGames','playoffWins','playoffLosses','seasons','titles'])p[key]??=0;return p}
function pickWeighted(items){let sum=items.reduce((z,i)=>z+i.weight,0),v=random()*sum;for(const item of items){v-=item.weight;if(v<0)return item.id}return items[items.length-1].id}
function scoringWeight(p,assist=false){return Math.pow(p.bonus+1,assist?(state.settings.assistExponent??1.2):(state.settings.goalExponent??1.35))}
function scoringPlay(team,stage,game,changed){
 const players=team.roster;
 const scorerPool=[{id:null,weight:state.settings.unnamedWeight??8},...players.map(p=>({id:p.id,weight:scoringWeight(p)}))];
 const scorerId=pickWeighted(scorerPool);
 let assisterIds=[],anonymousAssists=0;
 const unassisted=state.settings.unassistedPct??6,one=state.settings.oneAssistPct??19;
 const v=random()*100,numAssists=v<unassisted?0:v<unassisted+one?1:2;
 const candidates=players.filter(p=>p.id!==scorerId).map(p=>({id:p.id,weight:scoringWeight(p,true)}));
 for(let i=0;i<numAssists;i++){
   let id=pickWeighted([{id:null,weight:state.settings.unnamedWeight??8},...candidates]);
   if(id!==null){assisterIds.push(id);candidates.splice(candidates.findIndex(c=>c.id===id),1)}else anonymousAssists++
 }
 if(scorerId!==null){let p=ensurePlayer(players.find(p=>p.id===scorerId));p[stage==='regular'?'regGoals':'playoffGoals']++;changed?.set(p.id,p)}
 for(const id of assisterIds){let p=ensurePlayer(players.find(p=>p.id===id));p[stage==='regular'?'regAssists':'playoffAssists']++;changed?.set(p.id,p)}
 return {teamId:team.id,scorerId,scorerName:scorerId===null?'Unnamed skater':players.find(p=>p.id===scorerId)?.name,assistIds:assisterIds,assistNames:assisterIds.map(id=>players.find(p=>p.id===id)?.name),anonymousAssists,assistsCount:numAssists};
}
function generateScore(a,b,g,changed){
 const lower=Math.min(g.rollA,g.rollB);
 const losingGoals=clamp(Math.round(1+lower*.19+(random()-.5)*2.8),0,6);
 let margin;
 if(g.coin)margin=1;
 else{const difference=Math.abs(g.totalA-g.totalB);margin=clamp(Math.round(difference/3.8+(random()-.5)*1.7),1,7)}
 const winningGoals=clamp(losingGoals+margin,1,11);
 g.scoreA=g.winnerId===a.id?winningGoals:losingGoals;
 g.scoreB=g.winnerId===b.id?winningGoals:losingGoals;
 g.ot=g.coin;
 g.goalEvents=[];
 // In an overtime game, the last goal is credited to the winning side.
 const goals=[...Array(g.scoreA)].map(()=>a).concat([...Array(g.scoreB)].map(()=>b));
 if(g.coin){let ix=goals.findIndex(t=>t.id===g.winnerId);if(ix>=0)goals.push(goals.splice(ix,1)[0])}
 for(const team of goals)g.goalEvents.push(scoringPlay(team,g.stage,g,changed));
}
function playGame(a,b,bonusA,bonusB,season,stage,round,seriesNo,gameNo,gs,changed){
 const rollA=randint(0,state.settings.rollMax),rollB=randint(0,state.settings.rollMax);
 const totalA=rollA+bonusA,totalB=rollB+bonusB,coin=rollA===rollB||totalA===totalB;
 const winner=coin?(random()<.5?a:b):(totalA>totalB?a:b),loser=winner===a?b:a;
 const g={id:`S${season}-${stage}-${String(state.totalGames).padStart(8,'0')}`,season,stage,round,seriesNo,gameNo,teamIds:[a.id,b.id],aId:a.id,bId:b.id,rollA,rollB,bonusA,bonusB,totalA,totalB,coin,coinReason:rollA===rollB?'original-roll':(coin?'adjusted-total':null),winnerId:winner.id,loserId:loser.id};
 generateScore(a,b,g,changed);gs.push(g);state.totalGames++;if(coin)state.totalCoin++;
 if(stage==='regular'){
   winner.regW++;loser.regPoints+=coin?1:0;loser.regOTL=(loser.regOTL||0)+(coin?1:0);if(!coin)loser.regL++;
   winner.regPoints+=2;
   if(coin){winner.regCoinW++;loser.regCoinL++}
   a.pointsFor+=g.scoreA;a.pointsAgainst+=g.scoreB;b.pointsFor+=g.scoreB;b.pointsAgainst+=g.scoreA;
   winner.currentRegWinStreak++;winner.currentRegLossStreak=0;
   loser.currentRegLossStreak++;loser.currentRegWinStreak=0;
   winner.bestRegWinStreak=Math.max(winner.bestRegWinStreak,winner.currentRegWinStreak);
   loser.bestRegLossStreak=Math.max(loser.bestRegLossStreak,loser.currentRegLossStreak);
 }else{winner.playoffW++;loser.playoffL++;if(coin){winner.playoffCoinW++;loser.playoffCoinL++}}
 for(const t of [a,b])for(const player of t.roster){const p=ensurePlayer(player);const prefix=stage==='regular'?'reg':'playoff';p[prefix+'Games']++;if(stage==='regular'&&winner.id!==t.id&&coin)p.regOTL++;else p[prefix+(winner.id===t.id?'Wins':'Losses')]++;changed?.set(p.id,p)}
 return g;
}
