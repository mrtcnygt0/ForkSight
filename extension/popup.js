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
    language: "🌐 Dil",
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
    language: "🌐 Language",
  },
};
function detectLang() {
  const bl = (navigator.language || "en").split("-")[0].toLowerCase();
  return LANGS[bl] ? bl : "en";
}
let lang = detectLang();
function t(key) {
  return LANGS[lang][key] || key;
}

function applyLang() {
  document.getElementById("statsTitle").textContent = t("serverStatus");
  const qt = document.getElementById("quotaTitle");
  if (qt) qt.textContent = t("quotaTitle");
  const qu = document.getElementById("quotaUpgrade");
  if (qu) qu.textContent = t("upgrade");
  document.getElementById("adminLink").textContent = t("adminPanel");
  document.getElementById("langTitle").textContent = t("language");
  // Update stats if visible
  const statsGrid = document.getElementById("statsGrid");
  if (statsGrid.children.length) {
    const vals = Array.from(statsGrid.querySelectorAll(".v")).map(
      (e) => e.textContent,
    );
    statsGrid.innerHTML = `
      <div class="stat"><div class="v">${vals[0]}</div><div class="l">${t("load")}</div></div>
      <div class="stat"><div class="v">${vals[1]}</div><div class="l">${t("analyses")}</div></div>
      <div class="stat"><div class="v">${vals[2]}</div><div class="l">${t("users")}</div></div>
    `;
  }
}

const statusEl = document.getElementById("status");
const statsSection = document.getElementById("statsSection");
const statsGrid = document.getElementById("statsGrid");
const userInfoEl = document.getElementById("userInfo");
const adminSection = document.getElementById("adminSection");
const verInfo = document.getElementById("verInfo");

let apiBase = DEFAULT_API;

// ─── Başlangıç ──────────────────────────────────────
chrome.storage.local.get(
  ["taktik_token", "taktik_user", "taktik_lang"],
  (r) => {
    apiBase = DEFAULT_API;
    lang = r.taktik_lang || detectLang();
    document.getElementById("langSelect").value = lang;
    applyLang();
    if (r.taktik_user) {
      userInfoEl.style.display = "block";
      userInfoEl.textContent = `👤 ${r.taktik_user}`;
    }
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
      document.getElementById("quotaList").innerHTML =
        `<div style="color:var(--text-muted);text-align:center;padding:6px 0;">${t("loginForQuota")}</div>`;
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
  lang = e.target.value;
  chrome.storage.local.set({ taktik_lang: lang });
  applyLang();
  checkServer();
});

// ─── Sunucu Kontrol ─────────────────────────────────
function checkServer() {
  statusEl.textContent = t("serverChecking");
  statusEl.className = "status checking";
  fetch(`${apiBase}/stats`, { method: "GET" })
    .then((r) => r.json())
    .then((data) => {
      statusEl.textContent = t("serverRunning");
      statusEl.className = "status ok";
      showStats(data);
    })
    .catch(() => {
      statusEl.textContent = t("serverDown");
      statusEl.className = "status fail";
      statsSection.style.display = "none";
    });
}

// ─── İstatistikler ──────────────────────────────────
function showStats(d) {
  statsSection.style.display = "block";
  statsGrid.innerHTML = `
    <div class="stat"><div class="v">${d.load_percent || 0}%</div><div class="l">${t("load")}</div></div>
    <div class="stat"><div class="v">${d.total_completed || 0}</div><div class="l">${t("analyses")}</div></div>
    <div class="stat"><div class="v">${d.users || 0}</div><div class="l">${t("users")}</div></div>
  `;
}

// ─── Versiyon Kontrolü ──────────────────────────────
function checkVersion() {
  fetch(`${apiBase}/version`, { method: "GET" })
    .then((r) => r.json())
    .then((v) => {
      verInfo.textContent = `Extension v${EXTENSION_VERSION} | Server v${v.server_version}`;
      // Admin link
      chrome.storage.local.get("taktik_is_admin", (r) => {
        if (r.taktik_is_admin) {
          adminSection.style.display = "block";
          document.getElementById("adminLink").onclick = () => {
            chrome.tabs.create({ url: `${apiBase}/admin` });
          };
        }
      });
    })
    .catch(() => {
      verInfo.textContent = `Extension v${EXTENSION_VERSION}`;
    });
}
