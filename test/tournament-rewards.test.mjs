import test from 'node:test';
import assert from 'node:assert/strict';
import {recordTournamentFinish} from '../lib/tournament-rewards.mjs';
import {subjectName,repairStaffSubjects} from '../lib/korean.mjs';
import {decorateDailyLife} from '../lib/daily-life.mjs';
import {renderTournamentReward} from '../public/tournament-rewards.js';
import {seasonShared,createSeason} from '../lib/season.mjs';
import {beginLiveMatch,advanceLiveMatch} from '../lib/live-match.mjs';
const room=()=>({players:['u','v'].map(userId=>({userId,character:{id:userId,nickname:userId,position:userId==='u'?'MID':'ADC',team:'T1',stats:{mechanics:65,laning:65,macro:65,communication:65,mental:65,mastery:65},pool:['아리','카이사'],mainChampion:userId==='u'?'아리':'카이사',condition:80,fatigue:20,stress:20}})),revision:1,submissions:{},season:{id:'season',team:'T1',date:'2026-03-01',turn:49,history:[],schedule:[],results:[]}});
const final=(id='cup-final',winner='T1')=>({id,date:'2026-03-01',stage:'LCK Cup',round:'결승',teamA:'JDG',teamB:'T1',status:'completed',result:{winner}});
test('both finalists receive distinct small real rewards exactly once with actual capped deltas',()=>{
 for(const winner of ['T1','JDG']){const r=room(),m=final('cup-final',winner),award=recordTournamentFinish(r,m);assert.equal(award.placement,winner==='T1'?'champion':'runner-up');assert.equal(award.players.length,2);assert(r.players[0].character.stats.mental>65);assert(r.players[0].character.fatigue<20);const after=structuredClone(r);assert.equal(recordTournamentFinish(r,m),null);assert.deepEqual(r,after);}
 const r=room();for(const p of r.players){p.character.stats.mental=98.9;p.character.stats.communication=99;p.character.condition=100;p.character.fatigue=0;p.character.stress=0;}
 const a=recordTournamentFinish(r,final());assert.deepEqual(a.players[0].effects,{mental:.1,communication:0,condition:0,fatigue:0,stress:0});
});
test('only a completed tournament final involving our team awards a title; old records are not replayed',()=>{
 for(const id of ['cup-upper','msi-lower-final','road-final','ewc-kr-15','demacia-26'])assert.equal(recordTournamentFinish(room(),final(id)),null);
 for(const id of ['cup-final','po-final','fst-final','msi-final','worlds-final','ewc-final','demacia-27'])assert(recordTournamentFinish(room(),final(id)));
 const r=room();assert.equal(recordTournamentFinish(r,{...final(),status:'scheduled'}),null);assert.equal(recordTournamentFinish(r,{...final(),teamB:'G2'}),null);assert.equal(r.season.tournamentRewards,undefined);
});
test('a real simulated final commits rewards with the broadcast and never reveals them early',()=>{
 const r=room();r.season=createSeason({year:2026,team:'T1',seed:'title-test'});r.season.cupDraft.status='completed';
 const match={...final('fst-final'),bestOf:1,status:'scheduled'};delete match.result;r.season.schedule=[match];
 const pending=structuredClone(r);seasonShared.runMatch(pending,pending.season.schedule[0]);
 assert.equal(pending.season.tournamentRewards.length,1);const original=structuredClone(r.players);
 beginLiveMatch(r,pending,{date:r.season.date,matches:['fst-final']},{now:1000,stepMs:1});
 assert.equal(r.season.tournamentRewards,undefined);assert.deepEqual(r.players,original);
 advanceLiveMatch(r,1e9);assert.equal(r.season.tournamentRewards.length,1);assert.deepEqual(r.players.map(p=>p.character.stats),pending.players.map(p=>p.character.stats));
 const after=structuredClone(r);advanceLiveMatch(r,1e9+1);assert.deepEqual(r,after);
});
test('Korean staff subjects are grammatical and existing saved daily stories are corrected for display',()=>{
 assert.equal(subjectName('매니저'),'매니저가');assert.equal(subjectName('코치'),'코치가');assert.equal(subjectName('분석관'),'분석관이');assert.equal(subjectName('민수'),'민수가');assert.equal(subjectName('선우진'),'선우진이');
 const r=room();r.season.dailyLife={entries:[{text:'매니저이 말했다. 코치이 왔다.',reply:'코치이 고개를 끄덕였다.',answer:'join'}]};r.season.history=[{type:'daily-life',text:'매니저이 말했다.'}];decorateDailyLife(r);
 assert.equal(r.season.dailyLife.entries[0].text,'매니저가 말했다. 코치가 왔다.');assert.equal(r.season.history[0].text,'매니저가 말했다.');assert.equal(repairStaffSubjects('분석관이 말했다.'),'분석관이 말했다.');
});
test('title popup shows the appropriate placement and actual effects with escaped labels',()=>{
 for(const winner of ['T1','JDG']){const r=room(),award=recordTournamentFinish(r,final('cup-final',winner));award.team='<img>';const html=renderTournamentReward(award,'u');assert(html.includes(winner==='T1'?'우승했습니다!':'준우승했습니다!'));assert(html.includes('멘탈 +'));assert(html.includes('&lt;img&gt;'));assert(!html.includes('<img>'));}
});
