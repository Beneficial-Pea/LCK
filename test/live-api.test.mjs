import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function launch(dataFile) {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', LIVE_STEP_MS: '80', DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Live server timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk; const port = output.match(/listening on port (\d+)/)?.[1]; if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Live server exited ${code}: ${output}`)); });
  });
  return { base, async stop() { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } } };
}
function actor(server) {
  return { cookie: '', async request(route, method = 'GET', body) {
    const response = await fetch(server.base + route, { method,
      headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } };
}
const character = (position, nickname) => ({ name: nickname, nickname, age: 22, team: 'T1', position, mainChampion: '아리', pool: ['아리', '아지르', '오리아나'] });
const png = 'data:image/png;base64,iVBORw0KGgo=';

test('timed match broadcasts share only observed state and commit the season exactly once', { timeout: 30000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-live-'));
  const server = { base: '' };
  let running;
  try {
    running = await launch(path.join(temp, 'game.sqlite')); server.base = running.base;
    const host = actor(server), friend = actor(server), late = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    const friendId = (await friend.request('/api/session')).data.user.id;
    await late.request('/api/session');
    for (const [user, position, name] of [[host, 'MID', 'LiveHero'], [friend, 'JGL', 'LiveFriend'], [late, 'SUP', 'LiveLate']]) {
      assert.equal((await user.request('/api/slots/0', 'PUT', { character: character(position, name) })).status, 200);
    }
    let room = (await host.request('/api/rooms', 'POST', { slot: 0, year: 2025, seed: 'live-api' })).data.room;
    const route = `/api/rooms/${room.code}`;
    await t.test('preparation days still settle immediately and own game days open with draft only', async () => {
      await host.request(`${route}/action`, 'POST', { turn: room.season.turn, action: 'rest' });
      const normal = await host.request(`${route}/settle`, 'POST', { turn: room.season.turn, live: true });
      assert.equal(normal.status, 200); room = normal.data.room;
      assert.equal(room.broadcast, null); assert.equal(room.season.date, '2025-01-14');
      const fast = await host.request(`${route}/auto`, 'POST', { turn: room.season.turn, action: 'rest' });
      assert.equal(fast.status, 200); room = fast.data.room;
      assert(room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && [m.teamA, m.teamB].includes('T1')));
      assert.equal((await friend.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 })).status, 200);
      room = (await host.request(route)).data.room;
      for (const user of [host, friend]) await user.request(`${route}/action`, 'POST', { turn: room.season.turn, action: 'rest' });
      const before = (await host.request(route)).data.room;
      const starts = await Promise.all([
        host.request(`${route}/settle`, 'POST', { turn: before.season.turn, live: true }),
        host.request(`${route}/settle`, 'POST', { turn: before.season.turn, live: true }),
      ]);
      assert.deepEqual(starts.map(r => r.status).sort(), [200, 409]);
      const started = starts.find(r => r.status === 200).data;
      room = started.room;
      assert.equal(started.summary.live, true);
      assert.equal(room.broadcast.status, 'live'); assert.equal(room.broadcast.scoreA, 0); assert.equal(room.broadcast.scoreB, 0);
      assert.equal(room.broadcast.sets.length, 1); assert.equal(room.broadcast.sets[0].events.length, 1);
      assert.equal(room.broadcast.sets[0].events[0].type, 'draft');
      assert(!Object.hasOwn(room.broadcast, 'winner')); assert(!Object.hasOwn(room.broadcast.sets[0], 'winner'));
      assert(!JSON.stringify(room.broadcast).includes('recap'));
      assert.equal(room.broadcast.sets[0].scoreboard.reduce((sum, row) => sum + row.k + row.d + row.a, 0), 0);
      assert.deepEqual(room.season, before.season);
      assert(!Object.hasOwn(room, 'liveMatch'));
      assert(!JSON.stringify(room).includes('pendingRoom'));
    });
    const firstBroadcastId = room.broadcast.id, date = room.season.date, turn = room.season.turn, matchId = room.broadcast.matchId;
    await t.test('live state is shared, ETags advance with the clock, and gameplay or new joins cannot bypass it', async () => {
      for (const operation of ['action', 'auto', 'settle']) {
        assert.equal((await host.request(`${route}/${operation}`, 'POST', { turn, action: 'rest', live: true })).status, 409);
      }
      assert.equal((await late.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 })).status, 409);
      const peer = (await friend.request(route)).data.room;
      assert.equal(peer.broadcast.id, firstBroadcastId); assert.equal(peer.season.date, date);
      const exported = (await friend.request(`${route}/export`)).data.room;
      assert(!Object.hasOwn(exported, 'liveMatch')); assert(!JSON.stringify(exported).includes('pendingRoom'));
      assert(!exported.season.results.some(m => m.id === matchId));
      assert(!exported.season.schedule.find(m => m.id === matchId).result);
      const previous = (await host.request(route)).data.room;
      await pause(100);
      const progressed = await host.request(`${route}?since=${previous.revision}`);
      assert.equal(progressed.status, 200); assert(progressed.data.room.revision > previous.revision);
      assert(progressed.data.room.broadcast.currentEventIndex >= previous.broadcast.currentEventIndex);
    });
    await t.test('cosmetic updates and a host departure survive a live server restart', async () => {
      const changed = await friend.request(`${route}/portrait`, 'POST', { avatar: png, avatarSource: png, avatarCrop: { x: .2, y: .7, zoom: 2 } });
      assert.equal(changed.status, 200);
      await friend.request(`${route}/location`, 'POST', { location: '카페' });
      await friend.request(`${route}/move`, 'POST', { location: '카페', x: 62, y: 75 });
      await friend.request(`${route}/chat`, 'POST', { channel: 'owner', text: '중계 보면서 기다리는 중' });
      const before = (await friend.request(route)).data.room;
      assert(before.broadcast); assert.equal(before.season.date, date);
      assert.equal((await host.request(`${route}/leave`, 'POST', {})).status, 200);
      assert.equal((await host.request(route)).status, 403);
      await running.stop(); running = await launch(path.join(temp, 'game.sqlite')); server.base = running.base;
      const restored = (await friend.request(route)).data.room;
      assert.equal(restored.hostId, friendId); assert.equal(restored.players.length, 1);
      assert.equal(restored.broadcast?.id || restored.lastBroadcast?.id, firstBroadcastId);
      assert.equal(restored.players[0].character.avatarSource, png);
      assert.deepEqual(restored.players[0].scenePosition, { location: '카페', x: 62, y: 75 });
      assert(restored.messages.some(m => m.text === '중계 보면서 기다리는 중'));
    });
    await t.test('after the final scene, results and day advancement become visible exactly once', async () => {
      const deadline = Date.now() + 15000;
      do {
        room = (await friend.request(route)).data.room;
        if (!room.broadcast) break;
        assert.equal(room.season.turn, turn); assert.equal(room.season.date, date);
        assert(!room.season.results.some(m => m.id === matchId));
        await pause(45);
      } while (Date.now() < deadline);
      assert.equal(room.broadcast, null); assert.equal(room.season.turn, turn + 1);
      assert.equal(room.lastBroadcast.id, firstBroadcastId); assert(room.lastBroadcast.matchIds.includes(matchId));
      assert.equal(room.season.results.filter(m => m.id === matchId).length, 1);
      assert(room.season.results.find(m => m.id === matchId).result.winner);
      const friendPlayer = room.players.find(p => p.userId === friendId);
      assert.equal(friendPlayer.character.avatarSource, png); assert.equal(friendPlayer.character.avatar, png);
      assert.deepEqual(friendPlayer.character.avatarCrop, { x: .2, y: .7, zoom: 2 });
      assert.equal(friendPlayer.location, '카페'); assert.equal(room.hostId, friendId);
      assert(!room.players.some(p => p.userId === hostId));
      const repeated = await Promise.all([friend.request(route), friend.request(route)]);
      for (const response of repeated) { assert.equal(response.data.room.season.turn, turn + 1); assert.equal(response.data.room.revision, room.revision); }
      assert.equal((await friend.request(`${route}/settle`, 'POST', { turn, live: true })).status, 409);
      assert.equal((await late.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 })).status, 200);
    });
  } finally {
    await running?.stop(); await rm(temp, { recursive: true, force: true });
  }
});
