// Requires a local server with a disposable /tmp/ DATA_FILE.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Store} from '../lib/store.mjs';
import {processDailyLife} from '../lib/daily-life.mjs';
import {getRoster} from '../lib/season.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3219';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const res=await context.request.post(path,{data});assert(res.ok(),await res.text());return res.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'SetbackPlayer',team:'Gen.G',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르'],style:'균형 운영'}}})).ok());
 const room=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+room.code;await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});
 const db=new Store(process.env.DATA_FILE);try{const r=db.room(room.code);let seed;
  for(let i=0;i<2000;i++){const probe=structuredClone(r);probe.season.seed='sleep-browser-'+i;processDailyLife(probe,getRoster(probe));if(probe.season.dailyLife.entries[0].title==='수면 부족'){seed=probe.season.seed;break;}}
  assert(seed);r.season.seed=seed;r.revision++;db.saveRoom(r);
 }finally{db.close();}
 const settled=(await post(route+'/settle',{turn:1,npcTakeover:true})).room,entry=settled.season.dailyLife.entries.find(e=>e.userId===settled.me),before=settled.players[0].character;assert.equal(entry.kind,'setback');assert.deepEqual(entry.incidentEffects,{condition:-3,fatigue:3,stress:1});
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);await page.goto('/');await page.locator('.season-strip').waitFor();if(await page.locator('[data-world-event-popup]').count())await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.locator('[data-life-incident]').waitFor();assert.equal(await page.locator('.life-choice').count(),2);assert((await page.locator('[data-life-incident]').textContent()).includes('컨디션 -3'));assert(!(await page.locator('.life-event-text').textContent()).includes('그 뒤에는'));
 await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.reload();await page.locator('.season-strip').waitFor();const get=async()=>(await(await context.request.get(route)).json()).room;assert.deepEqual((await get()).players[0].character,before);
 // A saved callback from the previous release is hidden without changing its question.
 const fixture=new Store(process.env.DATA_FILE);try{const r=fixture.room(room.code),e=r.season.dailyLife.entries.find(e=>e.id===entry.id);e.text+=' '+e.partnerName+'이 전에 나눴던 일을 다시 꺼냈다. 그때는 긴 주문 내역을 접고 또 접었다. "우리 이만큼 시켰어?"라고 말했었다. "그 뒤에는 어떻게 됐어?"';r.revision++;fixture.saveRoom(r);}finally{fixture.close();}
 await page.reload();await page.locator('.season-strip').waitFor();await page.locator('[data-action="life-open"]').first().click();await page.locator('[data-life-incident]').waitFor();assert(!(await page.locator('.life-event-text').textContent()).includes('전에 나눴던'));assert((await page.locator('.life-event-text').textContent()).includes('어젯밤 잘 못 잤어?'));
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.locator('.modal').screenshot({path:new URL('../test-results/daily-setback-mobile.png',import.meta.url).pathname});
 const current=await get(),expected=current.season.dailyLife.entries.find(e=>e.id===entry.id).choices.find(c=>c.id==='join').effects;await page.locator('#modal-root [data-action="life-answer"][data-choice="join"]').click();await page.locator('[data-life-effects]').waitFor();const answered=await get(),after=answered.players[0].character;for(const key of ['condition','fatigue','stress'])assert.equal(after[key],before[key]+(expected[key]||0));assert.deepEqual(answered.season.dailyLife.entries.find(e=>e.id===entry.id).incidentEffects,entry.incidentEffects);
 const duplicate=await context.request.post(route+'/life',{data:{turn:answered.season.turn,seasonId:answered.season.id,entryId:entry.id,choice:'join'}});assert.equal(duplicate.status(),409);assert.deepEqual((await get()).players[0].character,after);assert.deepEqual(errors,[]);
 console.log('Daily setbacks browser passed: actual occurrence effects, one question, legacy callback removal, no repeat on reopen, mitigation, duplicate rejection and mobile fit.');
}finally{await browser.close();}
