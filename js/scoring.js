'use strict';
// V1.4: actual goals decide games. Every successful playmaking roll
// creates exactly one extra goal; assists never recursively generate goals.
const MOTIVATION_RANGES=[[-2,-1,5],[-2,0,8],[-2,2,4],[-1,0,16],[-1,1,25],[0,0,12],[0,1,16],[0,2,8],[1,2,6]];
function motivationRange(){return MOTIVATION_RANGES[weighted(MOTIVATION_RANGES.map(x=>x[2]))-1]}
function rollPlayerMotivation(p,season){
 if(p.motivationSeason===season)return false;
 if(!Number.isInteger(p.motivationMin)||!Number.isInteger(p.motivationMax)){
  const [lo,hi]=motivationRange();p.motivationMin=lo;p.motivationMax=hi;
 }
 p.motivation=randint(p.motivationMin,p.motivationMax);
 p.motivationSeason=season;return true;
}
function ensureScoringTendency(p){
 if(Number.isInteger(p.goalTendency)&&p.goalTendency>=0&&p.goalTendency<=100)return false;
 const span=Number(state.settings.tendencySpread??0);
 p.goalTendency=randint(50-span,50+span);return true;
}
function scoringTendency(p){return Number.isInteger(p.goalTendency)?p.goalTendency:50}
function effectiveRating(p){return Math.max(0,Math.min(10,p.bonus+(Number(p.motivation)||0)))}
function newPlayer(teamId,origin,season){
 const s=state.settings,[lo,hi]=motivationRange(),span=Number(s.tendencySpread??0);
 const bonus=weighted(origin==='draft'?s.draftWeights:s.normalWeights);
 const p={id:state.nextPlayerId++,teamId,name:FIRST[randint(0,FIRST.length-1)]+' '+LAST[randint(0,LAST.length-1)],bonus,
  startingYear:origin==='draft'?1:randint(1,s.careerLength),year:0,origin,joinSeason:season,retireSeason:null,
  motivationMin:lo,motivationMax:hi,motivation:0,motivationSeason:null,
  goalTendency:randint(50-span,50+span),
  seasons:0,regGames:0,regWins:0,regLosses:0,regOTL:0,regGoals:0,regAssists:0,
  playoffGoals:0,playoffAssists:0,playoffGames:0,playoffWins:0,playoffLosses:0,titles:0,history:[]};
 const t=testingData();const kind=origin==='draft'?'draft':'spawn';t.generation[kind][bonus]=(t.generation[kind][bonus]||0)+1;
 return p;
}
function makeNewPlayer(teamId,origin,season){const p=newPlayer(teamId,origin,season);p.year=p.startingYear;return p}
function bonusOf(team){return team.roster.reduce((sum,p)=>sum+p.bonus,0)}
function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x))}
function ensurePlayer(p){
 for(const k of ['regGoals','regAssists','regOTL','playoffGoals','playoffAssists','regGames','regWins','regLosses','playoffGames','playoffWins','playoffLosses','seasons','titles'])p[k]??=0;
 return p;
}
function pickWeighted(items){
 const valid=items.filter(item=>Number.isFinite(item.weight)&&item.weight>0);
 if(!valid.length)return null;
 let r=random()*valid.reduce((sum,item)=>sum+item.weight,0);
 for(const item of valid){r-=item.weight;if(r<0)return item.id}
 return valid[valid.length-1].id;
}
function standardNormal(){const u=Math.max(Number.MIN_VALUE,random());return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*random())}
function poisson(mean){
 if(!(mean>0))return 0;
 let n=0,p=1,threshold=Math.exp(-Math.min(50,mean));
 do{n++;p*=random()}while(p>threshold&&n<200);
 return n-1;
}
function scoringRoll(mean,settings=state.settings){
 const spread=Number(settings.goalVolatility??0);
 // A lognormal rate multiplier keeps the same mean, but creates rarer big games.
 const multiplier=spread>0?Math.exp(spread*standardNormal()-spread*spread/2):1;
 return poisson(Math.min(50,mean*multiplier));
}
function goalRate(p,settings=state.settings){
 const e=effectiveRating(p);if(!e)return 0;
 return Number(settings.goalRateAt9)*Math.pow(e/9,Number(settings.goalCurve))*scoringTendency(p)/50;
}
function playmakingRate(p,settings=state.settings){
 const e=effectiveRating(p);if(!e)return 0;
 return Number(settings.playmakingRateAt9)*Math.pow(e/9,Number(settings.playmakingCurve))*(100-scoringTendency(p))/50;
}
function unidentifiedRate(team,settings=state.settings){
 const effectiveSum=team.roster.reduce((sum,p)=>sum+effectiveRating(p),0);
 const share=Math.max(.35,1-Number(settings.unnamedIceTimeImpact)*effectiveSum/30);
 return Number(settings.unnamedGoalsPerGame)*share;
}
function scorerCandidates(team,exclude){
 const out=[{id:null,weight:Number(state.settings.unnamedRecipientWeight)}];
 for(const p of team.roster)if(p.id!==exclude){
  out.push({id:p.id,weight:Math.pow(.35+effectiveRating(p)/6,Number(state.settings.recipientCurve))});
 }
 return out;
}
function assistCandidates(team,excluded){
 const out=[{id:null,weight:Number(state.settings.unnamedAssistWeight)}];
 for(const p of team.roster)if(!excluded.has(p.id)){
  out.push({id:p.id,weight:Math.pow(.2+effectiveRating(p)/9,Number(state.settings.playmakingCurve))*(100-scoringTendency(p))/50});
 }
 return out;
}
function addGoal(team,stage,changed,scorerId,primaryId,source,ot=false){
 const roster=team.roster,assists=[],anonymous={count:0};
 const excluded=new Set(scorerId===null?[]:[scorerId]);
 let goalAssists=0;
 if(primaryId!==undefined&&primaryId!==null){
  assists.push(primaryId);excluded.add(primaryId);goalAssists=1;
  if(random()*100<state.settings.secondaryAssistPct)goalAssists=2;
 }else{
  const roll=random()*100;
  goalAssists=roll<state.settings.unassistedPct?0:roll<state.settings.unassistedPct+state.settings.oneAssistPct?1:2;
 }
 while(assists.length+anonymous.count<goalAssists){
  const id=pickWeighted(assistCandidates(team,excluded));
  if(id===null)anonymous.count++;
  else{assists.push(id);excluded.add(id)}
 }
 if(scorerId!==null){
  const p=ensurePlayer(roster.find(x=>x.id===scorerId));
  p[stage==='regular'?'regGoals':'playoffGoals']++;changed?.set(p.id,p);
 }
 for(const id of assists){
  const p=ensurePlayer(roster.find(x=>x.id===id));
  p[stage==='regular'?'regAssists':'playoffAssists']++;changed?.set(p.id,p);
 }
 return {teamId:team.id,scorerId,scorerName:scorerId===null?'Unidentified player':roster.find(x=>x.id===scorerId)?.name,
  assistIds:assists,assistNames:assists.map(id=>roster.find(x=>x.id===id)?.name),
  anonymousAssists:anonymous.count,assistsCount:goalAssists,source,otGoal:ot};
}
function generateTeamGoals(team,stage,changed){
 const plays=[];
 for(const p of team.roster){
  for(let i=0,n=scoringRoll(goalRate(p));i<n;i++)plays.push(addGoal(team,stage,changed,p.id,undefined,'self'));
 }
 for(let i=0,n=scoringRoll(unidentifiedRate(team));i<n;i++){
  plays.push(addGoal(team,stage,changed,null,undefined,'unidentified'));
 }
 // One successful playmaking roll is ONE extra goal. Assign it to someone
 // OTHER than the creator, and credit the creator with the primary assist.
 for(const p of team.roster){
  for(let i=0,n=scoringRoll(playmakingRate(p));i<n;i++){
   const scorer=pickWeighted(scorerCandidates(team,p.id));
   plays.push(addGoal(team,stage,changed,scorer,p.id,'playmaking'));
  }
 }
 return plays;
}
function overtimeGoal(team,stage,changed){
 const scorer=pickWeighted(scorerCandidates(team,undefined));
 return addGoal(team,stage,changed,scorer,undefined,'overtime',true);
}
function testingData(){
 if(!state.testing)state.testing={seasons:0,teamSeasons:0,teamPlus:0,effectiveTeamPlus:0,playerSeasons:0,individualPlus:0,
  games:0,goals:0,unidentifiedGoals:0,otGames:0,byStrength:{},byRosterCount:{},byEffectiveRating:{},byBaseRating:{},
  highestTeamPlus:0,highestEffectiveTeamPlus:0,teamsWithTwoEight:0,teamsWithThreeEight:0,
  generation:{spawn:{},draft:{}},multiGoalGames:{four:0,five:0,six:0},goalSeasons:{forty:0,fifty:0,sixty:0,seventy:0},
  checkpoints:{}};
 return state.testing;
}
function trackTeamStrength(){
 const t=testingData();
 for(const team of state.teams){
  t.teamSeasons++;t.teamPlus+=bonusOf(team);
  t.effectiveTeamPlus+=team.roster.reduce((sum,p)=>sum+effectiveRating(p),0);
  t.playerSeasons+=team.roster.length;t.individualPlus+=bonusOf(team);
  t.highestTeamPlus=Math.max(t.highestTeamPlus,bonusOf(team));
  t.highestEffectiveTeamPlus=Math.max(t.highestEffectiveTeamPlus,team.roster.reduce((sum,p)=>sum+effectiveRating(p),0));
  const eight=team.roster.filter(p=>p.bonus===8).length;
  if(eight>=2)t.teamsWithTwoEight++;
  if(eight>=3)t.teamsWithThreeEight++;
 }
}
function recordTestingGame(g,a,b){
 if(g.stage!=='regular')return;
 const t=testingData();t.games++;t.goals+=g.scoreA+g.scoreB;if(g.coin)t.otGames++;
 for(const team of [a,b]){
  const plays=g.goalEvents.filter(x=>x.teamId===team.id),strength=bonusOf(team),group=strength<5?'0–4':strength<9?'5–8':strength<13?'9–12':strength<17?'13–16':strength<25?'17–24':'25+';
  const stats=t.byStrength[group]??={games:0,goals:0};
  stats.games++;stats.goals+=plays.length;
  const depth=t.byRosterCount[team.roster.length]??={games:0,goals:0,unidentifiedGoals:0};
  depth.games++;depth.goals+=plays.length;
  const unknown=plays.filter(x=>x.scorerId===null).length;
  t.unidentifiedGoals+=unknown;depth.unidentifiedGoals+=unknown;
  const perPlayer={};
  for(const play of plays){
   if(play.scorerId!==null)perPlayer[play.scorerId]=(perPlayer[play.scorerId]||0)+1;
  }
  for(const goals of Object.values(perPlayer)){
   if(goals>=4)t.multiGoalGames.four++;
   if(goals>=5)t.multiGoalGames.five++;
   if(goals>=6)t.multiGoalGames.six++;
  }
  for(const p of team.roster){
   const bucket=t.byEffectiveRating[effectiveRating(p)]??={games:0,goals:0,assists:0};
   bucket.games++;bucket.goals+=perPlayer[p.id]||0;
   const assists=plays.reduce((sum,event)=>sum+event.assistIds.filter(id=>id===p.id).length,0);
   bucket.assists+=assists;
   const base=t.byBaseRating[p.bonus]??={games:0,goals:0,assists:0};
   base.games++;base.goals+=perPlayer[p.id]||0;base.assists+=assists;
  }
 }
}
function testingSnapshot(){
 const t=testingData();
 return {seasons:t.seasons,teamSeasons:t.teamSeasons,teamPlus:t.teamPlus,effectiveTeamPlus:t.effectiveTeamPlus,
  playerSeasons:t.playerSeasons,individualPlus:t.individualPlus,games:t.games,goals:t.goals,
  unidentifiedGoals:t.unidentifiedGoals,otGames:t.otGames,
  highestTeamPlus:t.highestTeamPlus,highestEffectiveTeamPlus:t.highestEffectiveTeamPlus,
  teamsWithTwoEight:t.teamsWithTwoEight,teamsWithThreeEight:t.teamsWithThreeEight};
}
function playGame(a,b,bonusA,bonusB,season,stage,round,seriesNo,gameNo,gs,changed){
 const goalsA=generateTeamGoals(a,stage,changed),goalsB=generateTeamGoals(b,stage,changed);
 const coin=goalsA.length===goalsB.length;
 const winner=coin?(random()<.5?a:b):(goalsA.length>goalsB.length?a:b);
 if(coin){
  (winner.id===a.id?goalsA:goalsB).push(overtimeGoal(winner,stage,changed));
 }
 const loser=winner.id===a.id?b:a;
 const g={id:'S'+season+'-'+stage+'-'+String(state.totalGames).padStart(8,'0'),season,stage,round,seriesNo,gameNo,
  teamIds:[a.id,b.id],aId:a.id,bId:b.id,bonusA:bonusOf(a),bonusB:bonusOf(b),
  rollA:null,rollB:null,totalA:null,totalB:null,coin,ot:coin,coinReason:coin?'tied-goals':null,
  scoreA:goalsA.length,scoreB:goalsB.length,winnerId:winner.id,loserId:loser.id,
  goalEvents:goalsA.concat(goalsB)};
 // Place the overtime winner last in the scoring summary.
 if(coin){const i=g.goalEvents.findIndex(x=>x.otGoal);if(i>=0)g.goalEvents.push(g.goalEvents.splice(i,1)[0])}
 gs.push(g);state.totalGames++;if(coin)state.totalCoin++;
 for(const team of [a,b]){team.scoringGP=(team.scoringGP||0)+1;team.scoringGF=(team.scoringGF||0)+(team.id===a.id?g.scoreA:g.scoreB)}
 if(stage==='regular'){
  winner.regW++;loser.regPoints+=coin?1:0;loser.regOTL=(loser.regOTL||0)+(coin?1:0);if(!coin)loser.regL++;
  winner.regPoints+=2;
  if(coin){winner.regCoinW++;loser.regCoinL++}
  a.pointsFor+=g.scoreA;a.pointsAgainst+=g.scoreB;b.pointsFor+=g.scoreB;b.pointsAgainst+=g.scoreA;
  winner.currentRegWinStreak++;winner.currentRegLossStreak=0;loser.currentRegLossStreak++;loser.currentRegWinStreak=0;
  winner.bestRegWinStreak=Math.max(winner.bestRegWinStreak,winner.currentRegWinStreak);
  loser.bestRegLossStreak=Math.max(loser.bestRegLossStreak,loser.currentRegLossStreak);
 }else{
  winner.playoffW++;loser.playoffL++;
  if(coin){winner.playoffCoinW++;loser.playoffCoinL++}
 }
 for(const team of [a,b])for(const player of team.roster){
  const p=ensurePlayer(player),prefix=stage==='regular'?'reg':'playoff';
  p[prefix+'Games']++;
  if(stage==='regular'&&winner.id!==team.id&&coin)p.regOTL++;
  else p[prefix+(winner.id===team.id?'Wins':'Losses')]++;
  changed?.set(p.id,p);
 }
 recordTestingGame(g,a,b);
 return g;
}
