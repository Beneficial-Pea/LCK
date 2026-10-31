// Optional real-browser check. Install Playwright + Chromium separately when needed.
// BASE_URL=http://127.0.0.1:3000 node test/browser-smoke.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const baseURL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const output = new URL('../test-results/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const errors = [];
const checks = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const action = (name, extra = '') => page.locator(`[data-action="${name}"]${extra}`).filter({ visible: true }).first();
const nav = async view => { await action('nav', `[data-view="${view}"]`).click(); await page.waitForTimeout(120); };
const request = async (path, data, method = 'POST') => {
  const response = await context.request.fetch(path, { method, data });
  const body = await response.json();
  assert(response.ok(), `${path}: ${JSON.stringify(body)}`);
  return body;
};
const state = async () => (await context.request.get('/api/session')).json();
const getRoom = async code => (await context.request.get(`/api/rooms/${code}`)).json();
const assertFits = async label => {
  const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  assert(size.scroll <= size.width + 1, `${label} horizontal overflow: ${JSON.stringify(size)}`);
};

try {
  await page.goto('/');
  await page.locator('.welcome-hero').waitFor();
  checks.push('landing renders without a room');
  await page.screenshot({ path: new URL('welcome-desktop.png', output).pathname, fullPage: true });

  await action('edit-slot').click();
  const slotForm = page.locator('[data-form="slot"]');
  await slotForm.waitFor();
  await slotForm.locator('[name="name"]').fill('김테스트');
  await slotForm.locator('[name="nickname"]').fill('Replay');
  await slotForm.locator('[name="age"]').fill('22');
  await slotForm.locator('[name="position"]').selectOption('MID');
  await slotForm.locator('[name="mainChampion"]').fill('아리');
  await slotForm.locator('[name="pool"]').fill('아리, 아지르, 오리아나, 사일러스, 갈리오');
  await slotForm.locator('button[type="submit"]').click();
  await slotForm.waitFor({ state: 'detached' });
  assert.equal((await state()).slots[0].nickname, 'Replay');
  checks.push('character created and saved through UI');

  await action('open-create').click();
  const createForm = page.locator('[data-form="create-room"]');
  await createForm.waitFor();
  if (await createForm.locator('[name="year"]').count()) await createForm.locator('[name="year"]').selectOption('2025');
  if (await createForm.locator('[name="name"]').count()) await createForm.locator('[name="name"]').fill('브라우저 검증 시즌');
  if (await createForm.locator('[name="seed"]').count()) await createForm.locator('[name="seed"]').fill('browser-qa');
  await createForm.locator('button[type="submit"]').click();
  await createForm.waitFor({ state: 'detached' });
  await page.locator('.assembly-header').waitFor();
  await action('lobby-ready').click();
  await action('lobby-prepare').click();
  await action('choose-team', '[data-team="T1"]').click();
  await action('lobby-start').click();
  await page.locator('.season-strip').waitFor();
  let session = await state();
  const code = session.rooms[0].code;
  let room = (await getRoom(code)).room;
  assert.equal(room.players.length, 1);
  assert.equal(room.roster.length, 5);
  checks.push('room created with four NPC roster positions');

  await action('choose-action', '[data-id="analysis"]').click();
  await action('submit-action').click();
  await page.waitForFunction(() => document.querySelector('[data-action="settle"]') && !document.querySelector('[data-action="settle"]').disabled);
  await action('settle').click();
  await page.waitForFunction(() => document.querySelector('.strip-value')?.textContent?.includes('2025.01.14'));
  room = (await getRoom(code)).room;
  assert.equal(room.season.turn, 2);
  checks.push('action submission and settlement advance exactly one day');

  // Reach the first own match by the same public API used by the client; the UI
  // itself is used to settle that game and read its progressive replay.
  const own = m => [m.teamA, m.teamB].includes(room.season.team);
  for (let attempts = 0; attempts < 12; attempts++) {
    room = (await getRoom(code)).room;
    if (room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && own(m))) break;
    await request(`/api/rooms/${code}/auto`, { turn: room.season.turn, action: 'analysis' });
  }
  room = (await getRoom(code)).room;
  assert(room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && own(m)), 'first own game reached');
  await page.reload();
  await page.locator('.season-strip').waitFor();
  await action('submit-action').click();
  await page.waitForFunction(() => !document.querySelector('[data-action="settle"]')?.disabled);
  const settled = page.waitForResponse(response => response.url().endsWith('/settle') && response.status() === 200);
  await action('settle').click(); await settled;
  room = (await getRoom(code)).room;
  const broadcastDeadline = Date.now() + 240000;
  while (room.broadcast && Date.now() < broadcastDeadline) {
    await page.waitForTimeout(300);
    room = (await getRoom(code)).room;
  }
  assert(!room.broadcast, 'The shared live broadcast must finish before archived replay is checked');
  const match = room.season.results.find(m => own(m));
  assert(match?.result.sets[0].events.some(e => e.type === 'first_blood'));
  await nav('match');
  await action('select-set', '[data-index="0"]').click();
  await page.locator('.match-event').first().waitFor();
  const initialCount = await page.locator('.match-event').count();
  await action('event-next').click();
  assert.equal(await page.locator('.match-event').count(), initialCount + 1);
  await action('all-events').click();
  await page.locator('.scoreboard').waitFor();
  assert((await page.locator('.event-list').textContent()).includes('퍼스트 킬'));
  assert((await page.locator('.reaction-list').textContent()).includes('퍼블'));
  assert.equal(await page.locator('.scoreboard tbody tr').count(), 10);
  checks.push('game settled; replay advances scenes, first blood and matching reactions; ten KDA rows');
  await page.screenshot({ path: new URL('match-desktop.png', output).pathname, fullPage: true });

  await nav('calendar');
  await page.locator('.calendar-grid').waitFor();
  await action('select-date', `[data-date="${match.date}"]`).click();
  assert((await page.locator('.day-detail').textContent()).includes('정산 완료'));
  await action('calendar-next').click();
  await action('calendar-today').click();
  checks.push('calendar date detail and month navigation');

  await nav('chat');
  await page.locator('[data-form="chat"] [name="text"]').fill('브라우저 검증 팀 메시지');
  await page.locator('[data-form="chat"] button[type="submit"]').click();
  await page.getByText('브라우저 검증 팀 메시지', { exact: true }).waitFor();
  await nav('owner');
  assert.equal(await page.getByText('브라우저 검증 팀 메시지', { exact: true }).count(), 0);
  await page.locator('[data-form="chat"] [name="text"]').fill('오너 일정 조율 메시지');
  await page.locator('[data-form="chat"] button[type="submit"]').click();
  await page.getByText('오너 일정 조율 메시지', { exact: true }).waitFor();
  checks.push('team and owner chat are distinct');

  await page.reload(); await page.locator('.season-strip').waitFor();
  assert.equal((await getRoom(code)).room.season.turn, room.season.turn);
  checks.push('refresh restores the saved room and date');

  const friend = await browser.newContext({ viewport: { width: 1280, height: 900 }, baseURL });
  try {
    await friend.request.get('/api/session');
    const slotResponse = await friend.request.put('/api/slots/0', { data: { character: { name: '이정글', nickname: 'Pathfinder', age: 23, team: 'T1', position: 'JGL', mainChampion: '리 신', pool: ['리 신', '바이', '비에고'], style: '초반 주도권' } } });
    assert(slotResponse.ok());
    assert((await friend.request.post('/api/rooms/join', { data: { code, slot: 0 } })).ok());
    await friend.addInitScript(code => localStorage.setItem('first-team.room', code), code);
    const peer = await friend.newPage();
    peer.on('pageerror', error => errors.push(error.message));
    await peer.goto('/'); await peer.locator('.season-strip').waitFor();
    await nav('home');
    await page.waitForFunction(() => document.querySelectorAll('.submit-chip').length === 2);
    await action('submit-action').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.submit-chip')].some(c => c.classList.contains('done')));
    assert(await action('settle').isDisabled(), 'host waits for second player');
    await peer.locator('[data-action="choose-action"][data-id="rest"]').click();
    await peer.locator('[data-action="submit-action"]').click();
    await page.waitForFunction(() => !document.querySelector('[data-action="settle"]').disabled);
    const priorTurn = (await getRoom(code)).room.season.turn;
    const settleResponse = page.waitForResponse(response => response.url().endsWith('/settle') && response.status() === 200);
    await action('settle').click(); await settleResponse;
    room = (await getRoom(code)).room;
    assert.equal(room.season.turn, priorTurn + 1);
    await peer.waitForFunction(date => document.querySelector('.strip-value')?.textContent?.includes(date.replaceAll('-', '.')), room.season.date);
    const peerRoom = (await (await friend.request.get(`/api/rooms/${code}`)).json()).room;
    assert.equal(peerRoom.season.date, room.season.date);
    assert.deepEqual(peerRoom.season.results, room.season.results);
    checks.push('two isolated browser users submit own actions, wait, settle and see identical date/results');
  } finally { await friend.close(); }

  await assertFits('desktop home');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['home', 'match', 'calendar', 'roster', 'dorm', 'chat']) {
    await nav(view); await assertFits(`mobile ${view}`);
  }
  await nav('home');
  await page.screenshot({ path: new URL('home-mobile.png', output).pathname, fullPage: true });
  checks.push('390px mobile screens fit without horizontal page overflow');
  assert.deepEqual(errors, [], 'browser JS errors');
  console.log(JSON.stringify({ status: 'passed', code, checks, browserErrors: errors, screenshots: output.pathname }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
