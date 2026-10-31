import { seededRandom } from './match.mjs';

const STATS = ['mechanics', 'laning', 'macro', 'communication', 'mental', 'mastery'];
const TYPES = ['champion-nerf', 'champion-buff', 'injury', 'team-synergy', 'npc-incident'];
const POSITIONS = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const pick = (random, values) => values[Math.floor(random() * values.length)];
const isSyntheticNpc = c => c.npc === true && /^npc:/.test(String(c.id)) && (c.generatedNpc === true || /\b(Ridge|Path|Comma|Scope|Link)$/.test(String(c.nickname)));
const rounded = n => Math.round(n * 100) / 100;

function plusDays(date, days) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
function hash(value) { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return (n >>> 0).toString(36); }
function ensureState(room) {
  const s = room.season;
  s.worldEvents ??= { version: 1, lastProcessedTurn: null, events: [], activeEffects: [] };
  s.worldEvents.events ??= []; s.worldEvents.activeEffects ??= [];
  return s.worldEvents;
}
function canProgress(room) {
  return Boolean(room?.season && !room.season.finished && !room.season.draft && (!room.lobby || room.lobby.status === 'started'));
}
function matches(effect, player) {
  if (effect.scope === 'champion') return player.mainChampion === effect.champion;
  if (effect.scope === 'team') return player.team === effect.team;
  return player.id === effect.targetId;
}

// Characters are copied into event snapshots only through these public fields.
// Portrait sources, user tokens and private messages never enter event history.
export function getWorldCandidates(room, extraPlayers = []) {
  const team = room.season?.team;
  const own = room.players?.map(p => ({ ...p.character, team: p.character.team || team, npc: false })) || [];
  const incoming = extraPlayers.flatMap(value => Array.isArray(value?.players) ? value.players : [value]);
  const ownPositions = new Set(own.map(c => c.position));
  const opposing = (room.season?.opponents || []).filter(p => p.name !== team).flatMap(p => p.players || []);
  const result = new Map();
  for (const c of [...opposing, ...incoming, ...own]) {
    if (!c?.id || !c.nickname || !POSITIONS.includes(c.position)) continue;
    if (c.team === team && c.npc && ownPositions.has(c.position)) continue;
    result.set(c.id, c);
  }
  return [...result.values()];
}

export function applyWorldEffects(room, players = []) {
  const turn = Number(room.season?.turn) || 1;
  const active = room.season?.worldEvents?.activeEffects || [];
  return players.map(player => {
    const effects = active.filter(e => e.startsTurn <= turn && e.expiresTurn > turn && matches(e, player));
    const effectiveStats = Object.fromEntries(STATS.map(key => {
      const base = Number(player.stats?.[key]);
      const modifier = effects.reduce((sum, e) => sum + (Number(e.statChanges?.[key]) || 0), 0);
      return [key, rounded(clamp((Number.isFinite(base) ? base : 65) + modifier, 1, 100))];
    }));
    return { ...player, stats: { ...player.stats }, effectiveStats,
      eventEffects: effects.map(e => ({ id: e.id, eventId: e.id, type: e.type, title: e.title, statChanges: { ...e.statChanges }, remainingDays: e.expiresTurn - turn, expiresTurn: e.expiresTurn, expiresDate: e.expiresDate, champion: e.champion || null, scope: e.scope, fictional: true })) };
  });
}

function specification(room, spec, candidates) {
  if (!TYPES.includes(spec.type)) throw new Error('지원하지 않는 시즌 이벤트입니다.');
  let scope, statChanges, title, summary, durationDays;
  const target = spec.targetId ? candidates.find(c => c.id === spec.targetId) : null;
  if (spec.type === 'champion-nerf' || spec.type === 'champion-buff') {
    if (typeof spec.champion !== 'string' || !spec.champion.trim()) throw new Error('패치 대상 챔피언이 필요합니다.');
    scope = 'champion'; durationDays = 14;
    const nerf = spec.type === 'champion-nerf';
    statChanges = nerf ? { laning: -1 } : { mastery: 1 };
    title = `${spec.champion} ${nerf ? '너프' : '버프'} · 시그니처 적응`;
    summary = `${spec.champion}을 시그니처로 쓰는 모든 팀 선수에게 ${nerf ? '라인전 −1' : '챔피언 숙련도 +1'}이 적용된다. 패치 적응 기간 14일. 실제 패치 뉴스가 아닌 가상 시즌 사건이다.`;
  } else if (spec.type === 'team-synergy') {
    if (!spec.team || !candidates.some(c => c.team === spec.team)) throw new Error('이벤트 대상 팀이 필요합니다.');
    scope = 'team'; durationDays = 7; statChanges = { communication: 1 };
    title = `${spec.team} 합류 콜 정리`;
    summary = `${spec.team} 선수단이 오브젝트 앞 콜 순서를 맞췄다. 7일 동안 소통 +1. 가상 시즌 사건이다.`;
  } else {
    if (!target) throw new Error('이벤트 대상 선수를 찾을 수 없습니다.');
    scope = 'player'; durationDays = 7;
    if (spec.type === 'npc-incident') {
      if (!isSyntheticNpc(target)) throw new Error('논란성 사건은 시스템이 만든 가상 NPC에게만 적용합니다.');
      statChanges = { mental: -2 };
      title = `${target.nickname} · 가상 인터뷰 해프닝`;
      summary = `${target.team}의 가상 선수 ${target.nickname}이 팀 홍보 촬영에서 연습 일정에 관한 말을 잘못 전달했다. 매니저와 해명 문구를 정리했다. 7일 동안 멘탈 −2. 실존 선수의 실제 논란이나 뉴스가 아니다.`;
    } else {
      statChanges = { mechanics: -2 };
      title = `${target.nickname} 손목 피로 관리`;
      summary = `${target.team} ${target.nickname}이 손목 피로로 연습 강도를 낮췄다. 7일 동안 피지컬 −2. 가상 시즌 사건이다.`;
    }
  }
  // Overrides are for internal deterministic scenario/unit checks, never an API.
  if (spec.statChanges) {
    const entries = Object.entries(spec.statChanges);
    if (!entries.length || entries.some(([key, value]) => !STATS.includes(key) || !Number.isFinite(value) || Math.abs(value) > 5)) throw new Error('이벤트 능력치 변화가 올바르지 않습니다.');
    statChanges = { ...spec.statChanges };
  }
  if (spec.durationDays != null) {
    if (!Number.isInteger(spec.durationDays) || spec.durationDays < 1 || spec.durationDays > 30) throw new Error('이벤트 기간은 1~30일이어야 합니다.');
    durationDays = spec.durationDays;
  }
  return { scope, statChanges, title, summary, durationDays };
}

// Pure in-process helper for tests and authored scenarios. The HTTP API exposes
// no way for a player to force an event or choose its victim.
export function applyWorldEvent(room, spec, candidates = getWorldCandidates(room)) {
  if (!canProgress(room)) throw new Error('진행 중인 시즌에서만 이벤트를 적용할 수 있습니다.');
  const s = room.season, settings = specification(room, spec, candidates);
  const id = spec.id || `world-${s.turn}-${spec.type}-${hash(`${spec.champion || ''}:${spec.targetId || ''}:${spec.team || ''}`)}`;
  const state = ensureState(room), existing = state.events.find(e => e.id === id);
  if (existing) return existing;
  const effect = {
    id, eventId: id, type: spec.type, title: settings.title, scope: settings.scope,
    ...(settings.scope === 'champion' ? { champion: spec.champion } : {}),
    ...(settings.scope === 'player' ? { targetId: spec.targetId } : {}),
    ...(settings.scope === 'team' ? { team: spec.team } : {}),
    statChanges: settings.statChanges, startsTurn: s.turn,
    expiresTurn: s.turn + settings.durationDays,
    expiresDate: plusDays(s.date, settings.durationDays), fictional: true,
  };
  const targets = candidates.filter(c => matches(effect, c)).map(c => ({ id: c.id, team: c.team, nickname: c.nickname, position: c.position, statChanges: { ...settings.statChanges } }));
  if (!targets.length) throw new Error('적용 대상이 없는 이벤트입니다.');
  const event = { ...effect, date: s.date, turn: s.turn, durationDays: settings.durationDays, summary: settings.summary, targets };
  state.events.unshift(event); state.events = state.events.slice(0, 120);
  state.activeEffects.push(effect); state.activeEffects = state.activeEffects.filter(e => e.expiresTurn > s.turn).slice(-60);
  s.history ??= [];
  s.history.unshift({ id, date: s.date, turn: s.turn, type: 'world-event', worldEventId: id, text: `${settings.title}. ${settings.summary}` });
  return event;
}

export function processWorldEvents(room, extraPlayers = []) {
  if (!canProgress(room)) return null;
  const s = room.season, state = ensureState(room);
  if (state.lastProcessedTurn === s.turn) return null;
  state.lastProcessedTurn = s.turn;
  state.activeEffects = state.activeEffects.filter(e => e.expiresTurn > s.turn);
  const random = seededRandom(`${s.seed}:world-events:${s.turn}`);
  if (random() >= .15) return null;
  const candidates = getWorldCandidates(room, extraPlayers);
  if (!candidates.length) return null;
  const roll = random();
  if (roll < .4) {
    const champions = [...new Set(candidates.map(c => c.mainChampion).filter(Boolean))];
    if (!champions.length) return null;
    return applyWorldEvent(room, { type: 'champion-nerf', champion: pick(random, champions) }, candidates);
  }
  if (roll < .57) {
    const champions = [...new Set(candidates.map(c => c.mainChampion).filter(Boolean))];
    if (!champions.length) return null;
    return applyWorldEvent(room, { type: 'champion-buff', champion: pick(random, champions) }, candidates);
  }
  if (roll < .75) return applyWorldEvent(room, { type: 'injury', targetId: pick(random, candidates).id }, candidates);
  if (roll < .9) return applyWorldEvent(room, { type: 'team-synergy', team: pick(random, [...new Set(candidates.map(c => c.team))]) }, candidates);
  const npcs = candidates.filter(isSyntheticNpc);
  return npcs.length ? applyWorldEvent(room, { type: 'npc-incident', targetId: pick(random, npcs).id }, candidates) : null;
}
