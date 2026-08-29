/**
 * ForkSight Learn — müfredat
 * FEN: sıra 8 → 1 (son satır = 1. yatay). Piyonlar 2. yatayda (e2), diğer beyaz taşlar 1. yatayda.
 */
(function () {
  "use strict";

  const L = (tr, en) => ({ tr, en });

  // Kısa FEN parçaları (doğrulama için)
  // rank2 piyon e2: 8/8/8/8/8/8/4P3/8
  // rank1 şah e1:   8/8/8/8/8/8/8/4K3
  // rank1 kale a1:  8/8/8/8/8/8/8/R7
  // rank1 fil c1:   8/8/8/8/8/8/8/2B5
  // rank1 at b1:    8/8/8/8/8/8/8/1N6
  // rank1 vezir d1: 8/8/8/8/8/8/8/3Q4

  const LESSONS = {
    king: {
      id: "king",
      piece: "K",
      icon: "♔",
      title: L("Şah", "The King"),
      mapLabel: L("Şah", "King"),
      intro: L(
        "Şahla başlayalım — oyundaki en önemli taş.",
        "Let's start with the king, the most important piece in the game.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/8/8/8/8/4K3 w - - 0 1",
          text: L(
            "Şah başlangıçta 1. yatayda durur — örneğin e1.",
            "The king starts on the back rank — for example e1.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/8/8/4K3 w - - 0 1",
          text: L(
            "Şah her yönde yalnızca bir kare gidebilir.",
            "The king can move only one square in any direction.",
          ),
          arrows: [
            ["e1", "d1"],
            ["e1", "d2"],
            ["e1", "e2"],
            ["e1", "f2"],
            ["e1", "f1"],
          ],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/4K3 w - - 0 1",
          star: "e2",
          path: ["e1e2"],
          movable: "e1",
          text: L("Şahını yıldıza sürükle.", "Drag your king to capture the star."),
          success: L("Harika!", "Nice!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/4K3/8 w - - 0 1",
          star: "f3",
          path: ["e2f3"],
          movable: "e2",
          text: L("Şimdi bir sonraki yıldızı al.", "Nice! Now capture the next star."),
          success: L("Süper!", "Great!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/5K2/8/8 w - - 0 1",
          star: "g4",
          path: ["f3g4"],
          movable: "f3",
          text: L("Son yıldız — bitirmek için al!", "One more star — capture it to finish!"),
          success: L("Mükemmel!", "Perfect!"),
        },
      ],
      complete: L(
        "Aferin! Artık şahın nasıl hareket ettiğini biliyorsun.",
        "Good job! Now you know how to move the king.",
      ),
    },

    pawn: {
      id: "pawn",
      piece: "P",
      icon: "♙",
      title: L("Piyon", "The Pawn"),
      mapLabel: L("Piyon", "Pawn"),
      intro: L(
        "Piyonlar 2. yataydan başlar — beyaz için e2, d2 gibi.",
        "Pawns start on the second rank — e2, d2, and so on for White.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/8/8/8/4P3/8 w - - 0 1",
          text: L(
            "Piyonlar yalnızca ileri gider; geri gidemezler.",
            "Pawns only move forward — never backward.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/8/4P3/8 w - - 0 1",
          text: L(
            "İlk hamlede piyon bir veya iki kare ilerleyebilir.",
            "On its first move, a pawn can go one or two squares forward.",
          ),
          arrows: [
            ["e2", "e3"],
            ["e2", "e4"],
          ],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/4P3/8 w - - 0 1",
          star: "e4",
          path: ["e2e4"],
          movable: "e2",
          text: L("Piyonunu iki kare ileri sür (e4).", "Push your pawn two squares forward (e4)."),
          success: L("Güzel!", "Well done!"),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/3p4/4P3/8 w - - 0 1",
          text: L(
            "Piyonlar çapraz alır — yalnızca rakip taşı yiyebilir.",
            "Pawns capture diagonally — only onto an enemy piece.",
          ),
          arrows: [["e2", "d3"]],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/3p4/4P3/8 w - - 0 1",
          star: "d3",
          path: ["e2d3"],
          movable: "e2",
          text: L("Rakip piyonu çapraz al.", "Capture the enemy pawn diagonally."),
          success: L("Doğru!", "Correct!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/4P3/8 w - - 0 1",
          star: "e3",
          path: ["e2e3"],
          movable: "e2",
          text: L("Bir kare ileri gitmeyi de dene.", "Try moving just one square forward."),
          success: L("Tamam!", "Got it!"),
        },
      ],
      complete: L(
        "Piyon hareketlerini öğrendin — 2. yataydan başla, ileri ve çapraz al!",
        "You learned pawns — they start on the second rank, move forward, and capture diagonally!",
      ),
    },

    rook: {
      id: "rook",
      piece: "R",
      icon: "♖",
      title: L("Kale", "The Rook"),
      mapLabel: L("Kale", "Rook"),
      intro: L(
        "Kale köşelerde başlar — a1 ve h1.",
        "Rooks start in the corners — a1 and h1.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
          text: L(
            "Kale yatay ve dikeyde istediği kadar gidebilir.",
            "The rook can slide any number of squares along ranks and files.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
          text: L("Düz hatlarda kayar.", "It slides along straight lines."),
          arrows: [
            ["a1", "a5"],
            ["a1", "h1"],
            ["a1", "a8"],
          ],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
          star: "a5",
          path: ["a1a5"],
          movable: "a1",
          text: L("Kaleyi a5'e götür.", "Slide the rook to a5."),
          success: L("Harika!", "Nice!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/R7 w - - 0 1",
          star: "h1",
          path: ["a1h1"],
          movable: "a1",
          text: L("Şimdi h1 karesine kaydır.", "Now slide to h1 along the first rank."),
          success: L("Tam isabet!", "Spot on!"),
        },
      ],
      complete: L(
        "Kaleyi öğrendin — dosya ve yatayda uzun menzil!",
        "You mastered the rook — long range on files and ranks!",
      ),
    },

    bishop: {
      id: "bishop",
      piece: "B",
      icon: "♗",
      title: L("Fil", "The Bishop"),
      mapLabel: L("Fil", "Bishop"),
      intro: L(
        "Filler c1 ve f1'de başlar — hep aynı renk karede kalır.",
        "Bishops start on c1 and f1 — they always stay on the same color squares.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/8/8/8/8/2B5 w - - 0 1",
          text: L(
            "Fil çaprazda istediği kadar gidebilir.",
            "The bishop can slide any number of squares diagonally.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/8/8/2B5 w - - 0 1",
          text: L("Çapraz hatları kullanır.", "It uses diagonal paths."),
          arrows: [
            ["c1", "f4"],
            ["c1", "a3"],
            ["c1", "g5"],
          ],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/2B5 w - - 0 1",
          star: "f4",
          path: ["c1f4"],
          movable: "c1",
          text: L("Fili f4'e götür.", "Move the bishop to f4."),
          success: L("Güzel!", "Well done!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/2B5 w - - 0 1",
          star: "a3",
          path: ["c1a3"],
          movable: "c1",
          text: L("Diğer çapraza git.", "Go along the other diagonal."),
          success: L("Mükemmel!", "Perfect!"),
        },
      ],
      complete: L(
        "Fil hareketini kavradın — çapraz güç!",
        "You grasped the bishop — diagonal power!",
      ),
    },

    knight: {
      id: "knight",
      piece: "N",
      icon: "♘",
      title: L("At", "The Knight"),
      mapLabel: L("At", "Knight"),
      intro: L(
        "Atlar b1 ve g1'de başlar — L şeklinde zıplar.",
        "Knights start on b1 and g1 — they jump in an L-shape.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/8/8/8/8/1N6 w - - 0 1",
          text: L(
            "At iki kare düz, bir kare yana gider.",
            "The knight moves two squares straight, then one square sideways.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/8/8/1N6 w - - 0 1",
          text: L(
            "Diğer taşların üzerinden atlayabilir.",
            "It can jump over other pieces.",
          ),
          arrows: [
            ["b1", "c3"],
            ["b1", "a3"],
            ["b1", "d2"],
          ],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/1N6 w - - 0 1",
          star: "c3",
          path: ["b1c3"],
          movable: "b1",
          text: L("Atı c3'e zıplat.", "Jump the knight to c3."),
          success: L("Harika!", "Nice!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/1N6 w - - 0 1",
          star: "a3",
          path: ["b1a3"],
          movable: "b1",
          text: L("Şimdi a3'e git.", "Now jump to a3."),
          success: L("Süper!", "Great!"),
        },
      ],
      complete: L(
        "Atın zıplamasını öğrendin — engelleri aşar!",
        "You learned the knight's jump — it leaps over blockers!",
      ),
    },

    queen: {
      id: "queen",
      piece: "Q",
      icon: "♕",
      title: L("Vezir", "The Queen"),
      mapLabel: L("Vezir", "Queen"),
      intro: L(
        "Vezir d1'de başlar — en güçlü taş.",
        "The queen starts on d1 — the most powerful piece.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/8/8/8/8/3Q4 w - - 0 1",
          text: L(
            "Vezir kale ve fil hareketlerinin ikisini birden yapar.",
            "The queen combines rook and bishop movement.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/8/8/8/8/3Q4 w - - 0 1",
          text: L("Düz ve çaprazda kayar.", "It slides on straight lines and diagonals."),
          arrows: [
            ["d1", "d5"],
            ["d1", "a4"],
            ["d1", "h1"],
          ],
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/3Q4 w - - 0 1",
          star: "d5",
          path: ["d1d5"],
          movable: "d1",
          text: L("Veziri d5'e götür.", "Move the queen to d5."),
          success: L("Güzel!", "Well done!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/8/8/8/8/3Q4 w - - 0 1",
          star: "a4",
          path: ["d1a4"],
          movable: "d1",
          text: L("Çaprazda a4'e git.", "Go diagonally to a4."),
          success: L("Mükemmel!", "Perfect!"),
        },
      ],
      complete: L(
        "Veziri öğrendin — tahtanın kraliçesi!",
        "You learned the queen — the ruler of the board!",
      ),
    },

    cap_rook: {
      id: "cap_rook",
      piece: "R",
      icon: "♖",
      title: L("Kaleyle Al", "Capture with the Rook"),
      mapLabel: L("Kale Al", "Rook"),
      intro: L(
        "Taşları ele geçirmek için rakibin taşının üstüne git.",
        "To capture, move your piece onto the enemy piece.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/2R2n2/8/8/8/8 w - - 0 1",
          text: L(
            "Taşları nasıl ele geçireceğini öğren.",
            "Learn how to capture pieces.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/2R2n2/8/8/8/8 w - - 0 1",
          text: L(
            "Rakip taşın karesine giderek onu alırsın.",
            "Move onto the enemy square to capture that piece.",
          ),
          arrows: [["c5", "f5"]],
        },
        {
          type: "challenge",
          fen: "8/8/8/2R2n2/8/8/8/8 w - - 0 1",
          star: "f5",
          path: ["c5f5"],
          movable: "c5",
          text: L("Hadi al onu.", "Go get it."),
          success: L("Harika!", "Nice!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/3R4/8/3b4/8/8 w - - 0 1",
          star: "d3",
          path: ["d5d3"],
          movable: "d5",
          text: L("Şimdi dikey al.", "Now capture along the file."),
          success: L("Doğru!", "Correct!"),
        },
      ],
      complete: L(
        "Kaleyle almayı öğrendin — düz hatlarda rakip taşı yiyebilirsin.",
        "You learned rook captures — take enemy pieces on ranks and files.",
      ),
    },

    cap_bishop: {
      id: "cap_bishop",
      piece: "B",
      icon: "♗",
      title: L("Fille Al", "Capture with the Bishop"),
      mapLabel: L("Fil Al", "Bishop"),
      intro: L(
        "Fil çapraz gider — uzaktaki korumasız taşı alabilirsin.",
        "The bishop moves diagonally — you can take undefended pieces far away.",
      ),
      steps: [
        {
          type: "intro",
          fen: "6r1/8/8/3B4/8/8/3n4/8 w - - 0 1",
          text: L(
            "Her taşı alamazsın — filin menzilinde ve alınabilir olmalı.",
            "You can't capture every piece — it must be on a diagonal and reachable.",
          ),
        },
        {
          type: "demo",
          fen: "6r1/8/8/3B4/8/8/3n4/8 w - - 0 1",
          text: L(
            "d5'teki fil g8'deki kaleye uzanır — at d2'ye değil.",
            "The bishop on d5 reaches the rook on g8 — not the knight on d2.",
          ),
          arrows: [["d5", "g8"]],
        },
        {
          type: "challenge",
          fen: "6r1/8/8/3B4/8/8/3n4/8 w - - 0 1",
          star: "g8",
          path: ["d5g8"],
          movable: "d5",
          text: L(
            "Hangi taşı ele geçirebilirsin?",
            "Which piece can you capture?",
          ),
          success: L("Aferin!", "Well done!"),
        },
      ],
      complete: L(
        "Fil menzilini kullandın — çaprazda uzak taşları al!",
        "You used the bishop's range — capture on diagonals!",
      ),
    },

    cap_queen: {
      id: "cap_queen",
      piece: "Q",
      icon: "♕",
      title: L("Vezirle Al", "Capture with the Queen"),
      mapLabel: L("Vezir Al", "Queen"),
      intro: L(
        "Vezir en güçlü taş — düz ve çaprazda uzak alabilir.",
        "The queen is the most powerful piece — she captures on lines and diagonals.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/7n/8/8/8/3Q4 w - - 0 1",
          text: L(
            "Vezir hem kale hem fil gibi hareket eder.",
            "The queen moves like a rook and a bishop combined.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/7n/8/8/8/3Q4 w - - 0 1",
          text: L("d1'deki vezir h5'teki ata uzanır.", "The queen on d1 reaches the knight on h5."),
          arrows: [["d1", "h5"]],
        },
        {
          type: "challenge",
          fen: "8/8/8/7n/8/8/8/3Q4 w - - 0 1",
          star: "h5",
          path: ["d1h5"],
          movable: "d1",
          text: L("Vezirle uzaktaki atı al.", "Use the queen to capture the knight."),
          success: L("Güçlü!", "Powerful!"),
        },
      ],
      complete: L(
        "Vezirle almayı öğrendin — menzilindeki taşlara dikkat et!",
        "You learned queen captures — watch pieces in her range!",
      ),
    },

    cap_pawn: {
      id: "cap_pawn",
      piece: "P",
      icon: "♙",
      title: L("Piyonla Al", "Capture with the Pawn"),
      mapLabel: L("Piyon Al", "Pawn"),
      intro: L(
        "Piyonlar yalnızca çapraz alır — ileri gidemezken alabilirsin.",
        "Pawns capture only diagonally — capture when you can't go straight.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/3p4/4P3/8/8/8 w - - 0 1",
          text: L(
            "Beyaz piyon e4'te, siyah piyon d5'te.",
            "The white pawn is on e4 and the black pawn on d5.",
          ),
        },
        {
          type: "demo",
          fen: "8/8/8/3p4/4P3/8/8/8 w - - 0 1",
          text: L(
            "Piyon ileri değil, çapraz gider — rakip piyonu al.",
            "The pawn goes diagonally, not forward — capture the enemy pawn.",
          ),
          arrows: [["e4", "d5"]],
        },
        {
          type: "challenge",
          fen: "8/8/8/3p4/4P3/8/8/8 w - - 0 1",
          star: "d5",
          path: ["e4d5"],
          movable: "e4",
          text: L(
            "Piyonla çapraz al — rakip piyonu al.",
            "Capture diagonally — take the enemy pawn.",
          ),
          success: L("Güzel!", "Well done!"),
        },
      ],
      complete: L(
        "Piyon alışını öğrendin — çapraz tek kare!",
        "You learned pawn captures — one square diagonally!",
      ),
    },

    cap_knight: {
      id: "cap_knight",
      piece: "N",
      icon: "♘",
      title: L("Atla Al", "Capture with the Knight"),
      mapLabel: L("At Al", "Knight"),
      intro: L(
        "At L şeklinde zıplar ve diğer taşların üzerinden geçer.",
        "The knight jumps in an L-shape and hops over other pieces.",
      ),
      steps: [
        {
          type: "intro",
          fen: "8/8/8/4p3/8/5N2/8/8 w - - 0 1",
          text: L(
            "Atlar engelleri umursamaz — zıplayarak alır.",
            "Knights ignore blockers — they jump to capture.",
          ),
        },
        {
          type: "challenge",
          fen: "8/8/8/4p3/8/5N2/8/8 w - - 0 1",
          star: "e5",
          path: ["f3e5"],
          movable: "f3",
          text: L("Atla rakip piyonu al.", "Jump and capture the pawn."),
          success: L("Süper!", "Great!"),
        },
        {
          type: "challenge",
          fen: "8/8/8/2b5/4N3/8/8/8 w - - 0 1",
          star: "c5",
          path: ["e4c5"],
          movable: "e4",
          text: L(
            "Atlar taşların üzerinden atlayabilir — fili al.",
            "Knights jump over pieces — capture the bishop.",
          ),
          success: L("Mükemmel!", "Perfect!"),
        },
        {
          type: "challenge",
          fen: "8/8/5n2/8/4N3/8/8/8 w - - 0 1",
          star: "f6",
          path: ["e4f6"],
          movable: "e4",
          text: L("Rakip atı ele geçir.", "Capture the enemy knight."),
          success: L("Harika!", "Nice!"),
        },
      ],
      complete: L(
        "At alışını kavradın — zıpla ve vur!",
        "You mastered knight captures — jump and strike!",
      ),
    },

    cap_master: {
      id: "cap_master",
      piece: "Q",
      icon: "⚔",
      title: L("Usta Alışlar", "Master Captures"),
      mapLabel: L("Usta", "Master"),
      intro: L(
        "Son tur — farklı taşlarla doğru alışı bul.",
        "Final round — find the right capture with each piece.",
      ),
      steps: [
        {
          type: "challenge",
          fen: "8/8/2p5/8/8/2R5/8/8 w - - 0 1",
          star: "c6",
          path: ["c3c6"],
          movable: "c3",
          text: L("Kaleyle aynı sütunda al.", "Capture along the file with the rook."),
          success: L("Tam isabet!", "Spot on!"),
        },
        {
          type: "challenge",
          fen: "r7/8/8/3Q4/8/8/8/8 w - - 0 1",
          star: "a8",
          path: ["d5a8"],
          movable: "d5",
          text: L(
            "Korumasız kaleyi al!",
            "Take the undefended rook!",
          ),
          success: L("Muhteşem!", "Brilliant!"),
        },
      ],
      complete: L(
        "Taş ele geçirmeyi tamamladın — rakibin taşlarını alarak üstünlük kur!",
        "You finished capturing — gain an advantage by taking enemy pieces!",
      ),
    },

    check: {
      id: "check",
      piece: "K",
      icon: "⚠",
      title: L("Şah Tehdidi", "Check"),
      mapLabel: L("Şah", "Check"),
      intro: L(
        "Rakip şahı tehdit etmek şahtır — şah asla yenilmez.",
        "Attacking the enemy king is check — the king is never captured.",
      ),
      steps: [
        {
          type: "intro",
          fen: "4k3/8/8/8/8/8/8/R7 w - - 0 1",
          text: L(
            "Kale a1'de, rakip şah e8'de. Henüz şah yok — kale şaha hizalanmadı.",
            "The rook is on a1 and the enemy king on e8. No check yet — they're not aligned.",
          ),
        },
        {
          type: "demo",
          fen: "4k3/8/8/8/8/8/8/R7 w - - 0 1",
          text: L(
            "Kaleyi e1'e kaydırırsan e8'deki şaha saldırırsın — bu şahtır.",
            "Slide the rook to e1 to attack the king on e8 — that's check.",
          ),
          arrows: [
            ["a1", "e1"],
            ["e1", "e8"],
          ],
        },
        {
          type: "challenge",
          fen: "4k3/8/8/8/8/8/8/R7 w - - 0 1",
          star: "e1",
          path: ["a1e1"],
          movable: "a1",
          text: L(
            "Kaleyi e1'e götür ve şah çek. (Şahın üstüne gidemezsin!)",
            "Move the rook to e1 to give check. (You can't move onto the king!)",
          ),
          success: L("Şah!", "Check!"),
        },
      ],
      complete: L(
        "Şah kavramını öğrendin — şah yenilmez, mat edilir!",
        "You learned check — the king is never captured, only checkmated!",
      ),
    },
  };

  const SECTIONS = [
    {
      id: "beginner",
      title: L("Başlangıç", "Beginner"),
      subtitle: L("Temel taş hareketleri", "Basic piece movement"),
      lessonIds: ["king", "pawn", "rook", "bishop", "knight", "queen"],
    },
    {
      id: "next",
      title: L("Sonraki Bölüm", "Next Section"),
      subtitle: L("Taş ele geçirme ve kurallar", "Capturing and rules"),
      lessonIds: [
        "cap_rook",
        "cap_bishop",
        "cap_queen",
        "cap_pawn",
        "cap_knight",
        "cap_master",
        "check",
      ],
      requiresSection: "beginner",
    },
  ];

  /** Geliştirme: FEN satırlarının 8 kare olduğunu doğrula */
  function validateFenBoard(fen) {
    const rows = String(fen || "").split(/\s+/)[0].split("/");
    if (rows.length !== 8) return false;
    return rows.every((row) => {
      let n = 0;
      for (const ch of row) {
        if (ch >= "1" && ch <= "8") n += parseInt(ch, 10);
        else if (/[prnbqkPRNBQK]/.test(ch)) n += 1;
        else return false;
      }
      return n === 8;
    });
  }

  function fenPieceAt(fen, sq) {
    const rows = String(fen || "").split(/\s+/)[0].split("/");
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1], 10) - 1;
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return "";
    const row = rows[7 - rank];
    let f = 0;
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") f += parseInt(ch, 10);
      else {
        if (f === file) return ch;
        f++;
      }
    }
    return "";
  }

  function validateCurriculum() {
    const errs = [];
    for (const [id, lesson] of Object.entries(LESSONS)) {
      for (let i = 0; i < (lesson.steps || []).length; i++) {
        const step = lesson.steps[i];
        const fen = step.fen;
        if (!validateFenBoard(fen)) errs.push(id + " step " + i + ": invalid FEN " + fen);
        if (step.type === "challenge" && step.path && step.path.length) {
          const lid = id;
          const isCap = lid === "capture" || String(lid).indexOf("cap_") === 0;
          if (!isCap) continue;
          const uci = step.path[step.path.length - 1];
          const to = uci.slice(2, 4);
          const target = fenPieceAt(fen, to);
          if (!target || target !== target.toLowerCase()) {
            errs.push(
              id + " step " + i + ": path ends on " + to + " but no black piece there",
            );
          }
          if (step.star && step.star !== to) {
            errs.push(id + " step " + i + ": star " + step.star + " != path to " + to);
          }
        }
      }
    }
    return errs;
  }

  const _fenErrors = validateCurriculum();
  if (_fenErrors.length && typeof console !== "undefined") {
    console.warn("[ForkSightLearn] FEN validation:", _fenErrors);
  }

  window.ForkSightLearnData = {
    LESSONS,
    SECTIONS,
    lessonOrder() {
      const out = [];
      for (const sec of SECTIONS) {
        for (const id of sec.lessonIds) {
          if (LESSONS[id]) out.push({ sectionId: sec.id, lessonId: id });
        }
      }
      return out;
    },
    getLesson(id) {
      return LESSONS[id] || null;
    },
    getSection(id) {
      return SECTIONS.find((s) => s.id === id) || null;
    },
    challengeCount(lesson) {
      if (!lesson || !lesson.steps) return 0;
      return lesson.steps.filter((s) => s.type === "challenge").length;
    },
    validateCurriculum,
  };
})();
