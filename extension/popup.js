// Popup — sunucu durumu + ayarlar + versiyon kontrolü
const DEFAULT_API = "https://forksight.mertcanyigit.com";
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
    shortcuts: "⌨️ Kısayollar",
    analyze: "Analiz",
    clear: "Temizle",
    safeMode: "Gizle",
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
    shortcuts: "⌨️ Shortcuts",
    analyze: "Analyze",
    clear: "Clear",
    safeMode: "Hide",
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
  document.getElementById("settingsTitle").textContent = t("serverSettings");
  document.getElementById("urlLabel").textContent = t("serverUrl");
  document.getElementById("saveUrl").textContent = t("save");
  document.getElementById("statsTitle").textContent = t("serverStatus");
  document.getElementById("shortcutsTitle").textContent = t("shortcuts");
  document.getElementById("scAnalyze").textContent = t("analyze");
  document.getElementById("scClear").textContent = t("clear");
  document.getElementById("scSafe").textContent = t("safeMode");
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
const apiUrlInput = document.getElementById("apiUrl");
const saveUrlBtn = document.getElementById("saveUrl");
const statsSection = document.getElementById("statsSection");
const statsGrid = document.getElementById("statsGrid");
const userInfoEl = document.getElementById("userInfo");
const adminSection = document.getElementById("adminSection");
const verInfo = document.getElementById("verInfo");

let apiBase = DEFAULT_API;

// ─── Başlangıç ──────────────────────────────────────
chrome.storage.local.get(
  ["taktik_api_base", "taktik_token", "taktik_user", "taktik_lang"],
  (r) => {
    apiBase = r.taktik_api_base || DEFAULT_API;
    lang = r.taktik_lang || detectLang();
    apiUrlInput.value = apiBase;
    document.getElementById("langSelect").value = lang;
    applyLang();
    if (r.taktik_user) {
      userInfoEl.style.display = "block";
      userInfoEl.textContent = `👤 ${r.taktik_user}`;
    }
    checkServer();
    checkVersion();
  },
);

// ─── Dil Değiştir ───────────────────────────────────
document.getElementById("langSelect").addEventListener("change", (e) => {
  lang = e.target.value;
  chrome.storage.local.set({ taktik_lang: lang });
  applyLang();
  checkServer();
});

// ─── URL Kaydet ─────────────────────────────────────
saveUrlBtn.onclick = () => {
  let url = apiUrlInput.value.trim().replace(/\/+$/, "");
  if (!url) url = DEFAULT_API;
  if (!url.startsWith("https://")) {
    statusEl.textContent = t("httpsOnly");
    statusEl.className = "status error";
    return;
  }
  apiBase = url;
  chrome.storage.local.set({ taktik_api_base: url });
  chrome.runtime.sendMessage({ type: "update_api_base", url });
  statusEl.textContent = t("urlSaved");
  statusEl.className = "status ok";
  setTimeout(checkServer, 500);
};

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
