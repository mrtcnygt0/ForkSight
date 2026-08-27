// Popup — sunucu durumu + ayarlar + versiyon kontrolü
const DEFAULT_API = "https://forksight.net";
const EXTENSION_VERSION = chrome.runtime.getManifest().version;

// ─── i18n ───────────────────────────────────────────
const LANGS = {
  tr: {
    serverRunning: "✅ Sunucu çalışıyor",
    serverDown: "❌ Sunucu bağlantısı yok",
    serverChecking: "Sunucu kontrol ediliyor…",
    serverSettings: "⚙️ Sunucu Ayarları",
    serverUrl: "Sunucu URL:",
    save: "💾 Kaydet",
    urlSaved: "✅ URL kaydedildi",
    httpsOnly: "❌ Sadece HTTPS URL kullanılabilir",
    serverStatus: "📊 Sunucu Durumu",
    load: "Yük",
    analyses: "Analiz",
    users: "Kullanıcı",
    quotaTitle: "📊 Günlük Kullanım",
    upgrade: "⭐ Premium'a Geç",
    unlimited: "Sınırsız",
    premiumOnly: "Premium gerekli",
    featTts: "Koç sesli yorum",
    featGame: "Oyun analizi",
    featHint: "Bulmaca ipucu",
    featQuiz: "Bulmaca oynama",
    featReview: "Detaylı koç incelemesi",
    loginForQuota: "Kullanım bilgisi için giriş yapın",
    adminPanel: "🔧 Admin Paneli",
    language: "Dil",
    openCoach: "Chess.com'da ForkSight'ı aç",
    openHint:
      "Chess.com sayfasında avatar'a tıklayarak Ana Sayfa, Koç ve Antrenman'a geç.",
    brandSub: "Kişisel satranç koçu",
  },
  en: {
    serverRunning: "✅ Server is running",
    serverDown: "❌ Server connection failed",
    serverChecking: "Checking server…",
    serverSettings: "⚙️ Server Settings",
    serverUrl: "Server URL:",
    save: "💾 Save",
    urlSaved: "✅ URL saved",
    httpsOnly: "❌ Only HTTPS URLs allowed",
    serverStatus: "📊 Server Status",
    load: "Load",
    analyses: "Analyses",
    users: "Users",
    quotaTitle: "📊 Daily Usage",
    upgrade: "⭐ Go Premium",
    unlimited: "Unlimited",
    premiumOnly: "Premium required",
    featTts: "Coach voice",
    featGame: "Game analysis",
    featHint: "Puzzle hint",
    featQuiz: "Puzzles played",
    featReview: "Deep coach review",
    loginForQuota: "Log in to see usage",
    adminPanel: "🔧 Admin Panel",
    language: "Language",
    openCoach: "Open ForkSight on Chess.com",
    openHint:
      "On Chess.com, click your avatar to open Home, Coach, and Training.",
    brandSub: "Personal chess coach",
  },
};

function detectLang() {
  const bl = (navigator.language || "en").split("-")[0].toLowerCase();
  return LANGS[bl] ? bl : "en";
}

let lang = detectLang();
function t(key) {
  return (LANGS[lang] && LANGS[lang][key]) || (LANGS.en && LANGS.en[key]) || key;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function applyLang() {
  setText("statsTitle", t("serverStatus"));
  setText("quotaTitle", t("quotaTitle"));
  setText("quotaUpgrade", t("upgrade"));
  setText("adminLink", t("adminPanel"));
  setText("langTitle", t("language"));
  setText("openCoachHint", t("openCoach"));
  setText("openHint", t("openHint"));
  setText("brandSub", t("brandSub"));

  // Status bar: only refresh checking/ok/fail labels, keep class
  if (statusEl) {
    if (statusEl.classList.contains("checking")) {
      statusEl.textContent = t("serverChecking");
    } else if (statusEl.classList.contains("ok")) {
      statusEl.textContent = t("serverRunning");
    } else if (statusEl.classList.contains("fail")) {
      statusEl.textContent = t("serverDown");
    }
  }

  const statsGrid = document.getElementById("statsGrid");
  if (statsGrid && statsGrid.children.length) {
    const vals = Array.from(statsGrid.querySelectorAll(".v")).map(
      (e) => e.textContent,
    );
    if (vals.length >= 3) {
      statsGrid.innerHTML = `
      <div class="stat"><div class="v">${vals[0]}</div><div class="l">${t("load")}</div></div>
      <div class="stat"><div class="v">${vals[1]}</div><div class="l">${t("analyses")}</div></div>
      <div class="stat"><div class="v">${vals[2]}</div><div class="l">${t("users")}</div></div>
    `;
    }
  }
}

const statusEl = document.getElementById("status");
const statsSection = document.getElementById("statsSection");
const statsGrid = document.getElementById("statsGrid");
const userInfoEl = document.getElementById("userInfo");
const adminSection = document.getElementById("adminSection");
const verInfo = document.getElementById("verInfo");

let apiBase = DEFAULT_API;
let checkAbort = null;

function persistLang(next) {
  // Panel (fs_lang) ile popup (taktik_lang) aynı tercihi paylaşsın
  return new Promise((resolve) => {
    chrome.storage.local.set({ fs_lang: next, taktik_lang: next }, () =>
      resolve(next),
    );
  });
}

// ─── Başlangıç ──────────────────────────────────────
chrome.storage.local.get(
  ["taktik_token", "taktik_user", "taktik_lang", "fs_lang"],
  (r) => {
    apiBase = DEFAULT_API;
    const stored =
      (r.fs_lang === "tr" || r.fs_lang === "en" ? r.fs_lang : null) ||
      (r.taktik_lang === "tr" || r.taktik_lang === "en" ? r.taktik_lang : null);
    lang = stored || detectLang();
    const sel = document.getElementById("langSelect");
    if (sel) sel.value = lang;
    applyLang();
    if (r.taktik_user && userInfoEl) {
      userInfoEl.style.display = "block";
      userInfoEl.textContent = `👤 ${r.taktik_user}`;
    }
    // Eski anahtar → yeni anahtar senkronu
    if (!r.fs_lang && stored) persistLang(stored);
    checkServer();
    checkVersion();
    loadQuota();
  },
);

// ─── Kullanım Kotası ────────────────────────────────
const FEATURE_LABELS = {
  tts_chars: "featTts",
  game_analysis: "featGame",
  hint: "featHint",
  quiz_play: "featQuiz",
  coach_review: "featReview",
};

function loadQuota() {
  const qs = document.getElementById("quotaSection");
  if (!qs) return;
  chrome.storage.local.get(["taktik_token"], (r) => {
    if (!r.taktik_token) {
      qs.style.display = "block";
      const list = document.getElementById("quotaList");
      if (list) {
        list.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:6px 0;">${t("loginForQuota")}</div>`;
      }
      return;
    }
    fetch(`${apiBase}/me/quota`, {
      headers: { Authorization: `Bearer ${r.taktik_token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || !data.ok) return;
        renderQuota(data);
      })
      .catch(() => {
        /* offline — silently skip */
      });
  });
}

function renderQuota(data) {
  const qs = document.getElementById("quotaSection");
  const list = document.getElementById("quotaList");
  const upgrade = document.getElementById("quotaUpgrade");
  if (!qs || !list) return;
  qs.style.display = "block";
  const isPremium = !!data.is_premium;
  const features = data.features || {};
  let html = "";
  let anyFree = false;
  Object.keys(FEATURE_LABELS).forEach((key) => {
    const f = features[key];
    if (!f) return;
    const label = t(FEATURE_LABELS[key]);
    let valueHtml;
    if (f.limit === -1) {
      valueHtml = `<span style="color:#4ade80;font-weight:600;">${t("unlimited")}</span>`;
    } else if (f.limit === 0) {
      valueHtml = `<span style="color:#f5c518;font-weight:600;">${t("premiumOnly")}</span>`;
      anyFree = true;
    } else {
      const used = f.used || 0;
      const limit = f.limit;
      const pct = Math.min(100, Math.round((used / limit) * 100));
      const color = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f5c518" : "#4ade80";
      valueHtml =
        `<span style="color:${color};font-weight:600;font-variant-numeric:tabular-nums;">${used}/${limit}</span>` +
        `<div style="width:100%;height:4px;background:#1f2937;border-radius:2px;margin-top:3px;overflow:hidden;">` +
        `<div style="width:${pct}%;height:100%;background:${color};"></div></div>`;
      anyFree = true;
    }
    html +=
      `<div style="display:flex;flex-direction:column;gap:2px;">` +
      `<div style="display:flex;justify-content:space-between;align-items:center;">` +
      `<span style="color:var(--text-muted);">${label}</span>${valueHtml}` +
      `</div></div>`;
  });
  list.innerHTML = html || `<div style="color:var(--text-muted);">—</div>`;
  if (upgrade) {
    if (!isPremium && anyFree) {
      upgrade.style.display = "block";
      upgrade.onclick = (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: `${apiBase}/premium` });
      };
    } else {
      upgrade.style.display = "none";
    }
  }
}

// ─── Dil Değiştir ───────────────────────────────────
document.getElementById("langSelect").addEventListener("change", (e) => {
  lang = e.target.value === "tr" ? "tr" : "en";
  persistLang(lang).then(() => {
    applyLang();
    checkServer();
    loadQuota();
  });
});

// ─── Chess.com'a git ────────────────────────────────
const openBtn = document.getElementById("openCoachHint");
if (openBtn) {
  openBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://www.chess.com/home" });
  });
}

// ─── Sunucu Kontrol ─────────────────────────────────
function checkServer() {
  if (!statusEl) return;
  statusEl.textContent = t("serverChecking");
  statusEl.className = "status checking";

  if (checkAbort) {
    try {
      checkAbort.abort();
    } catch (_) {}
  }
  checkAbort = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer =
    checkAbort &&
    setTimeout(() => {
      try {
        checkAbort.abort();
      } catch (_) {}
    }, 8000);

  const opts = checkAbort ? { method: "GET", signal: checkAbort.signal } : { method: "GET" };

  fetch(`${apiBase}/stats`, opts)
    .then(async (r) => {
      if (!r.ok) throw new Error("bad status " + r.status);
      return r.json();
    })
    .then((data) => {
      statusEl.textContent = t("serverRunning");
      statusEl.className = "status ok";
      showStats(data);
    })
    .catch(() => {
      // /stats başarısızsa /version ile ikinci deneme
      return fetch(`${apiBase}/version`, { method: "GET" })
        .then(async (r) => {
          if (!r.ok) throw new Error("bad status");
          return r.json();
        })
        .then(() => {
          statusEl.textContent = t("serverRunning");
          statusEl.className = "status ok";
          if (statsSection) statsSection.style.display = "none";
        })
        .catch(() => {
          statusEl.textContent = t("serverDown");
          statusEl.className = "status fail";
          if (statsSection) statsSection.style.display = "none";
        });
    })
    .finally(() => {
      if (timer) clearTimeout(timer);
    });
}

// ─── İstatistikler ──────────────────────────────────
function showStats(d) {
  if (!statsSection || !statsGrid) return;
  // Tasarımda gizlenmiş olabilir; yine de DOM'u doldur
  statsSection.style.display = "block";
  statsGrid.innerHTML = `
    <div class="stat"><div class="v">${d.load_percent || 0}%</div><div class="l">${t("load")}</div></div>
    <div class="stat"><div class="v">${d.total_completed || 0}</div><div class="l">${t("analyses")}</div></div>
    <div class="stat"><div class="v">${d.users || 0}</div><div class="l">${t("users")}</div></div>
  `;
}

// ─── Versiyon Kontrolü ──────────────────────────────
function checkVersion() {
  if (!verInfo) return;
  fetch(`${apiBase}/version`, { method: "GET" })
    .then((r) => r.json())
    .then((v) => {
      verInfo.textContent = `Extension v${EXTENSION_VERSION} | Server v${v.server_version}`;
      chrome.storage.local.get("taktik_is_admin", (r) => {
        if (r.taktik_is_admin && adminSection) {
          adminSection.style.display = "block";
          const link = document.getElementById("adminLink");
          if (link) {
            link.onclick = () => {
              chrome.tabs.create({ url: `${apiBase}/admin` });
            };
          }
        }
      });
    })
    .catch(() => {
      verInfo.textContent = `Extension v${EXTENSION_VERSION}`;
    });
}
