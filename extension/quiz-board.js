// ForkSight Quiz Board — Faz 1.5
// HTML grid tabanlı satranç tahtası. Tıkla-tıkla hamle, terfi seçici.
// Legalite kontrolü yok — sunucu doğru hamleyi karşılaştırır.
//
// Kullanım:
//   const board = ForkSightQuizBoard.create(container, {
//     fen: "r1bqkbnr/...",
//     sideToMove: "w" | "b",
//     onMove: (uci) => { ... }
//   });
//   board.setPosition(fen, sideToMove);
//   board.flash("from","to","ok"|"err");
//   board.revealSolution({ fen, sideToMove, wrongUci, correctUci })
//   board.destroy();

(function () {
  "use strict";

  const FILES = "abcdefgh";

  // Pulse / arrow stilleri — Shadow DOM içine enjekte edilmeli (panel shadow root).
  function ensureBoardStyles(host) {
    if (!host) return;
    if (host.querySelector && host.querySelector("#fsq-board-anim-css")) return;
    const s = document.createElement("style");
    s.id = "fsq-board-anim-css";
    s.textContent = `
      @keyframes fsq-pulse-ok {
        0%, 100% { box-shadow: inset 0 0 0 4px rgba(34,197,94,.85), 0 0 0 0 rgba(34,197,94,0); }
        50% { box-shadow: inset 0 0 0 5px rgba(34,197,94,1), 0 0 22px rgba(34,197,94,.65); }
      }
      @keyframes fsq-pulse-err {
        0%, 100% { box-shadow: inset 0 0 0 4px rgba(239,68,68,.85), 0 0 0 0 rgba(239,68,68,0); }
        50% { box-shadow: inset 0 0 0 5px rgba(239,68,68,1), 0 0 18px rgba(239,68,68,.55); }
      }
      @keyframes fsq-arrow-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .fsq-hl-ok {
        animation: fsq-pulse-ok 1.1s ease-in-out infinite;
        outline: 3px solid rgba(34,197,94,.95) !important;
        z-index: 2;
      }
      .fsq-hl-err {
        animation: fsq-pulse-err .9s ease-in-out infinite;
        outline: 3px solid rgba(239,68,68,.95) !important;
        z-index: 2;
      }
      .fsq-hl-info { outline: 3px solid rgba(59,130,246,.9) !important; z-index: 2; }
      .fsq-arrow-layer {
        position: absolute !important;
        left: 0; top: 0; right: 0; bottom: 0;
        width: 100% !important;
        height: 100% !important;
        pointer-events: none !important;
        z-index: 8 !important;
        overflow: visible;
        animation: fsq-arrow-in .25s ease-out;
      }
    `;
    host.insertBefore(s, host.firstChild);
  }

  // ── FEN → board[64] (rank*8 + file). board[0] = a1, board[63] = h8.
  function fenToBoard(fen) {
    const raw = String(fen || "").trim();
    const parts = raw.split(/\s+/);
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("Geçersiz FEN");
    const b = new Array(64).fill("");
    for (let r = 0; r < 8; r++) {
      const rank = 7 - r; // FEN satır 0 = 8. yatay
      let file = 0;
      for (const ch of rows[r]) {
        if (ch >= "1" && ch <= "8") {
          file += parseInt(ch, 10);
        } else if (/[prnbqkPRNBQK]/.test(ch)) {
          b[rank * 8 + file] = ch;
          file++;
        }
      }
    }
    return b;
  }

  function pieceImageURL(piece) {
    const color = piece === piece.toUpperCase() ? "w" : "b";
    const letter = piece.toUpperCase();
    try {
      return chrome.runtime.getURL("pieces/" + color + letter + ".png");
    } catch (_) {
      return "pieces/" + color + letter + ".png";
    }
  }

  function sqName(file, rank) {
    return FILES[file] + (rank + 1);
  }

  function boardToFen(board, sideToMove) {
    const ranks = [];
    for (let rank = 7; rank >= 0; rank--) {
      let row = "";
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = board[rank * 8 + file] || "";
        if (!p) {
          empty++;
        } else {
          if (empty) {
            row += String(empty);
            empty = 0;
          }
          row += p;
        }
      }
      if (empty) row += String(empty);
      ranks.push(row);
    }
    return ranks.join("/") + " " + (sideToMove === "b" ? "b" : "w") + " - - 0 1";
  }

  function isOwnPiece(piece, sideToMove) {
    if (!piece) return false;
    const isWhite = piece === piece.toUpperCase();
    return (isWhite && sideToMove === "w") || (!isWhite && sideToMove === "b");
  }

  function create(container, opts) {
    const state = {
      board: [],
      sideToMove: "w",
      flip: false,
      selectedFrom: null, // {file, rank, sq, piece}
      pendingPromo: null, // {fromSq, toSq, color}
      onMove: opts.onMove || (() => {}),
      canSelect: opts.canSelect || null,
      keepSideToMove: !!opts.keepSideToMove,
      forbidKingCapture: !!opts.forbidKingCapture,
      onIllegalMove: opts.onIllegalMove || null,
      squares: {}, // sq-name → div element
      root: null,
      promoOverlay: null,
      locked: false,
      arrowEl: null,
      lastFenBeforeMove: null,
      lastSideBeforeMove: "w",
    };

    function buildSkeleton() {
      container.innerHTML = "";
      const root = document.createElement("div");
      root.className = "fsq-board-root";
      // styles inline to be self-contained
      Object.assign(root.style, {
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        maxWidth: "560px",
        margin: "0 auto",
        userSelect: "none",
      });

      const grid = document.createElement("div");
      grid.className = "fsq-board-grid";
      Object.assign(grid.style, {
        display: "grid",
        gridTemplateColumns: "repeat(8, 1fr)",
        gridTemplateRows: "repeat(8, 1fr)",
        width: "100%",
        height: "100%",
        borderRadius: "10px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,.08)",
      });
      root.appendChild(grid);
      state.root = root;
      state.grid = grid;
      container.appendChild(root);
    }

    function paint() {
      const grid = state.grid;
      grid.innerHTML = "";
      state.squares = {};
      // dispRow 0 = top, dispCol 0 = left
      for (let dispRow = 0; dispRow < 8; dispRow++) {
        for (let dispCol = 0; dispCol < 8; dispCol++) {
          // map to board file/rank
          const file = state.flip ? 7 - dispCol : dispCol;
          const rank = state.flip ? dispRow : 7 - dispRow;
          const sq = sqName(file, rank);
          const idx = rank * 8 + file;
          const piece = state.board[idx] || "";
          const light = (file + rank) % 2 === 1;

          const cell = document.createElement("div");
          cell.className = "fsq-sq";
          cell.dataset.sq = sq;
          cell.dataset.file = String(file);
          cell.dataset.rank = String(rank);
          cell.dataset.piece = piece;
          Object.assign(cell.style, {
            position: "relative",
            background: light ? "#f0d9b5" : "#b58863",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          });

          // Koordinat etiketleri
          if (dispRow === 7) {
            const fl = document.createElement("span");
            fl.textContent = FILES[file];
            Object.assign(fl.style, {
              position: "absolute",
              right: "3px",
              bottom: "1px",
              fontSize: "10px",
              fontWeight: "600",
              color: light ? "#7a5a30" : "#f0d9b5",
              pointerEvents: "none",
            });
            cell.appendChild(fl);
          }
          if (dispCol === 0) {
            const rl = document.createElement("span");
            rl.textContent = String(rank + 1);
            Object.assign(rl.style, {
              position: "absolute",
              left: "3px",
              top: "1px",
              fontSize: "10px",
              fontWeight: "600",
              color: light ? "#7a5a30" : "#f0d9b5",
              pointerEvents: "none",
            });
            cell.appendChild(rl);
          }

          if (piece) {
            const img = document.createElement("img");
            img.src = pieceImageURL(piece);
            img.alt = piece;
            img.draggable = false;
            Object.assign(img.style, {
              width: "92%",
              height: "92%",
              pointerEvents: "none",
            });
            cell.appendChild(img);
          }

          cell.addEventListener("click", () => onSquareClick(sq));
          cell.addEventListener("pointerdown", (e) => onPointerDown(e, sq));
          grid.appendChild(cell);
          state.squares[sq] = cell;
        }
      }
    }

    // ── Drag-and-drop ─────────────────────────────────────
    function onPointerDown(e, sq) {
      if (state.locked || state.pendingPromo) return;
      if (e.button != null && e.button !== 0) return;
      const piece = state.squares[sq]?.dataset.piece || "";
      if (!isOwnPiece(piece, state.sideToMove)) return;
      if (state.canSelect && !state.canSelect(sq, piece)) return;
      // Drag adayı: pencerede pointermove/up dinle, eşik aşılırsa
      // sürüklemeye başla.
      const startX = e.clientX;
      const startY = e.clientY;
      const gridRect = state.grid.getBoundingClientRect();
      const cellSize = gridRect.width / 8;
      let dragging = false;
      let ghost = null;
      let lastHover = null;

      function startDrag() {
        dragging = true;
        // Kendi taşımızı seç + highlight
        state.selectedFrom = { sq, piece };
        clearHighlights();
        highlightFrom(sq);
        // Ghost img üret — state.root'a absolute olarak konumlandırırız.
        // (position:fixed, transformed ancestor (.fs-panel scale) altında
        // viewport yerine panel'e relative olur — bu yüzden absolute.)
        ghost = document.createElement("img");
        ghost.src = pieceImageURL(piece);
        ghost.draggable = false;
        Object.assign(ghost.style, {
          position: "absolute",
          width: cellSize * 0.92 + "px",
          height: cellSize * 0.92 + "px",
          pointerEvents: "none",
          zIndex: "999",
          transform: "translate(-50%, -50%)",
          filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))",
          opacity: "0.95",
          left: "0px",
          top: "0px",
        });
        state.root.appendChild(ghost);
        // Kalkış karesindeki img'i sakla
        const fromImg = state.squares[sq].querySelector("img");
        if (fromImg) fromImg.style.opacity = "0.25";
      }

      function squareAt(clientX, clientY) {
        const r = state.grid.getBoundingClientRect();
        const x = clientX - r.left;
        const y = clientY - r.top;
        if (x < 0 || y < 0 || x >= r.width || y >= r.height) return null;
        const dispCol = Math.floor(x / cellSize);
        const dispRow = Math.floor(y / cellSize);
        const file = state.flip ? 7 - dispCol : dispCol;
        const rank = state.flip ? dispRow : 7 - dispRow;
        return sqName(file, rank);
      }

      function setHover(targetSq) {
        if (lastHover && lastHover !== targetSq) {
          const c = state.squares[lastHover];
          if (c && c.dataset.sq !== state.selectedFrom?.sq) {
            c.style.boxShadow = "";
          }
        }
        if (targetSq && targetSq !== sq) {
          const c = state.squares[targetSq];
          if (c) c.style.boxShadow = "inset 0 0 0 3px rgba(255,255,255,.55)";
        }
        lastHover = targetSq;
      }

      function onMove(ev) {
        if (!dragging) {
          if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 4) {
            startDrag();
          } else {
            return;
          }
        }
        if (ghost) {
          // state.root'a relative absolute koordinat
          const rr = state.root.getBoundingClientRect();
          ghost.style.left = ev.clientX - rr.left + "px";
          ghost.style.top = ev.clientY - rr.top + "px";
        }
        const tgt = squareAt(ev.clientX, ev.clientY);
        setHover(tgt);
      }

      function cleanup() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        const fromImg = state.squares[sq]?.querySelector("img");
        if (fromImg) fromImg.style.opacity = "";
        if (lastHover && state.squares[lastHover]) {
          state.squares[lastHover].style.boxShadow = "";
        }
      }

      function onUp(ev) {
        if (!dragging) {
          cleanup();
          return; // click handler tetiklenecek
        }
        const tgt = squareAt(ev.clientX, ev.clientY);
        cleanup();
        if (!tgt || tgt === sq) {
          // İptal — seçimi koru ama highlight bırak (click ile devam edebilir)
          return;
        }
        // Drop hedefi: kendi taşımız mı kontrol, click-handler ile aynı mantık
        const tgtPiece = state.squares[tgt]?.dataset.piece || "";
        if (isOwnPiece(tgtPiece, state.sideToMove)) {
          state.selectedFrom = { sq: tgt, piece: tgtPiece };
          clearHighlights();
          highlightFrom(tgt);
          return;
        }
        const toRank = parseInt(tgt[1], 10);
        const isPawn = piece.toUpperCase() === "P";
        const promoRank = state.sideToMove === "w" ? 8 : 1;
        if (isPawn && toRank === promoRank) {
          state.pendingPromo = {
            fromSq: sq,
            toSq: tgt,
            color: state.sideToMove,
          };
          clearHighlights();
          highlightFrom(sq);
          showPromoPicker(tgt);
          return;
        }
        submitMove(sq + tgt);
      }

      function onCancel() {
        cleanup();
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    }

    function clearHighlights() {
      Object.values(state.squares).forEach((c) => {
        c.style.boxShadow = "";
        c.style.outline = "";
        c.style.zIndex = "";
        c.classList.remove("fsq-hl-ok", "fsq-hl-err", "fsq-hl-info");
      });
    }

    function clearArrow() {
      if (state.arrowEl && state.arrowEl.parentNode) {
        state.arrowEl.parentNode.removeChild(state.arrowEl);
      }
      state.arrowEl = null;
    }

    function waitFrame() {
      return new Promise((res) => {
        requestAnimationFrame(() => requestAnimationFrame(res));
      });
    }

    function sqCenter(sq) {
      const cell = state.squares[sq];
      if (!cell || !state.root) return null;
      const rootRect = state.root.getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      if (!rootRect.width || !r.width) return null;
      return {
        x: r.left - rootRect.left + r.width / 2,
        y: r.top - rootRect.top + r.height / 2,
      };
    }

    function drawArrow(fromSq, toSq, kind) {
      clearArrow();
      ensureBoardStyles(state.root);
      const a = sqCenter(fromSq);
      const b = sqCenter(toSq);
      if (!a || !b || !state.root) return;
      const rootRect = state.root.getBoundingClientRect();
      const w = Math.max(1, Math.round(rootRect.width));
      const h = Math.max(1, Math.round(rootRect.height));
      const colors = {
        ok: "rgba(34,197,94,.95)",
        err: "rgba(239,68,68,.92)",
        info: "rgba(59,130,246,.9)",
      };
      const col = colors[kind] || colors.info;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "fsq-arrow-layer");
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      svg.setAttribute("width", String(w));
      svg.setAttribute("height", String(h));
      Object.assign(svg.style, {
        position: "absolute",
        left: "0",
        top: "0",
        width: w + "px",
        height: h + "px",
        pointerEvents: "none",
        zIndex: "8",
        overflow: "visible",
      });

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Hedef kareye yapışmasın; ok ucu için yer bırak
      const tipPad = Math.min(22, len * 0.22);
      const shaftPad = Math.min(10, len * 0.08);
      const x1 = a.x + ux * shaftPad;
      const y1 = a.y + uy * shaftPad;
      const x2 = b.x - ux * tipPad;
      const y2 = b.y - uy * tipPad;
      // Ok ucu üçgeni (marker kullanma — Shadow DOM'da url(#id) kırılır)
      const tipLen = 16;
      const tipHalf = 9;
      const tx = b.x - ux * Math.min(8, tipPad * 0.35);
      const ty = b.y - uy * Math.min(8, tipPad * 0.35);
      const bx = tx - ux * tipLen;
      const by = ty - uy * tipLen;
      const px = -uy;
      const py = ux;
      const p1x = bx + px * tipHalf;
      const p1y = by + py * tipHalf;
      const p2x = bx - px * tipHalf;
      const p2y = by - py * tipHalf;

      const ns = "http://www.w3.org/2000/svg";
      const line = document.createElementNS(ns, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("y1", String(y1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y2", String(y2));
      line.setAttribute("stroke", col);
      line.setAttribute("stroke-width", "9");
      line.setAttribute("stroke-linecap", "round");
      line.setAttribute("opacity", "0.96");

      const tip = document.createElementNS(ns, "polygon");
      tip.setAttribute(
        "points",
        `${tx},${ty} ${p1x},${p1y} ${p2x},${p2y}`,
      );
      tip.setAttribute("fill", col);
      tip.setAttribute("opacity", "0.98");

      svg.appendChild(line);
      svg.appendChild(tip);
      state.root.appendChild(svg);
      state.arrowEl = svg;
    }

    function highlightFrom(sq) {
      const c = state.squares[sq];
      if (c) c.style.boxShadow = "inset 0 0 0 4px rgba(255, 235, 59, .75)";
    }

    function highlightMove(from, to, kind) {
      ensureBoardStyles(state.root);
      const cls =
        kind === "ok" ? "fsq-hl-ok" : kind === "err" ? "fsq-hl-err" : "fsq-hl-info";
      const outline =
        kind === "ok"
          ? "3px solid rgba(34,197,94,.95)"
          : kind === "err"
            ? "3px solid rgba(239,68,68,.95)"
            : "3px solid rgba(59,130,246,.9)";
      const glow =
        kind === "ok"
          ? "inset 0 0 0 4px rgba(34,197,94,.85), 0 0 18px rgba(34,197,94,.55)"
          : kind === "err"
            ? "inset 0 0 0 4px rgba(239,68,68,.85), 0 0 16px rgba(239,68,68,.5)"
            : "inset 0 0 0 4px rgba(59,130,246,.75)";
      [from, to].forEach((sq) => {
        const c = state.squares[sq];
        if (!c) return;
        c.classList.remove("fsq-hl-ok", "fsq-hl-err", "fsq-hl-info");
        c.classList.add(cls);
        // Inline fallback — Shadow DOM stil kaçırırsa yine görünsün
        c.style.outline = outline;
        c.style.boxShadow = glow;
        c.style.zIndex = "2";
      });
    }

    function sleep(ms) {
      return new Promise((res) => setTimeout(res, ms));
    }

    function onSquareClick(sq) {
      if (state.locked || state.pendingPromo) return;
      const cell = state.squares[sq];
      const piece = cell?.dataset.piece || "";

      // Hiçbir şey seçili değil → kendi taşımız olmalı
      if (!state.selectedFrom) {
        if (
          isOwnPiece(piece, state.sideToMove) &&
          (!state.canSelect || state.canSelect(sq, piece))
        ) {
          state.selectedFrom = { sq, piece };
          clearHighlights();
          highlightFrom(sq);
        }
        return;
      }

      // Aynı kareye tekrar tıklayınca iptal
      if (state.selectedFrom.sq === sq) {
        state.selectedFrom = null;
        clearHighlights();
        return;
      }

      // Yine kendi taşımıza tıklarsak seçimi değiştir
      if (
        isOwnPiece(piece, state.sideToMove) &&
        (!state.canSelect || state.canSelect(sq, piece))
      ) {
        state.selectedFrom = { sq, piece };
        clearHighlights();
        highlightFrom(sq);
        return;
      }

      // Hedef kare seçildi → UCI üret
      const from = state.selectedFrom.sq;
      const movingPiece = state.selectedFrom.piece;
      const toRank = parseInt(sq[1], 10);
      const isPawn = movingPiece.toUpperCase() === "P";
      const promoRank = state.sideToMove === "w" ? 8 : 1;

      if (isPawn && toRank === promoRank) {
        // Terfi: piece seç
        state.pendingPromo = {
          fromSq: from,
          toSq: sq,
          color: state.sideToMove,
        };
        clearHighlights();
        highlightFrom(from);
        showPromoPicker(sq);
        return;
      }

      submitMove(from + sq);
    }

    function pieceAtSq(sq) {
      const f = FILES.indexOf(sq[0]);
      const r = parseInt(sq[1], 10) - 1;
      if (f < 0 || r < 0) return "";
      return state.board[r * 8 + f] || "";
    }

    function isIllegalLearnMove(toSq) {
      if (!state.forbidKingCapture) return false;
      const target = pieceAtSq(toSq);
      return target && target.toUpperCase() === "K";
    }

    function rejectIllegalMove(fromSq, toSq) {
      clearHighlights();
      state.selectedFrom = null;
      if (typeof state.onIllegalMove === "function") {
        try {
          state.onIllegalMove("king_capture", { from: fromSq, to: toSq });
        } catch (_) {}
      }
    }

    function submitMove(uci) {
      const toSq = uci.slice(2, 4);
      if (isIllegalLearnMove(toSq)) {
        rejectIllegalMove(uci.slice(0, 2), toSq);
        return;
      }
      state.selectedFrom = null;
      state.pendingPromo = null;
      clearHighlights();
      // Yanlış olursa geri yüklemek için hamle öncesi FEN
      state.lastFenBeforeMove = boardToFen(state.board, state.sideToMove);
      state.lastSideBeforeMove = state.sideToMove;
      // Taşı görsel olarak yerel tahtada oynat (kullanıcı geri bildirimi).
      applyMoveLocal(uci);
      highlightMove(uci.slice(0, 2), uci.slice(2, 4), "info");
      try {
        state.onMove(uci);
      } catch (e) {
        console.error(e);
      }
    }

    function applyMoveLocal(uci) {
      try {
        const from = uci.slice(0, 2);
        const to = uci.slice(2, 4);
        const promo = uci.length >= 5 ? uci.slice(4, 5) : "";
        const fFile = FILES.indexOf(from[0]);
        const fRank = parseInt(from[1], 10) - 1;
        const tFile = FILES.indexOf(to[0]);
        const tRank = parseInt(to[1], 10) - 1;
        if (fFile < 0 || tFile < 0 || fRank < 0 || tRank < 0) return;
        const fromIdx = fRank * 8 + fFile;
        const toIdx = tRank * 8 + tFile;
        let piece = state.board[fromIdx];
        if (!piece) return;
        // En passant: piyon çapraz boş kareye gidiyorsa, yan kareyi temizle
        const isPawn = piece.toUpperCase() === "P";
        if (isPawn && fFile !== tFile && !state.board[toIdx]) {
          const epIdx = fRank * 8 + tFile;
          state.board[epIdx] = "";
        }
        // Rok: kral 2 kare yatay
        if (piece.toUpperCase() === "K" && Math.abs(tFile - fFile) === 2) {
          if (tFile === 6) {
            // kısa rok: h-kale → f
            const rIdx = fRank * 8 + 7;
            const rTo = fRank * 8 + 5;
            state.board[rTo] = state.board[rIdx];
            state.board[rIdx] = "";
          } else if (tFile === 2) {
            // uzun rok: a-kale → d
            const rIdx = fRank * 8 + 0;
            const rTo = fRank * 8 + 3;
            state.board[rTo] = state.board[rIdx];
            state.board[rIdx] = "";
          }
        }
        // Terfi
        if (isPawn && promo) {
          const isWhite = piece === piece.toUpperCase();
          piece = isWhite ? promo.toUpperCase() : promo.toLowerCase();
        }
        state.board[toIdx] = piece;
        state.board[fromIdx] = "";
        if (!state.keepSideToMove) {
          state.sideToMove = state.sideToMove === "w" ? "b" : "w";
        }
        paint();
      } catch (e) {
        console.error("applyMoveLocal", e);
      }
    }

    function showPromoPicker(toSq) {
      hidePromoPicker();
      const overlay = document.createElement("div");
      Object.assign(overlay.style, {
        position: "absolute",
        inset: "0",
        background: "rgba(0,0,0,.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "10",
      });
      const box = document.createElement("div");
      Object.assign(box.style, {
        background: "#111827",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: "10px",
        padding: "12px",
        display: "flex",
        gap: "8px",
      });
      const label = document.createElement("div");
      label.textContent = "Terfi:";
      Object.assign(label.style, {
        color: "#9ca3af",
        fontSize: "12px",
        alignSelf: "center",
        marginRight: "4px",
      });
      box.appendChild(label);

      const promos = ["q", "r", "b", "n"];
      promos.forEach((letter) => {
        const btn = document.createElement("button");
        const pieceCh =
          state.sideToMove === "w" ? letter.toUpperCase() : letter;
        const img = document.createElement("img");
        img.src = pieceImageURL(pieceCh);
        img.alt = letter;
        img.style.width = "44px";
        img.style.height = "44px";
        img.style.pointerEvents = "none";
        Object.assign(btn.style, {
          width: "52px",
          height: "52px",
          border: "1px solid rgba(255,255,255,.1)",
          borderRadius: "8px",
          background: "#1f2937",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
        });
        btn.appendChild(img);
        btn.addEventListener("mouseenter", () => {
          btn.style.background = "#374151";
        });
        btn.addEventListener("mouseleave", () => {
          btn.style.background = "#1f2937";
        });
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const p = state.pendingPromo;
          hidePromoPicker();
          if (!p) return;
          submitMove(p.fromSq + p.toSq + letter);
        });
        box.appendChild(btn);
      });

      // Cancel
      const cancel = document.createElement("button");
      cancel.textContent = "✕";
      Object.assign(cancel.style, {
        width: "32px",
        height: "52px",
        marginLeft: "4px",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: "8px",
        background: "transparent",
        color: "#9ca3af",
        cursor: "pointer",
        fontSize: "16px",
      });
      cancel.addEventListener("click", (e) => {
        e.stopPropagation();
        state.pendingPromo = null;
        state.selectedFrom = null;
        clearHighlights();
        hidePromoPicker();
      });
      box.appendChild(cancel);

      overlay.appendChild(box);
      state.root.appendChild(overlay);
      state.promoOverlay = overlay;
    }

    function hidePromoPicker() {
      if (state.promoOverlay && state.promoOverlay.parentNode) {
        state.promoOverlay.parentNode.removeChild(state.promoOverlay);
      }
      state.promoOverlay = null;
    }

    function setPosition(fen, sideToMove) {
      hidePromoPicker();
      clearArrow();
      state.board = fenToBoard(fen);
      state.sideToMove = sideToMove === "b" ? "b" : "w";
      // Otomatik flip: hamle sırası olan oyuncu altta
      state.flip = state.sideToMove === "b";
      state.selectedFrom = null;
      state.pendingPromo = null;
      state.locked = false;
      paint();
    }

    function flash(fromSq, toSq, kind) {
      clearHighlights();
      clearArrow();
      ensureBoardStyles(state.root);
      // Layout hazır olsun (özellikle paint sonrası)
      waitFrame().then(() => {
        highlightMove(fromSq, toSq, kind);
        if (fromSq && toSq) drawArrow(fromSq, toSq, kind || "info");
      });
    }

    function lock(flag) {
      state.locked = !!flag;
    }

    function destroy() {
      hidePromoPicker();
      clearArrow();
      container.innerHTML = "";
    }

    function highlightHint(sq) {
      const c = state.squares[sq];
      if (c) {
        c.style.boxShadow =
          "inset 0 0 0 4px rgba(245, 158, 11, .9), 0 0 18px rgba(245,158,11,.55)";
      }
    }

    // ── init
    buildSkeleton();
    ensureBoardStyles(state.root);
    if (opts.fen) setPosition(opts.fen, opts.sideToMove || "w");

    // Dışarıdan (örn. mate-2 rakip cevabı) hamle uygulamak için.
    function applyMove(uci, opts2) {
      if (!uci || uci.length < 4) return;
      try {
        applyMoveLocal(uci);
      } catch (_) {}
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      try {
        highlightMove(from, to, (opts2 && opts2.kind) || "info");
        drawArrow(from, to, (opts2 && opts2.kind) || "info");
      } catch (_) {}
    }

    /**
     * Yanlış sonrası: FEN'e dön → kırmızı yanlış kareler → doğru hamleyi oynat + yeşil ok.
     * Doğru sonrası: yeşil ok + pulse.
     */
    async function revealSolution(opts2) {
      const o = opts2 || {};
      const wrong = String(o.wrongUci || "").toLowerCase();
      const correct = String(o.correctUci || "").toLowerCase();
      lock(true);
      try {
        const restoreFen = o.fen || state.lastFenBeforeMove || null;
        const restoreSide =
          o.sideToMove || state.lastSideBeforeMove || "w";
        if (restoreFen) {
          setPosition(restoreFen, restoreSide);
          lock(true);
          await waitFrame();
        }
        if (wrong.length >= 4) {
          clearHighlights();
          clearArrow();
          highlightMove(wrong.slice(0, 2), wrong.slice(2, 4), "err");
          drawArrow(wrong.slice(0, 2), wrong.slice(2, 4), "err");
          await sleep(850);
        }
        if (correct.length >= 4) {
          if (restoreFen) {
            setPosition(restoreFen, restoreSide);
            lock(true);
            await waitFrame();
          }
          clearHighlights();
          clearArrow();
          try {
            applyMoveLocal(correct);
          } catch (_) {}
          await waitFrame();
          highlightMove(correct.slice(0, 2), correct.slice(2, 4), "ok");
          drawArrow(correct.slice(0, 2), correct.slice(2, 4), "ok");
        } else if (o.kind === "ok" && wrong.length >= 4) {
          clearHighlights();
          clearArrow();
          highlightMove(wrong.slice(0, 2), wrong.slice(2, 4), "ok");
          drawArrow(wrong.slice(0, 2), wrong.slice(2, 4), "ok");
        }
      } catch (_) {}
    }

    return {
      setPosition,
      flash,
      lock,
      destroy,
      clearHighlights,
      clearArrow,
      highlightHint,
      applyMove,
      revealSolution,
      drawArrow,
      getLastFenBeforeMove: () => state.lastFenBeforeMove,
      getFen: () => boardToFen(state.board, state.sideToMove),
    };
  }

  window.ForkSightQuizBoard = { create };
})();
