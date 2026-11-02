import test from 'node:test';
import assert from 'node:assert/strict';
import {stageFinishSnapshot,recordStageWrapUps} from '../lib/stage-wrapups.mjs';
import {createSeason,settleDay} from '../lib/season.mjs';
import {beginLiveMatch,advanceLiveMatch} from '../lib/live-match.mjs';
import {renderTournamentReward,tournamentMoments} from '../public/tournament-rewards.js';
const make=()=>({players:[{userId:'u',character:{id:'u',nickname:'Test',position:'MID',team:'T1',pool:['아리'],mainChampion:'아리',stats:{mechanics:65,laning:65,macro:65,communication:65,mental:65,mastery:65},condition:85,fatigue:10,stress:10}}],submissions:{},revision:1,season:createSeason({year:2026,team:'T1',seed:'wrap-up'})});
const game=(id,winner='Gen.G')=>({id,date:'2026-02-20',stage:'LCK Cup',teamA:'T1',teamB:'Gen.G',status:'completed',result:{winner}});
test('a lower-bracket route prevents elimination and a terminal loss records a personal team scene only once',()=>{
 const r=make(),s=r.season;s.schedule=[game('upper')];s.tournaments.fixtureIds.cupPlayoffs=['upper','lower'];s.tournaments.templates.cupPlayoffs=[{id:'upper',slots:[]},{id:'lower',slots:[{match:'upper',outcome:'loser'}]}];
 assert(!stageFinishSnapshot(s).cupPlayoffs);const before=stageFinishSnapshot(s),stats=structuredClone(r.players);
 s.schedule.push(game('lower'));const added=recordStageWrapUps(r,before);assert.equal(added.length,1);assert.equal(added[0].placement,'eliminated');assert(added[0].dialogue[0].text.includes('우리끼리 잘해보자고 했잖아'));assert.deepEqual(r.players,stats);
 assert.equal(recordStageWrapUps(r,before).length,0);assert.equal(s.stageWrapUps.length,1);
 const html=renderTournamentReward(added[0],'u');assert(html.includes('이번 대회는 여기까지'));assert(html.includes('코치'));assert(html.includes('매니저'));
});
test('LCK play-in losses with another chance stay active; qualification and the last defeat have different wrapups',()=>{
 for(const [id,winner,outcome]of [['pi-1','Gen.G',null],['pi-1','T1','qualified'],['pi-2','Gen.G','eliminated'],['pi-2','T1',null],['pi-3','Gen.G','eliminated'],['pi-3','T1','qualified']]){
  const r=make();r.season.schedule=[game(id,winner)];r.season.tournaments.fixtureIds.playin=[id];assert.equal(stageFinishSnapshot(r.season).playin?.outcome||null,outcome,id+' '+winner);
 }
});
test('regular-season wraps reflect the actual group and do not retroactively create scenes for old saves',()=>{
 const r=make(),s=r.season;s.schedule=[game('groups-1')];s.tournaments.fixtureIds.groups=['groups-1'];s.standings=[{team:'Gen.G',group:'레전드'},{team:'T1',group:'레전드'}];s.tournaments.playinSeeds=['T1'];
 const closed=stageFinishSnapshot(s);assert(closed.groups.detail.includes('레전드 그룹 2위'));assert(closed.groups.detail.includes('플레이인'));
 assert.deepEqual(recordStageWrapUps(r,closed),[]);assert.equal(s.stageWrapUps,undefined);
 const added=recordStageWrapUps(r,{});assert.equal(added[0].placement,'completed');assert.equal(tournamentMoments(r).length,1);
});
test('real finals use their existing title celebration without a second elimination wrapup',()=>{
 const r=make(),s=r.season;s.schedule=[game('cup-final')];s.tournaments.fixtureIds.cupPlayoffs=['cup-final'];s.tournaments.templates.cupPlayoffs=[{id:'cup-final',slots:[]}];assert.deepEqual(recordStageWrapUps(r,{}),[]);
});
test('EWC semifinalists still have bronze to play; third and fourth place close only after that game',()=>{
 for(const winner of ['T1','Gen.G']){const r=make(),s=r.season;s.tournaments.fixtureIds.ewc=Array.from({length:28},(_,i)=>'ewc-'+(i+1));s.schedule=[{...game('ewc-25'),stage:'EWC'}];assert(!stageFinishSnapshot(s).ewc);
 s.schedule.push({...game('ewc-27',winner),stage:'EWC'});assert(stageFinishSnapshot(s).ewc.detail.includes(winner==='T1'?'3위':'4위'));}
});
test('live settlement hides stage closures until its pending season is committed',()=>{
 const r=make(),s=r.season;s.cupDraft.status='completed';const m=s.schedule.find(m=>m.id==='fst-final');Object.assign(m,{date:s.date,teamA:'T1',teamB:'JDG',status:'scheduled',bestOf:1});
 const pending=structuredClone(r),summary=settleDay(pending);pending.season.stageWrapUps=[{id:'fixture',date:s.date,players:[{userId:'u'}]}];beginLiveMatch(r,pending,summary,{stepMs:1,now:0});assert.equal(r.season.stageWrapUps,undefined);advanceLiveMatch(r,1e9);assert.equal(r.season.stageWrapUps.length,1);
});

test('Road to MSI popups show the actual first or second qualification seed for both years and old saves',()=>{
 for(const year of [2025,2026])for(const seed of [1,2]){
  const r=make();r.season=createSeason({year,team:'T1',seed:'road-seed-label'});const ids=year===2026?[r.season.tournaments.fixtureIds.road[2],r.season.tournaments.fixtureIds.road[4]]:['road-upper','road-lower-final'];
  const reward={id:'stage-road',stageKey:'road',kind:'stage-wrap',placement:'qualified',date:r.season.date,team:'T1',tournament:'Road to MSI',matchId:ids[seed-1],dialogue:[],players:[{userId:'u'}]};r.season.stageWrapUps=[reward];r.season.qualifications.msi.teams=[];
  const before=structuredClone(r),view=tournamentMoments(r)[0];assert.equal(view.qualificationSeed,seed);const html=renderTournamentReward(view,'u');assert(html.includes(`Road to MSI ${seed}시드`));assert(!html.includes('Road to MSI 통과'));assert.deepEqual(r,before);
  reward.matchId=null;r.season.qualifications.msi.teams=seed===1?['T1','Gen.G']:['Gen.G','T1'];assert.equal(tournamentMoments(r)[0].qualificationSeed,seed);
 }
});
