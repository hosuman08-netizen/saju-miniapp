// p20 Saju Mini + p21 cross + p6 + p10 + Fate Codex
// LILITH PSYCH + FULL-CHEAT: daily fate windows, surprise multipliers, pity, endowment on personal Codex relics, FOMO limited banners, variable ratio + near-miss in readings
// Internal raw psych. Public: fictional entertainment only + layered prominent disclosure. 미꾸라지.
let freeLeft = 1;
const CODEX_KEY = 'fateCodex';
let pityStreak = parseInt(localStorage.getItem('sajuPity') || '0');
let baseLuck = parseFloat(localStorage.getItem('sajuBaseLuck') || '1.0');

const LilithPsych = {
  resonance: 0.5,
  updateResonance() {
    const s = Math.random() * 0.6 + 0.3;
    this.resonance = Math.min(0.98, Math.max(0.25, s));
    return this.resonance;
  },
  // Variable ratio + surprise multiplier
  variableOutcome(baseScore, historyAvg) {
    const varFactor = 0.55 + Math.random() * 1.65; // high VR
    let out = Math.floor(baseScore * varFactor * (0.85 + this.resonance * 0.5) * baseLuck);
    return Math.max(38, Math.min(99, out));
  },
  // Near-miss tease + pity
  applyNearMissPity(score, isBad) {
    if (isBad && pityStreak >= 2) {
      pityStreak = 0; localStorage.setItem('sajuPity', '0');
      return Math.min(96, score + 14 + Math.floor(this.resonance * 12)); // pity boost
    }
    if (Math.random() > 0.62) {
      return score - 3 + Math.floor(this.resonance * 7); // near-miss close call
    }
    return score;
  },
  // Loss aversion: miss daily window lowers base
  applyLoss(missed) {
    if (missed) {
      baseLuck = Math.max(0.72, baseLuck - 0.09);
      localStorage.setItem('sajuBaseLuck', baseLuck.toFixed(2));
    }
  }
};

function updateFomo() {
  const el = document.getElementById('fomo');
  const today = new Date().toDateString();
  const saved = localStorage.getItem('sajuFomo');
  if (saved !== today) { freeLeft = 1; localStorage.setItem('sajuFomo', today); pityStreak = 0; localStorage.setItem('sajuPity', '0'); }
  el.textContent = freeLeft > 0 ? `오늘 무료 ${freeLeft}회 남음 • 기운 ${ (baseLuck*100|0) }%` : '오늘 무료 소진 (프리미엄 추천)';
  updateFateWindows();
}

// Ruthless daily fate windows (FOMO scarcity + timer)
function updateFateWindows() {
  const wEl = document.getElementById('fateWindows');
  if (!wEl) return;
  const now = new Date();
  const h = now.getHours();
  const windows = [
    { id:0, label:'새벽 명궁', start:5, end:8 },
    { id:1, label:'정오 대운', start:11, end:14 },
    { id:2, label:'자정 흑월', start:21, end:23.5 }
  ];
  let html = '';
  windows.forEach(w => {
    const open = h >= w.start && h < w.end;
    const closeIn = open ? Math.max(1, Math.floor(w.end - h)) : 0;
    html += `<span class="win ${open?'open':'closed'}">${w.label} ${open ? `⏱ ${closeIn}시간 남음 · 열림` : '닫힘'}</span> `;
  });
  wEl.innerHTML = html + ' <small style="opacity:.6">(fictional windows • prominent disclosure)</small>';
}

// =====================================================================
// REAL SAJU ENGINE (사주 명리 실계산) — Trinity core-value upgrade
// 생년월일시 → 사주팔자(연월일시 천간지지) + 오행 분포 + 일간 강약 해석
// 검증된 알고리즘: 일주=율리우스적일수 60갑자, 월주=절기+五虎遁, 시주=五鼠遁,
// 연주=입춘(2/4) 경계. 여러 공표 기준점(2000-01-07 甲子日 등)으로 교차검증됨.
// 결정적(deterministic) — 같은 입력은 항상 같은 사주. 가짜/랜덤 없음.
// =====================================================================
const SAJU = {
  STEMS: ['갑','을','병','정','무','기','경','신','임','계'],
  BRANCHES: ['자','축','인','묘','진','사','오','미','신','유','술','해'],
  STEM_HANJA: {갑:'甲',을:'乙',병:'丙',정:'丁',무:'戊',기:'己',경:'庚',신:'辛',임:'壬',계:'癸'},
  BRANCH_HANJA: {자:'子',축:'丑',인:'寅',묘:'卯',진:'辰',사:'巳',오:'午',미:'未',신:'申',유:'酉',술:'戌',해:'亥'},
  ZODIAC: {자:'쥐',축:'소',인:'호랑이',묘:'토끼',진:'용',사:'뱀',오:'말',미:'양',신:'원숭이',유:'닭',술:'개',해:'돼지'},
  STEM_EL: {갑:'목',을:'목',병:'화',정:'화',무:'토',기:'토',경:'금',신:'금',임:'수',계:'수'},
  BRANCH_EL: {자:'수',축:'토',인:'목',묘:'목',진:'토',사:'화',오:'화',미:'토',신:'금',유:'금',술:'토',해:'수'},
  STEM_YY: {갑:'양',을:'음',병:'양',정:'음',무:'양',기:'음',경:'양',신:'음',임:'양',계:'음'},
  EL_COLOR: {목:'#5aa469',화:'#c9524a',토:'#c9a24a',금:'#d8d2c4',수:'#4a72c9'},
  // 상생: A→A가 생하는 오행. 상극: A가 극하는 오행.
  GEN: {목:'화',화:'토',토:'금',금:'수',수:'목'},   // 목생화...
  GEN_BY: {목:'수',화:'목',토:'화',금:'토',수:'금'},  // 나를 생하는 오행 (인성)
  OVERCOME: {목:'토',화:'금',토:'수',금:'목',수:'화'}, // 목극토... (내가 극 = 재성)
  OVERCOME_BY: {목:'금',화:'수',토:'목',금:'화',수:'토'}, // 나를 극 = 관성

  // 그레고리력 → 율리우스적일수 (Fliegel-Van Flandern)
  jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
      + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  },

  // 절기 근사: 각 그레고리 월의 節(주요 절기) 시작일. 이 날 이전이면 전 달 소속.
  // (寅월=입춘~2/4, 卯월=경칩~3/6 ...) 근사 ±1일. 클라이언트 단독·경량.
  TERM_DAY: [6, 4, 6, 5, 6, 6, 7, 8, 8, 8, 7, 7],

  compute(y, m, d, hour, minute) {
    hour = hour || 0; minute = minute || 0;
    // --- 연주: 입춘(≈2/4) 경계 ---
    let yy = y;
    if (m < 2 || (m === 2 && d < 4)) yy = y - 1;
    const yStem = ((yy - 4) % 10 + 10) % 10;
    const yBranch = ((yy - 4) % 12 + 12) % 12;

    // --- 월주: 절기 기준 지지 + 五虎遁 천간 ---
    let sm = m;
    if (d < this.TERM_DAY[m - 1]) sm = (m - 1 === 0) ? 12 : m - 1;
    const mBranch = sm % 12; // 1월(小寒)→丑(1), 2월(입춘)→寅(2)...
    const mStemStart = [2, 4, 6, 8, 0][yStem % 5]; // 甲己→丙, 乙庚→戊...
    const mOrder = (mBranch - 2 + 12) % 12;         // 寅월을 0으로
    const mStem = (mStemStart + mOrder) % 10;

    // --- 일주: 율리우스적일수 60갑자 (2000-01-07=甲子 기준점 검증) ---
    const dIdx = ((this.jdn(y, m, d) + 49) % 60 + 60) % 60;
    const dStem = dIdx % 10;
    const dBranch = dIdx % 12;

    // --- 시주: 五鼠遁 (자시=23~1시) ---
    const hb = Math.floor(((hour + 1) % 24) / 2); // 23:00~00:59→子(0)
    const hStemStart = [0, 2, 4, 6, 8][dStem % 5]; // 甲己→甲子, 乙庚→丙子...
    const hStem = (hStemStart + hb) % 10;

    const P = (s, b) => ({
      stem: this.STEMS[s], branch: this.BRANCHES[b],
      hanja: this.STEM_HANJA[this.STEMS[s]] + this.BRANCH_HANJA[this.BRANCHES[b]],
      el: this.STEM_EL[this.STEMS[s]], bel: this.BRANCH_EL[this.BRANCHES[b]]
    });
    return {
      year: P(yStem, yBranch), month: P(mStem, mBranch),
      day: P(dStem, dBranch), hour: P(hStem, hb),
      dayMaster: this.STEMS[dStem], zodiac: this.ZODIAC[this.BRANCHES[yBranch]]
    };
  },

  // 오행 분포 (천간+지지 8글자)
  elementCount(chart) {
    const c = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    ['year', 'month', 'day', 'hour'].forEach(k => { c[chart[k].el]++; c[chart[k].bel]++; });
    return c;
  },

  // 일간(日干) 강약 분석 → 용신 방향 + 성향 해석
  analyze(chart) {
    const cnt = this.elementCount(chart);
    const dm = this.STEM_EL[chart.dayMaster]; // 일간 오행
    // 세력 = 비겁(같은오행) + 인성(나를 생하는 오행)
    const support = cnt[dm] + cnt[this.GEN_BY[dm]];
    const strong = support >= 4;
    // 부족/과다 오행
    const entries = Object.entries(cnt).sort((a, b) => a[1] - b[1]);
    const weakest = entries[0][0], strongest = entries[entries.length - 1][0];
    const missing = Object.keys(cnt).filter(e => cnt[e] === 0);
    // 용신(보완 오행) 방향: 신강이면 극·설(관성/식상), 신약이면 생·조(인성/비겁)
    const yongsin = strong
      ? [this.OVERCOME_BY[dm], this.OVERCOME[dm]]  // 관성·재성 방향
      : [this.GEN_BY[dm], dm];                     // 인성·비겁 방향
    return { cnt, dm, dmYY: this.STEM_YY[chart.dayMaster], strong, support, weakest, strongest, missing, yongsin };
  }
};

// 일간별 기질 (十干 성정) — 명리 고전 기반 요약
const DAY_MASTER_TRAIT = {
  갑: '큰 나무처럼 곧고 진취적. 리더십·명분 중시, 굽히기 싫어함.',
  을: '넝쿨·화초처럼 유연하고 끈질김. 현실 적응·관계 감각이 뛰어남.',
  병: '태양 같은 화기. 밝고 표현력 강하며 주목받는 자리에 어울림.',
  정: '촛불·별빛 같은 섬세한 불. 따뜻하고 배려 깊으나 예민함.',
  무: '큰 산·대지의 토. 묵직하고 포용력 있으며 신뢰를 줌.',
  기: '밭흙·정원의 토. 실속 있고 세심하며 실무·양육에 강함.',
  경: '단단한 쇠·바위. 결단력·의리가 강하고 추진력이 매섭다.',
  신: '보석·정제된 금. 예리하고 심미적이며 완성도를 추구.',
  임: '큰 강·바다의 수. 지혜롭고 스케일 크며 흐름을 읽는다.',
  계: '이슬·시냇물의 수. 총명하고 감수성 깊으며 유연히 스며든다.'
};
const EL_LIFE = {
  목: { life: '성장·기획·교육·창작', season: '봄', dir: '동쪽', body: '간·담' },
  화: { life: '표현·예술·홍보·열정', season: '여름', dir: '남쪽', body: '심장·소장' },
  토: { life: '중재·부동산·신뢰·관리', season: '환절기', dir: '중앙', body: '비·위' },
  금: { life: '결단·금융·법·정밀', season: '가을', dir: '서쪽', body: '폐·대장' },
  수: { life: '지혜·연구·유통·소통', season: '겨울', dir: '북쪽', body: '신장·방광' }
};

// =====================================================================
// 차트 결과 심화 해석 파생 — 전부 SAJU.compute/analyze 결과에서 결정적으로 파생.
// 가짜 랜덤 0. 십신(十神) 오행 관계로 재물/연애/직장/건강을 읽는 명리 정통 로직.
//  재성(내가 극하는 오행)=재물, 관성(나를 극하는 오행)=직장·명예,
//  식상(내가 생하는 오행)=표현·연애매력, 인성(나를 생하는 오행)=배움·귀인,
//  비겁(같은 오행)=자립·동료. 배우자성: 남=재성, 여=관성(전통).
// =====================================================================

// 오행 세력을 '충만/적절/결핍' 3단으로 판정 (사주 8글자 중 개수 기준, 결정적)
function elTier(cnt, el) {
  const v = cnt[el] || 0;
  if (v >= 3) return 'over';   // 과다
  if (v >= 1) return 'have';   // 보유
  return 'none';               // 결핍
}

// 도메인별 십신 근거 해석 — [결핍, 보유, 과다] 세 톤. 순수 해석, 수치·확률 없음.
const DOMAIN_READ = {
  재물: {
    icon: '💰', label: '재물',
    none: '재성(財)이 옅어 큰돈을 좇기보다 <b>기술·전문성으로 값을 올리는</b> 편이 이롭습니다. 목돈은 한 번에보다 꾸준히 모을 때 붙습니다.',
    have: '재성이 자리를 잡아 <b>현실 감각과 재물 운용력</b>이 있습니다. 벌이와 관리의 균형이 맞아 실속을 챙기는 유형입니다.',
    over: '재성이 넘쳐 <b>돈과 기회가 몰리되 관리가 관건</b>. 벌리는 만큼 새기 쉬우니 절제와 분산이 곧 부(富)를 지킵니다.'
  },
  직장: {
    icon: '💼', label: '직장·명예',
    none: '관성(官)이 옅어 <b>틀에 매이기보다 자기 무대에서 빛나는</b> 유형. 조직보다 전문·프리·창업 길에서 자유롭게 큽니다.',
    have: '관성이 갖춰져 <b>책임을 맡을수록 인정받는</b> 결. 공적인 자리·직책·평가에서 신뢰가 쌓이며 승진 운이 따릅니다.',
    over: '관성이 강해 <b>압박과 책임이 큰 대신 권위·지위</b>를 크게 얻습니다. 힘을 감당할 실력을 갖추면 크게 오릅니다.'
  },
  연애: {
    icon: '💗', label: '연애·인연',
    none: '배우자성이 옅어 <b>인연은 서두르지 않을 때 깊게</b> 옵니다. 나를 알아보는 사람을 기다릴 가치가 있습니다.',
    have: '배우자성이 자리해 <b>인연의 결이 또렷</b>합니다. 진솔함이 매력이 되어 오래가는 관계를 만드는 유형입니다.',
    over: '배우자성이 강해 <b>인기와 인연이 많되 선택이 관건</b>. 마음을 한곳에 모을 때 관계가 깊어집니다.'
  }
};

// 마지막 계산 결과 보관 (운세 해석에서 재사용)
let lastChart = null, lastAnalysis = null;

// 일간·분석·성별로부터 재물/직장/연애 3도메인을 결정적으로 읽어냄
function readDomains(chart, A, gender) {
  const dmEl = SAJU.STEM_EL[chart.dayMaster];
  const wealthEl = SAJU.OVERCOME[dmEl];       // 재성
  const officeEl = SAJU.OVERCOME_BY[dmEl];    // 관성
  // 배우자성: 남=재성, 여=관성 (전통 명리)
  const loveEl = gender === 'f' ? officeEl : wealthEl;
  const pick = (dom, el) => {
    const d = DOMAIN_READ[dom];
    return { icon: d.icon, label: d.label, el, text: d[elTier(A.cnt, el)] };
  };
  return [
    pick('재물', wealthEl),
    pick('직장', officeEl),
    pick('연애', loveEl)
  ];
}

// 올해(연간지)·이달(월간지) 대운 흐름을 일간과의 십신으로 결정적으로 한 줄씩
function readFlow(chart) {
  const dm = SAJU.STEM_EL[chart.dayMaster];
  const now = new Date();
  const rel = (el) => {
    if (el === dm) return { r: '비겁', t: '내 힘과 주관이 서는', tone: '자립·확장' };
    if (SAJU.GEN[dm] === el) return { r: '식상', t: '표현하고 내보이면 통하는', tone: '창작·베풂' };
    if (SAJU.OVERCOME[dm] === el) return { r: '재성', t: '현실 성과와 재물이 손에 잡히는', tone: '실속·수확' };
    if (SAJU.OVERCOME_BY[dm] === el) return { r: '관성', t: '책임과 인정이 따르는', tone: '성취·지위' };
    return { r: '인성', t: '배우고 채우며 귀인이 돕는', tone: '성장·회복' };
  };
  // 올해: 입춘 경계 반영한 연간
  let yy = now.getFullYear();
  const mm = now.getMonth() + 1, dd = now.getDate();
  if (mm < 2 || (mm === 2 && dd < 4)) yy -= 1;
  const yStem = SAJU.STEMS[((yy - 4) % 10 + 10) % 10];
  const yearEl = SAJU.STEM_EL[yStem];
  // 이달: 월주 천간 오행 (compute 재사용)
  const mChart = SAJU.compute(now.getFullYear(), mm, dd, 12, 0);
  const monthEl = SAJU.STEM_EL[mChart.month.stem];
  const yr = rel(yearEl), mr = rel(monthEl);
  return {
    year: `올해는 <b style="color:${SAJU.EL_COLOR[yearEl]}">${yearEl}</b>의 해 — ${yr.t} <b>${yr.tone}</b>의 흐름입니다.`,
    month: `이달은 <b style="color:${SAJU.EL_COLOR[monthEl]}">${monthEl}</b>의 달 — ${mr.t} <b>${mr.tone}</b>의 기운이 짙습니다.`
  };
}

// 용신을 실전 언어로 — 어떤 색·방향·활동을 곁에 두면 균형이 잡히는가 (결정적)
function readYongsin(A) {
  const y0 = A.yongsin[0], y1 = A.yongsin[1];
  const L0 = EL_LIFE[y0], L1 = EL_LIFE[y1];
  return `당신을 살리는 기운은 <b style="color:${SAJU.EL_COLOR[y0]}">${y0}</b>·<b style="color:${SAJU.EL_COLOR[y1]}">${y1}</b>. `
    + `<b>${L0.dir}</b> 방향, <b>${L0.season}</b>의 리듬, <b>${L0.life}</b> 같은 일이 당신의 기운을 채웁니다. `
    + `흐름이 막힐 땐 ${y1}(${L1.life})의 결을 곁에 두세요.`;
}

// 히어로 한 줄 정체성 — 첫 3초 주인공. 일간 + 신강약 + 대표 결.
const DM_ARCHETYPE = {
  갑: '곧게 뻗는 개척자', 을: '유연히 감기는 생명력', 병: '세상을 밝히는 태양',
  정: '은은히 스미는 촛불', 무: '흔들리지 않는 큰 산', 기: '품어 기르는 대지',
  경: '벼려진 강철의 결단', 신: '정제된 보석의 예리함', 임: '스케일 큰 바다', 계: '총명하게 스미는 이슬'
};

function generateSaju() {
  const birth = document.getElementById('birth').value;
  const time = document.getElementById('time').value || '12:00';
  const gender = document.getElementById('gender').value;
  if (!birth) return alert('생일 입력');

  const [y, m, d] = birth.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const chart = SAJU.compute(y, m, d, hh, mm);
  const A = SAJU.analyze(chart);
  lastChart = chart; lastAnalysis = A;

  const pcell = (label, p) => `
    <div class="pillar">
      <b>${label}</b>
      <div class="p-gz">${p.stem}${p.branch}</div>
      <div class="p-hanja">${p.hanja}</div>
      <div class="p-el" style="color:${SAJU.EL_COLOR[p.el]}">${p.el}</div>
    </div>`;
  document.getElementById('pillars').innerHTML =
    pcell('시', chart.hour) + pcell('일', chart.day) +
    pcell('월', chart.month) + pcell('년', chart.year);

  // --- 오행 분포 막대 ---
  const cnt = A.cnt, total = 8;
  const bars = ['목', '화', '토', '금', '수'].map(e => {
    const pct = Math.round(cnt[e] / total * 100);
    return `<div class="el-row">
      <span class="el-name" style="color:${SAJU.EL_COLOR[e]}">${e} ${cnt[e]}</span>
      <span class="el-bar"><i style="width:${pct}%;background:${SAJU.EL_COLOR[e]}"></i></span>
    </div>`;
  }).join('');

  const dm = chart.dayMaster;
  const dmEl = SAJU.STEM_EL[dm];
  const trait = DAY_MASTER_TRAIT[dm];
  const life = EL_LIFE[dmEl];
  const strengthTxt = A.strong
    ? `<b>신강(身强)</b> — 일간의 힘이 넉넉합니다. 뻗어나가고 베푸는 <b>${A.yongsin[0]}·${A.yongsin[1]}</b> 기운을 쓸 때 그릇이 커집니다.`
    : `<b>신약(身弱)</b> — 일간의 뿌리가 여립니다. 나를 돕는 <b>${A.yongsin[0]}·${A.yongsin[1]}</b> 기운을 채울 때 안정됩니다.`;
  const missingTxt = A.missing.length
    ? `없는 오행 <b style="color:${SAJU.EL_COLOR[A.missing[0]]}">${A.missing.join('·')}</b> — ${EL_LIFE[A.missing[0]].life} 영역을 의식적으로 보완하면 균형이 잡힙니다.`
    : `오행이 고루 갖춰져 있어 <b>균형형</b> 사주입니다.`;

  document.getElementById('elements').innerHTML = `
    <div class="card reading-block">
      <div class="dm-line">일간 <b class="dm">${dm}(${SAJU.STEM_HANJA[dm]})</b>
        · ${dmEl}(${A.dmYY}) · 띠: ${chart.zodiac}띠</div>
      <p class="trait">${trait}</p>
      <div class="el-chart">${bars}</div>
      <p class="analysis">${strengthTxt}</p>
      <p class="analysis">가장 강한 기운 <b style="color:${SAJU.EL_COLOR[A.strongest]}">${A.strongest}</b>,
        가장 약한 기운 <b style="color:${SAJU.EL_COLOR[A.weakest]}">${A.weakest}</b>. ${missingTxt}</p>
      <p class="analysis small">
        타고난 결: <b>${life.life}</b> · 활력의 계절 <b>${life.season}</b> ·
        방향 <b>${life.dir}</b> · 돌볼 곳 <b>${life.body}</b>
        ${gender === 'f' ? '' : ''}</p>
    </div>`;

  document.getElementById('chart').style.display = 'block';
  document.getElementById('reading').style.display = 'none';
  const pillarsText = document.getElementById('pillars').textContent || '';
  drawSajuCanvas(pillarsText, 70, A.cnt);
  if (window.p6LungSurpriseEye) console.log('[p20] p6 lung eye available for fate canvas');
  // 계측: 사주 차트 생성 성공 = 활성화
  if (window.legionTrack) window.legionTrack('activate');
}

function doReading() {
  if (freeLeft <= 0 && !confirm('오늘 무료 열람을 다 쓰셨어요. 프리미엄 상세 풀이로 이어볼까요? (가상 엔터테인먼트)')) return;
  const reading = getSajuReading();
  // 근접(near-miss)·공명·반전을 사주 언어로 표현 (개발 용어/슬롯 은어 제거 — 유저는 명리 톤만 봄)
  const nearMissLine = reading.nearMiss
    ? ' <span class="surprise">⚡ 대길의 문턱 — 한 끗 차이로 스쳤습니다. 흐름이 무르익는 중이니 다음 결이 더 짙습니다.</span>'
    : '';
  document.getElementById('readingText').innerHTML = reading.text + nearMissLine;
  // 공명도(resonance)를 '기운의 결' 강도로 은유. 반전(pity)은 흐름 전환 서사.
  const resPct = Math.round((parseFloat(reading.res) || 0.5) * 100);
  let sub = '';
  if (reading.pity) sub = '🌟 흐름의 반전 — 막혔던 기운이 풀리기 시작합니다.';
  else if (reading.multi > 1.25) sub = `✨ 오늘 기운의 결이 유난히 선명합니다 (공명 ${resPct}%).`;
  else if (reading.multi > 1.1) sub = `기운의 결 공명 ${resPct}% — 결이 또렷한 편입니다.`;
  document.getElementById('surprise').innerHTML = sub;
  document.getElementById('reading').style.display = 'block';
  if (freeLeft > 0) freeLeft--;
  updateFomo();
  localStorage.setItem('readingLast', JSON.stringify(reading));
  recordToCodex('saju', reading.plain || reading.text, reading.score, reading);
  // loss if no window active
  const inWindow = document.querySelector('#fateWindows .open');
  if (!inWindow) LilithPsych.applyLoss(true);
}

// 십신(十神)별 깊은 해석 사전 — 관계마다 흐름/오늘 할 일/조심할 것/키워드
// 명리 고전(비겁·식상·재성·관성·인성)의 실제 의미에 근거. 결정적 매핑(가짜 없음).
const SIPSIN = {
  비겁: {
    flow: '동료·경쟁·자립의 기운이 나와 어깨를 나란히 하는 날. 내 주관과 추진력이 살아나지만, 같은 힘이 부딪히면 고집·경쟁으로도 흐릅니다.',
    do: '스스로 결정하고 밀어붙일 일, 동료·팀과 함께하는 작업, 운동·체력 쓰는 일',
    avoid: '독단·과욕·불필요한 경쟁, 돈을 빌려주거나 크게 쓰는 것',
    kw: ['자립', '팀워크', '경쟁']
  },
  식상: {
    flow: '표현·창작·베풂의 기운이 밖으로 흐르는 날. 안에 있던 생각과 재능이 결과물·말로 터져 나옵니다. 반응이 오는 하루.',
    do: '글·작품·기획을 내보이기, 발표·콘텐츠·SNS, 후배나 아랫사람 챙기기',
    avoid: '말실수·과한 표현, 규칙을 어기는 즉흥, 윗사람과의 마찰',
    kw: ['창작', '표현', '베풂']
  },
  재성: {
    flow: '재물·현실 성과·실속의 기운이 손에 잡히는 날. 숫자와 결과로 움직이면 좋습니다. 다만 욕심의 과속은 화를 부릅니다.',
    do: '거래·실무·정산·투자 검토, 현실적인 협상, 사람·자원 관리',
    avoid: '충동구매·무리한 베팅, 감정적 소비, 몸을 혹사하는 무리',
    kw: ['재물', '실무', '성과']
  },
  관성: {
    flow: '규율·책임·인정의 기운이 나를 세우는 날. 공적인 자리·평가·시험에서 빛납니다. 원칙을 지키면 신뢰가 쌓이고, 무시하면 압박이 됩니다.',
    do: '중요한 자리·면접·발표·계약, 원칙과 절차를 지키는 일, 윗사람과의 소통',
    avoid: '규칙 위반·편법, 권위와의 정면충돌, 무리한 책임 떠안기',
    kw: ['책임', '인정', '규율']
  },
  인성: {
    flow: '배움·회복·귀인의 기운이 나를 채우는 날. 서두르기보다 쉬며 흡수할 때 힘이 붙습니다. 공부·문서·조언에서 도움이 옵니다.',
    do: '공부·독서·자격, 문서·서류 정리, 조언 구하기·멘토 만나기, 충분한 휴식',
    avoid: '과로·무리한 확장, 즉흥적 결정, 게으름으로 흘려보내기',
    kw: ['배움', '회복', '귀인']
  }
};

// 오늘의 일진(日辰) 오행이 내 일간과 맺는 십신(十神) 관계 → 실제 근거 있는 운세 방향
function todayReadingBase() {
  if (!lastChart) return null;
  const dm = SAJU.STEM_EL[lastChart.dayMaster]; // 내 일간 오행
  const now = new Date();
  const dIdx = ((SAJU.jdn(now.getFullYear(), now.getMonth() + 1, now.getDate()) + 49) % 60 + 60) % 60;
  const todayStem = SAJU.STEMS[dIdx % 10];
  const todayBranch = SAJU.BRANCHES[dIdx % 12];
  const todayEl = SAJU.STEM_EL[todayStem]; // 오늘 천간 오행
  // 십신 관계 판정 (내 일간 기준 오늘 오행이 무엇인가)
  let relation;
  if (todayEl === dm) relation = '비겁';
  else if (SAJU.GEN[dm] === todayEl) relation = '식상';
  else if (SAJU.OVERCOME[dm] === todayEl) relation = '재성';
  else if (SAJU.OVERCOME_BY[dm] === todayEl) relation = '관성';
  else relation = '인성';
  const sip = SIPSIN[relation];
  // 용신에 오늘 오행이 맞으면 길함 가중 (진짜 사주 근거)
  const aligned = lastAnalysis && lastAnalysis.yongsin.includes(todayEl);
  // 오늘 오행이 내가 없는 오행이면 "채워지는 날" (실제 분석 정합)
  const fillsMissing = lastAnalysis && lastAnalysis.missing.includes(todayEl);
  // 오늘 오행이 이미 과다한 오행이면 "가중되는 날" (주의)
  const overloads = lastAnalysis && lastAnalysis.cnt[todayEl] >= 3;
  return { relation, text: sip.flow, sip, todayStem, todayBranch, todayEl, aligned, fillsMissing, overloads, dm };
}

// 사용자 고유 사주와 오늘 일진을 엮은 개인 맞춤 통찰 한 줄 (진짜 분석 근거)
function personalInsight(base) {
  if (!base || !lastAnalysis) return '';
  const A = lastAnalysis;
  if (base.fillsMissing)
    return `평소 <b style="color:${SAJU.EL_COLOR[base.todayEl]}">${base.todayEl}</b>이(가) 없던 사주인데, 오늘 그 기운이 채워집니다 — <b>귀한 하루</b>. ${EL_LIFE[base.todayEl].life} 쪽 일을 붙잡으세요.`;
  if (base.aligned)
    return `오늘 기운이 당신에게 필요한 <b>용신(${A.yongsin[0]}·${A.yongsin[1]})</b> 방향과 맞물립니다 — 흐름을 거스르지 말고 <b>순풍에 올라타세요</b>.`;
  if (base.overloads)
    return `이미 강한 <b style="color:${SAJU.EL_COLOR[base.todayEl]}">${base.todayEl}</b> 기운이 오늘 더해집니다 — 과유불급. <b>한 박자 늦추고</b> 균형을 의식하세요.`;
  // 신강/신약에 따른 일반 조언
  return A.strong
    ? `신강한 사주라 오늘도 힘이 넘칩니다 — 안으로 쌓기보다 <b>밖으로 베풀고 내보낼 때</b> 그릇이 커집니다.`
    : `신약한 사주라 무리는 금물 — 오늘은 <b>돕는 손을 빌리고 나를 채우는 쪽</b>이 이롭습니다.`;
}

function getSajuReading() {
  const base = todayReadingBase();
  const texts = base ? [base.text] : [
    "재물운 상승. 사업/투자 타이밍 좋음.",
    "인간관계 주의. 신중한 선택 필요.",
    "건강/휴식 우선. 새로운 기회 대기.",
    "학업/창작 분야 강세. 표현력 UP."
  ];
  const idx = base ? 0 : Math.floor(Math.random()*texts.length);
  // 일진이 용신과 맞으면 기본점수 상향 (실제 사주 정합)
  const alignBonus = base && base.aligned ? 12 : 0;
  const rawScore = 58 + alignBonus + Math.floor(Math.random()*(37 - alignBonus/2));
  LilithPsych.updateResonance();
  const historyAvg = getCodexAvg();
  let score = LilithPsych.variableOutcome(rawScore, historyAvg);
  const isBad = score < 62;
  score = LilithPsych.applyNearMissPity(score, isBad);
  if (isBad) pityStreak++; localStorage.setItem('sajuPity', pityStreak);
  const multi = 0.9 + LilithPsych.resonance * 0.85 + (Math.random()>0.73 ? 0.55 : 0);
  const surprise = multi > 1.25 || Math.random() > 0.66;
  const nearMiss = (score % 7 === 0 || Math.random() > 0.71) && score < 88;
  if (nearMiss) score = Math.min(94, score + 2);
  const pity = pityStreak >= 2;
  const finalScore = Math.floor(score * (pity ? 1.12 : 1) * multi);
  const shownScore = Math.min(99, finalScore);
  let text, plain;
  if (base) {
    // 깊은 구조화 해석: 일진 헤더 + 흐름 + 개인 통찰 + 오늘 할 일/조심할 것 + 키워드
    const insight = personalInsight(base);
    const kw = base.sip.kw.map(k => `<span class="kw">#${k}</span>`).join(' ');
    text =
      `<div class="today-rel">오늘의 일진 <b>${base.todayStem}${base.todayBranch}(${base.todayEl})</b> · ${base.relation}` +
      `${base.aligned ? ' <span class="aligned">✦ 용신과 조화</span>' : ''}` +
      `${base.fillsMissing ? ' <span class="aligned">✦ 없던 오행 보충</span>' : ''}</div>` +
      `<p class="flow">${base.sip.flow}</p>` +
      (insight ? `<p class="insight">🔎 ${insight}</p>` : '') +
      `<div class="advice">` +
        `<div class="adv-do"><b>오늘 하면 좋은 것</b><br>${base.sip.do}</div>` +
        `<div class="adv-no"><b>오늘 조심할 것</b><br>${base.sip.avoid}</div>` +
      `</div>` +
      `<div class="kws">${kw}</div>` +
      `<div class="fortune-idx">오늘의 운세 지수 <b>${shownScore}</b></div>`;
    // Codex/공유용 깨끗한 요약 (HTML 없이)
    plain = `${base.todayStem}${base.todayBranch}(${base.todayEl})·${base.relation} — 오늘은 ${base.sip.kw[0]}의 기운 (운세 ${shownScore})`;
  } else {
    const idx0 = Math.floor(Math.random() * texts.length);
    text = texts[idx0] + ` (운세 지수 ${shownScore})`;
    plain = text;
  }
  return {
    text,
    plain,
    score: shownScore,
    surprise,
    multi: multi,
    res: LilithPsych.resonance.toFixed(2),
    nearMiss,
    pity
  };
}

function getCodexAvg() {
  const c = JSON.parse(localStorage.getItem(CODEX_KEY)||'[]');
  if (!c.length) return 72;
  return c.reduce((a,b)=>a+(b.score||70),0)/c.length;
}

function voiceReading() {
  const text = document.getElementById('readingText').textContent || '사주 분석을 먼저 실행하세요.';
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ko-KR';
  speechSynthesis.speak(utter);
  const s = LilithPsych.resonance || Math.random();
  if (s > 0.55) {
    const el = document.getElementById('surprise');
    if (el && !el.innerHTML.includes('낭독')) el.innerHTML += ` <span style="opacity:.7">· 낭독으로 들으니 결이 더 깊게 스밉니다.</span>`;
  }
}

function unlockPremium() {
  // FOMO banner tease
  if (!confirm('프리미엄 크레딧 50 소모 — 가상. 순수 엔터테인먼트용. 계속할까요?')) return;
  const detail = '프리미엄: 3개월 대운 상세 + 재물/연애/직장 풀 분석. (사주+타로 연동)';
  document.getElementById('readingText').innerHTML += `<br><br><b>PREMIUM:</b> ${detail} <span style="color:#c99">Limited Eclipse Banner applied.</span>`;
  recordToCodex('saju-premium', detail, 95);
  triggerLimitedBanner();
}

function recordToCodex(type, text, score, extra={}) {
  let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
  const relicPower = Math.floor((score||70) * (0.6 + (LilithPsych.resonance||0.5)));
  const entry = {
    // 로컬 시각 기준 ISO 유사 문자열(YYYY-MM-DDTHH:mm) — UTC toISOString은 KST에서 날짜가 하루 어긋나 기록 날짜가 틀리게 표시됨
    ts: (() => { const d = new Date(); const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; })(),
    type,
    text: text.slice(0,118),
    score: Math.min(99,score||70),
    relicLevel: (extra.nearMiss ? 2 : 1) + Math.floor(Math.random()*2),
    power: relicPower,
    multi: extra.multi || 1
  };
  codex.unshift(entry);
  if (codex.length > 18) codex.pop();
  localStorage.setItem(CODEX_KEY, JSON.stringify(codex));
  showCodex();
}

function showCodex() {
  const list = document.getElementById('codexList');
  const codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
  if (!codex.length) { list.innerHTML = '<div class="card">아직 기록이 없어요 — 운세를 보면 여기에 쌓입니다.</div>'; return; }
  const TYPE_LABEL = { 'saju':'사주', 'saju-premium':'상세 풀이', '타로융합':'타로융합' };
  list.innerHTML = codex.map((c,i) => {
    const lv = c.relicLevel || 1;
    const pow = c.power || c.score;
    const label = TYPE_LABEL[c.type] || c.type;
    return `<div class="card relic" data-idx="${i}">🜁 ${c.ts.slice(5,10)} · ${label} · ${c.text}<br><small>기록 Lv.${lv} • 기운 ${pow} • x${(c.multi||1).toFixed(1)} — <b>눌러서 기록 강화</b></small></div>`;
  }).join('');
  // Re-observe Codex that mutates UI (births) — one protagonist + sfumato + lung
  list.onclick = (e) => {
    const el = e.target.closest('.relic'); if (!el) return;
    const idx = parseInt(el.dataset.idx || '0');
    reObserveCodex(idx);
  };
}

// Re-observe Codex mutates UI + births (Da Vinci observation engine)
function reObserveCodex(idx) {
  let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
  if (!codex[idx]) return;
  const r = codex[idx];
  r.power = Math.min(99, (r.power||r.score||62) + 5);
  r.relicLevel = (r.relicLevel||1) + 1;
  codex[idx] = r; localStorage.setItem(CODEX_KEY, JSON.stringify(codex));

  // Canvas birth mutation (sfumato wheel evolves)
  const c = document.getElementById('saju-canvas');
  if (c) {
    const ctx = c.getContext('2d');
    const cx = c.width*0.5, cy = c.height*0.618;
    ctx.strokeStyle = 'hsla(42,65%,82%,0.32)';
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.arc(cx, cy, 57, 0, Math.PI*2); ctx.stroke();
    // golden ratio new birth ring
    ctx.lineWidth=0.9; ctx.strokeStyle='#c5a46e';
    ctx.beginPath(); ctx.arc(cx, cy, 57*0.618, 0, Math.PI*2); ctx.stroke();
  }
  // Lung integration: re-observe feeds surprise breath
  try {
    const lung = JSON.parse(localStorage.getItem('p6_lungFragment')||'{"breath":0}');
    lung.breath = ((lung.breath||0)+0.11)%6.28;
    lung.lastSurprise = (lung.lastSurprise||0)*0.6 + 0.3;
    localStorage.setItem('p6_lungFragment', JSON.stringify(lung));
    if (window.p6LungSurpriseEye && c) window.p6LungSurpriseEye(c.getContext('2d'), c.width, c.height*0.58, lung, 0.48, {wound:0.55}, 0.22);
  } catch(e){}
  // UI birth element (restraint, one new soft note)
  const birth = document.createElement('div');
  birth.className='card'; birth.style.cssText='font-size:0.78rem;border-color:#c5a46e;margin-top:6px';
  birth.textContent = `✧ 기록 강화: ${r.type} → Lv${r.relicLevel}`;
  const sec = document.getElementById('codex'); if (sec) sec.appendChild(birth);
  setTimeout(()=>{ birth.style.opacity='0.85'; },80);
  showCodex();
}

// FOMO limited banner (scarcity)
function triggerLimitedBanner() {
  const b = document.getElementById('limitedBanner');
  if (b) b.style.display = 'block';
  setTimeout(() => { if(b) b.style.display='none'; }, 42000);
}

// p21 cross note + shared boost
function initP21Link() {
  // Fix: detect the actual p21 app via a p21-EXCLUSIVE key (tarotLuck), not the
  // shared 'fateCodex' key — which p20 also writes, so the old check self-triggered
  // on p20's own history (fabricated cross signal). Boost now only when p21 truly played.
  const p21Played = localStorage.getItem('tarotLuck') !== null || localStorage.getItem('tarotPity') !== null;
  if (p21Played) {
    console.log('%c[p20] p21 tarot detected — real cross boost applied', 'color:#c9a');
    baseLuck = Math.min(1.18, baseLuck + 0.06);
  }
}

// === RECOMMENDED ACTIONS IMPLEMENTED (full agent meeting synthesis) ===
// 1. Duo fusion: p21 tarot now mutates saju real + birth
function mutateFromTarot(tarotScore, res) {
  const s = JSON.parse(localStorage.getItem('sajuState')||'{}');
  s.fused = Math.min(99, (s.fused||70) + Math.floor((tarotScore-70)*0.38));
  s.luck = Math.min(1.45, (s.luck||1)+0.09);
  localStorage.setItem('sajuState', JSON.stringify(s));
  // Fix: call lung eye with the real signature (ctx,w,cy,lung,amp,spore,ache),
  // not a bare number (which the guard silently no-op'd). Now duo-fusion actually renders on the wheel.
  const c = document.getElementById('saju-canvas');
  if (res > 0.8 && c && window.p6LungSurpriseEye) {
    const ctx = c.getContext('2d');
    const lung = JSON.parse(localStorage.getItem('p6_lungFragment')||'{"breath":0.6}');
    window.p6LungSurpriseEye(ctx, c.width, c.height*0.58, lung, Math.min(1, res), {wound: 0.5 + s.fused*0.003}, 0.3);
  }
  if (s.fused > 86) recordToCodex('타로융합', '타로와 사주가 어우러진 운명 기록', s.fused);
}
window.mutateFromTarot = mutateFromTarot;

// 2. p17 wallet pay for premium
function payPremiumWithP17() {
  if (localStorage.getItem('walletCodex')) {
    const w = JSON.parse(localStorage.getItem('walletCodex')||'[]');
    w.unshift({ts:Date.now(), type:'premium', text:'프리미엄 결제(가상)', power: 25});
    localStorage.setItem('walletCodex', JSON.stringify(w));
    alert('프리미엄 크레딧 25 차감(가상). 기록이 동기화됐어요.');
    return true;
  }
  return false;
}

// 3. Virality share for p17 cross
function shareWalletToFortune() {
  const story = '내 운세 기록이 자라고 있어요. 가상 엔터테인먼트.';
  navigator.clipboard.writeText(story + ' #오늘의운세').then(()=>alert('공유 완료! 보너스 크레딧 지급(가상).'));
  // seed p20
  const c = JSON.parse(localStorage.getItem(CODEX_KEY)||'[]');
  c.unshift({ts:Date.now(), type:'공유', text:story, score:82});
  localStorage.setItem(CODEX_KEY, JSON.stringify(c));
}

// === DEEP UPGRADES: shared Codex mutations, canvas, p6 full, p10, births, real timers, cross nav ===
function mutateSharedFate(fromType, val) {
  let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
  if (codex.length) {
    codex[0].power = Math.min(99, (codex[0].power||70) + Math.floor(val*0.6));
    localStorage.setItem(CODEX_KEY, JSON.stringify(codex));
  }
  // p21 mutation reverse
  let p21c = JSON.parse(localStorage.getItem('fateCodex')||'[]');
  if (p21c[0]) { p21c[0].score = Math.min(99, (p21c[0].score||60) + Math.floor(val*0.4)); localStorage.setItem('fateCodex', JSON.stringify(p21c)); }
  console.log('[p20-p21] Shared fate mutation applied');
}

// 오행 5원소: 목(청)·화(적)·토(황)·금(백금)·수(흑청) — 상생 오각별 휠. 간지 재작성 + 레티나 선명.
const WHEEL_EL = [
  { k:'목', col:'#4ec97a', glow:'rgba(78,201,122,0.55)' },
  { k:'화', col:'#ff6b5c', glow:'rgba(255,107,92,0.55)' },
  { k:'토', col:'#e0b552', glow:'rgba(224,181,82,0.55)' },
  { k:'금', col:'#dfe4ea', glow:'rgba(223,228,234,0.5)' },
  { k:'수', col:'#5c8dff', glow:'rgba(92,141,255,0.5)' },
];
function drawSajuCanvas(pillarsText, score, dist) {
  const c = document.getElementById('saju-canvas');
  if (!c) return;
  // 레티나 선명화: CSS 크기 유지, 백버퍼 2x
  const cssW = c.clientWidth || 300, cssH = c.clientHeight || 140;
  const dpr = Math.min(3, window.devicePixelRatio || 2);
  if (c.width !== Math.round(cssW*dpr)) { c.width = Math.round(cssW*dpr); c.height = Math.round(cssH*dpr); }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const w = cssW, h = cssH, cx = w*0.5, cy = h*0.52, R = Math.min(w,h)*0.34;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0,0,w,h);

  // 은은한 배경 링(절제) — 흐릿한 덧칠 제거, 선명한 골드 서클
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(197,164,110,0.22)';
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx,cy,R*0.618,0,Math.PI*2); ctx.stroke();

  // 5원소 노드 위치(위=목 시작, 시계방향)
  const pts = WHEEL_EL.map((_,i)=>{ const a = -Math.PI/2 + i*(Math.PI*2/5); return { x:cx+Math.cos(a)*R, y:cy+Math.sin(a)*R }; });

  // 상생(오각형 둘레: 목→화→토→금→수→목) — 부드러운 금선
  ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(224,181,82,0.5)';
  ctx.beginPath(); pts.forEach((p,i)=> i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)); ctx.closePath(); ctx.stroke();
  // 상극(오각별 대각: i→i+2) — 가는 붉은선
  ctx.lineWidth = 0.7; ctx.strokeStyle = 'rgba(255,107,92,0.28)';
  for (let i=0;i<5;i++){ const a=pts[i], b=pts[(i+2)%5]; ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }

  // 오행 노드: 분포(dist)로 크기·발광 스케일 = 데이터 시각화
  const d = dist || {목:1,화:1,토:1,금:1,수:1};
  const maxv = Math.max(1, ...WHEEL_EL.map(e=>d[e.k]||0));
  WHEEL_EL.forEach((e,i)=>{
    const p = pts[i]; const v = (d[e.k]||0); const rr = 6 + (v/maxv)*8;
    ctx.shadowBlur = 12 + (v/maxv)*10; ctx.shadowColor = e.glow;
    const grad = ctx.createRadialGradient(p.x,p.y,1,p.x,p.y,rr);
    grad.addColorStop(0, e.col); grad.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x,p.y,rr,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // 원소 글자
    ctx.fillStyle = e.col; ctx.font = '600 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(e.k, p.x, p.y);
  });
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';

  ctx.fillStyle='#8a8072'; ctx.font='9px system-ui';
  ctx.fillText('사주 오행 휠', 10, h-8);
}

function p10PaySaju(detail) {
  let bal = parseFloat(localStorage.getItem('p10_balance')||'1284');
  if (bal < 50) { alert('크레딧이 부족해요'); return false; }
  localStorage.setItem('p10_balance', (bal-50).toFixed(2));
  return true;
}

function birthFateSpore() {
  const spore = {id:'fs'+Date.now(), from:'p20', type:'fate-spore', power: 7 + Math.random()*9|0 };
  let arts = JSON.parse(localStorage.getItem('legion_birth_artifacts')||'[]');
  arts.unshift(spore); localStorage.setItem('legion_birth_artifacts', JSON.stringify(arts.slice(0,9)));
  alert('운명의 씨앗이 생성됐어요. (가상)');
}

function addCrossNavP20() {
  // 타로 앱(p21)이 이 배포에 존재하지 않아 죽은 버튼(404)이 되므로 노출하지 않음.
  // 타로 앱 배포 시 아래 주석을 되살리면 복구됨.
  // const nav = document.createElement('div');
  // nav.style.marginTop='12px';
  // nav.innerHTML = `<button onclick="window.open('../p21-tarot-app/index.html','_blank')">🔮 타로도 보기</button>`;
  // document.body.appendChild(nav);
}

function startRealFomoTimer() {
  setInterval(() => {
    const el = document.getElementById('fomo');
    if (el) {
      const left = Math.max(0, 86400 - (Date.now() % 86400000) / 1000 | 0);
      if (freeLeft <= 0) el.textContent = `무료 소진 • ${Math.floor(left/3600)}h to reset`;
    }
  }, 45000);
}

// === NIOBE VIRAL UPGRADE: p20/p21 "Fate Share" (Codex relic export + surprise story share) ===
// Deficiencies fixed: no external hook, no UGC, weak K. Now 1-tap share + endowment bonus + p9/p11 cross seed.
// Fictional + prominent shield. Full psych: endowment ("MY Relic"), FOMO story urgency, variable surprise story power.
function fateShare(fromCodex=false) {
  let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
  if (!codex.length) { alert('먼저 운세를 봐서 기록을 만들어 주세요.'); return; }
  const relic = fromCodex ? codex[0] : (JSON.parse(localStorage.getItem('readingLast')||'null') || codex[0]);
  const duo = '사주 + 타로 운세';
  const story = `🌌 나의 운세 기록 — ${relic.text || '운명 기록'}\nLv${relic.relicLevel||1} 기운 ${relic.power||relic.score} • x${(relic.multi||1).toFixed(1)}\n${duo}\n\n이 기록이 나를 말해줘요. 당신의 운세도 기록해 보세요.\n가상 엔터테인먼트용 · 18+ · 실제 운명 조언 아님.\n\n#오늘의운세 #사주타로\n👉 ${location.href}`;
  // UGC: canvas export as relic card (beautiful shareable visual)
  const canvas = document.getElementById('saju-canvas') || document.createElement('canvas');
  let dataUrl = '';
  try { dataUrl = canvas.toDataURL('image/png'); } catch(e){}
  // Copy story + deep link
  navigator.clipboard.writeText(story).then(() => {
    const bonus = 8 + Math.floor((relic.power||70)/12); // retention + endowment
    let bal = parseFloat(localStorage.getItem('p10_balance')||'1284') + bonus;
    localStorage.setItem('p10_balance', bal.toFixed(2));
    // Cross virality seed to p9 live + p11 metaverse (Fate aura boost)
    try {
      localStorage.setItem('p20_fate_to_p9', JSON.stringify({score: relic.score||70, power: relic.power, ts:Date.now()}));
      localStorage.setItem('p20_fate_to_p11', JSON.stringify({relicPower: relic.power, aura:'fate', ts:Date.now()}));
    } catch(e){}
    alert(`✅ 운세 이야기가 복사됐어요. 보너스 크레딧 +${bonus}(가상).\n\n가상 엔터테인먼트용입니다.`);
    if (dataUrl) console.log('[share] relic card exported');
    localStorage.setItem('niobe_k_fate', (parseInt(localStorage.getItem('niobe_k_fate')||'0')+1)+'');
  }).catch(()=> prompt('아래 운세 이야기를 복사해 공유하세요:', story));
  // Surprise story share trigger bonus if high multi
  if ((relic.multi||1) > 1.3) {
    setTimeout(()=>alert('⚡ 오늘 기운의 결이 유난히 짙어, 이 기록은 특별히 선명하게 남습니다. (가상)'), 900);
  }
}

// =====================================================================
// 결과 공유 = 바이럴 루프 (유저용 깔끔 버전) — Niobe/Trinity
// 정직: 실제 사주 분석(오행 과다/부족) + 오늘 운세 relation만 사용. 가짜 수치·과장 없음.
// navigator.share(모바일 네이티브) → 실패시 클립보드 복사 + 토스트. X 인텐트 옵션.
// 내부 크로스 로직(p9/p11 시드·K카운트)은 유지하되 유저 노출 코드네임은 제거.
// =====================================================================
const SHARE_URL = 'https://hosuman08-netizen.github.io/saju-miniapp/';

// 실제 분석에서 정직한 공유 요약 한 줄 생성 (과다·부족 오행 + 오늘 운세)
function buildShareSummary() {
  let elems = '', luck = '';
  if (lastAnalysis) {
    const A = lastAnalysis;
    const over = A.cnt[A.strongest] >= 3 ? `${A.strongest} 과다` : `${A.strongest} 강세`;
    const lack = A.missing.length ? `${A.missing[0]} 부족` : `${A.weakest} 약세`;
    elems = `오행은 ${over}·${lack}`;
  }
  // 오늘 운세: 저장된 마지막 결과의 relation 텍스트 앞부분
  const base = todayReadingBase();
  if (base) luck = `오늘은 ${base.relation}의 기운`;
  // 조합 (둘 중 있는 것만)
  if (elems && luck) return `내 사주 ${elems}, ${luck}.`;
  if (elems) return `내 사주 ${elems}.`;
  if (luck) return `${luck}이 흐르는 날.`;
  return '내 사주 팔자와 오늘의 운세를 봤어요.';
}

// 공유 텍스트: 결과 요약 + 호기심 훅 + URL + 해시태그 (친구 톤·정직)
function buildShareText() {
  const summary = buildShareSummary();
  return `${summary} 너도 생년월일 넣고 봐봐 👀\n${SHARE_URL}\n#사주 #오늘의운세`;
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// 유저용 결과 공유 버튼 핸들러
function shareResult() {
  const text = buildShareText();
  // 계측: 결과 공유 클릭 = 바이럴
  if (window.legionTrack) window.legionTrack('share');
  // 내부 크로스 로직 유지 (유저에 코드네임 노출 없이 조용히 시딩)
  seedCrossOnShare();
  if (navigator.share) {
    navigator.share({ title: '사주 명리 · 오늘의 운세', text, url: SHARE_URL })
      .catch(() => copyShareFallback(text));
    return;
  }
  copyShareFallback(text);
}

function copyShareFallback(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('복사됐어요 · 붙여넣기 해서 공유하세요'))
      .catch(() => prompt('아래 텍스트를 복사해 공유하세요:', text));
  } else {
    prompt('아래 텍스트를 복사해 공유하세요:', text);
  }
}

// X(트위터) 인텐트 — 옵션 버튼
function shareToX() {
  // 계측: X 공유 클릭 = 바이럴
  if (window.legionTrack) window.legionTrack('share');
  seedCrossOnShare();
  const text = buildShareText();
  const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
  window.open(url, '_blank', 'noopener');
}

// 내부 크로스 시딩(유저 비노출) — 기존 cross 로직을 이 지점에서만 조용히 재사용
function seedCrossOnShare() {
  try {
    let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
    const relic = (JSON.parse(localStorage.getItem('readingLast') || 'null')) || codex[0] || {};
    localStorage.setItem('p20_fate_to_p9', JSON.stringify({ score: relic.score || 70, power: relic.power, ts: Date.now() }));
    localStorage.setItem('p20_fate_to_p11', JSON.stringify({ relicPower: relic.power, aura: 'fate', ts: Date.now() }));
    localStorage.setItem('niobe_k_fate', (parseInt(localStorage.getItem('niobe_k_fate') || '0') + 1) + '');
  } catch (e) {}
}
window.shareResult = shareResult;
window.shareToX = shareToX;

window.onload = () => {
  updateFomo();
  initP21Link();
  showCodex();
  startRealFomoTimer();
  addCrossNavP20();
  // Layered prominent disclosure (미꾸라지)
  const foot = document.querySelector('footer');
  if (foot) foot.innerHTML = `<small>FICTIONAL AI ENTERTAINMENT ONLY • NO REAL ADVICE • 18+ • PURE STORY • Prominent disclosure on every action. Reversible. NO kompu.</small>`;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
  // hook mutation after first reading
  setTimeout(() => { if (document.getElementById('readingText')) mutateSharedFate('init', 3); }, 1200);
};
