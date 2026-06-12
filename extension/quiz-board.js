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
//   board.destroy();

(function () {
  "use strict";

  const FILES = "abcdefgh";

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
      squares: {}, // sq-name → div element
      root: null,
      promoOverlay: null,
      locked: false,
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
      });
    }

    function highlightFrom(sq) {
      const c = state.squares[sq];
      if (c) c.style.boxShadow = "inset 0 0 0 4px rgba(255, 235, 59, .75)";
    }

    function highlightMove(from, to, kind) {
      const colors = {
        ok: "rgba(34,197,94,.7)",
        err: "rgba(239,68,68,.7)",
        info: "rgba(59,130,246,.7)",
      };
      const col = colors[kind] || colors.info;
      [from, to].forEach((sq) => {
        const c = state.squares[sq];
        if (c) c.style.outline = "4px solid " + col;
      });
    }

    function onSquareClick(sq) {
      if (state.locked || state.pendingPromo) return;
      const cell = state.squares[sq];
      const piece = cell?.dataset.piece || "";

      // Hiçbir şey seçili değil → kendi taşımız olmalı
      if (!state.selectedFrom) {
        if (isOwnPiece(piece, state.sideToMove)) {
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
      if (isOwnPiece(piece, state.sideToMove)) {
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

    function submitMove(uci) {
      state.selectedFrom = null;
      state.pendingPromo = null;
      clearHighlights();
      // Taşı görsel olarak yerel tahtada oynat (kullanıcı geri bildirimi).
      // Sunucu yanlış derse, çağıran taraf setPosition() ile FEN'i geri yükler.
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
        // Tarafı değiştir (sonraki tıklama için iç tutarlılık)
        state.sideToMove = state.sideToMove === "w" ? "b" : "w";
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
      highlightMove(fromSq, toSq, kind);
    }

    function lock(flag) {
      state.locked = !!flag;
    }

    function destroy() {
      hidePromoPicker();
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
      } catch (_) {}
    }

    return {
      setPosition,
      flash,
      lock,
      destroy,
      clearHighlights,
      highlightHint,
      applyMove,
    };
  }

  window.ForkSightQuizBoard = { create };
})();
