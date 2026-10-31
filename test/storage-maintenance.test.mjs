import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';

test('migration maintenance is healthy for Render but blocks visitors and never opens or creates a database',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'storage-maintenance-')),file=path.join(folder,'unopened','game.sqlite');let child;
 try{
  child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:'0',HOST:'127.0.0.1',DATA_FILE:file,STORAGE_MAINTENANCE:'1'},stdio:['ignore','pipe','pipe']});
  const base=await new Promise((resolve,reject)=>{let output='';const timeout=setTimeout(()=>reject(new Error('Maintenance startup timeout')),10000);child.stdout.on('data',chunk=>{output+=chunk;const port=output.match(/listening on port (\d+)/)?.[1];if(port){clearTimeout(timeout);resolve('http://127.0.0.1:'+port);}});child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Maintenance exited unexpectedly'));});});
  const healthy=await fetch(base+'/healthz');assert.equal(healthy.status,200);assert.deepEqual(await healthy.json(),{status:'maintenance'});
  for(const [route,method]of [['/','GET'],['/api/session','GET'],['/api/auth/register','POST'],['/api/rooms','POST']]){
   const response=await fetch(base+route,{method});assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('set-cookie'),null);
  }
  await assert.rejects(()=>stat(file),e=>e.code==='ENOENT');await assert.rejects(()=>stat(path.dirname(file)),e=>e.code==='ENOENT');
 }finally{if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}await rm(folder,{recursive:true,force:true});}
});
