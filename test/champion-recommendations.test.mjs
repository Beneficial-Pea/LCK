import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAMPION_RECOMMENDATIONS,recommendChampions} from '../lib/champion-recommendations.mjs';
import {CHAMPIONS} from '../lib/match.mjs';

test('all twenty role/style combinations recommend distinct mains and eight playable role champions',()=>{
 for(const position of ['TOP','JGL','MID','ADC','SUP']){
  const mains=[];
  for(const style of ['균형 운영','초반 주도권','한타','사이드 운영']){
   const recommendation=recommendChampions(position,style);assert.equal(recommendation.pool.length,8);assert.equal(new Set(recommendation.pool).size,8);
   assert(recommendation.pool.includes(recommendation.mainChampion));assert(recommendation.reason);
   for(const champion of recommendation.pool)assert(CHAMPIONS[position].includes(champion),`${position}/${style}: ${champion}`);
   mains.push(recommendation.mainChampion);
  }
  assert.equal(new Set(mains).size,4);
 }
 assert.equal(recommendChampions('SUP','한타').mainChampion,'렐');assert.equal(recommendChampions('JGL','초반 주도권').mainChampion,'리 신');
});
test('recommendations are independent copies and unknown legacy styles safely fall back to balanced picks',()=>{
 const original=structuredClone(CHAMPION_RECOMMENDATIONS),suggestion=recommendChampions('MID','사이드 운영');suggestion.pool.pop();suggestion.mainChampion='수정';
 assert.deepEqual(CHAMPION_RECOMMENDATIONS,original);
 for(const style of [undefined,'unknown','constructor','__proto__'])assert.deepEqual(recommendChampions('MID',style),recommendChampions('MID','균형 운영'));
 for(const position of ['MIDDLE','constructor','__proto__',undefined])assert.throws(()=>recommendChampions(position,'한타'),/포지션/);
});
