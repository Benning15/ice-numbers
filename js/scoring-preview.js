'use strict';

// Settings-only analytical preview. Expected goals use the same neutral
// per-player goal targets as scoringPlay with the user-supplied team GF pace.
// Assists still use the exact weighted scorer-exclusion and assister rules.
const SCORING_PRESETS={
 balanced:[1,1],
 moderate:[1.15,1.2],
 default:[1.35,1.2],
 stars:[1.65,1.55]
};
// Deterministic Monte Carlo forecast of the ACTUAL goal-scoring rules.
// All randomness is local: opening the Settings page never touches a league's
// seeded game RNG or simulates a real match. We sample rolls and score noise
// against a representative established opponent (+8/+1/+1 roster). The
// original score-cap, margin, overtime and Offensive Depth rules are mirrored;
// featured goal attribution is then estimated separately below.
function scoringPreviewTeamGoals(ratings,settings,gamesPerTeam=settings.gamesPerTeam){
 const rollMax=Math.max(1,Math.floor(Number(settings.rollMax??12)));
 const maxBonus=Math.max(0,Number(settings.maxBonus??8));
 const cap=Math.max(2,Math.floor(Number(settings.maxGoalsPerTeam??15)));
 const home={roster:ratings.filter(bonus=>bonus>0).map(bonus=>({bonus}))};
 const rival={roster:[{bonus:8},{bonus:1},{bonus:1}]};
 const bonusA=Math.min(maxBonus,ratings.reduce((sum,r)=>sum+r,0));
 const bonusB=Math.min(maxBonus,10);
 let rng=0x4f1bbcdc;
 const draw=()=>{
  let x=rng=(rng+0x6D2B79F5)>>>0;
  x=Math.imul(x^(x>>>15),x|1);
  x^=x+Math.imul(x^(x>>>7),x|61);
  return ((x^(x>>>14))>>>0)/4294967296;
 };
 const clampScore=(n,low,high)=>Math.min(high,Math.max(low,n));
 const extra=(team,roll)=>{
  const expected=offensiveDepthExpectation(team,roll,settings);
  return Math.floor(expected)+(draw()<expected%1?1:0);
 };
 let goals=0;
 const samples=6000;
 for(let i=0;i<samples;i++){
  const rollA=Math.floor(draw()*(rollMax+1)),rollB=Math.floor(draw()*(rollMax+1));
  const totalA=rollA+bonusA,totalB=rollB+bonusB;
  const coin=rollA===rollB||totalA===totalB;
  const winA=coin?draw()<.5:totalA>totalB;
  let lose=clampScore(Math.round(1+Math.min(rollA,rollB)*.19+(draw()-.5)*2.8),0,Math.min(6,cap-1));
  const margin=coin?1:clampScore(Math.round(Math.abs(totalA-totalB)/3.8+(draw()-.5)*1.7),1,7);
  let win=clampScore(lose+margin,1,cap);
  if(!coin&&win>=7&&win<cap&&draw()<.05)win=Math.min(cap,win+1+Math.floor(draw()*3));
  const extraA=extra(home,rollA),extraB=extra(rival,rollB);
  const winnerExtra=winA?extraA:extraB,loserExtra=winA?extraB:extraA;
  if(coin){lose=Math.min(cap-1,lose+Math.max(winnerExtra,loserExtra));win=lose+1;}
  else{lose=Math.min(cap-1,lose+loserExtra);win=Math.min(cap,Math.max(win+winnerExtra,lose+1));}
  goals+=winA?win:lose;
 }
 return Math.round(goals/samples*gamesPerTeam);
}
function scoringPreviewOdds(ratings,goalExponent,assistExponent,unnamedWeight,unassistedPct,oneAssistPct,teamGoals=90,gamesPerTeam=30,personalTargets=[30,30,30]){
 const featuredGoalRates=ratings.map((v,i)=>v>0?Math.pow((v+1)/9,goalExponent)*(personalTargets[i]??30)/30:0);
 const featuredTotal=featuredGoalRates.reduce((sum,v)=>sum+v,0);
 const expectedGF=teamGoals/Math.max(1,gamesPerTeam);
 const anonymousGoalRate=Math.max(0,expectedGF-featuredTotal)*(unnamedWeight/8);
 const goalWeights=featuredGoalRates.concat(anonymousGoalRate);
 const assistWeights=ratings.map(v=>v>0?Math.pow(v+1,assistExponent):0).concat(unnamedWeight);
 const goalSum=goalWeights.reduce((a,b)=>a+b,0);
 const goals=goalWeights.map(v=>v/goalSum);
 const assists=[0,0,0,0];
 const probabilities=[unassistedPct/100,oneAssistPct/100,(100-unassistedPct-oneAssistPct)/100];
 for(let scorer=0;scorer<4;scorer++){
   const eligible=[0,1,2,3].filter(j=>j!==scorer||j===3);
   const total1=eligible.reduce((sum,j)=>sum+assistWeights[j],0);
   for(const first of eligible){
     const firstProbability=assistWeights[first]/total1;
     assists[first]+=goals[scorer]*probabilities[1]*firstProbability;
     // The same featured player cannot be credited with both assists.
     // An unnamed skater remains eligible for the second anonymous assist.
     const eligible2=eligible.filter(j=>j===3||j!==first);
     const total2=eligible2.reduce((sum,j)=>sum+assistWeights[j],0);
     for(const second of eligible2){
       const probability=goals[scorer]*probabilities[2]*firstProbability*(assistWeights[second]/total2);
       assists[first]+=probability;
       assists[second]+=probability;
     }
   }
 }
 return {goals,assists,assistsPerGoal:probabilities[1]+2*probabilities[2]};
}
function scoringPreviewMarkup(s){
 const ratings=[8,8,7];
 const select=(v,i)=>'<div class="control"><label for="preview-rating-'+i+'">Player '+('ABC'[i])+' rating</label><select id="preview-rating-'+i+'" class="select" data-preview-rating="'+i+'"><option value="0">Empty slot (no player)</option>'+Array.from({length:8},(_,j)=>'<option value="'+(j+1)+'" '+(j+1===v?'selected':'')+'>+'+(j+1)+'</option>').join('')+'</select></div>'+ '<div class="control"><label for="preview-target-'+i+'">Player '+('ABC'[i])+' example target: <strong id="preview-target-label-'+i+'">30</strong></label><input id="preview-target-'+i+'" type="range" min="25" max="40" step="1" value="30" aria-label="Player '+('ABC'[i])+' example personal goal target"></div>';
 return '<section class="scoring-preview" aria-label="Live scoring calculator">'+
  '<h3>Live scoring calculator</h3>'+
  '<p class="help">Choose one, two or three featured players to see who receives goals and assists. Select Empty slot for missing players. This is a preview only — it does not generate players or change game results. Personal goal target sliders below are examples, not edits to real players. Actual targets stay hidden and shift gradually each season. Neutral Motivation (0) is assumed.</p>'+
  '<div class="scoring-preview-controls">'+ratings.map(select).join('')+
  '<div class="control"><label for="preview-team-goals">Projected team goals in season</label><input type="number" id="preview-team-goals" min="1" max="2000" step="1" value="'+scoringPreviewTeamGoals(ratings,s,s.gamesPerTeam)+'" readonly><label class="sub tiny" for="preview-auto-goals"><input id="preview-auto-goals" type="checkbox" checked> Auto-estimate from ratings and rules</label></div></div>'+
  '<p class="help">Automatic team-goal estimates follow the game’s roll, scoring-margin, overtime, Offensive Depth and goal-cap rules. The example team faces a representative +8/+1/+1 opponent across many simulated matchups. This is a projection, not a guarantee or an analysis of actual league opponents. Uncheck Auto-estimate to enter your own team goals. Real players have hidden targets and Motivation.</p>'+
  '<div class="scoring-presets"><span class="sub tiny">Quick presets:</span>'+
  '<button type="button" data-scoring-preset="balanced">Balanced</button>'+
  '<button type="button" data-scoring-preset="moderate">Moderate</button>'+
  '<button type="button" data-scoring-preset="default">Original defaults</button>'+
  '<button type="button" data-scoring-preset="stars">Star-heavy</button></div>'+
  '<p class="help">Presets change only the goal and assist strength controls above. Use the Save button to apply them to future seasons.</p>'+
  '<div id="scoring-preview-results" aria-live="polite"></div>'+
  '</section>';
}
function scoringStrengthControls(key,label,value){
 return '<div class="control scoring-strength-control">'+
  '<label for="cfg-'+key+'">'+label+' <span class="sub tiny">(<span id="value-'+key+'">'+Number(value).toFixed(2)+'</span>)</span></label>'+
  '<input type="range" min="0.2" max="3" step="0.05" id="strength-'+key+'" value="'+value+'" aria-label="'+label+' slider">'+
  '<div class="strength-ends"><span>More balanced</span><span>Stars dominate</span></div>'+
  '<p class="sub tiny">Fine tune exponent: <input type="number" min="0.2" max="3" step="0.05" id="cfg-'+key+'" value="'+value+'" aria-label="'+label+' precise value"></p></div>';
}
function updateScoringPreview(){
 const output=$('scoring-preview-results');
 if(!output)return;
 for(const k of ['goalExponent','assistExponent']){
   const cfg=$('cfg-'+k),range=$('strength-'+k),label=$('value-'+k);
   if(cfg&&range&&typeof cfg.value==='string'&&cfg.value.trim()!==''&&Number.isFinite(Number(cfg.value)))range.value=cfg.value;
   if(label)label.textContent=cfg&&typeof cfg.value==='string'&&cfg.value.trim()!==''&&Number.isFinite(Number(cfg.value))?Number(cfg.value).toFixed(2):'—';
 }
 const numbers=['goalExponent','assistExponent','unnamedWeight','unassistedPct','oneAssistPct'].map(k=>$('cfg-'+k));
 if(numbers.some(e=>!e||typeof e.value!=='string'||e.value.trim()===''||!Number.isFinite(Number(e.value)))){
   output.innerHTML='<p class="odds-status odds-invalid">Enter valid scoring settings to see the preview.</p>';return;
 }
 const [goalExp,assistExp,unnamed,zero,one]=numbers.map(e=>Number(e.value));
 const ratingEls=[0,1,2].map(i=>$('preview-rating-'+i));
 if(ratingEls.some(e=>!e)||ratingEls.some(e=>!Number.isInteger(Number(e.value))||Number(e.value)<0||Number(e.value)>8)||
  goalExp<.2||goalExp>3||assistExp<.2||assistExp>3||unnamed<=0||zero<0||one<0||zero+one>100||
  !Number.isInteger(Number($('cfg-gamesPerTeam')?.value??state.settings.gamesPerTeam))){
   output.innerHTML='<p class="odds-status odds-invalid">Check the goal/assist strength, probabilities and roster ratings.</p>';return;
 }
 const ratings=ratingEls.map(e=>Number(e.value));
 if(!ratings.some(v=>v>0)){
  output.innerHTML='<p class="odds-status odds-invalid">Select at least one featured player; leave the other slots empty if needed.</p>';return;
 }
 const gamesPerTeam=Number($('cfg-gamesPerTeam')?.value??state.settings.gamesPerTeam);
 const teamGoalsEl=$('preview-team-goals');
 if(!teamGoalsEl)return;
 const auto=$('preview-auto-goals')?.checked!==false;
 teamGoalsEl.readOnly=auto;
 if(auto){
  const rules={...state.settings};
  for(const k of ['offensiveDepthStrength','maxGoalsPerTeam','maxBonus','rollMax']){
   const input=$('cfg-'+k);
   if(input&&String(input.value).trim()===''){
    output.innerHTML='<p class="odds-status odds-invalid">Enter valid game scoring rules for the estimate.</p>';return;
   }
   if(input)rules[k]=Number(input.value);
  }
  if(!Number.isFinite(rules.offensiveDepthStrength)||rules.offensiveDepthStrength<0||rules.offensiveDepthStrength>3||
     !Number.isInteger(rules.maxGoalsPerTeam)||rules.maxGoalsPerTeam<9||rules.maxGoalsPerTeam>15||
     !Number.isInteger(rules.rollMax)||rules.rollMax<4||rules.rollMax>100||
     !Number.isInteger(rules.maxBonus)||rules.maxBonus<0||rules.maxBonus>30){
    output.innerHTML='<p class="odds-status odds-invalid">Check Offensive Depth, roll maximum, team bonus cap and goal ceiling.</p>';return;
  }
  teamGoalsEl.value=String(scoringPreviewTeamGoals(ratings,rules,gamesPerTeam));
 }
 const teamGoals=Number(teamGoalsEl.value);
 if(teamGoalsEl.value.trim()===''||!Number.isInteger(teamGoals)||teamGoals<1||teamGoals>2000){
  output.innerHTML='<p class="odds-status odds-invalid">Enter team goals between 1 and 2000, or enable Auto-estimate.</p>';return;
 }
 const personalTargets=[0,1,2].map(i=>{const el=$('preview-target-'+i),value=Number(el?.value);const target=Number.isInteger(value)&&value>=25&&value<=40?value:30;const occupied=ratings[i]>0;const label=$('preview-target-label-'+i);if(label)label.textContent=occupied?String(target):'—';if(el)el.disabled=!occupied;return target});
 const result=scoringPreviewOdds(ratings,goalExp,assistExp,unnamed,zero,one,teamGoals,gamesPerTeam,personalTargets);
 const items=ratings.flatMap((r,i)=>r>0?[{name:'Player '+('ABC'[i])+' (+'+r+', target '+personalTargets[i]+')',i}]:[]).concat({name:'Unnamed skaters',i:3});
 const rows=items.map(({name,i})=>{
   const share=result.goals[i]*100;
   return '<tr><td class="preview-name">'+name+'<div class="preview-meter"><span style="width:'+share.toFixed(1)+'%"></span></div></td>'+
   '<td>'+share.toFixed(1)+'%</td><td>'+ (result.goals[i]*teamGoals).toFixed(1)+'</td>'+
   '<td>'+(result.assists[i]*teamGoals).toFixed(1)+'</td>'+
   '<td><b>'+((result.goals[i]+result.assists[i])*teamGoals).toFixed(1)+'</b></td></tr>';
 }).join('');
 output.innerHTML='<p class="sub tiny">'+(auto?'Auto-estimated':'Manually assumed')+' <b>'+fmt(teamGoals)+'</b> team goals over '+fmt(gamesPerTeam)+' games &middot; '+result.assistsPerGoal.toFixed(2)+' assists per goal</p>'+
  '<div class="tablewrap"><table class="preview-table"><thead><tr><th>Scorer</th><th>Goal chance</th><th>Goals</th><th>Assists</th><th>Points</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table></div>'+
  '<p class="help">Only occupied player slots receive featured goals and assists; empty slots contribute nothing. A neutral +8 starts with a hidden personal target in the 25–35 range, averaging 30 across new players, and may develop as high as 40. Sliders here only explore hypothetical player tendencies; their real values are never shown. When expected team scoring is too low to support all featured goal targets, the goals must be shared. A scorer cannot assist their own goal, and each named player can earn at most one assist per goal. This is a mathematical preview, not a guaranteed result.</p>';
}
function applyScoringPreset(name){
 const values=SCORING_PRESETS[name];
 if(!values)return;
 for(const [i,k] of ['goalExponent','assistExponent'].entries()){
  const el=$('cfg-'+k);
  if(el)el.value=String(values[i]);
 }
 updateScoringPreview();
}
