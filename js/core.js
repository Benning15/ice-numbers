'use strict';
const TEAM_NAMES=["Estevan Bruins","Weyburn Red Wings","Regina Capitals","Saskatoon Blades","Moose Jaw Warriors","Warman Chiefs","Martensville Huskies","Swift Current Blues","Humboldt Broncos","La Ronge ICE","Lloydminster Oil","North Battleford Stars","Saskatchewan Wild","Yorkton Harvest","Round Lake Bears","Prince Albert Eagles"];
const DEFAULTS={gamesPerTeam:30,maxRoster:3,careerLength:5,playoffTeams:8,seriesBestOf:7,
 normalWeights:[40,27,16,9,4,2,1.5,.5],draftWeights:[13,18,20,18,13,9,6,3],startYear:1,generatedPlayersPerSeason:7,
 goalRateAt9:0.85,playmakingRateAt9:0.35,goalCurve:2,playmakingCurve:2,
 goalVolatility:0.2,unnamedGoalsPerGame:2.8,unnamedPlaymakingChancesPerGame:0.5,unnamedIceTimeImpact:0.55,
 unnamedRecipientWeight:3,unnamedAssistWeight:3,recipientCurve:1.3,
 tendencySpread:0,unassistedPct:6,oneAssistPct:19,secondaryAssistPct:55};
const TAB_NAMES={dashboard:'Dashboard',standings:'Standings',playoffs:'Playoff Bracket',alltime:'All-Time Records',history:'Season History',draft:'Draft Lottery',generation:'Player Generation',preview:'Preseason Preview',scoring:'Season Scoring',commissioner:'Commissioner Mode',teams:'Team Records',players:'Player History',customize:'Team Customization',testing:'Testing Information',faq:'FAQ',settings:'Settings'};
let seasonScoringStage='regular',seasonScoringYear=null;
let db,state,view='dashboard',sortBy='regW',sortDescending=true,selectedSeason=null,selectedTeam=0,selectedPlayer=null,playerQuery='',playerPage=0,playerSort='bonus',busy=false,cancelRun=false,progressText='',progressPercent=0,notice='';
const $=id=>document.getElementById(id),fmt=x=>Number(x||0).toLocaleString('en-CA'),pct=(a,b)=>b?(100*a/b).toFixed(1)+'%':'—',esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>JSON.parse(JSON.stringify(x));
function createTeam(name,id){return {id,name,logo:null,roster:[],regW:0,regL:0,regOTL:0,regPoints:0,regCoinW:0,regCoinL:0,playoffW:0,playoffL:0,playoffCoinW:0,playoffCoinL:0,playoffSeriesW:0,playoffSeriesL:0,playoffApps:0,missedPlayoffs:0,finals:0,titles:0,lastPlaces:0,currentPlayoffStreak:0,bestPlayoffStreak:0,currentMissStreak:0,bestMissStreak:0,currentTitleStreak:0,bestTitleStreak:0,titleDrought:0,longestTitleDrought:0,currentFirstStreak:0,bestFirstStreak:0,currentRegWinStreak:0,currentRegLossStreak:0,bestRegWinStreak:0,bestRegLossStreak:0,pointsFor:0,pointsAgainst:0,firstSeasonTitle:0}};
function initialState(){const seed=(Math.floor(Math.random()*0xffffffff)>>>0);return {version:3,season:0,activeSeason:null,regularSeason:null,seasonComplete:false,teams:TEAM_NAMES.map(createTeam),nextPlayerId:1,pendingDraftTeam:null,draft:null,generation:null,generatedForSeason:null,upcomingDraftNotes:[],transactions:[],nextTransactionId:1,futureRights:{generation:{},draft:{}},openingRostersPending:true,previewConfirmedForSeason:0,settings:clone(DEFAULTS),rngState:seed||123456789,initialSeed:seed||123456789,totalGames:0,totalCoin:0,notes:[]}};
function random(){let x=state.rngState=(state.rngState+0x6D2B79F5)>>>0;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296}
function randint(a,b){return a+Math.floor(random()*(b-a+1))}
function weighted(weights){let total=weights.reduce((a,b)=>a+b,0),r=random()*total;for(let i=0;i<weights.length;i++){r-=weights[i];if(r<0)return i+1}return weights.length}
