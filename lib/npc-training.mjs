// Growth belongs to the NPC's season identity, independently of its team preset.
const keys=['mechanics','laning','macro','communication','mental','mastery'];
const names={mechanics:'피지컬',laning:'라인전',macro:'운영',communication:'소통',mental:'멘탈',mastery:'숙련도'};
const round=value=>Math.round(value*100)/100;
export function withNpcTraining(season,npc){
 const growth=season.npcTraining?.[npc.id]?.stats||{};
 return {...npc,stats:Object.fromEntries(keys.map(key=>[key,round(Math.max(20,Math.min(99,Number(npc.stats[key])+Number(growth[key]||0))))]))};
}
export function trainNpc(season,npc,effects,session,{factor=1}={}){
 if(!npc?.npc||season.npcTrainingVersions?.[season.turn]===0)return null;
 const versions=season.npcTrainingVersions??={};versions[season.turn]=1;
 const all=season.npcTraining??={},record=all[npc.id]??={stats:{}};
 if(record.turn!==season.turn){record.turn=season.turn;record.sessions={};}
 if(record.sessions[session])return null;
 record.sessions[session]=true;
 const changes={};
 for(const key of keys){const gain=Number(effects[key]);if(!Number.isFinite(gain)||gain<=0)continue;
  const actual=round(Math.max(0,Math.min(99,Number(npc.stats[key])+gain*factor)-Number(npc.stats[key])));
  if(actual>0){record.stats[key]=round(Number(record.stats[key]||0)+actual);changes[key]=actual;}
 }
 return Object.keys(changes).length?{playerId:npc.id,nickname:npc.nickname,position:npc.position,effects:changes}:null;
}
export function npcGrowthText(growth=[]){return growth.length?' NPC 동반 성장: '+growth.map(p=>p.nickname+' '+Object.entries(p.effects).map(([k,v])=>`${names[k]} +${v}`).join(' · ')).join(' / ')+'.':'';}
