import {championComfort} from './champion-comfort.mjs';
import {createFlowTracker} from './match-flow.mjs';
import { readinessFor } from './readiness.mjs';
import { annotateMultiKills, summarizePerformances, selectPom } from './match-honors.mjs';
import { createCommentator } from './commentary.mjs';
import { createCaster } from './casting.mjs';
// Seeded, event-driven match simulation. No result is drawn before the game.
const POSITIONS = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
const LABELS = { TOP: '탑', JGL: '정글', MID: '미드', ADC: '원딜', SUP: '서포터' };
const LANE_LABELS = { ...LABELS, ADC: '바텀' };
export const CHAMPIONS = {
  TOP: ['제이스', '그웬', '럼블', '나르', '레넥톤', '오른', '크산테', '잭스', '카밀', '케넨', '암베사', '아트록스', '말파이트', '사이온', '갱플랭크', '피오라'],
  JGL: ['비에고', '리 신', '세주아니', '바이', '오공', '신 짜오', '자르반 4세', '니달리', '뽀삐', '마오카이', '스카너', '녹턴', '킨드레드', '릴리아', '그레이브즈', '엘리스'],
  MID: ['아지르', '아리', '오리아나', '사일러스', '탈리야', '신드라', '갈리오', '빅토르', '라이즈', '트위스티드 페이트', '르블랑', '조이', '코르키', '애니', '카시오페아', '베이가'],
  ADC: ['이즈리얼', '카이사', '바루스', '애쉬', '진', '자야', '칼리스타', '루시안', '케이틀린', '제리', '미스 포츈', '징크스', '시비르', '아펠리오스', '드레이븐', '트리스타나'],
  SUP: ['노틸러스', '레오나', '라칸', '알리스타', '브라움', '렐', '쓰레쉬', '탐 켄치', '바드', '레나타 글라스크', '유미', '룰루', '나미', '카르마', '밀리오', '블리츠크랭크'],
};
const WEIGHTS = {
  early: { mechanics: .24, laning: .32, macro: .13, communication: .12, mental: .06, mastery: .13 },
  middle: { mechanics: .18, laning: .12, macro: .25, communication: .22, mental: .1, mastery: .13 },
  late: { mechanics: .19, laning: .06, macro: .25, communication: .24, mental: .16, mastery: .1 },
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function seededRandom(seed) {
  let h = 2166136261;
  for (const c of String(seed ?? 'LCK')) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const choose = (rng, list) => list[Math.floor(rng() * list.length)];
const shuffled = (rng, list) => [...list].sort(() => 0).map(item => ({ item, n: rng() })).sort((a, b) => a.n - b.n).map(x => x.item);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function normalizeTeam(team, index) {
  const name = String(team?.name || `팀 ${index + 1}`);
  return {
    name,
    style: String(team?.style || 'balanced'),
    players: POSITIONS.map((position, i) => {
      const source = team?.players?.find(p => p.position === position) || {};
      const base = Number(team?.power) || 65;
      const values = source.effectiveStats || source.stats;
      const stats = Object.fromEntries(Object.keys(WEIGHTS.early).map(k => [k, clamp(Number(values?.[k]) || base, 1, 100)]));
      return { ...source, nickname: source.nickname ? (String(source.nickname).startsWith(name + ' ') ? String(source.nickname) : `${name} ${source.nickname}`) : `${name} ${LABELS[position]}`, position, stats,
        condition: clamp(Number(source.condition ?? 85), 0, 100), fatigue: clamp(Number(source.fatigue ?? 10), 0, 100), stress: clamp(Number(source.stress ?? 10), 0, 100),
        pool: Array.isArray(source.pool) ? source.pool.filter(x => typeof x === 'string' && x.trim()) : [],
        mainChampion: source.mainChampion || CHAMPIONS[position][i],
      };
    }),
  };
}

function styleBonus(style, phase) {
  if (/early|초반|공격|주도권/.test(style)) return phase === 'early' ? 5 : phase === 'late' ? -1 : 1;
  if (/teamfight|한타/.test(style)) return phase === 'late' ? 5 : phase === 'middle' ? 3 : -1;
  if (/side|사이드/.test(style)) return phase === 'middle' ? 4 : phase === 'late' ? 2 : 0;
  return 1;
}

function individualStrength(player, phase, champion,performanceVersion=1) {
  const weighted = Object.entries(WEIGHTS[phase]).reduce((sum, [key, weight]) => sum + player.stats[key] * weight, 0);
  const championFactor=1+championComfort(player,champion,{version:performanceVersion}).bonusPercent/100;
  const readiness=readinessFor(player,{version:performanceVersion});
  return weighted * readiness.conditionFactor * championFactor - readiness.fatiguePenalty - readiness.stressPenalty + styleBonus(player.style || '', phase) * .4;
}

function buildDraft(teams, spent, rng, firstSelection=0) {
  const used = new Set();
  const notes = [];
  const bannedThisSet=new Set();
  const bans=teams.map((team,i)=>{
    const targets=shuffled(rng,[...new Set(teams[1-i].players.map(p=>p.mainChampion).filter(Boolean))]).slice(0,3);
    const reserve=shuffled(rng,[...new Set(Object.values(CHAMPIONS).flat())]);
    const selected=[...new Set([...targets,...reserve])].filter(c=>!spent.has(c)&&!bannedThisSet.has(c)).slice(0,5);
    for(const c of selected)bannedThisSet.add(c);
    return selected;
  });
  const banned = new Set(bans.flat());
  const picks=[[],[]];
  for(const ti of [firstSelection,1-firstSelection]){const team=teams[ti];picks[ti]=team.players.map(player => {
    const preferred = [...new Set([player.mainChampion, ...player.pool])];
    let available = preferred.filter(c => !spent.has(c) && !used.has(c) && !banned.has(c));
    let champion;
    if (available.length) champion = available[0];
    else {
      available = CHAMPIONS[player.position].filter(c => !spent.has(c) && !used.has(c) && !banned.has(c));
      champion = choose(rng, available);
      notes.push(`${player.nickname}: 등록 챔피언이 밴되거나 이전 세트에 사용되어 ${champion || '대체 챔피언'} 선택. 등록 풀 밖 숙련도 보정 적용.`);
    }
    if (!champion) {
      // Extremely large custom drafts can exhaust a role pool. Retain uniqueness globally.
      champion = Object.values(CHAMPIONS).flat().find(c => !spent.has(c) && !used.has(c) && !banned.has(c));
    }
    used.add(champion);
    return { nickname: player.nickname, position: player.position, champion };
  });}
  for (const c of used) spent.add(c);
  return { bansA: bans[0], bansB: bans[1], picksA: picks[0], picksB: picks[1], notes,
    rule: '매 세트 양 팀 각각 5밴. 시리즈 전 세트에서 양 팀이 사용한 챔피언 재사용 금지. 등록 풀이 부족하면 포지션별 대체 챔피언과 숙련도 보정 적용. 밴된 챔피언은 해당 세트에서 양 팀 모두 선택할 수 없음.' };
}

function simulateSet(teams, number, spent, rng, strategy, stage, reactions, narration, castUsed, tournamentRules={}) {
  const draft = buildDraft(teams, spent, rng,tournamentRules.firstSelection||0);
  if(strategy&&typeof strategy==='object')for(const [side,key] of ['teamA','teamB'].entries())if(strategy[key])draft.notes.push(`${teams[side].name} 운영 계획: ${strategy[key]}`);
  if(tournamentRules.selectionRight)draft.selectionRight={team:teams[tournamentRules.firstSelection||0].name,reason:number===1?(tournamentRules.selectionReason||'추첨 선지명'):'직전 세트 패배',choice:'선픽 자동 선택'};
  if(tournamentRules.draftVersion===1){
    const chooser=tournamentRules.firstSelection||0,blue=tournamentRules.selectionRight?1-chooser:chooser;
    draft.assignment={version:1,blueTeam:teams[blue].name,redTeam:teams[1-blue].name,sideChoiceTeam:teams[blue].name,firstPickChoiceTeam:tournamentRules.selectionRight?teams[chooser].name:null,firstPickTeam:teams[chooser].name,reason:number===1?(tournamentRules.selectionReason||'1세트 사전 배정'):'직전 세트 패배 팀에 선택권',mode:tournamentRules.selectionRight?'rofs':'side'};
  }
  const picks = [draft.picksA, draft.picksB];
  if(tournamentRules.performanceVersion===1)for(const [ti,rows] of picks.entries())for(const [pi,pick] of rows.entries())pick.comfort=championComfort(teams[ti].players[pi],pick.champion);
  const scoreboard = teams.flatMap((team, ti) => team.players.map((p, pi) => ({ playerId:p.id||`${team.name}:${p.position}`,background:p.background||'none',nickname: p.nickname, position: p.position, team: team.name, champion: picks[ti][pi].champion, ...(tournamentRules.performanceVersion===1?{championComfort:picks[ti][pi].comfort}:{}), k: 0, d: 0, a: 0 })));
  const rows = [scoreboard.slice(0, 5), scoreboard.slice(5)];
  const events = [];
  const state = { gold: [2500, 2500], kills: [0, 0], towers: [0, 0], dragons: [0, 0], barons: [0, 0], elders: [0, 0], grubs: [0, 0], heralds: [0, 0], streaks: [Array(5).fill(0), Array(5).fill(0)] };
  const phaseAt = time => time < 14 * 60 ? 'early' : time < 26 * 60 ? 'middle' : 'late';
  const wording = options => choose(narration, options);
  const cast=createCaster(narration,castUsed);
  const observeFlow=createFlowTracker(teams.map(t=>t.name),seededRandom(`${tournamentRules.coachSeed}:flow`));
  const coachRandom=seededRandom(tournamentRules.coachSeed||'coach');
  const coaches=teams.map(team=>({team:team.name,activations:[],thresholds:[600,1200,1800].map(t=>t+Math.floor(coachRandom()*75))}));
  let counter = 0, clock = 0, dragonNext = 300, baronNext = 1200, heraldTaken = false, soul = null;
  const expandedObjectives=tournamentRules.objectiveVersion===1;
  const objectiveCounts=()=>({towers:[...state.towers],dragons:[...state.dragons],barons:[...state.barons],elders:[...state.elders],...(expandedObjectives?{grubs:[...state.grubs],heralds:[...state.heralds]}:{})});
  let baronBuff = [0, 0], teamfights = 0, ganks = 0, lastPush = [0, 0];
  const closingPhase = 34 * 60 + Math.floor(rng() * 9 * 60);
  const advance = seconds => {
    const delta = seconds - clock;
    if (delta < 0) throw new Error('경기 시간이 역행했습니다.');
    for (let side = 0; side < 2; side++) state.gold[side] += Math.round(delta / 60 * (1330 + rng() * 160));
    clock = seconds;
    if(tournamentRules.coachComms)for(const coach of coaches){
      const count=coach.activations.length;
      if(count<3&&seconds>=coach.thresholds[count]){
        const activation={start:formatTime(seconds),end:formatTime(seconds+45),duration:45,number:count+1};coach.activations.push(activation);
        add(seconds,'coach_comms',`${coach.team} 코치 보이스 ${count+1}/3. 양측 음성 연결을 확인한 뒤 45초 동안 다음 움직임을 정리한다. 경기 시계는 계속 흐른다.`,teams.findIndex(t=>t.name===coach.team),{kills:[],coach:{team:coach.team,...activation,limit:3}});
      }
    }
  };
  const add = (seconds, type, text, side = null, extra = {}, context = {}) => {
    const records = extra.kills || [];
    const leader = records[0];
    const flow=observeFlow({type,team:side===null?null:teams[side].name,...extra},{...state,baronBuff},seconds);
    const event = {
      id: `set-${number}-event-${++counter}`, time: formatTime(seconds), type, text,
      team: side === null ? null : teams[side].name,
      reactions: reactions(extra.subtype || type, {
        flow, number, team: side === null ? teams[0].name : teams[side].name,
        enemy: side === null ? teams[1].name : teams[1 - side].name,
        background:leader?scoreboard.find(p=>p.nickname===(context.killer||leader.killer))?.background:'none',
        killer: leader?.killer, victim: leader?.victim, champion: leader?.champion,
        role: leader ? LABELS[rows[side === null ? 0 : side].find(p => p.nickname === leader.killer)?.position] : '',
        deathCount: leader ? rows[1 - (side ?? 0)].find(p => p.nickname === leader.victim)?.d || 0 : 0,
        killCount: leader ? rows[side ?? 0].find(p => p.nickname === leader.killer)?.k || 0 : 0,
        location: extra.location, objective: extra.objective, comeback: extra.comeback || false,
        ...context,
      }),
      ...extra, ...(flow?{flow}:{}), score: [...state.kills], gold: [...state.gold], objectives:objectiveCounts(),
    };
    event.casting=cast(extra.subtype||type,event);
    events.push(event);return event;
  };
  const strength = (ti, phase, roles = null) => {
    const team = teams[ti];
    const all = team.players.map((p, pi) => individualStrength(p, phase, picks[ti][pi].champion,tournamentRules.performanceVersion));
    const average = all.reduce((sum, n) => sum + n, 0) / 5;
    const local = roles?.length ? roles.reduce((sum, position) => sum + all[POSITIONS.indexOf(position)], 0) / roles.length : average;
    const selected = typeof strategy === 'string' ? (ti === 0 ? strategy : '') : strategy?.[ti === 0 ? 'teamA' : 'teamB'];
    return average * .65 + local * .35 + styleBonus(team.style, phase) + (selected ? styleBonus(String(selected), phase) : 0);
  };
  const contested = (phase, roles = null, snowball = true) => {
    const difference = strength(0, phase, roles) - strength(1, phase, roles) + (snowball ? (state.gold[0] - state.gold[1]) / 1550 : 0);
    return rng() < clamp(1 / (1 + Math.exp(-difference / 14)), .02, .98) ? 0 : 1;
  };
  const roleIndex = position => POSITIONS.indexOf(position);
  const actor = (ti, preferred = [], alive = [0, 1, 2, 3, 4]) => {
    const preferredIndices = preferred.map(roleIndex).filter(i => alive.includes(i));
    if (preferredIndices.length && rng() < .75) return choose(rng, preferredIndices);
    const weights = alive.map(i => Math.max(10, teams[ti].players[i].stats.mechanics + (i === 4 ? -35 : 0)));
    let ticket = rng() * weights.reduce((a, b) => a + b, 0);
    const index = weights.findIndex(w => (ticket -= w) <= 0);
    return alive[index < 0 ? alive.length - 1 : index];
  };
  const kill = (side, killerIndex, victimIndex, location, availableAssists = null) => {
    const killer = rows[side][killerIndex], victim = rows[1 - side][victimIndex];
    const candidates = [...new Set(availableAssists ?? [0, 1, 2, 3, 4])].filter(i => i !== killerIndex);
    const count = candidates.length ? 1 + Math.floor(rng() * Math.min(3, candidates.length)) : 0;
    const assists = shuffled(rng, candidates).slice(0, count).map(i => rows[side][i]);
    const bounty = state.streaks[1 - side][victimIndex] >= 3 ? Math.min(500, state.streaks[1 - side][victimIndex] * 100) : 0;
    killer.k++; victim.d++;assists.forEach(p => p.a++);
    state.streaks[side][killerIndex]++;state.streaks[1 - side][victimIndex] = 0;
    state.kills[side]++;state.gold[side] += 300 + bounty + assists.length * 50;
    return { killer: killer.nickname, victim: victim.nickname, killerTeam: teams[side].name, victimTeam: teams[1 - side].name, assists: assists.map(p => p.nickname), location, champion: killer.champion, victimChampion: victim.champion, bounty, shutdown: bounty > 0 };
  };
  const killText = record => wording([
    `${record.killer}(${record.champion})이 ${record.location}에서 ${record.victim}을 잡았다.`,
    `${record.location}. ${record.killer}(${record.champion})이 끝까지 거리를 좁혀 ${record.victim}을 정리했다.`,
    `${record.victim}이 ${record.location}에서 끊겼다. 마지막 타격은 ${record.killer}(${record.champion}).`,
    `${record.location}에서 ${record.killer}(${record.champion})의 진입이 먼저 닿았다. ${record.victim}이 쓰러졌다.`,
    `${record.location} 교전에서 ${record.victim}이 전사했다. 처치는 ${record.killer}(${record.champion})에게 돌아갔다.`,
    `${record.killer}(${record.champion})이 ${record.victim}을 마무리했다. 처치 위치는 ${record.location}.`,
    `${record.location}에서 킬 로그가 올라왔다. ${record.killer}(${record.champion}) → ${record.victim}.`,
    `${record.victim}이 ${record.location}에서 잡혔다. ${record.killer}(${record.champion})이 처치를 챙겼다.`,
    `${record.location}. ${record.victim}이 쓰러지고 ${record.killer}(${record.champion})의 킬이 추가됐다.`,
    `${record.killer}(${record.champion})과 ${record.victim}의 교전이 처치로 끝났다. ${record.location}에서 ${record.killer}가 처치를 챙겼다.`,
    `${record.victim}이 버티던 ${record.location}에서 처치가 났다. ${record.killer}(${record.champion})이 킬을 가져갔다.`,
    `${record.location}의 킬은 ${record.killer}(${record.champion}). ${record.victim}이 전광판으로 올라갔다.`,
  ]) + (record.bounty ? ` 현상금 ${record.bounty}골드가 넘어갔다.` : '');
  const awardTower = (side, lane, amount = 1) => {
    const taken = Math.min(amount, (expandedObjectives?11:9) - state.towers[side]);
    state.towers[side] += Math.max(0, taken);state.gold[side] += Math.max(0, taken) * 500;
    lastPush[side] = clock;return taken;
  };
  const fight = (seconds, phase, decisive = false, location = null) => {
    const side = contested(phase), other = 1 - side;
    const beforeGap = state.gold[side] - state.gold[other];
    const place = location || choose(rng, ['미드 강가', '용 둥지 입구', '미드 2차 포탑 앞', '바론 강가', '탑 삼거리']);
    const victims = shuffled(rng, [0, 1, 2, 3, 4]);
    const winKills = decisive ? 4 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
    const carry = actor(side, ['MID', 'ADC']);
    const records = victims.slice(0, winKills).map(victim => kill(side, rng() < .6 ? carry : actor(side), victim, place));
    const survivors = [0, 1, 2, 3, 4].filter(i => !victims.slice(0, winKills).includes(i));
    const lossKills = survivors.length ? Math.floor(rng() * Math.min(3, survivors.length + 1)) : 0;
    for (const victim of shuffled(rng, [0, 1, 2, 3, 4]).slice(0, lossKills)) records.push(kill(other, actor(other, [], survivors), victim, place, survivors));
    const major = rows[side].filter(p => records.filter(r => r.killerTeam === teams[side].name && r.killer === p.nickname).length >= 2).sort((a,b) => b.k-a.k)[0];
    const multiKill = major ? records.filter(r => r.killer === major.nickname && r.killerTeam === teams[side].name).length : 0;
    const recovery = beforeGap < -1800;
    const towersTaken = seconds > 20 * 60 && winKills - lossKills >= 2 ? awardTower(side, 'MID', decisive ? 2 : 1) : 0;
    const comeback = recovery && state.gold[side] >= state.gold[other];
    teamfights++;
    const opening = wording([
      `${place}. ${rows[side][carry].nickname} 쪽으로 후속 합류가 이어졌다.`,
      `${place}에서 진입과 후속 딜이 맞물렸다. ${rows[side][carry].nickname}이 교전 중심에 섰다.`,
      `${place}. 앞선 시야를 잡은 ${teams[side].name}이 상대 진형을 둘로 갈랐다.`,
      `${place}에서 한 번에 다섯 명이 붙었다. ${teams[side].name}의 첫 타겟 전환이 빨랐다.`,
      `${place}에서 양 팀이 맞붙었다. ${teams[side].name}이 연속 처치를 만들었다.`,
      `${place}. 교전이 길어지면서 ${teams[side].name} 쪽으로 처치가 쌓였다.`,
      `${teams[side].name}이 ${place} 싸움에서 상대 인원을 줄였다.`,
      `${place}에 모인 두 팀이 한타를 벌였다. ${teams[side].name}의 후속 공격이 이어졌다.`,
      `${place}에서 대치가 끝나고 양 팀의 교전이 시작됐다. 처치 로그가 연달아 올라왔다.`,
      `${teams[side].name}이 ${place}에서 교환을 만들었다. 진입 뒤 팀원들이 공격을 이어갔다.`,
    ]);
    add(seconds, decisive ? 'decisive_fight' : 'teamfight', `${opening} ${records.map(r => `${r.killer} → ${r.victim}`).join(', ')}. ${winKills}:${lossKills} 교환.${multiKill ? ` ${major.nickname}이 이번 교전에서 ${multiKill}킬을 기록했다.` : ''}${comeback ? ' 뒤처지던 쪽이 골드 주도권까지 뒤집었다.' : recovery ? ' 뒤처지던 쪽이 차이를 좁혔다.' : ''}${towersTaken ? ` 교전 뒤 미드 포탑 ${towersTaken}개를 밀었다.` : ''}`,
      side, { kills: records, actors: [...new Set(records.flatMap(r=>[r.killer,r.victim]))], location: place, comeback, multiKill }, { killer: major?.nickname || records[0].killer, champion: major?.champion || records[0].champion, killCount: major?.k || rows[side].find(p=>p.nickname===records[0].killer).k, winKills, lossKills, multiKill });
    const support=rows[side].find(p=>p.position==='SUP');
    const participation=support?records.filter(r=>r.killerTeam===teams[side].name&&(r.killer===support.nickname||r.assists.includes(support.nickname))).length:0;
    const hero=multiKill>=3?major:participation>=3?support:null;
    if(hero){
      const scene=events.at(-1),lines=multiKill>=3?[
        `${hero.nickname}(${hero.champion})이 타겟을 바꾸며 ${multiKill}명을 연속으로 정리했다. 남은 팀원이 앞으로 붙을 공간이 생겼다.`,
        `교전 중심은 ${hero.nickname}이었다. ${multiKill}킬을 이어 가져가며 상대의 후속 합류를 끊었다.`,
        `${hero.nickname}의 ${multiKill}킬. 앞줄이 무너진 뒤에도 추격을 멈추지 않아 남은 상대가 흩어졌다.`
      ]:[
        `${hero.nickname}(${hero.champion})이 이번 교전의 ${participation}킬에 관여했다. 딜러가 타겟을 바꿀 때마다 함께 따라붙었다.`,
        `${hero.nickname}의 합류가 ${participation}번의 처치로 연결됐다. 화면에 잡힌 마지막 킬 뒤에도 지원이 이어졌다.`
      ];
      scene.text+=' '+wording(lines);scene.spotlight={nickname:hero.nickname,champion:hero.champion,kind:multiKill>=3?'multi-kill':'assist-chain',kills:multiKill>=3?multiKill:0,participation};
      scene.reactions.push(wording(multiKill>=3?[`${hero.nickname} 씨발 ${multiKill}킬을 혼자 먹노`,`${hero.champion} 저렇게 하는 거였냐 ㅋㅋ`,`${hero.nickname} 방금 한타에서 미쳤다`]:[`${hero.nickname} 킬에 안 뜬다고 한 게 없냐? ${participation}번 다 붙었는데`,`${hero.champion} 옆에서 다 해주네 ㄷㄷ`]));
    }
    return { side, decisive, winKills, lossKills, type: decisive ? 'decisive_fight' : 'teamfight' };
  };
  const gank = (seconds, phase) => {
    const lane = choose(rng, ['TOP', 'MID', 'ADC']), side = contested(phase, [lane, 'JGL']);
    const counter = rng() < .33 && ganks > 0;
    const location = choose(rng, [`${LANE_LABELS[lane]} 강가 입구`, `${LANE_LABELS[lane]} 1차 포탑 앞`, `${LANE_LABELS[lane]} 뒤쪽 삼거리`]);
    const record = kill(side, actor(side, ['JGL', lane], [1, roleIndex(lane), ...(lane === 'ADC' ? [4] : [])]), roleIndex(lane), location, [1, roleIndex(lane), ...(lane === 'ADC' ? [4] : [])]);
    ganks++;
    add(seconds, counter ? 'counter_gank' : 'gank', `${counter ? `${teams[1-side].name}의 갱킹 뒤에 ${teams[side].name} 정글이 따라붙었다. 역갱으로 숫자가 뒤집혔다. ` : wording(['정글이 시야 밖으로 크게 돌아 들어왔다. ', '밀린 웨이브 뒤에서 정글과 라이너가 동시에 합류했다. ', '상대 정글이 반대쪽에 보이자 빈 라인으로 들어갔다. '])}${killText(record)}`,
      side, { kills: [record], actors: [record.killer, record.victim, ...record.assists], location, counter });
    return { side, type: counter ? 'counter_gank' : 'gank' };
  };
  const skirmish = (seconds, phase, type) => {
    const lane = type === 'bot_skirmish' ? 'ADC' : choose(rng, ['TOP', 'MID', 'ADC']);
    const roles = type === 'invade' ? ['JGL', 'MID'] : type === 'bot_skirmish' ? ['ADC','SUP'] : [lane];
    const side = contested(phase, roles), other = 1-side;
    const victimIndex = type === 'invade' ? 1 : roleIndex(lane);
    const location = type === 'invade' ? choose(rng,['블루 버프 입구','칼날부리 캠프','레드 버프 뒤편']) : type === 'vision_catch' ? choose(rng,['미드 강가 수풀','적 블루 입구','바론 앞 제어 와드 자리']) : `${LANE_LABELS[lane]} ${type==='tower_dive'?'1차 포탑 안쪽':'라인'}`;
    const pool = roles.map(roleIndex);
    const solo = type === 'solo_kill' || type === 'outplay';
    const killer = solo ? roleIndex(lane) : actor(side, roles, type==='bot_skirmish' ? [3,4] : [0,1,2,3,4]);
    const record = kill(side, killer, victimIndex, location, solo ? [] : type === 'bot_skirmish' ? [3,4] : pool.length>1 ? pool : [1,roleIndex(lane)]);
    const records = [record];
    if (type === 'bot_skirmish' && rng() < .48) records.push(kill(side, actor(side,['ADC','SUP'],[3,4]), 4, location, [3,4]));
    if (type === 'tower_dive' && rng() < .37) {
      const defender = victimIndex === 4 ? 1 : 4;
      records.push(kill(other, defender, killer, location, []));
    }
    const descriptions = {
      solo_kill: ['긴 라인에서 맞교환이 누적됐다. 마지막 한 번의 딜교환으로 솔로 킬이 났다. ', '웨이브를 받던 상대에게 혼자 진입했다. 정글 도움 없이 마무리했다. '],
      outplay: ['핵심 스킬을 옆으로 흘린 뒤 바로 반격했다. ', '적은 체력으로 싸움을 길게 끌었다. 상대의 진입을 받아쳐 뒤집었다. '],
      invade: ['라이너가 먼저 강가로 내려왔다. 상대 정글 캠프에서 퇴로를 끊었다. ', '정글 캠프를 치던 상대에게 미드와 정글이 함께 들어갔다. '],
      bot_skirmish: ['바텀 2대2. 서포터의 진입에 원딜이 바로 거리를 좁혔다. ', '바텀에서 같은 순간 앞무빙이 나왔다. 먼저 맞춘 쪽이 교환을 가져갔다. '],
      tower_dive: ['큰 웨이브를 밀어 넣고 포탑 안으로 들어갔다. ', '정글 위치를 확인한 뒤 포탑 밑의 상대를 둘러쌌다. '],
      vision_catch: ['와드를 바꾸러 나온 선수를 수풀에서 기다렸다. ', '아군이 먼저 지운 시야 안으로 상대가 혼자 들어왔다. '],
    };
    const alternateDescriptions={
      solo_kill:['라인 맞대결에서 한 선수가 끝까지 공격했다. 외부 지원 없는 처치가 나왔다. ','일대일 교환에서 체력 차이가 벌어졌다. 마지막 공격이 처치로 이어졌다. ','라인에서 둘이 맞붙었다. 퇴각하기 전에 승부가 났다. ','혼자 마주친 상대에게 공격을 이어갔다. 지원이 붙기 전에 교전이 끝났다. ','서로 공격할 거리를 재다가 솔로 킬이 났다. ','라인에서 계속되던 교환이 한 명의 전사로 끝났다. '],
      outplay:['상대의 공격을 피한 뒤 반격을 연결했다. ','잡으러 들어온 상대에게 오히려 처치를 돌려줬다. ','공격을 받아내며 거리를 다시 잡았다. 뒤따른 반격으로 교전이 끝났다. ','위험한 위치에서 바로 무너지지 않았다. 상대의 진입 뒤에 반격을 넣었다. ','적은 체력으로 거리를 벌렸다가 다시 공격했다. ','상대가 접근한 순간 방향을 바꿨다. 반격이 처치까지 이어졌다. '],
      invade:['정글 안쪽에서 두 팀이 마주쳤다. 침투한 쪽이 먼저 퇴로를 막았다. ','캠프를 사이에 둔 대치에서 처치가 났다. ','라이너가 정글 교전에 합류했다. 상대 진영에서 인원을 끊었다. ','상대 정글 지역으로 들어가 캠프 주변의 선수를 노렸다. ','정글 안쪽 통로에서 교전이 벌어졌다. ','캠프를 확인하러 들어온 움직임이 선수 처치로 이어졌다. '],
      bot_skirmish:['바텀 두 선수가 동시에 앞쪽으로 움직였다. 가까운 거리에서 교환이 났다. ','바텀 라인에서 서로 공격을 주고받았다. 원딜과 서포터가 함께 붙었다. ','바텀 2대2 교전. 먼저 맞붙은 뒤 양쪽의 후속 공격이 이어졌다. ','아래쪽 라인에서 공격 거리가 겹쳤다. 서포터와 원딜이 같은 타겟을 노렸다. ','바텀에서 짧은 대치 뒤에 교전이 벌어졌다. ','원딜의 공격에 서포터가 붙었다. 바텀 교환이 처치로 끝났다. '],
      tower_dive:['수비하던 상대의 포탑 안으로 인원이 들어갔다. ','웨이브가 도착한 뒤 포탑 아래로 진입했다. ','포탑을 끼고 있던 선수에게 공격을 집중했다. ','포탑 주변에 인원을 붙이고 안쪽의 상대를 노렸다. ','수비 포탑 안에서 교전이 벌어졌다. ','라인을 정리한 뒤 물러나지 않고 포탑 안까지 따라붙었다. '],
      vision_catch:['시야를 확인하려던 선수가 어두운 통로에서 잡혔다. ','수풀을 지나던 상대를 기다리던 인원이 끊었다. ','시야를 바꾸는 동선에서 혼자 움직이던 선수가 노출됐다. ','상대가 확인하지 못한 자리에서 먼저 공격했다. ','시야가 끊긴 구역으로 들어온 상대에게 교전이 걸렸다. ','다음 지역을 확인하던 움직임이 처치로 끝났다. '],
    };
    for(const [kind,values]of Object.entries(alternateDescriptions))descriptions[kind].push(...values);
    add(seconds,type,wording(descriptions[type]||descriptions.vision_catch)+records.map(killText).join(' ')+(type==='tower_dive'&&records.length>1?' 포탑 안에서 한 명을 내주며 빠져나왔다.':''), side,
      { kills:records,actors:[...new Set(records.flatMap(r=>[r.killer,r.victim]))],location,method:type==='outplay'?'dodge-and-counter':type }, { winKills:records.filter(r=>r.killerTeam===teams[side].name).length,lossKills:records.filter(r=>r.killerTeam!==teams[side].name).length });
    return { side, type };
  };
  const objective = (seconds, phase, kind = 'dragon') => {
    const side = contested(phase, ['JGL','SUP','MID']), other = 1-side;
    const steal = rng()<.16;
    const contestedFight = !steal && rng()<.35;
    const name = kind==='grubs'?'공허 유충 3마리':kind==='baron'?'바론':soul===null?(state.dragons[side]===3?'용 영혼':'드래곤'):'장로 드래곤';
    const location = kind==='grubs'?'공허 유충 둥지':kind==='baron'?'바론 둥지':'용 둥지';
    const records=[];
    if(contestedFight) {
      const n=1+Math.floor(rng()*2);
      for(const victim of shuffled(rng,[0,2,3,4]).slice(0,n))records.push(kill(side,actor(side,['MID','ADC']),victim,location,[1,2,3,4]));
    }
    if(kind==='grubs'){state.grubs[side]+=3;state.gold[side]+=225;}
    else if(kind==='baron') { state.barons[side]++;baronNext=seconds+360;baronBuff[side]=seconds+180;state.gold[side]+=1500; }
    else if(soul!==null) {state.elders[side]++;dragonNext=seconds+360;state.gold[side]+=900;}
    else {state.dragons[side]++;if(state.dragons[side]===4)soul=side;dragonNext=seconds+(soul===null?300:360);state.gold[side]+=500;}
    const jungler=rows[side][1].nickname;
    const opening=steal?`${teams[other].name}이 먼저 체력을 낮췄다. ${jungler}가 둥지 안으로 들어가 마지막 타격을 가져갔다. `:contestedFight?`${teams[side].name}이 먼저 상대 합류를 끊었다. ${records.map(r=>`${r.killer} → ${r.victim}`).join(', ')}. `:wording([`${teams[other].name}이 반대쪽 웨이브를 받는 사이 `,`${teams[side].name}이 입구 시야를 먼저 지웠다. `,`상대가 귀환한 틈에 ${jungler}가 팀원을 불렀다. `]);
    add(seconds,kind==='baron'?'baron':'objective',`${opening}${teams[side].name}이 ${name}을 확보했다.${steal?' 오브젝트는 넘어갔고 양쪽이 뒤로 물러났다.':''}`,side,
      { objective:name,location,kills:records,actors:[jungler,...new Set(records.flatMap(r=>[r.killer,r.victim]))],subtype:steal?(kind==='baron'?'baron_steal':'objective_steal'):contestedFight?'objective_contest':undefined,steal,dragonCount:state.dragons[side] },
      {killer:records[0]?.killer||jungler,objective:name,winKills:records.length,lossKills:0});
    return {side,type:kind==='baron'?'baron':'objective'};
  };
  const mapMove = (seconds,phase,type='vision') => {
    const side=contested(phase,['TOP','SUP','JGL']),other=1-side;
    if(type==='side_push') {
      const lane=choose(rng,['TOP','MID','ADC']), already=state.towers[side], taken=awardTower(side,lane,1);
      add(seconds,'side_push',`${rows[side][roleIndex(lane)].nickname}이 ${LANE_LABELS[lane]} 웨이브를 끝까지 밀었다. ${teams[other].name}이 ${wording(['강가에 인원을 모으는','반대 라인에 합류하는','오브젝트 입구를 지키는'])} 동안 ${taken?'포탑 하나를 가져갔다.':'억제기 쪽 웨이브를 밀어 넣었다.'}`,side,{kills:[],location:`${LANE_LABELS[lane]} 라인`,objective:taken?'포탑':'억제기 압박',towersBefore:already},{killer:rows[side][roleIndex(lane)].nickname,role:LANE_LABELS[lane]});
    } else if(type==='herald') {
      heraldTaken=true;state.heralds[side]++;state.gold[side]+=450;
      add(seconds,'objective',`${rows[side][1].nickname}이 상대 정글 위치를 확인했다. ${teams[side].name}이 전령을 확보하고 미드에 인원을 보냈다.`,side,{kills:[],objective:'전령',location:'전령 둥지'}, {killer:rows[side][1].nickname,objective:'전령'});
    } else {
      const communication=teams[other].players.reduce((sum,p)=>sum+p.stats.communication,0)/5;
      const conflict=rng()<clamp((100-communication)/150,.08,.45);
      state.gold[side]+=180;
      const support=rows[side][4].nickname;
      add(seconds,conflict?'call_conflict':type,conflict?`${rows[other][1].nickname}은 강가 진입을, ${rows[other][2].nickname}은 사이드 수비를 콜했다. 합류가 둘로 갈린 사이 ${teams[side].name}이 먼저 시야를 잡았다.`:wording([`${support}가 강가의 와드를 하나씩 지웠다. ${teams[side].name}이 다음 오브젝트 쪽으로 먼저 자리를 옮겼다.`,`${teams[side].name}이 급하게 싸우지 않고 웨이브를 정리했다. ${support}가 안전한 귀환 동선을 열었다.`,`${rows[side][1].nickname}이 상대 캠프를 확인하고 빠졌다. ${teams[side].name}이 비어 있는 라인으로 인원을 바꿨다.`]),side,{kills:[],location:'강가 시야 구역',actors:[support]},{killer:support});
    }
    return {side,type};
  };

  add(0,'draft',`${draft.selectionRight?`RoFS: ${draft.selectionRight.team} · ${draft.selectionRight.reason} · 선픽 자동 선택. `:''}${stage||'공식 경기'} ${number}세트. ${teams[0].name}: ${draft.picksA.map(p=>`${p.nickname} ${p.champion}`).join(' · ')}. ${teams[1].name}: ${draft.picksB.map(p=>`${p.nickname} ${p.champion}`).join(' · ')}.`,null,{}, {champion:draft.picksA[2].champion,role:'미드'});
  const laneTime=90+Math.floor(rng()*65);advance(laneTime);
  const laneSide=contested('early',['TOP','MID','ADC'],false),lane=choose(rng,['TOP','MID','ADC']);
  state.gold[laneSide]+=130;
  add(laneTime,'laning',wording([`${rows[laneSide][roleIndex(lane)].nickname}이 ${LANE_LABELS[lane]}에서 먼저 웨이브를 밀었다. 정글이 그쪽 강가를 확인했다.`,`${LANE_LABELS[lane]} 라인에서 ${rows[laneSide][roleIndex(lane)].nickname}이 미니언 뒤 공간을 잡았다. 상대가 먼저 뒤로 물러났다.`,`${rows[laneSide][roleIndex(lane)].nickname}이 ${LANE_LABELS[lane]} 웨이브를 천천히 쌓았다. 다음 합류를 준비한다.`]),laneSide,{kills:[],location:`${LANE_LABELS[lane]} 라인`},{killer:rows[laneSide][roleIndex(lane)].nickname,role:LANE_LABELS[lane]});
  const firstTime=180+Math.floor(rng()*225);advance(firstTime);
  const method=choose(rng,['solo','gank','invade','bot-duo','river']);
  const firstRole=method==='invade'?'JGL':method==='bot-duo'?'ADC':choose(rng,['TOP','MID','ADC']);
  const firstSide=contested('early',[firstRole,'JGL']);
  const firstPool=method==='solo'?[roleIndex(firstRole)]:method==='bot-duo'?[3,4]:[roleIndex(firstRole),1];
  const firstKiller=actor(firstSide,[firstRole,...(method==='solo'?[]:['JGL'])],firstPool);
  const firstLocation=method==='invade'?choose(rng,['레드 버프 입구','블루 버프 뒤편']):method==='solo'?`${LANE_LABELS[firstRole]} 라인`:`${LANE_LABELS[firstRole]} 강가 입구`;
  const first=kill(firstSide,firstKiller,roleIndex(firstRole),firstLocation,method==='solo'?[]:firstPool);
  add(firstTime,'first_blood',`퍼스트 킬. ${killText(first)} ${method==='solo'?'정글 개입 없이 혼자 만든 킬이다.':first.assists.length?`${first.assists.join(', ')}이 먼저 합류했다.`:'다른 라인 합류 전에 교전이 끝났다.'}`,firstSide,{actors:[first.killer,first.victim,...first.assists],kills:[first],location:firstLocation,method},{method});
  if(rng()<.38) {
    const defender=choose(rng,[0,1,2,3,4].filter(i=>i!==roleIndex(firstRole)));advance(firstTime+5+Math.floor(rng()*9));
    const record=kill(1-firstSide,defender,firstKiller,firstLocation,[]);
    add(clock,'trade_kill',`러브샷. ${killText(record)} ${wording(['먼저 들어온 선수가 빠져나가기 전에 끊었다.','낮은 체력의 퇴로를 끝까지 따라갔다.','킬을 내준 뒤 곧바로 한 명을 데려갔다.'])}`,1-firstSide,{kills:[record],actors:[record.killer,record.victim],location:firstLocation});
  }
  let winner=null,step=0,last=null;
  while(clock<47*60 && winner===null && step<28) {
    const seconds=clock+80+Math.floor(rng()*91);advance(seconds);step++;
    const phase=phaseAt(seconds),roll=rng();
    if(ganks===0) last=gank(seconds,phase);
    else if(expandedObjectives&&seconds>=360&&state.grubs[0]+state.grubs[1]===0) last=objective(seconds,phase,'grubs');
    else if(seconds>=dragonNext && (state.dragons[0]+state.dragons[1]===0 || roll<.35)) last=objective(seconds,phase);
    else if(seconds>=18*60 && teamfights===0) last=fight(seconds,phase);
    else if(seconds>=closingPhase) last=fight(seconds,phase,true);
    else if(seconds>=baronNext && roll<.26) last=objective(seconds,phase,'baron');
    else if(seconds>=16*60 && !heraldTaken && roll<.14) last=mapMove(seconds,phase,'herald');
    else if(roll<.15) last=gank(seconds,phase);
    else if(roll<.35) last=skirmish(seconds,phase,choose(rng,phase==='early'?['solo_kill','invade','bot_skirmish','tower_dive','outplay']:['solo_kill','vision_catch','outplay','bot_skirmish']));
    else if(roll<.56 && seconds>=13*60) last=fight(seconds,phase);
    else if(roll<.77) last=mapMove(seconds,phase,'side_push');
    else last=mapMove(seconds,phase,roll>.9?'reset':'vision');
    const side=last.side,gap=state.gold[side]-state.gold[1-side];
    const wonLargeFight=['teamfight','decisive_fight'].includes(last.type)&&last.winKills-last.lossKills>=2;
    const pushReady=(state.towers[side]>=3 && gap>1800) || (state.towers[side]>=2 && (baronBuff[side]>seconds || state.elders[side]>0));
    if(seconds>=24*60 && teamfights>0 && ((wonLargeFight&&(pushReady||gap>5500)) || (last.type==='side_push'&&pushReady&&gap>6500) || (last.decisive&&last.winKills>=4)))winner=side;
  }
  if(winner===null) {advance(clock+85);last=fight(clock,'late',true);winner=last.side;}
  advance(clock+35+Math.floor(rng()*37));
  state.towers[winner]=Math.max(state.towers[winner],9);
  add(clock,'nexus',wording([`${teams[winner].name}이 남은 인원과 웨이브를 모아 미드로 들어갔다. 억제기와 쌍둥이 포탑이 무너졌다. 넥서스 파괴.`,`${teams[winner].name}이 수비 인원이 없는 쪽으로 바로 진입했다. 남은 포탑을 정리하고 넥서스를 파괴했다.`,`${teams[winner].name}이 교전 뒤에 멈추지 않았다. 밀어 넣은 웨이브와 함께 본진을 끝까지 밀었다. 넥서스 파괴.`])+` ${number}세트 종료.`,winner,{kills:[],location:'상대 넥서스'});
  const mvp=[...rows[winner]].sort((a,b)=>(b.k*2+b.a-b.d)-(a.k*2+a.a-a.d))[0];
  return {number,...(tournamentRules.performanceVersion===1?{performanceVersion:1}:{}),...(expandedObjectives?{objectiveVersion:1}:{}),coachComms:tournamentRules.coachComms?coaches.map(c=>({team:c.team,used:c.activations.length,remaining:3-c.activations.length,activations:c.activations})):undefined,winner:teams[winner].name,duration:formatTime(clock),killsA:state.kills[0],killsB:state.kills[1],events,draft,scoreboard,goldA:state.gold[0],goldB:state.gold[1],objectives:objectiveCounts(),mvp:mvp.nickname};
}
export function simulateSeries({ teamA, teamB, bestOf = 3, seed = 'LCK', stage = '', strategy = '', recentComments=[], selectionRight=false, selectionReason='', coachComms=false, setStrategies={}, objectiveVersion=1, draftVersion=1, performanceVersion=1 } = {}) {
  if (![1, 3, 5].includes(bestOf)) throw new RangeError('bestOf는 1, 3, 5 중 하나여야 합니다.');
  const teams = [normalizeTeam(teamA, 0), normalizeTeam(teamB, 1)];
  if (teams[0].name === teams[1].name) throw new Error('서로 다른 두 팀이 필요합니다.');
  const rng = seededRandom(seed);
  const spent = new Set(),castUsed=new Set();
  const reactions = createCommentator(seededRandom(`${seed}:community`), new Set(recentComments));
  const sets = [];
  let scoreA = 0, scoreB = 0,firstSelection=0;
  const target = Math.ceil(bestOf / 2);
  while (scoreA < target && scoreB < target) {
    const set = simulateSet(teams, sets.length + 1, spent, rng, setStrategies[sets.length+1]||strategy, stage, reactions, seededRandom(`${seed}:narration:${sets.length + 1}`),castUsed,{firstSelection,selectionRight,selectionReason,coachComms,objectiveVersion,draftVersion,performanceVersion,coachSeed:`${seed}:coach:${sets.length+1}`});
    if(setStrategies[sets.length+1])set.strategy=structuredClone(setStrategies[sets.length+1]);
    annotateMultiKills(set,`${seed}:${set.number}`);
    sets.push(set);
    if(selectionRight||draftVersion===1)firstSelection=set.winner===teams[0].name?1:0;
    if (set.winner === teams[0].name) scoreA++; else scoreB++;
  }
  const seenReactions=new Set(recentComments);
  for(const set of sets)for(const event of set.events)event.reactions=event.reactions.filter(text=>{if(seenReactions.has(text))return false;seenReactions.add(text);return true;});
  const winner = scoreA > scoreB ? teams[0].name : teams[1].name;
  const finalSet = sets.at(-1);
  const recap = [
    `${stage || '시리즈'} 종료. ${teams[0].name} ${scoreA}:${scoreB} ${teams[1].name}. 승리 팀은 ${winner}.`,
    `${finalSet.number}세트 ${finalSet.mvp}이 교전의 마무리를 맡았다. 최종 킬 스코어 ${finalSet.killsA}:${finalSet.killsB}.`,
    ...sets.map(set => {
      const blood = set.events.find(e => e.type === 'first_blood').kills[0];
      const steal = set.events.find(e => e.steal);
      const major = [...set.events].filter(e => ['teamfight', 'decisive_fight'].includes(e.type)).sort((a, b) => (b.kills?.length || 0) - (a.kills?.length || 0))[0];
      const carry = [...set.scoreboard].sort((a, b) => (b.k * 2 + b.a - b.d) - (a.k * 2 + a.a - a.d))[0];
      const options = [
        `${set.number}세트 복기: ${blood.location}에서 ${blood.killer}이 퍼스트 킬을 만들었다. ${set.winner}의 넥서스 마무리는 ${set.duration}.`,
        `${set.number}세트 기록: ${carry.nickname} ${carry.k}/${carry.d}/${carry.a}. ${major ? `${major.time} ${major.location} 교전에서 ${major.team}이 주도권을 잡았다.` : `${set.winner}이 ${set.duration}에 끝냈다.`}`,
        steal ? `${set.number}세트 오브젝트: ${steal.time} ${steal.objective} 스틸이 나왔다. 마지막 교전 뒤 ${set.winner}이 본진까지 진입했다.` : `${set.number}세트 운영: ${set.winner}이 총 ${set.objectives.dragons[set.winner === teams[0].name ? 0 : 1]}드래곤과 ${set.objectives.barons[set.winner === teams[0].name ? 0 : 1]}바론을 확보했다. 경기 시간 ${set.duration}.`,
      ];
      return choose(seededRandom(`${seed}:recap:${set.number}`), options);
    }),
  ];
  const performances=summarizePerformances(sets),pom=selectPom(performances,winner,String(seed));
  return { winner, scoreA, scoreB, bestOf, sets, recap, pom, performances, seed: String(seed), stage,
    simulationNote: '사건별 능력·컨디션·팀 성향·골드 차이로 판정하며, 누적 교전과 오브젝트 이후 넥서스 파괴로 승패가 결정됩니다.' };
}
