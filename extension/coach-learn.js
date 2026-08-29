/**
 * ForkSight — Learn with Coach (Chess.com Learn benzeri)
 * Harita → ders intro → demo/challenge → tamamlama
 */
(function () {
  "use strict";

  const DATA = window.ForkSightLearnData;
  const PROGRESS_KEY = "fs_coach_learn_progress";
  const FX_KEY = "fs_coach_learn_fx";

  const T = (s) =>
    window.ForkSightI18n && window.ForkSightI18n.t
      ? window.ForkSightI18n.t(s)
      : s;

  const L = (obj) => {
    if (!obj || typeof obj !== "object") return String(obj || "");
    const lg = lang();
    return obj[lg] || obj.tr || obj.en || "";
  };

  let host = null;
  let shadow = null;
  let root = null;
  let coach = null;
  let speakFn = null;
  let board = null;
  let audioEl = null;
  let fx = { tts: true, animations: true };

  let view = "map"; // map | lesson
  let progress = { completed: {}, currentLesson: null };
  let lessonCtx = null; // { lesson, stepIdx, pathIdx, challengeIdx, challengeTotal }

  function lang() {
    return window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
      ? "en"
      : "tr";
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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

  function avatarUrl(coachId, emotion) {
    try {
      return chrome.runtime.getURL(
        "avatars/" + (coachId || "tilki") + "/" + (emotion || "neutral") + ".png",
      );
    } catch (_) {
      return "";
    }
  }

  function pieceUrl(letter, color) {
    const c = color === "b" ? "b" : "w";
    const p = String(letter || "K").toUpperCase();
    try {
      return chrome.runtime.getURL("pieces/" + c + p + ".png");
    } catch (_) {
      return "";
    }
  }

  function learnAsset(file) {
    try {
      return chrome.runtime.getURL("learn/" + file);
    } catch (_) {
      return "";
    }
  }

  function coachPortrait() {
    const id = (coach && coach.id) || "tilki";
    const learnHero = learnAsset("coach-hero.png");
    if (id === "tilki" && learnHero) return learnHero;
    if (coach && coach.portrait) return coach.portrait;
    try {
      return chrome.runtime.getURL("v3/coaches/" + id + ".png");
    } catch (_) {
      return avatarUrl(id, "happy");
    }
  }

  function defaultProgress() {
    return { completed: {}, currentLesson: "king", updated: Date.now() };
  }

  function migrateCaptureProgress(prog) {
    const old = prog.completed && prog.completed.capture;
    if (!old || !old.done) return prog;
    const capIds = [
      "cap_rook",
      "cap_bishop",
      "cap_queen",
      "cap_pawn",
      "cap_knight",
      "cap_master",
    ];
    for (const id of capIds) {
      if (!prog.completed[id]) {
        prog.completed[id] = { done: true, ts: old.ts || Date.now() };
      }
    }
    return prog;
  }

  function loadProgress(cb) {
    try {
      chrome.storage.local.get([PROGRESS_KEY, FX_KEY], async (r) => {
        const saved = (r && r[PROGRESS_KEY]) || defaultProgress();
        progress = {
          completed: saved.completed || {},
          currentLesson: saved.currentLesson || "king",
          updated: saved.updated || Date.now(),
        };
        progress = migrateCaptureProgress(progress);
        const fxSaved = (r && r[FX_KEY]) || {};
        fx.tts = fxSaved.tts !== false;
        fx.animations = fxSaved.animations !== false;
        try {
          const remote = await api("coach_learn_get_progress");
          if (remote && remote.ok && remote.progress) {
            progress = mergeProgress(progress, remote.progress);
          }
        } catch (_) {}
        if (cb) cb();
      });
    } catch (_) {
      progress = defaultProgress();
      if (cb) cb();
    }
  }

  function mergeProgress(local, remote) {
    const out = { ...local, completed: { ...local.completed } };
    const rc = (remote && remote.completed) || {};
    for (const id of Object.keys(rc)) {
      const loc = out.completed[id];
      const rem = rc[id];
      if (!loc || (rem && rem.ts > (loc.ts || 0))) out.completed[id] = rem;
    }
    if (remote.currentLesson) out.currentLesson = remote.currentLesson;
    return out;
  }

  function saveProgress() {
    progress.updated = Date.now();
    try {
      chrome.storage.local.set({ [PROGRESS_KEY]: progress });
    } catch (_) {}
    api("coach_learn_save_progress", { progress }).catch(() => {});
  }

  function isLessonComplete(id) {
    return !!(progress.completed[id] && progress.completed[id].done);
  }

  function isLessonUnlocked(lessonId, sectionId) {
    const order = DATA.lessonOrder();
    const idx = order.findIndex(
      (x) => x.lessonId === lessonId && x.sectionId === sectionId,
    );
    if (idx <= 0) return true;
    const prev = order[idx - 1];
    return isLessonComplete(prev.lessonId);
  }

  function isSectionUnlocked(sec) {
    if (!sec.requiresSection) return true;
    const req = DATA.getSection(sec.requiresSection);
    if (!req) return true;
    return req.lessonIds.every((id) => isLessonComplete(id));
  }

  function nextLessonId() {
    const order = DATA.lessonOrder();
    for (const item of order) {
      if (!isLessonComplete(item.lessonId)) return item.lessonId;
    }
    return order[order.length - 1]?.lessonId || "king";
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
    if (!text || !fx.tts) return;
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
      const url =
        base +
        "/tts?lang=" +
        lang() +
        "&coach=" +
        encodeURIComponent((coach && coach.id) || "tilki") +
        "&text=" +
        encodeURIComponent(String(text).trim()) +
        "&v=el4";
      const headers = {};
      if (tk && tk.token) headers.Authorization = "Bearer " + tk.token;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const blob = await res.blob();
      audioEl = new Audio(URL.createObjectURL(blob));
      await audioEl.play();
    } catch (_) {}
  }

  function destroyBoard() {
    if (board) {
      try {
        board.destroy();
      } catch (_) {}
    }
    board = null;
  }

  function close() {
    stopAudio();
    destroyBoard();
    document.removeEventListener("keydown", onEsc, true);
    if (host && host.parentNode) host.parentNode.removeChild(host);
    host = null;
    shadow = null;
    root = null;
    lessonCtx = null;
    view = "map";
  }

  function onEsc(e) {
    if (e.key === "Escape") close();
  }

  function css() {
    const pathBg = learnAsset("path-bg.jpg");
    const boardBg = learnAsset("board-bg.jpg");
    const gemBg = learnAsset("tile-gem.svg");
    return `
      :host {
        position: fixed; inset: 0; z-index: 2147483646;
        font-family: "Segoe UI", system-ui, sans-serif;
        color: #eef1f7;
      }
      .fcl-backdrop {
        position: absolute; inset: 0;
        background: rgba(6,8,12,.92);
        backdrop-filter: blur(10px);
      }
      .fcl-shell {
        position: absolute; inset: 10px;
        display: flex; flex-direction: column;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.1);
        background: linear-gradient(180deg, #12151f 0%, #0a0c12 100%);
        box-shadow: 0 24px 80px rgba(0,0,0,.5);
        overflow: hidden;
      }
      .fcl-top, .fcl-body { position: relative; z-index: 1; }
      .fcl-top {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: rgba(0,0,0,.28);
        flex: 0 0 auto;
      }
      .fcl-back {
        appearance: none; cursor: pointer;
        width: 36px; height: 36px; border-radius: 10px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05); color: #dfe5f2;
        font-size: 18px; line-height: 1;
      }
      .fcl-back:hover { background: rgba(255,255,255,.12); }
      .fcl-title-wrap { flex: 1; min-width: 0; text-align: center; }
      .fcl-title { font-size: 14px; font-weight: 800; }
      .fcl-sub { font-size: 10px; color: #9aa3b5; margin-top: 2px; }
      .fcl-icon-btn {
        appearance: none; cursor: pointer;
        width: 36px; height: 36px; border-radius: 10px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.05); color: #dfe5f2;
        font-size: 14px;
      }
      .fcl-body { flex: 1; min-height: 0; overflow: hidden; position: relative; }
      .fcl-map, .fcl-lesson { position: absolute; inset: 0; display: flex; }
      .fcl-map { display: none; }
      .fcl-map.fcl-on, .fcl-lesson.fcl-on { display: flex; }
      .fcl-map-board {
        flex: 1.15; min-width: 0;
        display: flex; align-items: center; justify-content: center;
        padding: 20px 24px;
        background:
          linear-gradient(135deg, rgba(8,12,22,.92), rgba(12,20,36,.78)),
          url("${boardBg}") center/cover no-repeat;
        position: relative;
        overflow: hidden;
      }
      .fcl-map-board::before {
        content: ""; position: absolute; inset: 0;
        background: radial-gradient(ellipse 70% 60% at 50% 45%, rgba(76,141,255,.12), transparent 70%);
        pointer-events: none;
      }
      .fcl-map-board-frame {
        position: relative; z-index: 1;
        width: min(92%, 540px);
        padding: 14px;
        border-radius: 20px;
        background: linear-gradient(145deg, rgba(255,255,255,.08), rgba(255,255,255,.02));
        border: 1px solid rgba(255,255,255,.14);
        box-shadow: 0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.1);
        animation: fcl-board-in .7s cubic-bezier(.22,1,.36,1) both;
      }
      .fcl-map-board-inner {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 14px;
        overflow: hidden;
        border: 2px solid rgba(0,0,0,.25);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
      }
      @keyframes fcl-board-in {
        from { opacity: 0; transform: translateY(12px) scale(.96); }
        to { opacity: 1; transform: none; }
      }
      .fcl-map-side {
        flex: .88; min-width: 300px; max-width: 440px;
        display: flex; flex-direction: column;
        background:
          linear-gradient(180deg, rgba(10,12,18,.94) 0%, rgba(14,18,28,.98) 100%),
          url("${pathBg}") center top/cover no-repeat;
        border-left: 1px solid rgba(255,255,255,.08);
        position: relative;
      }
      .fcl-map-side::after {
        content: ""; position: absolute; inset: 0;
        background: linear-gradient(180deg, transparent 40%, rgba(0,0,0,.35) 100%);
        pointer-events: none;
      }
      .fcl-map-head {
        padding: 16px 18px 12px;
        display: flex; align-items: center; gap: 10px;
        position: relative; z-index: 2;
      }
      .fcl-grad {
        width: 36px; height: 36px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        background: linear-gradient(135deg, #4c8dff, #2a5fad);
        font-size: 18px;
        box-shadow: 0 6px 16px rgba(76,141,255,.35);
      }
      .fcl-map-head h2 { margin: 0; font-size: 17px; font-weight: 800; letter-spacing: -.02em; }
      .fcl-map-head-sub { font-size: 11px; color: #8b95a8; margin-top: 2px; }
      .fcl-coach-hero {
        position: relative; z-index: 2;
        margin: 0 14px 12px;
        padding: 14px;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
        border: 1px solid rgba(255,255,255,.1);
        display: flex; gap: 12px; align-items: flex-start;
        animation: fcl-hero-in .55s cubic-bezier(.22,1,.36,1) both;
      }
      @keyframes fcl-hero-in {
        from { opacity: 0; transform: translateX(10px); }
        to { opacity: 1; transform: none; }
      }
      .fcl-coach-portrait-wrap {
        position: relative; flex-shrink: 0;
        width: 88px; height: 88px;
      }
      .fcl-coach-glow {
        position: absolute; inset: -4px; border-radius: 20px;
        background: conic-gradient(from 120deg, #3dd68c, #4c8dff, #f5c542, #3dd68c);
        opacity: .55;
        animation: fcl-glow-spin 6s linear infinite;
        filter: blur(6px);
      }
      @keyframes fcl-glow-spin { to { transform: rotate(360deg); } }
      .fcl-coach-portrait {
        position: relative; z-index: 1;
        width: 88px; height: 88px; object-fit: contain;
        border-radius: 16px;
        background: rgba(0,0,0,.25);
        filter: drop-shadow(0 8px 16px rgba(0,0,0,.4));
        animation: fcl-coach-float 3.5s ease-in-out infinite;
      }
      @keyframes fcl-coach-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      .fcl-bubble {
        flex: 1; padding: 12px 14px; border-radius: 14px;
        background: #fff; color: #1a1d28;
        font-size: 13px; line-height: 1.45; font-weight: 500;
        position: relative;
        box-shadow: 0 8px 24px rgba(0,0,0,.2);
        animation: fcl-bub .5s cubic-bezier(.22,1,.36,1) both;
      }
      @keyframes fcl-bub {
        from { opacity: 0; transform: translateY(6px) scale(.98); }
        to { opacity: 1; transform: none; }
      }
      .fcl-bubble::before {
        content: ""; position: absolute; left: -7px; top: 22px;
        border: 7px solid transparent; border-right-color: #fff;
      }
      .fcl-path-scroll {
        flex: 1; overflow-y: auto; overflow-x: hidden;
        padding: 8px 12px 90px;
        position: relative; z-index: 2;
        scrollbar-width: thin;
        scrollbar-color: rgba(61,214,140,.4) transparent;
      }
      .fcl-path {
        display: flex; flex-direction: column; align-items: center;
        gap: 4px; position: relative;
        padding: 8px 0;
      }
      .fcl-path::before {
        content: ""; position: absolute;
        top: 24px; bottom: 24px; left: 50%;
        width: 4px; margin-left: -2px;
        background: linear-gradient(180deg, rgba(61,214,140,.15), rgba(76,141,255,.25), rgba(61,214,140,.15));
        border-radius: 999px;
        opacity: .7;
      }
      .fcl-path-section {
        width: 100%; text-align: center; margin: 16px 0 8px;
        font-size: 10px; font-weight: 800; letter-spacing: .14em;
        color: #9aa8bc; text-transform: uppercase;
        position: relative; z-index: 1;
      }
      .fcl-path-section span {
        display: inline-block; padding: 4px 12px;
        border-radius: 999px;
        background: rgba(0,0,0,.35);
        border: 1px solid rgba(255,255,255,.08);
      }
      .fcl-node {
        position: relative; z-index: 1;
        width: 100%; display: flex; justify-content: center;
        animation: fcl-tile-in .55s cubic-bezier(.22,1,.36,1) both;
      }
      .fcl-node:nth-child(odd) { padding-left: 0; }
      .fcl-node:nth-child(even) { padding-right: 0; }
      @keyframes fcl-tile-in {
        from { opacity: 0; transform: translateY(16px) scale(.92); }
        to { opacity: 1; transform: none; }
      }
      .fcl-tile {
        width: 92px; height: 92px;
        appearance: none; cursor: pointer; border: none; padding: 0;
        background: transparent; position: relative;
        transition: transform .3s cubic-bezier(.22,1,.36,1), filter .3s ease;
      }
      .fcl-tile:disabled { cursor: not-allowed; filter: grayscale(.7) brightness(.65); }
      .fcl-tile:not(:disabled):hover { transform: translateY(-3px) scale(1.04); }
      .fcl-tile-gem {
        position: absolute; inset: 0;
        background: url("${gemBg}") center/contain no-repeat;
        opacity: .95;
        transition: filter .3s ease;
      }
      .fcl-tile.done .fcl-tile-gem { filter: hue-rotate(40deg) saturate(1.2) brightness(1.05); }
      .fcl-tile.current .fcl-tile-gem {
        filter: brightness(1.15) saturate(1.3);
        animation: fcl-gem-pulse 2.2s ease-in-out infinite;
      }
      .fcl-tile.locked .fcl-tile-gem { opacity: .45; }
      @keyframes fcl-gem-pulse {
        0%, 100% { transform: scale(1); filter: brightness(1.1) drop-shadow(0 0 8px rgba(94,236,192,.3)); }
        50% { transform: scale(1.05); filter: brightness(1.2) drop-shadow(0 0 16px rgba(94,236,192,.55)); }
      }
      .fcl-piece-ico {
        position: absolute; left: 50%; top: 46%;
        width: 36px; height: 36px;
        transform: translate(-50%, -50%);
        object-fit: contain;
        filter: drop-shadow(0 3px 6px rgba(0,0,0,.45));
        pointer-events: none;
      }
      .fcl-tile-label {
        position: absolute; left: 50%; bottom: 8px;
        transform: translateX(-50%);
        font-size: 9px; font-weight: 800; letter-spacing: .04em;
        color: rgba(255,255,255,.9);
        text-shadow: 0 1px 3px rgba(0,0,0,.8);
        pointer-events: none; white-space: nowrap;
      }
      .fcl-done-badge {
        position: absolute; right: 4px; top: 4px;
        width: 22px; height: 22px; border-radius: 50%;
        background: linear-gradient(135deg, #3dd68c, #2ab872);
        color: #0a1a12; font-size: 12px; font-weight: 900;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 8px rgba(61,214,140,.5);
      }
      .fcl-lock-badge {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; opacity: .7;
      }
      .fcl-next-badge {
        position: absolute; top: -2px; left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #5eecc0, #2ab872);
        color: #0a1a12;
        font-size: 9px; font-weight: 900; padding: 4px 10px;
        border-radius: 999px; z-index: 3;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(61,214,140,.45);
        animation: fcl-badge-bob 2s ease-in-out infinite;
      }
      @keyframes fcl-badge-bob {
        0%, 100% { transform: translateX(-50%) translateY(0); }
        50% { transform: translateX(-50%) translateY(-3px); }
      }
      .fcl-map-foot {
        padding: 14px 16px 18px;
        border-top: 1px solid rgba(255,255,255,.08);
        background: rgba(0,0,0,.45);
        backdrop-filter: blur(8px);
        position: relative; z-index: 3;
      }
      .fcl-foot-title { font-size: 13px; font-weight: 800; margin-bottom: 10px; color: #dfe5f2; }
      .fcl-foot-row { display: flex; gap: 10px; }
      .fcl-btn-green {
        flex: 1; appearance: none; cursor: pointer; border: none;
        border-radius: 14px; padding: 14px 18px;
        font-size: 14px; font-weight: 800;
        background: linear-gradient(135deg, #5eecc0 0%, #2ab872 100%);
        color: #0a1a12;
        box-shadow: 0 8px 24px rgba(61,214,140,.3), inset 0 1px 0 rgba(255,255,255,.25);
        transition: transform .25s ease, box-shadow .25s ease;
      }
      .fcl-btn-green[data-lesson-act="continue"]::before {
        content: "✓"; margin-right: 8px; font-weight: 900;
      }
      .fcl-btn-ghost {
        appearance: none; cursor: pointer;
        width: 48px; border-radius: 14px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06); color: #dfe5f2;
        font-size: 16px;
        transition: background .2s ease;
      }
      .fcl-btn-ghost:hover { background: rgba(255,255,255,.12); }
      .fcl-lesson {
        display: none;
        flex-direction: row;
      }
      .fcl-lesson-board {
        flex: 1.2; min-width: 0;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; position: relative;
        background:
          linear-gradient(135deg, rgba(8,12,22,.9), rgba(12,20,36,.75)),
          url("${boardBg}") center/cover no-repeat;
      }
      .fcl-lesson-board .fcl-board-box {
        width: min(88vh, 100%); max-width: 680px;
        padding: 12px;
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(255,255,255,.07), rgba(255,255,255,.02));
        border: 1px solid rgba(255,255,255,.12);
        box-shadow: 0 20px 50px rgba(0,0,0,.4);
      }
      .fcl-board-box {
        position: relative;
        overflow: hidden;
      }
      .fsq-sq { overflow: visible; }
      .fcl-star {
        position: absolute;
        left: 50%; top: 50%;
        width: 52%; height: 52%;
        max-width: 52px; max-height: 52px;
        transform: translate(-50%, -50%);
        pointer-events: none;
        z-index: 6;
        opacity: 0;
        animation: fcl-star-in .45s cubic-bezier(.22,1,.36,1) forwards,
                   fcl-star-glow 2.8s ease-in-out .45s infinite;
      }
      .fcl-star-cap {
        width: 34%; height: 34%;
        max-width: 34px; max-height: 34px;
        top: 28%; left: 50%;
        transform: translate(-50%, -50%);
        z-index: 8;
      }
      .fcl-star svg {
        width: 100%; height: 100%; display: block;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.25));
      }
      @keyframes fcl-star-in {
        from { opacity: 0; transform: translate(-50%, -50%) scale(.55); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
      }
      @keyframes fcl-star-glow {
        0%, 100% { opacity: 0.9; filter: brightness(1); }
        50% { opacity: 1; filter: brightness(1.06); }
      }
      .fcl-lesson-side {
        flex: .8; min-width: 300px; max-width: 400px;
        display: flex; flex-direction: column;
        background: linear-gradient(180deg, #141820 0%, #0c0e14 100%);
        border-left: 1px solid rgba(255,255,255,.08);
      }
      .fcl-lesson-coach {
        flex: 1; padding: 20px 16px;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 16px; min-height: 0;
        text-align: center;
      }
      .fcl-lesson-coach .fcl-coach-portrait-wrap { width: 120px; height: 120px; }
      .fcl-lesson-coach .fcl-coach-portrait { width: 120px; height: 120px; }
      .fcl-lesson-coach .fcl-bubble {
        flex: 0 0 auto;
        width: 100%;
        max-width: 100%;
        text-align: left;
        align-self: stretch;
      }
      .fcl-lesson-coach .fcl-bubble::before {
        left: 28px; top: -7px;
        border: 7px solid transparent;
        border-bottom-color: #fff;
        border-right-color: transparent;
      }
      .fcl-coach-row { display: contents; }
      .fcl-lesson-head {
        display: flex; align-items: center; gap: 8px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(255,255,255,.06);
      }
      .fcl-lesson-head .fcl-title-wrap { text-align: left; }
      .fcl-lesson-coach .fcl-coach-row { padding: 0; border: none; }
      .fcl-lesson-coach .fcl-coach-av { width: 64px; height: 64px; }
      .fcl-progress-wrap {
        padding: 0 16px 16px; margin-top: auto;
      }
      .fcl-ch-label { font-size: 12px; color: #9aa3b5; margin-bottom: 6px; }
      .fcl-ch-bar {
        height: 6px; border-radius: 999px;
        background: rgba(255,255,255,.1); overflow: hidden;
      }
      .fcl-ch-fill {
        height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #3dd68c, #5eecc0);
        width: 0%;
        transition: width .6s cubic-bezier(.22,1,.36,1);
      }
      .fcl-lesson-foot { padding: 12px 16px 16px; }
      .fcl-complete-overlay {
        position: absolute; inset: 0; z-index: 20;
        display: flex; align-items: center; justify-content: center;
        background: rgba(6,8,12,.55);
        backdrop-filter: blur(4px);
        animation: fcl-fade-in .4s ease;
      }
      @keyframes fcl-fade-in { from { opacity: 0; } to { opacity: 1; } }
      .fcl-complete-card {
        text-align: center; padding: 24px;
        animation: fcl-pop .55s cubic-bezier(.22,1,.36,1);
      }
      @keyframes fcl-pop {
        from { opacity: 0; transform: scale(.85); }
        to { opacity: 1; transform: scale(1); }
      }
      .fcl-complete-star {
        width: 96px; height: 96px; margin: 0 auto 12px;
        animation: fcl-star-reveal .65s cubic-bezier(.22,1,.36,1) both;
      }
      @keyframes fcl-star-reveal {
        from { opacity: 0; transform: scale(.75); }
        to { opacity: 1; transform: scale(1); }
      }
      .fcl-complete-title { font-size: 28px; font-weight: 900; margin: 0; }
      .fcl-complete-sub { font-size: 14px; color: #b8c0d0; margin-top: 4px; }
      .fcl-board-complete {
        position: absolute; inset: 0; z-index: 15;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
        background: rgba(0,0,0,.35);
        animation: fcl-fade-in .5s ease;
      }
      .fcl-board-complete-inner { text-align: center; }
      .fcl-board-complete .fcl-complete-star { width: 100px; height: 100px; }
      .fcl-hand {
        position: absolute;
        right: 2px; bottom: 2px;
        width: 20px; height: 20px;
        font-size: 16px; line-height: 1;
        z-index: 7;
        pointer-events: none;
        opacity: 0;
        animation: fcl-hand-in .5s cubic-bezier(.22,1,.36,1) .35s forwards,
                   fcl-hand-soft 2s ease-in-out 1s infinite;
      }
      @keyframes fcl-hand-in {
        from { opacity: 0; transform: translate(4px, 4px); }
        to { opacity: .92; transform: none; }
      }
      @keyframes fcl-hand-soft {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(2px, -3px); }
      }
      @media (max-width: 900px) {
        .fcl-map, .fcl-lesson { flex-direction: column; }
        .fcl-map-side, .fcl-lesson-side { max-width: none; min-width: 0; flex: none; max-height: 45vh; }
        .fcl-map-board { flex: none; padding: 10px; }
        .fcl-map-board-frame { width: min(300px, 92vw); padding: 10px; }
        .fcl-coach-hero { margin: 0 10px 10px; padding: 12px; }
        .fcl-coach-portrait-wrap { width: 72px; height: 72px; }
        .fcl-coach-portrait { width: 72px; height: 72px; }
      }
    `;
  }

  function starSvg(uid) {
    const id = "fclsg" + (uid || "0");
    return (
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><linearGradient id="' +
      id +
      '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0%" stop-color="#ffe566"/><stop offset="100%" stop-color="#e8a020"/></linearGradient></defs>' +
      '<path fill="url(#' +
      id +
      ')" d="M32 6l6.8 16.2L56 22.5l-12.8 11.2L46 52 32 43.5 18 52l2.8-18.3L8 22.5l17.2-0.3z"/>' +
      "</svg>"
    );
  }

  function isCaptureLesson() {
    const id = lessonCtx && lessonCtx.lesson && lessonCtx.lesson.id;
    return !!id && (id === "capture" || String(id).indexOf("cap_") === 0);
  }

  function challengeFromSquare(step, pathIdx) {
    const idx = pathIdx != null ? pathIdx : (lessonCtx && lessonCtx.pathIdx) || 0;
    const path = (step.path || [])[idx];
    if (path && path.length >= 4) return path.slice(0, 2).toLowerCase();
    if (step.movable) return String(step.movable).toLowerCase();
    return null;
  }

  function challengeTargetSquare(step, pathIdx) {
    const idx = pathIdx != null ? pathIdx : (lessonCtx && lessonCtx.pathIdx) || 0;
    const path = (step.path || [])[idx];
    if (path && path.length >= 4) return path.slice(2, 4).toLowerCase();
    return step.star ? String(step.star).toLowerCase() : "";
  }

  function placeChallengeGoal(step, pathIdx) {
    clearStar();
    if (!step) return;
    const to = challengeTargetSquare(step, pathIdx);
    const from = challengeFromSquare(step, pathIdx);
    if (!to) return;
    const capture = isCaptureLesson();
    const run = () => {
      if (board && typeof board.clearArrow === "function") board.clearArrow();
      const box = root.querySelector(".fcl-board-box");
      const cell = box && box.querySelector('[data-sq="' + to + '"]');
      if (!cell) return;
      const star = document.createElement("div");
      star.className = "fcl-star" + (capture ? " fcl-star-cap" : "");
      star.innerHTML = starSvg(to);
      cell.appendChild(star);
      if (capture && from && board && typeof board.drawArrow === "function") {
        board.drawArrow(from, to, "info");
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }

  function placeStar(sq) {
    clearStar();
    if (!sq || !board) return;
    const run = () => {
      const box = root.querySelector(".fcl-board-box");
      const cell = box && box.querySelector('[data-sq="' + sq + '"]');
      if (!cell) return;
      const star = document.createElement("div");
      star.className = "fcl-star";
      star.innerHTML = starSvg(sq);
      cell.appendChild(star);
    };
    requestAnimationFrame(() => requestAnimationFrame(run));
  }

  function clearStar() {
    root.querySelectorAll(".fcl-star, .fcl-hand").forEach((n) => n.remove());
  }

  function showHandOnStar(sq) {
    placeStar(sq);
    const run = () => {
      const box = root.querySelector(".fcl-board-box");
      const cell = box && box.querySelector('[data-sq="' + sq + '"]');
      if (!cell || !cell.querySelector(".fcl-star")) return;
      const hand = document.createElement("div");
      hand.className = "fcl-hand";
      hand.textContent = "👆";
      hand.setAttribute("aria-hidden", "true");
      cell.appendChild(hand);
    };
    requestAnimationFrame(() => setTimeout(run, 120));
  }

  function renderMap() {
    view = "map";
    lessonCtx = null;
    destroyBoard();
    const mapEl = root.querySelector(".fcl-map");
    const lessonEl = root.querySelector(".fcl-lesson");
    mapEl.classList.add("fcl-on");
    lessonEl.classList.remove("fcl-on");

    const pathEl = root.querySelector(".fcl-path");
    const bubbleEl = root.querySelector(".fcl-map-bubble");
    const nextId = nextLessonId();
    progress.currentLesson = nextId;

    const mapIntro = lang() === "en"
      ? "Learn how to move the pieces — one lesson at a time."
      : "Taşların nasıl hareket ettiğini öğren — ders ders ilerle.";

    if (bubbleEl) bubbleEl.textContent = mapIntro;

    let html = "";
    let tileDelay = 0;
    for (const sec of DATA.SECTIONS) {
      const secOpen = isSectionUnlocked(sec);
      html += `<div class="fcl-path-section">${esc(L(sec.title))}</div>`;
      if (!secOpen) {
        html += `<div class="fcl-path-section" style="margin-top:0;color:#5a6275">${T("Önce önceki bölümü tamamla")}</div>`;
        continue;
      }
      for (const lid of sec.lessonIds) {
        const lesson = DATA.getLesson(lid);
        if (!lesson) continue;
        const done = isLessonComplete(lid);
        const unlocked = isLessonUnlocked(lid, sec.id);
        const isCurrent = !done && unlocked && lid === nextId;
        let cls = "fcl-tile";
        if (done) cls += " done";
        else if (!unlocked) cls += " locked";
        else if (isCurrent) cls += " current";

        const zig = tileDelay % 2 ? "padding-left:52px" : "padding-right:52px";
        let inner = "";
        if (!unlocked) {
          inner = `<span class="fcl-lock-badge">🔒</span>`;
        } else if (lesson.piece) {
          inner = `<img class="fcl-piece-ico" src="${esc(pieceUrl(lesson.piece))}" alt="" />`;
        } else {
          inner = `<span class="fcl-tile-label">${lesson.icon || "♟"}</span>`;
        }
        if (done) inner += `<span class="fcl-done-badge">✓</span>`;

        html += `<div class="fcl-node" style="animation-delay:${tileDelay * 0.06}s;${zig}">
          <button type="button" class="${cls}" data-lesson="${esc(lid)}" ${unlocked ? "" : "disabled"}>
            <span class="fcl-tile-gem" aria-hidden="true"></span>
            ${inner}
            ${isCurrent ? `<span class="fcl-next-badge">${T("Sıradaki")}</span>` : ""}
          </button>
        </div>`;
        tileDelay++;
      }
    }
    pathEl.innerHTML = html;

    pathEl.querySelectorAll("[data-lesson]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.lesson;
        if (id) openLesson(id);
      });
    });

    const footBtn = root.querySelector("[data-act=next-lesson]");
    if (footBtn) {
      footBtn.textContent =
        T("Sonraki Ders") + " →";
      footBtn.onclick = () => openLesson(nextId);
    }

    paintMapBoard();
    speak(mapIntro);
  }

  function paintMapBoard() {
    const box = root.querySelector(".fcl-map-board-inner");
    if (!box || !window.ForkSightQuizBoard) return;
    box.innerHTML = "";
    const QB = window.ForkSightQuizBoard.create(box, { onMove: () => {} });
    QB.setPosition(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1",
      "w",
    );
    QB.lock(true);
  }

  function openLesson(lessonId) {
    const lesson = DATA.getLesson(lessonId);
    if (!lesson) return;
    view = "lesson";
    lessonCtx = {
      lesson,
      stepIdx: 0,
      pathIdx: 0,
      challengeNum: 0,
      challengeTotal: DATA.challengeCount(lesson),
      fenBeforeStep: "",
    };

    const mapEl = root.querySelector(".fcl-map");
    const lessonEl = root.querySelector(".fcl-lesson");
    mapEl.classList.remove("fcl-on");
    lessonEl.classList.add("fcl-on");

    root.querySelector(".fcl-lesson-title").textContent = L(lesson.title);
    root.querySelector(".fcl-lesson-sub").textContent = T("Öğren");

    destroyBoard();
    const boardBox = root.querySelector(".fcl-board-box");
    boardBox.innerHTML = "";

    board = window.ForkSightQuizBoard.create(boardBox, {
      onMove: onBoardMove,
      canSelect: canSelectSquare,
      keepSideToMove: true,
      forbidKingCapture: true,
      onIllegalMove: () => {
        const msg =
          lang() === "en"
            ? "The king cannot be captured — give check, not take the king!"
            : "Şah yenilmez — şah çek, şahın üstüne gidemezsin!";
        setCoachBubble(msg, "thinking");
        speak(msg);
      },
    });

    renderLessonStep();
  }

  function currentStep() {
    if (!lessonCtx) return null;
    return lessonCtx.lesson.steps[lessonCtx.stepIdx] || null;
  }

  function expectedFromSquare() {
    const step = currentStep();
    if (!step || step.type !== "challenge") return null;
    const path = step.path || [];
    const uci = path[lessonCtx.pathIdx];
    if (uci && uci.length >= 4) return uci.slice(0, 2).toLowerCase();
    if (step.movable) return String(step.movable).toLowerCase();
    return null;
  }

  function canSelectSquare(sq) {
    const from = expectedFromSquare();
    if (!from) return true;
    return String(sq).toLowerCase() === from;
  }

  function challengeIndexForStep(stepIdx) {
    if (!lessonCtx) return 0;
    let n = 0;
    for (let i = 0; i <= stepIdx; i++) {
      if (lessonCtx.lesson.steps[i]?.type === "challenge") n++;
    }
    return n;
  }

  function updateProgressUI() {
    const step = currentStep();
    const wrap = root.querySelector(".fcl-progress-wrap");
    if (!wrap) return;
    if (!step || step.type !== "challenge") {
      wrap.style.display = "none";
      return;
    }
    wrap.style.display = "block";
    const num = challengeIndexForStep(lessonCtx.stepIdx);
    root.querySelector(".fcl-ch-label").textContent =
      T("Görev") + " " + num + "/" + lessonCtx.challengeTotal;
    const pct = Math.round((num / lessonCtx.challengeTotal) * 100);
    root.querySelector(".fcl-ch-fill").style.width = pct + "%";
  }

  function setCoachBubble(text) {
    const el = root.querySelector(".fcl-lesson-bubble");
    const av = root.querySelector(".fcl-lesson-av");
    const mapAv = root.querySelector(".fcl-map-coach");
    if (el) {
      el.textContent = text;
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    }
    const portrait = coachPortrait();
    if (av && portrait) av.src = portrait;
    if (mapAv && portrait) mapAv.src = portrait;
  }

  function setFooterButton(label, act) {
    const btn = root.querySelector("[data-act=lesson-action]");
    if (!btn) return;
    btn.textContent = label;
    btn.dataset.lessonAct = act;
    btn.style.display = "block";
  }

  function hideFooterButton() {
    const btn = root.querySelector("[data-act=lesson-action]");
    if (btn) btn.style.display = "none";
  }

  function highlightChallengePiece() {
    const from = expectedFromSquare();
    if (!board || !from) return;
    if (typeof board.highlightHint === "function") board.highlightHint(from);
  }

  async function renderLessonStep() {
    const step = currentStep();
    if (!step) {
      await showLessonComplete();
      return;
    }

    root.querySelectorAll(".fcl-complete-overlay, .fcl-board-complete").forEach((n) => n.remove());
    clearStar();
    if (board) {
      board.clearHighlights();
      board.clearArrow();
      board.lock(false);
    }

    const fen = step.fen || "8/8/8/8/8/8/8/4K3 w - - 0 1";
    const side = fen.split(/\s+/)[1] === "b" ? "b" : "w";
    lessonCtx.pathIdx = 0;
    lessonCtx.fenBeforeStep = fen;

    if (board) board.setPosition(fen, side);

    setCoachBubble(L(step.text), "neutral");
    await speak(L(step.text));
    updateProgressUI();

    if (step.type === "intro") {
      setFooterButton(T("Başla"), "continue");
      hideChallengeUI();
    } else if (step.type === "demo") {
      setFooterButton(T("Devam Et"), "continue");
      hideChallengeUI();
      if (board && step.arrows) {
        setTimeout(() => {
          for (const [from, to] of step.arrows) {
            board.drawArrow(from, to, "info");
          }
        }, fx.animations ? 400 : 0);
      }
    } else if (step.type === "challenge") {
      hideFooterButton();
      placeChallengeGoal(step);
      setTimeout(highlightChallengePiece, fx.animations ? 350 : 50);
      if (fx.animations && !isCaptureLesson()) {
        setTimeout(
          () => showHandOnStar(challengeTargetSquare(step)),
          800,
        );
      }
      lessonCtx.fenBeforeStep = fen;
    }
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeUci(uci) {
    return String(uci || "").toLowerCase().slice(0, 4);
  }

  function isCorrectLearnMove(uci, step, pathIdx) {
    const path = step.path || [];
    const exp = path[pathIdx];
    if (!exp) return false;
    const u = normalizeUci(uci);
    const e = normalizeUci(exp);
    if (u === e) return true;
    const from = expectedFromSquare();
    if (!from || u.slice(0, 2) !== from) return false;
    const isLast = pathIdx >= path.length - 1;
    const target = challengeTargetSquare(step, pathIdx);
    if (isLast && target && u.slice(2, 4) === target) return true;
    if (!isLast && u.slice(2, 4) === e.slice(2, 4)) return true;
    return false;
  }

  function hideChallengeUI() {
    const wrap = root.querySelector(".fcl-progress-wrap");
    if (wrap) wrap.style.display = "none";
  }

  async function onBoardMove(uci) {
    const step = currentStep();
    if (!step || step.type !== "challenge") return;

    const expected = (step.path || [])[lessonCtx.pathIdx];
    if (!expected) return;

    if (!isCorrectLearnMove(uci, step, lessonCtx.pathIdx)) {
      if (board) {
        const fb = lessonCtx.fenBeforeStep || step.fen;
        const sd = fb.split(/\s+/)[1] === "b" ? "b" : "w";
        board.setPosition(fb, sd);
        board.flash(uci.slice(0, 2), uci.slice(2, 4), "err");
        setTimeout(() => {
          highlightChallengePiece();
          placeChallengeGoal(step, lessonCtx.pathIdx);
        }, 80);
      }
      const isCapture =
        lessonCtx &&
        lessonCtx.lesson &&
        (lessonCtx.lesson.id === "capture" ||
          String(lessonCtx.lesson.id).indexOf("cap_") === 0);
      const wrong = isCapture
        ? lang() === "en"
          ? "Try again — capture the piece."
          : "Tekrar dene — taşı ele geçir."
        : lang() === "en"
          ? "Try again — follow the star."
          : "Tekrar dene — yıldızı takip et.";
      setCoachBubble(wrong, "thinking");
      void speak(wrong);
      return;
    }

    const okText = L(step.success) || (lang() === "en" ? "Nice!" : "Harika!");
    setCoachBubble(okText, "happy");
    await speak(okText);

    lessonCtx.pathIdx++;
    if (lessonCtx.pathIdx < (step.path || []).length) {
      if (board && typeof board.getFen === "function") {
        lessonCtx.fenBeforeStep = board.getFen();
      }
      if (board && typeof board.lock === "function") board.lock(false);
      if (fx.animations) await delay(350);
      placeChallengeGoal(step, lessonCtx.pathIdx);
      if (board) {
        board.clearHighlights();
        highlightChallengePiece();
      }
      const hint =
        lang() === "en"
          ? "Keep going — capture the star."
          : "Devam et — yıldıza ulaş.";
      setCoachBubble(hint, "neutral");
      return;
    }

    clearStar();
    root.querySelectorAll(".fcl-hand").forEach((n) => n.remove());
    if (board) {
      board.flash(uci.slice(0, 2), uci.slice(2, 4), "ok");
      board.lock(true);
    }

    if (fx.animations) await delay(450);
    lessonCtx.stepIdx++;
    await renderLessonStep();
  }

  async function showLessonComplete() {
    const lesson = lessonCtx.lesson;
    const boardWrap = root.querySelector(".fcl-lesson-board");
    const completeText = L(lesson.complete);

    setCoachBubble(completeText, "happy");
    await speak(completeText);
    hideFooterButton();
    hideChallengeUI();

    progress.completed[lesson.id] = {
      done: true,
      ts: Date.now(),
      stars: 3,
    };
    const nxt = nextLessonId();
    progress.currentLesson = nxt;
    saveProgress();

    const overlay = document.createElement("div");
    overlay.className = "fcl-board-complete";
    overlay.innerHTML =
      '<div class="fcl-board-complete-inner">' +
      '<div class="fcl-complete-star">' +
      starSvg() +
      "</div>" +
      "<h2 class=\"fcl-complete-title\">" +
      esc(L(lesson.title)) +
      "</h2>" +
      '<p class="fcl-complete-sub">' +
      esc(T("Ders Tamamlandı")) +
      "</p></div>";
    boardWrap.appendChild(overlay);

    setFooterButton(T("Devam Et →"), "finish-lesson");
    const btn = root.querySelector("[data-act=lesson-action]");
    if (btn) btn.style.display = "block";
  }

  function mountShell() {
    host = document.createElement("div");
    host.id = "forksight-coach-learn";
    shadow = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = css();
    shadow.appendChild(style);

    const cname = (coach && coach.name) || "Coach";
    const portrait = coachPortrait();

    root = document.createElement("div");
    root.className = "fcl-shell";
    root.innerHTML = `
      <div class="fcl-backdrop"></div>
      <div class="fcl-top">
        <button type="button" class="fcl-back" data-act="back" title="${esc(T("Geri"))}">←</button>
        <div class="fcl-title-wrap">
          <div class="fcl-title">${esc(T("Koçla Öğren"))}</div>
          <div class="fcl-sub">${esc(cname)}</div>
        </div>
        <button type="button" class="fcl-icon-btn" data-act="close" title="${esc(T("Kapat"))}">✕</button>
      </div>
      <div class="fcl-body">
        <div class="fcl-map fcl-on">
          <div class="fcl-map-board">
            <div class="fcl-map-board-frame">
              <div class="fcl-map-board-inner"></div>
            </div>
          </div>
          <div class="fcl-map-side">
            <div class="fcl-map-head">
              <span class="fcl-grad">🎓</span>
              <div>
                <h2>${esc(T("Öğren"))}</h2>
                <div class="fcl-map-head-sub">${esc(T("Oynamayı Öğren"))}</div>
              </div>
            </div>
            <div class="fcl-coach-hero">
              <div class="fcl-coach-portrait-wrap">
                <div class="fcl-coach-glow" aria-hidden="true"></div>
                <img class="fcl-coach-portrait fcl-map-coach" src="${esc(portrait)}" alt="" />
              </div>
              <div class="fcl-bubble fcl-map-bubble"></div>
            </div>
            <div class="fcl-path-scroll">
              <div class="fcl-path"></div>
            </div>
            <div class="fcl-map-foot">
              <div class="fcl-foot-title">${esc(T("Oynamayı Öğren"))}</div>
              <div class="fcl-foot-row">
                <button type="button" class="fcl-btn-ghost" data-act="back" title="${esc(T("Geri"))}">☰</button>
                <button type="button" class="fcl-btn-green" data-act="next-lesson">${esc(T("Sonraki Ders"))} →</button>
              </div>
            </div>
          </div>
        </div>
        <div class="fcl-lesson">
          <div class="fcl-lesson-board">
            <div class="fcl-board-box"></div>
          </div>
          <div class="fcl-lesson-side">
            <div class="fcl-lesson-head">
              <button type="button" class="fcl-back" data-act="back-lesson">←</button>
              <div class="fcl-title-wrap">
                <div class="fcl-title fcl-lesson-title">🎓 ${esc(T("Ders"))}</div>
                <div class="fcl-sub fcl-lesson-sub"></div>
              </div>
              <button type="button" class="fcl-icon-btn" data-act="tts" title="TTS">🔊</button>
            </div>
            <div class="fcl-lesson-coach">
              <div class="fcl-coach-portrait-wrap">
                <div class="fcl-coach-glow" aria-hidden="true"></div>
                <img class="fcl-coach-portrait fcl-lesson-av" src="${esc(portrait)}" alt="" />
              </div>
              <div class="fcl-bubble fcl-lesson-bubble"></div>
            </div>
            <div class="fcl-progress-wrap" style="display:none">
              <div class="fcl-ch-label"></div>
              <div class="fcl-ch-bar"><div class="fcl-ch-fill"></div></div>
            </div>
            <div class="fcl-lesson-foot">
              <button type="button" class="fcl-btn-green" data-act="lesson-action" style="display:none"></button>
            </div>
          </div>
        </div>
      </div>
    `;

    shadow.appendChild(root);
    document.body.appendChild(host);

    root.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const a = b.dataset.act;
      if (a === "close" || a === "back") close();
      else if (a === "back-lesson") renderMap();
      else if (a === "tts") {
        fx.tts = !fx.tts;
        try {
          chrome.storage.local.set({ [FX_KEY]: fx });
        } catch (_) {}
        if (!fx.tts) stopAudio();
      } else if (a === "lesson-action") {
        const la = b.dataset.lessonAct;
        if (la === "continue") {
          lessonCtx.stepIdx++;
          void renderLessonStep();
        } else if (la === "finish-lesson") renderMap();
      }
    });

    document.addEventListener("keydown", onEsc, true);
  }

  function open(opts) {
    opts = opts || {};
    if (host) close();
    coach = opts.coach || null;
    speakFn = opts.speak || null;
    loadProgress(() => {
      mountShell();
      renderMap();
    });
  }

  window.ForkSightCoachLearn = { open, close };
})();
