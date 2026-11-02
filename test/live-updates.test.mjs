import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeLiveRoom} from '../public/live-updates.js';
const current=()=>({code:'A',me:'u',revision:5,season:{id:'season',turn:10,results:[{id:'past'}]},broadcast:{id:'live',activeSet:1}});
const patch=()=>({code:'A',seasonId:'season',turn:10,liveId:'live',view:{code:'A',me:'u',revision:6,broadcast:{id:'live',activeSet:2},messages:[]}});
test('live patches retain the exact received season history and update public room fields without mutation',()=>{
 const room=current(),update=patch(),before=structuredClone(room),merged=mergeLiveRoom(room,update);assert.equal(merged.season,room.season);assert.equal(merged.season.results,room.season.results);assert.equal(merged.broadcast.activeSet,2);assert.equal(merged.revision,6);assert.deepEqual(room,before);
});
test('stale updates cannot rewind a resumed set; patches from other rooms, accounts or seasons require full refresh',()=>{
 const room=current(),stale=patch();stale.view.revision=4;assert.equal(mergeLiveRoom(room,stale),room);
 for(const change of [p=>p.code='B',p=>p.seasonId='new-season',p=>p.turn++,p=>p.liveId='new-live',p=>p.view.me='another-user',p=>p.view.season={results:[]},p=>p.view.revision=null]){const p=patch();change(p);assert.equal(mergeLiveRoom(room,p),null);}
});
