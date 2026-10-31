import { authenticatedBrowserContext } from './helpers/accounts.mjs';
// Optional real-browser QA. The clock runs in an isolated server and SQLite file.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = await mkdtemp(path.join(tmpdir(), 'first-team-live-browser-'));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', DATA_FILE: path.join(temp, 'game.sqlite'), LIVE_STEP_MS: '350' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '', browser;
const checks = [], errors = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const action = (page, name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({ visible: true }).first();
const fits = async page => {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.width + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
};
function assertVisibleKda(broadcast) {
  for (const set of broadcast.sets) {
    const rows = new Map(set.scoreboard.map(p => [`${p.team}:${p.nickname}`, { k: 0, d: 0, a: 0 }]));
    for (const event of set.events) for (const kill of event.kills || []) {
      const killer = rows.get(`${kill.killerTeam}:${kill.killer}`), victim = rows.get(`${kill.victimTeam}:${kill.victim}`);
      if (killer) killer.k++; if (victim) victim.d++;
      for (const name of kill.assists || []) { const assist = rows.get(`${kill.killerTeam}:${name}`); if (assist) assist.a++; }
    }
    for (const p of set.scoreboard) assert.deepEqual({ k: p.k, d: p.d, a: p.a }, rows.get(`${p.team}:${p.nickname}`));
  }
}
try {
  const baseURL = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk;const port = output.match(/listening on port (\d+)/)?.[1];if (port) { clearTimeout(timer);resolve(`http://127.0.0.1:${port}`); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const hostContext = await authenticatedBrowserContext(browser,{ viewport: { width: 1440, height: 1000 }, baseURL });
  const peerContext = await authenticatedBrowserContext(browser,{ viewport: { width: 1280, height: 900 }, baseURL });
  const request = async (context, route, data, method = data ? 'POST' : 'GET') => {
    const response = await context.request.fetch(route, { method, ...(data ? { data } : {}) });
    const body = await response.json();assert(response.ok(), `${route}: ${JSON.stringify(body)}`);return body;
  };
  const character = (position, nickname, champion) => ({ name: nickname, nickname, age: 21, position, mainChampion: champion, pool: [champion, '아리', '오리아나', '아지르'], style: '균형 운영' });
  await request(hostContext, '/api/session');
  await request(hostContext, '/api/slots/0', { character: character('MID', 'LiveHero', '아리') }, 'PUT');
  let { room } = await request(hostContext, '/api/rooms', { slot: 0, year: 2025, seed: 'match-live-browser' });
  const code = room.code, route = `/api/rooms/${code}`;
  for (let i = 0; i < 12; i++) {
    ({ room } = await request(hostContext, route));
    const today = room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && [m.teamA, m.teamB].includes(room.season.team));
    if (today) break;
    await request(hostContext, `${route}/auto`, { turn: room.season.turn, action: 'rest' });
  }
  await request(peerContext, '/api/session');
  await request(peerContext, '/api/slots/0', { character: character('JGL', 'LivePeer', '리 신') }, 'PUT');
  await request(peerContext, '/api/rooms/join', { code, slot: 0 });
  ({ room } = await request(hostContext, route));
  const before = structuredClone(room), turn = room.season.turn, date = room.season.date;
  const ownGame = room.season.schedule.find(m => m.date === date && m.status === 'scheduled' && [m.teamA, m.teamB].includes(room.season.team));
  assert(ownGame, 'A real scheduled own-team match must exist');
  await request(hostContext, `${route}/action`, { turn, action: 'rest' });
  await request(peerContext, `${route}/action`, { turn, action: 'rest' });
  await hostContext.addInitScript(code => localStorage.setItem('first-team.room', code), code);
  await peerContext.addInitScript(code => localStorage.setItem('first-team.room', code), code);
  const host = await hostContext.newPage(), peer = await peerContext.newPage();
  host.on('pageerror', error => errors.push(error.message));peer.on('pageerror', error => errors.push(error.message));
  await host.goto('/');await peer.goto('/');
  await host.locator('.season-strip').waitFor();await peer.locator('.season-strip').waitFor();
  const response = host.waitForResponse(r => r.url().endsWith('/settle') && r.status() === 200);
  await action(host, 'settle').click();
  const started = (await (await response).json()).room;
  assert.equal(started.broadcast.status, 'live');assert.equal(started.broadcast.scoreA, 0);assert.equal(started.broadcast.scoreB, 0);
  assert.equal(started.broadcast.sets.length, 1);assert.equal(started.broadcast.sets[0].winner, undefined);
  assert.equal(started.liveMatch, undefined);assert.equal(started.broadcast.winner, undefined);
  assert.equal(started.season.date, date);assert.equal(started.season.turn, turn);
  assert.deepEqual(started.season.standings, before.season.standings);
  assert(!started.season.results.some(m => m.id === ownGame.id));
  assert(!started.season.schedule.find(m => m.id === ownGame.id).result);
  await host.locator('[data-live-match]').waitFor();await peer.locator('[data-live-match]').waitFor();
  assert.equal(await host.locator('[data-action="all-events"]').count(), 0);
  assert.equal(await host.locator('[data-action="event-next"]').count(), 0);
  assert.equal(await host.locator('.live-header-link').count(), 1);
  assert(!/정산 완료 · 다시보기|경기 후 복기/.test(await host.locator('[data-live-match]').textContent()));
  checks.push('Actual UI starts a private pending match with score 0:0; date, standings, final winner and future sets stay hidden');

  await delay(1100);
  const first = (await request(hostContext, route)).room;
  assert(first.broadcast.currentEventIndex > 1);
  assertVisibleKda(first.broadcast);
  const other = (await request(peerContext, route)).room;
  assert.equal(other.broadcast.id, first.broadcast.id);
  assert.equal(other.broadcast.activeSet, first.broadcast.activeSet);
  assert(Math.abs(other.broadcast.currentEventIndex - first.broadcast.currentEventIndex) <= 1);
  assertVisibleKda(other.broadcast);
  const exported = await request(hostContext, `${route}/export`);
  assert.equal(exported.room.liveMatch, undefined);assert.equal(exported.room.pendingRoom, undefined);
  assert(!exported.room.season.results.some(m => m.id === ownGame.id));
  for (const op of ['action', 'settle', 'auto']) {
    const denied = await hostContext.request.post(`${route}/${op}`, { data: { turn, action: 'rest', live: true } });
    assert.equal(denied.status(), 409);
  }
  checks.push('Both browsers consume the same server-clock frames and visible-only KDA; exports hide the pending result and duplicate gameplay is blocked');

  const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xn1cAAAAASUVORK5CYII=';
  await request(hostContext, `${route}/portrait`, { avatar });
  await request(hostContext, `${route}/location`, { location: '카페' });
  await request(peerContext, `${route}/chat`, { channel: 'team', text: '같이 중계 보고 있어요' });
  const broadcastId = first.broadcast.id;
  await host.reload();await host.locator('[data-live-match]').waitFor();
  const resumed = (await request(hostContext, route)).room;
  assert.equal(resumed.broadcast.id, broadcastId);
  assert(resumed.broadcast.currentEventIndex >= first.broadcast.currentEventIndex || resumed.broadcast.activeSet > first.broadcast.activeSet);
  assert.equal(resumed.season.turn, turn);
  await host.screenshot({ path: path.join(root, 'test-results', 'live-desktop.png'), fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });await fits(host);
  await host.screenshot({ path: path.join(root, 'test-results', 'live-mobile.png'), fullPage: true });
  checks.push('Refresh resumes the existing broadcast and 390px live scores, scene stream and reactions fit without horizontal overflow');

  let completed;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    const current = (await request(hostContext, route)).room;
    if (!current.broadcast) { completed = current; break; }
    await delay(180);
  }
  assert(completed, 'Broadcast must finish naturally under its shared server clock');
  assert.equal(completed.season.turn, turn + 1);
  const nextDate = new Date(`${date}T00:00:00Z`);nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  assert.equal(completed.season.date, nextDate.toISOString().slice(0, 10));
  assert.equal(completed.season.results.filter(m => m.id === ownGame.id).length, 1);
  const final = completed.season.results.find(m => m.id === ownGame.id).result;
  assert.equal(completed.lastBroadcast.id, broadcastId);
  const mine = completed.players.find(p => p.userId === completed.me);
  assert.equal(mine.character.avatar, avatar);assert.equal(mine.location, '카페');
  assert(completed.messages.some(m => m.text === '같이 중계 보고 있어요'));
  const peerCompleted = (await request(peerContext, route)).room;
  assert.deepEqual(peerCompleted.season, completed.season);
  await host.locator('[data-live-match]').waitFor({ state: 'detached', timeout: 10000 });
  await host.locator('.score-numbers').waitFor();
  assert.equal((await host.locator('.score-numbers').textContent()).replace(/\s/g, ''), `${final.scoreA}:${final.scoreB}`);
  assert.equal(await host.locator('.live-header-link').count(), 0);
  checks.push('Natural completion commits the day and result exactly once for both participants while preserving live-time cosmetics, location and chat');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, browserErrors: errors.length }, null, 2));
} finally {
  await browser?.close();
  if (child.exitCode === null) { child.kill('SIGTERM');await once(child, 'exit'); }
  await rm(temp, { recursive: true, force: true });
}
