import { TEAM_PROFILES } from './team-profiles.mjs';
import { getRoster } from './season.mjs';

const round = number => Math.round(number * 10) / 10;
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const rating = player => average(Object.values(player.effectiveStats || player.stats || {}).filter(Number.isFinite));
export function getTeamNpcPower(team) { return TEAM_PROFILES.find(profile => profile.name === team)?.power ?? 65; }

export function getBalanceReport(room) {
  const season = room.season;
  if (!season?.team) return { pending: true, canRecalibrate: false, needsReview: false };
  const roster = getRoster(room);
  const opposing = (season.opponents || []).filter(profile => profile.name !== season.team);
  const games = [...(season.results || [])].filter(game => game.result && [game.teamA, game.teamB].includes(season.team)).reverse();
  let lostStreak = 0;
  for (const game of games) { if (game.result.winner === season.team) break; lostStreak++; }
  const teamNpcPower = getTeamNpcPower(season.team);
  const rosterPower = round(average(roster.map(rating)));
  const opponentAverage = round(average(opposing.map(profile => average((profile.players || []).map(rating)) || Number(profile.power) || 65)));
  const fatigue = round(average(room.players.map(player => Number(player.character.fatigue) || 0)));
  const condition = round(average(room.players.map(player => Number(player.character.condition) || 0)));
  const reasons = [];
  if (teamNpcPower - season.npcPower >= 5) reasons.push(`NPC 기본 능력 ${season.npcPower}가 선택 팀의 참고값 ${teamNpcPower}보다 낮습니다.`);
  if (opponentAverage - rosterPower >= 6) reasons.push(`현재 로스터 평균 ${rosterPower}가 상대 기본 평균 ${opponentAverage}보다 낮습니다.`);
  if (fatigue >= 55 || condition <= 45) reasons.push(`유저 선수 평균 피로 ${fatigue}, 컨디션 ${condition}입니다. 휴식과 훈련 강도를 점검하세요.`);
  if (lostStreak >= 4) reasons.push(`최근 ${lostStreak}연패입니다. 전력과 선수 상태를 함께 확인하세요.`);
  return {
    npcPower: season.npcPower, teamNpcPower, rosterPower, opponentAverage, lostStreak, fatigue, condition,
    npcPowerMode: room.lobby?.settings?.npcPowerMode || season.npcPowerMode || 'custom',
    canRecalibrate: !room.liveMatch && !season.finished && season.npcPower !== teamNpcPower,
    needsReview: reasons.length > 0, reason: reasons.join(' ') || '평균 능력만으로 승패가 결정되지는 않습니다. 상대 성향·밴픽·피로와 경기 사건도 함께 반영됩니다.',
  };
}

export function applyTeamNpcPreset(room) {
  const season = room.season;
  if (!season?.team || season.finished || room.liveMatch) throw Object.assign(new Error('경기 중이 아닌 진행 중 시즌에서만 NPC 기본 전력을 조정할 수 있습니다.'), { status: 409 });
  const before = season.npcPower, after = getTeamNpcPower(season.team);
  season.npcPower = after;
  season.npcPowerMode = 'team';
  if (room.lobby) {
    room.lobby.settings ??= {};
    room.lobby.settings.npcPower = after; room.lobby.settings.npcPowerMode = 'team';
  }
  season.history ??= [];
  if (before !== after) season.history.unshift({
    id: `npc-balance-${season.turn}-${before}-${after}`, date: season.date, turn: season.turn, type: 'settings',
    text: `방장이 ${season.team} 로스터 NPC 기본 능력을 ${before} → ${after}로 조정했다. 다음 경기부터 적용하며 기존 경기 결과와 유저 선수의 능력치는 유지한다.`,
  });
  return { before, after, effectiveFrom: season.date };
}
