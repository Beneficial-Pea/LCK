// Actual tournament finals only. Qualification/upper/lower finals do not award titles.
const finals=new Set(['cup-final','po-final','fst-final','msi-final','worlds-final','ewc-final','demacia-27']);
export function recordTournamentFinish(room,match){
 const s=room.season;
 if(!finals.has(match.id)||match.status!=='completed'||!match.result||![match.teamA,match.teamB].includes(s.team))return null;
 const rewards=s.tournamentRewards??=[];
 if(rewards.some(r=>r.matchId===match.id))return null;
 const champion=match.result.winner===s.team;
 const desired=champion?{mental:.5,communication:.3,condition:6,fatigue:-6,stress:-8}:{mental:.2,communication:.1,condition:3,fatigue:-3,stress:-4};
 const players=room.players.map(p=>{
  const effects={};for(const [key,amount] of Object.entries(desired)){
   const stat=key==='mental'||key==='communication',target=stat?p.character.stats:p.character;
   const before=target[key];target[key]=Number(Math.min(stat?99:100,Math.max(stat?20:0,before+amount)).toFixed(3));effects[key]=Number((target[key]-before).toFixed(3));
  }return {userId:p.userId,effects};
 });
 const reward={id:`title-${match.id}`,matchId:match.id,date:match.date,team:s.team,tournament:match.stage,placement:champion?'champion':'runner-up',players};
 rewards.push(reward);
 s.history.unshift({id:reward.id,date:match.date,turn:s.turn,type:'tournament-reward',text:`${match.stage} ${champion?'우승':'준우승'}. 선수단에 대회 성적 보상을 적용했다.`});
 return reward;
}
