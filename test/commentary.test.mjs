import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommentator, COMMENTARY_TYPES } from '../lib/commentary.mjs';
import { ambientComments } from '../lib/community-voices.mjs';
import { simulateSeries } from '../lib/match.mjs';

const random = seed => () => { seed = Math.imul(seed ^ seed >>> 15, 1 | seed);seed += 0x6d2b79f5;return (seed >>> 0) / 4294967296; };
const context = i => ({ team: `팀${i%3}`, enemy: `상대${i%4}`, killer: `선수${i%7}`, victim: `상대선수${i%11}`, champion: `챔피언${i%9}`, role: 'MID', location: `강가${i%3}`, objective: '드래곤', number: 1, winKills: 3, lossKills: 1 });

test('community reactions are deterministic and vary without repeating within a series', () => {
  const collect = seed => {
    const used = new Set(), react = createCommentator(random(seed), used), result = [];
    for(let i=0;i<90;i++)result.push(...react(COMMENTARY_TYPES[i % COMMENTARY_TYPES.length],context(i)));
    assert.equal(new Set(result).size,result.length);
    return result;
  };
  const a=collect(42);assert.deepEqual(a,collect(42));assert.notDeepEqual(a,collect(43));
  assert(a.length>=180);assert(a.some(text=>/시발|씨발|ㅅㅂ|존나|ㅈㄴ/.test(text)));assert(a.some(text=>/노/.test(text)));
});

test('first blood and ganks always refer to their recorded actors', () => {
  const react=createCommentator(random(5));
  for(let i=0;i<10;i++){
    const c=context(i),blood=react('first_blood',c),gank=react('gank',c);
    assert(blood.some(text=>text.includes('퍼블')));assert(gank.some(text=>text.includes(c.victim)));
  }
});

test('unreported streaks and ability use are not invented', () => {
  const react=createCommentator(random(19));
  const result=COMMENTARY_TYPES.flatMap(type=>react(type,context(0))).join('\n');
  assert(!/트리플|펜타|에이스|플래시|점멸|궁극기|주사위|피지컬 \d/.test(result));
  const seen=[];
  for(let i=0;i<15;i++)seen.push(...react('teamfight',{...context(i),comeback:true,deathCount:3,killCount:5,multiKill:3}));
  assert(seen.some(text=>/또 죽|뒤집|욕하던|킬 쌓|3명/.test(text)));
});

test('dense live comments mix cheers, criticism and occasional unrelated questions without dominating scenes',()=>{
 const react=createCommentator(random(781)),all=[],ambient=new Set(ambientComments);
 for(let i=0;i<100;i++)all.push(...react(COMMENTARY_TYPES[i%COMMENTARY_TYPES.length],context(i)));
 assert(all.length>500);assert(all.some(t=>ambient.has(t)));assert(all.filter(t=>ambient.has(t)).length<all.length*.12);
 assert(all.some(t=>/씨발|시발|ㅅㅂ/.test(t)));assert(all.some(t=>/노/.test(t)));
 assert(ambientComments.some(t=>t.includes('티원 이겼나요')));
});

test('recent-match comment memory changes only presentation and caster lines use observed kills',()=>{
 const input={teamA:{name:'A',power:70},teamB:{name:'B',power:70},bestOf:3,seed:'recent-comment-memory'};
 const a=simulateSeries(input),prior=a.sets.flatMap(s=>s.events.flatMap(e=>e.reactions)),b=simulateSeries({...input,recentComments:prior});
 assert.equal(a.winner,b.winner);assert.deepEqual(a.sets.map(s=>s.scoreboard),b.sets.map(s=>s.scoreboard));
 const after=b.sets.flatMap(s=>s.events.flatMap(e=>e.reactions));assert(!after.some(t=>prior.includes(t)));
 const cast=a.sets.flatMap(s=>s.events.filter(e=>e.casting).map(e=>e.casting));assert(cast.length>25);assert.equal(new Set(cast).size,cast.length);
 for(const set of a.sets)for(const e of set.events){if(!e.casting?.includes('이번 교전에서'))continue;const kills=e.kills.filter(k=>k.killerTeam===e.team).length;assert(e.casting.includes(`${kills}킬`));}
});
