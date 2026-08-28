/**
 * profile-panel.js — ForkSight kullanıcı profil paneli.
 *
 * Public API:
 *   window.ForkSightProfile.open({ anchorRect })
 *   window.ForkSightProfile.close()
 *
 * Açılış: avatar konumundan (anchorRect) scale animasyon ile
 * V3 dashboard paneli olarak ekranın merkezine doğru açılır.
 *
 * Tablar (V3): Ana Sayfa, Koç, Antrenman, Oyunlarım, İlerleme,
 * Başarılar, Arena, Profil, Ayarlar (+ sidebar PRO).
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
  const PANEL_W = 1080;
  const PANEL_H = 720;

  // V3 nav — primary / secondary / utility grupları.
  // Cache alan adları (weakness/puzzles/leaderboard) korunur; tab id'ler yeni.
  const TABS = [
    {
      id: "home",
      trLabel: "Ana Sayfa",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>`,
      group: "primary",
    },
    {
      id: "coach",
      trLabel: "Koç",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.2 19c1.5-3.1 3.9-4.7 6.8-4.7S17.3 15.9 18.8 19"/></svg>`,
      group: "primary",
    },
    {
      id: "training",
      trLabel: "Antrenman",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4v2.2M12 17.8V20M4 12h2.2M17.8 12H20"/><path d="m16.9 6.3 1.9-2.3"/><path d="m18 5.1-.9 2.3"/></svg>`,
      group: "primary",
    },
    {
      id: "games",
      trLabel: "Oyunlarım",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21h10"/><path d="M8 21V12h8v9"/><path d="M8 12h8"/><path d="M9 12V8h1.2V5.5h1.3V8H12.5V5.5h1.3V8H15V12"/><path d="M9.5 15h5M9.5 18h5"/><path d="M11.2 18.2v1.2h1.6v-1.2"/></svg>`,
      group: "primary",
    },
    {
      id: "progress",
      trLabel: "İlerleme",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V12M11 20V8M17 20v-5"/><path d="m4 14 5.5-4.5 3.5 2.5L20 6"/><path d="M16.5 6H20v3.5"/></svg>`,
      group: "primary",
    },
    {
      id: "achievements",
      trLabel: "Başarılar",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v3a4 4 0 0 1-4 4 4 4 0 0 1-4-4V4z"/><path d="M8 5H5a2.5 2.5 0 0 0 2.5 3.5M16 5h3a2.5 2.5 0 0 1-2.5 3.5"/><path d="M10 14h4v2h-4zM9.5 20h5"/><path d="M10.5 16h3v2.5h-3z"/></svg>`,
      group: "secondary",
    },
    {
      id: "arena",
      trLabel: "Arena",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 4.8h13v4.5c0 4.6-2.8 7.9-6.5 9.6-3.7-1.7-6.5-5-6.5-9.6V4.8z"/><path d="m13.2 7.2-3.4 5.2h2.4L10.8 16.8l3.6-5.4h-2.4z" fill="currentColor" stroke="none"/></svg>`,
      group: "secondary",
    },
    {
      id: "profile",
      trLabel: "Profil",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.2 19c1.5-3.1 3.9-4.7 6.8-4.7S17.3 15.9 18.8 19"/></svg>`,
      group: "secondary",
    },
    {
      id: "settings",
      trLabel: "Ayarlar",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.15" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.2M12 19v2.2M2.8 12h2.2M19 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M5.1 18.9l1.6-1.6M17.3 6.7l1.6-1.6"/><path d="M12 6.2a5.8 5.8 0 1 1 0 11.6 5.8 5.8 0 0 1 0-11.6z"/></svg>`,
      group: "secondary",
    },
  ];

  // ─── Durum ────────────────────────────────────────────
  let hostEl = null;
  let shadow = null;
  let panelEl = null;
  let activeTab = "home";
  let coachSubTab = "all"; // all | mine
  let selectedCoachId = "tilki";
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
      result: null, // { correct, userUci, expectedUci, expectedSan, pointsDelta, rating, phrase }
      themeFilter: "", // Faz 2.6: aktif tema filtresi (örn. "pin")
      themeFilterLabel: "", // UI gösterim etiketi
      themeRemaining: 0, // o temadan toplam puzzle adedi
    },
    achievements: null, // {items, earned_count, total_count} | "loading"
    quota: null, // /me/quota cevabı: {is_premium, premium_until, features:{...}}
    notifications: {
      open: false,
      loading: false,
      items: [],
      unread: 0,
      readIds: {},
    },
    arenaChest: { opening: false, opened: false },
    coachPlayGames: null, // null=loading | [] | CoachPlayGame[]
    leaderboard: {
      data: null, // {top, me, metric} | null
      metric: "points", // points | rating | solved | day_streak | weekly_solved
      loading: false,
    },
    sync: {
      active: false,
      progress: 0,
      phase: "",
      message: "",
      gamesTotal: 0,
      inserted: 0,
      error: null,
      pollId: null,
    },
    onboard: {
      step: 0, // 0 welcome | 1 link | 2 sync | 3 done
      dismissed: false,
      linking: false,
    },
    verifyCode: null,
    verifyCodeLoading: false,
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

  function chessLinkErrorMessage(resp) {
    if (!resp) return T("Bağlanılamadı.");
    if (resp.status === 404) return T("Chess.com kullanıcısı bulunamadı.");
    if (resp.status === 409) {
      return (
        (typeof resp.detail === "string" && resp.detail) ||
        resp.message ||
        T("Bu chess.com hesabı başka bir ForkSight kullanıcısına bağlı.")
      );
    }
    if (
      resp.code === "VERIFY_CODE_MISSING" ||
      (resp.verify_code && resp.message)
    ) {
      return (
        resp.message ||
        T(
          "Doğrulama kodu chess.com profilinde bulunamadı. Kodu Konum, Ad Soyad veya Hakkında alanına ekle.",
        )
      );
    }
    if (typeof resp.detail === "string" && resp.detail) return resp.detail;
    if (resp.detail && typeof resp.detail === "object" && resp.detail.message) {
      return resp.detail.message;
    }
    if (resp.error) return resp.error;
    return T("Bağlanılamadı.");
  }

  async function ensureVerifyCode(force) {
    if (cache.verifyCode && !force) return cache.verifyCode;
    if (cache.verifyCodeLoading) return cache.verifyCode;
    cache.verifyCodeLoading = true;
    try {
      const resp = await send("chess_com_verify_code");
      if (resp && resp.ok && resp.verify_code) {
        cache.verifyCode = String(resp.verify_code);
        return cache.verifyCode;
      }
    } catch (_) {
      /* ignore */
    } finally {
      cache.verifyCodeLoading = false;
    }
    return cache.verifyCode;
  }

  function renderVerifyCodeBox(opts) {
    const o = opts || {};
    const code = cache.verifyCode || "";
    const compact = !!o.compact;
    if (!code && !cache.verifyCodeLoading) {
      ensureVerifyCode().then((c) => {
        if (c && panelEl) renderActive();
      });
    }
    const codeHtml = code
      ? `<code class="fs-verify-code" data-verify-code>${esc(code)}</code>
         <button type="button" class="fs-btn fs-ghost fs-verify-copy" data-act="copy-verify-code">${T("Kopyala")}</button>`
      : `<span class="fs-v3-sub">${
          cache.verifyCodeLoading
            ? T("Kod yükleniyor…")
            : T("Kod alınamadı — paneli yenile.")
        }</span>`;
    return `
      <div class="fs-verify-box" ${compact ? 'style="margin-top:8px"' : ""}>
        <div class="fs-verify-lab">${T("Doğrulama kodun")}</div>
        <div class="fs-verify-row">${codeHtml}</div>
        <div class="fs-onboard-tip" style="margin-top:8px">
          ${T(
            "Bu kodu Chess.com → Ayarlar → Profil’de <b>Konum</b>, <b>Ad Soyad</b> veya <b>Hakkında</b> alanlarından birine yapıştır ve kaydet. Sonra kullanıcı adını yazıp Bağla’ya bas.",
          )}
        </div>
      </div>`;
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
        ? T("{n} gündür buradasın — devam et!")
        : streak < 30
          ? T("{n} günlük seri — etkileyici!")
          : T("{n} gün! Sen bir efsanesin 🔥");
    return tpl.replace("{n}", String(streak));
  }

  function isUserBlack(color) {
    const c = String(color || "").toLowerCase();
    return c === "b" || c === "black";
  }

  function isUserWhite(color) {
    const c = String(color || "").toLowerCase();
    return c === "w" || c === "white";
  }

  /** Oyun satırında "ben" = chess.com tarafı, rakip = diğer taraf. */
  function gameParticipants(g, profileUser) {
    const black = isUserBlack(g && g.user_color);
    const meName =
      (black ? g && g.black_username : g && g.white_username) ||
      (profileUser && profileUser.chess_com_username) ||
      (profileUser && profileUser.username) ||
      "Sen";
    const oppName =
      (black ? g && g.white_username : g && g.black_username) ||
      (g && (g.opponent || g.opponent_username)) ||
      "?";
    const meRating = black
      ? g && g.black_rating
      : g && g.white_rating;
    const oppRating = black
      ? g && g.white_rating
      : g && g.black_rating;
    const meAv =
      (profileUser && profileUser.chess_com_avatar) ||
      (black ? g && g.black_avatar : g && g.white_avatar) ||
      "";
    const oppAv =
      (g && (g.opponent_avatar || (black ? g.white_avatar : g.black_avatar))) ||
      "";
    return { meName, oppName, meRating, oppRating, meAv, oppAv, black };
  }

  function boardSvgHTML(g) {
    try {
      const R = window.ForkSightReview;
      if (
        R &&
        typeof R._buildBoardSVG === "function" &&
        typeof R._fenToPosition === "function" &&
        g &&
        g.final_fen
      ) {
        const pos = R._fenToPosition(g.final_fen);
        if (pos && pos.board) {
          return R._buildBoardSVG(
            { pos, fen: g.final_fen, from: null, to: null },
            isUserBlack(g.user_color),
          );
        }
      }
    } catch (_) {}
    return simpleBoardSvg(g && g.final_fen, isUserBlack(g && g.user_color));
  }

  /** Lightweight mini-board when coach-review helpers aren't loaded. */
  function simpleBoardSvg(fen, flip) {
    const glyphs = {
      K: "♔",
      Q: "♕",
      R: "♖",
      B: "♗",
      N: "♘",
      P: "♙",
      k: "♚",
      q: "♛",
      r: "♜",
      b: "♝",
      n: "♞",
      p: "♟",
    };
    const start =
      fen ||
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const rows = String(start).split(/\s+/)[0].split("/");
    if (rows.length !== 8) return "";
    const light = "#eeeed2";
    const dark = "#769656";
    let cells = "";
    for (let r = 0; r < 8; r++) {
      const rowStr = flip ? rows[7 - r] : rows[r];
      const expanded = [];
      for (const ch of rowStr) {
        if (/\d/.test(ch)) {
          for (let i = 0; i < Number(ch); i++) expanded.push("");
        } else expanded.push(ch);
      }
      while (expanded.length < 8) expanded.push("");
      for (let f = 0; f < 8; f++) {
        const piece = flip ? expanded[7 - f] : expanded[f];
        const x = f * 20;
        const y = r * 20;
        const isDark = (r + f) % 2 === 1;
        cells += `<rect x="${x}" y="${y}" width="20" height="20" fill="${isDark ? dark : light}"/>`;
        if (piece) {
          const g = glyphs[piece] || "";
          const fill = piece === piece.toUpperCase() ? "#f5f5f5" : "#1a1a1a";
          cells += `<text x="${x + 10}" y="${y + 15}" text-anchor="middle" font-size="13" font-family="Segoe UI Symbol, Noto Sans Symbols, sans-serif" fill="${fill}">${g}</text>`;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="100%" height="100%" style="display:block">${cells}</svg>`;
  }

  function miniBoardHTML(g) {
    const svg = boardSvgHTML(g) || simpleBoardSvg(null, false);
    return `<div class="fs-mini-board">${svg}</div>`;
  }

  function gameThumbHTML(g) {
    const svg = boardSvgHTML(g);
    const resultClass =
      g.result === "win" ? "win" : g.result === "loss" ? "loss" : "draw";
    const resultLabel =
      g.result === "win"
        ? T("Kazandı")
        : g.result === "loss"
          ? T("Kaybetti")
          : T("Beraberlik");
    const parts = gameParticipants(g, cache.profile && cache.profile.user);
    const opp = `${esc(parts.oppName || "?")} (${parts.oppRating || "?"})`;
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
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        color: #eceef4;
      }
      .fs-panel {
        --fs-bg: #12141d;
        --fs-bg-elev: #181b26;
        --fs-bg-soft: #222633;
        --fs-card: rgba(255,255,255,0.04);
        --fs-accent: #f5c542;
        --fs-accent-dim: rgba(245,197,66,0.18);
        --fs-text: #eceef4;
        --fs-text-dim: #9ba0aa;
        --fs-good: #3dd68c;
        --fs-bad: #ff6b6b;
        --fs-warn: #f5c542;
        --fs-tactics: #3dd68c;
        --fs-opening: #4c8dff;
        --fs-calc: #a78bfa;
        --fs-endgame: #f0a020;
        --fs-consist: #2dd4bf;
        --fs-border: rgba(255,255,255,0.07);
        --fs-radius: 12px;
        --fs-radius-lg: 18px;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        color: var(--fs-text);
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
      .fs-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        z-index: 2147483646;
        opacity: 0;
        transition: opacity .25s ease;
      }
      .fs-overlay.fs-show { opacity: 1; }
      .fs-panel.fs-show {
        transform: scale(1) rotate(0deg);
        opacity: 1;
      }
      /* Bulmaca çözüm/önizleme görünümünde panel büyür */
      .fs-panel.fs-panel-quiz {
        width: min(940px, 98vw);
        height: min(640px, 96vh);
      }

      /* ── Sol sidebar (V3) ── */
      .fs-sidebar {
        flex: 0 0 200px;
        background: linear-gradient(180deg, #161924 0%, #101218 72%);
        border-right: 1px solid var(--fs-border);
        display: flex; flex-direction: column;
        padding: 14px 10px 12px;
        gap: 4px;
        position: relative;
        overflow: hidden;
      }
      .fs-sidebar::before {
        content: "";
        position: absolute; left: 0; right: 0; bottom: 0; height: 160px;
        background:
          linear-gradient(0deg, rgba(18,20,29,0.2), transparent),
          repeating-conic-gradient(#1a1d28 0% 25%, #12141d 0% 50%) 0 0 / 18px 18px;
        opacity: 0.35; pointer-events: none; z-index: 0;
        mask-image: linear-gradient(180deg, transparent, #000 40%);
        -webkit-mask-image: linear-gradient(180deg, transparent, #000 40%);
      }
      .fs-sidebar::after {
        content: "";
        position: absolute; left: -40px; bottom: -20px;
        width: 180px; height: 180px;
        background: radial-gradient(circle, rgba(245,197,66,0.14), transparent 70%);
        pointer-events: none; z-index: 0;
      }
      .fs-brand {
        display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
        font-family: Georgia, "Times New Roman", serif;
        font-weight: 700; font-size: 12px; letter-spacing: 1.8px;
        color: #f5c542;
        text-transform: uppercase;
        padding: 4px 8px 14px 8px;
        position: relative; z-index: 1;
      }
      .fs-brand-ico {
        width: 52px; height: 52px; border-radius: 0;
        object-fit: contain;
        background: transparent;
        flex: 0 0 auto;
        filter: drop-shadow(0 2px 12px rgba(245,197,66,0.45));
      }
      .fs-tabs {
        display: flex; flex-direction: column; gap: 2px;
        flex: 1;
        position: relative; z-index: 1;
        overflow-y: auto;
      }
      .fs-nav-sep {
        height: 1px; margin: 8px 6px;
        background: var(--fs-border);
      }
      .fs-tab {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 12px; border-radius: 10px;
        background: transparent; border: 0; color: var(--fs-text-dim);
        font-size: 12.5px; font-weight: 600; cursor: pointer;
        transition: background .15s ease, color .15s ease;
        text-align: left;
        min-width: 0;
      }
      .fs-tab > span:nth-child(2) {
        min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .fs-tab .fs-tab-new { flex: 0 0 auto; }
      .fs-tab .fs-tab-ico {
        width: 20px; height: 20px; display: grid; place-items: center;
        flex: 0 0 auto;
      }
      .fs-tab .fs-tab-ico svg { display: block; width: 18px; height: 18px; }
      .fs-tab.fs-active .fs-tab-ico { color: #f5c542; }
      .fs-tab:hover { color: var(--fs-text); background: rgba(255,255,255,0.04); }
      .fs-tab.fs-active {
        background: rgba(58, 50, 36, 0.92);
        color: #f5c542;
        border-radius: 12px;
        opacity: 1;
        box-shadow:
          0 0 0 1px rgba(245,197,66,0.28),
          0 0 18px rgba(245,197,66,0.12),
          inset 0 1px 0 rgba(245,197,66,0.08);
        font-weight: 700;
      }
      .fs-tab.fs-tab-secondary { opacity: 0.92; font-weight: 500; }
      .fs-tab.fs-tab-secondary.fs-active { opacity: 1; font-weight: 700; }
      .fs-pro-card {
        display: flex; flex-direction: column; gap: 2px;
        padding: 12px 40px 12px 12px; border-radius: 14px;
        background: rgba(245,197,66,0.05);
        border: 1px solid rgba(245,197,66,0.32);
        cursor: pointer; position: relative; z-index: 1;
        text-align: left; color: var(--fs-text);
        box-shadow: 0 0 18px rgba(245,197,66,0.08);
        margin-top: auto;
      }
      .fs-pro-card:hover { border-color: rgba(245,197,66,0.5); }
      .fs-pro-card-title {
        display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
        font-size: 11px; font-weight: 700; color: var(--fs-accent); line-height: 1.15;
      }
      .fs-pro-card-title .fs-pro-name { font-size: 11px; font-weight: 700; }
      .fs-pro-card-title .fs-pro-pro { font-size: 17px; font-weight: 800; letter-spacing: 0.06em; }
      .fs-pro-card-title img {
        width: 18px; height: 18px; object-fit: contain;
        position: absolute; right: 10px; bottom: 10px;
      }
      .fs-pro-go {
        display: none; margin-top: 8px; width: 100%; text-align: center;
        border-radius: 8px; padding: 7px 8px; font-size: 11px; font-weight: 800;
        background: linear-gradient(135deg, #f5c542, #e0a820); color: #1a1408;
      }
      .fs-panel[data-tab="coach"]:not(.fs-user-premium) .fs-pro-go { display: block; }
      .fs-pro-card-sub {
        display: none; font-size: 11px; color: var(--fs-text-dim); margin-top: 6px; line-height: 1.35;
      }
      .fs-panel[data-tab="coach"]:not(.fs-user-premium) .fs-pro-card-sub { display: block; }
      .fs-tab-new {
        margin-left: auto; font-size: 9px; font-weight: 900; letter-spacing: 0.04em;
        padding: 2px 6px; border-radius: 999px; background: #f5c542; color: #1a1408;
      }
      .fs-panel[data-tab="profile"] .fs-lang-btn,
      .fs-panel[data-tab="arena"] .fs-lang-btn { display: none; }
      .fs-premium-pill { display: none; }

      /* ── Sağ ana alan ── */
      .fs-main {
        flex: 1 1 auto; min-width: 0;
        display: flex; flex-direction: column;
        background: var(--fs-bg);
      }
      .fs-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 16px 0 16px; gap: 8px;
      }
      .fs-header-left { min-width: 0; flex: 1; }
      .fs-header-right { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; }
      .fs-greet-title {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 28px; font-weight: 700; letter-spacing: -0.02em;
        color: var(--fs-text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .fs-panel[data-tab="coach"] .fs-greet-title {
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
        font-size: 22px; font-weight: 900; letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .fs-panel[data-tab="coach"] .fs-greet-sub { color: #d4b45a; }
      .fs-panel[data-tab="coach"] .fs-lang-btn { display: none; }
      .fs-panel[data-tab="coach"] .fs-body {
        padding-top: 8px;
        overflow: auto;
      }
      .fs-v3-title {
        font-family: Georgia, "Times New Roman", serif;
        font-size: 24px; font-weight: 600; margin-bottom: 4px; letter-spacing: -0.01em;
        color: var(--fs-text);
      }
      .fs-header-av {
        width: 36px; height: 36px; border-radius: 50%;
        object-fit: cover; flex: 0 0 auto;
        border: 1.5px solid rgba(255,255,255,0.18);
        box-shadow: 0 0 0 2px rgba(18,20,29,0.9);
        position: relative;
      }
      .fs-header-av-wrap {
        position: relative; width: 36px; height: 36px; flex: 0 0 auto;
      }
      .fs-header-av-wrap::after {
        content: ""; position: absolute; top: -1px; right: -1px;
        width: 10px; height: 10px; border-radius: 50%;
        background: #3dd68c; border: 2px solid #12141d;
      }
      .fs-train-stats {
        display: flex; align-items: center; gap: 12px;
      }
      .fs-train-level {
        display: flex; align-items: center; gap: 8px; min-width: 148px;
      }
      .fs-train-level .fs-hs-ico { font-size: 26px; filter: drop-shadow(0 2px 8px rgba(245,197,66,0.45)); }
      .fs-train-level .fs-hs-txt { flex: 1; min-width: 0; }
      .fs-train-level .fs-hs-lab { font-size: 12px; font-weight: 700; color: var(--fs-text); }
      .fs-train-level .fs-hs-lab strong { font-size: 15px; }
      .fs-train-level .fs-skill-bar {
        margin-top: 5px; width: 100%; height: 5px;
        background: rgba(255,255,255,0.08);
      }
      .fs-train-level .fs-skill-bar > i {
        background: linear-gradient(90deg, #ffd45a, #f5c542);
        box-shadow: 0 0 8px rgba(245,197,66,0.4);
      }
      .fs-train-level .fs-xp-lab {
        margin-top: 3px; font-size: 10px; font-weight: 600; color: var(--fs-text-dim);
      }
      .fs-train-streak {
        display: flex; align-items: center; gap: 8px;
        padding-right: 12px;
        border-right: 1px solid rgba(255,255,255,0.12);
      }
      .fs-train-streak .fs-hs-ico { font-size: 22px; }
      .fs-train-streak .fs-hs-val { font-size: 18px; font-weight: 800; color: var(--fs-text); line-height: 1; }
      .fs-train-streak .fs-hs-lab { font-size: 11px; font-weight: 600; color: var(--fs-text-dim); }
      .fs-panel[data-tab="arena"] .fs-train-level .fs-skill-bar > i,
      .fs-panel[data-tab="training"] .fs-train-level .fs-skill-bar > i {
        background: linear-gradient(90deg, #f59e0b, #f5c542 55%, #e8b020);
      }
      .fs-greet-sub { font-size: 14px; color: var(--fs-text-dim); margin-top: 6px; }
      .fs-home-stats {
        display: flex; align-items: stretch; gap: 0;
        margin: 4px 0 16px; padding: 16px 10px;
        border-radius: 16px;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.07);
      }
      .fs-home-stats .fs-hs {
        flex: 1; display: flex; align-items: center; gap: 10px;
        padding: 0 14px; min-width: 0;
      }
      .fs-home-stats .fs-hs-ico {
        width: 38px; height: 38px; flex: 0 0 auto;
        display: grid; place-items: center;
        font-size: 22px; line-height: 1;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));
      }
      .fs-home-stats .fs-hs-ico.level { color: #f5c542; filter: drop-shadow(0 0 10px rgba(245,197,66,0.35)); }
      .fs-home-stats .fs-hs-ico.rating { color: #cfd3dc; }
      .fs-home-stats .fs-hs-ico.streak { color: #ff8a3d; filter: drop-shadow(0 0 10px rgba(255,138,61,0.35)); }
      .fs-home-stats .fs-hs-txt { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .fs-home-stats .fs-hs-lab {
        font-size: 11px; font-weight: 600; color: var(--fs-text-dim);
        letter-spacing: 0.02em;
      }
      .fs-home-stats .fs-hs-val {
        font-size: 20px; font-weight: 800; color: var(--fs-text);
        letter-spacing: -0.02em; line-height: 1.1;
      }
      .fs-home-stats .fs-hs.fs-xp-block {
        flex: 1.55; flex-direction: column; align-items: stretch; gap: 8px;
        justify-content: center;
      }
      .fs-home-stats .fs-xp-top {
        display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
        font-size: 11px; font-weight: 600; color: var(--fs-text-dim);
      }
      .fs-home-stats .fs-xp-top strong { color: var(--fs-text); font-weight: 800; }
      .fs-home-stats .fs-xp-block .fs-skill-bar {
        width: 100%; height: 10px; border-radius: 999px;
        background: rgba(255,255,255,0.08); overflow: hidden;
      }
      .fs-home-stats .fs-xp-block .fs-skill-bar > i {
        background: linear-gradient(90deg, #7dd3fc, #a855f7 55%, #c084fc);
        box-shadow: 0 0 12px rgba(168,85,247,0.4);
      }
      .fs-stat-sep {
        width: 1px; align-self: stretch; margin: 4px 0;
        background: rgba(255,255,255,0.08); flex: 0 0 auto;
      }
      .fs-stat-pills {
        display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      }
      .fs-pill {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 8px; border-radius: 999px;
        background: var(--fs-card); border: 1px solid var(--fs-border);
        font-size: 11px; font-weight: 700; color: var(--fs-text-dim);
      }
      .fs-pill strong { color: var(--fs-text); font-weight: 800; }
      .fs-v3-grid {
        display: grid; gap: 14px;
      }
      .fs-v3-grid-2 { grid-template-columns: 1.35fr 1fr; }
      .fs-home-stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
        align-items: stretch;
      }
      @media (max-width: 900px) {
        .fs-v3-grid-2 { grid-template-columns: 1fr; }
      }
      .fs-v3-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.025));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        padding: 16px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      }
      .fs-v3-card.fs-v3-coach-card { overflow: visible; }
      .fs-v3-card.fs-recent-wrap {
        overflow: visible;
        padding: 18px 20px 20px;
      }
      .fs-v3-card.fs-hero-train {
        min-height: 248px;
        display: flex; flex-direction: column;
        justify-content: center;
        align-items: flex-start;
        padding: 24px 28px;
        border-color: rgba(61,214,140,0.22);
        max-width: 100%;
      }
      .fs-v3-card.fs-hero-train::before {
        content: "";
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse at 82% 45%, rgba(61,214,140,0.24), transparent 48%),
          linear-gradient(100deg, rgba(10,18,16,0.98) 0%, rgba(12,22,18,0.88) 36%, rgba(12,20,18,0.35) 56%, rgba(12,20,18,0.05) 74%, transparent 100%),
          var(--fs-hero-url) 102% 52% / min(420px, 48%) auto no-repeat;
        z-index: 0;
      }
      .fs-v3-card.fs-hero-train > * { position: relative; z-index: 1; max-width: 46%; }
      .fs-v3-card.fs-hero-train .fs-v3-title {
        font-size: 30px; font-weight: 700; margin-bottom: 6px;
      }
      .fs-v3-kicker {
        font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
        text-transform: uppercase; color: var(--fs-text-dim); margin-bottom: 6px;
        line-height: 1.3; overflow-wrap: anywhere;
      }
      .fs-v3-sub { font-size: 12.5px; color: var(--fs-text-dim); line-height: 1.45; overflow-wrap: anywhere; }
      .fs-btn, .fs-btn-outline, .fs-btn-gold, .fs-btn-sm, .fs-link-gold {
        max-width: 100%; white-space: normal; line-height: 1.25; text-align: center;
      }
      .fs-link-gold { text-align: right; }
      .fs-greet-title { overflow-wrap: anywhere; }
      .fs-greet-sub { overflow-wrap: anywhere; line-height: 1.35; }
      .fs-mission-pct { color: var(--fs-tactics); font-weight: 800; font-size: 15px; }
      .fs-mission-pct-rest { color: var(--fs-text-dim); font-weight: 600; font-size: 13px; }
      .fs-v3-coach-card {
        display: grid; grid-template-columns: auto 1fr auto;
        gap: 10px 16px; align-items: center;
        min-height: 188px;
        padding: 12px 20px 0 0;
        overflow: visible;
        background:
          radial-gradient(ellipse at 12% 40%, rgba(124,58,237,0.5), transparent 55%),
          linear-gradient(155deg, rgba(76,29,149,0.48), rgba(18,20,29,0.12));
        border-color: rgba(167,139,250,0.32);
      }
      .fs-v3-coach-av {
        width: 148px; height: 188px; border-radius: 0;
        object-fit: contain; object-position: center bottom;
        flex: 0 0 auto; background: transparent;
        margin-left: -6px; margin-bottom: 0;
        box-shadow: none; border: 0;
      }
      .fs-coach-av-wrap {
        position: relative; flex: 0 0 auto; align-self: end;
        margin-bottom: -2px;
      }
      .fs-coach-av-wrap .fs-coach-quote {
        position: absolute; top: 18px; left: 8px;
        width: 36px; height: 36px; border-radius: 50%;
        display: grid; place-items: center;
        background: rgba(76,29,149,0.78);
        border: 1px solid rgba(196,181,253,0.4);
        font-size: 20px; line-height: 1; color: #c4b5fd;
        font-family: Georgia, serif; pointer-events: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      }
      .fs-v3-coach-body { text-align: left; min-width: 0; position: relative; }
      .fs-v3-coach-body .fs-v3-title {
        font-size: 18px; font-family: Georgia, "Times New Roman", serif;
        font-weight: 700; line-height: 1.3; margin-bottom: 6px;
      }
      .fs-v3-coach-body .fs-v3-sub { font-size: 13px; line-height: 1.45; }
      .fs-coach-hl { color: #c4b5fd; font-weight: 800; }
      .fs-v3-coach-side { text-align: center; min-width: 96px; position: relative; }
      .fs-coach-side-top {
        display: flex; align-items: center; justify-content: center; gap: 8px;
        margin-bottom: 6px;
      }
      .fs-coach-delta {
        width: 58px; height: 58px; border-radius: 50%;
        display: grid; place-items: center;
        background: radial-gradient(circle, rgba(167,139,250,0.5), rgba(76,29,149,0.12));
        border: 1px solid rgba(196,181,253,0.45);
        font-size: 22px; font-weight: 800; color: #c4b5fd;
        box-shadow: 0 0 22px rgba(167,139,250,0.35);
      }
      .fs-coach-pct {
        font-size: 20px; font-weight: 800; color: #3dd68c;
        letter-spacing: -0.02em;
      }
      .fs-coach-spark {
        display: flex; align-items: flex-end; gap: 4px; height: 48px;
        justify-content: center; margin: 10px 0 12px;
      }
      .fs-coach-spark i {
        width: 9px; border-radius: 3px 3px 0 0;
        background: linear-gradient(180deg, #ddd6fe, #7c3aed);
      }
      .fs-coach-trend {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 2px; font-size: 11px; font-weight: 800; color: #3dd68c;
      }
      .fs-seg-bar {
        display: flex; gap: 6px; margin: 10px 0 16px;
        width: min(300px, 100%);
      }
      .fs-seg-bar i {
        flex: 1; height: 10px; border-radius: 5px;
        background: rgba(255,255,255,0.08);
      }
      .fs-seg-bar i.on { background: #3dd68c; box-shadow: 0 0 10px rgba(61,214,140,0.35); }
      .fs-btn-gold {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: linear-gradient(180deg, #ffd45a, #f5c542 55%, #e8b020);
        color: #12141d; border: 0; border-radius: 12px;
        padding: 12px 20px; font-weight: 800; font-size: 13px; cursor: pointer;
        box-shadow: 0 6px 18px rgba(245,197,66,0.28);
        align-self: flex-start;
        width: auto; max-width: 100%;
      }
      .fs-v3-card.fs-hero-train .fs-btn-gold { margin-top: 2px; }
      .fs-btn-gold:hover { filter: brightness(1.05); }
      .fs-btn-gold svg { flex: 0 0 auto; }
      .fs-btn-outline {
        display: inline-flex; align-items: center; justify-content: center;
        background: transparent; color: var(--fs-text);
        border: 1px solid rgba(255,255,255,0.18); border-radius: 12px;
        padding: 10px 14px; font-weight: 700; font-size: 12px; cursor: pointer;
      }
      .fs-recent-card {
        display: grid;
        grid-template-columns: minmax(148px, 170px) minmax(0, 1fr) 124px;
        grid-template-rows: auto auto;
        column-gap: 18px;
        row-gap: 12px;
        align-items: center;
      }
      .fs-recent-outcome {
        grid-column: 1; grid-row: 1;
        display: flex; flex-direction: column; gap: 5px;
        align-items: flex-start; min-width: 0;
      }
      .fs-recent-players {
        grid-column: 2; grid-row: 1;
        display: flex; align-items: center; justify-content: center;
        gap: 12px; min-width: 0;
      }
      .fs-recent-metrics {
        grid-column: 2; grid-row: 2;
        display: flex; flex-direction: row; align-items: flex-start;
        justify-content: center; gap: 28px; min-width: 0;
      }
      .fs-recent-board-wrap {
        grid-column: 3; grid-row: 1 / span 2;
        width: 124px; height: 124px; border-radius: 8px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        background: #769656; justify-self: end; align-self: center;
      }
      .fs-recent-card > .fs-btn-review {
        grid-column: 1; grid-row: 2;
        justify-self: start; align-self: center;
      }
      .fs-recent-main, .fs-recent-foot { display: contents; }
      .fs-recent-outcome .fs-recent-badge {
        display: inline-flex; align-items: center; gap: 8px;
        width: fit-content; padding: 0; border-radius: 0; background: transparent;
        font-size: 16px; font-weight: 800; letter-spacing: 0.01em;
        color: var(--fs-good);
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-recent-outcome .fs-recent-badge .fs-rb-ico {
        width: 22px; height: 22px; border-radius: 50%;
        display: grid; place-items: center; font-size: 11px; line-height: 1; font-weight: 900;
        background: var(--fs-good); color: #0c1210;
        box-shadow: 0 0 12px rgba(61,214,140,0.4);
      }
      .fs-recent-outcome .fs-recent-badge.loss { color: var(--fs-bad); }
      .fs-recent-outcome .fs-recent-badge.loss .fs-rb-ico {
        background: var(--fs-bad); color: #1a0c0c;
        box-shadow: 0 0 10px rgba(255,107,107,0.28);
      }
      .fs-recent-outcome .fs-recent-badge.draw { color: var(--fs-text); }
      .fs-recent-outcome .fs-recent-badge.draw .fs-rb-ico {
        background: rgba(255,255,255,0.14); color: var(--fs-text-dim); box-shadow: none;
      }
      .fs-recent-outcome .fs-recent-tc {
        font-size: 13px; font-weight: 600; color: var(--fs-text); line-height: 1.2;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-recent-player {
        display: flex; align-items: center; gap: 8px; min-width: 0;
      }
      .fs-recent-player .fs-rp-meta { min-width: 0; }
      .fs-recent-player .fs-rp-name {
        font-size: 14px; font-weight: 700; color: var(--fs-text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        line-height: 1.2;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-recent-player .fs-rp-rating {
        font-size: 12px; font-weight: 600; color: var(--fs-text-dim); margin-top: 2px;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-recent-av {
        width: 44px; height: 44px; border-radius: 50%;
        object-fit: cover; background: var(--fs-bg-elev);
        border: 2px solid rgba(255,255,255,0.16);
        box-shadow: none;
        flex: 0 0 auto;
      }
      .fs-recent-av.me {
        border-color: var(--fs-accent);
        box-shadow: 0 0 0 1px rgba(245,197,66,0.3);
      }
      .fs-recent-av.placeholder {
        display: grid; place-items: center; font-size: 14px; font-weight: 800;
        color: var(--fs-text-dim);
      }
      .fs-recent-vs {
        font-size: 11px; color: var(--fs-text-dim); font-weight: 700;
        flex: 0 0 auto; padding: 0 2px; letter-spacing: 0.04em;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-recent-metric { text-align: center; min-width: 0; }
      .fs-recent-metric .fs-rm-val {
        font-size: 24px; font-weight: 800; line-height: 1.15; color: var(--fs-text);
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-recent-metric.fs-rm-rating {
        padding: 8px 16px 6px;
        border-radius: 10px;
        border: 1px solid rgba(61,214,140,0.4);
        background: rgba(61,214,140,0.06);
      }
      .fs-recent-metric.fs-rm-rating.is-dn {
        border-color: rgba(255,107,107,0.4);
        background: rgba(255,107,107,0.06);
      }
      .fs-recent-metric .fs-rm-val.up,
      .fs-recent-metric .fs-rm-val.dn {
        display: block; padding: 0; border: 0; background: transparent;
        box-shadow: none; min-width: 0; border-radius: 0;
      }
      .fs-recent-metric .fs-rm-val.up { color: var(--fs-good); }
      .fs-recent-metric .fs-rm-val.dn { color: var(--fs-bad); }
      .fs-recent-metric .fs-rm-lab {
        margin-top: 2px; font-size: 11px; font-weight: 600; color: var(--fs-text-dim);
        white-space: nowrap;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-btn-review {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 9px 14px; border-radius: 10px;
        border: 1px solid rgba(245,197,66,0.55);
        background: transparent;
        color: var(--fs-text); font-size: 12.5px; font-weight: 700;
        cursor: pointer;
        font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      }
      .fs-btn-review:hover { background: rgba(245,197,66,0.1); border-color: rgba(245,197,66,0.8); }
      .fs-btn-review svg { flex: 0 0 auto; color: var(--fs-accent); }
      .fs-recent-board-wrap .fs-mini-board,
      .fs-recent-board-wrap svg,
      .fs-mini-board svg {
        width: 100% !important; height: 100% !important;
        display: block;
      }
      .fs-section-head {
        display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
      }
      .fs-section-head .fs-v3-kicker { margin-bottom: 0; flex: 0 0 auto; color: var(--fs-text-dim); }
      .fs-section-head .fs-sec-line {
        flex: 1 1 auto; height: 1px; background: rgba(255,255,255,0.08);
        min-width: 12px;
      }
      .fs-section-head .fs-link-gold { flex: 0 0 auto; margin-left: auto; }
      .fs-link-gold {
        background: none; border: 0; color: var(--fs-accent);
        font-size: 12px; font-weight: 700; cursor: pointer; padding: 0;
        max-width: 100%; white-space: normal; line-height: 1.25; text-align: right;
      }
      .fs-stat-bar {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 12px; border-radius: 12px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.06);
      }
      .fs-stat-bar .fs-pill {
        background: transparent; border: 0; padding: 0;
        font-size: 12px;
      }
      .fs-skill-icons {
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
        margin-top: 2px;
      }
      .fs-skill-ico {
        text-align: center; padding: 10px 8px 8px;
        border-radius: 0; border: 0; background: transparent;
      }
      .fs-skill-ico + .fs-skill-ico {
        border-left: 1px solid rgba(255,255,255,0.06);
      }
      .fs-skill-ico .fs-si {
        width: 56px; height: 56px; margin: 0 auto 10px;
        display: grid; place-items: center;
        font-size: 22px; line-height: 1;
        filter: drop-shadow(0 0 14px currentColor);
      }
      .fs-skill-ico .fs-si img {
        width: 44px !important; height: 44px !important; display: block;
        filter: drop-shadow(0 0 12px currentColor);
      }
      .fs-skill-ico .fs-si-lab {
        font-size: 12px; font-weight: 700; color: #eef1f8 !important; margin-bottom: 8px;
      }
      .fs-skill-ico .fs-si-bar {
        height: 7px; border-radius: 999px; margin: 0 auto 10px; width: 72%;
        background: rgba(255,255,255,0.08); overflow: hidden;
      }
      .fs-skill-ico .fs-si-bar > i { display: block; height: 100%; border-radius: 999px; }
      .fs-skill-ico .fs-si-score {
        font-size: 22px; font-weight: 800; line-height: 1.1; margin: 0;
      }
      .fs-skill-ico .fs-si-tone {
        display: block; margin-top: 3px;
        font-size: 11px; font-weight: 700; opacity: 0.95;
      }
      .fs-quiz-lobby-slim {
        margin-top: 8px; padding: 10px 12px; border-radius: 12px;
        border: 1px dashed rgba(255,255,255,0.1);
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        font-size: 12px; color: var(--fs-text-dim);
      }
      .fs-quote-banner {
        margin-top: 14px; border-radius: 16px; overflow: hidden;
        position: relative; min-height: 96px;
        border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-quote-banner img {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: cover; object-position: center 40%; opacity: 0.92;
      }
      .fs-quote-banner .fs-quote-txt {
        position: relative; z-index: 1;
        padding: 26px 24px 20px;
        font-family: Georgia, serif; font-style: italic;
        font-size: 18px; color: #f3f4f8;
        text-shadow: 0 2px 12px rgba(0,0,0,0.65);
        background: linear-gradient(90deg, rgba(12,14,20,0.82), rgba(12,14,20,0.18) 70%, transparent);
      }
      .fs-quote-banner .fs-quote-txt em { font-style: italic; font-weight: 700; color: #f5c542; }
      .fs-quote-sig {
        display: block; margin-top: 8px; font-family: Georgia, "Palatino Linotype", serif;
        font-style: italic; font-size: 13px; color: var(--fs-accent); font-weight: 600;
      }
      .fs-reward-cell {
        text-align: center; padding: 10px 8px;
        border-right: 1px solid rgba(255,255,255,0.08);
      }
      .fs-reward-cell:last-child { border-right: 0; }
      .fs-reward-cell .fs-comp-ico { font-size: 22px; margin-bottom: 6px; }
      .fs-reward-cell strong {
        display: block; font-size: 12px; font-weight: 800; color: var(--fs-text);
      }
      .fs-reward-cell.gold strong { color: var(--fs-accent); }
      .fs-reward-cell span {
        display: block; margin-top: 4px; font-size: 10px; line-height: 1.35;
        color: var(--fs-text-dim); font-weight: 500;
      }
      .fs-mini-board-fallback {
        width: 100%; height: 100%;
        background:
          repeating-conic-gradient(#769656 0% 25%, #eeeed2 0% 50%) 0 0 / 25% 25%;
      }
      .fs-header-bell {
        width: 34px; height: 34px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.04);
        display: grid; place-items: center; color: var(--fs-text-dim);
        cursor: pointer; position: relative;
      }
      .fs-header-bell::after { display: none; }
      .fs-quote-sig {
        display: block; margin-top: 6px;
        font-size: 12px; font-style: normal; letter-spacing: 0.08em;
        color: rgba(245,197,66,0.85); font-family: Georgia, serif;
      }
      .fs-mission-card {
        --fs-mission-url: none;
        padding: 0; overflow: hidden; min-height: 248px;
        border-color: rgba(61,214,140,0.2);
      }
      .fs-mission-card::before {
        content: "";
        position: absolute; inset: 0;
        background:
          radial-gradient(ellipse at 82% 50%, rgba(61,214,140,0.16), transparent 48%),
          linear-gradient(100deg, rgba(14,16,22,0.98) 0%, rgba(14,16,22,0.94) 36%, rgba(14,16,22,0.5) 55%, rgba(14,16,22,0.12) 72%, transparent 100%),
          var(--fs-mission-url) 98% 55% / 48% auto no-repeat;
        z-index: 0;
      }
      .fs-mission-hero {
        position: relative; z-index: 1;
        display: grid; grid-template-columns: 1.2fr auto 1fr;
        gap: 18px; align-items: center;
        min-height: 248px; padding: 22px 24px;
      }
      .fs-mission-hero .fs-mission-art { display: none; }
      .fs-mission-mid {
        display: flex; flex-direction: column; align-items: center; gap: 14px;
      }
      .fs-ring {
        width: 138px; height: 138px; border-radius: 50%;
        display: grid; place-items: center;
        background:
          radial-gradient(circle at center, #12141d 48%, transparent 49%),
          conic-gradient(var(--fs-tactics) var(--fs-ring-pct, 40%), rgba(255,255,255,0.08) 0);
        box-shadow:
          0 0 0 1px rgba(61,214,140,0.3),
          0 0 32px rgba(61,214,140,0.28),
          0 10px 28px rgba(0,0,0,0.35);
      }
      .fs-ring span { text-align: center; font-size: 12px; font-weight: 700; line-height: 1.25; color: var(--fs-text-dim); }
      .fs-ring span b { display: block; font-size: 24px; letter-spacing: -0.02em; color: var(--fs-text); font-weight: 800; }
      .fs-cat-grid {
        display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px;
      }
      .fs-cat-card {
        background: linear-gradient(180deg, rgba(255,255,255,0.035), rgba(0,0,0,0.35));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px; padding: 12px 10px 10px; cursor: pointer;
        text-align: left; color: var(--fs-text);
        min-height: 278px;
        display: flex; flex-direction: column;
        position: relative; overflow: hidden;
      }
      .fs-cat-card:nth-child(1) {
        background:
          radial-gradient(ellipse at 50% 42%, rgba(61,214,140,0.14), transparent 55%),
          linear-gradient(180deg, #14181f, #0a0c10);
      }
      .fs-cat-card:nth-child(2) {
        background:
          radial-gradient(ellipse at 50% 42%, rgba(76,141,255,0.16), transparent 55%),
          linear-gradient(180deg, #12161f, #090b10);
      }
      .fs-cat-card:nth-child(3) {
        background:
          radial-gradient(ellipse at 50% 42%, rgba(167,139,250,0.16), transparent 55%),
          linear-gradient(180deg, #15121f, #0a0910);
      }
      .fs-cat-card:nth-child(4) {
        background:
          radial-gradient(ellipse at 50% 42%, rgba(245,197,66,0.12), transparent 55%),
          linear-gradient(180deg, #18160f, #0c0a08);
      }
      .fs-cat-card:nth-child(5) {
        background:
          radial-gradient(ellipse at 50% 42%, rgba(34,211,238,0.14), transparent 55%),
          linear-gradient(180deg, #10181c, #080c0e);
      }
      .fs-cat-card::after {
        content: ""; position: absolute; left: 6%; right: 6%; bottom: 78px;
        height: 44px; border-radius: 50%; filter: blur(14px); opacity: 0.65;
        background: rgba(255,255,255,0.12); pointer-events: none;
      }
      .fs-cat-card:nth-child(1)::after { background: rgba(61,214,140,0.55); }
      .fs-cat-card:nth-child(2)::after { background: rgba(76,141,255,0.55); }
      .fs-cat-card:nth-child(3)::after { background: rgba(167,139,250,0.55); }
      .fs-cat-card:nth-child(4)::after { background: rgba(245,197,66,0.5); }
      .fs-cat-card:nth-child(5)::after { background: rgba(34,211,238,0.5); }
      .fs-cat-card:nth-child(1) { border-color: rgba(61,214,140,0.22); }
      .fs-cat-card:nth-child(2) { border-color: rgba(76,141,255,0.22); }
      .fs-cat-card:nth-child(3) { border-color: rgba(167,139,250,0.22); }
      .fs-cat-card:nth-child(4) { border-color: rgba(245,197,66,0.22); }
      .fs-cat-card:nth-child(5) { border-color: rgba(34,211,238,0.28); box-shadow: 0 0 22px rgba(34,211,238,0.12); }
      .fs-cat-card:hover { border-color: rgba(255,255,255,0.18); transform: translateY(-1px); }
      .fs-cat-card img {
        width: 128%; max-width: none; height: 152px; object-fit: contain; object-position: center bottom;
        margin: 2px -14% 0; background: transparent !important;
        filter: drop-shadow(0 14px 22px rgba(0,0,0,0.55));
        position: relative; z-index: 1; flex: 1 1 auto;
      }
      .fs-cat-bar {
        height: 5px; border-radius: 999px; margin: 8px 0 6px;
        background: rgba(255,255,255,0.06); overflow: hidden;
      }
      .fs-cat-bar > i { display: block; height: 100%; border-radius: 999px; }
      .fs-cat-card .fs-cat-name {
        font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
        text-transform: uppercase; position: relative; z-index: 1;
        display: flex; align-items: center; gap: 6px;
      }
      .fs-cat-card .fs-cat-name img {
        width: 16px; height: 16px; margin: 0; filter: none;
        flex: 0 0 auto; object-fit: contain;
      }
      .fs-cat-card .fs-cat-meta { font-size: 11px; color: var(--fs-text-dim); margin-top: 2px; position: relative; z-index: 1; }
      .fs-cat-card .fs-cat-cta {
        margin-top: 8px; font-size: 11px; font-weight: 800; color: var(--fs-text);
        position: relative; z-index: 1;
        display: flex; align-items: center; justify-content: center;
        padding: 7px 8px; border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(0,0,0,0.22);
      }
      .fs-cat-ico-row {
        display: flex; align-items: center; gap: 6px;
        position: relative; z-index: 1;
      }
      .fs-cat-score {
        font-size: 20px; font-weight: 800; letter-spacing: -0.02em;
        position: relative; z-index: 1;
        display: flex; align-items: center; gap: 8px;
        color: var(--fs-text);
      }
      .fs-cat-tone {
        display: inline-flex; align-items: center;
        font-size: 10px; font-weight: 800; letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 3px 8px; border-radius: 999px;
        border: 1px solid currentColor;
        background: rgba(255,255,255,0.06);
      }
      .fs-mission-card { margin-bottom: 10px !important; }
      .fs-cat-grid { margin-top: 0; }
      .fs-lang-btn, .fs-header .fs-icon-btn[data-act="close"] {
        opacity: 0.45; transform: scale(0.92);
      }
      .fs-lang-btn:hover, .fs-header .fs-icon-btn[data-act="close"]:hover { opacity: 0.9; }
      .fs-mission-ico {
        width: 28px; height: 28px; border-radius: 0;
        display: inline-grid; place-items: center; flex: 0 0 auto;
        background: transparent !important;
        filter: drop-shadow(0 0 10px currentColor);
      }
      .fs-mission-ico svg { width: 22px; height: 22px; display: block; }
      .fs-mission-list { list-style: none; padding: 0; margin: 10px 0 0; }
      .fs-mission-list li {
        display: flex; align-items: center; gap: 12px;
        font-size: 13px; padding: 8px 0; color: var(--fs-text);
        font-weight: 700;
      }
      .fs-mission-list li.done { color: var(--fs-text); }
      .fs-mission-list li.done .fs-mission-ico { color: var(--fs-tactics); }
      .fs-quiz-lobby-slim { display: none !important; }
      .fs-sidebar-atmos {
        position: absolute; left: -40px; bottom: 20px;
        width: 280px; height: 320px; object-fit: contain; object-position: left bottom;
        opacity: 0.72; pointer-events: none;
        filter: blur(1.5px) saturate(1.1);
        z-index: 0;
        mask-image: linear-gradient(180deg, transparent 0%, #000 18%, #000 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(180deg, transparent 0%, #000 18%, #000 85%, transparent 100%);
      }
      .fs-pro-card-title img {
        width: 22px; height: 22px; object-fit: contain; background: transparent;
      }
      .fs-xp-inline {
        display: flex; align-items: center; gap: 8px;
        min-width: 140px;
      }
      .fs-xp-inline .fs-skill-bar { width: 88px; height: 6px; }
      .fs-xp-inline .fs-skill-bar > i { background: linear-gradient(90deg, #a78bfa, #60a5fa); }
      .fs-pill {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 6px 10px; border-radius: 999px;
        background: rgba(255,255,255,0.04); border: 1px solid var(--fs-border);
        font-size: 12px; font-weight: 700; color: var(--fs-text-dim);
      }
      .fs-pill strong { color: var(--fs-text); font-weight: 800; font-size: 12px; }
      .fs-v3-coach-av-lg {
        width: 128px; height: 128px; border-radius: 50%;
        object-fit: cover; object-position: center top;
        border: 2px solid rgba(196,181,253,0.5);
        box-shadow: 0 12px 28px rgba(0,0,0,0.4);
        background: transparent;
        margin-left: -22px;
      }
      .fs-skill-row {
        display: grid; grid-template-columns: 88px 1fr 36px; gap: 8px;
        align-items: center; margin: 6px 0;
        font-size: 12px;
      }
      .fs-skill-bar {
        height: 7px; border-radius: 999px; background: rgba(255,255,255,0.06);
        overflow: hidden;
      }
      .fs-skill-bar > i {
        display: block; height: 100%; border-radius: 999px;
      }
      .fs-mission-list li.done { color: var(--fs-good); }
      .fs-xp-track {
        display: flex; align-items: center; gap: 12px; margin-top: 12px;
      }
      .fs-xp-track img { width: 42px; height: 42px; object-fit: contain; background: transparent; }
      .fs-coach-tabs {
        display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;
      }
      .fs-coach-tab {
        padding: 7px 12px; border-radius: 999px; border: 1px solid var(--fs-border);
        background: transparent; color: var(--fs-text-dim); font-size: 11px;
        font-weight: 700; cursor: pointer;
      }
      .fs-coach-tab.fs-on {
        background: var(--fs-accent); color: #12141d; border-color: var(--fs-accent);
      }

      /* ── Coach picker (v3.0 coachpage) ── */
      .fs-cpick { position: relative; min-height: 100%; }
      .fs-cpick-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 12px; margin: 0 0 12px; flex-wrap: wrap;
      }
      .fs-cpick-head .fs-cpick-nav { margin: 0; }
      .fs-cpick-info {
        display: flex; align-items: center; gap: 8px;
        margin: 0; padding: 8px 12px; border-radius: 10px;
        max-width: 340px;
        background: rgba(61,214,140,0.08);
        border: 1px solid rgba(61,214,140,0.28);
        font-size: 11px; line-height: 1.4; color: #c8f0d8;
      }
      .fs-cpick-info .fs-chip {
        flex: 0 0 auto; width: 22px; height: 22px; border-radius: 6px;
        display: grid; place-items: center; font-size: 12px;
        background: rgba(61,214,140,0.18); color: #3dd68c;
      }
      .fs-cpick-nav {
        display: flex; gap: 8px; align-items: center;
        margin: 0 0 14px;
      }
      .fs-cpick-nav button {
        appearance: none; cursor: pointer;
        border-radius: 999px; padding: 8px 14px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.04);
        color: var(--fs-text-dim); font-size: 11px; font-weight: 800;
        letter-spacing: 0.06em; text-transform: uppercase;
      }
      .fs-cpick-nav button.fs-on {
        color: #1a1408; background: linear-gradient(135deg, #f5c542, #e0a820);
        border-color: transparent;
        box-shadow: 0 6px 16px rgba(245,197,66,0.28);
      }
      .fs-cpick-grid {
        display: flex; flex-wrap: nowrap; gap: 14px;
        margin: 0 -4px 16px; padding: 6px 4px 14px;
        overflow-x: auto; overflow-y: visible;
        scroll-snap-type: x mandatory;
        scroll-padding-inline: 4px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        scrollbar-color: rgba(245,197,66,0.45) rgba(255,255,255,0.06);
        cursor: grab;
        user-select: none;
        touch-action: pan-y;
      }
      .fs-cpick-grid.fs-dragging {
        cursor: grabbing;
        scroll-snap-type: none;
      }
      .fs-cpick-grid.fs-dragging .fs-ccard,
      .fs-cpick-grid.fs-dragging .fs-ccard-btn {
        pointer-events: none;
      }
      .fs-cpick-scroll {
        position: relative; margin-bottom: 14px;
      }
      .fs-cpick-scroll::before,
      .fs-cpick-scroll::after {
        content: ""; position: absolute; top: 0; bottom: 18px; width: 28px; z-index: 2;
        pointer-events: none;
      }
      .fs-cpick-scroll::before {
        left: 0;
        background: linear-gradient(90deg, rgba(18,20,29,0.95), transparent);
      }
      .fs-cpick-scroll::after {
        right: 0;
        background: linear-gradient(270deg, rgba(18,20,29,0.95), transparent);
      }
      .fs-cpick-scroll .fs-cpick-grid { margin-bottom: 0; }
      .fs-cpick-arrow {
        position: absolute; top: 42%; transform: translateY(-50%);
        z-index: 3; width: 34px; height: 34px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(18,20,29,0.88);
        color: #f5c542; cursor: pointer;
        display: grid; place-items: center;
        box-shadow: 0 8px 20px rgba(0,0,0,0.35);
      }
      .fs-cpick-arrow:hover { border-color: rgba(245,197,66,0.45); }
      .fs-cpick-arrow.prev { left: 2px; }
      .fs-cpick-arrow.next { right: 2px; }
      .fs-cpick-arrow svg { width: 16px; height: 16px; display: block; }
      .fs-cpick-grid::-webkit-scrollbar { height: 8px; }
      .fs-cpick-grid::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.05); border-radius: 999px;
      }
      .fs-cpick-grid::-webkit-scrollbar-thumb {
        background: linear-gradient(90deg, rgba(245,197,66,0.55), rgba(61,214,140,0.45));
        border-radius: 999px;
      }
      .fs-ccard {
        position: relative; display: flex; flex-direction: column;
        flex: 0 0 248px; width: 248px; max-width: 248px;
        scroll-snap-align: start;
        border-radius: 18px; overflow: hidden;
        background: #0e1016;
        border: 1px solid color-mix(in srgb, var(--cc) 42%, rgba(255,255,255,0.08));
        box-shadow:
          0 16px 34px rgba(0,0,0,0.48),
          0 0 0 1px color-mix(in srgb, var(--cc) 18%, transparent),
          0 0 28px color-mix(in srgb, var(--cc) 14%, transparent),
          inset 0 1px 0 rgba(255,255,255,0.05);
        height: 508px;
        min-height: 508px;
        transition: border-color .2s, box-shadow .2s, transform .15s;
      }
      .fs-ccard:hover { transform: translateY(-2px); }
      .fs-ccard[data-theme="green"] { --cc: #3dd68c; --cc-dim: rgba(61,214,140,0.28); }
      .fs-ccard[data-theme="gold"] { --cc: #f5c542; --cc-dim: rgba(245,197,66,0.28); }
      .fs-ccard[data-theme="purple"] { --cc: #a78bfa; --cc-dim: rgba(167,139,250,0.28); }
      .fs-ccard[data-theme="blue"] { --cc: #4c8dff; --cc-dim: rgba(76,141,255,0.28); }
      .fs-ccard[data-theme="red"] { --cc: #ff6b6b; --cc-dim: rgba(255,107,107,0.28); }
      .fs-ccard[data-theme="orange"] { --cc: #ff8a3d; --cc-dim: rgba(255,138,61,0.30); }
      .fs-ccard.is-soon .fs-ccard-bg {
        filter: brightness(0.42) saturate(0.55) contrast(1.05);
      }
      .fs-ccard.is-soon .fs-ccard-scrim {
        background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.72) 55%, rgba(8,6,4,0.88) 100%);
      }
      .fs-ccard.is-soon .fs-ccard-name,
      .fs-ccard.is-soon .fs-ccard-rating { opacity: 0.78; }
      .fs-cooksoon {
        margin-top: 10px;
        padding: 10px 10px 8px;
        border-radius: 10px;
        border: 1px solid rgba(255,138,61,0.28);
        background: linear-gradient(165deg, rgba(255,138,61,0.10), rgba(0,0,0,0.35));
        text-align: center;
      }
      .fs-cooksoon-badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: #1a1208;
        background: linear-gradient(135deg, #ffb35a, #ff8a3d);
        box-shadow: 0 0 16px rgba(255,138,61,0.35);
      }
      .fs-cooksoon-oven {
        position: relative;
        height: 36px;
        margin: 8px auto 4px;
        width: 100%;
        max-width: 160px;
        overflow: hidden;
      }
      .fs-cooksoon-oven .st,
      .fs-cooksoon-oven .ln,
      .fs-cooksoon-oven .sp {
        position: absolute;
        pointer-events: none;
      }
      .fs-cooksoon-oven .st {
        width: 6px; height: 6px;
        background: #ffd59a;
        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
        animation: fs-cook-star 1.8s ease-in-out infinite;
        opacity: 0.85;
      }
      .fs-cooksoon-oven .st.s1 { left: 12%; top: 8px; animation-delay: 0s; }
      .fs-cooksoon-oven .st.s2 { left: 46%; top: 2px; animation-delay: 0.35s; }
      .fs-cooksoon-oven .st.s3 { left: 72%; top: 10px; animation-delay: 0.7s; }
      .fs-cooksoon-oven .st.s4 { left: 30%; top: 18px; animation-delay: 1.05s; width: 4px; height: 4px; }
      .fs-cooksoon-oven .ln {
        height: 1px;
        width: 28px;
        background: linear-gradient(90deg, transparent, rgba(255,200,120,0.9), transparent);
        animation: fs-cook-line 1.6s linear infinite;
        opacity: 0.7;
      }
      .fs-cooksoon-oven .ln.l1 { left: 8%; top: 22px; animation-delay: 0s; }
      .fs-cooksoon-oven .ln.l2 { left: 38%; top: 26px; width: 36px; animation-delay: 0.4s; }
      .fs-cooksoon-oven .ln.l3 { left: 62%; top: 20px; animation-delay: 0.85s; }
      .fs-cooksoon-oven .sp {
        width: 3px; height: 3px; border-radius: 50%;
        background: #ffc878;
        box-shadow: 0 0 6px rgba(255,180,80,0.8);
        animation: fs-cook-spark 1.4s ease-out infinite;
      }
      .fs-cooksoon-oven .sp.p1 { left: 22%; bottom: 2px; animation-delay: 0.1s; }
      .fs-cooksoon-oven .sp.p2 { left: 50%; bottom: 0; animation-delay: 0.55s; }
      .fs-cooksoon-oven .sp.p3 { left: 78%; bottom: 3px; animation-delay: 0.95s; }
      @keyframes fs-cook-star {
        0%, 100% { transform: scale(0.7) rotate(0deg); opacity: 0.35; }
        50% { transform: scale(1.2) rotate(20deg); opacity: 1; }
      }
      @keyframes fs-cook-line {
        0% { transform: translateX(-12px); opacity: 0; }
        30% { opacity: 0.85; }
        100% { transform: translateX(28px); opacity: 0; }
      }
      @keyframes fs-cook-spark {
        0% { transform: translateY(6px) scale(0.6); opacity: 0; }
        25% { opacity: 1; }
        100% { transform: translateY(-18px) scale(1); opacity: 0; }
      }
      .fs-cooksoon-cap {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: rgba(255,210,160,0.88);
      }
      .fs-ccard-btn.fs-soon-btn {
        opacity: 0.85;
        cursor: default;
        pointer-events: none;
        background: rgba(255,255,255,0.06);
        color: rgba(255,220,180,0.75);
        border: 1px dashed rgba(255,138,61,0.35);
      }
      .fs-ccard.fs-active {
        border-color: color-mix(in srgb, var(--cc) 85%, #fff);
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--cc) 65%, transparent),
          0 0 36px color-mix(in srgb, var(--cc) 34%, transparent),
          0 18px 36px rgba(0,0,0,0.5),
          inset 0 1px 0 rgba(255,255,255,0.06);
      }
      .fs-ccard-media {
        position: absolute; inset: 0;
        z-index: 0;
        overflow: hidden;
        isolation: isolate;
      }
      .fs-ccard-bg {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover; object-position: top center;
        display: block;
        filter: saturate(1.06) contrast(1.06);
      }
      .fs-ccard-scrim {
        position: absolute; inset: 0; pointer-events: none; z-index: 1;
        background:
          linear-gradient(180deg, rgba(8,10,14,0.22) 0%, transparent 22%),
          linear-gradient(180deg, transparent 28%, rgba(10,12,18,0.45) 48%, rgba(10,12,18,0.88) 68%, rgba(10,12,18,0.97) 100%),
          radial-gradient(ellipse at 50% 42%, var(--cc-dim), transparent 58%);
      }
      .fs-ccard-ribbon {
        position: absolute; top: 14px; left: 0; z-index: 5;
        background: var(--cc); color: #0b1210; font-size: 9px; font-weight: 900;
        letter-spacing: 0.08em; padding: 4px 12px 4px 10px;
        clip-path: polygon(0 0, 100% 0, 90% 100%, 0 100%);
        box-shadow: 0 4px 12px var(--cc-dim);
      }
      .fs-ccard-pro {
        position: absolute; top: 12px; right: 12px; z-index: 5;
        display: inline-flex; align-items: center; gap: 4px;
        padding: 4px 9px; border-radius: 6px;
        background: linear-gradient(135deg, #f5c542, #e0a820);
        color: #1a1408; font-size: 9px; font-weight: 900; letter-spacing: 0.06em;
        box-shadow: 0 4px 14px rgba(245,197,66,0.35);
      }
      .fs-ccard-top {
        position: absolute; top: 14px; left: 12px; z-index: 4;
        pointer-events: none;
      }
      .fs-ccard.fs-active .fs-ccard-top { top: 40px; }
      .fs-ccard-rating {
        font-size: 34px; font-weight: 900; line-height: 0.95; color: #fff;
        text-shadow: 0 2px 12px rgba(0,0,0,0.55), 0 0 18px var(--cc-dim);
      }
      .fs-ccard-role {
        margin-top: 3px; font-size: 10px; font-weight: 800; letter-spacing: 0.1em;
        color: var(--cc); text-transform: uppercase;
        text-shadow: 0 1px 8px rgba(0,0,0,0.55);
      }
      .fs-ccard-id {
        position: absolute; left: 12px; right: 12px; top: 44%; z-index: 4;
        pointer-events: none;
      }
      .fs-ccard-name {
        font-family: "Segoe Script", "Brush Script MT", "Palatino Linotype", Georgia, cursive;
        font-size: 30px; font-weight: 600; color: var(--cc); line-height: 1;
        text-shadow: 0 2px 14px rgba(0,0,0,0.65), 0 0 18px var(--cc-dim);
      }
      .fs-ccard-title {
        margin-top: 4px; font-size: 12px; font-weight: 800; color: #f2f4f8;
        display: flex; align-items: center; gap: 6px;
        text-shadow: 0 1px 8px rgba(0,0,0,0.65);
      }
      .fs-ccard-title .pc { color: var(--cc); font-size: 13px; }
      .fs-ccard-glass {
        position: relative; z-index: 3;
        margin-top: auto;
        display: flex; flex-direction: column;
        padding: 10px 12px 12px;
        background:
          linear-gradient(180deg, rgba(12,14,20,0.55), rgba(10,12,18,0.92));
        backdrop-filter: blur(12px) saturate(1.1);
        -webkit-backdrop-filter: blur(12px) saturate(1.1);
        border-top: 1px solid color-mix(in srgb, var(--cc) 18%, rgba(255,255,255,0.06));
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
      }
      .fs-ccard-desc {
        font-size: 10px; line-height: 1.4; color: var(--fs-text-dim);
        min-height: 28px;
      }
      .fs-ccard-skills { margin-top: 8px; display: flex; flex-direction: column; gap: 5px; }
      .fs-ccard-skill {
        display: grid; grid-template-columns: 72px 1fr 22px; gap: 6px; align-items: center;
        font-size: 9px; font-weight: 700; color: var(--fs-text-dim);
      }
      .fs-ccard-skill strong { color: var(--fs-text); font-size: 10px; text-align: right; }
      .fs-ccard-seg {
        display: grid; grid-template-columns: repeat(10, 1fr); gap: 2px; height: 6px;
      }
      .fs-ccard-seg i {
        display: block; border-radius: 2px; background: rgba(255,255,255,0.08);
      }
      .fs-ccard-seg i.on { background: var(--cc); box-shadow: 0 0 6px var(--cc-dim); }
      .fs-ccard-meta {
        margin-top: 8px; font-size: 9px; color: var(--fs-text-dim); line-height: 1.35;
      }
      .fs-ccard-meta b { color: #cfd3dc; font-weight: 700; }
      .fs-ccard-btn {
        margin-top: auto; width: 100%; appearance: none; cursor: pointer;
        border-radius: 10px; padding: 10px 12px;
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        font-size: 12px; font-weight: 800; letter-spacing: 0.01em;
        position: relative; z-index: 2;
        background: color-mix(in srgb, var(--cc) 28%, #161922);
        color: #eef2f8; border: 1px solid color-mix(in srgb, var(--cc) 55%, transparent);
      }
      .fs-ccard[data-theme="gold"] .fs-ccard-btn:not(.fs-locked) {
        background: linear-gradient(135deg, rgba(245,197,66,0.96), rgba(224,168,32,0.96));
        color: #1a1408; border-color: transparent;
      }
      .fs-ccard.fs-active .fs-ccard-btn {
        background: var(--cc); color: #0b1210;
        box-shadow: 0 8px 18px var(--cc-dim);
      }
      .fs-ccard-btn.fs-locked {
        opacity: 0.95;
        background: color-mix(in srgb, var(--cc) 14%, #141821);
        border: 1px solid color-mix(in srgb, var(--cc) 35%, rgba(255,255,255,0.12));
        color: #d7dbe6;
      }
      .fs-ccard-btn svg { width: 14px; height: 14px; display: block; flex: 0 0 auto; }
      .fs-cpick-bottom {
        display: grid; grid-template-columns: 1.15fr 0.85fr 1.35fr 0.9fr;
        gap: 10px; align-items: stretch;
      }
      .fs-cpick-box {
        border-radius: 14px; padding: 12px;
        background: rgba(255,255,255,0.035);
        border: 1px solid rgba(255,255,255,0.08);
        position: relative; overflow: hidden;
      }
      .fs-cpick-box .fs-k {
        font-size: 10px; font-weight: 800; letter-spacing: 0.08em;
        color: var(--fs-text-dim); margin-bottom: 8px;
      }
      .fs-free-coach {
        display: flex; gap: 10px; align-items: center;
      }
      .fs-free-coach img {
        width: 56px; height: 56px; object-fit: contain; flex: 0 0 auto;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,0.4));
      }
      .fs-free-coach .nm { font-size: 14px; font-weight: 800; color: var(--fs-text); }
      .fs-free-coach .sub { font-size: 11px; color: var(--fs-accent); font-weight: 700; }
      .fs-free-coach .desc { font-size: 10px; color: var(--fs-text-dim); margin-top: 2px; line-height: 1.35; }
      .fs-free-coach .fs-mini-btn {
        margin-top: 8px; appearance: none; cursor: pointer;
        border-radius: 8px; border: 1px solid rgba(61,214,140,0.4);
        background: rgba(61,214,140,0.15); color: #b8f5d4;
        font-size: 11px; font-weight: 800; padding: 6px 10px;
      }
      .fs-compare-art {
        display: flex; align-items: center; justify-content: center; gap: 10px;
        min-height: 72px; margin: 4px 0 8px;
      }
      .fs-compare-art .pc {
        width: 42px; height: 54px; border-radius: 10px;
        display: grid; place-items: center; font-size: 26px;
        background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-compare-art .pc.g { color: #3dd68c; box-shadow: 0 0 16px rgba(61,214,140,0.25); }
      .fs-compare-art .pc.r { color: #ff6b6b; box-shadow: 0 0 16px rgba(255,107,107,0.25); }
      .fs-compare-art .vs { font-size: 11px; font-weight: 900; color: var(--fs-text-dim); }
      .fs-skills-leg { display: flex; flex-direction: column; gap: 6px; }
      .fs-skills-leg .row {
        display: grid; grid-template-columns: 18px 78px 1fr; gap: 8px; align-items: start;
        font-size: 10px; line-height: 1.35;
      }
      .fs-skills-leg .row .ico { font-size: 13px; line-height: 1; }
      .fs-skills-leg .row b { color: var(--fs-text); font-size: 10px; }
      .fs-skills-leg .row span { color: var(--fs-text-dim); }
      .fs-cpick-knight {
        border: 0; background:
          radial-gradient(ellipse at 50% 70%, rgba(61,214,140,0.18), transparent 60%),
          rgba(255,255,255,0.02);
        padding: 0; display: grid; place-items: center;
      }
      .fs-cpick-knight img {
        width: 100%; height: 100%; max-height: 140px; object-fit: cover;
        border-radius: 14px; opacity: 0.95;
      }
      .fs-cmine {
        display: grid; grid-template-columns: 300px 1fr; gap: 14px;
      }
      .fs-cmine-hero {
        border-radius: 16px; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.1);
        background: #101218; position: relative;
        display: flex; flex-direction: column;
        min-height: 420px;
      }
      .fs-cmine-media {
        position: relative; flex: 0 0 280px; height: 280px;
        overflow: hidden; background: #0c0e14;
      }
      .fs-cmine-bg {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        object-fit: cover; object-position: top center;
        display: block;
      }
      .fs-cmine-scrim {
        position: absolute; inset: 0; pointer-events: none;
        background:
          linear-gradient(180deg, rgba(8,10,14,0.15) 0%, transparent 30%),
          linear-gradient(180deg, transparent 45%, rgba(10,12,18,0.92) 100%);
      }
      .fs-cmine-id {
        position: absolute; left: 14px; right: 14px; bottom: 12px; z-index: 2;
      }
      .fs-cmine-id .nm {
        font-family: "Segoe Script", "Brush Script MT", Georgia, cursive;
        font-size: 32px; color: #f3d27a; line-height: 1;
        text-shadow: 0 2px 12px rgba(0,0,0,0.55);
      }
      .fs-cmine-id .sub {
        margin-top: 4px; font-size: 13px; font-weight: 800; color: #eceef4;
      }
      .fs-cmine-hero .pad { padding: 14px; flex: 1 1 auto; }
      .fs-cmine-hero .pad .nm { display: none; }
      .fs-voice-note {
        margin-top: 10px; padding: 8px 10px; border-radius: 10px;
        background: rgba(245,197,66,0.08); border: 1px solid rgba(245,197,66,0.22);
        font-size: 11px; color: #e8d7a0; line-height: 1.4;
      }
      .fs-cmine-skills {
        margin-top: 12px; position: relative; overflow: hidden;
        border-radius: 16px; padding: 14px 14px 12px;
        border: 1px solid color-mix(in srgb, var(--cc) 24%, rgba(255,255,255,0.08));
        background:
          radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--cc) 14%, transparent), transparent 58%),
          linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.05),
          0 10px 28px rgba(0,0,0,0.22);
      }
      .fs-cmine-skills[data-theme="green"] { --cc: #3dd68c; --cc-dim: rgba(61,214,140,0.28); }
      .fs-cmine-skills[data-theme="gold"] { --cc: #f5c542; --cc-dim: rgba(245,197,66,0.28); }
      .fs-cmine-skills[data-theme="purple"] { --cc: #a78bfa; --cc-dim: rgba(167,139,250,0.28); }
      .fs-cmine-skills[data-theme="blue"] { --cc: #4c8dff; --cc-dim: rgba(76,141,255,0.28); }
      .fs-cmine-skills[data-theme="red"] { --cc: #ff6b6b; --cc-dim: rgba(255,107,107,0.28); }
      .fs-cmine-skills[data-theme="orange"] { --cc: #ff8a3d; --cc-dim: rgba(255,138,61,0.30); }
      .fs-cmine-skills-head {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
        margin-bottom: 12px;
      }
      .fs-cmine-skills-head .fs-v3-kicker { margin: 0; }
      .fs-cmine-skills-avg {
        display: flex; flex-direction: column; align-items: flex-end; gap: 1px;
        padding: 6px 10px; border-radius: 12px;
        background: color-mix(in srgb, var(--cc) 12%, rgba(255,255,255,0.03));
        border: 1px solid color-mix(in srgb, var(--cc) 28%, rgba(255,255,255,0.08));
        box-shadow: 0 0 18px var(--cc-dim);
      }
      .fs-cmine-skills-avg .val {
        font-size: 20px; font-weight: 900; line-height: 1; color: var(--cc);
        font-variant-numeric: tabular-nums;
        text-shadow: 0 0 16px var(--cc-dim);
      }
      .fs-cmine-skills-avg .lab {
        font-size: 9px; font-weight: 800; letter-spacing: 0.08em;
        text-transform: uppercase; color: var(--fs-text-dim);
      }
      .fs-cmine-skills-grid {
        display: flex; flex-direction: column; gap: 8px;
      }
      .fs-cmine-skill {
        position: relative;
        padding: 9px 10px 10px 11px;
        border-radius: 12px;
        background: rgba(0,0,0,0.22);
        border: 1px solid rgba(255,255,255,0.06);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03);
      }
      .fs-cmine-skill::before {
        content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 3px;
        border-radius: 0 3px 3px 0;
        background: linear-gradient(180deg, var(--cc), color-mix(in srgb, var(--cc) 35%, transparent));
        box-shadow: 0 0 10px var(--cc-dim);
      }
      .fs-cmine-skill-top {
        display: grid; grid-template-columns: 22px 1fr auto auto; gap: 8px; align-items: center;
        margin-bottom: 7px;
      }
      .fs-cmine-skill .ico {
        width: 22px; height: 22px; border-radius: 7px;
        display: grid; place-items: center;
        font-size: 11px; line-height: 1;
        color: var(--cc);
        background: color-mix(in srgb, var(--cc) 14%, rgba(255,255,255,0.04));
        border: 1px solid color-mix(in srgb, var(--cc) 24%, rgba(255,255,255,0.06));
      }
      .fs-cmine-skill .name {
        font-size: 11px; font-weight: 800; color: #eef1f7; letter-spacing: 0.01em;
      }
      .fs-cmine-skill .tier {
        font-size: 9px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
        color: var(--cc); opacity: 0.92;
        padding: 2px 6px; border-radius: 999px;
        background: color-mix(in srgb, var(--cc) 10%, transparent);
        border: 1px solid color-mix(in srgb, var(--cc) 18%, transparent);
      }
      .fs-cmine-skill .score {
        min-width: 30px; text-align: right;
        font-size: 13px; font-weight: 900; color: #fff;
        font-variant-numeric: tabular-nums;
        text-shadow: 0 0 12px var(--cc-dim);
      }
      .fs-cmine-skill-bar {
        position: relative; height: 8px; border-radius: 999px; overflow: hidden;
        background: rgba(255,255,255,0.06);
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.35);
      }
      .fs-cmine-skill-bar .fill {
        position: relative; z-index: 1; height: 100%; border-radius: inherit;
        background: linear-gradient(90deg, color-mix(in srgb, var(--cc) 55%, #fff 8%), var(--cc));
        box-shadow: 0 0 14px var(--cc-dim);
        transition: width 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .fs-cmine-skill-bar .glow {
        position: absolute; inset: 0; z-index: 2; pointer-events: none;
        background: linear-gradient(90deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%);
        transform: translateX(-120%);
        animation: fs-cmine-skill-shine 2.8s ease-in-out infinite;
      }
      @keyframes fs-cmine-skill-shine {
        0%, 72% { transform: translateX(-120%); opacity: 0; }
        78% { opacity: 1; }
        100% { transform: translateX(120%); opacity: 0; }
      }
      .fs-cmine-skill:nth-child(2) .glow { animation-delay: 0.35s; }
      .fs-cmine-skill:nth-child(3) .glow { animation-delay: 0.7s; }
      .fs-cmine-skill:nth-child(4) .glow { animation-delay: 1.05s; }
      .fs-cmine-skill:nth-child(5) .glow { animation-delay: 1.4s; }
      .fs-cmine-wrap { display: flex; flex-direction: column; gap: 14px; }
      .fs-cmine-recent {
        border-radius: 16px; padding: 14px 16px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(0,0,0,0.22);
      }
      .fs-cmine-recent-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; margin-bottom: 10px;
      }
      .fs-cmine-recent-head .fs-v3-kicker { margin: 0; color: #c4b5fd; }
      .fs-cmine-recent-sub {
        font-size: 11px; color: var(--fs-muted); line-height: 1.35;
      }
      .fs-cpg-row {
        display: flex; align-items: center; gap: 12px; width: 100%;
        padding: 10px 12px; margin: 0; border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; background: rgba(255,255,255,0.03);
        cursor: pointer; text-align: left; color: inherit;
        transition: background .15s ease, border-color .15s ease;
      }
      .fs-cpg-row + .fs-cpg-row { margin-top: 8px; }
      .fs-cpg-row:hover {
        background: rgba(76,141,255,0.08);
        border-color: rgba(76,141,255,0.28);
      }
      .fs-cpg-meta { flex: 1; min-width: 0; }
      .fs-cpg-top {
        display: flex; align-items: center; justify-content: space-between;
        gap: 8px; margin-bottom: 4px;
      }
      .fs-cpg-date { font-size: 11px; color: var(--fs-muted); white-space: nowrap; }
      .fs-cpg-sub { font-size: 12px; color: #c5ccda; line-height: 1.35; }
      .fs-cpg-go {
        flex: 0 0 auto; font-size: 11px; font-weight: 800;
        color: #f5c542; white-space: nowrap;
      }
      .fs-cmine-recent-loading {
        font-size: 12px; color: var(--fs-muted); padding: 8px 2px;
      }
      @media (max-width: 980px) {
        .fs-ccard { flex-basis: 228px; width: 228px; max-width: 228px; height: 488px; min-height: 488px; }
        .fs-cpick-bottom { grid-template-columns: 1fr 1fr; }
        .fs-cmine { grid-template-columns: 1fr; }
      }
      .fs-learn-box {
        margin-top: 10px; padding: 10px 12px; border-radius: 10px;
        background: rgba(76,141,255,0.08); border: 1px solid rgba(76,141,255,0.22);
        font-size: 12px; line-height: 1.45;
      }
      .fs-mini-board {
        width: 56px; height: 56px; border-radius: 8px; overflow: hidden;
        flex: 0 0 56px; background: #b58863;
        box-shadow: 0 4px 12px rgba(0,0,0,0.35);
      }
      .fs-mini-board svg { display: block; width: 100%; height: 100%; }
      .fs-mini-board-fallback {
        width: 100%; height: 100%;
        background: linear-gradient(135deg, #769656, #eeeed2);
      }
      .fs-revisit-row, .fs-reco-row {
        display: flex; align-items: center; gap: 10px;
        padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
        min-height: 64px;
      }
      .fs-revisit-row .fs-mini-board {
        flex: 0 0 56px; width: 56px; height: 56px;
      }
      .fs-revisit-row:last-child, .fs-reco-row:last-child { border-bottom: 0; }
      .fs-revisit-meta { flex: 1; min-width: 0; }
      .fs-revisit-meta strong { display: block; font-size: 12px; }
      .fs-revisit-meta span { font-size: 11px; color: var(--fs-text-dim); }
      .fs-tag {
        display: inline-block; font-size: 10px; font-weight: 800;
        padding: 2px 6px; border-radius: 6px; margin-left: 4px;
      }
      .fs-tag-bad { background: rgba(255,107,107,0.18); color: #ff8e8e; }
      .fs-tag-warn { background: rgba(240,160,32,0.18); color: #f0a020; }
      .fs-tag-ok { background: rgba(61,214,140,0.15); color: #3dd68c; }
      .fs-reco-ico {
        width: 36px; height: 36px; border-radius: 50%;
        display: grid; place-items: center; font-size: 16px; flex: 0 0 auto;
      }
      .fs-footer-xp {
        display: grid; grid-template-columns: 1.2fr 1.6fr 1fr; gap: 12px;
        align-items: center; margin-top: 14px;
      }
      .fs-chest-track {
        display: flex; align-items: flex-end; justify-content: space-between;
        gap: 6px; position: relative; padding-top: 18px;
      }
      .fs-chest-track::before {
        content: ""; position: absolute; left: 8%; right: 8%; top: 28px;
        height: 3px; background: rgba(255,255,255,0.1); border-radius: 999px;
      }
      .fs-chest-item { text-align: center; position: relative; z-index: 1; flex: 1; }
      .fs-chest-item img { width: 40px; height: 40px; object-fit: contain; background: transparent; }
      .fs-chest-item span { display: block; font-size: 10px; color: var(--fs-text-dim); margin-top: 2px; font-weight: 700; }
      .fs-chest-item.done span { color: var(--fs-accent); }
      .fs-coach-spark {
        display: flex; align-items: flex-end; gap: 3px; height: 36px;
        justify-content: center; margin: 8px 0;
      }
      .fs-coach-spark i {
        width: 7px; border-radius: 3px 3px 0 0;
        background: linear-gradient(180deg, #c4b5fd, #7c3aed);
      }
      .fs-stat-bar .fs-stat-sep {
        width: 1px; height: 18px; background: rgba(255,255,255,0.12);
        margin: 0 2px; flex: 0 0 auto; align-self: center;
      }
      .fs-learn-box strong { color: var(--fs-accent); }
      .fs-reco-ico.tactics { background: rgba(61,214,140,0.15); color: #3dd68c; }
      .fs-reco-ico.opening { background: rgba(76,141,255,0.15); color: #4c8dff; }
      .fs-reco-ico.calc { background: rgba(167,139,250,0.15); color: #c4b5fd; }
      .fs-reco-ico.end { background: rgba(245,197,66,0.15); color: #f5c542; }
      .fs-btn-sm {
        padding: 7px 10px; border-radius: 9px; font-size: 11px; font-weight: 800;
        border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04);
        color: var(--fs-text); cursor: pointer; white-space: nowrap;
      }
      .fs-btn-sm.gold {
        background: linear-gradient(180deg, #ffd45a, #f5c542); color: #12141d; border: 0;
      }
      .fs-btn-sm.green { border-color: rgba(61,214,140,0.35); color: #3dd68c; }
      .fs-btn-sm.blue { border-color: rgba(76,141,255,0.35); color: #4c8dff; }
      .fs-btn-sm.purple { border-color: rgba(167,139,250,0.35); color: #c4b5fd; }
      .fs-today-xp {
        padding: 10px 12px; border-radius: 12px;
        background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-today-xp strong { display: block; font-size: 14px; margin-bottom: 6px; }
      .fs-revisit-wrap { position: relative; }
      .fs-revisit-atmos {
        position: absolute; left: -8px; bottom: -18px; width: 72px; height: 90px;
        object-fit: contain; opacity: 0.7; pointer-events: none;
        filter: drop-shadow(0 8px 16px rgba(0,0,0,0.45));
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


      /* ── Notifications dropdown ── */
      .fs-header-right { position: relative; }
      .fs-notif-wrap { position: relative; flex: 0 0 auto; }
      .fs-header-bell {
        width: 34px; height: 34px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.04);
        display: grid; place-items: center; color: var(--fs-text-dim);
        cursor: pointer; position: relative;
      }
      .fs-header-bell:hover { color: var(--fs-text); border-color: rgba(245,197,66,0.35); }
      .fs-header-bell.fs-has-unread::after {
        content: ""; position: absolute; top: 6px; right: 7px;
        width: 8px; height: 8px; border-radius: 50%;
        background: #f5c542; border: 1.5px solid #12141d;
        box-shadow: 0 0 8px rgba(245,197,66,0.65);
      }
      .fs-notif-panel {
        position: absolute; top: calc(100% + 8px); right: 0;
        width: 320px; max-height: 360px; overflow: auto;
        background: #161924; border: 1px solid rgba(245,197,66,0.28);
        border-radius: 14px; z-index: 40;
        box-shadow: 0 18px 40px rgba(0,0,0,0.55);
        padding: 10px;
      }
      .fs-notif-panel[hidden] { display: none !important; }
      .fs-notif-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 4px 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.08);
        margin-bottom: 8px;
      }
      .fs-notif-head strong { font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; }
      .fs-notif-item {
        display: grid; grid-template-columns: 8px 1fr; gap: 10px;
        padding: 10px 8px; border-radius: 10px; cursor: pointer;
        text-align: left; width: 100%; border: 0; background: transparent; color: inherit;
      }
      .fs-notif-item:hover { background: rgba(255,255,255,0.04); }
      .fs-notif-item.unread .fs-notif-dot { background: var(--fs-accent); box-shadow: 0 0 8px rgba(245,197,66,0.5); }
      .fs-notif-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.15); margin-top: 5px; }
      .fs-notif-title { font-size: 12.5px; font-weight: 700; color: var(--fs-text); }
      .fs-notif-body { font-size: 11px; color: var(--fs-text-dim); margin-top: 2px; line-height: 1.35; }
      .fs-notif-empty { padding: 18px 8px; text-align: center; color: var(--fs-text-dim); font-size: 12px; }

      /* ── Profile V3 ── */
      .fs-prof-v3-head {
        display: grid; grid-template-columns: auto 1fr auto; gap: 16px;
        align-items: center; padding: 14px 16px; margin-bottom: 12px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
        border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-prof-online {
        position: absolute; top: 2px; right: 2px; width: 12px; height: 12px;
        border-radius: 50%; background: #3dd68c; border: 2px solid #12141d;
        box-shadow: 0 0 8px rgba(61,214,140,0.6); z-index: 2;
      }
      .fs-xp-ring {
        --fs-xp-pct: 70;
        position: relative;
        width: 104px; height: 104px; border-radius: 50%; margin: 0 auto;
        display: grid; place-items: center; text-align: center;
        background:
          radial-gradient(circle at center, #12141d 70%, transparent 71%),
          conic-gradient(from -90deg, #c084fc 0 calc(var(--fs-xp-pct) * 1%), rgba(255,255,255,0.07) 0);
        box-shadow:
          0 0 0 1px rgba(168,85,247,0.2),
          0 0 22px rgba(168,85,247,0.28),
          inset 0 0 18px rgba(168,85,247,0.08);
      }
      .fs-xp-ring::after {
        content: "";
        position: absolute; width: 8px; height: 8px; border-radius: 50%;
        background: #e9d5ff; box-shadow: 0 0 10px rgba(192,132,252,0.9);
        top: 50%; left: 50%; margin: -4px 0 0 -4px;
        transform:
          rotate(calc(var(--fs-xp-pct) * 3.6deg - 90deg))
          translate(46px);
      }
      .fs-xp-ring .xp-lab {
        font-size: 9px; color: #c4b5fd; font-weight: 700; letter-spacing: 0.08em;
      }
      .fs-xp-ring .xp-now { font-size: 17px; font-weight: 800; line-height: 1.1; }
      .fs-xp-ring .xp-max {
        font-size: 10px; color: var(--fs-text-dim); margin-top: 3px;
        padding-top: 3px; border-top: 1px solid rgba(255,255,255,0.12);
      }
      .fs-prof-stat-ico {
        width: 26px; height: 26px; margin: 0 auto 4px;
        display: grid; place-items: center; font-size: 18px; line-height: 1;
      }
      .fs-prof-stat-ico.pawn { color: #c5CAD3; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35)); }
      .fs-prof-stat-ico.shield {
        width: 24px; height: 28px; font-size: 11px; color: #3a2a12; font-weight: 900;
        clip-path: polygon(8% 0%, 92% 0%, 100% 18%, 100% 58%, 50% 100%, 0% 58%, 0% 18%);
        background:
          radial-gradient(circle at 35% 25%, #ffe08a, #f5c542 48%, #b8860b 88%);
        box-shadow: 0 4px 12px rgba(245,197,66,0.35);
      }
      .fs-prof-stat-ico.flame { color: #f59e0b; filter: drop-shadow(0 2px 6px rgba(245,158,11,0.45)); }
      .fs-hs-shield {
        width: 28px; height: 32px; border-radius: 0; font-size: 12px;
        color: #3a2a12; font-weight: 900; line-height: 1;
        clip-path: polygon(8% 0%, 92% 0%, 100% 18%, 100% 58%, 50% 100%, 0% 58%, 0% 18%);
        background:
          radial-gradient(circle at 35% 25%, #ffe08a, #f5c542 48%, #b8860b 88%);
        box-shadow: 0 4px 12px rgba(245,197,66,0.4);
        display: grid; place-items: center;
      }
      .fs-panel[data-tab="profile"] .fs-header {
        min-height: 44px; padding-top: 8px; padding-bottom: 4px;
        justify-content: flex-end;
      }
      .fs-panel[data-tab="profile"] .fs-header-left { display: none; }
      .fs-panel[data-tab="profile"] .fs-header-right { margin-left: auto; }
      .fs-panel[data-tab="profile"] .fs-body { padding-top: 4px; }
      .fs-attr-seg {
        display: flex; gap: 3px; width: 100%;
      }
      .fs-attr-seg i {
        flex: 1; height: 9px; border-radius: 2px;
        background: rgba(255,255,255,0.08);
      }
      .fs-identity-top {
        display: grid; grid-template-columns: 1fr 158px; gap: 10px;
        align-items: start; margin-bottom: 8px;
      }
      .fs-league-path {
        display: grid; grid-template-columns: 1fr auto 1fr; gap: 8px;
        align-items: end; margin-top: 16px; padding: 12px 8px 4px;
        border-radius: 12px;
        background:
          radial-gradient(ellipse at 50% 80%, rgba(245,197,66,0.12), transparent 60%),
          rgba(0,0,0,0.22);
      }
      .fs-league-node { text-align: center; }
      .fs-league-node img {
        width: 56px; height: 64px; object-fit: contain; display: block; margin: 0 auto 6px;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,0.45));
      }
      .fs-league-node.silver img { filter: grayscale(0.35) brightness(1.15) drop-shadow(0 6px 14px rgba(0,0,0,0.45)); }
      .fs-league-node.gold img { filter: drop-shadow(0 0 14px rgba(245,197,66,0.45)); }
      .fs-league-node span { font-size: 10px; color: var(--fs-text-dim); font-weight: 700; }
      .fs-league-dots {
        display: flex; gap: 6px; align-items: center; padding-bottom: 28px;
      }
      .fs-league-dots i {
        width: 6px; height: 6px; border-radius: 50%;
        background: rgba(245,197,66,0.55);
        box-shadow: 0 0 8px rgba(245,197,66,0.4);
      }
      .fs-arena-league-bar {
        display: grid; grid-template-columns: 1.35fr 0.85fr 0.95fr 1fr; gap: 0;
        align-items: start; margin-bottom: 14px; padding: 16px 18px;
        border-radius: 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02));
        border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-arena-league-bar > div { padding: 0 12px; min-width: 0; }
      .fs-arena-league-bar .fs-v3-title {
        font-size: clamp(16px, 1.6vw, 28px); line-height: 1.15; overflow-wrap: anywhere;
      }
      .fs-arena-league-bar .fs-v3-kicker { letter-spacing: 0.06em; }
      .fs-arena-league-bar > div + div { border-left: 1px solid rgba(255,255,255,0.08); }
      .fs-arena-league-main { display: flex; gap: 12px; align-items: center; padding-left: 0 !important; }
      .fs-arena-league-main .shield {
        width: 58px; height: 66px; border-radius: 12px 12px 28px 28px;
        display: grid; place-items: center; font-size: 28px; line-height: 1;
        background:
          radial-gradient(circle at 35% 28%, #f5f5f7, #b8bec8 48%, #7b8494 78%, #5c6572);
        box-shadow:
          0 0 0 2px rgba(192,192,192,0.4),
          0 8px 20px rgba(0,0,0,0.35),
          inset 0 -8px 14px rgba(0,0,0,0.28);
        overflow: hidden;
        clip-path: polygon(8% 0%, 92% 0%, 100% 18%, 100% 58%, 50% 100%, 0% 58%, 0% 18%);
      }
      .fs-arena-league-main .shield img {
        width: 34px; height: 34px; object-fit: contain; margin-top: -4px;
        filter: grayscale(0.45) brightness(1.25) contrast(1.05);
      }
      .fs-identity-art-wrap {
        position: relative; width: 158px; height: 168px;
        display: grid; place-items: center; justify-self: end;
      }
      .fs-identity-art-wrap::before {
        content: ""; position: absolute; inset: 2px;
        border-radius: 50%;
        background:
          conic-gradient(from 210deg, transparent 0 38%, rgba(245,197,66,0.7) 48%, transparent 58% 100%),
          radial-gradient(circle, rgba(245,197,66,0.22), transparent 70%);
        box-shadow: 0 0 34px rgba(245,197,66,0.32);
        animation: fs-halo-spin 14s linear infinite;
      }
      @keyframes fs-halo-spin { to { transform: rotate(360deg); } }
      .fs-identity-art {
        width: 138px; height: 158px; object-fit: contain; position: relative; z-index: 1;
        filter: drop-shadow(0 8px 18px rgba(0,0,0,0.45)) drop-shadow(0 0 16px rgba(245,197,66,0.4));
      }
      .fs-v3-card .fs-v3-title {
        font-family: Georgia, "Palatino Linotype", Palatino, "Times New Roman", serif;
        font-weight: 600; letter-spacing: -0.015em;
      }
      .fs-prof-edit {
        position: absolute; right: -2px; bottom: -2px; z-index: 2;
        width: 22px; height: 22px; border-radius: 50%;
        background: #1a1d28; color: var(--fs-accent);
        border: 1.5px solid rgba(245,197,66,0.85); padding: 0;
        display: grid; place-items: center; cursor: pointer;
        box-shadow: 0 0 0 2px #12141d;
      }
      .fs-prof-edit svg { width: 11px; height: 11px; display: block; }
      .fs-prof-idcol {
        display: flex; flex-direction: column; align-items: flex-start; min-width: 0;
      }
      .fs-skill-ico-wrap {
        width: 38px; height: 38px; border-radius: 50%;
        display: grid; place-items: center;
        background: color-mix(in srgb, var(--fs-skill-c, #f5c542) 28%, #12141d);
        box-shadow:
          0 0 0 1px color-mix(in srgb, var(--fs-skill-c, #f5c542) 45%, transparent),
          0 0 14px color-mix(in srgb, var(--fs-skill-c, #f5c542) 22%, transparent);
      }
      .fs-skill-list-row .fs-skill-bar { height: 8px; margin-top: 7px; border-radius: 999px; }
      .fs-skill-list-row .fs-skill-bar i { border-radius: 999px; }
      .fs-skill-ico-wrap img { width: 22px !important; height: 22px !important; display: block; }
      .fs-lb-xp-pill {
        display: inline-flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; border-radius: 50%; margin-left: 4px;
        font-size: 8px; font-weight: 800; vertical-align: middle;
        background: rgba(168,85,247,0.25); color: #c084fc;
        border: 1px solid rgba(168,85,247,0.45);
      }
      .fs-weekly-chest.opening {
        box-shadow:
          0 0 0 1px rgba(245,197,66,0.55),
          0 0 36px rgba(245,197,66,0.35),
          inset 0 0 40px rgba(245,197,66,0.08);
      }
      .fs-prog-goal { position: relative; margin: 12px 0 8px; }
      .fs-prog-goal .fs-skill-bar { height: 10px; }
      .fs-prog-goal .goal-ico {
        position: absolute; right: -2px; top: 50%; transform: translateY(-50%);
        font-size: 16px; filter: drop-shadow(0 0 8px rgba(245,197,66,0.5));
      }
      .fs-prof-v3-av {
        width: 72px; height: 72px; border-radius: 50%;
        object-fit: cover; border: 2px solid rgba(245,197,66,0.65);
        box-shadow: 0 0 0 3px rgba(18,20,29,0.9), 0 8px 20px rgba(0,0,0,0.4);
        background: var(--fs-bg-elev);
      }
      .fs-prof-v3-av-ph {
        width: 72px; height: 72px; border-radius: 50%;
        display: grid; place-items: center; font-weight: 800; font-size: 22px;
        border: 2px solid rgba(245,197,66,0.65); background: #222633;
      }
      .fs-prof-v3-name { font-size: 26px; font-weight: 700; font-family: Georgia, serif; }
      .fs-prof-v3-link {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 12px; color: var(--fs-text-dim); margin-top: 4px;
        background: none; border: 0; cursor: pointer; padding: 0;
      }
      .fs-prof-v3-link:hover { color: var(--fs-accent); }
      .fs-prof-badge {
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 8px; padding: 4px 10px; border-radius: 999px;
        background: rgba(245,197,66,0.12); border: 1px solid rgba(245,197,66,0.35);
        color: var(--fs-accent); font-size: 11px; font-weight: 800;
      }
      .fs-prof-badge img {
        width: 14px; height: 14px; object-fit: contain;
        filter: drop-shadow(0 0 4px rgba(245,197,66,0.45));
      }
      .fs-prof-statcols {
        display: grid; grid-template-columns: repeat(3, minmax(70px, 88px)) 108px;
        gap: 0; min-width: 390px; align-items: center;
      }
      .fs-prof-statcol {
        text-align: center; padding: 4px 12px;
        background: transparent; border: 0;
        border-right: 1px solid rgba(255,255,255,0.12);
        align-self: stretch; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
      }
      .fs-prof-statcol:nth-child(3) { border-right: 0; }
      .fs-prof-statcol.fs-prof-xp { border: 0; padding: 0 0 0 10px; }
      .fs-prof-statcol b { display: block; font-size: 24px; font-weight: 800; line-height: 1.1; margin-top: 2px; }
      .fs-prof-statcol > span.lab {
        font-size: 11px; color: var(--fs-text-dim); font-weight: 600;
        letter-spacing: 0.02em; text-transform: none;
      }
      .fs-prof-statcol .fs-v3-sub {
        margin-top: 2px; font-size: 11px; color: var(--fs-text-dim); font-weight: 500;
      }
      .fs-v3-card .fs-v3-kicker { color: var(--fs-accent); }
      .fs-quote-box {
        position: relative;
        margin-top: 12px; padding: 12px 14px 12px 36px; border-radius: 12px;
        background: rgba(0,0,0,0.28); border: 1px solid rgba(255,255,255,0.08);
        font-style: italic; color: var(--fs-text-dim); font-size: 12.5px; line-height: 1.45;
      }
      .fs-quote-box::before {
        content: "“"; position: absolute; left: 10px; top: 4px;
        font-size: 28px; line-height: 1; color: rgba(245,197,66,0.45);
        font-family: Georgia, serif;
      }
      .fs-prof-grid2 {
        display: grid; grid-template-columns: 1.15fr 1fr; gap: 14px; margin-top: 4px;
      }
      .fs-attr-row {
        display: grid; grid-template-columns: 22px 78px 1fr 78px; gap: 8px;
        align-items: center; margin: 6px 0; font-size: 12px;
      }
      .fs-attr-row .fs-skill-bar { height: 6px; }
      .fs-attr-ico { font-size: 14px; line-height: 1; text-align: center; }
      .fs-skill-list-row {
        display: grid; grid-template-columns: 36px 1fr auto; gap: 10px;
        align-items: center; padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .fs-skill-list-row:last-child { border-bottom: 0; }
      .fs-journey {
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;
        margin-top: 10px; position: relative; padding: 8px 4px 14px;
        border-radius: 12px;
        background:
          linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.35)),
          repeating-conic-gradient(#1a1d28 0% 25%, #12141d 0% 50%) 50% 100% / 22px 22px;
      }
      .fs-journey::before {
        content: ""; position: absolute; left: 8%; right: 8%; top: 30px;
        height: 2px;
        background: linear-gradient(90deg,
          rgba(245,197,66,0.55),
          rgba(245,197,66,0.75) 40%,
          rgba(61,214,140,0.65) 62%,
          rgba(167,139,250,0.75) 100%);
      }
      .fs-journey-item { text-align: center; position: relative; z-index: 1; }
      .fs-journey-ico {
        width: 46px; height: 46px; margin: 0 auto 8px; border-radius: 50%;
        display: grid; place-items: center; font-size: 16px; position: relative;
        background: #1a1d28; border: 2px solid rgba(245,197,66,0.55);
        box-shadow: 0 0 0 3px rgba(18,20,29,0.9), 0 0 14px rgba(245,197,66,0.18);
      }
      .fs-journey-item.done .fs-journey-ico {
        border-color: rgba(245,197,66,0.7);
        box-shadow: 0 0 0 3px rgba(18,20,29,0.9), 0 0 16px rgba(245,197,66,0.28);
      }
      .fs-journey-item.peak .fs-journey-ico {
        border-color: rgba(167,139,250,0.85);
        box-shadow: 0 0 0 3px rgba(18,20,29,0.9), 0 0 18px rgba(167,139,250,0.35);
        color: #c4b5fd;
      }
      .fs-journey-item strong {
        display: block; font-size: 11px; color: var(--fs-accent); font-weight: 800;
      }
      .fs-journey-item.peak strong { color: var(--fs-text); }
      .fs-journey-item .fs-j-when {
        display: block; font-size: 10px; color: var(--fs-text); margin-top: 3px; font-weight: 600;
      }
      .fs-journey-item .fs-j-sub {
        display: block; font-size: 10px; color: var(--fs-text-dim); margin-top: 4px;
        padding-top: 4px;
        border-top: 1px solid rgba(245,197,66,0.2);
        position: relative;
      }
      .fs-journey-item .fs-j-sub::before {
        content: "◆"; position: absolute; left: 50%; top: -7px; transform: translateX(-50%);
        font-size: 7px; color: rgba(245,197,66,0.55); background: #12141d; padding: 0 4px;
      }
      .fs-journey-item.done .fs-journey-ico::after {
        content: "✓"; position: absolute; right: -2px; top: -2px;
        width: 16px; height: 16px; border-radius: 50%;
        background: var(--fs-tactics); color: #0b1220; font-size: 10px; font-weight: 900;
        display: grid; place-items: center;
        box-shadow: 0 0 0 2px #12141d;
      }
      .fs-journey-item.peak .fs-journey-ico::after { display: none; }
      .fs-league-badge .shield {
        width: 36px; height: 40px; margin: 0 auto 6px;
        clip-path: polygon(8% 0%, 92% 0%, 100% 18%, 100% 58%, 50% 100%, 0% 58%, 0% 18%);
        display: grid; place-items: center; font-size: 16px;
        background: radial-gradient(circle at 35% 25%, #d7dbe3, #8b929e 55%, #5c6572);
        box-shadow: 0 4px 10px rgba(0,0,0,0.35);
      }
      .fs-league-badge.on .shield {
        background: radial-gradient(circle at 35% 25%, #ffe08a, #f5c542 48%, #b8860b 88%);
        box-shadow: 0 0 14px rgba(245,197,66,0.4);
      }
      .fs-league-badge:nth-child(1) .shield { background: radial-gradient(circle at 35% 25%, #e8b892, #b87333 55%, #7a4a1e); }
      .fs-league-badge:nth-child(3) .shield { background: radial-gradient(circle at 35% 25%, #ffe08a, #f5c542 48%, #b8860b 88%); }
      .fs-league-badge:nth-child(4) .shield { background: radial-gradient(circle at 35% 25%, #c4f1ff, #5ec8f0 48%, #2a7eb8); }
      .fs-league-badge:nth-child(5) .shield { background: radial-gradient(circle at 35% 25%, #e9d5ff, #a78bfa 48%, #6d28d9); }
      .fs-ach-hex {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 8px;
      }
      .fs-ach-hex-item { text-align: center; padding: 8px 4px; }
      .fs-ach-hex-ico {
        width: 48px; height: 54px; margin: 0 auto 6px;
        clip-path: polygon(50% 0%, 92% 18%, 92% 62%, 50% 100%, 8% 62%, 8% 18%);
        display: grid; place-items: center; font-size: 18px;
        background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(0,0,0,0.4));
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: 0 0 14px rgba(245,197,66,0.18);
      }
      .fs-journey-ico { position: relative; }
      .fs-ach-hex-item small { display: block; font-size: 10px; font-weight: 700; line-height: 1.25; }
      .fs-ach-sub {
        display: block; margin-top: 3px; font-size: 9px; line-height: 1.3;
        color: var(--fs-text-dim); font-weight: 500;
      }

      /* ── Arena V3 ── */
      .fs-arena-stats {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;
      }
      .fs-arena-stat {
        padding: 14px; border-radius: 14px;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-arena-stat .lab { font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fs-text-dim); }
      .fs-arena-stat .val { font-size: 22px; font-weight: 800; margin-top: 4px; }
      .fs-arena-stat .sub { font-size: 11px; color: var(--fs-text-dim); margin-top: 4px; }
      .fs-arena-mid {
        display: grid; grid-template-columns: 1.5fr 1fr; gap: 14px; margin-bottom: 14px;
      }
      .fs-lb-row-v3 {
        display: grid; grid-template-columns: 56px 40px minmax(0, 1fr) 56px 72px;
        gap: 10px; align-items: center; padding: 8px 12px;
        border-radius: 10px; font-size: 12px;
      }
      .fs-lb-row-v3.me {
        background: rgba(245,197,66,0.08);
        box-shadow: 0 0 0 1px rgba(245,197,66,0.4);
      }
      .fs-lb-row-v3 .rank {
        font-weight: 800; color: var(--fs-text-dim);
        min-width: 52px; display: flex; align-items: center; gap: 4px;
        white-space: nowrap;
      }
      .fs-lb-row-v3 .name {
        min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        padding-left: 2px;
      }
      .fs-lb-row-v3.me .rank, .fs-lb-row-v3.me .name, .fs-lb-row-v3.me .xp { color: var(--fs-accent); }
      .fs-delta-up { color: var(--fs-tactics); font-weight: 800; font-size: 11px; }
      .fs-delta-dn { color: #ff6b6b; font-weight: 800; font-size: 11px; }
      .fs-weekly-chest.opening img {
        animation: fs-chest-pop 0.95s cubic-bezier(.2,.8,.2,1);
      }
      .fs-weekly-chest.locked-shake img {
        animation: fs-chest-locked 0.42s ease;
      }
      @keyframes fs-chest-pop {
        0% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 8px rgba(245,197,66,0.3)); }
        35% { transform: scale(1.14) rotate(-4deg); filter: drop-shadow(0 0 28px rgba(245,197,66,0.85)) brightness(1.25); }
        60% { transform: scale(1.06) rotate(3deg); }
        100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 18px rgba(245,197,66,0.55)); }
      }
      @keyframes fs-chest-locked {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-4px) rotate(-2deg); }
        40% { transform: translateX(4px) rotate(2deg); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(3px); }
      }
      .fs-league-track {
        display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 10px;
      }
      .fs-league-badge {
        text-align: center; padding: 10px 6px; border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.2);
      }
      .fs-league-badge.on {
        border-color: rgba(245,197,66,0.55);
        box-shadow: 0 0 0 1px rgba(245,197,66,0.25), 0 0 18px rgba(245,197,66,0.15);
      }
      .fs-league-badge strong { display: block; font-size: 11px; }
      .fs-league-badge span { font-size: 10px; color: var(--fs-text-dim); }
      .fs-comp-grid {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
      }
      .fs-comp-with-chest {
        display: grid; grid-template-columns: 1.75fr 0.85fr; gap: 0; align-items: stretch;
        margin-top: 10px;
      }
      .fs-comp-with-chest .fs-comp-grid {
        grid-template-columns: repeat(4, 1fr); gap: 0;
        border-right: 1px solid rgba(255,255,255,0.08);
        padding-right: 8px;
      }
      .fs-comp-with-chest .fs-weekly-chest { margin-top: 0; height: 100%; margin-left: 10px; }
      .fs-comp-cell {
        padding: 8px 10px; border-radius: 0;
        background: transparent; border: 0;
        text-align: center;
        border-right: 1px solid rgba(255,255,255,0.08);
      }
      .fs-comp-with-chest .fs-comp-cell:last-child { border-right: 0; }
      .fs-comp-cell .fs-comp-ico {
        font-size: 22px; line-height: 1; margin-bottom: 6px;
        filter: drop-shadow(0 4px 10px rgba(0,0,0,0.35));
      }
      .fs-comp-cell b { display: block; font-size: 22px; margin-top: 2px; font-weight: 800; }
      .fs-comp-cell span {
        display: block; font-size: 11px; color: var(--fs-text-dim); font-weight: 600;
        letter-spacing: 0.02em; text-transform: none; margin-top: 4px;
        line-height: 1.25; overflow-wrap: anywhere;
      }
      .fs-comp-cell small {
        display: block; margin-top: 4px; font-size: 10.5px; color: var(--fs-tactics);
        line-height: 1.3; overflow-wrap: anywhere;
      }
      .fs-weekly-chest .fs-v3-kicker {
        letter-spacing: 0.05em; font-size: 9.5px; line-height: 1.25;
      }
      .fs-notif-title, .fs-notif-body { overflow-wrap: anywhere; }
      .fs-attr-row, .fs-skill-list-row { min-width: 0; }
      .fs-attr-row > span:nth-child(2),
      .fs-skill-list-row > div:nth-child(2) { min-width: 0; overflow-wrap: anywhere; }
      .fs-reward-cell strong, .fs-reward-cell span {
        display: block; overflow-wrap: anywhere; line-height: 1.3;
      }
      .fs-journey-item strong, .fs-journey-item .fs-j-when, .fs-journey-item .fs-j-sub {
        overflow-wrap: anywhere; line-height: 1.25;
      }
      .fs-ach-hex-item small, .fs-ach-sub { overflow-wrap: anywhere; }
      .fs-chest-bar {
        position: relative; margin-top: 10px; height: 18px; border-radius: 999px;
        background: rgba(255,255,255,0.08); overflow: hidden;
      }
      .fs-chest-bar > i {
        display: block; height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #a78bfa, #8b5cf6);
      }
      .fs-chest-bar > em {
        position: absolute; inset: 0; display: grid; place-items: center;
        font-style: normal; font-size: 10px; font-weight: 700; color: #fff;
        text-shadow: 0 1px 2px rgba(0,0,0,0.55);
        pointer-events: none;
      }
      .fs-weekly-chest {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; gap: 6px; padding: 12px 10px;
        border-radius: 14px;
        background:
          radial-gradient(ellipse at 50% 28%, rgba(125,211,252,0.16), transparent 42%),
          radial-gradient(ellipse at 50% 60%, rgba(245,197,66,0.12), transparent 55%),
          rgba(255,255,255,0.02);
        border: 1px solid rgba(245,197,66,0.22);
      }
      .fs-weekly-chest > div { width: 100%; }
      .fs-weekly-chest img {
        width: 92px; height: 92px; object-fit: contain;
        filter: drop-shadow(0 0 16px rgba(125,211,252,0.3)) drop-shadow(0 0 14px rgba(245,197,66,0.35));
      }
      .fs-xp-pill {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 28px; height: 18px; padding: 0 6px; margin-left: 6px;
        border-radius: 999px; font-size: 10px; font-weight: 800; vertical-align: middle;
        background: rgba(168,85,247,0.22); color: #c084fc;
        border: 1px solid rgba(168,85,247,0.45);
      }
      .fs-coach-hl { color: #c4b5fd; font-weight: 800; }

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

      /* ── Onboarding (yeni kullanıcı) ── */
      .fs-onboard {
        position: relative;
        border-radius: 16px;
        overflow: hidden;
        margin-bottom: 14px;
        border: 1px solid rgba(245,197,66,0.28);
        background:
          radial-gradient(120% 80% at 0% 0%, rgba(245,197,66,0.16), transparent 55%),
          radial-gradient(90% 70% at 100% 100%, rgba(61,214,140,0.10), transparent 50%),
          linear-gradient(160deg, #171a24 0%, #12141d 100%);
        box-shadow: 0 12px 40px rgba(0,0,0,0.35);
        animation: fs-onboard-in .45s ease-out;
      }
      @keyframes fs-onboard-in {
        from { opacity: 0; transform: translateY(12px) scale(.985); }
        to { opacity: 1; transform: none; }
      }
      .fs-onboard-inner { padding: 18px 18px 16px; position: relative; z-index: 1; }
      .fs-onboard-kicker {
        font-size: 10px; font-weight: 800; letter-spacing: .12em;
        text-transform: uppercase; color: var(--fs-accent);
        margin-bottom: 6px;
      }
      .fs-onboard-title {
        font-size: 22px; font-weight: 800; line-height: 1.2;
        color: var(--fs-text); margin: 0 0 6px;
        font-family: Georgia, "Times New Roman", serif;
      }
      .fs-onboard-sub {
        font-size: 13px; color: var(--fs-text-dim); line-height: 1.45;
        margin-bottom: 14px; max-width: 46ch;
      }
      .fs-onboard-steps {
        display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;
      }
      .fs-onboard-step {
        display: flex; align-items: center; gap: 7px;
        padding: 6px 10px; border-radius: 999px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        font-size: 11px; font-weight: 700; color: var(--fs-text-dim);
      }
      .fs-onboard-step.on {
        color: #12141d; background: var(--fs-accent);
        border-color: var(--fs-accent);
        box-shadow: 0 0 0 1px rgba(245,197,66,0.35), 0 6px 18px rgba(245,197,66,0.25);
      }
      .fs-onboard-step.done {
        color: var(--fs-good);
        border-color: rgba(61,214,140,0.35);
        background: rgba(61,214,140,0.1);
      }
      .fs-onboard-step i {
        width: 18px; height: 18px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        font-style: normal; font-size: 10px; font-weight: 800;
        background: rgba(0,0,0,0.25);
      }
      .fs-onboard-step.on i { background: rgba(0,0,0,0.18); }
      .fs-onboard-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px; padding: 14px;
      }
      .fs-onboard-form { display: flex; gap: 8px; margin-top: 10px; }
      .fs-onboard-form .fs-input { flex: 1; }
      .fs-onboard-tip {
        margin-top: 10px; font-size: 12px; color: var(--fs-text-dim); line-height: 1.4;
      }
      .fs-onboard-tip b { color: var(--fs-text); }
      .fs-verify-box {
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px dashed rgba(245,197,66,0.35);
        background: rgba(0,0,0,0.22);
      }
      .fs-verify-lab {
        font-size: 10px; font-weight: 800; letter-spacing: .08em;
        text-transform: uppercase; color: var(--fs-accent); margin-bottom: 6px;
      }
      .fs-verify-row {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      }
      .fs-verify-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 15px; font-weight: 800; letter-spacing: .06em;
        color: #f5c542; background: rgba(245,197,66,0.12);
        padding: 6px 10px; border-radius: 8px;
      }
      .fs-onboard-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
      .fs-onboard-actions .fs-btn, .fs-onboard-actions .fs-btn-gold { flex: 1; min-width: 120px; }
      .fs-onboard-xp {
        display: inline-flex; align-items: center; gap: 6px;
        margin-top: 10px; padding: 6px 10px; border-radius: 8px;
        background: rgba(245,197,66,0.12); color: var(--fs-accent);
        font-size: 12px; font-weight: 800;
        animation: fs-onboard-pulse 1.4s ease-in-out infinite;
      }
      @keyframes fs-onboard-pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.03); opacity: .88; }
      }
      .fs-onboard-knight {
        position: absolute; right: -8px; bottom: -18px;
        width: 140px; height: 140px; opacity: .22;
        pointer-events: none;
        animation: fs-onboard-float 4.5s ease-in-out infinite;
      }
      @keyframes fs-onboard-float {
        0%, 100% { transform: translateY(0) rotate(-4deg); }
        50% { transform: translateY(-10px) rotate(2deg); }
      }
      .fs-sync-box {
        margin-top: 10px; padding: 12px; border-radius: 10px;
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.08);
      }
      .fs-sync-box.running { border-color: rgba(245,197,66,0.35); }
      .fs-sync-box.done { border-color: rgba(61,214,140,0.4); }
      .fs-sync-box.error { border-color: rgba(255,107,107,0.4); }
      .fs-sync-head {
        display: flex; justify-content: space-between; align-items: center;
        gap: 8px; margin-bottom: 8px;
      }
      .fs-sync-title { font-size: 12px; font-weight: 800; color: var(--fs-text); }
      .fs-sync-pct {
        font-size: 12px; font-weight: 800; font-variant-numeric: tabular-nums;
        color: var(--fs-accent);
      }
      .fs-sync-box.done .fs-sync-pct { color: var(--fs-good); }
      .fs-sync-box.error .fs-sync-pct { color: var(--fs-bad); }
      .fs-sync-bar {
        height: 8px; border-radius: 999px; overflow: hidden;
        background: rgba(255,255,255,0.06);
      }
      .fs-sync-bar > i {
        display: block; height: 100%; width: 0%;
        border-radius: 999px;
        background: linear-gradient(90deg, #f5c542, #3dd68c);
        transition: width .4s ease;
        position: relative;
      }
      .fs-sync-box.running .fs-sync-bar > i::after {
        content: "";
        position: absolute; inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent);
        animation: fs-sync-shine 1.2s linear infinite;
      }
      @keyframes fs-sync-shine {
        from { transform: translateX(-100%); }
        to { transform: translateX(100%); }
      }
      .fs-sync-msg {
        margin-top: 8px; font-size: 12px; color: var(--fs-text-dim); line-height: 1.4;
      }
      .fs-sync-msg strong { color: var(--fs-text); }

      .fs-quiz-outcome {
        border-radius: 12px;
        padding: 12px;
        margin: 4px 0 2px;
        border: 1px solid var(--fs-border);
        background: var(--fs-bg-elev);
        animation: fs-outcome-in .35s ease-out;
      }
      .fs-quiz-outcome.fs-ok {
        border-color: rgba(61,214,140,.45);
        background: linear-gradient(160deg, rgba(61,214,140,.14), rgba(255,255,255,.03));
        box-shadow: 0 0 0 1px rgba(61,214,140,.12) inset;
      }
      .fs-quiz-outcome.fs-err {
        border-color: rgba(255,107,107,.45);
        background: linear-gradient(160deg, rgba(255,107,107,.14), rgba(255,255,255,.03));
        box-shadow: 0 0 0 1px rgba(255,107,107,.12) inset;
      }
      .fs-quiz-outcome-kicker {
        font-size: 10px; font-weight: 800; letter-spacing: .08em;
        text-transform: uppercase; color: var(--fs-text-dim); margin-bottom: 4px;
      }
      .fs-quiz-outcome.fs-ok .fs-quiz-outcome-kicker { color: var(--fs-good); }
      .fs-quiz-outcome.fs-err .fs-quiz-outcome-kicker { color: var(--fs-bad); }
      .fs-quiz-outcome-title {
        font-size: 16px; font-weight: 800; line-height: 1.25; color: var(--fs-text);
        margin-bottom: 6px;
      }
      .fs-quiz-outcome-move {
        display: inline-flex; align-items: center; gap: 8px;
        font-family: ui-monospace, monospace;
        font-size: 18px; font-weight: 800;
        padding: 8px 12px; border-radius: 10px;
        margin: 4px 0 8px;
        letter-spacing: .02em;
      }
      .fs-quiz-outcome.fs-ok .fs-quiz-outcome-move {
        background: rgba(61,214,140,.16); color: var(--fs-good);
      }
      .fs-quiz-outcome.fs-err .fs-quiz-outcome-move {
        background: rgba(255,107,107,.14); color: #ff8e8e;
      }
      .fs-quiz-outcome-sub {
        font-size: 12px; color: var(--fs-text-dim); line-height: 1.4;
        margin-bottom: 10px;
      }
      .fs-quiz-outcome-actions { display: flex; gap: 6px; }
      .fs-quiz-outcome-actions .fs-btn { flex: 1; font-size: 12px; padding: 8px 10px; font-weight: 700; }
      @keyframes fs-outcome-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
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
      if (days > 0) daysSuffix = ` · ${days} ${T("gün")}`;
    }
    const FEATURE_LABELS = {
      tts_chars: isPrem
        ? T("Koç sesi (karakter / gün)")
        : T("Koç sesi (karakter / gün)"),
      game_analysis: T("Oyun sonrası analiz / gün"),
      coach_review: T("Sesli koç incelemesi / hafta"),
      quiz_play: T("Bulmaca oynama / gün"),
      hint: T("Bulmaca ipucu / gün"),
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

  function v3Url(name) {
    try {
      return chrome.runtime.getURL("v3/" + name);
    } catch (_) {
      return "";
    }
  }

  function coachAsset(name) {
    return v3Url("coaches/" + name);
  }

  function foxAvatarUrl() {
    try {
      return chrome.runtime.getURL("v3/coaches/tilki.png");
    } catch (_) {
      try {
        return chrome.runtime.getURL("avatars/neutral.png");
      } catch (__) {
        return coachAsset("tilki.png");
      }
    }
  }

  function isUserPremium() {
    const q = cache.quota;
    if (!q) return false;
    if (q.is_premium) return true;
    const t = String(q.tier || "").toLowerCase();
    return t === "gold" || t === "diamond" || t === "pro";
  }

  function coachRoster() {
    const fox = foxAvatarUrl();
    return [
      {
        id: "tilki",
        name: "Tilki",
        title: T("The Fox"),
        role: T("TACTICIAN"),
        rating: 87,
        theme: "green",
        piece: "♞",
        pro: false,
        portrait: coachAsset("tilki.png") || fox,
        fox: true,
        voiceId: "vy8ll8abRxLjPlGMne1B",
        desc: T("Focuses on tactics, calculation and pattern recognition."),
        voice: T("Warm & Calm"),
        lang: "TR / EN",
        hasVoice: true,
        skills: [
          { id: "tactics", lab: T("Tactics"), n: 92 },
          { id: "calculation", lab: T("Calculation"), n: 88 },
          { id: "strategy", lab: T("Strategy"), n: 70 },
          { id: "endgame", lab: T("Endgame"), n: 68 },
          { id: "motivation", lab: T("Motivation"), n: 85 },
        ],
      },
      {
        id: "victoria",
        name: "Victoria",
        title: T("The Strategist"),
        role: T("STRATEGIST"),
        rating: 82,
        theme: "gold",
        piece: "♛",
        pro: true,
        portrait: coachAsset("victoria.png"),
        voiceId: "BIvP0GN1cAtSRTxNHnWS",
        desc: T("Helps you build strong plans and outplay your opponent."),
        voice: T("Confident & Smart"),
        lang: "TR / EN",
        hasVoice: true,
        skills: [
          { id: "tactics", lab: T("Tactics"), n: 74 },
          { id: "calculation", lab: T("Calculation"), n: 78 },
          { id: "strategy", lab: T("Strategy"), n: 93 },
          { id: "endgame", lab: T("Endgame"), n: 80 },
          { id: "motivation", lab: T("Motivation"), n: 80 },
        ],
      },
      {
        id: "boris",
        name: "Boris",
        title: T("The Mentor"),
        role: T("MENTOR"),
        rating: 80,
        theme: "purple",
        piece: "♚",
        pro: true,
        portrait: coachAsset("boris.png"),
        voiceId: "EkK5I93UQWFDigLMpZcX",
        desc: T("Sharp, honest feedback to help you eliminate your weaknesses."),
        voice: T("Direct & Honest"),
        lang: "TR / EN",
        hasVoice: true,
        skills: [
          { id: "tactics", lab: T("Tactics"), n: 78 },
          { id: "calculation", lab: T("Calculation"), n: 86 },
          { id: "strategy", lab: T("Strategy"), n: 82 },
          { id: "endgame", lab: T("Endgame"), n: 80 },
          { id: "motivation", lab: T("Motivation"), n: 72 },
        ],
      },
      {
        id: "kai",
        name: "Kai",
        title: T("The Calculator"),
        role: T("CALCULATOR"),
        rating: 78,
        theme: "blue",
        piece: "♝",
        pro: true,
        portrait: coachAsset("kai.png"),
        voiceId: "7b9mYhmnp0y2qSH1FnBL",
        desc: T("Improves your calculation depth and decision quality."),
        voice: T("Analytical & Calm"),
        lang: "TR / EN",
        hasVoice: true,
        skills: [
          { id: "tactics", lab: T("Tactics"), n: 80 },
          { id: "calculation", lab: T("Calculation"), n: 92 },
          { id: "strategy", lab: T("Strategy"), n: 76 },
          { id: "endgame", lab: T("Endgame"), n: 74 },
          { id: "motivation", lab: T("Motivation"), n: 70 },
        ],
      },
      {
        id: "lena",
        name: "Lena",
        title: T("The Motivator"),
        role: T("MOTIVATOR"),
        rating: 76,
        theme: "red",
        piece: "♜",
        pro: true,
        portrait: coachAsset("lena.png"),
        voiceId: "tnSpp4vdxKPjI9w0GnoV",
        desc: T("Keeps you motivated and helps you build winning habits."),
        voice: T("Energetic & Positive"),
        lang: "TR / EN",
        hasVoice: true,
        skills: [
          { id: "tactics", lab: T("Tactics"), n: 72 },
          { id: "calculation", lab: T("Calculation"), n: 70 },
          { id: "strategy", lab: T("Strategy"), n: 74 },
          { id: "endgame", lab: T("Endgame"), n: 68 },
          { id: "motivation", lab: T("Motivation"), n: 95 },
        ],
      },
      {
        id: "sero",
        name: "Şero",
        title: T("Sokak Kedisi"),
        role: T("SOKAK KEDİSİ"),
        rating: 84,
        theme: "orange",
        piece: "♞",
        pro: true,
        portrait: coachAsset("sero.png"),
        voiceId: "IXtQSoqIQFyzo05yKkE8",
        desc: T(
          "Sokak zekâsı ve sert dürüstlük: hatalarını saklamaz, peşini bırakmaz.",
        ),
        voice: T("Sert ve sokak zekâsı"),
        lang: "TR / EN",
        hasVoice: true,
        skills: [
          { id: "tactics", lab: T("Tactics"), n: 88 },
          { id: "calculation", lab: T("Calculation"), n: 76 },
          { id: "strategy", lab: T("Strategy"), n: 72 },
          { id: "endgame", lab: T("Endgame"), n: 70 },
          { id: "motivation", lab: T("Motivation"), n: 90 },
        ],
      },
    ];
  }

  // Prewritten coach intros (TR source + EN via T / parallel map).
  const COACH_GREETINGS = {
    tilki: {
      tr: "Merhaba! Ben Tilki, senin taktik koçun. Birlikte desenleri yakalayıp hesabını keskinleştireceğiz. Hazır mısın?",
      en: "Hi! I'm Tilki, your tactics coach. Together we'll spot patterns and sharpen your calculation. Ready?",
    },
    victoria: {
      tr: "Merhaba, ben Victoria. Strateji ve plan kurma konusunda yanındayım. Rakibini geride bırakacak sağlam planlar inşa edelim.",
      en: "Hello, I'm Victoria. I'm here for strategy and planning. Let's build solid plans that outplay your opponents.",
    },
    boris: {
      tr: "Selam. Ben Boris. Zayıf noktalarını dürüstçe göstereceğim — çünkü gerçek gelişim oradan başlar.",
      en: "Hello. I'm Boris. I'll give you honest feedback on your weaknesses — that's where real improvement starts.",
    },
    kai: {
      tr: "Merhaba, ben Kai. Hesap derinliğini ve karar kaliteni yükseltmek için buradayım. Hamleyi doğru satıra kadar hesaplayalım.",
      en: "Hi, I'm Kai. I'm here to deepen your calculation and decision quality. Let's think every move through to the right line.",
    },
    lena: {
      tr: "Hey! Ben Lena. Motivasyonunu yüksek tutup kazanma alışkanlıkları kurmana yardımcı olacağım. Haydi başlayalım!",
      en: "Hey! I'm Lena. I'll keep you motivated and help you build winning habits. Let's go!",
    },
    sero: {
      tr: "Selam. Ben Şero. Yumuşak konuşmam — hatalarını net söylerim, ama düzeltene kadar peşini bırakmam. Hazır mısın?",
      en: "Hey. I'm Şero. I won't sugarcoat your mistakes — but I won't quit until you fix them. Ready?",
    },
  };

  function coachGreetingText(coachId) {
    const id = String(coachId || "tilki").toLowerCase();
    const pack = COACH_GREETINGS[id] || COACH_GREETINGS.tilki;
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
        ? "en"
        : "tr";
    return pack[lang] || pack.tr;
  }

  function speakCoachGreeting(coachId) {
    const id = String(coachId || selectedCoachId || "tilki").toLowerCase();
    const line = coachGreetingText(id);
    if (!line) return;
    speakCoach(line, { coachId: id });
  }

  function getSelectedCoach() {
    const list = coachRoster();
    return list.find((c) => c.id === selectedCoachId) || list[0];
  }

  function coachSkillSegHTML(n, themeVar) {
    const on = Math.max(0, Math.min(10, Math.round(Number(n) / 10)));
    return `<div class="fs-ccard-seg">${Array.from({ length: 10 }, (_, i) =>
      `<i class="${i < on ? "on" : ""}"></i>`,
    ).join("")}</div>`;
  }

  const COACH_SKILL_META = {
    tactics: { ico: "◎" },
    calculation: { ico: "⚙" },
    strategy: { ico: "♛" },
    endgame: { ico: "♜" },
    motivation: { ico: "❀" },
  };

  function coachSkillTier(n) {
    const v = Number(n) || 0;
    if (v >= 90) return T("Master");
    if (v >= 80) return T("Elite");
    if (v >= 70) return T("Advanced");
    if (v >= 60) return T("Solid");
    return T("Rising");
  }

  function coachMineSkillsHTML(c) {
    const skills = c.skills || [];
    const avg = skills.length
      ? Math.round(skills.reduce((sum, s) => sum + Number(s.n || 0), 0) / skills.length)
      : 0;
    const rows = skills
      .map((s) => {
        const n = Math.max(0, Math.min(100, Number(s.n) || 0));
        const meta = COACH_SKILL_META[s.id] || { ico: "◆" };
        return `<div class="fs-cmine-skill" data-skill="${esc(s.id || "")}">
          <div class="fs-cmine-skill-top">
            <span class="ico" aria-hidden="true">${meta.ico}</span>
            <span class="name">${esc(s.lab)}</span>
            <span class="tier">${esc(coachSkillTier(n))}</span>
            <span class="score">${esc(String(n))}</span>
          </div>
          <div class="fs-cmine-skill-bar" aria-hidden="true">
            <div class="fill" style="width:${n}%"></div>
            <div class="glow"></div>
          </div>
        </div>`;
      })
      .join("");
    return `<div class="fs-cmine-skills" data-theme="${esc(c.theme || "gold")}">
      <div class="fs-cmine-skills-head">
        <div class="fs-v3-kicker">${T("COACH SKILLS")}</div>
        <div class="fs-cmine-skills-avg" title="${T("Overall skill average")}">
          <span class="val">${esc(String(avg))}</span>
          <span class="lab">${T("Overall")}</span>
        </div>
      </div>
      <div class="fs-cmine-skills-grid">${rows}</div>
    </div>`;
  }

  function coachTerminationLabel(term) {
    const map = {
      checkmate: T("Mat"),
      stalemate: T("Pat"),
      insufficient: T("Yetersiz materyal"),
      repetition: T("Tekrar"),
      fifty: T("50 hamle"),
    };
    return map[term] || term || "—";
  }

  function coachPlayRowHTML(g) {
    const flip = g.player_color === "b";
    const svg = simpleBoardSvg(g.final_fen, flip);
    const resultClass =
      g.player_result === "win"
        ? "win"
        : g.player_result === "loss"
          ? "loss"
          : "draw";
    const resultLabel =
      g.player_result === "win"
        ? T("Kazandın")
        : g.player_result === "loss"
          ? T("Kaybettin")
          : T("Beraberlik");
    const movesLabel = T("{n} hamle").replace(
      "{n}",
      String(g.ply_count || 0),
    );
    return `<button type="button" class="fs-cpg-row" data-act="coach-game-analyze" data-cpg-id="${esc(g.id)}">
      <div class="fs-mini-board">${svg}</div>
      <div class="fs-cpg-meta">
        <div class="fs-cpg-top">
          <span class="fs-game-result fs-r-${resultClass}">${resultLabel}</span>
          <span class="fs-cpg-date">${esc(fmtDate(g.ts))}</span>
        </div>
        <div class="fs-cpg-sub">vs ${esc(g.coach_name || "?")} · ${esc(coachTerminationLabel(g.termination))} · ${esc(movesLabel)}</div>
      </div>
      <span class="fs-cpg-go">${T("Analiz Et →")}</span>
    </button>`;
  }

  function renderCoachRecentGames() {
    const c = getSelectedCoach();
    const all = cache.coachPlayGames;
    const loading = all === null;
    const games = loading
      ? []
      : (all || []).filter((g) => g.coach_id === (c && c.id)).slice(0, 8);
    let body = "";
    if (loading) {
      body = `<div class="fs-cmine-recent-loading">${T("Yükleniyor…")}</div>`;
    } else if (!games.length) {
      body = `<div class="fs-cmine-recent-sub" style="margin:0">${T("Henüz bu koçla oyun yok. Koçunla Oyna ile başla!")}</div>`;
    } else {
      body = games.map(coachPlayRowHTML).join("");
    }
    return `<div class="fs-cmine-recent">
      <div class="fs-cmine-recent-head">
        <div class="fs-v3-kicker">${T("Koçun ile son oyunların")}</div>
        <div class="fs-cmine-recent-sub">${T("Eğitim maçlarını buradan inceleyebilirsin.")}</div>
      </div>
      ${body}
    </div>`;
  }

  async function ensureCoachPlayGames(force) {
    if (cache.coachPlayGames !== null && !force) return;
    cache.coachPlayGames = null;
    if (activeTab === "coach" && coachSubTab === "mine") renderActive();
    try {
      if (
        window.ForkSightCoachPlay &&
        typeof window.ForkSightCoachPlay.getHistory === "function"
      ) {
        cache.coachPlayGames = await window.ForkSightCoachPlay.getHistory();
      } else {
        cache.coachPlayGames = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(["fs_coach_play_history"], (r) => {
              resolve(
                Array.isArray(r.fs_coach_play_history)
                  ? r.fs_coach_play_history
                  : [],
              );
            });
          } catch (_) {
            resolve([]);
          }
        });
      }
    } catch (_) {
      cache.coachPlayGames = [];
    }
    if (activeTab === "coach" && coachSubTab === "mine") renderActive();
  }

  async function openCoachPlayGame(gameId) {
    let game = (cache.coachPlayGames || []).find((g) => g.id === gameId);
    if (!game && window.ForkSightCoachPlay) {
      try {
        const hist = await window.ForkSightCoachPlay.getHistory();
        game = hist.find((g) => g.id === gameId);
      } catch (_) {}
    }
    if (!game) return;
    let pgn = game.pgn;
    if (
      !pgn &&
      window.ForkSightCoachPlay &&
      typeof window.ForkSightCoachPlay.buildPgn === "function"
    ) {
      pgn = window.ForkSightCoachPlay.buildPgn(game);
    }
    if (!pgn) return;
    close();
    const direct =
      window.ForkSightReview &&
      typeof window.ForkSightReview._openPgnReview === "function";
    if (direct) {
      try {
        await window.ForkSightReview._openPgnReview(pgn);
        return;
      } catch (_) {}
    }
    if (
      window.ForkSightReview &&
      typeof window.ForkSightReview.openWithPgn === "function"
    ) {
      window.ForkSightReview.openWithPgn(pgn);
    }
  }

  function cookSoonHTML() {
    return `<div class="fs-cooksoon" aria-hidden="true">
      <div class="fs-cooksoon-badge">${T("Yakında")}</div>
      <div class="fs-cooksoon-oven">
        <i class="st s1"></i><i class="st s2"></i><i class="st s3"></i><i class="st s4"></i>
        <i class="ln l1"></i><i class="ln l2"></i><i class="ln l3"></i>
        <i class="sp p1"></i><i class="sp p2"></i><i class="sp p3"></i>
      </div>
      <div class="fs-cooksoon-cap">${T("Pişiriliyor…")}</div>
    </div>`;
  }

  function coachCardHTML(c) {
    const active = selectedCoachId === c.id;
    const prem = isUserPremium();
    const soon = !!c.comingSoon;
    const locked = !soon && !!c.pro && !prem && !active;
    // Mock: Victoria shows gold Select (no lock); other PRO cards show lock.
    const featuredUnlock = locked && c.id === "victoria";
    let btn;
    if (soon) {
      btn = `<button class="fs-ccard-btn fs-soon-btn" type="button" disabled>${T("Yakında")}</button>`;
    } else if (active) {
      btn = `<button class="fs-ccard-btn" data-act="coach-active" type="button">
        <svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${T("Active Coach")}
      </button>`;
    } else if (featuredUnlock) {
      btn = `<button class="fs-ccard-btn" data-act="coach-lock" data-coach="${esc(c.id)}" type="button">${T("Select Coach")}</button>`;
    } else if (locked) {
      btn = `<button class="fs-ccard-btn fs-locked" data-act="coach-lock" data-coach="${esc(c.id)}" type="button">
        <svg viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 11V8a4 4 0 018 0v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        ${T("Select Coach")}
      </button>`;
    } else {
      btn = `<button class="fs-ccard-btn" data-act="coach-select" data-coach="${esc(c.id)}" type="button">${T("Select Coach")}</button>`;
    }
    const skills = (c.skills || [])
      .map(
        (s) => `<div class="fs-ccard-skill">
          <span>${esc(s.lab)}</span>
          ${coachSkillSegHTML(s.n)}
          <strong>${esc(String(s.n))}</strong>
        </div>`,
      )
      .join("");
    return `<article class="fs-ccard ${active ? "fs-active" : ""} ${soon ? "is-soon" : ""}" data-theme="${esc(c.theme)}" data-coach="${esc(c.id)}">
      <div class="fs-ccard-media">
        <img class="fs-ccard-bg" src="${esc(c.portrait)}" alt="${esc(c.name)}" />
        <div class="fs-ccard-scrim" aria-hidden="true"></div>
        ${active && !soon ? `<div class="fs-ccard-ribbon">${T("CURRENT")}</div>` : ""}
        ${soon ? `<div class="fs-ccard-pro" style="background:linear-gradient(135deg,#ffb35a,#ff8a3d)">${T("Yakında")}</div>` : c.pro ? `<div class="fs-ccard-pro">PRO</div>` : ""}
        <div class="fs-ccard-top">
          <div class="fs-ccard-rating">${esc(String(c.rating))}</div>
          <div class="fs-ccard-role">${esc(c.role)}</div>
        </div>
        <div class="fs-ccard-id">
          <div class="fs-ccard-name">${esc(c.name)}</div>
          <div class="fs-ccard-title"><span class="pc">${esc(c.piece || "♟")}</span>${esc(c.title)}</div>
        </div>
      </div>
      <div class="fs-ccard-glass">
        <div class="fs-ccard-desc">${esc(c.desc)}</div>
        ${soon ? cookSoonHTML() : `<div class="fs-ccard-skills">${skills}</div>
        <div class="fs-ccard-meta"><b>${T("Voice")}:</b> ${esc(c.voice)} &nbsp;|&nbsp; <b>${T("Language")}:</b> ${esc(c.lang)}</div>`}
        ${btn}
      </div>
    </article>`;
  }

  function renderCoachMine() {
    const c = getSelectedCoach();
    const weak = cache.weakness && cache.weakness.report;
    const issue =
      (weak && (weak.top_issue || weak.summary)) ||
      T("Son oyunlarında açılış sonrası plan oluşturmak en büyük fırsatın.");
    const voiceNote = c.hasVoice
      ? T("Bu koçun kendi AI sesi var. Seçince seni kendi tarzında karşılar.")
      : T("Bu koç için özel ses yakında.");
    return `<div class="fs-cmine-wrap">
      <div class="fs-cmine">
        <div class="fs-cmine-hero">
          <div class="fs-cmine-media">
            <img class="fs-cmine-bg" src="${esc(c.portrait)}" alt="${esc(c.name)}" />
            <div class="fs-cmine-scrim" aria-hidden="true"></div>
            <div class="fs-cmine-id">
              <div class="nm">${esc(c.name)}</div>
              <div class="sub">${esc(c.title)}</div>
            </div>
          </div>
          <div class="pad">
            <div class="fs-ccard-desc" style="margin:0">${esc(c.desc)}</div>
            <div class="fs-voice-note">${esc(voiceNote)}</div>
            <button class="fs-btn-gold" data-act="go-training" style="margin-top:12px;width:100%">${T("Çalışmaya Başla →")}</button>
            <button class="fs-btn-outline" data-act="coach-play" type="button" style="margin-top:8px;width:100%;border-color:rgba(76,141,255,.45);color:#c8dcff">${T("Koçunla Oyna →")}</button>
          </div>
        </div>
        <div>
          <div class="fs-v3-card" style="margin:0">
            <div class="fs-v3-kicker" style="color:#c4b5fd">${T("KOÇ DİYOR Kİ")}</div>
            <div class="fs-v3-title" style="font-size:18px">${esc(issue)}</div>
            <div class="fs-v3-sub" style="margin-top:6px">${T("Analiz değil — gelişim. Bir sonraki oyunda bunu düzeltmeye odaklan.")}</div>
          </div>
          <div class="fs-v3-card" style="margin-top:12px;padding:0;border:none;background:transparent;box-shadow:none">
            ${coachMineSkillsHTML(c)}
          </div>
        </div>
      </div>
      ${renderCoachRecentGames()}
    </div>`;
  }

  function renderCoachTab() {
    const nav = `<div class="fs-cpick-nav">
      <button type="button" class="${coachSubTab === "all" ? "fs-on" : ""}" data-act="coach-tab" data-tab="all">${T("ALL COACHES")}</button>
      <button type="button" class="${coachSubTab === "mine" ? "fs-on" : ""}" data-act="coach-tab" data-tab="mine">${T("MY COACH")}</button>
    </div>`;
    const info = `<div class="fs-cpick-info">
      <span class="fs-chip">◎</span>
      <span>${T("AI Coaches analyze your games, adapt to your style, and help you grow.")}</span>
    </div>`;
    const head = `<div class="fs-cpick-head">${nav}${info}</div>`;

    if (coachSubTab === "mine") {
      return `<div class="fs-cpick">${head}${renderCoachMine()}</div>`;
    }

    const cards = coachRoster().map(coachCardHTML).join("");
    const tilki = coachRoster()[0];
    const bottom = `<div class="fs-cpick-bottom">
      <div class="fs-cpick-box">
        <div class="fs-k">${T("FREE COACHES")}</div>
        <div class="fs-free-coach">
          <img src="${esc(tilki.portrait)}" alt="Tilki" />
          <div>
            <div class="nm">Tilki</div>
            <div class="sub">${esc(tilki.title)}</div>
            <div class="desc">${T("Your starting coach. Perfect for building habits.")}</div>
            <button class="fs-mini-btn" data-act="coach-select" data-coach="tilki" type="button">${T("Select")}</button>
          </div>
        </div>
      </div>
      <div class="fs-cpick-box">
        <div class="fs-k">${T("COMPARE COACHES")}</div>
        <div class="fs-compare-art">
          <div class="pc g">♟</div>
          <div class="vs">VS</div>
          <div class="pc r">♜</div>
        </div>
        <button class="fs-btn-outline" data-act="coach-compare" type="button" style="width:100%">${T("Compare")}</button>
      </div>
      <div class="fs-cpick-box">
        <div class="fs-k">${T("COACH SKILLS EXPLAINED")}</div>
        <div class="fs-skills-leg">
          <div class="row"><div class="ico">◎</div><b>${T("Tactics")}</b><span>${T("Spot patterns and tactical opportunities.")}</span></div>
          <div class="row"><div class="ico">⚙</div><b>${T("Calculation")}</b><span>${T("Calculate variations and best moves.")}</span></div>
          <div class="row"><div class="ico">♛</div><b>${T("Strategy")}</b><span>${T("Build plans and positional understanding.")}</span></div>
          <div class="row"><div class="ico">♜</div><b>${T("Endgame")}</b><span>${T("Convert advantages and endgames.")}</span></div>
          <div class="row"><div class="ico">❀</div><b>${T("Motivation")}</b><span>${T("Stay focused and improve consistently.")}</span></div>
        </div>
      </div>
      <div class="fs-cpick-box fs-cpick-knight">
        <img src="${esc(coachAsset("knight-decor.png"))}" alt="" />
      </div>
    </div>`;

    return `<div class="fs-cpick">${head}
      <div class="fs-cpick-scroll">
        <button type="button" class="fs-cpick-arrow prev" data-act="coach-scroll" data-dir="-1" aria-label="${T("Previous")}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="fs-cpick-grid">${cards}</div>
        <button type="button" class="fs-cpick-arrow next" data-act="coach-scroll" data-dir="1" aria-label="${T("Next")}">
          <svg viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      ${bottom}</div>`;
  }

  function greetingLine(user) {
    const name = (user && (user.username || user.chess_com_username)) || "player";
    const h = new Date().getHours();
    const hello =
      h < 12 ? T("Günaydın") : h < 18 ? T("İyi günler") : T("İyi akşamlar");
    return {
      title: `${hello}, ${name}! 👋`,
      sub: T("Bugün satrançta ne geliştireceğiz?"),
    };
  }

  function skillHeuristic(stats, user) {
    const total = Math.max(1, Number(stats && stats.total_games) || 1);
    const wins = Number(stats && stats.wins) || 0;
    const streak = Number(user && user.streak_count) || 0;
    const rating = Number(user && user.highest_rating) || 1200;
    const winRate = Math.round((wins / total) * 100);
    const tactics = Math.min(95, 55 + Math.round(winRate * 0.25) + Math.min(15, streak));
    const opening = Math.min(92, 48 + Math.round((rating - 800) / 40));
    const calculation = Math.min(94, 50 + Math.round(winRate * 0.3));
    const endgame = Math.min(90, 42 + Math.round((rating - 900) / 45));
    const consistency = Math.min(96, 50 + streak * 4 + Math.round(winRate * 0.15));
    return [
      { id: "tactics", label: T("Taktik"), score: tactics, color: "var(--fs-tactics)", tone: skillTone(tactics) },
      { id: "opening", label: T("Açılış"), score: opening, color: "var(--fs-opening)", tone: skillTone(opening) },
      { id: "calculation", label: T("Hesap"), score: calculation, color: "var(--fs-calc)", tone: skillTone(calculation) },
      { id: "endgame", label: T("Oyunsonu"), score: endgame, color: "var(--fs-endgame)", tone: skillTone(endgame) },
      { id: "consistency", label: T("İstikrar"), score: consistency, color: "var(--fs-consist)", tone: skillTone(consistency) },
    ];
  }

  function skillTone(score) {
    if (score >= 80) return T("Güçlü");
    if (score >= 70) return T("İyi");
    if (score >= 60) return T("Gelişiyor");
    return T("İyileşiyor");
  }

  function renderSkillRows(skills) {
    return skills
      .map(
        (s) => `
      <div class="fs-skill-row">
        <span>${esc(s.label)}</span>
        <div class="fs-skill-bar"><i style="width:${s.score}%;background:${s.color}"></i></div>
        <strong>${s.score}</strong>
      </div>`,
      )
      .join("");
  }

  function skillIcon(id) {
    const map = {
      tactics: "ico-tactics.svg",
      opening: "ico-opening.svg",
      calculation: "ico-calculation.svg",
      endgame: "ico-endgame.svg",
      consistency: "ico-consistency.svg",
      middlegame: "ico-consistency.svg",
    };
    const file = map[id];
    if (file) {
      return `<img src="${esc(v3Url(file))}" alt="" />`;
    }
    return "♟️";
  }

  function renderSkillIcons(skills) {
    return `<div class="fs-skill-icons">${skills
      .map(
        (s) => `
      <div class="fs-skill-ico" style="color:${s.color}">
        <div class="fs-si" style="color:${s.color}">${skillIcon(s.id)}</div>
        <div class="fs-si-lab">${esc(s.label)}</div>
        <div class="fs-si-bar"><i style="width:${s.score}%;background:${s.color}"></i></div>
        <div class="fs-si-score" style="color:${s.color}">${s.score}</div>
        <span class="fs-si-tone" style="color:${s.color}">${esc(s.tone)}</span>
      </div>`,
      )
      .join("")}</div>`;
  }

  function avatarHTML(url, letter, me) {
    const cls = "fs-recent-av" + (me ? " me" : "") + (url ? "" : " placeholder");
    if (url) {
      return `<img class="${cls}" src="${esc(url)}" alt="" />`;
    }
    return `<div class="${cls}">${esc((letter || "?").slice(0, 1).toUpperCase())}</div>`;
  }

  function coachSparkHTML() {
    const heights = [34, 48, 42, 68, 90];
    return `<div class="fs-coach-spark">${heights
      .map((h) => `<i style="height:${h}%"></i>`)
      .join("")}</div>`;
  }

  function revisitRowsHTML(games) {
    const tags = [
      { lab: T("Kaçırılan çatal"), cls: "fs-tag-bad" },
      { lab: T("Gaf"), cls: "fs-tag-warn" },
      { lab: T("Açıkta taş"), cls: "fs-tag-bad" },
      { lab: T("Kaçırılan taktik"), cls: "fs-tag-warn" },
    ];
    const diffs = [T("Orta"), T("Zor"), T("Orta"), T("Kolay")];
    const list = (games || []).slice(0, 4);
    if (!list.length) {
      return `<div class="fs-v3-sub" style="margin-top:8px">${T("Kendi oyunlarından kaçırılan fırsatlar burada toplanır.")}</div>
        <button class="fs-btn-outline" data-act="go-games" style="margin-top:12px">${T("İncele")}</button>`;
    }
    return list
      .map((g, i) => {
        const moveN = Math.max(
          8,
          Math.min(
            42,
            Math.floor(Number(g.ply_count || g.move_count || 0) / 2) || 12 + i * 5,
          ),
        );
        const tag = tags[i % tags.length];
        return `<div class="fs-revisit-row">
          ${miniBoardHTML(g)}
          <div class="fs-revisit-meta">
            <strong>${T("Hamle")} ${moveN} <span class="fs-tag ${tag.cls}">${esc(tag.lab)}</span></strong>
            <span>${esc(diffs[i % diffs.length])} · ${esc(g.time_class || "blitz")}</span>
          </div>
          <button class="fs-btn-sm" data-game-id="${g.id}" type="button">${T("İncele")}</button>
        </div>`;
      })
      .join("");
  }

  function recommendedRowsHTML(startDisabled) {
    const rows = [
      { ico: "♞", cls: "tactics", title: T("At çatalları"), sub: T("Materyal kazandıran çifte saldırılar"), btn: "green" },
      { ico: "♜", cls: "opening", title: T("Son sıra taktikleri"), sub: T("Rok yapmamış şahı cezalandır"), btn: "blue" },
      { ico: "♟", cls: "calc", title: T("Sessiz hesap"), sub: T("Zorlayıcı varyantı bul"), btn: "purple" },
      { ico: "🔍", cls: "end", title: T("Oyunsonu temelleri"), sub: T("Şah aktivitesi ve muhalefet"), btn: "gold" },
    ];
    return rows
      .map(
        (r) => `<div class="fs-reco-row">
        <div class="fs-reco-ico ${r.cls}">${r.ico}</div>
        <div class="fs-revisit-meta">
          <strong>${esc(r.title)}</strong>
          <span>${esc(r.sub)}</span>
        </div>
        <button class="fs-btn-sm ${r.btn}" data-quiz-act="start" ${startDisabled}>${T("Başla")}</button>
      </div>`,
      )
      .join("");
  }

  function resultBadge(result) {
    const r = String(result || "").toLowerCase();
    if (r.includes("win") || r === "1" || r === "1-0" || r === "0-1") {
      return `<span class="fs-recent-badge"><i class="fs-rb-ico">★</i>${T("Zafer")}</span>`;
    }
    if (r.includes("loss") || r.includes("defeat")) {
      return `<span class="fs-recent-badge loss"><i class="fs-rb-ico">✕</i>${T("Kayıp")}</span>`;
    }
    return `<span class="fs-recent-badge draw"><i class="fs-rb-ico">＝</i>${T("Berabere")}</span>`;
  }

  function gameUserRating(g) {
    if (!g) return null;
    const raw = isUserBlack(g.user_color)
      ? g.black_rating
      : isUserWhite(g.user_color)
        ? g.white_rating
        : null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function needsOnboarding(user) {
    if (!user) return false;
    if (cache.onboard.dismissed) return false;
    const ccu = (user.chess_com_username || "").trim();
    if (!ccu) return true;
    const games =
      Number(
        (cache.profile &&
          cache.profile.stats &&
          cache.profile.stats.total_games) ||
          0,
      ) || ((cache.profile && cache.profile.recent_games) || []).length;
    if (games === 0 && cache.onboard.step < 3) return true;
    return false;
  }

  function renderSyncProgressBox(opts) {
    const o = opts || {};
    const s = cache.sync || {};
    const active = !!s.active || o.forceShow;
    if (!active && !o.always) return "";
    const pct = Math.max(0, Math.min(100, Math.round(Number(s.progress) || 0)));
    const stateCls = s.error
      ? "error"
      : pct >= 100 && !s.active
        ? "done"
        : s.active
          ? "running"
          : "";
    const title = s.error
      ? T("Senkronizasyon hatası")
      : pct >= 100 && !s.active
        ? T("Oyunlar hazır")
        : T("Oyunlar çekiliyor");
    const msg =
      s.message ||
      (s.active
        ? T("Chess.com hesabından oyunların aktarılıyor…")
        : T("Hazır."));
    const gamesLine =
      s.gamesTotal > 0
        ? T("{n} oyun veritabanında.").replace("{n}", String(s.gamesTotal))
        : s.inserted > 0
          ? T("{n} yeni oyun eklendi.").replace("{n}", String(s.inserted))
          : "";
    return `
      <div class="fs-sync-box ${stateCls}" data-sync-box>
        <div class="fs-sync-head">
          <div class="fs-sync-title">${esc(title)}</div>
          <div class="fs-sync-pct">${pct}%</div>
        </div>
        <div class="fs-sync-bar"><i style="width:${pct}%"></i></div>
        <div class="fs-sync-msg">${esc(msg)}${gamesLine ? ` <strong>${esc(gamesLine)}</strong>` : ""}</div>
      </div>`;
  }

  function updateSyncProgressDom() {
    if (!panelEl) return;
    const boxes = panelEl.querySelectorAll("[data-sync-box]");
    if (!boxes.length) {
      const host = panelEl.querySelector("[data-sync-live]");
      if (host)
        host.innerHTML = renderSyncProgressBox({ forceShow: true, always: true });
      return;
    }
    boxes.forEach((el) => {
      const wrap = document.createElement("div");
      wrap.innerHTML = renderSyncProgressBox({ forceShow: true, always: true });
      const next = wrap.firstElementChild;
      if (next) el.replaceWith(next);
    });
  }

  function stopSyncPoll() {
    if (cache.sync.pollId) {
      try {
        clearInterval(cache.sync.pollId);
      } catch (_) {}
      cache.sync.pollId = null;
    }
  }

  async function pollSyncStatusOnce() {
    try {
      const r = await send("chess_com_sync_status");
      if (!r || !r.ok) return null;
      const job = r.job || null;
      if (job) {
        cache.sync.progress = Number(job.progress) || 0;
        cache.sync.phase = job.phase || "";
        cache.sync.message = job.message || "";
        cache.sync.gamesTotal = Number(
          job.games_total != null ? job.games_total : r.games_total,
        ) || 0;
        cache.sync.inserted = Number(job.inserted) || 0;
        cache.sync.error = job.error || null;
        cache.sync.active = job.status === "queued" || job.status === "running";
        if (job.status === "done" || job.status === "error") {
          cache.sync.active = false;
          if (job.status === "done") cache.sync.progress = 100;
        }
      } else {
        cache.sync.gamesTotal = Number(r.games_total) || 0;
      }
      updateSyncProgressDom();
      return r;
    } catch (_) {
      return null;
    }
  }

  function startSyncPoll(opts) {
    const o = opts || {};
    stopSyncPoll();
    cache.sync.active = true;
    cache.sync.error = null;
    cache.sync.progress = Math.max(cache.sync.progress || 0, 4);
    cache.sync.message = o.message || T("Senkronizasyon başlatıldı…");
    updateSyncProgressDom();
    let stable = 0;
    let lastTotal = -1;
    const started = Date.now();
    const tick = async () => {
      const r = await pollSyncStatusOnce();
      const job = r && r.job;
      const done =
        (job && (job.status === "done" || job.status === "error")) ||
        (!job && Date.now() - started > 8000 && r && r.games_total > 0);
      const total = (r && r.games_total) || 0;
      if (total === lastTotal && total > 0) stable += 1;
      else stable = 0;
      lastTotal = total;
      if (done || stable >= 2 || Date.now() - started > 120000) {
        stopSyncPoll();
        cache.sync.active = false;
        if (!cache.sync.error) {
          cache.sync.progress = 100;
          cache.sync.message =
            total > 0
              ? T(
                  "Tamam! Oyunların çekildi. Oyunlarım sekmesinden inceleyebilirsin.",
                )
              : T(
                  "Senkron bitti. Henüz oyun bulunamadı — chess.com kullanıcı adını kontrol et.",
                );
        }
        updateSyncProgressDom();
        try {
          cache.profile = null;
          cache.games.items = [];
          await ensureProfile(true);
        } catch (_) {}
        if (typeof o.onDone === "function") {
          try {
            o.onDone(r);
          } catch (_) {}
        }
      }
    };
    tick();
    cache.sync.pollId = setInterval(tick, 1500);
  }

  function renderOnboarding(user) {
    const step = Number(cache.onboard.step) || 0;
    const name = (user && user.username) || T("Oyuncu");
    const knight =
      v3Url("logo-knight-gold-cut.png") || v3Url("logo-knight-gold.png");
    const stepsMeta = [
      { id: 0, lab: T("Başla") },
      { id: 1, lab: T("Hesap bağla") },
      { id: 2, lab: T("Oyunları çek") },
      { id: 3, lab: T("Hazırsın") },
    ];
    const stepsHtml = stepsMeta
      .map((s) => {
        const cls = step > s.id ? "done" : step === s.id ? "on" : "";
        const mark = step > s.id ? "✓" : String(s.id + 1);
        return `<div class="fs-onboard-step ${cls}"><i>${mark}</i>${esc(s.lab)}</div>`;
      })
      .join("");

    let body = "";
    if (step === 0) {
      body = `
        <div class="fs-onboard-card">
          <div class="fs-onboard-sub" style="margin:0">
            ${T("ForkSight, chess.com oyunlarından koçluk ve bulmaca üretir. İlk görev: hesabını bağla — yaklaşık 30 saniye.")}
          </div>
          <div class="fs-onboard-xp">★ +50 ${T("XP görev ödülü")}</div>
          <div class="fs-onboard-actions">
            <button class="fs-btn-gold" data-act="onboard-next">${T("Göreve Başla")}</button>
            <button class="fs-btn fs-ghost" data-act="onboard-skip">${T("Sonra")}</button>
          </div>
        </div>`;
    } else if (step === 1) {
      body = `
        <div class="fs-onboard-card">
          <div class="fs-onboard-sub" style="margin:0 0 4px">
            ${T("Önce doğrulama kodunu Chess.com profiline ekle, sonra kullanıcı adını yaz. Böylece sadece kendi hesabını bağlayabilirsin.")}
          </div>
          ${renderVerifyCodeBox()}
          <div class="fs-onboard-form" style="margin-top:12px">
            <input type="text" class="fs-input" data-onboard-ccu placeholder="${T("chess.com kullanıcı adı")}" />
            <button class="fs-btn-gold" data-act="onboard-link" ${cache.onboard.linking ? "disabled" : ""}>${T("Bağla")}</button>
          </div>
          <div class="fs-msg" data-msg="onboard-ccu"></div>
          <div class="fs-onboard-tip">
            ${T("İpucu: Kodu ekledikten sonra Chess.com’da Kaydet’e basmayı unutma. Bağlantı sonrası kodu profilinden silebilirsin.")}
          </div>
        </div>`;
    } else if (step === 2) {
      // Sync henüz başlamadıysa otomatik tetikle (bağlı hesap + 0 oyun)
      if (!cache.sync.active && !cache.sync.pollId && (user.chess_com_username || "").trim()) {
        setTimeout(() => {
          if (cache.onboard.step !== 2) return;
          send("chess_com_sync", { force: false })
            .then((resp) => {
              if (resp && resp.ok) {
                startSyncPoll({
                  message: T("Oyunlar çekiliyor…"),
                  onDone: () => {
                    cache.onboard.step = 3;
                    try {
                      chrome.storage.local.set({ fs_onboard_done: 1 });
                    } catch (_) {}
                    if (activeTab === "home") renderActive();
                  },
                });
              }
            })
            .catch(() => {});
        }, 80);
      }
      body = `
        <div class="fs-onboard-card">
          <div class="fs-onboard-sub" style="margin:0 0 8px">
            ${T("Oyunlar arka planda çekiliyor. Bitene kadar bekle — sayfayı yenilemen gerekmez.")}
          </div>
          <div data-sync-live>${renderSyncProgressBox({ forceShow: true, always: true })}</div>
          <div class="fs-onboard-tip">
            ${T("Bittikten sonra oyunlarını")} <b>${T("Oyunlarım")}</b> ${T("sekmesinde, antrenmanı")} <b>${T("Antrenman")}</b> ${T("sekmesinde bulursun.")}
          </div>
        </div>`;
    } else {
      body = `
        <div class="fs-onboard-card">
          <div class="fs-onboard-sub" style="margin:0">
            ${T("Harika! Hesabın bağlı ve oyunların hazır. Şimdi bir bulmaca çöz veya son oyunu incele.")}
          </div>
          <div class="fs-onboard-xp">★ ${T("Görev tamamlandı")}</div>
          <div class="fs-onboard-actions">
            <button class="fs-btn-gold" data-act="go-training">${T("Antrenmana Git")}</button>
            <button class="fs-btn" data-act="go-games">${T("Oyunlarım")}</button>
            <button class="fs-btn fs-ghost" data-act="onboard-finish">${T("Ana sayfaya dön")}</button>
          </div>
        </div>`;
    }

    return `
      <div class="fs-onboard" data-onboard>
        ${knight ? `<img class="fs-onboard-knight" src="${esc(knight)}" alt="" />` : ""}
        <div class="fs-onboard-inner">
          <div class="fs-onboard-kicker">${T("İlk Görev")} · ${esc(name)}</div>
          <h2 class="fs-onboard-title">${
            step === 0
              ? T("Satranç yolculuğuna hoş geldin")
              : step === 1
                ? T("Chess.com hesabını bağla")
                : step === 2
                  ? T("Oyunların geliyor…")
                  : T("Koç hazır — sen de!")
          }</h2>
          <div class="fs-onboard-steps">${stepsHtml}</div>
          ${body}
        </div>
      </div>`;
  }

  function resolveRatingChange(game, siblings) {
    if (!game) return null;
    const direct =
      game.rating_change ??
      game.rating_diff ??
      game.user_rating_change ??
      game.ratingDelta;
    if (direct != null && direct !== "") {
      const n = Number(direct);
      if (Number.isFinite(n) && Math.abs(n) <= 400) return n;
    }
    const list = Array.isArray(siblings) ? siblings : [];
    const tc = game.time_class;
    const mine = gameUserRating(game);
    const end = Number(game.end_time) || 0;
    if (mine == null || !tc) return null;
    let best = null;
    for (const older of list) {
      if (!older || older.id === game.id) continue;
      if (older.time_class !== tc) continue;
      const oEnd = Number(older.end_time) || 0;
      if (oEnd >= end) continue;
      const oRating = gameUserRating(older);
      if (oRating == null) continue;
      if (!best || oEnd > best.end) best = { end: oEnd, rating: oRating };
    }
    if (!best) return null;
    const delta = mine - best.rating;
    return Math.abs(delta) <= 400 ? delta : null;
  }

  function renderHomeTab() {
    const p = cache.profile;
    if (!p) return renderLoading();
    if (!p.user) {
      return `<div class="fs-empty">${T("Profil bilgisi alınamadı.")}</div>`;
    }
    const u = p.user;
    const stats = p.stats || {};
    const recent = (p.recent_games || [])[0];
    const skills = skillHeuristic(stats, u);
    const weak = cache.weakness && cache.weakness.report;
    const coachHeadline = T("Koçun bir şey fark etti.");
    const coachDetail =
      weak && weak.top_issue
        ? String(weak.top_issue)
        : T('Bu hafta taktik doğruluğun <span class="fs-coach-hl">%8</span> arttı.');
    const puzzleDone = Math.min(
      5,
      Number(
        (cache.puzzles.stats &&
          (cache.puzzles.stats.solved_today ||
            cache.puzzles.stats.today_solved)) ||
          0,
      ),
    );
    const missionDone = Math.min(5, Math.max(1, puzzleDone || 1));
    const missionTotal = 5;
    const segs = Array.from({ length: missionTotal })
      .map((_, i) => `<i class="${i < missionDone ? "on" : ""}"></i>`)
      .join("");
    const heroUrl = v3Url("hero-training-target.png");
    const coachAv =
      (getSelectedCoach() && getSelectedCoach().portrait) ||
      foxAvatarUrl() ||
      v3Url("coach-portrait-cut.png") ||
      v3Url("coach-sheet-nobg.png");
    const parts = recent ? gameParticipants(recent, u) : null;
    const meName = parts ? parts.meName : u.chess_com_username || u.username || "Sen";
    const meAv = parts ? parts.meAv : u.chess_com_avatar || "";
    const oppName = parts ? parts.oppName : "?";
    const oppAv = parts ? parts.oppAv : "";
    const meRating = parts ? parts.meRating : u.highest_rating;
    const oppRating = parts ? parts.oppRating : "";
    const rc = resolveRatingChange(recent, p.recent_games || []);
    const rcCls = rc == null ? "" : rc >= 0 ? "up" : "dn";
    const rcVal = rc == null ? "—" : `${rc >= 0 ? "+" : ""}${rc}`;
    const ply = recent ? Number(recent.ply_count || 0) : 0;
    const movesField = recent
      ? Number(recent.move_count || recent.moves || recent.n_moves || 0)
      : 0;
    let movesVal = "—";
    if (movesField > 0 && movesField <= 120) {
      movesVal = String(Math.round(movesField));
    } else if (ply > 0) {
      movesVal = String(Math.max(1, Math.round(ply / 2)));
    }
    const timeLabel = recent
      ? `${esc(recent.time_control || "")} ${esc(recent.time_class || "")}`.trim()
      : "";
    const reviewIco = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;

    const onboardHtml = needsOnboarding(u) ? renderOnboarding(u) : "";
    // Hesap bağlı değilse ana paneli sade tut — görev kartı önde
    if (onboardHtml && !(u.chess_com_username || "").trim() && cache.onboard.step < 3) {
      return `${onboardHtml}
        <div class="fs-v3-card" style="margin-top:4px">
          <div class="fs-v3-kicker">${T("Nasıl çalışır?")}</div>
          <div class="fs-v3-sub" style="color:var(--fs-text);margin-top:6px">
            1. ${T("Chess.com kullanıcı adını bağla")}<br/>
            2. ${T("Son oyunların otomatik çekilir (yenilemeye gerek yok)")}<br/>
            3. ${T("Oyunlarım’da incele, Antrenman’da bulmaca çöz")}
          </div>
        </div>`;
    }

    return `
      ${onboardHtml}
      <div class="fs-home-stats">
        <div class="fs-hs">
          <div class="fs-hs-ico level" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 4.2 4.8.8-3.4 3.5.8 4.8L12 13.8 7.4 15.3l.8-4.8L4.8 7l4.8-.8L12 2z" fill="#f5c542"/><path d="M6 20h12v1.5H6V20zm1.2-2.2h9.6c.4-2.1-1.2-3.8-4.8-3.8s-5.2 1.7-4.8 3.8z" fill="#f5c542" opacity=".92"/></svg>
          </div>
          <div class="fs-hs-txt">
            <div class="fs-hs-lab">${T("Seviye")}</div>
            <div class="fs-hs-val">${Math.max(1, Math.floor((Number(u.highest_rating) || 1000) / 80))}</div>
          </div>
        </div>
        <span class="fs-stat-sep"></span>
        <div class="fs-hs">
          <div class="fs-hs-ico rating" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 3c1.2 0 2.1.9 2.1 2.1V7h1.4c.7 0 1.2.6 1.2 1.2v1.3h-8.4V8.2c0-.7.5-1.2 1.2-1.2h1.4V5.1C9.9 3.9 10.8 3 12 3z" fill="#d7dbe6"/><path d="M7.8 9.8h8.4v2.2c0 2.6-1.7 4.4-4.2 4.4s-4.2-1.8-4.2-4.4V9.8z" fill="#c5cad3"/><path d="M9.2 17.2h5.6L16 21H8l1.2-3.8z" fill="#b8bec9"/></svg>
          </div>
          <div class="fs-hs-txt">
            <div class="fs-hs-lab">${T("Reyting")}</div>
            <div class="fs-hs-val">${esc(u.highest_rating || "—")}</div>
          </div>
        </div>
        <span class="fs-stat-sep"></span>
        <div class="fs-hs">
          <div class="fs-hs-ico streak" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M13.2 2.4c.2 2.8-1.1 4.4-2.6 6.1-1.4 1.5-2.8 3.1-2.5 5.4.3 2.4 2.4 4.1 4.9 4.1 2.7 0 4.8-2 4.8-4.8 0-2.6-1.4-4.1-2.8-5.8-.8-1-1.6-2.1-1.8-4.9z" fill="#ff8a3d"/><path d="M12 11.2c.9 1.2 1.4 2.2 1.4 3.4 0 1.5-1.1 2.6-2.5 2.6-1.5 0-2.6-1.3-2.4-2.9.2-1.3.9-2.1 1.8-3.1.3-.3.8-.8 1.7-2z" fill="#ffd08a"/></svg>
          </div>
          <div class="fs-hs-txt">
            <div class="fs-hs-lab">${T("Seri")}</div>
            <div class="fs-hs-val">${esc(u.streak_count || 0)} ${T("gün")}</div>
          </div>
        </div>
        <span class="fs-stat-sep"></span>
        <div class="fs-hs fs-xp-block">
          <div class="fs-xp-top"><span>${T("XP İlerlemesi")}</span><strong>${Math.min(1199, (Number(u.streak_count) || 0) * 80 + 400)} / 1200 XP</strong></div>
          <span class="fs-skill-bar"><i style="width:${Math.min(100, Math.round(((Number(u.streak_count) || 0) * 80 + 400) / 1200 * 100))}%"></i></span>
        </div>
      </div>
      <div class="fs-home-stack">
        <div class="fs-v3-card fs-hero-train" style="--fs-hero-url:url('${esc(heroUrl)}')">
          <div class="fs-v3-kicker" style="color:var(--fs-tactics)">${T("BUGÜNKÜ ANTRENMAN")}</div>
          <div class="fs-v3-title">${T("Taktik Görüş")}</div>
          <div class="fs-v3-sub">${T("Odak: taktik farkındalığını güçlendir")}</div>
          <div class="fs-v3-sub" style="margin-top:10px"><span class="fs-mission-pct">${missionDone}</span><span class="fs-mission-pct-rest"> / ${missionTotal} ${T("tamamlandı")}</span></div>
          <div class="fs-seg-bar">${segs}</div>
          <button class="fs-btn-gold" data-act="go-training"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>${T("Antrenmana Devam")}</button>
        </div>
        <div class="fs-v3-card fs-v3-coach-card">
          <div class="fs-coach-av-wrap">
            <img class="fs-v3-coach-av" src="${esc(coachAv)}" alt="" />
            <div class="fs-coach-quote">“</div>
          </div>
          <div class="fs-v3-coach-body">
            <div class="fs-v3-kicker" style="color:#c4b5fd">${T("KOÇ ÖNERİSİ")}</div>
            <div class="fs-v3-title">${esc(coachHeadline)}</div>
            <div class="fs-v3-sub">${coachDetail.includes("<span") ? coachDetail : esc(coachDetail)}</div>
            <button class="fs-btn-outline" data-act="go-coach" style="margin-top:12px;border-color:rgba(196,181,253,0.45);color:#e9e5ff">${T("Öneriyi gör →")}</button>
          </div>
          <div class="fs-v3-coach-side">
            <div class="fs-coach-side-top">
              <div class="fs-coach-delta">↑</div>
              <div class="fs-coach-pct">+8%</div>
            </div>
            ${coachSparkHTML()}
          </div>
        </div>
      </div>
      <div style="margin-top:14px">
        <div class="fs-section-head">
          <div class="fs-v3-kicker">${T("SON OYUN")}</div>
          <i class="fs-sec-line" aria-hidden="true"></i>
          <button class="fs-link-gold" data-act="go-games">${T("Tüm oyunlar →")}</button>
        </div>
        ${
          recent
            ? `<div class="fs-v3-card fs-recent-wrap">
                <div class="fs-recent-card">
                  <div class="fs-recent-outcome">
                    ${resultBadge(recent.result)}
                    <div class="fs-recent-tc">${timeLabel || esc(recent.time_class || "")}</div>
                  </div>
                  <div class="fs-recent-players">
                    <div class="fs-recent-player">
                      ${avatarHTML(meAv, meName, true)}
                      <div class="fs-rp-meta">
                        <div class="fs-rp-name">${esc(meName)}</div>
                        <div class="fs-rp-rating">${esc(meRating || "—")}</div>
                      </div>
                    </div>
                    <span class="fs-recent-vs">vs</span>
                    <div class="fs-recent-player">
                      <div class="fs-rp-meta" style="text-align:right">
                        <div class="fs-rp-name">${esc(oppName)}</div>
                        <div class="fs-rp-rating">${esc(oppRating || "—")}</div>
                      </div>
                      ${avatarHTML(oppAv, oppName, false)}
                    </div>
                  </div>
                  <div class="fs-recent-board-wrap">${miniBoardHTML(recent)}</div>
                  <button class="fs-btn-review" data-act="go-games" type="button">${reviewIco}${T("Oyunu İncele")}</button>
                  <div class="fs-recent-metrics">
                    <div class="fs-recent-metric ${rc != null ? "fs-rm-rating" : ""} ${rcCls === "dn" ? "is-dn" : ""}">
                      <div class="fs-rm-val ${rcCls}">${esc(rcVal)}</div>
                      <div class="fs-rm-lab">${T("Reyting Değişimi")}</div>
                    </div>
                    <div class="fs-recent-metric fs-rm-moves">
                      <div class="fs-rm-val">${esc(movesVal)}</div>
                      <div class="fs-rm-lab">${T("Hamleler")}</div>
                    </div>
                  </div>
                </div>
              </div>`
            : `<div class="fs-v3-card"><div class="fs-empty" style="padding:12px">${T("Henüz oyun çekilmedi.")}</div></div>`
        }
      </div>
      <div style="margin-top:14px">
        <div class="fs-section-head">
          <div class="fs-v3-kicker">${T("GELİŞİMİN")}</div>
          <i class="fs-sec-line" aria-hidden="true"></i>
          <button class="fs-link-gold" data-act="go-progress">${T("Detaylı gelişim →")}</button>
        </div>
        <div class="fs-v3-card">${renderSkillIcons(skills)}</div>
      </div>
      <div class="fs-quote-banner">
        <img src="${esc(v3Url("quote-cinematic-pieces.png"))}" alt="" />
        <div class="fs-quote-txt">“${T("Küçük iyileştirmeler <em>güçlü oyuncular</em> yaratır.")}”<span class="fs-quote-sig">— ForkSight</span></div>
      </div>
    `;
  }

  function renderProgressTab() {
    const p = cache.profile;
    if (!p) return renderLoading();
    if (!p.user) return `<div class="fs-empty">${T("Profil bilgisi alınamadı.")}</div>`;
    const skills = skillHeuristic(p.stats || {}, p.user);
    const best = skills.slice().sort((a, b) => b.score - a.score)[0];
    return `
      <div class="fs-v3-card">
        <div class="fs-v3-kicker">${T("BECERİ HARİTASI")}</div>
        <div class="fs-v3-title">${esc(best.label)} ${esc(best.tone)}</div>
        <div class="fs-v3-sub">${T("Rakamlarla boğulma — odaklanman gereken alanlar burada.")}</div>
        ${renderSkillIcons(skills)}
      </div>
      <div class="fs-v3-card" style="margin-top:12px">
        <div class="fs-v3-kicker">${T("GENEL BAKIŞ")}</div>
        <div class="fs-stat-row">
          <div class="fs-stat"><div class="fs-stat-val">${esc(p.user.highest_rating || "—")}</div><div class="fs-stat-lab">${T("Reyting")}</div></div>
          <div class="fs-stat"><div class="fs-stat-val">🔥 ${esc(p.user.streak_count || 0)}</div><div class="fs-stat-lab">${T("Seri")}</div></div>
          <div class="fs-stat"><div class="fs-stat-val">${esc((p.stats && p.stats.total_games) || 0)}</div><div class="fs-stat-lab">${T("Oyun")}</div></div>
        </div>
      </div>
    `;
  }

  function leagueFromRating(rating) {
    const r = Number(rating) || 0;
    const leagues = [
      { id: "bronze", label: T("Bronz"), min: 0, max: 1199, ico: "🥉" },
      { id: "silver", label: T("Gümüş"), min: 1200, max: 1599, ico: "🥈" },
      { id: "gold", label: T("Gold"), min: 1600, max: 1999, ico: "🥇" },
      { id: "diamond", label: T("Diamond"), min: 2000, max: 2399, ico: "💎" },
      { id: "master", label: T("Usta"), min: 2400, max: 99999, ico: "👑" },
    ];
    return leagues.find((x) => r >= x.min && r <= x.max) || leagues[0];
  }

  function identityTitle(skills) {
    const top = (skills || []).slice().sort((a, b) => b.score - a.score)[0];
    const map = {
      tactics: T("Taktiksel Mücadeleci"),
      calculation: T("Keskin Hesapçı"),
      opening: T("Açılış Bilgini"),
      endgame: T("Oyunsonu İşçisi"),
      consistency: T("İstikrarlı Tırmanıcı"),
      middlegame: T("Orta Oyun Savaşçısı"),
    };
    return (top && map[top.id]) || T("Taktiksel Mücadeleci");
  }

  function identityAttrs(skills) {
    const by = Object.fromEntries((skills || []).map((s) => [s.id, s.score]));
    const tone = (n) =>
      n >= 80
        ? T("Çok Güçlü")
        : n >= 70
          ? T("Güçlü")
          : n >= 60
            ? T("İyi")
            : T("Gelişiyor");
    const rows = [
      { lab: T("Taktiksel"), score: by.tactics || 70, color: "var(--fs-tactics)", ico: "⚔" },
      { lab: T("Agresif"), score: Math.min(95, Math.round((by.tactics || 70) * 0.9 + 5)), color: "#f59e0b", ico: "🔥" },
      { lab: T("Stratejik"), score: by.opening || 64, color: "var(--fs-calc)", ico: "♛" },
      { lab: T("İstikrarlı"), score: by.consistency || 70, color: "var(--fs-opening)", ico: "🛡" },
      { lab: T("Yaratıcı"), score: Math.min(92, Math.round(((by.calculation || 65) + (by.tactics || 70)) / 2 - 8)), color: "#22d3ee", ico: "💡" },
      { lab: T("Hesaplı"), score: by.calculation || 68, color: "#fb923c", ico: "◎" },
    ];
    return rows.map((r) => ({ ...r, tone: tone(r.score) }));
  }

  function attrSegHTML(score, color) {
    const on = Math.max(0, Math.min(10, Math.round(Number(score) / 10)));
    return `<div class="fs-attr-seg">${Array.from({ length: 10 }, (_, i) =>
      `<i class="${i < on ? "on" : ""}" style="${i < on ? `background:${color}` : ""}"></i>`,
    ).join("")}</div>`;
  }

  function journeyMilestones(profile) {
    const games = (profile && profile.recent_games) || [];
    const u = (profile && profile.user) || {};
    const stats = (profile && profile.stats) || {};
    const first = games.slice().sort((a, b) => (a.end_time || 0) - (b.end_time || 0))[0];
    const win = games.find((g) => String(g.result || "").toLowerCase().includes("win"));
    return [
      {
        ico: "♟",
        title: T("İlk Oyun"),
        sub: first ? `${esc(first.time_control || "")} ${esc(first.time_class || "")}`.trim() : "—",
        when: first ? fmtDate(first.end_time) : "—",
        done: !!first || Number(stats.total_games) > 0,
      },
      {
        ico: "⚔",
        title: T("İlk Zafer"),
        sub: win
          ? `vs. ${esc(gameParticipants(win, u).oppName || "?")}`
          : "—",
        when: win ? fmtDate(win.end_time) : "—",
        done: !!win || Number(stats.wins) > 0,
      },
      {
        ico: "100",
        title: T("100. Oyun"),
        sub: T("Rapid"),
        when: Number(stats.total_games) >= 100 ? T("Ulaşıldı") : "—",
        done: Number(stats.total_games) >= 100,
      },
      {
        ico: "🔥",
        title: T("İlk 7 Günlük Seri"),
        sub: "7 Days",
        when: Number(u.streak_count) >= 7 ? T("Aktif") : "—",
        done: Number(u.streak_count) >= 7,
      },
      {
        ico: "🏆",
        title: T("En Yüksek Reyting"),
        sub: u.highest_rating ? String(u.highest_rating) : "—",
        when: u.highest_rating ? T("En İyi") : "—",
        done: false,
        peak: true,
      },
    ];
  }

  function weeklyXpFromCache(user) {
    const streak = Number(user && user.streak_count) || 0;
    const solved =
      Number(
        (cache.puzzles.stats &&
          (cache.puzzles.stats.solved_today ||
            cache.puzzles.stats.today_solved ||
            cache.puzzles.stats.solved)) ||
          0,
      ) || 0;
    const me = (cache.leaderboard.data && cache.leaderboard.data.me) || {};
    if (
      me.value != null &&
      me.value !== "" &&
      cache.leaderboard.metric === "points"
    ) {
      return Math.max(0, Math.round(Number(me.value) || 0));
    }
    if (
      me.value != null &&
      me.value !== "" &&
      cache.leaderboard.metric === "weekly_solved"
    ) {
      return Math.max(0, Math.round((Number(me.value) || 0) * 25));
    }
    return Math.min(1999, 400 + streak * 80 + solved * 20);
  }

  function buildLocalNotifications() {
    const u = (cache.profile && cache.profile.user) || {};
    const items = [];
    const streak = Number(u.streak_count) || 0;
    if (streak >= 3) {
      items.push({
        id: "local-streak",
        titleKey: "Serin devam ediyor",
        bodyKey: "{n} Günlük Seri — Devam et!",
        bodyN: streak,
        ts: Date.now() / 1000,
        local: true,
      });
    }
    const xp = weeklyXpFromCache(u);
    if (xp >= 2000) {
      items.push({
        id: "local-chest",
        titleKey: "Haftalık Ödül Sandığı",
        bodyKey: "Sandığı Aç · {xp} XP",
        bodyXp: xp,
        ts: Date.now() / 1000,
        local: true,
        act: "go-arena",
      });
    } else {
      items.push({
        id: "local-arena",
        titleKey: "Arena",
        bodyKey: "{xp} / 2000 XP · Ligde yüksel. Oyununu keskinleştir.",
        bodyXp: xp,
        ts: Date.now() / 1000,
        local: true,
        act: "go-arena",
      });
    }
    items.push({
      id: "local-coach",
      titleKey: "Koç Önerisi",
      bodyKey: "Koçun bir şey fark etti. Bu hafta taktik doğruluğun %8 arttı.",
      ts: Date.now() / 1000 - 3600,
      local: true,
      act: "go-coach",
    });
    return items;
  }

  function formatNotifText(it) {
    const titleSrc = it.titleKey || it.title || "Bildirim";
    const bodySrc = it.bodyKey || it.body || "";
    let title = T(titleSrc);
    let body = T(bodySrc);
    if (it.bodyN != null) {
      body = body.replace("{n}", String(it.bodyN));
      // Fallback if body was built from partial keys previously
      if (body === bodySrc && bodySrc.includes("{n}")) {
        body = `${it.bodyN} ${T("Günlük Seri")} — ${T("Devam et!")}`;
      }
    }
    if (it.bodyXp != null) {
      const xpTxt = Number(it.bodyXp).toLocaleString();
      body = body.replace("{xp}", xpTxt);
      if (body === bodySrc && bodySrc.includes("{xp}")) {
        if (String(it.id) === "local-chest") {
          body = `${T("Sandığı Aç")} · ${xpTxt} XP`;
        } else {
          body = `${xpTxt} / 2000 XP · ${T("Ligde yüksel. Oyununu keskinleştir.")}`;
        }
      }
    }
    return { title, body };
  }

  async function ensureNotifications(force) {
    const n = cache.notifications;
    if (n.loading) return;
    if (n.items.length && !force) return;
    n.loading = true;
    try {
      const stored = await new Promise((resolve) => {
        try {
          chrome.storage.local.get(["fs_notif_read"], (r) => resolve(r || {}));
        } catch (_) {
          resolve({});
        }
      });
      n.readIds = stored.fs_notif_read || {};
      let remote = [];
      try {
        const r = await send("notifications_list", { since: 0 });
        if (r && r.ok && Array.isArray(r.notifications)) remote = r.notifications;
      } catch (_) {}
      const mapped = remote.map((x) => ({
        id: String(x.id),
        titleKey: x.title || "Bildirim",
        bodyKey: x.body || "",
        ts: x.ts || x.created_at || Date.now() / 1000,
        click_url: x.click_url || "",
        local: false,
      }));
      const local = buildLocalNotifications();
      const byId = new Map();
      [...mapped, ...local].forEach((it) => {
        if (!byId.has(String(it.id))) byId.set(String(it.id), it);
      });
      n.items = Array.from(byId.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0));
      n.unread = n.items.filter((it) => !n.readIds[String(it.id)]).length;
    } finally {
      n.loading = false;
      updateNotifBell();
    }
  }

  function updateNotifBell() {
    if (!panelEl) return;
    const bell = panelEl.querySelector(".fs-header-bell");
    if (!bell) return;
    bell.classList.toggle("fs-has-unread", (cache.notifications.unread || 0) > 0);
  }

  function renderNotifPanelHTML() {
    const n = cache.notifications;
    const items = n.items || [];
    const rows = items.length
      ? items
          .map((it) => {
            const unread = !n.readIds[String(it.id)];
            const txt = formatNotifText(it);
            return `<button type="button" class="fs-notif-item ${unread ? "unread" : ""}" data-notif-id="${esc(String(it.id))}" data-notif-act="${esc(it.act || "")}" data-notif-url="${esc(it.click_url || "")}">
              <i class="fs-notif-dot"></i>
              <span>
                <div class="fs-notif-title">${esc(txt.title)}</div>
                <div class="fs-notif-body">${esc(txt.body)}</div>
              </span>
            </button>`;
          })
          .join("")
      : `<div class="fs-notif-empty">${T("Henüz bildirim yok.")}</div>`;
    return `
      <div class="fs-notif-panel" id="fs-notif-panel" ${n.open ? "" : "hidden"}>
        <div class="fs-notif-head">
          <strong>${T("Bildirimler")}</strong>
          <button type="button" class="fs-link-gold" data-act="notif-mark-all">${T("Tümünü okundu işaretle")}</button>
        </div>
        ${rows}
      </div>`;
  }

  function toggleNotifications(forceOpen) {
    const n = cache.notifications;
    n.open = typeof forceOpen === "boolean" ? forceOpen : !n.open;
    const wrap = panelEl && panelEl.querySelector(".fs-notif-wrap");
    if (!wrap) return;
    let panel = wrap.querySelector(".fs-notif-panel");
    if (!panel) {
      wrap.insertAdjacentHTML("beforeend", renderNotifPanelHTML());
      panel = wrap.querySelector(".fs-notif-panel");
    } else {
      panel.outerHTML = renderNotifPanelHTML();
      panel = wrap.querySelector(".fs-notif-panel");
    }
    if (panel) panel.hidden = !n.open;
    if (n.open) ensureNotifications(true);
  }

  async function markNotifRead(id) {
    const n = cache.notifications;
    n.readIds[String(id)] = 1;
    n.unread = n.items.filter((it) => !n.readIds[String(it.id)]).length;
    try {
      chrome.storage.local.set({ fs_notif_read: n.readIds });
    } catch (_) {}
    if (!String(id).startsWith("local-")) {
      try {
        await send("notification_event", {
          notification_id: id,
          event_type: "click",
        });
      } catch (_) {}
    }
    updateNotifBell();
    if (n.open) toggleNotifications(true);
  }

  async function playChestOpen() {
    const wrap = panelEl && panelEl.querySelector(".fs-weekly-chest");
    const img = wrap && wrap.querySelector("img");
    if (!wrap || !img || cache.arenaChest.opening) return;
    if (cache.arenaChest.opened) return;
    const unlocked = wrap.classList.contains("unlocked");
    if (!unlocked) {
      wrap.classList.remove("locked-shake");
      void wrap.offsetWidth;
      wrap.classList.add("locked-shake");
      setTimeout(() => wrap.classList.remove("locked-shake"), 450);
      return;
    }
    cache.arenaChest.opening = true;
    wrap.classList.add("opening");
    const openUrl = v3Url("chest-open-cut.png") || v3Url("chest-open.png");
    setTimeout(() => {
      if (openUrl) img.src = openUrl;
    }, 280);
    setTimeout(() => {
      wrap.classList.remove("opening");
      cache.arenaChest.opening = false;
      cache.arenaChest.opened = true;
      try {
        chrome.storage.local.set({ fs_arena_chest_opened: true });
      } catch (_) {}
      const btn = wrap.querySelector(".fs-btn-gold[data-act='arena-chest']");
      if (btn) btn.remove();
      const title = wrap.querySelector(".fs-v3-title");
      if (title) title.textContent = T("Ödül alındı");
    }, 1000);
  }


  function renderProfileTab() {
    const p = cache.profile;
    if (!p) return renderLoading();
    if (!p.user) {
      return `<div class="fs-empty">${T("Profil bilgisi alınamadı.")}</div>`;
    }
    const u = p.user;
    const stats = p.stats || {};
    const skills = skillHeuristic(stats, u);
    // middlegame insert for profile skills list
    const midScore = Math.round(
      ((skills.find((s) => s.id === "tactics") || {}).score || 70) * 0.45 +
        ((skills.find((s) => s.id === "calculation") || {}).score || 70) * 0.55,
    );
    const skillList = [
      skills.find((s) => s.id === "tactics"),
      skills.find((s) => s.id === "calculation"),
      skills.find((s) => s.id === "opening"),
      {
        id: "middlegame",
        label: T("Orta Oyun"),
        score: midScore,
        color: "#f59e0b",
        tone: midScore >= 70 ? T("İyi") : T("Gelişiyor"),
      },
      skills.find((s) => s.id === "endgame"),
    ].filter(Boolean);
    const title = identityTitle(skills);
    const attrs = identityAttrs(skills);
    const level = Math.max(1, Math.floor((Number(u.highest_rating) || 1000) / 80));
    const xpNow = Math.min(2999, (Number(u.streak_count) || 0) * 120 + 1800);
    const xpMax = 3000;
    const ccUser = u.chess_com_username || u.username || "";
    const avUrl = u.chess_com_avatar || "";
    const knight = v3Url("cat-tactics-knight-cut.png") || v3Url("logo-knight-gold-cut.png");
    const coachAv =
      (getSelectedCoach() && getSelectedCoach().portrait) ||
      foxAvatarUrl() ||
      v3Url("coach-portrait-cut.png") ||
      v3Url("coach-sheet-nobg.png");
    const journey = journeyMilestones(p);
    const ach = (cache.achievements && cache.achievements !== "loading" && cache.achievements.items) || [];
    const achFallback = [
      { ico: "⚔", lab: T("Taktik Avcısı"), sub: T("50+ bulmaca çözüldü"), color: "#3dd68c" },
      { ico: "🔥", lab: T("Yedi Günlük Seri"), sub: T("Momentumunu koru!"), color: "#f5c542" },
      { ico: "♜", lab: T("Dönüş Oyuncusu"), sub: T("Kayıp pozisyonlardan galibiyet"), color: "#a78bfa" },
      { ico: "◎", lab: T("Keskin Hesapçı"), sub: T("Taktiklerde yüksek doğruluk"), color: "#4c8dff" },
    ];
    const achShow = (ach.length ? ach.slice(0, 4) : achFallback).map((a, i) => {
      if (a.lab) return a;
      return {
        ico: ["⚔", "🔥", "♜", "◎"][i] || "★",
        lab: a.title || a.name || a.code || T("Başarım"),
        sub: a.description || a.sub || "",
        color: "#f5c542",
      };
    });
    const editIco = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3 2.1 2.1 0 0 1 0 3L7 19l-4 1 1-4Z"/></svg>`;
    const badgeIco = v3Url("logo-knight-gold-cut.png") || v3Url("logo-knight-gold.png");

    return `
      <div class="fs-prof-v3-head">
        <div style="position:relative">
          ${
            avUrl
              ? `<img class="fs-prof-v3-av" src="${esc(avUrl)}" alt="" />`
              : `<div class="fs-prof-v3-av-ph">${esc((u.username || "?").slice(0, 1).toUpperCase())}</div>`
          }
          <i class="fs-prof-online" aria-hidden="true"></i>
          <button class="fs-prof-edit" type="button" data-act="go-settings" title="${T("Ayarlar")}">${editIco}</button>
        </div>
        <div class="fs-prof-idcol">
          <div class="fs-prof-v3-name">${esc(u.username || "?")}</div>
          <button class="fs-prof-v3-link" data-act="open-chesscom" data-user="${esc(ccUser)}">
            Chess.com: ${esc(ccUser || "—")}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5"/></svg>
          </button>
          <div class="fs-prof-badge">${
            badgeIco
              ? `<img src="${esc(badgeIco)}" alt="" />`
              : "♞"
          } ${esc(title)}</div>
        </div>
        <div class="fs-prof-statcols">
          <div class="fs-prof-statcol">
            <div class="fs-prof-stat-ico pawn">♟</div>
            <span class="lab">${T("Reyting")}</span><b>${esc(u.highest_rating || "—")}</b>
            <div class="fs-v3-sub">Rapid</div>
          </div>
          <div class="fs-prof-statcol">
            <div class="fs-prof-stat-ico shield">★</div>
            <span class="lab">${T("Seviye")}</span><b>${level}</b>
            <div class="fs-v3-sub">Knight</div>
          </div>
          <div class="fs-prof-statcol">
            <div class="fs-prof-stat-ico flame">🔥</div>
            <span class="lab">${T("Seri")}</span><b>${esc(u.streak_count || 0)}</b>
            <div class="fs-v3-sub">${T("gün")}</div>
          </div>
          <div class="fs-prof-statcol fs-prof-xp">
            <div class="fs-xp-ring" style="--fs-xp-pct:${Math.round((xpNow / xpMax) * 100)}">
              <div><div class="xp-lab">XP</div><div class="xp-now">${xpNow.toLocaleString()}</div><div class="xp-max">/ ${xpMax.toLocaleString()}</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="fs-prof-grid2">
        <div class="fs-v3-card">
          <div class="fs-identity-top">
            <div>
              <div class="fs-v3-kicker">${T("SATRANÇ KİMLİĞİN")}</div>
              <div class="fs-v3-title">${esc(title)}</div>
              <div class="fs-v3-sub">${T("Keskin, taktiksel pozisyonlarda büyüyorsun ve kazanma fırsatları yaratmayı seviyorsun. Oyunların aktif oyun ve saldırı fikirlerine güçlü bir yatkınlık gösteriyor.")}</div>
            </div>
            ${
              knight
                ? `<div class="fs-identity-art-wrap"><img class="fs-identity-art" src="${esc(knight)}" alt="" /></div>`
                : ""
            }
          </div>
          ${attrs
            .map(
              (a) => `
            <div class="fs-attr-row">
              <span class="fs-attr-ico" style="color:${a.color}">${a.ico || "•"}</span>
              <span>${esc(a.lab)}</span>
              ${attrSegHTML(a.score, a.color)}
              <strong style="color:${a.color};font-size:11px;text-align:right">${esc(a.tone)}</strong>
            </div>`,
            )
            .join("")}
          <div class="fs-quote-box">“${T("Başkalarının kaçırdığı taktikleri görüyorsun. İçgüdülerine güvenmeye devam et.")}”</div>
        </div>
        <div class="fs-v3-card">
          <div class="fs-v3-kicker">${T("BECERİLERİN")}</div>
          ${skillList
            .map(
              (s) => `
            <div class="fs-skill-list-row">
              <div class="fs-skill-ico-wrap" style="--fs-skill-c:${s.color}">${skillIcon(s.id)}</div>
              <div>
                <div style="font-weight:800;font-size:12px">${esc(s.label)}</div>
                <div class="fs-skill-bar" style="margin-top:6px"><i style="width:${s.score}%;background:${s.color}"></i></div>
              </div>
              <div style="text-align:right;color:${s.color}"><strong>${s.score}</strong><div class="fs-v3-sub">${esc(s.tone)}</div></div>
            </div>`,
            )
            .join("")}
          <button class="fs-btn-outline" data-act="go-progress" style="width:100%;margin-top:12px">${T("Tam Gelişimi Gör")} →</button>
        </div>
      </div>
      <div class="fs-v3-card" style="margin-top:14px">
        <div class="fs-v3-kicker">${T("OYUNCU YOLCULUĞU")}</div>
        <div class="fs-journey">
          ${journey
            .map(
              (j) => `
            <div class="fs-journey-item ${j.done ? "done" : ""} ${j.peak ? "peak" : ""}">
              <div class="fs-journey-ico">${j.ico}</div>
              <strong>${esc(j.title)}</strong>
              <span class="fs-j-when">${j.when}</span>
              <span class="fs-j-sub">${j.sub}</span>
            </div>`,
            )
            .join("")}
        </div>
      </div>
      <div class="fs-prof-grid2" style="margin-top:14px">
        <div class="fs-v3-card">
          <div class="fs-section-head">
            <div class="fs-v3-kicker">${T("SON BAŞARILAR")}</div>
            <button class="fs-link-gold" data-act="go-achievements">${T("Tümünü gör")}</button>
          </div>
          <div class="fs-ach-hex">
            ${achShow
              .map(
                (a) => `
              <div class="fs-ach-hex-item">
                <div class="fs-ach-hex-ico" style="color:${a.color}">${a.ico}</div>
                <small>${esc(a.lab)}</small>
                ${a.sub ? `<span class="fs-ach-sub">${esc(a.sub)}</span>` : ""}
              </div>`,
              )
              .join("")}
          </div>
        </div>
        <div class="fs-v3-card fs-v3-coach-card" style="min-height:auto;padding:14px">
          <img class="fs-v3-coach-av" src="${esc(coachAv)}" alt="" style="width:88px;height:88px;margin-left:-18px" />
          <div class="fs-v3-coach-body">
            <div class="fs-v3-kicker">${T("KOÇ ÖZETİ")}</div>
            <div class="fs-v3-title" style="font-size:14px;font-family:inherit">${T('En iyi performansın <span class="fs-coach-hl">taktik orta oyunlarda</span>; zor açılışlardan sonra da toparlanıyorsun.')}</div>
            <div class="fs-v3-sub" style="margin-top:6px">${T("Bir sonraki seviyeye ulaşmak için oyunsonu dönüşümüne odaklan.")}</div>
            <button class="fs-btn-outline" data-act="go-coach" style="margin-top:10px">${T("Koç Planını Gör")} →</button>
          </div>
        </div>
      </div>
      <div class="fs-quote-banner" style="margin-top:14px">
        <img src="${esc(v3Url("quote-cinematic-pieces.png"))}" alt="" />
        <div class="fs-quote-txt">“${T("Satranç kimliğin gücündür. Yolculuğun hikâyendir.")}”<span class="fs-quote-sig">— ForkSight Coach</span></div>
      </div>
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
        ${chip("win", T("Kazandıklarım"), "result")}
        ${chip("loss", T("Kaybettiklerim"), "result")}
        ${chip("draw", T("Beraberlik"), "result")}
      </div>
      <div class="fs-chips">
        ${chip("", T("Hepsi"), "time_class")}
        ${chip("bullet", "Bullet", "time_class")}
        ${chip("blitz", "Blitz", "time_class")}
        ${chip("rapid", "Rapid", "time_class")}
        ${chip("daily", T("Günlük"), "time_class")}
      </div>
      <div class="fs-learn-box">
        <strong>${T("Ne oldu?")}</strong><br/>
        ${T("Bir oyunu açtığında hamle motoru yerine önce faz yıldızları, en büyük hata ve öğrenilecek dersi göreceksin.")}
      </div>
    `;
    if (!g.items.length) {
      html += `<div class="fs-empty">${T("Eşleşen oyun yok.")}</div>`;
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
          <div class="fs-chap-title">${T("Ne oldu?")}</div>
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
        <div class="fs-quiz-stat"><div class="fs-quiz-stat-val">${esc(s.rating ?? 1200)}<span class="fs-quiz-rd">±${esc(Math.round(s.rd ?? 350))}</span></div><div class="fs-quiz-stat-lab">${T("Reyting")}</div></div>
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
      <div class="fs-v3-card fs-mission-card" style="margin-bottom:14px;--fs-mission-url:url('${esc(v3Url("hero-daily-mission.png"))}')">
        <div class="fs-mission-hero">
          <div>
            <div class="fs-v3-kicker" style="color:var(--fs-tactics)">${T("GÜNLÜK GÖREV")}</div>
            <div class="fs-v3-title" style="font-size:22px">${T("Günlük Görev")}</div>
            <div class="fs-v3-sub" style="margin-bottom:4px">${T("Antrenmanını tamamla ve seviye atla!")}</div>
            <ul class="fs-mission-list">
              <li class="${hasPuzzles ? "done" : ""}"><span class="fs-mission-ico" style="color:var(--fs-tactics)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h8l1 4H7l1-4z"/><path d="M12 8v10"/><path d="M9 18h6"/><circle cx="12" cy="14" r="2.2"/></svg></span>${T("5 Taktik Bulmaca")}</li>
              <li><span class="fs-mission-ico" style="color:var(--fs-opening)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><path d="M12 4v3M19 12h-3"/></svg></span>${T("3 Hata Tekrarı")}</li>
              <li><span class="fs-mission-ico" style="color:var(--fs-calc)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 9h8M8 12h5M8 15h6"/></svg></span>${T("1 Oyun İncelemesi")}</li>
            </ul>
          </div>
          <div class="fs-mission-mid">
            <div class="fs-ring" style="--fs-ring-pct:${Math.max(8, Math.min(100, Math.round((total ? Math.min(total, 9) : 0) / 9 * 100)))}%">
              <span><b>${Math.min(total, 9)} / 9</b>${T("tamamlandı")}</span>
            </div>
            <button class="fs-btn-gold" data-quiz-act="start" ${startDisabled}>${T("Antrenmana Devam →")}</button>
          </div>
          <div aria-hidden="true"></div>
        </div>
      </div>
      <div class="fs-v3-kicker" style="margin:4px 2px 6px">${T("ANTRENMAN KATEGORİLERİ")}</div>
      <div class="fs-cat-grid" style="margin-bottom:12px">
        <button class="fs-cat-card" data-quiz-act="start" ${startDisabled}>
          <div class="fs-cat-name" style="color:var(--fs-tactics)"><img src="${esc(v3Url("ico-tactics.svg"))}" alt="" />${T("Taktik")}</div>
          <img src="${esc(v3Url("cat-tactics-knight-cut.png"))}" alt="" />
          <div class="fs-cat-score">82 <span class="fs-cat-tone" style="color:var(--fs-tactics)">${T("Güçlü")}</span></div>
          <div class="fs-cat-bar"><i style="width:82%;background:var(--fs-tactics)"></i></div>
          <div class="fs-cat-meta">124 / 150 ${T("çözüldü")}</div>
          <div class="fs-cat-cta">${T("Antrenmana Başla →")}</div>
        </button>
        <button class="fs-cat-card" data-act="go-coach">
          <div class="fs-cat-name" style="color:var(--fs-opening)"><img src="${esc(v3Url("ico-opening.svg"))}" alt="" />${T("Açılış")}</div>
          <img src="${esc(v3Url("cat-opening-royalty-cut.png"))}" alt="" />
          <div class="fs-cat-score">64 <span class="fs-cat-tone" style="color:var(--fs-opening)">${T("Gelişiyor")}</span></div>
          <div class="fs-cat-bar"><i style="width:48%;background:var(--fs-opening)"></i></div>
          <div class="fs-cat-meta">48 / 100 ${T("çalışıldı")}</div>
          <div class="fs-cat-cta">${T("Çalış →")}</div>
        </button>
        <button class="fs-cat-card" data-quiz-act="start" ${startDisabled}>
          <div class="fs-cat-name" style="color:var(--fs-calc)"><img src="${esc(v3Url("ico-calculation.svg"))}" alt="" />${T("Hesap")}</div>
          <img src="${esc(v3Url("cat-calculation-cut.png"))}" alt="" />
          <div class="fs-cat-score">71 <span class="fs-cat-tone" style="color:var(--fs-calc)">${T("İyi")}</span></div>
          <div class="fs-cat-bar"><i style="width:63%;background:var(--fs-calc)"></i></div>
          <div class="fs-cat-meta">76 / 120 ${T("çözüldü")}</div>
          <div class="fs-cat-cta">${T("Antrenman →")}</div>
        </button>
        <button class="fs-cat-card" data-quiz-act="start" ${startDisabled}>
          <div class="fs-cat-name" style="color:var(--fs-accent)"><img src="${esc(v3Url("ico-endgame.svg"))}" alt="" />${T("Oyunsonu")}</div>
          <img src="${esc(v3Url("cat-endgame-cut.png"))}" alt="" />
          <div class="fs-cat-score">56 <span class="fs-cat-tone" style="color:var(--fs-accent)">${T("İyileşiyor")}</span></div>
          <div class="fs-cat-bar"><i style="width:32%;background:var(--fs-accent)"></i></div>
          <div class="fs-cat-meta">32 / 100 ${T("pratik")}</div>
          <div class="fs-cat-cta">${T("Pratik →")}</div>
        </button>
        <button class="fs-cat-card" data-act="go-games">
          <div class="fs-cat-name" style="color:#22d3ee"><img src="${esc(v3Url("ico-consistency.svg"))}" alt="" />${T("Hata Tekrarı")}</div>
          <img src="${esc(v3Url("cat-mistake-lens-cut.png"))}" alt="" />
          <div class="fs-cat-score">78 <span class="fs-cat-tone" style="color:#22d3ee">${T("İyi")}</span></div>
          <div class="fs-cat-bar"><i style="width:61%;background:#22d3ee"></i></div>
          <div class="fs-cat-meta">61 / 100 ${T("incelendi")}</div>
          <div class="fs-cat-cta">${T("İncele →")}</div>
        </button>
      </div>
      <div class="fs-v3-grid fs-v3-grid-2" style="margin-bottom:14px">
        <div class="fs-v3-card fs-revisit-wrap">
          <div class="fs-v3-kicker">${T("TEKRAR ET")}</div>
          <div class="fs-v3-title" style="font-size:15px;font-family:inherit">${T("Tekrar Etmen Gereken Pozisyonlar")}</div>
          ${revisitRowsHTML(
            (cache.profile && cache.profile.recent_games) ||
              cache.games.items ||
              [],
          )}
          <img class="fs-revisit-atmos" src="${esc(v3Url("sidebar-atmos-pawn-cutout.png") || v3Url("sidebar-atmos-pawn-cut.png"))}" alt="" />
        </div>
        <div class="fs-v3-card">
          <div class="fs-v3-kicker">${T("ÖNERİLEN")}</div>
          <div class="fs-v3-title" style="font-size:15px;font-family:inherit">${T("Senin İçin Önerilen")}</div>
          ${recommendedRowsHTML(startDisabled)}
        </div>
      </div>
      <div class="fs-v3-card">
        <div class="fs-footer-xp">
          <div>
            <div class="fs-v3-kicker">${T("BUGÜNÜN İLERLEMESİ")}</div>
            <div class="fs-v3-title" style="font-size:16px;font-family:inherit">◎ ${T("Devam et!")}</div>
            <div class="fs-v3-sub">${esc(lobbyMsg)}</div>
          </div>
          <div class="fs-chest-track">
            <div class="fs-chest-item done">
              <img src="${esc(v3Url(hasPuzzles ? "chest-open-cut.png" : "chest-closed-cut.png"))}" alt="" />
              <span>250 XP</span>
            </div>
            <div class="fs-chest-item">
              <img src="${esc(v3Url("chest-closed-cut.png"))}" alt="" />
              <span>500 XP</span>
            </div>
            <div class="fs-chest-item">
              <img src="${esc(v3Url("chest-closed-cut.png"))}" alt="" />
              <span>750 XP</span>
            </div>
            <div class="fs-chest-item">
              <img src="${esc(v3Url("chest-closed-cut.png"))}" alt="" />
              <span>1000 XP</span>
            </div>
          </div>
          <div class="fs-today-xp">
            <strong>${Math.min(1199, (Number((cache.profile && cache.profile.user && cache.profile.user.streak_count) || 0) * 80 + 400))} / 1200 XP</strong>
            <div class="fs-skill-bar"><i style="width:${Math.min(100, Math.round(((Number((cache.profile && cache.profile.user && cache.profile.user.streak_count) || 0) * 80 + 400) / 1200) * 100))}%;background:linear-gradient(90deg,#a78bfa,#60a5fa)"></i></div>
            <div class="fs-v3-sub" style="margin-top:6px">${T("Bugünün XP'si")}</div>
          </div>
        </div>
      </div>
      <details style="margin-top:10px">
        <summary style="cursor:pointer;color:var(--fs-text-dim);font-size:12px;font-weight:700">${T("Geçmiş Denemeler")}</summary>
        <div class="fs-quiz-lobby-slim" style="display:flex!important;opacity:0.85;margin-top:8px">
          <span>${T("Bulmaca motoru")}: ${esc(lobbyMsg)}</span>
          <div style="display:flex;gap:8px">
            <button class="fs-btn-sm gold" data-quiz-act="start" ${startDisabled}>${startBtnLabel}</button>
            <button class="fs-btn-sm" data-quiz-act="backfill" ${bfDisabled}>${bfLabel}</button>
          </div>
        </div>
        ${dailyHtml}
        ${themeBanner}
        <div class="fs-quiz-history" style="margin-top:8px">${histHtml}</div>
      </details>
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
    const allowed = ["tilki", "victoria", "boris", "kai", "lena", "sero"];
    const raw = String(selectedCoachId || "tilki").toLowerCase();
    const coach = allowed.includes(raw) ? raw : "tilki";
    const path = "avatars/" + coach + "/" + (mood || "neutral") + ".png";
    try {
      return chrome.runtime.getURL(path);
    } catch (_) {
      return path;
    }
  }

  function _avatarRootUrl(mood) {
    const path = "avatars/" + (mood || "neutral") + ".png";
    try {
      return chrome.runtime.getURL(path);
    } catch (_) {
      return path;
    }
  }

  function _bindQuizCoachFallback(img, mood) {
    if (!img) return;
    const m = mood || "neutral";
    img.onerror = function () {
      img.onerror = null;
      img.src = _avatarRootUrl(m);
    };
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
    const used = Number(p.usedHint) || 0;
    const settled = !!(p.result && p.result.settled);
    const hintBtns = [1, 2, 3]
      .map((lv) => {
        let disabled = isLichess || settled;
        let cls = "fs-quiz-hint-btn";
        let title = T("İpucu") + " " + lv;
        if (!isLichess && !settled) {
          if (lv <= used) {
            cls += " fs-active";
            disabled = true;
            title = T("İpucu alındı");
          } else if (lv === used + 1) {
            disabled = false;
            title = T("İpucu") + " " + lv;
          } else {
            disabled = true;
            title = T("Önce ipucu {n}").replace("{n}", String(lv - 1));
          }
        }
        return `<button class="${cls}" data-quiz-hint="${lv}" title="${esc(title)}" ${disabled ? "disabled" : ""}>💡 ${lv}</button>`;
      })
      .join("");
    const flashHtml = settled
      ? _renderQuizOutcomeCard(p.result)
      : p.flash.msg
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
    const coachMood = settled
      ? p.result.correct
        ? "happy"
        : "worried"
      : "thinking";
    const coachText = settled
      ? p.result.phrase || (p.result.correct ? T("Aferin, doğru hamle!") : T("Yanlış. Tekrar dene."))
      : headline;

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
            <span class="fs-quiz-chip fs-quiz-chip-reward" data-quiz-reward>+${pts} ${T("puan")}</span>
            <span class="fs-quiz-chip fs-quiz-chip-timer" data-quiz-timer>0.0s</span>
          </div>
          <div class="fs-quizv2-hintbtns">${hintBtns}</div>
        </div>
        <div class="fs-quizv2-body">
          <div class="fs-quizv2-board" data-quiz-board></div>
          <aside class="fs-quizv2-side">
            <div class="fs-quizv2-coach">
              <img class="fs-quizv2-coach-av" src="${_avatarUrl(coachMood)}" alt="" onerror="this.onerror=null;this.src='${_avatarRootUrl(coachMood)}'" />
              <div class="fs-quizv2-coach-bubble">
                <div class="fs-quizv2-coach-title">${T("Bulmaca")}</div>
                <div class="fs-quizv2-coach-text">${esc(coachText)}</div>
              </div>
            </div>
            <div class="fs-quizv2-section">${T("HAMLELER")}</div>
            ${_renderMovesList(pz.history_san || [], pz.side_to_move)}
            <div class="fs-quizv2-hintstatus" data-quiz-hint-status></div>
            ${flashHtml}
            <div class="fs-quizv2-actions" ${settled ? 'style="display:none"' : ""}>
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
              <img class="fs-quizv2-coach-av" src="${_avatarUrl(mood)}" alt="" onerror="this.onerror=null;this.src='${_avatarRootUrl(mood)}'" />
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
    if (activeTab === "achievements" || activeTab === "profile") renderActive();
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
    const lb = cache.leaderboard;
    if (lb.loading || !lb.data) {
      if (!lb.data && !lb.loading) loadLeaderboard(lb.metric || "points");
      return renderLoading();
    }
    const u = (cache.profile && cache.profile.user) || {};
    const puzzleStats = (cache.puzzles && cache.puzzles.stats) || {};
    const meEarly = (lb.data && lb.data.me) || {};
    // Arena lig/sıra = ForkSight bulmaca reytingi; chess.com ayrı
    const fsRating =
      Number(meEarly.rating) ||
      Number(puzzleStats.rating) ||
      1200;
    const chessComRating =
      meEarly.chess_com_rating != null
        ? Number(meEarly.chess_com_rating)
        : Number(u.highest_rating) || null;
    const apiLeague = (lb.data && lb.data.league) || {};
    const bands = [
      { id: "bronze", label: T("Bronz"), min: 0, max: 1199, ico: "🥉", range: "0-1199" },
      { id: "silver", label: T("Gümüş"), min: 1200, max: 1599, ico: "🥈", range: "1200-1599" },
      { id: "gold", label: T("Gold"), min: 1600, max: 1999, ico: "🥇", range: "1600-1999" },
      { id: "diamond", label: T("Diamond"), min: 2000, max: 2399, ico: "💎", range: "2000-2399" },
      { id: "master", label: T("Usta"), min: 2400, max: 99999, ico: "👑", range: "2400+" },
    ];
    const leagueMeta =
      bands.find((x) => x.id === apiLeague.id) || leagueFromRating(fsRating);
    const leagues = bands.map((b) => ({
      id: b.id,
      label: b.label,
      range: b.range,
      ico: b.ico,
    }));
    const top = lb.data.top || [];
    const me = lb.data.me || {};
    const fsName = u.username || me.username || T("Sen");
    const myAvatar = u.chess_com_avatar || me.avatar || "";
    const myFsPoints =
      me.points != null
        ? Number(me.points)
        : Number(me.value) || Number(puzzleStats.total_points) || 0;
    const meInTop =
      top.find((x) => x.is_me) ||
      (me.user_id != null
        ? top.find((x) => Number(x.user_id) === Number(me.user_id))
        : null);
    const myRankRaw = Number(me.rank) || Number(meInTop && meInTop.rank);
    const myRank =
      Number.isFinite(myRankRaw) && myRankRaw > 0 ? myRankRaw : null;
    const pool = Number(apiLeague.pool_size) || Math.max(top.length, 1);
    const percentile = Number(apiLeague.percentile);
    const weekXp = Math.max(
      0,
      Number.isFinite(myFsPoints) ? myFsPoints : weeklyXpFromCache(u),
    );
    const weekGoal = 2000;
    const pctBar = Math.min(100, Math.round((weekXp / weekGoal) * 100));
    const canOpenChest = weekXp >= weekGoal;
    const chestOpened = !!cache.arenaChest.opened;
    const unlocked = canOpenChest || chestOpened;
    const chestSrc = v3Url(
      chestOpened ? "chest-open-cut.png" : "chest-closed-cut.png",
    );
    const nextLeague = (() => {
      const order = ["bronze", "silver", "gold", "diamond", "master"];
      const i = order.indexOf(leagueMeta.id);
      if (i < 0 || i >= order.length - 1) return null;
      return bands.find((x) => x.id === order[i + 1]) || null;
    })();
    const endsIn = (() => {
      const now = new Date();
      const day = now.getUTCDay();
      const daysToMon = (8 - day) % 7 || 7;
      const end = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() + daysToMon,
          0,
          0,
          0,
        ),
      );
      const ms = end - now;
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `${d}d ${h}h ${m}m`;
    })();
    const lbAvatarHTML = (url, name) => {
      if (url) {
        return `<img class="fs-recent-av" src="${esc(url)}" alt="" />`;
      }
      return `<div class="fs-recent-av placeholder">${esc((name || "?").slice(0, 1).toUpperCase())}</div>`;
    };
    const isMeRow = (row) =>
      !!row &&
      (!!row.is_me ||
        (me.user_id != null && Number(row.user_id) === Number(me.user_id)) ||
        String(row.username || "").toLowerCase() ===
          String(u.username || "").toLowerCase());
    const rows = top
      .slice(0, 10)
      .map((row, idx) => {
        const rank = row.rank || idx + 1;
        const medal =
          rank === 1
            ? "👑"
            : rank === 2
              ? "🥈"
              : rank === 3
                ? "🥉"
                : String(rank);
        const mine = isMeRow(row);
        const displayName = mine ? fsName : row.username || "—";
        const avUrl = mine ? myAvatar || row.avatar : row.avatar;
        const delta = mine ? 2 : rank % 3 === 0 ? -1 : 1;
        return `
        <div class="fs-lb-row-v3 ${mine ? "me" : ""}">
          <div class="rank">${medal}<span class="${delta >= 0 ? "fs-delta-up" : "fs-delta-dn"}" style="margin-left:2px;font-size:10px">${delta >= 0 ? "↑" : "↓"}${Math.abs(delta)}</span></div>
          ${lbAvatarHTML(avUrl, displayName)}
          <div class="name" style="font-weight:700">${esc(displayName)}${mine ? ` (${T("Sen")})` : ""}</div>
          <div style="color:var(--fs-text-dim)">${esc(row.rating || (mine ? fsRating : null) || "—")}</div>
          <div class="xp" style="text-align:right;font-weight:800">
            ${Math.round(
              row.points != null
                ? row.points
                : lb.metric === "points"
                  ? row.value || 0
                  : 0,
            ).toLocaleString()}<span class="fs-lb-xp-pill">XP</span>
          </div>
        </div>`;
      })
      .join("");
    const around = [];
    if (myRank != null) {
      for (let r = Math.max(1, myRank - 2); r <= myRank + 2; r++) {
        const hit = top.find((x) => Number(x.rank) === r);
        // Yalnızca gerçek ben satırı — başka oyuncunun sırasına Jurry yapıştırma
        const useMe = isMeRow(hit) || (r === myRank && !hit);
        around.push({
          rank: r,
          username: useMe ? fsName : (hit && hit.username) || `Player${r}`,
          avatar: useMe ? myAvatar : (hit && hit.avatar) || "",
          rating: useMe ? fsRating : (hit && (hit.rating || "—")) || "—",
          xp: useMe
            ? Math.round(myFsPoints)
            : hit
              ? Math.round(
                  hit.points != null ? hit.points : hit.value || 0,
                )
              : 0,
          me: useMe,
          delta: useMe ? 2 : r < myRank ? 1 : -1,
        });
      }
    } else {
      around.push({
        rank: "—",
        username: fsName,
        avatar: myAvatar,
        rating: fsRating,
        xp: Math.round(myFsPoints),
        me: true,
        delta: 0,
      });
    }
    const stats = (cache.profile && cache.profile.stats) || {};
    const gamesN = Number(stats.total_games) || 0;
    const wins = Number(stats.wins) || 0;
    const losses = Number(stats.losses) || 0;
    const draws = Math.max(0, gamesN - wins - losses);
    const puzzles = Number(
      (cache.puzzles.stats && cache.puzzles.stats.solved) || 0,
    );
    const standingsBanner = (() => {
      if (myRank == null || !pool) return T("Henüz sıralamada değilsin.");
      const p =
        Number.isFinite(percentile) && percentile > 0
          ? percentile
          : Math.max(1, Math.min(100, Math.round((100 * myRank) / pool)));
      return T("{league} Lig'in ilk %{pct}'indesin!")
        .replace("{league}", leagueMeta.label)
        .replace("{pct}", String(p));
    })();
    const progressSub = nextLeague
      ? `${Math.max(0, weekGoal - weekXp).toLocaleString()} XP ${T("{league} Lig'e ulaşmak için").replace("{league}", nextLeague.label)}`
      : T("En üst ligdesin — zirveyi koru!");
    const pathFrom = leagueMeta;
    const pathTo = nextLeague || leagueMeta;

    return `
      <div class="fs-arena-league-bar">
        <div class="fs-arena-league-main">
          <div class="shield"><img src="${esc(v3Url("logo-knight-gold-cut.png"))}" alt="" /></div>
          <div>
            <div class="fs-v3-kicker">${T("Güncel Lig")}</div>
            <div class="fs-v3-title" style="font-size:22px;margin:0">${esc(leagueMeta.label)} ${T("Lig")}</div>
            <div class="fs-v3-sub">🏆 ${leagueMeta.min} – ${leagueMeta.max > 9000 ? "∞" : leagueMeta.max}</div>
          </div>
        </div>
        <div>
          <div class="fs-v3-kicker">${T("Sıralaman")}</div>
          <div class="fs-v3-title" style="font-size:28px;margin:0">#${myRank != null ? myRank : "—"}</div>
          <div class="fs-v3-sub">${T("{n} oyuncu arasından").replace("{n}", String(pool))}</div>
        </div>
        <div>
          <div class="fs-v3-kicker">${T("Bu Haftanın XP'si")}</div>
          <div class="fs-v3-title" style="font-size:28px;margin:0">${weekXp.toLocaleString()}<span class="fs-xp-pill">XP</span></div>
          <div class="fs-v3-sub">${
            Number.isFinite(percentile) && percentile > 0
              ? T("Bu hafta ilk %{pct}").replace("{pct}", String(percentile))
              : T("Lig sıralaman güncellenir")
          }</div>
        </div>
        <div>
          <div class="fs-v3-kicker">${T("Lig Bitişine")}</div>
          <div class="fs-v3-title" style="font-size:20px;margin:0">⏳ ${endsIn}</div>
          <div class="fs-v3-sub">${T("Daha çok oyna, sıralamada yüksel!")}</div>
        </div>
      </div>
      <div class="fs-arena-mid">
        <div class="fs-v3-card">
          <div class="fs-section-head">
            <div class="fs-v3-kicker">${esc(leagueMeta.label.toUpperCase())} ${T("LİDERLİK TABLOSU")}</div>
            <button class="fs-link-gold" data-lb-metric="points">${T("Tam Liderlik Tablosu")} →</button>
          </div>
          ${rows || `<div class="fs-empty">${T("Veri yok.")}</div>`}
          <div style="margin-top:10px;padding:10px;border-radius:10px;background:rgba(61,214,140,0.08);color:var(--fs-tactics);font-size:12px;font-weight:700">
            🏆 ${esc(standingsBanner)}
          </div>
        </div>
        <div class="fs-v3-card">
          <div class="fs-v3-kicker">${T("LİG İLERLEMESİ")}</div>
          <div class="fs-v3-title" style="font-size:18px;font-family:inherit">${weekXp.toLocaleString()} / ${weekGoal.toLocaleString()} <span style="color:#a855f7;font-size:12px">XP</span></div>
          <div class="fs-v3-sub">${progressSub}</div>
          <div class="fs-prog-goal">
            <div class="fs-skill-bar"><i style="width:${pctBar}%;background:linear-gradient(90deg,#a78bfa,#ec4899)"></i></div>
            <span class="goal-ico" aria-hidden="true">🥇</span>
          </div>
          <div class="fs-league-path">
            <div class="fs-league-node silver">
              <img src="${esc(v3Url("cat-tactics-knight-cut.png") || v3Url("logo-knight-gold-cut.png"))}" alt="" />
              <span>${esc(pathFrom.label)} ${pathFrom.min}</span>
            </div>
            <div class="fs-league-dots" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <div class="fs-league-node gold">
              <img src="${esc(v3Url("logo-knight-gold-cut.png"))}" alt="" />
              <span>${esc(pathTo.label)} ${!nextLeague && pathTo.id === "master" ? "∞" : pathTo.min}</span>
            </div>
          </div>
          <button class="fs-btn-outline" data-act="arena-how" style="width:100%;margin-top:10px">? ${T("Ligler Nasıl İşler")}</button>
        </div>
      </div>
      <div class="fs-v3-card" style="margin-bottom:14px">
        <div class="fs-section-head">
          <div class="fs-v3-kicker" style="color:var(--fs-text-dim)">${T("BU HAFTANIN YARIŞMASI")}</div>
        </div>
        <div class="fs-comp-with-chest">
          <div class="fs-comp-grid">
            <div class="fs-comp-cell"><div class="fs-comp-ico">⚔</div><b>${weekXp.toLocaleString()}</b><span>${T("Haftalık XP")}</span><small>${T("Lig puanın")}</small></div>
            <div class="fs-comp-cell"><div class="fs-comp-ico">🎮</div><b>${gamesN}</b><span>${T("Oynanan Oyun")}</span><small>${wins} ${T("Galibiyet")} · ${losses} ${T("Mağlubiyet")} · ${draws} ${T("Beraberlik")}</small></div>
            <div class="fs-comp-cell"><div class="fs-comp-ico">🧩</div><b>${puzzles}</b><span>${T("Çözülen Bulmaca")}</span><small>${T("Antrenman")}</small></div>
            <div class="fs-comp-cell"><div class="fs-comp-ico">🏆</div><b>#${myRank != null ? myRank : "—"}</b><span>${T("Güncel Sıra")}</span><small>${esc(leagueMeta.label)} · ${pool} ${T("oyuncu")}</small></div>
          </div>
          <div class="fs-weekly-chest ${unlocked ? "unlocked" : ""}" data-act="arena-chest">
            <div class="fs-v3-kicker" style="color:var(--fs-text-dim)">${T("HAFTALIK ÖDÜL SANDIĞI")}</div>
            <img src="${esc(chestSrc)}" alt="" />
            <div>
              <div class="fs-v3-title" style="font-size:13px;font-family:inherit;font-weight:600">${
                chestOpened
                  ? T("Ödül alındı")
                  : canOpenChest
                    ? T("Sandık açıldı — aç!")
                    : T("Açmak için 2.000 XP kazan")
              }</div>
              <div class="fs-chest-bar" aria-hidden="true">
                <i style="width:${pctBar}%"></i>
                <em>${weekXp.toLocaleString()} / ${weekGoal.toLocaleString()} XP</em>
              </div>
              ${
                canOpenChest && !chestOpened
                  ? `<button class="fs-btn-gold" style="margin-top:10px" data-act="arena-chest">${T("Sandığı Aç")}</button>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
      <div class="fs-prof-grid2">
        <div class="fs-v3-card">
          <div class="fs-section-head">
            <div class="fs-v3-kicker">${T("ÇEVRENDEKİ OYUNCULAR")}</div>
            <button class="fs-link-gold" data-lb-metric="points">${T("Tümünü gör")} →</button>
          </div>
          ${around
            .map(
              (a) => `
            <div class="fs-lb-row-v3 ${a.me ? "me" : ""}">
              <div class="rank">${a.rank}</div>
              ${
                a.avatar
                  ? `<img class="fs-recent-av" src="${esc(a.avatar)}" alt="" />`
                  : `<div class="fs-recent-av placeholder">${esc((a.username || "?").slice(0, 1).toUpperCase())}</div>`
              }
              <div class="name" style="font-weight:700">${esc(a.username)}${a.me ? ` (${T("Sen")})` : ""}</div>
              <div style="color:var(--fs-text-dim)">${esc(a.rating)}</div>
              <div class="xp" style="text-align:right">${a.xp} <span class="${a.delta >= 0 ? "fs-delta-up" : "fs-delta-dn"}">${a.delta >= 0 ? "↑" : "↓"}</span></div>
            </div>`,
            )
            .join("")}
          <div class="fs-v3-card" style="margin-top:10px;padding:12px;background:rgba(245,197,66,0.06)">
            <div style="display:flex;gap:10px;align-items:center">
              <div style="font-size:22px">♞</div>
              <div class="fs-v3-sub" style="color:var(--fs-text)">${T("Harika gidiyorsun! Oynamaya devam et, bu hafta ilk 5'e girebilirsin.")}</div>
            </div>
          </div>
        </div>
        <div>
          <div class="fs-v3-card">
            <div class="fs-v3-kicker">${T("LİG YAPISI")}</div>
            <div class="fs-league-track">
              ${leagues
                .map(
                  (L) => `
                <div class="fs-league-badge ${L.id === leagueMeta.id ? "on" : ""}">
                  <div class="shield">${L.ico}</div>
                  <strong>${esc(L.label)}</strong>
                  <span>${esc(L.range)}</span>
                </div>`,
                )
                .join("")}
            </div>
            <div style="margin-top:12px;padding:10px;border-radius:10px;border:1px solid rgba(245,197,66,0.3);color:var(--fs-accent);font-size:12px;font-weight:700">
              👑 ${
                nextLeague
                  ? T("Özel ödüller için {league} Lig'e ulaş!").replace(
                      "{league}",
                      nextLeague.label,
                    )
                  : T("En üst ligdesin — zirveyi koru!")
              }
            </div>
          </div>
          <div class="fs-v3-card" style="margin-top:12px">
            <div class="fs-v3-kicker">${T("KAZANABİLECEĞİN ÖDÜLLER")}</div>
            <div class="fs-comp-grid" style="grid-template-columns:repeat(4,1fr);gap:0;margin-top:8px">
              <div class="fs-reward-cell"><div class="fs-comp-ico">✦</div><strong>${T("XP Takviyeleri")}</strong><span>${T("Antrenmanla daha fazla XP kazan.")}</span></div>
              <div class="fs-reward-cell gold"><div class="fs-comp-ico">🛡</div><strong>${T("Özel Rozetler")}</strong><span>${T("Başarılarını sergile.")}</span></div>
              <div class="fs-reward-cell"><div class="fs-comp-ico">▦</div><strong>${T("Özel Temalar")}</strong><span>${T("Güzel tahta temalarını aç.")}</span></div>
              <div class="fs-reward-cell gold"><div class="fs-comp-ico">👑</div><strong>${T("Benzersiz Unvanlar")}</strong><span>${T("Arenada öne çık.")}</span></div>
            </div>
          </div>
        </div>
      </div>
      <div class="fs-quote-banner" style="margin-top:14px;min-height:64px">
        <img src="${esc(v3Url("quote-cinematic-pieces.png"))}" alt="" />
        <div class="fs-quote-txt" style="font-size:14px">
          “${T("Her rakip büyüme fırsatıdır.")}”
          <div class="fs-quote-sub">${T("Yarış, öğren, geliş.")}</div>
          <span class="fs-quote-sig">— ForkSight Coach</span>
        </div>
      </div>
    `;
  }

  async function loadLeaderboard(metric) {
    const m = metric || cache.leaderboard.metric || "points";
    cache.leaderboard.metric = m;
    cache.leaderboard.loading = true;
    cache.leaderboard.data = null;
    if (activeTab === "arena") renderActive();
    try {
      const r = await send("leaderboard", {
        metric: m,
        limit: 50,
        scope: "league",
      });
      cache.leaderboard.data = r && r.ok ? r : { top: [], me: {}, league: {} };
    } catch (_) {
      cache.leaderboard.data = { top: [], me: {}, league: {} };
    }
    cache.leaderboard.loading = false;
    if (activeTab === "arena") renderActive();
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
    if (!cache.verifyCode && !cache.verifyCodeLoading) {
      ensureVerifyCode().then((c) => {
        if (c && panelEl && activeTab === "settings") renderActive();
      });
    }
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
        ${
          ccu
            ? `<div class="fs-v3-sub" style="margin-bottom:8px">${T("Bağlı:")} <b>${esc(ccu)}</b></div>`
            : renderVerifyCodeBox({ compact: true })
        }
        <div class="fs-set-control">
          <input type="text" class="fs-input" data-set="ccu" value="${esc(ccu)}" placeholder="${T("kullanıcı adı")}" />
          <button class="fs-btn" data-act="save-ccu">${T("Kaydet")}</button>
        </div>
        <div class="fs-msg" data-msg="ccu"></div>
        ${
          ccu
            ? `<div class="fs-onboard-tip" style="margin-top:8px">${T("Hesabı değiştirirken yeni kullanıcı adının profilinde doğrulama kodun görünmeli.")} ${cache.verifyCode ? `<code class="fs-verify-code">${esc(cache.verifyCode)}</code> <button type="button" class="fs-btn fs-ghost" data-act="copy-verify-code">${T("Kopyala")}</button>` : ""}</div>`
            : ""
        }
      </div>
      <div class="fs-set-row">
        <div class="fs-set-lab">${T("Kullanım / Kota")}</div>
        ${renderQuotaStrip()}
      </div>
      <div class="fs-set-row">
        <div class="fs-set-lab">${T("Veriler")}</div>
        <div class="fs-set-control" style="display:flex; flex-direction:column; gap:6px;">
          <button class="fs-btn fs-ghost" data-act="resync" style="width:100%" ${cache.sync.active ? "disabled" : ""}>${T("↻ Oyunları Yeniden Senkronize Et")}</button>
          <button class="fs-btn fs-ghost" data-act="resync-force" style="width:100%" ${cache.sync.active ? "disabled" : ""}>${T("⟳ Tüm Veriyi Sıfırla ve Yeniden Çek")}</button>
        </div>
        <div class="fs-msg" data-msg="sync"></div>
        <div data-sync-live style="margin-top:8px">${
          cache.sync.active || cache.sync.progress > 0
            ? renderSyncProgressBox({ forceShow: true, always: true })
            : `<div class="fs-v3-sub" style="font-size:11px">${T("Sync bitince yüzde ve oyun sayısı burada görünür. Sayfa yenilemen gerekmez — Oyunlarım sekmesinden bak.")}</div>`
        }</div>
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
    if (activeTab === "home") html = renderHomeTab();
    else if (activeTab === "coach") html = renderCoachTab();
    else if (activeTab === "training") html = renderPuzzlesTab();
    else if (activeTab === "games") html = renderGamesTab();
    else if (activeTab === "progress") html = renderProgressTab();
    else if (activeTab === "achievements") html = renderAchievementsTab();
    else if (activeTab === "arena") html = renderLeaderboardTab();
    else if (activeTab === "profile") html = renderProfileTab();
    else if (activeTab === "settings") html = renderSettingsTab();
    body.innerHTML = html;
    panelEl.querySelectorAll(".fs-tab").forEach((t) => {
      t.classList.toggle("fs-active", t.dataset.tab === activeTab);
    });
    updateHeaderGreeting();
    bindBody();
    if (activeTab === "training") mountQuizBoard();
    if (activeTab === "coach") {
      const grid = panelEl.querySelector(".fs-cpick-grid");
      if (grid) bindCoachCarousel(grid);
    }
  }

  function bindCoachCarousel(grid) {
    if (!grid || grid.dataset.carouselBound === "1") return;
    grid.dataset.carouselBound = "1";

    grid.addEventListener(
      "wheel",
      (ev) => {
        // Vertical wheel scrolls the page. Only hijack for intentional horizontal
        // (trackpad sideways or Shift+wheel).
        const horizontalIntent =
          Math.abs(ev.deltaX) > Math.abs(ev.deltaY) || ev.shiftKey;
        if (!horizontalIntent) return;
        if (grid.scrollWidth <= grid.clientWidth + 2) return;
        const delta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.deltaY;
        ev.preventDefault();
        grid.scrollLeft += delta;
      },
      { passive: false },
    );

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScroll = 0;
    let pointerId = null;

    const onMove = (ev) => {
      if (!dragging || (pointerId != null && ev.pointerId !== pointerId)) return;
      const dx = ev.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        grid.classList.add("fs-dragging");
        try {
          if (pointerId != null) grid.setPointerCapture(pointerId);
        } catch (_) {}
      }
      if (!moved) return;
      grid.scrollLeft = startScroll - dx;
      ev.preventDefault();
    };

    const onUp = (ev) => {
      if (!dragging || (pointerId != null && ev.pointerId !== pointerId)) return;
      dragging = false;
      grid.classList.remove("fs-dragging");
      try {
        if (pointerId != null && grid.hasPointerCapture(pointerId)) {
          grid.releasePointerCapture(pointerId);
        }
      } catch (_) {}
      pointerId = null;
      if (moved) {
        const swallow = (e) => {
          e.preventDefault();
          e.stopPropagation();
          grid.removeEventListener("click", swallow, true);
        };
        grid.addEventListener("click", swallow, true);
        setTimeout(() => grid.removeEventListener("click", swallow, true), 0);
      }
    };

    grid.addEventListener("pointerdown", (ev) => {
      if (ev.button != null && ev.button !== 0) return;
      if (ev.target.closest && ev.target.closest(".fs-cpick-arrow")) return;
      if (grid.scrollWidth <= grid.clientWidth + 2) return;
      dragging = true;
      moved = false;
      startX = ev.clientX;
      startScroll = grid.scrollLeft;
      pointerId = ev.pointerId;
    });
    grid.addEventListener("pointermove", onMove);
    grid.addEventListener("pointerup", onUp);
    grid.addEventListener("pointercancel", onUp);
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
        // Bağlı ama oyun yok → onboarding sync adımına al
        const u = resp.user || {};
        const ccu = (u.chess_com_username || "").trim();
        const games =
          Number((resp.stats && resp.stats.total_games) || 0) ||
          (resp.recent_games || []).length;
        if (ccu && games === 0 && !cache.onboard.dismissed) {
          cache.onboard.step = Math.max(cache.onboard.step, 2);
          if (!cache.sync.active && !cache.sync.pollId) {
            // Sessizce durum kontrolü; gerekirse kullanıcı sync başlatır
            pollSyncStatusOnce();
          }
        } else if (ccu && games > 0) {
          cache.onboard.step = 3;
        }
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
    if (activeTab === "home" || activeTab === "profile" || activeTab === "progress" || activeTab === "settings" || activeTab === "coach")
      renderActive();
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
    if (activeTab === "coach") renderActive();
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

  function _fmtUciMove(uci) {
    const u = String(uci || "").toLowerCase();
    if (u.length < 4) return u || "—";
    const promo = u.length > 4 ? u.slice(4).toUpperCase() : "";
    return u.slice(0, 2) + " → " + u.slice(2, 4) + (promo ? "=" + promo : "");
  }

  function _renderQuizOutcomeCard(result) {
    const r = result || {};
    const ok = !!r.correct;
    const moveLabel = ok
      ? _fmtUciMove(r.userUci)
      : _fmtUciMove(r.expectedUci || r.userUci);
    const title = ok ? T("Harika! Doğru çözüm") : T("Yanlış hamle");
    const kicker = ok ? T("ÇÖZÜLDÜ") : T("DOĞRU HAMLE");
    let sub = "";
    if (ok) {
      const pts = r.pointsDelta != null ? Number(r.pointsDelta) : 0;
      sub =
        (pts >= 0 ? "+" : "") +
        pts +
        " " +
        T("puan") +
        (r.rating != null ? " · rating " + r.rating : "");
    } else if (r.expectedUci || r.expectedSan) {
      sub = T(
        "Tahtada yeşil ok doğru hamleyi gösteriyor. İstediğin kadar incele.",
      );
    } else {
      sub = T("Çözümü incele, sonra listeye dön.");
    }
    return `
      <div class="fs-quiz-outcome ${ok ? "fs-ok" : "fs-err"}" data-quiz-outcome>
        <div class="fs-quiz-outcome-kicker">${esc(kicker)}</div>
        <div class="fs-quiz-outcome-title">${esc(title)}</div>
        <div class="fs-quiz-outcome-move">${esc(moveLabel)}</div>
        <div class="fs-quiz-outcome-sub">${esc(sub)}</div>
        <div class="fs-quiz-outcome-actions">
          <button class="fs-btn" data-quiz-act="continue">${T("Listeye dön")}</button>
          ${
            !ok &&
            !_isLichessPuzzle((cache.puzzles && cache.puzzles.puzzle) || {})
              ? `<button class="fs-btn fs-ghost" data-quiz-act="share">🔗 ${T("Paylaş")}</button>`
              : ""
          }
        </div>
      </div>`;
  }

  function syncQuizHintButtons() {
    const p = cache.puzzles;
    if (!panelEl) return;
    const used = Number(p.usedHint) || 0;
    const settled = !!(p.result && p.result.settled);
    const isLichess = _isLichessPuzzle(p.puzzle || {});
    panelEl.querySelectorAll("[data-quiz-hint]").forEach((b) => {
      const lv = parseInt(b.dataset.quizHint, 10);
      b.classList.remove("fs-active");
      if (isLichess || settled) {
        b.disabled = true;
        return;
      }
      if (lv <= used) {
        b.classList.add("fs-active");
        b.disabled = true;
        b.title = T("İpucu alındı");
      } else if (lv === used + 1) {
        b.disabled = false;
        b.title = T("İpucu") + " " + lv;
      } else {
        b.disabled = true;
        b.title = T("Önce ipucu {n}").replace("{n}", String(lv - 1));
      }
    });
    const reward = panelEl.querySelector("[data-quiz-reward]");
    if (reward) {
      const pts = _QUIZ_POINTS_BY_HINT_CLIENT[used] || 10;
      reward.textContent = `+${pts} ${T("puan")}`;
    }
  }

  /** Final doğru/yanlış: tahtada animasyon + kalıcı kart. Otomatik kapanmaz. */
  async function presentQuizOutcome(opts) {
    const p = cache.puzzles;
    const o = opts || {};
    const phrase =
      o.phrase ||
      (o.correct ? T("Aferin, doğru hamle!") : T("Yanlış. Tekrar dene."));
    p.result = {
      settled: true,
      correct: !!o.correct,
      userUci: o.userUci || "",
      expectedUci: o.expectedUci || "",
      expectedSan: o.expectedSan || "",
      pointsDelta: o.pointsDelta,
      rating: o.rating,
      phrase,
    };
    stopQuizTimer();
    setQuizFlash(o.correct ? "ok" : "err", phrase);
    if (p.board) {
      try {
        p.board.lock(true);
      } catch (_) {}
    }
    if (panelEl) {
      panelEl
        .querySelectorAll(
          "[data-quiz-hint],[data-quiz-submit],[data-quiz-skip]",
        )
        .forEach((b) => (b.disabled = true));
      const flashEl = panelEl.querySelector(
        ".fs-quiz-flash, [data-quiz-outcome]",
      );
      if (flashEl) {
        const wrap = document.createElement("div");
        wrap.innerHTML = _renderQuizOutcomeCard(p.result);
        const card = wrap.firstElementChild;
        if (card) flashEl.replaceWith(card);
      }
      const actions = panelEl.querySelector(".fs-quizv2-actions");
      if (actions) actions.style.display = "none";
      const coachText = panelEl.querySelector(".fs-quizv2-coach-text");
      if (coachText) coachText.textContent = phrase;
      const coachAv = panelEl.querySelector(".fs-quizv2-coach-av");
      if (coachAv) {
        const mood = o.correct ? "happy" : "worried";
        coachAv.src = _avatarUrl(mood);
        _bindQuizCoachFallback(coachAv, mood);
      }
    }
    syncQuizHintButtons();

    if (p.board && typeof p.board.revealSolution === "function" && p.puzzle) {
      try {
        if (o.correct) {
          if (o.userUci && o.userUci.length >= 4) {
            p.board.flash(o.userUci.slice(0, 2), o.userUci.slice(2, 4), "ok");
          }
        } else {
          await p.board.revealSolution({
            // Hamle öncesi FEN (mate-2 adım 2 dahil); board.lastFenBeforeMove yedek
            fen: null,
            sideToMove: null,
            wrongUci: o.userUci,
            correctUci: o.expectedUci,
          });
        }
      } catch (_) {}
    }
  }

  function setQuizFlash(kind, msg) {
    cache.puzzles.flash = { kind: kind || "", msg: msg || "" };
    if (cache.puzzles.result && cache.puzzles.result.settled) return;
    if (activeTab === "training") {
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
          coach_review: T("Sesli koç incelemesi"),
          quiz_play: T("Bulmaca oynama"),
          hint: T("Bulmaca ipucu"),
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
  const _coachAudioCache = new Map(); // key "lang|coach|text" → object URL
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
  async function speakCoach(text, opts) {
    if (!text) return;
    if (cache.puzzles && cache.puzzles.ttsMuted) return;
    const reqId = ++_coachReqSeq;
    _coachStopAudio();
    const t = String(text).trim();
    if (!t) return;
    const coachId = String(
      (opts && opts.coachId) || selectedCoachId || "tilki",
    ).toLowerCase();
    const roster = coachRoster();
    const coachRow = roster.find((c) => c.id === coachId) || roster[0];
    const voiceId = String(
      (opts && opts.voiceId) || (coachRow && coachRow.voiceId) || "",
    ).trim();
    // TTS dili UI diliyle eşleşmeli (EN seçiliyse İngilizce seslendirme).
    const ttsLang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
        ? "en"
        : "tr";
    try {
      // Cache anahtarı dil + koç + voice id'ye özgü olmalı.
      const cacheKey = ttsLang + "|" + coachId + "|" + voiceId + "|" + t;
      let url = _coachAudioCache.get(cacheKey);
      if (!url) {
        const base = await _coachGetBase();
        if (reqId !== _coachReqSeq) return;
        if (!base) return;
        let endpoint =
          base +
          "/tts?lang=" +
          ttsLang +
          "&coach=" +
          encodeURIComponent(coachId) +
          "&text=" +
          encodeURIComponent(t) +
          "&v=el4";
        if (voiceId) endpoint += "&voice=" + encodeURIComponent(voiceId);
        let authHeaders = {};
        try {
          const tk = await send("get_token");
          if (tk && tk.token)
            authHeaders.Authorization = "Bearer " + tk.token;
        } catch (_) {}
        const res = await fetch(endpoint, {
          method: "GET",
          headers: authHeaders,
        });
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
    const themes = String((pz && pz.themes) || "").toLowerCase();
    const TH = {
      fork: "çatal",
      pin: "mıhlama",
      skewer: "şiş",
      discovered_check: "keşif şahı",
      double_check: "çifte şah",
      back_rank: "geri sıra matı",
      sacrifice: "feda",
      hanging: "korumasız taş kazanımı",
      promotion: "terfi",
      capture: "alış",
      check: "şah",
    };
    let lbl = "";
    for (const key in TH) {
      if (themes.includes(key)) {
        lbl = T(TH[key]);
        break;
      }
    }
    const N = window.ForkSightCoachNarration;
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
        ? "en"
        : "tr";
    const coach =
      (typeof selectedCoachId !== "undefined" && selectedCoachId) || "tilki";
    if (N && typeof N.quizPhrase === "function") {
      if (lbl) return N.quizPhrase(coach, lang, "correctTheme", lbl);
      return N.quizPhrase(coach, lang, "correct");
    }
    if (lbl) {
      return T("Aferin! Bu güzel bir {lbl} hamlesiydi.").replace("{lbl}", lbl);
    }
    return T("Aferin, doğru hamle!");
  }
  function _coachPhraseForWrong(expectedSan) {
    const N = window.ForkSightCoachNarration;
    const lang =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
        ? "en"
        : "tr";
    const coach =
      (typeof selectedCoachId !== "undefined" && selectedCoachId) || "tilki";
    if (N && typeof N.quizPhrase === "function") {
      if (expectedSan) return N.quizPhrase(coach, lang, "wrongSan", expectedSan);
      return N.quizPhrase(coach, lang, "wrong");
    }
    if (expectedSan) {
      return T("Yanlış. Doğru hamle {san} idi.").replace("{san}", expectedSan);
    }
    return T("Yanlış. Tekrar dene.");
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
    syncQuizHintButtons();
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
    p.result = null;
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
    if (activeTab === "training") renderActive();
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
    if (activeTab === "training" && p.view === "lobby") renderActive();
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
        if (activeTab === "training" && p.view === "lobby") renderActive();
        return;
      }
    } catch (e) {
      setQuizFlash("err", String(e.message || e));
      p.backfilling = false;
      if (activeTab === "training" && p.view === "lobby") renderActive();
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
      if (activeTab === "training" && p.view === "lobby") renderActive();
    }, 3000);
  }

  function setQuizView(v) {
    cache.puzzles.view = v;
    // Panel boyutunu çözüm/önizlemede büyüt
    if (panelEl) {
      const expanded = v === "solving" || v === "preview";
      panelEl.classList.toggle("fs-panel-quiz", expanded);
    }
    if (activeTab === "training") {
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
    p.result = null;
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
        setQuizView("solving");
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
    p.result = null;
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
    p.result = null;
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
    p.result = null;
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
    if (activeTab === "training") {
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
    if (activeTab === "training") {
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
    if (p.result && p.result.settled) return;
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
          .forEach((b) => {
            if (b.dataset.quizHint) return;
            b.disabled = false;
          });
        syncQuizHintButtons();
        return;
      }

      if (isLichess && r && r.ok && r.correct && r.done) {
        stopQuizTimer();
        const at = r.attempt || {};
        const phrase =
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
          ")";
        try {
          speakCoach(_coachPhraseForCorrect(p.puzzle));
        } catch (_) {}
        await presentQuizOutcome({
          correct: true,
          userUci: uci,
          pointsDelta: at.points_delta,
          rating: at.new_rating,
          phrase,
        });
        await refreshQuizStats();
        return;
      }

      if (isLichess && r && r.ok && !r.correct) {
        stopQuizTimer();
        const phrase =
          T("Yanlış.") +
          (r.expected_uci
            ? " " + T("Doğru cevap") + ": " + r.expected_uci
            : "");
        try {
          speakCoach(
            _coachPhraseForWrong(r.expected_san || r.expected_uci || ""),
          );
        } catch (_) {}
        await presentQuizOutcome({
          correct: false,
          userUci: uci,
          expectedUci: r.expected_uci || "",
          expectedSan: r.expected_san || "",
          phrase,
        });
        await refreshQuizStats();
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
          speakCoach(T("Doğru! Şimdi mat hamlesini bul."));
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
          .forEach((b) => {
            if (b.dataset.quizHint) return; // ipuçları sync ile
            b.disabled = false;
          });
        syncQuizHintButtons();
        return;
      }
      if (r && r.ok && r.correct) {
        const phrase =
          T("Doğru!") +
          " +" +
          (r.points_delta ?? 0) +
          " " +
          T("puan") +
          " · rating " +
          (r.rating ?? "");
        try {
          speakCoach(_coachPhraseForCorrect(p.puzzle));
        } catch (_) {}
        await presentQuizOutcome({
          correct: true,
          userUci: uci,
          pointsDelta: r.points_delta,
          rating: r.rating,
          phrase,
        });
        await refreshQuizStats();
      } else if (r && r.ok && !r.correct) {
        const phrase =
          T("Yanlış.") +
          (r.expected_uci
            ? " " + T("Doğru cevap") + ": " + r.expected_uci
            : "");
        try {
          speakCoach(
            _coachPhraseForWrong(r.expected_san || r.expected_uci || ""),
          );
        } catch (_) {}
        await presentQuizOutcome({
          correct: false,
          userUci: uci,
          expectedUci: r.expected_uci || "",
          expectedSan: r.expected_san || "",
          phrase,
        });
        await refreshQuizStats();
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
    if (p.result && p.result.settled) return;
    if (_isLichessPuzzle(p.puzzle)) {
      setQuizFlash("info", T("Lichess bulmacalarında ipucu kapalı."));
      return;
    }
    const next = (Number(p.usedHint) || 0) + 1;
    if (level !== next) {
      setQuizFlash(
        "info",
        T("İpuçları sırayla açılır. Önce ipucu {n}.").replace(
          "{n}",
          String(next),
        ),
      );
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
        syncQuizHintButtons();
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
    if (id === "training") {
      activeTab = id;
      renderActive();
      ensurePuzzles();
      return;
    }
    // Antrenman dışı sekmeye geçerken aktif tahta/timer'ı temizle
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
    if (id === "home" || id === "profile" || id === "progress" || id === "settings")
      ensureProfile();
    else if (id === "games") {
      if (!cache.games.items.length) loadGames(true);
    } else if (id === "coach") {
      ensureProfile();
      ensureWeakness();
      if (coachSubTab === "mine") ensureCoachPlayGames();
    } else if (id === "arena") {
      ensureProfile();
      loadLeaderboard(cache.leaderboard.metric || "points");
    }
    if (id === "profile") loadAchievements(false);
    ensureNotifications(false);
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
        if (a === "more-games" || a === "go-games") switchTab("games");
        else if (a === "go-training") switchTab("training");
        else if (a === "coach-play") {
          const c = getSelectedCoach();
          if (c && c.comingSoon) return;
          if (window.ForkSightProfile && typeof window.ForkSightProfile.close === "function") {
            window.ForkSightProfile.close();
          }
          if (window.ForkSightCoachPlay && typeof window.ForkSightCoachPlay.open === "function") {
            setTimeout(() => {
              window.ForkSightCoachPlay.open({ coach: c, speak: speakCoach });
            }, 80);
          }
        }
        else if (a === "go-coach") switchTab("coach");
        else if (a === "go-progress") switchTab("progress");
        else if (a === "go-achievements") switchTab("achievements");
        else if (a === "go-arena") switchTab("arena");
        else if (a === "go-settings") switchTab("settings");
        else if (a === "arena-chest") playChestOpen();
        else if (a === "arena-how") {
          const host = panelEl.querySelector(".fs-body");
          if (host) {
            let tip = host.querySelector(".fs-arena-how-tip");
            if (tip) {
              tip.remove();
            } else {
              tip = document.createElement("div");
              tip.className = "fs-v3-card fs-arena-how-tip";
              tip.style.cssText = "margin:0 0 14px;border-color:rgba(245,197,66,0.35)";
              tip.innerHTML = `<div class="fs-v3-kicker">${T("Ligler Nasıl İşler")}</div><div class="fs-v3-sub" style="margin-top:6px;color:var(--fs-text)">${T("Ligler ForkSight bulmaca reytingine göre belirlenir; sıralama bulmaca XP'sine göredir. chess.com reytingi Arena'yı etkilemez.")}</div>`;
              host.insertBefore(tip, host.firstChild);
            }
          }
        }
        else if (a === "open-chesscom") {
          const user = act.dataset.user;
          if (user) {
            const url = "https://www.chess.com/member/" + encodeURIComponent(user);
            try { chrome.tabs.create({ url }); } catch (_) { window.open(url, "_blank"); }
          }
        }
        else if (a === "load-more") loadGames(false);
        else if (a === "save-ccu") onSaveCcu();
        else if (a === "resync") onResync(false);
        else if (a === "resync-force") onResync(true);
        else if (a === "copy-verify-code") {
          const code =
            cache.verifyCode ||
            (act.closest(".fs-set-row, .fs-onboard-card") &&
              (act.closest(".fs-set-row, .fs-onboard-card").querySelector("[data-verify-code], .fs-verify-code") ||
                {}).textContent) ||
            "";
          const text = String(code || "").trim();
          if (text) {
            const done = () => {
              const prev = act.textContent;
              act.textContent = T("Kopyalandı");
              setTimeout(() => {
                act.textContent = prev || T("Kopyala");
              }, 1200);
            };
            try {
              if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(done).catch(() => {});
              } else {
                done();
              }
            } catch (_) {}
          } else {
            ensureVerifyCode().then(() => renderActive());
          }
        }
        else if (a === "onboard-next") {
          cache.onboard.step = Math.min(3, (cache.onboard.step || 0) + 1);
          if (cache.onboard.step === 1) ensureVerifyCode();
          renderActive();
        } else if (a === "onboard-skip" || a === "onboard-finish") {
          cache.onboard.dismissed = true;
          cache.onboard.step = 3;
          try {
            chrome.storage.local.set({ fs_onboard_done: 1 });
          } catch (_) {}
          renderActive();
        } else if (a === "onboard-link") {
          onOnboardLink();
        }
        else if (a === "logout") onLogout();
        else if (a === "premium") openPremiumPage();
        else if (a === "lang-en" || a === "lang-tr") {
          if (window.ForkSightI18n) {
            window.ForkSightI18n.setLang(a === "lang-en" ? "en" : "tr");
          }
        } else if (a === "lang-toggle") {
          if (window.ForkSightI18n) window.ForkSightI18n.toggleLang();
        } else if (a === "coach-tab") {
          coachSubTab = act.dataset.tab === "mine" ? "mine" : "all";
          if (coachSubTab === "mine") ensureCoachPlayGames(true);
          else renderActive();
        } else if (a === "coach-game-analyze") {
          const gid = act.dataset.cpgId;
          if (gid) openCoachPlayGame(gid);
        } else if (a === "coach-select") {
          const id = act.dataset.coach || "tilki";
          const coach = coachRoster().find((x) => x.id === id);
          if (coach && coach.comingSoon) return;
          if (coach && coach.pro && !isUserPremium()) {
            openPremiumPage();
            return;
          }
          selectedCoachId = id;
          try {
            chrome.storage.local.set({ fs_selected_coach: id });
          } catch (_) {}
          try {
            if (
              window.ForkSightAvatar &&
              typeof window.ForkSightAvatar.setCoach === "function"
            ) {
              window.ForkSightAvatar.setCoach(id);
            }
          } catch (_) {}
          renderActive();
          speakCoachGreeting(id);
        } else if (a === "coach-lock") {
          openPremiumPage();
        } else if (a === "coach-active") {
          coachSubTab = "mine";
          renderActive();
          speakCoachGreeting(selectedCoachId);
        } else if (a === "coach-scroll") {
          const grid = panelEl.querySelector(".fs-cpick-grid");
          if (grid) {
            const dir = Number(act.dataset.dir) || 1;
            const step = 250;
            grid.scrollBy({ left: dir * step, behavior: "smooth" });
          }
        } else if (a === "coach-compare") {
          const body = panelEl.querySelector(".fs-body");
          if (body) {
            let tip = body.querySelector(".fs-coach-compare-tip");
            if (tip) tip.remove();
            else {
              tip = document.createElement("div");
              tip.className = "fs-v3-card fs-coach-compare-tip";
              tip.style.cssText = "margin:0 0 12px;border-color:rgba(61,214,140,0.35)";
              const rows = coachRoster()
                .map((c) => {
                  const top = (c.skills || []).slice().sort((a, b) => b.n - a.n)[0];
                  return `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span><b style="color:#f3d27a">${esc(c.name)}</b> · ${esc(c.title)}</span>
                    <span style="color:var(--fs-text-dim)">${esc(top ? top.lab : "")} ${esc(String(top ? top.n : ""))}</span>
                  </div>`;
                })
                .join("");
              tip.innerHTML = `<div class="fs-v3-kicker">${T("COMPARE COACHES")}</div>${rows}`;
              body.insertBefore(tip, body.firstChild);
            }
          }
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
        else if (a === "back" || a === "continue") backToLobby();
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
        msg.textContent = T(
          "Bağlandı: {user}. Oyunlar çekiliyor — ilerlemeyi aşağıda izle.",
        ).replace("{user}", resp.chess_com_username);
        cache.profile = null;
        cache.games.items = [];
        cache.weakness = null;
        cache.onboard.step = Math.max(cache.onboard.step, 2);
        startSyncPoll({
          message: T("Chess.com hesabından oyunlar çekiliyor…"),
          onDone: () => {
            if (msg) {
              msg.className = "fs-msg fs-ok";
              msg.textContent = T(
                "Tamamlandı. Oyunlarım sekmesinden bakabilirsin — sayfa yenilemeye gerek yok.",
              );
            }
          },
        });
        setTimeout(() => ensureProfile(true), 800);
      } else {
        msg.className = "fs-msg fs-err";
        msg.textContent = chessLinkErrorMessage(resp);
        if (resp && resp.verify_code) {
          cache.verifyCode = String(resp.verify_code);
        }
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
    if (msg) {
      msg.className = "fs-msg";
      msg.textContent = T("Senkronize ediliyor…");
    }
    try {
      const resp = await send("chess_com_sync", { force: !!force });
      if (resp && resp.ok) {
        if (msg) {
          msg.className = "fs-msg fs-ok";
          msg.textContent = resp.purged
            ? T("Eski veriler temizlendi. Yeni oyunlar çekiliyor…")
            : T("Senkronizasyon başladı — yüzde aşağıda güncellenir.");
        }
        cache.profile = null;
        cache.games.items = [];
        cache.weakness = null;
        if (cache.puzzles) {
          cache.puzzles.stats = null;
          cache.puzzles.totalPuzzles = 0;
          cache.puzzles.history = [];
          cache.puzzles.autoBackfillTried = false;
        }
        startSyncPoll({
          message: force
            ? T("Sıfırdan yeniden çekiliyor…")
            : T("Yeni oyunlar aranıyor…"),
          onDone: () => {
            if (msg) {
              msg.className = "fs-msg fs-ok";
              msg.textContent = T(
                "Bitti! Oyunlar güncellendi. Oyunlarım’a geç — yenilemeye gerek yok.",
              );
            }
            if (btn) btn.disabled = false;
            if (otherBtn) otherBtn.disabled = false;
          },
        });
        return;
      }
      if (msg) {
        msg.className = "fs-msg fs-err";
        msg.textContent = (resp && resp.detail) || T("Hata.");
      }
    } catch (_) {
      if (msg) {
        msg.className = "fs-msg fs-err";
        msg.textContent = T("Sunucuya ulaşılamadı.");
      }
    } finally {
      if (!cache.sync.active) {
        if (btn) btn.disabled = false;
        if (otherBtn) otherBtn.disabled = false;
      }
    }
  }

  async function onOnboardLink() {
    const input = panelEl.querySelector("[data-onboard-ccu]");
    const msg = panelEl.querySelector('[data-msg="onboard-ccu"]');
    const v = ((input && input.value) || "").trim();
    if (!v) {
      if (msg) {
        msg.className = "fs-msg fs-err";
        msg.textContent = T("Boş olamaz.");
      }
      return;
    }
    cache.onboard.linking = true;
    if (msg) {
      msg.className = "fs-msg";
      msg.textContent = T("Kaydediliyor…");
    }
    try {
      const resp = await send("chess_com_link", { chess_com_username: v });
      if (resp && resp.ok) {
        cache.onboard.step = 2;
        cache.profile = null;
        cache.games.items = [];
        renderActive();
        startSyncPoll({
          message: T("İlk oyunların çekiliyor…"),
          onDone: () => {
            cache.onboard.step = 3;
            try {
              chrome.storage.local.set({ fs_onboard_done: 1 });
            } catch (_) {}
            if (activeTab === "home") renderActive();
          },
        });
      } else {
        if (msg) {
          msg.className = "fs-msg fs-err";
          msg.textContent = chessLinkErrorMessage(resp);
        }
        if (resp && resp.verify_code) {
          cache.verifyCode = String(resp.verify_code);
          renderActive();
        }
      }
    } catch (_) {
      if (msg) {
        msg.className = "fs-msg fs-err";
        msg.textContent = T("Sunucuya ulaşılamadı.");
      }
    } finally {
      cache.onboard.linking = false;
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
  function updateHeaderGreeting() {
    if (!panelEl) return;
    panelEl.dataset.tab = activeTab || "";
    const left = panelEl.querySelector(".fs-header-left");
    const pills = panelEl.querySelector(".fs-stat-pills");
    if (!left) return;
    const u = (cache.profile && cache.profile.user) || null;
    const g = greetingLine(u);
    if (activeTab === "home") {
      left.innerHTML = `<div class="fs-greet-title">${esc(g.title)}</div><div class="fs-greet-sub">${esc(g.sub)}</div>`;
    } else if (activeTab === "coach") {
      left.innerHTML = `<div class="fs-greet-title">${T("CHOOSE YOUR AI COACH")}</div><div class="fs-greet-sub">${T("Every great player has the right coach.")}</div>`;
    } else if (activeTab === "training") {
      left.innerHTML = `<div class="fs-greet-title">${T("Antrenman")}</div><div class="fs-greet-sub">${T("Alışkanlıklarını güçlendir, pozisyon pozisyon.")}</div>`;
    } else if (activeTab === "profile") {
      left.innerHTML = "";
    } else if (activeTab === "arena") {
      left.innerHTML = `<div class="fs-greet-title">Arena</div><div class="fs-greet-sub">${T("Ligde yüksel. Oyununu keskinleştir.")}</div>`;
    } else {
      const tab = TABS.find((x) => x.id === activeTab);
      left.innerHTML = `<div class="fs-greet-title">${esc(T(tab ? tab.trLabel : "ForkSight"))}</div><div class="fs-greet-sub">${esc(g.sub)}</div>`;
    }
    if (pills && u) {
      const level = Math.max(1, Math.floor((Number(u.highest_rating) || 1000) / 80));
      const xpNow = Math.min(2999, (Number(u.streak_count) || 0) * 120 + 1800);
      const xpMax = 3000;
      const avInner = u.chess_com_avatar
        ? `<img class="fs-header-av" src="${esc(u.chess_com_avatar)}" alt="" />`
        : `<div class="fs-header-av" style="display:grid;place-items:center;background:#222633;font-size:13px;font-weight:800">${esc((u.username || "?").slice(0, 1).toUpperCase())}</div>`;
      const av = `<div class="fs-header-av-wrap">${avInner}</div>`;
      if (activeTab === "home") {
        pills.innerHTML = av;
      } else if (activeTab === "training" || activeTab === "arena" || activeTab === "coach") {
        pills.innerHTML = `
          <div class="fs-train-stats">
            <div class="fs-train-streak">
              <div class="fs-hs-ico">🔥</div>
              <div>
                <div class="fs-hs-val">${esc(u.streak_count || 0)}</div>
                <div class="fs-hs-lab">${T("Günlük Seri")}</div>
              </div>
            </div>
            <div class="fs-train-level">
              <div class="fs-hs-ico fs-hs-shield">★</div>
              <div class="fs-hs-txt">
                <div class="fs-hs-lab">${T("Seviye")} <strong>${level}</strong></div>
                <span class="fs-skill-bar"><i style="width:${Math.round((xpNow / xpMax) * 100)}%"></i></span>
                <div class="fs-xp-lab">${xpNow.toLocaleString()} / ${xpMax.toLocaleString()} XP</div>
              </div>
            </div>
            ${av}
          </div>`;
      } else if (activeTab === "profile") {
        pills.innerHTML = av;
      } else {
      const xpHome = Math.min(1199, (Number(u.streak_count) || 0) * 80 + 400);
      pills.innerHTML = `
        <div class="fs-stat-bar">
          <span class="fs-pill">🛡 <strong>${T("Seviye")} ${level}</strong></span>
          <span class="fs-stat-sep"></span>
          <span class="fs-pill">♟ <strong>${esc(u.highest_rating || "—")}</strong></span>
          <span class="fs-stat-sep"></span>
          <span class="fs-pill">🔥 <strong>${esc(u.streak_count || 0)}</strong> ${T("gün")}</span>
          <span class="fs-stat-sep"></span>
          <span class="fs-pill fs-xp-inline"><strong>${xpHome}/1200 XP</strong><span class="fs-skill-bar"><i style="width:${Math.round((xpHome / 1200) * 100)}%"></i></span></span>
        </div>
        ${av}`;
      }
    }
    updateSidebarAtmos();
  }

  function updateSidebarAtmos() {
    if (!panelEl) return;
    const img = panelEl.querySelector(".fs-sidebar-atmos");
    if (!img) return;
    const pawn =
      v3Url("sidebar-atmos-pawn-cutout.png") ||
      v3Url("sidebar-atmos-pawn-cut.png") ||
      v3Url("sidebar-atmos-pawn.png");
    const king =
      v3Url("sidebar-atmos-king-cutout.png") ||
      v3Url("sidebar-atmos-king-cut.png") ||
      v3Url("sidebar-atmos-king.png");
    const src =
      activeTab === "training" || activeTab === "games" ? pawn : king;
    if (src) img.src = src;
  }

  function renderPanelShell() {
    if (!panelEl) return;
    const langCode =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr"
        ? "TR"
        : "EN";
    const logo = v3Url("logo-knight-gold-cut.png") || v3Url("logo-knight-gold.png") || chrome.runtime.getURL("avatars/neutral.png");
    const crown = v3Url("pro-crown-cut.png") || v3Url("pro-crown.png");
    const atmos =
      v3Url("sidebar-atmos-king-cutout.png") ||
      v3Url("sidebar-atmos-king-cut.png") ||
      v3Url("sidebar-atmos-king.png") ||
      v3Url("coach-full-cut.png");
    const primary = TABS.filter((t) => t.group === "primary");
    const secondary = TABS.filter((t) => t.group === "secondary");
    const utility = TABS.filter((t) => t.group === "utility");
    const tabBtn = (t, secondaryCls) =>
      `<button class="fs-tab ${secondaryCls || ""}" data-tab="${t.id}"><span class="fs-tab-ico">${t.icon}</span><span>${esc(T(t.trLabel))}</span>${t.id === "coach" ? `<span class="fs-tab-new">New</span>` : ""}</button>`;
    panelEl.innerHTML = `
      <aside class="fs-sidebar">
        ${atmos ? `<img class="fs-sidebar-atmos" src="${esc(atmos)}" alt="" />` : ""}
        <div class="fs-brand">
          <img class="fs-brand-ico" src="${esc(logo)}" alt="" />
          <span>FORKSIGHT</span>
        </div>
        <nav class="fs-tabs">
          ${primary.map((t) => tabBtn(t)).join("")}
          <div class="fs-nav-sep"></div>
          ${secondary.map((t) => tabBtn(t, "fs-tab-secondary")).join("")}
        </nav>
        <button class="fs-pro-card" data-act="premium" title="${T("Premium planını görüntüle / yükselt")}">
          <div class="fs-pro-card-title">
            ${crown ? `<img src="${esc(crown)}" alt="" />` : ""}
            <span class="fs-pro-name">ForkSight</span>
            <span class="fs-pro-pro">PRO</span>
          </div>
          <div class="fs-pro-card-sub">${T("Unlock all coaches")}</div>
          <div class="fs-pro-go">${T("Premium'a Geç")}</div>
        </button>
        <button class="fs-premium-pill" data-act="premium" hidden>⭐ ${T("Premium")}</button>
      </aside>
      <main class="fs-main">
        <div class="fs-header">
          <div class="fs-header-left"></div>
          <div class="fs-header-right">
            <button class="fs-icon-btn fs-lang-btn" data-act="lang-toggle" aria-label="${T("Dil")}" title="${T("Dil")}">🌐 <span class="fs-lang-code">${langCode}</span></button>
            <div class="fs-notif-wrap">
              <button class="fs-header-bell" type="button" data-act="notif-toggle" aria-label="${T("Bildirimler")}" title="${T("Bildirimler")}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 17h12l-1.2-1.2V11a4.8 4.8 0 1 0-9.6 0v4.8L6 17z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>
              </button>
            </div>
            <div class="fs-stat-pills"></div>
            <button class="fs-icon-btn" data-act="close" aria-label="${T("Kapat")}">×</button>
          </div>
        </div>
        <div class="fs-body"></div>
      </main>
    `;

    // Header dispatcher
    panelEl.querySelector(".fs-header").addEventListener("click", async (e) => {
      const notifItem = e.target.closest("[data-notif-id]");
      if (notifItem) {
        const id = notifItem.dataset.notifId;
        const act = notifItem.dataset.notifAct;
        const url = notifItem.dataset.notifUrl;
        await markNotifRead(id);
        cache.notifications.open = false;
        toggleNotifications(false);
        if (act === "go-arena") switchTab("arena");
        else if (act === "go-coach") switchTab("coach");
        else if (act === "go-training") switchTab("training");
        else if (act === "go-profile") switchTab("profile");
        else if (url) {
          try { chrome.tabs.create({ url }); } catch (_) { window.open(url, "_blank"); }
        }
        return;
      }
      const a = e.target.closest("[data-act]");
      if (!a) return;
      if (a.dataset.act === "close") close();
      else if (a.dataset.act === "lang-toggle" && window.ForkSightI18n) {
        window.ForkSightI18n.toggleLang();
      } else if (a.dataset.act === "notif-toggle") {
        await ensureNotifications(false);
        toggleNotifications();
      } else if (a.dataset.act === "notif-mark-all") {
        (cache.notifications.items || []).forEach((it) => {
          cache.notifications.readIds[String(it.id)] = 1;
        });
        cache.notifications.unread = 0;
        try { chrome.storage.local.set({ fs_notif_read: cache.notifications.readIds }); } catch (_) {}
        updateNotifBell();
        toggleNotifications(true);
      }
    });
    if (!window.__fsNotifOutsideBound) {
      window.__fsNotifOutsideBound = true;
      document.addEventListener("click", (ev) => {
        if (!panelEl || !cache.notifications.open) return;
        const path = typeof ev.composedPath === "function" ? ev.composedPath() : [];
        const inNotif = path.some(
          (n) => n && n.classList && n.classList.contains("fs-notif-wrap"),
        );
        if (inNotif) return;
        cache.notifications.open = false;
        const pan = panelEl.querySelector(".fs-notif-panel");
        if (pan) pan.hidden = true;
      }, true);
    }
    panelEl.querySelectorAll(".fs-tab").forEach((t) => {
      t.addEventListener("click", () => switchTab(t.dataset.tab));
    });
    panelEl.querySelectorAll(".fs-tab").forEach((t) => {
      t.classList.toggle("fs-active", t.dataset.tab === activeTab);
    });
    const pro = panelEl.querySelector(".fs-pro-card");
    if (pro) pro.addEventListener("click", openPremiumPage);
    const pill = panelEl.querySelector(".fs-premium-pill");
    if (pill) {
      pill.addEventListener("click", openPremiumPage);
      updatePremiumPill();
    }
    updateHeaderGreeting();
    ensureNotifications(false).then(() => updateNotifBell());
    try {
      chrome.storage.local.get(
        ["fs_arena_chest_opened", "fs_onboard_done", "fs_selected_coach"],
        (r) => {
        if (r && r.fs_arena_chest_opened) cache.arenaChest.opened = true;
        if (r && r.fs_onboard_done) {
          cache.onboard.dismissed = true;
          cache.onboard.step = 3;
        }
        if (r && r.fs_selected_coach) {
          const raw = String(r.fs_selected_coach);
          const row = coachRoster().find((x) => x.id === raw);
          if (row && row.comingSoon) {
            selectedCoachId = "tilki";
            try {
              chrome.storage.local.set({ fs_selected_coach: "tilki" });
            } catch (_) {}
          } else {
            selectedCoachId = raw;
          }
          if (activeTab === "coach") renderActive();
        }
      });
    } catch (_) {}
  }

  // Premium pill etiketini quota cache'inden günceller:
  // free → "⭐ Premium'a Geç", gold → "★ Gold · Ng", diamond → "💎 Diamond · Ng".
  function updatePremiumPill() {
    if (!panelEl) return;
    const pill = panelEl.querySelector(".fs-premium-pill");
    const pro = panelEl.querySelector(".fs-pro-card-title");
    const proSub = panelEl.querySelector(".fs-pro-card-sub");
    const proGo = panelEl.querySelector(".fs-pro-go");
    const q = cache.quota;
    const tier = (q && q.tier) || "free";
    const prem = isUserPremium();
    panelEl.classList.toggle("fs-user-premium", prem);
    let label;
    if (tier === "diamond") label = "💎 " + T("Diamond");
    else if (tier === "gold") label = "★ " + T("Gold");
    else label = "💎 " + T("ForkSight PRO");
    if ((tier === "gold" || tier === "diamond") && q && q.premium_until) {
      const now =
        q.server_time && q.server_time > 0 ? q.server_time : Date.now() / 1000;
      const days = Math.ceil((Number(q.premium_until) - now) / 86400);
      if (days > 0) label += ` · ${days} ${T("gün")}`;
    }
    if (pill) {
      pill.innerHTML = esc(label);
      pill.classList.toggle("fs-pill-gold", tier === "gold");
      pill.classList.toggle("fs-pill-diamond", tier === "diamond");
    }
    if (proSub && !prem) proSub.textContent = T("Unlock all coaches");
    if (proGo && !prem) proGo.textContent = T("Premium'a Geç");
    if (pro) {
      const crown = v3Url("pro-crown.png");
      pro.innerHTML = `${crown ? `<img src="${esc(crown)}" alt="" />` : ""}${esc(label)}`;
    }
  }

  // Premium sayfasını yeni sekmede açar. Kullanıcı eklentide giriş yapmışsa
  // token'ı hash ile geçirir → premium.html otomatik oturum açar (tekrar
  // giriş gerekmez). Token yoksa düz açar.
  async function openPremiumPage() {
    const PREMIUM_URL = "https://forksight.net/premium";
    let url = PREMIUM_URL;
    try {
      const r = await send("get_token");
      if (r && r.token) {
        const u =
          (cache.profile &&
            cache.profile.user &&
            cache.profile.user.username) ||
          "";
        url =
          PREMIUM_URL +
          "#token=" +
          encodeURIComponent(r.token) +
          (u ? "&user=" + encodeURIComponent(u) : "");
      }
    } catch (_) {}
    // Content script'te chrome.tabs yok → background üzerinden aç
    try {
      const opened = await send("open_url", { url });
      if (opened && opened.ok) return;
    } catch (_) {}
    try {
      window.open(url, "_blank", "noopener");
    } catch (_) {
      location.href = url;
    }
  }

  function buildPanel(anchorRect, opts) {
    opts = opts || {};
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
    if (opts.tab) activeTab = opts.tab;
    if (opts.coachSubTab === "mine" || opts.coachSubTab === "all") {
      coachSubTab = opts.coachSubTab;
    }
    if (!opts.tab) activeTab = "home";
    renderActive();
    ensureProfile();
    if (activeTab === "coach" && coachSubTab === "mine") ensureCoachPlayGames(true);
    requestAnimationFrame(() => {
      overlay.classList.add("fs-show");
      panelEl.classList.add("fs-show");
    });

    // Dil değişimi: kabuğu (sidebar + header etiketleri) ve aktif body'yi yeniden çiz.
    if (window.ForkSightI18n) {
      langUnsub = window.ForkSightI18n.onChange(() => {
        if (!panelEl) return;
        // Bildirim metinleri dil değişince yeniden üretensin
        cache.notifications.items = [];
        cache.notifications.loading = false;
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
      setTimeout(() => buildPanel(opts.anchorRect || null, opts), 50);
    } else {
      buildPanel(opts.anchorRect || null, opts);
    }
  }

  window.ForkSightProfile = { open, close };
})();
