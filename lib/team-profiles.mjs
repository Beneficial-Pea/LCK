import calendar2026 from '../data/calendar-2026.json' with { type: 'json' };

// Results-derived game presets, not official player ratings.
// The conversion formula is public; play styles are authored balancing choices.
export const TEAM_PROFILE_BASIS = {
  referenceYear: 2026,
  label: '2026 완료 경기 성적 기반 초기 전력 · 10월 31일 자료 기준',
  description: `${calendar2026.assessmentMethod} 독립 공개 캘린더의 경기 결과를 사용했으며 공식 원문 직접 대조는 미완료입니다. 시즌 시작 시점의 예측이 아닌 회고형 프리셋입니다.`,
  source: calendar2026.source,
  currentSeasonVerified: false,
  resultSource: 'secondary-calendar-snapshot',
  editable: true,
};

const descriptions = [
  { name: 'T1', fullName: 'T1', power: 89, style: '한타', description: '국제 무대의 큰 경기 경험을 강점으로 둔 팀입니다. 교전과 후반 판단을 중심으로 시즌을 설계할 수 있습니다.', basis: '2025 월즈 우승 성적 참고 · 수치와 성향은 게임용 환산' },
  { name: 'Gen.G', fullName: 'Gen.G', power: 92, style: '균형 운영', description: '라인 주도권과 오브젝트 운영을 고르게 갖춘 우승권 전력으로 설정했습니다. 긴 시즌의 안정적인 성적을 목표로 하기 좋습니다.', basis: '2025 LCK·MSI 우승 성적 참고 · 수치와 성향은 게임용 환산' },
  { name: 'HLE', fullName: '한화생명e스포츠', power: 89, style: '초반 주도권', description: '초반부터 교전과 주도권을 밀어붙이는 상위권 전력입니다. 준비한 조합으로 빠르게 차이를 벌리는 플레이를 지향합니다.', basis: '2025 LCK Cup·퍼스트 스탠드 우승 성적 참고 · 수치와 성향은 게임용 환산' },
  { name: 'DK', fullName: 'Dplus KIA', power: 80, style: '초반 주도권', description: '초반 동선과 라인 개입으로 경기를 여는 도전형 팀입니다. 벌어 놓은 이득을 끝까지 연결하는 운영이 과제입니다.', basis: '국내 경쟁 구도를 참고한 수동 전력 · 2026 실제 평가 미검증' },
  { name: 'KT', fullName: 'kt 롤스터', power: 84, style: '사이드 운영', description: '사이드 압박과 큰 경기에서의 집중력을 강점으로 둔 팀입니다. 교전 시점과 합류 콜을 맞추는 선택이 중요합니다.', basis: '2025 월즈 결승 진출 성적 참고 · 수치와 성향은 게임용 환산' },
  { name: 'BNK', fullName: 'BNK FEARX', power: 76, style: '초반 주도권', description: '주도권을 잡았을 때 과감하게 밀어붙이는 도전자 전력입니다. 상위권 팀을 상대로 초반 설계를 시험할 수 있습니다.', basis: '국내 경쟁 구도를 참고한 수동 전력 · 2026 실제 평가 미검증' },
  { name: 'DRX', fullName: 'DRX', power: 69, style: '사이드 운영', description: '훈련과 합류 완성도로 전력 차이를 좁혀 가는 도전자 팀입니다. 안정적인 성장과 체력 관리가 시즌에 영향을 줍니다.', basis: '게임 균형을 위한 도전자 전력 · 2026 실제 평가 미검증' },
  { name: 'NS', fullName: '농심 레드포스', power: 75, style: '한타', description: '팀 단위 합류와 한타를 중심으로 설정한 도전자 팀입니다. 선수 사이의 소통과 교전 준비를 쌓아 갈 수 있습니다.', basis: '국내 경쟁 구도를 참고한 수동 전력 · 2026 실제 평가 미검증' },
  { name: 'DNF', fullName: 'DN FREECS', power: 67, style: '초반 주도권', description: '초반 승부수로 더 강한 팀을 흔드는 도전자 전력입니다. 무리한 훈련보다는 경기별 준비와 컨디션 관리가 필요합니다.', basis: '2025 팀명 기준의 게임용 전력 · 2026 팀명·로스터 미검증' },
  { name: 'BRO', fullName: 'OK저축은행 브리온', power: 68, style: '균형 운영', description: '기본기와 팀워크를 차근차근 쌓는 도전자 팀입니다. 장기적인 훈련 선택으로 상위권 진입을 노릴 수 있습니다.', basis: '2025 팀명 기준의 게임용 전력 · 2026 팀명·로스터 미검증' },
];

const displayNames = { 'Gen.G': 'Gen.G', BNK: 'BFX', DRX: 'KRX', DNF: 'DNS' };
const fullNames = { DRX: 'KIWOOM DRX', DNF: 'DN SOOPers', BRO: 'HANJIN BRION' };
export const TEAM_PROFILES = descriptions.map(profile => {
  const record = calendar2026.teamAssessment.find(row => row.name === profile.name);
  return {
    ...profile,
    displayName: displayNames[profile.name] || profile.name,
    fullName: fullNames[profile.name] || profile.fullName,
    power: record?.power ?? profile.power,
    record: record ? { ...record } : null,
    basis: record ? `2026 LCK ${record.played}전 ${record.wins}승 ${record.losses}패 · Elo ${record.elo} → 게임 전력 ${record.power}. 성향은 게임용 설정입니다.` : profile.basis,
  };
});

export function defaultOpponentSettings() {
  return TEAM_PROFILES.map(({ name, power, style }) => ({ name, power, style }));
}
