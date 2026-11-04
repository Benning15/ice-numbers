'use strict';
// Cumulative V1.4 simulation diagnostics; distinct from league history.
function testingInformation(){
 titlebar('Testing Information','Tune settings, run seasons, and measure what the simulator actually produces.');
 const t=testingData(),format=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):'—';
 const safe=(n,d)=>d?n/d:null;
 const cards=(x)=>[
  ['Completed test seasons',fmt(x.seasons)],
  ['Average team +',format(safe(x.teamPlus,x.teamSeasons))],
  ['Average effective team +',format(safe(x.effectiveTeamPlus,x.teamSeasons))],
  ['Average named players/team',format(safe(x.playerSeasons,x.teamSeasons))],
  ['Average individual base +',format(safe(x.individualPlus,x.playerSeasons))],
  ['Highest team base +',fmt(x.highestTeamPlus||0)],
  ['Highest effective team +',fmt(x.highestEffectiveTeamPlus||0)],
  ['Goals/game (both teams)',format(safe(x.goals,x.games))],
  ['Goals/team/game',format(safe(x.goals,2*x.games))],
  ['OT coin-flip frequency',x.games?format(100*x.otGames/x.games,1)+'%':'—']
 ];
 const section=(x,label)=>'<div class="panel"><h3>'+label+'</h3><div class="cards">'+cards(x).map(([k,v])=>'<div class="stat"><span class="sub tiny">'+k+'</span><div class="big mono">'+v+'</div></div>').join('')+'</div></div>';
 const header=(title,subtitle)=>'<div class="panel"><h2>'+title+'</h2><p class="sub tiny">'+subtitle+'</p>';
 const rows=Object.entries(t.byStrength).sort((a,b)=>Number(a[0].split(/\D/)[0])-Number(b[0].split(/\D/)[0])).map(([range,o])=>'<tr><td>+'+range+'</td><td>'+fmt(o.games)+'</td><td>'+format(safe(o.goals,o.games))+'</td></tr>');
 const byRoster=Object.entries(t.byRosterCount).sort((a,b)=>Number(a[0])-Number(b[0])).map(([n,o])=>'<tr><td>'+n+'</td><td>'+fmt(o.games)+'</td><td>'+format(safe(o.goals,o.games))+'</td><td>'+format(safe(o.unidentifiedGoals,o.games))+'</td></tr>');
 const ratings=Object.entries(t.byEffectiveRating).sort((a,b)=>Number(a[0])-Number(b[0])).map(([rating,o])=>'<tr><td>+'+rating+'</td><td>'+fmt(o.games)+'</td><td>'+format(safe(o.goals,o.games),3)+'</td><td>'+format(safe(o.assists,o.games),3)+'</td></tr>');
 const baseRatings=Object.entries(t.byBaseRating).sort((a,b)=>Number(a[0])-Number(b[0])).map(([rating,o])=>'<tr><td>+'+rating+'</td><td>'+fmt(o.games)+'</td><td>'+format(safe(o.goals,o.games),3)+'</td><td>'+format(safe(o.assists,o.games),3)+'</td></tr>');
 const generated=Array.from({length:8},(_,i)=>'<tr><td>+'+(i+1)+'</td><td>'+fmt(t.generation.spawn[i+1]||0)+'</td><td>'+fmt(t.generation.draft[i+1]||0)+'</td></tr>');
 const threshold=Object.entries(t.goalSeasons).map(([name,n])=>'<tr><td>'+name[0].toUpperCase()+name.slice(1)+' or more goals</td><td>'+fmt(n)+'</td></tr>');
 const multi=Object.entries(t.multiGoalGames).map(([name,n])=>'<tr><td>'+name[0].toUpperCase()+name.slice(1)+' or more goals in one game</td><td>'+fmt(n)+'</td></tr>');
 $('app').innerHTML=
 '<div class="notice">These are measured results, not forced targets. A fresh universe starts its own testing data. Changing settings does not retroactively change recorded games or test results. Use Reset Testing Information when comparing new settings.</div>'+
 '<div class="buttonrow"><button id="reset-testing" class="danger">Reset Testing Information (keep league history)</button></div>'+
 section(t,'All measured seasons')+
 (t.checkpoints[100]?section(t.checkpoints[100],'Checkpoint after 100 seasons'):'<div class="panel"><h3>Checkpoint after 100 seasons</h3><p class="sub">Available after 100 completed test seasons.</p></div>')+
 (t.checkpoints[1000]?section(t.checkpoints[1000],'Checkpoint after 1,000 seasons'):'<div class="panel"><h3>Checkpoint after 1,000 seasons</h3><p class="sub">Available after 1,000 completed test seasons.</p></div>')+
 header('Team scoring by combined base rating','Uncapped sum of up to three player ratings. Goals are counted only in regular-season games.')+
 table(['Team +','Team games','Goals/team/game'],rows)+'</div>'+
 header('Unidentified roster and ice time','Goals from unidentified players include independent rolls and goals created by named teammates.')+
 table(['Named players','Team games','All goals/team/game','Unidentified goals/team/game'],byRoster)+'</div>'+
 header('Named-player goals and assists — base rating','Final measured goals and assists per game, grouped by permanent +1 through +8 rating.')+
 table(['Base rating','Player-games','Goals/player/game','Assists/player/game'],baseRatings)+'</div>'+
 header('Named-player goals and assists — effective rating','Effective rating includes Hidden Motivation; values can range 0 to +10.')+
 table(['Effective rating','Player-games','Goals/player/game','Assists/player/game'],ratings)+'</div>'+
 header('Generated and lottery draft ratings','Counts of players entering the league while testing was active. Undrafted prospects are excluded.')+
 table(['Base rating','Generated','Drafted'],generated)+
 '<p class="help">Team-seasons with two +8 players: '+fmt(t.teamsWithTwoEight||0)+' · Three +8 players: '+fmt(t.teamsWithThreeEight||0)+'</p></div>'+
 header('Extreme performances','Season counts use regular-season goals. Game counts include only regular-season games.')+
 table(['Season scoring','Occurrences'],threshold)+
 table(['Single-game scoring','Occurrences'],multi)+'</div>'+
 '<div class="panel"><p class="help">The 100 and 1,000 checkpoints are cumulative, not warmed-up averages. A continuous 1,000-season league is not the same as 1,000 fresh leagues. All historical scoring remains in Season History and Player History.</p></div>';
}
