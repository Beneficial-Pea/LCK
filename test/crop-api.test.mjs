import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1QAAAAASUVORK5CYII=', 'base64');
const image = suffix => 'data:image/png;base64,' + Buffer.concat([png, Buffer.from(suffix)]).toString('base64');
const portraitA = { avatar: image('final A'), avatarSource: image('private source A'), avatarCrop: { x: 0.2, y: 0.8, zoom: 2.3 } };
const portraitB = { avatar: image('final B'), avatarSource: image('private source B'), avatarCrop: { x: 0.7, y: 0.3, zoom: 1.5 } };
const character = (position, nickname, portrait = {}) => ({ name: nickname, nickname, age: 20, team: 'T1', position, mainChampion: '아리', pool: ['아리', '아지르'], style: '균형 운영', ...portrait });
const photoFields = c => ({ avatar: c.avatar, avatarSource: c.avatarSource, avatarCrop: c.avatarCrop });
const withoutPhoto = c => Object.fromEntries(Object.entries(c).filter(([key]) => !['avatar', 'avatarSource', 'avatarCrop'].includes(key)));

async function launch(dataFile) {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1', DATA_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  const base = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`Server startup timed out: ${output}`)); }, 10_000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(`http://127.0.0.1:${match[1]}`); }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
  });
  return { base, async stop() { if (child.exitCode !== null) return; child.kill('SIGTERM'); await once(child, 'exit'); } };
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

function assertPublicPhoto(c, expected) {
  assert.equal(c.avatar, expected.avatar);
  assert.equal(Object.hasOwn(c, 'avatarSource'), false, 'editing source must be stripped from other players');
  assert.equal(Object.hasOwn(c, 'avatarCrop'), false, 'editing crop must be stripped from other players');
}

test('crop editor source remains private while final portraits synchronize without changing gameplay', { timeout: 30_000 }, async t => {
  const temp = await mkdtemp(path.join(tmpdir(), 'first-team-crop-'));
  const dataFile = path.join(temp, 'game.sqlite');
  const server = { base: '' };
  let running;
  try {
    running = await launch(dataFile); server.base = running.base;
    const host = actor(server), member = actor(server), outsider = actor(server);
    const hostId = (await host.request('/api/session')).data.user.id;
    const memberId = (await member.request('/api/session')).data.user.id;
    await outsider.request('/api/session');
    const slotA = await host.request('/api/slots/0', 'PUT', { character: character('MID', 'CropA', portraitA) });
    assert.equal(slotA.status, 200);
    assert.deepEqual(photoFields(slotA.data.slots[0]), portraitA);
    const slotB = await member.request('/api/slots/0', 'PUT', { character: character('TOP', 'CropB', portraitB) });
    assert.equal(slotB.status, 200);
    assert.deepEqual(photoFields(slotB.data.slots[0]), portraitB);
    const created = await host.request('/api/rooms', 'POST', { slot: 0, seed: 'crop-test' });
    assert.equal(created.status, 200);
    const route = `/api/rooms/${created.data.room.code}`;
    const joined = await member.request('/api/rooms/join', 'POST', { slot: 0, code: created.data.room.code });
    assert.equal(joined.status, 200);

    await t.test('each member can reopen only their own crop source in players and roster', async () => {
      const hostRoom = (await host.request(route)).data.room;
      assert.deepEqual(photoFields(hostRoom.players.find(p => p.userId === hostId).character), portraitA);
      assert.deepEqual(photoFields(hostRoom.roster.find(c => c.position === 'MID')), portraitA);
      assertPublicPhoto(hostRoom.players.find(p => p.userId === memberId).character, portraitB);
      assertPublicPhoto(hostRoom.roster.find(c => c.position === 'TOP'), portraitB);
      assert.ok(!JSON.stringify(hostRoom).includes(portraitB.avatarSource));
      const memberRoom = (await member.request(route)).data.room;
      assert.deepEqual(photoFields(memberRoom.players.find(p => p.userId === memberId).character), portraitB);
      assert.deepEqual(photoFields(memberRoom.roster.find(c => c.position === 'TOP')), portraitB);
      assertPublicPhoto(memberRoom.players.find(p => p.userId === hostId).character, portraitA);
      assertPublicPhoto(memberRoom.roster.find(c => c.position === 'MID'), portraitA);
      assert.ok(!JSON.stringify(memberRoom).includes(portraitA.avatarSource));
      assert.equal((await outsider.request(route)).status, 403);
    });

    await t.test('repositioning a member portrait changes no character identity, slot, date or submitted action', async () => {
      const submission = await member.request(`${route}/action`, 'POST', { turn: joined.data.room.season.turn, action: 'rest' });
      assert.equal(submission.status, 200);
      const before = submission.data.room;
      const updatedPhoto = { ...portraitB, avatar: image('final B repositioned'), avatarCrop: { x: 0.1, y: 0.9, zoom: 3 } };
      const updated = await member.request(`${route}/portrait`, 'POST', updatedPhoto);
      assert.equal(updated.status, 200);
      const after = updated.data.room;
      assert.deepEqual(photoFields(after.players.find(p => p.userId === memberId).character), updatedPhoto);
      assert.deepEqual(withoutPhoto(after.players.find(p => p.userId === memberId).character), withoutPhoto(before.players.find(p => p.userId === memberId).character));
      assert.deepEqual(after.season, before.season);
      assert.deepEqual(after.submissions, before.submissions);
      assert.deepEqual(photoFields((await member.request('/api/session')).data.slots[0]), portraitB);
      assertPublicPhoto((await host.request(route)).data.room.players.find(p => p.userId === memberId).character, updatedPhoto);
    });

    await t.test('season JSON exports reveal final photos without any editing sources or crop metadata', async () => {
      for (const user of [host, member]) {
        const exported = await user.request(`${route}/export`);
        assert.equal(exported.status, 200);
        assert.ok(JSON.stringify(exported.data).includes(portraitA.avatar));
        assert.ok(!JSON.stringify(exported.data).includes('avatarSource'));
        assert.ok(!JSON.stringify(exported.data).includes('avatarCrop'));
        assert.ok(!JSON.stringify(exported.data).includes(portraitA.avatarSource));
        assert.ok(!JSON.stringify(exported.data).includes(portraitB.avatarSource));
      }
    });

    await t.test('invalid crops or source images never partially overwrite stored photos', async () => {
      const before = (await member.request(route)).data.room;
      const bad = [
        { ...portraitB, avatarCrop: { x: -0.1, y: 0.5, zoom: 1 } },
        { ...portraitB, avatarCrop: { x: 0.1, y: 0.5, zoom: 5 } },
        { ...portraitB, avatarCrop: { x: '0.1', y: 0.5, zoom: 1 } },
        { ...portraitB, avatarSource: 'https://example.com/source.png' },
        { avatarSource: portraitB.avatarSource }
      ];
      for (const data of bad) assert.equal((await member.request(`${route}/portrait`, 'POST', data)).status, 400);
      assert.deepEqual((await member.request(route)).data.room, before);
      assert.equal((await outsider.request(`${route}/portrait`, 'POST', portraitA)).status, 403);
      const beforeSlot = (await host.request('/api/session')).data.slots[0];
      const invalidSlot = await host.request('/api/slots/0', 'PUT', { character: character('MID', 'BadCrop', { ...portraitA, avatarCrop: { x: 0, y: 0, zoom: 10 } }) });
      assert.equal(invalidSlot.status, 400);
      assert.deepEqual((await host.request('/api/session')).data.slots[0], beforeSlot);
    });

    await t.test('a bounded pair of near-64KiB source and final images fits a single request', async () => {
      const bytesA = Buffer.alloc(64 * 1024, 13), bytesB = Buffer.alloc(64 * 1024, 17);
      Buffer.from([0xff, 0xd8, 0xff]).copy(bytesA); Buffer.from([0xff, 0xd8, 0xff]).copy(bytesB);
      const large = { avatar: 'data:image/jpeg;base64,' + bytesA.toString('base64'), avatarSource: 'data:image/jpeg;base64,' + bytesB.toString('base64'), avatarCrop: { x: 0.5, y: 0.5, zoom: 4 } };
      assert.ok(Buffer.byteLength(JSON.stringify(large)) > 128 * 1024);
      assert.ok(Buffer.byteLength(JSON.stringify(large)) < 256 * 1024);
      const changed = await host.request(`${route}/portrait`, 'POST', large);
      assert.equal(changed.status, 200);
      assert.deepEqual(photoFields(changed.data.room.players.find(p => p.userId === hostId).character), large);
    });

    await t.test('crop sources and coordinates survive SQLite restart under the same user session', async () => {
      const beforeHost = (await host.request(route)).data.room;
      const beforeMember = (await member.request(route)).data.room;
      const beforeSlots = (await member.request('/api/session')).data.slots;
      await running.stop(); running = await launch(dataFile); server.base = running.base;
      assert.deepEqual((await host.request(route)).data.room, beforeHost);
      assert.deepEqual((await member.request(route)).data.room, beforeMember);
      assert.deepEqual((await member.request('/api/session')).data.slots, beforeSlots);
    });

    await t.test('removing a portrait also removes the private source and crop without advancing the turn', async () => {
      const before = (await member.request(route)).data.room;
      const removed = await member.request(`${route}/portrait`, 'POST', { avatar: null, avatarSource: portraitB.avatarSource, avatarCrop: portraitB.avatarCrop });
      assert.equal(removed.status, 200);
      assert.deepEqual(photoFields(removed.data.room.players.find(p => p.userId === memberId).character), { avatar: null, avatarSource: null, avatarCrop: null });
      assert.deepEqual(removed.data.room.season, before.season);
      assert.deepEqual(removed.data.room.submissions, before.submissions);
      assert.deepEqual(photoFields((await member.request('/api/session')).data.slots[0]), portraitB);
    });
  } finally {
    if (running) await running.stop();
    await rm(temp, { recursive: true, force: true });
  }
});
