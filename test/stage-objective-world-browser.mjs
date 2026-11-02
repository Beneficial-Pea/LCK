// DATA_FILE must point to a disposable /tmp/ database served at BASE_URL.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Store} from '../lib/store.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
import {getRoster,seasonShared} from '../lib/season.mjs';
import {getWorldCandidates,applyWorldEvent} from '../lib/world-events.mjs';
import {recordStageWrapUps} from '../lib/stage-wrapups.mjs';
import {beginLiveMatch} from '../lib/live-match.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3213';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const res=await context.request.post(path,{data});assert(res.ok(),await res.text());return res.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'StagePlayer',team:'T1',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르','오리아나'],style:'균형 운영'}}})).ok());
 const initial=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+initial.code;await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),initial.code);
 const mutate=fn=>{const db=new Store(process.env.DATA_FILE);try{const room=db.room(initial.code);const result=fn(room);room.revision++;db.saveRoom(room);return result;}finally{db.close();}};
 const get=async()=>(await(await context.request.get(route)).json()).room;
 mutate(r=>applyWorldEvent(r,{id:'foreign-only',type:'injury',targetId:getWorldCandidates(r,getRoster(r)).find(c=>c.team==='Gen.G').id},getWorldCandidates(r,getRoster(r))));
 await page.goto('/');await page.locator('.season-strip').waitFor();assert.equal(await page.locator('[data-world-event-popup]').count(),0);
 let npcName;
 mutate(r=>{const all=getWorldCandidates(r,getRoster(r)),npc=all.find(c=>c.team==='T1'&&c.npc);npcName=npc.nickname;applyWorldEvent(r,{id:'own-npc',type:'injury',targetId:npc.id},all);});
 await page.reload();await page.locator('[data-world-event-popup="own-npc"]').waitFor();assert((await page.locator('#modal-root').textContent()).includes(npcName));assert((await page.locator('#modal-root').textContent()).includes('피지컬 -2'));await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.reload();await page.locator('.season-strip').waitFor();assert.equal(await page.locator('[data-world-event-popup]').count(),0);
 mutate(r=>applyWorldEvent(r,{id:'own-patch',type:'champion-nerf',champion:'아리'},getWorldCandidates(r,getRoster(r))));
 await page.reload();await page.locator('[data-world-event-popup="own-patch"]').waitFor();assert((await page.locator('#modal-root').textContent()).includes('StagePlayer'));assert((await page.locator('#modal-root').textContent()).includes('라인전 -2'));
 const after=(await get()).players[0].character;await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.locator('[data-action="world-event-open"][data-id="own-patch"]').click();await page.locator('[data-world-event-popup="own-patch"]').waitFor();assert.deepEqual((await get()).players[0].character,after);await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../test-results/world-popup-mobile.png',import.meta.url).pathname,fullPage:true});await page.locator('#modal-root [data-action="close-modal"]').first().click();
 mutate(r=>{const m=r.season.schedule.find(m=>m.id==='pi-2');Object.assign(m,{teamA:'T1',teamB:'Gen.G',status:'completed',result:{winner:'Gen.G'}});recordStageWrapUps(r,{});});
 await page.reload();await page.locator('[data-stage-wrap="stage-playin"]').waitFor();assert.equal(await page.locator('[data-action="tournament-reward"][data-id="stage-playin"]').count(),0);assert((await page.locator('#modal-root').textContent()).includes('우리끼리 잘해보자고 했잖아'));await page.screenshot({path:new URL('../test-results/stage-wrap-mobile.png',import.meta.url).pathname,fullPage:true});await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.reload();await page.locator('.season-strip').waitFor();assert.equal(await page.locator('[data-stage-wrap]').count(),0);assert.equal(await page.locator('[data-action="tournament-reward"][data-id="stage-playin"]').count(),0);
 mutate(r=>{const id=r.season.tournaments.fixtureIds.road[2],m=r.season.schedule.find(m=>m.id===id);Object.assign(m,{teamA:'T1',teamB:'Gen.G',status:'completed',result:{winner:'T1'}});recordStageWrapUps(r,{});});
 await page.reload();await page.locator('[data-stage-wrap="stage-road"]').waitFor();assert.equal(await page.locator('#modal-root h2').first().textContent(),'MSI 진출 확정');assert.equal(await page.locator('[data-stage-wrap="stage-road"] h3').textContent(),'MSI 진출 확정!');assert(!(await page.locator('#modal-root').textContent()).includes('다음 단계'));await page.locator('.modal').screenshot({path:'/tmp/lck-msi-qualified.png'});await page.locator('#modal-root [data-action="close-modal"]').first().click();
 mutate(r=>{const all=getWorldCandidates(r,getRoster(r)),target=all.find(c=>c.team==='T1'&&c.npc);for(const id of ['queue-one','queue-two'])applyWorldEvent(r,{id,type:'injury',targetId:target.id},all);});
 await page.reload();await page.locator('[data-world-event-popup="queue-two"]').waitFor();await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.locator('[data-world-event-popup="queue-one"]').waitFor();await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.reload();await page.locator('.season-strip').waitFor();assert.equal(await page.locator('[data-world-event-popup]').count(),0);
 // Use a real simulated live series and stop on a published mid-game snapshot.
 const expected=mutate(r=>{
  const pending=structuredClone(r),match={id:'browser-objectives',date:r.season.date,stage:'LCK',round:'테스트',teamA:'T1',teamB:'JDG',bestOf:3,status:'scheduled'};pending.season.schedule.push(match);seasonShared.runMatch(pending,match);
  beginLiveMatch(r,pending,{date:r.season.date,matches:[match.id]},{stepMs:1e9});const live=r.liveMatch,game=pending.season.results.find(m=>m.id===match.id);
  const cursor=live.frames.findIndex(f=>{const o=game.result.sets[f.setIndex].events[f.eventIndex].objectives;return f.setIndex===0&&o.grubs.reduce((a,b)=>a+b,0)===3&&o.towers.some(v=>v>0);});assert(cursor>=0);live.cursor=cursor;live.startedAt=Date.now()-cursor*live.stepMs;const frame=live.frames[cursor];return game.result.sets[0].events[frame.eventIndex].objectives;
 });
 await page.setViewportSize({width:1440,height:1000});await page.reload();await page.locator('[data-objective-board]').waitFor();
 for(const side of [0,1])for(const key of ['dragons','grubs','towers'])assert.equal(await page.locator(`[data-objective-side="${side}"] [data-objective="${key}"]`).getAttribute('data-count'),String(expected[key][side]));
 await page.locator('[data-objective-board]').screenshot({path:new URL('../test-results/objective-board-desktop.png',import.meta.url).pathname});await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('[data-objective-board]').screenshot({path:new URL('../test-results/objective-board-mobile.png',import.meta.url).pathname});assert.deepEqual(errors,[]);
 console.log('Stage/objective/world browser passed: foreign-news silence, own NPC effects, signature nerf, dismissal/reopen, stage closure, actual visible objective counts and mobile fit.');
}finally{await browser.close();}
