/**
 * ForkSight — Koçunla Oyna (eğitim amaçlı canlı maç)
 * Intro → tam ekran satranç → hamle bazlı koç yorumları
 */
(function () {
  "use strict";

  const T = (s) =>
    window.ForkSightI18n && window.ForkSightI18n.t
      ? window.ForkSightI18n.t(s)
      : s;

  const INTRO_LINES = {
    tilki: {
      tr: "Antrenman maçına hoş geldin! Ben Tilki — taktik desenleri birlikte avlayacağız. Hazır mısın?",
      en: "Welcome to our training match! I'm Tilki — we'll hunt tactical patterns together. Ready?",
    },
    victoria: {
      tr: "Bu bir eğitim maçı. Plan kur, yapıyı koru — ben de seni yönlendireceğim.",
      en: "This is a training match. Build a plan, keep your structure — I'll guide you.",
    },
    boris: {
      tr: "Dürüst olacağım: zayıf hamlelerini söyleyeceğim. Antrenman için buradayız.",
      en: "I'll be honest: I'll call out weak moves. We're here to train.",
    },
    kai: {
      tr: "Hesap derinliğini test edelim. Her hamleyi satır satır düşün.",
      en: "Let's test your calculation. Think every move through.",
    },
    lena: {
      tr: "Enerjini yüksek tut! Bu maç öğrenmek için — birlikte güçleneceğiz.",
      en: "Keep your energy up! This match is for learning — we'll grow together.",
    },
    sero: {
      tr: "Sokakta öğrendiklerimi göstereyim. Dikkatli ol, pişman etmem.",
      en: "Let me show you what the streets taught me. Be careful — I won't go easy.",
    },
  };

  let host = null;
  let root = null;
  let board = null;
  let session = null;
  let coach = null;
  let minimized = false;
  let lastValidFen = "";
  let gameMoves = [];
  let fx = { commentary: true, animations: true, tts: true };
  const COACH_PLAY_HISTORY_KEY = "fs_coach_play_history";
  const COACH_PLAY_HISTORY_MAX = 25;

  function uciMoveObj(uci) {
    return {
      uci,
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : null,
    };
  }

  function buildCoachPgn(game) {
    const moves = (game && game.uci_moves) || [];
    if (!moves.length) return (game && game.pgn) || "";
    const R = window.ForkSightReview;
    let sanLine = [];
    if (R && typeof R._buildTimeline === "function") {
      try {
        const timeline = R._buildTimeline(moves.map(uciMoveObj));
        for (let i = 1; i < timeline.length; i++) {
          const ply = timeline[i];
          if (!ply || !ply.san) continue;
          if (ply.side === "w") sanLine.push(ply.moveNo + ". " + ply.san);
          else sanLine.push(ply.san);
        }
      } catch (_) {
        sanLine = [];
      }
    }
    if (!sanLine.length) sanLine = moves.slice();
    const white =
      game.player_color === "w" ? game.player_name : game.coach_name;
    const black =
      game.player_color === "b" ? game.player_name : game.coach_name;
    const d = new Date(game.ts || Date.now());
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, ".");
    const headers = [
      '[Event "ForkSight Coach Play"]',
      '[Site "forksight.net/coach"]',
      `[Date "${dateStr}"]`,
      `[White "${String(white || "White").replace(/"/g, '\\"')}"]`,
      `[Black "${String(black || "Black").replace(/"/g, '\\"')}"]`,
      `[Result "${game.result || "*"}"]`,
      `[Termination "${game.termination || ""}"]`,
      `[ForkSightCoach "${game.coach_id || ""}"]`,
      `[ForkSightGameId "${game.id || ""}"]`,
      `[ForkSightUCI "${moves.join(" ")}"]`,
    ];
    return (
      headers.join("\n") +
      "\n\n" +
      sanLine.join(" ") +
      " " +
      (game.result || "*")
    );
  }

  function readCoachHistory(cb) {
    try {
      chrome.storage.local.get([COACH_PLAY_HISTORY_KEY], (r) => {
        const list = Array.isArray(r && r[COACH_PLAY_HISTORY_KEY])
          ? r[COACH_PLAY_HISTORY_KEY]
          : [];
        cb(list);
      });
    } catch (_) {
      cb([]);
    }
  }

  function writeCoachHistory(list, cb) {
    try {
      chrome.storage.local.set({ [COACH_PLAY_HISTORY_KEY]: list }, () => {
        if (cb) cb();
      });
    } catch (_) {
      if (cb) cb();
    }
  }

  function mergeCoachHistories(a, b) {
    const map = new Map();
    for (const g of [...(a || []), ...(b || [])]) {
      if (!g || !g.id) continue;
      const prev = map.get(g.id);
      if (!prev || (g.ts || 0) >= (prev.ts || 0)) map.set(g.id, g);
    }
    return Array.from(map.values())
      .sort((x, y) => (y.ts || 0) - (x.ts || 0))
      .slice(0, COACH_PLAY_HISTORY_MAX);
  }

  function pushCoachHistoryToServer(games) {
    api("coach_play_save_history", { games: games || [] }).catch(() => {});
  }

  async function syncCoachHistoryFromServer() {
    const local = await new Promise((resolve) => readCoachHistory(resolve));
    try {
      const remote = await api("coach_play_get_history");
      if (!remote || !remote.ok || !Array.isArray(remote.games)) return local;
      const remoteGames = remote.games;
      const merged = mergeCoachHistories(local, remoteGames);
      const mergedJson = JSON.stringify(merged);
      if (mergedJson !== JSON.stringify(local)) {
        await new Promise((resolve) => writeCoachHistory(merged, resolve));
      }
      if (mergedJson !== JSON.stringify(remoteGames) && merged.length) {
        pushCoachHistoryToServer(merged);
      }
      return merged;
    } catch (_) {
      return local;
    }
  }

  function playerDisplayName(cb) {
    try {
      chrome.storage.local.get(["taktik_user"], (r) => {
        const u = (r && r.taktik_user) || "";
        cb(
          u ||
            (lang() === "en" ? "You" : "Sen"),
        );
      });
    } catch (_) {
      cb(lang() === "en" ? "You" : "Sen");
    }
  }

  function resultFromOver(over, playerColor) {
    if (!over) return { result: "*", player_result: "draw" };
    if (over.result === "checkmate") {
      const won = over.winner === playerColor;
      const result =
        over.winner === "w"
          ? "1-0"
          : over.winner === "b"
            ? "0-1"
            : "*";
      return { result, player_result: won ? "win" : "loss" };
    }
    if (
      over.result === "stalemate" ||
      over.result === "insufficient" ||
      over.result === "repetition" ||
      over.result === "fifty"
    ) {
      return { result: "1/2-1/2", player_result: "draw" };
    }
    return { result: "*", player_result: "draw" };
  }

  function saveCoachGame(over) {
    if (!session || !gameMoves.length) return;
    const playerColor = session.player_color || "w";
    const { result, player_result } = resultFromOver(over, playerColor);
    const coachName = (coach && coach.name) || "Coach";
    playerDisplayName((playerName) => {
      const record = {
        id: "cp-" + Date.now(),
        ts: Date.now(),
        coach_id: session.coach_id || (coach && coach.id) || "tilki",
        coach_name: coachName,
        player_color: playerColor,
        player_name: playerName,
        uci_moves: gameMoves.slice(),
        final_fen: session.fen || lastValidFen || "",
        result,
        player_result,
        termination: over && over.result ? over.result : "",
        ply_count: gameMoves.length,
      };
      record.pgn = buildCoachPgn(record);
      readCoachHistory((list) => {
        list.unshift(record);
        const merged = list.slice(0, COACH_PLAY_HISTORY_MAX);
        writeCoachHistory(merged, () => {
          pushCoachHistoryToServer(merged);
        });
      });
    });
  }

  function getCoachHistory() {
    return syncCoachHistoryFromServer();
  }
  let speakFn = null;
  let audioEl = null;

  function api(type, data) {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage({ type, data: data || {} }, (resp) => {
          if (chrome.runtime.lastError)
            reject(new Error(chrome.runtime.lastError.message));
          else resolve(resp || {});
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  function lang() {
    return window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
      ? "en"
      : "tr";
  }

  function avatarUrl(coachId, emotion) {
    const em = emotion || "neutral";
    try {
      return chrome.runtime.getURL(
        "avatars/" + (coachId || "tilki") + "/" + em + ".png",
      );
    } catch (_) {
      return "";
    }
  }

  function portraitUrl(c) {
    if (!c) return "";
    if (c.portrait) return c.portrait;
    try {
      return chrome.runtime.getURL("v3/coaches/" + (c.id || "tilki") + ".png");
    } catch (_) {
      return "";
    }
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadFxSettings(cb) {
    try {
      chrome.storage.local.get(
        ["fs_coach_play_fx", "fs_coach_play_tts"],
        (r) => {
          const saved = (r && r.fs_coach_play_fx) || {};
          fx.commentary = saved.commentary !== false;
          fx.animations = saved.animations !== false;
          if (r && typeof r.fs_coach_play_tts === "boolean")
            fx.tts = r.fs_coach_play_tts;
          if (cb) cb();
        },
      );
    } catch (_) {
      if (cb) cb();
    }
  }

  function saveFxSettings() {
    try {
      chrome.storage.local.set({
        fs_coach_play_fx: {
          commentary: fx.commentary,
          animations: fx.animations,
        },
        fs_coach_play_tts: fx.tts,
      });
    } catch (_) {}
  }

  function stopAudio() {
    try {
      if (audioEl) {
        audioEl.pause();
        audioEl.src = "";
      }
    } catch (_) {}
    audioEl = null;
  }

  async function speak(text) {
    if (!text || !fx.tts || !fx.commentary) return;
    if (typeof speakFn === "function") {
      try {
        await speakFn(text, { coachId: coach && coach.id });
      } catch (_) {}
      return;
    }
    stopAudio();
    try {
      const baseR = await api("get_api_base");
      const base = (baseR && baseR.url) || "https://forksight.net";
      const tk = await api("get_token");
      const l = lang();
      let url =
        base +
        "/tts?lang=" +
        l +
        "&coach=" +
        encodeURIComponent((coach && coach.id) || "tilki") +
        "&text=" +
        encodeURIComponent(String(text).trim()) +
        "&v=el4";
      if (coach && coach.voiceId)
        url += "&voice=" + encodeURIComponent(coach.voiceId);
      const headers = {};
      if (tk && tk.token) headers.Authorization = "Bearer " + tk.token;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      audioEl = new Audio(URL.createObjectURL(blob));
      await audioEl.play();
    } catch (_) {}
  }

  function css() {
    return `
      :host {
        position: fixed; inset: 0; z-index: 2147483647;
        display: block; pointer-events: auto;
        font-family: "Segoe UI", system-ui, sans-serif;
        color: #eef1f7;
      }
      :host(.fcp-min) {
        inset: auto !important;
        top: auto !important; left: auto !important;
        right: 20px !important; bottom: 20px !important;
        width: 360px !important; height: 440px !important;
        max-width: calc(100vw - 32px) !important;
        max-height: calc(100vh - 32px) !important;
        border-radius: 14px;
        overflow: hidden;
        box-shadow: 0 16px 48px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.08);
      }
      .fcp-backdrop {
        position: absolute; inset: 0;
        background: rgba(6,8,12,.88);
        backdrop-filter: blur(8px);
      }
      :host(.fcp-min) .fcp-backdrop { display: none; }
      .fcp-shell {
        position: absolute; inset: 12px;
        display: flex; flex-direction: column;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.1);
        background: linear-gradient(180deg, #141824, #0d1018);
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
        overflow: hidden;
      }
      :host(.fcp-min) .fcp-shell {
        position: absolute; inset: 0; border-radius: 14px;
        display: flex; flex-direction: column;
        box-shadow: none;
      }
      .fcp-top {
        display: flex; align-items: center; justify-content: space-between;
        gap: 10px; padding: 10px 14px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: rgba(0,0,0,.25);
        flex: 0 0 auto; z-index: 2;
      }
      :host(.fcp-min) .fcp-top {
        padding: 8px 10px; gap: 8px;
      }
      .fcp-top-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
      .fcp-badge {
        font-size: 9px; font-weight: 900; letter-spacing: .08em;
        padding: 4px 8px; border-radius: 999px;
        background: rgba(61,214,140,.15); color: #7dffc0;
        border: 1px solid rgba(61,214,140,.35);
        white-space: nowrap; flex-shrink: 0;
      }
      :host(.fcp-min) .fcp-badge { display: none; }
      .fcp-title-wrap { min-width: 0; flex: 1; }
      .fcp-title { font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .fcp-title-short { display: none; }
      :host(.fcp-min) .fcp-title-full { display: none; }
      :host(.fcp-min) .fcp-title-short { display: block; font-size: 12px; }
      .fcp-sub { font-size: 10px; color: #9aa3b5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      :host(.fcp-min) .fcp-sub { display: none; }
      .fcp-top-actions {
        display: flex; gap: 6px; flex: 0 0 auto; align-items: center;
      }
      .fcp-icon-btn {
        appearance: none; cursor: pointer; border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05); color: #dfe5f2;
        border-radius: 8px; padding: 6px 10px; font-size: 11px; font-weight: 700;
        line-height: 1; flex-shrink: 0;
      }
      .fcp-icon-btn.fcp-btn-ico {
        width: 32px; height: 32px; padding: 0;
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 15px; font-weight: 400;
      }
      .fcp-icon-btn:hover { background: rgba(255,255,255,.12); }
      .fcp-icon-btn.danger { border-color: rgba(255,107,107,.35); color: #ffb4b4; }
      .fcp-body { flex: 1; min-height: 0; position: relative; overflow: hidden; }
      .fcp-intro, .fcp-game { position: absolute; inset: 0; display: flex; }
      .fcp-intro {
        align-items: center; justify-content: center; padding: 24px;
        background:
          radial-gradient(80% 60% at 50% 0%, rgba(245,197,66,.12), transparent 60%),
          radial-gradient(60% 50% at 80% 80%, rgba(76,141,255,.08), transparent 55%);
        overflow: auto;
      }
      :host(.fcp-min) .fcp-intro {
        padding: 10px; align-items: stretch; justify-content: flex-start;
      }
      .fcp-intro-card {
        width: min(520px, 100%); text-align: center;
        padding: 24px 22px 20px; border-radius: 20px;
        border: 1px solid rgba(255,255,255,.1);
        background: rgba(10,12,18,.75);
        box-shadow: 0 20px 60px rgba(0,0,0,.35);
      }
      :host(.fcp-min) .fcp-intro-card {
        width: 100%; padding: 12px 10px; border-radius: 12px;
        box-shadow: none; display: flex; flex-direction: column;
        min-height: 0; flex: 1;
      }
      .fcp-intro-av-wrap {
        position: relative; width: 180px; height: 180px; margin: 0 auto 14px;
        flex-shrink: 0;
      }
      :host(.fcp-min) .fcp-intro-av-wrap {
        width: 88px; height: 88px; margin: 0 auto 8px;
      }
      .fcp-intro-av {
        width: 100%; height: 100%; object-fit: contain;
        filter: drop-shadow(0 12px 24px rgba(0,0,0,.45));
        animation: fcp-av-in .7s cubic-bezier(.22,1,.36,1);
      }
      @keyframes fcp-av-in {
        from { opacity: 0; transform: translateY(16px) scale(.92); }
        to { opacity: 1; transform: none; }
      }
      .fcp-bubble {
        position: relative; margin: 0 auto 16px; max-width: 420px;
        padding: 12px 14px; border-radius: 14px;
        background: rgba(255,255,255,.06);
        border: 1px solid rgba(255,255,255,.1);
        font-size: 14px; line-height: 1.45; text-align: left;
        animation: fcp-bub-in .5s ease .25s both;
      }
      :host(.fcp-min) .fcp-bubble {
        margin: 0 0 10px; max-width: none; font-size: 12px;
        max-height: 96px; overflow-y: auto; flex-shrink: 0;
      }
      @keyframes fcp-bub-in {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: none; }
      }
      .fcp-bubble::after {
        content: ""; position: absolute; top: -8px; left: 28px;
        border: 8px solid transparent; border-bottom-color: rgba(255,255,255,.06);
      }
      :host(.fcp-min) .fcp-bubble::after { display: none; }
      .fcp-btn-gold {
        appearance: none; cursor: pointer; border: none;
        border-radius: 12px; padding: 12px 20px;
        font-size: 13px; font-weight: 800;
        background: linear-gradient(135deg, #f5c542, #e0a820);
        color: #1a1408; box-shadow: 0 8px 20px rgba(245,197,66,.28);
        flex-shrink: 0;
      }
      :host(.fcp-min) .fcp-btn-gold { width: 100%; padding: 10px; font-size: 12px; margin-top: auto; }
      .fcp-btn-gold:disabled { opacity: .55; cursor: wait; }
      .fcp-game { display: none; padding: 12px 14px 14px; gap: 14px; }
      .fcp-game.fcp-on { display: grid; grid-template-columns: 1fr 280px; }
      :host(.fcp-min) .fcp-game.fcp-on {
        display: flex; flex-direction: column;
        padding: 8px; gap: 6px;
      }
      .fcp-board-wrap {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        min-height: 0; flex: 1; position: relative;
      }
      .fcp-board-box {
        width: min(72vh, 100%); max-width: 640px;
      }
      :host(.fcp-min) .fcp-board-box {
        width: 100% !important; max-width: 100% !important;
        flex: 1; min-height: 0;
      }
      .fcp-side {
        display: flex; flex-direction: column; gap: 10px; min-height: 0;
      }
      :host(.fcp-min) .fcp-side { display: none; }
      .fcp-coach-panel {
        border-radius: 14px; padding: 12px;
        border: 1px solid rgba(255,255,255,.08);
        background: rgba(0,0,0,.28);
        display: flex; flex-direction: column; gap: 10px; flex: 1; min-height: 0;
      }
      .fcp-coach-av {
        width: 120px; height: 120px; object-fit: contain; margin: 0 auto;
        transition: transform .35s ease, filter .35s ease;
      }
      .fcp-coach-av.fcp-pulse { animation: fcp-coach-pulse .6s ease; }
      @keyframes fcp-coach-pulse {
        0%,100% { transform: scale(1); }
        50% { transform: scale(1.04); }
      }
      .fcp-comment {
        font-size: 13px; line-height: 1.45; color: #dfe5f2;
        padding: 10px 12px; border-radius: 12px;
        background: rgba(255,255,255,.05);
        border: 1px solid rgba(255,255,255,.08);
        min-height: 72px;
      }
      .fcp-settings {
        display: flex; flex-direction: column; gap: 6px;
        font-size: 11px; color: #aab2c3;
      }
      .fcp-settings label {
        display: flex; align-items: center; gap: 8px; cursor: pointer;
      }
      .fcp-status {
        font-size: 11px; color: #9aa3b5; text-align: center; padding-top: 4px;
        flex-shrink: 0;
      }
      :host(.fcp-min) .fcp-status { font-size: 10px; padding-top: 2px; }
      .fcp-over {
        position: absolute; inset: 0; display: none;
        align-items: center; justify-content: center;
        background: rgba(6,8,12,.42); z-index: 50;
        border-radius: 10px; pointer-events: auto;
      }
      .fcp-over.fcp-on { display: flex; }
      .fcp-over-card {
        width: min(300px, 92%); padding: 18px 16px 16px;
        border-radius: 14px; text-align: center;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(18,21,31,.96);
        box-shadow: 0 12px 40px rgba(0,0,0,.45);
      }
      .fcp-over-text {
        font-size: 15px; font-weight: 800; line-height: 1.35;
        color: #f2f4f8; margin-bottom: 14px;
      }
      .fcp-over-actions {
        display: flex; gap: 8px; align-items: stretch;
      }
      .fcp-btn-outline {
        appearance: none; cursor: pointer; flex: 1;
        border-radius: 10px; padding: 10px 12px;
        font-size: 12px; font-weight: 700;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(255,255,255,.06); color: #dfe5f2;
      }
      .fcp-btn-outline:hover { background: rgba(255,255,255,.1); }
      .fcp-over-actions .fcp-btn-gold {
        flex: 1; margin: 0; padding: 10px 12px; font-size: 12px;
        box-shadow: none;
      }
    `;
  }

  function introLine() {
    const id = (coach && coach.id) || "tilki";
    const pack = INTRO_LINES[id] || INTRO_LINES.tilki;
    return pack[lang()] || pack.tr;
  }

  function setCoachEmotion(em) {
    if (!root) return;
    const img = root.querySelector(".fcp-coach-av");
    const introImg = root.querySelector(".fcp-intro-av");
    const url = avatarUrl(coach && coach.id, em) || portraitUrl(coach);
    if (img) {
      img.src = url;
      if (fx.animations) {
        img.classList.remove("fcp-pulse");
        void img.offsetWidth;
        img.classList.add("fcp-pulse");
      }
    }
    if (introImg && em === "happy") introImg.src = url;
  }

  function showComment(text, emotion) {
    if (!root) return;
    const el = root.querySelector(".fcp-comment");
    if (!el) return;
    if (!fx.commentary) {
      el.textContent = T("Sessiz mod — yorumlar kapalı.");
      return;
    }
    el.textContent = text || "";
    if (emotion) setCoachEmotion(emotion);
    if (text) speak(text);
  }

  function setStatus(msg) {
    const el = root && root.querySelector(".fcp-status");
    if (el) el.textContent = msg || "";
  }

  function destroyBoard() {
    if (board) {
      try {
        board.destroy();
      } catch (_) {}
    }
    board = null;
  }

  async function resign() {
    if (session && session.session_id) {
      try {
        await api("coach_play_resign", { session_id: session.session_id });
      } catch (_) {}
    }
  }

  function close() {
    stopAudio();
    destroyBoard();
    resign();
    session = null;
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    root = null;
    document.removeEventListener("keydown", onEsc, true);
  }

  function onEsc(e) {
    if (e.key === "Escape") close();
  }

  function applyHostLayout() {
    if (!host) return;
    if (minimized) {
      host.classList.add("fcp-min");
      host.style.cssText =
        "position:fixed;z-index:2147483647;display:block;pointer-events:auto;" +
        "top:auto;left:auto;right:20px;bottom:20px;" +
        "width:360px;height:440px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);";
    } else {
      host.classList.remove("fcp-min");
      host.style.cssText =
        "position:fixed;z-index:2147483647;display:block;pointer-events:auto;" +
        "top:0;left:0;right:0;bottom:0;width:auto;height:auto;";
    }
    updateMinimizeBtn();
    // Tahta boyutunu yeniden hesaplat
    if (board && session && session.fen) {
      try {
        const stm = session.fen.includes(" w ") ? "w" : "b";
        board.setPosition(session.fen, stm);
      } catch (_) {}
    }
  }

  function updateMinimizeBtn() {
    const btn = root && root.querySelector('[data-act="minimize"]');
    if (!btn) return;
    btn.textContent = minimized ? "⛶" : "—";
    btn.title = minimized ? T("Büyüt") : T("Küçült");
    btn.setAttribute("aria-label", btn.title);
  }

  function toggleMinimize() {
    minimized = !minimized;
    applyHostLayout();
  }

  async function startSession() {
    const btn = root.querySelector('[data-act="continue"]');
    if (btn) btn.disabled = true;
    setStatus(T("Maç hazırlanıyor…"));
    try {
      const r = await api("coach_play_start", {
        coach_id: (coach && coach.id) || "tilki",
        color: "w",
      });
      if (!r.ok) {
        setStatus((r.detail || r.error || T("Maç başlatılamadı")) + "");
        if (btn) btn.disabled = false;
        return;
      }
      session = r;
      lastValidFen = r.fen;
      gameMoves = [];
      root.querySelector(".fcp-intro").style.display = "none";
      const game = root.querySelector(".fcp-game");
      game.classList.add("fcp-on");
      mountBoard(r.fen, r.player_color);
      setCoachEmotion("neutral");
      showComment(
        T("Eğitim maçı başladı. Hamlelerine göre yorum yapacağım — istersen sağdan kapat."),
        "happy",
      );
      setStatus(
        r.player_color === "w"
          ? T("Beyaz sensin — ilk hamleyi yap.")
          : T("Siyah sensin — koç hamle yapıyor…"),
      );
    } catch (e) {
      setStatus(String(e.message || e));
      if (btn) btn.disabled = false;
    }
  }

  function mountBoard(fen, playerColor) {
    destroyBoard();
    const box = root.querySelector(".fcp-board-box");
    if (!box || !window.ForkSightQuizBoard) return;
    box.innerHTML = "";
    board = window.ForkSightQuizBoard.create(box, {
      fen,
      sideToMove: fen.includes(" w ") ? "w" : "b",
      onMove: (uci) => onPlayerMove(uci),
    });
    if (playerColor === "b") board.lock(true);
  }

  async function onPlayerMove(uci) {
    if (!session || !board) return;
    board.lock(true);
    setStatus(T("Hamle işleniyor…"));
    try {
      const r = await api("coach_play_move", {
        session_id: session.session_id,
        move_uci: uci,
      });
      if (!r.ok) {
        if (r.error === "illegal") {
          setStatus(T("Geçersiz hamle."));
          if (lastValidFen)
            board.setPosition(
              lastValidFen,
              lastValidFen.includes(" w ") ? "w" : "b",
            );
          board.lock(false);
          return;
        }
        setStatus((r.detail || r.error || T("Hata")) + "");
        board.lock(false);
        return;
      }
      session.fen = r.fen;
      lastValidFen = r.fen;
      if (r.player_uci) gameMoves.push(r.player_uci);
      if (r.coach_uci) gameMoves.push(r.coach_uci);
      if (r.comments && r.comments.length && fx.commentary) {
        for (const c of r.comments) {
          if (c && c.text) showComment(c.text, c.emotion || "neutral");
        }
      }
      if (r.coach_uci) {
        setCoachEmotion("thinking");
        await delay(fx.animations ? 450 : 0);
        board.applyMove(r.coach_uci);
        setCoachEmotion("neutral");
      } else {
        board.setPosition(r.fen, r.side_to_move);
      }
      if (r.game_over) {
        endGame(r.game_over);
        return;
      }
      setStatus(T("Sıra sende."));
      board.lock(false);
    } catch (e) {
      setStatus(String(e.message || e));
      board.lock(false);
    }
  }

  function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  function endGame(over) {
    if (board) {
      board.lock(true);
      if (board.clearHighlights) board.clearHighlights();
      if (board.clearArrow) board.clearArrow();
    }
    const layer = root.querySelector(".fcp-over");
    const txt = root.querySelector(".fcp-over-text");
    let msg = T("Maç bitti.");
    if (over.result === "checkmate") {
      const won =
        over.winner === (session && session.player_color);
      msg = won ? T("Tebrikler, kazandın!") : T("Koç kazandı — bir dahaki sefere!");
      setCoachEmotion(won ? "losing" : "winning");
    } else if (over.result === "stalemate") {
      msg = T("Pat — berabere.");
      setCoachEmotion("neutral");
    }
    if (txt) txt.textContent = msg;
    if (layer) layer.classList.add("fcp-on");
    speak(msg);
    setStatus("");
    saveCoachGame(over);
  }

  function hideGameOver() {
    const layer = root && root.querySelector(".fcp-over");
    if (layer) layer.classList.remove("fcp-on");
  }

  async function retryGame() {
    hideGameOver();
    await resign();
    destroyBoard();
    session = null;
    lastValidFen = "";
    gameMoves = [];
    setStatus(T("Maç hazırlanıyor…"));
    await startSession();
  }

  function exitToPanel() {
    hideGameOver();
    stopAudio();
    destroyBoard();
    session = null;
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    root = null;
    document.removeEventListener("keydown", onEsc, true);
    setTimeout(() => {
      if (
        window.ForkSightProfile &&
        typeof window.ForkSightProfile.open === "function"
      ) {
        window.ForkSightProfile.open({ tab: "coach", coachSubTab: "mine" });
      }
    }, 60);
  }

  function mountShell() {
    host = document.createElement("div");
    host.className = "fcp-host";
    const shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = css();
    shadow.appendChild(style);

    root = document.createElement("div");
    root.className = "fcp-shell";
    const backdrop = document.createElement("div");
    backdrop.className = "fcp-backdrop";
    backdrop.addEventListener("click", close);
    const cname = (coach && coach.name) || "Coach";
    const ctitle = (coach && coach.title) || "";
    const av = portraitUrl(coach);
    const introAv =
      avatarUrl(coach && coach.id, "happy") || av;

    root.innerHTML = `
      <div class="fcp-top">
        <div class="fcp-top-left">
          <span class="fcp-badge">${T("EĞİTİM MAÇI")}</span>
          <div class="fcp-title-wrap">
            <div class="fcp-title fcp-title-full">${esc(cname)} · ${esc(T("Koçunla Oyna"))}</div>
            <div class="fcp-title fcp-title-short">${esc(cname)}</div>
            <div class="fcp-sub">${esc(ctitle)}</div>
          </div>
        </div>
        <div class="fcp-top-actions">
          <button type="button" class="fcp-icon-btn fcp-btn-ico" data-act="minimize" title="${esc(T("Küçült"))}" aria-label="${esc(T("Küçült"))}">—</button>
          <button type="button" class="fcp-icon-btn fcp-btn-ico danger" data-act="exit" title="${esc(T("Oyundan Çık"))}" aria-label="${esc(T("Oyundan Çık"))}">✕</button>
        </div>
      </div>
      <div class="fcp-body">
        <div class="fcp-intro">
          <div class="fcp-intro-card">
            <div class="fcp-intro-av-wrap">
              <img class="fcp-intro-av" src="${esc(introAv)}" alt="${esc(cname)}" />
            </div>
            <div class="fcp-bubble" id="fcp-intro-bubble">${esc(introLine())}</div>
            <button type="button" class="fcp-btn-gold" data-act="continue">${T("Devam Et →")}</button>
          </div>
        </div>
        <div class="fcp-game">
          <div class="fcp-board-wrap">
            <div class="fcp-board-box"></div>
            <div class="fcp-status"></div>
            <div class="fcp-over">
              <div class="fcp-over-card">
                <div class="fcp-over-text"></div>
                <div class="fcp-over-actions">
                  <button type="button" class="fcp-btn-outline" data-act="go-panel">${T("Çıkış")}</button>
                  <button type="button" class="fcp-btn-gold" data-act="retry">${T("Yeniden Dene")}</button>
                </div>
              </div>
            </div>
          </div>
          <div class="fcp-side">
            <div class="fcp-coach-panel">
              <img class="fcp-coach-av" src="${esc(avatarUrl(coach && coach.id, "neutral") || av)}" alt="" />
              <div class="fcp-comment">${T("Hazır olduğunda hamle yap.")}</div>
              <div class="fcp-settings">
                <label><input type="checkbox" data-fx="commentary" ${fx.commentary ? "checked" : ""} /> ${T("Koç yorumları")}</label>
                <label><input type="checkbox" data-fx="animations" ${fx.animations ? "checked" : ""} /> ${T("Animasyonlar & ifadeler")}</label>
                <label><input type="checkbox" data-fx="tts" ${fx.tts ? "checked" : ""} /> ${T("Sesli anlatım")}</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    shadow.appendChild(backdrop);
    shadow.appendChild(root);
    document.body.appendChild(host);
    applyHostLayout();

    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const a = b.dataset.act;
      if (a === "exit") close();
      else if (a === "go-panel") exitToPanel();
      else if (a === "retry") retryGame();
      else if (a === "minimize") toggleMinimize();
      else if (a === "continue") startSession();
    });

    root.querySelectorAll("[data-fx]").forEach((inp) => {
      inp.addEventListener("change", () => {
        const k = inp.dataset.fx;
        fx[k] = !!inp.checked;
        saveFxSettings();
        if (!fx.commentary) stopAudio();
      });
    });

    document.addEventListener("keydown", onEsc, true);
    speak(introLine());
  }

  function open(opts) {
    opts = opts || {};
    if (host) close();
    coach = opts.coach || null;
    speakFn = opts.speak || null;
    minimized = false;
    gameMoves = [];
    loadFxSettings(() => {
      mountShell();
      setCoachEmotion("happy");
    });
  }

  window.ForkSightCoachPlay = {
    open,
    close,
    getHistory: getCoachHistory,
    buildPgn: buildCoachPgn,
  };
})();
