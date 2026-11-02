import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Store} from '../lib/store.mjs';
import {authenticatedBrowserContext} from './helpers/accounts.mjs';
assert(process.env.DATA_FILE?.startsWith('/tmp/'));
const {chromium}=createRequire(import.meta.url)('playwright'),baseURL=process.env.BASE_URL,browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 assert((await context.request.put('/api/slots/0',{data:{character:{name:'선수',nickname:'FastChat',team:'T1',position:'MID',age:22,mainChampion:'아리',pool:['아리'],style:'균형 운영'}}})).ok());
 const response=await context.request.post('/api/rooms',{data:{slot:0,chooseTeam:true,waitingRoom:true}});assert(response.ok(),await response.text());const room=(await response.json()).room;
 await context.addInitScript(code=>{localStorage.setItem('first-team.room',code);localStorage.setItem('first-team.owner-dock','1');},room.code);
 await page.goto('/');await page.locator('#lobby-chat-text').waitFor();await page.locator('#owner-dock-text').fill('작성 중인 대화');
 await page.evaluate(()=>{window.chatInput=document.querySelector('#owner-dock-text');window.gamePanel=document.querySelector('#app').firstElementChild;});
 let chatRequests=0;page.on('request',r=>{if(r.url().includes('/messages?'))chatRequests++;});
 const started=Date.now(),db=new Store(process.env.DATA_FILE);try{db.addMessage(room.code,{channel:'owner',senderId:'peer',senderName:'다른 참가자',text:'빠른 새 메시지',at:new Date().toISOString()});}finally{db.close();}
 await page.locator('.owner-dock-log').getByText('빠른 새 메시지',{exact:true}).waitFor({timeout:2500});const elapsed=Date.now()-started;
 assert(chatRequests>0);assert(elapsed<2000,`Chat took ${elapsed}ms`);assert.equal(await page.locator('#owner-dock-text').inputValue(),'작성 중인 대화');
 assert(await page.evaluate(()=>window.chatInput===document.querySelector('#owner-dock-text')&&window.gamePanel===document.querySelector('#app').firstElementChild),'Chat must not rebuild the page or input');
 await page.locator('.assembly-messages').getByText('빠른 새 메시지',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log(`Fast chat browser passed: ${elapsed}ms delivery, chat-only requests, intact game DOM and draft, dock and lobby updated.`);
}finally{await browser.close();}
