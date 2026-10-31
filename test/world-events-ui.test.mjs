import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWorldEvents, renderEventEffects, effectiveStat } from '../public/world-events.js';

const event = {
  id: 'patch-1', date: '2026-03-01', turn: 20, type: 'champion-nerf', title: '아리 너프',
  summary: '시그니처 선수의 라인전 적응이 필요하다.', scope: 'champion', champion: '아리',
  statChanges: { laning: -1 }, durationDays: 14, expiresTurn: 34, expiresDate: '2026-03-15', fictional: true,
  targets: [
    { id: 'u', team: 'T1', nickname: '인트', position: 'MID', statChanges: { laning: -1 } },
    { id: 'n', team: 'Gen.G', nickname: 'Gen.G Comma', position: 'MID', statChanges: { laning: -1 } },
  ],
};
const room = turn => ({ season: { team: 'T1', turn, worldEvents: { events: [event], activeEffects: [{ id: event.id, eventId: event.id, expiresTurn: event.expiresTurn }] } }, roster: [{ mainChampion: '아리' }] });

test('world feed shows league-wide signature effects, affected players and actual duration', () => {
  const html = renderWorldEvents(room(21));
  for (const text of ['리그 소식', '아리 시그니처 선수 전원', '인트', 'Gen.G Comma', '라인전 -1', '13일 남음', '우리 팀 영향', '진행 효과 1건']) assert(html.includes(text), text);
  assert(html.includes('실제 패치나 실존 선수 보도가 아닙니다'));
  assert(!html.includes('<button'), 'No dead interaction controls');
  const expired = renderWorldEvents(room(34));
  assert(expired.includes('효과 종료'));assert(expired.includes('진행 효과 0건'));
});

test('feed escapes all source labels and never invents an event when history is empty', () => {
  const attack = '<img src=x onerror="bad()">';
  const r = room(21);r.season.worldEvents.events = [{ ...event, title: attack, summary: attack, champion: attack, targets: [{ nickname: attack, team: attack, position: attack, statChanges: { laning: -1 } }] }];
  const html = renderWorldEvents(r);
  assert(!html.includes('<img'));assert(html.includes('&lt;img'));
  const empty = renderWorldEvents({ season: { turn: 1 } });
  assert(empty.includes('아직 기록된 리그 소식이 없습니다'));
  assert(!empty.includes('data-world-event='));
});

test('player panel uses effective values without changing the base stats', () => {
  const character = { stats: { laning: 65, macro: 72 }, effectiveStats: { laning: 64, macro: 72 }, eventEffects: [{ id: event.id, title: '아리 너프', statChanges: { laning: -1 }, remainingDays: 13 }] };
  const before = structuredClone(character);
  assert.equal(effectiveStat(character, 'laning'), 64);assert.equal(effectiveStat(character, 'macro'), 72);
  assert.equal(effectiveStat({ stats: { laning: 0 } }, 'laning'), 0);
  const html = renderEventEffects(character);
  assert(html.includes('<s>65</s> → <strong>64</strong>'));assert(html.includes('13일'));assert(html.includes('(-1)'));
  assert.deepEqual(character, before);
  assert.equal(renderEventEffects({ stats: { laning: 65 } }), '');
  assert.equal(renderEventEffects({ ...character, eventEffects: [{ ...character.eventEffects[0], remainingDays: 0 }] }), '');
});

test('new signature players get an own-team badge and synthetic incidents are clearly marked', () => {
  const r = room(22);r.season.worldEvents.events = [{ ...event, targets: [event.targets[1]] }];
  assert(renderWorldEvents(r).includes('우리 팀 영향'));
  const lateJoin = room(35);lateJoin.season.worldEvents.events = [{ ...event, targets: [event.targets[1]] }];
  assert(!renderWorldEvents(lateJoin).includes('우리 팀 영향'), 'Joining after a patch expires does not rewrite its historical targets');
  assert(renderWorldEvents(room(35)).includes('우리 팀 영향'), 'Historical own-team targets remain identified after expiry');
  r.season.worldEvents.events = [{ ...event, type: 'npc-incident', scope: 'player', champion: null, title: '가상 선수 인터뷰 면담', targets: [event.targets[1]] }];
  const html = renderWorldEvents(r);
  assert(html.includes('가상 선수 사건'));assert(html.includes('가상 NPC 선수'));assert(html.includes('다른 팀 소식'));
});
