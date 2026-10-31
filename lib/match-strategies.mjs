export const MATCH_STRATEGIES=[
 {id:'balanced',name:'균형 운영',description:'라인과 오브젝트를 고르게 준비합니다.'},
 {id:'early',name:'초반 주도권',description:'초반 교전과 라인 주도권을 강화합니다. 후반에는 이점이 줄어듭니다.'},
 {id:'teamfight',name:'한타',description:'중후반 합류와 한타에 집중합니다. 초반 주도권을 내줄 수 있습니다.'},
 {id:'side',name:'사이드 운영',description:'중반 사이드 압박과 맵 운영에 집중합니다.'}
];
export function strategyFor(id){const choice=MATCH_STRATEGIES.find(p=>p.id===id);if(!choice)throw Object.assign(new Error('진행할 전략을 선택하세요.'),{status:400});return choice;}
