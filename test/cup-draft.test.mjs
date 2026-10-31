import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeason} from '../lib/season.mjs';
import {ensureCupDraft,pickCupTeam,completeCupDraft,currentCupCaptain} from '../lib/cup-draft.mjs';
test('media day randomizes captains reproducibly and drafts ten unique teams into cross-group fixtures',()=>{
 const make=seed=>createSeason({year:2026,seed,team:'T1'}),s=make('draft-test'),d=s.cupDraft;
 assert.deepEqual(d,make('draft-test').cupDraft);assert.notEqual(d.previous.champion,d.previous.runnerUp);
 assert.ok(new Set(Array.from({length:12},(_,i)=>make('draft-'+i).cupDraft.previous.champion)).size>1);
 s.date='2026-01-11';assert.throws(()=>pickCupTeam(s),/미디어데이/);s.date=d.date;
 assert.throws(()=>pickCupTeam(s,d.previous.champion),/지명되지/);
 const source=s.schedule.filter(m=>m.id.startsWith('cup-group-')).map(m=>[m.date,m.bestOf,m.sourceTeams]);
 assert.equal(currentCupCaptain(s),d.previous.champion);pickCupTeam(s,d.remaining[0]);completeCupDraft(s);
 assert.equal(d.status,'completed');assert.deepEqual(d.groups.map(g=>g.length),[5,5]);assert.equal(new Set(d.groups.flat()).size,10);
 d.picks.forEach((p,i)=>assert.equal(p.captain,i%2?d.previous.runnerUp:d.previous.champion));
 const fixtures=s.schedule.filter(m=>m.id.startsWith('cup-group-'));
 assert.deepEqual(fixtures.map(m=>[m.date,m.bestOf,m.sourceTeams]),source);
 for(const a of d.groups[0])for(const b of d.groups[1])assert.equal(fixtures.filter(m=>[m.teamA,m.teamB].includes(a)&&[m.teamA,m.teamB].includes(b)).length,1);
 for(const team of d.groups.flat()){assert.equal(fixtures.filter(m=>[m.teamA,m.teamB].includes(team)).length,5);assert.equal(fixtures.filter(m=>m.bestOf===5&&[m.teamA,m.teamB].includes(team)).length,1);}
 assert.equal(completeCupDraft(s),false);
});
test('existing seasons retain their groups and fixtures',()=>{
 const s=createSeason({year:2026,seed:'old'});s.date=s.cupDraft.date;completeCupDraft(s);s.date='2026-02-01';delete s.cupDraft;
 const before=structuredClone(s.schedule),groups=structuredClone(s.tournaments.cupGroups);assert.equal(ensureCupDraft(s),true);assert.equal(s.cupDraft.status,'legacy');assert.deepEqual(s.schedule,before);assert.deepEqual(s.tournaments.cupGroups,groups);
});
