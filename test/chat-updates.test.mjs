import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages} from '../public/chat-updates.js';
test('chat deltas deduplicate, remain ordered and survive older room snapshots',()=>{
 const old=[{id:3,text:'three'},{id:4,text:'four'}],fresh=mergeMessages(old,[{id:5,text:'five'},{id:4,text:'updated'}]);
 assert.deepEqual(fresh.map(m=>m.id),[3,4,5]);assert.equal(fresh[1].text,'updated');
 assert.deepEqual(mergeMessages(fresh,old,true).map(m=>m.id),[3,4,5]);
 assert.deepEqual(mergeMessages(fresh,[{id:4}],true).map(m=>m.id),[4,5]);
 const bounded=mergeMessages([],Array.from({length:250},(_,i)=>({id:i+1})));
 assert.equal(bounded.length,200);assert.equal(bounded[0].id,51);
 assert.deepEqual(old,[{id:3,text:'three'},{id:4,text:'four'}]);
});
