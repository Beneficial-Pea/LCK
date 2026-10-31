import { registerTestServer, ensureTestAccount } from './helpers/accounts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

const cwd = new URL('../', import.meta.url).pathname;
async function launch(file) {
  const child = spawn(process.execPath, ['server.mjs'], { cwd, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_FILE: file, COOKIE_SECURE: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(output || 'Server timeout')); }, 10000);
    child.stdout.on('data', chunk => { output += chunk; const port = output.match(/listening on port (\d+)/)?.[1]; if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);child.once('exit', code => { clearTimeout(timer);reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  registerTestServer(base,file);
  return { base, async stop() { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } } };
}
function actor(server) {
  return { cookie: '', async request(route, method = 'GET', body) {
      await ensureTestAccount(server,this);
    const r = await fetch(server.base + route, { method, headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const cookie = r.headers.get('set-cookie');if (cookie) this.cookie = cookie.split(';')[0];
    return { status: r.status, data: await r.json() };
  } };
}
const character = (nickname, position = 'MID') => ({ name: nickname, nickname, age: 20, team: 'T1', position, mainChampion: '아리', pool: ['아리', '아지르'] });

test('character-slot deletion is private and leaves active season snapshots intact', async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-delete-'));const server = { base: '' };let running;
  try {
    const file = path.join(temp, 'game.sqlite');running = await launch(file);server.base = running.base;
    const host = actor(server), peer = actor(server), outsider = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    await peer.request('/api/session');await outsider.request('/api/session');
    await host.request('/api/slots/0', 'PUT', { character: character('삭제할슬롯') });
    await host.request('/api/slots/1', 'PUT', { character: character('남겨둘슬롯', 'TOP') });
    await peer.request('/api/slots/0', 'PUT', { character: character('동료슬롯', 'JGL') });
    const created = await host.request('/api/rooms', 'POST', { slot: 0, seed: 'delete-verify' });assert.equal(created.status, 200);
    const route = `/api/rooms/${created.data.room.code}`;
    await peer.request('/api/rooms/join', 'POST', { code: created.data.room.code, slot: 0 });
    await host.request(`${route}/action`, 'POST', { turn: 1, action: 'rest' });
    const before = (await host.request(route)).data.room;
    const keep = (await host.request('/api/session')).data.slots[1];

    await t.test('a supplied user id cannot redirect deletion into another account', async () => {
      await outsider.request('/api/slots/0', 'DELETE', { userId: hostId });
      assert.equal((await host.request('/api/session')).data.slots[0].nickname, '삭제할슬롯');
    });
    await t.test('only the selected own slot is cleared; players, actions and season data stay identical', async () => {
      const deleted = await host.request('/api/slots/0', 'DELETE');assert.equal(deleted.status, 200);
      assert.equal(deleted.data.slots[0], null);assert.deepEqual(deleted.data.slots[1], keep);
      const after = (await host.request(route)).data.room;
      assert.deepEqual(after.players, before.players);assert.deepEqual(after.season, before.season);assert.deepEqual(after.submissions, before.submissions);
      assert.equal((await host.request('/api/session')).data.rooms.length, 1);
      assert.equal((await peer.request('/api/session')).data.slots[0].nickname, '동료슬롯');
    });
    await t.test('cleared slots cannot start a new season and repeat deletion is harmless', async () => {
      assert.equal((await host.request('/api/rooms', 'POST', { slot: 0 })).status, 400);
      assert.equal((await host.request('/api/slots/0', 'DELETE')).status, 200);
      assert.equal((await host.request('/api/slots/5', 'DELETE')).status, 404);
    });
    await t.test('restart keeps the cleared slot and the independently saved active character', async () => {
      await running.stop();running = await launch(file);server.base = running.base;
      assert.equal((await host.request('/api/session')).data.slots[0], null);
      assert.deepEqual((await host.request(route)).data.room.players, before.players);
      assert.deepEqual((await host.request(route)).data.room.season, before.season);
    });
  } finally { await running?.stop();await rm(temp, { recursive: true, force: true }); }
});
