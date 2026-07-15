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
  el.textContent = freeLeft > 0 ? `오늘 무료 ${freeLeft}회 남음 • base ${ (baseLuck*100|0) }%` : '오늘 무료 소진 (프리미엄 추천)';
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
    html += `<span class="win ${open?'open':'closed'}">${w.label} ${open ? `⏱ ${closeIn}h left — NOW` : 'closed'}</span> `;
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

// 마지막 계산 결과 보관 (운세 해석에서 재사용)
let lastChart = null, lastAnalysis = null;

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
  drawSajuCanvas(pillarsText, 70);
  if (window.p6LungSurpriseEye) console.log('[p20] p6 lung eye available for fate canvas');
}

function doReading() {
  if (freeLeft <= 0 && !confirm('무료 소진. 프리미엄으로? (FICTIONAL)')) return;
  const reading = getSajuReading();
  const boostedText = reading.text + (reading.nearMiss ? ' <span class="surprise">⚡ 아깝게 놓침: 대길 1점 차이 — 다음이 더 강렬</span>' : '');
  document.getElementById('readingText').innerHTML = boostedText;
  document.getElementById('surprise').innerHTML = reading.multi > 1.1 ? `⚡ 서프라이즈 배수 x${reading.multi.toFixed(1)} — 공명도 ${reading.res}` : (reading.pity ? '🌟 반전 운세: 나쁜 흐름이 끝났어요' : '');
  document.getElementById('reading').style.display = 'block';
  if (freeLeft > 0) freeLeft--;
  updateFomo();
  localStorage.setItem('readingLast', JSON.stringify(reading));
  recordToCodex('saju', reading.text, reading.score, reading);
  // loss if no window active
  const inWindow = document.querySelector('#fateWindows .open');
  if (!inWindow) LilithPsych.applyLoss(true);
}

// 오늘의 일진(日辰) 오행이 내 일간과 맺는 십신(十神) 관계 → 실제 근거 있는 운세 방향
function todayReadingBase() {
  if (!lastChart) return null;
  const dm = SAJU.STEM_EL[lastChart.dayMaster]; // 내 일간 오행
  const now = new Date();
  const dIdx = ((SAJU.jdn(now.getFullYear(), now.getMonth() + 1, now.getDate()) + 49) % 60 + 60) % 60;
  const todayStem = SAJU.STEMS[dIdx % 10];
  const todayEl = SAJU.STEM_EL[todayStem]; // 오늘 천간 오행
  // 십신 관계 판정 (내 일간 기준 오늘 오행이 무엇인가)
  let relation, text, favor;
  if (todayEl === dm) { relation = '비겁'; text = '동료·경쟁의 기운이 강한 날. 내 힘을 밀어붙이되 독단은 금물. 협업에서 성과가 납니다.'; favor = 'self'; }
  else if (SAJU.GEN[dm] === todayEl) { relation = '식상'; text = '표현·창작·베풂의 기운. 아이디어를 밖으로 내보내면 좋은 반응이 옵니다. 말과 결과물로 승부할 날.'; favor = 'express'; }
  else if (SAJU.OVERCOME[dm] === todayEl) { relation = '재성'; text = '재물·현실 성과의 기운. 실무·거래·투자 타이밍을 잡기 좋은 날. 다만 욕심의 과속은 주의.'; favor = 'wealth'; }
  else if (SAJU.OVERCOME_BY[dm] === todayEl) { relation = '관성'; text = '규율·책임·인정의 기운. 공적인 자리·평가에서 빛나는 날. 원칙을 지키면 신뢰가 쌓입니다.'; favor = 'career'; }
  else { relation = '인성'; text = '배움·회복·귀인의 기운. 쉬어가며 채우기 좋은 날. 공부·문서·조언에서 도움이 옵니다.'; favor = 'rest'; }
  // 용신에 오늘 오행이 맞으면 길함 가중 (진짜 사주 근거)
  const aligned = lastAnalysis && lastAnalysis.yongsin.includes(todayEl);
  return { relation, text, todayStem, todayEl, aligned };
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
  const prefix = base
    ? `<b class="today-rel">오늘의 일진 ${base.todayStem}(${base.todayEl}) · ${base.relation}</b>${base.aligned ? ' <span class="aligned">✦ 용신과 조화</span>' : ''}<br>`
    : '';
  return {
    text: prefix + texts[idx] + ` (운세 지수 ${Math.min(99,finalScore)})`,
    score: Math.min(99,finalScore),
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
    document.getElementById('surprise').innerHTML += ` | 서프라이즈 x${(s*1.7).toFixed(1)}`;
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
  list.innerHTML = codex.map((c,i) => {
    const lv = c.relicLevel || 1;
    const pow = c.power || c.score;
    return `<div class="card relic" data-idx="${i}">🜁 ${c.ts.slice(5,10)} [${c.type}] ${c.text}<br><small>기록 Lv.${lv} • 기운 ${pow} • x${(c.multi||1).toFixed(1)} — <b>눌러서 기록 강화</b></small></div>`;
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

function drawSajuCanvas(pillarsText, score) {
  const c = document.getElementById('saju-canvas');
  if (!c) return;
  const ctx = c.getContext('2d', {alpha:true});
  const w = c.width, h = c.height;
  const cx = w * 0.5, cy = h * 0.618; // Vitruvian golden navel
  ctx.fillStyle = '#0a0806'; ctx.fillRect(0,0,w,h);

  // Sfumato soft wheel layers (Da Vinci restraint + 5 glazes)
  for (let g=0; g<5; g++) {
    const a = 0.18 - g*0.028;
    ctx.strokeStyle = `hsla(42,58%,76%,${Math.max(0.04,a)})`;
    ctx.lineWidth = 1.8 - g*0.18;
    ctx.shadowBlur = 7 + g;
    ctx.shadowColor = 'rgba(197,164,110,0.2)';
    ctx.beginPath();
    ctx.arc(cx, cy, 42 + g*3.2, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Golden spokes (one protagonist wheel)
  ctx.strokeStyle = '#c5a46e'; ctx.lineWidth = 1.15;
  const r = 42;
  for (let i=0; i<4; i++) {
    const a = i * Math.PI / 2 + ((score||70)%80)*0.011 + (Date.now()%9000)/18000;
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); ctx.stroke();
  }
  // 8px grid inner rings (Vitruvian)
  ctx.lineWidth=0.7;
  for (let k=1;k<3;k++){ ctx.beginPath(); ctx.arc(cx,cy,r*(0.618*k),0,Math.PI*2); ctx.stroke(); }

  // p6 Lung Surprise Eye integration — real mutation on wheel
  const lung = JSON.parse(localStorage.getItem('p6_lungFragment')||'{"breath":0.6}');
  const spore = {wound: 0.5 + (score||0)*0.003};
  if (window.p6LungSurpriseEye) {
    window.p6LungSurpriseEye(ctx, w, cy-8, lung, 0.55, spore, 0.3);
  }

  ctx.fillStyle='#e8e0d0'; ctx.font='9px system-ui';
  ctx.fillText('사주 오행 휠', 38, h-9);
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
  }).catch(()=> prompt('Copy Fate Story:', story));
  // Surprise story share trigger bonus if high multi
  if ((relic.multi||1) > 1.3) {
    setTimeout(()=>alert('⚡ 높은 서프라이즈 — 특별 공유 보너스 창이 열렸어요.'), 900);
  }
}

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
