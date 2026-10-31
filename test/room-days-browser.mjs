// Disposable local server only: DATA_FILE=/tmp/... BASE_URL=... node test/room-days-browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
import {Store} from '../lib/store.mjs';
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3201';assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const response=await context.request.post(path,{data}),json=await response.json();assert(response.ok(),JSON.stringify(json));return json;};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'김선수',nickname:'RoomPlayer',team:'T1',position:'MID',age:24,mainChampion:'아리',pool:['아리','오리아나','아지르'],background:'franchise_star',style:'균형 운영'}}})).ok());
 const slots=(await(await context.request.get('/api/session')).json()).slots;let room=(await post('/api/rooms',{slot:0,year:2026})).room;const route='/api/rooms/'+room.code,get=async()=>(await(await context.request.get(route)).json()).room;
 await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});room=await get();
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);
 let db=new Store(process.env.DATA_FILE),r=db.room(room.code);r.season.date=room.scrimSchedule.find(e=>e.status==='scheduled').date;db.saveRoom(r);db.close();
 await page.goto('/');await page.locator('[data-dedicated-day="scrim"]').waitFor();assert.equal(await page.locator('[data-action="choose-action"],[data-action="submit-action"]').count(),0);assert(await page.locator('[data-action="settle"]').isDisabled());
 await page.locator('[data-action="play-scrim"][data-plan="balanced"]').click();await page.waitForFunction(()=>!document.querySelector('[data-action="settle"]').disabled);assert.equal(await page.locator('[data-action="choose-action"],[data-action="submit-action"]').count(),0);
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('../test-results/scrim-day-only.png',import.meta.url).pathname,fullPage:true});await page.locator('[data-action="settle"]').click();
 room=await get();db=new Store(process.env.DATA_FILE);r=db.room(room.code);const match=r.season.schedule.find(m=>m.status==='scheduled'&&[m.teamA,m.teamB].includes(r.season.team));r.season.date=match.date;db.saveRoom(r);db.close();
 await page.reload();await page.locator('[data-dedicated-day="match"]').waitFor();assert.equal(await page.locator('[data-action="choose-action"],[data-action="submit-action"]').count(),0);assert(await page.locator('[data-action="settle"]').isEnabled());await page.screenshot({path:new URL('../test-results/match-day-only.png',import.meta.url).pathname,fullPage:true});await page.locator('[data-action="settle"]').click();
 for(let i=0;i<35;i++){room=await get();if(!room.broadcast)break;if(room.broadcast.intermission)await post(route+'/set-strategy',{turn:room.season.turn,...room.broadcast.intermission,strategy:'balanced'});await new Promise(resolve=>setTimeout(resolve,20));}assert(!room.broadcast);
 await page.setViewportSize({width:1440,height:1000});await page.reload();await page.locator('.season-strip').waitFor();await page.locator('[data-action="room-controls"]').first().click();await page.locator('#modal-root [data-action="reset-room"]').click();await page.locator('[data-form="reset-room"]').waitFor();assert((await page.locator('.modal-body').textContent()).includes('채팅은 유지'));
 const oldId=room.season.id;await page.locator('[data-form="reset-room"] [name="confirmation"]').fill('초기화');const resetResponse=page.waitForResponse(response=>response.url().endsWith('/reset')&&response.status()===200);await page.locator('[data-form="reset-room"] [type="submit"]').click();await resetResponse;await page.locator('.assembly-header').waitFor();room=await get();assert.notEqual(room.season.id,oldId);assert.equal(room.season.turn,1);assert.equal(room.season.team,null);assert.deepEqual((await(await context.request.get('/api/session')).json()).slots,slots);
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('[data-action="leave-room"]').first().click();await page.locator('[data-form="leave"] [type="submit"]').click();await page.locator('.assembly-header').waitFor({state:'detached'});const session=await(await context.request.get('/api/session')).json();assert(!session.rooms.some(x=>x.code===room.code));assert.deepEqual(session.slots,slots);assert.deepEqual(errors,[]);
 console.log('Room/day browser passed: scrim and match days hide preparation and need no submissions; host reset confirms and keeps slots; leave removes membership; mobile fits.');
}finally{await browser.close();}
