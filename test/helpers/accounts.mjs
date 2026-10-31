// Test fixtures create real, one-use invitations in disposable databases.
// There is no test-only bypass in the application server.
import {randomUUID} from 'node:crypto';
import {Store} from '../../lib/store.mjs';
import {issueInvitation} from '../../lib/accounts.mjs';
const servers=new Map();
export function registerTestServer(base,file){servers.set(base,file);}
export function testInvitation(file,role='member'){
 const store=new Store(file);try{return issueInvitation(store,{role}).code;}finally{store.close();}
}
export async function ensureTestAccount(server,actor){
 if(actor.cookie)return;
 const file=servers.get(server.base);if(!file)throw new Error('Register the disposable test server before creating accounts.');
 const username='test_'+randomUUID().replaceAll('-','').slice(0,18),invitation=testInvitation(file);
 const response=await fetch(server.base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'test-password-2026',nickname:username,invitation})});
 if(!response.ok)throw new Error('Test account failed: '+await response.text());
 actor.cookie=response.headers.get('set-cookie').split(';')[0];
}
export async function authenticatedBrowserContext(browser,options){
 const context=await browser.newContext({...options,baseURL:options?.baseURL||process.env.BASE_URL||'http://127.0.0.1:3000'});if(!process.env.DATA_FILE)throw new Error('Browser smoke tests require a disposable DATA_FILE.');
 const username='browser_'+randomUUID().replaceAll('-','').slice(0,16);
 const response=await context.request.post('/api/auth/register',{data:{username,password:'browser-password-2026',nickname:username,invitation:testInvitation(process.env.DATA_FILE)}});
 if(!response.ok())throw new Error('Browser account failed: '+await response.text());
 return context;
}
