export const CHARACTER_BACKGROUNDS = [
 {id:'none',name:'기본 선수',description:'자신만의 길을 만들어 가는 선수.',bonuses:{}},
 {id:'rookie',name:'신인',description:'처음 1군 무대에 선 선수. 새 환경에 적응하며 경험을 쌓는다.',bonuses:{mechanics:1,mastery:2}},
 {id:'prospect',name:'주목받는 신예',description:'데뷔 전부터 관심을 모았다. 기대와 시선 속에서 자신의 실력을 증명한다.',bonuses:{mechanics:2,laning:2,mastery:1}},
 {id:'veteran',name:'베테랑',description:'리그의 긴 시즌과 큰 경기를 경험했다. 상황을 정리하고 동료를 이끈다.',bonuses:{macro:2,communication:2,mental:1}},
 {id:'former_all_pro',name:'지난 시즌 올프로',description:'지난 시즌 올프로에 이름을 올렸다. 올해도 그 평가를 지켜내려 한다.',bonuses:{mechanics:1,laning:1,macro:1,communication:1,mental:1,mastery:1}},
];
export function backgroundFor(value){return CHARACTER_BACKGROUNDS.find(b=>b.id===value)||CHARACTER_BACKGROUNDS[0];}
export function normalizeBackground(value){
 if(value==null||value==='')return 'none';
 if(typeof value!=='string'||!CHARACTER_BACKGROUNDS.some(b=>b.id===value))throw Object.assign(new Error('선수 배경을 선택하세요.'),{status:400});
 return value;
}
export function startingStats(background){
 const bonus=backgroundFor(background).bonuses;
 return Object.fromEntries(['mechanics','laning','macro','communication','mental','mastery'].map(key=>[key,65+(bonus[key]||0)]));
}
export function backgroundIntro(c){
 const name=c.nickname||c.name||'선수';
 return {rookie:`${name}이 첫 1군 시즌을 시작한다. 새로운 무대에서 한 경기씩 경험을 쌓는다.`,prospect:`데뷔 전부터 주목받던 ${name}이 합류했다. 기대를 경기력으로 바꿀 차례다.`,veteran:`리그를 오래 지켜온 ${name}이 합류했다. 긴 시즌을 헤쳐 갈 경험을 가져왔다.`,former_all_pro:`지난 시즌 올프로 ${name}이 합류했다. 올해도 자신의 자리를 증명하려 한다.`}[c.background]||`${name}이 선수단에 합류했다.`;
}
