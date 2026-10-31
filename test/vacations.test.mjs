import test from 'node:test';import assert from 'node:assert/strict';
import { createSeason,getRoster,settleDay } from '../lib/season.mjs';
import { vacationFor,vacationWindows,processVacation } from '../lib/vacations.mjs';
import { clubSchedule } from '../lib/club-schedule.mjs';
import { renderVacationPanel } from '../public/vacations.js';
const room=()=>({players:[{userId:'u',location:'연습실',character:{id:'p',nickname:'Rest',team:'T1',position:'MID',mainChampion:'아리',pool:['아리'],stats:{mechanics:65,laning:65,macro:65,communication:65,mental:65,mastery:65},condition:80,fatigue:30,stress:30}}],submissions:{},season:createSeason({year:2026,team:'T1',seed:'holiday'})});
test('vacations use competition gaps, exclude MSI/Worlds participants where required and never override an own fixture',()=>{
 const r=room(),s=r.season;s.date='2026-03-03';assert(vacationFor(s));s.schedule.push({date:s.date,teamA:'T1',teamB:'HLE'});assert.equal(vacationFor(s),null);s.schedule.pop();
 s.flags.msiSeeded=true;s.qualifications.msi.teams=['T1','HLE'];assert(!vacationWindows(s).some(v=>v.id==='june-break'));s.qualifications.msi.teams=['DK','HLE'];assert(vacationWindows(s).some(v=>v.id==='june-break'));
 s.flags.worldsSeeded=true;s.qualifications.worlds.teams=['T1'];assert(!vacationWindows(s).some(v=>v.id==='autumn-break'));assert.equal(vacationWindows(s).find(v=>v.id==='post-lck').end,'2026-09-18');
 s.year=2025;assert.deepEqual(vacationWindows(s),[]);
});
test('holiday stories have no response choices, vary across days and restore state exactly once without training gains',()=>{
 const r=room();r.season.date='2026-03-03';const stats=structuredClone(r.players[0].character.stats);
 for(let i=0;i<5;i++){processVacation(r);processVacation(r);r.season.date=new Date(Date.parse(r.season.date)+86400000).toISOString().slice(0,10);r.season.turn++;}
 assert.equal(r.season.vacations.entries.length,5);assert.equal(new Set(r.season.vacations.entries.map(e=>e.description)).size,5);assert(r.season.vacations.entries.every(e=>!e.choices));assert.deepEqual(r.players[0].character.stats,stats);assert.equal(r.players[0].character.condition,100);
 const snapshot=structuredClone(r);assert.deepEqual(snapshot.season.vacations,r.season.vacations);
});
test('daily settlement ignores declared training during vacations and team commercial activities move outside them',()=>{
 const r=room(),s=r.season;s.date='2026-03-03';r.submissions.u={turn:s.turn,action:'mechanics'};const base=r.players[0].character.stats.mechanics;
 const result=settleDay(r);assert(result.vacation);assert.equal(r.players[0].character.stats.mechanics,base);assert.equal(s.vacations.entries.length,1);assert(!s.dailyLife?.entries.length);assert.equal(s.date,'2026-03-04');
 assert(clubSchedule(r).filter(e=>e.status==='scheduled').every(e=>!vacationWindows(s).some(v=>e.date>=v.start&&e.date<=v.end)));
 const html=renderVacationPanel({...r,vacation:vacationFor(s)},'u',true);assert(html.includes('vacation-day')&&html.includes('vacation-end'));assert(!html.includes('choose-action')&&!html.includes('life-answer'));
});
