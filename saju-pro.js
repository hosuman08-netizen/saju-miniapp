/* =====================================================================
 * saju-pro.js — 전문 명리(命理) 계산 엔진
 * ---------------------------------------------------------------------
 * 전부 결정적(deterministic) 계산. 랜덤·가짜 수치 0.
 *
 *  1) 절입시각(節入時刻)  : VSOP87 절단급수로 태양 겉보기황경을 구해
 *                          황경 315°(입춘) 등에 도달하는 "분 단위" 순간을 역산.
 *                          → 연주(입춘)·월주(12절) 경계를 날짜가 아닌 시각으로 판정.
 *  2) 출생시각 보정        : 한국 표준시 역사(1908/1912/1954/1961) + 서머타임 구간
 *                          + 경도(진태양시) + 균시차(Equation of Time).
 *  3) 자시(子時) 학파      : 조자시(정자시)설 / 야자시설 선택.
 *  4) 파생 명식 항목       : 십신(十神), 십이운성(十二運星), 지장간(支藏干),
 *                          공망(空亡), 12신살 + 천을귀인 + 양인, 합충형파해원진.
 *  5) 시간축              : 대운(순역 판정 + 대운수 + 10주기), 세운(10년).
 *  6) 궁합                : 2인 대조(일간합·일지관계·용신 상보성).
 * ===================================================================== */
(function (root) {
  'use strict';

  var STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  var STEM_HANJA = { 갑: '甲', 을: '乙', 병: '丙', 정: '丁', 무: '戊', 기: '己', 경: '庚', 신: '辛', 임: '壬', 계: '癸' };
  var BRANCH_HANJA = { 자: '子', 축: '丑', 인: '寅', 묘: '卯', 진: '辰', 사: '巳', 오: '午', 미: '未', 신: '申', 유: '酉', 술: '戌', 해: '亥' };
  var STEM_EL = { 갑: '목', 을: '목', 병: '화', 정: '화', 무: '토', 기: '토', 경: '금', 신: '금', 임: '수', 계: '수' };
  var BRANCH_EL = { 자: '수', 축: '토', 인: '목', 묘: '목', 진: '토', 사: '화', 오: '화', 미: '토', 신: '금', 유: '금', 술: '토', 해: '수' };
  var STEM_YY = { 갑: 1, 을: 0, 병: 1, 정: 0, 무: 1, 기: 0, 경: 1, 신: 0, 임: 1, 계: 0 }; // 1=양 0=음
  var BRANCH_YY = { 자: 1, 축: 0, 인: 1, 묘: 0, 진: 1, 사: 0, 오: 1, 미: 0, 신: 1, 유: 0, 술: 1, 해: 0 };
  var ZODIAC = { 자: '쥐', 축: '소', 인: '호랑이', 묘: '토끼', 진: '용', 사: '뱀', 오: '말', 미: '양', 신: '원숭이', 유: '닭', 술: '개', 해: '돼지' };
  var GEN = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
  var GEN_BY = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
  var OVERCOME = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
  var OVERCOME_BY = { 목: '금', 화: '수', 토: '목', 금: '화', 수: '토' };
  var EL_COLOR = { 목: '#5aa469', 화: '#c9524a', 토: '#c9a24a', 금: '#d8d2c4', 수: '#4a72c9' };

  /* ===================================================================
   * [1] 천문 — 태양 겉보기황경 (VSOP87 절단, Meeus Astronomical Algorithms)
   * =================================================================== */
  var D2R = Math.PI / 180;

  // Earth heliocentric longitude 급수 (Meeus Table 32.A 절단) — [A, B, C]
  var L0 = [
    [175347046, 0, 0], [3341656, 4.6692568, 6283.07585], [34894, 4.6261, 12566.1517],
    [3497, 2.7441, 5753.3849], [3418, 2.8289, 3.5231], [3136, 3.6277, 77713.7715],
    [2676, 4.4181, 7860.4194], [2343, 6.1352, 3930.2097], [1324, 0.7425, 11506.7698],
    [1273, 2.0371, 529.691], [1199, 1.1096, 1577.3435], [990, 5.233, 5884.927],
    [902, 2.045, 26.298], [857, 3.508, 398.149], [780, 1.179, 5223.694],
    [753, 2.533, 5507.553], [505, 4.583, 18849.228], [492, 4.205, 775.523],
    [357, 2.92, 0.067], [317, 5.849, 11790.629], [284, 1.899, 796.298],
    [271, 0.315, 10977.079], [243, 0.345, 5486.778], [206, 4.806, 2544.314],
    [205, 1.869, 5573.143], [202, 2.458, 6069.777], [156, 0.833, 213.299],
    [132, 3.411, 2942.463], [126, 1.083, 20.775], [115, 0.645, 0.98],
    [103, 0.636, 4694.003], [102, 0.976, 15720.839], [102, 4.267, 7.114],
    [99, 6.21, 2146.17], [98, 0.68, 155.42], [86, 5.98, 161000.69],
    [85, 1.3, 6275.96], [85, 3.67, 71430.7], [80, 1.81, 17260.15],
    [79, 3.04, 12036.46], [75, 1.76, 5088.63], [74, 3.5, 3154.69],
    [74, 4.68, 801.82], [70, 0.83, 9437.76], [62, 3.98, 8827.39],
    [61, 1.82, 7084.9], [57, 2.78, 6286.6], [56, 4.39, 14143.5],
    [56, 3.47, 6279.55], [52, 0.19, 12139.55], [52, 1.33, 1748.02],
    [51, 0.28, 5856.48], [49, 0.49, 1194.45], [41, 5.37, 8429.24],
    [41, 2.4, 19651.05], [39, 6.17, 10447.39], [37, 6.04, 10213.29],
    [37, 2.57, 1059.38], [36, 1.71, 2352.87], [36, 1.78, 6812.77],
    [33, 0.59, 17789.85], [30, 0.44, 83996.85], [30, 2.74, 1349.87],
    [25, 3.16, 4690.48]
  ];
  var L1 = [
    [628331966747, 0, 0], [206059, 2.678235, 6283.07585], [4303, 2.6351, 12566.1517],
    [425, 1.59, 3.523], [119, 5.796, 26.298], [109, 2.966, 1577.344],
    [93, 2.59, 18849.23], [72, 1.14, 529.69], [68, 1.87, 398.15],
    [67, 4.41, 5507.55], [59, 2.89, 5223.69], [56, 2.17, 155.42],
    [45, 0.4, 796.3], [36, 0.47, 775.52], [29, 2.65, 7.11],
    [21, 5.34, 0.98], [19, 1.85, 5486.78], [19, 4.97, 213.3],
    [17, 2.99, 6275.96], [16, 0.03, 2544.31], [16, 1.43, 2146.17],
    [15, 1.21, 10977.08], [12, 2.83, 1748.02], [12, 3.26, 5088.63],
    [12, 5.27, 1194.45], [12, 2.08, 4694.0], [11, 0.77, 553.57],
    [10, 1.3, 6286.6], [10, 4.24, 1349.87], [9, 2.7, 242.73],
    [9, 5.64, 951.72], [8, 5.3, 2352.87], [6, 2.65, 9437.76], [6, 4.67, 4690.48]
  ];
  var L2 = [
    [52919, 0, 0], [8720, 1.0721, 6283.0758], [309, 0.867, 12566.152],
    [27, 0.05, 3.52], [16, 5.19, 26.3], [16, 3.68, 155.42], [10, 0.76, 18849.23],
    [9, 2.06, 77713.77], [7, 0.83, 775.52], [5, 4.66, 1577.34], [4, 1.03, 7.11],
    [4, 3.44, 5573.14], [3, 5.14, 796.3], [3, 6.05, 5507.55], [3, 1.19, 242.73],
    [3, 6.12, 529.69], [3, 0.31, 398.15], [3, 2.28, 553.57], [2, 4.38, 5223.69],
    [2, 3.75, 0.98]
  ];
  var L3 = [[289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15], [3, 5.2, 155.42],
    [1, 4.72, 3.52], [1, 5.3, 18849.23], [1, 5.97, 242.73]];
  var L4 = [[114, 3.142, 0], [8, 4.13, 6283.08], [1, 3.84, 12566.15]];
  var L5 = [[1, 3.14, 0]];

  function sumSeries(terms, tau) {
    var s = 0;
    for (var i = 0; i < terms.length; i++) s += terms[i][0] * Math.cos(terms[i][1] + terms[i][2] * tau);
    return s;
  }

  // 태양 겉보기황경 (도). jde = Julian Ephemeris Day (TT 기준)
  function sunApparentLongitude(jde) {
    var tau = (jde - 2451545.0) / 365250.0;
    var l = (sumSeries(L0, tau) + sumSeries(L1, tau) * tau + sumSeries(L2, tau) * tau * tau
      + sumSeries(L3, tau) * Math.pow(tau, 3) + sumSeries(L4, tau) * Math.pow(tau, 4)
      + sumSeries(L5, tau) * Math.pow(tau, 5)) / 1e8;   // 라디안
    var Ldeg = norm360(l / D2R + 180);                   // 지구황경 → 태양황경
    var T = (jde - 2451545.0) / 36525.0;
    // FK5 보정
    var lambdaP = Ldeg - 1.397 * T - 0.00031 * T * T;
    Ldeg += -0.09033 / 3600;
    // 장동(章動) 황경 + 광행차
    var om = norm360(125.04452 - 1934.136261 * T);
    var dPsi = (-17.20 * Math.sin(om * D2R) - 1.32 * Math.sin(2 * (280.4665 + 36000.7698 * T) * D2R)
      - 0.23 * Math.sin(2 * (218.3165 + 481267.8813 * T) * D2R) + 0.21 * Math.sin(2 * om * D2R)) / 3600;
    var R = earthRadiusVector(tau);
    var aberr = -20.4898 / 3600 / R;
    void lambdaP;
    return norm360(Ldeg + dPsi + aberr);
  }

  var R0 = [[100013989, 0, 0], [1670700, 3.0984635, 6283.07585], [13956, 3.05525, 12566.1517],
    [3084, 5.1985, 77713.7715], [1628, 1.1739, 5753.3849], [1576, 2.8469, 7860.4194],
    [925, 5.453, 11506.77], [542, 4.564, 3930.21], [472, 3.661, 5884.927],
    [346, 0.964, 5507.553], [329, 5.9, 5223.694], [307, 0.299, 5573.143],
    [243, 4.273, 11790.629], [212, 5.847, 1577.344], [186, 5.022, 10977.079],
    [175, 3.012, 18849.228], [110, 5.055, 5486.778], [98, 0.89, 6069.78],
    [86, 5.69, 15720.84], [86, 1.27, 161000.69], [65, 0.27, 17260.15],
    [63, 0.92, 529.69], [57, 2.01, 83996.85], [56, 5.24, 71430.7],
    [49, 3.25, 2544.31], [47, 2.58, 775.52], [45, 5.54, 9437.76],
    [43, 6.01, 6275.96], [39, 5.36, 4694.0], [38, 2.39, 8827.39],
    [37, 0.83, 19651.05], [37, 4.9, 12139.55], [36, 1.67, 12036.46]];
  var R1 = [[103019, 1.10749, 6283.07585], [1721, 1.0644, 12566.1517], [702, 3.142, 0],
    [32, 1.02, 18849.23], [31, 2.84, 5507.55], [25, 1.32, 5223.69],
    [18, 1.42, 1577.34], [10, 5.91, 10977.08], [9, 1.42, 6275.96], [9, 0.27, 5486.78]];
  var R2 = [[4359, 5.7846, 6283.0758], [124, 5.579, 12566.152], [12, 3.14, 0],
    [9, 3.63, 77713.77], [6, 1.87, 5573.14], [3, 5.47, 18849.23]];
  function earthRadiusVector(tau) {
    return (sumSeries(R0, tau) + sumSeries(R1, tau) * tau + sumSeries(R2, tau) * tau * tau) / 1e8;
  }

  function norm360(x) { x = x % 360; return x < 0 ? x + 360 : x; }

  // ΔT (TT - UT) 초. Espenak & Meeus 다항근사.
  function deltaTsec(year) {
    var t, u;
    if (year < 1900) { t = (year - 1860) / 100; return 7.62 + 57.37 * t - 2.6291 * t * t; }
    if (year < 1920) { t = year - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * Math.pow(t, 4); }
    if (year < 1941) { t = year - 1920; return 21.20 + 0.84493 * t - 0.076100 * t * t + 0.0020936 * t * t * t; }
    if (year < 1961) { t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547; }
    if (year < 1986) { t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718; }
    if (year < 2005) { t = year - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
    if (year < 2050) { t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    u = (year - 1820) / 100; return -20 + 32 * u * u - 0.5628 * (2150 - year);
  }

  // 그레고리력(UTC) → JD
  function jdFromUTC(y, m, d, h, mi, s) {
    h = h || 0; mi = mi || 0; s = s || 0;
    var Y = y, M = m;
    if (M <= 2) { Y -= 1; M += 12; }
    var A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
    var day = d + (h + mi / 60 + s / 3600) / 24;
    return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + day + B - 1524.5;
  }

  // JD → {y,m,d,h,mi,s}
  function utcFromJD(jd) {
    var z = Math.floor(jd + 0.5), f = jd + 0.5 - z, A = z;
    if (z >= 2299161) { var al = Math.floor((z - 1867216.25) / 36524.25); A = z + 1 + al - Math.floor(al / 4); }
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C),
      E = Math.floor((B - D) / 30.6001);
    var dd = B - D - Math.floor(30.6001 * E) + f;
    var mm = E < 14 ? E - 1 : E - 13;
    var yy = mm > 2 ? C - 4716 : C - 4715;
    var day = Math.floor(dd), frac = (dd - day) * 24;
    var h = Math.floor(frac); frac = (frac - h) * 60;
    var mi = Math.floor(frac); var s = Math.round((frac - mi) * 60);
    if (s >= 60) { s -= 60; mi++; } if (mi >= 60) { mi -= 60; h++; }
    return { y: yy, m: mm, d: day, h: h, mi: mi, s: s };
  }

  /* --- 24절기 --- */
  var TERM_NAMES = ['소한', '대한', '입춘', '우수', '경칩', '춘분', '청명', '곡우', '입하', '소만',
    '망종', '하지', '소서', '대서', '입추', '처서', '백로', '추분', '한로', '상강',
    '입동', '소설', '대설', '동지'];
  var TERM_LON = [285, 300, 315, 330, 345, 0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150,
    165, 180, 195, 210, 225, 240, 255, 270];
  var TERM_APPROX = [[1, 6], [1, 20], [2, 4], [2, 19], [3, 6], [3, 21], [4, 5], [4, 20],
    [5, 6], [5, 21], [6, 6], [6, 21], [7, 7], [7, 23], [8, 8], [8, 23],
    [9, 8], [9, 23], [10, 8], [10, 23], [11, 7], [11, 22], [12, 7], [12, 22]];
  // 節(월 경계) 인덱스 — 짝수번째(소한·입춘·경칩…)
  var JEOL_IDX = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

  var _termCache = {};
  // year의 index번째 절기 순간 JD(UT). 분 단위 정밀.
  function termJD(year, idx) {
    var key = year + ':' + idx;
    if (_termCache[key] !== undefined) return _termCache[key];
    var ap = TERM_APPROX[idx];
    var jde = jdFromUTC(year, ap[0], ap[1], 0, 0, 0) + deltaTsec(year) / 86400;
    var target = TERM_LON[idx];
    for (var i = 0; i < 8; i++) {
      var diff = sunApparentLongitude(jde) - target;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      var corr = diff / 0.9856473;
      jde -= corr;
      if (Math.abs(corr) < 1e-7) break;   // < 0.01초
    }
    var jdut = jde - deltaTsec(year) / 86400;
    _termCache[key] = jdut;
    return jdut;
  }

  // 절기 이름 → 인덱스
  function termIndexByName(name) { return TERM_NAMES.indexOf(name); }

  // 어떤 순간(JD UT)이 속한 "월지" 와 그 절기 정보
  function monthTermOf(jd) {
    // 직전 節을 찾는다 (연도 전후 탐색)
    var y = utcFromJD(jd).y;
    var cand = [];
    for (var yy = y - 1; yy <= y + 1; yy++) {
      for (var k = 0; k < JEOL_IDX.length; k++) {
        var idx = JEOL_IDX[k];
        cand.push({ y: yy, idx: idx, jd: termJD(yy, idx), name: TERM_NAMES[idx], lon: TERM_LON[idx] });
      }
    }
    cand.sort(function (a, b) { return a.jd - b.jd; });
    var prev = null, next = null;
    for (var i = 0; i < cand.length; i++) {
      if (cand[i].jd <= jd) prev = cand[i];
      else { next = cand[i]; break; }
    }
    var bIdx = (Math.round(norm360(prev.lon - 315) / 30) + 2) % 12;
    return { prev: prev, next: next, branchIdx: bIdx };
  }

  // 균시차 (분). jd = UT
  function equationOfTime(jd) {
    var jde = jd + deltaTsec(utcFromJD(jd).y) / 86400;
    var T = (jde - 2451545.0) / 36525.0;
    var tau = (jde - 2451545.0) / 365250.0;
    var L0m = norm360(280.4664567 + 360007.6982779 * tau + 0.03032028 * tau * tau
      + tau * tau * tau / 49931 - tau * tau * tau * tau / 15300 - Math.pow(tau, 5) / 2000000);
    var lam = sunApparentLongitude(jde);
    var om = norm360(125.04452 - 1934.136261 * T);
    var dPsi = (-17.20 * Math.sin(om * D2R) - 1.32 * Math.sin(2 * (280.4665 + 36000.7698 * T) * D2R)
      - 0.23 * Math.sin(2 * (218.3165 + 481267.8813 * T) * D2R) + 0.21 * Math.sin(2 * om * D2R)) / 3600;
    var eps0 = 23 + 26 / 60 + 21.448 / 3600 - (46.8150 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
    var dEps = (9.20 * Math.cos(om * D2R) + 0.57 * Math.cos(2 * (280.4665 + 36000.7698 * T) * D2R)
      + 0.10 * Math.cos(2 * (218.3165 + 481267.8813 * T) * D2R) - 0.09 * Math.cos(2 * om * D2R)) / 3600;
    var eps = eps0 + dEps;
    var alpha = norm360(Math.atan2(Math.cos(eps * D2R) * Math.sin(lam * D2R), Math.cos(lam * D2R)) / D2R);
    var E = L0m - 0.0057183 - alpha + dPsi * Math.cos(eps * D2R);
    while (E > 180) E -= 360; while (E < -180) E += 360;
    return E * 4; // 분
  }

  /* ===================================================================
   * [2] 한국 표준시 역사 + 서머타임
   * =================================================================== */
  // 표준자오선 구간 [시작(포함), 끝(미포함), UTC오프셋(분), 설명]
  var KST_ERAS = [
    [[1908, 4, 1], [1912, 1, 1], 510, '동경 127.5° (UTC+8:30)'],
    [[1912, 1, 1], [1954, 3, 21], 540, '동경 135° (UTC+9:00)'],
    [[1954, 3, 21], [1961, 8, 10], 510, '동경 127.5° (UTC+8:30) — 대통령령 876호'],
    [[1961, 8, 10], [3000, 1, 1], 540, '동경 135° (UTC+9:00)']
  ];
  // 서머타임 구간 [시작 y,m,d,h] [끝 y,m,d,h] — 당시 표준시각 표기
  var DST_RANGES = [
    [[1948, 6, 1, 0], [1948, 9, 13, 0]], [[1949, 4, 3, 0], [1949, 9, 11, 0]],
    [[1950, 4, 1, 0], [1950, 9, 10, 0]], [[1951, 5, 6, 0], [1951, 9, 9, 0]],
    [[1955, 5, 5, 0], [1955, 9, 9, 0]], [[1956, 5, 20, 0], [1956, 9, 30, 0]],
    [[1957, 5, 5, 0], [1957, 9, 22, 0]], [[1958, 5, 4, 0], [1958, 9, 21, 0]],
    [[1959, 5, 3, 0], [1959, 9, 20, 0]], [[1960, 5, 1, 0], [1960, 9, 18, 0]],
    [[1987, 5, 10, 2], [1987, 10, 11, 3]], [[1988, 5, 8, 2], [1988, 10, 9, 3]]
  ];
  function ymdKey(y, m, d, h) { return ((y * 100 + m) * 100 + d) * 100 + (h || 0); }

  function standardOffsetMin(y, m, d) {
    var k = ymdKey(y, m, d, 0);
    for (var i = 0; i < KST_ERAS.length; i++) {
      var e = KST_ERAS[i];
      if (k >= ymdKey(e[0][0], e[0][1], e[0][2], 0) && k < ymdKey(e[1][0], e[1][1], e[1][2], 0))
        return { min: e[2], note: e[3] };
    }
    return { min: 540, note: '동경 135° (UTC+9:00)' };
  }
  function dstMin(y, m, d, h) {
    var k = ymdKey(y, m, d, h);
    for (var i = 0; i < DST_RANGES.length; i++) {
      var r = DST_RANGES[i];
      if (k >= ymdKey(r[0][0], r[0][1], r[0][2], r[0][3]) && k < ymdKey(r[1][0], r[1][1], r[1][2], r[1][3]))
        return 60;
    }
    return 0;
  }

  var CITIES = [
    { name: '서울', lon: 126.978 }, { name: '인천', lon: 126.705 }, { name: '수원', lon: 127.029 },
    { name: '춘천', lon: 127.734 }, { name: '강릉', lon: 128.896 }, { name: '대전', lon: 127.385 },
    { name: '청주', lon: 127.489 }, { name: '전주', lon: 127.148 }, { name: '광주', lon: 126.852 },
    { name: '목포', lon: 126.392 }, { name: '대구', lon: 128.601 }, { name: '포항', lon: 129.365 },
    { name: '부산', lon: 129.075 }, { name: '울산', lon: 129.311 }, { name: '제주', lon: 126.531 },
    { name: '평양', lon: 125.754 }, { name: '도쿄', lon: 139.692 }, { name: '베이징', lon: 116.407 },
    { name: '뉴욕', lon: -74.006 }, { name: 'LA', lon: -118.243 }
  ];

  /* ===================================================================
   * [3] 명식 계산
   * =================================================================== */
  var HIDDEN = { // 지장간: [여기, 중기, 정기] (없으면 null) + 일수
    자: [['임', 10], null, ['계', 20]],
    축: [['계', 9], ['신', 3], ['기', 18]],
    인: [['무', 7], ['병', 7], ['갑', 16]],
    묘: [['갑', 10], null, ['을', 20]],
    진: [['을', 9], ['계', 3], ['무', 18]],
    사: [['무', 7], ['경', 7], ['병', 16]],
    오: [['병', 10], ['기', 9], ['정', 11]],
    미: [['정', 9], ['을', 3], ['기', 18]],
    신: [['무', 7], ['임', 7], ['경', 16]],
    유: [['경', 10], null, ['신', 20]],
    술: [['신', 9], ['정', 3], ['무', 18]],
    해: [['무', 7], ['갑', 7], ['임', 16]]
  };

  // 십신: 일간 기준 대상 천간의 관계
  function tenGod(dayStem, target) {
    var de = STEM_EL[dayStem], te = STEM_EL[target];
    var same = STEM_YY[dayStem] === STEM_YY[target];
    if (te === de) return same ? '비견' : '겁재';
    if (GEN[de] === te) return same ? '식신' : '상관';
    if (OVERCOME[de] === te) return same ? '편재' : '정재';
    if (OVERCOME_BY[de] === te) return same ? '편관' : '정관';
    return same ? '편인' : '정인';
  }
  var TEN_GOD_GROUP = {
    비견: '비겁', 겁재: '비겁', 식신: '식상', 상관: '식상',
    편재: '재성', 정재: '재성', 편관: '관성', 정관: '관성', 편인: '인성', 정인: '인성'
  };
  var TEN_GOD_HANJA = {
    비견: '比肩', 겁재: '劫財', 식신: '食神', 상관: '傷官', 편재: '偏財',
    정재: '正財', 편관: '偏官', 정관: '正官', 편인: '偏印', 정인: '正印'
  };
  var TEN_GOD_MEAN = {
    비견: '자립·동료·경쟁. 내 힘으로 서는 기운.',
    겁재: '추진·과감·경쟁. 크게 벌이고 크게 쓰는 기운.',
    식신: '표현·먹을복·여유. 꾸준히 만들어 내는 기운.',
    상관: '재능·비판·돌파. 틀을 깨고 드러내는 기운.',
    편재: '큰 재물·유통·사업 감각. 흐르는 돈의 기운.',
    정재: '성실한 재물·관리. 쌓이는 돈의 기운.',
    편관: '압박·의리·위기돌파. 나를 단련시키는 힘.',
    정관: '규율·명예·직책. 인정받는 자리의 기운.',
    편인: '직관·전문·비주류 학문. 깊이 파는 기운.',
    정인: '배움·문서·귀인. 나를 돌보고 채우는 기운.'
  };

  // 십이운성: 일간의 12단계
  var TWELVE = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
  var TWELVE_HANJA = { 장생: '長生', 목욕: '沐浴', 관대: '冠帶', 건록: '建祿', 제왕: '帝旺', 쇠: '衰', 병: '病', 사: '死', 묘: '墓', 절: '絶', 태: '胎', 양: '養' };
  var TWELVE_MEAN = {
    장생: '새로 태어나 뻗는 시작의 자리', 목욕: '다듬어지며 흔들리는 자리',
    관대: '갓 갖춰 입고 나서는 자리', 건록: '제 몫을 온전히 하는 자리',
    제왕: '기운이 정점에 오른 자리', 쇠: '정점을 지나 물러서는 자리',
    병: '힘이 빠지고 돌봄이 필요한 자리', 사: '움직임이 멎고 안으로 드는 자리',
    묘: '갈무리하고 저장하는 자리', 절: '끊기고 비워지는 자리',
    태: '보이지 않게 잉태되는 자리', 양: '조용히 길러지는 자리'
  };
  var JANGSAENG = { 갑: '해', 을: '오', 병: '인', 정: '유', 무: '인', 기: '유', 경: '사', 신: '자', 임: '신', 계: '묘' };
  function twelveStage(dayStem, branch) {
    var start = BRANCHES.indexOf(JANGSAENG[dayStem]);
    var bi = BRANCHES.indexOf(branch);
    var fwd = STEM_YY[dayStem] === 1;
    var step = fwd ? (bi - start + 12) % 12 : (start - bi + 12) % 12;
    return TWELVE[step];
  }

  // 공망
  function gongmang(dayStemIdx, dayBranchIdx) {
    var i60 = sexagenaryIndex(dayStemIdx, dayBranchIdx);
    var head = i60 - (i60 % 10);
    var hb = head % 12;
    return [BRANCHES[(hb + 10) % 12], BRANCHES[(hb + 11) % 12]];
  }
  function sexagenaryIndex(s, b) {
    for (var i = 0; i < 60; i++) if (i % 10 === s && i % 12 === b) return i;
    return 0;
  }

  // 12신살
  var SB_NAMES = ['겁살', '재살', '천살', '지살', '연살', '월살', '망신살', '장성살', '반안살', '역마살', '육해살', '화개살'];
  var SB_ALIAS = { 연살: '도화살', 장성살: '장성살' };
  var SB_MEAN = {
    겁살: '빼앗기고 흔들리는 자리 — 방심 금물', 재살: '갇히고 겨루는 자리 — 구설 주의',
    천살: '내 뜻 밖의 큰 힘이 작용하는 자리', 지살: '움직이고 자리를 옮기는 자리',
    연살: '매력·인기·끌림의 자리 (도화)', 월살: '메마르고 정체되는 자리',
    망신살: '드러나고 밑천이 보이는 자리', 장성살: '주도하고 지휘하는 자리',
    반안살: '안장에 오르는 자리 — 승진·후원', 역마살: '이동·여행·해외·변동의 자리',
    육해살: '지치고 발목 잡히는 자리', 화개살: '예술·종교·고독·재능의 자리'
  };
  var TRINE = { // 삼합국 → 생지
    수: { members: ['신', '자', '진'], birth: '신' },
    목: { members: ['해', '묘', '미'], birth: '해' },
    화: { members: ['인', '오', '술'], birth: '인' },
    금: { members: ['사', '유', '축'], birth: '사' }
  };
  function trineOf(branch) {
    for (var k in TRINE) if (TRINE[k].members.indexOf(branch) >= 0) return TRINE[k];
    return null;
  }
  // 기준지(년지 또는 일지)에 대한 각 지지의 12신살 이름
  function twelveSinsal(baseBranch, branch) {
    var t = trineOf(baseBranch); if (!t) return null;
    var birthIdx = BRANCHES.indexOf(t.birth);
    var start = (birthIdx + 9) % 12;          // 겁살 위치
    var step = (BRANCHES.indexOf(branch) - start + 12) % 12;
    return SB_NAMES[step];
  }
  // 천을귀인
  var CHEONEUL = { 갑: ['축', '미'], 무: ['축', '미'], 경: ['축', '미'], 을: ['자', '신'], 기: ['자', '신'], 병: ['해', '유'], 정: ['해', '유'], 신: ['인', '오'], 임: ['사', '묘'], 계: ['사', '묘'] };
  var YANGIN = { 갑: '묘', 병: '오', 무: '오', 경: '유', 임: '자' };
  var MUNCHANG = { 갑: '사', 을: '오', 병: '신', 정: '유', 무: '신', 기: '유', 경: '해', 신: '자', 임: '인', 계: '묘' };

  // 합충형파해
  var STEM_COMBO = { 갑기: '토', 을경: '금', 병신: '수', 정임: '목', 무계: '화' };
  var SIX_COMBO = { 자축: '토', 인해: '목', 묘술: '화', 진유: '금', 사신: '수', 오미: '토' };
  var CLASH = { 자: '오', 오: '자', 축: '미', 미: '축', 인: '신', 신: '인', 묘: '유', 유: '묘', 진: '술', 술: '진', 사: '해', 해: '사' };
  var PA = { 자: '유', 유: '자', 축: '진', 진: '축', 인: '해', 해: '인', 묘: '오', 오: '묘', 사: '신', 신: '사', 미: '술', 술: '미' };
  var HAE = { 자: '미', 미: '자', 축: '오', 오: '축', 인: '사', 사: '인', 묘: '진', 진: '묘', 신: '해', 해: '신', 유: '술', 술: '유' };
  var WONJIN = { 자: '미', 미: '자', 축: '오', 오: '축', 인: '유', 유: '인', 묘: '신', 신: '묘', 진: '해', 해: '진', 사: '술', 술: '사' };
  var HYUNG3 = [['인', '사', '신'], ['축', '술', '미']];
  var HYUNG2 = [['자', '묘']];
  var SELFHYUNG = ['진', '오', '유', '해'];
  var DIRECTION = { 인묘진: '목', 사오미: '화', 신유술: '금', 해자축: '수' };

  var PILLAR_LABEL = { hour: '시주', day: '일주', month: '월주', year: '년주' };
  var PILLAR_PALACE = {
    year: { palace: '조상·초년(0~15세)', person: '조부모·뿌리' },
    month: { palace: '부모·청년(16~30세)', person: '부모·형제·사회' },
    day: { palace: '나·중년(31~45세)', person: '나 / 배우자(일지)' },
    hour: { palace: '자녀·말년(46세~)', person: '자녀·결실' }
  };

  /* --- 메인: 정밀 명식 --- */
  // opt: { lon: 경도, ja: '조자시'|'야자시', applyLongitude: bool, applyEot: bool, timeKnown: bool }
  function computePro(y, m, d, hour, minute, opt) {
    opt = opt || {};
    var lon = (typeof opt.lon === 'number') ? opt.lon : 126.978;
    var jaSchool = opt.ja || '조자시';
    var timeKnown = opt.timeKnown !== false;
    hour = hour || 0; minute = minute || 0;

    // 1) 표기시각 → UTC
    var era = standardOffsetMin(y, m, d);
    var dst = dstMin(y, m, d, hour);
    // 서머타임은 시계를 앞당긴다 → 같은 표기시각의 실제 UTC는 1시간 이르다
    var offsetMin = era.min + dst;                 // 표기시각 - offset = UTC
    var jdUT = jdFromUTC(y, m, d, hour, minute, 0) - offsetMin / 1440;

    // 2) 진태양시 보정
    // 경도보정 ON  → 출생지 경도의 지방시(lon*4분)를 UTC에 더한다
    // 경도보정 OFF → 표준자오선 그대로(=표기 표준시)로 되돌린다. UTC로 떨어지면 안 됨.
    var lonCorrMin = (opt.applyLongitude === false) ? era.min : lon * 4;
    var eotMin = opt.applyEot === false ? 0 : equationOfTime(jdUT);
    var jdTST = jdUT + (lonCorrMin + eotMin) / 1440;

    // 표시용: 표준시 대비 순 보정량(분)
    var lonRefMin = (opt.applyLongitude === false) ? 0 : (lon * 4 - era.min);
    var totalCorr = lonRefMin + eotMin;
    var tst = utcFromJD(jdTST);

    // 3) 연주 — 입춘 순간 기준
    var solarYear = y;
    var ipchun = termJD(y, termIndexByName('입춘'));
    if (jdUT < ipchun) solarYear = y - 1;
    var yStem = ((solarYear - 4) % 10 + 10) % 10;
    var yBranch = ((solarYear - 4) % 12 + 12) % 12;

    // 4) 월주 — 節 순간 기준 + 五虎遁
    var mt = monthTermOf(jdUT);
    var mBranch = mt.branchIdx;
    var mStemStart = [2, 4, 6, 8, 0][yStem % 5];
    var mStem = (mStemStart + ((mBranch - 2 + 12) % 12)) % 10;

    // 5) 일주 — 진태양시 날짜. 조자시설이면 23시 이후 다음날로 넘김.
    var dayY = tst.y, dayM = tst.m, dayD = tst.d;
    var advanced = false;
    if (timeKnown && tst.h >= 23) {
      if (jaSchool === '조자시') {
        var nx = utcFromJD(Math.floor(jdTST + 0.5) + 0.5 + 0.5); // 다음날 정오 근사
        nx = utcFromJD(jdFromUTC(tst.y, tst.m, tst.d, 12, 0, 0) + 1);
        dayY = nx.y; dayM = nx.m; dayD = nx.d; advanced = true;
      }
    }
    var dIdx = ((jdnCivil(dayY, dayM, dayD) + 49) % 60 + 60) % 60;
    var dStem = dIdx % 10, dBranch = dIdx % 12;

    // 6) 시주 — 五鼠遁 (진태양시 기준)
    var hb = timeKnown ? Math.floor(((tst.h + 1) % 24) / 2) : null;
    var hStem = null;
    if (timeKnown) {
      var hStemStart = [0, 2, 4, 6, 8][dStem % 5];
      hStem = (hStemStart + hb) % 10;
    }

    function P(s, b) {
      if (s === null || b === null) return null;
      return {
        stem: STEMS[s], branch: BRANCHES[b],
        stemHanja: STEM_HANJA[STEMS[s]], branchHanja: BRANCH_HANJA[BRANCHES[b]],
        hanja: STEM_HANJA[STEMS[s]] + BRANCH_HANJA[BRANCHES[b]],
        el: STEM_EL[STEMS[s]], bel: BRANCH_EL[BRANCHES[b]],
        yy: STEM_YY[STEMS[s]] ? '양' : '음'
      };
    }

    var chart = {
      year: P(yStem, yBranch), month: P(mStem, mBranch),
      day: P(dStem, dBranch), hour: P(hStem, hb),
      dayMaster: STEMS[dStem], zodiac: ZODIAC[BRANCHES[yBranch]],
      solarYear: solarYear, timeKnown: timeKnown,
      meta: {
        eraNote: era.note, dstApplied: dst > 0, dstMin: dst,
        lon: lon, lonCorrMin: Math.round(lonRefMin * 10) / 10,
        eotMin: Math.round(eotMin * 10) / 10,
        totalCorrMin: Math.round(totalCorr),
        trueSolar: pad2(tst.h) + ':' + pad2(tst.mi),
        clockTime: pad2(hour) + ':' + pad2(minute),
        jaSchool: jaSchool, dayAdvanced: advanced,
        ipchun: fmtKST(ipchun, era.min),
        monthTerm: mt.prev.name + ' ' + fmtKST(mt.prev.jd, era.min),
        nextTerm: mt.next ? mt.next.name + ' ' + fmtKST(mt.next.jd, era.min) : '',
        jdUT: jdUT, prevTermJD: mt.prev.jd, nextTermJD: mt.next ? mt.next.jd : null
      }
    };
    return chart;
  }

  function jdnCivil(y, m, d) {
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4)
      - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtKST(jdut, offMin) {
    // 초 단위를 분으로 반올림 (30초 이상이면 올림)
    var t = utcFromJD(jdut + (offMin === undefined ? 540 : offMin) / 1440 + 30 / 86400);
    return t.y + '-' + pad2(t.m) + '-' + pad2(t.d) + ' ' + pad2(t.h) + ':' + pad2(t.mi);
  }

  /* --- 명식 파생 항목 전량 --- */
  function fullChart(chart) {
    var dm = chart.dayMaster;
    var keys = ['year', 'month', 'day', 'hour'];
    var pillars = [];
    keys.forEach(function (k) {
      var p = chart[k];
      if (!p) { pillars.push({ key: k, label: PILLAR_LABEL[k], empty: true, palace: PILLAR_PALACE[k] }); return; }
      var hid = HIDDEN[p.branch].filter(Boolean).map(function (h) {
        return { stem: h[0], days: h[1], el: STEM_EL[h[0]], god: tenGod(dm, h[0]) };
      });
      var main = HIDDEN[p.branch][2][0];
      pillars.push({
        key: k, label: PILLAR_LABEL[k], palace: PILLAR_PALACE[k],
        stem: p.stem, branch: p.branch, hanja: p.hanja,
        stemHanja: p.stemHanja, branchHanja: p.branchHanja,
        stemEl: p.el, branchEl: p.bel, yy: p.yy,
        stemGod: k === 'day' ? '일간' : tenGod(dm, p.stem),
        branchGod: tenGod(dm, main),
        stage: twelveStage(dm, p.branch),
        hidden: hid, mainHidden: main,
        zodiac: ZODIAC[p.branch]
      });
    });

    // 공망
    var gm = gongmang(STEMS.indexOf(chart.day.stem), BRANCHES.indexOf(chart.day.branch));
    pillars.forEach(function (p) { if (!p.empty) p.gongmang = gm.indexOf(p.branch) >= 0; });

    // 신살
    var baseY = chart.year.branch, baseD = chart.day.branch;
    var sinsal = [];
    pillars.forEach(function (p) {
      if (p.empty) return;
      var list = [];
      var byYear = twelveSinsal(baseY, p.branch);
      var byDay = twelveSinsal(baseD, p.branch);
      if (byYear) list.push({ name: byYear, base: '년지' });
      if (byDay && byDay !== byYear) list.push({ name: byDay, base: '일지' });
      if ((CHEONEUL[dm] || []).indexOf(p.branch) >= 0) list.push({ name: '천을귀인', base: '일간' });
      if (YANGIN[dm] === p.branch) list.push({ name: '양인', base: '일간' });
      if (MUNCHANG[dm] === p.branch) list.push({ name: '문창귀인', base: '일간' });
      p.sinsal = list;
      list.forEach(function (s) { if (sinsal.indexOf(s.name) < 0) sinsal.push(s.name); });
    });

    return { pillars: pillars, gongmang: gm, sinsalAll: sinsal, dayMaster: dm };
  }

  // 십신 개수 집계 (천간 3 + 지지 정기 4, 지장간 전체는 별도)
  function tenGodCount(chart) {
    var dm = chart.dayMaster, c = {};
    ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'].forEach(function (g) { c[g] = 0; });
    ['year', 'month', 'day', 'hour'].forEach(function (k) {
      var p = chart[k]; if (!p) return;
      if (k !== 'day') c[tenGod(dm, p.stem)]++;
      c[tenGod(dm, HIDDEN[p.branch][2][0])]++;
    });
    var grp = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
    for (var g in c) grp[TEN_GOD_GROUP[g]] += c[g];
    return { detail: c, group: grp };
  }

  // 8글자 내부 합충형파해
  function relations(chart) {
    var keys = ['year', 'month', 'day', 'hour'].filter(function (k) { return chart[k]; });
    var out = [];
    // 천간합·천간충(극)
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        var a = chart[keys[i]], b = chart[keys[j]];
        var pair = [a.stem, b.stem].sort(function (x, y) { return STEMS.indexOf(x) - STEMS.indexOf(y); }).join('');
        if (STEM_COMBO[pair]) out.push({
          type: '천간합', kind: 'combo', power: 3, from: keys[i], to: keys[j],
          text: a.stem + b.stem + ' 합 → ' + STEM_COMBO[pair],
          note: '두 기둥의 천간이 묶여 ' + STEM_COMBO[pair] + '의 결로 향합니다.'
        });
        // 천간충(七冲): 음양이 같으면서 서로 극(剋)하는 관계 (갑경·을신·병임·정계 …)
        if (STEM_YY[a.stem] === STEM_YY[b.stem] && STEM_EL[a.stem] !== STEM_EL[b.stem]
          && (OVERCOME[STEM_EL[a.stem]] === STEM_EL[b.stem] || OVERCOME[STEM_EL[b.stem]] === STEM_EL[a.stem])) {
          out.push({
            type: '천간충', kind: 'clash', power: 2, from: keys[i], to: keys[j],
            text: a.stem + b.stem + ' 충', note: '천간끼리 부딪혀 결정이 갈리기 쉽습니다.'
          });
        }
      }
    }
    // 지지
    for (var p = 0; p < keys.length; p++) {
      for (var q = p + 1; q < keys.length; q++) {
        var x = chart[keys[p]].branch, yb = chart[keys[q]].branch;
        var sp = [x, yb].sort(function (m, n) { return BRANCHES.indexOf(m) - BRANCHES.indexOf(n); }).join('');
        if (SIX_COMBO[sp]) out.push({ type: '육합', kind: 'combo', power: 3, from: keys[p], to: keys[q], text: x + yb + ' 육합 → ' + SIX_COMBO[sp], note: '가깝게 묶여 정이 붙고 일이 매듭지어집니다.' });
        if (CLASH[x] === yb) out.push({ type: '충', kind: 'clash', power: 4, from: keys[p], to: keys[q], text: x + yb + ' 충', note: '정면으로 부딪혀 이동·변동·정리가 일어납니다.' });
        if (PA[x] === yb) out.push({ type: '파', kind: 'clash', power: 1, from: keys[p], to: keys[q], text: x + yb + ' 파', note: '금이 가듯 잔균열이 생깁니다.' });
        if (HAE[x] === yb) out.push({ type: '해', kind: 'clash', power: 1, from: keys[p], to: keys[q], text: x + yb + ' 해', note: '발목을 잡는 사소한 방해가 따릅니다.' });
        if (WONJIN[x] === yb) out.push({ type: '원진', kind: 'clash', power: 2, from: keys[p], to: keys[q], text: x + yb + ' 원진', note: '이유 없이 껄끄러운 애증의 결입니다.' });
        if (HYUNG2[0].indexOf(x) >= 0 && HYUNG2[0].indexOf(yb) >= 0 && x !== yb)
          out.push({ type: '형', kind: 'clash', power: 2, from: keys[p], to: keys[q], text: x + yb + ' 상형', note: '예의 없이 부딪히는 마찰입니다.' });
        if (x === yb && SELFHYUNG.indexOf(x) >= 0)
          out.push({ type: '자형', kind: 'clash', power: 1, from: keys[p], to: keys[q], text: x + yb + ' 자형', note: '스스로를 몰아세우는 결입니다.' });
      }
    }
    // 삼합 / 방합 / 반합
    var bset = keys.map(function (k) { return chart[k].branch; });
    for (var el in TRINE) {
      var mem = TRINE[el].members;
      var have = mem.filter(function (b) { return bset.indexOf(b) >= 0; });
      if (have.length === 3) out.push({ type: '삼합', kind: 'combo', power: 5, text: mem.join('') + ' 삼합 → ' + el + '국', note: '세 글자가 뭉쳐 ' + el + '의 세력이 크게 일어납니다.' });
      else if (have.length === 2 && have.indexOf(mem[1]) >= 0) out.push({ type: '반합', kind: 'combo', power: 2, text: have.join('') + ' 반합 → ' + el, note: '왕지를 낀 절반의 결합입니다.' });
    }
    for (var dk in DIRECTION) {
      var dm2 = dk.split('');
      var h2 = dm2.filter(function (b) { return bset.indexOf(b) >= 0; });
      if (h2.length === 3) out.push({ type: '방합', kind: 'combo', power: 4, text: dk + ' 방합 → ' + DIRECTION[dk], note: '같은 계절이 모여 ' + DIRECTION[dk] + '의 기운이 짙어집니다.' });
    }
    // 삼형
    HYUNG3.forEach(function (tri) {
      var h3 = tri.filter(function (b) { return bset.indexOf(b) >= 0; });
      if (h3.length === 3) out.push({ type: '삼형', kind: 'clash', power: 4, text: tri.join('') + ' 삼형', note: '세 글자가 얽혀 크게 흔들리되 단련되는 결입니다.' });
    });
    return out;
  }

  /* --- 대운 --- */
  function daeun(chart, gender, count) {
    count = count || 9;
    var yStemIdx = STEMS.indexOf(chart.year.stem);
    var yangYear = STEM_YY[chart.year.stem] === 1;
    var male = gender !== 'f';
    var forward = (yangYear && male) || (!yangYear && !male);

    var jd = chart.meta.jdUT;
    var days, boundary;
    if (forward) { days = chart.meta.nextTermJD - jd; boundary = '다음 절기까지'; }
    else { days = jd - chart.meta.prevTermJD; boundary = '지난 절기부터'; }
    var startAgeF = days / 3;
    var startAge = Math.max(1, Math.round(startAgeF * 10) / 10);
    var startAgeInt = Math.max(1, Math.round(startAgeF));

    var mIdx = sexagenaryIndex(STEMS.indexOf(chart.month.stem), BRANCHES.indexOf(chart.month.branch));
    var dm = chart.dayMaster;
    var list = [];
    for (var i = 1; i <= count; i++) {
      var k = ((mIdx + (forward ? i : -i)) % 60 + 60) % 60;
      var s = STEMS[k % 10], b = BRANCHES[k % 12];
      list.push({
        idx: i, age: startAgeInt + (i - 1) * 10,
        ageEnd: startAgeInt + i * 10 - 1,
        year: chart.solarYear + startAgeInt + (i - 1) * 10,
        stem: s, branch: b, hanja: STEM_HANJA[s] + BRANCH_HANJA[b],
        stemEl: STEM_EL[s], branchEl: BRANCH_EL[b],
        stemGod: tenGod(dm, s), branchGod: tenGod(dm, HIDDEN[b][2][0]),
        stage: twelveStage(dm, b)
      });
    }
    return {
      forward: forward, direction: forward ? '순행' : '역행',
      startAge: startAge, startAgeInt: startAgeInt,
      days: Math.round(days * 100) / 100, boundary: boundary,
      rule: (yangYear ? '양간(陽干)' : '음간(陰干)') + ' 연간 + ' + (male ? '남명' : '여명')
        + ' → ' + (forward ? '순행' : '역행'),
      list: list
    };
  }

  // 현재 대운 찾기
  function currentDaeun(du, chart, nowYear) {
    var age = nowYear - chart.solarYear + 1; // 세는나이 기준
    for (var i = du.list.length - 1; i >= 0; i--) {
      if (age >= du.list[i].age) return { cur: du.list[i], age: age };
    }
    return { cur: null, age: age };
  }

  // 세운 (연운) — n년치
  function seun(chart, fromYear, n) {
    n = n || 10;
    var dm = chart.dayMaster, out = [];
    for (var i = 0; i < n; i++) {
      var yy = fromYear + i;
      var s = STEMS[((yy - 4) % 10 + 10) % 10], b = BRANCHES[((yy - 4) % 12 + 12) % 12];
      out.push({
        year: yy, stem: s, branch: b, hanja: STEM_HANJA[s] + BRANCH_HANJA[b],
        stemGod: tenGod(dm, s), branchGod: tenGod(dm, HIDDEN[b][2][0]),
        stage: twelveStage(dm, b), zodiac: ZODIAC[b],
        clash: CLASH[chart.day.branch] === b ? '일지충' : (CLASH[chart.year.branch] === b ? '년지충' : null),
        combo: SIX_COMBO[[chart.day.branch, b].sort(function (x, y) { return BRANCHES.indexOf(x) - BRANCHES.indexOf(y); }).join('')] ? '일지합' : null
      });
    }
    return out;
  }

  /* --- 오행/신강약 --- */
  function elementCount(chart, weighted) {
    var c = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    ['year', 'month', 'day', 'hour'].forEach(function (k) {
      var p = chart[k]; if (!p) return;
      c[p.el]++; c[p.bel]++;
    });
    if (!weighted) return c;
    return c;
  }
  // 지장간 가중 세력 (여기/중기/정기 일수 비율 반영) — 신강약 판정 정밀화
  function weightedPower(chart) {
    var w = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
    var WEIGHT = { year: 0.8, month: 1.4, day: 1.2, hour: 0.9 };
    ['year', 'month', 'day', 'hour'].forEach(function (k) {
      var p = chart[k]; if (!p) return;
      w[p.el] += 1.0 * WEIGHT[k];
      var hid = HIDDEN[p.branch].filter(Boolean);
      var tot = hid.reduce(function (a, h) { return a + h[1]; }, 0);
      hid.forEach(function (h) { w[STEM_EL[h[0]]] += (h[1] / tot) * 1.2 * WEIGHT[k]; });
    });
    for (var k2 in w) w[k2] = Math.round(w[k2] * 100) / 100;
    return w;
  }

  function analyzePro(chart) {
    var cnt = elementCount(chart);
    var pw = weightedPower(chart);
    var dmEl = STEM_EL[chart.dayMaster];
    var support = pw[dmEl] + pw[GEN_BY[dmEl]];
    var drain = pw[GEN[dmEl]] + pw[OVERCOME[dmEl]] + pw[OVERCOME_BY[dmEl]];
    var ratio = support / (support + drain);
    var strong = ratio >= 0.5;
    // 월령 득령 여부 (월지가 나를 돕는가)
    var monthEl = chart.month.bel;
    var deukryeong = (monthEl === dmEl || monthEl === GEN_BY[dmEl]);
    var entries = Object.keys(cnt).map(function (e) { return [e, cnt[e]]; }).sort(function (a, b) { return a[1] - b[1]; });
    var weakest = entries[0][0], strongest = entries[entries.length - 1][0];
    var missing = Object.keys(cnt).filter(function (e) { return cnt[e] === 0; });
    var yongsin = strong ? [OVERCOME_BY[dmEl], OVERCOME[dmEl]] : [GEN_BY[dmEl], dmEl];
    var gisin = strong ? [GEN_BY[dmEl], dmEl] : [OVERCOME_BY[dmEl], OVERCOME[dmEl]];
    return {
      cnt: cnt, power: pw, dm: dmEl, dmYY: STEM_YY[chart.dayMaster] ? '양' : '음',
      strong: strong, ratio: Math.round(ratio * 100), support: Math.round(support * 10) / 10,
      drain: Math.round(drain * 10) / 10, deukryeong: deukryeong,
      weakest: weakest, strongest: strongest, missing: missing,
      yongsin: yongsin, gisin: gisin
    };
  }

  /* --- 격국 --- */
  function gyeokguk(chart) {
    var dm = chart.dayMaster, mb = chart.month.branch;
    var mainHidden = HIDDEN[mb][2][0];
    var mainGod = tenGod(dm, mainHidden);
    // 투간 확인: 월지 지장간이 천간(년·월·시)에 드러났는가
    var stems = ['year', 'month', 'hour'].map(function (k) { return chart[k] ? chart[k].stem : null; }).filter(Boolean);
    var hid = HIDDEN[mb].filter(Boolean).map(function (h) { return h[0]; });
    var tooganList = hid.filter(function (h) { return stems.indexOf(h) >= 0; });
    var isWang = ['자', '오', '묘', '유'].indexOf(mb) >= 0;

    var god, basis;
    if (tooganList.length && !isWang) {
      // 투간한 글자 중 정기 우선
      var pick = tooganList.indexOf(mainHidden) >= 0 ? mainHidden : tooganList[tooganList.length - 1];
      god = tenGod(dm, pick); basis = '월지 ' + mb + '의 지장간 ' + pick + '이(가) 천간에 투출';
    } else {
      god = mainGod; basis = (isWang ? '월지 ' + mb + '는 왕지 — 투간 없어도 정기' : '투간 없음 — 월지 정기') + ' ' + mainHidden + ' 기준';
    }
    var name;
    if (god === '비견' || god === '겁재') {
      if (YANGIN[dm] === mb) { name = '양인격'; basis += ' / 일간의 양인(羊刃) 자리'; }
      else { name = '건록격'; basis += ' / 일간의 록(祿) 자리'; }
    } else name = god + '격';
    return { name: name, god: god, basis: basis };
  }
  var GYEOK_MEAN = {
    정관격: '규율과 명예로 서는 격. 조직·공직·평판의 길에서 안정적으로 오릅니다.',
    편관격: '압박을 뚫고 서는 격. 위기와 경쟁이 오히려 나를 벼립니다.',
    정재격: '성실히 쌓는 재물의 격. 관리와 신용이 곧 자산이 됩니다.',
    편재격: '크게 굴리는 재물의 격. 사업·유통·스케일에 감각이 있습니다.',
    식신격: '꾸준히 만들어 내는 격. 먹을 복과 여유, 전문 기예가 따릅니다.',
    상관격: '재능으로 판을 깨는 격. 표현력이 무기이나 규율과 부딪히기 쉽습니다.',
    정인격: '배움과 문서의 격. 귀인과 자격이 나를 세웁니다.',
    편인격: '깊이 파는 직관의 격. 비주류·전문 영역에서 빛납니다.',
    건록격: '자기 힘으로 서는 격. 독립·자수성가의 결이 강합니다.',
    양인격: '강한 칼을 쥔 격. 결단력이 크되 절제가 곧 그릇입니다.'
  };

  /* --- 궁합 --- */
  function compatibility(a, b) {
    var A = analyzePro(a), B = analyzePro(b);
    var items = [], score = 50;

    // 1) 일간 관계
    var pairKey = [a.dayMaster, b.dayMaster].sort(function (x, y) { return STEMS.indexOf(x) - STEMS.indexOf(y); }).join('');
    if (STEM_COMBO[pairKey]) {
      score += 14;
      items.push({ w: 14, title: '일간 천간합 ' + a.dayMaster + b.dayMaster, text: '두 사람의 일간이 맞물려 ' + STEM_COMBO[pairKey] + '으로 화합합니다. 끌림이 자연스럽고 오래 갑니다.' });
    } else if (OVERCOME[STEM_EL[a.dayMaster]] === STEM_EL[b.dayMaster] || OVERCOME[STEM_EL[b.dayMaster]] === STEM_EL[a.dayMaster]) {
      score -= 8;
      items.push({ w: -8, title: '일간 상극', text: '일간끼리 극(剋)하는 결 — 서로를 자극하고 성장시키지만 마찰도 잦습니다.' });
    } else if (STEM_EL[a.dayMaster] === STEM_EL[b.dayMaster]) {
      score += 4;
      items.push({ w: 4, title: '일간 동기(同氣)', text: '같은 오행의 일간 — 결이 비슷해 편안하되 경쟁심이 붙을 수 있습니다.' });
    } else {
      score += 8;
      items.push({ w: 8, title: '일간 상생', text: '한쪽이 다른 쪽을 생(生)하는 결 — 자연스럽게 돕고 채워주는 관계입니다.' });
    }

    // 2) 일지(배우자궁) 관계
    var ab = a.day.branch, bb = b.day.branch;
    var sk = [ab, bb].sort(function (x, y) { return BRANCHES.indexOf(x) - BRANCHES.indexOf(y); }).join('');
    if (SIX_COMBO[sk]) { score += 16; items.push({ w: 16, title: '일지 육합 ' + ab + bb, text: '배우자궁이 직접 묶입니다. 함께 있을 때 가장 편안한 조합.' }); }
    else if (trineOf(ab) && trineOf(ab) === trineOf(bb) && ab !== bb) { score += 12; items.push({ w: 12, title: '일지 삼합권', text: '같은 삼합 국(局) — 지향점과 리듬이 맞습니다.' }); }
    else if (CLASH[ab] === bb) { score -= 14; items.push({ w: -14, title: '일지 충 ' + ab + bb, text: '배우자궁이 정면 충돌 — 강렬하게 끌리되 부딪힘이 큽니다. 거리 조절이 관건.' }); }
    else if (WONJIN[ab] === bb) { score -= 9; items.push({ w: -9, title: '일지 원진', text: '까닭 없이 껄끄러운 결 — 애증이 함께 옵니다.' }); }
    else if (HAE[ab] === bb) { score -= 5; items.push({ w: -5, title: '일지 해', text: '사소한 어긋남이 반복되기 쉽습니다.' }); }
    else if (ab === bb) { score += 6; items.push({ w: 6, title: '일지 동일', text: '같은 배우자궁 — 취향과 생활 리듬이 닮았습니다.' }); }
    else { score += 2; items.push({ w: 2, title: '일지 무해무득', text: '배우자궁이 특별히 얽히지 않아 담백한 결입니다.' }); }

    // 3) 용신 상보성 — 상대가 내 용신을 채워주는가
    function fill(target, src, srcAnal) {
      var got = 0;
      target.yongsin.forEach(function (e) { got += (srcAnal.cnt[e] || 0); });
      return got;
    }
    var aGet = fill(A, b, B), bGet = fill(B, a, A);
    var yScore = Math.min(18, (aGet + bGet) * 2);
    score += yScore - 6;
    items.push({
      w: yScore - 6, title: '용신 상보성',
      text: '상대의 사주에 내 용신(' + A.yongsin.join('·') + ')이 ' + aGet + '자, '
        + '내 사주에 상대 용신(' + B.yongsin.join('·') + ')이 ' + bGet + '자 있습니다. '
        + (aGet + bGet >= 6 ? '서로의 부족을 실제로 메워주는 조합입니다.'
          : aGet + bGet >= 3 ? '한쪽이 더 채워주는 다소 기울어진 보완입니다.'
            : '서로의 결핍을 채우기보다 각자 채워야 하는 조합입니다.')
    });

    // 4) 오행 균형 — 합쳐서 고르게 되는가
    var merged = {}; ['목', '화', '토', '금', '수'].forEach(function (e) { merged[e] = A.cnt[e] + B.cnt[e]; });
    var vals = Object.keys(merged).map(function (e) { return merged[e]; });
    var mean = vals.reduce(function (x, y) { return x + y; }, 0) / 5;
    var sd = Math.sqrt(vals.reduce(function (x, y) { return x + (y - mean) * (y - mean); }, 0) / 5);
    var balScore = Math.max(-8, Math.min(10, Math.round((3.2 - sd) * 4)));
    score += balScore;
    items.push({
      w: balScore, title: '오행 합산 균형',
      text: '둘의 16글자를 합치면 ' + ['목', '화', '토', '금', '수'].map(function (e) { return e + merged[e]; }).join(' · ')
        + ' — ' + (sd < 1.6 ? '매우 고르게 채워집니다.' : sd < 2.4 ? '대체로 균형이 잡힙니다.' : '한쪽 기운으로 쏠립니다.')
    });

    score = Math.max(5, Math.min(98, Math.round(score)));
    var grade = score >= 85 ? '천생연분' : score >= 72 ? '좋은 인연' : score >= 58 ? '무난한 결'
      : score >= 44 ? '노력이 필요한 결' : '결이 엇갈리는 조합';
    return { score: score, grade: grade, items: items, A: A, B: B };
  }

  root.SajuPro = {
    STEMS: STEMS, BRANCHES: BRANCHES, STEM_HANJA: STEM_HANJA, BRANCH_HANJA: BRANCH_HANJA,
    STEM_EL: STEM_EL, BRANCH_EL: BRANCH_EL, EL_COLOR: EL_COLOR, ZODIAC: ZODIAC,
    GEN: GEN, GEN_BY: GEN_BY, OVERCOME: OVERCOME, OVERCOME_BY: OVERCOME_BY,
    HIDDEN: HIDDEN, TEN_GOD_GROUP: TEN_GOD_GROUP, TEN_GOD_HANJA: TEN_GOD_HANJA,
    TEN_GOD_MEAN: TEN_GOD_MEAN, TWELVE_MEAN: TWELVE_MEAN, TWELVE_HANJA: TWELVE_HANJA,
    SB_MEAN: SB_MEAN, SB_ALIAS: SB_ALIAS, GYEOK_MEAN: GYEOK_MEAN, CITIES: CITIES,
    TERM_NAMES: TERM_NAMES,
    tenGod: tenGod, twelveStage: twelveStage, gongmang: gongmang, twelveSinsal: twelveSinsal,
    computePro: computePro, fullChart: fullChart, tenGodCount: tenGodCount,
    relations: relations, daeun: daeun, currentDaeun: currentDaeun, seun: seun,
    analyzePro: analyzePro, gyeokguk: gyeokguk, compatibility: compatibility,
    elementCount: elementCount, weightedPower: weightedPower,
    termJD: termJD, termIndexByName: termIndexByName, fmtKST: fmtKST,
    sunApparentLongitude: sunApparentLongitude, equationOfTime: equationOfTime,
    jdFromUTC: jdFromUTC, utcFromJD: utcFromJD, standardOffsetMin: standardOffsetMin, dstMin: dstMin
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.SajuPro;
})(typeof window !== 'undefined' ? window : globalThis);
