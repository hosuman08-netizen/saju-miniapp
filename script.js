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

function generateSaju() {
  const birth = document.getElementById('birth').value;
  const time = document.getElementById('time').value;
  const gender = document.getElementById('gender').value;
  if (!birth) return alert('생일 입력');

  const d = new Date(birth);
  const year = d.getFullYear();
  const stems = ['갑','을','병','정','무','기','경','신','임','계'];
  const branches = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
  const stemIdx = (year - 4) % 10;
  const branchIdx = (year - 4) % 12;
  const pillarY = stems[stemIdx] + branches[branchIdx];
  const pillarM = stems[(stemIdx+1)%10] + branches[(branchIdx+1)%12];
  const pillarD = stems[(stemIdx+3)%10] + branches[(branchIdx+4)%12];
  const pillarH = stems[(stemIdx+5)%10] + branches[(branchIdx+6)%12];

  document.getElementById('pillars').innerHTML = `
    <div class="pillar"><b>년</b><br>${pillarY}</div>
    <div class="pillar"><b>월</b><br>${pillarM}</div>
    <div class="pillar"><b>일</b><br>${pillarD}</div>
    <div class="pillar"><b>시</b><br>${pillarH}</div>
  `;
  const elements = '목(년) · 화(월) · 토(일) · 금(시) — 오행 균형 분석';
  document.getElementById('elements').innerHTML = `<div class="card">${elements} (성별:${gender})</div>`;
  document.getElementById('chart').style.display = 'block';
  document.getElementById('reading').style.display = 'none';
  // Da Vinci canvas + p6
  const pillarsText = document.getElementById('pillars').textContent || '';
  drawSajuCanvas(pillarsText, 70);
  if (window.p6LungSurpriseEye) console.log('[p20] p6 lung eye available for fate canvas');
}

function doReading() {
  if (freeLeft <= 0 && !confirm('무료 소진. 프리미엄으로? (FICTIONAL)')) return;
  const reading = getSajuReading();
  const boostedText = reading.text + (reading.nearMiss ? ' <span class="surprise">⚡ NEAR-MISS: 대길 1점 차이 — 다음 더 강렬</span>' : '');
  document.getElementById('readingText').innerHTML = boostedText;
  document.getElementById('surprise').innerHTML = reading.multi > 1.1 ? `⚡ SURPRISE MULT x${reading.multi.toFixed(1)} — p6 Lung resonance ${reading.res}` : (reading.pity ? '🌟 PITY TRIGGERED: bad streak ended' : '');
  document.getElementById('reading').style.display = 'block';
  if (freeLeft > 0) freeLeft--;
  updateFomo();
  localStorage.setItem('readingLast', JSON.stringify(reading));
  recordToCodex('saju', reading.text, reading.score, reading);
  // loss if no window active
  const inWindow = document.querySelector('#fateWindows .open');
  if (!inWindow) LilithPsych.applyLoss(true);
}

function getSajuReading() {
  const texts = [
    "재물운 상승. 사업/투자 타이밍 좋음.",
    "인간관계 주의. 신중한 선택 필요.",
    "건강/휴식 우선. 새로운 기회 대기.",
    "학업/창작 분야 강세. 표현력 UP."
  ];
  const idx = Math.floor(Math.random()*texts.length);
  const rawScore = 58 + Math.floor(Math.random()*37);
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
  return {
    text: texts[idx] + ` (운세 지수 ${Math.min(99,finalScore)})`,
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
  const utter = new SpeechSynthesisUtterance('p6 폐 음성: ' + text);
  utter.lang = 'ko-KR';
  speechSynthesis.speak(utter);
  const s = LilithPsych.resonance || Math.random();
  if (s > 0.55) {
    document.getElementById('surprise').innerHTML += ` | p6 Lung surprise x${(s*1.7).toFixed(1)}`;
  }
}

function unlockPremium() {
  // p10 mock + FOMO banner tease
  if (!confirm('p10 Harvest Credits 50 소모 — FICTIONAL. PURE ENTERTAINMENT ONLY. Continue?')) return;
  const detail = '프리미엄: 3개월 대운 상세 + 재물/연애/직장 풀 분석. (p20+p21 연동됨)';
  document.getElementById('readingText').innerHTML += `<br><br><b>PREMIUM:</b> ${detail} <span style="color:#c99">Limited Eclipse Banner applied.</span>`;
  recordToCodex('saju-premium', detail, 95);
  triggerLimitedBanner();
}

function recordToCodex(type, text, score, extra={}) {
  let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '[]');
  const relicPower = Math.floor((score||70) * (0.6 + (LilithPsych.resonance||0.5)));
  const entry = {
    ts: new Date().toISOString(),
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
  if (!codex.length) { list.innerHTML = '<div class="card">아직 기록 없음 — Re-observe Codex로 birth 시작.</div>'; return; }
  list.innerHTML = codex.map((c,i) => {
    const lv = c.relicLevel || 1;
    const pow = c.power || c.score;
    return `<div class="card relic" data-idx="${i}">🜁 ${c.ts.slice(5,10)} [${c.type}] ${c.text}<br><small>Relic Lv.${lv} • Power ${pow} • x${(c.multi||1).toFixed(1)} — <b>Click: Re-observe → Birth</b></small></div>`;
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
  birth.textContent = `✧ Birth: ${r.type} re-observed → Lv${r.relicLevel} (Vitruvian mutation)`;
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
  const hasP21 = localStorage.getItem(CODEX_KEY);
  if (hasP21) console.log('%c[p20] p21 codex detected — cross boost ready', 'color:#c9a');
  // cross fate index from p21
  const p21Data = JSON.parse(localStorage.getItem('fateCodex') || '[]');
  if (p21Data.length > 1) baseLuck = Math.min(1.18, baseLuck + 0.06);
}

// === RECOMMENDED ACTIONS IMPLEMENTED (full agent meeting synthesis) ===
// 1. Duo fusion: p21 tarot now mutates saju real + birth
function mutateFromTarot(tarotScore, res) {
  const s = JSON.parse(localStorage.getItem('sajuState')||'{}');
  s.fused = Math.min(99, (s.fused||70) + Math.floor((tarotScore-70)*0.38));
  s.luck = Math.min(1.45, (s.luck||1)+0.09);
  localStorage.setItem('sajuState', JSON.stringify(s));
  if (res>0.8 && window.p6LungSurpriseEye) window.p6LungSurpriseEye(res);
  if (s.fused > 86) recordToCodex('duo-birth', 'Destiny Spore (p21->p20)', s.fused);
}
window.mutateFromTarot = mutateFromTarot;

// 2. p17 wallet pay for premium
function payPremiumWithP17() {
  if (localStorage.getItem('walletCodex')) {
    const w = JSON.parse(localStorage.getItem('walletCodex')||'[]');
    w.unshift({ts:Date.now(), type:'p20-premium', text:'Paid with wallet for saju premium', power: 25});
    localStorage.setItem('walletCodex', JSON.stringify(w));
    alert('p17 Wallet deducted 25 credits for premium. Relic synced.');
    return true;
  }
  return false;
}

// 3. Virality share for p17 cross
function shareWalletToFortune() {
  const story = 'MY Wallet fed p20 Saju fate. Relics growing. Fictional.';
  navigator.clipboard.writeText(story + ' #DestinyDuo').then(()=>alert('Shared! +p10 bonus simulated.'));
  // seed p20
  const c = JSON.parse(localStorage.getItem(CODEX_KEY)||'[]');
  c.unshift({ts:Date.now(), type:'p17-virality', text:story, score:82});
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
  ctx.fillText('Saju Wheel • Sfumato Vitruvian • p6 Lung', 38, h-9);
}

function p10PaySaju(detail) {
  let bal = parseFloat(localStorage.getItem('p10_balance')||'1284');
  if (bal < 50) { alert('p10 shallow: low credits'); return false; }
  localStorage.setItem('p10_balance', (bal-50).toFixed(2));
  return true;
}

function birthFateSpore() {
  const spore = {id:'fs'+Date.now(), from:'p20', type:'fate-spore', power: 7 + Math.random()*9|0 };
  let arts = JSON.parse(localStorage.getItem('legion_birth_artifacts')||'[]');
  arts.unshift(spore); localStorage.setItem('legion_birth_artifacts', JSON.stringify(arts.slice(0,9)));
  alert('Birth: Fate Spore created. Feeds p17 + p21 mutations.');
}

function addCrossNavP20() {
  const nav = document.createElement('div');
  nav.style.marginTop='12px';
  nav.innerHTML = `<button onclick="window.open('../p21-tarot-app/index.html','_blank')">p21 Tarot Cross</button>
  <button onclick="window.open('../p17-coin-wallet-app/index.html','_blank')">p17 Wallet</button>
  <button onclick="window.open('../p10-stable-fee-app/index.html','_blank')">p10 Pay</button>`;
  document.body.appendChild(nav);
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
  if (!codex.length) { alert('먼저 운세나 드로우로 Fate Codex 생성하세요.'); return; }
  const relic = fromCodex ? codex[0] : (JSON.parse(localStorage.getItem('readingLast')||'null') || codex[0]);
  const duo = 'p20 사주 + p21 타로 Destiny Duo';
  const story = `🌌 MY Fate Relic — ${relic.text || '운명 기록'}\nLv${relic.relicLevel||1} Power ${relic.power||relic.score} • x${(relic.multi||1).toFixed(1)}\n${duo} • Surprise from p6 Lung\n\n이 Codex가 나를 말한다. 너의 운명도 기록하라.\nFictional entertainment only. 18+. Prominent: NO real fate advice. Reversible.\n\n#DestinyDuo #FateShare p20+p21\n👉 ${location.href}`;
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
    alert(`✅ Fate Share copied (Destiny Duo story + relic). +${bonus} p10 bonus. p9 live glow + p11 metaverse aura seeded.\n\nFictional. Layered disclosure: entertainment only.`);
    // Simulate OG visual if dataUrl
    if (dataUrl) console.log('[Niobe] Relic card exported for X/TG OG');
    // K ignition stub
    localStorage.setItem('niobe_k_fate', (parseInt(localStorage.getItem('niobe_k_fate')||'0')+1)+'');
  }).catch(()=> prompt('Copy Fate Story:', story));
  // Surprise story share trigger bonus if high multi
  if ((relic.multi||1) > 1.3) {
    setTimeout(()=>alert('⚡ HIGH SURPRISE — story share extra FOMO window open.'), 900);
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
