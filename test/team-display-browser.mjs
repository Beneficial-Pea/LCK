// Use a local server and disposable /tmp/ DATA_FILE.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Store} from '../lib/store.mjs';
import {seasonShared} from '../lib/season.mjs';
import {beginLiveMatch} from '../lib/live-match.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3218';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 const projection=await page.evaluate(async()=>{
  const {normalizeTeamDisplay}=await import('/team-display.js'),root=document.createElement('div');root.innerHTML='<button data-team="DRX" title="DRX">DRX</button><select><option>DRX</option></select><input value="DRX"><textarea>DRX</textarea><p class="message-text">DRX 원문</p><h2>KIWOOM DRX</h2><span data-player-id="npc:DRX:TOP">DRX Ternox</span>';
  normalizeTeamDisplay(root,2026);const once=root.innerHTML;normalizeTeamDisplay(root,2026);return {button:root.querySelector('button').textContent,id:root.querySelector('button').dataset.team,title:root.querySelector('button').title,option:root.querySelector('option').textContent,value:root.querySelector('select').value,input:root.querySelector('input').value,textarea:root.querySelector('textarea').value,chat:root.querySelector('p').textContent,full:root.querySelector('h2').textContent,playerId:root.querySelector('span').dataset.playerId,stable:once===root.innerHTML};
 });
 assert.deepEqual(projection,{button:'KRX',id:'DRX',title:'KRX',option:'KRX',value:'DRX',input:'DRX',textarea:'DRX',chat:'DRX 원문',full:'KIWOOM DRX',playerId:'npc:DRX:TOP',stable:true});
 const meta=await(await context.request.get('/api/meta')).json();assert.equal(meta.teamProfiles.find(t=>t.name==='DRX').displayName,'KRX');
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'KrxPlayer',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르'],style:'균형 운영'}}})).ok());
 const created=await context.request.post('/api/rooms',{data:{slot:0,year:2026,chooseTeam:true}});assert(created.ok());const room=(await created.json()).room,route='/api/rooms/'+room.code;
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);await page.reload();await page.locator('[data-action="lobby-ready"]').click();await page.locator('[data-action="lobby-prepare"]').click();const choice=page.locator('[data-action="choose-team"][data-team="DRX"]');await choice.waitFor();assert((await choice.textContent()).includes('KRX'));await choice.click();await page.locator('[data-action="lobby-start"]').click();
 assert((await context.request.post(route+'/cup-draft',{data:{turn:1,pickNumber:1,remaining:true}})).ok());await page.reload();await page.locator('.home-quick-access').waitFor();
 const noOldShortName=async selector=>{const text=(await page.locator(selector).textContent()).replace(/KIWOOM\s+DRX|키움\s+DRX/g,'');assert(!/\bDRX\b/.test(text),selector+' has an old abbreviation');};
 await noOldShortName('#main-content');await page.locator('[data-action="team-roster-modal"]').click();await page.locator('#modal-root .roster-list').waitFor();assert((await page.locator('#modal-root .roster-list').textContent()).includes('KRX'));await noOldShortName('#modal-root');await page.locator('#modal-root [data-action="close-modal"]').first().click();
 await page.locator('[data-action="standings-modal"]').click();await page.locator('#modal-root [data-cup-progress]').waitFor();await noOldShortName('#modal-root');await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.locator('[data-view="calendar"]').first().click();await page.locator('.calendar-layout').waitFor();await noOldShortName('#main-content');
 const raw=(await(await context.request.get(route)).json()).room;assert.equal(raw.season.team,'DRX');assert(raw.roster.every(c=>c.team==='DRX'));
 const chat=await context.request.post(route+'/chat',{data:{channel:'team',text:'DRX 원문 대화'}});assert(chat.ok());
 const db=new Store(process.env.DATA_FILE);try{const r=db.room(room.code),pending=structuredClone(r),m={id:'krx-display-live',date:r.season.date,stage:'LCK',round:'검증',teamA:'DRX',teamB:'T1',bestOf:3,status:'scheduled'};pending.season.schedule.push(m);seasonShared.runMatch(pending,m);beginLiveMatch(r,pending,{date:r.season.date,matches:[m.id]},{stepMs:1e9});r.revision++;db.saveRoom(r);}finally{db.close();}
 await page.reload();await page.locator('[data-objective-board]').waitFor();await noOldShortName('.live-match-layout');assert((await page.locator('[data-objective-side="0"]').textContent()).includes('KRX'));
 await page.locator('[data-owner-toggle]').first().click();await page.locator('[data-dock-channel="team"]').click();await page.locator('.owner-dock-log').getByText('DRX 원문 대화',{exact:true}).waitFor();
 await page.locator('[data-view="notices"]').first().click();await page.getByRole('heading',{name:'정정 업데이트 · 키움 DRX의 약칭은 KRX입니다',exact:true}).waitFor();
 const restored=(await(await context.request.get(route)).json()).room;assert.equal(restored.season.team,'DRX');assert.deepEqual(restored.players[0].character.stats,raw.players[0].character.stats);assert.deepEqual(errors,[]);
 console.log('KRX browser passed: team selection, home, roster, standings, calendar and live text use KRX; full names, inputs, saved keys, chat and stats are preserved; corrected notice visible.');
}finally{await browser.close();}
