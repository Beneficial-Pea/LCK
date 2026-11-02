import test from 'node:test';
import assert from 'node:assert/strict';
import {readinessFor} from '../lib/readiness.mjs';
import {championComfort} from '../lib/champion-comfort.mjs';
import {simulateSeries} from '../lib/match.mjs';
import {renderReadiness} from '../public/honors.js';
test('high mental softens condition and fatigue penalties up to 30 percent without recovering state or training growth',()=>{
 const c={stats:{mental:65},condition:25,fatigue:90,stress:40},before=structuredClone(c),normal=readinessFor(c),strong=readinessFor({...c,stats:{mental:99}});
 assert.equal(normal.mentalMitigation,0);assert.equal(strong.mentalMitigation,.3);assert(strong.conditionFactor>normal.conditionFactor);assert(Math.abs((1-strong.conditionFactor)/(1-normal.conditionFactor)-.7)<1e-12);assert.equal(strong.fatiguePenalty,normal.fatiguePenalty*.7);assert.equal(strong.stressPenalty,normal.stressPenalty);assert.equal(strong.growthFactor,.35);assert.equal(strong.tier,'탈진');assert.deepEqual(c,before);
 let last=0;for(let mental=20;mental<=100;mental++){const r=readinessFor({...c,stats:{mental}});assert(r.mentalMitigation>=last&&r.mentalMitigation<=.3);last=r.mentalMitigation;}
 assert.equal(readinessFor({...c,effectiveStats:{mental:99}}).mentalMitigation,.3);assert(renderReadiness({...c,readiness:strong}).includes('불이익 30% 완화'));assert.equal(readinessFor({...c,stats:{mental:99}},{version:0}).mentalMitigation,0);
});
test('signature and registered main champions have separate nonstacking bonuses; outside-pool penalty is retained',()=>{
 const p={mainChampion:'아리',pool:['아리','오리아나']};assert.deepEqual(championComfort(p,'아리'),{kind:'signature',bonusPercent:6});assert.deepEqual(championComfort(p,'오리아나'),{kind:'main',bonusPercent:3});assert.deepEqual(championComfort(p,'제드'),{kind:'off-pool',bonusPercent:-6});assert.equal(championComfort(p,'아리',{version:0}).bonusPercent,3.5);assert.equal(championComfort(p,'오리아나',{version:0}).bonusPercent,0);
});
test('new match rules record actual draft comfort and alter combat deterministically; legacy records omit new metadata',()=>{
 const input={teamA:{name:'A',power:90},teamB:{name:'B',power:78},bestOf:3,seed:'comfort-live'};
 const fresh=simulateSeries(input),legacy=simulateSeries({...input,performanceVersion:0});assert.deepEqual(fresh,simulateSeries(input));let combatChanged=false;for(let i=0;i<12&&!combatChanged;i++){const args={...input,seed:'performance-impact-'+i};combatChanged=JSON.stringify(simulateSeries(args).sets[0].events)!==JSON.stringify(simulateSeries({...args,performanceVersion:0}).sets[0].events);}assert(combatChanged,'New bonuses must affect actual combat, not just badges');
 for(const set of fresh.sets){assert.equal(set.performanceVersion,1);for(const p of set.scoreboard){assert([6,3,-6].includes(p.championComfort.bonusPercent));const picks=p.team==='A'?set.draft.picksA:set.draft.picksB;assert.deepEqual(p.championComfort,picks.find(q=>q.position===p.position).comfort);}}
 for(const set of legacy.sets){assert(!set.performanceVersion);assert(set.scoreboard.every(p=>!p.championComfort));assert(set.draft.picksA.every(p=>!p.comfort));}
});
