import test from 'node:test';
import assert from 'node:assert/strict';
import { splitMatchText,renderMatchText } from '../public/match-feed.js';
import { simulateSeries } from '../lib/match.mjs';
import { createCaster } from '../lib/casting.mjs';
import { COMMENTARY_TYPES } from '../lib/commentary.mjs';

test('facts and spoken casting remain separate for new events and older appended saves, preserving later highlights',()=>{
 const normal={text:'강가에서 A가 B를 잡았다.',casting:'A가 먼저 킬을 챙겼습니다!'};
 assert.deepEqual(splitMatchText(normal),{situation:normal.text,casting:normal.casting});
 const old={...normal,text:normal.text+' '+normal.casting+' A가 교전에서 3킬을 기록했다.'},snapshot=structuredClone(old);
 assert.deepEqual(splitMatchText(old),{situation:normal.text+' A가 교전에서 3킬을 기록했다.',casting:normal.casting});assert.deepEqual(old,snapshot);
 assert.deepEqual(splitMatchText({text:'옛 경기 기록이다.'}),{situation:'옛 경기 기록이다.',casting:''});
 const html=renderMatchText(old);assert.equal(html.split(normal.casting).length,2);assert(html.includes('상황 기록'));assert(html.includes('해설 중계'));
 assert(!renderMatchText({text:'<script>bad</script>',casting:'<img src=x onerror=bad>'}).includes('<script>'));assert(!renderMatchText({text:'x',casting:'<img src=x onerror=bad>'}).includes('<img'));
});

test('expanded commentary has over four hundred unique lines and never introduces mixed raw template tokens',()=>{
 const caster=createCaster(()=>0),all=[];
 for(const type of COMMENTARY_TYPES)for(let i=0;i<100;i++){const text=caster(type,{team:'A',kills:[],location:'강가',objective:'드래곤'});if(!text)break;all.push(text);}
 assert(all.length>=400);assert.equal(new Set(all).size,all.length);assert(all.every(t=>!t.includes('${')&&!t.includes('undefined')));
});

test('simulated scenes store casting outside factual text and keep a spoken line in nearly every scene',()=>{
 const descriptions=new Set(),spoken=new Set();let events=0,withCasting=0;
 for(let i=0;i<45;i++){
  const result=simulateSeries({teamA:{name:'A',power:70},teamB:{name:'B',power:70},bestOf:3,seed:'split-cast-'+i});
  for(const set of result.sets)for(const event of set.events){events++;if(event.casting){withCasting++;assert(!event.text.includes(event.casting));spoken.add(event.casting);}descriptions.add(event.text);}
 }
 assert(withCasting/events>.95,`${withCasting}/${events} scenes include spoken casting`);assert(spoken.size>300);assert(descriptions.size>600);
});
