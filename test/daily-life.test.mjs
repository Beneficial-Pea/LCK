import test from 'node:test';import assert from 'node:assert/strict';import{createSeason,getRoster,settleDay}from'../lib/season.mjs';import{processDailyLife,answerDailyLife,DAILY_SCENE_COUNT}from'../lib/daily-life.mjs';
const room=()=>({players:[{userId:'u',location:'연습실',character:{id:'p',nickname:'Int',name:'인트',team:'T1',position:'MID',mainChampion:'아리',pool:['아리'],stats:{mechanics:65,laning:65,macro:65,communication:65,mental:65,mastery:65},condition:85,fatigue:10,stress:10}}],submissions:{u:{turn:1,action:'rest'}},season:createSeason({year:2026,team:'T1',seed:'life-variety'}),revision:0});
test('quiet days create persistent varied companion stories and never repeat within the recent window',()=>{const r=room();for(let i=0;i<10;i++){processDailyLife(r,getRoster(r));r.season.turn++;}assert.equal(r.season.dailyLife.entries.length,10);assert.equal(new Set(r.season.dailyLife.entries.map(e=>e.scene)).size,10);assert(r.season.dailyLife.entries.every(e=>e.partnerId!=='p'&&e.location==='연습실'));});
test('choices are personal, once-only, expire and affect a remembered relationship without extra turns',()=>{const r=room();settleDay(r);const e=r.season.dailyLife.entries[0],date=r.season.date;assert.throws(()=>answerDailyLife(r,'other',e.id,'join'));const before=r.season.dailyLife.bonds['u:'+e.partnerId].affinity;answerDailyLife(r,'u',e.id,'join');assert.equal(r.season.dailyLife.bonds['u:'+e.partnerId].affinity,before+2);assert.equal(r.season.date,date);assert.throws(()=>answerDailyLife(r,'u',e.id,'join'));});
test('match days do not invent an additional offday and repeat processing is idempotent',()=>{const r=room();processDailyLife(r,getRoster(r));processDailyLife(r,getRoster(r));assert.equal(r.season.dailyLife.entries.length,1);const other=room();other.season.date='2026-01-14';other.season.schedule.push({date:other.season.date,teamA:'T1',teamB:'KT'});processDailyLife(other,getRoster(other));assert.equal(other.season.dailyLife,undefined);});
test('expanded stories keep sixty recent situations distinct, preserve earlier replies and support five players',()=>{
 assert.equal(DAILY_SCENE_COUNT,132);const r=room();
 r.players=Array.from({length:5},(_,i)=>({...structuredClone(r.players[0]),userId:'u'+i,character:{...structuredClone(r.players[0].character),id:'p'+i,position:['TOP','JGL','MID','ADC','SUP'][i]}}));
 for(let day=0;day<90;day++){processDailyLife(r,getRoster(r));r.season.turn++;for(const p of r.players){const items=r.season.dailyLife.entries.filter(e=>e.userId===p.userId);assert.equal(new Set(items.slice(0,60).map(e=>e.scene)).size,Math.min(day+1,60));if(day===0)answerDailyLife(r,p.userId,items[0].id,'join');}}
 assert.equal(r.season.dailyLife.entries.length,450);assert.equal(r.season.dailyLife.entries.filter(e=>e.answer==='join').length,5);
 assert(r.season.dailyLife.entries.every(e=>e.partnerId.startsWith('staff:')),'Never writes dialogue for another human participant');
});

test('dialogue applies server-owned ability and recovery changes once and respects state caps',async()=>{
 const {previewDailyEffects,decorateDailyLife}=await import('../lib/daily-life.mjs');const r=room();settleDay(r);const entry=r.season.dailyLife.entries[0];entry.title='리플레이 내기';entry.choices[0].effects={mechanics:999};
 const before=structuredClone(r.players[0].character),preview=previewDailyEffects(r,entry,'join');assert.equal(preview.macro,.2);assert.equal(preview.communication,.1);
 const result=answerDailyLife(r,'u',entry.id,'join');assert.deepEqual(result.effects,preview);assert.equal(r.players[0].character.stats.macro,Number((before.stats.macro+.2).toFixed(3)));assert.equal(r.players[0].character.stats.mechanics,before.stats.mechanics);const after=structuredClone(r.players[0].character);assert.throws(()=>answerDailyLife(r,'u',entry.id,'join'));assert.deepEqual(r.players[0].character,after);
 const capped=room();settleDay(capped);const e=capped.season.dailyLife.entries[0];e.title='짧은 낮잠';Object.assign(capped.players[0].character,{condition:100,fatigue:0,stress:0});for(const key of Object.keys(capped.players[0].character.stats))capped.players[0].character.stats[key]=99;capped.season.dailyLife.bonds['u:'+e.partnerId].affinity=100;
 decorateDailyLife(capped);assert(Object.values(e.choices.find(c=>c.id==='later').effects).every(value=>value===0));answerDailyLife(capped,'u',e.id,'later');assert.equal(capped.players[0].character.stats.mental,99);assert.equal(capped.players[0].character.condition,100);assert.equal(capped.players[0].character.fatigue,0);
});

test('all 132 scenes have concrete action labels and both study alternatives can use relevant abilities',async()=>{
 const {DAILY_SCENE_TITLES,decorateDailyLife,dailyChoiceEffects}=await import('../lib/daily-life.mjs');const {DAILY_CHOICE_TITLES,dailyChoiceDefinition}=await import('../lib/daily-choices.mjs');
 assert.equal(DAILY_SCENE_TITLES.length,132);assert.deepEqual([...DAILY_SCENE_TITLES].sort(),[...DAILY_CHOICE_TITLES].sort());
 const labels=[];for(const title of DAILY_SCENE_TITLES){const a=dailyChoiceDefinition(title,'join'),b=dailyChoiceDefinition(title,'later');assert.notEqual(a.label,b.label,title);for(const option of [a,b]){assert(option.label.length>=8);assert(!['함께 이야기한다','내 방식으로 답한다'].includes(option.label));assert(Object.keys(option.effects).length>0);labels.push(option.label);}}
 assert.equal(new Set(labels).size,264);
 const r=room();settleDay(r);const pending=r.season.dailyLife.entries[0];pending.title='짧은 낮잠';pending.choices[0].label='함께 이야기한다';pending.choices[1].label='내 방식으로 답한다';
 decorateDailyLife(r);assert.equal(pending.choices[0].label,'10분 뒤에 깨워주기로 한다');assert(pending.choices[1].label.includes('알람을 두 개'));assert(!('condition' in pending.choices[0].effects));assert(!('fatigue' in pending.choices[0].effects));assert(!('condition' in pending.choices[1].effects));
 const before={condition:r.players[0].character.condition,fatigue:r.players[0].character.fatigue};answerDailyLife(r,'u',pending.id,'join');assert.equal(r.players[0].character.condition,before.condition);assert.equal(r.players[0].character.fatigue,before.fatigue);
 assert(dailyChoiceEffects({title:'모의 밴픽'},'later').macro>0);assert(dailyChoiceEffects({title:'연습 종료 시간'},'join').mechanics>0);assert(dailyChoiceEffects({title:'연습 종료 시간'},'later').fatigue<0);
});

test('old callbacks are removed while the current question, saved choice and applied effects remain intact',async()=>{
 const {decorateDailyLife,stripDailyRecall}=await import('../lib/daily-life.mjs');
 const question='개인 훈련을 마치고 손을 털었다. 연습실에서 Ilex이 노래를 흥얼거렸다. "이거 제목 뭐였지?"';
 const endings=['Ilex이 지난번 「야식 영수증」 이야기를 꺼냈다. "그 뒤에는 어떻게 됐어?"','Ilex이 전에 나눴던 일을 다시 꺼냈다. 그때는 긴 주문 내역을 접고 또 접었다. "우리 이만큼 시켰어?"라고 말했었다. "그 뒤에는 어떻게 됐어?"','Ilex이 전에 이름 없는 과자를 먹어도 되는지 물어봤던 일을 다시 꺼냈다. "그 뒤에는 어떻게 됐어?"'];
 for(const tail of endings){
  const r=room(),text=question+' '+tail;r.season.dailyLife={entries:[{id:'old',title:'음악',text,answer:'join',reply:'이미 고른 답',effects:{mental:.1}}],bonds:{}};r.season.history=[{type:'daily-life',text}];
  decorateDailyLife(r);assert.equal(r.season.dailyLife.entries[0].text,question);assert.equal(r.season.history[0].text,question);assert.equal(r.season.dailyLife.entries[0].reply,'이미 고른 답');assert.deepEqual(r.season.dailyLife.entries[0].effects,{mental:.1});assert.equal(stripDailyRecall(question),question);
 }
});

test('all twelve setbacks apply small real state changes once at occurrence and remain recoverable',async()=>{
 const {dailySetbacks}=await import('../lib/daily-setbacks.mjs');const {decorateDailyLife,previewDailyEffects}=await import('../lib/daily-life.mjs');
 const r=room(),seen=new Map();r.season.seed='setback-coverage';
 for(let day=0;day<600&&seen.size<dailySetbacks.length;day++){
  Object.assign(r.players[0].character,{condition:85,fatigue:10,stress:10});const before=structuredClone(r.players[0].character);processDailyLife(r,getRoster(r));const entry=r.season.dailyLife.entries[0];
  assert(!entry.text.includes('전에 나눴던'));assert(!entry.text.includes('그 뒤에는 어떻게 됐어'));
  if(entry.kind==='setback'){
   const spec=dailySetbacks.find(s=>s.scene[0]===entry.title);assert.deepEqual(entry.incidentEffects,spec.effects);for(const [key,delta]of Object.entries(spec.effects))assert.equal(r.players[0].character[key],before[key]+delta);
   assert.deepEqual(r.players[0].character.stats,before.stats);seen.set(entry.title,structuredClone(r));
  }
  const after=structuredClone(r);processDailyLife(r,getRoster(r));assert.deepEqual(r,after);r.season.turn++;
 }
 assert.equal(seen.size,12);
 const sleep=seen.get('수면 부족');sleep.season.turn++;const entry=sleep.season.dailyLife.entries[0],before=structuredClone(sleep.players[0].character),incident=structuredClone(entry.incidentEffects);decorateDailyLife(sleep);assert.deepEqual(sleep.players[0].character,before);
 const expected=previewDailyEffects(sleep,entry,'join');answerDailyLife(sleep,'u',entry.id,'join');assert.deepEqual(entry.effects,expected);assert.deepEqual(entry.incidentEffects,incident);assert.equal(sleep.players[0].character.condition,before.condition+expected.condition);assert.equal(sleep.players[0].character.fatigue,before.fatigue+expected.fatigue);
 const answered=structuredClone(sleep);assert.throws(()=>answerDailyLife(sleep,'u',entry.id,'join'));assert.deepEqual(sleep,answered);
 const skipped=seen.get('장비 설정 초기화'),skippedState=structuredClone(skipped.players[0].character);skipped.season.turn+=2;assert.throws(()=>answerDailyLife(skipped,'u',skipped.season.dailyLife.entries[0].id,'join'));assert.deepEqual(skipped.players[0].character,skippedState);
});
