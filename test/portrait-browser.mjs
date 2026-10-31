// Optional browser QA: requires Playwright and a Chromium executable.
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
const temp = await mkdtemp(path.join(tmpdir(), 'first-team-portrait-browser-'));
await mkdir(path.join(root, 'test-results'), { recursive: true });
const child = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', DATA_FILE: path.join(temp, 'game.sqlite') },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '', browser;
const checks = [], errors = [];
try {
  const baseURL = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const port = output.match(/listening on port (\d+)/)?.[1];
      if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, baseURL });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const button = (action, scope = page) => scope.locator(`[data-action="${action}"]`).filter({ visible: true }).first();
  const nav = async view => { await page.locator(`[data-action="nav"][data-view="${view}"]`).filter({ visible: true }).first().click(); };
  const session = async () => (await context.request.get('/api/session')).json();
  const fetchRoom = async code => (await context.request.get(`/api/rooms/${code}`)).json();
  const upload = async (form, buffer, filename = 'portrait.png', mimeType = 'image/png') => {
    await form.locator('[data-portrait-file]').setInputFiles({ name: filename, mimeType, buffer });
    await page.waitForFunction(() => !document.querySelector('#modal-root [type=submit]')?.disabled);
  };
  const save = async form => { await form.locator('[type=submit]').click(); await form.waitFor({ state: 'detached' }); };
  const fits = async () => {
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
    assert(dimensions.scroll <= dimensions.width + 1, `Horizontal overflow: ${JSON.stringify(dimensions)}`);
  };

  await page.goto('/');
  await page.locator('.welcome-hero').waitFor();
  const image = async color => Buffer.from(await page.evaluate(color => {
    const canvas = document.createElement('canvas');canvas.width = 1000;canvas.height = 500;
    const c = canvas.getContext('2d');c.fillStyle = color;c.fillRect(0,0,1000,500);c.fillStyle = '#b7ef61';c.fillRect(320,70,360,360);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color), 'base64');
  const blue = await image('#325ba8'), red = await image('#a82d52');

  await button('edit-slot').click();
  let form = page.locator('[data-form="slot"]');
  await form.locator('[name=name]').fill('김사진');
  await form.locator('[name=nickname]').fill('Portrait');
  await form.locator('[name=age]').fill('22');
  await form.locator('[name=position]').selectOption('MID');
  await upload(form, blue);
  await page.locator('#portrait-preview img').waitFor();
  assert.equal(await form.locator('[name=nickname]').inputValue(), 'Portrait', 'Upload keeps typed character fields');
  const preview = await page.locator('#portrait-preview img').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight, src: img.src }));
  assert.equal(preview.width, 256);assert.equal(preview.height, 256);
  assert(Buffer.from(preview.src.split(',')[1], 'base64').length <= 64 * 1024);
  await save(form);
  let me = await session();
  const savedPhoto = me.slots[0].avatar;
  assert.equal(savedPhoto, preview.src);
  await page.locator('img[alt="Portrait 프로필 사진"]').first().waitFor();
  checks.push('PNG upload crops to256 square, compresses, preserves typed fields, persists in slot');

  await button('open-create').click();
  form = page.locator('[data-form="create-room"]');
  assert.equal(await form.locator('[name=year]').inputValue(),'2026');
  await form.locator('[name=name]').fill('사진 브라우저 검증');
  await save(form);
  await page.locator('.assembly-header').waitFor();
  await button('lobby-ready').click();
  await button('lobby-prepare').click();
  await page.locator('[data-action="choose-team"][data-team="T1"]').click();
  await button('lobby-start').click();
  await page.locator('.season-strip').waitFor();
  me = await session();const code = me.rooms[0].code;
  let room = (await fetchRoom(code)).room;
  assert.equal(room.players[0].character.avatar, savedPhoto);
  await nav('roster');
  await page.locator('.player-card img[alt="Portrait 프로필 사진"]').waitFor();
  const original = structuredClone(room.players[0].character), originalDate = room.season.date, originalTurn = room.season.turn;
  await button('edit-portrait').click();form = page.locator('[data-form="portrait"]');
  await upload(form, red);await page.locator('#portrait-preview img').waitFor();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(root, 'test-results', 'portrait-editor-desktop.png') });
  await save(form);
  room = (await fetchRoom(code)).room;
  const newPhoto = room.players[0].character.avatar;
  assert.notEqual(newPhoto, savedPhoto);
  assert.deepEqual({ ...room.players[0].character, avatar: original.avatar, avatarSource: original.avatarSource, avatarCrop: original.avatarCrop }, original);
  assert.equal(room.season.date, originalDate);assert.equal(room.season.turn, originalTurn);
  assert.equal((await session()).slots[0].avatar, savedPhoto);
  checks.push('Active photo-only edit preserves identity/stats/date/turn and leaves separate slot untouched');

  await page.reload();await page.locator('.season-strip').waitFor();await nav('roster');
  assert.equal(await page.locator('.player-card img[alt="Portrait 프로필 사진"]').getAttribute('src'), newPhoto);
  checks.push('Reload restores the active room photo');

  const peerContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, baseURL });
  await peerContext.request.get('/api/session');
  assert((await peerContext.request.put('/api/slots/0', { data: { character: { name: '이친구', nickname: 'NoPhoto', age: 20, team: 'T1', position: 'JGL', mainChampion: '리 신', pool: ['리 신', '바이'], style: '균형 운영' } } })).ok());
  assert((await peerContext.request.post('/api/rooms/join', { data: { code, slot: 0 } })).ok());
  const peerRoom = (await (await peerContext.request.get(`/api/rooms/${code}`)).json()).room;
  assert.equal(peerRoom.players[0].character.avatar, newPhoto);
  assert.equal(peerRoom.players[1].character.avatar, null);
  await peerContext.addInitScript(code => localStorage.setItem('first-team.room', code), code);
  const peer = await peerContext.newPage();peer.on('pageerror', e => errors.push(e.message));
  await peer.goto('/');await peer.locator('.season-strip').waitFor();
  await peer.locator('[data-action="nav"][data-view="roster"]').filter({ visible: true }).first().click();
  assert.equal(await peer.locator('.player-card img[alt="Portrait 프로필 사진"]').getAttribute('src'), newPhoto);
  await peer.locator('[aria-label="NoPhoto 기본 프로필"]').first().waitFor();
  checks.push('Second browser sees shared photo; legacy/no-photo player safely uses initials');

  await button('edit-portrait').click();form = page.locator('[data-form="portrait"]');
  await upload(form, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'bad.svg', 'image/svg+xml');
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('PNG, JPG, WebP'));
  assert.equal(await page.locator('#portrait-preview img').getAttribute('src'), newPhoto);
  await upload(form, Buffer.from('not an image'), 'broken.png', 'image/png');
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('사진을 열지 못했습니다'));
  assert.equal(await page.locator('#portrait-preview img').getAttribute('src'), newPhoto);
  checks.push('SVG and corrupt PNG are rejected without replacing existing photo');
  await button('remove-portrait', form).click();
  await page.locator('#portrait-preview .portrait-fallback').waitFor();
  await save(form);
  room = (await fetchRoom(code)).room;
  assert.equal(room.players[0].character.avatar, null);
  assert.equal(room.players[1].character.avatar, null);
  await page.locator('.player-card [aria-label="Portrait 기본 프로필"]').waitFor();
  await page.reload();await page.locator('.season-strip').waitFor();await nav('roster');
  await page.locator('.player-card [aria-label="Portrait 기본 프로필"]').waitFor();
  checks.push('Photo removal persists and leaves peer unchanged');

  await page.setViewportSize({ width: 390, height: 844 });
  await fits();
  await button('edit-portrait').click();form = page.locator('[data-form="portrait"]');
  await upload(form, blue);await page.locator('#portrait-preview img').waitFor();
  await fits();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(root, 'test-results', 'portrait-editor-mobile.png') });
  await button('close-modal').click();await nav('home');await fits();
  checks.push('390px roster, photo editor, and today view fit without horizontal overflow');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, browserErrors: errors.length }, null, 2));
} finally {
  await browser?.close();
  if (child.exitCode === null) { child.kill('SIGTERM');await once(child, 'exit'); }
  await rm(temp, { recursive: true, force: true });
}
