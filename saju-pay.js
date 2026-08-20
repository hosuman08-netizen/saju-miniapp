/* p20 사주 — 결제 진입점 (Telegram Stars, 단일 SKU: 정식 리딩 1건 = 250 ⭐)
 *
 * ⛔ 이 파일의 제1규칙: **무료 폴백 금지.**
 *    p1(game.js:5718)은 PAY_BACKEND가 비어 있으면 grantPackWithBonus()로 상품을 공짜로 줬다.
 *    여기서는 백엔드 미설정 / 텔레그램 밖 / 네트워크 실패 / 스토리지 다운 — 어떤 실패에서도
 *    유료 콘텐츠가 열리는 경로가 존재하지 않는다. 열람권은 오직 서버 /consume 응답에서만 나온다.
 *
 * 흐름:
 *    [보기 버튼] → checkout_open → /invoice → tg.openInvoice
 *      → paid    → invoice_paid → POST /consume → orderId 수령 → 콘텐츠 렌더 → premium_unlock
 *      → cancel  → invoice_cancelled → 아무것도 열리지 않음
 *      → paid인데 /consume 실패 → 크레딧은 서버에 남아 있음 → 재시도 버튼 + 다음 부팅 시 자동 복구
 *
 * 콘텐츠 이음새: window.SajuPremium.render(chart, entitlement) 를 구현해야 실제 유료 풀이가 나온다.
 *    렌더러가 없으면 **크레딧을 차감하지 않는다**(돈만 받고 못 주는 상태 방지).
 */
(function (root) {
  "use strict";

  // 워커 배포 후 여기에 주소를 넣는다. 비어 있으면 결제 UI는 "준비 중"으로 잠긴다(무료 지급 아님).
  var PAY_BACKEND = "https://saju-pay.hoyashi95.workers.dev";
  var BOT_USERNAME = "CheonGi_bot";
  var SKU = "reading";
  var FALLBACK_STARS = 250;             // /pricing 응답 전 임시 표시값. 실제 청구가는 서버가 단일 소스.
  var PENDING_KEY = "saju_pay_pending"; // 결제완료·미수령 상태 플래그
  var ORDERS_KEY = "saju_paid_orders";  // 서버가 발급한 orderId 로컬 사본(재열람용)

  var pricing = null;   // /pricing 캐시

  function track(type, extra) {
    try { if (root.legionTrack) root.legionTrack(type, extra || {}); } catch (e) {}
  }
  function toast(msg) {
    try {
      if (root.SajuUI && root.SajuUI.toast) { root.SajuUI.toast(msg); return; }
    } catch (e) {}
    try { alert(msg); } catch (e) {}
  }
  function webApp() {
    try {
      if (root.Telegram && root.Telegram.WebApp) return root.Telegram.WebApp;
    } catch (e) {}
    return null;
  }
  function initData() {
    var w = webApp();
    try { return (w && w.initData) ? w.initData : ""; } catch (e) { return ""; }
  }

  /** 결제가 실제로 가능한 상태인가. 하나라도 빠지면 결제 UI를 잠근다. */
  function mode() {
    if (!PAY_BACKEND) return "not-configured";
    // 렌더러가 없으면 팔 수 있는 물건이 없는 것 → 구매 버튼 자체를 띄우지 않는다.
    // (돈만 받고 콘텐츠를 못 주는 상태를 구조적으로 차단)
    if (!contentReady()) return "not-configured";
    var w = webApp();
    if (!w || typeof w.openInvoice !== "function") return "outside-telegram";
    if (!initData()) return "outside-telegram";     // 서명 없는 세션 = uid 위조 가능 → 거부
    return "ready";
  }

  function stars() {
    return (pricing && pricing.stars) || FALLBACK_STARS;
  }

  function loadPricing() {
    if (!PAY_BACKEND) return Promise.resolve(null);
    return fetch(PAY_BACKEND + "/pricing?item=" + encodeURIComponent(SKU) + "&lang=ko")
      .then(function (r) { return r.json(); })
      .then(function (d) { pricing = d; return d; })
      .catch(function () { return null; });
  }

  // ── 콘텐츠 이음새 ───────────────────────────────────────────────────────────
  function contentReady() {
    return !!(root.SajuPremium && typeof root.SajuPremium.render === "function");
  }
  function chart() {
    try { return (root.SajuUI && root.SajuUI.state && root.SajuUI.state.chart) || null; } catch (e) { return null; }
  }
  function deliver(entitlement) {
    try {
      root.SajuPremium.render(chart(), entitlement);
      var orders = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
      orders.unshift({ orderId: entitlement.orderId, sku: entitlement.sku, ts: Date.now() });
      localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 50)));
      localStorage.removeItem(PENDING_KEY);
      track("premium_unlock", { sku: entitlement.sku, paid: 1 });
      render();
      return true;
    } catch (e) {
      // 렌더 실패 = 크레딧은 이미 소모됨. 지원 문의를 위해 orderId를 반드시 남긴다.
      localStorage.setItem(PENDING_KEY, JSON.stringify({ orderId: entitlement.orderId, ts: Date.now(), err: "render" }));
      toast("풀이를 여는 중 오류가 발생했습니다. 열람권은 보존됩니다 (주문번호 " + entitlement.orderId + ")");
      return false;
    }
  }

  // ── 크레딧 소비 ─────────────────────────────────────────────────────────────
  function consume() {
    if (mode() !== "ready") { toast("텔레그램에서 열어야 결제 내역을 확인할 수 있습니다."); return Promise.resolve(false); }
    if (!contentReady()) {
      // ⚠️ 렌더러가 없으면 절대 차감하지 않는다.
      toast("상세 풀이 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return Promise.resolve(false);
    }
    return fetch(PAY_BACKEND + "/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: initData(), sku: SKU }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.orderId) return deliver(d);
        if (d && d.reason === "no-credit") { toast("보유한 열람권이 없습니다."); return false; }
        throw new Error((d && d.error) || "consume failed");
      })
      .catch(function () {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ ts: Date.now(), err: "consume" }));
        toast("열람권 확인에 실패했습니다. 결제분은 서버에 남아 있으니 다시 시도해 주세요.");
        render();
        return false;
      });
  }

  // ── 결제 시작 ───────────────────────────────────────────────────────────────
  function checkout() {
    var m = mode();
    if (m !== "ready") { explain(m); return; }
    if (!chart()) { toast("먼저 명식을 뽑아 주세요."); return; }

    track("checkout_open", { sku: SKU, stars: stars() });
    var w = webApp();
    fetch(PAY_BACKEND + "/invoice?item=" + encodeURIComponent(SKU) + "&lang=ko&initData=" + encodeURIComponent(initData()))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d || !d.link) throw new Error((d && d.error) || "no link");
        w.openInvoice(d.link, function (status) {
          if (status === "paid") {
            track("invoice_paid", { sku: SKU, stars: stars() });
            localStorage.setItem(PENDING_KEY, JSON.stringify({ ts: Date.now(), err: "awaiting" }));
            // 웹훅 반영에 수백 ms 걸릴 수 있어 한 번 지연 후 시도, 실패 시 재시도 버튼이 남는다.
            setTimeout(function () { consume(); }, 1200);
          } else {
            track("invoice_cancelled", { sku: SKU, status: String(status || "unknown") });
            if (status === "failed") toast("결제가 실패했습니다.");
          }
        });
      })
      .catch(function () { toast("결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요."); });
  }

  function explain(m) {
    if (m === "not-configured") { toast("정식 리딩은 곧 열립니다."); return; }
    if (m === "outside-telegram") {
      toast(BOT_USERNAME
        ? "정식 리딩 결제는 텔레그램 앱 안에서만 가능합니다."
        : "정식 리딩 결제는 텔레그램 앱 안에서만 가능합니다. (준비 중)");
    }
  }

  // ── 부팅 복구: 결제했는데 못 받은 크레딧이 있으면 되찾아온다 ────────────────
  function recover() {
    if (mode() !== "ready") return;
    fetch(PAY_BACKEND + "/entitlement?item=" + encodeURIComponent(SKU) + "&initData=" + encodeURIComponent(initData()))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.credits > 0) { pendingCredits = d.credits; render(); }
      })
      .catch(function () {});
  }
  var pendingCredits = 0;

  // ── UI ──────────────────────────────────────────────────────────────────────
  var mountId = null;

  function render() {
    if (!mountId) return;
    var el = document.getElementById(mountId);
    if (!el) return;
    var box = el.querySelector("#sajuPayBox");
    if (!box) {
      box = document.createElement("div");
      box.id = "sajuPayBox";
      box.style.cssText = "margin-top:12px;padding:14px;border:1px solid #c5a46e55;border-radius:12px;background:#15121c;text-align:center";
      el.appendChild(box);
    }
    var m = mode();
    var price = stars();
    var head =
      '<p style="font-size:12px;line-height:1.6;opacity:.85;margin:0 0 8px">여기까지가 겉장입니다.<br><br>' +
      '당신 사주에서 가장 강한 기운 하나, 그리고<br>가장 조심해야 할 시기 하나 — 둘 다 속장에 있습니다.</p>' +
      '<p style="font-size:12px;line-height:1.65;opacity:.85;margin:0 0 10px">' +
      '⭐250 · 열람권 영구 보관 · 열람 전 환불 가능<br>' +
      '<span style="opacity:.6">※ 엔터테인먼트 목적의 해석이며 의료·법률·투자 조언이 아닙니다.</span></p>';

    if (pendingCredits > 0) {
      box.innerHTML = head +
        '<button type="button" class="primary-cta wide" id="sajuPayOpen">⭐ 보유 열람권 ' + pendingCredits + '개 · 지금 열기</button>';
      box.querySelector("#sajuPayOpen").onclick = function () { pendingCredits = 0; consume(); };
      return;
    }

    if (m === "ready") {
      box.innerHTML = head +
        '<button type="button" class="primary-cta wide" id="sajuPayBuy">⭐ 속장 열기 (정식 ' + price + '⭐)</button>' +
        '<p style="font-size:11px;opacity:.6;margin:8px 0 0">텔레그램 Stars 결제 · 열람 전이면 봇 DM으로 환불 요청 가능 · 엔터테인먼트 목적</p>';
      box.querySelector("#sajuPayBuy").onclick = checkout;
      track("shop_view", { sku: SKU, stars: price });
      return;
    }

    if (m === "outside-telegram" && BOT_USERNAME) {
      box.innerHTML = head +
        '<a class="primary-cta wide" href="https://t.me/' + BOT_USERNAME + '?start=buy_reading" style="display:inline-block;text-decoration:none">⭐ ' + price + ' — 텔레그램에서 결제</a>' +
        '<p style="font-size:11px;opacity:.65;margin:8px 0 0"><a href="https://t.me/' + BOT_USERNAME + '?startapp=saju" style="color:#e0b552">이미 결제했다면 미니앱에서 열기</a> · Stars · 엔터테인먼트</p>';
      return;
    }
    box.innerHTML = head +
      '<button type="button" class="secondary wide" disabled style="opacity:.5;cursor:not-allowed">⭐ ' + price + ' — 정식 리딩은 준비 중입니다.</button>';
  }

  function mount(containerId) {
    mountId = containerId || mountId;
    if (!mountId) return;
    if (!pricing && PAY_BACKEND) loadPricing().then(render);
    render();
  }

  root.SajuPay = {
    mount: mount,
    checkout: checkout,
    mode: mode,
    stars: stars,
    recover: recover,
    // 테스트용: 서버 응답 없이는 어떤 것도 열리지 않음을 확인하는 진입점
    _consume: consume,
  };

  if (document.readyState !== "loading") recover();
  else document.addEventListener("DOMContentLoaded", recover);
})(typeof window !== "undefined" ? window : globalThis);
