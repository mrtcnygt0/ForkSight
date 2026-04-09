// Popup — sunucu durumu + ayarlar + versiyon kontrolü
const DEFAULT_API = "https://forksight.mertcanyigit.com";
const EXTENSION_VERSION = "1.0";

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
  ["taktik_api_base", "taktik_token", "taktik_user"],
  (r) => {
    apiBase = r.taktik_api_base || DEFAULT_API;
    apiUrlInput.value = apiBase;
    if (r.taktik_user) {
      userInfoEl.style.display = "block";
      userInfoEl.textContent = `👤 ${r.taktik_user}`;
    }
    checkServer();
    checkVersion();
  },
);

// ─── URL Kaydet ─────────────────────────────────────
saveUrlBtn.onclick = () => {
  let url = apiUrlInput.value.trim().replace(/\/+$/, "");
  if (!url) url = DEFAULT_API;
  if (!url.startsWith("https://")) {
    statusEl.textContent = "❌ Only HTTPS URLs allowed";
    statusEl.className = "status error";
    return;
  }
  apiBase = url;
  chrome.storage.local.set({ taktik_api_base: url });
  chrome.runtime.sendMessage({ type: "update_api_base", url });
  statusEl.textContent = "✅ URL kaydedildi";
  statusEl.className = "status ok";
  setTimeout(checkServer, 500);
};

// ─── Sunucu Kontrol ─────────────────────────────────
function checkServer() {
  statusEl.textContent = "Sunucu kontrol ediliyor…";
  statusEl.className = "status checking";
  fetch(`${apiBase}/stats`, { method: "GET" })
    .then((r) => r.json())
    .then((data) => {
      statusEl.textContent = "✅ Sunucu çalışıyor";
      statusEl.className = "status ok";
      showStats(data);
    })
    .catch(() => {
      statusEl.textContent = "❌ Sunucu bağlantısı yok";
      statusEl.className = "status fail";
      statsSection.style.display = "none";
    });
}

// ─── İstatistikler ──────────────────────────────────
function showStats(d) {
  statsSection.style.display = "block";
  statsGrid.innerHTML = `
    <div class="stat"><div class="v">${d.pool_size || 0}</div><div class="l">Workers</div></div>
    <div class="stat"><div class="v">${d.queue_size || 0}/${d.max_queue || 0}</div><div class="l">Kuyruk</div></div>
    <div class="stat"><div class="v">${d.load_percent || 0}%</div><div class="l">Yük</div></div>
    <div class="stat"><div class="v">${d.total_completed || 0}</div><div class="l">Analiz</div></div>
    <div class="stat"><div class="v">${d.cache_hits || 0}</div><div class="l">Cache Hit</div></div>
    <div class="stat"><div class="v">${d.users || 0}</div><div class="l">Kullanıcı</div></div>
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
