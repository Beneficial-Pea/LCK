import { authenticatedBrowserContext } from './helpers/accounts.mjs';
// Optional real-browser QA. Uses two sessions and a real naturally rolled event.
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
const temp = await mkdtemp(path.join(tmpdir(), 'first-team-world-browser-'));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', DATA_FILE: path.join(temp, 'game.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '', browser;
const checks = [], errors = [];
const action = (page, name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({ visible: true }).first();
const fits = async page => {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.width + 1, `Horizontal overflow: ${JSON.stringify(size)}`);
};
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
  const character = (position, nickname, champion) => ({ name: nickname, nickname, age: 21, position, mainChampion: champion, pool: [champion, '오리아나', '아지르'], style: '균형 운영' });
  await request(hostContext, '/api/session');
  await request(hostContext, '/api/slots/0', { character: character('MID', '인트', '아리') }, 'PUT');
  let { room } = await request(hostContext, '/api/rooms', { slot: 0, waitingRoom: true, chooseTeam: true, year: 2026, seed: 'event-demo-1367' });
  const base = `/api/rooms/${room.code}`, code = room.code;
  for (const [route, data] of [['ready', { ready: true }], ['prepare', {}], ['team', { team: 'T1' }], ['start', {}]]) await request(hostContext, `${base}/${route}`, data);
  await hostContext.addInitScript(code => localStorage.setItem('first-team.room', code), code);
  const host = await hostContext.newPage();host.on('pageerror', error => errors.push(error.message));
  await host.goto('/');await host.locator('.season-strip').waitFor();
  await host.locator('[data-world-events]').waitFor();
  assert((await host.locator('[data-world-events]').textContent()).includes('아직 기록된 리그 소식이 없습니다'));
  await action(host, 'choose-action', '[data-id="rest"]').click();await action(host, 'submit-action').click();
  await host.waitForFunction(() => !document.querySelector('[data-action="settle"]')?.disabled);
  const settled = host.waitForResponse(response => response.url().endsWith('/settle') && response.status() === 200);
  await action(host, 'settle').click();await settled;
  await host.locator('[data-world-event]').first().waitFor();
  ({ room } = await request(hostContext, base));
  assert.equal(room.season.turn, 2);assert.equal(room.season.date, '2026-01-13');
  const event = room.season.worldEvents.events[0];
  assert.equal(event.type, 'champion-nerf');assert.equal(event.champion, '아리');assert.deepEqual(event.statChanges, { laning: -1 });
  assert(event.targets.some(t => t.nickname === '인트' && t.team === 'T1'));
  assert(event.targets.some(t => t.team === 'Gen.G'));assert(event.targets.some(t => t.team === 'DRX'));
  const mine = room.players[0].character, mineId = mine.id;
  assert.equal(mine.stats.laning, 65);assert.equal(mine.effectiveStats.laning, 64);
  const gen = room.season.opponents.find(team => team.name === 'Gen.G').players.find(c => c.mainChampion === '아리');
  assert.equal(gen.effectiveStats.laning, gen.stats.laning - 1);
  const feed = host.locator('[data-world-events]');
  assert((await feed.textContent()).includes('아리 시그니처 선수 전원'));assert((await feed.textContent()).includes('라인전 -1'));
  assert((await feed.textContent()).includes('13일 남음'));assert((await feed.textContent()).includes('실제 패치나 실존 선수 보도가 아닙니다'));
  assert(!/주사위|RNG|random\(\)|world-events:/i.test(await feed.textContent()));
  const targetDetails = feed.locator('details').first();
  if (!(await targetDetails.getAttribute('open') !== null)) await targetDetails.locator('summary').click();
  assert.equal(await targetDetails.locator('li').count(), event.targets.length);
  checks.push('A naturally rolled Ahri nerf records all matching home and opposing signature players; no forced-event API');
  await feed.scrollIntoViewIfNeeded();await host.screenshot({ path: path.join(root, 'test-results', 'world-events-desktop.png') });

  await action(host, 'nav', '[data-view="roster"]').click();await host.locator('.roster-cards').waitFor();
  const ownCard = host.locator('.player-card').filter({ hasText: '인트' });
  assert.equal(await ownCard.locator('.stat-line').filter({ hasText: '라인전' }).locator('strong').textContent(), '64');
  assert((await ownCard.locator('.world-player-effects').textContent()).includes('65 → 64'));
  const opponentCard = host.locator('.opponent-view').filter({ has: host.locator('h3', { hasText: 'Gen.G' }) });
  await opponentCard.locator('.world-opponent-effects .world-player-effects').waitFor();
  assert((await opponentCard.locator('.world-player-effects').textContent()).includes('아리 너프'));
  checks.push('Own and opponent roster show base-to-effective stats and duration; base growth remains intact');

  await request(peerContext, '/api/session');
  await request(peerContext, '/api/slots/0', { character: character('JGL', '동료', '리 신') }, 'PUT');
  await request(peerContext, '/api/rooms/join', { code, slot: 0 });
  await peerContext.addInitScript(code => localStorage.setItem('first-team.room', code), code);
  const peer = await peerContext.newPage();peer.on('pageerror', error => errors.push(error.message));
  await peer.goto('/');await peer.locator('[data-world-event]').first().waitFor();
  const peerRoom = (await request(peerContext, base)).room;
  assert.deepEqual(peerRoom.season.worldEvents, room.season.worldEvents);
  assert.equal(peerRoom.roster.find(c => c.id === mineId).effectiveStats.laning, 64);
  assert.equal(peerRoom.players.find(p => p.userId === peerRoom.me).character.effectiveStats.laning, 65);
  checks.push('A separate participant sees the identical league event and enemy effects, while an unrelated signature remains unchanged');

  const before = structuredClone(peerRoom.season.worldEvents), date = peerRoom.season.date, turn = peerRoom.season.turn;
  await request(hostContext, `${base}/location`, { location: '카페' });
  await request(hostContext, `${base}/chat`, { channel: 'owner', text: '소식 확인했어요' });
  await request(hostContext, `${base}/chat`, { channel: 'team', text: '라인전 연습은 다음 턴에 할게요.' });
  const after = (await request(hostContext, base)).room;
  assert.deepEqual(after.season.worldEvents, before);assert.equal(after.season.date, date);assert.equal(after.season.turn, turn);
  await host.reload();await host.locator('[data-world-event]').first().waitFor();
  assert.equal((await request(hostContext, base)).room.season.worldEvents.events[0].id, event.id);
  checks.push('Reload restores the same event; movement and both chat channels neither reroll it nor consume a turn');

  await host.setViewportSize({ width: 390, height: 844 });await fits(host);
  await host.locator('[data-world-events]').scrollIntoViewIfNeeded();await host.screenshot({ path: path.join(root, 'test-results', 'world-events-mobile.png') });
  await action(host, 'nav', '[data-view="roster"]').click();await host.locator('.roster-cards').waitFor();await fits(host);
  await host.locator('.world-opponent-effects').first().scrollIntoViewIfNeeded();await fits(host);
  checks.push('390px league feed, target disclosures, player stats and opponent event panels fit without horizontal overflow');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, browserErrors: errors.length }, null, 2));
} finally {
  await browser?.close();
  if (child.exitCode === null) { child.kill('SIGTERM');await once(child, 'exit'); }
  await rm(temp, { recursive: true, force: true });
}
