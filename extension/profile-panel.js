/**
 * profile-panel.js — ForkSight kullanıcı profil paneli.
 *
 * Public API:
 *   window.ForkSightProfile.open({ anchorRect })
 *   window.ForkSightProfile.close()
 *
 * Açılış: avatar konumundan (anchorRect) dairesel/scale animasyon ile
 * 400×620 sabit panel olarak ekranın merkezine doğru açılır.
 *
 * Tablar: Profil, Oyunlar, Analiz, Ayarlar
 *
 * Tüm DOM'u kendi Shadow DOM'unda tutar — sayfa stillerinden etkilenmez.
 */
(function () {
  "use strict";

  // ─── i18n yardımcısı ──────────────────────────────────
  const T = (s) =>
    window.ForkSightI18n
      ? window.ForkSightI18n.t(s)
      : String(s == null ? "" : s);

  // ─── Sabitler ─────────────────────────────────────────
  const HOST_ID = "forksight-profile-panel-host";
  const PANEL_W = 720;
  const PANEL_H = 500;

  // Tab tanımları — etiketler render anında T() ile çevrilir.
  const TABS = [
    { id: "profile", trLabel: "Profil", icon: "👤" },
    { id: "games", trLabel: "Oyunlar", icon: "♟" },
    { id: "weakness", trLabel: "Analiz", icon: "🎯" },
    { id: "puzzles", trLabel: "Bulmacalar", icon: "🧩" },
    { id: "achievements", trLabel: "Başarımlar", icon: "🏆" },
    { id: "leaderboard", trLabel: "Liderlik", icon: "📊" },
    { id: "settings", trLabel: "Ayarlar", icon: "⚙" },
  ];

  // ─── Durum ────────────────────────────────────────────
  let hostEl = null;
  let shadow = null;
  let panelEl = null;
  let activeTab = "profile";
  let langUnsub = null;

  // In-memory cache (panel kapanırken silinir)
  let cache = {
    profile: null, // {user, stats, recent_games}
    games: {
      items: [],
      offset: 0,
      hasMore: true,
      filter: { result: "", time_class: "" },
    },
    weakness: null, // {report}
    weaknessClass: null, // null=auto-pick | "bullet"|"blitz"|"rapid"|"daily"
    puzzles: {
      view: "lobby", // "lobby" | "loading" | "solving" | "preview"
      stats: null,
      totalPuzzles: 0,
      totalGames: 0,
      processedGames: 0,
      backfilling: false,
      backfillPollId: null,
      backfillStartedAt: 0,
      autoBackfillTried: false,
      history: [], // recent_attempts (zenginleştirilmiş)
      puzzle: null, // solving veya preview puzzle objesi
      preview: null, // { puzzle, last_attempt }
      board: null,
      timerId: null,
      startTs: 0,
      usedHint: 0,
      submitting: false,
      hintFromSq: null,
      flash: { kind: "", msg: "" },
      themeFilter: "", // Faz 2.6: aktif tema filtresi (örn. "pin")
      themeFilterLabel: "", // UI gösterim etiketi
      themeRemaining: 0, // o temadan toplam puzzle adedi
    },
    achievements: null, // {items, earned_count, total_count} | "loading"
    quota: null, // /me/quota cevabı: {is_premium, premium_until, features:{...}}
    leaderboard: {
      data: null, // {top, me, metric} | null
      metric: "rating", // rating | solved | day_streak | weekly_solved | points
      loading: false,
    },
  };

  // ─── Yardımcılar ──────────────────────────────────────
  const esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  function send(type, data) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, data: data || {} }, (resp) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(resp || {});
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function fmtDate(ts) {
    if (!ts) return "—";
    try {
      const d = new Date(ts * 1000);
      const locale =
        window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
          ? "tr-TR"
          : "en-US";
      return d.toLocaleDateString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch (_) {
      return "—";
    }
  }

  function dailyMessage(streak) {
    // Streak'e göre kısa motivasyon mesajı.
    if (!streak || streak < 1) return T("Bugün de iyi şanslar!");
    if (streak === 1) return T("Güzel bir başlangıç! 🚀");
    const tpl =
      streak < 7
        ? window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
          ? "{n} days here — keep going!"
          : `${streak} gündür buradasın — devam et!`
        : streak < 30
          ? window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
            ? "{n}-day streak — impressive!"
            : `${streak} günlük seri — etkileyici!`
          : window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
            ? "{n} days! You're a legend 🔥"
            : `${streak} gün! Sen bir efsanesin 🔥`;
    return tpl.replace("{n}", String(streak));
  }

  function gameThumbHTML(g) {
    // Mini tahta (final_fen) — coach-review modülündeki buildBoardSVG'yi kullan.
    // ÖNEMLİ: buildBoardSVG `step.pos.board[idx]` parse edilmiş Position bekler,
    // sadece FEN string yetmez. Bu yüzden _fenToPosition ile önce parse et.
    let svg = "";
    try {
      const R = window.ForkSightReview;
      if (
        R &&
        typeof R._buildBoardSVG === "function" &&
        typeof R._fenToPosition === "function" &&
        g.final_fen
      ) {
        const pos = R._fenToPosition(g.final_fen);
        if (pos && pos.board) {
          svg = R._buildBoardSVG(
            { pos, fen: g.final_fen, from: null, to: null },
            g.user_color === "black",
          );
        }
      }
    } catch (_) {}
    const resultClass =
      g.result === "win" ? "win" : g.result === "loss" ? "loss" : "draw";
    const resultLabel =
      g.result === "win"
        ? T("Kazandı")
        : g.result === "loss"
          ? T("Kaybetti")
          : T("Beraberlik");
    const opp =
      g.user_color === "white"
        ? `${esc(g.black_username || "?")} (${g.black_rating || "?"})`
        : `${esc(g.white_username || "?")} (${g.white_rating || "?"})`;
    return `
      <button class="fs-game-card" data-game-id="${g.id}" type="button">
        <div class="fs-game-board">${svg || '<div class="fs-game-board-fallback"></div>'}</div>
        <div class="fs-game-meta">
          <div class="fs-game-result fs-r-${resultClass}">${resultLabel}</div>
          <div class="fs-game-opp">vs ${opp}</div>
          <div class="fs-game-eco">${esc(g.eco || "—")} · ${esc(g.time_class || "—")}</div>
        </div>
      </button>
    `;
  }

  async function openGame(gameId) {
    try {
      const resp = await send("me_game_pgn", { id: gameId });
      // Server response: { ok, status, game: { id, pgn, url, ... } }
      const pgn = resp && resp.game && resp.game.pgn;
      if (resp && resp.ok && pgn) {
        if (
          window.ForkSightReview &&
          typeof window.ForkSightReview.openWithPgn === "function"
        ) {
          close();
          window.ForkSightReview.openWithPgn(pgn);
          return;
        }
      }
      console.warn("[ForkSight] openGame failed; resp =", resp);
      alert(T("Oyun yüklenemedi."));
    } catch (e) {
      console.warn("[ForkSight] openGame error", e);
      alert(T("Sunucuya ulaşılamadı."));
    }
  }

  // ─── Stil ─────────────────────────────────────────────
  function panelCSS() {
    return `
      :host {
        all: initial;
        --fs-bg: #1a1d24;
        --fs-bg-elev: #242832;
        --fs-bg-soft: #2d323e;
        --fs-accent: #f5c518;
        --fs-accent-dim: rgba(245,197,24,0.18);
        --fs-text: #ececec;
        --fs-text-dim: #9ba0aa;
        --fs-good: #6fcf6f;
        --fs-bad: #ff6b6b;
        --fs-warn: #f5c518;
        --fs-border: rgba(255,255,255,0.06);
        --fs-radius: 10px;
        --fs-radius-lg: 18px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: var(--fs-text);
      }
      .fs-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 2147483646;
        opacity: 0;
        transition: opacity .25s ease;
      }
      .fs-overlay.fs-show { opacity: 1; }
      .fs-panel {
        position: fixed;
        width: min(${PANEL_W}px, 96vw); height: min(${PANEL_H}px, 92vh);
        background: var(--fs-bg);
        border-radius: var(--fs-radius-lg);
        box-shadow: 0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px var(--fs-border);
        z-index: 2147483647;
        overflow: hidden;
        display: flex; flex-direction: row;
        transform-origin: var(--fs-origin-x, 50%) var(--fs-origin-y, 50%);
        transform: scale(0) rotate(-180deg);
        opacity: 0;
        transition: transform .42s cubic-bezier(.18,.89,.32,1.28), opacity .25s ease;
      }
      .fs-panel.fs-show {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
      /* Bulmaca çözüm/önizleme görünümünde panel büyür */
      .fs-panel.fs-panel-quiz {
        width: min(940px, 98vw);
        height: min(640px, 96vh);
      }

      /* ── Sol sidebar (mockup'taki dikey tab kolonu) ── */
      .fs-sidebar {
        flex: 0 0 168px;
        background: var(--fs-bg-elev);
        border-right: 1px solid var(--fs-border);
        display: flex; flex-direction: column;
        padding: 16px 12px;
        gap: 6px;
      }
      .fs-brand {
        display: flex; align-items: center; gap: 8px;
        font-weight: 800; font-size: 13px; letter-spacing: 1.2px;
        color: var(--fs-text);
        text-transform: uppercase;
        padding: 4px 8px 14px 8px;
      }
      .fs-brand-ico {
        width: 26px; height: 26px; border-radius: 50%;
        object-fit: cover;
        background: var(--fs-bg-soft);
        flex: 0 0 auto;
      }
      .fs-tabs {
        display: flex; flex-direction: column; gap: 4px;
        flex: 1;
      }
      .fs-tab {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px; border-radius: 10px;
        background: transparent; border: 0; color: var(--fs-text-dim);
        font-size: 13px; font-weight: 600; cursor: pointer;
        transition: background .15s ease, color .15s ease;
        text-align: left;
      }
      .fs-tab .fs-tab-ico { font-size: 15px; width: 18px; text-align: center; }
      .fs-tab:hover { color: var(--fs-text); background: rgba(255,255,255,0.04); }
      .fs-tab.fs-active {
        background: var(--fs-accent); color: #1a1d24;
        box-shadow: 0 4px 14px rgba(245,197,24,0.28);
      }
      .fs-premium-pill {
        display: flex; align-items: center; justify-content: center; gap: 6px;
        padding: 8px 14px; border-radius: 10px;
        background: transparent; border: 1px solid var(--fs-accent);
        color: var(--fs-accent); font-size: 12px; font-weight: 700;
        cursor: pointer;
      }
      .fs-premium-pill:hover { background: var(--fs-accent-dim); }
      .fs-premium-pill.fs-pill-gold {
        border-color: #f5c518; color: #f5c518;
        background: rgba(245,197,24,0.10);
      }
      .fs-premium-pill.fs-pill-diamond {
        border-color: #b9a8ff; color: #cabfff;
        background: rgba(185,168,255,0.12);
      }

      /* ── Sağ ana alan ── */
      .fs-main {
        flex: 1 1 auto; min-width: 0;
        display: flex; flex-direction: column;
      }
      .fs-header {
        display: flex; align-items: center; justify-content: flex-end;
        padding: 10px 14px 0 14px; gap: 4px;
      }
      .fs-icon-btn {
        background: transparent; border: 0; color: var(--fs-text-dim);
        font-size: 18px; cursor: pointer; padding: 6px 10px; border-radius: 8px;
        line-height: 1;
      }
      .fs-icon-btn:hover { background: var(--fs-bg-elev); color: var(--fs-text); }
      .fs-lang-btn { display:inline-flex; align-items:center; gap:4px; font-size: 14px; }
      .fs-lang-code { font-size: 10px; font-weight: 700; letter-spacing: .5px; opacity: .85; }
      .fs-lang-row { display: flex; gap: 6px; }
      .fs-lang-row .fs-btn { flex: 1 1 0; }
      .fs-body {
        flex: 1; overflow-y: auto; padding: 4px 18px 16px 18px;
        scrollbar-width: thin; scrollbar-color: var(--fs-bg-soft) transparent;
      }
      .fs-body::-webkit-scrollbar { width: 6px; }
      .fs-body::-webkit-scrollbar-thumb { background: var(--fs-bg-soft); border-radius: 3px; }

      /* ── Profile tab ── */
      .fs-prof-head {
        display: flex; gap: 12px; align-items: flex-start;
        padding: 6px 0 14px 0;
      }
      .fs-prof-avatar-wrap { position: relative; flex: 0 0 auto; }
      .fs-prof-avatar {
        width: 64px; height: 64px; border-radius: 50%;
        background: var(--fs-bg-elev) center/cover no-repeat;
        border: 2px solid var(--fs-accent);
      }
      .fs-prof-bubble {
        position: relative;
        flex: 1 1 auto; align-self: center;
        background: var(--fs-bg-elev); color: var(--fs-text);
        padding: 8px 12px; border-radius: 14px 14px 14px 4px;
        font-size: 12px; line-height: 1.35;
        max-width: 240px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      }
      .fs-prof-bubble:before {
        content: ''; position: absolute; left: -6px; bottom: 10px;
        width: 0; height: 0;
        border: 6px solid transparent;
        border-right-color: var(--fs-bg-elev);
        border-left: 0;
      }
      .fs-prof-id { padding: 4px 0 10px 0; }
      .fs-prof-name { font-size: 18px; font-weight: 700; }
      .fs-prof-ccu { font-size: 12px; color: var(--fs-text-dim); margin-top: 2px; }
      .fs-stat-row {
        display: flex; gap: 8px;
        margin-bottom: 14px;
      }
      .fs-stat {
        flex: 1; background: var(--fs-bg-elev);
        padding: 10px; border-radius: var(--fs-radius);
        text-align: center;
      }
      .fs-stat-val { font-size: 18px; font-weight: 700; color: var(--fs-accent); }
      .fs-stat-lab { font-size: 10px; color: var(--fs-text-dim); margin-top: 2px; text-transform: uppercase; letter-spacing: .5px; }

      /* ── Quota strip (günlük/haftalık kullanım rozeti) ── */
      .fs-quota-strip {
        background: var(--fs-bg-elev); border: 1px solid var(--fs-border);
        border-radius: var(--fs-radius); padding: 10px 12px; margin-bottom: 14px;
      }
      .fs-quota-strip.fs-quota-premium {
        background: linear-gradient(135deg, rgba(247,183,51,.08), rgba(252,74,26,.08));
        border-color: rgba(247,183,51,.35);
      }
      .fs-quota-head {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 11px; color: var(--fs-text-dim); text-transform: uppercase;
        letter-spacing: .6px; font-weight: 600; margin-bottom: 8px;
      }
      .fs-quota-head .fs-quota-badge {
        font-size: 10px; padding: 2px 8px; border-radius: 10px;
        background: var(--fs-accent-dim); color: var(--fs-accent);
        text-transform: none; letter-spacing: 0; font-weight: 600;
      }
      .fs-quota-head .fs-quota-badge.fs-prem {
        background: linear-gradient(135deg, #f7b733, #fc4a1a); color: #fff;
      }
      .fs-quota-items { display: flex; flex-direction: column; gap: 7px; }
      .fs-quota-item { display: flex; flex-direction: column; gap: 3px; }
      .fs-quota-item-row {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px;
      }
      .fs-quota-item-lab { color: var(--fs-text); font-weight: 500; }
      .fs-quota-item-val { color: var(--fs-text-dim); font-variant-numeric: tabular-nums; font-size: 11px; }
      .fs-quota-bar {
        height: 4px; background: var(--fs-bg); border-radius: 3px; overflow: hidden;
      }
      .fs-quota-bar-fill {
        height: 100%; border-radius: 3px;
        background: linear-gradient(90deg, #4caf50, #8bc34a);
        transition: width .3s ease;
      }
      .fs-quota-bar-fill.fs-warn { background: linear-gradient(90deg, #ffb300, #ff7043); }
      .fs-quota-bar-fill.fs-full { background: linear-gradient(90deg, #e53935, #b71c1c); }
      .fs-quota-upgrade {
        margin-top: 10px; width: 100%; display: block; text-align: center;
        padding: 8px 12px; border-radius: var(--fs-radius); border: 0;
        background: linear-gradient(135deg, #f7b733, #fc4a1a); color: #fff;
        font-weight: 700; font-size: 12px; cursor: pointer; text-decoration: none;
        letter-spacing: .3px;
      }
      .fs-quota-upgrade:hover { filter: brightness(1.1); }

      .fs-section-title {
        font-size: 11px; color: var(--fs-text-dim); text-transform: uppercase;
        letter-spacing: .8px; font-weight: 600; margin: 10px 0 8px 2px;
        display: flex; justify-content: space-between; align-items: baseline;
      }
      .fs-link-btn {
        background: transparent; border: 0; color: var(--fs-accent);
        font-size: 11px; cursor: pointer; padding: 2px 6px; border-radius: 4px;
      }
      .fs-link-btn:hover { background: var(--fs-accent-dim); }

      /* ── Game grid ── */
      .fs-game-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      }
      .fs-game-card {
        background: var(--fs-bg-elev); border: 1px solid var(--fs-border);
        border-radius: var(--fs-radius); overflow: hidden;
        padding: 0; cursor: pointer; color: var(--fs-text);
        font-family: inherit; text-align: left;
        transition: transform .15s ease, border-color .15s ease;
        display: flex; flex-direction: column;
      }
      .fs-game-card:hover {
        transform: translateY(-2px);
        border-color: var(--fs-accent);
      }
      .fs-game-board { width: 100%; aspect-ratio: 1/1; background: #b58863; }
      .fs-game-board svg { display: block; width: 100%; height: 100%; }
      .fs-game-board-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, #b58863, #f0d9b5); }
      .fs-game-meta { padding: 6px 8px; }
      .fs-game-result { font-size: 11px; font-weight: 700; }
      .fs-r-win { color: var(--fs-good); }
      .fs-r-loss { color: var(--fs-bad); }
      .fs-r-draw { color: var(--fs-warn); }
      .fs-game-opp { font-size: 10px; color: var(--fs-text); margin-top: 2px;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fs-game-eco { font-size: 9px; color: var(--fs-text-dim); margin-top: 2px; }

      /* ── Filter chips ── */
      .fs-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
      .fs-chip {
        background: var(--fs-bg-elev); color: var(--fs-text-dim);
        border: 1px solid var(--fs-border); border-radius: 999px;
        padding: 4px 10px; font-size: 11px; cursor: pointer;
      }
      .fs-chip:hover { color: var(--fs-text); }
      .fs-chip.fs-on { background: var(--fs-accent); color: #1a1d24; border-color: var(--fs-accent); }
      .fs-chip-dis { opacity: .35; cursor: not-allowed; }
      .fs-chip-n {
        display: inline-block; min-width: 18px; padding: 0 5px;
        margin-left: 4px; font-size: 10px; font-weight: 600;
        background: rgba(255,255,255,.08); border-radius: 999px;
        color: inherit;
      }
      .fs-chip.fs-on .fs-chip-n { background: rgba(0,0,0,.22); }
      .fs-chips-weakness { margin-bottom: 6px; }

      /* ── Chapter (mockup'taki 01/02/03 stili) ──
         Landing afişindeki "büyük lavanta numara + büyük başlık +
         küçük alt başlık" dilini analiz sekmesine indirgeyerek
         uyguluyoruz; 400px panele sığacak şekilde. */
      .fs-chap {
        display: flex; align-items: center; gap: 12px;
        margin: 18px 2px 10px 2px;
      }
      .fs-chap:first-child { margin-top: 4px; }
      .fs-chap-num {
        font-size: 38px; font-weight: 800; line-height: 1;
        color: #a78bfa;
        font-feature-settings: "tnum" 1;
        text-shadow: 0 0 24px rgba(167,139,250,0.25);
        flex: 0 0 auto;
      }
      .fs-chap-text { display: flex; flex-direction: column; gap: 2px; }
      .fs-chap-title {
        font-size: 14px; font-weight: 800; color: var(--fs-text);
        text-transform: uppercase; letter-spacing: 1.4px;
      }
      .fs-chap-sub {
        font-size: 10px; color: var(--fs-text-dim);
        text-transform: uppercase; letter-spacing: 1.2px;
      }
      .fs-chap-lead {
        font-size: 12px; color: var(--fs-text-dim); line-height: 1.55;
        margin: 0 2px 12px 2px;
      }

      /* ── Polished stat trio (mockup) ──
         Genel sekmesindeki Kazanç/Kayıp/Berabere büyük halkalı ikonlar.
         Yeşil/Kırmızı/Sarı halka + büyük rakam + KÜÇÜK label. */
      .fs-stat-rich-row {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
        margin-bottom: 4px;
      }
      .fs-stat-rich {
        background: var(--fs-bg-elev); border-radius: var(--fs-radius);
        padding: 12px 6px 10px 6px; text-align: center;
        display: flex; flex-direction: column; align-items: center; gap: 4px;
      }
      .fs-stat-ring {
        width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
        border: 2px solid currentColor;
        background: rgba(255,255,255,0.02);
      }
      .fs-stat-rich .fs-stat-val {
        font-size: 22px; font-weight: 800; color: inherit;
      }
      .fs-stat-rich .fs-stat-lab {
        font-size: 9px; color: var(--fs-text-dim);
        text-transform: uppercase; letter-spacing: .6px;
      }

      /* ── Weakness ── */
      .fs-weak-intro {
        font-size: 12px; color: var(--fs-text-dim); line-height: 1.5;
        margin: 0 2px 10px 2px;
      }
      .fs-weak-row {
        background: var(--fs-bg-elev); border-radius: var(--fs-radius);
        padding: 12px 14px; margin-bottom: 10px;
        border-left: 3px solid var(--fs-bad);
      }
      .fs-weak-head {
        display: flex; justify-content: space-between; align-items: baseline;
        gap: 8px; margin-bottom: 4px;
      }
      .fs-weak-name { font-weight: 700; font-size: 14px; color: var(--fs-text); }
      .fs-weak-rate { font-size: 13px; color: var(--fs-bad); font-weight: 800;
        white-space: nowrap; }
      .fs-weak-family {
        display: inline-block; font-size: 10px; font-weight: 600;
        color: var(--fs-accent); background: var(--fs-accent-dim);
        padding: 2px 8px; border-radius: 999px; margin-bottom: 6px;
        text-transform: uppercase; letter-spacing: .4px;
      }
      .fs-weak-desc {
        font-size: 12px; color: var(--fs-text); line-height: 1.5;
        margin: 4px 0 8px 0;
      }
      .fs-weak-meta { font-size: 11px; color: var(--fs-text-dim); }
      .fs-weak-bar {
        height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px;
        overflow: hidden; margin: 8px 0 10px 0;
      }
      .fs-weak-bar > span { display: block; height: 100%;
        background: linear-gradient(90deg, #ff8a8a, var(--fs-bad)); }
      .fs-weak-refs-lab {
        font-size: 10px; color: var(--fs-text-dim); text-transform: uppercase;
        letter-spacing: .5px; font-weight: 600; margin-bottom: 6px;
      }
      .fs-weak-ref {
        display: flex; align-items: center; gap: 8px;
        background: var(--fs-bg); border-radius: 8px;
        padding: 6px 10px; margin-bottom: 4px;
        font-size: 11px; cursor: pointer; border: 0;
        color: var(--fs-text); text-align: left; width: 100%;
        transition: background .12s ease;
      }
      .fs-weak-ref:hover { background: var(--fs-bg-soft); }
      .fs-weak-ref-ico { font-size: 14px; }
      .fs-weak-ref-txt { flex: 1; }
      .fs-weak-ref-arrow { color: var(--fs-accent); font-weight: 700; }

      .fs-phase-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .fs-phase {
        background: var(--fs-bg-elev); border-radius: var(--fs-radius);
        padding: 10px; text-align: center;
      }
      .fs-phase-lab { font-size: 10px; color: var(--fs-text-dim); text-transform: uppercase; }
      .fs-phase-val { font-size: 20px; font-weight: 700; margin-top: 4px; color: var(--fs-accent); }
      .fs-phase-sub { font-size: 10px; color: var(--fs-text-dim); margin-top: 2px; }
      .fs-phase-tip {
        background: var(--fs-bg-elev); border-radius: var(--fs-radius);
        padding: 10px 12px; margin-top: 8px;
        font-size: 12px; color: var(--fs-text); line-height: 1.5;
        border-left: 3px solid var(--fs-warn);
      }
      .fs-phase-tip b { color: var(--fs-warn); }

      /* ── Settings ── */
      .fs-set-row { margin-bottom: 14px; }
      .fs-set-lab { font-size: 11px; color: var(--fs-text-dim); margin-bottom: 4px; text-transform: uppercase; letter-spacing: .5px; }
      .fs-set-control { display: flex; gap: 6px; align-items: center; }
      .fs-input {
        flex: 1; background: var(--fs-bg-elev); border: 1px solid var(--fs-border);
        color: var(--fs-text); padding: 8px 10px; border-radius: var(--fs-radius);
        font: inherit; outline: none;
      }
      .fs-input:focus { border-color: var(--fs-accent); }
      .fs-btn {
        background: var(--fs-accent); color: #1a1d24;
        border: 0; border-radius: var(--fs-radius);
        padding: 8px 14px; font-weight: 700; cursor: pointer;
        font: inherit; font-weight: 700;
      }
      .fs-btn:disabled { opacity: .6; cursor: wait; }
      .fs-btn.fs-ghost { background: transparent; color: var(--fs-text); border: 1px solid var(--fs-border); }
      .fs-btn.fs-danger { background: var(--fs-bad); color: #fff; }
      .fs-msg { font-size: 11px; margin-top: 6px; }
      .fs-msg.fs-ok { color: var(--fs-good); }
      .fs-msg.fs-err { color: var(--fs-bad); }
      .fs-empty {
        text-align: center; color: var(--fs-text-dim); font-size: 12px;
        padding: 30px 16px;
      }
      .fs-spinner {
        width: 22px; height: 22px; border: 2px solid var(--fs-border);
        border-top-color: var(--fs-accent); border-radius: 50%;
        margin: 30px auto; animation: fs-spin 1s linear infinite;
      }
      @keyframes fs-spin { to { transform: rotate(360deg); } }

      /* ── Bulmacalar sekmesi ── */
      .fs-quiz-wrap {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 168px;
        gap: 12px;
        align-items: start;
      }
      .fs-quiz-main { min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .fs-quiz-chips { display: flex; flex-wrap: wrap; gap: 5px; }
      .fs-quiz-chip {
        font-size: 10px; font-weight: 700; letter-spacing: .5px;
        padding: 3px 8px; border-radius: 999px;
        background: rgba(245,197,24,.12); color: var(--fs-accent);
        border: 1px solid rgba(245,197,24,.25);
        text-transform: uppercase;
      }
      .fs-quiz-chip.fs-quiz-chip-new { background: rgba(111,207,111,.12); color: var(--fs-good); border-color: rgba(111,207,111,.3); }
      .fs-quiz-board-host {
        width: 100%;
        max-width: 320px;
        margin: 0 auto;
      }
      .fs-quiz-hintbar {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        font-size: 11px;
      }
      .fs-quiz-timer {
        font-variant-numeric: tabular-nums;
        padding: 3px 8px; border-radius: 6px;
        background: var(--fs-bg-elev); color: var(--fs-text-dim);
      }
      .fs-quiz-hint-btn {
        font-size: 11px; padding: 4px 8px; border-radius: 6px;
        background: transparent; color: var(--fs-warn);
        border: 1px solid rgba(245,197,24,.35);
        cursor: pointer; font-weight: 600;
      }
      .fs-quiz-hint-btn:hover:not(:disabled) { background: rgba(245,197,24,.1); }
      .fs-quiz-hint-btn:disabled { opacity: .45; cursor: not-allowed; }
      .fs-quiz-hint-btn.fs-active { background: var(--fs-warn); color: #1a1d24; }
      .fs-quiz-hint-status { flex: 1 1 100%; color: var(--fs-text-dim); font-size: 10px; min-height: 12px; }
      .fs-quiz-answer { display: flex; gap: 6px; }
      .fs-quiz-input {
        flex: 1; padding: 6px 8px; border-radius: 6px;
        background: var(--fs-bg-elev); color: var(--fs-text);
        border: 1px solid var(--fs-border); font-size: 12px;
        font-family: ui-monospace, monospace;
      }
      .fs-quiz-input:focus { outline: 0; border-color: var(--fs-accent); }
      .fs-quiz-meta { font-size: 10px; color: var(--fs-text-dim); }
      .fs-quiz-flash { font-size: 12px; min-height: 14px; padding: 2px 0; }
      .fs-quiz-flash.fs-ok { color: var(--fs-good); }
      .fs-quiz-flash.fs-err { color: var(--fs-bad); }
      .fs-quiz-flash.fs-info { color: var(--fs-text-dim); }
      .fs-quiz-side { display: flex; flex-direction: column; gap: 10px; }
      .fs-quiz-stats {
        background: var(--fs-bg-elev); border-radius: 10px;
        padding: 10px; display: grid; grid-template-columns: 1fr 1fr;
        gap: 6px;
      }
      .fs-quiz-stat { text-align: center; padding: 4px 2px; }
      .fs-quiz-stat-val { font-size: 16px; font-weight: 700; color: var(--fs-accent); }
      .fs-quiz-rd {
        font-size: 9px; font-weight: 600; color: var(--fs-text-dim);
        margin-left: 3px; vertical-align: middle; letter-spacing: .2px;
      }
      .fs-quiz-themes {
        display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
      }
      .fs-quiz-theme {
        padding: 6px 8px; border-radius: 8px;
        background: var(--fs-bg-elev); border: 1px solid var(--fs-border);
        display: flex; flex-direction: column; gap: 2px; min-width: 0;
        cursor: pointer; user-select: none;
        transition: transform .08s ease, border-color .12s ease;
      }
      .fs-quiz-theme:hover { transform: translateY(-1px); border-color: var(--fs-accent); }
      .fs-quiz-theme.fs-th-active {
        outline: 2px solid var(--fs-accent);
        outline-offset: -1px;
      }
      .fs-quiz-theme-lab {
        font-size: 10px; color: var(--fs-text-dim); font-weight: 600;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .fs-quiz-theme-val {
        font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums;
      }
      .fs-quiz-theme-sub { font-size: 9px; color: var(--fs-text-dim); }
      .fs-quiz-theme.fs-th-good { border-color: rgba(111,207,111,.4); }
      .fs-quiz-theme.fs-th-good .fs-quiz-theme-val { color: var(--fs-good); }
      .fs-quiz-theme.fs-th-warn { border-color: rgba(245,197,24,.35); }
      .fs-quiz-theme.fs-th-warn .fs-quiz-theme-val { color: var(--fs-warn); }
      .fs-quiz-theme.fs-th-bad { border-color: rgba(232,87,87,.4); }
      .fs-quiz-theme.fs-th-bad .fs-quiz-theme-val { color: var(--fs-bad, #e85757); }
      .fs-quiz-theme-banner {
        display: flex; align-items: center; gap: 8px;
        padding: 7px 10px; margin: 6px 0;
        border-radius: 8px;
        background: rgba(80,160,255,.10);
        border: 1px solid rgba(80,160,255,.35);
        font-size: 12px;
      }
      .fs-quiz-theme-banner-lbl { flex: 1; }
      .fs-quiz-theme-banner-cnt { color: var(--fs-text-dim); font-size: 11px; }
      .fs-quiz-theme-banner-x {
        background: transparent; color: var(--fs-text-dim);
        border: 1px solid var(--fs-border); border-radius: 6px;
        padding: 2px 7px; cursor: pointer; font-size: 11px;
      }
      .fs-quiz-theme-banner-x:hover { color: var(--fs-text); border-color: var(--fs-accent); }
      /* Faz 2.3: Günlük Mücadele kartı */
      .fs-quiz-daily {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 12px; margin: 4px 0 0 0;
        background: linear-gradient(135deg, rgba(255,193,7,.10), rgba(255,87,34,.08));
        border: 1px solid rgba(255,193,7,.35);
        border-radius: 10px;
        text-align: left; color: inherit; cursor: pointer;
        font-family: inherit;
        transition: transform .12s ease, border-color .12s ease;
      }
      .fs-quiz-daily:hover:not([disabled]) { transform: translateY(-1px); border-color: rgba(255,193,7,.6); }
      .fs-quiz-daily[disabled] { opacity: .5; cursor: not-allowed; }
      .fs-quiz-daily.fs-done { background: linear-gradient(135deg, rgba(76,175,80,.10), rgba(56,142,60,.08)); border-color: rgba(76,175,80,.4); }
      .fs-quiz-daily-head { display: flex; flex-direction: column; gap: 2px; }
      .fs-quiz-daily-title { font-size: 13px; font-weight: 700; }
      .fs-quiz-daily-sub { font-size: 11px; color: var(--fs-text-dim); }
      .fs-quiz-daily-dots { display: flex; gap: 4px; }
      .fs-quiz-daily-dot {
        width: 10px; height: 10px; border-radius: 50%;
        background: rgba(255,255,255,.12);
        border: 1px solid rgba(255,255,255,.18);
      }
      .fs-quiz-daily-dot.fs-ok { background: #4caf50; border-color: #4caf50; box-shadow: 0 0 6px rgba(76,175,80,.5); }
      .fs-quiz-stat-lab { font-size: 9px; color: var(--fs-text-dim); text-transform: uppercase; letter-spacing: .5px; }
      .fs-quiz-actions { display: flex; flex-direction: column; gap: 6px; }
      .fs-quiz-actions .fs-btn { width: 100%; font-size: 12px; padding: 7px 10px; }

      /* Lobby */
      .fs-quiz-lobby { display: flex; flex-direction: column; gap: 12px; }
      .fs-quiz-lobby-head { padding: 4px 0 2px 0; }
      .fs-quiz-lobby-title { font-size: 18px; font-weight: 700; }
      .fs-quiz-lobby-sub { font-size: 12px; color: var(--fs-text-dim); margin-top: 3px; }
      .fs-quiz-lobby-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .fs-quiz-lobby-actions .fs-btn { flex: 1 1 0; min-width: 140px; padding: 10px 14px; font-size: 13px; }
      .fs-quiz-start { font-weight: 700; }
      .fs-quiz-bf {
        display: flex; flex-direction: column; gap: 6px;
        padding: 8px 10px;
        background: var(--fs-bg-elev);
        border: 1px solid var(--fs-border);
        border-radius: 10px;
      }
      .fs-quiz-bf-head {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 11px; color: var(--fs-text-dim);
        font-weight: 600; letter-spacing: .3px;
      }
      .fs-quiz-bf-num { font-variant-numeric: tabular-nums; color: var(--fs-text); }
      .fs-quiz-bf-bar {
        height: 6px;
        background: var(--fs-bg-soft, rgba(255,255,255,.05));
        border-radius: 3px;
        overflow: hidden;
      }
      .fs-quiz-bf-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--fs-accent), #ffd35c);
        transition: width .4s ease;
      }
      /* Belirsiz (indeterminate) ilerleme: süre kestirilemediğinden
         (motor hızına bağlı) kayan animasyon gösterilir. */
      .fs-quiz-bf-indeterminate .fs-quiz-bf-fill {
        width: 40%;
        border-radius: 3px;
        animation: fs-bf-slide 1.3s ease-in-out infinite;
      }
      @keyframes fs-bf-slide {
        0% { margin-left: -40%; }
        100% { margin-left: 100%; }
      }
      .fs-quiz-daily {
        display: flex; flex-direction: column; gap: 6px;
        padding: 10px 12px;
        background: linear-gradient(135deg, rgba(245,197,24,.08), rgba(245,197,24,.02));
        border: 1px solid rgba(245,197,24,.22);
        border-radius: 10px;
      }
      .fs-quiz-daily.fs-done {
        background: linear-gradient(135deg, rgba(111,207,111,.12), rgba(111,207,111,.02));
        border-color: rgba(111,207,111,.35);
      }
      .fs-quiz-daily-row {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; font-weight: 700; color: var(--fs-text);
      }
      .fs-quiz-daily-streak {
        font-size: 13px; color: var(--fs-warn); display: flex; align-items: center; gap: 4px;
      }
      .fs-quiz-daily.fs-done .fs-quiz-daily-streak { color: var(--fs-good); }
      .fs-quiz-daily-streak span { font-size: 10px; color: var(--fs-text-dim); font-weight: 500; }
      .fs-quiz-daily-bar {
        height: 6px;
        background: rgba(255,255,255,.06);
        border-radius: 3px;
        overflow: hidden;
      }
      .fs-quiz-daily-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--fs-accent), #ffd35c);
        transition: width .5s ease;
      }
      .fs-quiz-daily.fs-done .fs-quiz-daily-fill {
        background: linear-gradient(90deg, var(--fs-good), #9ee69e);
      }
      .fs-quiz-daily-sub {
        font-size: 10px; color: var(--fs-text-dim); display: flex; gap: 6px;
        align-items: center; flex-wrap: wrap;
      }
      .fs-quiz-due-chip {
        font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px;
        background: rgba(120,180,255,.12); color: #aac8ff;
        border: 1px solid rgba(120,180,255,.3); margin-left: auto;
      }
      .fs-quiz-section-title { font-size: 11px; font-weight: 700; color: var(--fs-text-dim); text-transform: uppercase; letter-spacing: .5px; margin-top: 4px; }
      .fs-quiz-history { display: grid; grid-template-columns: 1fr; gap: 4px; max-height: 180px; overflow-y: auto; }
      .fs-quiz-hist-item {
        display: grid;
        grid-template-columns: 22px 1fr 60px 50px;
        align-items: center;
        gap: 8px;
        padding: 7px 10px; border-radius: 8px;
        background: var(--fs-bg-elev);
        border: 1px solid var(--fs-border);
        color: var(--fs-text);
        font-size: 12px;
        cursor: pointer; text-align: left;
        transition: background .15s ease;
      }
      .fs-quiz-hist-item:hover { background: rgba(255,255,255,.06); }
      .fs-quiz-hist-item .fs-quiz-hist-ico { font-weight: 700; font-size: 14px; text-align: center; }
      .fs-quiz-hist-item.fs-ok .fs-quiz-hist-ico { color: var(--fs-good); }
      .fs-quiz-hist-item.fs-err .fs-quiz-hist-ico { color: var(--fs-bad); }
      .fs-quiz-hist-type { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: var(--fs-text-dim); }
      .fs-quiz-hist-time { color: var(--fs-text-dim); font-variant-numeric: tabular-nums; font-size: 11px; text-align: right; }
      .fs-quiz-hist-pts { font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
      .fs-quiz-hist-item.fs-ok .fs-quiz-hist-pts { color: var(--fs-good); }
      .fs-quiz-hist-item.fs-err .fs-quiz-hist-pts { color: var(--fs-bad); }

      /* Loading */
      .fs-quiz-loading { text-align: center; padding: 30px 16px; }
      .fs-quiz-loading-title { font-size: 14px; font-weight: 600; color: var(--fs-text); }
      .fs-quiz-loading-sub { font-size: 12px; color: var(--fs-text-dim); margin-top: 4px; }

      /* Solving / preview üst bar */
      .fs-quiz-topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .fs-quiz-back {
        background: transparent; border: 1px solid var(--fs-border);
        color: var(--fs-text-dim); cursor: pointer;
        padding: 4px 10px; border-radius: 8px; font-size: 11px;
      }
      .fs-quiz-back:hover { color: var(--fs-text); background: var(--fs-bg-elev); }

      /* Preview */
      .fs-quiz-chip-readonly { background: rgba(150,150,150,.18); color: var(--fs-text-dim); border-color: rgba(150,150,150,.3); }
      .fs-quiz-chip-bad { background: rgba(255,107,107,.15); color: var(--fs-bad); border-color: rgba(255,107,107,.3); }
      .fs-quiz-preview-info { font-size: 12px; color: var(--fs-text); padding: 4px 2px; }
      .fs-quiz-preview-row { padding: 3px 0; }
      .fs-quiz-preview-lab { font-weight: 600; color: var(--fs-text-dim); margin-right: 6px; }
      .fs-quiz-sol-mv { font-family: ui-monospace, monospace; background: var(--fs-bg-elev); padding: 2px 6px; border-radius: 4px; margin-right: 4px; }

      /* ── Solver v2 layout (Chess.com benzeri) ── */
      .fs-quizv2 {
        display: flex; flex-direction: column;
        gap: 8px;
        height: 100%;
        min-height: 0;
      }
      .fs-quizv2-topbar {
        display: flex; align-items: center; gap: 10px;
        flex-wrap: wrap;
        padding: 2px 0 6px 0;
        border-bottom: 1px solid var(--fs-border);
      }
      .fs-quizv2-topchips { display: flex; flex-wrap: wrap; gap: 5px; flex: 1 1 auto; }
      .fs-quizv2-hintbtns { display: flex; gap: 5px; }
      .fs-quizv2-hintbtns .fs-quiz-hint-btn { padding: 5px 9px; font-size: 12px; }
      .fs-quiz-chip-cat { background: rgba(245,197,24,.18); color: var(--fs-accent); border-color: rgba(245,197,24,.35); }
      .fs-quiz-chip-reward { background: rgba(111,207,111,.15); color: var(--fs-good); border-color: rgba(111,207,111,.3); }
      .fs-quiz-chip-timer {
        background: var(--fs-bg-elev); color: var(--fs-text);
        border-color: var(--fs-border);
        font-variant-numeric: tabular-nums;
        font-family: ui-monospace, monospace;
      }

      .fs-quizv2-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 260px;
        gap: 14px;
        min-height: 0;
        flex: 1 1 auto;
      }
      .fs-quizv2-board {
        align-self: start;
        width: 100%;
        max-width: min(540px, calc(96vh - 200px));
        justify-self: center;
      }
      .fs-quizv2-board .fsq-board-root { max-width: none !important; }
      .fs-quizv2-boardcol {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .fs-quizv2-gamelink {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 14px;
        background: var(--fs-bg-elev);
        border: 1px solid var(--fs-border);
        border-radius: 10px;
        color: var(--fs-text);
        font-size: 12px; font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: background .15s, border-color .15s, transform .05s;
      }
      .fs-quizv2-gamelink:hover {
        background: var(--fs-bg-soft);
        border-color: var(--fs-accent);
        color: var(--fs-accent);
      }
      .fs-quizv2-gamelink:active { transform: translateY(1px); }
      .fs-quizv2-gamelink svg { flex: 0 0 auto; }
      .fs-quizv2-side {
        display: flex; flex-direction: column; gap: 10px;
        min-height: 0;
        overflow: hidden;
      }
      .fs-quizv2-coach {
        display: flex; gap: 10px; align-items: flex-start;
        background: var(--fs-bg-elev);
        border: 1px solid var(--fs-border);
        border-radius: 12px;
        padding: 10px;
      }
      .fs-quizv2-coach-av {
        width: 44px; height: 44px; border-radius: 50%;
        flex: 0 0 auto;
        background: var(--fs-bg-soft);
        object-fit: cover;
      }
      .fs-quizv2-coach-bubble { flex: 1 1 auto; min-width: 0; }
      .fs-quizv2-coach-title {
        font-size: 10px; font-weight: 700; text-transform: uppercase;
        letter-spacing: .5px; color: var(--fs-text-dim);
      }
      .fs-quizv2-coach-text {
        font-size: 13px; line-height: 1.35; color: var(--fs-text);
        margin-top: 3px;
      }
      .fs-quizv2-section {
        font-size: 10px; font-weight: 700; letter-spacing: .5px;
        color: var(--fs-text-dim); text-transform: uppercase;
        margin-top: 4px;
      }
      .fs-quiz-moves-list {
        display: flex; flex-direction: column;
        gap: 2px;
        overflow-y: auto;
        max-height: 220px;
        background: var(--fs-bg-elev);
        border: 1px solid var(--fs-border);
        border-radius: 10px;
        padding: 6px 8px;
      }
      .fs-quiz-moverow {
        display: grid;
        grid-template-columns: 28px 1fr 1fr;
        gap: 6px;
        align-items: center;
        font-size: 12px;
        padding: 2px 2px;
        border-radius: 4px;
      }
      .fs-quiz-moverow:hover { background: rgba(255,255,255,.03); }
      .fs-quiz-moveno { color: var(--fs-text-dim); font-variant-numeric: tabular-nums; font-size: 11px; }
      .fs-quiz-movecell { font-family: ui-monospace, monospace; }
      .fs-quiz-moverow-turn { background: rgba(245,197,24,.06); }
      .fs-quiz-moves-empty {
        font-size: 11px; color: var(--fs-text-dim);
        padding: 8px; text-align: center;
        background: var(--fs-bg-elev); border-radius: 8px;
      }
      .fs-quizv2-hintstatus { font-size: 11px; color: var(--fs-text-dim); min-height: 14px; }
      .fs-quizv2-actions { display: flex; gap: 6px; }
      .fs-quizv2-actions .fs-btn { flex: 1; font-size: 12px; padding: 7px 10px; }
      .fs-quizv2-sol {
        background: var(--fs-bg-elev); border: 1px solid var(--fs-border);
        border-radius: 8px; padding: 8px;
        display: flex; flex-wrap: wrap; gap: 4px;
      }

      /* ─── Faz 3.1: Başarımlar & Liderlik ─── */
      .fs-ach-summary {
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 14px; margin-bottom: 12px;
        background: var(--fs-bg-elev); border-radius: 10px;
        border: 1px solid var(--fs-border);
      }
      .fs-ach-summary-num { font-size: 18px; font-weight: 700; color: var(--fs-accent); }
      .fs-ach-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 10px;
      }
      .fs-ach-card {
        background: var(--fs-bg-elev); border: 1px solid var(--fs-border);
        border-radius: 10px; padding: 10px;
        display: flex; flex-direction: column; gap: 6px;
        min-height: 110px; position: relative;
        transition: transform .1s ease, border-color .12s ease;
      }
      .fs-ach-card.fs-ach-locked { opacity: .55; filter: grayscale(.6); }
      .fs-ach-card.fs-ach-earned { border-color: rgba(245,197,24,.5); box-shadow: 0 0 0 1px rgba(245,197,24,.2) inset; }
      .fs-ach-card.fs-ach-earned:hover { transform: translateY(-2px); }
      .fs-ach-ico { font-size: 28px; line-height: 1; }
      .fs-ach-row { display: flex; align-items: center; gap: 8px; }
      .fs-ach-name { font-weight: 700; font-size: 12px; color: var(--fs-text); }
      .fs-ach-desc { font-size: 11px; color: var(--fs-text-dim); flex: 1; }
      .fs-ach-tier {
        position: absolute; top: 6px; right: 8px;
        font-size: 9px; font-weight: 700; letter-spacing: .5px;
        padding: 2px 6px; border-radius: 999px;
        text-transform: uppercase;
        background: rgba(255,255,255,.06); color: var(--fs-text-dim);
      }
      .fs-ach-tier-bronze   { color:#cd7f32; background: rgba(205,127,50,.12); }
      .fs-ach-tier-silver   { color:#c0c0c0; background: rgba(192,192,192,.12); }
      .fs-ach-tier-gold     { color:#f5c518; background: rgba(245,197,24,.14); }
      .fs-ach-tier-platinum { color:#7fd3ff; background: rgba(127,211,255,.14); }
      .fs-ach-tier-diamond  { color:#b9a8ff; background: rgba(185,168,255,.14); }
      .fs-ach-prog {
        width: 100%; height: 6px; border-radius: 999px;
        background: rgba(255,255,255,.06); overflow: hidden;
      }
      .fs-ach-prog-bar {
        height: 100%; background: linear-gradient(90deg, var(--fs-accent), #f5d966);
        border-radius: 999px; transition: width .25s ease;
      }
      .fs-ach-prog-txt { font-size: 10px; color: var(--fs-text-dim); text-align: right; }

      /* Toast */
      .fs-ach-toast-host {
        position: fixed; right: 20px; bottom: 20px;
        display: flex; flex-direction: column; gap: 8px;
        z-index: 2147483647; pointer-events: none;
      }
      .fs-ach-toast {
        background: linear-gradient(135deg, #2a2620 0%, #1d1f25 100%);
        border: 1px solid rgba(245,197,24,.45);
        border-radius: 10px; padding: 10px 14px;
        display: flex; align-items: center; gap: 10px;
        min-width: 240px; max-width: 340px;
        box-shadow: 0 8px 32px rgba(0,0,0,.45);
        color: #f5e9c8;
        animation: fsAchSlideIn .25s ease-out;
        pointer-events: auto;
      }
      .fs-ach-toast-ico { font-size: 28px; line-height: 1; }
      .fs-ach-toast-body { flex: 1; }
      .fs-ach-toast-title { font-size: 11px; color: var(--fs-accent); font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
      .fs-ach-toast-name { font-size: 14px; font-weight: 700; color: #fff; }
      .fs-ach-toast-desc { font-size: 11px; color: rgba(255,255,255,.65); }
      @keyframes fsAchSlideIn { from { transform: translateX(120%); opacity: 0; } to { transform: none; opacity: 1; } }
      @keyframes fsAchSlideOut { to { transform: translateX(120%); opacity: 0; } }

      /* Leaderboard */
      .fs-lb-tabs {
        display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 12px;
      }
      .fs-lb-tab {
        font-size: 11px; padding: 5px 10px; border-radius: 999px;
        background: var(--fs-bg-elev); color: var(--fs-text-dim);
        border: 1px solid var(--fs-border); cursor: pointer;
      }
      .fs-lb-tab.fs-active { background: var(--fs-accent); color: #1a1d24; border-color: var(--fs-accent); font-weight: 700; }
      .fs-lb-me {
        background: rgba(245,197,24,.08); border: 1px solid rgba(245,197,24,.35);
        border-radius: 10px; padding: 10px 14px; margin-bottom: 10px;
        display: flex; align-items: center; gap: 10px;
      }
      .fs-lb-me-rank { font-size: 18px; font-weight: 700; color: var(--fs-accent); min-width: 36px; }
      .fs-lb-me-name { flex: 1; font-weight: 600; }
      .fs-lb-me-val { font-variant-numeric: tabular-nums; font-weight: 700; }
      .fs-lb-table {
        background: var(--fs-bg-elev); border-radius: 10px;
        border: 1px solid var(--fs-border); overflow: hidden;
      }
      .fs-lb-row {
        display: grid; grid-template-columns: 40px 1fr 80px;
        align-items: center; padding: 7px 12px;
        border-top: 1px solid var(--fs-border); font-size: 12px;
      }
      .fs-lb-row:first-child { border-top: 0; }
      .fs-lb-row.fs-lb-me-row { background: rgba(245,197,24,.06); }
      .fs-lb-rank { color: var(--fs-text-dim); font-weight: 600; font-variant-numeric: tabular-nums; }
      .fs-lb-rank-1 { color: #f5c518; }
      .fs-lb-rank-2 { color: #c0c0c0; }
      .fs-lb-rank-3 { color: #cd7f32; }
      .fs-lb-name { color: var(--fs-text); }
      .fs-lb-val { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--fs-accent); }
    `;
  }

  // ─── Tab içerikleri ───────────────────────────────────
  function renderLoading() {
    return '<div class="fs-spinner"></div>';
  }

  // ─── Quota rozeti (profil tab altında günlük kullanım) ───
  // /me/quota cevabından bir özet kart üretir. Sınırsız (Premium) için
  // sadece "Sınırsız" yazar; Free için progress bar + "Premium'a Geç" CTA.
  function renderQuotaStrip() {
    const q = cache.quota;
    if (!q) return ""; // sessizce atla; veri yüklenince re-render olur
    const isPrem = !!q.is_premium;
    const tier = q.tier || (isPrem ? "diamond" : "free");
    const isTr = !(
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
    );
    // Süreli üyelikse "· N gün" eki (sınırsız/abonelik için premium_until null).
    let daysSuffix = "";
    if (isPrem && q.premium_until) {
      const now =
        q.server_time && q.server_time > 0 ? q.server_time : Date.now() / 1000;
      const days = Math.ceil((Number(q.premium_until) - now) / 86400);
      if (days > 0) daysSuffix = isTr ? ` · ${days} gün` : ` · ${days}d`;
    }
    const FEATURE_LABELS = {
      tts_chars: isPrem
        ? T("Koç sesi (karakter / gün)")
        : T("Koç sesi (karakter / gün)"),
      game_analysis: T("Oyun sonrası analiz / gün"),
      coach_review: T("Sesli koç review / hafta"),
      quiz_play: T("Bulmaca oynama / gün"),
      hint: T("Puzzle ipucu / gün"),
    };
    const order = [
      "tts_chars",
      "game_analysis",
      "coach_review",
      "quiz_play",
      "hint",
    ];
    const items = order
      .map((key) => {
        const f = q.features?.[key];
        if (!f) return "";
        const lab = FEATURE_LABELS[key] || key;
        const limit = Number(f.limit);
        const used = Number(f.used || 0);
        // limit = -1 → sınırsız; limit = 0 → kapalı (Premium gerektirir)
        if (limit < 0) {
          return `<div class="fs-quota-item">
            <div class="fs-quota-item-row">
              <span class="fs-quota-item-lab">${esc(lab)}</span>
              <span class="fs-quota-item-val">${T("Sınırsız")}</span>
            </div>
          </div>`;
        }
        if (limit === 0) {
          return `<div class="fs-quota-item">
            <div class="fs-quota-item-row">
              <span class="fs-quota-item-lab">${esc(lab)}</span>
              <span class="fs-quota-item-val">${T("Premium gerekli")}</span>
            </div>
            <div class="fs-quota-bar"><div class="fs-quota-bar-fill fs-full" style="width:100%"></div></div>
          </div>`;
        }
        const pct = Math.max(
          0,
          Math.min(100, Math.round((used / limit) * 100)),
        );
        const cls = pct >= 100 ? "fs-full" : pct >= 75 ? "fs-warn" : "";
        return `<div class="fs-quota-item">
          <div class="fs-quota-item-row">
            <span class="fs-quota-item-lab">${esc(lab)}</span>
            <span class="fs-quota-item-val">${esc(used)} / ${esc(limit)}</span>
          </div>
          <div class="fs-quota-bar"><div class="fs-quota-bar-fill ${cls}" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join("");
    const badge = isPrem
      ? tier === "gold"
        ? `<span class="fs-quota-badge fs-prem">★ ${T("Gold")}${daysSuffix}</span>`
        : `<span class="fs-quota-badge fs-prem">💎 ${T("Diamond")}${daysSuffix}</span>`
      : `<span class="fs-quota-badge">${T("Ücretsiz")}</span>`;
    const upgradeCta = isPrem
      ? ""
      : `<a class="fs-quota-upgrade" href="https://forksight.net/premium" target="_blank" rel="noopener">★ ${T("Premium'a Geç — Sınırsız Kullan")}</a>`;
    return `<div class="fs-quota-strip ${isPrem ? "fs-quota-premium" : ""}">
      <div class="fs-quota-head">
        <span>${T("BUGÜNKÜ KULLANIM")}</span>
        ${badge}
      </div>
      <div class="fs-quota-items">${items}</div>
      ${upgradeCta}
    </div>`;
  }

  function renderProfileTab() {
    const p = cache.profile;
    if (!p) return renderLoading();
    if (!p.user) {
      return `<div class="fs-empty">${T("Profil bilgisi alınamadı.")}</div>`;
    }
    const u = p.user;
    const stats = p.stats || {};
    const recent = (p.recent_games || []).slice(0, 4);
    const av = u.chess_com_avatar
      ? `style="background-image:url('${esc(u.chess_com_avatar)}')"`
      : "";
    const displayName = esc(u.username || "?");
    const ccu = u.chess_com_username
      ? `chess.com: ${esc(u.chess_com_username)}`
      : T("Chess.com hesabı bağlı değil");
    const streak = u.streak_count || 0;
    const highRating = u.highest_rating || "—";

    return `
      <div class="fs-prof-head">
        <div class="fs-prof-avatar-wrap">
          <div class="fs-prof-avatar" ${av}></div>
        </div>
        <div class="fs-prof-bubble">${esc(dailyMessage(streak))}</div>
      </div>
      <div class="fs-prof-id">
        <div class="fs-prof-name">${displayName}</div>
        <div class="fs-prof-ccu">${ccu}</div>
      </div>
      <div class="fs-stat-row">
        <div class="fs-stat">
          <div class="fs-stat-val">${highRating}</div>
          <div class="fs-stat-lab">${T("EN YÜKSEK")}</div>
        </div>
        <div class="fs-stat">
          <div class="fs-stat-val">🔥 ${streak}</div>
          <div class="fs-stat-lab">${T("GÜNLÜK SERİ")}</div>
        </div>
        <div class="fs-stat">
          <div class="fs-stat-val">${stats.total_games || 0}</div>
          <div class="fs-stat-lab">${T("TOPLAM")}</div>
        </div>
      </div>
      ${renderQuotaStrip()}
      <div class="fs-section-title">
        <span>${T("Son Oyunlar")}</span>
        <button class="fs-link-btn" data-act="more-games">${T("Daha fazla →")}</button>
      </div>
      ${
        recent.length
          ? `<div class="fs-game-grid">${recent.map(gameThumbHTML).join("")}</div>`
          : `<div class="fs-empty">${T("Henüz oyun çekilmedi.")}<br>${
              window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
                ? "You can link your Chess.com account from Settings."
                : "Chess.com hesabını Ayarlar'dan bağlayabilirsin."
            }</div>`
      }
    `;
  }

  function renderGamesTab() {
    const g = cache.games;
    const f = g.filter;
    const chip = (val, lab, key) =>
      `<button class="fs-chip ${f[key] === val ? "fs-on" : ""}" data-filter="${key}:${val}">${esc(lab)}</button>`;
    let html = `
      <div class="fs-chips">
        ${chip("", T("Tümü"), "result")}
        ${chip("win", T("Kazandı"), "result")}
        ${chip("loss", T("Kaybetti"), "result")}
        ${chip("draw", T("Beraberlik"), "result")}
      </div>
      <div class="fs-chips">
        ${chip("", T("Hepsi"), "time_class")}
        ${chip("bullet", "Bullet", "time_class")}
        ${chip("blitz", "Blitz", "time_class")}
        ${chip("rapid", "Rapid", "time_class")}
        ${chip("daily", "Daily", "time_class")}
      </div>
    `;
    if (!g.items.length) {
      html += `<div class="fs-empty">${
        window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
          ? "No matching games."
          : "Eşleşen oyun yok."
      }</div>`;
    } else {
      html += `<div class="fs-game-grid">${g.items.map(gameThumbHTML).join("")}</div>`;
      if (g.hasMore) {
        html += `<div style="text-align:center;margin-top:12px"><button class="fs-btn fs-ghost" data-act="load-more">${T("Daha fazla yükle")}</button></div>`;
      }
    }
    return html;
  }

  // ─── Açılış / Faz açıklama yardımcıları ──────────────
  // ECO kodunun ilk harfine göre açılış ailesini sınıflandır (chess.com /
  // FIDE konvansiyonu). Bu sayede "C55" yerine "Açık Oyun · İtalyan"
  // gibi yeni başlayanın anlayacağı bir etiket gösterebiliyoruz.
  function ecoFamily(eco) {
    if (!eco || typeof eco !== "string") return T("Açılış");
    const c = eco[0].toUpperCase();
    return (
      {
        A: T("Yan açılış"), // 1.c4, 1.Nf3, düzensiz açılışlar
        B: T("Yarı-açık oyun"), // 1.e4 c5/c6/d6 vb.
        C: T("Açık oyun"), // 1.e4 e5
        D: T("Kapalı oyun"), // 1.d4 d5
        E: T("Hint savunması"), // 1.d4 Nf6
      }[c] || T("Açılış")
    );
  }

  // Açılış adı yoksa ECO koduna göre kısa, didaktik bir cümle üret.
  function ecoExplain(eco) {
    if (!eco) return "";
    const c = eco[0].toUpperCase();
    return (
      {
        A: T(
          "Genelde 1.c4 veya 1.Nf3 ile başlayan düzensiz/yan açılışlar. Merkez kontrolünü kanat taşları ile dengelemeyi gerektirir.",
        ),
        B: T(
          "Beyaz 1.e4 oynar, siyah merkezi simetrik karşılamaz (örn. Sicilyen, Caro-Kann). Yapı planını bilmek kritiktir.",
        ),
        C: T(
          "Klasik 1.e4 e5 açılışları (İtalyan, İspanyol, vs.). Hızlı gelişim ve şah güvenliği esastır.",
        ),
        D: T(
          "1.d4 d5 ile gelen kapalı oyunlar. Piyon yapısı uzun süre kalır, planlı oyun gerekir.",
        ),
        E: T(
          "1.d4 Nf6 ile başlayan Hint savunmaları (King's Indian, Nimzo vb.). Stratejik, manevralı oyun.",
        ),
      }[c] || ""
    );
  }

  // Faz adı + yeni başlayan açıklaması + tavsiye (label/desc/tip T() ile sarılır)
  const PHASE_INFO = {
    opening: {
      label: "Açılış",
      desc: "İlk ~15 hamle. Taşları geliştir, merkeze hâkim ol, şahı roka et.",
      tip: "Çok kaybediyorsan 1-2 açılışı ezberle ve aynısını her oyunda tekrarla.",
    },
    middlegame: {
      label: "Orta Oyun",
      desc: "15-40. hamleler. Plan kur, zayıf kareleri yakala, taktiklere dikkat et.",
      tip: "Hamleden önce 'rakip bana ne yapabilir?' sorusunu sor; bedava taş kayıplarını azaltır.",
    },
    endgame: {
      label: "Son Oyun",
      desc: "40+ hamle. Az taş kaldı; şahı aktif kullan, piyon terfisi öne çıkar.",
      tip: "Şah+vezir mat, K+R mat, K+P son oyun temellerini çalış — kazandığın oyun kaymasını engeller.",
    },
  };

  function renderWeaknessTab() {
    const w = cache.weakness;
    if (!w) return renderLoading();
    const full = w.report || {};
    if (!full.total_games) {
      return `
        <div class="fs-empty">
          ${T("Henüz analiz için yeterli oyun yok.")}<br>
          <span style="font-size:11px;color:var(--fs-text-dim)">
            ${T("Chess.com hesabını bağladıktan sonra son oyunlarına bakacağız.")}
          </span>
        </div>`;
    }
    const groups = full.per_time_class || {};
    const CLASSES = [
      { id: "bullet", label: "Bullet" },
      { id: "blitz", label: "Blitz" },
      { id: "rapid", label: "Rapid" },
      { id: "daily", label: T("Günlük") },
    ];
    // Default: oyun sayısı en yüksek olan sınıf
    let cls = cache.weaknessClass;
    if (!cls || !groups[cls] || !groups[cls].total_games) {
      let best = null;
      let bestN = 0;
      for (const c of CLASSES) {
        const n = (groups[c.id] || {}).total_games || 0;
        if (n > bestN) {
          bestN = n;
          best = c.id;
        }
      }
      cls = best || "blitz";
    }
    const r = groups[cls] || {};
    const classChips = CLASSES.map((c) => {
      const n = (groups[c.id] || {}).total_games || 0;
      const dis = n === 0 ? " fs-chip-dis" : "";
      const on = c.id === cls ? " fs-on" : "";
      return `<button class="fs-chip${on}${dis}" data-weakness-class="${c.id}"${n === 0 ? " disabled" : ""}>
        ${esc(c.label)} <span class="fs-chip-n">${n}</span>
      </button>`;
    }).join("");
    const classBar = `
      <div class="fs-chips fs-chips-weakness">${classChips}</div>
      <div class="fs-chap-lead" style="margin-top:-2px">
        ${T("Bullet, Blitz, Rapid ve Günlük oyunlar farklı tempolarda analiz ediliyor — her havuzun kendi zayıflıkları olur.")}
      </div>`;

    if (!r.total_games) {
      return `
        ${classBar}
        <div class="fs-empty">
          ${T("Bu kategoride henüz yeterli oyun yok.")}
        </div>`;
    }

    const phases = r.weak_phases || {};
    const weak = r.weak_openings || [];

    // ── Faz kartları + en zayıf faz için tavsiye kutusu ──
    const phaseCard = (key) => {
      const info = PHASE_INFO[key] || { label: key };
      const ph = phases[key] || {};
      const rate = Math.round((ph.loss_rate || 0) * 100);
      const color =
        rate >= 50
          ? "var(--fs-bad)"
          : rate >= 35
            ? "var(--fs-warn)"
            : "var(--fs-good)";
      return `
        <div class="fs-phase">
          <div class="fs-phase-lab">${esc(T(info.label))}</div>
          <div class="fs-phase-val" style="color:${color}">${rate}%</div>
          <div class="fs-phase-sub">${ph.games || 0} ${T("oyun")} · ${ph.losses || 0} ${T("kayıp")}</div>
        </div>`;
    };
    // En çok kaybedilen fazı bul (loss_rate * sample) — anlamlı olması için min 3 oyun
    let worstPhase = null;
    let worstScore = 0;
    for (const k of ["opening", "middlegame", "endgame"]) {
      const ph = phases[k] || {};
      if ((ph.games || 0) < 3) continue;
      const sc = (ph.loss_rate || 0) * (ph.games || 0);
      if (sc > worstScore) {
        worstScore = sc;
        worstPhase = k;
      }
    }
    let phaseTip = "";
    if (worstPhase) {
      const info = PHASE_INFO[worstPhase];
      const ph = phases[worstPhase];
      const samples = (ph.samples || []).slice(0, 2);
      const refs = samples
        .map(
          (id) =>
            `<button class="fs-weak-ref" data-game-id="${id}">
              <span class="fs-weak-ref-ico">♟</span>
              <span class="fs-weak-ref-txt">${T("Bu fazda kaybettiğin bir oyun")}</span>
              <span class="fs-weak-ref-arrow">${T("→ İncele")}</span>
            </button>`,
        )
        .join("");
      phaseTip = `
        <div class="fs-phase-tip">
          <b>${esc(T(info.label))}</b> ${T("diğer fazlardan daha çok kaybediyorsun.")}
          ${esc(T(info.desc))}<br>
          <span style="color:var(--fs-text-dim)">💡 ${esc(T(info.tip))}</span>
          ${refs ? `<div style="margin-top:8px">${refs}</div>` : ""}
        </div>`;
    }

    // ── Zayıf açılışlar (kartlar) ──
    const openingsHtml = weak.length
      ? weak
          .map((o) => {
            const pct = Math.round((o.loss_rate || 0) * 100);
            // BACKEND ALANLARI: o.name, o.sample_game_ids (eski kodda yanlış
            // alan isimleri kullanılmıştı, referans oyunlar bu yüzden
            // hiç gözükmüyordu).
            const name = o.name || o.eco || T("Açılış");
            const samples = o.sample_game_ids || [];
            const family = ecoFamily(o.eco);
            const explain = ecoExplain(o.eco);
            const refs = samples
              .slice(0, 3)
              .map(
                (id) =>
                  `<button class="fs-weak-ref" data-game-id="${id}">
                    <span class="fs-weak-ref-ico">♟</span>
                    <span class="fs-weak-ref-txt">${T("Bu açılışla kaybettiğin oyun")}</span>
                    <span class="fs-weak-ref-arrow">${T("→ İncele")}</span>
                  </button>`,
              )
              .join("");
            return `
              <div class="fs-weak-row">
                <span class="fs-weak-family">${esc(family)} · ${esc(o.eco || "?")}</span>
                <div class="fs-weak-head">
                  <span class="fs-weak-name">${esc(name)}</span>
                  <span class="fs-weak-rate">${pct}% ${T("kayıp")}</span>
                </div>
                <div class="fs-weak-meta">${o.games} ${T("oyun oynadın")} · ${o.losses}${T("'inde kaybettin")}</div>
                <div class="fs-weak-bar"><span style="width:${pct}%"></span></div>
                ${explain ? `<div class="fs-weak-desc">${esc(explain)}</div>` : ""}
                ${
                  refs
                    ? `<div class="fs-weak-refs-lab">${T("Referans oyunlar")}</div>${refs}`
                    : `<div class="fs-weak-meta" style="font-style:italic">
                        ${T("Yakın zamanda bu açılışta kaybettiğin oyun bulunamadı.")}
                      </div>`
                }
              </div>`;
          })
          .join("")
      : `<div class="fs-empty" style="padding:14px 0">
          ${T("Henüz zayıf bir açılış tespit edemedik.")}<br>
          <span style="font-size:11px;color:var(--fs-text-dim)">
            ${T("(En az 3 oyun oynanan ve %50'den fazla kaybedilen açılışlar burada gözükür.)")}
          </span>
        </div>`;

    return `
      ${classBar}
      <div class="fs-chap">
        <div class="fs-chap-num">01</div>
        <div class="fs-chap-text">
          <div class="fs-chap-title">${T("Genel")}</div>
          <div class="fs-chap-sub">${esc(CLASSES.find((c) => c.id === cls).label)} · ${r.total_games} ${T("oyun")}</div>
        </div>
      </div>
      <div class="fs-stat-rich-row">
        <div class="fs-stat-rich" style="color:var(--fs-good)">
          <div class="fs-stat-ring">🏆</div>
          <div class="fs-stat-val">${r.wins || 0}</div>
          <div class="fs-stat-lab">${T("Kazanç")}</div>
        </div>
        <div class="fs-stat-rich" style="color:var(--fs-bad)">
          <div class="fs-stat-ring">✕</div>
          <div class="fs-stat-val">${r.losses || 0}</div>
          <div class="fs-stat-lab">${T("Kayıp")}</div>
        </div>
        <div class="fs-stat-rich" style="color:var(--fs-warn)">
          <div class="fs-stat-ring">½</div>
          <div class="fs-stat-val">${r.draws || 0}</div>
          <div class="fs-stat-lab">${T("Berabere")}</div>
        </div>
      </div>

      <div class="fs-chap">
        <div class="fs-chap-num">02</div>
        <div class="fs-chap-text">
          <div class="fs-chap-title">${T("Faz Analizi")}</div>
          <div class="fs-chap-sub">${T("Açılış · Orta · Son oyun")}</div>
        </div>
      </div>
      <div class="fs-chap-lead">
        ${T("Bir satranç partisi üç fazdan oluşur. Hangi fazda ne kadar kaybettiğini gör — yüzde yüksekse o faza çalış.")}
      </div>
      <div class="fs-phase-grid">
        ${phaseCard("opening")}
        ${phaseCard("middlegame")}
        ${phaseCard("endgame")}
      </div>
      ${phaseTip}

      <div class="fs-chap">
        <div class="fs-chap-num">03</div>
        <div class="fs-chap-text">
          <div class="fs-chap-title">${T("Zayıf Açılışlar")}</div>
          <div class="fs-chap-sub">${T("Yarıdan fazla kaybettiklerin")}</div>
        </div>
      </div>
      <div class="fs-chap-lead">
        ${T("Aşağıdaki referans oyunlara tıkla — hangi hamlede yanlış yaptığını koç modülü sana hamle hamle gösterecek.")}
      </div>
      ${openingsHtml}
    `;
  }

  // ─── Bulmacalar (Puzzles) ─────────────────────────────
  function renderPuzzlesTab() {
    const p = cache.puzzles;
    if (p.view === "loading") return renderPuzzlesLoading();
    if (p.view === "solving") return renderPuzzlesSolving();
    if (p.view === "preview") return renderPuzzlesPreview();
    return renderPuzzlesLobby();
  }

  function renderQuizStatsGrid() {
    const p = cache.puzzles;
    const s = p.stats || {};
    const hasDailySet = !!(
      p.daily &&
      Array.isArray(p.daily.puzzles) &&
      p.daily.puzzles.length
    );
    const goal = hasDailySet
      ? Math.max(1, parseInt(p.daily.total ?? 0, 10) || 1)
      : Math.max(1, parseInt(s.daily_goal ?? 5, 10) || 5);
    const done = hasDailySet
      ? Math.max(0, parseInt(p.daily.solved ?? 0, 10) || 0)
      : Math.max(0, parseInt(s.today_solved ?? 0, 10) || 0);
    const pct = Math.min(100, Math.round((done / goal) * 100));
    const reached = done >= goal;
    const dayStreak = parseInt(s.day_streak ?? 0, 10) || 0;
    const bestDayStreak = parseInt(s.best_day_streak ?? 0, 10) || 0;
    const due = parseInt(p.dueCount ?? 0, 10) || 0;
    const goalMsg = reached
      ? T("Bugünkü hedefi tamamladın!")
      : T("Bugün") + ` ${done}/${goal}`;
    const streakMsg =
      dayStreak > 0
        ? dayStreak + " " + T("gün üst üste")
        : T("Bugün başla, seriyi kur");
    const dueChip =
      due > 0
        ? `<span class="fs-quiz-due-chip">${due} ${T("tekrar bekliyor")}</span>`
        : "";
    return `
      <div class="fs-quiz-daily ${reached ? "fs-done" : ""}">
        <div class="fs-quiz-daily-row">
          <div class="fs-quiz-daily-lab">${esc(goalMsg)}</div>
          <div class="fs-quiz-daily-streak">🔥 ${esc(dayStreak)} <span>${esc(T("gün"))}</span></div>
        </div>
        <div class="fs-quiz-daily-bar"><div class="fs-quiz-daily-fill" style="width:${pct}%"></div></div>
        <div class="fs-quiz-daily-sub">${esc(streakMsg)} · ${T("En iyi")}: ${esc(bestDayStreak)} ${dueChip}</div>
      </div>
      <div class="fs-quiz-stats">
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(s.rating ?? 1200)}<span class="fs-quiz-rd">±${esc(Math.round(s.rd ?? 350))}</span></div><div class="fs-quiz-stat-lab">${T("Rating")}</div></div>
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(s.streak ?? 0)}</div><div class="fs-quiz-stat-lab">${T("Seri")}</div></div>
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(s.best_streak ?? 0)}</div><div class="fs-quiz-stat-lab">${T("En İyi")}</div></div>
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(s.solved_cnt ?? 0)}</div><div class="fs-quiz-stat-lab">${T("Çözüm")}</div></div>
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(s.attempt_cnt ?? 0)}</div><div class="fs-quiz-stat-lab">${T("Deneme")}</div></div>
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(p.totalPuzzles ?? 0)}</div><div class="fs-quiz-stat-lab">${T("Toplam")}</div></div>
      </div>
      ${_renderQuizThemes(p.themes)}
    `;
  }

  function _renderQuizThemes(themes) {
    if (!Array.isArray(themes) || themes.length === 0) return "";
    const top = themes.slice(0, 6);
    const activeTheme = (cache.puzzles.themeFilter || "").toLowerCase();
    const cells = top
      .map((t) => {
        const att = Number(t.attempts || 0);
        const acc = Math.round(Number(t.accuracy || 0) * 100);
        // Renk: <50% kırmızı, 50-75 sarı, >75 yeşil
        let cls = "fs-th-warn";
        if (acc >= 75) cls = "fs-th-good";
        else if (acc < 50) cls = "fs-th-bad";
        const themeKey = String(t.theme || "").toLowerCase();
        const isActive = themeKey && themeKey === activeTheme;
        const activeCls = isActive ? " fs-th-active" : "";
        // Etiket: EN modunda key→EN çevirisi (server "label" TR gönderir),
        // çeviri yoksa server label'ına düş.
        const enLabel = themeKey ? T("__theme_" + themeKey + "__") : "";
        const useEn = enLabel && enLabel !== "__theme_" + themeKey + "__";
        const label = esc(useEn ? enLabel : t.label || t.theme);
        return `
        <div class="fs-quiz-theme ${cls}${activeCls}" data-fs-theme="${esc(themeKey)}" data-fs-theme-label="${label}" role="button" tabindex="0" title="${esc(T("Bu temadan çalış"))}">
          <div class="fs-quiz-theme-lab">${label}</div>
          <div class="fs-quiz-theme-val">${acc}%</div>
          <div class="fs-quiz-theme-sub">${att} ${esc(T("deneme"))}</div>
        </div>`;
      })
      .join("");
    return `
      <div class="fs-quiz-section-title">${T("Tema Performansı")}</div>
      <div class="fs-quiz-themes">${cells}</div>`;
  }

  function renderPuzzlesLobby() {
    const p = cache.puzzles;
    const hist = p.history || [];
    const total = p.totalPuzzles || 0;
    const totalGames = p.totalGames || 0;
    const processed = p.processedGames || 0;
    const hasPuzzles = total > 0;
    const noGames = totalGames === 0;

    const histHtml = hist.length
      ? hist
          .map((h, i) => {
            const ok = !!h.correct;
            const tStr =
              h.time_ms != null ? (h.time_ms / 1000).toFixed(1) + "s" : "";
            const typeStr = h.puzzle_type
              ? String(h.puzzle_type).toUpperCase()
              : "";
            const ptsStr =
              h.points_delta != null
                ? (h.points_delta >= 0 ? "+" : "") + h.points_delta
                : "";
            return `
              <button class="fs-quiz-hist-item ${ok ? "fs-ok" : "fs-err"}" data-quiz-hist="${esc(h.puzzle_id)}">
                <span class="fs-quiz-hist-ico">${ok ? "✓" : "✗"}</span>
                <span class="fs-quiz-hist-type">${esc(typeStr)}</span>
                <span class="fs-quiz-hist-time">${esc(tStr)}</span>
                <span class="fs-quiz-hist-pts">${esc(ptsStr)}</span>
              </button>
            `;
          })
          .join("")
      : `<div class="fs-empty" style="padding:14px 8px;font-size:12px">${T("Henüz deneme yok.")}</div>`;

    let lobbyMsg;
    if (noGames) {
      lobbyMsg = T(
        "Önce chess.com hesabını bağla ve oyunlarını senkronize et.",
      );
    } else if (p.backfilling) {
      lobbyMsg = T("Geçmiş oyunlarından bulmaca üretiyoruz…");
    } else if (hasPuzzles) {
      // Net "hazır" mesajı: kaç bulmaca üretildiğini göster (kullanıcı
      // üretimin çalıştığını anlasın).
      lobbyMsg = `${total} ${T("bulmaca hazır — yeni bulmacaya başla!")}`;
    } else {
      lobbyMsg = T(
        "Henüz bulmaca yok. Geçmiş oyunlarından üretmek için aşağıdaki butona bas.",
      );
    }

    // Üretim ilerlemesi: SADECE backfill aktifken göster. "X/50 oyun" metni
    // yanıltıcıydı (her oyundan puzzle çıkmaz → asla 50'ye ulaşmaz, hep
    // "yarım kalmış" görünürdü). Artık üretilen bulmaca sayısını gösteriyoruz.
    let progressHtml = "";
    if (p.backfilling) {
      progressHtml = `
        <div class="fs-quiz-bf">
          <div class="fs-quiz-bf-head">
            <span>⏳ ${T("Üretiliyor")}</span>
            <span class="fs-quiz-bf-num">${total} ${T("bulmaca")}${processed ? " · " + processed + " " + T("oyun") : ""}</span>
          </div>
          <div class="fs-quiz-bf-bar fs-quiz-bf-indeterminate"><div class="fs-quiz-bf-fill"></div></div>
        </div>
      `;
    }

    const startBtnLabel = hasPuzzles
      ? `▶ ${T("Yeni Bulmaca")}`
      : p.backfilling
        ? `⏳ ${T("Hazırlanıyor…")}`
        : `▶ ${T("Yeni Bulmaca")}`;
    const startDisabled = !hasPuzzles ? "disabled" : "";
    const bfDisabled = p.backfilling || noGames ? "disabled" : "";
    const bfLabel = p.backfilling
      ? `⏳ ${T("Üretiliyor…")}`
      : `🧩 ${T("Geçmiş oyunlardan üret")}`;

    // Faz 2.6: aktif tema filtresi banner'ı
    let themeBanner = "";
    if (p.themeFilter) {
      const lbl = esc(p.themeFilterLabel || p.themeFilter);
      const rem = Number(p.themeRemaining || 0);
      themeBanner = `
        <div class="fs-quiz-theme-banner">
          <span class="fs-quiz-theme-banner-lbl">🎯 ${T("Tema")}: <b>${lbl}</b></span>
          <span class="fs-quiz-theme-banner-cnt">${rem} ${T("bulmaca")}</span>
          <button class="fs-quiz-theme-banner-x" data-quiz-act="theme-clear" title="${esc(T("Temizle"))}">✕</button>
        </div>
      `;
    }

    // Faz 2.3: Günlük Mücadele (5'li set)
    let dailyHtml = "";
    const daily = p.daily;
    if (daily && Array.isArray(daily.puzzles) && daily.puzzles.length) {
      const solvedToday = Math.max(
        0,
        parseInt((p.stats && p.stats.today_solved) ?? 0, 10) || 0,
      );
      const visualSolved = Math.max(
        Math.max(0, parseInt(daily.solved ?? 0, 10) || 0),
        solvedToday,
      );
      const visualTotal = Math.max(1, parseInt(daily.total ?? 0, 10) || 1);
      const dots = Array.from({ length: visualTotal })
        .map(
          (_x, i) =>
            `<span class="fs-quiz-daily-dot ${i < visualSolved ? "fs-ok" : ""}"></span>`,
        )
        .join("");
      const done = visualSolved >= visualTotal;
      const subTxt = done
        ? T("Bugünün mücadelesi tamamlandı! 🎉")
        : `${Math.min(visualSolved, visualTotal)}/${visualTotal} ${T("çözüldü")}`;
      dailyHtml = `
        <button class="fs-quiz-daily ${done ? "fs-done" : ""}" data-quiz-act="daily-start" ${hasPuzzles ? "" : "disabled"}>
          <div class="fs-quiz-daily-head">
            <span class="fs-quiz-daily-title">🏆 ${T("Bugünün Mücadelesi")}</span>
            <span class="fs-quiz-daily-sub">${esc(subTxt)}</span>
          </div>
          <div class="fs-quiz-daily-dots">${dots}</div>
        </button>
      `;
    }

    return `
      <div class="fs-quiz-lobby">
        <div class="fs-quiz-lobby-head">
          <div class="fs-quiz-lobby-title">🧩 ${T("Bulmacalar")}</div>
          <div class="fs-quiz-lobby-sub">${esc(lobbyMsg)}</div>
        </div>
        ${renderQuizStatsGrid()}
        ${dailyHtml}
        ${themeBanner}
        ${progressHtml}
        <div class="fs-quiz-lobby-actions">
          <button class="fs-btn fs-quiz-start" data-quiz-act="start" ${startDisabled}>${startBtnLabel}</button>
          <button class="fs-btn fs-ghost" data-quiz-act="backfill" ${bfDisabled}>${bfLabel}</button>
        </div>
        <div class="fs-quiz-section-title">${T("Geçmiş Denemeler")}</div>
        <div class="fs-quiz-history">${histHtml}</div>
      </div>
    `;
  }

  function renderPuzzlesLoading() {
    return `
      <div class="fs-quiz-loading">
        <div class="fs-spinner" style="margin:40px auto 20px"></div>
        <div class="fs-quiz-loading-title">${T("Senin için en iyi bulmacaları getiriyoruz")}</div>
        <div class="fs-quiz-loading-sub">${T("Bir saniye…")}</div>
      </div>
    `;
  }

  function _puzzleCategoryLabel(pz) {
    if (!pz) return "";
    const t = String(pz.type || "").toLowerCase();
    if (t === "mate1") return T("Mat 1");
    if (t === "mate2") return T("Mat 2");
    if (t === "mate3") return T("Mat 3");
    if (t === "best_move") return T("En İyi Hamle");
    if (t === "tactic") return T("Taktik");
    return t.toUpperCase();
  }

  function _puzzleHeadline(pz) {
    if (!pz) return T("Bulmaca");
    const t = String(pz.type || "").toLowerCase();
    if (t === "mate1") return T("Tek hamlede mat!");
    if (t === "mate2") return T("İki hamlede mat bul.");
    if (t === "tactic") return T("Bu pozisyonda en iyi hamleyi bul.");
    return T("Bu pozisyonda en iyi hamleyi bul.");
  }

  function _isLichessPuzzle(pz) {
    return !!(pz && String(pz.source || "").toLowerCase() === "lichess");
  }

  function _puzzleSourceLabel(pz) {
    return _isLichessPuzzle(pz) ? "Lichess" : "ForkSight";
  }

  function _sideToMoveLabel(side) {
    return side === "b" ? T("Siyah oynar") : T("Beyaz oynar");
  }

  function _renderMovesList(history, sideToMove) {
    if (!Array.isArray(history) || !history.length) {
      return `<div class="fs-quiz-moves-empty">${T("Bu pozisyona kadar oynanan hamle yok.")}</div>`;
    }
    // 1 hamle çifti = 1 satır: [no] [beyaz] [siyah]
    const rows = [];
    for (let i = 0; i < history.length; i += 2) {
      const moveNo = Math.floor(i / 2) + 1;
      const w = history[i] || "";
      const b = history[i + 1] || "";
      rows.push(
        `<div class="fs-quiz-moverow">
          <span class="fs-quiz-moveno">${moveNo}.</span>
          <span class="fs-quiz-movecell">${esc(w)}</span>
          <span class="fs-quiz-movecell">${esc(b)}</span>
        </div>`,
      );
    }
    // Son satırda "şimdi sıra X" işareti
    const turnLabel = sideToMove === "w" ? T("Beyaz oynar") : T("Siyah oynar");
    rows.push(
      `<div class="fs-quiz-moverow fs-quiz-moverow-turn">
        <span class="fs-quiz-moveno">→</span>
        <span class="fs-quiz-movecell" style="grid-column: 2 / span 2; font-style: italic; color: var(--fs-accent);">${esc(turnLabel)}</span>
      </div>`,
    );
    return `<div class="fs-quiz-moves-list">${rows.join("")}</div>`;
  }

  function _avatarUrl(mood) {
    try {
      return chrome.runtime.getURL("avatars/" + mood + ".png");
    } catch (_) {
      return "avatars/" + mood + ".png";
    }
  }

  function renderPuzzlesSolving() {
    const p = cache.puzzles;
    const pz = p.puzzle || {};
    const isLichess = _isLichessPuzzle(pz);
    const headline = _puzzleHeadline(pz);
    const cat = _puzzleCategoryLabel(pz);
    const pts = _QUIZ_POINTS_BY_HINT_CLIENT[p.usedHint || 0] || 10;
    const sideLabel = _sideToMoveLabel(pz.side_to_move || "w");
    const sourceLabel = _puzzleSourceLabel(pz);
    const topTheme = isLichess
      ? String(pz.themes || "")
          .split(/\s+/)
          .filter(Boolean)[0] || ""
      : "";
    const flashHtml = p.flash.msg
      ? `<div class="fs-quiz-flash fs-${p.flash.kind}">${esc(p.flash.msg)}</div>`
      : `<div class="fs-quiz-flash"></div>`;
    const srcMeta = isLichess
      ? T("Kaynak") +
        ": Lichess" +
        (topTheme ? " · " + T("Tema") + ": " + topTheme : "")
      : pz.source_game_id
        ? T("Kaynak") +
          ": " +
          T("oyun") +
          " #" +
          pz.source_game_id +
          " · " +
          T("hamle") +
          " " +
          pz.source_ply
        : "";

    return `
      <div class="fs-quizv2">
        <div class="fs-quizv2-topbar">
          <button class="fs-quiz-back" data-quiz-act="back">← ${T("Liste")}</button>
          <div class="fs-quizv2-topchips">
            <span class="fs-quiz-chip fs-quiz-chip-cat">${esc(cat)}</span>
            <span class="fs-quiz-chip fs-quiz-chip-readonly">${T("Kaynak")}: ${esc(sourceLabel)}</span>
            <span class="fs-quiz-chip">${esc(sideLabel)}</span>
            ${pz.rating != null ? `<span class="fs-quiz-chip">${T("Zorluk")} ${esc(pz.rating)}</span>` : ""}
            ${!isLichess && pz.played_cnt === 0 ? `<span class="fs-quiz-chip fs-quiz-chip-new">${T("YENİ")}</span>` : ""}
            <span class="fs-quiz-chip fs-quiz-chip-reward">+${pts} ${T("puan")}</span>
            <span class="fs-quiz-chip fs-quiz-chip-timer" data-quiz-timer>0.0s</span>
          </div>
          <div class="fs-quizv2-hintbtns">
            <button class="fs-quiz-hint-btn" data-quiz-hint="1" title="${T("İpucu")} 1" ${isLichess ? "disabled" : ""}>💡 1</button>
            <button class="fs-quiz-hint-btn" data-quiz-hint="2" title="${T("İpucu")} 2" ${isLichess ? "disabled" : ""}>💡 2</button>
            <button class="fs-quiz-hint-btn" data-quiz-hint="3" title="${T("İpucu")} 3" ${isLichess ? "disabled" : ""}>💡 3</button>
          </div>
        </div>
        <div class="fs-quizv2-body">
          <div class="fs-quizv2-board" data-quiz-board></div>
          <aside class="fs-quizv2-side">
            <div class="fs-quizv2-coach">
              <img class="fs-quizv2-coach-av" src="${_avatarUrl("thinking")}" alt="" />
              <div class="fs-quizv2-coach-bubble">
                <div class="fs-quizv2-coach-title">${T("Bulmaca")}</div>
                <div class="fs-quizv2-coach-text">${esc(headline)}</div>
              </div>
            </div>
            <div class="fs-quizv2-section">${T("HAMLELER")}</div>
            ${_renderMovesList(pz.history_san || [], pz.side_to_move)}
            <div class="fs-quizv2-hintstatus" data-quiz-hint-status></div>
            ${flashHtml}
            <div class="fs-quizv2-actions">
              <button class="fs-btn fs-ghost" data-quiz-skip>${T("Atla")}</button>
              ${!isLichess ? `<button class="fs-btn fs-ghost" data-quiz-act="share" title="${T("Twitter'da paylaş")}">🔗 ${T("Paylaş")}</button>` : ""}
              <button class="fs-btn" data-quiz-submit style="display:none">${T("Cevapla")}</button>
              <input type="hidden" data-quiz-input value="" />
            </div>
            <div class="fs-quiz-meta">${esc(srcMeta)}</div>
          </aside>
        </div>
      </div>
    `;
  }

  function renderPuzzlesPreview() {
    const p = cache.puzzles;
    const pv = p.preview || {};
    const pz = pv.puzzle || {};
    const la = pv.last_attempt || {};
    const cat = _puzzleCategoryLabel(pz);
    const headline =
      la && la.correct
        ? T("Tebrikler! Bu bulmacayı çözmüştün.")
        : T("Bu bulmacayı çözememiştin. İşte çözümü.");
    const mood = la && la.correct ? "happy" : "worried";
    const sol = pz.solution_uci || "";
    const solParts = sol.split(/\s+/).filter(Boolean);
    let solList = "";
    if (solParts.length >= 3) {
      // mate-2 tam hat: sen → rakip → sen (mat)
      solList =
        `<span class="fs-quiz-sol-mv">1. ${esc(solParts[0])}</span> ` +
        `<span class="fs-quiz-sol-mv fs-quiz-sol-opp">1… ${esc(solParts[1])}</span> ` +
        `<span class="fs-quiz-sol-mv">2. ${esc(solParts[2])}#</span>`;
    } else {
      solList = solParts
        .map(
          (m, i) => `<span class="fs-quiz-sol-mv">${i + 1}. ${esc(m)}</span>`,
        )
        .join(" ");
    }
    const srcMeta = pz.source_game_id
      ? T("Kaynak") +
        ": " +
        T("oyun") +
        " #" +
        pz.source_game_id +
        " · " +
        T("hamle") +
        " " +
        pz.source_ply
      : "";
    const gameUrl = pz.game_url || "";
    const gameMove = pz.source_ply ? `?move=${pz.source_ply}` : "";
    const gameLink = gameUrl ? gameUrl + gameMove : "";

    return `
      <div class="fs-quizv2">
        <div class="fs-quizv2-topbar">
          <button class="fs-quiz-back" data-quiz-act="back">← ${T("Liste")}</button>
          <div class="fs-quizv2-topchips">
            <span class="fs-quiz-chip fs-quiz-chip-readonly">${T("ÖNİZLEME")}</span>
            <span class="fs-quiz-chip fs-quiz-chip-cat">${esc(cat)}</span>
            ${la && la.correct != null ? `<span class="fs-quiz-chip ${la.correct ? "fs-quiz-chip-new" : "fs-quiz-chip-bad"}">${la.correct ? T("ÇÖZÜLDÜ") : T("BAŞARISIZ")}</span>` : ""}
            ${la && la.time_ms != null ? `<span class="fs-quiz-chip">${(la.time_ms / 1000).toFixed(1)}s</span>` : ""}
          </div>
        </div>
        <div class="fs-quizv2-body">
          <div class="fs-quizv2-boardcol">
            <div class="fs-quizv2-board" data-quiz-board data-readonly="1"></div>
            ${
              gameLink
                ? `<a class="fs-quizv2-gamelink" href="${esc(gameLink)}" target="_blank" rel="noopener noreferrer">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                     ${T("Oyunu Chess.com'da Aç")}
                   </a>`
                : ""
            }
          </div>
          <aside class="fs-quizv2-side">
            <div class="fs-quizv2-coach">
              <img class="fs-quizv2-coach-av" src="${_avatarUrl(mood)}" alt="" />
              <div class="fs-quizv2-coach-bubble">
                <div class="fs-quizv2-coach-title">${T("Bulmaca")}</div>
                <div class="fs-quizv2-coach-text">${esc(headline)}</div>
              </div>
            </div>
            <div class="fs-quizv2-section">${T("HAMLELER")}</div>
            ${_renderMovesList(pz.history_san || [], pz.side_to_move)}
            <div class="fs-quizv2-section">${T("ÇÖZÜM")}</div>
            <div class="fs-quizv2-sol">${solList}</div>
            <div class="fs-quizv2-actions" style="margin-top:8px">
              <button class="fs-btn fs-ghost" data-quiz-act="share" title="${T("Twitter'da paylaş")}">🔗 ${T("Bu bulmacayı paylaş")}</button>
            </div>
            <div class="fs-quiz-meta">${esc(srcMeta)}</div>
            <div class="fs-quiz-meta">${T("Önizleme — puan kazanamazsın.")}</div>
          </aside>
        </div>
      </div>
    `;
  }

  // İstemci tarafında hint→puan haritası (UI gösterimi için)
  const _QUIZ_POINTS_BY_HINT_CLIENT = { 0: 10, 1: 7, 2: 4, 3: 1 };

  // ─── Faz 3.1: Başarımlar tab ─────────────────────────
  function renderAchievementsTab() {
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
        ? "tr"
        : "en";
    const data = cache.achievements;
    if (data === "loading" || data == null) {
      // Veri yüklenmemişse istek tetikle
      if (data == null) loadAchievements();
      return renderLoading();
    }
    const items = data.items || [];
    if (!items.length) {
      return `<div class="fs-empty">${T("Henüz başarım yok.")}</div>`;
    }
    // Önce kazanılanlar, sonra ilerleme yüzdesine göre
    const sorted = items.slice().sort((a, b) => {
      if (a.earned !== b.earned) return a.earned ? -1 : 1;
      return (b.percent || 0) - (a.percent || 0);
    });
    const cards = sorted
      .map((it) => {
        const name = lang === "tr" ? it.name_tr : it.name_en;
        const desc = lang === "tr" ? it.desc_tr : it.desc_en;
        const tierCls = `fs-ach-tier-${it.tier}`;
        const earnedCls = it.earned ? "fs-ach-earned" : "fs-ach-locked";
        const progLine = it.earned
          ? `<div class="fs-ach-prog-txt">${T("Kazanıldı")} ✓</div>`
          : `
            <div class="fs-ach-prog"><div class="fs-ach-prog-bar" style="width:${it.percent}%"></div></div>
            <div class="fs-ach-prog-txt">${it.progress} / ${it.goal}</div>
          `;
        return `
          <div class="fs-ach-card ${earnedCls}" title="${esc(desc)}">
            <span class="fs-ach-tier ${tierCls}">${esc(it.tier)}</span>
            <div class="fs-ach-row">
              <span class="fs-ach-ico">${esc(it.icon || "🏆")}</span>
              <span class="fs-ach-name">${esc(name)}</span>
            </div>
            <div class="fs-ach-desc">${esc(desc)}</div>
            ${progLine}
          </div>
        `;
      })
      .join("");
    return `
      <div class="fs-ach-summary">
        <div>${T("Toplam Başarım")}</div>
        <div><span class="fs-ach-summary-num">${data.earned_count}</span> / ${data.total_count}</div>
      </div>
      <div class="fs-ach-grid">${cards}</div>
    `;
  }

  async function loadAchievements(force) {
    if (cache.achievements === "loading") return;
    if (cache.achievements && !force) return;
    cache.achievements = "loading";
    if (activeTab === "achievements") renderActive();
    try {
      const r = await send("achievements_me");
      cache.achievements =
        r && r.ok ? r : { items: [], earned_count: 0, total_count: 0 };
    } catch (_) {
      cache.achievements = { items: [], earned_count: 0, total_count: 0 };
    }
    if (activeTab === "achievements") renderActive();
  }

  // ─── Faz 3.1: Liderlik tab ───────────────────────────
  const _LB_METRICS = [
    {
      id: "rating",
      trLabel: "Reyting",
      enLabel: "Rating",
      fmt: (v) => Math.round(v),
    },
    {
      id: "solved",
      trLabel: "Çözüm",
      enLabel: "Solved",
      fmt: (v) => Math.round(v),
    },
    {
      id: "points",
      trLabel: "Puan",
      enLabel: "Points",
      fmt: (v) => Math.round(v),
    },
    {
      id: "day_streak",
      trLabel: "Günlük Seri",
      enLabel: "Day Streak",
      fmt: (v) => Math.round(v),
    },
    {
      id: "weekly_solved",
      trLabel: "Haftalık",
      enLabel: "Weekly",
      fmt: (v) => Math.round(v),
    },
  ];

  function renderLeaderboardTab() {
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
        ? "tr"
        : "en";
    const lb = cache.leaderboard;
    const tabs = _LB_METRICS
      .map((m) => {
        const lab = lang === "tr" ? m.trLabel : m.enLabel;
        const cls = m.id === lb.metric ? "fs-lb-tab fs-active" : "fs-lb-tab";
        return `<button class="${cls}" data-lb-metric="${m.id}">${esc(lab)}</button>`;
      })
      .join("");

    if (lb.loading || !lb.data) {
      if (!lb.data && !lb.loading) loadLeaderboard(lb.metric);
      return `
        <div class="fs-lb-tabs">${tabs}</div>
        ${renderLoading()}
      `;
    }
    const cfg = _LB_METRICS.find((x) => x.id === lb.metric) || _LB_METRICS[0];
    const data = lb.data;
    const me = data.me || {};
    const meBlock = me.rank
      ? `
        <div class="fs-lb-me">
          <div class="fs-lb-me-rank">#${me.rank}</div>
          <div class="fs-lb-me-name">${esc(me.username || T("Sen"))}</div>
          <div class="fs-lb-me-val">${cfg.fmt(me.value || 0)}</div>
        </div>
      `
      : `<div class="fs-empty" style="margin-bottom:10px">${T("Henüz sıralamada değilsin.")}</div>`;

    const rows = (data.top || [])
      .map((u) => {
        const rankCls =
          u.rank === 1
            ? "fs-lb-rank fs-lb-rank-1"
            : u.rank === 2
              ? "fs-lb-rank fs-lb-rank-2"
              : u.rank === 3
                ? "fs-lb-rank fs-lb-rank-3"
                : "fs-lb-rank";
        const rowCls = u.is_me ? "fs-lb-row fs-lb-me-row" : "fs-lb-row";
        const medal =
          u.rank === 1
            ? "🥇 "
            : u.rank === 2
              ? "🥈 "
              : u.rank === 3
                ? "🥉 "
                : "";
        return `
        <div class="${rowCls}">
          <div class="${rankCls}">${medal}${u.rank}</div>
          <div class="fs-lb-name">${esc(u.username || "—")}</div>
          <div class="fs-lb-val">${cfg.fmt(u.value || 0)}</div>
        </div>
      `;
      })
      .join("");

    return `
      <div class="fs-lb-tabs">${tabs}</div>
      ${meBlock}
      <div class="fs-lb-table">
        ${rows || `<div class="fs-empty" style="padding:20px">${T("Veri yok.")}</div>`}
      </div>
    `;
  }

  async function loadLeaderboard(metric) {
    const m = metric || cache.leaderboard.metric || "rating";
    cache.leaderboard.metric = m;
    cache.leaderboard.loading = true;
    cache.leaderboard.data = null;
    if (activeTab === "leaderboard") renderActive();
    try {
      const r = await send("leaderboard", { metric: m, limit: 50 });
      cache.leaderboard.data = r && r.ok ? r : { top: [], me: {} };
    } catch (_) {
      cache.leaderboard.data = { top: [], me: {} };
    }
    cache.leaderboard.loading = false;
    if (activeTab === "leaderboard") renderActive();
  }

  // ─── Toast: yeni başarım kazanıldı ────────────────────
  function showAchievementToasts(list) {
    if (!Array.isArray(list) || !list.length) return;
    let host = document.getElementById("fs-ach-toast-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "fs-ach-toast-host";
      host.className = "fs-ach-toast-host";
      // Toast'lar tüm sayfada görünmeli — shadow değil, body'ye eklenir.
      document.body.appendChild(host);
      // Style enjeksiyonu — toast'lar shadow dışında olduğu için global CSS.
      if (!document.getElementById("fs-ach-toast-style")) {
        const st = document.createElement("style");
        st.id = "fs-ach-toast-style";
        st.textContent = `
          .fs-ach-toast-host { position: fixed; right: 20px; bottom: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 2147483647; pointer-events: none; }
          .fs-ach-toast { background: linear-gradient(135deg,#2a2620 0%,#1d1f25 100%); border: 1px solid rgba(245,197,24,.45); border-radius: 10px; padding: 10px 14px; display: flex; align-items: center; gap: 10px; min-width: 240px; max-width: 340px; box-shadow: 0 8px 32px rgba(0,0,0,.45); color: #f5e9c8; animation: fsAchSlideIn .25s ease-out; pointer-events: auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .fs-ach-toast-ico { font-size: 28px; line-height: 1; }
          .fs-ach-toast-body { flex: 1; }
          .fs-ach-toast-title { font-size: 11px; color: #f5c518; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; }
          .fs-ach-toast-name { font-size: 14px; font-weight: 700; color: #fff; }
          .fs-ach-toast-desc { font-size: 11px; color: rgba(255,255,255,.65); }
          @keyframes fsAchSlideIn { from { transform: translateX(120%); opacity: 0; } to { transform: none; opacity: 1; } }
          @keyframes fsAchSlideOut { to { transform: translateX(120%); opacity: 0; } }
        `;
        document.head.appendChild(st);
      }
    }
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
        ? "tr"
        : "en";
    list.forEach((a, i) => {
      const name = lang === "tr" ? a.name_tr : a.name_en;
      const desc = lang === "tr" ? a.desc_tr : a.desc_en;
      const el = document.createElement("div");
      el.className = "fs-ach-toast";
      el.innerHTML = `
        <span class="fs-ach-toast-ico">${esc(a.icon || "🏆")}</span>
        <div class="fs-ach-toast-body">
          <div class="fs-ach-toast-title">${T("Yeni Başarım")}</div>
          <div class="fs-ach-toast-name">${esc(name)}</div>
          <div class="fs-ach-toast-desc">${esc(desc)}</div>
        </div>
      `;
      setTimeout(() => host.appendChild(el), i * 350);
      setTimeout(
        () => {
          el.style.animation = "fsAchSlideOut .25s ease-in forwards";
          setTimeout(() => el.remove(), 280);
        },
        4500 + i * 350,
      );
    });
    // Başarım listesi cache'ini tazele
    cache.achievements = null;
    if (activeTab === "achievements") loadAchievements(true);
  }
  // Dış (mountQuizBoard içi) erişim için global'e koyalım.
  try {
    window.__fsShowAchievementToasts = showAchievementToasts;
  } catch (_) {}

  function renderSettingsTab() {
    const u = (cache.profile && cache.profile.user) || {};
    const ccu = u.chess_com_username || "";
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
        ? "tr"
        : "en";
    return `
      <div class="fs-set-row">
        <div class="fs-set-lab">${T("Dil")}</div>
        <div class="fs-set-control fs-lang-row">
          <button class="fs-btn ${lang === "en" ? "" : "fs-ghost"}" data-act="lang-en">${T("İngilizce")}</button>
          <button class="fs-btn ${lang === "tr" ? "" : "fs-ghost"}" data-act="lang-tr">${T("Türkçe")}</button>
        </div>
      </div>
      <div class="fs-set-row">
        <div class="fs-set-lab">${T("Chess.com Kullanıcı Adı")}</div>
        <div class="fs-set-control">
          <input type="text" class="fs-input" data-set="ccu" value="${esc(ccu)}" placeholder="${T("kullanıcı adı")}" />
          <button class="fs-btn" data-act="save-ccu">${T("Kaydet")}</button>
        </div>
        <div class="fs-msg" data-msg="ccu"></div>
      </div>
      <div class="fs-set-row">
        <div class="fs-set-lab">${T("Veriler")}</div>
        <div class="fs-set-control" style="display:flex; flex-direction:column; gap:6px;">
          <button class="fs-btn fs-ghost" data-act="resync" style="width:100%">${T("↻ Oyunları Yeniden Senkronize Et")}</button>
          <button class="fs-btn fs-ghost" data-act="resync-force" style="width:100%">${T("⟳ Tüm Veriyi Sıfırla ve Yeniden Çek")}</button>
        </div>
        <div class="fs-msg" data-msg="sync"></div>
      </div>
      <div class="fs-set-row">
        <div class="fs-set-lab">${T("Oturum")}</div>
        <div class="fs-set-control">
          <button class="fs-btn fs-danger" data-act="logout" style="width:100%">${T("Çıkış Yap")}</button>
        </div>
      </div>
    `;
  }

  function renderActive() {
    if (!panelEl) return;
    const body = panelEl.querySelector(".fs-body");
    let html = "";
    if (activeTab === "profile") html = renderProfileTab();
    else if (activeTab === "games") html = renderGamesTab();
    else if (activeTab === "weakness") html = renderWeaknessTab();
    else if (activeTab === "puzzles") html = renderPuzzlesTab();
    else if (activeTab === "achievements") html = renderAchievementsTab();
    else if (activeTab === "leaderboard") html = renderLeaderboardTab();
    else if (activeTab === "settings") html = renderSettingsTab();
    body.innerHTML = html;
    panelEl.querySelectorAll(".fs-tab").forEach((t) => {
      t.classList.toggle("fs-active", t.dataset.tab === activeTab);
    });
    bindBody();
    if (activeTab === "puzzles") mountQuizBoard();
  }

  // ─── Veri yükleme ─────────────────────────────────────
  async function ensureProfile(force) {
    if (cache.profile && !force) return;
    cache.profile = null;
    renderActive();
    // Profil ve quota'yı paralel çek — quota panelin alt rozetinde
    // "Bugün kalan: X koç sesi, Y oyun analizi" şeklinde gösterilir.
    try {
      const [resp, qresp] = await Promise.all([
        send("me_profile"),
        send("me_quota").catch(() => null),
      ]);
      if (resp && resp.ok) {
        cache.profile = {
          user: resp.user,
          stats: resp.stats,
          recent_games: resp.recent_games,
        };
      } else {
        cache.profile = { user: null };
      }
      if (qresp && qresp.ok) {
        cache.quota = {
          is_premium: !!qresp.is_premium,
          tier: qresp.tier || (qresp.is_premium ? "diamond" : "free"),
          sponsor_tier: qresp.sponsor_tier || null,
          premium_until: qresp.premium_until || null,
          features: qresp.features || {},
          server_time: qresp.server_time || 0,
        };
      }
    } catch (_) {
      cache.profile = { user: null };
    }
    updatePremiumPill();
    if (activeTab === "profile" || activeTab === "settings") renderActive();
  }

  async function loadGames(reset) {
    if (reset) {
      cache.games.items = [];
      cache.games.offset = 0;
      cache.games.hasMore = true;
    }
    renderActive();
    try {
      const f = cache.games.filter;
      const resp = await send("me_games", {
        limit: 20,
        offset: cache.games.offset,
        result: f.result || undefined,
        time_class: f.time_class || undefined,
      });
      if (resp && resp.ok && Array.isArray(resp.games)) {
        cache.games.items = cache.games.items.concat(resp.games);
        cache.games.offset += resp.games.length;
        cache.games.hasMore = resp.games.length === 20;
      } else {
        cache.games.hasMore = false;
      }
    } catch (_) {
      cache.games.hasMore = false;
    }
    if (activeTab === "games") renderActive();
  }

  async function ensureWeakness(force) {
    if (cache.weakness && !force) return;
    cache.weakness = null;
    renderActive();
    try {
      const resp = await send("me_weakness");
      if (resp && resp.ok) cache.weakness = { report: resp.report };
      else cache.weakness = { report: null };
    } catch (_) {
      cache.weakness = { report: null };
    }
    if (activeTab === "weakness") renderActive();
  }

  // ─── Bulmacalar — davranış ────────────────────────────
  function stopQuizTimer() {
    if (cache.puzzles.timerId) {
      clearInterval(cache.puzzles.timerId);
      cache.puzzles.timerId = null;
    }
  }
  function startQuizTimer() {
    stopQuizTimer();
    cache.puzzles.startTs = Date.now();
    const tick = () => {
      if (!panelEl) return;
      const el = panelEl.querySelector("[data-quiz-timer]");
      if (!el) return;
      const sec = (Date.now() - cache.puzzles.startTs) / 1000;
      el.textContent = sec.toFixed(1) + "s";
    };
    tick();
    cache.puzzles.timerId = setInterval(tick, 100);
  }

  function setQuizFlash(kind, msg) {
    cache.puzzles.flash = { kind: kind || "", msg: msg || "" };
    if (activeTab === "puzzles") {
      const el = panelEl && panelEl.querySelector(".fs-quiz-flash");
      if (el) {
        el.className = "fs-quiz-flash" + (kind ? " fs-" + kind : "");
        el.textContent = msg || "";
      }
    }
  }

  // ─── Quota 402 → upgrade modal helper ───
  // Backend bir endpoint için günlük/haftalık limiti dolduğunda 402 ile
  // {code:"QUOTA_EXCEEDED", feature, used, limit, unit, reset_at,
  //  upgrade_url, premium_required} döner. Bu helper kullanıcıya tek seferlik
  // bir overlay gösterir + profil quota cache'ini yenileyip strip'i tazeler.
  let _quotaModalOpen = false;
  function showQuotaUpgradeModal(info) {
    if (_quotaModalOpen) return;
    _quotaModalOpen = true;
    // Strip'i tazele
    send("me_quota")
      .then((qr) => {
        if (qr && qr.ok) {
          cache.quota = {
            is_premium: !!qr.is_premium,
            tier: qr.tier || (qr.is_premium ? "diamond" : "free"),
            sponsor_tier: qr.sponsor_tier || null,
            premium_until: qr.premium_until || null,
            features: qr.features || {},
            server_time: qr.server_time || 0,
          };
          if (activeTab === "profile") renderActive();
          updatePremiumPill();
        }
      })
      .catch(() => {});
    try {
      const isPremiumLocked = !!info?.premium_required;
      const used = info?.used != null ? Number(info.used) : null;
      const limit = info?.limit != null ? Number(info.limit) : null;
      const unit = info?.unit || "";
      const resetAt = info?.reset_at ? Number(info.reset_at) * 1000 : 0;
      const resetTxt = resetAt
        ? new Date(resetAt).toLocaleString("tr-TR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "";
      const upgradeUrl = info?.upgrade_url || "https://forksight.net/premium";
      const featureName =
        {
          tts_chars: T("Sesli koç (TTS)"),
          game_analysis: T("Oyun sonrası analiz"),
          coach_review: T("Sesli koç review"),
          quiz_play: T("Bulmaca oynama"),
          hint: T("Puzzle ipucu"),
        }[info?.feature] || T("Bu özellik");
      const title = isPremiumLocked
        ? "★ " + T("Premium Özellik")
        : T("Limit Doldu");
      const body = isPremiumLocked
        ? `${featureName} ${T("Premium üyelik gerektirir.")}`
        : `${featureName}: ${used ?? "?"} / ${limit ?? "?"} ${unit}` +
          (resetTxt ? ` · ${resetTxt} ${T("sonrası sıfırlanır.")}` : "") +
          ` ${T("Premium ile sınırsız kullan.")}`;
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483647;" +
        "display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;";
      const card = document.createElement("div");
      card.style.cssText =
        "background:#1a1d24;color:#e8eaed;padding:28px 32px;border-radius:16px;" +
        "max-width:420px;width:90%;box-shadow:0 24px 60px rgba(0,0,0,.6);" +
        "border:1px solid #353a45;";
      card.innerHTML =
        `<div style="font-size:18px;font-weight:700;margin-bottom:12px;">${esc(title)}</div>` +
        `<div style="font-size:14px;line-height:1.5;color:#b8bdc7;margin-bottom:20px;">${esc(body)}</div>` +
        `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
        `<button id="_fs_pqm_close" style="background:transparent;border:1px solid #3a3f4a;color:#b8bdc7;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">${esc(T("Kapat"))}</button>` +
        `<button id="_fs_pqm_upg" style="background:linear-gradient(135deg,#f7b733,#fc4a1a);border:none;color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">${esc(T("Premium'a Geç"))}</button>` +
        `</div>`;
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      const close = () => {
        _quotaModalOpen = false;
        try {
          overlay.remove();
        } catch (_) {}
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      card.querySelector("#_fs_pqm_close")?.addEventListener("click", close);
      card.querySelector("#_fs_pqm_upg")?.addEventListener("click", () => {
        try {
          window.open(upgradeUrl, "_blank");
        } catch (_) {}
        close();
      });
    } catch (e) {
      _quotaModalOpen = false;
    }
  }
  function _isQuotaResp(r) {
    return !!(r && r.code === "QUOTA_EXCEEDED");
  }

  // ─── Faz 2.5: TTS koç anlatımı (ElevenLabs → sunucu /tts) ───
  // Sunucu tarafı ElevenLabs (multilingual_v2) sesini MP3 olarak döner;
  // erişilemezse sessiz başarısızlık (rahatsız edici robotik sese düşmek
  // yerine satırı atla — coach-review.js ile aynı politika).
  // Kullanıcı sessize alabilir: cache.puzzles.ttsMuted (varsayılan: false).
  let _coachAudio = null;
  let _coachReqSeq = 0;
  const _coachAudioCache = new Map(); // text → object URL
  const _COACH_CACHE_MAX = 40;
  let _coachApiBase = null;
  async function _coachGetBase() {
    if (_coachApiBase) return _coachApiBase;
    try {
      const r = await send("get_api_base");
      if (r && r.url) {
        _coachApiBase = String(r.url).replace(/\/+$/, "");
      }
    } catch (_) {}
    return _coachApiBase || "";
  }
  function _coachStopAudio() {
    try {
      if (_coachAudio) {
        _coachAudio.pause();
        _coachAudio.src = "";
      }
    } catch (_) {}
    _coachAudio = null;
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (_) {}
  }
  async function speakCoach(text) {
    if (!text) return;
    if (cache.puzzles && cache.puzzles.ttsMuted) return;
    const reqId = ++_coachReqSeq;
    _coachStopAudio();
    const t = String(text).trim();
    if (!t) return;
    // TTS dili UI diliyle eşleşmeli (EN seçiliyse İngilizce seslendirme).
    const ttsLang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
        ? "en"
        : "tr";
    try {
      // Cache anahtarı dile özgü olmalı; yoksa TR ses EN'de tekrar çalınır.
      const cacheKey = ttsLang + "|" + t;
      let url = _coachAudioCache.get(cacheKey);
      if (!url) {
        const base = await _coachGetBase();
        if (reqId !== _coachReqSeq) return;
        if (!base) return;
        const endpoint =
          base +
          "/tts?lang=" +
          ttsLang +
          "&text=" +
          encodeURIComponent(t) +
          "&v=el2";
        const res = await fetch(endpoint, { method: "GET" });
        if (reqId !== _coachReqSeq) return;
        if (!res.ok) throw new Error("tts http " + res.status);
        const blob = await res.blob();
        if (reqId !== _coachReqSeq) return;
        url = URL.createObjectURL(blob);
        _coachAudioCache.set(cacheKey, url);
        if (_coachAudioCache.size > _COACH_CACHE_MAX) {
          const firstKey = _coachAudioCache.keys().next().value;
          try {
            URL.revokeObjectURL(_coachAudioCache.get(firstKey));
          } catch (_) {}
          _coachAudioCache.delete(firstKey);
        }
      }
      if (reqId !== _coachReqSeq) return;
      const audio = new Audio(url);
      audio.volume = 1.0;
      audio.playbackRate = 1.0;
      _coachAudio = audio;
      // Ses bitene kadar bekle: çağıran kod (örn. submitQuizUci) await
      // edip ekranı kapatmadan önce anlatımın bitmesini garanti edebilsin.
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          try {
            audio.onended = null;
            audio.onerror = null;
            audio.onpause = null;
          } catch (_) {}
          resolve();
        };
        audio.onended = finish;
        audio.onerror = finish;
        // Stale request olursa _coachStopAudio() pause çağırır → finish
        audio.onpause = () => {
          if (reqId !== _coachReqSeq) finish();
        };
        // Güvenlik: 20 sn üst sınır (TTS asla bu kadar uzun sürmemeli)
        setTimeout(finish, 20000);
        audio.play().catch(() => finish());
      });
    } catch (e) {
      try {
        console.warn("[ForkSight] coach TTS error:", e);
      } catch (_) {}
      // Sessiz başarısızlık — Microsoft sesine düşmüyoruz.
    }
  }
  function _coachPhraseForCorrect(pz) {
    const en = window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";
    const themes = String((pz && pz.themes) || "").toLowerCase();
    const TH = {
      fork: ["çatal", "fork"],
      pin: ["mıhlama", "pin"],
      skewer: ["şiş", "skewer"],
      discovered_check: ["keşif şahı", "discovered check"],
      double_check: ["çifte şah", "double check"],
      back_rank: ["geri sıra matı", "back-rank mate"],
      sacrifice: ["feda", "sacrifice"],
      hanging: ["korumasız taş kazanımı", "hanging piece win"],
      promotion: ["terfi", "promotion"],
      capture: ["alış", "capture"],
      check: ["şah", "check"],
    };
    let lbl = "";
    for (const key in TH) {
      if (themes.includes(key)) {
        lbl = en ? TH[key][1] : TH[key][0];
        break;
      }
    }
    if (lbl) {
      return en
        ? "Well done! That was a nice " + lbl + "."
        : "Aferin! Bu güzel bir " + lbl + " hamlesiydi.";
    }
    return en ? "Well done, correct move!" : "Aferin, doğru hamle!";
  }
  function _coachPhraseForWrong(expectedSan) {
    const en = window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";
    if (expectedSan) {
      return en
        ? "Wrong. The correct move was " + expectedSan + "."
        : "Yanlış. Doğru hamle " + expectedSan + " idi.";
    }
    return en ? "Wrong. Try again." : "Yanlış. Tekrar dene.";
  }

  function mountQuizBoard() {
    const p = cache.puzzles;
    if (!panelEl) return;
    const host = panelEl.querySelector("[data-quiz-board]");
    if (!host) return;
    let pz = null;
    let readOnly = false;
    if (p.view === "solving") {
      pz = p.puzzle;
    } else if (p.view === "preview") {
      pz = p.preview && p.preview.puzzle;
      readOnly = true;
    }
    if (!pz) {
      host.innerHTML = "";
      return;
    }
    if (!window.ForkSightQuizBoard) {
      host.innerHTML = `<div class="fs-empty" style="padding:18px">${esc(T("Tahta modülü yüklenemedi."))}</div>`;
      return;
    }
    if (p.board) {
      try {
        p.board.destroy();
      } catch (_) {}
      p.board = null;
    }
    host.innerHTML = "";
    p.board = window.ForkSightQuizBoard.create(host, {
      fen: pz.fen,
      sideToMove: pz.side_to_move,
      onMove: (uci) => {
        if (readOnly) return;
        submitQuizUci(uci);
      },
    });
    if (readOnly) {
      try {
        p.board.lock(true);
      } catch (_) {}
      const sol = (pz.solution_uci || "").trim().split(/\s+/)[0];
      if (sol && sol.length >= 4) {
        try {
          p.board.flash(sol.slice(0, 2), sol.slice(2, 4), "info");
        } catch (_) {}
      }
    } else if (p.hintFromSq) {
      try {
        p.board.highlightHint(p.hintFromSq);
      } catch (_) {}
    }
  }

  async function ensurePuzzles() {
    const p = cache.puzzles;
    // Bulmacalar sekmesine girişte her zaman lobby gösterilir,
    // aktif puzzle + timer otomatik başlamaz.
    p.view = "lobby";
    p.puzzle = null;
    p.preview = null;
    p.usedHint = 0;
    p.hintFromSq = null;
    stopQuizTimer();
    if (p.board) {
      try {
        p.board.destroy();
      } catch (_) {}
      p.board = null;
    }
    try {
      const r = await send("quiz_stats");
      if (r && r.ok) {
        p.stats = r.stats || null;
        p.totalPuzzles = r.total_puzzles || 0;
        p.totalGames = r.total_games || 0;
        p.processedGames = r.processed_games || 0;
        p.dueCount = r.due_count || 0;
        p.history = Array.isArray(r.recent_attempts) ? r.recent_attempts : [];
      }
    } catch (_) {}
    try {
      const rt = await send("quiz_themes");
      if (rt && rt.ok) {
        p.themes = Array.isArray(rt.themes) ? rt.themes : [];
      }
    } catch (_) {}
    try {
      const rd = await send("quiz_daily");
      if (rd && rd.ok) {
        p.daily = {
          day: rd.day,
          puzzles: Array.isArray(rd.puzzles) ? rd.puzzles : [],
          solved: rd.solved || 0,
          total: rd.total || 0,
          completed_at: rd.completed_at || null,
        };
      }
    } catch (_) {}
    if (activeTab === "puzzles") renderActive();
    // Otomatik backfill: havuz boş ama analiz edilebilecek oyun varsa
    // ve daha önce denemediysek arka planda üretmeye başla.
    if (
      !p.autoBackfillTried &&
      !p.backfilling &&
      p.totalPuzzles === 0 &&
      p.totalGames > 0
    ) {
      p.autoBackfillTried = true;
      startBackfill({ auto: true });
    }
  }

  function stopBackfillPoll() {
    if (cache.puzzles.backfillPollId) {
      clearInterval(cache.puzzles.backfillPollId);
      cache.puzzles.backfillPollId = null;
    }
  }

  async function startBackfill(opts) {
    const p = cache.puzzles;
    if (p.backfilling) return;
    opts = opts || {};
    if (p.totalGames <= 0) {
      setQuizFlash(
        "info",
        T("Önce chess.com hesabını bağlayıp oyun senkronize et."),
      );
      return;
    }
    p.backfilling = true;
    p.backfillStartedAt = Date.now();
    if (!opts.auto) {
      setQuizFlash("info", T("Geçmiş oyunlardan bulmaca üretiliyor..."));
    }
    if (activeTab === "puzzles" && p.view === "lobby") renderActive();
    try {
      const r = await send("quiz_backfill", {
        limit_games: 50,
        include_mate2: true,
      });
      if (!r || !r.ok) {
        if (_isQuotaResp(r)) {
          setQuizFlash("err", T("Günlük oyun çekme limitin doldu."));
          showQuotaUpgradeModal(r);
        } else {
          setQuizFlash("err", (r && r.detail) || T("Hata"));
        }
        p.backfilling = false;
        if (activeTab === "puzzles" && p.view === "lobby") renderActive();
        return;
      }
    } catch (e) {
      setQuizFlash("err", String(e.message || e));
      p.backfilling = false;
      if (activeTab === "puzzles" && p.view === "lobby") renderActive();
      return;
    }
    // Stats'ı periyodik tazele; yeni bulmaca eklendikçe sayaç artar.
    stopBackfillPoll();
    let lastTotal = p.totalPuzzles;
    let stableTicks = 0;
    p.backfillPollId = setInterval(async () => {
      try {
        const r = await send("quiz_stats");
        if (r && r.ok) {
          p.stats = r.stats || p.stats;
          p.totalPuzzles = r.total_puzzles || 0;
          p.totalGames = r.total_games || p.totalGames;
          p.processedGames = r.processed_games || 0;
          p.dueCount = r.due_count != null ? r.due_count : p.dueCount;
          p.history = Array.isArray(r.recent_attempts)
            ? r.recent_attempts
            : p.history;
        }
      } catch (_) {}
      // İlerleme yoksa veya tüm oyunlar işlendiyse bitir.
      // Motor (best_move) analizi yavaş olduğundan tek bir puzzle dakikalar
      // sürebilir; bu yüzden "durağan" toleransı geniş tutulur, yoksa üretim
      // sürerken erkenden "bitti" sanılır.
      const elapsed = Date.now() - p.backfillStartedAt;
      if (p.totalPuzzles === lastTotal) {
        stableTicks++;
      } else {
        stableTicks = 0;
        lastTotal = p.totalPuzzles;
      }
      // 3sn × 20 = 60sn puzzle artmazsa VEYA toplam 6dk geçtiyse bitir.
      const done = stableTicks >= 20 || elapsed > 360000;
      if (done) {
        stopBackfillPoll();
        p.backfilling = false;
        if (p.totalPuzzles > 0) {
          setQuizFlash(
            "ok",
            `${p.totalPuzzles} ${T("bulmaca hazır — yeni bulmacaya başla!")}`,
          );
        } else {
          setQuizFlash("info", T("Uygun bulmaca bulunamadı."));
        }
      }
      if (activeTab === "puzzles" && p.view === "lobby") renderActive();
    }, 3000);
  }

  function setQuizView(v) {
    cache.puzzles.view = v;
    // Panel boyutunu çözüm/önizlemede büyüt
    if (panelEl) {
      const expanded = v === "solving" || v === "preview";
      panelEl.classList.toggle("fs-panel-quiz", expanded);
    }
    if (activeTab === "puzzles") {
      renderActive();
      mountQuizBoard();
    }
  }

  // Faz 2.6: tema odaklı pratik
  function setThemeFilterAndStart(themeKey, themeLabel) {
    const p = cache.puzzles;
    p.themeFilter = themeKey || "";
    p.themeFilterLabel = themeLabel || themeKey || "";
    p.themeRemaining = 0;
    if (p.themeFilter) startNewPuzzle();
  }

  function clearThemeFilter() {
    const p = cache.puzzles;
    p.themeFilter = "";
    p.themeFilterLabel = "";
    p.themeRemaining = 0;
    // Lobby'deyse yeniden çiz; başka view'daysa lobby'ye dönmeyelim
    if (p.view === "lobby") renderActive();
  }

  // Faz 2.3: Günlük Mücadele başlat — bugünün çözülmemiş ilk puzzle'ından
  // başlar. Tema filtresi varsa temizler. Her solve sonrası `loadNextPuzzle`
  // çağrıldığında daily set içinden sırayla devam etmez; sıradan bir
  // bulmaca akışına geçer. (Tüm 5'i bitirmek için kullanıcı tekrar
  // butona dönebilir.)
  async function startDailyChallenge() {
    const p = cache.puzzles;
    if (!p.daily || !p.daily.puzzles || !p.daily.puzzles.length) return;
    const next = p.daily.puzzles.find((dp) => !dp.solved);
    if (!next) return; // hepsi bitti
    p.themeFilter = "";
    p.themeFilterLabel = "";
    setQuizView("loading");
    p.usedHint = 0;
    p.hintFromSq = null;
    p.solveStep = 1;
    p.firstUci = null;
    p.oppUci = null;
    p.lichessMoveIndex = 0;
    try {
      const r = await send("quiz_next", { puzzle_id: next.id });
      if (r && r.ok && r.puzzle) {
        if (r.stats) p.stats = r.stats;
        p.puzzle = r.puzzle;
        p.dailyMode = true;
        setQuizView("active");
      } else {
        // Fallback: standart akışa düş
        setQuizView("lobby");
        startNewPuzzle();
      }
    } catch (_) {
      setQuizView("lobby");
    }
  }

  async function startNewPuzzle() {
    const p = cache.puzzles;
    setQuizView("loading");
    await new Promise((r) => setTimeout(r, 600));
    p.usedHint = 0;
    p.hintFromSq = null;
    p.solveStep = 1;
    p.firstUci = null;
    p.oppUci = null;
    p.lichessMoveIndex = 0;
    try {
      const r = await send("quiz_next", { theme: p.themeFilter || "" });
      if (r && r.ok && r.puzzle) {
        if (r.stats) p.stats = r.stats;
        if (r.total_puzzles != null) p.totalPuzzles = r.total_puzzles;
        if (r.theme_total != null) p.themeRemaining = r.theme_total;
        p.puzzle = r.puzzle;
        p.lichessMoveIndex = 0;
        if (r.exhausted) {
          // Havuzdaki tüm puzzle'lar çözüldü — tekrar pratiği başlıyor.
          p.flash = {
            kind: "info",
            msg: r.source_fallback
              ? T(
                  "Kendi bulmacaların tükendiği için Lichess bulmacası gösteriliyor.",
                )
              : p.themeFilter
                ? T("Bu temadaki tüm bulmacaları çözdün — tekrar pratiği.")
                : T("Tüm bulmacaları çözdün — tekrar pratiği başlıyor."),
          };
        } else {
          p.flash = { kind: "", msg: "" };
        }
        setQuizView("solving");
        startQuizTimer();
      } else if (r && r.ok && !r.puzzle) {
        p.flash = {
          kind: "info",
          msg:
            r.exhausted && p.themeFilter
              ? T(
                  "Bu temadaki tüm bulmacaları çözdün! Başka bir tema dene veya tema filtresini kaldır.",
                )
              : T("Bulmaca yok — geçmiş oyunlardan üretmeyi dene."),
        };
        setQuizView("lobby");
      } else if (_isQuotaResp(r)) {
        p.flash = {
          kind: "err",
          msg: T("Günlük bulmaca oynama hakkın doldu."),
        };
        setQuizView("lobby");
        showQuotaUpgradeModal(r);
      } else {
        p.flash = { kind: "err", msg: (r && r.detail) || T("Hata") };
        setQuizView("lobby");
      }
    } catch (e) {
      p.flash = { kind: "err", msg: String(e.message || e) };
      setQuizView("lobby");
    }
  }

  async function openPuzzlePreview(puzzleId) {
    const p = cache.puzzles;
    setQuizView("loading");
    try {
      const r = await send("quiz_puzzle_detail", { puzzle_id: puzzleId });
      if (r && r.ok && r.puzzle) {
        p.preview = { puzzle: r.puzzle, last_attempt: r.last_attempt || null };
        setQuizView("preview");
      } else {
        p.flash = {
          kind: "err",
          msg: (r && r.detail) || T("Önizleme açılamadı"),
        };
        setQuizView("lobby");
      }
    } catch (e) {
      p.flash = { kind: "err", msg: String(e.message || e) };
      setQuizView("lobby");
    }
  }

  // Faz 3.2: Bulmaca paylaşımı (Twitter intent + clipboard)
  function sharePuzzle() {
    const p = cache.puzzles;
    let pid = null;
    if (p.view === "solving" && p.puzzle) pid = p.puzzle.id;
    else if (p.view === "preview" && p.preview && p.preview.puzzle)
      pid = p.preview.puzzle.id;
    if (!pid) {
      setQuizFlash("err", T("Paylaşılacak bulmaca yok."));
      return;
    }
    const url = `https://forksight.net/share/puzzle/${pid}`;
    const text = T("Bu satranç taktiğini çözebilir misin? 🧩");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).catch(() => {});
      }
    } catch (_) {}
    const intent =
      "https://twitter.com/intent/tweet?text=" +
      encodeURIComponent(text) +
      "&url=" +
      encodeURIComponent(url);
    try {
      window.open(intent, "_blank", "noopener,noreferrer");
    } catch (_) {}
    setQuizFlash("ok", T("Link kopyalandı, Twitter açılıyor…"));
  }

  function backToLobby() {
    const p = cache.puzzles;
    stopQuizTimer();
    if (p.board) {
      try {
        p.board.destroy();
      } catch (_) {}
      p.board = null;
    }
    p.puzzle = null;
    p.preview = null;
    p.usedHint = 0;
    p.hintFromSq = null;
    p.solveStep = 1;
    p.firstUci = null;
    p.oppUci = null;
    p.lichessMoveIndex = 0;
    refreshQuizStats();
    setQuizView("lobby");
  }

  async function loadNextPuzzle() {
    const p = cache.puzzles;
    p.usedHint = 0;
    p.hintFromSq = null;
    setQuizFlash("info", T("Bulmaca yükleniyor..."));
    try {
      const r = await send("quiz_next", { theme: p.themeFilter || "" });
      if (r && r.ok) {
        if (r.stats) p.stats = r.stats;
        if (r.total_puzzles != null) p.totalPuzzles = r.total_puzzles;
        if (r.theme_total != null) p.themeRemaining = r.theme_total;
        if (r.puzzle) {
          p.puzzle = r.puzzle;
          p.lichessMoveIndex = 0;
          if (r.exhausted) {
            setQuizFlash(
              "info",
              r.source_fallback
                ? T(
                    "Kendi bulmacaların tükendiği için Lichess bulmacası gösteriliyor.",
                  )
                : p.themeFilter
                  ? T("Bu temadaki tüm bulmacaları çözdün — tekrar pratiği.")
                  : T("Tüm bulmacaları çözdün — tekrar pratiği başlıyor."),
            );
          } else {
            setQuizFlash("", "");
          }
        } else {
          p.puzzle = null;
          setQuizFlash(
            "info",
            r.exhausted && p.themeFilter
              ? T(
                  "Bu temadaki tüm bulmacaları çözdün! Başka bir tema dene veya tema filtresini kaldır.",
                )
              : T("Bulmaca yok — geçmiş oyunlardan üretmeyi dene."),
          );
        }
      } else {
        p.puzzle = null;
        if (_isQuotaResp(r)) {
          setQuizFlash("err", T("Günlük bulmaca oynama hakkın doldu."));
          showQuotaUpgradeModal(r);
        } else {
          const errMsg = (r && r.detail) || T("Bulmaca alınamadı");
          setQuizFlash("err", errMsg);
        }
      }
    } catch (e) {
      p.puzzle = null;
      setQuizFlash("err", String(e.message || e));
    }
    if (activeTab === "puzzles") {
      renderActive();
      mountQuizBoard();
      if (p.puzzle) startQuizTimer();
      else stopQuizTimer();
    }
  }

  async function refreshQuizStats() {
    try {
      const r = await send("quiz_stats");
      if (r && r.ok) {
        cache.puzzles.stats = r.stats || null;
        cache.puzzles.totalPuzzles = r.total_puzzles || 0;
        cache.puzzles.totalGames = r.total_games || cache.puzzles.totalGames;
        cache.puzzles.processedGames = r.processed_games || 0;
        cache.puzzles.history = Array.isArray(r.recent_attempts)
          ? r.recent_attempts
          : [];
      }
    } catch (_) {}
    try {
      const rd = await send("quiz_daily");
      if (rd && rd.ok) {
        cache.puzzles.daily = {
          day: rd.day,
          puzzles: Array.isArray(rd.puzzles) ? rd.puzzles : [],
          solved: rd.solved || 0,
          total: rd.total || 0,
          completed_at: rd.completed_at || null,
        };
      }
    } catch (_) {}
    if (activeTab === "puzzles") {
      // Lobby görünümde tüm sayfayı yeniden çiz (history listesi de güncellensin),
      // solving/preview'de sadece istatistik sayılarını yerinde tazele.
      const p = cache.puzzles;
      if (p.view === "lobby") {
        renderActive();
        return;
      }
      const s = p.stats || {};
      const ratingHtml = `${esc(s.rating ?? 1200)}<span class="fs-quiz-rd">±${esc(Math.round(s.rd ?? 350))}</span>`;
      const order = [
        ratingHtml,
        s.streak ?? 0,
        s.best_streak ?? 0,
        s.solved_cnt ?? 0,
        s.attempt_cnt ?? 0,
        p.totalPuzzles ?? 0,
      ];
      const nodes = panelEl.querySelectorAll(".fs-quiz-stat-val");
      nodes.forEach((n, i) => {
        if (order[i] == null) return;
        if (i === 0) n.innerHTML = String(order[i]);
        else n.textContent = String(order[i]);
      });
    }
  }

  async function submitQuizUci(uci) {
    const p = cache.puzzles;
    if (!p.puzzle || p.submitting) return;
    p.submitting = true;
    const isLichess = _isLichessPuzzle(p.puzzle);
    const isMate2 = (p.puzzle.type || "").toLowerCase() === "mate2";
    const step = !isLichess && isMate2 ? p.solveStep || 1 : 1;
    // Step-1 (mate2) için zamanlayıcıyı durdurma — devam edecek
    if (!isLichess && (!isMate2 || step === 2)) stopQuizTimer();
    if (p.board)
      try {
        p.board.lock(true);
      } catch (_) {}
    panelEl
      .querySelectorAll("[data-quiz-hint],[data-quiz-submit],[data-quiz-skip]")
      .forEach((b) => (b.disabled = true));
    setQuizFlash("info", T("Kontrol ediliyor..."));
    try {
      const elapsedMs = Math.max(0, Date.now() - (p.startTs || Date.now()));
      const body = isLichess
        ? {
            lichess_id: p.puzzle.lichess_id,
            move_index: p.lichessMoveIndex || 0,
            move_uci: uci,
            used_hint: 0,
            time_ms: elapsedMs,
          }
        : {
            puzzle_id: p.puzzle.id,
            move_uci: uci,
            used_hint: p.usedHint,
            time_ms: elapsedMs,
            step,
            prev_uci: step === 2 ? p.firstUci || "" : null,
            opp_uci: step === 2 ? p.oppUci || "" : null,
          };
      const r = await send(isLichess ? "lichess_move" : "quiz_solve", body);

      if (isLichess && r && r.ok && r.correct && !r.done) {
        p.lichessMoveIndex =
          r.next_move_index != null
            ? Number(r.next_move_index)
            : (p.lichessMoveIndex || 0) + 1;
        setQuizFlash("ok", T("Doğru! Rakip cevap veriyor..."));
        await new Promise((res) => setTimeout(res, 650));
        if (p.board && r.opp_uci) {
          try {
            p.board.applyMove(r.opp_uci, { kind: "info" });
          } catch (_) {}
        }
        setQuizFlash("info", T("Sıra sende."));
        if (p.board)
          try {
            p.board.lock(false);
          } catch (_) {}
        panelEl
          .querySelectorAll(
            "[data-quiz-hint],[data-quiz-submit],[data-quiz-skip]",
          )
          .forEach((b) => (b.disabled = !!b.dataset.quizHint));
        return;
      }

      if (isLichess && r && r.ok && r.correct && r.done) {
        stopQuizTimer();
        const at = r.attempt || {};
        setQuizFlash(
          "ok",
          T("Doğru!") +
            " +" +
            (at.points_delta ?? 0) +
            " " +
            T("puan") +
            " · rating " +
            (at.new_rating ?? "") +
            " (" +
            ((at.rating_delta || 0) >= 0 ? "+" : "") +
            (at.rating_delta ?? 0) +
            ")",
        );
        await refreshQuizStats();
        setTimeout(() => {
          if (activeTab === "puzzles") backToLobby();
        }, 1000);
        return;
      }

      if (isLichess && r && r.ok && !r.correct) {
        stopQuizTimer();
        setQuizFlash(
          "err",
          T("Yanlış.") +
            (r.expected_uci
              ? " " + T("Doğru cevap") + ": " + r.expected_uci
              : ""),
        );
        await refreshQuizStats();
        setTimeout(() => {
          if (activeTab === "puzzles") backToLobby();
        }, 1000);
        return;
      }

      // Faz 3.1: yeni başarımları varsa toast göster
      if (
        r &&
        r.ok &&
        Array.isArray(r.new_achievements) &&
        r.new_achievements.length
      ) {
        try {
          showAchievementToasts(r.new_achievements);
        } catch (_) {}
      }
      // ── Mate-2 step-1 doğru: rakip cevabı oynat, 2. hamleyi bekle
      if (r && r.ok && r.correct && r.continue) {
        p.firstUci = uci;
        p.oppUci = r.opp_uci || "";
        p.solveStep = 2;
        if (p.board) {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          try {
            p.board.flash(from, to, "ok");
          } catch (_) {}
        }
        setQuizFlash("ok", T("Doğru! Rakip cevap veriyor..."));
        // Faz 2.5: ilk hamle doğru → kısa onay
        try {
          speakCoach(
            window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
              ? "Correct! Now find the mating move."
              : "Doğru! Şimdi mat hamlesini bul.",
          );
        } catch (_) {}
        // Rakip cevabını biraz beklet, sonra tahtaya uygula
        await new Promise((res) => setTimeout(res, 700));
        if (p.board && p.oppUci) {
          try {
            p.board.applyMove(p.oppUci, { kind: "info" });
          } catch (_) {}
        }
        // Talimat güncelle ve tahtayı tekrar aç
        setQuizFlash("info", T("Şimdi mat hamlesini bul!"));
        if (p.board)
          try {
            p.board.lock(false);
          } catch (_) {}
        panelEl
          .querySelectorAll(
            "[data-quiz-hint],[data-quiz-submit],[data-quiz-skip]",
          )
          .forEach((b) => (b.disabled = false));
        return;
      }
      if (r && r.ok && r.correct) {
        setQuizFlash(
          "ok",
          T("Doğru!") +
            " +" +
            (r.points_delta ?? 0) +
            " " +
            T("puan") +
            " · rating " +
            (r.rating ?? ""),
        );
        // Ses bittikten 1 sn sonra kapan: speakCoach Promise<void>
        // döner; refreshQuizStats ile paralel çalışsın.
        let _coachP = Promise.resolve();
        try {
          _coachP = speakCoach(_coachPhraseForCorrect(p.puzzle));
        } catch (_) {}
        if (p.board) {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          try {
            p.board.flash(from, to, "ok");
          } catch (_) {}
        }
        await refreshQuizStats();
        try {
          await _coachP;
        } catch (_) {}
        setTimeout(() => {
          if (activeTab === "puzzles") backToLobby();
        }, 1000);
      } else if (r && r.ok && !r.correct) {
        setQuizFlash(
          "err",
          T("Yanlış.") +
            (r.expected_uci
              ? " " + T("Doğru cevap") + ": " + r.expected_uci
              : ""),
        );
        let _coachP = Promise.resolve();
        try {
          _coachP = speakCoach(
            _coachPhraseForWrong(r.expected_san || r.expected_uci || ""),
          );
        } catch (_) {}
        if (p.board) {
          const from = uci.slice(0, 2);
          const to = uci.slice(2, 4);
          try {
            p.board.flash(from, to, "err");
          } catch (_) {}
        }
        await refreshQuizStats();
        try {
          await _coachP;
        } catch (_) {}
        setTimeout(() => {
          if (activeTab === "puzzles") backToLobby();
        }, 1000);
      } else {
        setQuizFlash("err", (r && r.detail) || T("Hata"));
      }
    } catch (e) {
      setQuizFlash("err", String(e.message || e));
    } finally {
      p.submitting = false;
    }
  }

  async function requestQuizHint(level) {
    const p = cache.puzzles;
    if (!p.puzzle) return;
    if (_isLichessPuzzle(p.puzzle)) {
      setQuizFlash("info", T("Lichess bulmacalarında ipucu kapalı."));
      return;
    }
    try {
      const r = await send("quiz_hint", { puzzle_id: p.puzzle.id, level });
      if (r && r.ok) {
        p.usedHint = Math.max(p.usedHint, level);
        if (r.from_sq && p.board) {
          p.hintFromSq = r.from_sq;
          try {
            p.board.highlightHint(r.from_sq);
          } catch (_) {}
        }
        const parts = [T("İpucu") + " " + level];
        if (r.piece_type) parts.push(T("Taş") + ": " + r.piece_type);
        if (r.uci) parts.push(T("Hamle") + ": " + r.uci);
        const statusEl = panelEl.querySelector("[data-quiz-hint-status]");
        if (statusEl) statusEl.textContent = parts.join(" · ");
        // Aktif butonları işaretle
        panelEl.querySelectorAll("[data-quiz-hint]").forEach((b) => {
          const lv = parseInt(b.dataset.quizHint, 10);
          if (lv <= p.usedHint) b.classList.add("fs-active");
        });
      } else if (_isQuotaResp(r)) {
        setQuizFlash("err", T("Günlük ipucu hakkın doldu."));
        showQuotaUpgradeModal(r);
      } else {
        setQuizFlash("err", (r && r.detail) || T("İpucu alınamadı"));
      }
    } catch (e) {
      setQuizFlash("err", String(e.message || e));
    }
  }

  async function runQuizBackfill() {
    // Eski tek-atışlık akış yerine progress'li startBackfill'i çağır.
    cache.puzzles.autoBackfillTried = true;
    await startBackfill({ auto: false });
  }

  // ─── Tab değişimi ─────────────────────────────────────
  function switchTab(id) {
    if (id === "puzzles") {
      activeTab = id;
      renderActive();
      ensurePuzzles();
      return;
    }
    // Bulmacalar dışı sekmeye geçerken aktif tahta/timer'ı temizle
    stopQuizTimer();
    stopBackfillPoll();
    if (cache.puzzles.board) {
      try {
        cache.puzzles.board.destroy();
      } catch (_) {}
      cache.puzzles.board = null;
    }
    if (panelEl) panelEl.classList.remove("fs-panel-quiz");
    activeTab = id;
    renderActive();
    if (id === "profile") ensureProfile();
    else if (id === "games") {
      if (!cache.games.items.length) loadGames(true);
    } else if (id === "weakness") ensureWeakness();
    else if (id === "settings") ensureProfile(); // ccu için
  }

  // ─── Body event bind ──────────────────────────────────
  function bindBody() {
    if (!panelEl) return;
    const body = panelEl.querySelector(".fs-body");
    body.onclick = async (e) => {
      const card = e.target.closest(".fs-game-card");
      if (card) {
        const gid = parseInt(card.dataset.gameId, 10);
        if (gid) openGame(gid);
        return;
      }
      const chipGame = e.target.closest("[data-game-id]");
      if (chipGame && !card) {
        const gid = parseInt(chipGame.dataset.gameId, 10);
        if (gid) openGame(gid);
        return;
      }
      const act = e.target.closest("[data-act]");
      if (act) {
        const a = act.dataset.act;
        if (a === "more-games") switchTab("games");
        else if (a === "load-more") loadGames(false);
        else if (a === "save-ccu") onSaveCcu();
        else if (a === "resync") onResync(false);
        else if (a === "resync-force") onResync(true);
        else if (a === "logout") onLogout();
        else if (a === "lang-en" || a === "lang-tr") {
          if (window.ForkSightI18n) {
            window.ForkSightI18n.setLang(a === "lang-en" ? "en" : "tr");
          }
        } else if (a === "lang-toggle") {
          if (window.ForkSightI18n) window.ForkSightI18n.toggleLang();
        }
        return;
      }
      // Leaderboard metric tab tıklaması
      const lbBtn = e.target.closest("[data-lb-metric]");
      if (lbBtn) {
        const m = lbBtn.dataset.lbMetric;
        if (m && m !== cache.leaderboard.metric) loadLeaderboard(m);
        return;
      }
      const f = e.target.closest("[data-filter]");
      if (f) {
        const [key, val] = f.dataset.filter.split(":");
        cache.games.filter[key] = val;
        loadGames(true);
      }
      // Analiz: time-class seçici
      const wcls = e.target.closest("[data-weakness-class]");
      if (wcls && !wcls.disabled) {
        cache.weaknessClass = wcls.dataset.weaknessClass;
        renderActive();
        return;
      }
      // Bulmacalar: ipucu
      const hintBtn = e.target.closest("[data-quiz-hint]");
      if (hintBtn && !hintBtn.disabled) {
        const lv = parseInt(hintBtn.dataset.quizHint, 10);
        if (lv >= 1 && lv <= 3) requestQuizHint(lv);
        return;
      }
      // Bulmacalar: cevapla / atla
      const submitBtn = e.target.closest("[data-quiz-submit]");
      if (submitBtn && !submitBtn.disabled) {
        const inp = panelEl.querySelector("[data-quiz-input]");
        const v = ((inp && inp.value) || "").trim().toLowerCase();
        if (v) submitQuizUci(v);
        return;
      }
      const skipBtn = e.target.closest("[data-quiz-skip]");
      if (skipBtn && !skipBtn.disabled) {
        backToLobby();
        return;
      }
      // Bulmacalar: geçmiş öğesine tıkla → önizleme
      const histBtn = e.target.closest("[data-quiz-hist]");
      if (histBtn) {
        const pid = parseInt(histBtn.dataset.quizHist, 10);
        if (pid) openPuzzlePreview(pid);
        return;
      }
      // Bulmacalar: lobby/üst-bar aksiyonları
      const qact = e.target.closest("[data-quiz-act]");
      if (qact) {
        const a = qact.dataset.quizAct;
        if (a === "start") startNewPuzzle();
        else if (a === "back") backToLobby();
        else if (a === "backfill") runQuizBackfill();
        else if (a === "refresh") refreshQuizStats();
        else if (a === "theme-clear") clearThemeFilter();
        else if (a === "daily-start") startDailyChallenge();
        else if (a === "share") sharePuzzle();
        return;
      }
      // Faz 2.6: Tema kartı tıklandığında o temadan oturum başlat
      const themeCard = e.target.closest("[data-fs-theme]");
      if (themeCard) {
        const themeKey = String(themeCard.dataset.fsTheme || "").toLowerCase();
        const themeLab = themeCard.dataset.fsThemeLabel || themeKey;
        if (themeKey) setThemeFilterAndStart(themeKey, themeLab);
        return;
      }
    };
    // Bulmacalar: Enter ile gönder
    body.onkeydown = (e) => {
      if (e.key !== "Enter") return;
      const inp = e.target.closest("[data-quiz-input]");
      if (!inp) return;
      const v = (inp.value || "").trim().toLowerCase();
      if (v) submitQuizUci(v);
    };
  }

  async function onSaveCcu() {
    const input = panelEl.querySelector('[data-set="ccu"]');
    const msg = panelEl.querySelector('[data-msg="ccu"]');
    const btn = panelEl.querySelector('[data-act="save-ccu"]');
    const v = (input.value || "").trim();
    if (!v) {
      msg.className = "fs-msg fs-err";
      msg.textContent = T("Boş olamaz.");
      return;
    }
    btn.disabled = true;
    msg.textContent = T("Kaydediliyor…");
    msg.className = "fs-msg";
    try {
      const resp = await send("chess_com_link", { chess_com_username: v });
      if (resp && resp.ok) {
        msg.className = "fs-msg fs-ok";
        msg.textContent =
          window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
            ? `Linked: ${resp.chess_com_username}. Syncing games…`
            : `Bağlandı: ${resp.chess_com_username}. Oyunlar senkronize ediliyor…`;
        cache.profile = null;
        cache.games.items = [];
        cache.weakness = null;
        setTimeout(() => ensureProfile(true), 1500);
      } else {
        msg.className = "fs-msg fs-err";
        msg.textContent =
          resp && resp.status === 404
            ? T("Chess.com kullanıcısı bulunamadı.")
            : (resp && resp.detail) || T("Bağlanılamadı.");
      }
    } catch (_) {
      msg.className = "fs-msg fs-err";
      msg.textContent = T("Sunucuya ulaşılamadı.");
    } finally {
      btn.disabled = false;
    }
  }

  async function onResync(force) {
    const msg = panelEl.querySelector('[data-msg="sync"]');
    const btn = panelEl.querySelector(
      force ? '[data-act="resync-force"]' : '[data-act="resync"]',
    );
    const otherBtn = panelEl.querySelector(
      force ? '[data-act="resync"]' : '[data-act="resync-force"]',
    );
    if (force) {
      const ok = confirm(
        T(
          "Tüm chess.com oyunları, bulmacalar ve istatistikler silinip yeniden çekilecek. Devam edilsin mi?",
        ),
      );
      if (!ok) return;
    }
    if (btn) btn.disabled = true;
    if (otherBtn) otherBtn.disabled = true;
    msg.className = "fs-msg";
    msg.textContent = T("Senkronize ediliyor…");
    try {
      const resp = await send("chess_com_sync", { force: !!force });
      if (resp && resp.ok) {
        msg.className = "fs-msg fs-ok";
        let txt = T("Senkronizasyon başlatıldı, birkaç saniye sürebilir.");
        if (resp.purged) {
          txt =
            T("Eski veriler temizlendi.") + " " + T("Yeni oyunlar çekiliyor…");
        }
        msg.textContent = txt;
        cache.profile = null;
        cache.games.items = [];
        cache.weakness = null;
        if (cache.puzzles) {
          cache.puzzles.stats = null;
          cache.puzzles.totalPuzzles = 0;
          cache.puzzles.history = [];
          cache.puzzles.autoBackfillTried = false;
        }
      } else {
        msg.className = "fs-msg fs-err";
        msg.textContent =
          (resp && resp.detail) ||
          (window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
            ? "Error."
            : "Hata.");
      }
    } catch (_) {
      msg.className = "fs-msg fs-err";
      msg.textContent = T("Sunucuya ulaşılamadı.");
    } finally {
      if (btn) btn.disabled = false;
      if (otherBtn) otherBtn.disabled = false;
    }
  }

  function onLogout() {
    try {
      chrome.runtime.sendMessage({ type: "logout" }, () => {
        try {
          chrome.storage.local.remove(["taktik_token", "taktik_refresh_token"]);
        } catch (_) {}
        close();
        try {
          window.location.reload();
        } catch (_) {}
      });
    } catch (_) {
      close();
    }
  }

  // ─── Mount / unmount ──────────────────────────────────
  // Panel kabuğunu (sidebar + header) içine render eder. Dil değişince
  // de yeniden çağrılarak tab etiketleri, header dil rozeti vs. yenilenir.
  function renderPanelShell() {
    if (!panelEl) return;
    const langCode =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
        ? "TR"
        : "EN";
    panelEl.innerHTML = `
      <aside class="fs-sidebar">
        <div class="fs-brand">
          <img class="fs-brand-ico" src="${chrome.runtime.getURL("avatars/neutral.png")}" alt="" />
          <span>ForkSight</span>
        </div>
        <nav class="fs-tabs">
          ${TABS.map(
            (t) =>
              `<button class="fs-tab" data-tab="${t.id}"><span class="fs-tab-ico">${t.icon}</span><span>${esc(T(t.trLabel))}</span></button>`,
          ).join("")}
        </nav>
        <button class="fs-premium-pill" data-act="premium" title="${T("Premium planını görüntüle / yükselt")}">⭐ ${T("Premium")}</button>
      </aside>
      <main class="fs-main">
        <div class="fs-header">
          <button class="fs-icon-btn fs-lang-btn" data-act="lang-toggle" aria-label="${T("Dil")}" title="${T("Dil")}">🌐 <span class="fs-lang-code">${langCode}</span></button>
          <button class="fs-icon-btn" data-act="close" aria-label="${T("Kapat")}">×</button>
        </div>
        <div class="fs-body"></div>
      </main>
    `;

    // Header dispatcher
    panelEl.querySelector(".fs-header").addEventListener("click", (e) => {
      const a = e.target.closest("[data-act]");
      if (!a) return;
      if (a.dataset.act === "close") close();
      else if (a.dataset.act === "lang-toggle" && window.ForkSightI18n) {
        window.ForkSightI18n.toggleLang();
      }
    });
    panelEl.querySelectorAll(".fs-tab").forEach((t) => {
      t.addEventListener("click", () => switchTab(t.dataset.tab));
    });
    // Active tab vurgusu
    panelEl.querySelectorAll(".fs-tab").forEach((t) => {
      t.classList.toggle("fs-active", t.dataset.tab === activeTab);
    });
    // Premium pill: durum etiketini güncelle + tıklamada premium sayfasını aç
    const pill = panelEl.querySelector(".fs-premium-pill");
    if (pill) {
      pill.addEventListener("click", openPremiumPage);
      updatePremiumPill();
    }
  }

  // Premium pill etiketini quota cache'inden günceller:
  // free → "⭐ Premium'a Geç", gold → "★ Gold · Ng", diamond → "💎 Diamond · Ng".
  function updatePremiumPill() {
    if (!panelEl) return;
    const pill = panelEl.querySelector(".fs-premium-pill");
    if (!pill) return;
    const q = cache.quota;
    const tier = (q && q.tier) || "free";
    const isTr = !(
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
    );
    let label;
    if (tier === "diamond") label = "💎 " + T("Diamond");
    else if (tier === "gold") label = "★ " + T("Gold");
    else label = "⭐ " + T("Premium'a Geç");
    // Süreli üyelikse kalan günü ekle (sınırsız/abonelik için premium_until null).
    if ((tier === "gold" || tier === "diamond") && q && q.premium_until) {
      const now =
        q.server_time && q.server_time > 0 ? q.server_time : Date.now() / 1000;
      const days = Math.ceil((Number(q.premium_until) - now) / 86400);
      if (days > 0) label += isTr ? ` · ${days} gün` : ` · ${days}d`;
    }
    pill.innerHTML = esc(label);
    pill.classList.toggle("fs-pill-gold", tier === "gold");
    pill.classList.toggle("fs-pill-diamond", tier === "diamond");
  }

  // Premium sayfasını yeni sekmede açar. Kullanıcı eklentide giriş yapmışsa
  // token'ı hash ile geçirir → premium.html otomatik oturum açar (tekrar
  // giriş gerekmez). Token yoksa düz açar.
  async function openPremiumPage() {
    let base = await getCoachApiBase();
    if (!base) base = "https://forksight.net";
    let url = base + "/premium";
    try {
      const r = await send("get_token");
      if (r && r.token) {
        const u =
          (cache.profile &&
            cache.profile.user &&
            cache.profile.user.username) ||
          "";
        url +=
          "#token=" +
          encodeURIComponent(r.token) +
          (u ? "&user=" + encodeURIComponent(u) : "");
      }
    } catch (_) {}
    try {
      window.open(url, "_blank", "noopener");
    } catch (_) {
      location.href = url;
    }
  }

  function buildPanel(anchorRect) {
    if (hostEl) return;
    hostEl = document.createElement("div");
    hostEl.id = HOST_ID;
    document.body.appendChild(hostEl);
    shadow = hostEl.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = panelCSS();
    shadow.appendChild(style);

    const overlay = document.createElement("div");
    overlay.className = "fs-overlay";
    overlay.addEventListener("click", close);
    shadow.appendChild(overlay);

    panelEl = document.createElement("div");
    panelEl.className = "fs-panel";
    // Konum: ekran ortası
    const left = Math.round((window.innerWidth - PANEL_W) / 2);
    const top = Math.round((window.innerHeight - PANEL_H) / 2);
    panelEl.style.left = left + "px";
    panelEl.style.top = top + "px";
    // Transform origin = avatar merkezi (panel'in sol-üstüne göre %)
    if (anchorRect) {
      const acx = anchorRect.left + anchorRect.width / 2;
      const acy = anchorRect.top + anchorRect.height / 2;
      const ox = Math.max(0, Math.min(100, ((acx - left) / PANEL_W) * 100));
      const oy = Math.max(0, Math.min(100, ((acy - top) / PANEL_H) * 100));
      panelEl.style.setProperty("--fs-origin-x", ox + "%");
      panelEl.style.setProperty("--fs-origin-y", oy + "%");
    }

    renderPanelShell();
    shadow.appendChild(panelEl);

    // İlk render + animasyon
    activeTab = "profile";
    renderActive();
    ensureProfile();
    requestAnimationFrame(() => {
      overlay.classList.add("fs-show");
      panelEl.classList.add("fs-show");
    });

    // Dil değişimi: kabuğu (sidebar + header etiketleri) ve aktif body'yi yeniden çiz.
    if (window.ForkSightI18n) {
      langUnsub = window.ForkSightI18n.onChange(() => {
        if (!panelEl) return;
        renderPanelShell();
        renderActive();
      });
    }

    document.addEventListener("keydown", onEsc, true);
  }

  function onEsc(e) {
    if (e.key === "Escape") close();
  }

  function close() {
    document.removeEventListener("keydown", onEsc, true);
    if (langUnsub) {
      try {
        langUnsub();
      } catch (_) {}
      langUnsub = null;
    }
    // Quiz timer + board temizliği
    stopQuizTimer();
    stopBackfillPoll();
    if (cache.puzzles.board) {
      try {
        cache.puzzles.board.destroy();
      } catch (_) {}
      cache.puzzles.board = null;
    }
    if (!hostEl) return;
    try {
      const overlay = shadow.querySelector(".fs-overlay");
      const p = shadow.querySelector(".fs-panel");
      if (overlay) overlay.classList.remove("fs-show");
      if (p) p.classList.remove("fs-show");
    } catch (_) {}
    setTimeout(() => {
      try {
        hostEl && hostEl.parentNode && hostEl.parentNode.removeChild(hostEl);
      } catch (_) {}
      hostEl = null;
      shadow = null;
      panelEl = null;
      // Cache'i koru — kapanıp tekrar açılınca anlık göstersin.
    }, 320);
  }

  function open(opts) {
    opts = opts || {};
    if (hostEl) {
      close();
      setTimeout(() => buildPanel(opts.anchorRect || null), 50);
    } else {
      buildPanel(opts.anchorRect || null);
    }
  }

  window.ForkSightProfile = { open, close };
})();
