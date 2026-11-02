import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../lib/store.mjs';
test('public directory projects only recruiting metadata and excludes old, invalid, empty, full and closed rooms',()=>{
 const store=new Store(':memory:');try{
  const room={code:'OPEN',name:'공개 모집',visibility:'public',hostId:'SECRET-HOST',createdAt:'2026-01-01',lobby:{status:'waiting'},season:{year:2026,date:'2026-01-12',difficulty:'normal',seed:'SECRET-SEED',finished:false},players:[{userId:'host',character:{position:'MID',nickname:'SECRET-NICK',memo:'SECRET-MEMO'}}]};
  store.saveRoom(room);store.saveRoom({...structuredClone(room),code:'OLD',visibility:undefined});store.saveRoom({...structuredClone(room),code:'PRIVATE',visibility:'private'});store.saveRoom({...structuredClone(room),code:'EMPTY',players:[]});store.saveRoom({...structuredClone(room),code:'FULL',players:Array.from({length:5},(_,i)=>({userId:'p'+i,character:{position:['TOP','JGL','MID','ADC','SUP'][i]}}))});
  store.saveRoom({...structuredClone(room),code:'SELECT',lobby:{status:'selecting'}});store.saveRoom({...structuredClone(room),code:'START',lobby:{status:'started'}});store.saveRoom({...structuredClone(room),code:'END',season:{...room.season,finished:true}});store.db.prepare('INSERT INTO rooms VALUES(?,?)').run('BROKEN','invalid JSON');
  const rows=store.publicRooms('visitor');assert.equal(rows.length,1);assert.deepEqual(rows[0].openPositions,['TOP','JGL','ADC','SUP']);assert.equal(rows[0].isMember,false);assert.equal(store.publicRooms('host')[0].isMember,true);assert(!JSON.stringify(rows).includes('SECRET'));
  room.players.push({userId:'second',character:{position:'TOP'}});store.saveRoom(room);assert.equal(store.publicRooms('visitor')[0].memberCount,2);assert(!store.publicRooms('visitor')[0].openPositions.includes('TOP'));
  room.visibility='private';store.saveRoom(room);assert.equal(store.publicRooms('visitor').length,0);room.visibility='public';room.lobby.status='selecting';store.saveRoom(room);assert.equal(store.publicRooms('visitor').length,0);
 }finally{store.close();}
});
