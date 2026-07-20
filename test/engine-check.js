/* 명리 엔진 회귀 게이트 — 절입시각·시간보정·명식 파생 규칙을 공표값/고전규칙과 대조.
 * 계산이 조용히 틀어지면 여기서 잡는다. 실패 시 exit 1. */
const S = require('../saju-pro.js');
let fail = 0, pass = 0;
function eq(label, got, want) {
  if (String(got) === String(want)) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + ' — 계산 ' + got + ' / 기대 ' + want); }
}
function ok(label, cond, detail) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (detail ? ' — ' + detail : '')); }
}

console.log('── 절입시각 (한국천문연구원 공표 KST와 분 단위 대조)');
[[2024, '입춘', '2024-02-04 17:27'], [2025, '입춘', '2025-02-03 23:10'],
[2026, '입춘', '2026-02-04 05:02'], [2000, '춘분', '2000-03-20 16:35'],
[2024, '하지', '2024-06-21 05:51'], [2023, '동지', '2023-12-22 12:27'],
[2025, '추분', '2025-09-23 03:19']].forEach(function (c) {
  eq(c[0] + ' ' + c[1], S.fmtKST(S.termJD(c[0], S.termIndexByName(c[1])), 540), c[2]);
});

console.log('── 균시차 (연중 극값 근처)');
ok('2월 중순 약 -14분', Math.abs(S.equationOfTime(S.jdFromUTC(2024, 2, 11, 0, 0, 0)) + 14.2) < 1);
ok('11월 초 약 +16분', Math.abs(S.equationOfTime(S.jdFromUTC(2024, 11, 3, 0, 0, 0)) - 16.4) < 1);

console.log('── 한국 표준시 역사');
eq('1954~1961 표준자오선', S.standardOffsetMin(1958, 6, 10).min, 510);
eq('1961.8.10 이후 환원', S.standardOffsetMin(1962, 6, 10).min, 540);
eq('1987 서머타임 시행중', S.dstMin(1987, 7, 20, 10), 60);
eq('1987 서머타임 구간 밖', S.dstMin(1987, 12, 20, 10), 0);
ok('서머타임이 시주를 실제로 밀어냄',
  S.computePro(1987, 7, 20, 10, 0, {}).hour.hanja !== S.computePro(1987, 12, 20, 10, 0, {}).hour.hanja);

console.log('── 시간 보정');
eq('보정 전부 OFF = 표기시각 유지', S.computePro(1990, 5, 15, 14, 30, { applyLongitude: false, applyEot: false }).meta.trueSolar, '14:30');
eq('서울 경도보정 약 -32분', S.computePro(1990, 5, 15, 14, 30, { applyLongitude: false }).meta.trueSolar > S.computePro(1990, 5, 15, 14, 30, {}).meta.trueSolar, 'true');
ok('부산이 서울보다 진태양시가 이르지 않음(동쪽)',
  S.computePro(1990, 5, 15, 13, 0, { lon: 129.075 }).meta.trueSolar > S.computePro(1990, 5, 15, 13, 0, { lon: 126.978 }).meta.trueSolar);

console.log('── 입춘/절기 경계 (연주·월주가 실제로 갈리는지)');
var before = S.computePro(2026, 2, 4, 4, 30, {}), after = S.computePro(2026, 2, 4, 5, 30, {});
ok('입춘 05:02 전후로 연주가 바뀜', before.year.hanja !== after.year.hanja, before.year.hanja + ' vs ' + after.year.hanja);
ok('입춘 05:02 전후로 월주가 바뀜', before.month.hanja !== after.month.hanja, before.month.hanja + ' vs ' + after.month.hanja);

console.log('── 십신 (일간 기준 고전 규칙)');
eq('갑 기준 갑 = 비견', S.tenGod('갑', '갑'), '비견');
eq('갑 기준 을 = 겁재', S.tenGod('갑', '을'), '겁재');
eq('갑 기준 병 = 식신', S.tenGod('갑', '병'), '식신');
eq('갑 기준 정 = 상관', S.tenGod('갑', '정'), '상관');
eq('갑 기준 무 = 편재', S.tenGod('갑', '무'), '편재');
eq('갑 기준 기 = 정재', S.tenGod('갑', '기'), '정재');
eq('갑 기준 경 = 편관', S.tenGod('갑', '경'), '편관');
eq('갑 기준 신 = 정관', S.tenGod('갑', '신'), '정관');
eq('갑 기준 임 = 편인', S.tenGod('갑', '임'), '편인');
eq('갑 기준 계 = 정인', S.tenGod('갑', '계'), '정인');

console.log('── 십이운성 (갑목: 해=장생, 묘=제왕, 미=묘)');
eq('갑-해 장생', S.twelveStage('갑', '해'), '장생');
eq('갑-묘 제왕', S.twelveStage('갑', '묘'), '제왕');
eq('갑-미 묘', S.twelveStage('갑', '미'), '묘');
eq('을-오 장생(음간 역행)', S.twelveStage('을', '오'), '장생');

console.log('── 공망 (60갑자 순중)');
eq('갑자순 → 술해', S.gongmang(0, 0).join(''), '술해');
eq('갑술순 → 신유', S.gongmang(0, 10).join(''), '신유');
eq('갑인순 → 자축', S.gongmang(0, 2).join(''), '자축');

console.log('── 12신살 (신자진 수국 기준)');
eq('신자진 지살 = 신', S.twelveSinsal('자', '신'), '지살');
eq('신자진 도화(연살) = 유', S.twelveSinsal('자', '유'), '연살');
eq('신자진 역마 = 인', S.twelveSinsal('자', '인'), '역마살');
eq('신자진 화개 = 진', S.twelveSinsal('자', '진'), '화개살');
eq('인오술 도화 = 묘', S.twelveSinsal('오', '묘'), '연살');
eq('인오술 역마 = 신', S.twelveSinsal('오', '신'), '역마살');

console.log('── 대운 순역 (양남음녀 순행)');
ok('양간 연간 + 남 = 순행', S.daeun(S.computePro(1990, 5, 15, 14, 30, {}), 'm').forward);
ok('양간 연간 + 여 = 역행', !S.daeun(S.computePro(1990, 5, 15, 14, 30, {}), 'f').forward);
ok('음간 연간 + 여 = 순행', S.daeun(S.computePro(1987, 7, 20, 10, 0, {}), 'f').forward);
ok('음간 연간 + 남 = 역행', !S.daeun(S.computePro(1987, 7, 20, 10, 0, {}), 'm').forward);

console.log('── 자시 학파 (23:30 출생)');
var jo = S.computePro(1990, 5, 15, 23, 30, { ja: '조자시' });
var ya = S.computePro(1990, 5, 15, 23, 30, { ja: '야자시' });
ok('조자시는 일주를 다음 날로 넘김', jo.day.hanja !== ya.day.hanja, jo.day.hanja + ' vs ' + ya.day.hanja);
ok('두 설 모두 시지는 자시', jo.hour.branch === '자' && ya.hour.branch === '자');

console.log('── 시각 미상 처리');
var tu = S.computePro(1990, 5, 15, 12, 0, { timeKnown: false });
ok('시주가 비어 있음', tu.hour === null);
eq('오행 합이 6자', Object.keys(S.analyzePro(tu).cnt).reduce(function (s, k) { return s + S.analyzePro(tu).cnt[k]; }, 0), 6);

console.log('── 전 구간 스모크 (1900~2100)');
var n = 0, threw = 0;
for (var y = 1900; y <= 2100; y += 7) {
  for (var m = 1; m <= 12; m += 3) {
    [1, 15, 28].forEach(function (d) {
      [0, 5, 13, 23].forEach(function (h) {
        n++;
        try {
          var c = S.computePro(y, m, d, h, 30, {});
          var a = S.analyzePro(c), du = S.daeun(c, h % 2 ? 'm' : 'f');
          S.fullChart(c); S.relations(c); S.gyeokguk(c); S.tenGodCount(c); S.seun(c, y, 10);
          var tot = ['목', '화', '토', '금', '수'].reduce(function (s, e) { return s + a.cnt[e]; }, 0);
          if (tot !== 8 || du.startAgeInt < 1 || du.startAgeInt > 11 || isNaN(a.ratio)) throw new Error('불변식 위반 ' + tot + '/' + du.startAgeInt);
        } catch (e) { threw++; if (threw < 3) console.log('    ' + y + '-' + m + '-' + d + ' ' + h + '시: ' + e.message); }
      });
    });
  }
}
ok(n + '개 케이스 전부 정상 (오행합=8 · 대운수 1~11 · 예외 0)', threw === 0, threw + '건 실패');

console.log('\n' + (fail === 0 ? '🟢 엔진 회귀 통과 (' + pass + ')' : '🔴 엔진 회귀 실패 ' + fail + '건 / 통과 ' + pass));
process.exit(fail === 0 ? 0 : 1);
