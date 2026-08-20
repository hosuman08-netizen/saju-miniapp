/* p20 사주 미니앱 — 결제 백엔드 (Cloudflare Worker, Telegram Stars 전용)
 *
 * 설계 원칙 (p1 legion-pay에서 의도적으로 갈라진 부분):
 *   1) SKU 2개만: `reading`(사주 정식) · `tarot`(타로 정식). 그 외 늘리지 않는다.
 *   2) 가챠·확률·랜덤 요소 0. 250 Stars = 정식 리딩 1건이라는 확정 결과물.
 *      → 확률 공개 의무 자체가 발생하지 않는다(GIPA/FTC/BR 리스크 회피의 가장 깨끗한 길).
 *   3) 영수증이 아니라 **크레딧 원장**을 쓴다. 재구매해도 덮어쓰이지 않고 누적되며 만료되지 않는다.
 *      (p1은 `rcpt:uid:item` 단일키 + TTL 24h → 같은 SKU 연속구매 시 유실 + 미소비 영수증 증발 위험)
 *   4) 결제 완료 = 콘텐츠 지급이 아니다. 콘텐츠는 클라이언트가 /consume 으로 크레딧을 1 차감해야 열린다.
 *      서버가 ok를 주지 않으면 유료 콘텐츠는 어떤 경로로도 열리지 않는다.
 *   5) 환불 경로를 처음부터 넣는다(refundStarPayment). 디지털 재화 + Stars는 환불 요구가 실제로 온다.
 *
 * 배포는 neo 승인 사항. 이 파일은 `wrangler deploy` 하지 않은 상태로 커밋만 한다.
 * 시크릿(BOT_TOKEN / WEBHOOK_SECRET / ADMIN_SECRET)은 코드·깃에 절대 넣지 않는다 → wrangler secret put.
 */

// ── 상품 정의 ────────────────────────────────────────────────────────────────
const CATALOG = {
  reading: {
    sku: "reading",
    ledger: "saju",
    stars: 250,
    ver: "SJ1",
    ko: {
      title: "정식 사주 리딩 1건",
      desc:
        "내 명식 기준 정식 풀이 1건 — 십신·용신 해설, 대운 흐름 상세, 재물·관계·직업 영역별 분석. " +
        "구매 즉시 1회 열람권이 지급되고 기록에 영구 저장됩니다. 확률 요소 없음(랜덤 뽑기 아님). " +
        "엔터테인먼트 목적의 해석이며 의료·법률·투자 조언이 아닙니다.",
    },
    en: {
      title: "Full Saju Reading (1 credit)",
      desc:
        "One full reading for your chart — ten-gods & useful-god commentary, luck-cycle detail, " +
        "and wealth/relationship/career breakdown. One credit is granted immediately and saved to your record. " +
        "No random draw. Entertainment only — not medical, legal, or financial advice.",
    },
  },
  tarot: {
    sku: "tarot",
    ledger: "tarot",
    stars: 250,
    ver: "TR1",
    ko: {
      title: "정식 타로 리딩 1건",
      desc:
        "3장(과거·현재·미래)·켈틱 크로스·관계 7장·다섯 장 십자 중 1회. 확정 풀이, 가챠 아님. " +
        "구매 즉시 열람권 1회. 엔터테인먼트이며 예언·투자 조언이 아닙니다.",
    },
    en: {
      title: "Full Tarot Reading (1 credit)",
      desc:
        "One deep spread (Celtic Cross, relationship 7, or five-card cross). Fixed interpretation, not a gacha. " +
        "One credit granted immediately. Entertainment only — not prophecy or financial advice.",
    },
  },
};
function itemOf(raw) {
  const k = String(raw || "reading");
  return CATALOG[k] || null;
}
function pickLang(raw) {
  const c = String(raw || "").slice(0, 2).toLowerCase();
  return c === "en" ? "en" : "ko";
}

// ── CORS: p1은 "*" 였다. p20은 출처 화이트리스트로 좁힌다. ────────────────────
const ALLOWED_ORIGINS = [
  "https://hosuman08-netizen.github.io",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
];
function corsHeaders(req) {
  const o = req.headers.get("Origin") || "";
  const allow = ALLOWED_ORIGINS.indexOf(o) >= 0 ? o : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
const json = (req, o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...corsHeaders(req) },
  });

async function tg(token, method, body) {
  const r = await fetch("https://api.telegram.org/bot" + token + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const WEBHOOK_URL = "https://saju-pay.hoyashi95.workers.dev/webhook";
let webhookReady = false;
async function ensureWebhook(env) {
  const token = env.BOT_TOKEN;
  const secret = env.WEBHOOK_SECRET;
  if (!token || !secret) return false;
  if (webhookReady) return true;
  try {
    const info = await tg(token, "getWebhookInfo", {});
    const url = (info && info.result && info.result.url) || "";
    if (url === WEBHOOK_URL) {
      webhookReady = true;
      return true;
    }
    const set = await tg(token, "setWebhook", {
      url: WEBHOOK_URL,
      secret_token: secret,
      allowed_updates: ["message", "pre_checkout_query"],
    });
    webhookReady = !!(set && set.ok);
    return webhookReady;
  } catch (e) {
    return false;
  }
}

async function sendStarsInvoice(token, chatId, uid, it) {
  const copy = it.ko;
  return tg(token, "sendInvoice", {
    chat_id: chatId,
    title: String(copy.title).slice(0, 32),
    description: String(copy.desc).slice(0, 255),
    payload: [it.ver, it.sku, String(uid), nonce()].join(":"),
    currency: "XTR",
    prices: [{ label: String(copy.title).slice(0, 32), amount: it.stars }],
  });
}

/** Telegram WebApp initData HMAC 검증(공식 규격). 성공 시 user 객체, 실패 시 null.
 *  uid는 절대 쿼리스트링을 신뢰하지 않고 여기서만 파생한다. */
async function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const pairs = [];
    for (const [k, v] of params.entries()) pairs.push(k + "=" + v);
    pairs.sort();
    const enc = new TextEncoder();
    const sk = await crypto.subtle.importKey("raw", enc.encode("WebAppData"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const secret = await crypto.subtle.sign("HMAC", sk, enc.encode(botToken));
    const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(pairs.join("\n")));
    const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex !== hash) return null;
    const authDate = parseInt(params.get("auth_date") || "0", 10);
    if (!authDate || Math.abs(Math.floor(Date.now() / 1000) - authDate) > 86400) return null;
    const raw = params.get("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// ── 크레딧 원장 ───────────────────────────────────────────────────────────────
// 만료 없음. 유저가 돈을 낸 결과물이므로 TTL을 걸지 않는다.
async function getCredits(env, uid, sku) {
  if (!env.RECEIPTS) return null;
  const it = itemOf(sku || "reading");
  if (!it) return 0;
  const nk = "cred:" + uid + ":" + it.ledger;
  let n = parseInt(await env.RECEIPTS.get(nk) || "", 10);
  if (!Number.isFinite(n) && it.ledger === "saju") {
    n = parseInt(await env.RECEIPTS.get("cred:" + uid) || "0", 10);
  }
  return Number.isFinite(n) && n > 0 ? n : 0;
}
async function setCredits(env, uid, sku, n) {
  const it = itemOf(sku || "reading");
  if (!it) return;
  await env.RECEIPTS.put("cred:" + uid + ":" + it.ledger, String(Math.max(0, n | 0)));
  if (it.ledger === "saju") {
    try { await env.RECEIPTS.delete("cred:" + uid); } catch (e) {}
  }
}

function nonce() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

// ── 복귀 유도 메시지 (봇 메시지킷 v2 2026-08-20 아키텍트 — 궁금증 후킹, 가짜할인 금지) ──
// 실발송은 SCHEDULE_SEND_ENABLED="true"일 때만 실제로 tg() 호출한다. 기본 false(드라이런) —
// 코드는 배포돼도 neo가 이 var를 켜기 전까진 사람에게 아무 메시지도 안 나간다.
// v2는 할인/이벤트 문구를 아예 뺐다(궁금증 > 할인 원칙, "가짜 할인 금지") — 로테이션에 EVENT_MESSAGE 없음.
const SAJU_URL = "https://hosuman08-netizen.github.io/saju-miniapp/";
const TAROT_URL = "https://hosuman08-netizen.github.io/tarot-oracle/";
// 사주 톤(구조·평생의 판) + 타로 톤(순간·오늘의 질문) 혼합 로테이션 — 별도 유저추적 없이 8종을 순환.
const RETURN_MESSAGES = [
  { id: "daily", text: "🌙 오늘의 판이 새로 깔렸습니다. 어제와 다른 자리입니다.", btn: "오늘 운세 보기", url: SAJU_URL },
  { id: "tarot_flip", text: "🃏 어제 뽑은 카드, 오늘은 다르게 읽힙니다. 하루가 지났으니까요.", btn: "타로 열기", url: TAROT_URL },
  { id: "weekly", text: "📜 이번 주 흐름이 꺾이는 날이 있습니다. 무료로 확인하세요.", btn: "주간 흐름", url: SAJU_URL },
  { id: "tarot_undecided", text: "🌗 결정 못 한 그 일 — 아직인가요? 다섯 장이면 정리됩니다.", btn: "크로스 스프레드", url: TAROT_URL },
  { id: "match", text: "👥 그 사람과의 궁합, 생년월일 하나면 됩니다.", btn: "궁합 보기", url: SAJU_URL },
  { id: "tarot_someone", text: "💞 그 사람 생각이 났다면, 그것도 신호입니다. 관계 스프레드 열려 있습니다.", btn: "관계 스프레드", url: TAROT_URL },
  { id: "tarot3d", text: "🃏 3일째 카드를 안 뒤집었습니다. 물어보고 싶은 게, 하나쯤 있잖아요.", btn: "타로 한 장", url: TAROT_URL },
  { id: "tarot_free", text: "🕯️ 오늘의 한 장은 아직 안 뽑았습니다. 무료입니다.", btn: "카드 뽑기", url: TAROT_URL },
];

const DAY = 86400000;
async function touchUser(env, uid, chatId) {
  const key = "usr:" + uid;
  let rec = null;
  try { rec = JSON.parse((await env.RECEIPTS.get(key)) || "null"); } catch (e) {}
  const now = Date.now();
  if (!rec) rec = { chat: chatId, first: now, last: now, sentCount: 0, weekStart: now, nextIdx: 0 };
  rec.chat = chatId;
  rec.last = now;
  await env.RECEIPTS.put(key, JSON.stringify(rec), { expirationTtl: 400 * 86400 });
}
async function maybeSendReturnMessage(env, token, uid, rec, now, dryRun) {
  if (now - rec.last > 14 * DAY) return { skipped: "inactive-14d" };          // 2주 무응답 → 중단
  if (now - (rec.lastSentAt || 0) < 2 * DAY) return { skipped: "spacing" };    // 최소 간격
  if (now - (rec.weekStart || 0) > 7 * DAY) { rec.weekStart = now; rec.sentCount = 0; }
  if (rec.sentCount >= 3) return { skipped: "weekly-cap" };                    // 주 2~3회 상한
  const msg = RETURN_MESSAGES[(rec.nextIdx || 0) % RETURN_MESSAGES.length];
  if (!dryRun) {
    await tg(token, "sendMessage", {
      chat_id: rec.chat,
      text: msg.text,
      reply_markup: { inline_keyboard: [[{ text: msg.btn, web_app: { url: msg.url || SAJU_URL } }]] },
    });
  }
  rec.lastSentAt = now;
  rec.sentCount = (rec.sentCount || 0) + 1;
  rec.nextIdx = ((rec.nextIdx || 0) + 1) % RETURN_MESSAGES.length;
  return { sent: dryRun ? "dry-run" : msg.id };
}

export default {
  async fetch(req, env) {
    const token = env.BOT_TOKEN;
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
    const url = new URL(req.url);

    // ── 가격·내용 공개 (인증 불필요). 프론트는 하드코딩 대신 여기를 단일 소스로 쓴다. ──
    if (req.method === "GET" && url.pathname === "/pricing") {
      const it = itemOf(url.searchParams.get("item") || "reading");
      if (!it) return json(req, { error: "unknown item" }, 400);
      const lang = pickLang(url.searchParams.get("lang"));
      const copy = it[lang];
      return json(req, {
        sku: it.sku,
        stars: it.stars,
        currency: "XTR",
        title: copy.title,
        description: copy.desc,
        random: false,
        recurring: false,
        consumable: true,
        refund: "구매 후 열람 전이면 봇 DM으로 환불 요청 가능합니다.",
        disclaimer: "엔터테인먼트 목적의 해석입니다. 의료·법률·투자 조언이 아닙니다.",
      });
    }

    // ── 인보이스 발급 ──────────────────────────────────────────────────────────
    if (req.method === "GET" && url.pathname === "/invoice") {
      if (!token) return json(req, { error: "backend not configured" }, 500);
      const it = itemOf(url.searchParams.get("item") || "reading");
      if (!it) return json(req, { error: "unknown item" }, 400);
      const lang = pickLang(url.searchParams.get("lang"));
      const copy = it[lang];
      const user = await verifyInitData(url.searchParams.get("initData") || "", token);
      if (!user || !user.id) return json(req, { error: "telegram auth required" }, 401);
      const uid = String(user.id);

      const payload = [it.ver, it.sku, uid, nonce()].join(":");
      const res = await tg(token, "createInvoiceLink", {
        title: String(copy.title).slice(0, 32),
        description: String(copy.desc).slice(0, 255),
        payload: payload,
        currency: "XTR",
        prices: [{ label: String(copy.title).slice(0, 32), amount: it.stars }],
      });
      if (!res.ok) return json(req, { error: res.description || "telegram error" }, 502);
      return json(req, { link: res.result, stars: it.stars, sku: it.sku });
    }

    // ── 보유 크레딧 조회 (읽기 전용, 차감 없음) ───────────────────────────────
    if (req.method === "GET" && url.pathname === "/entitlement") {
      const user = await verifyInitData(url.searchParams.get("initData") || "", token);
      if (!user || !user.id) return json(req, { error: "telegram auth required" }, 401);
      if (!env.RECEIPTS) return json(req, { error: "storage unavailable" }, 503);
      const it = itemOf(url.searchParams.get("item") || "reading");
      if (!it) return json(req, { error: "unknown item" }, 400);
      return json(req, { credits: await getCredits(env, String(user.id), it.sku), sku: it.sku });
    }

    // ── 크레딧 1 차감 → 열람권 발급 (POST 전용: 프리페치·링크클릭으로 소모되지 않게) ──
    if (req.method === "POST" && url.pathname === "/consume") {
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const user = await verifyInitData(body.initData || "", token);
      if (!user || !user.id) return json(req, { error: "telegram auth required" }, 401);
      if (!env.RECEIPTS) return json(req, { error: "storage unavailable" }, 503);
      const it = itemOf(body.sku || body.item || "reading");
      if (!it) return json(req, { error: "unknown item" }, 400);
      const uid = String(user.id);
      const have = await getCredits(env, uid, it.sku);
      if (have <= 0) return json(req, { ok: false, credits: 0, reason: "no-credit", sku: it.sku });
      const orderId = nonce();
      await setCredits(env, uid, it.sku, have - 1);
      await env.RECEIPTS.put(
        "ord:" + uid + ":" + orderId,
        JSON.stringify({ sku: it.sku, ts: Date.now() }),
        { expirationTtl: 90 * 86400 }
      );
      return json(req, { ok: true, orderId: orderId, sku: it.sku, credits: have - 1 });
    }

    // ── 관리자 환불 (neo 수동 실행 전용) ──────────────────────────────────────
    if (req.method === "POST" && url.pathname === "/admin/refund") {
      const adm = env.ADMIN_SECRET;
      if (!adm || req.headers.get("X-Admin-Secret") !== adm) return json(req, { ok: false }, 403);
      let body = {};
      try { body = await req.json(); } catch (e) {}
      const uid = String(body.uid || "");
      const charge = String(body.charge_id || "");
      if (!/^\d+$/.test(uid) || !charge) return json(req, { ok: false, reason: "bad-args" }, 400);
      const r = await tg(token, "refundStarPayment", { user_id: Number(uid), telegram_payment_charge_id: charge });
      if (r.ok && env.RECEIPTS) {
        const sku = body.sku || "reading";
        const have = await getCredits(env, uid, sku);
        await setCredits(env, uid, sku, Math.max(0, have - 1));
      }
      return json(req, r);
    }

    // ── 봇 웹훅 ───────────────────────────────────────────────────────────────
    if (req.method === "POST" && (url.pathname === "/" || url.pathname === "/webhook")) {
      if (!token) return json(req, { ok: false });
      // 🔒 fail-CLOSED. 시크릿 미설정이어도 통과시키지 않는다 (p1과 동일하게 유지해야 하는 부분).
      const ws = env.WEBHOOK_SECRET;
      if (!ws || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== ws) return json(req, { ok: false }, 403);

      let u = {};
      try { u = await req.json(); } catch (e) {}

      // 인바운드 메시지 = 활성 신호 (복귀 캠페인 "2주 무응답 중단" 판정용)
      if (u.message && u.message.from && u.message.from.id && env.RECEIPTS) {
        try { await touchUser(env, String(u.message.from.id), u.message.chat.id); } catch (e) {}
      }

      // pre_checkout: p1은 무조건 ok:true 였다. 여기서는 payload·통화·금액을 실제로 검증한다.
      if (u.pre_checkout_query) {
        const q = u.pre_checkout_query;
        const parts = String(q.invoice_payload || "").split(":");
        const it = itemOf(parts[1]);
        const okPayload = !!(it && parts[0] === it.ver && parts[2] === String(q.from && q.from.id));
        const okMoney = !!(it && q.currency === "XTR" && Number(q.total_amount) === it.stars);
        if (okPayload && okMoney) {
          await tg(token, "answerPreCheckoutQuery", { pre_checkout_query_id: q.id, ok: true });
        } else {
          await tg(token, "answerPreCheckoutQuery", {
            pre_checkout_query_id: q.id,
            ok: false,
            error_message: "결제 정보를 확인할 수 없습니다. 앱을 새로 열고 다시 시도해 주세요.",
          });
        }
      }

      // 결제 완료 → 크레딧 +1 (charge_id 기준 멱등)
      if (u.message && u.message.successful_payment) {
        const sp = u.message.successful_payment;
        const parts = String(sp.invoice_payload || "").split(":");
        const it = itemOf(parts[1]) || CATALOG.reading;
        const uid = parts[2] || String((u.message.from && u.message.from.id) || "");
        const charge = sp.telegram_payment_charge_id || "";
        if (env.RECEIPTS && /^\d+$/.test(uid) && charge) {
          const dedupeKey = "chg:" + charge;
          const seen = await env.RECEIPTS.get(dedupeKey);
          if (!seen) {
            await env.RECEIPTS.put(dedupeKey, uid, { expirationTtl: 180 * 86400 });
            const have = await getCredits(env, uid, it.sku);
            await setCredits(env, uid, it.sku, have + 1);
            await env.RECEIPTS.put(
              "pay:" + uid + ":" + charge,
              JSON.stringify({ sku: it.sku, stars: sp.total_amount, ts: Date.now() }),
              { expirationTtl: 180 * 86400 }
            );
          }
          const openUrl = it.sku === "tarot"
            ? "https://hosuman08-netizen.github.io/tarot-oracle/"
            : (env.APP_URL || "https://hosuman08-netizen.github.io/saju-miniapp/");
          await tg(token, "sendMessage", {
            chat_id: u.message.chat.id,
            text: "결제가 완료되었습니다. 아래 버튼으로 들어가 정식 리딩을 여세요.\n환불은 /help",
            reply_markup: { inline_keyboard: [[{ text: "리딩 열기", web_app: { url: openUrl } }]] },
          });
        }
      }

      // /start buy_reading|buy_tarot → 챗 Stars 인보이스 (브라우저에서도 결제 진입 가능)
      if (u.message && typeof u.message.text === "string" && u.message.text.indexOf("/start") === 0) {
        const appUrl = env.APP_URL || "https://hosuman08-netizen.github.io/saju-miniapp/";
        const tarotUrl = "https://hosuman08-netizen.github.io/tarot-oracle/";
        const arg = String(u.message.text.split(/\s+/)[1] || "").toLowerCase();
        if (arg === "buy_reading" || arg === "buy_tarot") {
          const it = arg === "buy_tarot" ? CATALOG.tarot : CATALOG.reading;
          const uid = u.message.from && u.message.from.id;
          const inv = uid ? await sendStarsInvoice(token, u.message.chat.id, uid, it) : { ok: false };
          if (!inv || !inv.ok) {
            await tg(token, "sendMessage", {
              chat_id: u.message.chat.id,
              text: "결제창을 열지 못했습니다. 잠시 후 다시 시도하거나 미니앱에서 열어 주세요.",
              reply_markup: { inline_keyboard: [[
                { text: it.sku === "tarot" ? "타로 미니앱" : "사주 미니앱", web_app: { url: it.sku === "tarot" ? tarotUrl : appUrl } },
              ]] },
            });
          }
          return json(req, { ok: true });
        }
        await tg(token, "sendMessage", {
          chat_id: u.message.chat.id,
          text:
            "🌌 당신의 사주는 이미 쓰여 있습니다.\n" +
            "   아직 안 읽었을 뿐입니다.\n\n" +
            "天機 — 천기누설\n\n" +
            "· 생년월일시 넉 자면, 당신의 판이 열립니다\n" +
            "· 재물이 들어오는 해, 사람이 떠나는 해 — 흐름이 보입니다\n" +
            "· 🆓 오늘 하루의 운은, 지금 공짜로\n\n" +
            '"그때 알았더라면" 을 없애는 방법은 하나뿐입니다.',
          reply_markup: { inline_keyboard: [
            [{ text: "🔮 내 명식 열기", web_app: { url: appUrl } }],
            [{ text: "🃏 타로 열기", web_app: { url: tarotUrl } }],
          ] },
        });
      }
      // /help → 환불 규정 안내 (킷 지침: 모든 유료 안내에 /help 환불 링크)
      if (u.message && typeof u.message.text === "string" && u.message.text.indexOf("/help") === 0) {
        await tg(token, "sendMessage", {
          chat_id: u.message.chat.id,
          text:
            "정식 리딩(250⭐)은 열람 전이면 이 대화로 환불 요청 가능합니다. " +
            "열람 후에는 콘텐츠가 이미 제공된 것으로 보아 청약철회가 제한됩니다(전자상거래법 제17조 제2항 제5호).\n" +
            "모든 리딩은 엔터테인먼트 목적의 해석이며 예측·확정이 아니고, 투자·의료·법률 조언이 아닙니다.",
        });
      }

      return json(req, { ok: true });
    }

    const wh = await ensureWebhook(env);
    return json(req, { ok: true, service: "saju-pay", skus: Object.keys(CATALOG), webhook: !!wh });
  },

  // Cron Trigger (wrangler-pay.toml [triggers]) — 복귀 유도 발송.
  // SCHEDULE_SEND_ENABLED가 "true"가 아니면 dry-run만 하고 실제 tg() 호출 없음.
  // 배포되고 크론이 돌아도 이 var를 neo가 켜기 전까진 사람에게 메시지가 안 나간다.
  async scheduled(event, env, ctx) {
    const token = env.BOT_TOKEN;
    if (!token || !env.RECEIPTS) return;
    const dryRun = env.SCHEDULE_SEND_ENABLED !== "true";
    const now = Date.now();
    let cursor = undefined;
    let scanned = 0, sent = 0;
    do {
      const page = await env.RECEIPTS.list({ prefix: "usr:", cursor, limit: 1000 });
      for (const k of page.keys) {
        scanned++;
        let rec;
        try { rec = JSON.parse((await env.RECEIPTS.get(k.name)) || "null"); } catch (e) { continue; }
        if (!rec) continue;
        const result = await maybeSendReturnMessage(env, token, k.name.slice(4), rec, now, dryRun);
        if (result && result.sent) { sent++; await env.RECEIPTS.put(k.name, JSON.stringify(rec), { expirationTtl: 400 * 86400 }); }
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ scheduled: "saju-return", dryRun, scanned, sent }));
  },
};
