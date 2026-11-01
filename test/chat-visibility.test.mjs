import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../lib/store.mjs';
test('legacy automatic notices do not consume the conversation window; staff replies and private-message boundaries remain intact',()=>{
 const store=new Store(':memory:');try{
  store.addMessage('ROOM',{channel:'team',senderId:'u',senderName:'매니저',text:'실제 참가자의 오래된 선수단 대화'});
  for(let i=0;i<260;i++)store.addMessage('ROOM',{channel:'team',senderId:'system',senderName:'매니저',text:'자동 정산 안내 '+i});
  for(const senderName of ['코치','분석관'])store.addMessage('ROOM',{channel:'team',senderId:'system',senderName,text:'직접 멘션한 스태프 답변'});
  store.addMessage('ROOM',{channel:'team',senderId:'system',senderName:'매니저',text:'“캘린더 확인해. 준비 행동은 정산 전까지 수정할 수 있어.”'});
  store.addMessage('ROOM',{channel:'team',senderId:'system',senderName:'매니저',kind:'staff-reply',text:'새 형식 스태프 답변'});
  store.addMessage('ROOM',{channel:'dm',senderId:'u',to:'friend',text:'개인 대화'});
  store.addMessage('OTHER',{channel:'team',senderId:'other',text:'다른 방'});
  const own=store.messages('ROOM','u');assert.equal(own.length,6);assert(own.some(m=>m.text==='실제 참가자의 오래된 선수단 대화'));assert(!own.some(m=>m.text.startsWith('자동 정산')));assert(own.some(m=>m.text==='개인 대화'));
  assert(!store.messages('ROOM','outsider').some(m=>m.channel==='dm'));assert(!own.some(m=>m.text==='다른 방'));
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM messages').get().n,267,'Stored history is retained; filtering does not delete records');
 }finally{store.close();}
});
