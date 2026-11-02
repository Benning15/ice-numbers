'use strict';

// Hidden Motivation: most players have modest year-to-year swings, with rare
// consistently positive/negative players and rare wide-range wildcards.
// Range is permanent; a new value is rolled once at the start of each season.
const MOTIVATION_RANGES=[
 [-2,-1,5],[-2,0,8],[-2,2,4],
 [-1,0,16],[-1,1,25],[0,0,12],
 [0,1,16],[0,2,8],[1,2,6]
];
function motivationRange(){
 const choice=weighted(MOTIVATION_RANGES.map(x=>x[2]))-1;
 return MOTIVATION_RANGES[choice];
}
function rollPlayerMotivation(p,season){
 if(p.motivationSeason===season)return false;
 // Old saves have no Motivation fields. Add them only when a new season
 // begins, leaving historical scores and an in-progress season untouched.
 if(!Number.isInteger(p.motivationMin)||!Number.isInteger(p.motivationMax)||
    p.motivationMin< -2||p.motivationMax>2||p.motivationMin>p.motivationMax){
   const [min,max]=motivationRange();
   p.motivationMin=min;
   p.motivationMax=max;
 }
 p.motivation=randint(p.motivationMin,p.motivationMax);
 p.motivationSeason=season;
 return true;
}
// Permanent, hidden goal-vs-assist style. Uniform 20–80 for new players;
// a high number means a goal-oriented scorer, low means a playmaker.
// Existing players get their tendency at the next season boundary. Archived
// games and any current saved playoff scores are not rewritten.
const GOAL_TENDENCY_MIN=20,GOAL_TENDENCY_MAX=80;
function ensureScoringTendency(p){
 if(Number.isInteger(p.goalTendency)&&p.goalTendency>=GOAL_TENDENCY_MIN&&p.goalTendency<=GOAL_TENDENCY_MAX)return false;
 p.goalTendency=randint(GOAL_TENDENCY_MIN,GOAL_TENDENCY_MAX);
 return true;
}
function scoringTendency(p){
 return Number.isInteger(p.goalTendency)&&p.goalTendency>=GOAL_TENDENCY_MIN&&p.goalTendency<=GOAL_TENDENCY_MAX?p.goalTendency:50;
}
function newPlayer(teamId,origin,season){
 const s=state.settings,[min,max]=motivationRange();
 return {id:state.nextPlayerId++,teamId,name:FIRST[randint(0,FIRST.length-1)]+' '+LAST[randint(0,LAST.length-1)],bonus:weighted(origin==='draft'?s.draftWeights:s.normalWeights),
 startingYear:origin==='draft'?1:randint(1,s.careerLength),year:0,origin,joinSeason:season,retireSeason:null,
 motivationMin:min,motivationMax:max,motivation:0,motivationSeason:null,
 goalTendency:randint(GOAL_TENDENCY_MIN,GOAL_TENDENCY_MAX),
 seasons:0,regGames:0,regWins:0,regLosses:0,regOTL:0,regGoals:0,regAssists:0,playoffGoals:0,playoffAssists:0,playoffGames:0,playoffWins:0,playoffLosses:0,titles:0,history:[]};
}
function makeNewPlayer(teamId,origin,season){let p=newPlayer(teamId,origin,season);p.year=p.startingYear;return p}
function bonusOf(team){return Math.min(state.settings.maxBonus,team.roster.reduce((a,p)=>a+p.bonus,0))}
// Ice Numbers 1.2: one source of truth for rolls, scores and scoring plays.
function clamp(x,lo,hi){return Math.max(lo,Math.min(hi,x))}
function ensurePlayer(p){for(const key of ['regGoals','regAssists','regOTL','playoffGoals','playoffAssists','regGames','regWins','regLosses','playoffGames','playoffWins','playoffLosses','seasons','titles'])p[key]??=0;return p}
function pickWeighted(items){let sum=items.reduce((z,i)=>z+i.weight,0),v=random()*sum;for(const item of items){v-=item.weight;if(v<0)return item.id}return items[items.length-1].id}
// Each team goal is one scoring event. Named player scoring odds combine
// rating + seasonal Motivation with permanent goal/assist tendencies.
// The shared +8-relative calibration keeps unnamed skaters meaningfully
// involved, while Offensive Depth and actual scores determine how many
// points can be awarded. Nothing here guarantees an individual goal total.
function scoringWeight(p,assist=false,settings=state.settings){
 const effective=Math.max(0,p.bonus+(Number.isInteger(p.motivation)?p.motivation:0));
 const tendency=scoringTendency(p);
 if(assist)return Math.pow(effective+1,Number(settings.assistExponent??1.2))*(100-tendency)/50;
 return Math.pow((effective+1)/9,Number(settings.goalExponent??1.35))*8*tendency/50;
}
function goalScorerPool(team,settings=state.settings){
 // A full team includes many unnamed skaters: they receive twice the
 // unnamed assist weight for GOAL selection to avoid crediting nearly
 // every team goal to one star. Assist events still use the base weight.
 return [{id:null,weight:Math.max(0,Number(settings.unnamedWeight??8))*2},
  ...team.roster.map(p=>({id:p.id,weight:scoringWeight(p,false,settings)}))];
}
function scoringPlay(team,stage,game,changed){
 const players=team.roster;
 const scorerPool=goalScorerPool(team);
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
// Uncapped roster strength gives deeper teams additional *scoring chances*.
// The original capped bonus still decides winners and standings. At default
// strength 1, a +24 roster (vs a +8 cap) with a maximum roll expects one
// extra goal; a half-size roll expects half a goal, before score limits.
function offensiveDepthExpectation(team,roll,settings=state.settings){
 const strength=Number(settings.offensiveDepthStrength??DEFAULTS.offensiveDepthStrength);
 if(!(strength>0)||!(roll>0))return 0;
 const uncapped=team.roster.reduce((total,p)=>total+p.bonus,0);
 const excess=Math.max(0,uncapped-settings.maxBonus);
 if(excess===0)return 0;
 const rollFraction=Math.min(1,roll/Math.max(1,settings.rollMax));
 return Math.min(3,excess/16*rollFraction*strength);
}
function extraOffensiveGoals(team,roll,settings=state.settings){
 const expected=offensiveDepthExpectation(team,roll,settings);
 if(!expected)return 0;
 const whole=Math.floor(expected),fraction=expected-whole;
 return whole+(fraction>0&&random()<fraction?1:0);
}
function generateScore(a,b,g,changed){
 const cap=Math.max(2,Math.floor(state.settings.maxGoalsPerTeam??DEFAULTS.maxGoalsPerTeam));
 const lower=Math.min(g.rollA,g.rollB);
 let losingGoals=clamp(Math.round(1+lower*.19+(random()-.5)*2.8),0,Math.min(6,cap-1));
 let margin;
 if(g.coin)margin=1;
 else{const difference=Math.abs(g.totalA-g.totalB);margin=clamp(Math.round(difference/3.8+(random()-.5)*1.7),1,7)}
 let winningGoals=clamp(losingGoals+margin,1,cap);
 if(!g.coin&&winningGoals>=7&&winningGoals<cap&&random()<.05){
   winningGoals=Math.min(cap,winningGoals+randint(1,3));
 }

 // The score boost is based on each team's own roll and uncapped player
 // ratings, not on the team bonus used to decide the game. Playoff seeding
 // bonuses cannot affect offensive depth.
 const extraA=extraOffensiveGoals(a,g.rollA),extraB=extraOffensiveGoals(b,g.rollB);
 const winnerExtra=g.winnerId===a.id?extraA:extraB;
 const loserExtra=g.winnerId===a.id?extraB:extraA;
 if(g.coin){
   // Overtime must stay a one-goal result. A high-tempo depth boost raises
   // both scores together rather than turning a coin flip into a blowout.
   losingGoals=Math.min(cap-1,losingGoals+Math.max(winnerExtra,loserExtra));
   winningGoals=losingGoals+1;
 }else{
   losingGoals=Math.min(cap-1,losingGoals+loserExtra);
   winningGoals=Math.min(cap,Math.max(winningGoals+winnerExtra,losingGoals+1));
 }
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
 generateScore(a,b,g,changed);
 // Save this season's running scoring rate AFTER allocating today's goals.
 // The counters travel with the league's meta state, so advancing a saved
 // playoff bracket produces the same future odds as continuous play.
 for(const t of [a,b]){
  t.scoringGP=(t.scoringGP||0)+1;
  t.scoringGF=(t.scoringGF||0)+(t.id===a.id?g.scoreA:g.scoreB);
 }
 gs.push(g);state.totalGames++;if(coin)state.totalCoin++;
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
