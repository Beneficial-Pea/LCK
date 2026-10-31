import { registerTestServer, ensureTestAccount } from './helpers/accounts.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { getTeamNpcPower } from '../lib/balance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function launch(dataFile) {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: root,
    env: { ...process.env, PORT: '0', HOST: '127.0.0.1', COOKIE_SECURE: '0', LIVE_STEP_MS: '15', DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Balance server timed out: ${output}`)), 10000);
    child.stdout.on('data', chunk => { output += chunk; const port = output.match(/listening on port (\d+)/)?.[1]; if (port) { clearTimeout(timer); resolve(`http://127.0.0.1:${port}`); } });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Balance server exited ${code}: ${output}`)); });
  });
  registerTestServer(base,dataFile);
  return { base, async stop() { if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit'); } } };
}
function actor(server) {
  return { cookie: '', async request(route, method = 'GET', body) {
      await ensureTestAccount(server,this);
    const response = await fetch(server.base + route, { method,
      headers: { ...(this.cookie ? { Cookie: this.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) this.cookie = response.headers.get('set-cookie').split(';')[0];
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  } };
}
const character = (position, nickname) => ({ name: nickname, nickname, age: 22, team: 'Gen.G', position, mainChampion: '아리', pool: ['아리', '아지르'] });
const rating = player => Object.values(player.stats).reduce((a, b) => a + b, 0) / Object.keys(player.stats).length;
const png = 'data:image/png;base64,iVBORw0KGgo=';

test('team-based NPC presets fix new rooms and explicitly repair old rooms without rewriting their season', { timeout: 30000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-balance-'));
  const server = { base: '' };
  let running;
  try {
    const database = path.join(temp, 'game.sqlite');
    running = await launch(database); server.base = running.base;
    const host = actor(server), friend = actor(server), outsider = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    await friend.request('/api/session'); await outsider.request('/api/session');
    await host.request('/api/slots/0', 'PUT', { character: character('MID', 'BalanceHost') });
    await friend.request('/api/slots/0', 'PUT', { character: character('JGL', 'BalanceFriend') });
    let legacyRoute;

    await t.test('team selection supplies the selected team NPC level while custom and legacy settings remain explicit', async () => {
      const beforeSlot = (await host.request('/api/session')).data.slots[0];
      for (const mode of ['team', 'custom']) {
        let room = (await host.request('/api/rooms', 'POST', { slot: 0, chooseTeam: true, waitingRoom: true, npcPowerMode: mode, npcPower: 65, seed: `balance-${mode}` })).data.room;
        const route = `/api/rooms/${room.code}`;
        await host.request(`${route}/ready`, 'POST', { ready: true });
        await host.request(`${route}/prepare`, 'POST', {});
        const selected = await host.request(`${route}/team`, 'POST', { team: 'Gen.G' });
        assert.equal(selected.status, 200); room = selected.data.room;
        const expected = mode === 'team' ? getTeamNpcPower('Gen.G') : 65;
        assert.equal(room.season.npcPower, expected); assert.equal(room.balance.npcPowerMode, mode);
        const npcs = room.roster.filter(p => p.npc);
        assert.equal(npcs.length, 4);
        if (mode === 'team') {
          assert.equal(expected, 90);
          assert(npcs.every(p => rating(p) > 82), 'Gen.G empty roles use team-level NPCs, not the old65 preset');
        }
        assert.deepEqual(room.players.find(p => p.userId === hostId).character.stats, beforeSlot.stats);
        assert.equal((await host.request(`${route}/start`, 'POST', {})).status, 200);
      }
      assert.deepEqual((await host.request('/api/session')).data.slots[0], beforeSlot);
      const legacy = await host.request('/api/rooms', 'POST', { slot: 0, year: 2025, seed: 'balance-legacy' });
      assert.equal(legacy.status, 200); legacyRoute = `/api/rooms/${legacy.data.room.code}`;
      assert.equal(legacy.data.room.season.npcPower, 65);
      assert.equal(legacy.data.room.balance.npcPowerMode, 'custom');
      assert.equal((await host.request('/api/rooms', 'POST', { slot: 0, npcPowerMode: 'guaranteed-win' })).status, 400);
      assert.equal((await host.request('/api/slots/1', 'PUT', { character: character('TOP', '\u200b\u2060') })).status, 400);
    });

    await t.test('an existing host can repair only future NPC strength while preserving submitted actions, stats and completed games', async () => {
      let room = (await host.request(legacyRoute)).data.room;
      const code = room.code;
      // Create one real past result through the public API instead of inventing a loss.
      while (!room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && [m.teamA, m.teamB].includes('Gen.G'))) {
        const advanced = await host.request(`${legacyRoute}/auto`, 'POST', { turn: room.season.turn, action: 'rest' });
        assert.equal(advanced.status, 200); room = advanced.data.room;
      }
      await host.request(`${legacyRoute}/action`, 'POST', { turn: room.season.turn, action: 'rest' });
      room = (await host.request(`${legacyRoute}/settle`, 'POST', { turn: room.season.turn })).data.room;
      assert(room.season.results.some(m => [m.teamA, m.teamB].includes('Gen.G')));
      assert.equal((await friend.request('/api/rooms/join', 'POST', { code, slot: 0 })).status, 200);
      await host.request(`${legacyRoute}/portrait`, 'POST', { avatar: png, avatarSource: png, avatarCrop: { x: .2, y: .8, zoom: 2 } });
      for (const user of [host, friend]) await user.request(`${legacyRoute}/action`, 'POST', { turn: room.season.turn, action: 'analysis' });
      const before = (await host.request(legacyRoute)).data.room;
      assert.equal(before.balance.needsReview, true); assert.equal(before.balance.canRecalibrate, true);
      assert.match(before.balance.reason, /NPC 기본 능력 65/);
      assert.equal((await outsider.request(`${legacyRoute}/balance`, 'POST', { mode: 'team' })).status, 403);
      assert.equal((await friend.request(`${legacyRoute}/balance`, 'POST', { mode: 'team' })).status, 403);
      assert.equal((await host.request(`${legacyRoute}/balance`, 'POST', { mode: 'custom' })).status, 400);
      const response = await host.request(`${legacyRoute}/balance`, 'POST', { mode: 'team' });
      assert.equal(response.status, 200); room = response.data.room;
      assert.equal(response.data.adjustment.before, 65); assert.equal(response.data.adjustment.after, 90);
      assert.equal(room.balance.npcPowerMode, 'team'); assert.equal(room.balance.canRecalibrate, false);
      assert.equal(room.season.date, before.season.date); assert.equal(room.season.turn, before.season.turn);
      assert.deepEqual(room.players, before.players); assert.deepEqual(room.submissions, before.submissions);
      assert.deepEqual(room.season.results, before.season.results); assert.deepEqual(room.season.schedule, before.season.schedule);
      const beforeNpc = before.roster.filter(c => c.npc), afterNpc = room.roster.filter(c => c.npc);
      assert.equal(afterNpc.length, beforeNpc.length);
      for (const npc of afterNpc) assert(rating(npc) >= rating(beforeNpc.find(p => p.id === npc.id)) + 20);
      const balanceLogs = room.season.history.filter(h => h.type === 'settings' && h.id.startsWith('npc-balance-'));
      assert.equal(balanceLogs.length, 1);
      const repeat = (await host.request(`${legacyRoute}/balance`, 'POST', { mode: 'team' })).data.room;
      assert.equal(repeat.season.history.filter(h => h.type === 'settings' && h.id.startsWith('npc-balance-')).length, 1);
      await running.stop(); running = await launch(database); server.base = running.base;
      const restored = (await host.request(legacyRoute)).data.room;
      assert.equal(restored.balance.npcPowerMode, 'team'); assert.equal(restored.season.npcPower, 90);
      assert.deepEqual(restored.players, room.players); assert.deepEqual(restored.season.results, room.season.results);
    });

    await t.test('a live match cannot be recalibrated retroactively, but its future roster can be adjusted after completion', async () => {
      let room = (await host.request('/api/rooms', 'POST', { slot: 0, year: 2025, npcPower: 65, seed: 'balance-live' })).data.room;
      const route = `/api/rooms/${room.code}`;
      while (!room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && [m.teamA, m.teamB].includes('Gen.G'))) {
        room = (await host.request(`${route}/auto`, 'POST', { turn: room.season.turn, action: 'rest' })).data.room;
      }
      await host.request(`${route}/action`, 'POST', { turn: room.season.turn, action: 'rest' });
      room = (await host.request(`${route}/settle`, 'POST', { turn: room.season.turn, live: true })).data.room;
      assert(room.broadcast); assert.equal(room.balance.canRecalibrate, false);
      assert.equal((await host.request(`${route}/balance`, 'POST', { mode: 'team' })).status, 409);
      const deadline = Date.now() + 10000;
      while (room.broadcast && Date.now() < deadline) { await pause(20); room = (await host.request(route)).data.room; }
      assert.equal(room.broadcast, null);
      const completed = structuredClone(room.season.results), date = room.season.date, turn = room.season.turn;
      const adjusted = await host.request(`${route}/balance`, 'POST', { mode: 'team' });
      assert.equal(adjusted.status, 200); assert.equal(adjusted.data.room.season.npcPower, 90);
      assert.deepEqual(adjusted.data.room.season.results, completed);
      assert.equal(adjusted.data.room.season.date, date); assert.equal(adjusted.data.room.season.turn, turn);
    });
  } finally {
    await running?.stop(); await rm(temp, { recursive: true, force: true });
  }
});
