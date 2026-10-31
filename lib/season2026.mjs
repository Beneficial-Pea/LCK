import { ensureDemacia, updateDemacia } from './demacia.mjs';
import { processDailyLife } from './daily-life.mjs';
import { processClubActivities } from './club-schedule.mjs';
import { randomUUID } from 'node:crypto';
import calendar from '../data/calendar-2026.json' with { type: 'json' };
import { defaultOpponentSettings } from './team-profiles.mjs';
import { seasonShared } from './season.mjs';
import { processWorldEvents } from './world-events.mjs';

export const RULES2026 = [
  '2026 시즌은 한국시간 날짜 기준 1월 12일 준비일부터 11월 15일 월즈 결승까지, 하루 1턴·308턴입니다. 기존 2025 시즌과 세이브는 자동 변환하거나 초기화하지 않습니다.',
  '독립 공개 API 캘린더의 2026 경기 날짜·시각·초기 대진을 저장한 스냅샷입니다. 원본 커밋과 출처는 시즌 자료에 남습니다. 공식 원문 직접 대조는 미완료이며 공식 규정 전체를 재현했다고 주장하지 않습니다.',
  'Cup 그룹 25경기와 정규시즌 R1~2 90경기는 자료의 실제 날짜·대진을 사용합니다. 이후 토너먼트와 그룹은 같은 날짜·시각의 슬롯에 게임 결과로 진출팀을 넣습니다. 실제 경기 결과는 게임 승패로 재사용하지 않습니다.',
  '2026 LCK Cup은 1월 14일~3월 1일입니다. 마지막 그룹 주차 5경기는 BO5이며 그룹 점수를 2점으로 환산하는 게임 규칙을 사용합니다. 그룹 승리팀 상위 2팀·패배팀 1위 직행, 6팀 플레이인과 6팀 더블 엘리미네이션으로 진행합니다. 세부 동률·상대 지명은 간소화한 추정 규칙입니다.',
  '2026 퍼스트 스탠드는 Cup 결승 진출 2팀만 참가합니다. 3월 16~22일, 8팀·2개 GSL 그룹·4강·결승으로 총 13경기입니다. 2025년처럼 Cup 우승팀 1팀만 보내지 않습니다.',
  'R1~2는 4월 1일~5월 31일, 상위 6팀은 6월 6~14일 Road to MSI에 참가합니다. 5·6위전→4위전→3위전의 경로와 1·2위전이 있으며 1·2위전 승자 및 최종전 승자만 MSI에 갑니다.',
  '2026 MSI는 6월 28일~7월 12일입니다. LCK 2시드는 4팀·6경기의 플레이인에서 1개 본선 자리를 다투고 1시드는 본선 직행합니다. 본선은 8팀 더블 엘리미네이션 14경기입니다.',
  'R1~2 성적을 승계하여 상위 5팀 레전드·하위 5팀 라이즈로 나눕니다. 2026년 7월 29일~8월 23일 그룹 경기는 40경기·팀당 8경기의 R3~4입니다. 2025년의 60경기 R3~5를 복사하지 않습니다.',
  '레전드 상위 4팀은 플레이오프 직행, 레전드 5위와 라이즈 상위 3팀은 8월 26~28일 3경기 플레이인으로 2팀을 정합니다. 6팀 더블 엘리미네이션 플레이오프는 8월 29일~9월 13일 10경기입니다. 별도 지역 선발전은 없습니다. 상세 지명 규정은 간소화합니다.',
  'LCK 팀이 MSI 결승에 오르면 LCK 월즈 출전권은 4장, 아니면 3장입니다. 2026 스냅샷처럼 LCK 시드는 스위스에 직행하며, 국제 플레이인 4팀·6경기의 승자 1팀이 나머지 자리를 채웁니다.',
  '월즈는 한국시간 10월 16~19일 플레이인, 10월 24일~11월 1일 스위스, 11월 4~7일 8강, 11월 8~9일 4강, 11월 15일 결승입니다. 스위스는 3승 진출·3패 탈락이며 같은 성적끼리 짝짓고 재대결을 가능한 한 피합니다. 실제 추첨 규정은 간소화합니다.',
  '데마시아컵 글로벌 인비테이셔널: 10월 3~17일, 6개 지역 12팀. MSI 지역별 순위에 따라 3·3·2·2·1·1팀을 초청하며 월즈 참가팀을 제외합니다. LCK는 정규시즌 최종 순위를 사용하고 거절 시 차순위로 승계합니다. 해외 실제 초청 명단은 확인 전까지 순위 슬롯 NPC로 표시합니다.',
  '데마시아컵 온라인은 R1 BO1, 이후 BO3 변형 스위스입니다. 2승 진출·3패 탈락이며 0승 2패 3팀은 별도 라운드 로빈을 통해 1팀만 마지막 진출전에 합류합니다. 첫 라운드 내전과 그룹 전체 재대결을 피합니다. 0승 2패조 동률은 세트 득실과 저장된 시드 추첨으로 간소화합니다.',
  '데마시아컵 오프라인 8강부터 결승까지 모두 BO5입니다. 추첨된 왼쪽 팀이 1세트 RoFS, 이후 직전 세트 패자가 RoFS를 가집니다. 게임에서는 선픽 선택을 자동 적용합니다. 코치 보이스는 팀별·세트별 최대 3회·각 45초, 경기 정지 없이 자동 코치 콜로 재현하고 다음 세트로 이월하지 않습니다.',
  'EWC는 자료에 있는 7월 15~19일 28개 경기 슬롯을 사용한 초청 대회입니다. 게임에서는 R1~2 상위 4팀을 LCK 초청팀으로 삼으며 MSI·월즈 시드에 영향을 주지 않습니다. 실제 초청·시드 절차의 완전 재현이 아닙니다.',
  '상대 능력치는 저장된 2026 완료 경기 성적을 게임 수치로 환산한 회고형 프리셋입니다. 공식 선수 능력치나 시즌 개막 시점 예측이 아닙니다. 전력·성향·난이도·랜덤 시드는 시즌 시작 후 고정됩니다.',
  '경기는 사건을 순서대로 시뮬레이션해 승패를 결정합니다. 양 팀 글로벌 피어리스로 시리즈 내 챔피언 재사용을 막고 풀이 부족하면 숙련도 페널티가 있는 포지션 대체 픽을 씁니다. 밴은 팀당 3개로 간소화했습니다. 댓글은 경기 사건에 대한 가상 반응입니다.',
];

const domestic = calendar.domestic;
const international = calendar.international;
const parts = {
  cupGroup: domestic.filter(m => m.date <= '2026-02-01'),
  cupPlayin: domestic.filter(m => m.date >= '2026-02-06' && m.date <= '2026-02-08'),
  cupPlayoffs: domestic.filter(m => m.date >= '2026-02-12' && m.date <= '2026-03-01'),
  league: domestic.filter(m => m.date >= '2026-04-01' && m.date <= '2026-05-31'),
  road: domestic.filter(m => m.date >= '2026-06-06' && m.date <= '2026-06-14'),
  groups: domestic.filter(m => m.date >= '2026-07-29' && m.date <= '2026-08-23'),
  playin: domestic.filter(m => m.date >= '2026-08-26' && m.date <= '2026-08-28'),
  playoffs: domestic.filter(m => m.date >= '2026-08-29' && m.date <= '2026-09-13'),
  fst: international.filter(m => m.league === 'FST'),
  msiPlayin: international.filter(m => m.league === 'MSI' && m.date < '2026-07-03'),
  msiMain: international.filter(m => m.league === 'MSI' && m.date >= '2026-07-03'),
  ewc: international.filter(m => m.league === 'EWC'),
  worldsPlayin: international.filter(m => m.league === 'Worlds' && m.round.includes('플레이-인')),
  swiss: international.filter(m => m.league === 'Worlds' && m.round.includes('스위스')),
  worldsKnockout: international.filter(m => m.league === 'Worlds' && !m.round.includes('플레이-인') && !m.round.includes('스위스')),
};
const winners = match => match.score && match.teams[match.score[0] > match.score[1] ? 0 : 1];
const idFor = (prefix, i, n, finalId) => finalId && i === n - 1 ? finalId : `${prefix}-${i + 1}`;
function addFixtures(schedule, rows, prefix, stage, finalId, fixed = false) {
  return rows.map((row, i) => {
    const id = idFor(prefix, i, rows.length, finalId);
    const match = { id, date: row.date, stage, round: row.round.replace(/^[^·]*·\s*/, ''), teamA: fixed ? row.teams[0] : null, teamB: fixed ? row.teams[1] : null, bestOf: row.bestOf, status: fixed ? 'scheduled' : 'pending', sourceId: row.id, sourceStart: row.start, sourceTeams: row.teams, sourceRound: row.round, fixtureBasis: fixed ? 'actual-initial-fixture' : 'result-seeded-slot' };
    schedule.push(match); return match;
  });
}
function cupGroups() {
  const graph = {}; for (const row of parts.cupGroup) { const [a, b] = row.teams; (graph[a] ??= []).push(b); (graph[b] ??= []).push(a); }
  const colors = { T1: 0 }, stack = ['T1'];
  while (stack.length) { const a = stack.pop(); for (const b of graph[a]) if (!(b in colors)) { colors[b] = 1 - colors[a]; stack.push(b); } }
  return [Object.keys(colors).filter(t => colors[t] === 0), Object.keys(colors).filter(t => colors[t] === 1)];
}
function currentRanking(s, table = s.standings) { return seasonShared.rank(table, s.seed, s.results); }
function cupRanking(s, names) { return [...s.cupStandings].filter(t => names.includes(t.team)).sort((a, b) => b.points - a.points || b.setWins - b.setLosses - (a.setWins - a.setLosses) || seasonShared.hash(s.seed + a.team) - seasonShared.hash(s.seed + b.team)).map(t => t.team); }
function find(s, id) { return s.schedule.find(m => m.id === id); }
function win(s, id) { return find(s, id)?.result?.winner; }
function lose(s, id) { const m = find(s, id); return m?.result ? m.result.winner === m.teamA ? m.teamB : m.teamA : null; }
function setPair(s, id, a, b) { const m = find(s, id); if (m && m.status === 'pending' && a && b && a !== b) { m.teamA = a; m.teamB = b; m.status = 'scheduled'; } }
function allDone(s, ids) { return ids.every(id => Boolean(find(s, id)?.result)); }
function ownStatus(s, teams) { return teams.includes(s.team) ? 'qualified' : 'not-qualified'; }
function record(s, text, type = 'qualification') { seasonShared.log(s, text, type); }
function table(rows) { return seasonShared.emptyTable(rows); }

// A source result is used only to identify a bracket edge: the next historical
// appearance of a team came from this prior match's winner/loser slot. The game
// resolves that edge with its own simulated outcome, never the historical score.
function makeTemplate(rows, ids, mapping) {
  const seen = {}, edges = [];
  rows.forEach((row, i) => {
    const slots = row.teams.map(team => {
      const prior = seen[team];
      return prior ? { match: prior.id, outcome: winners(prior.row) === team ? 'winner' : 'loser' } : { team: mapping[team] ?? team };
    });
    edges.push({ id: ids[i], slots }); for (const team of row.teams) seen[team] = { id: ids[i], row };
  });
  return edges;
}
function resolveTemplates(s) {
  for (const edges of Object.values(s.tournaments.templates)) for (const edge of edges) {
    const teams = edge.slots.map(slot => slot.match ? slot.outcome === 'winner' ? win(s, slot.match) : lose(s, slot.match) : slot.team);
    setPair(s, edge.id, teams[0], teams[1]);
  }
}
function activateTemplate(s, key, rows, ids, mapping = {}) { s.tournaments.templates[key] = makeTemplate(rows, ids, mapping); resolveTemplates(s); }
function sourceIds(s, prefix) { return s.tournaments.fixtureIds[prefix]; }
function actualTable(rows, teams) {
  const t = table(teams);
  for (const row of rows) if (row.score) seasonShared.tableResult(t, { teamA: row.teams[0], teamB: row.teams[1], result: { winner: winners(row), scoreA: row.score[0], scoreB: row.score[1] } });
  return t;
}

export function createSeason2026({ team = 'T1', difficulty = 'normal', seed = '2026-LCK', npcPower = 65, opponents = [] } = {}) {
  const h = seasonShared; if (!h.TEAMS.includes(team)) team = 'T1';
  const defaults = defaultOpponentSettings(); const difficultyShift = difficulty === 'hard' ? 7 : difficulty === 'easy' ? -7 : 0;
  const profiles = defaults.map((profile, i) => {
    const configured = Array.isArray(opponents) ? opponents.find(o => o.name === profile.name || o.team === profile.name) : opponents?.[profile.name];
    const p = Number(configured?.power ?? profile.power);
    return h.baseProfile(profile.name, i, seed, h.clamp((Number.isFinite(p) ? p : profile.power) + (profile.name === team ? 0 : difficultyShift), 30, 95), configured?.style || profile.style);
  });
  const schedule = [], fixtureIds = {};
  const add = (key, rows, prefix, stage, finalId, fixed) => { fixtureIds[key] = addFixtures(schedule, rows, prefix, stage, finalId, fixed).map(m => m.id); };
  add('cupGroup', parts.cupGroup, 'cup-group', 'LCK Cup', null, true); add('cupPlayin', parts.cupPlayin, 'cup-pi', 'LCK Cup'); add('cupPlayoffs', parts.cupPlayoffs, 'cup-po', 'LCK Cup', 'cup-final');
  add('league', parts.league, 'league', 'LCK R1~2', null, true); add('road', parts.road, 'road', 'Road to MSI'); add('groups', parts.groups, 'groups', 'LCK R3~4'); add('playin', parts.playin, 'pi', 'LCK 플레이인'); add('playoffs', parts.playoffs, 'po', 'LCK 플레이오프', 'po-final');
  add('fst', parts.fst, 'fst', '퍼스트 스탠드', 'fst-final'); add('msiPlayin', parts.msiPlayin, 'msi-pi', 'MSI'); add('msiMain', parts.msiMain, 'msi-main', 'MSI', 'msi-final'); add('ewc', parts.ewc, 'ewc', 'EWC', 'ewc-final');
  add('worldsPlayin', parts.worldsPlayin, 'worlds-playin', '월즈');
  let offset = 0;
  [8, 8, 8, 6, 3].forEach((count, r) => { const ids = addFixtures(schedule, parts.swiss.slice(offset, offset + count), `swiss-${r + 1}`, '월즈').map(m => m.id); fixtureIds[`swiss${r + 1}`] = ids; offset += count; });
  fixtureIds.worldsKnockout = parts.worldsKnockout.map((row, i) => {
    const [m] = addFixtures(schedule, [row], 'unused', '월즈'); m.id = i < 4 ? `worlds-q${i + 1}` : i < 6 ? `worlds-s${i - 3}` : 'worlds-final'; return m.id;
  });
  schedule.sort((a, b) => a.sourceStart.localeCompare(b.sourceStart) || a.id.localeCompare(b.id));
  const startDate = '2026-01-12', endDate = parts.worldsKnockout.at(-1).date;
  const season = { id: randomUUID(), year: 2026, startDate, endDate, date: startDate, turn: 1, totalTurns: Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1, finished: false, team, seed: String(seed), difficulty, npcPower: h.clamp(Number(npcPower) || 65, 30, 95), opponents: profiles, standings: table(h.TEAMS), cupStandings: table(h.TEAMS).map(row => ({ ...row, points: 0 })), schedule, results: [], history: [], relationships: [], qualifications: { firstStand: { status: 'pending', team: null, teams: [] }, msi: { status: 'pending', teams: [] }, worlds: { status: 'pending', teams: [], seeds: 3, reason: 'MSI 결승 진출 지역 대기 · 요청 규칙 적용' } }, flags: {}, groups: null, tournaments: { fixtureIds, templates: {}, cupGroups: cupGroups() }, rules: RULES2026, calendarSource: calendar.source };
  ensureDemacia(season);return season;
}

function update2026(room) {
  const s = room.season, t = s.tournaments, ids = t.fixtureIds;
  if (!s.flags.cupSeeded && allDone(s, ids.cupGroup)) {
    s.flags.cupSeeded = true;
    const points = t.cupGroups.map(group => s.cupStandings.filter(row => group.includes(row.team)).reduce((sum, row) => sum + row.points, 0));
    const winning = points[0] >= points[1] ? 0 : 1, a = cupRanking(s, t.cupGroups[winning]), b = cupRanking(s, t.cupGroups[1 - winning]);
    t.cupDirect = [a[0], a[1], b[0]];
    activateTemplate(s, 'cupPlayin', parts.cupPlayin, ids.cupPlayin, { DRX: b[2], BRO: a[4], KT: b[3], DNF: a[3], DK: b[1], NS: a[2] });
    record(s, `2026 Cup 그룹 배틀 종료. 직행 ${t.cupDirect.join(', ')}. 플레이인은 6팀이 3개 자리를 다툰다.`);
  }
  if (!s.flags.cupPlayoffSeeded && allDone(s, ids.cupPlayin)) {
    s.flags.cupPlayoffSeeded = true;
    const qualifiers = [win(s, ids.cupPlayin[2]), win(s, ids.cupPlayin[3]), win(s, ids.cupPlayin[4])];
    activateTemplate(s, 'cupPlayoffs', parts.cupPlayoffs, ids.cupPlayoffs, { 'Gen.G': t.cupDirect[0], T1: t.cupDirect[1], BNK: t.cupDirect[2], DNF: qualifiers[1], DK: qualifiers[0], DRX: qualifiers[2] });
  }
  const cupFinal = find(s, 'cup-final');
  if (cupFinal.status === 'scheduled' && !s.flags.fstSeeded) {
    s.flags.fstSeeded = true; t.cupFinalists = [cupFinal.teamA, cupFinal.teamB];
    s.qualifications.firstStand = { status: ownStatus(s, t.cupFinalists), team: null, teams: t.cupFinalists };
    // The actual final's upper-bracket slot was GEN and lower slot BFX. Preserve
    // those two slots, with simulated finalists replacing the historical teams.
    activateTemplate(s, 'fst', parts.fst, ids.fst, { BNK: cupFinal.teamA, 'Gen.G': cupFinal.teamB });
    record(s, `2026 퍼스트 스탠드 LCK 대표는 Cup 결승 진출팀 ${t.cupFinalists.join(', ')}. 두 팀 모두 참가한다.`);
  }
  if (win(s, 'cup-final')) { s.qualifications.firstStand.team = win(s, 'cup-final'); t.cupChampion = win(s, 'cup-final'); }
  if (win(s, 'fst-final') && !s.flags.fstEnded) { s.flags.fstEnded = true; finishIntl(s, 'firstStand', 'fst-final'); }

  if (!s.flags.leagueSplit && allDone(s, ids.league)) {
    s.flags.leagueSplit = true; const order = currentRanking(s).map(row => row.team); t.roadSeeds = order.slice(0, 6); s.groups = { legend: order.slice(0, 5), rise: order.slice(5) };
    s.standings.forEach(row => { row.group = s.groups.legend.includes(row.team) ? '레전드' : '라이즈'; });
    // Fixed dates and historical group-rank slots; names change with this game.
    const actual = seasonShared.rank(actualTable(parts.league, seasonShared.TEAMS), '2026-actual', []).map(row => row.team);
    const actualLegend = [...new Set(parts.groups.filter(m => m.teams.includes('T1')).flatMap(m => m.teams))];
    const actualRise = seasonShared.TEAMS.filter(team => !actualLegend.includes(team));
    const map = {};
    [actual.filter(team => actualLegend.includes(team)), actual.filter(team => actualRise.includes(team))].forEach((group, i) => group.forEach((team, j) => { map[team] = (i === 0 ? s.groups.legend : s.groups.rise)[j]; }));
    parts.groups.forEach((row, i) => setPair(s, ids.groups[i], map[row.teams[0]], map[row.teams[1]]));
    setPair(s, ids.road[0], order[4], order[5]); setPair(s, ids.road[2], order[0], order[1]);
    // EWC invitations are an explicit game rule, independent of MSI seeds.
    activateTemplate(s, 'ewc', parts.ewc, ids.ewc, { 'Gen.G': order[0], T1: order[1], DK: order[2], HLE: order[3] });
    record(s, `R1~2 종료. Road to MSI 상위 6팀 ${t.roadSeeds.join(', ')}. 2026 그룹 R3~4는 팀당 8경기이며 기존 성적을 승계한다.`);
  }
  if (t.roadSeeds) {
    setPair(s, ids.road[1], t.roadSeeds[3], win(s, ids.road[0]));
    setPair(s, ids.road[3], t.roadSeeds[2], win(s, ids.road[1]));
    setPair(s, ids.road[4], lose(s, ids.road[2]), win(s, ids.road[3]));
  }
  if (!s.flags.msiSeeded && allDone(s, ids.road)) {
    s.flags.msiSeeded = true; const teams = [win(s, ids.road[2]), win(s, ids.road[4])]; s.qualifications.msi = { status: ownStatus(s, teams), teams };
    activateTemplate(s, 'msiPlayin', parts.msiPlayin, ids.msiPlayin, { T1: teams[1] });
    record(s, `MSI 1시드 ${teams[0]}은 본선 직행, 2시드 ${teams[1]}은 1개 본선 자리를 놓고 플레이인에 참가한다.`);
  }
  if (!s.flags.msiBracket && allDone(s, ids.msiPlayin)) {
    s.flags.msiBracket = true; t.msiPlayinWinner = win(s, ids.msiPlayin.at(-1));
    activateTemplate(s, 'msiMain', parts.msiMain, ids.msiMain, { HLE: s.qualifications.msi.teams[0], T1: t.msiPlayinWinner });
    if (s.qualifications.msi.teams[1] === s.team && t.msiPlayinWinner !== s.team) s.qualifications.msi.status = 'eliminated';
  }
  const msiFinal = find(s, 'msi-final');
  if (!s.flags.msiFinalists && msiFinal.status === 'scheduled') {
    s.flags.msiFinalists = true; const four = [msiFinal.teamA, msiFinal.teamB].some(team => s.qualifications.msi.teams.includes(team));
    s.qualifications.worlds.seeds = four ? 4 : 3; s.qualifications.worlds.reason = four ? 'LCK 팀 MSI 결승 진출 · 요청 규칙에 따라 4시드' : 'LCK 팀 MSI 결승 미진출 · 3시드';
    record(s, `MSI 결승 ${msiFinal.teamA} vs ${msiFinal.teamB}. 요청 규칙에 따른 LCK 월즈 시드는 ${four ? 4 : 3}개다.`);
  }
  if (win(s, 'msi-final') && !s.flags.msiEnded) { s.flags.msiEnded = true; finishIntl(s, 'msi', 'msi-final'); }

  if (!s.flags.playinSeeded && allDone(s, ids.groups)) {
    s.flags.playinSeeded = true; const lg = currentRanking(s, s.standings.filter(row => row.group === '레전드')).map(row => row.team), rise = currentRanking(s, s.standings.filter(row => row.group === '라이즈')).map(row => row.team);
    t.playoffDirect = lg.slice(0, 4); t.playinSeeds = [lg[4], ...rise.slice(0, 3)];
    setPair(s, ids.playin[0], rise[1], lg[4]); setPair(s, ids.playin[1], rise[0], rise[2]);
    record(s, `2026 그룹 경기 종료. 플레이오프 직행 ${t.playoffDirect.join(', ')}. 플레이인은 3경기로 2개 자리를 정한다.`);
  }
  if (s.flags.playinSeeded) setPair(s, ids.playin[2], win(s, ids.playin[1]), lose(s, ids.playin[0]));
  if (!s.flags.playoffSeeded && allDone(s, ids.playin)) {
    s.flags.playoffSeeded = true; const q = [win(s, ids.playin[0]), win(s, ids.playin[2])]; t.playoffSeeds = [...t.playoffDirect, ...q];
    activateTemplate(s, 'playoffs', parts.playoffs, ids.playoffs, { 'Gen.G': t.playoffDirect[0], HLE: t.playoffDirect[1], T1: t.playoffDirect[2], DK: t.playoffDirect[3], KT: q[0], BNK: q[1] });
  }
  if (!s.flags.worldsSeeded && win(s, 'po-final')) {
    s.flags.worldsSeeded = true;
    const order = [win(s, 'po-final'), lose(s, 'po-final'), lose(s, ids.playoffs[8]), lose(s, ids.playoffs[7])];
    const teams = order.slice(0, s.qualifications.worlds.seeds); s.qualifications.worlds = { ...s.qualifications.worlds, status: ownStatus(s, teams), teams }; t.lckChampion = order[0];
    t.worldsLckMap = { 'Gen.G': teams[0], HLE: teams[1], T1: teams[2], DK: teams[3] || 'PSG' };
    activateTemplate(s, 'worldsPlayin', parts.worldsPlayin, ids.worldsPlayin);
    record(s, `${order[0]}이 2026 LCK를 우승했다. 월즈 스위스 직행 ${teams.join(', ')}. 별도 지역 선발전은 없다.`);
  }
  if (!s.flags.swissSeeded && allDone(s, ids.worldsPlayin)) {
    s.flags.swissSeeded = true; const qualifier = win(s, ids.worldsPlayin.at(-1));
    const teams = [...new Set(parts.swiss.slice(0, 8).flatMap(row => row.teams))].map(team => t.worldsLckMap[team] || (team === 'KC' ? qualifier : team));
    if (new Set(teams).size !== 16) throw new Error('월즈 본선 16개 팀이 중복되었습니다.');
    t.worldsSwiss = teams.map(team => ({ team, wins: 0, losses: 0, opponents: [] })); seedSwiss(s, 1);
  }
  for (let r = 1; r <= 5; r++) if (!s.flags[`swissDone${r}`] && allDone(s, ids[`swiss${r}`])) {
    s.flags[`swissDone${r}`] = true;
    for (const id of ids[`swiss${r}`]) {
      const m = find(s, id), a = t.worldsSwiss.find(row => row.team === m.teamA), b = t.worldsSwiss.find(row => row.team === m.teamB);
      a.opponents.push(b.team); b.opponents.push(a.team); (m.result.winner === a.team ? a : b).wins++; (m.result.winner === a.team ? b : a).losses++;
    }
    if (t.worldsSwiss.some(row => row.team === s.team && row.losses >= 3)) s.qualifications.worlds.status = 'eliminated';
    if (r < 5) seedSwiss(s, r + 1);
    else { const top = t.worldsSwiss.filter(row => row.wins === 3).sort((a, b) => a.losses - b.losses || seasonShared.hash(s.seed + a.team) - seasonShared.hash(s.seed + b.team)); for (let i = 0; i < 4; i++) setPair(s, `worlds-q${i + 1}`, top[i]?.team, top[7 - i]?.team); }
  }
  setPair(s, 'worlds-s1', win(s, 'worlds-q1'), win(s, 'worlds-q2')); setPair(s, 'worlds-s2', win(s, 'worlds-q3'), win(s, 'worlds-q4')); setPair(s, 'worlds-final', win(s, 'worlds-s1'), win(s, 'worlds-s2'));
  if (!s.flags.worldsEnded && win(s, 'worlds-final')) { s.flags.worldsEnded = true; finishIntl(s, 'worlds', 'worlds-final'); t.worldsChampion = win(s, 'worlds-final'); }
  resolveTemplates(s);
  s.standings = currentRanking(s);
  updateDemacia(s);
}
function finishIntl(s, key, id) { const q = s.qualifications[key]; if ((q.teams || []).includes(s.team)) q.status = win(s, id) === s.team ? 'champion' : 'eliminated'; record(s, `${find(s, id).stage} 우승: ${win(s, id)}.`, 'title'); }
function markLiveElimination(s, match) {
  const key = match.stage === '퍼스트 스탠드' ? 'firstStand' : match.stage === 'MSI' ? 'msi' : null;
  if (!key || lose(s, match.id) !== s.team) return;
  const hasLowerPath = Object.values(s.tournaments.templates).flat().some(edge => edge.slots.some(slot => slot.match === match.id && slot.outcome === 'loser'));
  if (!hasLowerPath) s.qualifications[key].status = 'eliminated';
}
function seedSwiss(s, round) {
  const remaining = s.tournaments.worldsSwiss.filter(row => row.wins < 3 && row.losses < 3).sort((a, b) => b.wins - a.wins || a.losses - b.losses || seasonShared.hash(`${s.seed}:${round}:${a.team}`) - seasonShared.hash(`${s.seed}:${round}:${b.team}`));
  let i = 0;
  while (remaining.length) {
    const a = remaining.shift(); let j = remaining.findIndex(b => b.wins === a.wins && !a.opponents.includes(b.team)); if (j < 0) j = remaining.findIndex(b => b.wins === a.wins); if (j < 0) j = 0;
    const b = remaining.splice(j, 1)[0]; if (!b) throw new Error('스위스 대진 수가 맞지 않습니다.');
    const id = s.tournaments.fixtureIds[`swiss${round}`][i++]; setPair(s, id, a.team, b.team); find(s, id).bestOf = a.wins === 2 || a.losses === 2 ? 3 : 1;
  }
}

export function settleDay2026(room, { npcTakeover = false } = {}) {
  const s = room.season; if (s.finished) throw new Error('이미 종료된 시즌입니다.');
  ensureDemacia(s);
  const missing = room.players.filter(p => !room.submissions?.[p.userId] || room.submissions[p.userId].turn !== s.turn);
  if (missing.length && !npcTakeover) throw new Error('모든 참가자의 행동 제출을 기다려야 합니다.');
  const date = s.date, turn = s.turn;
  const actions = room.players.map(p => { const sub = room.submissions?.[p.userId], takeover = !sub || sub.turn !== s.turn; return seasonShared.applyAction(room, p, takeover ? { action: 'rest' } : sub, takeover); });
  processDailyLife(room, seasonShared.getRoster(room));
  const worldEvent = processWorldEvents(room, seasonShared.worldEventParticipants(room));
  update2026(room); const played = [];
  for (const match of s.schedule.filter(m => m.date === date)) {
    update2026(room);
    if (match.status === 'scheduled') {
      seasonShared.runMatch(room, match); played.push(match.id);
      markLiveElimination(s, match);
      if (match.id.startsWith('cup-group')) { const row = s.cupStandings.find(row => row.team === match.result.winner); row.points += match.bestOf === 5 ? 2 : 1; }
    }
  }
  update2026(room);
  const unresolved = s.schedule.filter(m => m.date === date && m.status === 'pending');
  if (unresolved.length) throw new Error(`확정되지 않은 2026 필수 대진: ${unresolved.map(m => m.id).join(', ')}`);
  const clubActivities=processClubActivities(room);
  room.submissions = {};
  if (date === s.endDate) { s.finished = true; record(s, `${s.totalTurns}턴의 2026 시즌이 종료됐다. 기존 슬롯과 시즌 기록은 보관된다.`, 'season-end'); }
  else { s.date = seasonShared.addDays(date); s.turn++; }
  room.revision = (room.revision || 0) + 1;
  return { date, turn, actions, worldEvent, clubActivities, matches: played, nextDate: s.date, finished: s.finished };
}
