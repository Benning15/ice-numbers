'use strict';

// Settings-only analytical preview. It follows scoringPlay's exact weighted
// scorer/assister selection, including scorer exclusion, no repeated featured
// assister, and the unnamed-skater bucket for each assist slot.
const SCORING_PRESETS={
 balanced:[1,1],
 moderate:[1.15,1.2],
 default:[1.35,1.2],
 stars:[1.65,1.55]
};
function scoringPreviewOdds(ratings,goalExponent,assistExponent,unnamedWeight,unassistedPct,oneAssistPct){
 const goalWeights=ratings.map(v=>Math.pow(v+1,goalExponent)).concat(unnamedWeight);
 const assistWeights=ratings.map(v=>Math.pow(v+1,assistExponent)).concat(unnamedWeight);
 const goalSum=goalWeights.reduce((a,b)=>a+b,0);
 const goals=goalWeights.map(v=>v/goalSum);
 const assists=[0,0,0,0];
 const probabilities=[unassistedPct/100,oneAssistPct/100,(100-unassistedPct-oneAssistPct)/100];
 for(let scorer=0;scorer<4;scorer++){
   const eligible=[0,1,2,3].filter(j=>j!==scorer);
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
 const select=(v,i)=>'<div class="control"><label for="preview-rating-'+i+'">Player '+('ABC'[i])+'</label><select id="preview-rating-'+i+'" class="select" data-preview-rating="'+i+'">'+Array.from({length:8},(_,j)=>'<option value="'+(j+1)+'" '+(j+1===v?'selected':'')+'>+'+(j+1)+'</option>').join('')+'</select></div>';
 return '<section class="scoring-preview" aria-label="Live scoring calculator">'+
  '<h3>Live scoring calculator</h3>'+
  '<p class="help">Choose a three-player roster to see who receives goals and assists. This is a preview only — it does not generate players or change game results.</p>'+
  '<div class="scoring-preview-controls">'+ratings.map(select).join('')+
  '<div class="control"><label for="preview-team-goals">Assumed team goals in season</label><input type="number" id="preview-team-goals" min="1" max="2000" step="1" value="'+(s.gamesPerTeam*3)+'"></div></div>'+
  '<p class="help">For example, 90 team goals over 30 games. This is an assumption for the preview, not a forecast.</p>'+
  '<div class="scoring-presets"><span class="sub tiny">Quick presets:</span>'+
  '<button type="button" data-scoring-preset="balanced">Balanced</button>'+
  '<button type="button" data-scoring-preset="moderate">Moderate</button>'+
  '<button type="button" data-scoring-preset="default">Original defaults</button>'+
  '<button type="button" data-scoring-preset="stars">Star-heavy</button></div>'+
  '<p class="help">Presets change only the goal and assist strength controls above. Press <b>Save All Settings</b> to apply them to future seasons.</p>'+
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
   if(cfg&&range&&Number.isFinite(Number(cfg.value))&&cfg.value.trim()!=='')range.value=cfg.value;
   if(label)label.textContent=cfg&&cfg.value.trim()!==''&&Number.isFinite(Number(cfg.value))?Number(cfg.value).toFixed(2):'—';
 }
 const numbers=['goalExponent','assistExponent','unnamedWeight','unassistedPct','oneAssistPct'].map(k=>$('cfg-'+k));
 const inputs=numbers.concat([$('preview-team-goals')]);
 if(inputs.some(e=>!e||e.value.trim()===''||!Number.isFinite(Number(e.value)))){
   output.innerHTML='<p class="odds-status odds-invalid">Enter valid scoring settings to see the preview.</p>';return;
 }
 const [goalExp,assistExp,unnamed,zero,one,teamGoals]=inputs.map(e=>Number(e.value));
 const ratingEls=[0,1,2].map(i=>$('preview-rating-'+i));
 if(ratingEls.some(e=>!e)||ratingEls.some(e=>!Number.isInteger(Number(e.value))||Number(e.value)<1||Number(e.value)>8)||
  goalExp<.2||goalExp>3||assistExp<.2||assistExp>3||unnamed<=0||zero<0||one<0||zero+one>100||
  !Number.isInteger(teamGoals)||teamGoals<1||teamGoals>2000){
   output.innerHTML='<p class="odds-status odds-invalid">Check the goal/assist strength, probabilities, roster ratings and team-goal assumption.</p>';return;
 }
 const ratings=ratingEls.map(e=>Number(e.value));
 const result=scoringPreviewOdds(ratings,goalExp,assistExp,unnamed,zero,one);
 const items=ratings.map((r,i)=>({name:'Player '+('ABC'[i])+' (+'+r+')',i})).concat({name:'Unnamed skaters',i:3});
 const rows=items.map(({name,i})=>{
   const share=result.goals[i]*100;
   return '<tr><td class="preview-name">'+name+'<div class="preview-meter"><span style="width:'+share.toFixed(1)+'%"></span></div></td>'+
   '<td>'+share.toFixed(1)+'%</td><td>'+ (result.goals[i]*teamGoals).toFixed(1)+'</td>'+
   '<td>'+(result.assists[i]*teamGoals).toFixed(1)+'</td>'+
   '<td><b>'+((result.goals[i]+result.assists[i])*teamGoals).toFixed(1)+'</b></td></tr>';
 }).join('');
 output.innerHTML='<p class="sub tiny">Projected scoring across <b>'+fmt(teamGoals)+'</b> team goals &middot; '+result.assistsPerGoal.toFixed(2)+' assists per goal</p>'+
  '<div class="tablewrap"><table class="preview-table"><thead><tr><th>Scorer</th><th>Goal chance</th><th>Goals</th><th>Assists</th><th>Points</th></tr></thead>'+
  '<tbody>'+rows+'</tbody></table></div>'+
  '<p class="help">Goals are assigned first. The goal scorer cannot earn an assist on that goal, and each featured player can receive at most one assist per goal. Numbers are mathematical expectations, not guaranteed season totals; roster/team goal assumptions are only for this preview.</p>';
}
function applyScoringPreset(name){
 const values=SCORING_PRESETS[name];
 if(!values)return;
 for(const [i,k] of ['goalExponent','assistExponent'].entries()){
  const el=$('cfg-'+k);
  if(el)el.value=values[i];
 }
 updateScoringPreview();
}
