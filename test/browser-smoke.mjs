import { authenticatedBrowserContext } from './helpers/accounts.mjs';
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
const context = await authenticatedBrowserContext(browser,{ viewport: { width: 1440, height: 1000 }, baseURL });
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
  assert(await slotForm.locator('[name="autoChampions"]').isChecked());
  await slotForm.locator('[name="position"]').selectOption('SUP');
  await slotForm.locator('[name="style"]').selectOption('한타');
  assert.equal(await slotForm.locator('[name="mainChampion"]').inputValue(),'렐');
  assert((await slotForm.locator('[name="pool"]').inputValue()).includes('알리스타'));
  await slotForm.locator('[name="mainChampion"]').fill('바드');
  assert(!(await slotForm.locator('[name="autoChampions"]').isChecked()));
  await slotForm.locator('[name="position"]').selectOption('MID');
  await slotForm.locator('[name="style"]').selectOption('초반 주도권');
  assert.equal(await slotForm.locator('[name="mainChampion"]').inputValue(),'바드','Manual choices survive style/role changes');
  await action('recommend-champions').click();
  assert(await slotForm.locator('[name="autoChampions"]').isChecked());
  assert.equal(await slotForm.locator('[name="mainChampion"]').inputValue(),'르블랑');
  await slotForm.locator('[name="style"]').selectOption('균형 운영');
  assert.equal(await slotForm.locator('[name="mainChampion"]').inputValue(),'아리');

  assert.equal(await slotForm.locator('[name="background"] option').count(),29);
  assert.equal(await slotForm.locator('[name="background"] optgroup').count(),4);
  await slotForm.locator('[name="background"]').selectOption('signature_specialist');
  assert((await page.locator('[data-background-preview]').textContent()).includes('주력 챔피언'));
  assert.equal(await page.locator('.background-stat-preview strong').last().textContent(),'67');
  await slotForm.locator('[name="background"]').selectOption('dynasty_captain');
  assert.equal(await page.locator('.background-stat-preview strong').nth(3).textContent(),'67');
  await slotForm.locator('[name="background"]').selectOption('former_all_pro');
  assert((await page.locator('[data-background-preview]').textContent()).includes('올프로'));
  assert.equal(await page.locator('.background-stat-preview strong').first().textContent(),'66');
  await slotForm.locator('[name="mainChampion"]').fill('아리');
  await slotForm.locator('[name="pool"]').fill('아리, 아지르, 오리아나, 사일러스, 갈리오');
  await slotForm.locator('button[type="submit"]').click();
  await slotForm.waitFor({ state: 'detached' });
  assert.equal((await state()).slots[0].nickname, 'Replay');
  assert.equal((await state()).slots[0].background,'former_all_pro');assert.equal((await state()).slots[0].stats.mechanics,66);
  checks.push('character created and saved through UI');

  await action('open-create').click();
  const createForm = page.locator('[data-form="create-room"]');
  await createForm.waitFor();
  assert.equal(await createForm.locator('select[name=year]').count(),0);
  assert.equal(await createForm.locator('[name=year]').inputValue(),'2026');
  if (await createForm.locator('[name="name"]').count()) await createForm.locator('[name="name"]').fill('브라우저 검증 시즌');
  assert.equal(await createForm.locator('[name="seed"]').count(),0,'Seed input is absent');
  await createForm.locator('button[type="submit"]').click();
  await createForm.waitFor({ state: 'detached' });
  await page.locator('.assembly-header').waitFor();
  await action('lobby-ready').click();
  await action('lobby-prepare').click();
  await action('choose-team', '[data-team="T1"]').click();
  await action('lobby-start').click();
  await page.locator('[data-cup-media]').waitFor();
  assert.equal(await page.locator('.training-grid').count(),0);
  await action('cup-draft-auto').click();
  await page.locator('.season-strip').waitFor();
  checks.push('preseason media day drafts ten teams before training starts');
  let session = await state();
  const code = session.rooms[0].code;
  let room = (await getRoom(code)).room;
  assert.equal(room.players.length, 1);
  assert.equal(room.roster.length, 5);
  checks.push('room created with four NPC roster positions');
  assert.equal(await page.locator('[data-my-stats] [data-my-stat]').count(),6);
  const myStatsBefore=room.players[0].character.stats;
  assert.equal(await page.locator('[data-my-stat=macro] strong').textContent(),Number(room.players[0].character.effectiveStats?.macro??myStatsBefore.macro).toFixed(1));
  assert(room.season.ewc.qualifierTeams.includes('T1'));assert.notEqual(room.season.ewc.previousChampion.team,'T1');
  checks.push('own six abilities are visible above actions and selected team always enters Road to EWC');
  assert((await page.locator('[data-cup-progress]').textContent()).includes('바론 그룹'));
  assert((await page.locator('[data-cup-progress]').textContent()).includes('장로 그룹'));
  assert((await page.locator('[data-player-readiness]').textContent()).includes('경기력 보정'));
  await action('awards').click();await page.locator('#dialog-title').getByText('POM · 시즌 시상식').waitFor();await action('close-modal').click();

  await action('choose-action', '[data-id="analysis"]').click();
  assert((await page.locator('[data-team-news] .news-declaration').textContent()).includes('상대 분석'));
  const trainingBox=await page.locator('.training-grid').boundingBox(),newsBox=await page.locator('[data-team-news]').boundingBox();
  assert(newsBox.x>trainingBox.x+trainingBox.width,'News sits beside the action area on desktop');
  await action('submit-action').click();
  await page.waitForFunction(()=>document.querySelector('.news-declaration')?.textContent.includes('이번 턴 제출: 상대 분석'));
  await page.waitForFunction(() => document.querySelector('[data-action="settle"]') && !document.querySelector('[data-action="settle"]').disabled);
  await action('settle').click();
  await page.waitForFunction(() => document.querySelector('.strip-value')?.textContent?.includes('2026.01.13'));
  room = (await getRoom(code)).room;
  assert.equal(room.season.turn, 2);
  await page.waitForFunction(value=>document.querySelector('[data-my-stat=macro] strong')?.textContent===value,Number(room.players[0].character.effectiveStats?.macro??room.players[0].character.stats.macro).toFixed(1));
  assert(room.players[0].character.stats.macro>myStatsBefore.macro);
  assert((await page.locator('[data-team-news-log]').textContent()).includes('상대 분석'));
  assert.equal(await page.locator('[data-activity-log]').count(),0);
  checks.push('news sits beside action choices, reflects submitted action, then displays settlement records');
  checks.push('action submission and settlement advance exactly one day');
  assert.equal(room.season.year,2026);
  const firstActivity=room.clubSchedule.find(e=>e.date===room.season.date);assert(firstActivity);
  assert((await page.locator('.today-title').textContent()).includes(firstActivity.title));
  assert((await context.request.get('/crest.svg')).ok());
  assert.equal(await page.locator('.brand-mark img').first().getAttribute('src'),'/crest.svg');
  await nav('calendar');assert.equal(await page.locator('.demacia-panel').count(),1);assert.equal(await page.locator('.ewc-panel').count(),1);await action('select-date',`[data-date="${firstActivity.date}"]`).click();
  assert((await page.locator('.day-detail').textContent()).includes(firstActivity.title));
  await nav('home');
  checks.push('2026-only room creation, original club crest and scheduled team activities in home/calendar');

  // Reach the first own match by the same public API used by the client; the UI
  // itself is used to settle that game and read its progressive replay.
  const own = m => [m.teamA, m.teamB].includes(room.season.team);
  for (let attempts = 0; attempts < 12; attempts++) {
    room = (await getRoom(code)).room;
    if (room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && own(m))) break;
    const scrim=room.scrimSchedule?.find(e=>e.date===room.season.date&&e.status==='scheduled');if(scrim)await request(`/api/rooms/${code}/scrim`,{turn:room.season.turn,id:scrim.id,focus:'balanced'});
    if(room.clubSchedule.some(e=>e.date===room.season.date&&e.status==='scheduled')||scrim){
      await request(`/api/rooms/${code}/action`,{turn:room.season.turn,action:'rest'});
      await request(`/api/rooms/${code}/settle`,{turn:room.season.turn});
    }else await request(`/api/rooms/${code}/auto`, { turn: room.season.turn, action: 'analysis' });
  }
  room = (await getRoom(code)).room;
  assert(room.season.schedule.some(m => m.date === room.season.date && m.status === 'scheduled' && own(m)), 'first own game reached');
  await page.reload();
  await page.locator('.season-strip').waitFor();
  await action('submit-action').click();
  await page.waitForFunction(() => !document.querySelector('[data-action="settle"]')?.disabled);
  const settled = page.waitForResponse(response => response.url().endsWith('/settle') && response.status() === 200);
  await action('settle').click(); await settled;
  await page.locator('[data-live-match] .match-casting').first().waitFor();
  const liveFact=await page.locator('[data-live-match] .match-situation p').first().textContent(),liveCast=await page.locator('[data-live-match] .match-casting p').first().textContent();
  assert(!liveFact.includes(liveCast),'Live situations and casting use separate paragraphs');
  room = (await getRoom(code)).room;
  const broadcastDeadline = Date.now() + 240000;
  while (room.broadcast && Date.now() < broadcastDeadline) {
    await page.waitForTimeout(300);
    room = (await getRoom(code)).room;
    if(room.broadcast?.intermission){const p=room.broadcast.intermission;await request(`/api/rooms/${code}/set-strategy`,{turn:room.season.turn,matchId:p.matchId,nextSet:p.nextSet,strategy:'balanced'});}
  }
  assert(!room.broadcast, 'The shared live broadcast must finish before archived replay is checked');
  const match = room.season.results.find(m => own(m));
  assert(match?.result.sets[0].events.some(e => e.type === 'first_blood'));
  assert.equal(match.result.pom.team,match.result.winner);for(const set of match.result.sets){assert.equal(set.draft.bansA.length,5);assert.equal(set.draft.bansB.length,5);}
  await nav('match');
  await action('select-set', '[data-index="0"]').click();
  await page.locator('.match-event').first().waitFor();
  const initialCount = await page.locator('.match-event').count();
  await action('event-next').click();
  assert.equal(await page.locator('.match-event').count(), initialCount + 1);
  await action('all-events').click();
  await page.locator('.scoreboard').waitFor();
  assert.equal(await page.locator('[data-match-pom]').count(),1);assert((await page.locator('[data-match-pom]').textContent()).includes(match.result.pom.nickname));
  assert(await page.locator('.event-list .match-casting').count()>5);
  const recordedCasting=new Set(match.result.sets[0].events.map(e=>e.casting).filter(Boolean));
  assert((await page.locator('.event-list .match-casting p').allTextContents()).every(text=>recordedCasting.has(text)));
  checks.push('live and archived scenes separate factual records from spoken casting');
  assert((await page.locator('.event-list').textContent()).includes('퍼스트 킬'));
  const shownReactions=await page.locator('.reaction-list .reaction p').allTextContents();
  const recordedReactions=new Set(match.result.sets[0].events.flatMap(event=>event.reactions));
  assert(shownReactions.length>0 && shownReactions.every(text=>recordedReactions.has(text)), 'Replay comments match the actual recorded scenes');
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

  if(!await page.locator('#owner-dock-text').count())await page.locator('[data-owner-toggle]').click();
  await page.locator('[data-dock-channel="team"]').click();
  await page.locator('#owner-dock-text').fill('브라우저 검증 팀 메시지');
  await page.locator('[data-form="owner-dock"] [type="submit"]').click();
  await page.locator('.owner-dock-log').getByText('브라우저 검증 팀 메시지',{exact:true}).waitFor();
  await page.locator('[data-dock-channel="owner"]').click();
  assert.equal(await page.locator('#owner-dock').getByText('브라우저 검증 팀 메시지',{exact:true}).count(),0);
  await page.locator('#owner-dock-text').fill('오너 일정 조율 메시지');
  await page.locator('[data-form="owner-dock"] [type="submit"]').click();
  await page.locator('.owner-dock-log').getByText('오너 일정 조율 메시지',{exact:true}).waitFor();
  checks.push('team and owner chat are distinct');
  await page.locator('#owner-dock-text').fill('오너 초안 보존');
  await page.locator('[data-dock-channel="team"]').click();
  await page.locator('#owner-dock-text').fill('팀 초안 보존');
  await page.locator('[data-owner-toggle]').click();
  assert.equal(await page.locator('#owner-dock-text').count(),0);
  await nav('dorm');
  await page.locator('[data-owner-toggle]').click();
  assert.equal(await page.locator('#owner-dock-text').inputValue(),'팀 초안 보존');
  await page.locator('[data-dock-channel="owner"]').click();
  assert.equal(await page.locator('#owner-dock-text').inputValue(),'오너 초안 보존');
  await nav('home');
  assert.equal(await page.locator('#owner-dock-text').inputValue(),'오너 초안 보존');
  await page.locator('[data-owner-toggle]').click();
  checks.push('folding, navigation and channel switching preserve separate chat drafts');

  await page.reload(); await page.locator('.season-strip').waitFor();
  assert.equal((await getRoom(code)).room.season.turn, room.season.turn);
  checks.push('refresh restores the saved room and date');

  const friend = await authenticatedBrowserContext(browser,{ viewport: { width: 1280, height: 900 }, baseURL });
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
    const sharedBefore=(await getRoom(code)).room,practice=sharedBefore.scrimSchedule?.find(e=>e.date===sharedBefore.season.date&&e.status==='scheduled');if(practice)await request(`/api/rooms/${code}/scrim`,{turn:sharedBefore.season.turn,id:practice.id,focus:'balanced'});
    const priorTurn = (await getRoom(code)).room.season.turn;
    const settleResponse = page.waitForResponse(response => response.url().endsWith('/settle') && response.status() === 200);
    await action('settle').click(); await settleResponse;
    room = (await getRoom(code)).room;
    for(let step=0;room.broadcast&&step<40;step++){if(room.broadcast.intermission){const p=room.broadcast.intermission;await request(`/api/rooms/${code}/set-strategy`,{turn:room.season.turn,...p,strategy:'balanced'});}await page.waitForTimeout(150);room=(await getRoom(code)).room;}
    assert.equal(room.season.turn, priorTurn + 1);
    await peer.waitForFunction(date => document.querySelector('.strip-value')?.textContent?.includes(date.replaceAll('-', '.')), room.season.date);
    const peerRoom = (await (await friend.request.get(`/api/rooms/${code}`)).json()).room;
    assert.equal(peerRoom.season.date, room.season.date);
    assert.deepEqual(peerRoom.season.results, room.season.results);
    checks.push('two isolated browser users submit own actions, wait, settle and see identical date/results');
  } finally { await friend.close(); }

  await assertFits('desktop home');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const view of ['home', 'match', 'calendar', 'roster', 'dorm']) {
    await nav(view);if(view==='home'){const actionBox=await page.locator('.settle-box').boundingBox(),newsBox=await page.locator('[data-team-news]').boundingBox();assert(newsBox.y>=actionBox.y+actionBox.height-2);assert(newsBox.y<actionBox.y+actionBox.height+70,'News follows settlement controls on mobile');} await assertFits(`mobile ${view}`);
  }
  await nav('home');
  await page.screenshot({ path: new URL('home-mobile.png', output).pathname, fullPage: true });
  checks.push('390px mobile screens fit without horizontal page overflow');
  room=(await getRoom(code)).room;
  for(let i=0;i<80&&room.season.date<'2026-03-03';i++){const practice=room.scrimSchedule?.find(e=>e.date===room.season.date&&e.status==='scheduled');if(practice)await request(`/api/rooms/${code}/scrim`,{turn:room.season.turn,id:practice.id,focus:'balanced'});room=(await request(`/api/rooms/${code}/settle`,{turn:room.season.turn,npcTakeover:true})).room;}
  assert.equal(room.season.date,'2026-03-03');const vacationStats=structuredClone(room.players[0].character.stats);
  await page.reload();await page.locator('.vacation-panel').waitFor();await assertFits('mobile vacation');
  assert.equal(await page.locator('[data-action=choose-action]').count(),0);assert.equal(await page.locator('[data-action=life-answer]').count(),0);
  assert(!(await page.locator('[data-world-events]').textContent()).includes('실제 패치나 실존 선수 보도가 아닙니다'));
  await page.screenshot({path:new URL('vacation-mobile.png',output).pathname,fullPage:true});
  await action('vacation-day').click();await page.waitForFunction(()=>document.querySelector('.strip-value')?.textContent.includes('2026.03.04'));
  await action('vacation-end').click();await page.waitForFunction(()=>document.querySelector('.strip-value')?.textContent.includes('2026.03.08'));
  room=(await getRoom(code)).room;assert.equal(room.vacation,null);assert.deepEqual(room.players[0].character.stats,vacationStats);
  assert.equal(await page.locator('[data-action=choose-action]').count(),7);assert.equal(await page.locator('[data-my-stats] [data-my-stat]').count(),6);
  checks.push('vacation removes training/dialogue choices, skips one day or remaining break, preserves abilities and returns to normal training');
  assert.deepEqual(errors, [], 'browser JS errors');
  console.log(JSON.stringify({ status: 'passed', code, checks, browserErrors: errors, screenshots: output.pathname }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
