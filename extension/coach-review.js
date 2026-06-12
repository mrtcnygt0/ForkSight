/* ForkSight Coach Review — game analysis modal
 *
 * Public API:
 *   window.ForkSightReview.open()         → show method picker (URL veya FEN)
 *   window.ForkSightReview.openProfile()  → show user profile modal
 *   window.ForkSightReview.openWithUrl(url) → skip directly to URL flow
 *   window.ForkSightReview.openWithPgn(pgn) → skip directly to PGN analysis
 *
 * Flow:
 *   1. User enters a chess.com game URL.
 *   2. We detect the game type (live | computer | coach) and id.
 *   3. For live games we fetch the public callback endpoint:
 *        https://www.chess.com/callback/live/game/{id}
 *      which returns JSON containing the encoded moveList ("TCN") plus
 *      PGN headers, timestamps, and player info.
 *   4. The TCN moveList is decoded to a list of UCI moves.
 *   5. (This chunk) move list + headers are rendered in a modal.
 *   6. (Next chunk) a full SVG board, navigation, Stockfish eval per move,
 *      and an avatar speech-bubble narrator are layered on top.
 *
 * Notes on chess.com endpoints (tested May 2026):
 *   - /callback/live/game/{id}     → works, returns JSON (used here).
 *   - /game/computer/{id}          → user reported as not working.
 *   - /game/coach/{id}             → public page, no known callback API.
 *
 * The TCN ("two-character notation") used by chess.com is documented in
 * various community decoders. Each move is two characters from a fixed
 * 64-char alphabet (file/rank squares 0..63, a1=0, h8=63). Indices ≥64
 * mean a promotion: the destination is recomputed from the source and
 * the encoded promotion piece.
 */
(function () {
  "use strict";

  // ─── TCN decoder ─────────────────────────────────────────────────────
  // Canonical 75-char chess.com alphabet (note the DOUBLE '+' before '='):
  // a-z (0..25), A-Z (26..51), then a 23-char symbol block. Indices 0-63
  // are board squares (a1..h8), indices 64-74 encode pawn promotions.
  // Chess.com's actual TCN alphabet (verified empirically by decoding a
  // Caro-Kann Advance game): 26 lowercase + 26 uppercase + 10 digits + !?
  // = 64 square chars, followed by 11 promotion-encoding chars. Earlier
  // versions used the classic published TCN alphabet which omitted the
  // digits and therefore failed on any move where the from/to char is
  // 0-9 (e.g. Bf5 from c8 encodes as '6', the 59th char).
  const TCN_ALPHABET =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?{~}(^)[_]@#";
  const TCN_PROMO = "qnrbkp"; // promotion piece order used by chess.com

  function tcnSquareName(idx) {
    const file = "abcdefgh"[idx % 8];
    const rank = Math.floor(idx / 8) + 1;
    return file + rank;
  }

  /**
   * Decode chess.com's compact moveList into an array of UCI move objects.
   * Each entry: { from: "e2", to: "e4", promotion: null | "q"|"n"|"r"|"b",
   *               uci: "e2e4" }
   *
   * Note: chess.com encodes castling with the king moving to its OWN rook's
   * square (chess960 style) — e.g. white short castles as e1→h1, not e1→g1.
   * We translate that into the standard UCI king-moves-two-squares form so
   * downstream consumers don't need to know about the quirk.
   */
  function decodeTCN(moveList) {
    if (typeof moveList !== "string" || moveList.length < 2) return [];
    const out = [];
    let skipped = 0;
    let i = 0;
    while (i + 1 < moveList.length) {
      const fromIdx = TCN_ALPHABET.indexOf(moveList[i]);
      let toIdx = TCN_ALPHABET.indexOf(moveList[i + 1]);
      if (fromIdx < 0 || toIdx < 0) {
        skipped++;
        if (skipped <= 3) {
          console.warn(
            "[ForkSightReview] TCN char dışı pair atlandı:",
            JSON.stringify(moveList[i] + moveList[i + 1]),
            "@ offset",
            i,
          );
        }
        // Resync by 1 char in case the stream contains an unexpected
        // single-byte tag (very rare with the corrected alphabet).
        i += 1;
        continue;
      }
      let promotion = null;
      if (toIdx > 63) {
        promotion = TCN_PROMO[Math.floor((toIdx - 64) / 3)] || "q";
        // Destination rank is one step from source rank; file shifts -1/0/+1.
        const fileShift = ((toIdx - 64) % 3) - 1;
        const sourceRank = Math.floor(fromIdx / 8);
        const destRank = sourceRank === 6 ? 7 : 0; // 7th→8th or 2nd→1st
        const destFile = (fromIdx % 8) + fileShift;
        toIdx = destRank * 8 + destFile;
      }
      let from = tcnSquareName(fromIdx);
      let to = tcnSquareName(toIdx);

      // NOTE: chess.com encodes castling as king-onto-own-rook (e.g. white
      // short castle = e1→h1, queenside = e1→a1). We DO NOT rewrite that
      // here — earlier versions blindly rewrote any e1→h1/a1 (or e8→…)
      // pair into a two-square king move, which corrupted legitimate rook
      // captures like Rxh1 after the king had already castled away from
      // e1 (e.g. 18.O-O-O … 22.Rxh1 was being decoded as Rg1).
      //
      // The position-aware applyMove() detects king-onto-rook correctly
      // by checking that the moving piece is actually a king, so we just
      // pass the raw square pair through.

      out.push({
        from,
        to,
        promotion,
        uci: from + to + (promotion || ""),
      });
      i += 2;
    }
    if (skipped) {
      console.warn(
        "[ForkSightReview] TCN decode: toplam",
        skipped,
        "pair atlandı (alfabe dışı karakter).",
      );
    }
    return out;
  }

  // ─── PGN ingestion ───────────────────────────────────────────────────
  // We need to:
  //   1) Parse PGN headers + extract the moveText
  //   2) Tokenise SAN moves (stripping comments, NAGs, variations, result)
  //   3) Convert each SAN to a UCI move (requires a minimal legal move
  //      generator so we can disambiguate and validate)
  //   4) Surface per-ply clock/timestamp data when chess.com embedded it.
  //
  // The move generator below is intentionally minimal — only what's
  // needed for SAN resolution. The actual board mutation still happens
  // through applyMove() so castling / en passant / promotions stay in
  // one canonical place.

  const _KNIGHT_DELTAS = [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ];
  const _KING_DELTAS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const _ROOK_RAYS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const _BISHOP_RAYS = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const _QUEEN_RAYS = _ROOK_RAYS.concat(_BISHOP_RAYS);

  function _pieceColorChar(p) {
    return p === p.toUpperCase() ? "w" : "b";
  }

  function _isAttacked(board, sqIdx, byColor) {
    const r = Math.floor(sqIdx / 8);
    const f = sqIdx % 8;
    // Pawn attacks — the pawn moves forward, so an attacker sits diagonally
    // "behind" the target square from its own perspective.
    const pawnDir = byColor === "w" ? -1 : 1;
    for (const df of [-1, 1]) {
      const ar = r + pawnDir;
      const af = f + df;
      if (ar < 0 || ar >= 8 || af < 0 || af >= 8) continue;
      const p = board[ar * 8 + af];
      if (p && _pieceColorChar(p) === byColor && p.toLowerCase() === "p")
        return true;
    }
    for (const [dr, df] of _KNIGHT_DELTAS) {
      const nr = r + dr,
        nf = f + df;
      if (nr < 0 || nr >= 8 || nf < 0 || nf >= 8) continue;
      const p = board[nr * 8 + nf];
      if (p && _pieceColorChar(p) === byColor && p.toLowerCase() === "n")
        return true;
    }
    for (const [dr, df] of _KING_DELTAS) {
      const nr = r + dr,
        nf = f + df;
      if (nr < 0 || nr >= 8 || nf < 0 || nf >= 8) continue;
      const p = board[nr * 8 + nf];
      if (p && _pieceColorChar(p) === byColor && p.toLowerCase() === "k")
        return true;
    }
    for (const [dr, df] of _ROOK_RAYS) {
      let nr = r + dr,
        nf = f + df;
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        const p = board[nr * 8 + nf];
        if (p) {
          if (_pieceColorChar(p) === byColor) {
            const t = p.toLowerCase();
            if (t === "r" || t === "q") return true;
          }
          break;
        }
        nr += dr;
        nf += df;
      }
    }
    for (const [dr, df] of _BISHOP_RAYS) {
      let nr = r + dr,
        nf = f + df;
      while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
        const p = board[nr * 8 + nf];
        if (p) {
          if (_pieceColorChar(p) === byColor) {
            const t = p.toLowerCase();
            if (t === "b" || t === "q") return true;
          }
          break;
        }
        nr += dr;
        nf += df;
      }
    }
    return false;
  }

  // Generate pseudo-legal moves for the side to move. Castling here is
  // gated by check/through-check rules (so we don't propose illegal
  // castles during SAN disambiguation); regular moves are filtered for
  // own-king-safety inside sanToUci().
  function _pseudoMoves(pos) {
    const out = [];
    const turn = pos.turn;
    const board = pos.board;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p) continue;
      const isWhite = p === p.toUpperCase();
      if ((isWhite && turn !== "w") || (!isWhite && turn !== "b")) continue;
      const r = Math.floor(i / 8),
        f = i % 8;
      const t = p.toLowerCase();
      const own = isWhite ? "w" : "b";
      if (t === "p") {
        const dir = isWhite ? 1 : -1;
        const startRank = isWhite ? 1 : 6;
        const promoRank = isWhite ? 7 : 0;
        const fr = r + dir;
        if (fr >= 0 && fr < 8 && !board[fr * 8 + f]) {
          if (fr === promoRank) {
            for (const pr of ["q", "r", "b", "n"])
              out.push([i, fr * 8 + f, pr]);
          } else out.push([i, fr * 8 + f, null]);
          if (r === startRank) {
            const fr2 = r + 2 * dir;
            if (!board[fr2 * 8 + f]) out.push([i, fr2 * 8 + f, null]);
          }
        }
        for (const df of [-1, 1]) {
          const cf = f + df;
          if (cf < 0 || cf >= 8) continue;
          const cr = r + dir;
          if (cr < 0 || cr >= 8) continue;
          const tgt = board[cr * 8 + cf];
          const tSqName = "abcdefgh"[cf] + (cr + 1);
          if (tgt && _pieceColorChar(tgt) !== own) {
            if (cr === promoRank) {
              for (const pr of ["q", "r", "b", "n"])
                out.push([i, cr * 8 + cf, pr]);
            } else out.push([i, cr * 8 + cf, null]);
          } else if (!tgt && tSqName === pos.ep) {
            out.push([i, cr * 8 + cf, null]);
          }
        }
      } else if (t === "n") {
        for (const [dr, df] of _KNIGHT_DELTAS) {
          const nr = r + dr,
            nf = f + df;
          if (nr < 0 || nr >= 8 || nf < 0 || nf >= 8) continue;
          const tgt = board[nr * 8 + nf];
          if (!tgt || _pieceColorChar(tgt) !== own)
            out.push([i, nr * 8 + nf, null]);
        }
      } else if (t === "b" || t === "r" || t === "q") {
        const rays =
          t === "b" ? _BISHOP_RAYS : t === "r" ? _ROOK_RAYS : _QUEEN_RAYS;
        for (const [dr, df] of rays) {
          let nr = r + dr,
            nf = f + df;
          while (nr >= 0 && nr < 8 && nf >= 0 && nf < 8) {
            const tgt = board[nr * 8 + nf];
            if (!tgt) out.push([i, nr * 8 + nf, null]);
            else {
              if (_pieceColorChar(tgt) !== own)
                out.push([i, nr * 8 + nf, null]);
              break;
            }
            nr += dr;
            nf += df;
          }
        }
      } else if (t === "k") {
        for (const [dr, df] of _KING_DELTAS) {
          const nr = r + dr,
            nf = f + df;
          if (nr < 0 || nr >= 8 || nf < 0 || nf >= 8) continue;
          const tgt = board[nr * 8 + nf];
          if (!tgt || _pieceColorChar(tgt) !== own)
            out.push([i, nr * 8 + nf, null]);
        }
        // Castling — only if rights are present, squares empty, king
        // not in check / not passing through attacked square.
        const homeRank = isWhite ? 0 : 7;
        if (r === homeRank && f === 4) {
          const enemy = isWhite ? "b" : "w";
          const KSide = isWhite ? "K" : "k";
          const QSide = isWhite ? "Q" : "q";
          if (
            pos.castle.indexOf(KSide) >= 0 &&
            !board[homeRank * 8 + 5] &&
            !board[homeRank * 8 + 6] &&
            !_isAttacked(board, homeRank * 8 + 4, enemy) &&
            !_isAttacked(board, homeRank * 8 + 5, enemy) &&
            !_isAttacked(board, homeRank * 8 + 6, enemy)
          ) {
            out.push([i, homeRank * 8 + 6, null]);
          }
          if (
            pos.castle.indexOf(QSide) >= 0 &&
            !board[homeRank * 8 + 1] &&
            !board[homeRank * 8 + 2] &&
            !board[homeRank * 8 + 3] &&
            !_isAttacked(board, homeRank * 8 + 4, enemy) &&
            !_isAttacked(board, homeRank * 8 + 3, enemy) &&
            !_isAttacked(board, homeRank * 8 + 2, enemy)
          ) {
            out.push([i, homeRank * 8 + 2, null]);
          }
        }
      }
    }
    return out;
  }

  /**
   * Resolve a SAN token to a UCI string given the current position.
   * Returns the UCI (e.g. "e2e4", "e7e8q") or null if the SAN does not
   * uniquely identify a legal move.
   */
  function sanToUci(pos, sanRaw) {
    let san = String(sanRaw)
      .replace(/[+#!?]+$/g, "")
      .trim();
    if (!san) return null;
    if (san === "O-O" || san === "0-0") {
      const r = pos.turn === "w" ? 1 : 8;
      return "e" + r + "g" + r;
    }
    if (san === "O-O-O" || san === "0-0-0") {
      const r = pos.turn === "w" ? 1 : 8;
      return "e" + r + "c" + r;
    }
    let promo = null;
    const pm = san.match(/=([QRBN])$/i);
    if (pm) {
      promo = pm[1].toLowerCase();
      san = san.slice(0, pm.index);
    } else {
      const pm2 = san.match(/([QRBN])$/);
      if (pm2 && san.length >= 3 && /[1-8]/.test(san[san.length - 2])) {
        promo = pm2[1].toLowerCase();
        san = san.slice(0, -1);
      }
    }
    let pieceLetter = "P";
    if (/^[KQRBN]/.test(san)) {
      pieceLetter = san[0];
      san = san.slice(1);
    }
    san = san.replace(/x/g, "");
    if (san.length < 2) return null;
    const targetSq = san.slice(-2);
    if (!/^[a-h][1-8]$/.test(targetSq)) return null;
    const targetIdx =
      targetSq.charCodeAt(0) - 97 + (parseInt(targetSq[1], 10) - 1) * 8;
    const disamb = san.slice(0, -2);
    let disambFile = null,
      disambRank = null;
    for (const ch of disamb) {
      if (ch >= "a" && ch <= "h") disambFile = ch.charCodeAt(0) - 97;
      else if (ch >= "1" && ch <= "8") disambRank = parseInt(ch, 10) - 1;
    }
    const isWhite = pos.turn === "w";
    const myPiece = isWhite ? pieceLetter : pieceLetter.toLowerCase();
    const moves = _pseudoMoves(pos);
    const candidates = moves.filter(([from, to, p]) => {
      if (to !== targetIdx) return false;
      if (pos.board[from] !== myPiece) return false;
      if (disambFile !== null && from % 8 !== disambFile) return false;
      if (disambRank !== null && Math.floor(from / 8) !== disambRank)
        return false;
      if (promo && p !== promo) return false;
      if (!promo && p !== null) return false;
      return true;
    });
    const legal = [];
    for (const cand of candidates) {
      const [from, to, p] = cand;
      const fromSq = "abcdefgh"[from % 8] + (Math.floor(from / 8) + 1);
      const toSq = "abcdefgh"[to % 8] + (Math.floor(to / 8) + 1);
      let next;
      try {
        next = applyMove(pos, {
          from: fromSq,
          to: toSq,
          promotion: p,
          uci: fromSq + toSq + (p || ""),
        }).pos;
      } catch (_) {
        continue;
      }
      const moverColor = pos.turn;
      const kch = moverColor === "w" ? "K" : "k";
      let kIdx = -1;
      for (let ii = 0; ii < 64; ii++)
        if (next.board[ii] === kch) {
          kIdx = ii;
          break;
        }
      if (kIdx < 0) continue;
      if (!_isAttacked(next.board, kIdx, moverColor === "w" ? "b" : "w"))
        legal.push(cand);
    }
    if (legal.length !== 1) return null;
    const [from, to, p] = legal[0];
    const fromSq = "abcdefgh"[from % 8] + (Math.floor(from / 8) + 1);
    const toSq = "abcdefgh"[to % 8] + (Math.floor(to / 8) + 1);
    return fromSq + toSq + (p || "");
  }

  /**
   * Parse a PGN string into { headers, sanMoves, timestamps, clocks }.
   * Timestamps come from `[%timestamp N]` comments; clocks from `[%clk
   * H:MM:SS(.t)]`. Both arrays align with sanMoves order (null where the
   * comment didn't carry that field).
   */
  function parsePgn(pgnStr) {
    const text = String(pgnStr || "").trim();
    if (!text) throw new Error(T("PGN boş."));
    const headers = {};
    const headerRegex = /\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]/g;
    let m;
    let lastHeaderEnd = 0;
    while ((m = headerRegex.exec(text)) !== null) {
      headers[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      lastHeaderEnd = m.index + m[0].length;
    }
    let body = text.slice(lastHeaderEnd);
    const timestamps = [];
    const clocks = [];
    const commentRegex = /\{([^}]*)\}/g;
    let cm;
    while ((cm = commentRegex.exec(body)) !== null) {
      const c = cm[1];
      const tsMatch = c.match(/%timestamp\s+(\d+)/);
      timestamps.push(tsMatch ? parseInt(tsMatch[1], 10) : null);
      const ckMatch = c.match(/%clk\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (ckMatch) {
        clocks.push(
          parseInt(ckMatch[1], 10) * 3600 +
            parseInt(ckMatch[2], 10) * 60 +
            parseFloat(ckMatch[3]),
        );
      } else clocks.push(null);
    }
    body = body.replace(/\{[^}]*\}/g, " ");
    body = body.replace(/\$\d+/g, " ");
    while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, " ");
    body = body.replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g, " ");
    body = body.replace(/\d+\.(\.\.)?/g, " ");
    const tokens = body.split(/\s+/).filter((t) => t.length > 0);
    return { headers, sanMoves: tokens, timestamps, clocks };
  }

  /**
   * Walk a PGN's SAN moves, converting each to a UCI move and producing
   * the array buildTimeline() expects. Throws on the first move that
   * fails to resolve so the user sees a clear "couldn't parse move X".
   */
  function pgnToMoves(pgnStr) {
    const parsed = parsePgn(pgnStr);
    const startPos = parsed.headers.FEN
      ? fenToPosition(parsed.headers.FEN)
      : null;
    let pos = startPos ? clonePosition(startPos) : newPosition();
    const uciMoves = [];
    for (let i = 0; i < parsed.sanMoves.length; i++) {
      const san = parsed.sanMoves[i];
      const uci = sanToUci(pos, san);
      if (!uci) {
        throw new Error(
          'Hamle ayrıştırılamadı: "' + san + '" (hamle #' + (i + 1) + ").",
        );
      }
      const move = {
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : null,
        uci,
      };
      uciMoves.push(move);
      pos = applyMove(pos, move).pos;
    }
    return {
      headers: parsed.headers,
      uciMoves,
      startPos,
      timestamps: parsed.timestamps,
      clocks: parsed.clocks,
    };
  }

  // ─── URL parsing ─────────────────────────────────────────────────────
  /**
   * Recognise chess.com game URLs.
   * Returns { type: "live"|"computer"|"coach"|"daily", id: "1234567" }
   * or null if the input isn't a chess.com game URL we know.
   */
  function parseGameUrl(input) {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    // Accept bare ids too — assume live in that case.
    if (/^\d{6,}$/.test(trimmed)) {
      return { type: "live", id: trimmed };
    }
    const m = trimmed.match(
      /chess\.com\/(?:game|live)\/(live|computer|coach|daily)\/(\d+)/i,
    );
    if (m) return { type: m[1].toLowerCase(), id: m[2] };
    // Also accept /game/{id} without type — assume live.
    const m2 = trimmed.match(/chess\.com\/game\/(\d{6,})/i);
    if (m2) return { type: "live", id: m2[1] };
    return null;
  }

  // ─── Fetch ───────────────────────────────────────────────────────────
  async function fetchLiveGame(id) {
    const url =
      "https://www.chess.com/callback/live/game/" + encodeURIComponent(id);
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(T("Sunucu hata kodu döndü: HTTP ") + res.status);
    }
    const data = await res.json();
    if (!data || !data.game) throw new Error(T("Geçersiz yanıt formatı."));
    return data;
  }

  async function fetchDailyGame(id) {
    const url =
      "https://www.chess.com/callback/daily/game/" + encodeURIComponent(id);
    const res = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(
        T(
          "Daily oyun alınamadı (HTTP {n}). Oyun id doğru mu, hâlâ erişilebilir mi?",
        ).replace("{n}", res.status),
      );
    }
    const data = await res.json();
    if (!data || !data.game) throw new Error(T("Geçersiz yanıt formatı."));
    return data;
  }

  /**
   * Router that picks the right callback endpoint based on the parsed
   * URL type. Only "live" and "daily" are wired right now; anything else
   * throws a friendly error so the caller can surface it.
   */
  async function fetchGame(parsed) {
    if (!parsed || !parsed.type)
      throw new Error(T("Bilinmeyen bağlantı türü."));
    if (parsed.type === "live") return fetchLiveGame(parsed.id);
    if (parsed.type === "daily") return fetchDailyGame(parsed.id);
    throw new Error(
      T(
        "Şu an yalnızca live ve daily oyunlar destekleniyor (tip: {t}).",
      ).replace("{t}", parsed.type),
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────
  // i18n: Türkçe metinleri kaynak alır; seçili dil EN ise sözlükten karşılığı döner.
  function T(s) {
    return window.ForkSightI18n
      ? window.ForkSightI18n.t(s)
      : String(s == null ? "" : s);
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtDuration(sec) {
    if (!sec || sec < 0) return "—";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
  }

  /**
   * Convert chess.com's centi-second timestamp string ("1210,1200,…") into
   * per-move seconds remaining. For now we just expose raw values; the
   * narrator (next chunk) will use them to detect time pressure.
   */
  function parseTimestamps(s) {
    if (typeof s !== "string" || !s.length) return [];
    return s
      .split(",")
      .map((x) => parseInt(x, 10))
      .filter((n) => isFinite(n));
  }

  // PGN TimeControl → base/increment seconds. Handles "600", "180+2",
  // "1/86400" (daily) and falls back to {base:0,inc:0}.
  function parseTimeControl(tc) {
    const m = /^(\d+)(?:\+(\d+))?/.exec(String(tc || "").trim());
    if (!m) return { base: 0, inc: 0 };
    return { base: parseInt(m[1], 10), inc: parseInt(m[2] || "0", 10) };
  }

  // Format remaining seconds as chess.com clock style. ≥1min → "M:SS",
  // <1min → "0:SS.t" (tenths). Negative or null → "—".
  function formatClock(secs) {
    if (secs == null || !isFinite(secs)) return "—";
    if (secs < 0) secs = 0;
    if (secs >= 60) {
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return m + ":" + (s < 10 ? "0" + s : s);
    }
    const tenths = Math.floor((secs % 1) * 10);
    return (
      "0:" +
      (Math.floor(secs) < 10 ? "0" + Math.floor(secs) : Math.floor(secs)) +
      "." +
      tenths
    );
  }

  // Compute remaining time (in seconds) for white/black after `ply` moves
  // have been played, using chess.com's deciseconds timestamp array.
  // timestamps[i] is the remaining time of the player who played move i+1.
  // White plays the odd plies (1,3,…) → even indices (0,2,…) in timestamps;
  // Black plays the even plies (2,4,…) → odd indices (1,3,…).
  function clocksAtPly(timestamps, ply, baseSecs) {
    let wIdx = -1;
    let bIdx = -1;
    const lastMove = ply - 1; // index into timestamps array
    for (let i = 0; i <= lastMove && i < timestamps.length; i++) {
      if (i % 2 === 0) wIdx = i;
      else bIdx = i;
    }
    const w = wIdx >= 0 ? timestamps[wIdx] / 10 : baseSecs;
    const b = bIdx >= 0 ? timestamps[bIdx] / 10 : baseSecs;
    return { w, b };
  }

  // Count captured pieces by walking the board array. Returns an object
  // with `byWhite` (what white captured from black) and `byBlack` (what
  // black captured from white). Each side is keyed by piece letter (p/n/
  // b/r/q) with the count. Also returns a material delta in centipawn-
  // equivalent units (p=1,n=3,b=3,r=5,q=9) → byWhite − byBlack.
  function capturedCounts(board) {
    const init = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    // We walk the board and decrement these starting counts for every
    // matching piece *still on the board*. Whatever is left is the
    // number of pieces of that color that were lost (= captured by the
    // OTHER side).
    const whiteLost = Object.assign({}, init);
    const blackLost = Object.assign({}, init);
    for (const p of board) {
      if (!p) continue;
      const k = p.toLowerCase();
      if (!(k in whiteLost)) continue; // ignores kings
      if (p === p.toUpperCase()) whiteLost[k]--;
      else blackLost[k]--;
    }
    // Pieces white captured = pieces black lost, and vice versa.
    const byWhite = {};
    const byBlack = {};
    let matW = 0;
    let matB = 0;
    const val = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    for (const k of Object.keys(init)) {
      const cw = Math.max(0, blackLost[k]); // white captured these black pieces
      const cb = Math.max(0, whiteLost[k]); // black captured these white pieces
      if (cw > 0) {
        byWhite[k] = cw;
        matW += cw * val[k];
      }
      if (cb > 0) {
        byBlack[k] = cb;
        matB += cb * val[k];
      }
    }
    return { byWhite, byBlack, delta: matW - matB };
  }

  // Render a row of captured-piece thumbnails for a given side. `pieces`
  // is the byWhite/byBlack object from capturedCounts(). `capturerColor`
  // ('w'|'b') is who did the capturing; we display the OPPONENT pieces
  // (lowercase if capturer is white → black pieces taken).
  function renderCapturedRow(pieces, capturerColor, delta) {
    const order = ["p", "n", "b", "r", "q"];
    // Captured pieces belong to the opposite color, so build filenames
    // with the opponent's prefix (wP for white pawns, etc).
    const oppPrefix = capturerColor === "w" ? "b" : "w";
    let html = "";
    for (const k of order) {
      const n = pieces[k] || 0;
      for (let i = 0; i < n; i++) {
        const file = `pieces/${oppPrefix}${k.toUpperCase()}.png`;
        const url = chrome.runtime.getURL(file);
        html += '<img class="forksight-rb-cap-pc" src="' + url + '" alt=""/>';
      }
    }
    // Material advantage badge: +N when capturer is ahead in material.
    const advantage = capturerColor === "w" ? delta : -delta;
    if (advantage > 0) {
      html += '<span class="forksight-rb-cap-adv">+' + advantage + "</span>";
    }
    return html;
  }

  // Build SAN strings (one per move) from UCI by walking the board with a
  // tiny built-in chess engine. Out of scope for chunk 1 — for now we just
  // show "1. e2-e4 e7-e5 ..." style. Proper SAN comes with the board engine.
  function uciPairsAsRows(uciMoves) {
    const rows = [];
    for (let i = 0; i < uciMoves.length; i += 2) {
      const w = uciMoves[i];
      const b = uciMoves[i + 1];
      rows.push({
        n: i / 2 + 1,
        w: w
          ? w.from +
            "-" +
            w.to +
            (w.promotion ? "=" + w.promotion.toUpperCase() : "")
          : "",
        b: b
          ? b.from +
            "-" +
            b.to +
            (b.promotion ? "=" + b.promotion.toUpperCase() : "")
          : "",
      });
    }
    return rows;
  }

  // ─── Mini chess engine (position + FEN + SAN, no legality checks) ────
  // We trust chess.com's move stream, so we only need to APPLY moves, not
  // validate them. The engine tracks the minimum state required for FEN
  // generation + decent SAN: piece placement, side to move, castling rights,
  // en passant target, halfmove clock, fullmove number.
  //
  // Pieces are encoded as single chars: P/N/B/R/Q/K = white, p/n/b/r/q/k = black.
  // Board is a flat 64-array, index 0 = a1, 63 = h8 (same convention as TCN).
  function initialBoard() {
    return [
      // rank 1 (white back rank)
      "R",
      "N",
      "B",
      "Q",
      "K",
      "B",
      "N",
      "R",
      // rank 2 (white pawns)
      "P",
      "P",
      "P",
      "P",
      "P",
      "P",
      "P",
      "P",
      // ranks 3-6 (empty)
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      // rank 7 (black pawns)
      "p",
      "p",
      "p",
      "p",
      "p",
      "p",
      "p",
      "p",
      // rank 8 (black back rank)
      "r",
      "n",
      "b",
      "q",
      "k",
      "b",
      "n",
      "r",
    ];
  }

  function newPosition() {
    return {
      board: initialBoard(),
      turn: "w",
      castle: "KQkq",
      ep: "-",
      half: 0,
      full: 1,
    };
  }

  function clonePosition(p) {
    return {
      board: p.board.slice(),
      turn: p.turn,
      castle: p.castle,
      ep: p.ep,
      half: p.half,
      full: p.full,
    };
  }

  function sqToIdx(sq) {
    return sq.charCodeAt(0) - 97 + (parseInt(sq[1], 10) - 1) * 8;
  }
  function idxToSq(idx) {
    return "abcdefgh"[idx % 8] + (Math.floor(idx / 8) + 1);
  }

  /**
   * Apply a UCI move to a position. Returns { pos, san, capture, check } for
   * narration use. Mutates a copy of `pos`. We assume the move is legal.
   */
  function applyMove(prevPos, move) {
    const pos = clonePosition(prevPos);
    const fromIdx = sqToIdx(move.from);
    const toIdx = sqToIdx(move.to);
    const piece = pos.board[fromIdx];
    if (!piece) {
      // Defensive: empty from-square means a previous move desynced the
      // board. Log it loudly so we can debug instead of silently corrupting
      // the rest of the timeline.
      console.warn(
        "[ForkSightReview] Boş kareden hamle:",
        move.uci || move.from + move.to,
        "— pozisyon güncellenmeden geçildi.",
      );
      // Still consume the turn so subsequent rendering doesn't shift.
      pos.turn = pos.turn === "w" ? "b" : "w";
      if (pos.turn === "w") pos.full = (prevPos.full || 1) + 1;
      return {
        pos,
        san: "?",
        capture: false,
        epCapture: false,
        castle: null,
        promotion: null,
        from: move.from,
        to: move.to,
        uci: move.uci,
        piece: "?",
      };
    }
    const target = pos.board[toIdx];
    const isWhite = piece === piece.toUpperCase();
    const pieceLower = piece.toLowerCase();
    let capture = !!target;
    let castleSide = null; // "K" or "Q"
    let epCapture = false;

    // ─ En passant capture: pawn moves diagonally onto an empty ep square ─
    if (pieceLower === "p" && move.to === pos.ep && !target) {
      const capRank = isWhite ? toIdx - 8 : toIdx + 8;
      pos.board[capRank] = "";
      capture = true;
      epCapture = true;
    }

    // ─ Castling detection ─
    // Accept both the standard king-moves-two-squares encoding AND the
    // chess.com / chess960 style where the king moves onto its own rook's
    // square (already normalised in decodeTCN, but we keep this branch as
    // a safety net in case raw UCI from other sources is passed in).
    let castleDetected = false;
    if (pieceLower === "k") {
      const fileDelta = (toIdx % 8) - (fromIdx % 8);
      const sameRank = Math.floor(toIdx / 8) === Math.floor(fromIdx / 8);
      if (sameRank && Math.abs(fileDelta) === 2) {
        castleDetected = true;
      } else if (
        sameRank &&
        target &&
        target.toLowerCase() === "r" &&
        // CRITICAL: only treat as castling when the rook belongs to the
        // SAME side as the moving king. Earlier this condition was the
        // tautology `target === piece || target !== piece`, which made
        // any king-takes-rook on the home rank (e.g. black `Kxe8`
        // capturing a white rook on e8) look like a castle and corrupted
        // the board.
        _pieceColorChar(target) === _pieceColorChar(piece)
      ) {
        // King-onto-rook: rewrite to standard 2-square form on the fly.
        castleDetected = true;
      }
    }
    if (castleDetected) {
      const homeRank = Math.floor(fromIdx / 8) * 8;
      const kingside = toIdx % 8 > fromIdx % 8;
      castleSide = kingside ? "K" : "Q";
      const rookFromIdx = kingside ? homeRank + 7 : homeRank + 0;
      const kingTargetIdx = kingside ? homeRank + 6 : homeRank + 2;
      const rookTargetIdx = kingside ? homeRank + 5 : homeRank + 3;
      // Clear king + rook origin squares first (in case king-onto-rook).
      pos.board[fromIdx] = "";
      pos.board[rookFromIdx] = "";
      pos.board[kingTargetIdx] = piece;
      pos.board[rookTargetIdx] = isWhite ? "R" : "r";
      capture = false; // not a real capture
      // Skip the generic move/promotion handling below.
      // Update castling rights for the king side.
      pos.castle = pos.castle.replace(isWhite ? /[KQ]/g : /[kq]/g, "");
      if (!pos.castle) pos.castle = "-";
      pos.ep = "-";
      pos.half = (prevPos.half || 0) + 1;
      if (!isWhite) pos.full = (prevPos.full || 1) + 1;
      pos.turn = isWhite ? "b" : "w";
      return {
        pos,
        san: kingside ? "O-O" : "O-O-O",
        capture: false,
        epCapture: false,
        castle: castleSide,
        promotion: null,
        from: move.from,
        to: kingside
          ? "abcdefgh"[6] + (Math.floor(fromIdx / 8) + 1)
          : "abcdefgh"[2] + (Math.floor(fromIdx / 8) + 1),
        uci: move.uci,
        piece,
      };
    }

    // ─ Move the piece (handle promotion) ─
    pos.board[fromIdx] = "";
    if (move.promotion) {
      pos.board[toIdx] = isWhite
        ? move.promotion.toUpperCase()
        : move.promotion.toLowerCase();
    } else {
      pos.board[toIdx] = piece;
    }

    // ─ Update castling rights when rook/king moves OR is captured ─
    if (pieceLower === "k") {
      pos.castle = pos.castle.replace(isWhite ? /[KQ]/g : /[kq]/g, "");
    }
    if (pieceLower === "r") {
      // Identify which rook moved by its from square
      if (move.from === "a1") pos.castle = pos.castle.replace("Q", "");
      else if (move.from === "h1") pos.castle = pos.castle.replace("K", "");
      else if (move.from === "a8") pos.castle = pos.castle.replace("q", "");
      else if (move.from === "h8") pos.castle = pos.castle.replace("k", "");
    }
    // Rook captured on its home square → opponent loses that side's right
    if (move.to === "a1") pos.castle = pos.castle.replace("Q", "");
    if (move.to === "h1") pos.castle = pos.castle.replace("K", "");
    if (move.to === "a8") pos.castle = pos.castle.replace("q", "");
    if (move.to === "h8") pos.castle = pos.castle.replace("k", "");
    if (!pos.castle) pos.castle = "-";

    // ─ En passant target square for next move ─
    if (pieceLower === "p" && Math.abs(toIdx - fromIdx) === 16) {
      pos.ep = idxToSq(isWhite ? fromIdx + 8 : fromIdx - 8);
    } else {
      pos.ep = "-";
    }

    // ─ Halfmove clock: reset on pawn move or capture ─
    if (pieceLower === "p" || capture) pos.half = 0;
    else pos.half = (prevPos.half || 0) + 1;

    // ─ Fullmove number: increment after black moves ─
    if (!isWhite) pos.full = (prevPos.full || 1) + 1;

    pos.turn = isWhite ? "b" : "w";

    // ─ Build SAN representation (no disambiguation logic — good-enough) ─
    let san;
    if (castleSide === "K") san = "O-O";
    else if (castleSide === "Q") san = "O-O-O";
    else {
      const letter = pieceLower === "p" ? "" : pieceLower.toUpperCase();
      let s = "";
      if (pieceLower === "p" && capture) {
        s = move.from[0] + "x" + move.to;
      } else if (capture) {
        s = letter + "x" + move.to;
      } else {
        s = letter + move.to;
      }
      if (move.promotion) s += "=" + move.promotion.toUpperCase();
      san = s;
    }

    return {
      pos,
      san,
      capture,
      epCapture,
      castle: castleSide,
      promotion: move.promotion || null,
      from: move.from,
      to: move.to,
      uci: move.uci,
      piece,
    };
  }

  /**
   * Parse a FEN string into a position object (board+turn+castle+ep+half+full).
   * Throws a human-readable error if the FEN is malformed.
   */
  function fenToPosition(fenStr) {
    const raw = String(fenStr == null ? "" : fenStr).trim();
    if (!raw) throw new Error(T("FEN boş."));
    const parts = raw.split(/\s+/);
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error(T("FEN'de 8 sıra olmalı."));
    const board = new Array(64).fill("");
    for (let r = 0; r < 8; r++) {
      const rank = 7 - r; // FEN row 0 corresponds to rank 8
      let file = 0;
      for (let i = 0; i < rows[r].length; i++) {
        const ch = rows[r][i];
        if (ch >= "1" && ch <= "8") {
          file += parseInt(ch, 10);
        } else if (/[prnbqkPRNBQK]/.test(ch)) {
          if (file > 7) throw new Error(T("FEN sırası taşıyor: ") + rows[r]);
          board[rank * 8 + file] = ch;
          file++;
        } else {
          throw new Error(T("FEN'de geçersiz karakter: ") + ch);
        }
      }
      if (file !== 8)
        throw new Error(T("FEN sırasında 8 kare yok: ") + rows[r]);
    }
    const turn = parts[1] === "b" ? "b" : "w";
    const castle = parts[2] && /^[KQkq-]+$/.test(parts[2]) ? parts[2] : "-";
    const ep = parts[3] && /^([a-h][36]|-)$/.test(parts[3]) ? parts[3] : "-";
    const half = Math.max(0, parseInt(parts[4] || "0", 10) || 0);
    const full = Math.max(1, parseInt(parts[5] || "1", 10) || 1);
    return { board, turn, castle, ep, half, full };
  }

  function positionToFen(pos) {
    let rows = [];
    for (let r = 7; r >= 0; r--) {
      let row = "";
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = pos.board[r * 8 + f];
        if (!p) {
          empty++;
        } else {
          if (empty) {
            row += empty;
            empty = 0;
          }
          row += p;
        }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return (
      rows.join("/") +
      " " +
      pos.turn +
      " " +
      pos.castle +
      " " +
      pos.ep +
      " " +
      pos.half +
      " " +
      pos.full
    );
  }

  /**
   * Build the full review timeline from the decoded UCI moves: every ply's
   * position, FEN, SAN, last-move highlight squares.
   * Returns an array indexed by ply (0 = initial position, 1 = after move 1, …).
   */
  function buildTimeline(uciMoves, startPos) {
    const root = startPos ? clonePosition(startPos) : newPosition();
    const timeline = [
      {
        pos: root,
        fen: positionToFen(root),
        san: null,
        from: null,
        to: null,
        moveNo: 0,
        side: null,
      },
    ];
    let cur = timeline[0].pos;
    for (let i = 0; i < (uciMoves ? uciMoves.length : 0); i++) {
      const step = applyMove(cur, uciMoves[i]);
      cur = step.pos;
      timeline.push({
        pos: step.pos,
        fen: positionToFen(step.pos),
        san: step.san,
        from: step.from,
        to: step.to,
        capture: step.capture,
        promotion: step.promotion,
        castle: step.castle,
        moveNo: Math.floor(i / 2) + 1,
        side: i % 2 === 0 ? "w" : "b",
      });
    }
    return timeline;
  }

  // ─── SVG board renderer ──────────────────────────────────────────────
  // Pieces are rendered as PNG images from extension/pieces/. Filenames
  // follow the pattern <color><PieceLetter>.png — e.g. wK.png, bQ.png.
  // If a file is missing the cell falls back to the Unicode glyph so the
  // board stays usable while assets are still being produced.
  const UNICODE_PIECE = {
    K: "\u2654",
    Q: "\u2655",
    R: "\u2656",
    B: "\u2657",
    N: "\u2658",
    P: "\u2659",
    k: "\u265A",
    q: "\u265B",
    r: "\u265C",
    b: "\u265D",
    n: "\u265E",
    p: "\u265F",
  };

  function pieceImageURL(piece) {
    // piece is one of K Q R B N P k q r b n p
    const color = piece === piece.toUpperCase() ? "w" : "b";
    const letter = piece.toUpperCase();
    try {
      return chrome.runtime.getURL("pieces/" + color + letter + ".png");
    } catch (_) {
      return null;
    }
  }

  // Maps a narration category to a chess.com-style badge icon file name in
  // extension/analysis_icons/. `null` means "do not draw a badge for this
  // category" (used for routine moves so the board does not get noisy).
  const CATEGORY_ICON = {
    brilliant: "brilliant",
    great: "great",
    best: "best",
    good: "good",
    solid: "ok",
    inaccuracy: "dubious",
    mistake: "inaccuracy_dark",
    blunder: "blunder",
    mateThreat: "critical",
    book: "book",
  };

  function categoryIconURL(category) {
    const name = CATEGORY_ICON[category];
    if (!name) return null;
    try {
      return chrome.runtime.getURL("analysis_icons/" + name + ".png");
    } catch (_) {
      return null;
    }
  }

  function buildBoardSVG(
    step,
    flip,
    category,
    bestUci,
    prevFen,
    playerUci,
    endgame,
  ) {
    const size = 480;
    const cell = size / 8;
    const fromIdx = step.from ? sqToIdx(step.from) : -1;
    const toIdx = step.to ? sqToIdx(step.to) : -1;

    let svg =
      '<svg class="forksight-rb" viewBox="0 0 ' +
      size +
      " " +
      size +
      '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      T("Satranç tahtası") +
      '">';

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const idx = r * 8 + f;
        const dispRank = flip ? r : 7 - r;
        const dispFile = flip ? 7 - f : f;
        const x = dispFile * cell;
        const y = dispRank * cell;
        const light = (r + f) % 2 === 1;
        const baseColor = light ? "#f0d9b5" : "#b58863";
        const highlight = idx === fromIdx || idx === toIdx;
        const fill = highlight ? (light ? "#f5e98a" : "#c9b04a") : baseColor;
        svg +=
          '<rect x="' +
          x +
          '" y="' +
          y +
          '" width="' +
          cell +
          '" height="' +
          cell +
          '" fill="' +
          fill +
          '"/>';

        const piece = step.pos.board[idx];
        if (piece) {
          const imgUrl = pieceImageURL(piece);
          if (imgUrl) {
            // PNG image — slightly inset so the piece visually "sits"
            // inside the square (≈92% of cell, centered).
            const pad = cell * 0.04;
            svg +=
              '<image href="' +
              imgUrl +
              '" x="' +
              (x + pad) +
              '" y="' +
              (y + pad) +
              '" width="' +
              (cell - pad * 2) +
              '" height="' +
              (cell - pad * 2) +
              '" preserveAspectRatio="xMidYMid meet"/>';
          } else {
            // Fallback: Unicode glyph (used if chrome.runtime is not
            // available or the asset is missing).
            const ch = UNICODE_PIECE[piece];
            const isWhite = piece === piece.toUpperCase();
            svg +=
              '<text x="' +
              (x + cell / 2) +
              '" y="' +
              (y + cell * 0.72) +
              '" font-size="' +
              cell * 0.78 +
              '" text-anchor="middle" font-family="\'Segoe UI Symbol\',\'Noto Sans Symbols 2\',sans-serif"' +
              ' fill="' +
              (isWhite ? "#ffffff" : "#1a1a1a") +
              '"' +
              ' stroke="' +
              (isWhite ? "#1a1a1a" : "#ffffff") +
              '" stroke-width="1"' +
              ">" +
              ch +
              "</text>";
          }
        }

        // File label on bottom rank (always the BOARD file of this
        // column, regardless of orientation — so flipped boards show
        // h,g,…,a left-to-right correctly).
        if (dispRank === 7) {
          svg +=
            '<text x="' +
            (x + cell - 5) +
            '" y="' +
            (y + cell - 4) +
            '" font-size="11" text-anchor="end" font-family="sans-serif" fill="' +
            (light ? "#7a5a30" : "#f0d9b5") +
            '">' +
            "abcdefgh"[f] +
            "</text>";
        }
        // Rank label on leftmost file — uses the BOARD rank so flipped
        // boards show 1 at the top and 8 at the bottom.
        if (dispFile === 0) {
          svg +=
            '<text x="' +
            (x + 4) +
            '" y="' +
            (y + 13) +
            '" font-size="11" text-anchor="start" font-family="sans-serif" fill="' +
            (light ? "#7a5a30" : "#f0d9b5") +
            '">' +
            (r + 1) +
            "</text>";
        }
      }
    }

    // ── Move-quality badge ──────────────────────────────────────────────
    // Draw a chess.com-style category icon (brilliant / blunder / …) at
    // the top-right corner of the destination square so the user can
    // visually scan move quality without reading the narration.
    if (toIdx >= 0 && category) {
      const iconUrl = categoryIconURL(category);
      if (iconUrl) {
        const toRank = Math.floor(toIdx / 8);
        const toFile = toIdx % 8;
        const dispRankTo = flip ? 7 - toRank : toRank;
        const tx = (flip ? 7 - toFile : toFile) * cell;
        const ty = (7 - dispRankTo) * cell;
        const badge = cell * 0.55; // ~33 px when board is 480 px
        // Slight outward offset so the badge "pops" off the square.
        const bx = tx + cell - badge * 0.7;
        const by = ty - badge * 0.3;
        svg +=
          '<image href="' +
          iconUrl +
          '" x="' +
          bx +
          '" y="' +
          by +
          '" width="' +
          badge +
          '" height="' +
          badge +
          '" preserveAspectRatio="xMidYMid meet" style="pointer-events:none"/>';
      }
    }

    // ── Best-move arrow (chess.com-style) ──────────────────────────────
    // Drawn on top of the board only when the player's move actually
    // cost evaluation (inaccuracy / mistake / blunder). For best / great
    // / brilliant / good / solid moves the narration says "daha iyisi
    // yoktu" — drawing an arrow to a different (equally-good) line just
    // confuses the user.
    const ARROW_CATEGORIES = new Set(["inaccuracy", "mistake", "blunder"]);
    if (
      bestUci &&
      prevFen &&
      bestUci.length >= 4 &&
      ARROW_CATEGORIES.has(category) &&
      (!playerUci || bestUci.slice(0, 4) !== playerUci.slice(0, 4))
    ) {
      const src = bestUci.slice(0, 2);
      const dst = bestUci.slice(2, 4);
      const a = _sqCenterXY(src, flip, cell);
      const b = _sqCenterXY(dst, flip, cell);
      if (a && b) {
        const piece = _pieceAtSquare(prevFen, src);
        const isKnight = piece && piece.toLowerCase() === "n";
        const df = Math.abs(src.charCodeAt(0) - dst.charCodeAt(0));
        const dr = Math.abs(parseInt(src[1], 10) - parseInt(dst[1], 10));
        const knightL =
          isKnight && ((df === 1 && dr === 2) || (df === 2 && dr === 1));

        // L-shaped path for knights, straight line otherwise.
        const pts = [a];
        let lastA = a;
        if (knightL) {
          // Turn at the corner of the longer leg first — matches
          // chess.com's knight-arrow convention.
          const midSq = df > dr ? dst[0] + src[1] : src[0] + dst[1];
          const mid = _sqCenterXY(midSq, flip, cell);
          if (mid) {
            pts.push(mid);
            lastA = mid;
          }
        }

        // Geometry of the last leg → shaft truncation + arrowhead.
        const headLen = cell * 0.36;
        const headW = cell * 0.46;
        const shaftW = cell * 0.22;
        const dx = b.x - lastA.x;
        const dy = b.y - lastA.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        // Stop the shaft a hair before the tip so the polygon overlaps
        // cleanly with no visible seam at any zoom level.
        const shaftEnd = {
          x: b.x - ux * headLen * 0.55,
          y: b.y - uy * headLen * 0.55,
        };
        pts.push(shaftEnd);
        const tipX = b.x;
        const tipY = b.y;
        const perpX = -uy;
        const perpY = ux;
        const baseX = tipX - ux * headLen;
        const baseY = tipY - uy * headLen;
        const t1x = baseX + perpX * (headW / 2);
        const t1y = baseY + perpY * (headW / 2);
        const t2x = baseX - perpX * (headW / 2);
        const t2y = baseY - perpY * (headW / 2);

        const d = pts
          .map(
            (p, i) =>
              (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1),
          )
          .join(" ");

        const FILL = "rgba(155, 199, 0, 0.86)";
        // Drop shadow + slight inner stroke gives the chess.com "soft"
        // feel without needing a heavy <filter> chain.
        svg +=
          "<defs>" +
          '<filter id="forksight-arrow-shadow" x="-20%" y="-20%" width="140%" height="140%">' +
          '<feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>' +
          '<feOffset dx="0" dy="1.2" result="off"/>' +
          '<feComponentTransfer><feFuncA type="linear" slope="0.55"/></feComponentTransfer>' +
          '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>' +
          "</filter>" +
          "</defs>" +
          '<g class="forksight-rb-arrow" filter="url(#forksight-arrow-shadow)" style="pointer-events:none">' +
          '<path d="' +
          d +
          '" stroke="' +
          FILL +
          '" stroke-width="' +
          shaftW +
          '" fill="none" stroke-linecap="butt" stroke-linejoin="round"/>' +
          '<polygon points="' +
          tipX.toFixed(1) +
          "," +
          tipY.toFixed(1) +
          " " +
          t1x.toFixed(1) +
          "," +
          t1y.toFixed(1) +
          " " +
          t2x.toFixed(1) +
          "," +
          t2y.toFixed(1) +
          '" fill="' +
          FILL +
          '"/>' +
          "</g>";
      }
    }

    // ── Endgame badges ─────────────────────────────────────────────────
    // When the final position is on the board, drop a chess.com-style
    // popup icon on each king square: a trophy/crown on the winner, a
    // flag (mate/resign) or clock (timeout) on the loser. Draws get a
    // neutral handshake on both kings.
    if (endgame && endgame.winner !== undefined) {
      const badges = [];
      const sizeRatio = 0.72; // badge takes ~72% of the cell
      const offsetRatio = 0.28; // shift toward upper-right corner
      const pushBadge = (sq, icon) => {
        if (!sq || !icon) return;
        const center = _sqCenterXY(sq, flip, cell);
        const size = cell * sizeRatio;
        const x = center.x - size / 2 + cell * offsetRatio;
        const y = center.y - size / 2 - cell * offsetRatio;
        const url = `${chrome.runtime.getURL("analysis_icons/" + icon)}`;
        badges.push(
          '<image class="forksight-rb-endbadge" href="' +
            url +
            '" x="' +
            x.toFixed(1) +
            '" y="' +
            y.toFixed(1) +
            '" width="' +
            size.toFixed(1) +
            '" height="' +
            size.toFixed(1) +
            '" preserveAspectRatio="xMidYMid meet" style="pointer-events:none"/>',
        );
      };
      const winKingSq =
        endgame.winner === "w"
          ? endgame.whiteKingSq
          : endgame.winner === "b"
            ? endgame.blackKingSq
            : null;
      const loseKingSq =
        endgame.winner === "w"
          ? endgame.blackKingSq
          : endgame.winner === "b"
            ? endgame.whiteKingSq
            : null;
      if (endgame.lossType === "draw") {
        pushBadge(endgame.whiteKingSq, "draw_dark.png");
        pushBadge(endgame.blackKingSq, "draw_dark.png");
      } else if (winKingSq && loseKingSq) {
        pushBadge(winKingSq, "winning.png");
        const loserIcon =
          endgame.lossType === "time" ? "time_dark.png" : "flag_dark.png";
        pushBadge(loseKingSq, loserIcon);
      }
      if (badges.length) svg += badges.join("");
    }

    svg += "</svg>";
    return svg;
  }

  // ─── Rule-based narration ────────────────────────────────────────────
  // Given the eval transition between two plies (from the perspective of the
  // player who *just* moved), classify the move quality and pick a sentence
  // template. We never tell the user which move was best — only how their
  // current choice compared.
  //
  // Categories drive both the text AND the avatar emotion swap.
  // IMPORTANT: every `emotion` here must match an existing PNG in
  // extension/avatars/. Available files (May 2026): gameOver, happy,
  // losing, mistake, neutral, opportunity, thinking, winning, worried.
  // Referencing anything else (e.g. "confident", "confused") produces a
  // 404 and the avatar bubble shows a broken image.
  const NARRATION_CATEGORIES = {
    blunder: {
      emotion: "mistake",
      lines: {
        self: [
          "Tüh, burası ağır bir hata.",
          "Bu hamle pozisyonu ciddi şekilde bozdu.",
          "Burada büyük bir fırsat kaçırdın — değerlendirme keskin düştü.",
        ],
        opp: [
          "Rakibin burada ağır bir hata yaptı — değerlendirme senin lehine döndü.",
          "Bu rakibin için büyük bir gaf; avantajı sana hediye etti.",
          "Rakibinden affedilmez bir hamle geldi.",
        ],
        neutral: [
          "Ciddi bir hata — pozisyon belirgin biçimde bozuldu.",
          "Büyük bir gaf; değerlendirme keskin düştü.",
          "Affedilmez bir kayıp; çok daha güçlü bir seçenek vardı.",
        ],
      },
    },
    mistake: {
      emotion: "worried",
      lines: {
        self: [
          "Burada bir hata var.",
          "Bu hamle değerlendirmeni düşürdü.",
          "Daha keskin bir hamle vardı.",
        ],
        opp: [
          "Rakibinden zayıf bir hamle — değerlendirme sana döndü.",
          "Rakibin burada bir hata yaptı.",
          "Rakibin daha sağlam bir seçeneği kaçırdı.",
        ],
        neutral: [
          "Hata; pozisyon kötüleşti.",
          "Daha iyisi mümkündü.",
          "İdeal değil; daha sağlam bir seçenek vardı.",
        ],
      },
    },
    inaccuracy: {
      emotion: "neutral",
      lines: {
        self: [
          "Küçük bir yanlışlık — büyük zarar yok ama daha keskini vardı.",
          "Hafif konum kaybı; pozisyon hâlâ oynanabilir.",
          "Ufak bir kayma; pozisyonu hâlâ kontrol edebilirsin.",
        ],
        opp: [
          "Rakibinden ufak bir yanlışlık — sana küçük bir fırsat doğdu.",
          "Rakibin hafif bir konum kaybetti.",
          "Rakibin tam isabeti bulamadı.",
        ],
        neutral: [
          "Küçük bir yanlışlık — büyük zarar yok.",
          "Hafif konum kaybı; pozisyon hâlâ oynanabilir.",
          "İdeal değil ama dengeyi bozmadı.",
        ],
      },
    },
    solid: {
      emotion: "neutral",
      lines: {
        self: [
          "Sağlam, makul bir hamle.",
          "Pozisyonu koruyan iyi bir tercih.",
          "Dengeyi sürdüren bir hamle.",
        ],
        opp: [
          "Rakibinden sağlam bir hamle.",
          "Rakibin pozisyonunu koruyan makul bir tercih.",
          "Rakibin dengeyi sürdürüyor.",
        ],
        neutral: [
          "Sağlam, makul bir hamle.",
          "Pozisyonu koruyan bir tercih.",
          "Dengeyi sürdüren bir hamle.",
        ],
      },
    },
    best: {
      emotion: "neutral",
      lines: {
        self: [
          "En iyi hamle — motorla aynı seçimi yaptın.",
          "Tam isabet; bundan daha iyisi yoktu.",
          "Doğru tercih, pozisyonu en iyi şekilde sürdürdün.",
        ],
        opp: [
          "Rakibin en iyi hamleyi buldu — motorla aynı seçim.",
          "Rakibinden tam isabet; bundan daha iyisi yoktu.",
          "Rakibin doğru tercihi yaptı, pozisyonunu en iyi şekilde sürdürdü.",
        ],
        neutral: [
          "En iyi hamle — motorla aynı seçim.",
          "Tam isabet; bundan daha iyisi yoktu.",
          "Doğru tercih, pozisyonu en iyi şekilde sürdürüyor.",
        ],
      },
    },
    good: {
      emotion: "winning",
      lines: {
        self: [
          "Güzel hamle — değerlendirme lehine döndü.",
          "İyi seçim; küçük bir avantaj kazandın.",
          "Etkili bir hamle; pozisyonun biraz daha rahatladı.",
        ],
        opp: [
          "Rakibinden güzel bir hamle — değerlendirme onun lehine döndü.",
          "Rakibin iyi seçim yaptı; küçük bir avantaj kazandı.",
          "Etkili bir hamle; rakibinin pozisyonu biraz daha rahatladı.",
        ],
        neutral: [
          "Güzel hamle — değerlendirme lehine döndü.",
          "İyi seçim; küçük bir avantaj kazanıldı.",
          "Etkili bir hamle; pozisyon biraz daha rahatladı.",
        ],
      },
    },
    great: {
      emotion: "winning",
      lines: {
        self: [
          "Çok iyi bir hamle — pozisyon belirgin biçimde lehine döndü.",
          "Harika seçim, rakibine ciddi sorun çıkardın.",
          "Güçlü bir tercih; avantajın gözle görülür şekilde büyüdü.",
        ],
        opp: [
          "Rakibinden çok iyi bir hamle — pozisyon onun lehine döndü.",
          "Rakibin harika bir seçim yaptı; sana ciddi sorun çıkardı.",
          "Rakibinden güçlü bir tercih; avantajı gözle görülür şekilde büyüdü.",
        ],
        neutral: [
          "Çok iyi bir hamle — pozisyon belirgin biçimde döndü.",
          "Harika seçim; rakibe ciddi sorun çıkardı.",
          "Güçlü bir tercih; avantaj gözle görülür şekilde büyüdü.",
        ],
      },
    },
    brilliant: {
      emotion: "happy",
      lines: {
        self: [
          "Mükemmel! Değerlendirme net biçimde lehine döndü.",
          "Çok güçlü bir hamle yaptın — pozisyon büyük ölçüde kazanıyor.",
          "Harika tercih; rakibine ciddi sorun bıraktın.",
        ],
        opp: [
          "Rakibin mükemmel oynadı — değerlendirme onun lehine net biçimde döndü.",
          "Rakibinden çok güçlü bir hamle; pozisyon onun için büyük ölçüde kazanıyor.",
          "Rakibinin harika bir tercihi; sana ciddi bir sorun bıraktı.",
        ],
        neutral: [
          "Mükemmel! Değerlendirme net biçimde döndü.",
          "Çok güçlü bir hamle — pozisyon büyük ölçüde kazançlı.",
          "Harika tercih; rakibe ciddi bir sorun bıraktı.",
        ],
      },
    },
    mateThreat: {
      emotion: "opportunity",
      lines: {
        self: [
          "Şah-mat tehdidi belirdi — fırsatı kollamalısın.",
          "Burada mat ufukta; dikkatli oyna.",
        ],
        opp: [
          "Rakibin mat tehdidi kuruyor — dikkatli olmalısın!",
          "Rakibin mat hattını arıyor; uyanık ol.",
        ],
        neutral: ["Şah-mat tehdidi belirdi.", "Burada mat ufukta — dikkat!"],
      },
    },
    book: {
      emotion: "neutral",
      lines: {
        self: [
          "Açılış teorisi — bilinen hatlardan birini oynadın.",
          "Bilindik bir açılış hamlesi.",
        ],
        opp: [
          "Rakibin açılış teorisinden oynadı — bilinen bir hat.",
          "Bilindik bir açılış hamlesi rakibinden.",
        ],
        neutral: [
          "Açılış teorisi — bilinen hatlardan biri.",
          "Bilindik bir açılış hamlesi.",
        ],
      },
    },
  };

  // İngilizce paralel anlatım sözlüğü. NARRATION_CATEGORIES ile aynı şema.
  // Dil seçimi `window.ForkSightI18n.getLang()` ile çalışma zamanında yapılır.
  const NARRATION_CATEGORIES_EN = {
    blunder: {
      emotion: "mistake",
      lines: {
        self: [
          "That was a serious mistake — your position took a clear hit.",
          "You blundered; the evaluation dropped sharply.",
          "Unforgiveable loss here; a much stronger option was available.",
        ],
        opp: [
          "Your opponent blundered — their position is clearly worse now.",
          "A blunder from your opponent; the evaluation swung sharply in your favor.",
          "An unforgiveable loss for your opponent — the advantage is yours.",
        ],
        neutral: [
          "A serious mistake — the position deteriorated clearly.",
          "A blunder; the evaluation dropped sharply.",
          "An unforgiveable loss; a much stronger option was available.",
        ],
      },
    },
    mistake: {
      emotion: "worried",
      lines: {
        self: [
          "You made a mistake; your position got worse.",
          "Better was possible — this move lowered your evaluation.",
          "Not ideal; a more solid option was on the table.",
        ],
        opp: [
          "Your opponent made a mistake; their position got worse.",
          "A weak move from your opponent — the evaluation swung your way.",
          "Not ideal for your opponent; they had a more solid option.",
        ],
        neutral: [
          "A mistake; the position deteriorated.",
          "Better was possible — this move lowered the evaluation.",
          "Not ideal; a more solid option was available.",
        ],
      },
    },
    inaccuracy: {
      emotion: "neutral",
      lines: {
        self: [
          "A small inaccuracy — no big damage, but something sharper was there.",
          "A slight loss of ground; the position is still playable.",
          "Not ideal but you didn't disturb the balance.",
        ],
        opp: [
          "A small inaccuracy from your opponent — no big damage, but a tiny chance opened up for you.",
          "Your opponent lost a bit of ground; the position is still roughly balanced.",
          "Your opponent's move wasn't ideal but didn't disturb the balance.",
        ],
        neutral: [
          "A small inaccuracy — no big damage.",
          "A slight loss of ground; the position is still playable.",
          "Not ideal but balance was preserved.",
        ],
      },
    },
    solid: {
      emotion: "neutral",
      lines: {
        self: [
          "A solid, reasonable move.",
          "A good choice that holds the position.",
          "A move that keeps the balance.",
        ],
        opp: [
          "A solid move from your opponent.",
          "A reasonable choice that keeps your opponent's position together.",
          "Your opponent holds the balance.",
        ],
        neutral: [
          "A solid, reasonable move.",
          "A choice that holds the position.",
          "A move that keeps the balance.",
        ],
      },
    },
    best: {
      emotion: "neutral",
      lines: {
        self: [
          "Best move — you matched the engine's choice.",
          "Spot on; nothing was better.",
          "Right call — you handled the position optimally.",
        ],
        opp: [
          "Your opponent found the best move — same as the engine.",
          "Spot on from your opponent; nothing was better.",
          "Your opponent made the right call and handled the position optimally.",
        ],
        neutral: [
          "Best move — same as the engine.",
          "Spot on; nothing was better.",
          "The right call; the position is held optimally.",
        ],
      },
    },
    good: {
      emotion: "winning",
      lines: {
        self: [
          "Nice move — the evaluation swung your way.",
          "Good choice; you picked up a small edge.",
          "Effective move; your position eased up a bit.",
        ],
        opp: [
          "Nice move from your opponent — the evaluation swung their way.",
          "Your opponent picked a good move; they got a small edge.",
          "An effective move; your opponent's position eased up a bit.",
        ],
        neutral: [
          "Nice move — the evaluation shifted.",
          "Good choice; a small edge was gained.",
          "An effective move; the position eased up.",
        ],
      },
    },
    great: {
      emotion: "winning",
      lines: {
        self: [
          "Excellent move — the position clearly swung your way.",
          "Great choice — you handed your opponent serious problems.",
          "A strong call; your advantage grew visibly.",
        ],
        opp: [
          "An excellent move from your opponent — the position swung their way.",
          "A great choice from your opponent; they handed you serious problems.",
          "A strong call from your opponent; their advantage grew visibly.",
        ],
        neutral: [
          "An excellent move — the position clearly turned.",
          "A great choice; serious problems for the opponent.",
          "A strong call; the advantage grew visibly.",
        ],
      },
    },
    brilliant: {
      emotion: "happy",
      lines: {
        self: [
          "Brilliant! The evaluation clearly swung your way.",
          "A very strong move — the position is largely winning.",
          "A great choice; you've left your opponent in serious trouble.",
        ],
        opp: [
          "Your opponent played brilliantly — the evaluation clearly swung their way.",
          "A very strong move from your opponent; the position is largely winning for them.",
          "A great choice from your opponent; they've left you in serious trouble.",
        ],
        neutral: [
          "Brilliant! The evaluation clearly turned.",
          "A very strong move — the position is largely winning.",
          "A great choice; serious trouble for the other side.",
        ],
      },
    },
    mateThreat: {
      emotion: "opportunity",
      lines: {
        self: [
          "A mate threat appeared — watch for the chance.",
          "Mate is on the horizon here; play carefully.",
        ],
        opp: [
          "Your opponent is building a mate threat — be careful!",
          "Your opponent is looking for a mating line; stay alert.",
        ],
        neutral: [
          "A mate threat appeared.",
          "Mate is on the horizon — careful!",
        ],
      },
    },
    book: {
      emotion: "neutral",
      lines: {
        self: [
          "Opening theory — you played one of the known lines.",
          "A well-known opening move.",
        ],
        opp: [
          "Your opponent played opening theory — a known line.",
          "A well-known opening move from your opponent.",
        ],
        neutral: [
          "Opening theory — one of the known lines.",
          "A well-known opening move.",
        ],
      },
    },
  };

  function _activeNarration() {
    const lang = window.ForkSightI18n ? window.ForkSightI18n.getLang() : "en";
    return lang === "tr" ? NARRATION_CATEGORIES : NARRATION_CATEGORIES_EN;
  }

  /**
   * Convert a pawn-unit eval into a 0..100 win probability for the side
   * whose perspective the eval is in. Uses the standard logistic curve
   * (k≈0.4) that Lichess/chess.com-style reviews use. Mates collapse to
   * the asymptote so any mate-in-N counts as ~100%/0%.
   */
  function winProb(evalPawns) {
    if (typeof evalPawns !== "number" || !isFinite(evalPawns)) return 50;
    if (evalPawns >= 25) return 100;
    if (evalPawns <= -25) return 0;
    return 50 + 50 * (2 / (1 + Math.exp(-0.4 * evalPawns)) - 1);
  }

  /**
   * Convert a pawn-unit eval into a 0..100 win probability for the side
   * whose perspective the eval is in. Uses the standard logistic curve
   * (k≈0.4) that Lichess/chess.com-style reviews use. Mates collapse to
   * the asymptote so any mate-in-N counts as ~100%/0%.
   */
  function winProb(evalPawns) {
    if (typeof evalPawns !== "number" || !isFinite(evalPawns)) return 50;
    if (evalPawns >= 25) return 100;
    if (evalPawns <= -25) return 0;
    return 50 + 50 * (2 / (1 + Math.exp(-0.4 * evalPawns)) - 1);
  }

  /**
   * Categorize a ply using win-probability loss (Δwp) from the mover's
   * perspective. This is far more meaningful than a raw pawn delta:
   *  - In a totally won position (+9), dropping to +7 barely changes wp,
   *    so it's not a "blunder".
   *  - Around equality, a 0.4 pawn swing is a real inaccuracy because wp
   *    moves by ~5 points there.
   *
   * Inputs are pawn-unit evals from the MOVER's perspective at ply-1
   * (before the move) and ply (after the move). We compute the wp loss
   * (positive = mover lost wp) and bucket it.
   *
   * Positive improvements (negative loss) get "great" / "brilliant" only
   * when the mover meaningfully improved an unclear position — pure noise
   * around equality stays in the "best" bucket.
   */
  function categorize(prevEvalMover, curEvalMover, ply) {
    if (ply <= 6) return "book";
    if (typeof prevEvalMover !== "number" || typeof curEvalMover !== "number") {
      // Eval missing for this ply (backend hiccup / unauthenticated /
      // rate-limited). Return null so no badge is drawn — better to show
      // a visible gap than to mislead the user with a fake "solid" tick
      // on every move (which is what happens if the analyze endpoint
      // silently 403s, see analyzeFen mode handling).
      return null;
    }
    const wpBefore = winProb(prevEvalMover);
    const wpAfter = winProb(curEvalMover);
    const loss = wpBefore - wpAfter; // >0 means mover lost win-prob

    // Mover got worse → quality drop. Eşikler chess.com'unkilere
    // yaklaştırıldı — bizim eski 5/10/20 değerlerimiz çok cömertti ve
    // sıradan hatalar "best" olarak işaretleniyor, dolayısıyla doğruluk
    // skorları gerçek-dışı yüksek çıkıyordu.
    if (loss >= 15) return "blunder";
    if (loss >= 7) return "mistake";
    if (loss >= 3) return "inaccuracy";

    // Mover improved (engine under-rated their move) → reward.
    // Require the improvement to be material AND the position not already
    // overwhelmingly winning, otherwise small noise reads as "brilliant".
    // Eşikler -7/-15 → -12/-22'ye sıkılaştırıldı (great/brilliant
    // gerçekten zor-bulunan hamleleri yansıtsın).
    if (loss <= -22 && Math.abs(curEvalMover) < 8) return "brilliant";
    if (loss <= -12 && Math.abs(curEvalMover) < 8) return "great";

    // Quiet, near-engine move. "best" sadece gerçekten engine'e yakın
    // hamlelerde; aksi halde "good" (Mükemmel).
    if (Math.abs(loss) < 0.8) return "best";
    return "good";
  }

  function pickLine(category, perspective) {
    const N = _activeNarration();
    const c = N[category] || N.solid;
    const p =
      perspective === "self" || perspective === "opp" ? perspective : "neutral";
    const arr = (c.lines && c.lines[p]) || (c.lines && c.lines.neutral) || [];
    return {
      text: arr[Math.floor(Math.random() * arr.length)] || "",
      emotion: c.emotion,
    };
  }

  // ─── Material + contextual hint helpers ──────────────────────────────
  const _PIECE_VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function materialFromFen(fen) {
    if (!fen) return { w: 0, b: 0, diff: 0 };
    const board = fen.split(" ")[0] || "";
    let w = 0,
      b = 0;
    for (let i = 0; i < board.length; i++) {
      const c = board[i];
      const lc = c.toLowerCase();
      const v = _PIECE_VAL[lc];
      if (v == null) continue;
      if (c === lc) b += v;
      else w += v;
    }
    return { w, b, diff: w - b };
  }

  /**
   * Heuristic, position-derived "human" hint that augments the rule-based
   * category line. We can't ask the engine for the best move from the
   * cached eval-only data, so we infer from SAN + FEN diff:
   *   - capture detection via "x" in SAN
   *   - material delta from FEN (mover-relative)
   *   - eval drop without capture → likely hung a piece
   *   - opponent's previous blunder you didn't punish → missed a capture
   */
  function contextualHint(
    prevStep,
    curStep,
    prevEvalWhite,
    curEvalWhite,
    perspective,
  ) {
    if (!curStep || !prevStep) return "";
    const san = curStep.san || "";
    const moverSign = curStep.side === "w" ? +1 : -1;
    const prevMat = materialFromFen(prevStep.fen);
    const curMat = materialFromFen(curStep.fen);
    // Material gained by mover (positive = mover captured more than lost).
    const matGain = (curMat.diff - prevMat.diff) * moverSign;
    const isCapture = /x/.test(san);

    const self = perspective === "self";
    const opp = perspective === "opp";
    const isEN =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";

    // Trade / capture commentary.
    if (isCapture) {
      if (matGain >= 2) {
        if (isEN) {
          if (self) return "You won material with this move.";
          if (opp) return "Your opponent won material with this move.";
          return "Material was won on this move.";
        }
        if (self) return "Bu hamleyle malzeme kazandın.";
        if (opp) return "Rakibin bu hamleyle malzeme kazandı.";
        return "Bu hamleyle malzeme kazanıldı.";
      }
      if (matGain <= -2) {
        if (isEN) {
          if (self) return "An unequal trade — you gave up material.";
          if (opp) return "A losing trade for your opponent.";
          return "A losing trade.";
        }
        if (self) return "Eşit olmayan bir değişim — malzeme verdin.";
        if (opp) return "Rakibin için kayıplı bir değişim oldu.";
        return "Kayıplı bir değişim.";
      }
      // matGain === 0 → equal trade
      if (isEN) {
        if (self) return "A sensible, equal trade.";
        if (opp) return "Your opponent made an equal trade.";
        return "A sensible, equal trade.";
      }
      if (self) return "Mantıklı, denk bir taş değişimi yaptın.";
      if (opp) return "Rakibin denk bir taş değişimi yaptı.";
      return "Mantıklı, denk bir taş değişimi.";
    }

    // No capture but big eval drop for the mover → likely hung a piece.
    if (typeof prevEvalWhite === "number" && typeof curEvalWhite === "number") {
      const evalGainMover = (curEvalWhite - prevEvalWhite) * moverSign;
      if (evalGainMover <= -2.5) {
        if (isEN) {
          if (self) return "After this move you left a piece hanging.";
          if (opp) return "After this move your opponent left a piece hanging.";
          return "A piece was left undefended after this move.";
        }
        if (self) return "Bu hamleden sonra bir taşını boşta bıraktın.";
        if (opp) return "Rakibin bu hamleden sonra bir taşını boşta bıraktı.";
        return "Bu hamleden sonra bir taş savunmasız kaldı.";
      }
      // Mover's eval got much better without capture → quiet improvement
      if (evalGainMover >= 2.5) {
        if (isEN) {
          if (self)
            return "You found a line that exploited your opponent's weakness.";
          if (opp) return "Your opponent found a line where you stayed weak.";
          return "A line exploiting a weakness was found.";
        }
        if (self) return "Rakibinin zayıf kaldığı bir hat buldun.";
        if (opp) return "Rakibin zayıf kaldığın bir hat buldu.";
        return "Pozisyondaki zayıf bir hat keşfedildi.";
      }
    }

    return "";
  }

  // ─── Engine best-move hint (chess.com-style) ─────────────────────────
  // Given the position BEFORE the mover played, plus the engine's preferred
  // UCI move, returns a Turkish phrase like:
  //   "Daha iyisi vardı: At f3'e"
  //   "Daha iyisi vardı: rakibinin f6'daki atını alabilirdin"
  // Skipped when the player already chose the engine's move.
  const _PIECE_TR = {
    p: "piyon",
    n: "at",
    b: "fil",
    r: "kale",
    q: "vezir",
    k: "şah",
  };
  const _PIECE_TR_CAP = {
    p: "Piyon",
    n: "At",
    b: "Fil",
    r: "Kale",
    q: "Vezir",
    k: "Şah",
  };
  // Convert a UCI move ("g1f3", "e7e8q", "e1g1") to SAN-style notation
  // ("Nf3", "e8=Q", "O-O") using only the FEN before the move. Heuristic
  // (no disambiguation when two same-type pieces can reach the same
  // square — engine top moves rarely need it, and the worst case is just
  // "Nf3" vs "Ngf3" which still reads fine).
  function _uciToSan(prevFen, uci) {
    if (!prevFen || !uci || uci.length < 4) return uci || "";
    const src = uci.slice(0, 2);
    const dst = uci.slice(2, 4);
    const promo = uci.slice(4, 5);
    const piece = _pieceAtSquare(prevFen, src);
    if (!piece) return uci;
    const target = _pieceAtSquare(prevFen, dst);
    const pl = piece.toLowerCase();
    // Castling: king moves 2 files
    if (pl === "k" && Math.abs(src.charCodeAt(0) - dst.charCodeAt(0)) === 2) {
      return dst.charCodeAt(0) > src.charCodeAt(0) ? "O-O" : "O-O-O";
    }
    const capMark = target ? "x" : "";
    if (pl === "p") {
      // En passant: pawn captures into an empty square. Treat as capture.
      const isEpish = !target && src[0] !== dst[0];
      const cap = target || isEpish ? "x" : "";
      const base = cap ? src[0] + cap + dst : dst;
      return promo ? base + "=" + promo.toUpperCase() : base;
    }
    return piece.toUpperCase() + capMark + dst;
  }

  // Square name → SVG pixel center, accounting for board flip. Used by
  // both the best-move arrow and any future board overlays.
  function _sqCenterXY(sq, flip, cell) {
    if (!sq || sq.length !== 2) return null;
    const fileIdx = sq.charCodeAt(0) - 97;
    const rankNum = parseInt(sq[1], 10);
    if (fileIdx < 0 || fileIdx > 7 || rankNum < 1 || rankNum > 8) return null;
    const rankIdx = rankNum - 1; // 1→0, 8→7
    const dispRank = flip ? rankIdx : 7 - rankIdx;
    const dispFile = flip ? 7 - fileIdx : fileIdx;
    return { x: dispFile * cell + cell / 2, y: dispRank * cell + cell / 2 };
  }
  function _pieceAtSquare(fen, sq) {
    if (!fen || !sq || sq.length !== 2) return null;
    const board = String(fen).split(" ")[0] || "";
    const ranks = board.split("/");
    if (ranks.length !== 8) return null;
    const fileIdx = sq.charCodeAt(0) - 97; // 'a' → 0
    const rankNum = parseInt(sq[1], 10);
    if (fileIdx < 0 || fileIdx > 7 || rankNum < 1 || rankNum > 8) return null;
    const rankIdx = 8 - rankNum; // FEN ranks listed 8..1
    let f = 0;
    for (const c of ranks[rankIdx]) {
      if (/\d/.test(c)) {
        f += parseInt(c, 10);
      } else {
        if (f === fileIdx) return c;
        f++;
      }
      if (f > 7) break;
    }
    return null;
  }
  // Locate the white & black kings in a board array (idx 0 = a8 … 63 = h1
  // per buildTimeline's convention). Returns square names (e.g. "g1").
  function _findKings(board) {
    let w = null;
    let b = null;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p) continue;
      if (p === "K" || p === "k") {
        const r = i >> 3; // 0 = rank 1 … 7 = rank 8
        const f = i & 7;
        const sq = String.fromCharCode(97 + f) + (r + 1);
        if (p === "K") w = sq;
        else b = sq;
      }
    }
    return { w, b };
  }
  // Inspect PGN headers + chess.com game payload to figure out who won
  // and how. Used by the final-ply endgame badge overlay.
  function computeEndgame(headers, game, timeline) {
    if (!timeline || !timeline.length) return null;
    const last = timeline[timeline.length - 1];
    if (!last || !last.pos) return null;
    let winner = null;
    if (game && game.colorOfWinner === "white") winner = "w";
    else if (game && game.colorOfWinner === "black") winner = "b";
    else if (headers && headers.Result === "1-0") winner = "w";
    else if (headers && headers.Result === "0-1") winner = "b";
    // Draw signals.
    const isDraw =
      !winner &&
      ((headers && headers.Result === "1/2-1/2") ||
        (game && game.colorOfWinner === null));

    const txt = String(
      (game && game.resultMessage) || (headers && headers.Termination) || "",
    ).toLowerCase();
    let lossType = "other";
    if (/checkmate|şahmat|mat\b/.test(txt)) lossType = "mate";
    else if (/time|timeout|süre|zaman/.test(txt)) lossType = "time";
    else if (/resign|abandon|terk/.test(txt)) lossType = "resign";
    else if (
      isDraw ||
      /draw|stalemate|repetition|insufficient|berabere|pat/.test(txt)
    )
      lossType = "draw";

    const kings = _findKings(last.pos.board);
    return {
      winner, // 'w' | 'b' | null
      lossType, // 'mate' | 'time' | 'resign' | 'draw' | 'other'
      whiteKingSq: kings.w,
      blackKingSq: kings.b,
      finalPly: timeline.length - 1,
    };
  }
  // Turkish dative suffix for a square name (vowel harmony, last vowel only).
  function _datifySquare(sq) {
    // square names end in a digit; the file letter doesn't matter for harmony.
    // We pronounce squares by file+rank — last sound is the digit.
    const last = sq[sq.length - 1];
    // Front/back vowel mapping by Turkish numerals:
    //   1 (bir)→e, 2 (iki)→ye, 3 (üç)→e, 4 (dört)→e, 5 (beş)→e,
    //   6 (altı)→ya, 7 (yedi)→ye, 8 (sekiz)→e
    const map = {
      1: "'e",
      2: "'ye",
      3: "'e",
      4: "'e",
      5: "'e",
      6: "'ya",
      7: "'ye",
      8: "'e",
    };
    return sq + (map[last] || "'e");
  }
  function _datifyPiece(name) {
    // "at" → "atını", "fil" → "filini", "vezir" → "vezirini", "kale" → "kalesini",
    // "şah" → "şahını", "piyon" → "piyonunu"
    const map = {
      at: "atını",
      fil: "filini",
      kale: "kalesini",
      vezir: "vezirini",
      şah: "şahını",
      piyon: "piyonunu",
    };
    return map[name] || name + "ını";
  }
  // Taş adının İngilizce karşılığı (best-move ipuçları için).
  const _PIECE_EN = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  };
  const _PIECE_EN_CAP = {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King",
  };

  // ─── Attack detection + Static Exchange Evaluation (SEE-lite) ────────
  // Used by bestMoveHint / mistakeWhy to distinguish a *free* capture
  // ("bedavadan bir vezir kazanırdın") from an even trade ("vezir takası
  // olurdu"). Without this, a Qxd8 where the king can recapture would
  // still be advertised as a free queen — exactly the bug the user hit.
  //
  // Limitations (acceptable trade-off vs. shipping a full chess engine):
  //   - No X-ray / battery handling (a rook behind a queen on the same
  //     file is missed once the queen captures and clears the line).
  //   - Pinned attackers are treated as fully mobile (in rare cases this
  //     overstates the defenders).
  // For the "free vs trade" classification we only need, simple SEE on a
  // sorted attacker list gives the right answer in the vast majority of
  // positions the player will see.
  // NOTE: _KNIGHT_DELTAS and _KING_DELTAS are already declared earlier
  // in this IIFE (around line 143) for the legality checker — reuse them
  // here instead of redeclaring (which would throw a SyntaxError and
  // break the entire module, leaving window.ForkSightReview undefined).
  const _ROOK_DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const _BISHOP_DIRS = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];

  // Parse the board part of a FEN into a 8x8 array indexed [rank][file]
  // where rank 0 = rank 1 (white's back rank) and file 0 = a.
  function _fenToBoard(fen) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const ranks = String(fen || "")
      .split(" ")[0]
      .split("/");
    if (ranks.length !== 8) return board;
    for (let r = 0; r < 8; r++) {
      let f = 0;
      for (const c of ranks[r]) {
        if (/\d/.test(c)) {
          f += parseInt(c, 10);
        } else {
          if (f < 8) board[7 - r][f] = c;
          f++;
        }
      }
    }
    return board;
  }

  function _sqToRF(sq) {
    return { f: sq.charCodeAt(0) - 97, r: parseInt(sq[1], 10) - 1 };
  }

  // Returns piece *values* of every `byColor` piece that attacks `sq`.
  // Sorted ascending so SEE can grab the cheapest defender first.
  function _attackerValuesOf(board, sq, byColor) {
    const { f: tf, r: tr } = _sqToRF(sq);
    if (tf < 0 || tf > 7 || tr < 0 || tr > 7) return [];
    const wantWhite = byColor === "w";
    const out = [];
    const consider = (p, val) => {
      if (!p) return false;
      const isWhite = p === p.toUpperCase();
      if (isWhite !== wantWhite) return false;
      out.push(val);
      return true;
    };

    // Pawns — attack diagonally forward from byColor's perspective.
    const pawnRank = byColor === "w" ? tr - 1 : tr + 1;
    if (pawnRank >= 0 && pawnRank < 8) {
      for (const df of [-1, 1]) {
        const f = tf + df;
        if (f < 0 || f > 7) continue;
        const p = board[pawnRank][f];
        if (p && p.toLowerCase() === "p") consider(p, 1);
      }
    }

    // Knights
    for (const [df, dr] of _KNIGHT_DELTAS) {
      const f = tf + df,
        r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = board[r][f];
      if (p && p.toLowerCase() === "n") consider(p, 3);
    }

    // King (worth ∞ for SEE — recapture by king only legal if undefended)
    for (const [df, dr] of _KING_DELTAS) {
      const f = tf + df,
        r = tr + dr;
      if (f < 0 || f > 7 || r < 0 || r > 7) continue;
      const p = board[r][f];
      if (p && p.toLowerCase() === "k") consider(p, 100);
    }

    // Sliders — rooks/queens orthogonal
    for (const [df, dr] of _ROOK_DIRS) {
      for (let i = 1; i < 8; i++) {
        const f = tf + df * i,
          r = tr + dr * i;
        if (f < 0 || f > 7 || r < 0 || r > 7) break;
        const p = board[r][f];
        if (!p) continue;
        const lc = p.toLowerCase();
        if (lc === "r" || lc === "q") consider(p, lc === "r" ? 5 : 9);
        break; // ray blocked
      }
    }
    // Sliders — bishops/queens diagonal
    for (const [df, dr] of _BISHOP_DIRS) {
      for (let i = 1; i < 8; i++) {
        const f = tf + df * i,
          r = tr + dr * i;
        if (f < 0 || f > 7 || r < 0 || r > 7) break;
        const p = board[r][f];
        if (!p) continue;
        const lc = p.toLowerCase();
        if (lc === "b" || lc === "q") consider(p, lc === "b" ? 3 : 9);
        break;
      }
    }

    return out.sort((a, b) => a - b);
  }

  // Static Exchange Evaluation for the move `uci` played on `prevFen`.
  // Returns the net material gain (in pawn units) for the side playing
  // the move, assuming optimal recaptures from both sides. Negative means
  // the trade loses material overall.
  //
  // For non-captures returns null (caller checks if there's anything to
  // gain at all).
  function _seeMove(prevFen, uci) {
    if (!prevFen || !uci || uci.length < 4) return null;
    const board = _fenToBoard(prevFen);
    const src = uci.slice(0, 2);
    const dst = uci.slice(2, 4);
    const { f: sf, r: sr } = _sqToRF(src);
    const { f: tf, r: tr } = _sqToRF(dst);
    const mover = board[sr] && board[sr][sf];
    const target = board[tr] && board[tr][tf];
    if (!mover) return null;
    // Detect en-passant for pawn diagonal moves into empty squares.
    const isPawn = mover.toLowerCase() === "p";
    const epCap = isPawn && !target && sf !== tf;
    if (!target && !epCap) return null; // non-capture

    const moverIsWhite = mover === mover.toUpperCase();
    const moverColor = moverIsWhite ? "w" : "b";
    const oppColor = moverIsWhite ? "b" : "w";
    const moverVal = _PIECE_VAL[mover.toLowerCase()] || 0;
    const targetVal = epCap ? 1 : _PIECE_VAL[target.toLowerCase()] || 0;

    // Move mover onto dst so attacker lists reflect post-capture position.
    board[sr][sf] = null;
    if (epCap) {
      // Remove the captured pawn (one rank "behind" dst from mover's side)
      const epRank = moverIsWhite ? tr - 1 : tr + 1;
      if (epRank >= 0 && epRank < 8) board[epRank][tf] = null;
    }
    board[tr][tf] = mover;

    // Collect remaining attackers of both sides for `dst`.
    const ourAttackers = _attackerValuesOf(board, dst, moverColor);
    const oppAttackers = _attackerValuesOf(board, dst, oppColor);

    // Classical SEE swap-list algorithm.
    const gain = [targetVal];
    let onSquareVal = moverVal;
    let side = "opp"; // opponent to recapture
    while (true) {
      const list = side === "opp" ? oppAttackers : ourAttackers;
      if (list.length === 0) break;
      const next = list.shift();
      gain.push(onSquareVal - gain[gain.length - 1]);
      // Stand-pat: if even taking still loses, stop.
      if (Math.max(-gain[gain.length - 2], gain[gain.length - 1]) < 0) break;
      onSquareVal = next;
      side = side === "opp" ? "us" : "opp";
    }
    // Backward minimax — each side stops if continuing loses for them.
    for (let d = gain.length - 2; d >= 0; d--) {
      gain[d] = -Math.max(-gain[d], gain[d + 1]);
    }
    return gain[0];
  }

  // Convenience: does the opponent have ANY attacker on `dst` AFTER mover
  // captures? When false, the capture is truly free (no recapture possible).
  function _isFreeCapture(prevFen, uci) {
    const board = _fenToBoard(prevFen);
    const dst = uci.slice(2, 4);
    const src = uci.slice(0, 2);
    const { f: sf, r: sr } = _sqToRF(src);
    const { f: tf, r: tr } = _sqToRF(dst);
    const mover = board[sr] && board[sr][sf];
    if (!mover) return false;
    const moverIsWhite = mover === mover.toUpperCase();
    const oppColor = moverIsWhite ? "b" : "w";
    // Move mover onto dst so we don't count the mover as a defender.
    board[sr][sf] = null;
    board[tr][tf] = mover;
    return _attackerValuesOf(board, dst, oppColor).length === 0;
  }

  function bestMoveHint(prevFen, bestUci, playerUci, category, perspective) {
    if (!prevFen || !bestUci) return "";
    // Skip when the player matched the engine — no "should have" needed.
    if (playerUci && bestUci.slice(0, 4) === playerUci.slice(0, 4)) return "";
    // Only surface for sub-optimal categories where it adds value.
    if (!["blunder", "mistake", "inaccuracy"].includes(category)) return "";
    const src = bestUci.slice(0, 2);
    const dst = bestUci.slice(2, 4);
    const pieceChar = _pieceAtSquare(prevFen, src);
    if (!pieceChar) return "";
    const target = _pieceAtSquare(prevFen, dst);
    const self = perspective === "self";
    const opp = perspective === "opp";
    const isEN =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";

    // Compose a concise SAN (e.g. "Bxd4", "Nf3", "O-O") so the player can
    // map the suggestion to their board instantly.
    const san = _uciToSan(prevFen, bestUci);

    // Taş-bazlı ifade: SAN ("Nh6") yerine "At ile daha iyi bir hamlen
    // vardı" gibi kısa bir cümle üret. Kullanıcı tahtada doğru hamleyi
    // zaten ok ile görüyor → koordinat tekrarı bilişsel yük yaratıyordu.
    // Rok özel durumdur (taş türü yerine "Rok" denir).
    const isCastle = /^O-O(-O)?$/.test(san);
    const pcKey = pieceChar.toLowerCase();
    const pcTr = _PIECE_TR[pcKey] || "taş";
    const pcEn = _PIECE_EN[pcKey] || "piece";
    const pcEnCap = _PIECE_EN_CAP[pcKey] || "Piece";
    const isLongCastle = san === "O-O-O";
    const moveDescTr = isCastle
      ? isLongCastle
        ? "uzun rok yapmak"
        : "kısa rok yapmak"
      : pcTr + " ile oynamak";
    const moveDescEn = isCastle
      ? isLongCastle
        ? "castle queenside"
        : "castle kingside"
      : "play your " + pcEn;
    const moveDescEnOpp = isCastle
      ? isLongCastle
        ? "castling queenside"
        : "castling kingside"
      : "their " + pcEn;

    // Material-value framing — make captures concrete using SEE so a
    // "Qxd8 with king-recapture" reads as a trade, not a free queen.
    let captureFrame = ""; // English
    let captureFrameTR = "";
    if (target) {
      const tarV = _PIECE_VAL[target.toLowerCase()] || 0;
      const see = _seeMove(prevFen, bestUci);
      const isFree = _isFreeCapture(prevFen, bestUci);
      const tnEn = _PIECE_EN[target.toLowerCase()] || "piece";
      const tnTr = _PIECE_TR[target.toLowerCase()] || "taş";
      if (isFree && tarV > 0) {
        captureFrame = "free " + tnEn;
        captureFrameTR = "bedavadan bir " + tnTr + " kazanırdın";
      } else if (see != null && see >= 2) {
        captureFrame = "winning material";
        captureFrameTR = "malzeme kazanırdın";
      } else if (see != null && see > 0 && see < 2) {
        captureFrame = "a slight material edge";
        captureFrameTR = "küçük bir malzeme avantajı kazanırdın";
      } else if (see != null && see === 0) {
        captureFrame = "an even " + tnEn + " trade";
        captureFrameTR = tnTr + " takası olurdu";
      } else {
        // see < 0 → engine sees a deeper tactical follow-up; don't
        // mislead with "free" — frame as the right plan.
        captureFrame = "the right tactical sequence";
        captureFrameTR = "doğru taktik dizilim";
      }
    }

    if (isEN) {
      if (target) {
        if (self) return "Better — " + moveDescEn + ": " + captureFrame + ".";
        if (opp)
          return (
            "Better for your opponent — " +
            moveDescEnOpp +
            ": " +
            captureFrame +
            "."
          );
        return "Better — " + moveDescEn + ": " + captureFrame + ".";
      }
      if (self) return "Better — " + moveDescEn + ".";
      if (opp) return "Better for your opponent — " + moveDescEnOpp + ".";
      return "Better — " + moveDescEn + ".";
    }

    // ── Türkçe ──
    if (target) {
      if (self)
        return (
          (isCastle
            ? "Daha iyisi: " + moveDescTr
            : moveDescTr.charAt(0).toUpperCase() +
              moveDescTr.slice(1) +
              " daha iyiydi") +
          " — " +
          captureFrameTR +
          "."
        );
      if (opp)
        return (
          "Rakibin için " +
          moveDescTr +
          " daha iyiydi — " +
          captureFrameTR +
          "."
        );
      return (
        moveDescTr.charAt(0).toUpperCase() +
        moveDescTr.slice(1) +
        " daha iyiydi — " +
        captureFrameTR +
        "."
      );
    }
    if (self)
      return isCastle
        ? "Daha iyisi: " + moveDescTr + "."
        : moveDescTr.charAt(0).toUpperCase() +
            moveDescTr.slice(1) +
            " daha iyiydi.";
    if (opp) return "Rakibin için " + moveDescTr + " daha iyiydi.";
    return (
      moveDescTr.charAt(0).toUpperCase() + moveDescTr.slice(1) + " daha iyiydi."
    );
  }

  // ─── Mistake-WHY (specific reason a sub-optimal move was bad) ────────
  // Combines material delta, eval drop, and best-move comparison to
  // generate a punchy "what went wrong" sentence. Returns "" when nothing
  // specific can be said (the assembler then falls back to a soft generic
  // intro instead of the old corporate "İdeal değil; daha sağlam ...").
  function mistakeWhy(
    prevStep,
    curStep,
    prevEvalWhite,
    curEvalWhite,
    bestUci,
    perspective,
  ) {
    if (!curStep || !prevStep) return "";
    const san = curStep.san || "";
    const moverSign = curStep.side === "w" ? +1 : -1;
    const prevMat = materialFromFen(prevStep.fen);
    const curMat = materialFromFen(curStep.fen);
    const matGain = (curMat.diff - prevMat.diff) * moverSign;
    const playerCaptured = /x/.test(san);
    const self = perspective === "self";
    const opp = perspective === "opp";
    const isEN =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";

    // Eval drop in pawn units (mover's perspective; positive = lost ground).
    let evalDrop = null;
    if (typeof prevEvalWhite === "number" && typeof curEvalWhite === "number") {
      evalDrop = (prevEvalWhite - curEvalWhite) * moverSign;
    }

    // Did the engine want a capture you skipped?
    let missedCapture = null;
    let missedSee = null;
    let missedFree = false;
    if (bestUci && prevStep.fen) {
      const bDst = bestUci.slice(2, 4);
      const bTarget = _pieceAtSquare(prevStep.fen, bDst);
      if (bTarget) {
        missedCapture = {
          sq: bDst,
          piece: bTarget,
          name:
            (isEN ? _PIECE_EN : _PIECE_TR)[bTarget.toLowerCase()] || "piece",
        };
        // SEE so we don't claim "free queen" when it's actually a trade.
        missedSee = _seeMove(prevStep.fen, bestUci);
        missedFree = _isFreeCapture(prevStep.fen, bestUci);
      }
    }

    // 1) Player hung material (big drop, no capture by them).
    if (!playerCaptured && evalDrop != null && evalDrop >= 2.5) {
      if (isEN) {
        if (self) return "This move left a piece undefended.";
        if (opp) return "Your opponent left a piece undefended here.";
        return "A piece was left undefended.";
      }
      if (self) return "Bu hamleyle bir taşını boşta bıraktın.";
      if (opp) return "Rakibin bu hamleyle bir taşını boşta bıraktı.";
      return "Bu hamleyle bir taş savunmasız kaldı.";
    }

    // 2) Player skipped a free/winning capture the engine saw.
    if (!playerCaptured && missedCapture) {
      const movV = _PIECE_VAL[(missedCapture.piece || "").toLowerCase()] || 0;
      const isJuicy = movV >= 3; // a piece, not just a pawn
      // SEE-aware wording: only say "missed" / "görmedin" when the capture
      // actually wins material. For an even trade we soften to "takas
      // mümkündü". For a losing SEE we suppress this WHY entirely (the
      // engine's reasoning is deeper than a simple capture).
      const isEvenTrade = !missedFree && missedSee != null && missedSee === 0;
      const isLosingSee = missedSee != null && missedSee < 0;
      if (isLosingSee) {
        // Fall through to other WHY checks (or empty) — don't claim a
        // bedavadan capture that isn't there.
      } else if (isEN) {
        if (isEvenTrade) {
          if (self)
            return (
              "A " +
              missedCapture.name +
              " trade was available on " +
              missedCapture.sq +
              "."
            );
          if (opp)
            return (
              "Your opponent had a " +
              missedCapture.name +
              " trade on " +
              missedCapture.sq +
              "."
            );
          return (
            "A " +
            missedCapture.name +
            " trade was available on " +
            missedCapture.sq +
            "."
          );
        }
        if (self)
          return (
            "You missed " +
            (isJuicy ? "the " : "a free ") +
            missedCapture.name +
            " on " +
            missedCapture.sq +
            "."
          );
        if (opp)
          return (
            "Your opponent missed " +
            (isJuicy ? "the " : "a free ") +
            missedCapture.name +
            " on " +
            missedCapture.sq +
            "."
          );
        return (
          "A " +
          missedCapture.name +
          " on " +
          missedCapture.sq +
          " was hanging."
        );
      } else {
        const tnDat = _datifyPiece(missedCapture.name);
        if (isEvenTrade) {
          if (self)
            return (
              missedCapture.sq +
              " karesinde " +
              tnDat +
              " üzerinden takas mümkündü."
            );
          if (opp)
            return (
              "Rakibin " +
              missedCapture.sq +
              " karesinde " +
              tnDat +
              " üzerinden takası kaçırdı."
            );
          return (
            missedCapture.sq +
            " karesinde " +
            tnDat +
            " üzerinden takas mümkündü."
          );
        }
        if (self)
          return (
            "Rakibin " +
            missedCapture.sq +
            " karesindeki " +
            tnDat +
            " görmedin."
          );
        if (opp)
          return (
            "Rakibin " +
            missedCapture.sq +
            " karesindeki " +
            tnDat +
            " almayı kaçırdı."
          );
        return missedCapture.sq + " karesindeki " + tnDat + " alınabilirdi.";
      }
    }

    // 3) Player made an unequal trade (gave up material).
    if (playerCaptured && matGain <= -2) {
      if (isEN) {
        if (self) return "This trade cost you material.";
        if (opp) return "Your opponent lost material in this trade.";
        return "An unequal trade — material was lost.";
      }
      if (self) return "Bu değişimde malzeme kaybettin.";
      if (opp) return "Rakibin bu değişimde malzeme kaybetti.";
      return "Bu değişimde malzeme kaybedildi.";
    }

    // 4) Big positional drop without obvious tactic.
    if (evalDrop != null && evalDrop >= 1.5) {
      if (isEN) {
        if (self) return "This move handed your opponent the initiative.";
        if (opp) return "Your opponent gave you the initiative here.";
        return "The initiative shifted after this move.";
      }
      if (self) return "Bu hamle inisiyatifi rakibine bıraktı.";
      if (opp) return "Bu hamleyle rakibin inisiyatifi sana verdi.";
      return "Bu hamleyle inisiyatif el değiştirdi.";
    }

    // 5) Mild slip — let the caller use a soft fallback.
    return "";
  }

  // Returns a Promise<number | null> — the eval in pawn units from white's
  // perspective. Caller must convert to mover-perspective when narrating.
  //
  // Side-effect: every successful analyze also populates `_bestMoveByFen`
  // with the engine's preferred move (UCI, e.g. "g1f3"). The narration
  // layer reads this to generate "Daha iyisi vardı: At f3'e" style hints
  // without an extra round-trip to the server.
  const _bestMoveByFen = new Map();
  let _analyzeWarnCount = 0;

  // Chess.com avatar resolver — cached per-username so a 72-ply review
  // only hits api.chess.com twice (once per player). Returns null on
  // failure / missing avatar so the caller can keep the fallback image.
  const _chessComAvatarCache = new Map(); // username (lowercase) → url|null
  const _chessComAvatarInFlight = new Map(); // username → Promise<url|null>
  function _resolveChessComAvatar(username) {
    const u = String(username || "")
      .trim()
      .toLowerCase();
    if (!u) return Promise.resolve(null);
    if (_chessComAvatarCache.has(u))
      return Promise.resolve(_chessComAvatarCache.get(u));
    if (_chessComAvatarInFlight.has(u)) return _chessComAvatarInFlight.get(u);
    const p = (async () => {
      try {
        const res = await fetch(
          "https://api.chess.com/pub/player/" + encodeURIComponent(u),
          { method: "GET", headers: { Accept: "application/json" } },
        );
        if (!res.ok) {
          _chessComAvatarCache.set(u, null);
          return null;
        }
        const body = await res.json().catch(() => null);
        const url = (body && body.avatar) || null;
        _chessComAvatarCache.set(u, url);
        return url;
      } catch (_) {
        _chessComAvatarCache.set(u, null);
        return null;
      } finally {
        _chessComAvatarInFlight.delete(u);
      }
    })();
    _chessComAvatarInFlight.set(u, p);
    return p;
  }

  // After the modal is mounted, swap any <img.forksight-rb-player-av>
  // src with the real chess.com avatar fetched lazily. Imgs whose src
  // already points to a non-fallback URL are skipped.
  function _upgradePlayerAvatars(root) {
    if (!root) return;
    const imgs = root.querySelectorAll(
      "img.forksight-rb-player-av[data-fs-username]",
    );
    imgs.forEach((img) => {
      const uname = img.getAttribute("data-fs-username");
      if (!uname) return;
      _resolveChessComAvatar(uname).then((url) => {
        if (url && img.isConnected) img.src = url;
      });
    });
  }

  function analyzeFen(fen, depth) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "analyze",
            data: {
              fen,
              depth: depth || 14,
              multipv: 1,
              max_time: 0,
              // Server gate: free users may only call analyze with
              // mode="manual". "review" was getting 403 and silently
              // nulling every eval (so all post-book moves fell back to
              // the neutral "solid" badge). This is a user-initiated
              // batch of manual analyses, so "manual" is accurate.
              mode: "manual",
            },
          },
          (resp) => {
            if (chrome.runtime.lastError) {
              if (_analyzeWarnCount++ < 3) {
                console.warn(
                  "[ForkSightReview] analyze runtime error:",
                  chrome.runtime.lastError.message,
                );
              }
              return resolve(null);
            }
            if (!resp || !resp.ok || !resp.moves || !resp.moves.length) {
              if (_analyzeWarnCount++ < 3) {
                console.warn(
                  "[ForkSightReview] analyze failed:",
                  resp && (resp.error || resp.detail)
                    ? resp.error || resp.detail
                    : resp,
                );
              }
              return resolve(null);
            }
            const raw = String(resp.moves[0].score || "0");
            // Capture best move (UCI) for narration hints; engine returns
            // either resp.moves[0].move or the first token of pv_uci.
            try {
              const bm =
                resp.moves[0].move ||
                (resp.moves[0].pv_uci
                  ? String(resp.moves[0].pv_uci).split(/\s+/)[0]
                  : null);
              if (bm && /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(bm)) {
                _bestMoveByFen.set(fen, bm.toLowerCase());
              }
            } catch (_) {}
            let score;
            if (
              raw.startsWith("M") ||
              raw.startsWith("+M") ||
              raw.startsWith("-M")
            ) {
              // Mate — collapse to a large signed value, capped.
              const sign = raw.includes("-") ? -1 : 1;
              score = sign * 30;
            } else {
              score = parseFloat(raw);
              if (!isFinite(score)) score = 0;
            }
            // Convert side-to-move eval to white POV using the FEN turn marker.
            const turn = fen.split(" ")[1] || "w";
            resolve(turn === "w" ? score : -score);
          },
        );
      } catch (_) {
        resolve(null);
      }
    });
  }

  // ─── Modal lifecycle ─────────────────────────────────────────────────
  let modalEl = null;

  function close() {
    if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    modalEl = null;
    document.removeEventListener("keydown", onEsc);
  }

  function onEsc(e) {
    if (e.key === "Escape") close();
  }

  function mount(innerHtml) {
    close();
    modalEl = document.createElement("div");
    modalEl.className = "forksight-review-modal";
    modalEl.innerHTML = `
      <div class="forksight-review-backdrop"></div>
      <div class="forksight-review-shell" role="dialog" aria-label="${T("ForkSight oyun incelemesi")}">
        ${innerHtml}
      </div>
    `;
    document.body.appendChild(modalEl);
    modalEl
      .querySelector(".forksight-review-backdrop")
      .addEventListener("click", close);
    document.addEventListener("keydown", onEsc);
    return modalEl;
  }

  // ─── Step 1: Method picker (URL veya FEN) ────────────────────────────
  function openPrompt(prefill) {
    // If caller passed a prefill string we assume legacy URL flow and
    // skip directly to the URL form so existing entry points still work.
    if (typeof prefill === "string" && prefill.length > 0) {
      openUrlPrompt(prefill);
      return;
    }
    mount(`
      <button class="forksight-review-close" aria-label="${T("Kapat")}">×</button>
      <div class="forksight-review-prompt forksight-review-methodpick">
        <div class="forksight-review-promptHead">
          <img class="forksight-review-coach" alt="" />
          <div>
            <h2>${T("Oyun Analizi")}</h2>
            <p>${T("Analiz yöntemini seç.")}</p>
          </div>
        </div>
        <div class="forksight-review-methodpick-grid">
          <button class="forksight-review-methodpick-card" data-method="url">
            <span class="forksight-review-methodpick-ico">🔗</span>
            <span class="forksight-review-methodpick-title">${T("URL ile")}</span>
            <span class="forksight-review-methodpick-desc">
              ${T("Chess.com live veya daily oyun bağlantısı yapıştır.")}
            </span>
          </button>
          <button class="forksight-review-methodpick-card" data-method="pgn">
            <span class="forksight-review-methodpick-ico">📋</span>
            <span class="forksight-review-methodpick-title">${T("PGN ile")}</span>
            <span class="forksight-review-methodpick-desc">
              ${T("Oyunun PGN metnini yapıştır — hamleler, oyuncular ve saatler dahil tam inceleme.")}
            </span>
          </button>
        </div>
      </div>
    `);
    try {
      modalEl.querySelector(".forksight-review-coach").src =
        chrome.runtime.getURL("avatars/thinking.png");
    } catch (_) {}
    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);
    modalEl
      .querySelectorAll(".forksight-review-methodpick-card")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const m = btn.dataset.method;
          if (m === "pgn") openPgnPrompt();
          else openUrlPrompt();
        }),
      );
  }

  // ─── Step 1a: URL prompt ─────────────────────────────────────────────
  function openUrlPrompt(prefill) {
    mount(`
      <button class="forksight-review-close" aria-label="${T("Kapat")}">×</button>
      <div class="forksight-review-prompt">
        <div class="forksight-review-promptHead">
          <img class="forksight-review-coach" alt="" />
          <div>
            <h2>${T("URL ile Analiz")}</h2>
            <p>${T("Bir Chess.com oyun bağlantısı yapıştır.")}</p>
          </div>
        </div>
        <input class="forksight-review-input" type="text" inputmode="url"
               placeholder="https://www.chess.com/game/live/1388711047"
               value="${esc(prefill || "")}" autofocus />
        <div class="forksight-review-hint">
          ${T("Desteklenen türler: <b>live</b> ve <b>daily</b>. Örnek: https://www.chess.com/game/daily/967774833")}
        </div>
        <div class="forksight-review-actions">
          <button class="forksight-review-cancel">← ${T("Geri")}</button>
          <button class="forksight-review-go">${T("Analiz Et")}</button>
        </div>
        <div class="forksight-review-error" hidden></div>
      </div>
    `);

    try {
      modalEl.querySelector(".forksight-review-coach").src =
        chrome.runtime.getURL("avatars/thinking.png");
    } catch (_) {}

    const input = modalEl.querySelector(".forksight-review-input");
    const errEl = modalEl.querySelector(".forksight-review-error");
    const go = async () => {
      const parsed = parseGameUrl(input.value);
      errEl.hidden = true;
      if (!parsed) {
        errEl.textContent = T(
          "Bağlantıyı tanıyamadım. Örnek: https://www.chess.com/game/live/123456789",
        );
        errEl.hidden = false;
        return;
      }
      if (parsed.type !== "live" && parsed.type !== "daily") {
        errEl.textContent = T(
          "Şu an yalnızca live ve daily oyunlar destekleniyor (tip: {t}).",
        ).replace("{t}", parsed.type);
        errEl.hidden = false;
        return;
      }
      await openReview(parsed);
    };

    modalEl.querySelector(".forksight-review-go").addEventListener("click", go);
    modalEl
      .querySelector(".forksight-review-cancel")
      .addEventListener("click", () => openPrompt());
    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") go();
    });
    setTimeout(() => input.focus(), 30);
  }

  // ─── Step 1b: PGN prompt ─────────────────────────────────────────────
  function openPgnPrompt(prefill, notice) {
    const noticeHtml = notice
      ? `<div class="forksight-review-notice" role="status">${notice}</div>`
      : "";
    mount(`
      <button class="forksight-review-close" aria-label="${T("Kapat")}">×</button>
      <div class="forksight-review-prompt">
        <div class="forksight-review-promptHead">
          <img class="forksight-review-coach" alt="" />
          <div>
            <h2>${T("PGN ile Analiz")}</h2>
            <p>${T("Oyunun PGN metnini yapıştır.")}</p>
          </div>
        </div>
        ${noticeHtml}
        <textarea class="forksight-review-input forksight-review-textarea"
                  rows="10"
                  placeholder='[Event "..."]&#10;[White "..."]&#10;[Black "..."]&#10;...&#10;&#10;1. e4 c5 2. Nf3 Nc6 ...'
                  autofocus>${esc(prefill || "")}</textarea>
        <div class="forksight-review-hint">
          ${T("Chess.com'da bir oyunda <b>Share → PGN</b> ile kopyalayıp buraya yapıştırabilirsin. Hamleler, oyuncular ve saatler otomatik okunur.")}
        </div>
        <div class="forksight-review-actions">
          <button class="forksight-review-cancel">← ${T("Geri")}</button>
          <button class="forksight-review-go">${T("Analiz Et")}</button>
        </div>
        <div class="forksight-review-error" hidden></div>
      </div>
    `);

    try {
      modalEl.querySelector(".forksight-review-coach").src =
        chrome.runtime.getURL("avatars/thinking.png");
    } catch (_) {}

    const input = modalEl.querySelector(".forksight-review-input");
    const errEl = modalEl.querySelector(".forksight-review-error");
    const go = async () => {
      errEl.hidden = true;
      try {
        await openPgnReview(input.value);
      } catch (e) {
        errEl.textContent = (e && e.message) || T("PGN ayrıştırılamadı.");
        errEl.hidden = false;
      }
    };

    modalEl.querySelector(".forksight-review-go").addEventListener("click", go);
    modalEl
      .querySelector(".forksight-review-cancel")
      .addEventListener("click", () => openPrompt());
    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);
    input.addEventListener("keydown", (e) => {
      // Ctrl/Cmd+Enter triggers analysis from inside the textarea.
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        go();
      }
    });
    setTimeout(() => input.focus(), 30);
  }

  // ─── Step 2: loading + review render ─────────────────────────────────
  function showLoading(message) {
    let loadingGifUrl = "";
    try {
      loadingGifUrl = chrome.runtime.getURL("gifs/loading.gif");
    } catch (_) {}
    mount(`
      <button class="forksight-review-close" aria-label="Kapat">×</button>
      <div class="forksight-review-loading">
        <img class="forksight-review-spinner" src="${loadingGifUrl}" alt="" draggable="false"/>
        <div id="forksight-review-loading-msg">${esc(message || "Oyun bilgileri alınıyor…")}</div>
        <div class="forksight-review-progress-wrap" id="forksight-review-progress-wrap" style="display:none">
          <div class="forksight-review-progress-bar"><div class="forksight-review-progress-fill" id="forksight-review-progress-fill"></div></div>
          <div class="forksight-review-progress-text" id="forksight-review-progress-text">0%</div>
        </div>
      </div>
    `);
    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);
  }

  function updateLoading(message, done, total) {
    if (!modalEl) return;
    const msgEl = modalEl.querySelector("#forksight-review-loading-msg");
    if (msgEl && message) msgEl.textContent = message;
    const wrap = modalEl.querySelector("#forksight-review-progress-wrap");
    if (!wrap) return;
    if (typeof total === "number" && total > 0) {
      wrap.style.display = "";
      const pct = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
      const fill = modalEl.querySelector("#forksight-review-progress-fill");
      const txt = modalEl.querySelector("#forksight-review-progress-text");
      if (fill) fill.style.width = pct + "%";
      if (txt) txt.textContent = "%" + pct + "  (" + done + " / " + total + ")";
    } else {
      wrap.style.display = "none";
    }
  }

  function showError(message, retryParsed) {
    mount(`
      <button class="forksight-review-close" aria-label="Kapat">×</button>
      <div class="forksight-review-error-box">
        <div class="forksight-review-error-ico">⚠️</div>
        <h3>Oyun yüklenemedi</h3>
        <p>${esc(message)}</p>
        <div class="forksight-review-actions">
          <button class="forksight-review-cancel">Kapat</button>
          <button class="forksight-review-retry">Tekrar Dene</button>
        </div>
      </div>
    `);
    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);
    modalEl
      .querySelector(".forksight-review-cancel")
      .addEventListener("click", close);
    modalEl
      .querySelector(".forksight-review-retry")
      .addEventListener("click", () => {
        if (retryParsed) openReview(retryParsed);
        else openPrompt();
      });
  }

  // ─── Server-side review cache (per-game eval array) ─────────────────
  // Depth 8 is too noisy for reliable blunder/brilliant detection — at that
  // depth Stockfish frequently misses tactics and quiet moves' evals jitter
  // by 0.3+ pawns between consecutive plies, washing out real signal. Depth
  // 14 is the sweet spot used by Lichess' "rapid" cloud analysis: deep
  // enough to see 2-ply tactics and stable enough that wp-loss buckets
  // mean what they say.
  const REVIEW_DEPTH = 14;
  const REVIEW_SITE = "chess.com";

  // How many analyses to keep in flight at once. The server runs an
  // 8-worker Stockfish pool, so 5 concurrent client requests gives us
  // ~5x the throughput of a strictly-serial loop while leaving headroom
  // for other users on the same backend. A 104-ply game at depth 14
  // drops from ~60s wall time to ~12s on a warm pool.
  const REVIEW_CONCURRENCY = 5;

  // Drive `analyzeFen` over every ply in `timeline` with bounded
  // concurrency. Eval results land in `evalCache[p]`. Categories
  // (inaccuracy/mistake/blunder/...) are recomputed in a second pass
  // because each ply's badge depends on its predecessor's eval.
  //
  // `getModal` lets the caller abort when the user closes the modal
  // mid-analysis; we check it both before dispatching and before each
  // progress tick so we don't keep slamming the server in the background.
  async function _runReviewAnalysis(
    timeline,
    evalCache,
    catCache,
    getModal,
    onProgress,
  ) {
    const N = timeline.length;
    if (N === 0) return;
    let nextIdx = 0;
    let done = 0;
    async function worker() {
      while (true) {
        if (!getModal()) return;
        const p = nextIdx++;
        if (p >= N) return;
        try {
          evalCache[p] = await analyzeFen(timeline[p].fen, REVIEW_DEPTH);
        } catch (_) {
          evalCache[p] = null;
        }
        done++;
        try {
          onProgress && onProgress(done, N);
        } catch (_) {}
      }
    }
    const workers = [];
    const n = Math.min(REVIEW_CONCURRENCY, N);
    for (let i = 0; i < n; i++) workers.push(worker());
    await Promise.all(workers);
    if (!getModal()) return;
    // Second pass: categorize now that every eval is settled. Doing this
    // sequentially is essentially free vs. the analysis itself.
    for (let p = 1; p < N; p++) {
      if (evalCache[p] != null && evalCache[p - 1] != null) {
        const step = timeline[p];
        const moverSign = step.side === "w" ? +1 : -1;
        catCache[p] = categorize(
          evalCache[p - 1] * moverSign,
          evalCache[p] * moverSign,
          p,
        );
      }
    }
  }

  function loadCachedEvals(gameId) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "getGameAnalysis",
            data: {
              site: REVIEW_SITE,
              gameId: String(gameId),
              depth: REVIEW_DEPTH,
            },
          },
          (resp) => {
            if (chrome.runtime.lastError) return resolve(null);
            if (
              !resp ||
              !resp.ok ||
              !resp.cached ||
              !Array.isArray(resp.evals)
            ) {
              return resolve(null);
            }
            // Return both arrays; bests may be null (older cache rows).
            resolve({
              evals: resp.evals,
              bests: Array.isArray(resp.bests) ? resp.bests : null,
            });
          },
        );
      } catch (_) {
        resolve(null);
      }
    });
  }

  function saveCachedEvals(gameId, evals, bests) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "saveGameAnalysis",
            data: {
              site: REVIEW_SITE,
              game_id: String(gameId),
              depth: REVIEW_DEPTH,
              evals: evals.map((v) => (typeof v === "number" ? v : null)),
              bests: Array.isArray(bests)
                ? bests.map((u) => (typeof u === "string" ? u : null))
                : null,
            },
          },
          (resp) => {
            // 402 — günlük oyun analizi kotası dolmuş. Kullanıcıya
            // upgrade modal'ı göster (bu fonksiyon background tarafından
            // {ok:false, quota:true, ...quotaInfo} olarak normalize edilir).
            if (resp && resp.quota && resp.code === "QUOTA_EXCEEDED") {
              try {
                _showQuotaModal(resp);
              } catch (_) {}
            }
            resolve();
          },
        );
      } catch (_) {
        resolve();
      }
    });
  }

  function rebuildCatCache(timeline, evalCache) {
    const catCache = new Array(timeline.length).fill(null);
    for (let p = 1; p < timeline.length; p++) {
      if (evalCache[p] == null || evalCache[p - 1] == null) continue;
      const step = timeline[p];
      const moverSign = step.side === "w" ? +1 : -1;
      catCache[p] = categorize(
        evalCache[p - 1] * moverSign,
        evalCache[p] * moverSign,
        p,
      );
    }
    return catCache;
  }

  async function openReview(parsed) {
    showLoading("Oyun bilgileri alınıyor…");
    let data;
    try {
      data = await fetchGame(parsed);
    } catch (e) {
      showError(e && e.message ? e.message : "Bilinmeyen ağ hatası.", parsed);
      return;
    }

    // Ask the viewer which side they played so narration can address them
    // in second person ("siz" / "rakibiniz"). User can also pick "izleyici"
    // for a neutral commentary.
    const viewerSide = await pickViewerSide(data);
    if (viewerSide === undefined) return; // modal was closed mid-pick

    // Pre-compute the timeline so we know how many positions to analyze.
    const moves = decodeTCN((data.game && data.game.moveList) || "");
    const timeline = buildTimeline(moves);
    let evalCache = new Array(timeline.length).fill(null);
    let catCache = new Array(timeline.length).fill(null);

    // ① Try server cache first — instant if this game was analyzed before.
    showLoading("Önceki analiz aranıyor…");
    const cached = await loadCachedEvals(parsed.id);
    if (!modalEl) return;
    if (
      cached &&
      Array.isArray(cached.evals) &&
      cached.evals.length === timeline.length
    ) {
      evalCache = cached.evals.slice();
      // Rehydrate best-move map so narration hints work on cache-hit reviews.
      if (
        Array.isArray(cached.bests) &&
        cached.bests.length === timeline.length
      ) {
        for (let p = 0; p < timeline.length; p++) {
          const bm = cached.bests[p];
          if (
            typeof bm === "string" &&
            /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(bm)
          ) {
            _bestMoveByFen.set(timeline[p].fen, bm.toLowerCase());
          }
        }
      }
      catCache = rebuildCatCache(timeline, evalCache);
      renderSummary(parsed, data, {
        timeline,
        evalCache,
        catCache,
        viewerSide,
      });
      return;
    }

    // ② Cache miss — run eager pre-analysis at depth 14, then save.
    updateLoading(
      T("Hamleler değerlendiriliyor… (Stockfish derinlik {n})").replace(
        "{n}",
        REVIEW_DEPTH,
      ),
      0,
      timeline.length,
    );
    await _runReviewAnalysis(
      timeline,
      evalCache,
      catCache,
      () => !!modalEl,
      (done, total) => updateLoading(null, done, total),
    );

    if (!modalEl) return;
    // Persist for next time (fire-and-forget — don't block UI on the save).
    const bestsArr = timeline.map((s) => _bestMoveByFen.get(s.fen) || null);
    saveCachedEvals(parsed.id, evalCache, bestsArr);
    renderSummary(parsed, data, {
      timeline,
      evalCache,
      catCache,
      viewerSide,
    });
  }

  /**
   * Open the review modal for a PGN-pasted game. Reuses the live-game
   * flow as much as possible: builds a real timeline from SAN moves,
   * synthesises the chess.com-shaped `data` object from PGN headers,
   * runs the viewer-side picker + eager pre-analysis, then hands off
   * to renderSummary.
   */
  async function openPgnReview(pgnStr) {
    // 1) Parse PGN → moves. Throws with a readable error if SAN fails.
    const pgn = pgnToMoves(pgnStr);
    const { headers, uciMoves, startPos, timestamps, clocks } = pgn;

    // 2) Build the per-ply timeline (honouring [FEN] header if present).
    const timeline = buildTimeline(uciMoves, startPos || undefined);

    // 3) Try to surface the chess.com game id from the [Link] header so
    //    eval-cache lookups still work across PGN re-pastes of the same
    //    game. Fall back to a stable hash of the headers otherwise.
    const link = headers.Link || headers.Site || "";
    const linkMatch = link.match(
      /chess\.com\/(?:game|live)\/(live|daily|computer|coach)\/(\d+)/i,
    );
    const gameType = linkMatch ? linkMatch[1].toLowerCase() : "pgn";
    const gameId = linkMatch
      ? linkMatch[2]
      : "pgn-" +
        (headers.White || "") +
        "-" +
        (headers.Black || "") +
        "-" +
        (headers.Date || "") +
        "-" +
        uciMoves.length;
    const parsed = { type: gameType, id: gameId };

    // 4) Convert per-move clock seconds → chess.com's centisecond array
    //    so the per-ply player rows can render "0:02:15" timers like
    //    they do for live games. Each entry is the clock at that ply.
    const tsCsv = (clocks || [])
      .map((s) => (s == null ? "" : Math.round(s * 10)))
      .filter((v) => v !== "")
      .join(",");

    // 5) Synthesize the data object renderReview expects.
    const colorOfWinner =
      headers.Result === "1-0"
        ? "white"
        : headers.Result === "0-1"
          ? "black"
          : null;
    const data = {
      game: {
        moveList: "", // already encoded into `timeline`
        moveTimestamps: tsCsv,
        pgnHeaders: headers,
        colorOfWinner,
        resultMessage:
          headers.Termination ||
          (headers.Result === "*" ? "Sonlandırılmamış" : ""),
        timeControl: headers.TimeControl || "",
      },
      players: {
        top: {
          color: "black",
          username: headers.Black || "Siyah",
          rating: headers.BlackElo || "",
        },
        bottom: {
          color: "white",
          username: headers.White || "Beyaz",
          rating: headers.WhiteElo || "",
        },
      },
    };

    // 6) Ask who the viewer played as (or "izleyici").
    const viewerSide = await pickViewerSide(data);
    if (viewerSide === undefined) return;

    // 7) Eval cache lookup + eager pre-analysis (mirrors openReview).
    let evalCache = new Array(timeline.length).fill(null);
    let catCache = new Array(timeline.length).fill(null);

    showLoading("Önceki analiz aranıyor…");
    const cached = await loadCachedEvals(parsed.id);
    if (!modalEl) return;
    if (
      cached &&
      Array.isArray(cached.evals) &&
      cached.evals.length === timeline.length
    ) {
      evalCache = cached.evals.slice();
      if (
        Array.isArray(cached.bests) &&
        cached.bests.length === timeline.length
      ) {
        for (let p = 0; p < timeline.length; p++) {
          const bm = cached.bests[p];
          if (
            typeof bm === "string" &&
            /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(bm)
          )
            _bestMoveByFen.set(timeline[p].fen, bm.toLowerCase());
        }
      }
      catCache = rebuildCatCache(timeline, evalCache);
      renderSummary(parsed, data, {
        timeline,
        evalCache,
        catCache,
        viewerSide,
      });
      return;
    }

    updateLoading(
      T("Hamleler değerlendiriliyor… (Stockfish derinlik {n})").replace(
        "{n}",
        REVIEW_DEPTH,
      ),
      0,
      timeline.length,
    );
    await _runReviewAnalysis(
      timeline,
      evalCache,
      catCache,
      () => !!modalEl,
      (done, total) => updateLoading(null, done, total),
    );
    if (!modalEl) return;
    const bestsArr = timeline.map((s) => _bestMoveByFen.get(s.fen) || null);
    saveCachedEvals(parsed.id, evalCache, bestsArr);
    renderSummary(parsed, data, {
      timeline,
      evalCache,
      catCache,
      viewerSide,
    });
  }

  /**
   * Modal asking the viewer which color they played. Resolves to "w", "b",
   * or null ("izleyici" — neutral commentary). Resolves to `undefined` if
   * the user closes the modal without choosing.
   */
  function pickViewerSide(data) {
    return new Promise((resolve) => {
      const top = (data.players && data.players.top) || {};
      const bottom = (data.players && data.players.bottom) || {};
      const whitePlayer = bottom.color === "white" ? bottom : top;
      const blackPlayer = bottom.color === "white" ? top : bottom;
      const whiteName = esc(whitePlayer.username || T("1. Oyuncu (Beyaz)"));
      const blackName = esc(blackPlayer.username || T("2. Oyuncu (Siyah)"));
      const whiteRating = esc(whitePlayer.rating || "");
      const blackRating = esc(blackPlayer.rating || "");

      mount(`
        <button class="forksight-review-close" aria-label="${T("Kapat")}">×</button>
        <div class="forksight-review-sidepick">
          <h2>${T("Hangi taraftaydınız?")}</h2>
          <p>${T("Yorumları size göre kişiselleştirebilmek için oynadığınız tarafı seçin.")}</p>
          <div class="forksight-review-sidepick-row">
            <button class="forksight-review-sidepick-btn" data-side="w">
              <span class="forksight-review-dot forksight-review-dot--w"></span>
              <span class="forksight-review-sidepick-name">${whiteName}</span>
              <span class="forksight-review-sidepick-rating">${whiteRating}</span>
            </button>
            <button class="forksight-review-sidepick-btn" data-side="b">
              <span class="forksight-review-dot forksight-review-dot--b"></span>
              <span class="forksight-review-sidepick-name">${blackName}</span>
              <span class="forksight-review-sidepick-rating">${blackRating}</span>
            </button>
          </div>
          <button class="forksight-review-sidepick-neutral" data-side="none">
            ${T("İzleyici olarak devam et (tarafsız yorum)")}
          </button>
        </div>
      `);

      let settled = false;
      const finish = (val) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };

      modalEl
        .querySelector(".forksight-review-close")
        .addEventListener("click", () => {
          // close() already runs via the outer handler; signal abort.
          finish(undefined);
        });
      // Backdrop click also closes — detect via modalEl removal.
      const observer = new MutationObserver(() => {
        if (!modalEl) {
          observer.disconnect();
          finish(undefined);
        }
      });
      if (modalEl && modalEl.parentNode) {
        observer.observe(modalEl.parentNode, { childList: true });
      }
      modalEl.querySelectorAll("[data-side]").forEach((btn) =>
        btn.addEventListener("click", () => {
          observer.disconnect();
          const s = btn.dataset.side;
          finish(s === "w" || s === "b" ? s : null);
        }),
      );
    });
  }

  // ─── Review aggregate stats (accuracy + per-category counts) ─────────
  const STAT_ROWS = [
    { key: "brilliant", trLabel: "Harika", icon: "brilliant" },
    { key: "great", trLabel: "Çok iyi", icon: "great" },
    { key: "book", trLabel: "Kitap", icon: "book" },
    { key: "best", trLabel: "En iyi", icon: "best" },
    { key: "good", trLabel: "Mükemmel", icon: "good" },
    { key: "solid", trLabel: "İyi", icon: "ok" },
    { key: "inaccuracy", trLabel: "Yanlışlık", icon: "dubious" },
    { key: "mistake", trLabel: "Hata", icon: "inaccuracy_dark" },
    { key: "blunder", trLabel: "Gaf", icon: "blunder" },
  ];

  // Per-ply win-probability loss → 0..100 "accuracy" using Lichess'
  // exponential mapping. Higher loss = lower accuracy. Then averaged
  // across the player's moves.
  //
  // Doğruluk artık Lichess'in tam algoritması: her hamleye volatilite
  // (yakın plilerdeki wp std'si) ağırlığı verilir ve **harmonik
  // ortalama** alınır. Aritmetik ortalama tek kötü hamleyi gizliyordu;
  // harmonik ortalama 1-2 gafı belirgin biçimde cezalandırır
  // (chess.com'un raporuyla aynı doğrultuda).
  function _accFromLoss(losses) {
    if (!losses.length) return null;
    let totW = 0;
    let totWoverA = 0;
    for (const it of losses) {
      const L = Math.max(0, it && typeof it === "object" ? it.L : it);
      const w = Math.max(
        0.5,
        it && typeof it === "object" && typeof it.vol === "number" ? it.vol : 1,
      );
      const a = Math.max(
        0.5,
        Math.min(100, 103.1668 * Math.exp(-0.04354 * L) - 3.1669),
      );
      totW += w;
      totWoverA += w / a;
    }
    return totWoverA > 0 ? totW / totWoverA : null;
  }

  // Bir hamledeki "volatilite" — etrafındaki ±2 plinin wp std sapması.
  // Sıkışık, taktiksel pozisyonlarda volatilite yüksektir; orada yapılan
  // hatalar daha çok cezalandırılır.
  function _volWeights(wps) {
    const n = wps.length;
    const out = new Array(n).fill(1);
    const W = 2; // pencere yarı genişliği
    for (let i = 0; i < n; i++) {
      let sum = 0;
      let sumSq = 0;
      let k = 0;
      for (let j = Math.max(0, i - W); j <= Math.min(n - 1, i + W); j++) {
        sum += wps[j];
        sumSq += wps[j] * wps[j];
        k++;
      }
      const mean = sum / k;
      const variance = Math.max(0, sumSq / k - mean * mean);
      const std = Math.sqrt(variance);
      // 0.5..12 aralığında — uç değerleri yumuşat
      out[i] = Math.max(0.5, Math.min(12, std));
    }
    return out;
  }

  function computeReviewStats(timeline, evalCache, catCache) {
    const empty = () => ({
      brilliant: 0,
      great: 0,
      best: 0,
      good: 0,
      solid: 0,
      inaccuracy: 0,
      mistake: 0,
      blunder: 0,
      book: 0,
      mateThreat: 0,
    });
    const counts = { w: empty(), b: empty() };
    const losses = { w: [], b: [] };
    // Tüm pliler için wp dizisi (beyaz perspektifinden) — volatilite
    // ağırlıklarını hesaplamak için tek pas.
    const wpsAll = new Array(timeline.length).fill(50);
    let lastWp = 50;
    for (let p = 0; p < timeline.length; p++) {
      if (evalCache[p] != null) lastWp = winProb(evalCache[p]);
      wpsAll[p] = lastWp;
    }
    const volsAll = _volWeights(wpsAll);
    for (let p = 1; p < timeline.length; p++) {
      const step = timeline[p];
      const side = step.side;
      const cat = catCache[p];
      if (cat && counts[side][cat] != null) counts[side][cat]++;
      if (evalCache[p] != null && evalCache[p - 1] != null) {
        const sign = side === "w" ? +1 : -1;
        const wpBefore = winProb(evalCache[p - 1] * sign);
        const wpAfter = winProb(evalCache[p] * sign);
        losses[side].push({
          L: Math.max(0, wpBefore - wpAfter),
          vol: volsAll[p],
        });
      }
    }
    return {
      counts,
      accuracy: {
        w: _accFromLoss(losses.w),
        b: _accFromLoss(losses.b),
      },
    };
  }

  // ─── Chess.com-style eval graph (line + colored dots) ────────────────
  // White's win-prob is drawn as a filled area from the bottom up. The
  // x-axis is ply number; mistakes/blunders/brilliancies get a dot.
  const _GRAPH_DOT = {
    brilliant: "#1baca6",
    great: "#5c8bef",
    blunder: "#fa412d",
    mistake: "#ff7769",
    inaccuracy: "#f7c245",
  };

  function buildEvalGraphSVG(timeline, evalCache, catCache) {
    const W = 600;
    const H = 90;
    const n = timeline.length;
    if (n < 2) return "";
    const pts = [];
    let lastWp = 50;
    for (let p = 0; p < n; p++) {
      const x = (p / (n - 1)) * W;
      const e = evalCache[p];
      const wp = e == null ? lastWp : winProb(e);
      lastWp = wp;
      const y = H - (wp / 100) * H;
      pts.push([x, y]);
    }
    let path = `M0,${H} L${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      path += ` L${pts[i][0].toFixed(2)},${pts[i][1].toFixed(2)}`;
    }
    path += ` L${W},${H} Z`;
    let dots = "";
    for (let p = 1; p < n; p++) {
      const color = _GRAPH_DOT[catCache[p]];
      if (!color) continue;
      const [x, y] = pts[p];
      dots +=
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.2" ` +
        `fill="${color}" stroke="#1a1a1a" stroke-width="0.6"/>`;
    }
    return (
      `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" ` +
      `class="forksight-evalgraph">` +
      `<rect x="0" y="0" width="${W}" height="${H}" fill="#2a2a2a"/>` +
      `<path d="${path}" fill="#f5f5f5"/>` +
      `<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" ` +
      `stroke="rgba(245,197,24,0.45)" stroke-width="0.6" stroke-dasharray="3,3"/>` +
      dots +
      `</svg>`
    );
  }

  // ─── Typewriter + TTS (Web Speech API) ───────────────────────────────
  let _typeTimer = null;
  function typewriter(el, text, speed) {
    if (_typeTimer) {
      clearInterval(_typeTimer);
      _typeTimer = null;
    }
    if (!el) return;
    el.textContent = "";
    let i = 0;
    const s = typeof speed === "number" ? speed : 22;
    _typeTimer = setInterval(() => {
      i++;
      el.textContent = text.slice(0, i);
      if (i >= text.length) {
        clearInterval(_typeTimer);
        _typeTimer = null;
      }
    }, s);
  }

  let _ttsEnabled = false;
  function setTTSEnabled(on) {
    _ttsEnabled = !!on;
    try {
      localStorage.setItem("forksight_tts", _ttsEnabled ? "1" : "0");
    } catch (_) {}
    if (!_ttsEnabled) {
      try {
        window.speechSynthesis && window.speechSynthesis.cancel();
      } catch (_) {}
      try {
        if (_serverAudio) {
          _serverAudio.pause();
          _serverAudio.src = "";
          _serverAudio = null;
        }
      } catch (_) {}
    }
  }
  try {
    _ttsEnabled = localStorage.getItem("forksight_tts") === "1";
  } catch (_) {}

  // ─── Server-side neural TTS (ElevenLabs primary, edge-tts fallback)
  // Cached on the server by (voice, text) so repeated narration is instant.
  // We also keep an in-memory blob-URL cache here to skip the network on
  // re-plays of the same line within a session.
  let _serverAudio = null;
  // Quota modal'ı bir oturumda tek kez göster — koç review boyunca
  // her satırda spam etmesin. Yeni review başladığında reset edilebilir.
  let _quotaModalShown = false;
  function _showQuotaModal(info) {
    if (_quotaModalShown) return;
    _quotaModalShown = true;
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
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483646;" +
        "display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;";
      const card = document.createElement("div");
      card.style.cssText =
        "background:#1a1d24;color:#e8eaed;padding:28px 32px;border-radius:16px;" +
        "max-width:420px;width:90%;box-shadow:0 24px 60px rgba(0,0,0,.6);" +
        "border:1px solid #353a45;";
      const title = isPremiumLocked
        ? "🎙️ Sesli Koç — Premium Özellik"
        : "📊 Günlük TTS Limitin Doldu";
      const body = isPremiumLocked
        ? "Koç sesi (ElevenLabs nöral TTS) Premium üyelik gerektirir. " +
          "Free hesabında günde 500 karaktere kadar tatma payın var, sonrası kapanır."
        : `Bugün ${used != null ? used : "?"} / ${limit != null ? limit : "?"} ${unit} kullandın.` +
          (resetTxt ? ` ${resetTxt} sonrası sıfırlanır.` : "") +
          " Premium'a geçerek günde 100.000 karaktere kadar dinleyebilirsin.";
      card.innerHTML =
        `<div style="font-size:18px;font-weight:600;margin-bottom:12px;">${title}</div>` +
        `<div style="font-size:14px;line-height:1.5;color:#b8bdc7;margin-bottom:20px;">${body}</div>` +
        `<div style="display:flex;gap:10px;justify-content:flex-end;">` +
        `<button id="_fs_qm_close" style="background:transparent;border:1px solid #3a3f4a;color:#b8bdc7;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">Kapat</button>` +
        `<button id="_fs_qm_upg" style="background:linear-gradient(135deg,#f7b733,#fc4a1a);border:none;color:#fff;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;font-size:13px;">Premium'a Geç</button>` +
        `</div>`;
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      const close = () => {
        try {
          overlay.remove();
        } catch (_) {}
      };
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
      });
      card.querySelector("#_fs_qm_close")?.addEventListener("click", close);
      card.querySelector("#_fs_qm_upg")?.addEventListener("click", () => {
        try {
          window.open(upgradeUrl, "_blank");
        } catch (_) {}
        close();
      });
    } catch (e) {
      console.warn("[coach] quota modal failed:", e);
    }
  }
  // Used to be a sticky boolean — once true, every subsequent line went
  // to browser TTS (often picking a wrong-language Natural voice and
  // sounding "German"). Now we count consecutive failures and back off
  // for a short window only, then retry the server. This keeps premium
  // ElevenLabs audio playing across transient network blips.
  let _serverTtsFails = 0;
  let _serverTtsCooldownUntil = 0;
  const _SERVER_TTS_MAX_FAILS = 3;
  const _SERVER_TTS_COOLDOWN_MS = 20000; // 20s
  // Monotonic request id — every speak() bumps this. In-flight fetches
  // older than the latest id are discarded so we never play two clips on
  // top of each other when the user clicks through moves quickly.
  let _ttsRequestSeq = 0;
  let _apiBaseCache = null;
  const _audioCache = new Map(); // key "lang|text" → objectURL
  const _AUDIO_CACHE_MAX = 64;

  function _getApiBase() {
    if (_apiBaseCache) return Promise.resolve(_apiBaseCache);
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get("taktik_api_base", (r) => {
          _apiBaseCache = (r && r.taktik_api_base) || "https://forksight.net";
          resolve(_apiBaseCache);
        });
      } catch (_) {
        _apiBaseCache = "https://forksight.net";
        resolve(_apiBaseCache);
      }
    });
  }

  function _currentTtsLang() {
    try {
      return window.ForkSightI18n && window.ForkSightI18n.getLang() === "en"
        ? "en"
        : "tr";
    } catch (_) {
      return "tr";
    }
  }

  function _stopAllSpeech() {
    try {
      window.speechSynthesis && window.speechSynthesis.cancel();
    } catch (_) {}
    try {
      if (_serverAudio) {
        _serverAudio.pause();
        _serverAudio.currentTime = 0;
      }
    } catch (_) {}
  }

  // Soften the narration so MS Neural voices breathe naturally:
  //   - trim filler ellipses
  //   - collapse multiple spaces
  //   - ensure sentence-end punctuation so the engine inserts a pause
  //   - normalize percentages and decimals per language. ElevenLabs (and
  //     most TTS) reads raw "%97.2" wrong in Turkish — the "%" sigil
  //     belongs *after* the number ("97,2 yüzde" sounds awkward; the
  //     natural Turkish form is "yüzde 97,2" with comma as decimal
  //     separator). Without this rewrite the voice stumbles or skips it.
  function _shapeForTTS(s, lang) {
    let t = String(s || "")
      .replace(/\s+/g, " ")
      .replace(/…/g, ".")
      .trim();
    if (!t) return t;
    if (lang === "tr") {
      // "%97.2" / "% 97,2" → "yüzde 97,2"
      // (decimal separator becomes "," — Turkish convention)
      t = t.replace(/%\s*(\d+)(?:[.,](\d+))?/g, (_m, intPart, fracPart) => {
        return fracPart
          ? "yüzde " + intPart + "," + fracPart
          : "yüzde " + intPart;
      });
      // Standalone decimals like "0.4" → "0,4" so the voice doesn't read
      // them as "zero point four" in English.
      t = t.replace(/(\d)\.(\d)/g, "$1,$2");
    } else {
      // English: "%97.2" → "97.2 percent" (post-fix sigil)
      t = t.replace(/%\s*(\d+(?:\.\d+)?)/g, "$1 percent");
    }
    if (!/[.!?]$/.test(t)) t += ".";
    return t;
  }

  async function _serverSpeak(text, lang, reqId) {
    const cacheKey = lang + "|" + text;
    let url = _audioCache.get(cacheKey);
    if (!url) {
      const base = await _getApiBase();
      // If a newer speak() call happened during the await, abandon.
      if (reqId !== _ttsRequestSeq) return;
      const endpoint =
        base.replace(/\/+$/, "") +
        "/tts?lang=" +
        encodeURIComponent(lang) +
        "&text=" +
        encodeURIComponent(text) +
        // Cache-buster: tarayıcı, /tts cevaplarını 1 yıl boyunca
        // immutable olarak cache'liyor. Eski sürümlerde ElevenLabs
        // başarısız olduğunda edge-tts (Microsoft) mp3'ü dönüyordu ve
        // o dosyalar hâlâ tarayıcı cache'inde duruyor. Kitap hamleleri
        // gibi sık görülen metinler aynı olduğu için (örn. "Bilindik
        // bir açılış hamlesi") her oyunda eski edge-tts ses dosyası
        // okunmaya devam ediyordu. `v=` ile cache key'ini değiştirip
        // sunucudan taze ElevenLabs sesini almaya zorluyoruz.
        "&v=el2";
      // Token'ı background'dan al; sunucu kullanıcıyı tanıyıp quota
      // (Free = 500 char/gün, Premium = 100K char/gün) uygulayabilsin.
      let _authHeaders = {};
      try {
        const tk = await new Promise((res) => {
          chrome.runtime.sendMessage({ type: "get_token" }, (r) =>
            res(r || {}),
          );
        });
        if (tk && tk.token)
          _authHeaders["Authorization"] = "Bearer " + tk.token;
      } catch (_) {}
      const res = await fetch(endpoint, {
        method: "GET",
        headers: _authHeaders,
      });
      if (reqId !== _ttsRequestSeq) return; // stale
      if (res.status === 402) {
        // Quota dolmuş veya feature kapalı (free user) → upgrade promptu
        // tetikle ve sesi sessizce yut. Modal'ı bir kez göster, sonraki
        // satırlar için tekrar açmayalım (spam olmasın).
        try {
          const body = await res.json();
          _showQuotaModal(body);
        } catch (_) {}
        return; // bu satır seslendirilmez; metin baloncukta kalır
      }
      if (!res.ok) throw new Error("tts http " + res.status);
      const blob = await res.blob();
      if (reqId !== _ttsRequestSeq) return; // stale
      url = URL.createObjectURL(blob);
      _audioCache.set(cacheKey, url);
      if (_audioCache.size > _AUDIO_CACHE_MAX) {
        const firstKey = _audioCache.keys().next().value;
        const old = _audioCache.get(firstKey);
        try {
          URL.revokeObjectURL(old);
        } catch (_) {}
        _audioCache.delete(firstKey);
      }
    }
    // Bail if a newer request superseded us during the fetch.
    if (reqId !== _ttsRequestSeq) return;
    // Stop any prior playback (browser TTS or previous audio).
    _stopAllSpeech();
    const audio = new Audio(url);
    audio.volume = 1.0;
    audio.playbackRate = 1.0;
    _serverAudio = audio;
    await audio.play();
  }

  function _browserSpeak(text, lang) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "en" ? "en-US" : "tr-TR";
      u.rate = 0.95;
      u.pitch = 1.05;
      u.volume = 1.0;
      const voices = window.speechSynthesis.getVoices() || [];
      // STRICT language filter — previously we OR'd a name-regex matching
      // "Natural"/"Online"/"Google" which let a German "Microsoft Katja
      // Natural - de-DE" voice into the Turkish candidate list (and the
      // subsequent .find(/Natural/) picked it). Result: TR text read with
      // a German voice. Require BCP-47 lang match first; use the name
      // regex only as a *quality* tiebreaker within already-lang-matched
      // voices.
      const langRe = lang === "en" ? /^en(-|_)?US/i : /^tr(-|_)?TR/i;
      const langRelaxed = lang === "en" ? /^en/i : /^tr/i;
      let langVoices = voices.filter((v) => langRe.test(v.lang || ""));
      if (langVoices.length === 0) {
        // Fall back to any voice in the same base language family.
        langVoices = voices.filter((v) => langRelaxed.test(v.lang || ""));
      }
      const qualityRe =
        lang === "en"
          ? /Jenny|Aria|Ava|Emma|Michelle|Sara|Natural|Online|Google/i
          : /Emel|Filiz|Aylin|Natural|Online|Google|Turkish|Türk/i;
      const pick =
        langVoices.find((v) => qualityRe.test(v.name || "")) ||
        langVoices.find((v) => /Natural/i.test(v.name || "")) ||
        langVoices.find((v) => /Online/i.test(v.name || "")) ||
        langVoices[0];
      // If we found NO voice in the requested language at all, refuse
      // to speak rather than play in a random foreign voice.
      if (!pick) return;
      u.voice = pick;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  function speak(text) {
    if (!_ttsEnabled) return;
    const lang = _currentTtsLang();
    const shaped = _shapeForTTS(text, lang);
    if (!shaped) return;
    // Mark every new line as the latest request and cancel anything
    // already in flight / playing — guarantees we never get two voices
    // overlapping.
    const reqId = ++_ttsRequestSeq;
    _stopAllSpeech();
    // ElevenLabs (sunucu TTS) HER ZAMAN birinci tercihtir. Tarayıcı
    // TTS'i (Microsoft/Google sesleri) yalnızca sunucu sesi hiç
    // kullanılamadığında — yani peş peşe N başarısızlıkla "broken"
    // bayrağı kalktığında — devreye girer. Tek bir 5xx ya da geçici
    // ağ hatası için ASLA tarayıcı sesine düşmüyoruz, çünkü kullanıcı
    // ElevenLabs kalitesini bekliyor.
    _serverSpeak(shaped, lang, reqId)
      .then(() => {
        _serverTtsFails = 0;
      })
      .catch((err) => {
        if (reqId !== _ttsRequestSeq) return; // user moved on
        _serverTtsFails++;
        try {
          console.warn(
            "[ForkSight] server TTS error (" + _serverTtsFails + "):",
            err,
          );
        } catch (_) {}
        // Sessiz başarısızlık: tarayıcı sesine düşmüyoruz. Server-side
        // zaten edge-tts'e fallback yapıyor; oradan da ses gelmediyse
        // bu satırı atlamak, yanlış aksanlı bir Microsoft sesinden
        // çok daha az rahatsız edici.
      });
  }

  // ─── Summary screen (chess.com-style intro before navigation) ────────
  function renderSummary(parsed, data, pre) {
    const game = data.game || {};
    const headers = game.pgnHeaders || {};
    const top = (data.players && data.players.top) || {};
    const bottom = (data.players && data.players.bottom) || {};
    const whitePlayer = bottom.color === "white" ? bottom : top;
    const blackPlayer = bottom.color === "white" ? top : bottom;
    const whiteName = esc(whitePlayer.username || headers.White || T("Beyaz"));
    const blackName = esc(blackPlayer.username || headers.Black || T("Siyah"));
    const stats = computeReviewStats(pre.timeline, pre.evalCache, pre.catCache);
    const flip = pre.viewerSide === "b";
    const graphSVG = buildEvalGraphSVG(
      pre.timeline,
      pre.evalCache,
      pre.catCache,
    );

    const result =
      headers.Result ||
      (game.colorOfWinner
        ? game.colorOfWinner === "white"
          ? "1-0"
          : "0-1"
        : "—");

    const fmtAcc = (a) => (a == null ? "—" : a.toFixed(1));

    // Pick an opening flavour line for the coach bubble.
    let coachLine;
    const wAcc = stats.accuracy.w;
    const bAcc = stats.accuracy.b;
    const viewerSide = pre.viewerSide;
    const _isEN =
      window.ForkSightI18n && window.ForkSightI18n.getLang() === "en";
    if (viewerSide && (wAcc != null || bAcc != null)) {
      const yourAcc = viewerSide === "w" ? wAcc : bAcc;
      const oppAcc = viewerSide === "w" ? bAcc : wAcc;
      if (yourAcc != null && oppAcc != null) {
        if (yourAcc >= 90) {
          coachLine = _isEN
            ? "An outstanding game — your accuracy is " +
              yourAcc.toFixed(1) +
              "%. Let's look at the moves together."
            : "Olağanüstü bir oyun çıkardın — doğruluğun %" +
              yourAcc.toFixed(1) +
              ". Hadi hamleleri birlikte inceleyelim.";
        } else if (yourAcc >= 75) {
          coachLine = _isEN
            ? "Nice performance! Your accuracy is " +
              yourAcc.toFixed(1) +
              "%. Let's review a few critical moments together."
            : "Güzel bir performans! Doğruluğun %" +
              yourAcc.toFixed(1) +
              ". Birkaç kritik anı birlikte gözden geçirelim.";
        } else if (yourAcc >= oppAcc) {
          coachLine = _isEN
            ? "Good job — still, there's room to improve. Let's start the review."
            : "İyi iş — yine de geliştirebileceğin yerler var. İncelemeyi başlatalım.";
        } else {
          coachLine = _isEN
            ? "A few tough moments — but don't worry, every game teaches us. Let's look together."
            : "Birkaç zorlu an olmuş; ama merak etme, her oyun öğretir. Beraber bakalım.";
        }
      }
    }
    if (!coachLine) {
      coachLine = _isEN
        ? "I've reviewed the game. When you're ready, hit 'Start Review'."
        : "Oyunu inceledim. Hazır olduğunda 'İncelemeyi Başlat' diyebilirsin.";
    }

    const rowsHTML = STAT_ROWS.map((r) => {
      const wv = stats.counts.w[r.key] || 0;
      const bv = stats.counts.b[r.key] || 0;
      let iconUrl = "";
      try {
        iconUrl = chrome.runtime.getURL("analysis_icons/" + r.icon + ".png");
      } catch (_) {}
      return (
        `<tr><td class="forksight-summary-num">${wv}</td>` +
        `<td class="forksight-summary-lab">` +
        (iconUrl
          ? `<img src="${iconUrl}" alt="" class="forksight-summary-ico"/>`
          : "") +
        `<span>${T(r.trLabel)}</span></td>` +
        `<td class="forksight-summary-num">${bv}</td></tr>`
      );
    }).join("");

    mount(`
      <button class="forksight-review-close" aria-label="${T("Kapat")}">×</button>
      <button class="forksight-review-lang" id="forksight-review-lang" title="${T("Dil")}" aria-label="${T("Dil")}">🌐 <span class="forksight-review-lang-code">${window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr" ? "TR" : "EN"}</span></button>
      <button class="forksight-review-tts" id="forksight-review-tts" title="${T("Sesli oku")}"
        aria-pressed="${_ttsEnabled}">
        <span class="forksight-tts-ico">${_ttsEnabled ? "🔊" : "🔈"}</span>
      </button>
      <div class="forksight-review-summary">
        <header class="forksight-review-meta">
          <div class="forksight-review-player">
            <span class="forksight-review-dot forksight-review-dot--w"></span>
            <span class="forksight-review-pname">${whiteName}</span>
            <span class="forksight-review-prating">${esc(whitePlayer.rating || headers.WhiteElo || "")}</span>
          </div>
          <div class="forksight-review-vs">vs</div>
          <div class="forksight-review-player">
            <span class="forksight-review-dot forksight-review-dot--b"></span>
            <span class="forksight-review-pname">${blackName}</span>
            <span class="forksight-review-prating">${esc(blackPlayer.rating || headers.BlackElo || "")}</span>
          </div>
        </header>
        <div class="forksight-review-result">
          <span class="forksight-review-resnum">${esc(result)}</span>
          <span class="forksight-review-resmsg">${esc(game.resultMessage || headers.Termination || "")}</span>
        </div>

        <div class="forksight-summary-coach">
          <img class="forksight-summary-av" id="forksight-summary-av" alt="" />
          <div class="forksight-summary-bubble">
            <span id="forksight-summary-text"></span>
            <span class="forksight-summary-caret">▌</span>
          </div>
        </div>

        <div class="forksight-summary-graph ${flip ? "forksight-summary-graph--flip" : ""}">
          ${graphSVG}
        </div>

        <table class="forksight-summary-stats">
          <thead>
            <tr>
              <th>${whiteName}</th>
              <th></th>
              <th>${blackName}</th>
            </tr>
            <tr class="forksight-summary-acc">
              <td class="forksight-summary-num">${fmtAcc(stats.accuracy.w)}</td>
              <td class="forksight-summary-lab"><span>${T("Doğruluk")}</span></td>
              <td class="forksight-summary-num">${fmtAcc(stats.accuracy.b)}</td>
            </tr>
          </thead>
          <tbody>
            ${rowsHTML}
          </tbody>
        </table>

        <button class="forksight-summary-start" id="forksight-summary-start">
          → ${T("İncelemeyi Başlat")}
        </button>
      </div>
    `);

    try {
      modalEl.querySelector("#forksight-summary-av").src =
        chrome.runtime.getURL("avatars/thinking.png");
    } catch (_) {}

    const textEl = modalEl.querySelector("#forksight-summary-text");
    typewriter(textEl, coachLine, 28);
    speak(coachLine);

    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);

    // Dil değiştirici (summary)
    const langBtnS = modalEl.querySelector("#forksight-review-lang");
    if (langBtnS && window.ForkSightI18n) {
      langBtnS.addEventListener("click", () => {
        window.ForkSightI18n.toggleLang().then((newLang) => {
          const codeEl = langBtnS.querySelector(".forksight-review-lang-code");
          if (codeEl) codeEl.textContent = newLang === "tr" ? "TR" : "EN";
          // Re-render the summary so all T()'d labels update.
          renderSummary(parsed, data, pre);
        });
      });
    }

    const ttsBtn = modalEl.querySelector("#forksight-review-tts");
    ttsBtn.addEventListener("click", () => {
      setTTSEnabled(!_ttsEnabled);
      ttsBtn.setAttribute("aria-pressed", _ttsEnabled ? "true" : "false");
      ttsBtn.querySelector(".forksight-tts-ico").textContent = _ttsEnabled
        ? "🔊"
        : "🔈";
      if (_ttsEnabled) speak(textEl.textContent || coachLine);
    });

    modalEl
      .querySelector("#forksight-summary-start")
      .addEventListener("click", () => {
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        renderReview(parsed, data, pre);
      });
  }

  function renderReview(parsed, data, pre) {
    const game = data.game || {};
    const headers = game.pgnHeaders || {};
    // Re-use the pre-analyzed timeline if openReview already built it,
    // otherwise fall back to decoding here (keeps the function callable
    // standalone for debugging).
    const moves = pre && pre.timeline ? null : decodeTCN(game.moveList || "");
    const timeline = pre && pre.timeline ? pre.timeline : buildTimeline(moves);
    const timestamps = parseTimestamps(game.moveTimestamps);

    const top = (data.players && data.players.top) || {};
    const bottom = (data.players && data.players.bottom) || {};
    const whitePlayer = bottom.color === "white" ? bottom : top;
    const blackPlayer = bottom.color === "white" ? top : bottom;
    // Viewer side comes from pickViewerSide(). "w" / "b" → personalised
    // narration + board oriented with viewer at the bottom. null → neutral
    // commentary, board defaults to white-on-bottom.
    const viewerSide = (pre && pre.viewerSide) || null;
    const flipBoard = viewerSide === "b";

    // ── Endgame badge metadata ─────────────────────────────────────────
    // Detect winner + how the game ended so the final-ply board overlay
    // can show chess.com-style icons over each king (trophy on the
    // winner, flag/clock on the loser). Recomputed once per review.
    const endgame = computeEndgame(headers, game, timeline);

    const result =
      headers.Result ||
      (game.colorOfWinner
        ? game.colorOfWinner === "white"
          ? "1-0"
          : "0-1"
        : "—");

    // Build paired-row move list with explicit ply indices for navigation.
    const sanRows = [];
    for (let i = 1; i < timeline.length; i += 2) {
      sanRows.push({
        n: timeline[i].moveNo,
        w: { ply: i, san: timeline[i].san },
        b: timeline[i + 1] ? { ply: i + 1, san: timeline[i + 1].san } : null,
      });
    }

    // ── Player rows ────────────────────────────────────────────────────
    // Build top/bottom player metadata: the bottom row is the viewer
    // (or white if no viewer side detected), the top row is the
    // opponent. Used by the chess.com-style player strips that sit
    // above and below the board.
    const bottomColor = flipBoard ? "b" : "w";
    const topColor = flipBoard ? "w" : "b";
    const bottomPlayerObj = bottomColor === "w" ? whitePlayer : blackPlayer;
    const topPlayerObj = bottomColor === "w" ? blackPlayer : whitePlayer;
    const playerAvatarFor = (p) =>
      (p && (p.avatarUrl || p.avatar || p.image)) ||
      chrome.runtime.getURL("avatars/neutral.png");
    const playerNameFor = (p, color) =>
      esc(
        (p && p.username) ||
          (color === "w" ? headers.White || "Beyaz" : headers.Black || "Siyah"),
      );
    const playerRatingFor = (p, color) =>
      esc(
        (p && p.rating) ||
          (color === "w" ? headers.WhiteElo || "" : headers.BlackElo || ""),
      );
    const tcInfo = parseTimeControl(headers.TimeControl);
    const baseClockSecs = tcInfo.base || 0;
    const renderPlayerRow = (pos, color, p) => {
      // Mark the row with the username so a post-mount async pass can
      // upgrade the avatar from chess.com's public API (callback responses
      // sometimes omit `avatarUrl` even when the player has uploaded one,
      // which made every row show our fallback fox).
      const uname = (p && p.username) || "";
      return `
      <div class="forksight-rb-player" data-pos="${pos}" data-color="${color}">
        <img class="forksight-rb-player-av"
             src="${playerAvatarFor(p)}"
             data-fs-username="${esc(uname)}"
             alt="" />
        <div class="forksight-rb-player-mid">
          <div class="forksight-rb-player-name">
            <span>${playerNameFor(p, color)}</span>
            <span class="forksight-rb-player-rating">${
              playerRatingFor(p, color)
                ? "(" + playerRatingFor(p, color) + ")"
                : ""
            }</span>
          </div>
          <div class="forksight-rb-player-cap"
               id="forksight-rb-cap-${pos}"></div>
        </div>
        <div class="forksight-rb-player-clock"
             id="forksight-rb-clk-${pos}">${esc(formatClock(baseClockSecs))}</div>
      </div>`;
    };

    mount(`
      <button class="forksight-review-close" aria-label="${T("Kapat")}">×</button>
      <button class="forksight-review-lang" id="forksight-review-lang" title="${T("Dil")}" aria-label="${T("Dil")}">🌐 <span class="forksight-review-lang-code">${window.ForkSightI18n && window.ForkSightI18n.getLang() === "tr" ? "TR" : "EN"}</span></button>
      <button class="forksight-review-tts" id="forksight-review-tts" title="${T("Sesli oku")}"
        aria-pressed="${_ttsEnabled}">
        <span class="forksight-tts-ico">${_ttsEnabled ? "🔊" : "🔈"}</span>
      </button>
      <div class="forksight-review-layout">
        <aside class="forksight-review-board">
          <div class="forksight-rb-wrap">
            ${renderPlayerRow("top", topColor, topPlayerObj)}
            <div class="forksight-rb-boardrow${flipBoard ? " forksight-rb-boardrow--flip" : ""}">
              <div class="forksight-rb-bar" id="forksight-rb-bar" title="${T("Değerlendirme çubuğu")}">
                <div class="forksight-rb-bar-black" id="forksight-rb-bar-black" style="height:50%"></div>
                <div class="forksight-rb-bar-white" id="forksight-rb-bar-white" style="height:50%"></div>
                <div class="forksight-rb-bar-tick"></div>
                <div class="forksight-rb-bar-label" id="forksight-rb-bar-label">0.0</div>
              </div>
              <div class="forksight-rb-host" id="forksight-rb-host"></div>
            </div>
            <div class="forksight-rb-nav">
              <button class="forksight-rb-btn" data-nav="start" title="${T("Başa")}">⏮</button>
              <button class="forksight-rb-btn" data-nav="prev" title="${T("Geri")}">◀</button>
              <span class="forksight-rb-counter" id="forksight-rb-counter">0 / ${timeline.length - 1}</span>
              <button class="forksight-rb-btn" data-nav="next" title="${T("İleri")}">▶</button>
              <button class="forksight-rb-btn" data-nav="end" title="${T("Sona")}">⏭</button>
            </div>
            ${renderPlayerRow("bottom", bottomColor, bottomPlayerObj)}
          </div>
        </aside>
        <section class="forksight-review-side">
          <header class="forksight-review-meta">
            <div class="forksight-review-player">
              <span class="forksight-review-dot forksight-review-dot--w"></span>
              <span class="forksight-review-pname">${esc(whitePlayer.username || headers.White || T("Beyaz"))}</span>
              <span class="forksight-review-prating">${esc(whitePlayer.rating || headers.WhiteElo || "")}</span>
            </div>
            <div class="forksight-review-vs">vs</div>
            <div class="forksight-review-player">
              <span class="forksight-review-dot forksight-review-dot--b"></span>
              <span class="forksight-review-pname">${esc(blackPlayer.username || headers.Black || T("Siyah"))}</span>
              <span class="forksight-review-prating">${esc(blackPlayer.rating || headers.BlackElo || "")}</span>
            </div>
          </header>
          <div class="forksight-review-result">
            <span class="forksight-review-resnum">${esc(result)}</span>
            <span class="forksight-review-resmsg">${esc(game.resultMessage || headers.Termination || "")}</span>
          </div>
          <div class="forksight-review-meta-row">
            <span>${esc(headers.Event || "Live Chess")}</span>
            <span>${esc(headers.TimeControl || "")}</span>
            <span>${esc(headers.Date || "")}</span>
            <span>${esc(headers.ECO || "")}</span>
          </div>
          <div class="forksight-review-narration" id="forksight-review-narration">
            <img class="forksight-review-narration-av" id="forksight-narration-av" alt="" />
            <div class="forksight-review-narration-text" id="forksight-narration-text">
              ${T("Başlangıç pozisyonu. Sağdaki hamleye veya ileri/geri tuşlarına tıklayarak oyunu dolaş.")}
            </div>
          </div>
          <h4 class="forksight-review-mlh">${T("Hamleler")}</h4>
          <ol class="forksight-review-moves" id="forksight-review-moves">
            ${sanRows
              .map(
                (r) => `
              <li>
                <span class="forksight-review-mn">${r.n}.</span>
                <span class="forksight-review-mw" data-ply="${r.w.ply}">${esc(r.w.san || "")}</span>
                <span class="forksight-review-mb" data-ply="${r.b ? r.b.ply : ""}">${esc(r.b ? r.b.san || "" : "")}</span>
              </li>`,
              )
              .join("")}
          </ol>
        </section>
      </div>
    `);

    // ─── Wire up interactive viewer ────────────────────────────────────
    const hostEl = modalEl.querySelector("#forksight-rb-host");
    const counterEl = modalEl.querySelector("#forksight-rb-counter");
    // evalValEl: kept as a no-op placeholder so existing assignments
    // don't crash now that the "STOCKFISH:" label was removed from the
    // template (the bar itself already conveys the eval).
    const evalValEl = { textContent: "" };
    const barWhiteEl = modalEl.querySelector("#forksight-rb-bar-white");
    const barBlackEl = modalEl.querySelector("#forksight-rb-bar-black");
    const barLabelEl = modalEl.querySelector("#forksight-rb-bar-label");
    const narrAvEl = modalEl.querySelector("#forksight-narration-av");
    const narrTextEl = modalEl.querySelector("#forksight-narration-text");
    const movesListEl = modalEl.querySelector("#forksight-review-moves");
    const closeBtn = modalEl.querySelector(".forksight-review-close");
    // Player-row dynamic targets (captured pieces + clocks).
    const capTopEl = modalEl.querySelector("#forksight-rb-cap-top");
    const capBottomEl = modalEl.querySelector("#forksight-rb-cap-bottom");
    const clkTopEl = modalEl.querySelector("#forksight-rb-clk-top");
    const clkBottomEl = modalEl.querySelector("#forksight-rb-clk-bottom");
    closeBtn.addEventListener("click", close);

    // Upgrade player avatars from chess.com's public API. Chess.com's
    // /callback/live/game/{id} response occasionally returns an empty
    // `avatarUrl` (e.g. when the requester isn't signed in to the game
    // room), which made every row fall back to our fox. The public
    // /pub/player/{username} endpoint reliably exposes the real avatar
    // and doesn't require auth or CORS gymnastics.
    _upgradePlayerAvatars(modalEl);

    // Dil değiştirici (🌐) — kullanıcı dilini değiştirir; mevcut görünüm
    // bir sonraki açılışta yeni dili gösterir. Anlatım metinleri Phase 2'de
    // çevrilecek; bu yüzden burada hard reload yapmıyoruz.
    const langBtn = modalEl.querySelector("#forksight-review-lang");
    if (langBtn && window.ForkSightI18n) {
      langBtn.addEventListener("click", () => {
        window.ForkSightI18n.toggleLang().then((newLang) => {
          const codeEl = langBtn.querySelector(".forksight-review-lang-code");
          if (codeEl) codeEl.textContent = newLang === "tr" ? "TR" : "EN";
          // Re-render the viewer so all static labels ("HAMLELER",
          // narration prefix etc.) reflect the new language. We stash
          // the current ply on the closure so goTo() can restore it.
          const savedPly = currentPly;
          renderReview(parsed, data, { ...(pre || {}), _restorePly: savedPly });
        });
      });
    }

    // TTS toggle (top-right). State persists in localStorage.
    const ttsBtn = modalEl.querySelector("#forksight-review-tts");
    if (ttsBtn) {
      ttsBtn.addEventListener("click", () => {
        setTTSEnabled(!_ttsEnabled);
        ttsBtn.setAttribute("aria-pressed", _ttsEnabled ? "true" : "false");
        ttsBtn.querySelector(".forksight-tts-ico").textContent = _ttsEnabled
          ? "🔊"
          : "🔈";
        if (_ttsEnabled && narrTextEl) speak(narrTextEl.textContent || "");
      });
    }

    let currentPly = 0;
    // Seed caches from openReview's pre-analysis pass when available.
    const evalCache =
      pre && pre.evalCache
        ? pre.evalCache.slice()
        : new Array(timeline.length).fill(null); // white-POV pawn eval
    const catCache =
      pre && pre.catCache
        ? pre.catCache.slice()
        : new Array(timeline.length).fill(null); // narration category
    let analyzeToken = 0; // bumps on every nav so stale responses are dropped

    const avatarUrl = (state) => {
      try {
        return chrome.runtime.getURL("avatars/" + state + ".png");
      } catch (_) {
        return "";
      }
    };
    narrAvEl.src = avatarUrl("neutral");

    function renderBoard() {
      const step = timeline[currentPly];
      // Pull the engine's preferred move for the position *before* the
      // current ply was played, so the arrow shows "what should have
      // happened" rather than what did. Skipped on ply 0 (starting
      // position has no prior move to second-guess).
      const prevStep = currentPly > 0 ? timeline[currentPly - 1] : null;
      const prevFen = prevStep ? prevStep.fen : null;
      const bestUci = prevFen ? _bestMoveByFen.get(prevFen) : null;
      const playerUci =
        step.from && step.to
          ? step.from + step.to + (step.promotion || "")
          : "";
      hostEl.innerHTML = buildBoardSVG(
        step,
        flipBoard,
        catCache[currentPly],
        bestUci,
        prevFen,
        playerUci,
        endgame && currentPly === endgame.finalPly ? endgame : null,
      );
      counterEl.textContent = currentPly + " / " + (timeline.length - 1);

      // ── Captured-piece & clock strips ────────────────────────────────
      // The board state changes every ply, so refresh the chess.com-
      // style player rows: opponent on top, viewer on bottom. Each shows
      // material captured *from* the other side, plus the clock at the
      // moment that ply was played.
      const caps = capturedCounts(step.pos.board);
      // The "top" row's captures are what the top-row color took.
      if (capTopEl) {
        capTopEl.innerHTML = renderCapturedRow(
          topColor === "w" ? caps.byWhite : caps.byBlack,
          topColor,
          caps.delta,
        );
      }
      if (capBottomEl) {
        capBottomEl.innerHTML = renderCapturedRow(
          bottomColor === "w" ? caps.byWhite : caps.byBlack,
          bottomColor,
          caps.delta,
        );
      }
      const clk = clocksAtPly(timestamps, currentPly, baseClockSecs);
      if (clkTopEl) {
        clkTopEl.textContent = formatClock(topColor === "w" ? clk.w : clk.b);
      }
      if (clkBottomEl) {
        clkBottomEl.textContent = formatClock(
          bottomColor === "w" ? clk.w : clk.b,
        );
      }
      // Mark the side whose turn it is (about to move from this position).
      const sideToMove = step.pos && step.pos.turn;
      [
        ["top", topColor],
        ["bottom", bottomColor],
      ].forEach(([pos, color]) => {
        const row = modalEl.querySelector(
          `.forksight-rb-player[data-pos="${pos}"]`,
        );
        if (row)
          row.classList.toggle(
            "forksight-rb-player--active",
            sideToMove === color,
          );
      });

      // Highlight active move in list
      movesListEl
        .querySelectorAll(".forksight-review-mw, .forksight-review-mb")
        .forEach((el) => el.classList.remove("forksight-review-active"));
      if (currentPly > 0) {
        const active = movesListEl.querySelector(
          '[data-ply="' + currentPly + '"]',
        );
        if (active) {
          active.classList.add("forksight-review-active");
          // Auto-scroll into view
          const liRect = active.getBoundingClientRect();
          const listRect = movesListEl.getBoundingClientRect();
          if (liRect.top < listRect.top || liRect.bottom > listRect.bottom) {
            active.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }
      }
    }

    // Show eval from the viewer's perspective when a side was picked,
    // otherwise default to White-POV (classic engine convention).
    function fmtEval(whiteEval) {
      if (whiteEval == null) return "—";
      const sign = viewerSide === "b" ? -1 : 1;
      const v = whiteEval * sign;
      if (Math.abs(v) >= 25) return v > 0 ? "+M" : "-M";
      return (v >= 0 ? "+" : "") + v.toFixed(2);
    }

    // Chess.com/Lichess-style vertical bar. White grows from the bottom
    // when White is winning. If the viewer chose Black, CSS flips the bar
    // so the viewer's color is always on the bottom (matches flipped board).
    function updateEvalBar(whiteEval) {
      if (whiteEval == null) {
        barWhiteEl.style.height = "50%";
        barBlackEl.style.height = "50%";
        barLabelEl.textContent = "…";
        barLabelEl.dataset.side = "";
        return;
      }
      const wp = winProb(whiteEval); // 0..100, White win %
      const clamped = Math.max(2, Math.min(98, wp));
      barWhiteEl.style.height = clamped + "%";
      barBlackEl.style.height = 100 - clamped + "%";
      // Label sits on the side of whoever is losing (chess.com behavior).
      const sign = viewerSide === "b" ? -1 : 1;
      const v = whiteEval * sign;
      let txt;
      if (Math.abs(whiteEval) >= 25) {
        txt = v > 0 ? "M" : "-M";
      } else {
        txt = (v >= 0 ? "+" : "") + v.toFixed(1);
      }
      barLabelEl.textContent = txt;
      barLabelEl.dataset.side = whiteEval >= 0 ? "w" : "b";
    }

    async function refreshEvalAndNarration() {
      const myToken = ++analyzeToken;
      const ply = currentPly;
      const step = timeline[ply];

      // Determine eval (cached or fetch)
      let curEvalWhite = evalCache[ply];
      if (curEvalWhite == null) {
        evalValEl.textContent = "…";
        // Keep the bar at its previous position while fetching; only the
        // label hints that a new eval is being computed.
        barLabelEl.textContent = "…";
        curEvalWhite = await analyzeFen(step.fen, REVIEW_DEPTH);
        if (myToken !== analyzeToken) return; // user navigated away
        evalCache[ply] = curEvalWhite;
      }
      evalValEl.textContent = fmtEval(curEvalWhite);
      updateEvalBar(curEvalWhite);

      // Narration: requires the previous ply's eval as a baseline.
      if (ply === 0) {
        narrAvEl.src = avatarUrl("neutral");
        const startText = T(
          "Başlangıç pozisyonu. Sağdaki hamleye veya ileri/geri tuşlarına tıklayarak oyunu dolaş.",
        );
        typewriter(narrTextEl, startText, 22);
        speak(startText);
        return;
      }

      let prevEvalWhite = evalCache[ply - 1];
      if (prevEvalWhite == null) {
        prevEvalWhite = await analyzeFen(timeline[ply - 1].fen, REVIEW_DEPTH);
        if (myToken !== analyzeToken) return;
        evalCache[ply - 1] = prevEvalWhite;
      }

      // Categorize from the *mover's* perspective. step.side === "w" means
      // white just made a move on ply N — so the mover's eval is +whiteEval.
      const moverSign = step.side === "w" ? +1 : -1;
      const perspective = !viewerSide
        ? "neutral"
        : step.side === viewerSide
          ? "self"
          : "opp";
      const cat = categorize(
        prevEvalWhite == null ? null : prevEvalWhite * moverSign,
        curEvalWhite == null ? null : curEvalWhite * moverSign,
        ply,
      );
      // "best" / "great" / "brilliant" all imply "engine agreed this was
      // the move" — but `categorize` only looks at win-prob delta, so any
      // near-zero-loss reply qualifies as "best" even when Stockfish's #1
      // was a totally different (and stronger) move. Downgrade to "good"
      // when the player's move didn't match the engine pick, so the
      // narration stops falsely claiming "bundan daha iyisi yoktu".
      const _prevFenForCat = timeline[ply - 1] && timeline[ply - 1].fen;
      const _bestUciForCat = _prevFenForCat
        ? _bestMoveByFen.get(_prevFenForCat)
        : null;
      const _playerUciForCat =
        step.from && step.to
          ? step.from + step.to + (step.promotion || "")
          : "";
      const _matchedEngine =
        _bestUciForCat &&
        _playerUciForCat &&
        _bestUciForCat.slice(0, 4) === _playerUciForCat.slice(0, 4);
      let catFinal = cat;
      if (
        !_matchedEngine &&
        (cat === "best" || cat === "great" || cat === "brilliant")
      ) {
        catFinal = "good";
      }
      // Cache + redraw board so the category badge appears on the
      // destination square as soon as the eval comes back.
      if (catCache[ply] !== catFinal) {
        catCache[ply] = catFinal;
        if (ply === currentPly) renderBoard();
      }
      const picked = pickLine(catFinal, perspective);
      // 2nd-person prefix when viewer chose a side, neutral otherwise.
      let prefix;
      if (viewerSide && step.side === viewerSide) {
        prefix = T("{n}. hamleniz ({san}): ")
          .replace("{n}", step.moveNo)
          .replace("{san}", step.san);
      } else if (viewerSide && step.side !== viewerSide) {
        prefix = T("Rakibinizin {n}. hamlesi ({san}): ")
          .replace("{n}", step.moveNo)
          .replace("{san}", step.san);
      } else {
        const moverKey =
          step.side === "w"
            ? "Beyaz {n}. hamle ({san}): "
            : "Siyah {n}. hamle ({san}): ";
        prefix = T(moverKey)
          .replace("{n}", step.moveNo)
          .replace("{san}", step.san);
      }
      const hint = contextualHint(
        timeline[ply - 1],
        step,
        prevEvalWhite,
        curEvalWhite,
        perspective,
      );
      // Engine best-move hint ("Daha iyisi vardı: …") — only for blunder/
      // mistake/inaccuracy. Uses the per-FEN best move captured during
      // pre-analysis (or rehydrated from the server cache).
      const prevFen = timeline[ply - 1] && timeline[ply - 1].fen;
      const bestUci = prevFen ? _bestMoveByFen.get(prevFen) : null;
      const playerUci =
        step.from && step.to
          ? step.from + step.to + (step.promotion || "")
          : "";
      const engineHint = bestMoveHint(
        prevFen,
        bestUci,
        playerUci,
        catFinal,
        perspective,
      );
      // ── Narration assembly ──
      // For sub-optimal moves (blunder/mistake/inaccuracy) where we have
      // a concrete engine suggestion, REPLACE the generic category line
      // (e.g. "İdeal değil; daha sağlam bir seçenek vardı.") with a
      // tactical WHY + the specific better move. This kills the old
      // "daha sağlam" + "Daha iyisi vardı" redundancy and makes the
      // commentary read like a friend pointing at the board.
      const isSubOptimal =
        catFinal === "blunder" ||
        catFinal === "mistake" ||
        catFinal === "inaccuracy";
      const parts = [];
      if (isSubOptimal && engineHint) {
        const why = mistakeWhy(
          timeline[ply - 1],
          step,
          prevEvalWhite,
          curEvalWhite,
          bestUci,
          perspective,
        );
        if (why) parts.push(why);
        else parts.push(picked.text); // fall back to soft generic line
        parts.push(engineHint);
      } else {
        parts.push(picked.text);
        if (hint) parts.push(hint);
        if (engineHint) parts.push(engineHint);
      }
      const spokenText = parts.join(" ");
      const displayText = prefix + spokenText;
      typewriter(narrTextEl, displayText, 22);
      narrAvEl.src = avatarUrl(picked.emotion);
      speak(spokenText);
    }

    function goTo(ply) {
      ply = Math.max(0, Math.min(timeline.length - 1, ply));
      if (ply === currentPly) return;
      currentPly = ply;
      renderBoard();
      refreshEvalAndNarration();
    }

    // Nav buttons
    modalEl.querySelectorAll(".forksight-rb-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.dataset.nav;
        if (a === "start") goTo(0);
        else if (a === "prev") goTo(currentPly - 1);
        else if (a === "next") goTo(currentPly + 1);
        else if (a === "end") goTo(timeline.length - 1);
      });
    });

    // Move list clicks
    movesListEl.addEventListener("click", (e) => {
      const el = e.target.closest("[data-ply]");
      if (!el) return;
      const p = parseInt(el.dataset.ply, 10);
      if (isFinite(p)) goTo(p);
    });

    // Keyboard navigation (left/right arrows)
    const onKey = (e) => {
      if (!modalEl) {
        document.removeEventListener("keydown", onKey);
        return;
      }
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(currentPly - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(currentPly + 1);
      } else if (e.key === "Home") {
        goTo(0);
      } else if (e.key === "End") {
        goTo(timeline.length - 1);
      }
    };
    document.addEventListener("keydown", onKey);

    // Initial render: position 0, no eval text needed; narration uses default.
    renderBoard();
    // Start the eval load for ply 0 in the background (also primes cache).
    refreshEvalAndNarration();
    // After a language toggle the viewer is re-rendered; restore the ply
    // the user was on so navigation isn't reset.
    if (pre && typeof pre._restorePly === "number" && pre._restorePly > 0) {
      goTo(pre._restorePly);
    }
  }

  // ─── Profile (placeholder using stored creds) ────────────────────────
  function openProfile() {
    let user = "—";
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem("taktik_user") || "null");
    } catch (_) {}
    if (raw && raw.username) user = raw.username;

    mount(`
      <button class="forksight-review-close" aria-label="Kapat">×</button>
      <div class="forksight-review-profile">
        <img class="forksight-review-profile-av" alt="" />
        <h3>${esc(user)}</h3>
        <div class="forksight-review-profile-sub">ForkSight Coach kullanıcısı</div>
        <div class="forksight-review-profile-msg">
          Detaylı profil paneli yakında — şu an sadece adın görünüyor.
        </div>
        <div class="forksight-review-actions">
          <button class="forksight-review-cancel">Kapat</button>
        </div>
      </div>
    `);
    try {
      modalEl.querySelector(".forksight-review-profile-av").src =
        chrome.runtime.getURL("avatars/happy.png");
    } catch (_) {}
    modalEl
      .querySelector(".forksight-review-close")
      .addEventListener("click", close);
    modalEl
      .querySelector(".forksight-review-cancel")
      .addEventListener("click", close);
  }

  // ─── Public API ──────────────────────────────────────────────────────
  window.ForkSightReview = {
    open: () => openPrompt(),
    openWithUrl: (u) => openUrlPrompt(u),
    openWithPgn: (p, notice) => openPgnPrompt(p, notice),
    openProfile,
    // Exposed for future chunks / debugging:
    _decodeTCN: decodeTCN,
    _parseGameUrl: parseGameUrl,
    _fetchLiveGame: fetchLiveGame,
    _fetchDailyGame: fetchDailyGame,
    _fetchGame: fetchGame,
    _buildTimeline: buildTimeline,
    _positionToFen: positionToFen,
    _fenToPosition: fenToPosition,
    _buildBoardSVG: buildBoardSVG,
    _analyzeFen: analyzeFen,
    _openPgnReview: openPgnReview,
    _parsePgn: parsePgn,
    _pgnToMoves: pgnToMoves,
    _sanToUci: sanToUci,
  };
})();
