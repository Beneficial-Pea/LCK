// Run against a disposable server: DATA_FILE=... BASE_URL=... node test/notices-browser.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {testInvitation,authenticatedBrowserContext} from './helpers/accounts.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const baseURL=process.env.BASE_URL||'http://127.0.0.1:3199';
assert(process.env.DATA_FILE,'Use a disposable DATA_FILE');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const errors=[];
try{
 const admin=await browser.newContext({baseURL,viewport:{width:1440,height:1000}});
 const registration=await admin.request.post('/api/auth/register',{data:{username:'notice_admin_'+Date.now(),password:'notice123',nickname:'공지운영자'+Date.now().toString().slice(-6),invitation:testInvitation(process.env.DATA_FILE,'admin')}});assert(registration.ok());
 const page=await admin.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.locator('[data-action="nav"][data-view="notices"]').first().click();
 await page.locator('.notice-card').first().waitFor();const initialCount=await page.locator('.notice-card').count();assert(initialCount>=2);
 await page.locator('[data-action="notice-new"]').click();let form=page.locator('[data-form="notice"]');
 await form.locator('[name="title"]').fill('업데이트 공지 테스트');await form.locator('[name="category"]').selectOption('업데이트');await form.locator('[name="pinned"]').check();
 const body='첫 번째 줄\n두 번째 줄\n<script>window.noticeInjected=true</script>';
 await form.locator('[name="body"]').fill(body);await form.locator('[type="submit"]').click();
 const card=page.locator('.notice-card').filter({hasText:'업데이트 공지 테스트'});await card.waitFor();assert.equal(await card.locator('.notice-copy').textContent(),body);assert.equal(await page.evaluate(()=>window.noticeInjected),undefined);
 await card.locator('[data-action="notice-edit"]').click();form=page.locator('[data-form="notice"]');await form.locator('[name="title"]').fill('수정된 업데이트');await form.locator('[type="submit"]').click();await page.getByRole('heading',{name:'수정된 업데이트',exact:true}).waitFor();
 const member=await authenticatedBrowserContext(browser,{baseURL,viewport:{width:390,height:844}}),mobile=await member.newPage();mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('/');await mobile.locator('[data-action="mobile-menu"]').click();await mobile.locator('#modal-root [data-view="notices"]').click();await mobile.getByRole('heading',{name:'수정된 업데이트',exact:true}).waitFor();
 assert.equal(await mobile.locator('[data-action="notice-new"],[data-action="notice-edit"],[data-action="notice-delete"]').count(),0);
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});await mobile.screenshot({path:new URL('../test-results/notices-mobile.png',import.meta.url).pathname,fullPage:true});await page.screenshot({path:new URL('../test-results/notices-desktop.png',import.meta.url).pathname,fullPage:true});
 const edited=page.locator('.notice-card').filter({hasText:'수정된 업데이트'});await edited.locator('[data-action="notice-delete"]').click();await edited.locator('[data-action="notice-cancel-delete"]').click();assert.equal(await edited.count(),1);await edited.locator('[data-action="notice-delete"]').click();await edited.locator('[data-action="notice-confirm-delete"]').click();await edited.waitFor({state:'detached'});
 await page.reload();await page.locator('[data-view="notices"]').first().click();await page.locator('.notice-card').first().waitFor();assert.equal(await page.locator('.notice-card').count(),initialCount);assert.deepEqual(errors,[]);
 console.log('Notices browser passed: admin create/edit/delete, escaped multiline text, member read-only, mobile navigation/width, refresh persistence.');
}finally{await browser.close();}
