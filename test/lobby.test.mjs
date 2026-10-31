import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function launch(dataFile) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_FILE: dataFile, COOKIE_SECURE: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Lobby server timeout: ${output}`)); }, 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Lobby server exited ${code}: ${output}`)); });
  });
  return { base, async stop() { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } } };
}
function actor(server) {
  return {
    cookie: '',
    async request(route, method = 'GET', body) {
      const response = await fetch(server.base + route, {
        method,
        headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, data: await response.json() };
    }
  };
}
const character = (position, nickname) => ({ name: nickname, nickname, age: 20, team: 'T1', position, mainChampion: '아리', pool: ['아리'], style: '균형 운영' });

test('shared waiting rooms enforce personal readiness and a single host launch', { timeout: 30000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-lobby-'));
  const server = { base: '' };
  let running;
  try {
    running = await launch(path.join(temp, 'game.sqlite')); server.base = running.base;
    const host = actor(server), friend = actor(server), outsider = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    const friendId = (await friend.request('/api/session')).data.user.id;
    await outsider.request('/api/session');
    await host.request('/api/slots/0', 'PUT', { character: character('TOP', '대기방장') });
    await friend.request('/api/slots/0', 'PUT', { character: character('JGL', '대기친구') });
    let room, route;

    await t.test('new UI rooms wait without advancing date and cannot submit or settle gameplay', async () => {
      const created = await host.request('/api/rooms', 'POST', { slot: 0, waitingRoom: true, seed: 'lobby-test' });
      assert.equal(created.status, 200); room = created.data.room; route = `/api/rooms/${room.code}`;
      assert.equal(room.lobby.status, 'waiting'); assert.equal(room.lobby.startedAt, null);
      assert.equal(room.season.turn, 1); assert.equal(room.season.date, '2025-01-13');
      assert.equal(room.roster.length, 5);
      for (const operation of ['action', 'settle', 'auto']) {
        const result = await host.request(`${route}/${operation}`, 'POST', { turn: 1, action: 'rest', npcTakeover: true });
        assert.equal(result.status, 409); assert.match(result.data.error, /대기실/);
      }
      assert.equal((await outsider.request(`${route}/ready`, 'POST', { ready: true })).status, 403);
      assert.equal((await host.request('/api/session')).data.rooms[0].lobbyStatus, 'waiting');
    });

    await t.test('readiness belongs to each participant and newly joined users are unready', async () => {
      let updated = await host.request(`${route}/ready`, 'POST', { ready: true, userId: friendId });
      assert.equal(updated.status, 200); assert.equal(updated.data.room.lobby.ready[hostId], true);
      assert.equal(updated.data.room.lobby.ready[friendId], undefined);
      const joined = await friend.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 });
      assert.equal(joined.status, 200); room = joined.data.room;
      assert.equal(room.lobby.ready[hostId], true); assert.equal(room.lobby.ready[friendId], false);
      assert.equal((await friend.request(`${route}/start`, 'POST', {})).status, 403);
      const blocked = await host.request(`${route}/start`, 'POST', {});
      assert.equal(blocked.status, 409); assert.match(blocked.data.error, /대기친구/);
      assert.equal((await friend.request(`${route}/ready`, 'POST', { ready: 'true' })).status, 400);
      assert.equal((await friend.request(`${route}/ready`, 'POST', { ready: true })).data.room.lobby.ready[friendId], true);
      updated = await friend.request(`${route}/ready`, 'POST', { ready: false });
      assert.equal(updated.data.room.lobby.ready[friendId], false);
      assert.equal((await host.request(`${route}/start`, 'POST', {})).status, 409);
      await friend.request(`${route}/ready`, 'POST', { ready: true });
    });

    await t.test('waiting room owner chat is shared and restart preserves readiness', async () => {
      assert.equal((await friend.request(`${route}/chat`, 'POST', { channel: 'owner', text: '준비됐어요. 시작해 주세요.' })).status, 200);
      const before = (await host.request(route)).data.room;
      assert.ok(before.messages.some(m => m.channel === 'owner' && m.text === '준비됐어요. 시작해 주세요.'));
      await running.stop(); running = await launch(path.join(temp, 'game.sqlite')); server.base = running.base;
      assert.deepEqual((await host.request(route)).data.room.lobby, before.lobby);
      assert.deepEqual((await friend.request(route)).data.room.season, before.season);
    });

    await t.test('two simultaneous start requests launch once without consuming a game turn', async () => {
      const before = (await host.request(route)).data.room;
      const starts = await Promise.all([host.request(`${route}/start`, 'POST', {}), host.request(`${route}/start`, 'POST', {})]);
      assert.deepEqual(starts.map(r => r.status).sort(), [200, 409]);
      const after = (await host.request(route)).data.room;
      assert.equal(after.lobby.status, 'started'); assert.ok(after.lobby.startedAt);
      assert.deepEqual(after.season, before.season); assert.deepEqual(after.players, before.players);
      assert.deepEqual((await friend.request(route)).data.room.season, after.season);
      assert.deepEqual(after.submissions, before.submissions);
      assert.equal((await friend.request(`${route}/ready`, 'POST', { ready: false })).status, 409);
      assert.equal((await friend.request(`${route}/action`, 'POST', { turn: after.season.turn, action: 'rest' })).status, 200);
    });

    await t.test('solo readiness never waits for NPCs and default legacy API rooms are already started', async () => {
      const solo = (await host.request('/api/rooms', 'POST', { slot: 0, waitingRoom: true })).data.room;
      const soloRoute = `/api/rooms/${solo.code}`;
      await host.request(`${soloRoute}/ready`, 'POST', { ready: true });
      assert.equal((await host.request(`${soloRoute}/start`, 'POST', {})).status, 200);
      const legacy = (await host.request('/api/rooms', 'POST', { slot: 0 })).data.room;
      assert.equal(legacy.lobby.status, 'started');
      assert.equal((await host.request(`/api/rooms/${legacy.code}/action`, 'POST', { turn: 1, action: 'rest' })).status, 200);
    });

    await t.test('leaving removes readiness and transfers host so remaining players can launch', async () => {
      const waiting = (await host.request('/api/rooms', 'POST', { slot: 0, waitingRoom: true })).data.room;
      const waitingRoute = `/api/rooms/${waiting.code}`;
      await friend.request('/api/rooms/join', 'POST', { slot: 0, code: waiting.code });
      await host.request(`${waitingRoute}/ready`, 'POST', { ready: true });
      await friend.request(`${waitingRoute}/ready`, 'POST', { ready: true });
      assert.equal((await host.request(`${waitingRoute}/leave`, 'POST', {})).status, 200);
      const remaining = (await friend.request(waitingRoute)).data.room;
      assert.equal(remaining.hostId, friendId); assert.equal(remaining.lobby.ready[hostId], undefined);
      assert.equal(remaining.lobby.ready[friendId], true);
      assert.equal((await friend.request(`${waitingRoute}/start`, 'POST', {})).status, 200);
    });

    await t.test('the first participant returning to an empty waiting room becomes host', async () => {
      const empty = (await host.request('/api/rooms', 'POST', { slot: 0, waitingRoom: true })).data.room;
      const emptyRoute = `/api/rooms/${empty.code}`;
      await host.request(`${emptyRoute}/leave`, 'POST', {});
      const joined = await friend.request('/api/rooms/join', 'POST', { code: empty.code, slot: 0 });
      assert.equal(joined.status, 200); assert.equal(joined.data.room.hostId, friendId);
      assert.equal(joined.data.room.lobby.ready[friendId], false);
      await friend.request(`${emptyRoute}/ready`, 'POST', { ready: true });
      assert.equal((await friend.request(`${emptyRoute}/start`, 'POST', {})).status, 200);
    });
  } finally {
    if (running) await running.stop();
    await rm(temp, { recursive: true, force: true });
  }
});
