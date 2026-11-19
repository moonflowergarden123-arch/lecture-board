/* 더콘텐츠스쿨 · 탄생월 맞춤 합격 부적 — 데이터 */
window.EXAMS = {
  suneung: {
    id: 'suneung',
    label: '수능 합격',
    headline: '2026학년도 수능 합격 기원',
    tip: '수험번호·답안지 표기부터 확인! 마킹은 5문제마다 한 번, 3초 쉬어가기.'
  },
  naesin: {
    id: 'naesin',
    label: '내신·수행 대박',
    headline: '내신·수행평가 대박 기원',
    tip: '서술형은 ‘주어진 조건’에 먼저 밑줄. 부분점수는 끝까지 노리는 게 답이에요.'
  },
  myeonjeop: {
    id: 'myeonjeop',
    label: '면접·논술 합격',
    headline: '면접·논술 합격 기원',
    tip: '첫 문장은 30초 안에, 근거 → 주장 순서로. 목소리 크기가 절반은 먹고 들어가요.'
  }
};

window.EXAMS.general = {
  id: 'general',
  label: '합격 기원',
  headline: '2026 합격을 기원합니다',
  tip: '수능·내신·면접, 어떤 시험이든 이 카드 하나면 충분해요.'
};

window.MONTHS = [
  {
    month: 1, sign: '염소자리', signEn: 'Capricorn', range: '12.22 ~ 1.19', element: '흙', constellation: 'cap',
    tarot: { key: 'world', num: 'XXI', name: '세계', en: 'THE WORLD', keyword: '완성 · 목표 달성',
      line: '끝까지 해낸 사람에게만 열리는 마지막 문 — 마무리가 곧 실력입니다.' },
    ratings: { focus: 5, mistake: 4, condition: 4 },
    lucky: { color: '딥 포레스트', hex: '#1F3D2B', item: '은색 샤프' },
    cheer: ['여기까지 온 것만으로 이미 반은 이뤘어요.', '마지막 한 문제까지, 손을 놓지 마세요.']
  },
  {
    month: 2, sign: '물병자리', signEn: 'Aquarius', range: '1.20 ~ 2.18', element: '공기', constellation: 'aqr',
    tarot: { key: 'star', num: 'XVII', name: '별', en: 'THE STAR', keyword: '희망 · 회복',
      line: '별은 가장 어두운 밤에 가장 밝게 빛납니다. 오늘 그 별을 따라가면 됩니다.' },
    ratings: { focus: 4, mistake: 4, condition: 5 },
    lucky: { color: '아이스 블루', hex: '#A8D3E8', item: '투명 유리 물병' },
    cheer: ['긴장은 준비를 다 했다는 신호예요.', '한 문제 풀 때마다 마음이 가벼워질 거예요.']
  },
  {
    month: 3, sign: '물고기자리', signEn: 'Pisces', range: '2.19 ~ 3.20', element: '물', constellation: 'pis',
    tarot: { key: 'moon', num: 'XVIII', name: '달', en: 'THE MOON', keyword: '직감 · 상상력',
      line: '달빛은 길을 다 밝히지 않아도 발밑은 비춥니다. 감이 오는 답을 믿어 보세요.' },
    ratings: { focus: 4, mistake: 4, condition: 4 },
    lucky: { color: '라벤더 미스트', hex: '#C9B8E0', item: '보라색 손수건' },
    cheer: ['모르는 문제에서도 감이 오는 순간이 있어요.', '그 감을 믿고 한 줄이라도 적어 보세요.']
  },
  {
    month: 4, sign: '양자리', signEn: 'Aries', range: '3.21 ~ 4.19', element: '불', constellation: 'ari',
    tarot: { key: 'emperor', num: 'IV', name: '황제', en: 'THE EMPEROR', keyword: '돌파 · 주도권',
      line: '먼저 풀 문제를 정하는 순간 시험은 이미 내 쪽으로 기울어 있습니다.' },
    ratings: { focus: 5, mistake: 4, condition: 5 },
    lucky: { color: '코랄 레드', hex: '#E8613C', item: '빨간 체크 연필' },
    cheer: ['오늘 시험지는 네가 이끄는 거예요.', '쉬운 문제부터, 확실하게 가져가세요.']
  },
  {
    month: 5, sign: '황소자리', signEn: 'Taurus', range: '4.20 ~ 5.20', element: '흙', constellation: 'tau',
    tarot: { key: 'empress', num: 'III', name: '여황제', en: 'THE EMPRESS', keyword: '안정 · 풍요',
      line: '서두르지 않는 사람이 끝까지 정확합니다. 네 속도가 가장 정확한 속도예요.' },
    ratings: { focus: 4, mistake: 5, condition: 4 },
    lucky: { color: '샴페인 베이지', hex: '#E8D5B7', item: '베이지 니트' },
    cheer: ['조급해하지 않아도 괜찮아요.', '차분하게 한 칸씩, 그게 제일 빨라요.']
  },
  {
    month: 6, sign: '쌍둥이자리', signEn: 'Gemini', range: '5.21 ~ 6.20', element: '공기', constellation: 'gem',
    tarot: { key: 'magician', num: 'I', name: '마법사', en: 'THE MAGICIAN', keyword: '집중 · 재능',
      line: '필요한 건 이미 다 가지고 있습니다. 오늘 그 도구를 꺼내 쓰기만 하면 됩니다.' },
    ratings: { focus: 4, mistake: 4, condition: 4 },
    lucky: { color: '민트 실버', hex: '#BFD9CE', item: '초록 형광펜' },
    cheer: ['머릿속이 복잡할수록 문제는 단순해요.', '조건 하나, 숫자 하나만 더 또박또박 읽어 보세요.']
  },
  {
    month: 7, sign: '게자리', signEn: 'Cancer', range: '6.21 ~ 7.22', element: '물', constellation: 'cnc',
    tarot: { key: 'chariot', num: 'VII', name: '전차', en: 'THE CHARIOT', keyword: '전진 · 승리',
      line: '흔들려도 앞으로 가면 됩니다. 전차는 멈추지 않는 쪽이 이깁니다.' },
    ratings: { focus: 5, mistake: 4, condition: 4 },
    lucky: { color: '펄 화이트', hex: '#F7F3EA', item: '흰색 필통' },
    cheer: ['한 과목이 흔들려도 괜찮아요.', '다음 과목에서 다시 앞으로 나아가면 돼요.']
  },
  {
    month: 8, sign: '사자자리', signEn: 'Leo', range: '7.23 ~ 8.22', element: '불', constellation: 'leo',
    tarot: { key: 'strength', num: 'VIII', name: '힘', en: 'STRENGTH', keyword: '용기 · 집중',
      line: '진짜 힘은 소리치는 게 아니라 끝까지 버티는 것입니다. 마지막 10분이 실력입니다.' },
    ratings: { focus: 4, mistake: 4, condition: 5 },
    lucky: { color: '골드 오커', hex: '#E0A32E', item: '금색 볼펜' },
    cheer: ['지금까지 버틴 사람은 답안지도 버팁니다.', '마지막 10분을 끝까지 써 보세요.']
  },
  {
    month: 9, sign: '처녀자리', signEn: 'Virgo', range: '8.23 ~ 9.22', element: '흙', constellation: 'vir',
    tarot: { key: 'hermit', num: 'IX', name: '은둔자', en: 'THE HERMIT', keyword: '집중 · 지혜',
      line: '조용히 앉아 있는 그 시간이 그대로 점수가 됩니다. 혼자만의 집중을 믿어 보세요.' },
    ratings: { focus: 5, mistake: 5, condition: 4 },
    lucky: { color: '세이지 그린', hex: '#9CAF88', item: '초록 손목시계' },
    cheer: ['소란한 교실에서도 네 자리는 조용해요.', '그 집중력이 오늘 가장 큰 무기예요.']
  },
  {
    month: 10, sign: '천칭자리', signEn: 'Libra', range: '9.23 ~ 10.22', element: '공기', constellation: 'lib',
    tarot: { key: 'justice', num: 'XI', name: '정의', en: 'JUSTICE', keyword: '균형 · 시간 배분',
      line: '쉬운 문제 하나, 어려운 문제 하나 모두 같은 1점입니다. 시간 배분이 곧 실력입니다.' },
    ratings: { focus: 4, mistake: 5, condition: 4 },
    lucky: { color: '로즈 핑크', hex: '#E8A9B8', item: '분홍 지우개' },
    cheer: ['한 문제에 오래 붙잡히지 마세요.', '버릴 문제를 아는 게 오늘의 진짜 실력이에요.']
  },
  {
    month: 11, sign: '전갈자리', signEn: 'Scorpio', range: '10.23 ~ 11.21', element: '물', constellation: 'sco',
    tarot: { key: 'wheel', num: 'X', name: '운명의 수레바퀴', en: 'WHEEL OF FORTUNE', keyword: '전환 · 행운',
      line: '막히던 문제가 한 번에 풀리는 날이 있습니다. 오늘, 운의 바퀴는 네 쪽으로 돌아 있어요.' },
    ratings: { focus: 4, mistake: 4, condition: 4 },
    lucky: { color: '버건디', hex: '#6E1F2A', item: '빨간 머리끈' },
    cheer: ['포기하기 직전에 한 번 더 들여다보세요.', '오늘은 그 한 번에서 답이 나와요.']
  },
  {
    month: 12, sign: '사수자리', signEn: 'Sagittarius', range: '11.22 ~ 12.21', element: '불', constellation: 'sag',
    tarot: { key: 'sun', num: 'XIX', name: '태양', en: 'THE SUN', keyword: '성공 · 기쁨',
      line: '이미 네 안에 해가 하나 있습니다. 답안지 위로 그 빛을 그대로 옮겨 보세요.' },
    ratings: { focus: 5, mistake: 4, condition: 5 },
    lucky: { color: '선셋 오렌지', hex: '#F2913D', item: '주황 텀블러' },
    cheer: ['너무 잘하려고 하지 말고, 즐겁게 써 보세요.', '웃으면서 나온 답이 맞는 경우가 많아요.']
  }
];

/* ── 부적 그림 소재 + 길상 부제 ── */
window.MINHWA = {
  1:  { motive: '일월오봉도', gil: '대성', short: '세계' },
  2:  { motive: '학과 소나무', gil: '만복', short: '별' },
  3:  { motive: '등용문 잉어', gil: '등용', short: '달' },
  4:  { motive: '청룡', gil: '대길', short: '황제' },
  5:  { motive: '모란', gil: '풍요', short: '여황제' },
  6:  { motive: '까치와 소나무', gil: '희보', short: '마법사' },
  7:  { motive: '천마', gil: '쾌진', short: '전차' },
  8:  { motive: '호랑이', gil: '필승', short: '힘' },
  9:  { motive: '매화와 사슴', gil: '지혜', short: '은둔자' },
  10: { motive: '책가도', gil: '성취', short: '정의' },
  11: { motive: '봉황', gil: '행운', short: '수레바퀴' },
  12: { motive: '연화도', gil: '성공', short: '태양' }
};

window.MONTHS.forEach(function (m) {
  var meta = window.MINHWA[m.month] || {};
  m.gil = meta.gil || '대길';
  m.tarotShort = meta.short || m.tarot.name;
  m.motive = meta.motive || '민화';
});

window.EXAMS.suneung.bujeok   = '수능합격부';
window.EXAMS.naesin.bujeok    = '내신합격부';
window.EXAMS.myeonjeop.bujeok = '면접합격부';
window.EXAMS.general.bujeok   = '합격부';
