const bounded=(value,fallback)=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):fallback));
export function readinessFor(c={}){
 const condition=bounded(c.condition,85),fatigue=bounded(c.fatigue,10),stress=bounded(c.stress,10);
 return {conditionFactor:.8+condition*.002,fatiguePenalty:fatigue*.11,stressPenalty:stress*.07,growthFactor:fatigue>70?.35:fatigue>40?.7:1,
  tier:fatigue>70||condition<35?'탈진':fatigue>40||condition<60?'피로 누적':'양호'};
}
