import { seededRandom } from './match.mjs';

// Team activities are fictional club appointments, rather than real LCK dates.
const activities = [
  ['파트너사 광고 촬영','촬영 스튜디오','광고','새 유니폼 위에 마이크를 달았다. 제품을 건네는 손 위치부터 다시 맞췄다. 마지막 컷을 찍고 감독의 오케이 사인이 나자 다 같이 어깨를 풀었다.',2,-1],
  ['프로필·단체 화보','사진 스튜디오','화보','개인 컷에서는 진지했지만 단체 컷에서 결국 웃음이 터졌다. 사진가가 그 표정 그대로 한 장을 더 찍었다. 보정할 사진은 각자 직접 골랐다.',2,-2],
  ['구단 팬미팅','팬 라운지','팬 행사','팬들이 준비한 질문지를 돌아가며 읽었다. 경기장에서 알아보던 응원 문구를 바로 앞에서 발견했다. 마지막 단체 사진까지 찍고 인사를 마쳤다.',3,-3],
  ['팀 채널 예능 촬영','콘텐츠 촬영실','콘텐츠','대본에는 가벼운 퀴즈라고 적혀 있었다. 승부가 붙자 목소리가 커지고 제작진이 룰을 다시 설명했다. 벌칙 소품을 들고 엔딩 인사를 찍었다.',2,-2],
  ['시즌 중간 인터뷰','미디어룸','인터뷰','기자가 최근 경기의 선택을 물었다. 화면에서 보이지 않았던 콜과 준비 과정을 차분히 설명했다. 말을 고치고 싶은 부분은 녹음이 끝나기 전에 다시 확인했다.',1,1],
  ['정기 손목·자세 검진','구단 클리닉','검진','손목 가동 범위와 앉는 자세를 점검했다. 트레이너가 책상 높이와 쉬는 간격을 적어 줬다. 통증을 참기보다 미리 말하자는 약속도 남겼다.',-4,-1],
  ['스폰서 제품 체험 방송','구단 방송실','광고','파트너사의 새 장비를 연결하고 실제 설정을 비교했다. 제품 설명과 게임 이야기를 번갈아 하다 보니 예정 시간이 꽉 찼다. 방송 종료 뒤 장비를 원래대로 돌렸다.',2,0],
  ['팬 사인회','구단 행사장','팬 행사','이름 철자를 다시 확인하며 사인을 했다. 손편지는 따로 봉투에 챙겼다. 다음 경기에도 보러 오겠다는 말을 듣고 고개를 숙여 인사했다.',2,-2],
  ['팀 다큐멘터리 촬영','연습실','콘텐츠','카메라를 의식하던 분위기가 복기를 시작하자 금방 사라졌다. 제작진은 선수들의 말이 끝날 때까지 기다렸다. 촬영 종료 후에는 평소 연습실로 돌아왔다.',1,0],
  ['보이스·홍보 문구 녹음','녹음실','광고','짧은 응원 멘트를 여러 속도로 읽었다. 평소 말투로 해 달라는 요청에 마지막 테이크를 다시 녹음했다. 서로의 녹음본을 듣다가 웃음을 참지 못했다.',1,-1],
  ['아마추어 멘토링','구단 교육실','팬 행사','어린 선수들이 준비해 온 리플레이를 함께 봤다. 정답 하나보다 선택의 이유를 묻는 시간이 길어졌다. 헤어지기 전에는 다음 목표를 하나씩 정했다.',2,-2],
  ['팀 오디오·장비 점검','연습실','팀 일정','대회용 설정을 저장하고 마이크 레벨을 맞췄다. 백업 장비로도 한 번씩 접속했다. 매니저가 체크리스트 마지막 칸에 표시했다.',-1,0],
];
const dateAfter = (date, days) => new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);

export function clubSchedule(room) {
  const s=room.season;
  if(s.year!==2026||!s.team||s.draft)return [];
  const completed=s.clubDiary||[],busy=new Set(s.schedule.filter(m=>[m.teamA,m.teamB].includes(s.team)).map(m=>m.date));
  const used=new Set(completed.map(x=>x.date)),events=[];
  const random=seededRandom(`${s.seed}:club:${s.team}`);
  for(let month=1;month<=11;month++)for(let slot=0;slot<3;slot++){
    const id=`club-2026-${month}-${slot}`,done=completed.find(e=>e.id===id),index=(month*3+slot-3)%activities.length;
    const [title,location,category,text,fatigue,stress]=activities[index];
    const generated=`2026-${String(month).padStart(2,'0')}-${String([6,16,25][slot]+Math.floor(random()*3)).padStart(2,'0')}`;
    let date=s.clubPlan?.find(e=>e.id===id)?.date||generated;
    if(date<s.startDate)date=dateAfter(s.startDate,slot+1);
    // Completed appointments retain their original date even if brackets change.
    if(done){events.push({...done,status:'completed'});continue;}
    for(let i=0;i<45&&(busy.has(date)||used.has(date));i++)date=dateAfter(date,1);
    if(date>s.endDate||date<s.date||busy.has(date)||used.has(date))continue;
    // Already missed appointments on old saves are not moved into a pile today.
    const originalMonth=Number(date.slice(5,7));
    if(originalMonth>month+1||date<s.date)continue;
    used.add(date);events.push({id,date,title,location,category,text,fatigue,stress,status:'scheduled'});
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}

export function processClubActivities(room) {
  const s=room.season,plan=clubSchedule(room);
  if(s.year===2026&&s.team&&!s.draft)s.clubPlan=plan;
  const today=plan.filter(e=>e.date===s.date&&e.status==='scheduled');
  for(const event of today){
    s.clubDiary??=[];s.clubDiary.push({...event,status:'completed'});
    for(const p of room.players){
      p.character.fatigue=Math.max(0,Math.min(100,p.character.fatigue+event.fatigue));
      p.character.stress=Math.max(0,Math.min(100,p.character.stress+event.stress));
    }
    s.history.unshift({id:event.id,date:s.date,turn:s.turn,type:'club-activity',text:`${event.title} · ${event.location}. ${event.text}`});
  }
  return today;
}
