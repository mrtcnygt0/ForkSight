/* Background service worker — content script ↔ Stockfish sunucusu proxy */

const DEFAULT_API = "https://forksight.mertcanyigit.com";
let API_BASE = DEFAULT_API;

// JWT tokenlar (bellekte tut)
let authToken = null;
let refreshToken = null;
let refreshTimer = null;
let notificationViewerId = null;

// Başlangıçta storage'dan yükle
chrome.storage.local.get(
  ["taktik_token", "taktik_refresh_token", "taktik_api_base"],
  (r) => {
    if (r.taktik_token) authToken = r.taktik_token;
    if (r.taktik_refresh_token) refreshToken = r.taktik_refresh_token;
    if (r.taktik_api_base) API_BASE = r.taktik_api_base;
    if (authToken) scheduleRefresh();
  },
);

// ─── Notification Polling ───────────────────────────
const NOTIF_ALARM = "forksight_notif_poll";
const NOTIF_SOURCE = "lichess";

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
    const stored = await chrome.storage.local.get([
      "taktik_notif_last_ts",
      "taktik_api_base",
    ]);
    const base = stored.taktik_api_base || DEFAULT_API;
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
  const stored = await chrome.storage.local.get([
    `notif_meta_${nid}`,
    "taktik_api_base",
  ]);
  const meta = stored[`notif_meta_${nid}`] || {};
  const base = stored.taktik_api_base || DEFAULT_API;
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
  if (msg.type === "update_api_base") {
    const url = (msg.url || DEFAULT_API).replace(/\/+$/, "");
    if (!url.startsWith("https://")) {
      sendResponse({ ok: false, error: "Only HTTPS URLs allowed" });
      return true;
    }
    API_BASE = url;
    chrome.storage.local.set({ taktik_api_base: API_BASE });
    sendResponse({ ok: true });
    return true;
  }

  if (msg.type === "get_api_base") {
    sendResponse({ url: API_BASE });
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
          return { ok: false, error: "Rate limit — lütfen yavaşlayın" };
        if (r.status === 503)
          return { ok: false, error: "Sunucu yoğun, tekrar deneyin" };
        if (r.status === 401)
          return { ok: false, error: "Oturum süresi doldu", expired: true };
        return r.json();
      })
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  if (msg.type === "reset") {
    fetch(`${API_BASE}/reset`, {
      method: "POST",
      headers: apiHeaders(),
      body: "{}",
    })
      .then((r) => {
        if (r.status === 401)
          return { ok: false, error: "Oturum süresi doldu", expired: true };
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
      .catch(() => sendResponse({ error: "bağlantı yok" }));
    return true;
  }

  if (msg.type === "game_result") {
    fetch(`${API_BASE}/game-result`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(msg.data),
    })
      .then((r) => r.json())
      .then((data) => sendResponse(data))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});
