import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPixelSprite, sceneOccupants, renderLocationScene } from '../public/scenes.js';

const player=(id,location='연습실')=>({userId:id,location,character:{id:`char-${id}`,nickname:id,position:'MID'}});
test('pixel identity is deterministic and venue art changes with the chosen location',()=>{
  const p=player('A');assert.equal(renderPixelSprite(p.character),renderPixelSprite(p.character));
  const practice=renderLocationScene({location:'연습실',players:[p],me:'A',team:'T1'});
  const cafe=renderLocationScene({location:'카페',players:[p],me:'A',team:'T1'});
  assert.notEqual(practice,cafe);assert.match(practice,/data-scene="연습실"/);assert.match(practice,/프로필 보기/);
});
test('the scene uses actual character locations and labels roster NPCs explicitly',()=>{
  const players=[player('A'),player('B','카페')],roster=[{id:'npc-top',nickname:'Ridge',position:'TOP',npc:true}];
  assert.deepEqual(sceneOccupants({location:'카페',players,roster}).map(p=>p.character.nickname),['B']);
  const practice=sceneOccupants({location:'연습실',players,roster,me:'A'});assert.equal(practice.length,2);assert.equal(practice[0].mine,true);assert.equal(practice[1].npc,true);
  const html=renderLocationScene({location:'연습실',players,roster,me:'A'});assert.match(html,/참가자 1명 · NPC 1명/);assert.doesNotMatch(html,/B 프로필/);
});
test('all user-controlled labels and IDs are escaped before rendering',()=>{
  const evil='<img src=x onerror="alert(1)">';const p=player(evil);p.character.id='x" onclick="alert(2)';
  const html=renderLocationScene({location:'연습실',players:[p],team:evil,date:evil});
  assert.doesNotMatch(html,/<img/);assert.doesNotMatch(html,/data-character-id="x" onclick=/);assert.match(html,/&lt;img/);assert.match(html,/&quot;/);
});
test('all twelve configured venues have distinct original scene art',()=>{
  const venues=['연습실','거실','주방','분석실','헬스장','매니저실','경기장','PC방','편의점','식당','카페','클리닉'];
  const output=venues.map(location=>renderLocationScene({location}));assert.equal(new Set(output).size,12);
  for(const html of output)assert.match(html,/scene-background/);
});
test('persisted positions apply only to their matching venue and retain keyboard controls',()=>{
  const p=player('A');p.scenePosition={x:67,y:84,location:'연습실'};
  const html=renderLocationScene({location:'연습실',players:[p],me:'A'});
  assert.match(html,/--scene-x:67%;--scene-y:84%/);assert.match(html,/data-user-id="A"/);assert.match(html,/data-scene-floor tabindex="0"/);
  p.scenePosition.location='카페';const other=renderLocationScene({location:'연습실',players:[p],me:'A'});assert.doesNotMatch(other,/--scene-x:67%/);
});
