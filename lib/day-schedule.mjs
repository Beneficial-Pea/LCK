import {scrimSchedule} from './scrims.mjs';
export function dayActivity(room){
 const s=room.season;if(s.year!==2026||s.draft||s.finished)return null;
 const match=s.schedule.find(m=>m.date===s.date&&m.status==='scheduled'&&[m.teamA,m.teamB].includes(s.team));
 if(match)return {type:'match',id:match.id,title:`${match.stage} · ${match.round}`,opponent:match.teamA===s.team?match.teamB:match.teamA,bestOf:match.bestOf};
 const practice=scrimSchedule(room).find(e=>e.date===s.date);return practice?{type:'scrim',id:practice.id,title:practice.title,opponent:practice.opponent,bestOf:3,completed:practice.status==='completed'}:null;
}
