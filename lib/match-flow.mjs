// Observes published snapshots only. This module never changes combat or draws
// from its RNG, and cannot inspect the future winner of a set or series.
const facts={
 first_lead:[
  '{team}이 골드 {gap} 우위를 만들었다. 다음 장면부터 이 격차를 유지할 수 있는지가 관전 포인트다.',
  '양 팀의 자원 차이가 벌어지기 시작했다. 현재 {team}이 {gap} 앞선다.',
  '현재 골드 선두는 {team}. 격차는 {gap}이며, 상대는 다음 교환에서 이 차이를 줄여야 한다.',
  '{team} 쪽으로 자원 우위가 기울었다. 현재 {gap} 차이다.',
  '지금까지의 교환을 합치면 {team}이 골드에서 {gap} 앞서 있다.',
  '처음 드러난 자원 차이는 {team}의 {gap} 우위다.'
 ],
 lead_change:[
  '골드 선두가 {team}으로 바뀌었다. 현재 {gap} 우위다. 앞서던 {enemy}가 추격하는 쪽이 됐다.',
  '{team}이 자원 차이를 뒤집었다. 현재 골드는 {team} 쪽이 {gap} 많다.',
  '골드 그래프의 방향이 바뀌었다. {team}이 {gap} 앞서는 위치로 올라왔다.',
  '뒤따르던 {team}이 현재 골드 선두에 섰다. 우위는 {gap}이다.',
  '이 장면 이후 골드 우위를 가진 팀은 {team}. {enemy}에 {gap} 앞선다.',
  '앞서던 팀과 뒤쫓던 팀의 자리가 바뀌었다. {team}이 골드 {gap} 우위다.'
 ],
 comeback:[
  '한때 {deficit} 뒤졌던 {team}이 골드 선두를 되찾았다. 지금은 오히려 {gap} 앞선다.',
  '{team}이 최대 {deficit}의 열세를 지우고 {gap} 우위로 돌아섰다. 실제 골드 역전이다.',
  '자원 열세 {deficit}까지 몰렸던 {team}이 현재 {gap} 앞선다. 추격이 역전으로 이어졌다.',
  '{enemy}가 벌렸던 최대 {deficit} 차이가 사라졌다. 골드는 {team}의 {gap} 우위로 바뀌었다.',
  '골드 기록으로 확인되는 역전이다. {team}은 한때 {deficit} 뒤졌지만 현재 {gap} 앞선다.',
  '{team}이 긴 추격 끝에 자원 선두로 올라섰다. 최대 열세는 {deficit}, 현재 우위는 {gap}이다.'
 ],
 recovery:[
  '{team}이 자원 격차를 줄였다. 최대 {deficit} 열세에서 현재 {gap} 차이까지 따라왔다. 아직 골드는 {enemy}가 앞선다.',
  '최대 {deficit}이던 골드 차이가 {gap}까지 좁혀졌다. {team}이 추격하지만 선두는 여전히 {enemy}다.',
  '{team}의 추격이 골드에도 반영됐다. 한때 {deficit} 차이였고 지금은 {gap} 뒤진다.',
  '{enemy}의 우위가 줄었다. {team}은 최대 열세 {deficit} 중 일부를 지우고 {gap} 차이로 좁혔다.',
  '역전까지는 남았지만 격차가 줄고 있다. {team}의 현재 골드 열세는 {gap}이다.',
  '{team}이 추격할 여지를 만들었다. 최대 {deficit}까지 벌어졌던 골드 차이가 {gap}으로 줄었다.'
 ],
 snowball:[
  '{team}의 골드 우위가 {gap}까지 커졌다. 최근 성과가 자원 차이로 쌓였다.',
  '{team}이 앞서던 자원 차이를 더 벌렸다. 현재 격차는 {gap}이다.',
  '골드 차이는 {team}의 {gap} 우위다. {enemy}가 다음 성과를 내지 못하면 부담이 더 커진다.',
  '{team}이 얻은 이득을 계속 쌓고 있다. 골드 차이가 {gap}에 도달했다.',
  '현재 자원 격차 {gap}. 선두 {team}이 차이를 키우는 흐름이다.',
  '{enemy}가 지켜야 할 격차가 더 벌어졌다. {team}이 골드 {gap} 앞선다.'
 ],
 fight_back:[
  '{team}이 이번 교전에서 더 많은 처치를 만들었다. 다만 전체 골드는 아직 {enemy}가 {gap} 앞선다.',
  '교전 성과는 {team}에게 남았지만 골드 선두는 바뀌지 않았다. 현재 차이는 {gap}이다.',
  '{team}이 한 번 반격했다. 이 장면을 기준으로도 골드는 {enemy}의 {gap} 우위다.',
  '이번 킬 교환은 {team} 쪽이 좋았다. 전체 자원 차이 {gap}을 줄이는 다음 성과가 필요하다.',
  '{team}이 밀리던 경기에서 교환 하나를 가져왔다. 골드 역전은 아직이며 열세는 {gap}이다.',
  '교전 승리와 전체 우위는 다르다. {team}이 처치에서 앞섰지만 골드는 {gap} 뒤진다.'
 ],
 objective_trade:[
  '{enemy}가 {previousObjective}을 챙긴 뒤 {team}은 {objective}으로 답했다. 양 팀이 서로 다른 목표를 교환했다.',
  '최근 목표 교환은 {enemy}의 {previousObjective}, {team}의 {objective}이다. 같은 장소에서만 다투지 않았다.',
  '{team}이 다른 목표를 가져오며 응수했다. 앞선 장면의 {enemy} {previousObjective}과 이번 {objective}이 교환됐다.',
  '지도 양쪽에서 성과가 나왔다. {enemy}의 {previousObjective} 확보 뒤 {team}이 {objective}을 챙겼다.',
  '{previousObjective}을 내준 쪽도 가만히 있지 않았다. {team}이 {objective}으로 성과를 남겼다.',
  '목표를 나눠 가져가는 흐름이다. 직전 {previousObjective}은 {enemy}, 이번 {objective}은 {team} 몫이다.'
 ],
 baron_siege:[
  '{team}이 바론 버프가 남아 있는 동안 포탑 {towers}개를 추가로 밀었다. 버프를 실제 건물 성과로 바꿨다.',
  '바론을 가진 {team}의 압박이 포탑 {towers}개 파괴로 이어졌다.',
  '{team}이 바론 버프 시간에 건물 {towers}개를 가져갔다. 수비할 공간이 줄었다.',
  '버프를 얻은 뒤의 압박에서 포탑 {towers}개가 무너졌다. {team}이 이번 턴을 건물로 남겼다.',
  '{team}이 바론의 남은 시간을 활용했다. 이 장면에서 가져간 포탑은 {towers}개다.',
  '바론 버프와 함께 전진한 {team}이 포탑 {towers}개를 더 정리했다.'
 ],
 soul_point:[
  '{team}의 세 번째 드래곤이다. 다음 일반 드래곤에서 영혼을 확보할 수 있는 지점에 도달했다.',
  '{team}이 드래곤을 세 번 챙겼다. 다음 용 싸움에는 영혼이 걸릴 수 있다.',
  '드래곤 누적 3회. {team}은 영혼까지 한 번의 확보가 남았다.',
  '{team}이 영혼 확보를 한 번 앞둔 상태가 됐다. 다음 용을 둘러싼 선택이 더 중요해졌다.',
  '{team}의 일반 드래곤 확보가 세 번에 도달했다. 영혼을 내줄 수 있는 다음 차례가 다가온다.',
  '세 번째 드래곤이 {team}에게 갔다. 다음 일반 드래곤도 가져가면 영혼이 완성된다.'
 ],
 soul:[
  '{team}이 네 번째 드래곤으로 영혼을 완성했다. 드래곤 누적 성과가 하나의 큰 목표로 이어졌다.',
  '용 영혼은 {team}의 몫이다. 일반 드래곤 네 번을 확보한 결과다.',
  '{team}이 영혼을 얻었다. 이제 다음 드래곤의 단계도 달라진다.',
  '네 번째 드래곤이 기록됐다. {team}이 영혼을 갖고 다음 교전을 준비한다.',
  '{team}의 드래곤 누적이 영혼으로 완성됐다. 상대는 이후 교전에서 이 차이도 생각해야 한다.',
  '영혼 확보가 확정됐다. 드래곤을 네 번 가져간 팀은 {team}이다.'
 ],
 elder:[
  '{team}이 장로 드래곤을 확보했다. 다음 큰 교전을 준비하는 양 팀의 부담이 달라졌다.',
  '장로 드래곤이 {team}에게 넘어갔다. 이 목표 뒤의 교전을 계속 지켜봐야 한다.',
  '{team}이 장로를 손에 넣었다. 상대는 다음 진입을 더 조심해야 한다.',
  '일반 드래곤 단계가 끝난 뒤 나온 장로를 {team}이 챙겼다.',
  '{team}이 후반의 큰 목표를 가져갔다. 장로 확보 이후의 합류가 중요하다.',
  '이번 후반 목표는 장로 드래곤이다. 확보한 팀은 {team}으로 기록됐다.'
 ],
};
const labels={first_lead:'골드 우위 형성',lead_change:'골드 선두 교체',comeback:'골드 역전',recovery:'격차 축소',snowball:'스노우볼',fight_back:'열세 속 반격',objective_trade:'목표 교환',baron_siege:'바론 공성',soul_point:'영혼까지 한 번',soul:'용 영혼 확보',elder:'장로 확보'};
const gold=n=>Math.abs(n)>=1000?`${(Math.abs(n)/1000).toFixed(1)}k`:`${Math.round(Math.abs(n))}`;
const fill=(template,context)=>template.replace(/\{(\w+)\}/g,(_,key)=>String(context[key]??''));
export function createFlowTracker(names,random=()=>0){
 let previous=null,stableLeader=null,lastObjective=null;const maximumDeficit=[0,0],lastSnowball=[2000,2000],announced=new Map();
 return (event,state,seconds)=>{
  const current={gold:[...state.gold],towers:[...state.towers]},gap=current.gold[0]-current.gold[1],leader=Math.abs(gap)>=1000?(gap>0?0:1):null,side=names.indexOf(event.team),before=previous;
  previous=current;
  maximumDeficit[0]=Math.max(maximumDeficit[0],-gap);maximumDeficit[1]=Math.max(maximumDeficit[1],gap);
  if(!before||['draft','nexus','coach_comms'].includes(event.type))return null;
  const towers=side>=0?Math.max(0,current.towers[side]-before.towers[side]):0;
  let kind=null,subject=side,prior=null;
  if(leader!==null&&stableLeader!==leader){subject=leader;kind=stableLeader===null?'first_lead':maximumDeficit[leader]>=3000?'comeback':'lead_change';stableLeader=leader;}
  const objective=event.objective;
  const acquired=side>=0&&(['드래곤','용 영혼','장로 드래곤','바론','전령'].includes(objective)||towers>0);
  if(!kind&&acquired&&lastObjective&&lastObjective.side!==side&&seconds-lastObjective.seconds<=120&&lastObjective.objective!==(towers>0?'포탑':objective)){kind='objective_trade';prior=lastObjective.objective;}
  if(acquired)lastObjective={side,seconds,objective:towers>0?'포탑':objective};
  if(!kind&&towers>0&&state.baronBuff?.[side]>seconds)kind='baron_siege';
  if(!kind&&event.objective==='용 영혼')kind='soul';
  if(!kind&&event.objective==='장로 드래곤')kind='elder';
  if(!kind&&event.objective==='드래곤'&&event.dragonCount===3)kind='soul_point';
  const own=side>=0?current.gold[side]-current.gold[1-side]:0,oldOwn=side>=0?before.gold[side]-before.gold[1-side]:0;
  if(!kind&&side>=0&&own<0&&maximumDeficit[side]>=3000&&maximumDeficit[side]+own>=1500&&own-oldOwn>=900)kind='recovery';
  if(!kind&&side>=0&&own>=4000&&own-lastSnowball[side]>=2000){kind='snowball';lastSnowball[side]=own;}
  const kills=(event.kills||[]).filter(k=>k.killerTeam===event.team).length,losses=(event.kills||[]).length-kills;
  if(!kind&&side>=0&&own<=-2000&&kills>=2&&kills>losses)kind='fight_back';
  if(!kind||subject<0)return null;
  const key=`${kind}:${subject}`,cooldown=['recovery','fight_back'].includes(kind)?120:kind==='snowball'?90:0;
  if(seconds-(announced.get(key)??-Infinity)<cooldown)return null;announced.set(key,seconds);
  const context={team:names[subject],enemy:names[1-subject],gap:gold(gap),deficit:gold(maximumDeficit[subject]),objective:towers>0?'포탑':objective,previousObjective:prior,towers};
  const bank=facts[kind],text=fill(bank[Math.floor(random()*bank.length)],context);
  return {kind,label:labels[kind],text,team:context.team,enemy:context.enemy,goldDifference:Math.abs(gap),peakDeficit:maximumDeficit[subject],towers,objective:context.objective,previousObjective:prior};
 };
}
export const FLOW_FACT_COUNT=Object.values(facts).reduce((n,lines)=>n+lines.length,0);
