import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Store} from '../lib/store.mjs';
import {settleDay} from '../lib/season.mjs';
import {beginLiveMatch,advanceLiveMatch} from '../lib/live-match.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const response=await context.request.post(path,{data});assert(response.ok(),await response.text());return response.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'StreamHost',team:'T1',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르'],style:'균형 운영'}}})).ok());
 const initial=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+initial.code;await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});
 const mutate=fn=>{const db=new Store(process.env.DATA_FILE);try{const r=db.room(initial.code);fn(r);r.revision++;db.saveRoom(r);}finally{db.close();}};
 mutate(r=>{const match={id:'stream-browser',date:r.season.date,stage:'LCK',round:'테스트',teamA:'T1',teamB:'JDG',bestOf:3,status:'scheduled'};r.season.schedule.push(match);const sample=structuredClone(r);settleDay(sample,{npcTakeover:true});const archived=sample.season.results.find(m=>m.id===match.id);for(let i=0;i<32;i++)r.season.results.push({...structuredClone(archived),id:'archived-stream-'+i,date:'2026-01-01'});const pending=structuredClone(r),summary=settleDay(pending,{npcTakeover:true});summary.npcTakeover=true;beginLiveMatch(r,pending,summary,{interactive:true,stepMs:1e9});advanceLiveMatch(r,Date.now()+1e12);assert(r.liveMatch.intermission);});
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),initial.code);await page.goto('/');await page.locator('[data-strategy-break]').waitFor();
 const full=(await(await context.request.get(route)).json()).room,fullBytes=Buffer.byteLength(JSON.stringify(full));let requests=0,responseData,release;const gate=new Promise(resolve=>release=resolve);
 await page.route('**/api/rooms/*/set-strategy',async handler=>{requests++;assert.equal(handler.request().postDataJSON().liveUpdate,true);const response=await handler.fetch();responseData=await response.json();await gate;const headers={...response.headers()};delete headers['content-encoding'];delete headers['content-length'];await handler.fulfill({status:response.status(),headers,json:responseData});});
 await page.locator('[data-action="set-strategy"][data-plan="teamfight"]').click();await page.locator('[data-strategy-progress]:visible').waitFor();assert(await page.locator('[data-action="set-strategy"]').first().isDisabled());await page.evaluate(()=>document.querySelector('[data-action="set-strategy"]').click());assert.equal(requests,1);release();
 await page.waitForFunction(()=>!document.querySelector('[data-strategy-break]'));assert(responseData.roomPatch);assert(!responseData.roomPatch.view.season);const bytes=Buffer.byteLength(JSON.stringify(responseData));assert(bytes<fullBytes/5);assert.equal(await page.locator('[data-live-event]').count(),1);assert.equal(responseData.roomPatch.view.broadcast.activeSet,2);assert(!responseData.roomPatch.view.broadcast.sets[1].completed);assert(!('winner'in responseData.roomPatch.view.broadcast.sets[1]));
 mutate(r=>{r.liveMatch.stepMs=1400;r.liveMatch.startedAt=Date.now()-1e9;});
 const streamed=await page.waitForResponse(r=>r.url().includes('liveUpdate=1')&&r.status()===200);const update=await streamed.json();assert(update.roomPatch);assert(!update.roomPatch.view.season);assert.equal(update.roomPatch.view.broadcast.sets[1].events.length,2);assert.equal(update.roomPatch.view.broadcast.activeSet,2);assert(!update.roomPatch.view.broadcast.sets[1].completed);await page.locator('[data-live-event]').nth(1).waitFor();assert.equal(await page.locator('[data-strategy-break]').count(),0);assert.deepEqual(errors,[]);
 console.log(`Live performance browser passed: immediate progress, one strategy request, ${fullBytes} → ${bytes} bytes, live patches and one scene after delayed polling without future results.`);
}finally{await browser.close();}
