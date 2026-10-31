import {seededRandom} from './match.mjs';
const mediaDate='2026-01-12';
function history(s,text,id){s.history.unshift({id,date:s.date,turn:s.turn,type:'cup-media-day',text});}
function originalGroups(s){
 const graph={};for(const m of s.schedule.filter(m=>m.id.startsWith('cup-group-'))){const [a,b]=m.sourceTeams||[];if(!a||!b)throw new Error('컵 원본 대진이 없습니다.');(graph[a]??=[]).push(b);(graph[b]??=[]).push(a);}
 const colors={'Gen.G':0},pending=['Gen.G'];while(pending.length){const a=pending.pop();for(const b of graph[a]||[])if(!(b in colors)){colors[b]=1-colors[a];pending.push(b);}}
 return ['Gen.G','HLE'].map((captain,i)=>[captain,...s.cupStandings.map(r=>r.team).filter(t=>t!==captain&&colors[t]===i)]);
}
export function ensureCupDraft(s){
 if(s.year!==2026)return false;
 if(s.cupDraft){const d=s.cupDraft;if(['scheduled','drafting'].includes(d.status)&&d.date==='2026-01-13'&&s.date<=d.date&&!s.results.some(m=>m.id.startsWith('cup-group-'))){d.date=s.date;d.version=2;return true;}return false;}
 const groups=s.tournaments.cupGroups;
 if(s.date>mediaDate||s.results.some(m=>m.id.startsWith('cup-group-'))){s.cupDraft={version:1,status:'legacy',date:mediaDate,groups:structuredClone(groups),picks:[]};return true;}
 const random=seededRandom(`${s.seed}:lck:previous-final`),teams=s.cupStandings.map(r=>r.team),order=[...teams];
 for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const [champion,runnerUp]=order;
 s.cupDraft={version:2,status:'scheduled',date:mediaDate,previous:{champion,runnerUp},groups:[[champion],[runnerUp]],remaining:teams.filter(t=>t!==champion&&t!==runnerUp),picks:[],sourceGroups:originalGroups(s)};
 s.tournaments.cupGroups=structuredClone(s.cupDraft.groups);
 for(const m of s.schedule.filter(m=>m.id.startsWith('cup-group-'))){m.teamA=null;m.teamB=null;m.status='pending';m.fixtureBasis='media-day-group-draft';}
 history(s,`전년도 LCK 우승은 ${champion}, 준우승은 ${runnerUp}. ${champion}이 바론 그룹, ${runnerUp}이 장로 그룹의 대표로 시즌 시작 미디어데이에 참가한다.`,'cup-previous-final');
 return true;
}
export function currentCupCaptain(s){const d=s.cupDraft;if(!d||!['scheduled','drafting'].includes(d.status))return null;return [d.previous.champion,d.previous.runnerUp][d.picks.length%2];}
function assignFixtures(s){
 const d=s.cupDraft,fixtures=s.schedule.filter(m=>m.id.startsWith('cup-group-'));
 if(fixtures.some(m=>m.result||m.status==='completed'))throw new Error('이미 치른 컵 대진은 변경할 수 없습니다.');
 const mapping=new Map();d.sourceGroups.forEach((names,i)=>names.forEach((name,j)=>mapping.set(name,d.groups[i][j])));
 const pairs=fixtures.map(m=>m.sourceTeams.map(t=>mapping.get(t)));if(pairs.some(pair=>pair.length!==2||pair.some(t=>!t)||pair[0]===pair[1]))throw new Error('컵 그룹 대진을 배정하지 못했습니다.');
 fixtures.forEach((m,i)=>{[m.teamA,m.teamB]=pairs[i];m.status='scheduled';});
 s.tournaments.cupGroups=structuredClone(d.groups);d.status='completed';s.flags.cupGroupsDrawn=true;
 history(s,`LCK 컵 미디어데이 지명 완료. 바론: ${d.groups[0].join(', ')}. 장로: ${d.groups[1].join(', ')}. 그룹 간 25경기 대진이 확정됐다.`,'cup-draft-completed');
}
export function pickCupTeam(s,pickedTeam=null){
 const d=s.cupDraft;if(!d||!['scheduled','drafting'].includes(d.status))throw Object.assign(new Error('진행할 컵 그룹 지명이 없습니다.'),{status:409});
 if(s.date<d.date)throw Object.assign(new Error('미디어데이 당일에 그룹을 지명할 수 있습니다.'),{status:409});
 const side=d.picks.length%2,captain=currentCupCaptain(s),number=d.picks.length+1;
 let team=pickedTeam;
 if(!team){team=[...d.remaining].sort((a,b)=>{
  const score=t=>(Number(s.opponents.find(p=>p.name===t)?.power)||65)+seededRandom(`${s.seed}:cup-draft:${number}:${t}`)()*6;
  return score(b)-score(a)||a.localeCompare(b);
 })[0];}
 if(!d.remaining.includes(team))throw Object.assign(new Error('아직 지명되지 않은 LCK 팀을 선택하세요.'),{status:400});
 d.status='drafting';d.groups[side].push(team);d.remaining=d.remaining.filter(t=>t!==team);d.picks.push({number,captain,group:side===0?'바론':'장로',team,automatic:!pickedTeam});
 s.tournaments.cupGroups=structuredClone(d.groups);history(s,`${number}순위 지명. ${captain}이 ${team}을 ${side===0?'바론':'장로'} 그룹으로 선택했다.`,`cup-draft-pick-${number}`);
 if(!d.remaining.length)assignFixtures(s);return d.picks.at(-1);
}
export function completeCupDraft(s){
 const d=s.cupDraft;if(!d||!['scheduled','drafting'].includes(d.status)||s.date<d.date)return false;
 while(d.status!=='completed')pickCupTeam(s);return true;
}
