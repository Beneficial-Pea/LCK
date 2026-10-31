// Uses a disposable DATA_FILE only; edits fixtures in that local test database.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
import {Store} from '../lib/store.mjs';
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3200';assert(process.env.DATA_FILE?.startsWith('/tmp/'),'Use a disposable /tmp DATA_FILE');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const request=async(path,data)=>{const r=await context.request.post(path,{data});const json=await r.json();assert(r.ok(),JSON.stringify(json));return json;};
 const slot=await context.request.put('/api/slots/0',{data:{character:{name:'김선수',nickname:'Franchise',age:27,team:'T1',position:'MID',style:'균형 운영',mainChampion:'아리',pool:['아리','아지르','오리아나'],background:'franchise_star'}}});assert(slot.ok());assert.equal((await slot.json()).slots[0].stats.macro,67);
 let room=(await request('/api/rooms',{slot:0,year:2026})).room;const route='/api/rooms/'+room.code,get=async()=>(await(await context.request.get(route)).json()).room;
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);await page.goto('/');await page.locator('[data-cup-media]').waitFor();assert.equal(await page.locator('.training-grid').count(),0);
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../test-results/preseason-media.png',import.meta.url).pathname,fullPage:true});
 for(let pick=0;pick<8;pick++){const next=page.locator('[data-action="cup-draft-pick"]:not([data-team])');await next.click();if(pick<7)await page.waitForFunction(n=>document.querySelector('[data-cup-media]')?.textContent.includes((n+2)+'순위 지명 차례'),pick);}
 await page.locator('.season-strip').waitFor();room=await get();assert.deepEqual(room.season.cupDraft.groups.map(g=>g.length),[5,5]);assert.equal(room.season.turn,1);
 const db=new Store(process.env.DATA_FILE),saved=db.room(room.code),event=room.scrimSchedule.find(e=>e.status==='scheduled');saved.season.date=event.date;saved.season.interviews=[{id:'browser-interview',matchId:'browser-fixture',date:event.date,team:'T1',nickname:'Franchise',question:'수훈선수로 선정된 소감은?',status:'pending',userId:saved.hostId}];db.saveRoom(saved);db.close();
 await page.reload();await page.locator('[data-action="play-scrim"][data-plan="side"]').click();await page.locator('.scrim-record[open]').waitFor();assert((await page.locator('.scrim-record').textContent()).includes('사이드 운영'));assert((await get()).season.scrimDiary[0].sets.length>=2);
 assert.equal(await page.locator('[data-pom-interviews]').count(),0);assert.equal((await get()).season.interviews[0].status,'pending');
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:new URL('../test-results/scrim-mobile.png',import.meta.url).pathname,fullPage:true});await page.setViewportSize({width:1440,height:1000});
 const data=new Store(process.env.DATA_FILE),gameRoom=data.room(room.code),first=gameRoom.season.schedule.find(m=>m.status==='scheduled'&&[m.teamA,m.teamB].includes(gameRoom.season.team));gameRoom.season.date=first.date;data.saveRoom(gameRoom);data.close();room=await get();
 await request(route+'/settle',{turn:room.season.turn,npcTakeover:true,live:true});for(let i=0;i<40;i++){room=await get();if(room.broadcast?.intermission)break;await new Promise(r=>setTimeout(r,20));}assert(room.broadcast.intermission);
 await page.reload();await page.locator('[data-strategy-break]').waitFor();await page.screenshot({path:new URL('../test-results/set-strategy-desktop.png',import.meta.url).pathname,fullPage:true});await page.locator('[data-action="set-strategy"][data-plan="early"]').click();await page.waitForFunction(()=>!document.querySelector('[data-strategy-break]'));
 assert.deepEqual(errors,[]);console.log('Training browser passed: preseason 8-pick draft, ten teams, franchise bonus, detailed scrim, retired interviews hidden, mobile fit and live strategy selection.');
}finally{await browser.close();}
