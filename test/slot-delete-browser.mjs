import { authenticatedBrowserContext } from './helpers/accounts.mjs';
// Optional browser QA for explicit private-slot deletion and active-season isolation.
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
const temp = await mkdtemp(path.join(tmpdir(), 'first-team-slot-delete-'));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', DATA_FILE: path.join(temp, 'game.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser;
const checks = [], errors = [];
const action = (page, name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({ visible: true }).first();
const fits = async page => { const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));assert(size.scroll <= size.width + 1, `Horizontal overflow ${JSON.stringify(size)}`); };
try {
  const baseURL = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk;const port = output.match(/listening on port (\d+)/)?.[1];if (port) { clearTimeout(timer);resolve(`http://127.0.0.1:${port}`); } });
    child.stderr.on('data', chunk => { output += chunk; });child.once('error', reject);child.once('exit', code => { clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await authenticatedBrowserContext(browser,{ viewport: { width: 1440, height: 1000 }, baseURL });
  const request = async (route, data, method = data ? 'POST' : 'GET') => { const response = await context.request.fetch(route, { method, ...(data ? { data } : {}) });const body = await response.json();assert(response.ok(), `${route}: ${JSON.stringify(body)}`);return body; };
  const avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Xn1cAAAAASUVORK5CYII=';
  const character = nickname => ({ name: nickname, nickname, age: 20, position: 'MID', mainChampion: '아리', pool: ['아리', '아지르'], avatar, avatarSource: avatar, avatarCrop: { x: .3, y: .6, zoom: 2 } });
  await request('/api/session');await request('/api/slots/0', { character: character('DeleteDraft') }, 'PUT');
  const initial = await request('/api/session');assert.equal(initial.slots[0].team, null);
  const page = await context.newPage();page.on('pageerror', error => errors.push(error.message));await page.goto('/');await page.locator('.welcome-hero').waitFor();
  await action(page, 'nav', '[data-view="slots"]').click();
  await action(page, 'delete-slot', '[data-index="0"]').click();let form = page.locator('[data-form="delete-slot"]');await form.waitFor();
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-delete-cancel'));
  await form.locator('[data-delete-cancel]').click();await form.waitFor({ state: 'detached' });
  assert.deepEqual((await request('/api/session')).slots, initial.slots);assert.equal((await request('/api/session')).rooms.length, 0);
  await action(page, 'delete-slot', '[data-index="0"]').click();await page.locator('[data-form="delete-slot"]').waitFor();await page.keyboard.press('Escape');
  await page.locator('[data-form="delete-slot"]').waitFor({ state: 'detached' });assert.deepEqual((await request('/api/session')).slots, initial.slots);
  checks.push('Deleting requires an explicit confirmation; initial focus is Cancel and both Cancel and Escape preserve the private character and photo');

  await action(page, 'delete-slot', '[data-index="0"]').click();form = page.locator('[data-form="delete-slot"]');await form.waitFor();
  assert((await form.locator('[type="submit"]').textContent()).includes('삭제'));
  const deleted = page.waitForResponse(r => r.url().endsWith('/api/slots/0') && r.request().method() === 'DELETE' && r.status() === 200);
  await form.locator('[type="submit"]').click();await deleted;await form.waitFor({ state: 'detached' });
  assert.equal((await request('/api/session')).slots[0], null);assert.equal(await page.locator('[data-action="delete-slot"]').count(), 0);
  await page.reload();await page.locator('.welcome-hero').waitFor();await action(page, 'nav', '[data-view="slots"]').click();
  assert.equal((await request('/api/session')).slots[0], null);assert.equal(await page.locator('[data-action="delete-slot"]').count(), 0);
  checks.push('Confirm removes only the selected private slot, persists across reload and leaves no Delete button on an empty slot');

  await request('/api/slots/0', { character: character('ActiveHero') }, 'PUT');
  let { room } = await request('/api/rooms', { slot: 0, year: 2025, seed: 'slot-delete-active' });
  const route = `/api/rooms/${room.code}`;await request(`${route}/action`, { turn: room.season.turn, action: 'analysis' });
  ({ room } = await request(route));const before = structuredClone(room);
  await page.evaluate(code => localStorage.setItem('first-team.room', code), room.code);await page.reload();await page.locator('.season-strip').waitFor();
  await action(page, 'nav', '[data-view="slots"]').click();await action(page, 'delete-slot', '[data-index="0"]').click();form = page.locator('[data-form="delete-slot"]');await form.waitFor();
  assert((await form.textContent()).includes('시즌'));
  await page.setViewportSize({ width: 390, height: 844 });await fits(page);
  await page.screenshot({ path: path.join(root, 'test-results', 'slot-delete-mobile.png'), fullPage: true, animations: 'disabled' });
  await form.locator('[type="submit"]').click();await form.waitFor({ state: 'detached' });
  assert.equal((await request('/api/session')).slots[0], null);
  const after = (await request(route)).room;
  assert.deepEqual(after.players, before.players);assert.deepEqual(after.season, before.season);assert.deepEqual(after.submissions, before.submissions);
  assert.equal(after.revision, before.revision);assert.equal(after.players[0].character.avatar, avatar);
  await action(page, 'nav', '[data-view="home"]').click();await page.locator('.season-strip').waitFor();await fits(page);
  assert((await page.locator('.own-player-label').textContent()).includes('ActiveHero'));
  checks.push('Deleting a copied slot during a season preserves the active player, portrait, stats, submitted action, date and all season state; mobile confirmation and return-to-game work');
  assert.deepEqual(errors, []);console.log(JSON.stringify({ checks, browserErrors: errors.length }, null, 2));
} finally {
  await browser?.close();if (child.exitCode === null) { child.kill('SIGTERM');await once(child, 'exit'); }await rm(temp, { recursive: true, force: true });
}
