// Run against a disposable server configured with the test bootstrap invitation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const bootstrap=process.env.FIRST_TEAM_ADMIN_INVITE;assert(bootstrap,'Set FIRST_TEAM_ADMIN_INVITE on the disposable server and this test.');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:3000',browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),errors=[],checks=[];
const output=new URL('../test-results/',import.meta.url);await mkdir(output,{recursive:true});
const owner=await browser.newContext({baseURL,viewport:{width:1440,height:1000}}),page=await owner.newPage();page.on('pageerror',e=>errors.push(e.message));
const password='browser-auth-password-2026';
const fillSignup=async(p,username,nickname,invitation)=>{const form=p.locator('[data-form="auth-register"]');await form.locator('[name="username"]').fill(username);await form.locator('[name="nickname"]').fill(nickname);if(invitation)await form.locator('[name="invitation"]').fill(invitation);await form.locator('[name="password"]').fill(password);await form.locator('[name="passwordConfirm"]').fill(password);await form.locator('[type=submit]').click();};
try{
 await page.goto('/');await page.locator('[data-form="auth-login"]').waitFor();assert.equal(await page.locator('.shell').count(),0);assert.equal((await owner.request.get('/api/meta')).status(),401);
 await page.screenshot({path:new URL('auth-login-desktop.png',output).pathname});checks.push('anonymous visitors see login and cannot access game APIs');
 await page.locator('[data-auth-mode="register"]').click();await fillSignup(page,'browser_owner','초대관리자',bootstrap);await page.locator('.welcome-hero').waitFor();assert.equal(await page.locator('.user-name').textContent(),'초대관리자');
 await page.locator('.sidebar [data-view="invites"]').click();await page.locator('[data-form="issue-invitation"] [type=submit]').click();await page.locator('[data-issued-invitation]').waitFor();
 const inviteLink=await page.locator('[data-issued-invitation] input').inputValue();checks.push('operator invitation creates admin; admin issues a one-use invitation link');
 const friend=await browser.newContext({baseURL,viewport:{width:390,height:844}}),peer=await friend.newPage();peer.on('pageerror',e=>errors.push(e.message));
 await peer.goto(inviteLink);await peer.locator('[data-form="auth-register"]').waitFor();assert(!peer.url().includes('invite='));assert((await peer.locator('[name="invitation"]').inputValue()).length>=24);
 const size=await peer.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(size.scroll<=size.width+1);await peer.screenshot({path:new URL('auth-invite-mobile.png',output).pathname});
 await fillSignup(peer,'browser_friend','친구닉네임');await peer.locator('.welcome-hero').waitFor();assert.equal(await peer.locator('.user-name').count(),1);assert.equal(await peer.locator('[data-view="invites"]').count(),0);checks.push('invite link opens signup, nickname is saved, and members have no admin menu');
 const saved=await friend.request.put('/api/slots/0',{data:{character:{name:'계정선수',nickname:'AuthPlayer',age:21,team:'T1',position:'MID',autoChampions:true,style:'한타'}}});assert(saved.ok());
 const another=await browser.newContext({baseURL,viewport:{width:1280,height:900}}),other=await another.newPage();other.on('pageerror',e=>errors.push(e.message));await other.goto('/');
 const login=other.locator('[data-form="auth-login"]');await login.locator('[name="username"]').fill('browser_friend');await login.locator('[name="password"]').fill(password);await login.locator('[type=submit]').click();await other.locator('.welcome-hero').waitFor();
 const restored=await (await another.request.get('/api/session')).json();assert.equal(restored.slots[0].nickname,'AuthPlayer');assert.equal(restored.user.name,'친구닉네임');checks.push('another browser signs into the same account and restores its character slot');
 await page.locator('[data-action="refresh-invitations"]').click();await page.waitForFunction(()=>document.querySelector('.invitation-row')?.textContent.includes('가입 완료'));assert((await page.locator('.invitation-row').first().textContent()).includes('가입 완료'));
 await page.locator('.user-block').click();const profile=page.locator('[data-form="profile"]');await profile.locator('[name="name"]').fill('변경된관리자');await profile.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('.user-name')?.textContent==='변경된관리자');
 await page.locator('.user-block').click();await page.locator('[data-action="logout"]').click();await page.locator('[data-form="auth-login"]').waitFor();assert.equal((await owner.request.get('/api/invitations')).status(),401);checks.push('nickname can be changed; logout returns to the gate and revokes access');
 const relog=page.locator('[data-form="auth-login"]');await relog.locator('[name="username"]').fill('browser_owner');await relog.locator('[name="password"]').fill(password);await relog.locator('[type=submit]').click();await page.locator('.welcome-hero').waitFor();assert.equal(await page.locator('.user-name').textContent(),'변경된관리자');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',checks,browserErrors:errors},null,2));
 await friend.close();await another.close();
}finally{await browser.close();}
