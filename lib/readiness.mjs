const bounded=(value,fallback)=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):fallback));
export function readinessFor(c={},{version=1}={}){
 const condition=bounded(c.condition,85),fatigue=bounded(c.fatigue,10),stress=bounded(c.stress,10);
 const mental=bounded(c.effectiveStats?.mental??c.stats?.mental,65),mentalMitigation=version===0?0:Math.min(1,Math.max(0,(mental-65)/34))*.3,baseConditionFactor=.8+condition*.002;
 return {mentalMitigation,conditionFactor:baseConditionFactor+(1-baseConditionFactor)*mentalMitigation,fatiguePenalty:fatigue*.11*(1-mentalMitigation),stressPenalty:stress*.07,growthFactor:fatigue>70?.35:fatigue>40?.7:1,
  tier:fatigue>70||condition<35?'탈진':fatigue>40||condition<60?'피로 누적':'양호'};
}
