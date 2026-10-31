import { authenticatedBrowserContext } from './helpers/accounts.mjs';
// Optional end-to-end browser QA. Uses an isolated server and temporary SQLite.
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
const testYear = process.env.TEST_YEAR || '2026';
const temp = await mkdtemp(path.join(tmpdir(), 'first-team-lobby-scene-'));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', DATA_FILE: path.join(temp, 'game.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '', browser;
const checks = [], errors = [];
const action = (page, name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({ visible: true }).first();
const nav = (page, view) => action(page, 'nav', `[data-view="${view}"]`).click();
const fits = async page => {
  const d = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(d.scroll <= d.width + 1, `Horizontal overflow: ${JSON.stringify(d)}`);
};
try {
  const baseURL = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10000);
    server.stdout.on('data', chunk => {
      output += chunk;const port = output.match(/listening on port (\d+)/)?.[1];
      if (port) { clearTimeout(timer);resolve(`http://127.0.0.1:${port}`); }
    });
    server.stderr.on('data', chunk => { output += chunk; });
    server.once('error', reject);
    server.once('exit', code => { clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const contexts = [], pages = [];
  for (let i = 0; i < 2; i++) {
    const context = await authenticatedBrowserContext(browser,{ viewport: { width: 1440, height: 1000 }, baseURL });
    const page = await context.newPage();page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');await page.locator('.welcome-hero').waitFor();
    contexts.push(context);pages.push(page);
  }
  const [host, peer] = pages;
  const sessions = async () => Promise.all(contexts.map(async c => (await c.request.get('/api/session')).json()));
  const roomFor = async (i, code) => (await (await contexts[i].request.get(`/api/rooms/${code}`)).json()).room;
  const png = Buffer.from(await host.evaluate(() => {
    const c = document.createElement('canvas');c.width = c.height = 300;
    const g = c.getContext('2d');g.fillStyle = '#96d648';g.fillRect(0,0,300,300);g.fillStyle = '#416486';g.fillRect(70,40,160,230);
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  for (let i = 0; i < 2; i++) {
    const p = pages[i];await action(p, 'edit-slot').click();const form = p.locator('[data-form="slot"]');
    assert.equal(await form.locator('[name="team"]').count(), 0, 'Character registration has no premature team selector');
    await form.locator('[name="name"]').fill(i ? '이동친구' : '김준비');
    await form.locator('[name="nickname"]').fill(i ? 'Walker' : 'Ready');
    await form.locator('[name="position"]').selectOption(i ? 'JGL' : 'MID');
    if (i === 0) {
      await form.locator('[data-portrait-file]').setInputFiles({ name: 'ready.png', mimeType: 'image/png', buffer: png });
      await p.waitForFunction(() => !document.querySelector('#modal-root [type=submit]')?.disabled);
      await p.locator('#portrait-preview img').waitFor();
    }
    await form.locator('[type="submit"]').click();await form.waitFor({ state: 'detached' });
  }
  const initial = await sessions(), ids = initial.map(s => s.user.id), avatar = initial[0].slots[0].avatar;
  assert.equal(initial[0].slots[0].team, null);assert.equal(initial[1].slots[0].team, null);assert(avatar);
  checks.push('Two independent browser users register teamless characters; own photo stored');

  await action(host, 'open-create').click();let form = host.locator('[data-form="create-room"]');
  assert.equal(await form.locator('[name=year]').inputValue(),'2026');
  await form.locator('[name="name"]').fill('준비와 픽셀 이동 검증');
  await form.locator('[type="submit"]').click();await form.waitFor({ state: 'detached' });
  await host.locator('.assembly-header').waitFor();
  const code = (await sessions())[0].rooms[0].code;
  await action(peer, 'open-join').click();form = peer.locator('[data-form="join-room"]');
  await form.locator('[name="code"]').fill(code);await form.locator('[type="submit"]').click();await form.waitFor({ state: 'detached' });
  await peer.locator('.assembly-header').waitFor();
  await host.waitForFunction(() => document.querySelector('.assembly-header')?.textContent.includes('2/5명'));
  let room = await roomFor(0, code);const date = room.season.date, turn = room.season.turn;
  if (testYear === '2026') { assert.equal(room.season.year, 2026);assert.equal(date, '2026-01-12');assert.equal(room.season.totalTurns, 308); }
  assert.equal(room.lobby.status, 'waiting');assert.equal(room.season.team, null);
  assert.equal(await host.locator('[data-action="submit-action"]').count(), 0);
  assert.equal((await contexts[0].request.post(`/api/rooms/${code}/action`, { data: { turn, action: 'rest' } })).status(), 409);
  assert.equal((await contexts[0].request.post(`/api/rooms/${code}/prepare`, { data: {} })).status(), 409);
  assert.equal((await contexts[1].request.post(`/api/rooms/${code}/team`, { data: { team: 'T1' } })).status(), 403);
  for(const p of [host,peer]){await p.locator('[data-owner-toggle]').click();await p.locator('[data-dock-channel=owner]').click();}
  await host.locator('[data-form="owner-dock"] [name="text"]').fill('모두 준비하면 출발해요');
  await host.locator('[data-form="owner-dock"] [type="submit"]').click();
  await peer.getByText('모두 준비하면 출발해요', { exact: true }).waitFor();
  for(const p of [host,peer])await p.locator('[data-owner-toggle]').click();
  checks.push('Real shared waiting room blocks gameplay/early prepare; owner chat synchronizes');

  await action(host, 'lobby-ready').click();await action(peer, 'lobby-ready').click();
  await host.waitForFunction(() => !document.querySelector('[data-action="lobby-prepare"]')?.disabled);
  await host.setViewportSize({ width: 390, height: 844 });await fits(host);
  await host.screenshot({ path: path.join(root, 'test-results', 'lobby-mobile.png'), fullPage: true });
  await action(host, 'lobby-prepare').click();await host.locator('.team-selection-grid').waitFor();
  await peer.locator('.team-selection-grid').waitFor();
  assert.equal(await host.locator('.team-choice').count(), 10);
  assert((await host.locator('.team-choice p').first().textContent()).length > 10);
  assert.equal(await peer.locator('.team-choice:not(:disabled)').count(), 0);
  assert.equal(await peer.locator('[data-action="lobby-start"]').count(), 0);
  await fits(host);
  await host.screenshot({ path: path.join(root, 'test-results', 'team-selection-mobile.png'), fullPage: true });
  await action(host, 'choose-team', '[data-team="Gen.G"]').click();
  room = await roomFor(0, code);
  assert.equal(room.lobby.selectedTeam, 'Gen.G');
  assert(room.players.every(p => p.character.team === 'Gen.G'));
  assert.equal(room.players[0].character.avatar, avatar);
  assert.equal(room.season.date, date);assert.equal(room.season.turn, turn);
  await action(host, 'lobby-start').click();await host.locator('.season-strip').waitFor();await peer.locator('.season-strip').waitFor();
  room = await roomFor(0, code);assert.equal(room.lobby.status, 'started');
  assert.equal(room.season.team, 'Gen.G');assert.equal(room.season.date, date);assert.equal(room.season.turn, turn);
  assert.equal((await sessions())[0].slots[0].team, null, 'Season team selection does not rewrite character slot');
  checks.push('All-ready → host-only described team selection → synchronized start; photo and slots preserved');

  await host.setViewportSize({ width: 1440, height: 1000 });
  await nav(host, 'dorm');await nav(peer, 'dorm');
  await host.locator('[data-scene="연습실"]').waitFor();
  assert.equal(await host.locator('.scene-character[data-user-id]').count(), 2);
  const practiceArt = await host.locator('.scene-background').innerHTML();
  await host.locator(`.scene-character[data-user-id="${ids[0]}"]`).click();
  await host.locator('#dialog-title').filter({ hasText: 'Ready' }).waitFor();
  assert.equal(await host.locator('.modal img[alt="Ready 프로필 사진"]').getAttribute('src'), avatar);
  await action(host, 'close-modal').click();
  await action(host, 'move', '[data-location="카페"]').click();await host.locator('[data-scene="카페"]').waitFor();
  assert.notEqual(await host.locator('.scene-background').innerHTML(), practiceArt);
  assert.equal(await host.locator('.scene-character[data-user-id]').count(), 1);
  await peer.waitForFunction(id => !document.querySelector(`.scene-character[data-user-id="${id}"]`), ids[0]);
  await action(peer, 'move', '[data-location="카페"]').click();await peer.locator('[data-scene="카페"]').waitFor();
  await host.waitForFunction(() => document.querySelectorAll('.scene-character[data-user-id]').length === 2);
  checks.push('Distinct venue artwork; players appear only in their real shared location; sprite opens original profile photo');

  const initialPosition = await host.locator(`.scene-character[data-user-id="${ids[0]}"]`).evaluate(e => ({ x: parseFloat(e.style.getPropertyValue('--scene-x')), y: parseFloat(e.style.getPropertyValue('--scene-y')) }));
  const expectedPosition = { x: initialPosition.x + 3, y: initialPosition.y + 2, location: '카페' };
  const floor = host.locator('[data-scene-floor]');await floor.focus();
  const moved = host.waitForResponse(r => r.url().endsWith(`/api/rooms/${code}/move`) && r.status() === 200);
  await floor.press('d');await floor.press('s');await moved;
  room = await roomFor(0, code);const position = room.players.find(p => p.userId === ids[0]).scenePosition;
  assert.deepEqual(position, expectedPosition);
  assert.equal(room.season.date, date);assert.equal(room.season.turn, turn);
  assert.equal(room.players[0].character.avatar, avatar);
  await peer.waitForFunction(({ id, x }) => document.querySelector(`.scene-character[data-user-id="${id}"]`)?.style.getPropertyValue('--scene-x') === `${x}%`, { id: ids[0], x: expectedPosition.x });
  await host.reload();await host.locator('.season-strip').waitFor();await nav(host, 'dorm');
  await host.locator('[data-scene="카페"]').waitFor();
  assert.equal(await host.locator(`.scene-character[data-user-id="${ids[0]}"]`).evaluate(e => e.style.getPropertyValue('--scene-x')), `${expectedPosition.x}%`);
  checks.push('Focused WASD walking saves coordinates, synchronizes peer, survives reload, and consumes no turn');

  await host.setViewportSize({ width: 390, height: 844 });await fits(host);
  await host.locator('[data-scene-floor]').scrollIntoViewIfNeeded();await host.waitForTimeout(250);
  await host.screenshot({ path: path.join(root, 'test-results', 'scene-mobile.png') });
  await host.locator(`.scene-character[data-user-id="${ids[0]}"]`).click();await fits(host);
  await action(host, 'close-modal').click();
  checks.push('390px scene and player-profile screens fit without horizontal overflow');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, browserErrors: errors.length }, null, 2));
} finally {
  await browser?.close();
  if (server.exitCode === null) { server.kill('SIGTERM');await once(server, 'exit'); }
  await rm(temp, { recursive: true, force: true });
}
