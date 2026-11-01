import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Store} from '../lib/store.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3215';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const res=await context.request.post(path,{data});assert(res.ok(),await res.text());return res.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'QuietPlayer',team:'T1',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르'],style:'균형 운영'}}})).ok());
 const room=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+room.code;assert.equal(room.messages.length,0);await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});await post(route+'/chat',{channel:'team',text:'선수단 대화는 잘 보여야 해'});
 const db=new Store(process.env.DATA_FILE);try{for(let i=0;i<260;i++)db.addMessage(room.code,{channel:'team',senderId:'system',senderName:'매니저',text:'자동 정산 완료 '+i,at:new Date().toISOString()});const r=db.room(room.code);r.revision++;db.saveRoom(r);}finally{db.close();}
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);await page.goto('/');const readiness=page.locator('[data-my-stats] details[data-player-readiness]');await readiness.waitFor();assert.equal(await readiness.getAttribute('open'),null);assert.equal(await readiness.locator('.readiness-body').isVisible(),false);
 await readiness.locator('summary').click();assert(await readiness.locator('.readiness-body').isVisible());await page.reload();await readiness.waitFor();assert(await readiness.locator('.readiness-body').isVisible());await readiness.locator('summary').click();await page.reload();await readiness.waitFor();assert.equal(await readiness.locator('.readiness-body').isVisible(),false);
 await page.locator('[data-owner-toggle]').first().click();await page.locator('[data-dock-channel="team"]').click();await page.locator('.owner-dock-log').getByText('선수단 대화는 잘 보여야 해',{exact:true}).waitFor();assert(!(await page.locator('.owner-dock-log').textContent()).includes('자동 정산 완료'));
 await post(route+'/chat',{channel:'team',text:'@매니저 일정 알려줘'});await page.reload();await page.locator('.owner-dock-log').waitFor();assert((await page.locator('.owner-dock-log').textContent()).includes('캘린더 확인해'));
 const settled=await post(route+'/settle',{turn:1,npcTakeover:true});assert(settled.room.messages.every(m=>m.senderId!=='system'||m.kind==='staff-reply'));assert(settled.room.season.history.some(h=>h.type==='action'));
 await page.reload();await page.locator('.season-strip').waitFor();const modal=page.locator('#modal-root [data-action="close-modal"]');while(await modal.count()){await modal.first().click();await page.waitForTimeout(20);}
 await page.locator('[data-owner-toggle]').first().click();await page.setViewportSize({width:390,height:844});await readiness.evaluate(el=>el.scrollIntoView({block:'center'}));await readiness.locator('summary').click();assert(await readiness.locator('.readiness-body').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await readiness.screenshot({path:new URL('../test-results/readiness-expanded-mobile.png',import.meta.url).pathname});await readiness.locator('summary').click();await readiness.screenshot({path:new URL('../test-results/readiness-collapsed-mobile.png',import.meta.url).pathname});assert.deepEqual(errors,[]);
 console.log('Readiness/chat browser passed: collapse default and persistence, legacy notice filtering before message limit, actual team messages, staff mentions, silent settlement and mobile fit.');
}finally{await browser.close();}
