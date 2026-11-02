import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Store} from '../lib/store.mjs';
import {simulateSeries} from '../lib/match.mjs';
import {beginLiveMatch} from '../lib/live-match.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
async function checkWidth(page){const info=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].map(n=>({tag:n.tagName,cls:n.className,left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right})).filter(n=>n.right>innerWidth+1).slice(0,15)}));if(info.scroll>info.width+1)console.log(JSON.stringify(info));assert(info.scroll<=info.width+1);}
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const post=async(path,data)=>{const r=await context.request.post(path,{data});assert(r.ok(),await r.text());return r.json();};
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'기록',nickname:'RecordsPlayer',team:'T1',position:'MID',age:22,mainChampion:'아리',pool:['아리'],style:'균형 운영'}}})).ok());
 const room=(await post('/api/rooms',{slot:0,year:2026})).room,route='/api/rooms/'+room.code;await post(route+'/cup-draft',{turn:1,pickNumber:1,remaining:true});
 const result=simulateSeries({teamA:{name:'T1'},teamB:{name:'JDG'},bestOf:5,seed:'side-browser',selectionRight:true});
 const match={id:'records-browser',date:room.season.date,stage:'EWC',round:'결승',teamA:'T1',teamB:'JDG',bestOf:5,status:'completed',result};
 const mutate=fn=>{const db=new Store(process.env.DATA_FILE);try{const r=db.room(room.code);fn(r);r.revision++;db.saveRoom(r);}finally{db.close();}};
 mutate(r=>{r.season.results.push(match);r.season.schedule.push(match);});await context.addInitScript(code=>localStorage.setItem('first-team.room',code),room.code);
 await page.goto('/');await page.locator('[data-action="nav"][data-view="match"]').first().click();await page.locator('[data-action="all-events"]').click();
 const panel=page.locator('[data-set-scoreboard]');await panel.waitFor();assert.equal(await panel.locator('tbody tr').count(),10);assert.equal(await panel.locator('[data-side=blue]').getAttribute('data-team'),result.sets[0].draft.assignment.blueTeam);
 await page.locator('[data-action="select-set"][data-index="1"]').click();await page.locator('[data-action="all-events"]').click();assert.equal(await panel.getAttribute('data-set-scoreboard'),'2');assert.equal(await panel.locator('[data-side=blue]').getAttribute('data-team'),result.sets[1].draft.assignment.blueTeam);assert((await panel.locator('[data-set-rights]').textContent()).includes(result.sets[1].draft.assignment.firstPickChoiceTeam));
 await panel.screenshot({path:'/tmp/lck-set-records-desktop.png'});await page.setViewportSize({width:390,height:844});await checkWidth(page);const [blue,red]=await panel.locator('.set-team').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top};}));assert.equal(blue.top,red.top);assert(Math.abs(blue.right-red.left)<2);await panel.screenshot({path:'/tmp/lck-set-records-mobile.png'});
 // Publish only part of set two and compare the inline records to the visible server projection.
 mutate(r=>{r.season.results=r.season.results.filter(m=>m.id!==match.id);const pending=structuredClone(r);pending.season.results.push(match);beginLiveMatch(r,pending,{matches:[match.id]},{stepMs:1e9});const live=r.liveMatch;live.cursor=live.frames.findIndex(f=>f.setIndex===1&&f.eventIndex===4);live.startedAt=Date.now()-live.cursor*live.stepMs;});
 await page.reload();await page.locator('[data-live-match]').waitFor();await panel.waitFor();assert.equal(await panel.getAttribute('data-set-scoreboard'),'2');const current=(await(await context.request.get(route)).json()).room.broadcast.sets.find(s=>s.number===2);assert(!current.completed);assert(!('winner'in current));for(const p of current.scoreboard){const row=panel.locator('tbody tr').filter({hasText:p.nickname});assert((await row.textContent()).includes(`${p.k} / ${p.d} / ${p.a}`));}await checkWidth(page);assert.deepEqual(errors,[]);
 console.log('Set records browser passed: two columns, per-set sides and rights, replay switching, mobile fit and live KDA without future results.');
}finally{await browser.close();}
