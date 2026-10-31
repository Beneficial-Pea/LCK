import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeason, settleDay } from '../lib/season.mjs';
import { clubSchedule, processClubActivities } from '../lib/club-schedule.mjs';

const room=()=>({players:[{userId:'u',location:'연습실',character:{id:'p',nickname:'Int',team:'T1',position:'MID',mainChampion:'아리',pool:['아리'],stats:{mechanics:65,laning:65,macro:65,communication:65,mental:65,mastery:65},condition:85,fatigue:20,stress:20}}],submissions:{},season:createSeason({year:2026,team:'T1',seed:'club-plan'})});
test('club appointments are visible in advance, stable and avoid own fixtures throughout the season',()=>{
 const r=room(),before=structuredClone(r),events=clubSchedule(r);
 assert.deepEqual(r,before,'Planning a public view never changes the save');
 assert.deepEqual(events,clubSchedule(r));assert(events.length>=28);
 assert.equal(new Set(events.map(e=>e.id)).size,events.length);assert.equal(new Set(events.map(e=>e.date)).size,events.length);
 for(const e of events){assert(e.date>=r.season.startDate&&e.date<=r.season.endDate);assert(!r.season.schedule.some(m=>m.date===e.date&&[m.teamA,m.teamB].includes('T1')));}
 for(const category of ['광고','화보','팬 행사','인터뷰','검진','콘텐츠'])assert(events.some(e=>e.category===category));
});
test('activities settle once with history and bounded effects; a completed date never moves',()=>{
 const r=room(),event=clubSchedule(r)[0];r.season.date=event.date;
 const before=r.players[0].character.fatigue;
 assert.equal(processClubActivities(r).length,1);assert.equal(r.players[0].character.fatigue,before+event.fatigue);
 assert.equal(processClubActivities(r).length,0);assert.equal(r.season.clubDiary.length,1);
 r.season.schedule.push({date:event.date,teamA:'T1',teamB:'KT'});
 const saved=clubSchedule(r).find(e=>e.id===event.id);assert.equal(saved.date,event.date);assert.equal(saved.status,'completed');
 assert(r.season.history.some(h=>h.type==='club-activity'&&h.text.includes(event.title)));
});
test('a newly qualified fixture moves a future appointment without losing it as its old date passes',()=>{
 const r=room(),event=clubSchedule(r)[0];
 r.season.schedule.push({date:event.date,teamA:'T1',teamB:'KT'});
 const moved=clubSchedule(r).find(e=>e.id===event.id);assert(moved.date>event.date);
 r.season.date=moved.date;assert.equal(clubSchedule(r).find(e=>e.id===event.id).date,moved.date);
 processClubActivities(r);assert.equal(r.season.clubDiary[0].id,event.id);
});
test('a persisted plan never pulls an appointment earlier after a bracket conflict disappears',()=>{
 const r=room(),event=clubSchedule(r)[0],fixture={date:event.date,teamA:'T1',teamB:'KT'};
 r.season.schedule.push(fixture);processClubActivities(r);
 const moved=clubSchedule(r).find(e=>e.id===event.id);assert(moved.date>event.date);
 r.season.schedule=r.season.schedule.filter(m=>m!==fixture);
 assert.equal(clubSchedule(r).find(e=>e.id===event.id).date,moved.date);
 const restored=structuredClone(r);assert.deepEqual(clubSchedule(restored),clubSchedule(r));
});
test('existing saves gain future appointments without replaying months of missed work and daily settlement applies them',()=>{
 const r=room();r.season.date='2026-08-01';const events=clubSchedule(r);
 assert(events.every(e=>e.date>=r.season.date));assert(events.length>=8);
 const fresh=room();fresh.submissions.u={turn:1,action:'rest'};settleDay(fresh);
 const first=clubSchedule(fresh)[0];assert.equal(first.date,fresh.season.date);fresh.submissions.u={turn:2,action:'rest'};
 const result=settleDay(fresh);assert.equal(result.clubActivities[0].id,first.id);assert.equal(fresh.season.clubDiary[0].id,first.id);
 assert.equal(fresh.season.turn,3);
 const legacy=room();legacy.season.year=2025;assert.deepEqual(clubSchedule(legacy),[]);
});
