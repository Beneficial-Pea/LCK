import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1QAAAAASUVORK5CYII=', 'base64');
const avatarA = 'data:image/png;base64,' + pngBytes.toString('base64');
const avatarB = 'data:image/png;base64,' + Buffer.concat([pngBytes, Buffer.from('other portrait')]).toString('base64');

async function launch(dataFile) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server startup timed out: ${output}`)), 10_000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  return {
    base,
    async stop() {
      if (child.exitCode !== null) return;
      child.kill('SIGTERM'); await once(child, 'exit');
    }
  };
}

function actor(server) {
  return {
    cookie: '',
    async request(route, method = 'GET', body) {
      const headers = { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) };
      const response = await fetch(server.base + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, data: await response.json() };
    }
  };
}
const character = (position, nickname, avatar) => ({ name: nickname, nickname, age: 20, team: 'T1', position, mainChampion: '아리', pool: ['아리', '아지르'], style: '균형 운영', ...(avatar === undefined ? {} : { avatar }) });

test('profile photos persist independently in character slots and active multiplayer seasons', { timeout: 30_000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-portrait-'));
  const dataFile = path.join(temp, 'game.sqlite');
  let running;
  const server = { base: '' };
  try {
    running = await launch(dataFile); server.base = running.base;
    const host = actor(server), member = actor(server), outsider = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    const memberId = (await member.request('/api/session')).data.user.id;
    await outsider.request('/api/session');
    let room, route;

    await t.test('slot photos are private and copied into a newly joined season', async () => {
      const saved = await host.request('/api/slots/0', 'PUT', { character: character('MID', '사진선수', avatarA) });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.slots[0].avatar, avatarA);
      assert.equal((await member.request('/api/session')).data.slots[0], null);
      const legacy = await member.request('/api/slots/0', 'PUT', { character: character('TOP', '기존선수') });
      assert.equal(legacy.status, 200);
      assert.equal(legacy.data.slots[0].avatar, null);
      const created = await host.request('/api/rooms', 'POST', { slot: 0, seed: 'portrait-test' });
      assert.equal(created.status, 200); room = created.data.room;
      route = `/api/rooms/${room.code}`;
      assert.equal(room.players.find(p => p.userId === hostId).character.avatar, avatarA);
      const joined = await member.request('/api/rooms/join', 'POST', { slot: 0, code: room.code });
      assert.equal(joined.status, 200); room = joined.data.room;
      assert.equal(room.players.find(p => p.userId === memberId).character.avatar, null);
    });

    await t.test('nonhost players update only their own cosmetic photo without consuming a turn or altering submissions', async () => {
      const submitted = await member.request(`${route}/action`, 'POST', { turn: room.season.turn, action: 'rest' });
      assert.equal(submitted.status, 200);
      const before = submitted.data.room;
      const updated = await member.request(`${route}/portrait`, 'POST', { avatar: avatarB, userId: hostId });
      assert.equal(updated.status, 200); room = updated.data.room;
      const expectedPlayers = structuredClone(before.players);
      Object.assign(expectedPlayers.find(p => p.userId === memberId).character, { avatar: avatarB, avatarSource: null, avatarCrop: { x: 0.5, y: 0.5, zoom: 1 } });
      assert.deepEqual(room.players, expectedPlayers);
      assert.deepEqual(room.season, before.season);
      assert.deepEqual(room.submissions, before.submissions);
      assert.ok(room.revision > before.revision);
      assert.equal(room.roster.find(c => c.position === 'TOP').avatar, avatarB);
      assert.equal((await member.request('/api/session')).data.slots[0].avatar, null);
      assert.equal((await host.request(route)).data.room.players.find(p => p.userId === memberId).character.avatar, avatarB);
    });

    await t.test('slot edits never secretly replace the portrait in an existing season', async () => {
      const saved = await host.request('/api/slots/0', 'PUT', { character: character('MID', '사진선수', avatarB) });
      assert.equal(saved.status, 200);
      assert.equal(saved.data.slots[0].avatar, avatarB);
      room = (await host.request(route)).data.room;
      assert.equal(room.players.find(p => p.userId === hostId).character.avatar, avatarA);
    });

    await t.test('outsiders cannot change photos and malformed uploads leave the room untouched', async () => {
      const before = (await host.request(route)).data.room;
      assert.equal((await outsider.request(`${route}/portrait`, 'POST', { avatar: avatarB })).status, 403);
      for (const avatar of ['https://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,abcd']) {
        assert.equal((await member.request(`${route}/portrait`, 'POST', { avatar })).status, 400);
      }
      assert.deepEqual((await host.request(route)).data.room, before);
      const beforeSlots = (await host.request('/api/session')).data.slots;
      assert.equal((await host.request('/api/slots/0', 'PUT', { character: character('MID', '실패선수', 'javascript:alert(1)') })).status, 400);
      assert.deepEqual((await host.request('/api/session')).data.slots, beforeSlots);
    });

    await t.test('explicit photo removal retains player identity and all simulation state', async () => {
      const before = (await host.request(route)).data.room;
      const changed = await host.request(`${route}/portrait`, 'POST', { avatar: null });
      assert.equal(changed.status, 200); room = changed.data.room;
      assert.equal(room.players.find(p => p.userId === hostId).character.avatar, null);
      const expectedPlayers = structuredClone(before.players);
      Object.assign(expectedPlayers.find(p => p.userId === hostId).character, { avatar: null, avatarSource: null, avatarCrop: null });
      assert.deepEqual(room.players, expectedPlayers);
      assert.deepEqual(room.season, before.season);
      assert.deepEqual(room.submissions, before.submissions);
      assert.equal((await host.request('/api/session')).data.slots[0].avatar, avatarB);
    });

    await t.test('SQLite restart restores both the separate slot portrait and shared player photo', async () => {
      const beforeRoom = (await member.request(route)).data.room;
      const beforeSlots = (await host.request('/api/session')).data.slots;
      await running.stop(); running = await launch(dataFile); server.base = running.base;
      assert.deepEqual((await member.request(route)).data.room, beforeRoom);
      assert.deepEqual((await host.request('/api/session')).data.slots, beforeSlots);
      assert.equal((await member.request(route)).data.room.players.find(p => p.userId === memberId).character.avatar, avatarB);
    });
  } finally {
    if (running) await running.stop();
    await rm(temp, { recursive: true, force: true });
  }
});
