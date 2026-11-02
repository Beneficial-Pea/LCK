import {stageFinishSnapshot,recordStageWrapUps} from './stage-wrapups.mjs';
import {recordTournamentFinish} from './tournament-rewards.mjs';
import { readinessFor } from './readiness.mjs';
import { recordMatchAwards, publishSeasonAwards } from './player-awards.mjs';
import { processDailyLife } from './daily-life.mjs';
import { randomUUID } from 'node:crypto';
import { simulateSeries } from './match.mjs';
import { applyWorldEffects, processWorldEvents } from './world-events.mjs';
import { ensureRosterNicknames, npcNickname } from './nicknames.mjs';
import { createSeason2026, settleDay2026, RULES2026 } from './season2026.mjs';
export { RULES2026 };

export const POSITIONS = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
export const TEAMS = ['T1', 'Gen.G', 'HLE', 'DK', 'KT', 'BNK', 'DRX', 'NS', 'DNF', 'BRO'];
const STAT_KEYS = ['mechanics', 'laning', 'macro', 'communication', 'mental', 'mastery'];
const CHAMPIONS = {
  TOP: ['제이스', '나르', '럼블', '크산테', '레넥톤', '그웬', '잭스', '오른'],
  JGL: ['리 신', '바이', '비에고', '세주아니', '신 짜오', '오공', '녹턴', '마오카이'],
  MID: ['아지르', '아리', '오리아나', '사일러스', '탈리야', '갈리오', '빅토르', '르블랑'],
  ADC: ['진', '징크스', '카이사', '바루스', '애쉬', '이즈리얼', '칼리스타', '제리'],
  SUP: ['노틸러스', '레오나', '알리스타', '라칸', '렐', '브라움', '룰루', '쓰레쉬'],
};
export const ACTIONS = [
  { id: 'mechanics', name: '피지컬 훈련', description: '피지컬 +0.9 · 숙련도 +0.4. 피로 +10, 컨디션 −4.', effects: { mechanics: .9, mastery: .4, fatigue: 10, condition: -4, stress: 3 } },
  { id: 'laning', name: '라인전 연습', description: '라인전 +0.9 · 숙련도 +0.3. 피로 +9, 컨디션 −3.', effects: { laning: .9, mastery: .3, fatigue: 9, condition: -3, stress: 3 } },
  { id: 'analysis', name: '상대 분석', description: '운영 +0.8 · 멘탈 +0.2. 피로 +3.', effects: { macro: .8, mental: .2, fatigue: 3, stress: -2 } },
  { id: 'duo', name: '듀오 연습', description: '소통 +0.7 · 숙련도 +0.4. 파트너와 관계가 쌓인다. 피로 +7.', effects: { communication: .7, mastery: .4, fatigue: 7, condition: -2, stress: -2 } },
  { id: 'team', name: '팀 스크림', description: '운영 +0.4 · 소통 +0.6 · 피지컬 +0.2. 피로 +10.', effects: { macro: .4, communication: .6, mechanics: .2, fatigue: 10, condition: -4, stress: 2 } },
  { id: 'rest', name: '충분한 휴식', description: '컨디션 +12 · 피로 −22 · 스트레스 −16.', effects: { condition: 12, fatigue: -22, stress: -16, mental: .15 } },
  { id: 'walk', name: '외출과 산책', description: '컨디션 +5 · 피로 −10 · 스트레스 −13. 장소의 일상이 기록된다.', effects: { condition: 5, fatigue: -10, stress: -13, mental: .25 } },
];
export const RULES = [
  '게임 시간은 한국시간 날짜 기준, 2025-01-13부터 11-09까지 하루 1턴(301턴)입니다.',
  '실제 2025 대회 기간을 기준으로 대진을 재구성한 시뮬레이션입니다. 공식 경기별 캘린더의 완전 재현이 아닙니다. 공식 자료의 온라인 대조는 현재 네트워크 정책으로 완료하지 못했습니다.',
  'LCK Cup은 5팀씩 두 그룹의 교차 대진 25경기와 통합 상위 6팀 토너먼트로 간소화합니다. 실제 그룹 승수·플레이인·상대 지명 규정과 다릅니다. 우승팀만 퍼스트 스탠드에 갑니다.',
  'R1~2는 10팀 더블 라운드 로빈 90경기입니다. 상대 조합은 고정하되 실제 경기일별 대진과 다릅니다. 승수 → 세트 득실 → 맞대결 → 시드 해시로 동률을 정합니다.',
  '상위 6팀이 Road to MSI에 진출합니다. 상위 2팀은 부전승, 예선 패자는 탈락, 본선은 패자 경로가 있습니다. 상위 두 팀에 MSI 시드가 배정됩니다.',
  'R1~2 상위 5팀은 레전드, 하위 5팀은 라이즈입니다. 종전 성적을 승계하여 그룹별 3회전 60경기를 치릅니다. 레전드 상위 4팀은 플레이오프, 레전드 5위와 라이즈 상위 3팀은 2개 자리를 놓고 플레이인에 참가합니다.',
  'MSI 본선은 8팀 더블 엘리미네이션으로 구성하며 세부 경기 날짜와 국제대회 예선 일부를 압축했습니다. LCK 팀이 MSI 결승에 오르면 LCK 월즈 4시드, 그렇지 않으면 3시드를 받는 요청 규칙을 적용합니다. 실제 지역별 추가 시드·우승팀 조건 전체를 재현하지 않습니다.',
  '월즈는 4시드 간 플레이인, 3승/3패 스위스, 8강·4강·결승입니다. 스위스 세부 동률 조 추첨과 재대결 회피는 간소화합니다. 별도의 LCK 지역 선발전은 없습니다.',
  '로스터·밴픽·능력치는 가상 설정입니다. 실존 팀이나 선수의 실제 평가가 아닙니다. 상대 능력치·성향·난이도·랜덤 시드는 시즌 시작 후 고정됩니다.',
  '모든 세트는 사건을 순서대로 시뮬레이션하여 승패를 결정합니다. 글로벌 피어리스로 한 시리즈에서 양 팀이 사용한 챔피언을 다시 선택할 수 없습니다. 등록 풀이 고갈되면 포지션별 대체 챔피언을 선택하고 숙련도 페널티를 적용합니다. 매 세트 양 팀이 각각 챔피언 5개를 밴합니다. 댓글은 실제 커뮤니티가 아닌 경기 사건에 대한 가상 반응입니다.',
];

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
function hash(value) { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function addDays(date, n = 1) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function datesBetween(start, end, weekdays = [0, 3, 4, 5, 6]) { const out = []; for (let d = start; d <= end; d = addDays(d)) if (weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay())) out.push(d); return out; }
const emptyTable = names => names.map(team => ({ team, played: 0, wins: 0, losses: 0, setWins: 0, setLosses: 0, group: null }));
function rank(table, seed, matches = []) {
  return [...table].sort((a, b) => b.wins - a.wins || ((b.setWins - b.setLosses) - (a.setWins - a.setLosses)) || headToHead(a.team, b.team, matches) || hash(`${seed}:${a.team}`) - hash(`${seed}:${b.team}`));
}
function headToHead(a, b, matches) { let score = 0; for (const m of matches) if ([m.teamA, m.teamB].includes(a) && [m.teamA, m.teamB].includes(b) && m.result) score += m.result.winner === a ? -1 : 1; return score; }
function roundRobin(names, cycles = 1) {
  const pairs = []; const initial = [...names]; if (initial.length % 2) initial.push(null);
  for (let c = 0; c < cycles; c++) {
    let ring = [...initial];
    for (let r = 0; r < ring.length - 1; r++) {
      for (let i = 0; i < ring.length / 2; i++) if (ring[i] && ring[ring.length - 1 - i]) pairs.push(c % 2 ? [ring[ring.length - 1 - i], ring[i]] : [ring[i], ring[ring.length - 1 - i]]);
      ring = [ring[0], ring.at(-1), ...ring.slice(1, -1)];
    }
  }
  return pairs;
}
function fixture(id, date, stage, round, teamA = null, teamB = null, bestOf = 3) { return { id, date, stage, round, teamA, teamB, bestOf, status: teamA && teamB ? 'scheduled' : 'pending' }; }
function assignPairs(pairs, dates, prefix, stage, round, bestOf = 3, cap = 2) {
  const pending = [...pairs], out = [];
  for (const date of dates) {
    const used = new Set();
    for (let slot = 0; slot < cap; slot++) {
      const i = pending.findIndex(([a, b]) => !used.has(a) && !used.has(b));
      if (i < 0) break;
      const [a, b] = pending.splice(i, 1)[0]; used.add(a); used.add(b);
      out.push(fixture(`${prefix}-${out.length + 1}`, date, stage, round, a, b, bestOf));
    }
  }
  // A balanced round-robin can leave a colliding tail on a full final day. Swap
  // a prior opponent pair into that day rather than creating an extra date.
  while (pending.length) {
    const [a, b] = pending.shift();
    let placed = false;
    for (const date of dates) {
      const today = out.filter(m => m.date === date);
      if (today.length < cap && !today.some(m => [m.teamA, m.teamB].includes(a) || [m.teamA, m.teamB].includes(b))) {
        out.push(fixture(`${prefix}-${out.length + 1}`, date, stage, round, a, b, bestOf)); placed = true; break;
      }
    }
    if (!placed) {
      // Keep the published stage window. A third series is visible in calendar
      // and logged as an explicit schedule simplification, never hidden.
      const date = [...dates].reverse().find(d => !out.some(m => m.date === d && ([m.teamA, m.teamB].includes(a) || [m.teamA, m.teamB].includes(b))));
      if (!date) throw new Error('대진을 대회 기간 안에 배치할 수 없습니다.');
      out.push(fixture(`${prefix}-${out.length + 1}`, date, stage, round, a, b, bestOf));
    }
  }
  return out;
}

function baseProfile(name, i, seed, power, style) {
  const players = POSITIONS.map((position, j) => {
    const p = clamp(power + (hash(`${seed}:${name}:${position}`) % 9) - 4, 25, 99);
    return { id: `npc:${name}:${position}`, name: `${name} 가상 선수`, nickname: npcNickname(name, position), team: name, position, tier: '1군', mainChampion: CHAMPIONS[position][i % 5], pool: [...CHAMPIONS[position]], style, stats: Object.fromEntries(STAT_KEYS.map((key, k) => [key, clamp(p + (hash(`${seed}:${name}:${j}:${k}`) % 7) - 3, 20, 99)])), condition: 85, fatigue: 12, stress: 15, npc: true, generatedNpc: true };
  });
  return { name, power, style, players };
}
export function createSeason({ team = 'T1', difficulty = 'normal', seed = '2025-LCK', npcPower = 65, opponents = [], year = 2025 } = {}) {
  if (Number(year) === 2026) return createSeason2026({ team, difficulty, seed, npcPower, opponents });
  if (!TEAMS.includes(team)) team = 'T1';
  const d = difficulty === 'hard' ? 7 : difficulty === 'easy' ? -7 : 0;
  const powerDefaults = [75, 82, 79, 74, 70, 68, 63, 65, 61, 60];
  const styles = ['한타', '균형 운영', '초반 주도권', '사이드 운영'];
  const profiles = TEAMS.map((name, i) => {
    const custom = Array.isArray(opponents) ? opponents.find(o => o.name === name || o.team === name) : opponents?.[name];
    const configuredPower = Number(custom?.power ?? powerDefaults[i]);
    return baseProfile(name, i, seed, clamp((Number.isFinite(configuredPower) ? configuredPower : powerDefaults[i]) + (name === team ? 0 : d), 30, 95), custom?.style || styles[i % 4]);
  });
  const groupA = TEAMS.slice(0, 5), groupB = TEAMS.slice(5);
  const cupPairs = [];
  for (let round = 0; round < 5; round++) for (let i = 0; i < 5; i++) cupPairs.push([groupA[i], groupB[(i + round) % 5]]);
  const schedule = [
    ...assignPairs(cupPairs, datesBetween('2025-01-15', '2025-02-02'), 'cup-group', 'LCK Cup', '그룹 배틀'),
    fixture('cup-q1', '2025-02-07', 'LCK Cup', '6강 1', null, null, 5),
    fixture('cup-q2', '2025-02-08', 'LCK Cup', '6강 2', null, null, 5),
    fixture('cup-s1', '2025-02-15', 'LCK Cup', '4강 1', null, null, 5),
    fixture('cup-s2', '2025-02-16', 'LCK Cup', '4강 2', null, null, 5),
    fixture('cup-final', '2025-02-23', 'LCK Cup', '결승', null, null, 5),
    ...assignPairs(roundRobin(TEAMS, 2), datesBetween('2025-04-02', '2025-06-01'), 'league', 'LCK R1~2', '정규시즌'),
    ...bracketFixtures('road', 'Road to MSI', ['2025-06-07', '2025-06-07', '2025-06-08', '2025-06-08', '2025-06-13', '2025-06-14', '2025-06-15'], true),
    ...bracketFixtures('po', 'LCK 플레이오프', ['2025-09-10', '2025-09-11', '2025-09-13', '2025-09-14', '2025-09-17', '2025-09-20', '2025-09-21', '2025-09-28']),
    fixture('pi-a', '2025-09-03', 'LCK 플레이인', '1라운드 1', null, null, 5), fixture('pi-b', '2025-09-04', 'LCK 플레이인', '1라운드 2', null, null, 5),
    fixture('pi-upper', '2025-09-05', 'LCK 플레이인', '승자전', null, null, 5), fixture('pi-lower', '2025-09-06', 'LCK 플레이인', '패자전', null, null, 5), fixture('pi-final', '2025-09-07', 'LCK 플레이인', '최종 진출전', null, null, 5),
    fixture('worlds-playin', '2025-10-14', '월즈', '플레이인', null, null, 5),
    ...[28, 29, 30, 31].map((day, i) => fixture(`worlds-q${i + 1}`, `2025-10-${day}`, '월즈', `8강 ${i + 1}`, null, null, 5)),
    fixture('worlds-s1', '2025-11-01', '월즈', '4강 1', null, null, 5), fixture('worlds-s2', '2025-11-02', '월즈', '4강 2', null, null, 5), fixture('worlds-final', '2025-11-09', '월즈', '결승', null, null, 5),
  ];
  const season = { id: randomUUID(), team, date: '2025-01-13', turn: 1, totalTurns: 301, finished: false, seed: String(seed), difficulty, npcPower: clamp(Number(npcPower) || 65, 30, 95), opponents: profiles, standings: emptyTable(TEAMS), cupStandings: emptyTable(TEAMS), schedule, results: [], history: [], relationships: [], qualifications: { firstStand: { status: 'pending', team: null }, msi: { status: 'pending', teams: [] }, worlds: { status: 'pending', teams: [], seeds: 3, reason: 'MSI 결과 대기' } }, flags: {}, tournaments: {}, groups: null, rules: RULES };
  addPendingInternational(season);
  season.schedule.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return season;
}
function bracketFixtures(prefix, stage, dates, road = false) {
  const rounds = ['q1', 'q2', 's1', 's2', 'lower', 'upper', 'lower-final', ...(road ? [] : ['final'])];
  const labels = ['6강 1', '6강 2', '4강 1', '4강 2', '패자전', '승자 결승', '최종 진출전', '결승'];
  return rounds.map((r, i) => fixture(`${prefix}-${r}`, dates[i], stage, labels[i], null, null, 5));
}
function addPendingInternational(s) {
  // Known dates, unknown qualifiers. Pending entries are not simulated until seeded.
  for (let i = 0; i < 10; i++) s.schedule.push(fixture(`fst-group-${i + 1}`, `2025-03-${String(10 + Math.floor(i / 2)).padStart(2, '0')}`, '퍼스트 스탠드', '라운드 로빈'));
  s.schedule.push(fixture('fst-s1', '2025-03-15', '퍼스트 스탠드', '4강 1', null, null, 5), fixture('fst-s2', '2025-03-15', '퍼스트 스탠드', '4강 2', null, null, 5), fixture('fst-final', '2025-03-16', '퍼스트 스탠드', '결승', null, null, 5));
  const msiDays = { 'q1': '02', 'q2': '02', 'q3': '03', 'q4': '03', 'l1a': '04', 'l1b': '05', 's1': '06', 's2': '07', 'l2a': '08', 'l2b': '08', 'upper': '10', 'l3': '11', 'lower-final': '12', 'final': '13' };
  for (const [key, day] of Object.entries(msiDays)) s.schedule.push(fixture(`msi-${key}`, `2025-07-${day}`, 'MSI', key === 'final' ? '결승' : key === 'upper' ? '승자 결승' : key.startsWith('q') ? '8강' : key.startsWith('s') ? '승자 4강' : '패자조', null, null, 5));
  for (let i = 0; i < 4; i++) s.schedule.push(fixture(`msi-playin-${i + 1}`, `2025-06-${28 + Math.floor(i / 2)}`, 'MSI', '플레이인', null, null, 3));
  const groupDates = datesBetween('2025-07-23', '2025-08-31');
  for (let i = 0; i < 60; i++) s.schedule.push(fixture(`groups-${i + 1}`, groupDates[Math.floor(i / 2)], 'LCK R3~5', '그룹 정규시즌'));
  const swissDates = ['2025-10-15', '2025-10-17', '2025-10-19', '2025-10-22', '2025-10-25'];
  const counts = [8, 8, 8, 6, 3];
  for (let r = 1; r <= 5; r++) for (let i = 0; i < counts[r - 1]; i++) s.schedule.push(fixture(`swiss-${r}-${i + 1}`, swissDates[r - 1], '월즈', `스위스 ${r}라운드`, null, null, 1));
}

export function getRoster(room) {
  const s = room.season;
  return applyWorldEffects(room, ensureRosterNicknames(room, POSITIONS.map((position, i) => {
    const member = room.players.find(p => p.character.position === position);
    if (member) return { ...member.character, tier: '1군', npc: false };
    return baseProfile(s.team, i, s.seed, s.npcPower, '균형 운영').players.find(p => p.position === position);
  }), s.team));
}
function teamProfile(room, name) {
  const s = room.season;
  if (name === s.team) return { name, style: '균형 운영', players: getRoster(room) };
  const configured = s.opponents.find(o => o.name === name);
  const profile = configured ? structuredClone(configured) : baseProfile(name, hash(name) % 5, s.seed, 68 + hash(`${s.seed}:${name}`) % 16, ['초반 주도권', '한타', '사이드 운영', '균형 운영'][hash(name) % 4]);
  return { ...profile, players: applyWorldEffects(room, ensureRosterNicknames(room, profile.players, name)) };
}
function worldEventParticipants(room) {
  const names = new Set([room.season.team, ...room.season.opponents.map(p => p.name)]);
  for (const match of room.season.schedule) for (const name of [match.teamA, match.teamB]) if (name) names.add(name);
  return [...names].flatMap(name => teamProfile(room, name).players);
}
function setTeams(s, id, a, b) {
  if (!a || !b || a === b) return;
  const m = s.schedule.find(m => m.id === id);
  if (m && m.status === 'pending') { m.teamA = a; m.teamB = b; m.status = 'scheduled'; }
}
const matchById = (s, id) => s.schedule.find(m => m.id === id);
const winner = (s, id) => matchById(s, id)?.result?.winner;
function loser(s, id) { const m = matchById(s, id); return m?.result ? (m.result.winner === m.teamA ? m.teamB : m.teamA) : null; }
function log(s, text, type = 'system', extra = {}) { s.history.unshift({ id: randomUUID(), date: s.date, turn: s.turn, type, text, ...extra }); }
function tableResult(table, match) {
  const a = table.find(t => t.team === match.teamA), b = table.find(t => t.team === match.teamB); if (!a || !b) return;
  for (const t of [a, b]) { t.played++; if (match.result.winner === t.team) t.wins++; else t.losses++; }
  a.setWins += match.result.scoreA; a.setLosses += match.result.scoreB; b.setWins += match.result.scoreB; b.setLosses += match.result.scoreA;
}
function statusFor(s, teams) { return teams.includes(s.team) ? 'qualified' : 'not-qualified'; }
function markElimination(s, stage, team) { const key = stage === '퍼스트 스탠드' ? 'firstStand' : stage === 'MSI' ? 'msi' : stage === '월즈' ? 'worlds' : null; if (key && team === s.team) s.qualifications[key].status = 'eliminated'; }

function updateBrackets(room) {
  const s = room.season;
  if (s.date >= '2025-02-02' && !s.flags.cupSeeded && s.schedule.filter(m => m.id.startsWith('cup-group')).every(m => m.result)) {
    const order = rank(s.cupStandings, s.seed, s.results.filter(m => m.id.startsWith('cup-group'))).map(t => t.team); s.tournaments.cupSeeds = order; s.flags.cupSeeded = true;
    setTeams(s, 'cup-q1', order[2], order[5]); setTeams(s, 'cup-q2', order[3], order[4]);
    log(s, `LCK Cup 그룹 배틀 종료. ${order.slice(0, 6).join(', ')}이 토너먼트에 진출했다.`, 'qualification');
  }
  if (s.flags.cupSeeded) {
    const order = s.tournaments.cupSeeds; setTeams(s, 'cup-s1', order[0], winner(s, 'cup-q2')); setTeams(s, 'cup-s2', order[1], winner(s, 'cup-q1'));
    setTeams(s, 'cup-final', winner(s, 'cup-s1'), winner(s, 'cup-s2'));
  }
  if (winner(s, 'cup-final') && !s.flags.fstSeeded) {
    const champion = winner(s, 'cup-final'); s.flags.fstSeeded = true; s.qualifications.firstStand = { status: statusFor(s, [champion]), team: champion };
    const teams = [champion, 'TES', 'TL', 'KC', 'CFO']; s.tournaments.fstTable = emptyTable(teams);
    roundRobin(teams).forEach(([a, b], i) => setTeams(s, `fst-group-${i + 1}`, a, b));
    log(s, `${champion}이 LCK Cup을 우승했다. 퍼스트 스탠드 LCK 대표는 ${champion}.`, 'qualification');
  }
  if (s.tournaments.fstTable && s.date >= '2025-03-14' && !s.flags.fstPlayoffs && s.schedule.filter(m => m.id.startsWith('fst-group')).every(m => m.result)) {
    const order = rank(s.tournaments.fstTable, s.seed).map(t => t.team); s.flags.fstPlayoffs = true;
    setTeams(s, 'fst-s1', order[0], order[3]); setTeams(s, 'fst-s2', order[1], order[2]); markElimination(s, '퍼스트 스탠드', order[4]);
  }
  setTeams(s, 'fst-final', winner(s, 'fst-s1'), winner(s, 'fst-s2'));
  if (winner(s, 'fst-final') && !s.flags.fstEnded) { s.flags.fstEnded = true; s.tournaments.fstChampion = winner(s, 'fst-final'); s.qualifications.firstStand.status = s.team === winner(s, 'fst-final') ? 'champion' : s.qualifications.firstStand.status === 'not-qualified' ? 'not-qualified' : 'eliminated'; log(s, `${winner(s, 'fst-final')}이 퍼스트 스탠드를 우승했다.`, 'title'); }

  if (s.date >= '2025-06-01' && !s.flags.leagueSplit && s.schedule.filter(m => m.id.startsWith('league-')).every(m => m.result)) {
    const order = rank(s.standings, s.seed, s.results.filter(m => m.id.startsWith('league-'))).map(t => t.team); s.flags.leagueSplit = true; s.tournaments.roadSeeds = order.slice(0, 6);
    seedSix(s, 'road', order.slice(0, 6)); s.groups = { legend: order.slice(0, 5), rise: order.slice(5) };
    for (const row of s.standings) row.group = s.groups.legend.includes(row.team) ? '레전드' : '라이즈';
    const lg = roundRobin(s.groups.legend, 3), rise = roundRobin(s.groups.rise, 3);
    for (let i = 0; i < 30; i++) { setTeams(s, `groups-${i * 2 + 1}`, ...lg[i]); setTeams(s, `groups-${i * 2 + 2}`, ...rise[i]); }
    log(s, `R1~2 종료. Road to MSI 진출: ${order.slice(0, 6).join(', ')}. 레전드·라이즈 그룹 편성을 확정했다. 정규시즌 성적은 승계한다.`, 'qualification');
  }
  if (s.tournaments.roadSeeds) updateSix(s, 'road', s.tournaments.roadSeeds);
  if (winner(s, 'road-upper') && winner(s, 'road-lower-final') && !s.flags.msiSeeded) {
    const qualified = [winner(s, 'road-upper'), winner(s, 'road-lower-final')]; s.flags.msiSeeded = true; s.qualifications.msi = { status: statusFor(s, qualified), teams: qualified };
    const playin = ['PSG', 'G2', 'FLY', 'GAM'];
    setTeams(s, 'msi-playin-1', playin[0], playin[1]); setTeams(s, 'msi-playin-2', playin[2], playin[3]);
    setTeams(s, 'msi-playin-3', playin[1], playin[2]); setTeams(s, 'msi-playin-4', playin[0], playin[3]);
    s.tournaments.msiTeams = [qualified[0], 'BLG', 'CFO', qualified[1], 'AL', 'MKOI', null, null];
    log(s, `MSI LCK 대표가 확정됐다. 1시드 ${qualified[0]}, 2시드 ${qualified[1]}.`, 'qualification');
  }
  if (s.flags.msiSeeded && winner(s, 'msi-playin-4') && !s.flags.msiBracket) {
    const table = emptyTable(['PSG', 'G2', 'FLY', 'GAM']); for (const m of s.results.filter(m => m.id.startsWith('msi-playin'))) tableResult(table, m);
    const seeds = rank(table, s.seed).slice(0, 2).map(t => t.team); s.tournaments.msiTeams[6] = seeds[0]; s.tournaments.msiTeams[7] = seeds[1]; s.flags.msiBracket = true;
    const t = s.tournaments.msiTeams; [[0, 7], [1, 6], [2, 3], [4, 5]].forEach(([a, b], i) => setTeams(s, `msi-q${i + 1}`, t[a], t[b]));
  }
  updateMsi(s);
  if (winner(s, 'msi-upper') && winner(s, 'msi-lower-final') && !s.flags.msiFinalists) {
    const finalists = [winner(s, 'msi-upper'), winner(s, 'msi-lower-final')]; s.flags.msiFinalists = true;
    const four = finalists.some(t => s.qualifications.msi.teams.includes(t));
    s.qualifications.worlds.seeds = four ? 4 : 3; s.qualifications.worlds.reason = four ? 'LCK 팀 MSI 결승 진출 · 요청 규칙에 따라 4시드' : 'LCK 팀 MSI 결승 미진출 · 3시드';
    log(s, `MSI 결승: ${finalists.join(' vs ')}. LCK 월즈 출전권은 ${four ? 4 : 3}장이다.`, 'qualification');
  }
  if (winner(s, 'msi-final') && !s.flags.msiEnded) { s.flags.msiEnded = true; s.tournaments.msiChampion = winner(s, 'msi-final'); if (s.qualifications.msi.teams.includes(s.team)) s.qualifications.msi.status = winner(s, 'msi-final') === s.team ? 'champion' : 'eliminated'; log(s, `${winner(s, 'msi-final')}이 MSI를 우승했다.`, 'title'); }

  if (s.date >= '2025-08-31' && !s.flags.playinSeeded && s.schedule.filter(m => m.id.startsWith('groups-')).every(m => m.result)) {
    const lg = rank(s.standings.filter(t => t.group === '레전드'), s.seed, s.results).map(t => t.team), rise = rank(s.standings.filter(t => t.group === '라이즈'), s.seed, s.results).map(t => t.team);
    s.tournaments.playoffDirect = lg.slice(0, 4); s.tournaments.playinSeeds = [lg[4], ...rise.slice(0, 3)]; s.flags.playinSeeded = true;
    setTeams(s, 'pi-a', lg[4], rise[2]); setTeams(s, 'pi-b', rise[0], rise[1]);
    log(s, `그룹 정규시즌 종료. 플레이오프 직행: ${lg.slice(0, 4).join(', ')}. 플레이인: ${s.tournaments.playinSeeds.join(', ')}.`, 'qualification');
  }
  setTeams(s, 'pi-upper', winner(s, 'pi-a'), winner(s, 'pi-b')); setTeams(s, 'pi-lower', loser(s, 'pi-a'), loser(s, 'pi-b')); setTeams(s, 'pi-final', loser(s, 'pi-upper'), winner(s, 'pi-lower'));
  if (winner(s, 'pi-final') && !s.flags.playoffSeeded) {
    s.flags.playoffSeeded = true; s.tournaments.playoffSeeds = [...s.tournaments.playoffDirect, winner(s, 'pi-upper'), winner(s, 'pi-final')]; seedSix(s, 'po', s.tournaments.playoffSeeds);
    log(s, `플레이오프 6팀 확정: ${s.tournaments.playoffSeeds.join(', ')}.`, 'qualification');
  }
  if (s.tournaments.playoffSeeds) updateSix(s, 'po', s.tournaments.playoffSeeds);
  if (winner(s, 'po-final') && !s.flags.worldsSeeded) {
    s.flags.worldsSeeded = true;
    const order = [winner(s, 'po-final'), loser(s, 'po-final'), loser(s, 'po-lower-final'), loser(s, 'po-lower')];
    const teams = order.slice(0, s.qualifications.worlds.seeds); s.qualifications.worlds = { ...s.qualifications.worlds, status: statusFor(s, teams), teams }; s.tournaments.lckChampion = order[0];
    const pool = [...teams.slice(0, 3), 'BLG', 'AL', 'TES', 'G2', 'MKOI', 'FNC', 'FLY', 'TL', '100T', 'CFO', 'PSG', 'GAM'];
    s.tournaments.worldsPool = pool; s.tournaments.worldsSwiss = [];
    setTeams(s, 'worlds-playin', teams.length === 4 ? teams[3] : 'VKE', 'WBG');
    log(s, `${order[0]}이 LCK를 우승했다. 월즈 진출: ${teams.join(', ')}. 별도 지역 선발전은 없다.`, 'qualification');
  }
  if (winner(s, 'worlds-playin') && !s.flags.swissSeeded) {
    s.flags.swissSeeded = true; const teams = [...s.tournaments.worldsPool, winner(s, 'worlds-playin')]; s.tournaments.worldsSwiss = teams.map(team => ({ team, wins: 0, losses: 0, opponents: [] }));
    seedSwiss(s, 1); markElimination(s, '월즈', loser(s, 'worlds-playin'));
  }
  for (let r = 1; r <= 5; r++) {
    const matches = s.schedule.filter(m => m.id.startsWith(`swiss-${r}-`));
    if (!s.flags[`swissDone${r}`] && matches.length && matches.every(m => m.result)) {
      s.flags[`swissDone${r}`] = true;
      for (const m of matches) {
        const a = s.tournaments.worldsSwiss.find(t => t.team === m.teamA), b = s.tournaments.worldsSwiss.find(t => t.team === m.teamB);
        a.opponents.push(b.team); b.opponents.push(a.team); (m.result.winner === a.team ? a : b).wins++; (m.result.winner === a.team ? b : a).losses++;
      }
      for (const t of s.tournaments.worldsSwiss) if (t.losses === 3) markElimination(s, '월즈', t.team);
      if (r < 5) seedSwiss(s, r + 1);
      else {
        const qualified = s.tournaments.worldsSwiss.filter(t => t.wins === 3).sort((a, b) => a.losses - b.losses || hash(s.seed + a.team) - hash(s.seed + b.team));
        for (let i = 0; i < 4; i++) setTeams(s, `worlds-q${i + 1}`, qualified[i]?.team, qualified[7 - i]?.team);
        log(s, `월즈 스위스 종료. 8강 진출: ${qualified.map(t => t.team).join(', ')}.`, 'qualification');
      }
    }
  }
  setTeams(s, 'worlds-s1', winner(s, 'worlds-q1'), winner(s, 'worlds-q2')); setTeams(s, 'worlds-s2', winner(s, 'worlds-q3'), winner(s, 'worlds-q4')); setTeams(s, 'worlds-final', winner(s, 'worlds-s1'), winner(s, 'worlds-s2'));
  if (winner(s, 'worlds-final') && !s.flags.worldsEnded) { s.flags.worldsEnded = true; s.tournaments.worldsChampion = winner(s, 'worlds-final'); if (s.qualifications.worlds.teams.includes(s.team)) s.qualifications.worlds.status = winner(s, 'worlds-final') === s.team ? 'champion' : 'eliminated'; log(s, `${winner(s, 'worlds-final')}이 2025 월즈를 우승했다. 시즌 마지막 경기가 끝났다.`, 'title'); }
  s.standings = rank(s.standings, s.seed, s.results.filter(m => m.stage.startsWith('LCK R')));
}
function seedSix(s, prefix, order) { setTeams(s, `${prefix}-q1`, order[2], order[5]); setTeams(s, `${prefix}-q2`, order[3], order[4]); }
function updateSix(s, prefix, order) {
  setTeams(s, `${prefix}-s1`, order[0], winner(s, `${prefix}-q2`)); setTeams(s, `${prefix}-s2`, order[1], winner(s, `${prefix}-q1`));
  setTeams(s, `${prefix}-lower`, loser(s, `${prefix}-s1`), loser(s, `${prefix}-s2`)); setTeams(s, `${prefix}-upper`, winner(s, `${prefix}-s1`), winner(s, `${prefix}-s2`));
  setTeams(s, `${prefix}-lower-final`, loser(s, `${prefix}-upper`), winner(s, `${prefix}-lower`)); setTeams(s, `${prefix}-final`, winner(s, `${prefix}-upper`), winner(s, `${prefix}-lower-final`));
}
function updateMsi(s) {
  setTeams(s, 'msi-l1a', loser(s, 'msi-q1'), loser(s, 'msi-q2')); setTeams(s, 'msi-l1b', loser(s, 'msi-q3'), loser(s, 'msi-q4'));
  setTeams(s, 'msi-s1', winner(s, 'msi-q1'), winner(s, 'msi-q2')); setTeams(s, 'msi-s2', winner(s, 'msi-q3'), winner(s, 'msi-q4'));
  setTeams(s, 'msi-l2a', winner(s, 'msi-l1a'), loser(s, 'msi-s2')); setTeams(s, 'msi-l2b', winner(s, 'msi-l1b'), loser(s, 'msi-s1'));
  setTeams(s, 'msi-upper', winner(s, 'msi-s1'), winner(s, 'msi-s2')); setTeams(s, 'msi-l3', winner(s, 'msi-l2a'), winner(s, 'msi-l2b'));
  setTeams(s, 'msi-lower-final', winner(s, 'msi-l3'), loser(s, 'msi-upper')); setTeams(s, 'msi-final', winner(s, 'msi-upper'), winner(s, 'msi-lower-final'));
}
function seedSwiss(s, round) {
  const active = s.tournaments.worldsSwiss.filter(t => t.wins < 3 && t.losses < 3).sort((a, b) => b.wins - a.wins || a.losses - b.losses || hash(`${s.seed}:swiss${round}:${a.team}`) - hash(`${s.seed}:swiss${round}:${b.team}`));
  let i = 1;
  while (active.length) {
    const a = active.shift(); let j = active.findIndex(b => a.wins === b.wins && !a.opponents.includes(b.team));
    if (j < 0) j = active.findIndex(b => a.wins === b.wins); if (j < 0) j = 0;
    const b = active.splice(j, 1)[0]; if (!b) throw new Error('스위스 대진 수가 맞지 않습니다.');
    const id = `swiss-${round}-${i++}`; setTeams(s, id, a.team, b.team); const m = matchById(s, id); m.bestOf = a.wins === 2 || a.losses === 2 ? 3 : 1;
  }
}

function rememberRelation(s, player, targetId, targetName, memory, staff = false) {
  let relation = s.relationships.find(r => r.userId === player.userId && r.targetId === targetId);
  if (!relation) { relation = { id: randomUUID(), userId: player.userId, targetId, targetName, affinity: 0, memories: [] }; s.relationships.push(relation); }
  relation.affinity = clamp(relation.affinity + 3);
  relation.memories.unshift({ date: s.date, text: memory });
  if (staff && relation.affinity >= 12 && !relation.personalEventUnlocked) {
    relation.personalEventUnlocked = true;
    const text = targetId === 'staff:analyst'
      ? `분석관이 ${player.character.nickname}의 책상에 클립 네 개를 남겼다. "이번에는 네가 먼저 짚어봐." 둘은 첫 귀환 장면부터 확인했다.`
      : `코치가 ${player.character.nickname}을 빈 분석실로 불렀다. "마지막 콜, 네가 정리해." 보드에 다음 스크림의 합류 순서를 적었다.`;
    relation.memories.unshift({ date: s.date, text, type: 'personal-event' });
    log(s, text, 'personal-event', { userId: player.userId, targetId });
  }
  relation.memories = relation.memories.slice(0, 40);
  return relation;
}
function applyAction(room, player, submission, takeover) {
  const s = room.season, c = player.character;
  c.tier = '1군'; c.stats ??= Object.fromEntries(STAT_KEYS.map(k => [k, 65])); c.condition ??= 85; c.fatigue ??= 10; c.stress ??= 10;
  const action = ACTIONS.find(a => a.id === submission.action) || ACTIONS.find(a => a.id === 'rest');
  const conditionFactor = readinessFor(c).growthFactor;
  for (const [key, val] of Object.entries(action.effects)) {
    if (STAT_KEYS.includes(key)) c.stats[key] = Math.round(clamp((Number(c.stats[key]) || 65) + val * conditionFactor, 20, 99) * 100) / 100;
    else c[key] = Math.round(clamp((Number(c[key]) || 0) + val) * 100) / 100;
  }
  // Normal overnight recovery is part of each turn, alongside intentional rest.
  c.fatigue = clamp(c.fatigue - 3); c.condition = clamp(c.condition + 1);
  let text = `${c.nickname}: ${action.name}.`;
  if (action.id === 'duo') {
    const targetId = submission.target || player.duoId;
    const target = room.players.find(p => p.userId === targetId || p.character.id === targetId);
    const npcPosition = /^NPC:(TOP|JGL|MID|ADC|SUP)$/.exec(String(targetId || ''))?.[1];
    const npc = getRoster(room).find(c => c.npc && (c.id === targetId || c.position === npcPosition));
    const name = target?.character.nickname || npc?.nickname || '임시 NPC 파트너';
    const id = target?.userId || (npc ? targetId : 'temporary-npc');
    rememberRelation(s, player, id, name, '봇 강가 합류 시간을 맞추며 듀오 연습을 마쳤다.');
    text += ` ${name}와 리플레이를 돌려봤다.${target || npc ? '' : ' 일정 종료 후 임시 배정이 해제됐다.'}`;
  } else if (action.id === 'analysis') {
    text += ' 분석관이 첫 귀환과 강가 합류 시점을 표시했다.';
    rememberRelation(s, player, 'staff:analyst', '분석관', '첫 귀환과 강가 합류 시점을 함께 표시했다.', true);
  } else if (action.id === 'team') {
    text += ' 코치가 마지막 교전의 콜을 다시 들려줬다.';
    rememberRelation(s, player, 'staff:coach', '코치', '마지막 교전의 콜을 다시 듣고 합류 순서를 정리했다.', true);
  }
  else if (action.id === 'rest') text += ' 휴대폰을 책상에 뒤집어 두고 알람을 껐다.';
  else if (action.id === 'walk') text += ` ${player.location || '숙소'}에서 잠시 발을 멈췄다. 돌아와 다음 일정을 확인했다.`;
  else text += ' 종료 시간이 되자 손을 털고 연습 기록을 저장했다.';
  if (submission.autoReason) text += ` [자동 준비: ${submission.autoReason}]`;
  if (takeover) text += ' [방장 지정 NPC 대행: 충분한 휴식]';
  log(s, text, 'action', { userId: player.userId, actionId:action.id, effects: action.effects, takeover, ...(submission.autoReason?{autoReason:submission.autoReason}:{}) });
  return { userId: player.userId, action: action.id, takeover, text };
}
function compactOtherResult(result) {
  return { ...result, sets: result.sets.map(set => ({ number: set.number, winner: set.winner, duration: set.duration, killsA: set.killsA, killsB: set.killsB, events: [], scoreboard: [], draft: { bansA: [], bansB: [], picksA: [], picksB: [] }, summaryOnly: true })), recap: result.recap.slice(0, 1), summaryOnly: true };
}
function runMatch(room, match) {
  const s = room.season;
  const ours = match.teamA === s.team || match.teamB === s.team;
  let result = simulateSeries({ draftVersion:s.matchDraftVersions?.[match.id]??1, objectiveVersion:s.matchObjectiveVersions?.[match.id]??1, teamA: teamProfile(room, match.teamA), teamB: teamProfile(room, match.teamB), bestOf: match.bestOf, seed: `${s.seed}:${match.id}`, stage: match.stage, setStrategies:s.matchPlans?.[match.id]||{}, recentComments:ours?s.commentaryMemory||[]:[],selectionRight:match.selectionRight===true,selectionReason:match.selectionReason||'',coachComms:match.coachComms===true });
  if(ours)s.commentaryMemory=[...(s.commentaryMemory||[]),...result.sets.flatMap(set=>set.events.flatMap(event=>event.reactions))].slice(-600);
  recordMatchAwards(s,match,result);
  delete result.performances;
  if (!ours) result = compactOtherResult(result);
  match.result = result; match.status = 'completed'; s.results.push(match);
  if (match.id.startsWith('cup-group')) tableResult(s.cupStandings, match);
  if (match.id.startsWith('league-') || match.id.startsWith('groups-')) tableResult(s.standings, match);
  if (match.id.startsWith('fst-group')) tableResult(s.tournaments.fstTable, match);
  if (ours) {
    const won = result.winner === s.team;
    log(s, `${match.stage} ${match.round} · ${match.teamA} ${result.scoreA}:${result.scoreB} ${match.teamB}. ${won ? '경기를 가져왔다.' : '복기할 장면이 남았다.'}`, 'match', { matchId: match.id });
    for (const player of room.players) { const c = player.character; c.fatigue = clamp(c.fatigue + result.sets.length * 3); c.stress = clamp(c.stress + (won ? -4 : 8)); c.condition = clamp(c.condition - result.sets.length * 2); c.stats.mental = clamp(c.stats.mental + .15, 20, 99); }
  }
  recordTournamentFinish(room,match);
  const knockoutLoss = (match.id.startsWith('fst-s') || match.id === 'fst-final' || match.id.startsWith('worlds-q') || match.id.startsWith('worlds-s') || match.id === 'worlds-final' || match.id.startsWith('msi-l') || match.id === 'msi-final');
  if (knockoutLoss) markElimination(s, match.stage, loser(s, match.id));
  return match;
}
export function settleDay(room, { npcTakeover = false } = {}) {
  if (room.season.year === 2026) return settleDay2026(room, { npcTakeover });
  const s = room.season; if (s.finished) throw new Error('이미 종료된 시즌입니다.');
  const stageBefore=stageFinishSnapshot(s);
  const missing = room.players.filter(p => !room.submissions?.[p.userId] || room.submissions[p.userId].turn !== s.turn);
  if (missing.length && !npcTakeover) throw new Error('모든 참가자의 행동 제출을 기다려야 합니다.');
  const date = s.date, turn = s.turn;
  const actions = room.players.map(p => { const sub = room.submissions?.[p.userId]; const takeover = !sub || sub.turn !== s.turn; return applyAction(room, p, takeover ? { action: 'rest' } : sub, takeover); });
  processDailyLife(room, getRoster(room));
  const worldEvent = processWorldEvents(room, worldEventParticipants(room));
  updateBrackets(room);
  const today = s.schedule.filter(m => m.date === s.date); const played = [];
  // Newly resolved bracket participants can be assigned after the prior series.
  for (const m of today) { updateBrackets(room); if (m.status === 'scheduled') played.push(runMatch(room, m)); }
  updateBrackets(room);
  const unresolved = today.filter(m => m.status === 'pending');
  if (unresolved.length) throw new Error(`확정되지 않은 필수 대진: ${unresolved.map(m => m.id).join(', ')}`);
  recordStageWrapUps(room,stageBefore);
  publishSeasonAwards(s);
  room.submissions = {};
  if (s.date === '2025-11-09') { s.finished = true; log(s, '301턴의 시즌이 종료됐다. 선수와 경기 기록은 이 시즌 세이브에 보관된다.', 'season-end'); }
  else { s.date = addDays(s.date); s.turn++; }
  room.revision = (room.revision || 0) + 1;
  return { date, turn, actions, worldEvent, matches: played.map(m => m.id), nextDate: s.date, finished: s.finished };
}

// Shared gameplay helpers are called only after module initialization. The year
// engine keeps its calendar/brackets separate while training and matches remain
// identical for existing saved seasons.
export const seasonShared = { getRoster, teamProfile, TEAMS, POSITIONS, clamp, hash, addDays, emptyTable, rank, baseProfile, fixture, tableResult, log, applyAction, runMatch, worldEventParticipants };
