'use strict';
// Mathematical preview of current unsaved Settings; does not consume game RNG.
function scoringEstimatorMarkup(){
 const selectors=[0,1,2].map(i=>'<div class="control"><label for="preview-effective-'+i+'">Player '+('ABC'[i])+' effective rating</label>'+
 '<select id="preview-effective-'+i+'" class="select">'+Array.from({length:11},(_,r)=>
 '<option value="'+r+'" '+(r===[9,3,0][i]?'selected':'')+'>'+(r?'+'+r:'Empty / 0')+'</option>').join('')+'</select></div>').join('');
 return '<section class="scoring-preview"><h3>Live Scoring Estimator</h3>'+
 '<p class="help">Try a sample roster with current unsaved settings. Ratings here are effective ratings after motivation. This estimates average goals/game, not a specific game score; actual results remain random. Players use neutral 50/50 scoring tendencies.</p>'+
 '<div class="scoring-preview-controls">'+selectors+'</div>'+
 '<div id="scoring-estimator-output" aria-live="polite"></div></section>';
}
function updateScoringEstimator(){
 const target=$('scoring-estimator-output');if(!target)return;
 const s={...state.settings};
 for(const k of ['goalRateAt9','playmakingRateAt9','goalCurve','playmakingCurve','goalVolatility',
  'unnamedGoalsPerGame','unnamedIceTimeImpact','unnamedRecipientWeight','unnamedAssistWeight','recipientCurve']){
  const input=$('cfg-'+k);
  if(!input||input.value.trim()===''||!Number.isFinite(Number(input.value))){target.textContent='Enter valid settings to see the estimate.';return}
  s[k]=Number(input.value);
 }
 if(!(s.goalRateAt9>=0&&s.playmakingRateAt9>=0&&s.goalCurve>0&&s.playmakingCurve>0&&
 s.unnamedGoalsPerGame>=0&&s.unnamedIceTimeImpact>=0&&s.unnamedIceTimeImpact<=1&&s.unnamedRecipientWeight>0&&s.recipientCurve>0)){
  target.textContent='Check scoring settings first.';return;
 }
 const elems=[0,1,2].map(i=>$('preview-effective-'+i));
 if(elems.some(e=>!e))return;
 const players=elems.map((e,i)=>({id:i+1,bonus:Number(e.value),name:'Player '+('ABC'[i]),goalTendency:50,motivation:0}))
  .filter(p=>p.bonus>0);
 const unknown={id:null,label:'Unidentified roster',independent:unidentifiedRate({roster:players},s),fromPlays:0,created:0};
 const rows=players.map(p=>({id:p.id,label:p.name+' (+'+p.bonus+')',independent:goalRate(p,s),fromPlays:0,created:playmakingRate(p,s)}));
 for(const creator of rows){
  const candidates=[{row:unknown,weight:s.unnamedRecipientWeight},
   ...rows.filter(x=>x.id!==creator.id).map(x=>({row:x,weight:Math.pow(.35+players.find(p=>p.id===x.id).bonus/6,s.recipientCurve)}))];
  const sum=candidates.reduce((v,x)=>v+x.weight,0);
  if(sum>0)for(const x of candidates)x.row.fromPlays+=creator.created*x.weight/sum;
 }
 const total=rows.concat(unknown).reduce((v,x)=>v+x.independent+x.fromPlays,0);
 target.innerHTML='<p class="record"><b>Expected team goals/game: '+total.toFixed(2)+'</b>'+
 ' · '+(total*s.gamesPerTeam).toFixed(0)+' over '+s.gamesPerTeam+' games at this constant lineup</p>'+
 table(['Source','Own goals/game','From teammates','Final goals/game','Created goals/game'],rows.concat(unknown).map(r=>
 '<tr><td>'+esc(r.label)+'</td><td>'+r.independent.toFixed(2)+'</td><td>'+r.fromPlays.toFixed(2)+'</td>'+
 '<td><b>'+(r.independent+r.fromPlays).toFixed(2)+'</b></td><td>'+r.created.toFixed(2)+'</td></tr>'))+
 '<p class="help">Created goals award primary assists to the creator. The table does not estimate additional random assists on independent goals or secondary assists. No goals are double-counted.</p>';
}
