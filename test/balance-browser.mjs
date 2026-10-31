import { authenticatedBrowserContext } from './helpers/accounts.mjs';
// Optional real-browser QA for NPC team presets and explicit legacy recalibration.
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
const temp = await mkdtemp(path.join(tmpdir(), 'first-team-balance-browser-'));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const child = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', DATA_FILE: path.join(temp, 'game.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '', browser;
const checks = [], errors = [];
const action = (page, name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({ visible: true }).first();
const fits = async page => { const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })); assert(size.scroll <= size.width + 1, `Horizontal overflow ${JSON.stringify(size)}`); };
try {
  const baseURL = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk;const port = output.match(/listening on port (\d+)/)?.[1];if (port) { clearTimeout(timer);resolve(`http://127.0.0.1:${port}`); } });
    child.stderr.on('data', chunk => { output += chunk; });child.once('error', reject);child.once('exit', code => { clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await authenticatedBrowserContext(browser,{ viewport: { width: 1440, height: 1000 }, baseURL });
  const request = async (ctx, route, data, method = data ? 'POST' : 'GET') => { const response = await ctx.request.fetch(route, { method, ...(data ? { data } : {}) });const body = await response.json();assert(response.ok(), `${route}: ${JSON.stringify(body)}`);return body; };
  const character = nickname => ({ name: nickname, nickname, age: 20, position: 'MID', mainChampion: '아리', pool: ['아리', '아지르', '오리아나'], style: '균형 운영' });
  await request(context, '/api/session');await request(context, '/api/slots/0', { character: character('SettingHero') }, 'PUT');
  const page = await context.newPage();page.on('pageerror', error => errors.push(error.message));await page.goto('/');await page.locator('.welcome-hero').waitFor();

  await action(page, 'open-create').click();let form = page.locator('[data-form="create-room"]');
  const mode = form.locator('[name="npcPowerMode"]'), power = form.locator('[name="npcPower"]');
  assert.equal(await mode.inputValue(), 'team');assert(await power.isDisabled());
  await mode.selectOption('custom');assert(await power.isEnabled());await power.fill('70');
  await page.setViewportSize({ width: 390, height: 844 });await fits(page);
  await page.screenshot({ path: path.join(root, 'test-results', 'balance-create-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const customResponse = page.waitForResponse(r => r.url() === baseURL + '/api/rooms' && r.request().method() === 'POST');
  await form.locator('[type="submit"]').click();const custom = (await (await customResponse).json()).room;await form.waitFor({ state: 'detached' });
  assert.equal(custom.season.npcPower, 70);assert.equal(custom.lobby.settings.npcPowerMode, 'custom');
  await page.locator('.assembly-header').waitFor();
  checks.push('New room defaults to team-preset mode; custom mode enables a mobile-safe numeric input and submits the chosen value');

  // Open a separate new room in the UI, leaving the first room and its setting intact.
  await action(page, 'open-create').click();form = page.locator('[data-form="create-room"]');
  assert.equal(await form.locator('[name="npcPowerMode"]').inputValue(), 'team');assert(await form.locator('[name="npcPower"]').isDisabled());
  const teamResponse = page.waitForResponse(r => r.url() === baseURL + '/api/rooms' && r.request().method() === 'POST');
  await form.locator('[type="submit"]').click();let preset = (await (await teamResponse).json()).room;await form.waitFor({ state: 'detached' });
  const presetRoute = `/api/rooms/${preset.code}`;
  await page.locator('.assembly-header').waitFor();await action(page, 'lobby-ready').click();await action(page, 'lobby-prepare').click();
  await action(page, 'choose-team', '[data-team="Gen.G"]').click();await action(page, 'lobby-start').click();
  await page.locator('.season-strip').waitFor();({ room: preset } = await request(context, presetRoute));
  assert.equal(preset.season.team, 'Gen.G');assert.equal(preset.season.npcPower, 90);assert.equal(preset.balance.npcPowerMode, 'team');
  assert.equal(preset.players[0].character.stats.laning, 65);assert.equal(preset.roster.filter(c => c.npc).length, 4);
  const customSaved = (await request(context, `/api/rooms/${custom.code}`)).room;
  assert.equal(customSaved.season.npcPower, 70);assert.equal(customSaved.lobby.settings.npcPowerMode, 'custom');
  checks.push('Selecting Gen.G applies NPC power 90 in team mode, leaves the human at 65 and does not overwrite a separate custom-70 room');

  const legacyContext = await authenticatedBrowserContext(browser,{ viewport: { width: 1440, height: 1000 }, baseURL });
  await request(legacyContext, '/api/session');await request(legacyContext, '/api/slots/0', { character: { ...character('LegacyHero'), team: 'Gen.G' } }, 'PUT');
  let { room: legacy } = await request(legacyContext, '/api/rooms', { slot: 0, year: 2025, seed: 'balance-browser', npcPower: 65, npcPowerMode: 'custom' });
  const legacyRoute = `/api/rooms/${legacy.code}`;
  for (let i = 0; i < 15; i++) {
    ({ room: legacy } = await request(legacyContext, legacyRoute));
    if (legacy.season.schedule.some(m => m.date === legacy.season.date && m.status === 'scheduled' && [m.teamA, m.teamB].includes('Gen.G'))) break;
    await request(legacyContext, `${legacyRoute}/auto`, { turn: legacy.season.turn, action: 'rest' });
  }
  await request(legacyContext, `${legacyRoute}/action`, { turn: legacy.season.turn, action: 'rest' });
  ({ room: legacy } = await request(legacyContext, `${legacyRoute}/settle`, { turn: legacy.season.turn }));
  assert(legacy.season.results.length > 0);assert.equal(legacy.balance.npcPower, 65);assert.equal(legacy.balance.teamNpcPower, 90);assert.equal(legacy.balance.canRecalibrate, true);
  const before = structuredClone(legacy);
  await legacyContext.addInitScript(code => localStorage.setItem('first-team.room', code), legacy.code);
  const oldPage = await legacyContext.newPage();oldPage.on('pageerror', error => errors.push(error.message));await oldPage.goto('/');await oldPage.locator('.season-strip').waitFor();
  await action(oldPage, 'nav', '[data-view="lobby"]').click();await oldPage.locator('[data-balance-check]').waitFor();
  assert((await oldPage.locator('[data-balance-check]').textContent()).includes('65'));
  await action(oldPage, 'review-balance').click();const balanceForm = oldPage.locator('[data-form="balance"]');await balanceForm.waitFor();
  const label = await balanceForm.locator('.balance-change').textContent();assert(label.includes('65') && label.includes('90'));
  await oldPage.setViewportSize({ width: 390, height: 844 });await fits(oldPage);
  await oldPage.screenshot({ path: path.join(root, 'test-results', 'balance-mobile.png'), fullPage: true });
  const adjusted = oldPage.waitForResponse(r => r.url().endsWith('/balance') && r.status() === 200);
  await balanceForm.locator('[type="submit"]').click();const after = (await (await adjusted).json()).room;
  assert.equal(after.season.npcPower, 90);assert.equal(after.balance.npcPowerMode, 'team');assert.equal(after.balance.canRecalibrate, false);
  assert.equal(after.season.date, before.season.date);assert.equal(after.season.turn, before.season.turn);assert.deepEqual(after.season.results, before.season.results);
  const mineBefore = before.players.find(p => p.userId === before.me).character, mineAfter = after.players.find(p => p.userId === after.me).character;
  for (const key of ['id', 'stats', 'condition', 'fatigue', 'stress']) assert.deepEqual(mineAfter[key], mineBefore[key]);
  await balanceForm.waitFor({ state: 'detached' });await fits(oldPage);
  assert(await oldPage.locator('[data-action="review-balance"]').isDisabled());
  checks.push('An explicit host review changes legacy NPC 65→90 while preserving human abilities, date, turn and historical match results; report and confirmation fit 390px');
  assert.deepEqual(errors, []);console.log(JSON.stringify({ checks, browserErrors: errors.length }, null, 2));
} finally {
  await browser?.close();if (child.exitCode === null) { child.kill('SIGTERM');await once(child, 'exit'); }await rm(temp, { recursive: true, force: true });
}
