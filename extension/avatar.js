/* ForkSight Coach Avatar — passive draggable mascot
 *
 * Public API (window.ForkSightAvatar):
 *   setState(state)   → switch expression. One of:
 *       'neutral' | 'happy' | 'winning' | 'thinking' | 'worried' |
 *       'losing'  | 'opportunity' | 'mistake' | 'gameOver'
 *   setCoach(id)      → swap mini sprites for tilki|victoria|boris|kai|lena
 *   getCoach()        → current coach id
 *   getState()        → current state string
 *   show() / hide()   → toggle visibility
 *   blink(on)         → toggle game-over blink/pulse animation
 *   resetPosition()   → restore default bottom-right corner
 *
 * Persistence: position is saved to chrome.storage.local (key
 * "forksight_avatar_pos") with a localStorage fallback so the user
 * only has to place it once per device. Selected coach follows
 * chrome.storage.local "fs_selected_coach".
 *
 * Step 1: this file only renders the avatar and handles dragging.
 * Eval → state mapping is wired up by content.js in a later step.
 */
(function () {
  "use strict";

  // ─── i18n shim ─────────────────────────────────────────────
  function T(s) {
    try {
      return window.ForkSightI18n ? window.ForkSightI18n.t(s) : s;
    } catch (_) {
      return s;
    }
  }
  function _isEN() {
    try {
      return window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";
    } catch (_) {
      return false;
    }
  }

  const STORAGE_KEY = "forksight_avatar_pos";
  const VISIBLE_KEY = "forksight_avatar_visible";
  // Persists the last finished game's summary + gameOver flag so the user can
  // re-open the recap after closing the chess.com win/loss modal (which clears
  // the board and would otherwise reset the avatar's mood).
  const SUMMARY_KEY = "forksight_avatar_last_summary";
  const GAMEOVER_KEY = "forksight_avatar_gameover";
  const COACH_KEY = "fs_selected_coach";
  const COACH_IDS = ["tilki", "victoria", "boris", "kai", "lena", "sero"];
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
  let selectedCoachId = "tilki";
  // Latest game summary delivered by content.js at game end. The avatar
  // becomes clickable in `gameOver` state and opens a recap modal.
  let lastSummary = null;
  let modalEl = null;
  let menuEl = null;

  // ─── Living-mascot (roaming) state ──────────────────────────────────
  // The avatar wanders the screen only when idle. It freezes during play
  // (so mood is readable + zero distraction), while dragging, while hovered,
  // and on gameOver. Position is driven via container left/top in a rAF loop.
  let bubbleEl = null;
  let roamRAF = null;
  let roamPos = null; // {x, y} current top-left (px)
  let roamTarget = null; // {x, y} destination
  let roamPhase = "idle"; // "idle" | "walk"
  let roamIdleUntil = 0;
  let lastActivityAt = 0; // last update() call → "game active" window
  let roamHovering = false;
  let roamResumeAt = 0; // pause roaming until this time (after hover/drag)
  let roamDragging = false;
  let bubbleTimer = null;
  let cursorX = -9999;
  let cursorY = -9999;
  let cursorFresh = false;
  const ROAM_SPEED = 1.7; // px per 60fps frame
  const ROAM_ACTIVE_WINDOW = 12000; // ms after an update() before roaming resumes
  const _prefersReducedMotion = (() => {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (_) {
      return false;
    }
  })();

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

  function normalizeCoachId(id) {
    const s = String(id || "tilki").toLowerCase();
    return COACH_IDS.includes(s) ? s : "tilki";
  }

  function imgUrl(state, coachId) {
    const st = STATES.includes(state) ? state : "neutral";
    const coach = normalizeCoachId(coachId || selectedCoachId);
    const path = "avatars/" + coach + "/" + st + ".png";
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      return path;
    }
  }

  function rootImgUrl(state) {
    const st = STATES.includes(state) ? state : "neutral";
    const path = "avatars/" + st + ".png";
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      return path;
    }
  }

  function bindImgFallback(img, state) {
    if (!img) return;
    const st = STATES.includes(state) ? state : "neutral";
    img.onerror = function () {
      // Missing coach folder / emotion → root avatars/{state}.png (legacy).
      img.onerror = function () {
        img.onerror = null;
        if (selectedCoachId !== "tilki") {
          img.src = imgUrl(st, "tilki");
        }
      };
      img.src = rootImgUrl(st);
    };
  }

  function setImg(img, state, coachId) {
    if (!img) return;
    const st = STATES.includes(state) ? state : "neutral";
    img.src = imgUrl(st, coachId);
    bindImgFallback(img, st);
  }

  function applyCoachClass() {
    if (!containerEl) return;
    containerEl.dataset.coach = selectedCoachId;
    COACH_IDS.forEach((id) => {
      containerEl.classList.toggle("forksight-avatar--coach-" + id, id === selectedCoachId);
    });
  }

  function setCoach(coachId, opts) {
    const next = normalizeCoachId(coachId);
    const silent = opts && opts.silent;
    if (next === selectedCoachId && !(opts && opts.force)) {
      applyCoachClass();
      return selectedCoachId;
    }
    selectedCoachId = next;
    applyCoachClass();
    if (imgEl) setImg(imgEl, currentState);
    if (!silent) hopOnce();
    return selectedCoachId;
  }

  function loadSelectedCoach(cb) {
    const done = (id) => {
      selectedCoachId = normalizeCoachId(id);
      applyCoachClass();
      if (typeof cb === "function") cb(selectedCoachId);
    };
    try {
      chrome.storage.local.get([COACH_KEY], (r) => {
        done(r && r[COACH_KEY] ? r[COACH_KEY] : "tilki");
      });
    } catch (_) {
      done("tilki");
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
      // Roaming: sürükleme bitti → konumu senkronize et, kısa bir süre bekle.
      roamDragging = false;
      roamResumeAt = Date.now() + 2500;
      try {
        const r = el.getBoundingClientRect();
        roamPos = { x: r.left, y: r.top };
        roamTarget = null;
      } catch (_) {}
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
      roamDragging = true; // gezinmeyi durdur
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
    if (imgEl) setImg(imgEl, state);
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
   * @param {object}  [data.summary]       End-of-game stats payload. When
   *                                       present, the avatar becomes clickable
   *                                       and opens a recap modal.
   */
  function update(data) {
    if (!data || typeof data !== "object") return;
    // Oyun analizi geldi → "oyun aktif" penceresini tazele ve gezinmeyi
    // anında durdur (mood okunabilir kalsın, dikkat dağılmasın).
    lastActivityAt = Date.now();
    if (containerEl) {
      containerEl.classList.remove("fs-walking");
      containerEl.classList.add("fs-idle");
    }
    const {
      playerEval,
      isPlayerTurn,
      evalChange,
      topGap,
      isGameOver,
      summary,
    } = data;
    const now = Date.now();

    if (isGameOver) {
      if (summary && typeof summary === "object") {
        lastSummary = summary;
      }
      setState("gameOver");
      blink(true);
      if (containerEl) {
        containerEl.classList.add("forksight-avatar--clickable");
        containerEl.title = T("ForkSight Coach — oyun özeti için tıkla");
      }
      // Oyun-sonu CTA balonu — özet için tıklamayı teşvik eder.
      say(T("Oyun özetin hazır — bana tıkla! 🏆"), 6000);
      // Sticky until a fresh analysis arrives (handled below).
      stateLockUntil = now + 1e12;
      return;
    }

    // Any fresh analysis after game-over implies a new game began.
    if (currentState === "gameOver") {
      blink(false);
      stateLockUntil = 0;
      lastSummary = null;
      closeSummaryModal();
      if (containerEl) {
        containerEl.classList.remove("forksight-avatar--clickable");
        containerEl.title = T("ForkSight Coach (sürükleyerek taşı)");
      }
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
    lastSummary = null;
    closeSummaryModal();
    closeMenu();
    try {
      chrome.storage.local.remove([SUMMARY_KEY, GAMEOVER_KEY]);
    } catch (_) {}
    if (containerEl) {
      containerEl.classList.remove("forksight-avatar--clickable");
      containerEl.title = T("ForkSight Coach (sürükleyerek taşı)");
    }
    setState("neutral");
  }

  // ─── End-of-game summary modal ───────────────────────────────────────
  // Built lazily on first open. Lives directly under document.body so it
  // is independent of the legacy hidden panel (which uses a shadow DOM).
  function fmtDuration(sec) {
    if (!sec || sec < 0) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (_isEN()) {
      return m > 0 ? `${m} min ${s} sec` : `${s} sec`;
    }
    return m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
  }

  function resultLine(result) {
    if (result === "win")
      return { text: T("Tebrikler — kazandın!"), mood: "happy" };
    if (result === "loss")
      return { text: T("Bir dahaki sefere, iyi savaştın."), mood: "losing" };
    if (result === "draw")
      return { text: T("Berabere — sıkı bir mücadeleydi."), mood: "thinking" };
    return { text: T("Oyun bitti."), mood: "neutral" };
  }

  function coachVerdict(s) {
    if (!s || !s.moveCount) return T("Oyun çok kısa sürdü — analiz yetersiz.");
    if (s.blunders === 0 && s.mistakes <= 1 && s.avgLoss < 0.3)
      return T("Çok temiz oynadın — sağlam karar verme!");
    if (s.blunders === 0 && s.avgLoss < 0.6)
      return T("Genel olarak tutarlı bir oyundu.");
    if (s.blunders >= 3)
      return T(
        "Birkaç kritik hamle pahalıya patladı — bir dahaki maçta tempoyu düşürmeyi dene.",
      );
    if (s.blunders >= 1)
      return T(
        "Bir blunder maçı çevirdi — hamle öncesi son bir kontrol işe yarar.",
      );
    if (s.mistakes >= 3)
      return T("Orta seviyede birkaç hata vardı, geliştirilebilir.");
    return T("Dengeli bir oyundu, devam!");
  }

  function buildSummaryModal(s) {
    closeSummaryModal();
    modalEl = document.createElement("div");
    modalEl.className = "forksight-summary-modal";
    modalEl.setAttribute("role", "dialog");
    modalEl.setAttribute("aria-label", T("Oyun özeti"));

    const rl = resultLine(s && s.result);
    const moveCount = (s && s.moveCount) || 0;
    const dur = fmtDuration((s && s.durationSec) || 0);
    const avg = s && s.moveCount ? s.avgLoss.toFixed(2) : "—";
    const worst = s && s.worstLoss > 0 ? `-${s.worstLoss.toFixed(1)}` : "—";
    const bl = (s && s.blunders) || 0;
    const ms = (s && s.mistakes) || 0;
    const ia = (s && s.inaccuracies) || 0;

    modalEl.innerHTML = `
      <div class="forksight-summary-backdrop"></div>
      <div class="forksight-summary-card" role="document">
        <button class="forksight-summary-close" aria-label="${T("Kapat")}">×</button>
        <div class="forksight-summary-head">
          <img class="forksight-summary-avatar" alt="" />
          <div class="forksight-summary-headtext">
            <div class="forksight-summary-title">${escapeHtml(rl.text)}</div>
            <div class="forksight-summary-sub">${escapeHtml(coachVerdict(s))}</div>
          </div>
        </div>
        <div class="forksight-summary-grid">
          <div class="forksight-summary-cell">
            <div class="forksight-summary-num">${moveCount}</div>
            <div class="forksight-summary-lab">${T("analiz edilen hamle")}</div>
          </div>
          <div class="forksight-summary-cell">
            <div class="forksight-summary-num">${escapeHtml(dur)}</div>
            <div class="forksight-summary-lab">${T("süre")}</div>
          </div>
          <div class="forksight-summary-cell">
            <div class="forksight-summary-num">${avg}</div>
            <div class="forksight-summary-lab">${T("hamle başına ort. kayıp")}</div>
          </div>
          <div class="forksight-summary-cell">
            <div class="forksight-summary-num">${worst}</div>
            <div class="forksight-summary-lab">${T("en kötü hamle")}</div>
          </div>
        </div>
        <div class="forksight-summary-tags">
          <span class="forksight-tag forksight-tag--bl">${T("Gaf")}: ${bl}</span>
          <span class="forksight-tag forksight-tag--ms">${T("Hata")}: ${ms}</span>
          <span class="forksight-tag forksight-tag--ia">${T("Yanlışlık")}: ${ia}</span>
        </div>
        <div class="forksight-summary-foot">
          <button class="forksight-summary-ok">${T("Tamam")}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Wire image src after attach so chrome.runtime.getURL is safe.
    const av = modalEl.querySelector(".forksight-summary-avatar");
    if (av) setImg(av, rl.mood);

    const close = () => closeSummaryModal();
    modalEl
      .querySelector(".forksight-summary-close")
      .addEventListener("click", close);
    modalEl
      .querySelector(".forksight-summary-ok")
      .addEventListener("click", close);
    modalEl
      .querySelector(".forksight-summary-backdrop")
      .addEventListener("click", close);
    document.addEventListener("keydown", onEscClose);
  }

  function onEscClose(e) {
    if (e.key === "Escape") closeSummaryModal();
  }

  function closeSummaryModal() {
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    document.removeEventListener("keydown", onEscClose);
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // "Son Oyun Özeti" artık eski basit istatistik modalını AÇMAZ; bunun
  // yerine doğrudan analiz akışını başlatır:
  //   1) Mevcut sayfa URL'sinden (ya da saklı summary'den) chess.com oyun
  //      ID'si çıkarılırsa Review modülü o URL ile açılır → otomatik
  //      olarak oyun çekilip analiz edilir.
  //   2) Aksi halde PGN giriş ekranı, "linki algılayamadık, zaman
  //      damgalı PGN'i yapıştırın" notuyla açılır.
  function _detectChessComGameUrl() {
    try {
      const path = (location && location.pathname) || "";
      // /game/live/123, /game/daily/123, /live/computer/123, /game/123
      const m =
        path.match(/\/(?:game|live)\/(live|daily|computer|coach)\/(\d{5,})/i) ||
        path.match(/\/game\/(\d{5,})/i);
      if (m) {
        const id = m[2] || m[1];
        const type = m[2] ? m[1].toLowerCase() : "live";
        const kind = type === "daily" ? "daily" : "live";
        return `https://www.chess.com/game/${kind}/${id}`;
      }
      // Son çare: sayfadaki ilk chess.com oyun bağlantısı.
      const a = document.querySelector(
        'a[href*="chess.com/game/live/"], a[href*="chess.com/game/daily/"]',
      );
      if (a && a.href) return a.href;
    } catch (_) {}
    if (lastSummary && typeof lastSummary === "object") {
      if (lastSummary.url) return String(lastSummary.url);
      if (lastSummary.gameId)
        return `https://www.chess.com/game/live/${lastSummary.gameId}`;
    }
    return null;
  }

  function openSummary() {
    const url = _detectChessComGameUrl();
    const review = window.ForkSightReview;
    if (url && review && typeof review.openWithUrl === "function") {
      try {
        review.openWithUrl(url);
        return;
      } catch (_) {
        /* fall through to PGN prompt */
      }
    }
    if (review && typeof review.openWithPgn === "function") {
      try {
        review.openWithPgn(
          "",
          T(
            "Oyun bağlantısı otomatik algılanamadı. Lütfen chess.com'da Share → PGN ile <b>zaman damgaları (clock) açık</b> olarak kopyalanmış PGN metnini aşağıya yapıştırın.",
          ),
        );
        return;
      } catch (_) {
        /* fall through */
      }
    }
    // Review modülü hiç yüklenmediyse en azından bilgilendir.
    alert(T("Analiz modülü yüklenemedi. Sayfayı yenileyin."));
  }

  // ─── Action menu (popover next to the avatar) ────────────────────────
  // Items: Analiz Et (open game-review modal), Profilim (open profile),
  // Son Oyun Özeti (only when we still hold a finished-game payload).
  function toggleMenu() {
    if (menuEl) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function openMenu() {
    closeMenu();
    if (!containerEl) return;
    menuEl = document.createElement("div");
    menuEl.className = "forksight-avatar-menu";

    const hasSummary = !!lastSummary;
    const auth = window.ForkSightAuth || null;
    const loggedIn = !!(auth && auth.isLoggedIn && auth.isLoggedIn());
    if (!loggedIn) {
      // Anonim: sadece giriş seçeneği — kayıtlı oturum yok.
      menuEl.innerHTML = `
        <button class="forksight-menu-item" data-act="login">
          <span class="forksight-menu-ico">🔐</span>
          <span class="forksight-menu-lab">${T("Giriş Yap / Kayıt Ol")}</span>
        </button>
        ${
          hasSummary
            ? `<button class="forksight-menu-item" data-act="summary">
                 <span class="forksight-menu-ico">🏁</span>
                 <span class="forksight-menu-lab">${T("Son Oyun Özeti")}</span>
               </button>`
            : ""
        }
      `;
    } else {
      menuEl.innerHTML = `
        <button class="forksight-menu-item" data-act="profile">
          <span class="forksight-menu-ico">👤</span>
          <span class="forksight-menu-lab">${T("Profilim")}</span>
        </button>
        <button class="forksight-menu-item" data-act="analyze">
          <span class="forksight-menu-ico">📊</span>
          <span class="forksight-menu-lab">${T("Analiz Et")}</span>
        </button>
        ${
          hasSummary
            ? `<button class="forksight-menu-item" data-act="summary">
                 <span class="forksight-menu-ico">🏁</span>
                 <span class="forksight-menu-lab">${T("Son Oyun Özeti")}</span>
               </button>`
            : ""
        }
      `;
    }
    document.body.appendChild(menuEl);

    // Position the menu near the avatar — prefer above if there's room,
    // otherwise below; horizontally aligned to the avatar's left edge but
    // clamped so it never falls off-screen.
    const ar = containerEl.getBoundingClientRect();
    const mw = 180;
    const mh = menuEl.offsetHeight || 140;
    let top = ar.top - mh - 10;
    if (top < 8) top = ar.bottom + 10;
    let left = ar.left + ar.width / 2 - mw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
    menuEl.style.left = left + "px";
    menuEl.style.top = top + "px";

    menuEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".forksight-menu-item");
      if (!btn) return;
      const act = btn.dataset.act;
      closeMenu();
      if (act === "analyze") openAnalyze();
      else if (act === "profile") openProfile();
      else if (act === "summary") openSummary();
      else if (act === "login") openLogin();
    });

    // Close on outside click / escape, next tick to skip the opening click.
    setTimeout(() => {
      document.addEventListener("mousedown", onOutsideMenuClick, true);
      document.addEventListener("keydown", onMenuEsc);
    }, 0);
  }

  function closeMenu() {
    if (menuEl && menuEl.parentNode) menuEl.parentNode.removeChild(menuEl);
    menuEl = null;
    document.removeEventListener("mousedown", onOutsideMenuClick, true);
    document.removeEventListener("keydown", onMenuEsc);
  }

  function onOutsideMenuClick(e) {
    if (!menuEl) return;
    if (menuEl.contains(e.target)) return;
    if (containerEl && containerEl.contains(e.target)) return;
    closeMenu();
  }

  function onMenuEsc(e) {
    if (e.key === "Escape") closeMenu();
  }

  function openAnalyze() {
    if (
      window.ForkSightReview &&
      typeof window.ForkSightReview.open === "function"
    ) {
      window.ForkSightReview.open();
    } else {
      alert(T("Analiz modülü yüklenemedi. Sayfayı yenileyin."));
    }
  }

  function openProfile() {
    // Yeni profil paneli (4-tab): tercih edilen.
    if (
      window.ForkSightProfile &&
      typeof window.ForkSightProfile.open === "function"
    ) {
      const rect = containerEl ? containerEl.getBoundingClientRect() : null;
      try {
        window.ForkSightProfile.open({ anchorRect: rect });
      } catch (_) {
        window.ForkSightProfile.open();
      }
      return;
    }
    if (
      window.ForkSightReview &&
      typeof window.ForkSightReview.openProfile === "function"
    ) {
      window.ForkSightReview.openProfile();
    } else {
      // Lightweight fallback — show whatever we know via chrome.storage.
      try {
        chrome.storage.local.get(null, (all) => {
          const u = (all && (all.taktik_user || all.forksight_user)) || "—";
          alert(T("Profil") + ":\n\n" + T("Kullanıcı") + ": " + u);
        });
      } catch (_) {
        alert(T("Profil bilgisi alınamadı."));
      }
    }
  }

  function openLogin() {
    if (
      window.ForkSightAuth &&
      typeof window.ForkSightAuth.openLogin === "function"
    ) {
      try {
        window.ForkSightAuth.openLogin();
        return;
      } catch (_) {}
    }
    alert(T("Giriş modülü hazır değil. Sayfayı yenileyin."));
  }

  // ─── Living mascot: speech bubble + roaming engine ──────────────────
  // Design: the avatar is a *coach*, so roaming is strictly ambient. It
  // wanders only when idle and instantly freezes during play (so mood is
  // readable and it never distracts or leaks hints), while hovered, while
  // dragging, and on gameOver. All motion respects prefers-reduced-motion.
  function say(text, ms) {
    if (!bubbleEl || !text) return;
    bubbleEl.textContent = text;
    bubbleEl.classList.add("show");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => {
      if (bubbleEl) bubbleEl.classList.remove("show");
    }, ms || 4200);
  }

  function hopOnce() {
    if (!containerEl || _prefersReducedMotion) return;
    containerEl.classList.add("fs-hop");
    setTimeout(() => {
      if (containerEl) containerEl.classList.remove("fs-hop");
    }, 620);
  }

  function roamBounds() {
    const w = (containerEl && containerEl.offsetWidth) || SIZE;
    const h = (containerEl && containerEl.offsetHeight) || SIZE;
    const pad = 12;
    return {
      minX: pad,
      maxX: Math.max(pad, window.innerWidth - w - pad),
      minY: pad,
      maxY: Math.max(pad, window.innerHeight - h - pad),
    };
  }

  function roamNewTarget() {
    const b = roamBounds();
    roamTarget = {
      x: b.minX + Math.random() * (b.maxX - b.minX),
      y: b.minY + Math.random() * (b.maxY - b.minY),
    };
  }

  // True while a game is "live": gameOver freezes (blink + click-to-recap),
  // and any analysis within the active window means a game is in progress.
  function roamActiveByGame() {
    if (currentState === "gameOver") return true;
    return Date.now() - lastActivityAt < ROAM_ACTIVE_WINDOW;
  }

  function roamAllowed() {
    if (!containerEl) return false;
    if (containerEl.style.display === "none") return false;
    if (roamDragging || roamHovering) return false;
    if (Date.now() < roamResumeAt) return false;
    if (roamActiveByGame()) return false;
    if (document.hidden) return false;
    return true;
  }

  const ROAM_TIPS = {
    tilki: {
      tr: [
        "Bir bulmaca çözelim mi? 🧩",
        "Bugün formdayız! ✨",
        "Beni istediğin yere sürükleyebilirsin 🐾",
        "Oyun bitince sana özet çıkarırım 🏆",
        "Takıldığında ipucu iste 💡",
        "Seriyi bozma — her gün biraz pratik!",
      ],
      en: [
        "Shall we solve a puzzle? 🧩",
        "We're on form today! ✨",
        "You can drag me anywhere 🐾",
        "I'll recap your game when it ends 🏆",
        "Ask for a hint when you're stuck 💡",
        "Keep the streak — practice daily!",
      ],
    },
    victoria: {
      tr: [
        "Planını net tut — acele etme.",
        "Strateji: önce yapı, sonra taktik.",
        "Sakin kal; iyi hamle sabır ister.",
      ],
      en: [
        "Keep your plan clear — no rush.",
        "Strategy first, tactics second.",
        "Stay composed; good moves take patience.",
      ],
    },
    boris: {
      tr: [
        "Doğruyu söyleyeceğim — o hamle zayıftı.",
        "Hesabı bitirmeden bırakma.",
        "Sert ama adil: tekrar dene.",
      ],
      en: [
        "I'll be honest — that move was weak.",
        "Don't stop mid-calculation.",
        "Tough but fair: try again.",
      ],
    },
    kai: {
      tr: [
        "Derinlik +1 — bir varyant daha.",
        "Tahtayı parçalara ayır, say.",
        "Kesin hesap: adım adım.",
      ],
      en: [
        "Depth +1 — one more line.",
        "Break the board into parts, count.",
        "Precise calc: step by step.",
      ],
    },
    lena: {
      tr: [
        "Hadi! Bu pozisyonu çevirebilirsin 💪",
        "Enerji yüksek — devam!",
        "Her gün biraz daha iyi!",
      ],
      en: [
        "Come on! You can flip this position 💪",
        "Energy high — keep going!",
        "A little better every day!",
      ],
    },
  };
  function roamPickTip() {
    const pack = ROAM_TIPS[selectedCoachId] || ROAM_TIPS.tilki;
    const arr = _isEN() ? pack.en : pack.tr;
    return arr[(Math.random() * arr.length) | 0];
  }

  function roamStartIdle() {
    roamPhase = "idle";
    if (!containerEl) return;
    containerEl.classList.remove("fs-walking");
    containerEl.classList.add("fs-idle");
    // Uzun dinlenme: maskot çoğunlukla durur, ara sıra gezinir (rahatsız
    // etmesin). 9–20 sn arası boşta kalır.
    roamIdleUntil = Date.now() + 9000 + Math.random() * 11000;
    // Boştayken küçük ifade çeşitliliği — canlı hissi (oyun yokken güvenli).
    setState(Math.random() < 0.3 ? "happy" : "neutral");
    // Seyrek, dostça ipucu — sadece boştayken.
    if (Math.random() < 0.18) say(roamPickTip(), 3800);
  }

  function roamStartWalk() {
    roamPhase = "walk";
    roamNewTarget();
    if (!containerEl) return;
    containerEl.classList.remove("fs-idle");
    containerEl.classList.add("fs-walking");
    setState("neutral");
  }

  function roamLoop() {
    roamRAF = requestAnimationFrame(roamLoop);
    if (!containerEl) return;

    // İmleç yakınsa ona dön (gezinmese bile yön çevirir → "canlı" hissi).
    if (cursorFresh && !roamDragging && roamPos) {
      const w = containerEl.offsetWidth || SIZE;
      const h = containerEl.offsetHeight || SIZE;
      const dxc = cursorX - (roamPos.x + w / 2);
      const dyc = cursorY - (roamPos.y + h / 2);
      if (Math.hypot(dxc, dyc) < 170) {
        containerEl.classList.toggle("fs-face-right", dxc > 0);
      }
    }

    if (!roamAllowed()) {
      // Oyun aktif / hover / drag → gezinme; sakin nefes pozu.
      containerEl.classList.remove("fs-walking");
      containerEl.classList.add("fs-idle");
      return;
    }

    if (!roamPos) {
      const rect = containerEl.getBoundingClientRect();
      roamPos = { x: rect.left, y: rect.top };
    }
    if (!roamTarget) roamNewTarget();

    if (roamPhase === "walk") {
      const dx = roamTarget.x - roamPos.x;
      const dy = roamTarget.y - roamPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist < ROAM_SPEED + 0.5) {
        roamPos.x = roamTarget.x;
        roamPos.y = roamTarget.y;
        roamStartIdle();
      } else {
        const step = ROAM_SPEED / dist;
        roamPos.x += dx * step;
        roamPos.y += dy * step;
        // Yön: temel görsel sola bakar → sağa giderken (dx>0) aynala.
        containerEl.classList.toggle("fs-face-right", dx > 0);
      }
      containerEl.style.left = roamPos.x + "px";
      containerEl.style.top = roamPos.y + "px";
      containerEl.style.right = "auto";
      containerEl.style.bottom = "auto";
    } else if (Date.now() >= roamIdleUntil) {
      // İdle bitince her zaman yürüme — çoğu zaman tekrar dinlen (sakin kalsın).
      if (Math.random() < 0.4) roamStartWalk();
      else roamStartIdle();
    }
  }

  function startRoaming() {
    if (!containerEl) return;
    // İmleç takibi (yön + yakınlık) — pasif, ucuz.
    window.addEventListener(
      "mousemove",
      (e) => {
        cursorX = e.clientX;
        cursorY = e.clientY;
        cursorFresh = true;
      },
      { passive: true },
    );
    // Hover → tam dur + sana bak; ayrılınca kısa süre sonra devam et.
    containerEl.addEventListener("mouseenter", () => {
      roamHovering = true;
      containerEl.classList.remove("fs-walking");
      containerEl.classList.add("fs-idle");
    });
    containerEl.addEventListener("mouseleave", () => {
      roamHovering = false;
      roamResumeAt = Date.now() + 700;
      const rect = containerEl.getBoundingClientRect();
      roamPos = { x: rect.left, y: rect.top };
    });

    if (_prefersReducedMotion) {
      // Hareketsiz mod: gezinme yok; yalnızca ara sıra ipucu balonu.
      containerEl.classList.add("fs-idle");
      setInterval(() => {
        if (!containerEl || containerEl.style.display === "none") return;
        if (roamActiveByGame() || roamHovering) return;
        say(roamPickTip(), 4200);
      }, 18000);
      return;
    }

    const rect = containerEl.getBoundingClientRect();
    roamPos = { x: rect.left, y: rect.top };
    roamStartIdle();
    if (roamRAF) cancelAnimationFrame(roamRAF);
    roamRAF = requestAnimationFrame(roamLoop);
    // İlk açılış selamı — sayfa otursun diye kısa gecikmeyle, oyun yoksa.
    setTimeout(() => {
      if (!containerEl || containerEl.style.display === "none") return;
      if (roamActiveByGame() || roamHovering) return;
      const greet = {
        tilki: {
          tr: "Selam! Antrenmana hazır mısın? 🦊",
          en: "Hey! Ready to train? 🦊",
        },
        victoria: {
          tr: "Merhaba. Planlı oynayalım.",
          en: "Hello. Let's play with a plan.",
        },
        boris: {
          tr: "Hazır mısın? Yumuşak oynamayacağım.",
          en: "Ready? I won't go easy.",
        },
        kai: {
          tr: "Hesaba başlayalım.",
          en: "Let's start calculating.",
        },
        lena: {
          tr: "Hadi! Bugün formdayız! ✨",
          en: "Let's go! We're on fire today! ✨",
        },
      };
      const g = greet[selectedCoachId] || greet.tilki;
      say(_isEN() ? g.en : g.tr, 4200);
    }, 1800);
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
    containerEl.dataset.coach = selectedCoachId;
    containerEl.setAttribute("role", "img");
    containerEl.setAttribute("aria-label", "ForkSight Coach");
    containerEl.title = T("ForkSight Coach (sürükleyerek taşı)");

    imgEl = document.createElement("img");
    imgEl.className = "forksight-avatar__img";
    setImg(imgEl, "neutral");
    imgEl.alt = "";
    imgEl.draggable = false;
    applyCoachClass();

    // İç sarmalayıcı: yürüme/nefes/zıplama transform'ları burada yaşar,
    // container'ın hover/drag scale'i ile çakışmaz.
    const innerEl = document.createElement("div");
    innerEl.className = "forksight-avatar__inner";
    innerEl.appendChild(imgEl);
    containerEl.appendChild(innerEl);

    // Konuşma balonu (bağlamsal ipuçları + oyun-sonu CTA).
    bubbleEl = document.createElement("div");
    bubbleEl.className = "forksight-avatar__bubble";
    bubbleEl.setAttribute("role", "status");
    containerEl.appendChild(bubbleEl);

    containerEl.classList.add("fs-idle");
    document.body.appendChild(containerEl);

    loadPosition(({ pos, visible }) => {
      applyPosition(pos || defaultPosition());
      if (!visible) containerEl.style.display = "none";
    });

    makeDraggable(containerEl, containerEl);

    // Click-to-open menu: pops a small action menu next to the avatar.
    // The drag layer already swallows clicks that followed a real drag,
    // so this only fires on a clean tap.
    containerEl.addEventListener("click", (e) => {
      e.stopPropagation();
      hopOnce();
      toggleMenu();
    });

    // Refresh title / open menu on language change so EN/TR toggle is live.
    try {
      if (window.ForkSightI18n && window.ForkSightI18n.onChange) {
        window.ForkSightI18n.onChange(() => {
          if (!containerEl) return;
          const clickable = containerEl.classList.contains(
            "forksight-avatar--clickable",
          );
          containerEl.title = clickable
            ? T("ForkSight Coach — oyun özeti için tıkla")
            : T("ForkSight Coach (sürükleyerek taşı)");
          if (menuEl) {
            closeMenu();
            openMenu();
          }
        });
      }
    } catch (_) {}

    // Restore persisted gameOver state from a previous page load so the
    // user can still reopen the last game's summary even after refresh
    // or after dismissing the chess.com result popup.
    try {
      chrome.storage.local.get([SUMMARY_KEY, GAMEOVER_KEY], (r) => {
        if (r && r[SUMMARY_KEY]) lastSummary = r[SUMMARY_KEY];
        if (r && r[GAMEOVER_KEY]) {
          setState("gameOver");
          blink(true);
          stateLockUntil = Date.now() + 1e12;
          if (containerEl) {
            containerEl.classList.add("forksight-avatar--clickable");
          }
        }
      });
    } catch (_) {}

    // Keep inside viewport when the window is resized.
    window.addEventListener("resize", () => {
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      applyPosition({ left: rect.left, top: rect.top });
      roamPos = { x: rect.left, y: rect.top };
      roamNewTarget();
    });

    // Yaşayan maskot motorunu başlat (boştayken gezinir; oyun/drag/hover'da durur).
    startRoaming();

    // Koç değişince yüzen avatar anında güncellenir.
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes[COACH_KEY]) return;
        setCoach(changes[COACH_KEY].newValue);
      });
    } catch (_) {}
  }

  function init() {
    loadSelectedCoach(() => {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", build, { once: true });
      } else {
        build();
      }
    });
  }

  window.ForkSightAvatar = {
    setState,
    getState: () => currentState,
    setCoach,
    getCoach: () => selectedCoachId,
    update,
    resetGame,
    blink,
    openMenu,
    closeMenu,
    openSummary,
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
