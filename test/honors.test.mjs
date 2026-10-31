import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateSeries } from '../lib/match.mjs';
import { annotateMultiKills, selectPom } from '../lib/match-honors.mjs';
import { CHARACTER_BACKGROUNDS, startingStats, normalizeBackground } from '../lib/backgrounds.mjs';
import { recordMatchAwards, publishSeasonAwards, ensureAwards } from '../lib/player-awards.mjs';
import { createSeason, settleDay } from '../lib/season.mjs';
import { renderCupProgress, renderPomCard, renderSeasonAwards, backgroundPreview, renderLckStandings, renderDomesticBracket, renderReadiness } from '../public/honors.js';
import { tournamentBoards, renderBracketBoard, renderActiveTournament } from '../public/tournament-board.js';
import { readinessFor } from '../lib/readiness.mjs';
import { renderMatchText } from '../public/match-feed.js';

const series=seed=>simulateSeries({teamA:{name:'T1'},teamB:{name:'Gen.G'},bestOf:5,seed});
test('five unique bans per side exclude spent champions and all ten current bans exclude picks',()=>{
 const r=series('five-bans'),spent=new Set();
 for(const set of r.sets){
  assert.equal(set.draft.bansA.length,5);assert.equal(set.draft.bansB.length,5);
  const bans=[...set.draft.bansA,...set.draft.bansB];assert.equal(new Set(bans).size,10);
  for(const ban of bans)assert(!spent.has(ban));
  for(const pick of [...set.draft.picksA,...set.draft.picksB]){assert(!bans.includes(pick.champion));assert(!spent.has(pick.champion));spent.add(pick.champion);}
 }
});
test('POM uses one winning-side player and actual full-series KDA, including a support candidate',()=>{
 const r=series('POM');assert(r.pom);assert.equal(r.pom.team,r.winner);
 const p=r.performances.find(p=>p.playerId===r.pom.playerId&&p.team===r.winner);assert.equal(p.sets,r.sets.length);
 for(const [key,kda] of [['kills','k'],['deaths','d'],['assists','a']])assert.equal(r.pom[key],r.sets.reduce((sum,s)=>sum+s.scoreboard.find(q=>q.playerId===p.playerId&&q.team===p.team)[kda],0));
 assert.deepEqual(r,series('POM'));
 const rows=r.performances.filter(p=>p.team===r.winner).map(p=>({...p,kills:0,assists:0,deaths:20}));
 const support=rows.find(p=>p.position==='SUP');support.assists=50;support.deaths=0;
 assert.equal(selectPom(rows,r.winner,'support').position,'SUP');
});
test('multi-kills require consecutive real kills within the timer and never change KDA or nexus',()=>{
 let found=new Set();
 for(let i=0;i<350&&!found.has(5);i++){
  const r=simulateSeries({teamA:{name:'A'},teamB:{name:'B'},bestOf:3,seed:'honors-'+i});
  for(const s of r.sets){assert.equal(s.events.at(-1).type,'nexus');for(const event of s.events){
   for(const m of event.multiKills){
    found.add(m.count);assert([3,4,5].includes(m.count));
    const kills=event.kills.filter(k=>k.killer===m.nickname&&k.killerTeam===m.team&&k.time<=m.time);
    assert(kills.length>=m.count);assert.equal(new Set(kills.map(k=>k.victim)).size,kills.length);
    assert(event.casting.includes(m.label));assert(renderMatchText(event).includes(`data-multikill="${m.count}"`));
   }
  }}
 }
 assert(found.has(5),'a pentakill is reachable');
 const set={scoreboard:[{nickname:'A',team:'A'}],events:[{id:'gap',time:'03:00',kills:Array.from({length:5},(_,i)=>({killer:'A',killerTeam:'A',victim:'B'+i,victimTeam:'B'})),text:'교전',casting:'교전입니다.',reactions:[]}]};
 annotateMultiKills(set,'gap-test');const kills=set.events[0].kills;
 for(const m of set.events[0].multiKills){const end=kills.findIndex(k=>k.time===m.time);for(let j=end-m.count+2;j<=end;j++)assert(kills[j].timeSeconds-kills[j-1].timeSeconds<=10);}
});
test('backgrounds have small server-owned bonuses and previous All-Pro is separate from current trophies',()=>{
 assert.equal(normalizeBackground(undefined),'none');assert.throws(()=>normalizeBackground('champion'),/배경/);
 for(const b of CHARACTER_BACKGROUNDS){const stats=startingStats(b.id);assert.equal(Object.keys(stats).length,6);assert(Object.values(stats).every(v=>v>=65&&v<=67));assert.deepEqual(stats,startingStats(b.id));}
 assert.equal(startingStats('veteran').communication,67);assert.equal(startingStats('former_all_pro').mechanics,66);
 assert(backgroundPreview(CHARACTER_BACKGROUNDS,'former_all_pro').includes('올프로'));assert(!backgroundPreview(CHARACTER_BACKGROUNDS,'none').includes('+0'));
 const s={year:2026,results:[]};assert.equal(Object.keys(ensureAwards(s).ledger).length,0);assert.equal(s.awards.ceremony,null);
});
test('ledger covers both teams exactly once; annual award counts only regular season and freezes 15 role-specific awards',()=>{
 const s={year:2026,date:'2026-09-30',turn:1,results:[],history:[]};
 for(let i=0;i<6;i++){
  const r=simulateSeries({teamA:{name:'Team'+i},teamB:{name:'Team'+((i+1)%6)},bestOf:3,seed:'awards'+i});
  assert(recordMatchAwards(s,{id:'league-'+i},r));assert(!recordMatchAwards(s,{id:'league-'+i},r));
 }
 const rows=Object.values(s.awards.ledger);assert.equal(rows.reduce((sum,p)=>sum+p.regular.pom,0),6);assert.equal(rows.reduce((sum,p)=>sum+p.regular.matches,0),60);
 const r=series('international');recordMatchAwards(s,{id:'worlds-final'},r);assert.equal(Object.values(s.awards.ledger).reduce((sum,p)=>sum+p.regular.pom,0),6);
 assert(!publishSeasonAwards(s));s.date='2026-10-01';assert(publishSeasonAwards(s));
 const ceremony=structuredClone(s.awards.ceremony),selected=ceremony.allPro.flatMap(t=>t.players);assert.equal(selected.length,15);assert.equal(new Set(selected.map(p=>p.team+':'+p.playerId)).size,15);
 for(const tier of ceremony.allPro)assert.deepEqual(tier.players.map(p=>p.position),['TOP','JGL','MID','ADC','SUP']);
 assert.equal(ceremony.playerOfYear.regular.pom,Math.max(...rows.map(p=>p.regular.pom)));
 recordMatchAwards(s,{id:'league-late'},series('late'));assert(!publishSeasonAwards(s));assert.deepEqual(s.awards.ceremony,ceremony);assert.equal(s.history.length,1);
 assert(renderSeasonAwards({season:s}).includes('PLAYER OF THE YEAR'));assert(renderPomCard({...r.pom,nickname:'<bad>'}).includes('&lt;bad&gt;'));
});
test('old compacted matches are excluded from new player accounting without inventing historical awards',()=>{
 const s={year:2026,results:[{id:'league-old'}]};recordMatchAwards(s,{id:'league-new'},series('new'));
 assert.equal(s.awards.untrackedMatches,1);assert.equal(s.awards.processedIds.length,2);assert.equal(Object.values(s.awards.ledger).reduce((n,p)=>n+p.regular.pom,0),1);
});
test('Cup shows Baron/Elder and independently persists direct, play-in and playoff qualifiers',()=>{
 const room={players:[],submissions:{},season:createSeason({year:2026,team:'T1',seed:'cup-stages'}),revision:0};
 let html=renderCupProgress(room);assert(html.includes('바론 그룹'));assert(html.includes('장로 그룹'));assert(!html.includes('undefined'));
 while(room.season.date<='2026-02-01')settleDay(room,{npcTakeover:true});
 const t=room.season.tournaments;assert.equal(t.cupDirect.length,3);assert.equal(t.cupPlayinTeams.length,6);assert.equal(new Set([...t.cupDirect,...t.cupPlayinTeams,...t.cupEliminated]).size,10);
 html=renderCupProgress(room);for(const team of t.cupPlayinTeams)assert(html.includes(team));assert(!t.cupPlayinQualifiers);
 while(room.season.date<='2026-02-08')settleDay(room,{npcTakeover:true});
 assert.equal(t.cupPlayinQualifiers.length,3);assert(t.cupPlayinQualifiers.every(team=>t.cupPlayinTeams.includes(team)));assert.equal(new Set(t.cupPlayoffTeams).size,6);
 assert(renderCupProgress(room).includes(t.cupPlayoffTeams.join(' · ')));assert(room.season.history.some(h=>h.text.includes('플레이오프에 합류')));
 const htmlPlayoffs=renderDomesticBracket(room,'cupPlayoffs');assert(htmlPlayoffs.includes('승자조 준결승'));assert(htmlPlayoffs.includes('패자조 결승'));assert(htmlPlayoffs.includes('최종 결승'));assert(htmlPlayoffs.includes('<path'));
 assert(renderLckStandings(room,'REGULAR-TABLE').includes('data-lck-stage="cupPlayoffs"'));assert(!renderLckStandings(room,'REGULAR-TABLE').includes('REGULAR-TABLE'));
 room.season.date='2026-04-15';assert(renderLckStandings(room,'REGULAR-TABLE').includes('REGULAR-TABLE'));
});

test('readiness exposes the exact match penalties and existing training thresholds; resting restores them',()=>{
 const fresh=readinessFor({condition:100,fatigue:0,stress:0});assert.equal(fresh.conditionFactor,1);assert.equal(fresh.fatiguePenalty,0);assert.equal(fresh.growthFactor,1);
 const tired=readinessFor({condition:40,fatigue:71,stress:30});assert.equal(tired.conditionFactor,.88);assert.equal(tired.fatiguePenalty,7.81);assert.equal(tired.growthFactor,.35);assert.equal(tired.tier,'탈진');
 assert.equal(readinessFor({fatigue:41}).growthFactor,.7);assert.equal(readinessFor({fatigue:40}).growthFactor,1);
 const c={condition:40,fatigue:71,stress:30,readiness:tired};assert(renderReadiness(c).includes('훈련 성장량 65% 감소'));assert(renderReadiness(c).includes('−12.0%'));
 const before=series('readiness-reference');assert.deepEqual(before,series('readiness-reference'));
});

test('international and Road-to boards follow current routing, leave unmade draws empty and switch with the calendar',()=>{
 const room={players:[],submissions:{},season:createSeason({year:2026,team:'T1',seed:'all-boards'}),revision:0};
 const expected=new Map([['2026-03-17','fst'],['2026-05-05','ewcRoad'],['2026-06-07','road'],['2026-06-29','msiPlayin'],['2026-07-06','msiMain'],['2026-07-15','ewc'],['2026-07-18','ewc'],['2026-10-05','demacia'],['2026-10-20','worldsSwiss'],['2026-11-08','worldsKnockout']]);
 while(!room.season.finished){
  const key=expected.get(room.season.date);
  if(key){const html=renderActiveTournament(room);assert(html.includes(`data-active-tournament="${key}"`),room.season.date);assert(!html.includes('undefined'));assert(html.includes('data-bracket-match'));}
  settleDay(room,{npcTakeover:true});
 }
 for(const board of tournamentBoards(room)){
  const html=renderBracketBoard(room,board);assert(!html.includes('undefined'),board.key);
  if(board.edges.some(edge=>edge.slots.some(slot=>slot.match)))assert(html.includes('<path'),board.key);
 }
 const msi=tournamentBoards(room).find(b=>b.key==='msiMain'),msiHtml=renderBracketBoard(room,msi);assert(msiHtml.includes('승자조 준결승'));assert(msiHtml.includes('패자조 결승'));assert(msiHtml.includes('최종 결승'));
 const future={season:createSeason({year:2026,team:'T1'})};for(const m of future.season.schedule){m.sourceTeams=['DO-NOT-LEAK'];m.sourceRound='DO-NOT-LEAK';}
 assert(!renderBracketBoard(future,tournamentBoards(future).find(b=>b.key==='worldsKnockout')).includes('DO-NOT-LEAK'));
});
