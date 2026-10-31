// Import factual dates/results from a separately published schedule snapshot.
// Never executes the upstream collector or contacts its API.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/import-calendar2026.mjs /path/to/lol_2026cal_for_lck');
const aliases = { GEN: 'Gen.G', BFX: 'BNK', KRX: 'DRX', DNS: 'DNF' };
const canonical = name => aliases[name] || name;
const convert = row => {
  const scored = row.title.match(/\((\d+)\s*:\s*(\d+)\)/);
  const score = row.state === 'completed' && scored ? scored.slice(1).map(Number) : null;
  const format = row.title.match(/Bo([135])/i);
  return {
    id: row.id, start: row.start, date: row.start.slice(0, 10), league: row.league,
    round: row.round, teams: row.teams.map(canonical), originalTeams: row.teams,
    completed: row.state === 'completed', score,
    bestOf: format ? Number(format[1]) : score ? Math.max(...score) * 2 - 1 : 3,
  };
};
const lck = JSON.parse(readFileSync(path.join(sourcePath, 'docs/lck.json'), 'utf8'));
const intl = JSON.parse(readFileSync(path.join(sourcePath, 'docs/intl.json'), 'utf8'));
const domestic = lck.filter(row => row.league === 'LCK').map(convert);
const international = intl.map(convert);
const names = ['T1', 'Gen.G', 'HLE', 'DK', 'KT', 'BNK', 'DRX', 'NS', 'DNF', 'BRO'];
const table = Object.fromEntries(names.map(name => [name, { name, elo: 1500, played: 0, wins: 0, losses: 0, setWins: 0, setLosses: 0, latestMatch: null }]));
for (const match of [...domestic].sort((a, b) => a.start.localeCompare(b.start))) {
  if (!match.completed || !match.score || match.date > '2026-10-31') continue;
  const [a, b] = match.teams.map(name => table[name]);
  if (!a || !b || match.score[0] === match.score[1]) continue;
  const won = match.score[0] > match.score[1];
  const expected = 1 / (1 + 10 ** ((b.elo - a.elo) / 400));
  const change = 32 * (1 + Math.abs(match.score[0] - match.score[1]) * .15) * (Number(won) - expected);
  a.elo += change; b.elo -= change;
  for (const row of [a, b]) { row.played++; row.latestMatch = match.date; }
  (won ? a : b).wins++; (won ? b : a).losses++;
  a.setWins += match.score[0]; a.setLosses += match.score[1];
  b.setWins += match.score[1]; b.setLosses += match.score[0];
}
const output = {
  source: {
    url: 'https://github.com/jaykhan24/lol_2026cal_for_lck',
    commit: execFileSync('git', ['-C', sourcePath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    snapshotDate: '2026-10-31', timeZone: 'Asia/Seoul', primaryVerified: false,
    note: '독립 공개 캘린더의 API 수집 결과에서 날짜·대진·완료 점수 사실만 추출했습니다. 원 수집 코드를 실행하지 않았으며 공식 원문 직접 대조는 미완료입니다. 실제 점수는 초기 전력 환산에만 사용하고 게임 승패로 고정하지 않습니다.',
  },
  domestic, international,
  teamAssessment: Object.values(table).map(row => ({ ...row, elo: Math.round(row.elo), power: Math.max(55, Math.min(95, Math.round(73 + (row.elo - 1500) / 15))) })),
  assessmentMethod: '2026 완료 LCK 시리즈를 시간순으로 Elo(시작1500, K32, 세트차 가중1+0.15×차이)로 계산하고, 73+(Elo−1500)/15를55~95로 제한합니다. 공식 팀 평점이 아닌 게임용 환산입니다. 성향은 별도 작성한 게임 설정입니다.',
};
mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(new URL('../data/calendar-2026.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ domestic: domestic.length, international: international.length, teamAssessment: output.teamAssessment }));
