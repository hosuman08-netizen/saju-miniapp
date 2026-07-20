/* =====================================================================
 * saju-ui.js — 명식 렌더링 · 시간축 · 궁합 · 공유 카드
 * 모든 표시값은 saju-pro.js의 결정적 계산에서 파생. 랜덤 없음.
 * ===================================================================== */
(function () {
  'use strict';
  var SP = window.SajuPro;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var elc = function (e) { return SP.EL_COLOR[e] || '#c5a46e'; };

  var STATE = { chart: null, full: null, anal: null, daeun: null, gender: 'm', input: null, match: null };

  /* --- 십신 그룹 색 --- */
  var GOD_COLOR = { 비겁: '#c9a24a', 식상: '#5aa469', 재성: '#c9524a', 관성: '#4a72c9', 인성: '#9b7fc9' };
  var godColor = function (g) { return GOD_COLOR[SP.TEN_GOD_GROUP[g]] || '#a38a66'; };

  /* --- 일간 아키타입 (script.js와 동일 사전 재사용) --- */
  var ARCHE = {
    갑: '곧게 뻗는 개척자', 을: '유연히 감기는 생명력', 병: '세상을 밝히는 태양',
    정: '은은히 스미는 촛불', 무: '흔들리지 않는 큰 산', 기: '품어 기르는 대지',
    경: '벼려진 강철의 결단', 신: '정제된 보석의 예리함', 임: '스케일 큰 바다', 계: '총명하게 스미는 이슬'
  };

  /* ================= 도시 셀렉트 초기화 ================= */
  function initCities() {
    var sel = $('city'); if (!sel || sel.options.length) return;
    SP.CITIES.forEach(function (c, i) {
      var o = document.createElement('option');
      o.value = c.lon; o.textContent = c.name;
      if (i === 0) o.selected = true;
      sel.appendChild(o);
    });
  }

  /* ================= 탭 ================= */
  function initTabs() {
    var tabs = document.querySelectorAll('#tabs .tab');
    Array.prototype.forEach.call(tabs, function (t) {
      t.onclick = function () {
        Array.prototype.forEach.call(tabs, function (x) { x.classList.remove('active'); });
        Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (p) { p.classList.remove('active'); });
        t.classList.add('active');
        var p = $(t.dataset.tab); if (p) p.classList.add('active');
      };
    });
  }

  /* ================= 메인 생성 ================= */
  function generate() {
    initCities();
    var birth = $('birth').value;
    if (!birth) { toast('생년월일을 입력해 주세요'); return; }
    var timeUnknown = $('timeUnknown').checked;
    var time = $('time').value || '12:00';
    var gender = $('gender').value;
    var lon = parseFloat($('city').value);
    var ja = $('jaSchool').value;

    var ymd = birth.split('-').map(Number);
    var hm = time.split(':').map(Number);

    var chart = SP.computePro(ymd[0], ymd[1], ymd[2], hm[0], hm[1], {
      lon: lon, ja: ja, timeKnown: !timeUnknown,
      applyLongitude: $('optLon').checked, applyEot: $('optEot').checked
    });
    var full = SP.fullChart(chart);
    var anal = SP.analyzePro(chart);
    var du = SP.daeun(chart, gender, 10);

    STATE.chart = chart; STATE.full = full; STATE.anal = anal; STATE.daeun = du;
    STATE.gender = gender; STATE.input = { birth: birth, time: time, timeUnknown: timeUnknown };

    // 최근 프로필 루프 (원탭 재조회)
    try {
      var rec = JSON.parse(localStorage.getItem('saju_recent') || '[]');
      var entry = { birth: birth, time: time, timeUnknown: timeUnknown, gender: gender, lon: lon, ja: ja, t: Date.now() };
      rec = rec.filter(function (r) { return r.birth !== birth || r.gender !== gender; });
      rec.unshift(entry);
      localStorage.setItem('saju_recent', JSON.stringify(rec.slice(0, 6)));
      localStorage.setItem('saju_last_birth', birth);
      var reads = +(localStorage.getItem('saju_reads') || 0) + 1;
      localStorage.setItem('saju_reads', String(reads));
      // daily streak
      var st = JSON.parse(localStorage.getItem('saju_streak') || '{}');
      var td = new Date(); var tk = td.getFullYear() + '-' + (td.getMonth()+1) + '-' + td.getDate();
      var yd = new Date(); yd.setDate(yd.getDate()-1); var yk = yd.getFullYear() + '-' + (yd.getMonth()+1) + '-' + yd.getDate();
      if (st.last !== tk) {
        st.count = (st.last === yk) ? (st.count || 0) + 1 : 1;
        st.last = tk;
        localStorage.setItem('saju_streak', JSON.stringify(st));
      }
    } catch (e) {}

    // script.js 하위 호환 (오늘의 운세 · 코덱스가 참조)
    try { lastChart = chart; lastAnalysis = anal; } catch (e) { /* 스코프 없으면 무시 */ }
    window.lastChart = chart; window.lastAnalysis = anal;

    renderHero(); renderMyeongsik(); renderElements();
    renderSipsin(); renderDaeun(); renderBasis();
    $('gunghapBody').innerHTML = '';

    // 입력 폼을 한 줄 요약으로 접어 결과가 먼저 보이게 한다
    var cityName = $('city').options[$('city').selectedIndex].textContent;
    $('summaryText').textContent = birth.replace(/-/g, '.') + ' · ' +
      (timeUnknown ? '시각 모름' : time) + ' · ' + (gender === 'f' ? '여' : '남') + ' · ' + cityName;
    $('input').classList.add('done');

    $('chart').classList.remove('hidden');
    $('reading').classList.add('hidden');
    if (typeof drawSajuCanvas === 'function') {
      try { drawSajuCanvas('', 70, anal.cnt); } catch (e) { /* 캔버스 실패해도 본문 유지 */ }
    }
    $('chart').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (window.legionTrack) window.legionTrack('activate', { feature: 'myeongsik' });
  }

  /* ================= 히어로 ================= */
  function renderHero() {
    var c = STATE.chart, a = STATE.anal, g = SP.gyeokguk(c);
    var dm = c.dayMaster;
    $('hero').innerHTML =
      '<div class="hero">' +
      '<div class="hero-eyebrow">일간 · 나를 뜻하는 글자</div>' +
      '<div class="hero-dm" style="color:' + elc(a.dm) + '">' + SP.STEM_HANJA[dm] + '</div>' +
      '<div class="hero-name">' + dm + '(' + SP.STEM_HANJA[dm] + ') · ' + a.dm + a.dmYY + ' · ' + c.zodiac + '띠</div>' +
      '<div class="hero-arche">' + esc(ARCHE[dm] || '') + '</div>' +
      '<div class="hero-chips">' +
      '<span class="chip">' + esc(g.name) + '</span>' +
      '<span class="chip">' + (a.strong ? '신강' : '신약') + ' ' + a.ratio + '%</span>' +
      '<span class="chip">용신 ' + a.yongsin.map(function (y) { return '<b style="color:' + elc(y) + '">' + y + '</b>'; }).join('·') + '</span>' +
      (STATE.full.sinsalAll.indexOf('천을귀인') >= 0 ? '<span class="chip gold">천을귀인</span>' : '') +
      '</div>' +
      '<p class="hero-gyeok">' + esc(SP.GYEOK_MEAN[g.name] || '') + '</p>' +
      '</div>';
  }

  /* ================= 명식표 ================= */
  function renderMyeongsik() {
    var c = STATE.chart, f = STATE.full;
    // 표시 순서: 시 일 월 년 (전통 만세력 배열)
    var order = ['hour', 'day', 'month', 'year'];
    var ps = order.map(function (k) { return f.pillars.filter(function (p) { return p.key === k; })[0]; });
    var head = '<tr><th class="rowlab"></th>' + ps.map(function (p) {
      return '<th>' + p.label.replace('주', '') + '<span class="palace">' + p.palace.palace.split('·')[0] + '</span></th>';
    }).join('') + '</tr>';

    function row(label, cells, cls) {
      return '<tr class="' + (cls || '') + '"><th class="rowlab">' + label + '</th>' + cells.join('') + '</tr>';
    }
    var empty = '<td class="cell empty">–</td>';

    var rGodTop = row('천간 십신', ps.map(function (p) {
      if (p.empty) return empty;
      return '<td class="cell"><span class="god" style="color:' + godColor(p.stemGod) + '">' + p.stemGod + '</span></td>';
    }), 'r-god');

    var rStem = row('천간', ps.map(function (p) {
      if (p.empty) return empty;
      return '<td class="cell gz" style="background:' + elc(p.stemEl) + '18;border-color:' + elc(p.stemEl) + '55">' +
        '<div class="hz" style="color:' + elc(p.stemEl) + '">' + p.stemHanja + '</div>' +
        '<div class="kr">' + p.stem + '</div>' +
        '<div class="tiny">' + p.stemEl + p.yy + '</div></td>';
    }), 'r-stem');

    var rBranch = row('지지', ps.map(function (p) {
      if (p.empty) return empty;
      return '<td class="cell gz' + (p.gongmang ? ' gongmang' : '') + '" style="background:' + elc(p.branchEl) + '18;border-color:' + elc(p.branchEl) + '55">' +
        '<div class="hz" style="color:' + elc(p.branchEl) + '">' + p.branchHanja + '</div>' +
        '<div class="kr">' + p.branch + '</div>' +
        '<div class="tiny">' + p.branchEl + ' · ' + p.zodiac + '</div>' +
        (p.gongmang ? '<div class="gm-tag">공망</div>' : '') + '</td>';
    }), 'r-branch');

    var rGodBot = row('지지 십신', ps.map(function (p) {
      if (p.empty) return empty;
      return '<td class="cell"><span class="god" style="color:' + godColor(p.branchGod) + '">' + p.branchGod + '</span></td>';
    }), 'r-god');

    var rStage = row('십이운성', ps.map(function (p) {
      if (p.empty) return empty;
      return '<td class="cell"><span class="stage" title="' + esc(SP.TWELVE_MEAN[p.stage]) + '">' + p.stage + '</span></td>';
    }), 'r-stage');

    var rHidden = row('지장간', ps.map(function (p) {
      if (p.empty) return empty;
      return '<td class="cell hidden-cell">' + p.hidden.map(function (h) {
        return '<span class="hid" style="color:' + elc(h.el) + '" title="' + h.god + '">' + SP.STEM_HANJA[h.stem] + '</span>';
      }).join('') + '</td>';
    }), 'r-hidden');

    var rSinsal = row('신살', ps.map(function (p) {
      if (p.empty) return empty;
      if (!p.sinsal.length) return '<td class="cell tiny dim">–</td>';
      return '<td class="cell sinsal-cell">' + p.sinsal.map(function (s) {
        var nm = SP.SB_ALIAS[s.name] || s.name;
        return '<span class="ss' + (s.name === '천을귀인' || s.name === '문창귀인' ? ' good' : '') + '" title="' + esc(SP.SB_MEAN[s.name] || '') + '">' + nm + '</span>';
      }).join('') + '</td>';
    }), 'r-sinsal');

    var noteTime = STATE.chart.timeKnown ? '' :
      '<p class="note warn">태어난 시각을 모른다고 선택하셨습니다 — 시주(時柱)를 비우고 계산했습니다. 시주에 걸리는 십신·십이운성·신살은 빠집니다.</p>';

    $('myeongsik').innerHTML =
      '<div class="table-wrap"><table class="myeongsik">' +
      '<thead>' + head + '</thead><tbody>' +
      rGodTop + rStem + rBranch + rGodBot + rStage + rHidden + rSinsal +
      '</tbody></table></div>' + noteTime +
      '<p class="legend">공망 = 비어 있는 자리 · 지장간 = 지지 속에 숨은 천간 · 십이운성 = 일간이 그 자리에서 갖는 기운의 단계. ' +
      '<span class="dim">항목을 길게 누르면 뜻이 나옵니다.</span></p>';
  }

  /* ================= 오행 분포 ================= */
  function renderElements() {
    var a = STATE.anal, c = STATE.chart;
    var els = ['목', '화', '토', '금', '수'];
    var maxp = Math.max.apply(null, els.map(function (e) { return a.power[e]; }));
    var bars = els.map(function (e) {
      var pct = Math.round(a.power[e] / maxp * 100);
      var isY = a.yongsin.indexOf(e) >= 0;
      var hiddenOnly = a.cnt[e] === 0 && a.power[e] > 0;
      return '<div class="el-row"><span class="el-name" style="color:' + elc(e) + '">' + e +
        '<b>' + a.cnt[e] + '</b></span>' +
        '<span class="el-bar" title="세력 ' + a.power[e] + '"><i style="width:' + pct + '%;background:' + elc(e) +
        (hiddenOnly ? ';opacity:0.5' : '') + '"></i></span>' +
        '<span class="el-pw">' + a.power[e] + '</span>' +
        '<span class="el-tag">' + (isY ? '<em class="yong">용신</em>' : (a.gisin.indexOf(e) >= 0 ? '<em class="gi">기신</em>' : '')) + '</span></div>';
    }).join('');
    var hiddenNote = els.filter(function (e) { return a.cnt[e] === 0 && a.power[e] > 0; });

    var missingTxt = a.missing.length
      ? '없는 오행 <b style="color:' + elc(a.missing[0]) + '">' + a.missing.join('·') + '</b> — 그 기운이 닿는 일을 의식적으로 채우면 균형이 잡힙니다.'
      : '오행이 고루 갖춰진 <b>균형형</b> 명식입니다.';

    var tg = SP.tenGodCount(c);
    var grpOrder = ['비겁', '식상', '재성', '관성', '인성'];
    var grpTot = grpOrder.reduce(function (s, g) { return s + tg.group[g]; }, 0) || 1;
    var grpBars = grpOrder.map(function (g) {
      return '<div class="el-row"><span class="el-name" style="color:' + GOD_COLOR[g] + '">' + g +
        '<b>' + tg.group[g] + '</b></span>' +
        '<span class="el-bar"><i style="width:' + Math.round(tg.group[g] / grpTot * 100) + '%;background:' + GOD_COLOR[g] + '"></i></span>' +
        '<span class="el-tag"></span></div>';
    }).join('');

    $('elements').innerHTML =
      '<div class="card">' +
      '<h3 class="card-h">오행 분포</h3>' +
      '<p class="note mb">숫자 <b>0~8</b> = 겉으로 드러난 여덟 글자에서 센 개수 · 막대와 오른쪽 값 = 지장간(지지 속 숨은 천간)까지 포함하고 월지에 비중을 준 <b>실제 세력</b>입니다.</p>' +
      '<div class="el-chart">' + bars + '</div>' +
      (hiddenNote.length ? '<p class="note">겉으로는 <b style="color:' + elc(hiddenNote[0]) + '">' + hiddenNote.join('·') +
        '</b>이(가) 없어 보이지만 지지 속에 숨어 있습니다 — 완전히 비어 있는 것과는 다릅니다.</p>' : '') +
      '<p class="analysis">' + (a.strong
        ? '<b>신강(身强)</b> — 일간을 돕는 세력이 ' + a.ratio + '%. 힘이 넉넉하니 <b>' + a.yongsin.join('·') + '</b>으로 내보내고 쓸 때 그릇이 커집니다.'
        : '<b>신약(身弱)</b> — 일간을 돕는 세력이 ' + a.ratio + '%. 뿌리가 여리니 <b>' + a.yongsin.join('·') + '</b>을 채울 때 안정됩니다.') +
      ' <span class="dim">(월령 ' + (a.deukryeong ? '득령 — 계절이 나를 돕습니다' : '실령 — 계절이 나를 돕지 않습니다') + ')</span></p>' +
      '<p class="analysis">' + missingTxt + '</p>' +
      '<h3 class="card-h mt">십신 세력</h3>' +
      '<div class="el-chart">' + grpBars + '</div>' +
      '<p class="note">비겁=자립 · 식상=표현 · 재성=재물 · 관성=명예 · 인성=배움. 천간 3자와 지지 정기 4자를 셉니다.</p>' +
      '</div>';
  }

  /* ================= 십신 · 신살 패널 ================= */
  function renderSipsin() {
    var c = STATE.chart, f = STATE.full;
    var tg = SP.tenGodCount(c);

    // 십신 상세 카드
    var order = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
    var present = order.filter(function (g) { return tg.detail[g] > 0; });
    var godCards = present.map(function (g) {
      return '<div class="god-card" style="border-left-color:' + godColor(g) + '">' +
        '<div class="god-head"><b style="color:' + godColor(g) + '">' + g + '</b>' +
        '<span class="hanja-sm">' + SP.TEN_GOD_HANJA[g] + '</span>' +
        '<span class="cnt">×' + tg.detail[g] + '</span></div>' +
        '<p>' + esc(SP.TEN_GOD_MEAN[g]) + '</p></div>';
    }).join('');
    var absent = order.filter(function (g) { return tg.detail[g] === 0; });

    // 십이운성
    var stages = f.pillars.filter(function (p) { return !p.empty; }).map(function (p) {
      return '<div class="stage-row"><span class="sl">' + p.label + '</span>' +
        '<b>' + p.stage + '</b><span class="hanja-sm">' + SP.TWELVE_HANJA[p.stage] + '</span>' +
        '<span class="sd">' + esc(SP.TWELVE_MEAN[p.stage]) + '</span></div>';
    }).join('');

    // 신살
    var seen = {}, sinsalCards = [];
    f.pillars.forEach(function (p) {
      if (p.empty) return;
      p.sinsal.forEach(function (s) {
        if (seen[s.name]) { seen[s.name].where.push(p.label); return; }
        seen[s.name] = { name: s.name, base: s.base, where: [p.label] };
        sinsalCards.push(seen[s.name]);
      });
    });
    var sinsalHtml = sinsalCards.map(function (s) {
      var nm = SP.SB_ALIAS[s.name] || s.name;
      var good = s.name === '천을귀인' || s.name === '문창귀인' || s.name === '반안살' || s.name === '장성살';
      return '<div class="ss-card' + (good ? ' good' : '') + '">' +
        '<div class="ss-head"><b>' + nm + '</b><span class="where">' + s.where.join('·') + '</span></div>' +
        '<p>' + esc(SP.SB_MEAN[s.name] || (s.name === '천을귀인' ? '가장 귀한 구원의 별 — 어려울 때 사람이 나타납니다.'
          : s.name === '문창귀인' ? '글과 시험, 학문의 별 — 배우고 표현하는 일에 유리합니다.'
            : s.name === '양인' ? '날카로운 칼의 자리 — 결단력이 크되 과하면 다칩니다.' : '')) + '</p></div>';
    }).join('');

    // 합충형파해
    var rels = SP.relations(c);
    var combos = rels.filter(function (r) { return r.kind === 'combo'; });
    var clashes = rels.filter(function (r) { return r.kind === 'clash'; });
    function relList(arr, cls) {
      if (!arr.length) return '<p class="note dim">해당 없음</p>';
      return arr.sort(function (a, b) { return b.power - a.power; }).map(function (r) {
        return '<div class="rel-row ' + cls + '"><span class="rel-type">' + r.type + '</span>' +
          '<b>' + esc(r.text) + '</b><span class="rel-note">' + esc(r.note) + '</span></div>';
      }).join('');
    }

    var g = SP.gyeokguk(c);
    $('sipsinBody').innerHTML =
      '<div class="card"><h3 class="card-h">격국 — ' + esc(g.name) + '</h3>' +
      '<p class="analysis">' + esc(SP.GYEOK_MEAN[g.name] || '') + '</p>' +
      '<p class="note">판정 근거: ' + esc(g.basis) + '</p></div>' +

      '<div class="card"><h3 class="card-h">내 명식의 십신</h3>' +
      '<div class="god-grid">' + godCards + '</div>' +
      (absent.length ? '<p class="note">없는 십신: <b>' + absent.join(' · ') + '</b> — 그 영역은 타고나기보다 대운·세운에서 들어올 때 크게 움직입니다.</p>' : '') +
      '</div>' +

      '<div class="card"><h3 class="card-h">십이운성 — 기둥별 기운의 단계</h3>' + stages + '</div>' +

      '<div class="card"><h3 class="card-h">신살</h3>' +
      '<p class="note">기준: 12신살은 년지·일지의 삼합국, 귀인류는 일간에서 뽑습니다. 공망 = <b>' + f.gongmang.join(' · ') + '</b></p>' +
      '<div class="ss-grid">' + (sinsalHtml || '<p class="note dim">해당 없음</p>') + '</div></div>' +

      '<div class="card"><h3 class="card-h">여덟 글자의 관계</h3>' +
      '<h4 class="sub-h combo">합 — 묶이고 화합하는 결</h4>' + relList(combos, 'combo') +
      '<h4 class="sub-h clash">충·형·파·해 — 부딪히고 흔들리는 결</h4>' + relList(clashes, 'clash') +
      '</div>';
  }

  /* ================= 대운 · 세운 ================= */
  // 용신 부합도: 대운 간지의 오행이 내 용신이면 +, 기신이면 − (0~100 정규화)
  function luckScore(stemEl, branchEl) {
    var a = STATE.anal, s = 0;
    [[stemEl, 1], [branchEl, 1.3]].forEach(function (p) {
      if (a.yongsin.indexOf(p[0]) >= 0) s += p[1];
      else if (a.gisin.indexOf(p[0]) >= 0) s -= p[1];
    });
    return Math.round((s + 2.3) / 4.6 * 100);
  }

  function renderDaeun() {
    var c = STATE.chart, du = STATE.daeun;
    var nowY = new Date().getFullYear();
    var cur = SP.currentDaeun(du, c, nowY);

    var rows = du.list.map(function (d) {
      var sc = luckScore(d.stemEl, d.branchEl);
      var isCur = cur.cur && cur.cur.idx === d.idx;
      return '<div class="du-row' + (isCur ? ' cur' : '') + '">' +
        '<div class="du-age">' + d.age + '–' + d.ageEnd + '세<span class="du-year">' + d.year + '~</span></div>' +
        '<div class="du-gz">' +
        '<span class="hz" style="color:' + elc(d.stemEl) + '">' + SP.STEM_HANJA[d.stem] + '</span>' +
        '<span class="hz" style="color:' + elc(d.branchEl) + '">' + SP.BRANCH_HANJA[d.branch] + '</span>' +
        '<span class="kr">' + d.stem + d.branch + '</span></div>' +
        '<div class="du-god"><span style="color:' + godColor(d.stemGod) + '">' + d.stemGod + '</span>' +
        '<span style="color:' + godColor(d.branchGod) + '">' + d.branchGod + '</span>' +
        '<span class="du-stage">' + d.stage + '</span></div>' +
        '<div class="du-bar"><i style="width:' + sc + '%;background:linear-gradient(90deg,' + elc(d.stemEl) + ',' + elc(d.branchEl) + ')"></i></div>' +
        (isCur ? '<div class="du-now">지금</div>' : '') +
        '</div>';
    }).join('');

    var curTxt = cur.cur
      ? '지금은 <b>' + cur.cur.age + '세부터의 ' + cur.cur.stem + cur.cur.branch + '(' + SP.STEM_HANJA[cur.cur.stem] + SP.BRANCH_HANJA[cur.cur.branch] + ') 대운</b> 안에 있습니다. ' +
      '천간 <b style="color:' + godColor(cur.cur.stemGod) + '">' + cur.cur.stemGod + '</b>, 지지 <b style="color:' + godColor(cur.cur.branchGod) + '">' + cur.cur.branchGod + '</b> — ' +
      esc(SP.TEN_GOD_MEAN[cur.cur.stemGod])
      : '아직 첫 대운(' + du.startAgeInt + '세)에 들기 전입니다. 그전까지는 월주의 기운을 그대로 씁니다.';

    var su = SP.seun(c, nowY, 10);
    var seunRows = su.map(function (s) {
      var sc = luckScore(SP.STEM_EL[s.stem], SP.BRANCH_EL[s.branch]);
      return '<div class="se-row' + (s.year === nowY ? ' cur' : '') + '">' +
        '<span class="se-y">' + s.year + '</span>' +
        '<span class="se-gz"><b style="color:' + elc(SP.STEM_EL[s.stem]) + '">' + SP.STEM_HANJA[s.stem] + '</b>' +
        '<b style="color:' + elc(SP.BRANCH_EL[s.branch]) + '">' + SP.BRANCH_HANJA[s.branch] + '</b>' +
        '<i>' + s.stem + s.branch + '</i></span>' +
        '<span class="se-god" style="color:' + godColor(s.stemGod) + '">' + s.stemGod + '</span>' +
        '<span class="se-bar"><i style="width:' + sc + '%"></i></span>' +
        '<span class="se-tag">' + (s.clash ? '<em class="gi">' + s.clash + '</em>' : (s.combo ? '<em class="yong">' + s.combo + '</em>' : '')) + '</span>' +
        '</div>';
    }).join('');

    $('daeunBody').innerHTML =
      '<div class="card"><h3 class="card-h">대운 — 10년 단위의 큰 흐름</h3>' +
      '<p class="analysis">' + curTxt + '</p>' +
      '<p class="note">순역 판정: ' + esc(du.rule) + ' · 대운수 <b>' + du.startAgeInt + '</b> ' +
      '(' + esc(du.boundary) + ' ' + du.days + '일 ÷ 3) → <b>' + du.startAgeInt + '세</b>부터 대운이 바뀝니다.</p>' +
      '<div class="du-list">' + rows + '</div>' +
      '<p class="note">막대는 <b>용신 부합도</b> — 그 대운의 간지 오행이 내 용신(' + STATE.anal.yongsin.join('·') + ')에 얼마나 맞는지를 계산한 값입니다. 길흉 점수가 아니라 <b>내 사주와의 궁합</b>입니다.</p>' +
      '</div>' +

      '<div class="card"><h3 class="card-h">세운 — 앞으로 10년</h3>' +
      '<div class="se-list">' + seunRows + '</div>' +
      '<p class="note">일지충 = 자리가 흔들려 이동·변동이 잦은 해 · 일지합 = 인연과 일이 매듭지어지는 해.</p>' +
      '</div>';
  }

  /* ================= 계산 근거 ================= */
  function renderBasis() {
    var m = STATE.chart.meta, c = STATE.chart;
    var rows = [
      ['입력한 시각', m.clockTime + ' (시계 표기)'],
      ['적용 표준시', m.eraNote],
      ['서머타임', m.dstApplied ? '적용됨 (+60분) — 해당 연도 시행 구간' : '해당 없음'],
      ['경도 보정', (m.lonCorrMin >= 0 ? '+' : '') + m.lonCorrMin + '분 (동경 ' + m.lon + '°)'],
      ['균시차 보정', (m.eotMin >= 0 ? '+' : '') + m.eotMin + '분'],
      ['진태양시', '<b>' + m.trueSolar + '</b> — 시주는 이 시각으로 정합니다'],
      ['자시 기준', m.jaSchool + '설' + (m.dayAdvanced ? ' — 23시 이후라 일주를 다음 날로 넘겼습니다' : '')],
      ['연주 기준 입춘', m.ipchun + ' — 이 순간을 지나야 새 연주'],
      ['월주 기준 절기', m.monthTerm],
      ['다음 절기', m.nextTerm || '–']
    ];
    $('basisBody').innerHTML =
      '<div class="card"><h3 class="card-h">이 명식이 나온 근거</h3>' +
      '<table class="basis">' + rows.map(function (r) {
        return '<tr><th>' + r[0] + '</th><td>' + r[1] + '</td></tr>';
      }).join('') + '</table>' +
      '<p class="note">사주는 1월 1일이 아니라 <b>입춘 순간</b>에 해가 바뀌고, 월주는 <b>12절기 순간</b>에 바뀝니다. ' +
      '이 앱은 절입시각을 날짜가 아니라 태양 황경으로 <b>분 단위</b>까지 계산합니다. ' +
      '절기 경계에 태어난 분의 연주·월주가 다른 사이트와 다르게 나오는 이유가 여기에 있습니다.</p>' +
      '</div>' +
      '<div class="card"><h3 class="card-h">왜 다른 앱과 결과가 다를 수 있나</h3>' +
      '<ul class="why-list">' +
      '<li><b>절기를 날짜로만 처리하는 곳</b>은 경계일 출생자의 월주·연주가 통째로 달라집니다.</li>' +
      '<li><b>경도 보정을 하지 않는 곳</b>은 한국 표준시(동경 135°)를 그대로 써서 시주가 최대 32분 밀립니다.</li>' +
      '<li><b>서머타임을 반영하지 않는 곳</b>은 1948~51 · 1955~60 · 1987~88년 출생자의 시주가 한 칸 밀립니다.</li>' +
      '<li><b>1954.3.21~1961.8.9</b>은 표준자오선이 동경 127.5°였습니다. 이 구간을 모르면 30분이 어긋납니다.</li>' +
      '<li><b>야자시/조자시</b>는 학파가 갈립니다. 정답이 하나가 아니라 <b>어느 설을 썼는지</b>가 중요합니다.</li>' +
      '</ul>' +
      '<p class="note">이 앱은 위 다섯 가지를 모두 적용하고, 무엇을 적용했는지 위 표에 그대로 공개합니다.</p>' +
      '</div>' +
      '<p class="disclaimer">명식 계산은 결정적 알고리즘입니다. 해석 문장은 엔터테인먼트 목적이며 보장된 예측이 아닙니다. ' +
      '입력한 생년월일시는 이 기기 안에서만 계산되며 서버로 전송되지 않습니다.</p>';
    void c;
  }

  /* ================= 궁합 ================= */
  function matchRun() {
    if (!STATE.chart) { toast('먼저 내 명식을 뽑아 주세요'); return; }
    var b = $('pBirth').value; if (!b) { toast('상대 생년월일을 입력해 주세요'); return; }
    var t = $('pTime').value || '12:00';
    var ymd = b.split('-').map(Number), hm = t.split(':').map(Number);
    var lon = parseFloat($('city').value);
    var other = SP.computePro(ymd[0], ymd[1], ymd[2], hm[0], hm[1], { lon: lon, ja: $('jaSchool').value });
    var r = SP.compatibility(STATE.chart, other);
    STATE.match = { other: other, res: r };

    function mini(ch, title) {
      var ks = ['hour', 'day', 'month', 'year'];
      return '<div class="mini-chart"><div class="mini-title">' + title + '</div><div class="mini-gz">' +
        ks.map(function (k) {
          var p = ch[k]; if (!p) return '<span class="mg empty">–</span>';
          return '<span class="mg"><b style="color:' + elc(p.el) + '">' + p.stemHanja + '</b>' +
            '<b style="color:' + elc(p.bel) + '">' + p.branchHanja + '</b></span>';
        }).join('') + '</div>' +
        '<div class="mini-dm">일간 ' + ch.dayMaster + ' · ' + ch.zodiac + '띠</div></div>';
    }

    var items = r.items.map(function (i) {
      return '<div class="mi-row ' + (i.w >= 0 ? 'plus' : 'minus') + '">' +
        '<div class="mi-head"><b>' + esc(i.title) + '</b><span class="mi-w">' + (i.w >= 0 ? '+' : '') + i.w + '</span></div>' +
        '<p>' + esc(i.text) + '</p></div>';
    }).join('');

    $('gunghapBody').innerHTML =
      '<div class="card">' +
      '<div class="match-score"><div class="ms-num">' + r.score + '</div><div class="ms-grade">' + r.grade + '</div></div>' +
      '<div class="mini-row">' + mini(STATE.chart, '나') + '<span class="mini-amp">×</span>' + mini(other, '상대') + '</div>' +
      '<div class="mi-list">' + items + '</div>' +
      '<p class="note">점수는 위 네 항목의 가중 합(기준 50에서 가감)입니다. 항목과 가중치를 그대로 공개하니 근거를 직접 보실 수 있습니다.</p>' +
      '<div class="btn-row"><button onclick="SajuUI.shareCard(\'match\')" class="primary-cta">🖼️ 궁합 카드 저장·공유</button></div>' +
      '</div>';
    // 워커 ALLOWED에 있는 이벤트명만 사용 (미허용 타입은 전량 폐기됨)
    if (window.legionTrack) window.legionTrack('activate', { feature: 'gunghap' });
    $('gunghapBody').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ================= 공유 카드 (이미지 1장) ================= */
  function shareCard(mode) {
    try{var _sr=+(localStorage.getItem('saju_reads')||0)+1;localStorage.setItem('saju_reads',_sr);}catch(e){}
    if (!STATE.chart) { toast('먼저 명식을 뽑아 주세요'); return; }
    var W = 1080, H = 1350;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');

    // 배경
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12100d'); g.addColorStop(1, '#0a0806');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = 'rgba(197,164,110,0.35)'; x.lineWidth = 3;
    x.strokeRect(36, 36, W - 72, H - 72);

    var c = STATE.chart, a = STATE.anal, gy = SP.gyeokguk(c);
    x.textAlign = 'center';

    if (mode === 'match' && STATE.match) {
      var r = STATE.match.res;
      x.fillStyle = '#8b6f47'; x.font = '600 34px system-ui, sans-serif';
      x.fillText('사주 궁합', W / 2, 150);
      x.fillStyle = '#c5a46e'; x.font = '700 200px system-ui, sans-serif';
      x.fillText(String(r.score), W / 2, 380);
      x.fillStyle = '#f5f1e6'; x.font = '600 56px system-ui, sans-serif';
      x.fillText(r.grade, W / 2, 470);
      drawPair(x, c, STATE.match.other, W, 560);
      x.font = '400 30px system-ui, sans-serif';
      var yy = 800;
      r.items.slice(0, 4).forEach(function (i) {
        x.fillStyle = i.w >= 0 ? '#7fc48f' : '#d99b8a';
        x.textAlign = 'left';
        x.fillText((i.w >= 0 ? '+' : '') + i.w, 110, yy);
        x.fillStyle = '#e5dcc9';
        x.fillText(i.title, 200, yy);
        yy += 56;
      });
      // 가장 크게 작용한 항목의 설명을 아래 여백에 풀어 쓴다
      var top = r.items.slice().sort(function (p, q) { return Math.abs(q.w) - Math.abs(p.w); })[0];
      if (top) {
        x.fillStyle = 'rgba(255,255,255,0.05)';
        roundRect(x, 100, yy + 16, W - 200, 170, 14); x.fill();
        x.fillStyle = top.w >= 0 ? '#7fc48f' : '#d99b8a';
        x.font = '600 30px system-ui, sans-serif';
        x.fillText('가장 크게 작용한 결 — ' + top.title, 130, yy + 66);
        x.fillStyle = '#b3a488'; x.font = '400 28px system-ui, sans-serif';
        wrapText(x, top.text, 130, yy + 112, W - 260, 38, 2);
      }
      x.textAlign = 'center';
    } else {
      x.fillStyle = '#8b6f47'; x.font = '600 32px system-ui, sans-serif';
      x.fillText('나의 사주 명식', W / 2, 140);
      x.fillStyle = elc(a.dm); x.font = '700 150px serif';
      x.fillText(SP.STEM_HANJA[c.dayMaster], W / 2, 300);
      x.fillStyle = '#f5f1e6'; x.font = '600 44px system-ui, sans-serif';
      x.fillText(ARCHE[c.dayMaster] || '', W / 2, 372);
      x.fillStyle = '#a38a66'; x.font = '400 30px system-ui, sans-serif';
      x.fillText(gy.name + ' · ' + (a.strong ? '신강' : '신약') + ' · 용신 ' + a.yongsin.join('·'), W / 2, 425);

      drawPillars(x, c, W, 490);

      // 오행 막대
      var els = ['목', '화', '토', '금', '수'];
      var maxp = Math.max.apply(null, els.map(function (e) { return a.power[e]; }));
      var by = 900;
      els.forEach(function (e, i) {
        var bx = 150, bw = 640;
        x.textAlign = 'left';
        x.fillStyle = elc(e); x.font = '600 30px system-ui, sans-serif';
        x.fillText(e + ' ' + a.cnt[e], bx - 60, by + i * 56 + 10);
        x.fillStyle = 'rgba(255,255,255,0.07)';
        roundRect(x, bx + 20, by + i * 56 - 14, bw, 22, 11); x.fill();
        x.fillStyle = elc(e);
        roundRect(x, bx + 20, by + i * 56 - 14, Math.max(12, bw * a.power[e] / maxp), 22, 11); x.fill();
      });
      x.textAlign = 'center';
      var sin = STATE.full.sinsalAll.filter(function (s) {
        return ['도화살', '연살', '역마살', '화개살', '천을귀인', '문창귀인', '양인'].indexOf(s) >= 0;
      }).map(function (s) { return SP.SB_ALIAS[s] || s; });
      if (sin.length) {
        x.fillStyle = '#c5a46e'; x.font = '500 30px system-ui, sans-serif';
        x.fillText(sin.slice(0, 4).join('  ·  '), W / 2, 1215);
      }
    }

    x.fillStyle = '#6b5a42'; x.font = '400 24px system-ui, sans-serif';
    x.fillText('엔터테인먼트용 풀이 · 정통 만세력 계산', W / 2, H - 96);
    x.fillStyle = '#8b6f47'; x.font = '600 26px system-ui, sans-serif';
    x.fillText('사주 명리 미니앱', W / 2, H - 58);

    exportCanvas(cv, mode === 'match' ? '사주궁합' : '사주명식');
    if (window.legionTrack) window.legionTrack('share', { kind: mode === 'match' ? 'gunghap_card' : 'myeongsik_card' });
  }

  function drawPillars(x, c, W, top) {
    var ks = ['hour', 'day', 'month', 'year'], labs = ['시', '일', '월', '년'];
    var bw = 200, gap = 16, totalW = bw * 4 + gap * 3, sx = (W - totalW) / 2;
    ks.forEach(function (k, i) {
      var p = c[k], px = sx + i * (bw + gap);
      x.fillStyle = 'rgba(255,255,255,0.04)';
      roundRect(x, px, top, bw, 300, 16); x.fill();
      x.strokeStyle = 'rgba(197,164,110,0.25)'; x.lineWidth = 2;
      roundRect(x, px, top, bw, 300, 16); x.stroke();
      x.fillStyle = '#8b6f47'; x.font = '500 26px system-ui, sans-serif';
      x.fillText(labs[i], px + bw / 2, top + 44);
      if (!p) { x.fillStyle = '#4a3f30'; x.font = '700 90px serif'; x.fillText('–', px + bw / 2, top + 170); return; }
      x.fillStyle = elc(p.el); x.font = '700 92px serif';
      x.fillText(p.stemHanja, px + bw / 2, top + 150);
      x.fillStyle = elc(p.bel); x.font = '700 92px serif';
      x.fillText(p.branchHanja, px + bw / 2, top + 250);
      x.fillStyle = '#8b6f47'; x.font = '400 24px system-ui, sans-serif';
      x.fillText(p.stem + p.branch, px + bw / 2, top + 288);
    });
  }

  function drawPair(x, a, b, W, top) {
    [[a, '나', top], [b, '상대', top + 130]].forEach(function (row) {
      var ch = row[0];
      x.textAlign = 'left';
      x.fillStyle = '#8b6f47'; x.font = '500 30px system-ui, sans-serif';
      x.fillText(row[1], 110, row[2] + 60);
      var ks = ['hour', 'day', 'month', 'year'];
      ks.forEach(function (k, i) {
        var p = ch[k]; var px = 250 + i * 190;
        if (!p) { x.fillStyle = '#4a3f30'; x.font = '700 60px serif'; x.fillText('–', px, row[2] + 62); return; }
        x.fillStyle = elc(p.el); x.font = '700 58px serif';
        x.fillText(p.stemHanja, px, row[2] + 62);
        x.fillStyle = elc(p.bel); x.font = '700 58px serif';
        x.fillText(p.branchHanja, px + 62, row[2] + 62);
      });
    });
    x.textAlign = 'center';
  }

  // 캔버스 줄바꿈 (한국어는 글자 단위로 끊는다)
  function wrapText(x, text, tx, ty, maxW, lh, maxLines) {
    var line = '', lines = [];
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (x.measureText(test).width > maxW && line) { lines.push(line); line = text[i]; }
      else line = test;
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    lines.forEach(function (l, i) { x.fillText(l, tx, ty + i * lh); });
    return lines.length;
  }

  function roundRect(x, rx, ry, w, h, r) {
    x.beginPath();
    x.moveTo(rx + r, ry); x.lineTo(rx + w - r, ry); x.quadraticCurveTo(rx + w, ry, rx + w, ry + r);
    x.lineTo(rx + w, ry + h - r); x.quadraticCurveTo(rx + w, ry + h, rx + w - r, ry + h);
    x.lineTo(rx + r, ry + h); x.quadraticCurveTo(rx, ry + h, rx, ry + h - r);
    x.lineTo(rx, ry + r); x.quadraticCurveTo(rx, ry, rx + r, ry); x.closePath();
  }

  function exportCanvas(cv, name) {
    cv.toBlob(function (blob) {
      if (!blob) { toast('이미지를 만들지 못했습니다'); return; }
      var file = null;
      try { file = new File([blob], name + '.png', { type: 'image/png' }); } catch (e) { file = null; }
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch(function () { });
        return;
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = name + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      toast('카드를 저장했습니다');
    }, 'image/png');
  }

  function toast(msg) {
    var t = $('toast'); if (!t) { return; }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ================= 부팅 ================= */
  function boot() {
    initCities(); initTabs();
    var tu = $('timeUnknown');
    if (tu) tu.onchange = function () { $('time').disabled = tu.checked; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  function editInput() {
    $('input').classList.remove('done');
    $('input').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderRecent() {
    var box = document.getElementById('sajuRecent');
    if (!box) {
      var host = document.getElementById('input') || document.getElementById('birth') && document.getElementById('birth').parentNode;
      if (!host) return;
      box = document.createElement('div');
      box.id = 'sajuRecent';
      box.style.cssText = 'margin:10px 0;display:flex;flex-wrap:wrap;gap:6px';
      if (host.parentNode) host.parentNode.insertBefore(box, host.nextSibling);
      else host.appendChild(box);
    }
    try {
      var rec = JSON.parse(localStorage.getItem('saju_recent') || '[]');
      var st = JSON.parse(localStorage.getItem('saju_streak') || '{}');
      var reads = localStorage.getItem('saju_reads') || '0';
      if (!rec.length) {
        box.innerHTML = '<span style="font-size:12px;opacity:.6">최근 없음 · 첫 명식으로 루프 시작 · 조회 '+reads+'</span>';
        return;
      }
      box.innerHTML = '<span style="font-size:12px;width:100%;opacity:.75">🔥 '+(st.count||0)+'일 · 조회 '+reads+' · 최근 탭</span>' +
        rec.map(function (r, i) {
          return '<button type="button" data-ri="'+i+'" style="padding:6px 10px;border-radius:999px;border:1px solid #c5a46e55;background:#16121c;color:#ece8f1;font-size:12px;cursor:pointer">' +
            r.birth + (r.gender==='f'?' ·여':' ·남') + '</button>';
        }).join('');
      Array.prototype.forEach.call(box.querySelectorAll('[data-ri]'), function (btn) {
        btn.onclick = function () {
          var r = rec[+btn.getAttribute('data-ri')];
          if (!r) return;
          var b = document.getElementById('birth'); if (b) b.value = r.birth;
          var tm = document.getElementById('time'); if (tm && r.time) tm.value = r.time;
          var tu = document.getElementById('timeUnknown'); if (tu) tu.checked = !!r.timeUnknown;
          var g = document.getElementById('gender'); if (g) g.value = r.gender || 'm';
          var j = document.getElementById('jaSchool'); if (j && r.ja) j.value = r.ja;
          generate();
          try { if (window.legionTrack) legionTrack('recent_rerun', {}); } catch (e) {}
        };
      });
    } catch (e) {}
  }

  // boot recent after DOM
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderRecent);
  else setTimeout(renderRecent, 0);
  // re-render after generate
  var _gen = generate;
  generate = function () { _gen(); setTimeout(renderRecent, 50); };

  window.SajuUI = { generate: generate, matchRun: matchRun, shareCard: shareCard, editInput: editInput, toast: toast, state: STATE, renderRecent: renderRecent };
  window.generateSaju = generate;   // 기존 진입점 호환
})();
