/* 정식 사주 리딩 렌더러. 서버 /consume 성공 후에만 호출된다. 무료 폴백 없음. */
(function (root) {
  "use strict";
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function render(chart, entitlement) {
    var P = root.SajuPro;
    if (!P || !chart || !chart.dayMaster) throw new Error("no chart");
    var a = P.analyzePro(chart);
    var g = P.gyeokguk(chart);
    var gods = P.tenGodCount(chart);
    var gender = "m";
    try { gender = (root.SajuUI && root.SajuUI.state && root.SajuUI.state.gender) || "m"; } catch (e) {}
    var du = P.daeun(chart, gender, 8);
    var cur = P.currentDaeun(du, chart, new Date().getFullYear());
    var gMean = (P.GYEOK_MEAN && P.GYEOK_MEAN[g.name]) || "";
    var host = el("reading") || document.querySelector("main");
    if (!host) throw new Error("no host");
    var box = el("sajuPremiumOut");
    if (!box) {
      box = document.createElement("div");
      box.id = "sajuPremiumOut";
      box.className = "card reading-block";
      box.style.cssText = "margin-top:14px;padding:16px;border:1px solid #e0b552;border-radius:12px;background:#12101a";
      host.appendChild(box);
    }
    var godLine = Object.keys(gods).filter(function (k) { return gods[k] > 0; })
      .map(function (k) { return k + " " + gods[k]; }).join(" · ");
    var duLine = cur
      ? ("현재 대운 " + (cur.stem || "") + (cur.branch || "") + " · " + (cur.start || "") + "년대")
      : "대운 산출됨";
    box.innerHTML =
      '<div style="color:#e0b552;font-weight:800;margin-bottom:8px">정식 사주 리딩</div>' +
      '<p style="font-size:13px;line-height:1.7;margin:0 0 10px">일간 <b>' + esc(chart.dayMaster) + "</b> · " +
      (a.strong ? "신강" : "신약") + " (" + a.ratio + "%) · 격국 <b>" + esc(g.name) + "</b></p>" +
      '<p style="font-size:13px;line-height:1.7">' + esc(g.basis) + (gMean ? " — " + esc(gMean) : "") + "</p>" +
      '<p style="font-size:13px;line-height:1.7">용신 ' + esc(a.yongsin.join("·")) +
      " · 기신 " + esc(a.gisin.join("·")) +
      (a.missing.length ? " · 결여 " + esc(a.missing.join("·")) : "") + "</p>" +
      '<p style="font-size:13px;line-height:1.7">십신: ' + esc(godLine) + "</p>" +
      '<p style="font-size:13px;line-height:1.7">' + esc(duLine) + "</p>" +
      '<p style="font-size:13px;line-height:1.7">재물: ' + (gods["정재"] + gods["편재"] > 1 ? "재성이 있어 굴릴 재료가 있습니다." : "재성이 얇습니다. 관리와 신용이 먼저입니다.") +
      " 관계: " + (gods["정관"] + gods["편관"] + gods["식신"] > 1 ? "관·식의 결이 드러납니다." : "관계 축은 절제와 선택이 필요합니다.") +
      " 직업: " + esc(g.name) + "의 길로 서는 편이 맞습니다.</p>" +
      '<p style="font-size:11px;opacity:.65;margin:12px 0 0">열람권 ' + esc((entitlement && entitlement.orderId) || "") +
      " · 확률 요소 없음 · 엔터테인먼트 · 의료·법률·투자 조언 아님</p>";
    try { box.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) {}
    try {
      if (typeof recordToCodex === "function") {
        recordToCodex("saju-premium", g.name + " " + a.yongsin.join("·"), 88);
      }
    } catch (e) {}
  }
  root.SajuPremium = { render: render };
})(typeof window !== "undefined" ? window : globalThis);
