// Run against a local server with a disposable /tmp/ DATA_FILE.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {Store} from '../lib/store.mjs';
import {recordTournamentFinish} from '../lib/tournament-rewards.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const baseURL=process.env.BASE_URL||'http://127.0.0.1:3211';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const res=await context.request.post(path,{data});assert(res.ok(),await res.text());return res.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'TitlePlayer',position:'MID',age:22,mainChampion:'아리',pool:['아리','아지르'],style:'균형 운영'}}})).ok());
 const room=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+room.code;
 await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);
 const get=async()=>(await(await context.request.get(route)).json()).room;
 const award=(id,won)=>{const db=new Store(process.env.DATA_FILE);try{const r=db.room(room.code);recordTournamentFinish(r,{id,date:r.season.date,stage:id==='cup-final'?'LCK Cup':'MSI',round:'결승',teamA:r.season.team,teamB:'JDG',status:'completed',result:{winner:won?r.season.team:'JDG'}});r.revision++;db.saveRoom(r);}finally{db.close();}};
 award('cup-final',true);await page.goto('/');await page.locator('[data-tournament-reward="title-cup-final"]').waitFor();assert((await page.locator('#modal-root').textContent()).includes('우승했습니다!'));assert((await page.locator('#modal-root').textContent()).includes('멘탈 +0.5'));
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await page.screenshot({path:new URL('../test-results/title-champion.png',import.meta.url).pathname,fullPage:true});
 const before=(await get()).players[0].character;
 await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.reload();await page.locator('.season-strip').waitFor();assert.equal(await page.locator('[data-tournament-reward]').count(),0);
 assert.equal(await page.locator('[data-action="tournament-reward"]').count(),0);assert.deepEqual((await get()).players[0].character,before);
 award('msi-final',true);await page.reload();await page.locator('[data-tournament-reward="title-msi-final"]').waitFor();assert((await page.locator('#modal-root').textContent()).includes('우승했습니다!'));assert.equal(await page.locator('[data-action="tournament-reward"]').count(),0);await page.locator('#modal-root [data-action="close-modal"]').first().click();
 award('worlds-final',false);await page.reload();await page.locator('[data-tournament-reward="title-worlds-final"]').waitFor();assert((await page.locator('#modal-root').textContent()).includes('준우승했습니다!'));assert((await page.locator('#modal-root').textContent()).includes('멘탈 +0.2'));
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const box=await page.locator('.modal').boundingBox();assert(box.x>=0&&box.x+box.width<=390);await page.screenshot({path:new URL('../test-results/title-runner-mobile.png',import.meta.url).pathname,fullPage:true});await page.locator('#modal-root [data-action="close-modal"]').first().click();
 const db=new Store(process.env.DATA_FILE);try{const r=db.room(room.code);r.season.finished=true;r.season.date=r.season.endDate;r.season.turn=r.season.totalTurns;r.revision++;db.saveRoom(r);}finally{db.close();}
 const finished=await get();await page.reload();await page.locator('[data-season-end]').waitFor();assert.equal(await page.locator('.finished-banner,[data-action="tournament-reward"]').count(),0);assert((await page.locator('#modal-root').textContent()).includes('이번 시즌을 마쳤습니다.'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#modal-root [data-action="close-modal"]').first().click();await page.reload();await page.locator('.season-strip').waitFor();assert.equal(await page.locator('[data-season-end],[data-tournament-reward],.finished-banner,[data-action="tournament-reward"]').count(),0);assert.deepEqual((await get()).players,finished.players);assert.deepEqual((await get()).season.tournamentRewards,finished.season.tournamentRewards);assert.deepEqual(errors,[]);
 console.log('Tournament popup browser passed: champion, runner-up, actual effects, MSI win, no persistent banners, one-time season-end popup, unchanged rewards and mobile fit.');
}finally{await browser.close();}
