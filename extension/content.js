/* ForkSight — chess.com auth bridge.
 *
 * The legacy in-game assistant panel (live engine analysis, auto-play,
 * "stealth" hide mode, websocket streaming) was removed in the ethical
 * pivot. The extension now only offers training tools — puzzles, profile
 * stats and post-game review — rendered by the profile / quiz / review
 * modules. Nothing in this file reads, evaluates or influences a live game.
 *
 * Its sole job is to expose a tiny `window.ForkSightAuth` that the floating
 * avatar and the profile panel use to open a login / register modal and to
 * query the current session state.
 */
(function () {
  "use strict";

  // ─── Language (TR/EN) for the modal copy ──────────────
  function _detectLang() {
    try {
      if (window.ForkSightI18n && window.ForkSightI18n.getLang) {
        return window.ForkSightI18n.getLang() === "en" ? "en" : "tr";
      }
    } catch (_) {}
    const bl = (navigator.language || "tr").slice(0, 2).toLowerCase();
    return bl === "en" ? "en" : "tr";
  }
  const _STRINGS = {
    tr: {
      tagline: "Satranç antrenmanı ve koçluk",
      login: "Giriş",
      register: "Kayıt",
      username: "Kullanıcı adı",
      password: "Şifre",
      email: "E-posta (opsiyonel)",
      loginBtn: "🔑 Giriş Yap",
      registerBtn: "✨ Kayıt Ol",
      close: "Kapat",
      needCreds: "Kullanıcı adı ve şifre gerekli.",
      loggingIn: "⏳ Giriş yapılıyor…",
      registering: "⏳ Kayıt oluşturuluyor…",
      connErr: "Sunucu bağlantı hatası.",
      success: "✅ Başarılı. Sayfa yenileniyor…",
      failed: "İşlem başarısız.",
    },
    en: {
      tagline: "Chess training & coaching",
      login: "Sign In",
      register: "Sign Up",
      username: "Username",
      password: "Password",
      email: "Email (optional)",
      loginBtn: "🔑 Sign In",
      registerBtn: "✨ Sign Up",
      close: "Close",
      needCreds: "Username and password are required.",
      loggingIn: "⏳ Signing in…",
      registering: "⏳ Creating account…",
      connErr: "Server connection error.",
      success: "✅ Success. Reloading…",
      failed: "Operation failed.",
    },
  };
  const _L = _STRINGS[_detectLang()];

  let _liveUser = null;
  let _liveIsPremium = false;

  // Restore session from storage and verify the token (+ premium status).
  try {
    chrome.storage.local.get(["taktik_user", "taktik_token"], (r) => {
      if (r && r.taktik_token && r.taktik_user) {
        _liveUser = r.taktik_user;
        try {
          chrome.runtime.sendMessage({ type: "verify_token" }, (resp) => {
            if (chrome.runtime.lastError) return;
            if (resp && resp.ok) {
              _liveUser = resp.username || r.taktik_user;
              _liveIsPremium = !!resp.is_premium;
            } else {
              _liveUser = null;
              try {
                chrome.storage.local.remove([
                  "taktik_token",
                  "taktik_refresh_token",
                  "taktik_user",
                  "taktik_is_admin",
                ]);
              } catch (_) {}
            }
          });
        } catch (_) {}
      }
    });
  } catch (_) {}

  function openLoginModal() {
    const existing = document.getElementById("forksight-auth-modal");
    if (existing) existing.remove();

    const host = document.createElement("div");
    host.id = "forksight-auth-modal";
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
    host.innerHTML =
      `<div style="background:#1a1f2e;border:1px solid #2a3142;border-radius:16px;padding:24px;width:340px;max-width:92vw;color:#e8edf5;box-shadow:0 20px 60px rgba(0,0,0,.6);">` +
      `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">` +
      `<span style="font-size:24px;">♟</span>` +
      `<div><div style="font-size:18px;font-weight:700;">ForkSight</div>` +
      `<div style="font-size:11px;color:#8a93a6;">${_L.tagline}</div></div></div>` +
      `<div id="fs-auth-tabs" style="display:flex;gap:4px;margin:14px 0 10px 0;background:#0f1320;border-radius:8px;padding:3px;">` +
      `<button data-tab="login" class="fs-auth-tab" style="flex:1;background:#2a3142;color:#fff;border:none;padding:8px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">${_L.login}</button>` +
      `<button data-tab="register" class="fs-auth-tab" style="flex:1;background:transparent;color:#8a93a6;border:none;padding:8px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">${_L.register}</button>` +
      `</div>` +
      `<input id="fs-auth-user" type="text" placeholder="${_L.username}" autocomplete="username" style="width:100%;background:#0f1320;border:1px solid #2a3142;color:#e8edf5;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">` +
      `<input id="fs-auth-pass" type="password" placeholder="${_L.password}" autocomplete="current-password" style="width:100%;background:#0f1320;border:1px solid #2a3142;color:#e8edf5;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">` +
      `<input id="fs-auth-email" type="email" placeholder="${_L.email}" autocomplete="email" style="display:none;width:100%;background:#0f1320;border:1px solid #2a3142;color:#e8edf5;padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:8px;box-sizing:border-box;">` +
      `<div id="fs-auth-msg" style="font-size:12px;color:#ef4444;min-height:16px;margin-bottom:8px;"></div>` +
      `<button id="fs-auth-submit" style="width:100%;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;padding:11px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">${_L.loginBtn}</button>` +
      `<button id="fs-auth-close" style="width:100%;background:transparent;color:#8a93a6;border:1px solid #2a3142;margin-top:8px;padding:9px;border-radius:8px;font-size:12px;cursor:pointer;">${_L.close}</button>` +
      `</div>`;
    document.body.appendChild(host);

    let mode = "login";
    const tabs = host.querySelectorAll(".fs-auth-tab");
    const userI = host.querySelector("#fs-auth-user");
    const passI = host.querySelector("#fs-auth-pass");
    const mailI = host.querySelector("#fs-auth-email");
    const msgEl = host.querySelector("#fs-auth-msg");
    const submitBtn = host.querySelector("#fs-auth-submit");

    function setMode(m) {
      mode = m;
      tabs.forEach((t) => {
        const active = t.dataset.tab === m;
        t.style.background = active ? "#2a3142" : "transparent";
        t.style.color = active ? "#fff" : "#8a93a6";
      });
      mailI.style.display = m === "register" ? "block" : "none";
      passI.autocomplete = m === "login" ? "current-password" : "new-password";
      submitBtn.textContent = m === "login" ? _L.loginBtn : _L.registerBtn;
      msgEl.textContent = "";
    }
    tabs.forEach((t) =>
      t.addEventListener("click", () => setMode(t.dataset.tab)),
    );
    host
      .querySelector("#fs-auth-close")
      .addEventListener("click", () => host.remove());
    host.addEventListener("click", (e) => {
      if (e.target === host) host.remove();
    });

    function submit() {
      const username = (userI.value || "").trim();
      const password = passI.value || "";
      if (!username || !password) {
        msgEl.textContent = _L.needCreds;
        return;
      }
      msgEl.style.color = "#8a93a6";
      msgEl.textContent = mode === "login" ? _L.loggingIn : _L.registering;
      submitBtn.disabled = true;
      const payload = { username, password };
      if (mode === "register") payload.email = (mailI.value || "").trim();
      chrome.runtime.sendMessage({ type: mode, data: payload }, (resp) => {
        submitBtn.disabled = false;
        if (chrome.runtime.lastError) {
          msgEl.style.color = "#ef4444";
          msgEl.textContent = _L.connErr;
          return;
        }
        if (resp && resp.ok && resp.token) {
          try {
            chrome.storage.local.set({ taktik_user: username });
          } catch (_) {}
          _liveUser = username;
          _liveIsPremium = !!resp.is_premium;
          msgEl.style.color = "#4ade80";
          msgEl.textContent = _L.success;
          setTimeout(() => {
            host.remove();
            try {
              location.reload();
            } catch (_) {}
          }, 600);
        } else {
          msgEl.style.color = "#ef4444";
          msgEl.textContent =
            (resp && (resp.error || resp.message)) || _L.failed;
        }
      });
    }
    submitBtn.addEventListener("click", submit);
    [userI, passI, mailI].forEach((el) =>
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      }),
    );
    setTimeout(() => userI.focus(), 50);
  }

  window.ForkSightAuth = {
    isLoggedIn: () => !!_liveUser,
    isGuest: () => !_liveUser,
    isPremium: () => !!_liveIsPremium,
    getUser: () => _liveUser,
    openLogin: openLoginModal,
  };
})();
