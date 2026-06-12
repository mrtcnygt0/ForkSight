/* ForkSight Coach Avatar — passive draggable mascot
 *
 * Public API (window.ForkSightAvatar):
 *   setState(state)   → switch expression. One of:
 *       'neutral' | 'happy' | 'winning' | 'thinking' | 'worried' |
 *       'losing'  | 'opportunity' | 'mistake' | 'gameOver'
 *   getState()        → current state string
 *   show() / hide()   → toggle visibility
 *   blink(on)         → toggle game-over blink/pulse animation
 *   resetPosition()   → restore default bottom-right corner
 *
 * Persistence: position is saved to chrome.storage.local (key
 * "forksight_avatar_pos") with a localStorage fallback so the user
 * only has to place it once per device.
 *
 * Step 1: this file only renders the avatar and handles dragging.
 * Eval → state mapping is wired up by content.js in a later step.
 */
(function () {
  "use strict";

  const STORAGE_KEY = "forksight_avatar_pos";
  const VISIBLE_KEY = "forksight_avatar_visible";
  const STATES = [
    "neutral",
    "happy",
    "winning",
    "thinking",
    "worried",
    "losing",
    "opportunity",
    "mistake",
    "gameOver",
  ];
  const SIZE = 110; // px, container box

  let containerEl = null;
  let imgEl = null;
  let currentState = "neutral";

  // Attention-grabbing states (mistake / opportunity) "stick" briefly so
  // the user actually sees them. gameOver sticks until next analysis.
  let stateLockUntil = 0;
  const STATE_PRIORITY = {
    gameOver: 100,
    mistake: 50,
    opportunity: 50,
    winning: 30,
    losing: 30,
    happy: 20,
    worried: 20,
    thinking: 10,
    neutral: 0,
  };

  // Eval thresholds (pawn units, from PLAYER's perspective).
  // Tuned to be forgiving — small fluctuations stay in 'thinking'.
  function stateFromEval(ev) {
    if (typeof ev !== "number" || !isFinite(ev)) return "neutral";
    if (ev >= 1.5) return "winning";
    if (ev >= 0.5) return "happy";
    if (ev >= -0.5) return "thinking";
    if (ev >= -1.5) return "worried";
    return "losing";
  }

  function imgUrl(state) {
    try {
      return chrome.runtime.getURL("avatars/" + state + ".png");
    } catch (e) {
      return "avatars/" + state + ".png";
    }
  }

  function loadPosition(cb) {
    try {
      chrome.storage.local.get([STORAGE_KEY, VISIBLE_KEY], (r) => {
        cb({
          pos: r && r[STORAGE_KEY] ? r[STORAGE_KEY] : null,
          visible: r && r[VISIBLE_KEY] !== false, // default true
        });
      });
    } catch (e) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const vis = localStorage.getItem(VISIBLE_KEY);
        cb({
          pos: raw ? JSON.parse(raw) : null,
          visible: vis === null ? true : vis === "true",
        });
      } catch (_) {
        cb({ pos: null, visible: true });
      }
    }
  }

  function savePosition(pos) {
    try {
      chrome.storage.local.set({ [STORAGE_KEY]: pos });
    } catch (e) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
      } catch (_) {}
    }
  }

  function saveVisible(visible) {
    try {
      chrome.storage.local.set({ [VISIBLE_KEY]: !!visible });
    } catch (e) {
      try {
        localStorage.setItem(VISIBLE_KEY, visible ? "true" : "false");
      } catch (_) {}
    }
  }

  function clampToViewport(left, top) {
    const w = (containerEl && containerEl.offsetWidth) || SIZE;
    const h = (containerEl && containerEl.offsetHeight) || SIZE;
    const maxLeft = Math.max(0, window.innerWidth - w);
    const maxTop = Math.max(0, window.innerHeight - h);
    return {
      left: Math.max(0, Math.min(left, maxLeft)),
      top: Math.max(0, Math.min(top, maxTop)),
    };
  }

  function applyPosition(pos) {
    if (!containerEl) return;
    const { left, top } = clampToViewport(pos.left, pos.top);
    containerEl.style.left = left + "px";
    containerEl.style.top = top + "px";
    containerEl.style.right = "auto";
    containerEl.style.bottom = "auto";
  }

  function defaultPosition() {
    const margin = 24;
    return {
      left: Math.max(0, window.innerWidth - SIZE - margin),
      top: Math.max(0, window.innerHeight - SIZE - margin),
    };
  }

  function makeDraggable(el, handle) {
    let dragging = false;
    let sx = 0;
    let sy = 0;
    let startLeft = 0;
    let startTop = 0;
    let moved = false;

    const onMove = (e) => {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = cx - sx;
      const dy = cy - sy;
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
      const { left, top } = clampToViewport(startLeft + dx, startTop + dy);
      el.style.left = left + "px";
      el.style.top = top + "px";
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove("forksight-avatar--dragging");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("touchcancel", onUp);
      if (moved) {
        const rect = el.getBoundingClientRect();
        savePosition({ left: rect.left, top: rect.top });
      }
    };

    const onDown = (e) => {
      // Only main button (mouse) or single touch
      if (e.button !== undefined && e.button !== 0) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      dragging = true;
      moved = false;
      sx = cx;
      sy = cy;
      const rect = el.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      el.classList.add("forksight-avatar--dragging");
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onUp);
      document.addEventListener("touchcancel", onUp);
    };

    handle.addEventListener("mousedown", onDown);
    handle.addEventListener("touchstart", onDown, { passive: false });

    // Swallow the click that immediately follows a drag so it doesn't
    // accidentally trigger downstream click handlers.
    handle.addEventListener(
      "click",
      (e) => {
        if (moved) {
          e.stopPropagation();
          e.preventDefault();
          moved = false;
        }
      },
      true,
    );
  }

  function setState(state) {
    if (!STATES.includes(state)) return;
    currentState = state;
    if (imgEl) imgEl.src = imgUrl(state);
    if (containerEl) containerEl.dataset.state = state;
  }

  function blink(on) {
    if (!containerEl) return;
    containerEl.classList.toggle("forksight-avatar--blink", !!on);
  }

  /**
   * High-level eval → emotion dispatcher. Called by content.js after every
   * Stockfish analysis. The avatar NEVER reveals which move is best — it
   * only reflects the mood of the position. This is the ethical core of
   * the coach avatar: visible during play, but provides zero hint info.
   *
   * @param {object} data
   * @param {number}  [data.playerEval]    Eval in pawn units, player POV.
   * @param {boolean} [data.isPlayerTurn]  true = player to move now.
   * @param {number}  [data.evalChange]    Δ after player's last move (only
   *                                       meaningful when isPlayerTurn=false).
   * @param {number}  [data.topGap]        |best - second-best| score gap.
   *                                       Used for 'opportunity' detection
   *                                       on the player's turn.
   * @param {boolean} [data.isGameOver]    true → freeze on gameOver + blink.
   */
  function update(data) {
    if (!data || typeof data !== "object") return;
    const { playerEval, isPlayerTurn, evalChange, topGap, isGameOver } = data;
    const now = Date.now();

    if (isGameOver) {
      setState("gameOver");
      blink(true);
      // Sticky until a fresh analysis arrives (handled below).
      stateLockUntil = now + 1e12;
      return;
    }

    // Any fresh analysis after game-over implies a new game began.
    if (currentState === "gameOver") {
      blink(false);
      stateLockUntil = 0;
    }

    let next = "neutral";

    if (isPlayerTurn === false && typeof evalChange === "number") {
      // Player just moved → react to move quality.
      if (evalChange <= -1.5) next = "mistake";
      else next = stateFromEval(playerEval);
    } else if (
      isPlayerTurn === true &&
      typeof topGap === "number" &&
      topGap >= 1.5 &&
      typeof playerEval === "number" &&
      playerEval >= -0.5
    ) {
      // Strong tactical opportunity available, but we never tell the user
      // *which* move it is. Just wide-eyed surprise.
      next = "opportunity";
    } else if (typeof playerEval === "number") {
      next = stateFromEval(playerEval);
    }

    // While a high-priority state is locked, only stronger states override.
    if (now < stateLockUntil) {
      const curPri = STATE_PRIORITY[currentState] || 0;
      const nxtPri = STATE_PRIORITY[next] || 0;
      if (nxtPri <= curPri) return;
    }

    // Lock attention states so they stay visible long enough to be noticed.
    if (next === "mistake" || next === "opportunity") {
      stateLockUntil = now + 2500;
    }

    if (next !== currentState) setState(next);
  }

  function resetGame() {
    blink(false);
    stateLockUntil = 0;
    setState("neutral");
  }

  function build() {
    if (document.getElementById("forksight-avatar")) return;
    if (!document.body) {
      // Body not ready yet — retry shortly.
      setTimeout(build, 100);
      return;
    }

    containerEl = document.createElement("div");
    containerEl.id = "forksight-avatar";
    containerEl.className = "forksight-avatar";
    containerEl.dataset.state = "neutral";
    containerEl.setAttribute("role", "img");
    containerEl.setAttribute("aria-label", "ForkSight Coach");
    containerEl.title = "ForkSight Coach (sürükleyerek taşı)";

    imgEl = document.createElement("img");
    imgEl.className = "forksight-avatar__img";
    imgEl.src = imgUrl("neutral");
    imgEl.alt = "";
    imgEl.draggable = false;

    containerEl.appendChild(imgEl);
    document.body.appendChild(containerEl);

    loadPosition(({ pos, visible }) => {
      applyPosition(pos || defaultPosition());
      if (!visible) containerEl.style.display = "none";
    });

    makeDraggable(containerEl, containerEl);

    // Keep inside viewport when the window is resized.
    window.addEventListener("resize", () => {
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      applyPosition({ left: rect.left, top: rect.top });
    });
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", build, { once: true });
    } else {
      build();
    }
  }

  window.ForkSightAvatar = {
    setState,
    getState: () => currentState,
    update,
    resetGame,
    blink,
    show: () => {
      if (containerEl) containerEl.style.display = "";
      saveVisible(true);
    },
    hide: () => {
      if (containerEl) containerEl.style.display = "none";
      saveVisible(false);
    },
    resetPosition: () => {
      const pos = defaultPosition();
      applyPosition(pos);
      savePosition(pos);
    },
  };

  init();
})();
