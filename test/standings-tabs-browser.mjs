import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Store} from '../lib/store.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL||'http://127.0.0.1:3220';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const res=await context.request.post(path,{data});assert(res.ok(),await res.text());return res.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'RankTabsPlayer',team:'T1',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르'],style:'균형 운영'}}})).ok());
 const room=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+room.code;await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});
 const mutate=fn=>{const db=new Store(process.env.DATA_FILE);try{const r=db.room(room.code);fn(r);r.revision++;db.saveRoom(r);}finally{db.close();}};
 mutate(r=>{r.season.date='2026-07-15';r.season.turn=185;Object.assign(r.season.standings.find(t=>t.team==='T1'),{wins:12,losses:4,setWins:26,setLosses:10});});
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);await page.goto('/');await page.locator('.home-quick-access').waitFor();
 const open=async()=>{await page.locator('[data-action="standings-modal"]').click();await page.locator('#modal-root [data-lck-stage="regular"]').waitFor();assert((await page.locator('#modal-root .standings tbody tr').first().textContent()).includes('12'));};
 const tournament=()=>page.locator('[data-action="standings-tab"][data-tab="tournament"]').click();
 await open();assert.equal(await page.locator('#modal-root [role="tab"]').count(),3);await tournament();assert.equal(await page.locator('#modal-root [data-active-tournament]').count(),0);assert.equal(await page.locator('#modal-root [data-tournament-offseason]').count(),0);assert(!(await page.locator('#modal-root').textContent()).includes('아직 대진이 확정되지 않았습니다'));assert.equal(await page.locator('#modal-root .qual-card').count(),5);await page.locator('#modal-root [data-action="close-modal"]').first().click();
 mutate(r=>{const id=r.season.tournaments.fixtureIds.ewc[0];Object.assign(r.season.schedule.find(m=>m.id===id),{teamA:'T1',teamB:'G2',status:'scheduled'});});
 await page.reload();await page.locator('.home-quick-access').waitFor();await open();await tournament();await page.locator('#modal-root [data-active-tournament="ewc"]').waitFor();assert.equal(await page.locator('#modal-root [data-lck-stage="regular"]').count(),0);await page.locator('[data-action="standings-tab"][data-tab="team"]').click();await page.locator('#modal-root [data-lck-stage="regular"]').waitFor();assert((await page.locator('#modal-root .standings tbody tr').first().textContent()).includes('12'));
 await page.setViewportSize({width:390,height:844});await tournament();await page.locator('#modal-root [data-active-tournament="ewc"]').waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.locator('.modal').screenshot({path:new URL('../test-results/standings-tournament-tabs-mobile.png',import.meta.url).pathname});await page.locator('#modal-root [data-action="close-modal"]').first().click();
 mutate(r=>{r.season.date='2026-07-20';r.season.turn=190;});await page.reload();await page.locator('.home-quick-access').waitFor();await open();await tournament();await page.locator('[data-tournament-offseason]').waitFor();assert.equal(await page.locator('#modal-root [data-active-tournament]').count(),0);assert((await page.locator('[data-tournament-offseason]').textContent()).includes('현재는 대회 진행 기간이 아닙니다.'));await page.locator('#modal-root [data-action="close-modal"]').first().click();
 const restored=(await(await context.request.get(route)).json()).room;assert.equal(restored.season.standings.find(t=>t.team==='T1').wins,12);assert.deepEqual(errors,[]);
 console.log('Standings tabs browser passed: league accessible during EWC, separate brackets, silent unseeded state, offseason message, tab switching and mobile fit.');
}finally{await browser.close();}
