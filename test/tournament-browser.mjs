// Run only against a disposable test server with DATA_FILE and BASE_URL set.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { Store } from '../lib/store.mjs';
import { settleDay } from '../lib/season.mjs';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
assert(process.env.DATA_FILE&&process.env.BASE_URL,'Use a disposable DATA_FILE and BASE_URL');
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({baseURL:process.env.BASE_URL,viewport:{width:1440,height:1000}}),errors=[],checks=[];
const request=async(route,data,method='POST')=>{const res=await context.request.fetch(route,{method,data});assert(res.ok(),await res.text());return res.json();};
const output=new URL('../test-results/',import.meta.url);await mkdir(output,{recursive:true});
let store;
try{
 await request('/api/session',undefined,'GET');
 await request('/api/slots/0',{character:{name:'대진검증',nickname:'BracketTester',age:24,position:'MID',mainChampion:'아리',pool:['아리','오리아나'],team:'T1',background:'veteran'}},'PUT');
 const {room:created}=await request('/api/rooms',{slot:0,year:2026,seed:'browser-brackets'});
 store=new Store(process.env.DATA_FILE);const room=store.room(created.code);
 await context.addInitScript(code=>localStorage.setItem('first-team.room',code),created.code);
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
 const checkpoints=[['2026-02-06','[data-lck-stage="cupPlayin"]'],['2026-02-13','[data-lck-stage="cupPlayoffs"]'],['2026-03-17','[data-active-tournament="fst"]'],['2026-04-15','[data-lck-stage="regular"]'],['2026-05-05','[data-active-tournament="ewcRoad"]'],['2026-06-07','[data-active-tournament="road"]'],['2026-06-29','[data-active-tournament="msiPlayin"]'],['2026-07-06','[data-active-tournament="msiMain"]'],['2026-07-15','[data-active-tournament="ewc"]'],['2026-07-18','[data-tournament-board="ewcPlayoffs"]'],['2026-08-27','[data-lck-stage="playin"]'],['2026-09-02','[data-lck-stage="playoffs"]'],['2026-10-05','[data-active-tournament="demacia"]'],['2026-11-08','[data-active-tournament="worldsKnockout"]']];
 for(const [date,selector] of checkpoints){
  while(room.season.date<date)settleDay(room,{npcTakeover:true});
  store.saveRoom(room);await page.goto('/');await page.locator('.season-strip').waitFor();
  const panel=page.locator(selector);await panel.waitFor();await panel.scrollIntoViewIfNeeded();
  assert(!(await panel.textContent()).includes('undefined'),date);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:1000});
   const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));assert(sizes.page<=sizes.viewport+1,`${date} @${width} overflow: ${JSON.stringify(sizes)}`);
   if(date==='2026-02-13'||date==='2026-07-06'){await panel.locator('h2').scrollIntoViewIfNeeded();await page.screenshot({path:new URL(`bracket-${date}-${width}.png`,output).pathname});}
  }
  checks.push(date+' '+selector);
 }
 await page.locator('[data-action="awards"]').click();await page.locator('.award-winner').waitFor();assert.equal(await page.locator('.all-pro-grid .position-badge').count(),15);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',checks,browserErrors:errors},null,2));
}finally{store?.close();await browser.close();}
