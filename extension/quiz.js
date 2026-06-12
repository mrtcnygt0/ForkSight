// ForkSight Quiz — Faz 1 iskeleti
// Adım 1.4: API'yi bağla, bilgileri göster, UCI text input ile çöz.
// Adım 1.5'te bu dosyaya SVG tahta ve drag/click hamle eklenecek.

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const TYPE_LABELS = {
    mate1: "Mat 1",
    mate2: "Mat 2",
    mate3: "Mat 3",
    best: "En İyi Hamle",
    tactic: "Taktik",
    sac_mate: "Fedakârlık Matı",
    defense: "Savunma",
    promotion: "Terfi",
    endgame: "Oyun Sonu",
  };

  const state = {
    apiBase: "https://forksight.net",
    token: "",
    puzzle: null,
    startTs: 0,
    usedHint: 0,
    submitting: false,
    lastPuzzleId: 0,
    board: null,
    timerId: 0,
    hintFromSq: null,
  };

  // ── Storage ───────────────────────────────────────────
  function loadAuth() {
    return new Promise((res) => {
      chrome.storage.local.get(["taktik_api_base", "taktik_token"], (r) => {
        state.apiBase = (r.taktik_api_base || "https://forksight.net").replace(
          /\/+$/,
          "",
        );
        state.token = r.taktik_token || "";
        res();
      });
    });
  }

  // ── HTTP ──────────────────────────────────────────────
  async function api(method, path, body) {
    const url = state.apiBase + path;
    const opts = {
      method,
      headers: {
        Accept: "application/json",
      },
    };
    if (state.token) opts.headers["Authorization"] = "Bearer " + state.token;
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(url, opts);
    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!r.ok) {
      const err = new Error(`HTTP ${r.status}`);
      err.status = r.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  // ── Render ────────────────────────────────────────────
  function renderStats(stats, total, byType) {
    if (!stats) return;
    $("sBoxRating").textContent = stats.rating ?? 1200;
    $("sBoxStreak").textContent = stats.streak ?? 0;
    $("sBoxBest").textContent = stats.best_streak ?? 0;
    $("sBoxSolved").textContent = stats.solved_cnt ?? 0;
    $("sBoxAttempts").textContent = stats.attempt_cnt ?? 0;
    $("sBoxTotal").textContent = total ?? 0;
    $("miniRating").textContent = stats.rating ?? "—";
    $("miniStreak").textContent = stats.streak ?? "—";
    $("miniPoints").textContent = stats.total_points ?? "—";

    if (Array.isArray(byType) && byType.length) {
      $("byType").innerHTML = byType
        .map((r) => {
          const label = TYPE_LABELS[r.type] || r.type;
          const solved = r.solved || 0;
          return (
            `<div class="by-type-row"><span>${label}</span>` +
            `<span>${solved}/${r.n}</span></div>`
          );
        })
        .join("");
    } else {
      $("byType").innerHTML = "";
    }
  }

  // ── Timer ─────────────────────────────────────────────
  function startTimer() {
    stopTimer();
    updateTimer();
    state.timerId = setInterval(updateTimer, 100);
  }
  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = 0;
    }
  }
  function updateTimer() {
    const el = $("timerDisplay");
    if (!el) return;
    const sec = (Date.now() - state.startTs) / 1000;
    el.textContent = sec.toFixed(1) + "s";
  }

  // ── Hint UI ───────────────────────────────────────────
  function resetHintUI() {
    const st = $("hintStatus");
    if (st) st.textContent = "";
    for (let i = 1; i <= 3; i++) {
      const b = $("btnHint" + i);
      if (b) b.classList.remove("active");
    }
  }
  function disableHintButtons(flag) {
    for (let i = 1; i <= 3; i++) {
      const b = $("btnHint" + i);
      if (b) b.disabled = !!flag;
    }
  }
  async function requestHint(level) {
    if (!state.puzzle || state.submitting) return;
    if (level <= state.usedHint) return;
    try {
      const res = await api(
        "GET",
        `/quiz/hint?puzzle_id=${state.puzzle.id}&level=${level}`,
      );
      state.usedHint = Math.max(state.usedHint, level);
      for (let i = 1; i <= 3; i++) {
        const b = $("btnHint" + i);
        if (b && i <= state.usedHint) b.classList.add("active");
      }
      if (res.from_sq && state.board && state.board.highlightHint) {
        state.board.highlightHint(res.from_sq);
        state.hintFromSq = res.from_sq;
      }
      const points = { 1: 7, 2: 4, 3: 1 }[state.usedHint] ?? 10;
      let msg = `İpucu ${state.usedHint} • doğru cevapta +${points} puan`;
      if (res.uci) {
        msg += ` • Hamle: ${res.uci}`;
      } else if (res.piece_type) {
        const map = {
          K: "Şah",
          Q: "Vezir",
          R: "Kale",
          B: "Fil",
          N: "At",
          P: "Piyon",
        };
        msg += ` • ${map[res.piece_type] || res.piece_type} oynar (${res.from_sq})`;
      } else if (res.from_sq) {
        msg += ` • Kalkış: ${res.from_sq}`;
      }
      $("hintStatus").textContent = msg;
    } catch (e) {
      $("hintStatus").textContent = "Hata: " + (e.body?.detail || e.message);
    }
  }

  function renderPuzzle(p) {
    state.puzzle = p;
    state.startTs = Date.now();
    state.usedHint = 0;
    state.hintFromSq = null;
    $("answerInput").value = "";
    $("feedback").style.display = "none";
    $("feedback").className = "";
    $("feedback").textContent = "";
    resetHintUI();
    startTimer();

    if (!p) {
      $("puzzleMeta").innerHTML =
        `<span class="pill warn">Boş</span>` +
        `<span>Henüz puzzle yok. Önce <b>Geçmiş oyunlardan üret</b> butonuna bas.</span>`;
      if (state.board) {
        state.board.destroy();
        state.board = null;
      }
      $("boardArea").innerHTML =
        `<div class="ph">Henüz çözecek bulmaca yok</div>`;
      $("sourceLink").textContent = "";
      $("answerInput").disabled = true;
      $("btnSubmit").disabled = true;
      $("btnSkip").disabled = true;
      disableHintButtons(true);
      stopTimer();
      return;
    }

    $("answerInput").disabled = false;
    $("btnSubmit").disabled = false;
    $("btnSkip").disabled = false;
    disableHintButtons(false);

    const sideText = p.side_to_move === "w" ? "Beyaz oynar" : "Siyah oynar";
    const typeText = TYPE_LABELS[p.type] || p.type;
    $("puzzleMeta").innerHTML = [
      `<span class="pill">${typeText}</span>`,
      `<span class="pill muted">${sideText}</span>`,
      `<span class="pill muted">Zorluk ${p.rating || "?"}</span>`,
      p.played_cnt
        ? `<span class="pill muted">Daha önce ${p.played_cnt}× denendi</span>`
        : `<span class="pill">Yeni</span>`,
    ].join("");

    // Tahtayı oluştur / pozisyonu güncelle
    const boardArea = $("boardArea");
    if (!state.board && window.ForkSightQuizBoard) {
      state.board = window.ForkSightQuizBoard.create(boardArea, {
        fen: p.fen,
        sideToMove: p.side_to_move,
        onMove: (uci) => submitUci(uci),
      });
    } else if (state.board) {
      state.board.setPosition(p.fen, p.side_to_move);
    } else {
      // Fallback: tahta yüklü değil — FEN'i metin göster
      boardArea.innerHTML =
        `<div class="ph"><b>FEN:</b><br>` +
        `<code style="font-size:11px">${escapeHtml(p.fen)}</code></div>`;
    }

    if (p.source_game_id) {
      $("sourceLink").innerHTML =
        `Kaynak: oyun #${p.source_game_id}, hamle ${Math.floor((p.source_ply || 0) / 2) + 1}`;
    } else {
      $("sourceLink").textContent = "";
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function flash(kind, msg) {
    const el = $("feedback");
    el.className = kind;
    el.textContent = msg;
    el.style.display = "block";
  }

  // ── Akış ──────────────────────────────────────────────
  async function loadNext() {
    try {
      const exclude = state.lastPuzzleId || 0;
      const res = await api("GET", `/quiz/next?exclude_id=${exclude}`);
      renderStats(res.stats, res.total_puzzles, []); // by_type quiz/stats'ta
      renderPuzzle(res.puzzle);
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        showNoAuth();
      } else {
        flash("err", "Yüklenemedi: " + (e.body?.detail || e.message));
      }
    }
  }

  async function loadStats() {
    try {
      const res = await api("GET", "/quiz/stats");
      renderStats(res.stats, res.total_puzzles, res.by_type);
    } catch (e) {
      // sessiz — next zaten stats getirir
    }
  }

  async function submitUci(uci) {
    if (state.submitting || !state.puzzle) return;
    const raw = String(uci || "")
      .trim()
      .toLowerCase();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(raw)) {
      flash("err", "Geçersiz UCI. Örn: e2e4, b7b8q");
      return;
    }
    state.submitting = true;
    $("btnSubmit").disabled = true;
    disableHintButtons(true);
    stopTimer();
    if (state.board) state.board.lock(true);
    try {
      const res = await api("POST", "/quiz/solve", {
        puzzle_id: state.puzzle.id,
        move_uci: raw,
        used_hint: state.usedHint | 0,
        time_ms: Math.max(0, Date.now() - state.startTs),
      });
      state.lastPuzzleId = state.puzzle.id;
      renderStats(
        {
          rating: res.rating,
          streak: res.streak,
          best_streak: res.best_streak,
          total_points: res.total_points,
          solved_cnt: state.puzzle ? null : 0,
          attempt_cnt: null,
        },
        null,
        null,
      );
      const fromSq = raw.slice(0, 2);
      const toSq = raw.slice(2, 4);
      if (res.correct) {
        if (state.board) state.board.flash(fromSq, toSq, "ok");
        flash("ok", `✓ Doğru! +${res.points_delta} puan, rating ${res.rating}`);
      } else {
        if (state.board) state.board.flash(fromSq, toSq, "err");
        flash("err", `✗ Yanlış. Doğru cevap: ${res.expected_uci}`);
      }
      setTimeout(
        () => {
          loadStats();
          loadNext();
        },
        res.correct ? 900 : 1800,
      );
    } catch (e) {
      flash("err", "Gönderilemedi: " + (e.body?.detail || e.message));
    } finally {
      state.submitting = false;
      $("btnSubmit").disabled = false;
      // tahta kilidi loadNext setPosition'da otomatik açılır
    }
  }

  function submitAnswer() {
    return submitUci($("answerInput").value);
  }

  async function skip() {
    if (!state.puzzle) return;
    state.lastPuzzleId = state.puzzle.id;
    loadNext();
  }

  async function backfill() {
    $("btnBackfill").disabled = true;
    $("backfillNote").textContent = "Sıraya alındı, arka planda çalışıyor…";
    try {
      await api("POST", "/quiz/backfill?limit_games=50&include_mate2=true");
      $("backfillNote").textContent =
        "Tarama başladı. Birkaç dakika sonra Yenile butonuna basabilirsin.";
    } catch (e) {
      $("backfillNote").textContent = "Hata: " + (e.body?.detail || e.message);
    } finally {
      setTimeout(() => {
        $("btnBackfill").disabled = false;
      }, 8000);
    }
  }

  function showNoAuth() {
    $("main").style.display = "none";
    $("noAuth").style.display = "block";
  }

  // ── Init ──────────────────────────────────────────────
  async function init() {
    await loadAuth();
    if (!state.token) {
      showNoAuth();
      return;
    }
    $("main").style.display = "grid";
    $("btnSubmit").addEventListener("click", submitAnswer);
    $("btnSkip").addEventListener("click", skip);
    $("btnRefresh").addEventListener("click", () => {
      loadStats();
      loadNext();
    });
    $("btnBackfill").addEventListener("click", backfill);
    $("answerInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitAnswer();
    });
    for (let i = 1; i <= 3; i++) {
      const b = $("btnHint" + i);
      if (b) b.addEventListener("click", () => requestHint(i));
    }
    await loadStats();
    await loadNext();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
