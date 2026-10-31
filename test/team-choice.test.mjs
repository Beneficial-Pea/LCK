import { registerTestServer, ensureTestAccount } from './helpers/accounts.mjs';
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
    cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_FILE: dataFile, COOKIE_SECURE: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Team-choice server timeout: ${output}`)); }, 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Team-choice server exited ${code}: ${output}`)); });
  });
  registerTestServer(base,dataFile);
  return { base, async stop() { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } } };
}
function actor(server) {
  return {
    cookie: '',
    async request(route, method = 'GET', body) {
      await ensureTestAccount(server,this);
      const response = await fetch(server.base + route, {
        method, headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, data: await response.json() };
    }
  };
}
const character = (position, nickname, team) => ({ name: nickname, nickname, age: 20, position, mainChampion: '아리', pool: ['아리', '아지르'], style: '균형 운영', ...(team ? { team } : {}) });

test('character selection, shared readiness, host team selection and cosmetic scene movement stay separate', { timeout: 30000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-team-choice-'));
  const server = { base: '' };
  let running;
  try {
    running = await launch(path.join(temp, 'game.sqlite')); server.base = running.base;
    const host = actor(server), friend = actor(server), late = actor(server), outsider = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    const friendId = (await friend.request('/api/session')).data.user.id;
    const lateId = (await late.request('/api/session')).data.user.id;
    await outsider.request('/api/session');
    let room, route;

    await t.test('characters no longer require a team and the room does not secretly assign one', async () => {
      const saved = await host.request('/api/slots/0', 'PUT', { character: character('TOP', '팀없는선수') });
      assert.equal(saved.status, 200); assert.equal(saved.data.slots[0].team, null);
      const old = await friend.request('/api/slots/0', 'PUT', { character: character('JGL', '기존캐릭터', 'Gen.G') });
      assert.equal(old.status, 200);
      await late.request('/api/slots/0', 'PUT', { character: character('MID', '늦은참가자') });
      const meta = (await host.request('/api/meta')).data;
      assert.equal(meta.teamProfiles.length, 10); assert.ok(meta.teamProfiles.every(p => p.name && p.description && p.power));
      assert.ok(meta.teamProfileBasis.description);
      assert.deepEqual(meta.availableSeasons.map(s => s.year), [2026]);
      assert.equal((await host.request('/api/rooms', 'POST', { slot: 0, chooseTeam: true, year: 2030 })).status, 400);
      const created = await host.request('/api/rooms', 'POST', { slot: 0, waitingRoom: true, chooseTeam: true, seed: 'team-choice-test' });
      assert.equal(created.status, 200); room = created.data.room; route = `/api/rooms/${room.code}`;
      assert.equal(room.season.team, null); assert.equal(room.season.draft, true);
      assert.equal(room.season.year, 2026); assert.equal(room.season.date, '2026-01-12'); assert.equal(room.season.totalTurns, 308);
      assert.equal(room.players[0].character.team, null); assert.equal(room.lobby.selectedTeam, null);
      assert.equal(room.lobby.requireTeamSelection, true); assert.ok(room.roster.every(c => c.team === null || c.team === '대기실'));
      assert.equal(room.lobby.settings.year, 2026);
      const joined = await friend.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 });
      assert.equal(joined.status, 200); room = joined.data.room;
      assert.ok(room.players.every(p => p.character.team === null));
      assert.equal((await friend.request('/api/session')).data.slots[0].team, 'Gen.G');
      assert.equal(room.lobby.settings.opponents.length, 10);
    });

    await t.test('only a prepared host enters team selection and gameplay remains blocked', async () => {
      assert.equal((await host.request(`${route}/prepare`, 'POST', {})).status, 409);
      await host.request(`${route}/ready`, 'POST', { ready: true });
      assert.equal((await host.request(`${route}/prepare`, 'POST', {})).status, 409);
      await friend.request(`${route}/ready`, 'POST', { ready: true });
      assert.equal((await friend.request(`${route}/prepare`, 'POST', {})).status, 403);
      assert.equal((await host.request(`${route}/start`, 'POST', {})).status, 409);
      const before = (await host.request(route)).data.room;
      const prepared = await host.request(`${route}/prepare`, 'POST', {});
      assert.equal(prepared.status, 200); room = prepared.data.room;
      assert.equal(room.lobby.status, 'selecting'); assert.deepEqual(room.season, before.season);
      assert.equal((await host.request(`${route}/start`, 'POST', {})).status, 409);
      assert.equal((await host.request(`${route}/action`, 'POST', { turn: 1, action: 'rest' })).status, 409);
      assert.equal((await host.request(`${route}/settle`, 'POST', { turn: 1, npcTakeover: true })).status, 409);
      assert.equal((await friend.request(`${route}/ready`, 'POST', { ready: false })).status, 409);
      assert.equal((await late.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 })).status, 409);
      assert.equal((await friend.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 })).status, 200);
    });

    await t.test('the host chooses one shared team without replacing characters or editing slots', async () => {
      const before = (await host.request(route)).data.room;
      assert.equal((await friend.request(`${route}/team`, 'POST', { team: 'DK' })).status, 403);
      assert.equal((await host.request(`${route}/team`, 'POST', { team: 'unknown' })).status, 400);
      const selected = await host.request(`${route}/team`, 'POST', { team: 'DK' });
      assert.equal(selected.status, 200); room = selected.data.room;
      assert.equal(room.season.team, 'DK'); assert.equal(room.season.draft, true); assert.equal(room.lobby.selectedTeam, 'DK');
      assert.equal(room.season.year, 2026); assert.equal(room.season.date, '2026-01-12');
      const expected = structuredClone(before.players); expected.forEach(p => p.character.team = 'DK');
      assert.deepEqual(room.players, expected); assert.ok(room.roster.every(c => c.team === 'DK'));
      assert.equal(room.season.date, before.season.date); assert.equal(room.season.turn, before.season.turn);
      assert.equal((await host.request('/api/session')).data.slots[0].team, null);
      assert.equal((await friend.request('/api/session')).data.slots[0].team, 'Gen.G');
      const reselection = await host.request(`${route}/team`, 'POST', { team: 'HLE' });
      assert.equal(reselection.status, 200); room = reselection.data.room;
      assert.ok(room.players.every(p => p.character.team === 'HLE'));
      assert.equal(room.players[0].character.id, before.players[0].character.id);
      assert.deepEqual(room.players[0].character.stats, before.players[0].character.stats);
    });

    await t.test('start is atomic and later participants join the chosen team independent of private slot history', async () => {
      const before = (await host.request(route)).data.room;
      const starts = await Promise.all([host.request(`${route}/start`, 'POST', {}), host.request(`${route}/start`, 'POST', {})]);
      assert.deepEqual(starts.map(r => r.status).sort(), [200, 409]);
      room = (await host.request(route)).data.room;
      assert.equal(room.lobby.status, 'started'); assert.equal(room.season.draft, false);
      assert.equal(room.season.date, before.season.date); assert.equal(room.season.turn, before.season.turn);
      assert.deepEqual(room.players, before.players);
      const joined = await late.request('/api/rooms/join', 'POST', { code: room.code, slot: 0 });
      assert.equal(joined.status, 200); room = joined.data.room;
      assert.equal(room.players.find(p => p.userId === lateId).character.team, 'HLE');
      assert.equal((await late.request('/api/session')).data.slots[0].team, null);
      assert.equal((await host.request(`${route}/team`, 'POST', { team: 'T1' })).status, 409);
      assert.equal((await host.request(`${route}/action`, 'POST', { turn: room.season.turn, action: 'rest' })).status, 409);
      assert.equal((await friend.request(`${route}/cup-draft`, 'POST', {turn:room.season.turn,pickNumber:1,remaining:true})).status,403);
      const drafted=await host.request(`${route}/cup-draft`, 'POST', {turn:room.season.turn,pickNumber:1,remaining:true});assert.equal(drafted.status,200);assert.deepEqual(drafted.data.room.season.cupDraft.groups.map(g=>g.length),[5,5]);assert.equal(drafted.data.room.season.turn,room.season.turn);
      assert.equal((await host.request(`${route}/action`, 'POST', { turn: room.season.turn, action: 'rest' })).status, 200);
    });

    await t.test('scene movement is personal, bounded, shared and independent of all simulation state', async () => {
      const before = (await host.request(route)).data.room;
      assert.equal((await outsider.request(`${route}/move`, 'POST', { x: 30, y: 80, location: '연습실' })).status, 403);
      for (const point of [{ x: 7, y: 80 }, { x: 93, y: 80 }, { x: 30, y: 57 }, { x: 30, y: 91 }, { x: '30', y: 80 }, { x: null, y: 80 }]) {
        assert.equal((await host.request(`${route}/move`, 'POST', { ...point, location: '연습실' })).status, 400);
      }
      assert.equal((await host.request(`${route}/move`, 'POST', { x: 30, y: 80, location: '카페' })).status, 409);
      assert.deepEqual((await host.request(route)).data.room, before);
      const moved = await host.request(`${route}/move`, 'POST', { x: 34.125, y: 78.667, location: '연습실', userId: friendId });
      assert.equal(moved.status, 200); room = moved.data.room;
      const expectedPlayers = structuredClone(before.players);
      expectedPlayers.find(p => p.userId === hostId).scenePosition = { x: 34.13, y: 78.67, location: '연습실' };
      assert.deepEqual(room.players, expectedPlayers); assert.deepEqual(room.season, before.season);
      assert.deepEqual(room.submissions, before.submissions);
      assert.deepEqual((await friend.request(route)).data.room.players.find(p => p.userId === hostId).scenePosition, expectedPlayers[0].scenePosition);
      const relocated = await host.request(`${route}/location`, 'POST', { location: '카페' });
      assert.equal(relocated.data.room.players.find(p => p.userId === hostId).scenePosition, null);
      assert.equal((await host.request(`${route}/move`, 'POST', { x: 30, y: 80, location: '연습실' })).status, 409);
      assert.equal((await host.request(`${route}/move`, 'POST', { x: 30, y: 80, location: '카페' })).status, 200);
    });

    await t.test('selection and movements survive reconnection and an emptied draft room can reopen', async () => {
      const before = (await host.request(route)).data.room;
      await running.stop(); running = await launch(path.join(temp, 'game.sqlite')); server.base = running.base;
      assert.deepEqual((await host.request(route)).data.room, before);
      const draft = (await host.request('/api/rooms', 'POST', { slot: 0, chooseTeam: true })).data.room;
      const draftRoute = `/api/rooms/${draft.code}`;
      await host.request(`${draftRoute}/ready`, 'POST', { ready: true });
      await host.request(`${draftRoute}/prepare`, 'POST', {});
      await host.request(`${draftRoute}/team`, 'POST', { team: 'DK' });
      await host.request(`${draftRoute}/leave`, 'POST', {});
      const reopened = await friend.request('/api/rooms/join', 'POST', { code: draft.code, slot: 0 });
      assert.equal(reopened.status, 200); assert.equal(reopened.data.room.hostId, friendId);
      assert.equal(reopened.data.room.lobby.status, 'waiting'); assert.equal(reopened.data.room.lobby.selectedTeam, null);
      assert.equal(reopened.data.room.season.team, null); assert.equal(reopened.data.room.players[0].character.team, null);
    });
  } finally {
    if (running) await running.stop();
    await rm(temp, { recursive: true, force: true });
  }
});
