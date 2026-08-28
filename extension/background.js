/* Background service worker — content script ↔ Stockfish sunucusu proxy */

const DEFAULT_API = "https://forksight.net";
let API_BASE = DEFAULT_API;

// JWT tokenlar (bellekte tut)
let authToken = null;
let refreshToken = null;
let refreshTimer = null;
let notificationViewerId = null;

// Başlangıçta storage'dan yükle
chrome.storage.local.get(["taktik_token", "taktik_refresh_token"], (r) => {
  if (r.taktik_token) authToken = r.taktik_token;
  if (r.taktik_refresh_token) refreshToken = r.taktik_refresh_token;
  if (authToken) scheduleRefresh();
});

// ─── Notification Polling ───────────────────────────
const NOTIF_ALARM = "forksight_notif_poll";
const NOTIF_SOURCE = "chesscom";

chrome.alarms.create(NOTIF_ALARM, { periodInMinutes: 3 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === NOTIF_ALARM) checkNotifications();
});

// Service worker başladığında hemen kontrol et (PC açıldığında vs.)
chrome.runtime.onStartup.addListener(() => checkNotifications());
chrome.runtime.onInstalled.addListener(() => checkNotifications());

async function getNotificationViewerId() {
  if (notificationViewerId) return notificationViewerId;
  const stored = await chrome.storage.local.get(["taktik_notif_viewer_id"]);
  if (stored.taktik_notif_viewer_id) {
    notificationViewerId = stored.taktik_notif_viewer_id;
    return notificationViewerId;
  }
  notificationViewerId =
    globalThis.crypto?.randomUUID?.() ||
    `viewer_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await chrome.storage.local.set({
    taktik_notif_viewer_id: notificationViewerId,
  });
  return notificationViewerId;
}

async function createBrowserNotification(notifId, options) {
  return new Promise((resolve) => {
    chrome.notifications.create(notifId, options, (createdId) => {
      if (chrome.runtime.lastError) resolve("");
      else resolve(createdId || "");
    });
  });
}

async function reportNotificationEvent(base, notificationId, eventType) {
  try {
    const viewerId = await getNotificationViewerId();
    await fetch(`${base}/notification-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        notification_id: Number(notificationId),
        event_type: eventType,
        viewer_id: viewerId,
        source: NOTIF_SOURCE,
      }),
    });
  } catch (e) {
    // İstatistik gönderimi başarısız olabilir; ana akışı bozma.
  }
}

async function checkNotifications() {
  try {
    const stored = await chrome.storage.local.get(["taktik_notif_last_ts"]);
    const base = DEFAULT_API;
    const since = stored.taktik_notif_last_ts || 0;

    const r = await fetch(`${base}/notifications?since=${since}`);
    if (!r.ok) return;
    const data = await r.json();
    if (!data.ok || !data.notifications || data.notifications.length === 0)
      return;

    let maxTs = since;
    for (const n of data.notifications) {
      const opts = {
        type: n.image_url ? "image" : "basic",
        title: n.title,
        message: n.body,
        iconUrl: n.icon_url || "icon128.png",
        priority: 2,
        requireInteraction: true,
      };
      if (n.image_url) opts.imageUrl = n.image_url;

      const notifId = "forksight_notif_" + n.id;
      const createdId = await createBrowserNotification(notifId, opts);
      if (!createdId) continue;

      await chrome.storage.local.set({
        [`notif_meta_${n.id}`]: { click_url: n.click_url || "" },
      });
      await reportNotificationEvent(base, n.id, "shown");

      if (n.created_at > maxTs) maxTs = n.created_at;
    }

    await chrome.storage.local.set({ taktik_notif_last_ts: maxTs });
  } catch (e) {
    // Ağ hatası — sessizce geç
  }
}

chrome.notifications.onClicked.addListener(async (notifId) => {
  const match = notifId.match(/^forksight_notif_(\d+)$/);
  if (!match) return;
  const nid = match[1];
  const stored = await chrome.storage.local.get([`notif_meta_${nid}`]);
  const meta = stored[`notif_meta_${nid}`] || {};
  const base = DEFAULT_API;
  const url = meta.click_url;
  await reportNotificationEvent(base, nid, "clicked");
  if (url) {
    chrome.tabs.create({ url });
  }
  chrome.storage.local.remove([`notif_meta_${nid}`]);
  chrome.notifications.clear(notifId);
});

function apiHeaders() {
  const h = { "Content-Type": "application/json" };
  if (authToken) h["Authorization"] = `Bearer ${authToken}`;
  return h;
}

// ─── Token Refresh ──────────────────────────────────
function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  // 90 dakikada bir yenile (access token 2 saatlik)
  refreshTimer = setTimeout(doRefresh, 90 * 60 * 1000);
}

async function doRefresh() {
  if (!refreshToken) return;
  try {
    const r = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
    });
    if (r.ok) {
      const data = await r.json();
      if (data.ok) {
        authToken = data.token;
        refreshToken = data.refresh_token;
        chrome.storage.local.set({
          taktik_token: data.token,
          taktik_refresh_token: data.refresh_token,
        });
        scheduleRefresh();
      }
    }
  } catch (e) {
    // Refresh başarısız — token geçersiz olabilir, temizle
    authToken = null;
    refreshToken = null;
    chrome.storage.local.remove(["taktik_token", "taktik_refresh_token"]);
  }
}

// ─── Mesaj İşleyici ─────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "get_api_base") {
    sendResponse({ url: API_BASE });
    return true;
  }

  // İçerik script'lerinin /tts gibi auth'lu endpoint'leri direkt çağırabilmesi
  // için access token'ı ödünç verir. Sadece kısa ömürlü access token döner;
  // refresh token paylaşılmaz.
  if (msg.type === "get_token") {
    sendResponse({ token: authToken || null, apiBase: API_BASE });
    return true;
  }

  // Kullanıcının mevcut quota durumunu çeker (TTS, game-analysis, ...).
  if (msg.type === "me_quota") {
    fetch(`${API_BASE}/me/quota`, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "open_url") {
    // Content script'ten güvenli sekme açma (chess.com sayfasında window.open engellenebilir)
    const raw = String((msg.data && msg.data.url) || msg.url || "").trim();
    let ok = false;
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" || u.protocol === "http:") {
        chrome.tabs.create({ url: u.href });
        ok = true;
      }
    } catch (_) {}
    sendResponse({ ok });
    return true;
  }

  if (msg.type === "open_extension_page") {
    // content-script -> background: chrome.tabs eklentisi içinden açılır
    const page = String(msg.page || "").replace(/^\/+/, "");
    if (!/^[a-z0-9_\-./]+\.html$/i.test(page)) {
      sendResponse({ ok: false, error: "invalid page" });
      return true;
    }
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL(page) });
      sendResponse({ ok: true });
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
    return true;
  }

  if (msg.type === "verify_token") {
    if (!authToken) {
      sendResponse({ ok: false });
      return true;
    }
    fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken || authToken}`,
      },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.token) {
          authToken = data.token;
          refreshToken = data.refresh_token || refreshToken;
          chrome.storage.local.set({
            taktik_token: data.token,
            taktik_refresh_token: data.refresh_token || "",
          });
          scheduleRefresh();
          sendResponse({
            ok: true,
            username: data.username,
            is_premium: data.is_premium,
            is_admin: data.is_admin,
            is_streamer: data.is_streamer,
          });
        } else {
          authToken = null;
          refreshToken = null;
          chrome.storage.local.remove(["taktik_token", "taktik_refresh_token"]);
          sendResponse({ ok: false });
        }
      })
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "analyze") {
    fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(msg.data),
    })
      .then((r) => {
        if (r.status === 429)
          return { ok: false, error: "Rate limit — please slow down" };
        if (r.status === 503)
          return { ok: false, error: "Server busy, please try again" };
        if (r.status === 401)
          return { ok: false, error: "Session expired", expired: true };
        return r.json();
      })
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "getGameAnalysis") {
    const { site, gameId, depth } = msg.data || {};
    const url =
      `${API_BASE}/game-analysis?site=${encodeURIComponent(site)}` +
      `&game_id=${encodeURIComponent(gameId)}&depth=${encodeURIComponent(depth)}`;
    fetch(url, { method: "GET", headers: apiHeaders() })
      .then((r) => r.json())
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "saveGameAnalysis") {
    fetch(`${API_BASE}/game-analysis`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(msg.data),
    })
      .then(async (r) => {
        if (r.status === 402) {
          const body = await r.json().catch(() => ({}));
          return { ok: false, quota: true, ...body };
        }
        if (r.status === 401)
          return { ok: false, error: "Session expired", expired: true };
        return r.json();
      })
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "login") {
    fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.data),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.token) {
          authToken = data.token;
          refreshToken = data.refresh_token || null;
          chrome.storage.local.set({
            taktik_token: data.token,
            taktik_refresh_token: data.refresh_token || "",
            taktik_is_admin: !!data.is_admin,
          });
          scheduleRefresh();
        }
        sendResponse(data);
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "register") {
    fetch(`${API_BASE}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.data),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.token) {
          authToken = data.token;
          refreshToken = data.refresh_token || null;
          chrome.storage.local.set({
            taktik_token: data.token,
            taktik_refresh_token: data.refresh_token || "",
          });
          scheduleRefresh();
        }
        sendResponse(data);
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "logout") {
    authToken = null;
    refreshToken = null;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    chrome.storage.local.remove([
      "taktik_token",
      "taktik_refresh_token",
      "taktik_is_admin",
    ]);
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "ping") {
    fetch(`${API_BASE}/`, { method: "GET" })
      .then((r) => r.json())
      .then((data) => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (msg.type === "version") {
    fetch(`${API_BASE}/version`, { method: "GET" })
      .then((r) => r.json())
      .then((data) => sendResponse(data))
      .catch(() => sendResponse({ error: "no connection" }));
    return true;
  }

  // ─── Chess.com entegrasyon endpoint'leri ─────────────
  if (msg.type === "chess_com_verify_code") {
    fetch(`${API_BASE}/chess-com/verify-code`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "chess_com_verify") {
    fetch(`${API_BASE}/chess-com/verify`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        chess_com_username: msg.data?.chess_com_username || "",
      }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "chess_com_link") {
    fetch(`${API_BASE}/chess-com/link`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        chess_com_username: msg.data?.chess_com_username || "",
      }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "chess_com_sync") {
    const force = !!(msg.data && msg.data.force);
    const url = `${API_BASE}/chess-com/sync` + (force ? "?force=true" : "");
    fetch(url, {
      method: "POST",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "chess_com_sync_status") {
    fetch(`${API_BASE}/chess-com/sync-status`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "me_profile") {
    fetch(`${API_BASE}/me/profile`, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "me_games") {
    const params = new URLSearchParams();
    const d = msg.data || {};
    if (d.limit != null) params.set("limit", String(d.limit));
    if (d.offset != null) params.set("offset", String(d.offset));
    if (d.result) params.set("result", d.result);
    if (d.time_class) params.set("time_class", d.time_class);
    const qs = params.toString();
    fetch(`${API_BASE}/me/games${qs ? "?" + qs : ""}`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "me_game_pgn") {
    const id = encodeURIComponent(String(msg.data?.id || ""));
    fetch(`${API_BASE}/me/games/${id}`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "me_weakness") {
    fetch(`${API_BASE}/me/weakness-report`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // ─── Bulmacalar (Quiz) ─────────────────────────────
  if (msg.type === "quiz_stats") {
    fetch(`${API_BASE}/quiz/stats`, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_themes") {
    fetch(`${API_BASE}/quiz/themes`, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_daily") {
    fetch(`${API_BASE}/quiz/daily`, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_next") {
    const d = msg.data || {};
    const qs = new URLSearchParams();
    if (d.exclude_id) qs.set("exclude_id", String(d.exclude_id));
    if (d.theme) qs.set("theme", String(d.theme));
    if (d.puzzle_id) qs.set("puzzle_id", String(d.puzzle_id));
    const url = qs.toString()
      ? `${API_BASE}/quiz/next?${qs.toString()}`
      : `${API_BASE}/quiz/next`;
    fetch(url, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }


  if (msg.type === "notifications_list") {
    const d = msg.data || {};
    const since = Number(d.since || 0) || 0;
    const qs = since ? `?since=${since}` : "";
    fetch(`${API_BASE}/notifications${qs}`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({
          ok: status === 200,
          status,
          notifications: (body && body.notifications) || [],
          ...body,
        }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message, notifications: [] }));
    return true;
  }

  if (msg.type === "notification_event") {
    const d = msg.data || {};
    reportNotificationEvent(API_BASE, d.notification_id, d.event_type || "click")
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  // Faz 3.1: Başarımlar & Liderlik
  if (msg.type === "achievements_me") {
    fetch(`${API_BASE}/achievements/me`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "leaderboard") {
    const d = msg.data || {};
    const qs = new URLSearchParams();
    if (d.metric) qs.set("metric", String(d.metric));
    if (d.limit) qs.set("limit", String(d.limit));
    if (d.scope) qs.set("scope", String(d.scope));
    const url = qs.toString()
      ? `${API_BASE}/leaderboard?${qs.toString()}`
      : `${API_BASE}/leaderboard`;
    fetch(url, { method: "GET", headers: apiHeaders() })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_solve") {
    const d = msg.data || {};
    fetch(`${API_BASE}/quiz/solve`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        puzzle_id: d.puzzle_id,
        move_uci: d.move_uci || d.uci,
        used_hint: d.used_hint || 0,
        time_ms: d.time_ms || 0,
        step: d.step || 1,
        prev_uci: d.prev_uci || null,
        opp_uci: d.opp_uci || null,
      }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "lichess_move") {
    const d = msg.data || {};
    fetch(`${API_BASE}/lichess/move`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        lichess_id: d.lichess_id,
        move_index: d.move_index || 0,
        move_uci: d.move_uci || d.uci,
        used_hint: d.used_hint || 0,
        time_ms: d.time_ms || 0,
      }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_hint") {
    const d = msg.data || {};
    const params = new URLSearchParams();
    params.set("puzzle_id", String(d.puzzle_id));
    params.set("level", String(d.level || 1));
    fetch(`${API_BASE}/quiz/hint?${params.toString()}`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_backfill") {
    const d = msg.data || {};
    const params = new URLSearchParams();
    if (d.limit_games != null) params.set("limit_games", String(d.limit_games));
    if (d.include_mate2 != null)
      params.set("include_mate2", d.include_mate2 ? "true" : "false");
    fetch(`${API_BASE}/quiz/backfill?${params.toString()}`, {
      method: "POST",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "quiz_puzzle_detail") {
    const id = encodeURIComponent(String((msg.data || {}).puzzle_id || ""));
    fetch(`${API_BASE}/quiz/puzzle/${id}`, {
      method: "GET",
      headers: apiHeaders(),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "coach_play_start") {
    const d = msg.data || {};
    fetch(`${API_BASE}/coach/play/start`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        coach_id: d.coach_id || "tilki",
        color: d.color || "w",
      }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "coach_play_move") {
    const d = msg.data || {};
    fetch(`${API_BASE}/coach/play/move`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({
        session_id: d.session_id,
        move_uci: d.move_uci,
      }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "coach_play_resign") {
    const d = msg.data || {};
    fetch(`${API_BASE}/coach/play/resign`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ session_id: d.session_id }),
    })
      .then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => ({})),
      }))
      .then(({ status, body }) =>
        sendResponse({ ok: status === 200, status, ...body }),
      )
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
