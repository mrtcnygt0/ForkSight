/**
 * i18n.js — ForkSight basit dil katmanı.
 *
 * Yaklaşım: Türkçe metinler kaynak ("source") dil; DICT_EN içinde
 * her TR cümlesinin İngilizce karşılığı tutulur.
 *   T("Profil")  → seçili dil EN ise "Profile", TR ise "Profil"
 *
 * Dil tercihi `chrome.storage.local.fs_lang` içinde tutulur.
 * Varsayılan: "en". Kullanıcı 🌐 ile değiştirebilir.
 *
 * Public API (window.ForkSightI18n):
 *   t(trSource)              → string
 *   getLang()                → "en" | "tr"
 *   setLang(lang)            → Promise<void>
 *   toggleLang()             → Promise<string>  (yeni dil)
 *   onChange(cb)             → unsubscribe fn
 *
 * Phase 1: UI chrome (paneller, sekmeler, butonlar, hatalar)
 * Phase 2: coach-review.js anlatımları
 *          - NARRATION_CATEGORIES_EN parallel sözlüğü + _activeNarration()
 *          - contextualHint / bestMoveHint EN dalları
 *          - STAT_ROWS etiketleri + özet koç replikleri
 */
(function () {
  "use strict";

  // ─── Sözlük: TR → EN ──────────────────────────────────
  const DICT_EN = {
    // Sekmeler
    Profil: "Profile",
    Oyunlar: "Games",
    Analiz: "Analysis",
    Bulmacalar: "Puzzles",
    Başarımlar: "Achievements",
    Liderlik: "Leaderboard",
    Ayarlar: "Settings",

    // Profil sekmesi
    "Daha fazla →": "More →",
    "Son Oyunlar": "Recent Games",
    "EN YÜKSEK": "PEAK",
    "GÜNLÜK SERİ": "DAILY STREAK",
    TOPLAM: "TOTAL",
    "Bugün de iyi şanslar!": "Good luck today!",
    "Güzel bir başlangıç! 🚀": "Nice start! 🚀",
    "Chess.com hesabı bağlı değil": "Chess.com account not linked",

    // Oyunlar sekmesi — filtreler ve durumlar
    Tümü: "All",
    Kazandı: "Won",
    Kaybetti: "Lost",
    Beraberlik: "Draw",
    Hepsi: "All",
    "Daha fazla yükle": "Load more",
    "Henüz oyun çekilmedi.": "No games synced yet.",

    // Açılış aileleri (ECO A-E)
    Açılış: "Opening",
    "Yan açılış": "Flank opening",
    "Yarı-açık oyun": "Semi-open game",
    "Açık oyun": "Open game",
    "Kapalı oyun": "Closed game",
    "Hint savunması": "Indian defense",
    "Genelde 1.c4 veya 1.Nf3 ile başlayan düzensiz/yan açılışlar. Merkez kontrolünü kanat taşları ile dengelemeyi gerektirir.":
      "Irregular / flank openings starting usually with 1.c4 or 1.Nf3. Center is contested with wing pieces — requires positional understanding.",
    "Beyaz 1.e4 oynar, siyah merkezi simetrik karşılamaz (örn. Sicilyen, Caro-Kann). Yapı planını bilmek kritiktir.":
      "White plays 1.e4 and Black answers asymmetrically (e.g. Sicilian, Caro-Kann). Knowing the typical pawn structures is critical.",
    "Klasik 1.e4 e5 açılışları (İtalyan, İspanyol, vs.). Hızlı gelişim ve şah güvenliği esastır.":
      "Classical 1.e4 e5 openings (Italian, Ruy Lopez, etc.). Fast development and king safety are the priorities.",
    "1.d4 d5 ile gelen kapalı oyunlar. Piyon yapısı uzun süre kalır, planlı oyun gerekir.":
      "Closed games starting with 1.d4 d5. Pawn structures persist; long-term planning matters more than quick tactics.",
    "1.d4 Nf6 ile başlayan Hint savunmaları (King's Indian, Nimzo vb.). Stratejik, manevralı oyun.":
      "Indian defenses starting with 1.d4 Nf6 (King's Indian, Nimzo, etc.). Strategic, maneuvering play.",

    // Faz analizi (Analiz sekmesi)
    Genel: "Overview",
    Son: "Last",
    oyunun: "games",
    Kazanç: "Wins",
    Kayıp: "Losses",
    Berabere: "Draws",
    "Orta Oyun": "Middlegame",
    "Son Oyun": "Endgame",
    "Açılış · Orta · Son oyun": "Opening · Middlegame · Endgame",
    "Bir satranç partisi üç fazdan oluşur. Hangi fazda ne kadar kaybettiğini gör — yüzde yüksekse o faza çalış.":
      "A chess game has three phases. See how much you lose in each — if the percentage is high, work on that phase.",
    "Yarıdan fazla kaybettiklerin": "The ones you lose more than half",
    "Aşağıdaki referans oyunlara tıkla — hangi hamlede yanlış yaptığını koç modülü sana hamle hamle gösterecek.":
      "Click a reference game below — the coach module will walk you move-by-move through where it went wrong.",
    oyun: "games",
    kayıp: "losses",
    "diğer fazlardan daha çok kaybediyorsun.":
      "you lose more here than in the other phases.",
    "Bu fazda kaybettiğin bir oyun": "A game you lost in this phase",
    "Bu açılışla kaybettiğin oyun": "A game you lost with this opening",
    "→ İncele": "→ Review",
    "oyun oynadın": "games played",
    "'inde kaybettin": " lost",
    "Yakın zamanda bu açılışta kaybettiğin oyun bulunamadı.":
      "No recent losing games found for this opening.",
    "Henüz zayıf bir açılış tespit edemedik.":
      "We haven't detected a weak opening yet.",
    "(En az 3 oyun oynanan ve %50'den fazla kaybedilen açılışlar burada gözükür.)":
      "(Openings played at least 3 times with over 50% losses appear here.)",
    "Henüz analiz için yeterli oyun yok.": "Not enough games to analyze yet.",
    "Chess.com hesabını bağladıktan sonra son oyunlarına bakacağız.":
      "Once you link your Chess.com account we'll look at your recent games.",
    "Faz Analizi": "Phase Analysis",
    "Zayıf Açılışlar": "Weakest Openings",
    "İlk ~15 hamle. Taşları geliştir, merkeze hâkim ol, şahı roka et.":
      "First ~15 moves. Develop pieces, control the center, castle the king.",
    "Çok kaybediyorsan 1-2 açılışı ezberle ve aynısını her oyunda tekrarla.":
      "If you lose a lot here, learn 1-2 openings and repeat them in every game.",
    "15-40. hamleler. Plan kur, zayıf kareleri yakala, taktiklere dikkat et.":
      "Moves 15-40. Build plans, target weak squares, watch for tactics.",
    "Hamleden önce 'rakip bana ne yapabilir?' sorusunu sor; bedava taş kayıplarını azaltır.":
      "Before each move ask 'what can my opponent do to me?' — it cuts blunders.",
    "40+ hamle. Az taş kaldı; şahı aktif kullan, piyon terfisi öne çıkar.":
      "Move 40+. Few pieces left; activate the king, pawn promotion becomes key.",
    "Şah+vezir mat, K+R mat, K+P son oyun temellerini çalış — kazandığın oyun kaymasını engeller.":
      "Study K+Q, K+R and K+P endgame basics — it prevents losing won games.",

    // Settings sekmesi
    "Chess.com Kullanıcı Adı": "Chess.com Username",
    "kullanıcı adı": "username",
    Kaydet: "Save",
    Veriler: "Data",
    "↻ Oyunları Yeniden Senkronize Et": "↻ Re-sync Games",
    Oturum: "Session",
    "Çıkış Yap": "Log out",
    Dil: "Language",
    Türkçe: "Turkish",
    İngilizce: "English",

    // Hata ve durum mesajları
    "Oyun yüklenemedi.": "Could not load the game.",
    "Sunucuya ulaşılamadı.": "Could not reach the server.",
    "Boş olamaz.": "Cannot be empty.",
    "Kaydediliyor…": "Saving…",
    "Chess.com kullanıcısı bulunamadı.": "Chess.com user not found.",
    "Bağlanılamadı.": "Could not connect.",
    "Senkronize ediliyor…": "Syncing…",
    "Senkronizasyon başlatıldı, birkaç saniye sürebilir.":
      "Sync started — this may take a few seconds.",
    Kapat: "Close",
    Bildirimler: "Notifications",
    Premium: "Premium",
    Gold: "Gold",
    Diamond: "Diamond",
    "Premium'a Geç": "Go Premium",
    "Premium planını görüntüle / yükselt": "View / upgrade your plan",
    "Premium'a Geç — Sınırsız Kullan": "Go Premium — Unlimited",
    "BUGÜNKÜ KULLANIM": "TODAY'S USAGE",
    Ücretsiz: "Free",
    Sınırsız: "Unlimited",
    "Premium gerekli": "Premium required",
    "Koç sesi (karakter / gün)": "Coach voice (chars / day)",
    "Oyun sonrası analiz / gün": "Post-game analysis / day",
    "Sesli koç review / hafta": "Voice coach review / week",
    "Chess.com oyun çekme / gün": "Chess.com import / day",
    "Bulmaca oynama / gün": "Puzzles played / day",
    "Bulmaca oynama": "Puzzles played",
    "bulmaca hazır — yeni bulmacaya başla!": "puzzles ready — start a new one!",
    bulmaca: "puzzles",
    oyun: "games",
    Üretiliyor: "Generating",
    "Uygun bulmaca bulunamadı.": "No suitable puzzles found.",
    "Puzzle ipucu / gün": "Puzzle hint / day",
    "Günlük bulmaca oynama hakkın doldu.": "You've used today's puzzle plays.",
    gün: "days",

    // Coach-review (UI chrome)
    HAMLELER: "MOVES",
    Hamleler: "Moves",
    // Coach-review narration prefix templates ({n}=move number, {san}=SAN).
    "{n}. hamleniz ({san}): ": "Your move {n} ({san}): ",
    "Rakibinizin {n}. hamlesi ({san}): ": "Opponent's move {n} ({san}): ",
    "Beyaz {n}. hamle ({san}): ": "White move {n} ({san}): ",
    "Siyah {n}. hamle ({san}): ": "Black move {n} ({san}): ",
    "Sesli oku": "Read aloud",
    vs: "vs",
    "Başlangıç pozisyonu. Sağdaki hamleye veya ileri/geri tuşlarına tıklayarak oyunu dolaş.":
      "Starting position. Click a move on the right or use the prev/next buttons to navigate the game.",

    // Side picker
    "Hangi taraftaydınız?": "Which side were you?",
    "Yorumları size göre kişiselleştirebilmek için oynadığınız tarafı seçin.":
      "Pick the side you played so we can personalize the commentary.",
    "İzleyici olarak devam et (tarafsız yorum)":
      "Continue as a spectator (neutral commentary)",
    "1. Oyuncu (Beyaz)": "Player 1 (White)",
    "2. Oyuncu (Siyah)": "Player 2 (Black)",

    // Coach-review Phase 2: stat rows / summary chrome / loading
    Harika: "Brilliant",
    "Çok iyi": "Great",
    Kitap: "Book",
    "En iyi": "Best",
    Mükemmel: "Excellent",
    İyi: "Solid",
    Yanlışlık: "Inaccuracy",
    Hata: "Mistake",
    Gaf: "Blunder",
    Doğruluk: "Accuracy",
    "İncelemeyi Başlat": "Start Review",
    Beyaz: "White",
    Siyah: "Black",
    "Hamleler değerlendiriliyor… (Stockfish derinlik {n})":
      "Analyzing moves… (Stockfish depth {n})",

    // Avatar (mascot, menu, end-of-game summary modal)
    "ForkSight Coach — oyun özeti için tıkla":
      "ForkSight Coach — click for game summary",
    "ForkSight Coach (sürükleyerek taşı)": "ForkSight Coach (drag to move)",
    "Oyun özetin hazır — bana tıkla! 🏆": "Your recap is ready — click me! 🏆",
    "Tebrikler — kazandın!": "Congratulations — you won!",
    "Bir dahaki sefere, iyi savaştın.": "Next time — you fought well.",
    "Berabere — sıkı bir mücadeleydi.": "Draw — it was a tough fight.",
    "Oyun bitti.": "Game over.",
    "Oyun çok kısa sürdü — analiz yetersiz.":
      "The game was too short — not enough to analyze.",
    "Çok temiz oynadın — sağlam karar verme!":
      "Very clean play — solid decision-making!",
    "Genel olarak tutarlı bir oyundu.": "Overall a consistent game.",
    "Birkaç kritik hamle pahalıya patladı — bir dahaki maçta tempoyu düşürmeyi dene.":
      "A few critical moves cost you — try slowing the tempo down next game.",
    "Bir blunder maçı çevirdi — hamle öncesi son bir kontrol işe yarar.":
      "A blunder flipped the game — one last check before moving helps.",
    "Orta seviyede birkaç hata vardı, geliştirilebilir.":
      "There were a few moderate mistakes; room to improve.",
    "Dengeli bir oyundu, devam!": "A balanced game — keep going!",
    "Oyun özeti": "Game summary",
    "analiz edilen hamle": "moves analyzed",
    süre: "duration",
    "hamle başına ort. kayıp": "avg loss per move",
    "en kötü hamle": "worst move",
    Tamam: "OK",
    "Giriş Yap / Kayıt Ol": "Sign In / Sign Up",
    "Son Oyun Özeti": "Last Game Summary",
    Profilim: "My Profile",
    "Analiz Et": "Analyze",
    "Analiz modülü yüklenemedi. Sayfayı yenileyin.":
      "Analysis module could not load. Refresh the page.",
    Kullanıcı: "User",
    "Profil bilgisi alınamadı.": "Could not load profile info.",
    "Giriş modülü hazır değil. Sayfayı yenileyin.":
      "Login module not ready. Refresh the page.",

    // Coach-review Phase 3: modals + errors
    Kapat: "Close",
    "ForkSight oyun incelemesi": "ForkSight game review",
    "Oyun Analizi": "Game Analysis",
    "Analiz yöntemini seç.": "Pick an analysis method.",
    "URL ile": "By URL",
    "Chess.com live veya daily oyun bağlantısı yapıştır.":
      "Paste a Chess.com live or daily game link.",
    "PGN ile": "By PGN",
    "Oyunun PGN metnini yapıştır — hamleler, oyuncular ve saatler dahil tam inceleme.":
      "Paste the game's PGN — full review with moves, players and clocks.",
    "URL ile Analiz": "Analyze by URL",
    "Bir Chess.com oyun bağlantısı yapıştır.": "Paste a Chess.com game link.",
    "Desteklenen türler: <b>live</b> ve <b>daily</b>. Örnek: https://www.chess.com/game/daily/967774833":
      "Supported types: <b>live</b> and <b>daily</b>. Example: https://www.chess.com/game/daily/967774833",
    Geri: "Back",
    "PGN ile Analiz": "Analyze by PGN",
    "Oyunun PGN metnini yapıştır.": "Paste the game's PGN.",
    "Chess.com'da bir oyunda <b>Share → PGN</b> ile kopyalayıp buraya yapıştırabilirsin. Hamleler, oyuncular ve saatler otomatik okunur.":
      "On Chess.com, copy the PGN of any game via <b>Share → PGN</b> and paste it here. Moves, players and clocks are read automatically.",
    "PGN ayrıştırılamadı.": "Could not parse PGN.",
    "Bağlantıyı tanıyamadım. Örnek: https://www.chess.com/game/live/123456789":
      "Couldn't recognize the link. Example: https://www.chess.com/game/live/123456789",
    "Şu an yalnızca live ve daily oyunlar destekleniyor (tip: {t}).":
      "Only live and daily games are supported right now (type: {t}).",
    "PGN boş.": "PGN is empty.",
    "Sunucu hata kodu döndü: HTTP ": "Server returned error: HTTP ",
    "Geçersiz yanıt formatı.": "Invalid response format.",
    "Daily oyun alınamadı (HTTP {n}). Oyun id doğru mu, hâlâ erişilebilir mi?":
      "Couldn't fetch the daily game (HTTP {n}). Is the game id correct and still accessible?",
    "Bilinmeyen bağlantı türü.": "Unknown link type.",
    "FEN boş.": "FEN is empty.",
    "FEN'de 8 sıra olmalı.": "FEN must have 8 ranks.",
    "FEN sırası taşıyor: ": "FEN rank overflows: ",
    "FEN'de geçersiz karakter: ": "Invalid character in FEN: ",
    "FEN sırasında 8 kare yok: ": "FEN rank doesn't have 8 squares: ",
    "Satranç tahtası": "Chessboard",

    // streak (dinamik şablonlar)
    __streak_lt_7__: "{n} days here — keep going!",
    __streak_lt_30__: "{n}-day streak — impressive!",
    __streak_legend__: "{n} days! You're a legend 🔥",

    // ─── Bulmacalar (Puzzles) sekmesi — lobi, çözüm, önizleme ───────────
    Bulmaca: "Puzzle",
    "Yeni Bulmaca": "New Puzzle",
    "Geçmiş oyunlardan üret": "Generate from past games",
    "Geçmiş oyunlardan bulmaca üretiliyor...":
      "Generating puzzles from past games...",
    "Geçmiş oyunlarından bulmaca üretiyoruz…":
      "We're generating puzzles from your past games…",
    "Üretiliyor…": "Generating…",
    "Hazırlanıyor…": "Preparing…",
    "Bulmaca yükleniyor...": "Loading puzzle...",
    "Senin için en iyi bulmacaları getiriyoruz":
      "Fetching the best puzzles for you",
    "Bir saniye…": "One moment…",
    "Kontrol ediliyor...": "Checking...",
    "Bulmaca alınamadı": "Couldn't load puzzle",
    "Önizleme açılamadı": "Couldn't open preview",
    "Henüz bulmaca yok. Geçmiş oyunlarından üretmek için aşağıdaki butona bas.":
      "No puzzles yet. Tap the button below to generate from your past games.",
    "Bulmaca yok — geçmiş oyunlardan üretmeyi dene.":
      "No puzzles — try generating from past games.",
    "Önce chess.com hesabını bağla ve oyunlarını senkronize et.":
      "First link your chess.com account and sync your games.",
    "Önce chess.com hesabını bağlayıp oyun senkronize et.":
      "First link your chess.com account and sync games.",
    "Henüz deneme yok.": "No attempts yet.",
    "Geçmiş Denemeler": "Recent Attempts",
    "Veri yok.": "No data.",
    "Yeni oyunlar çekiliyor…": "Fetching new games…",
    "Eski veriler temizlendi.": "Old data cleared.",
    "⟳ Tüm Veriyi Sıfırla ve Yeniden Çek": "⟳ Reset All Data and Re-fetch",
    "Tüm chess.com oyunları, bulmacalar ve istatistikler silinip yeniden çekilecek. Devam edilsin mi?":
      "All chess.com games, puzzles and stats will be deleted and re-fetched. Continue?",

    // Bulmaca çözüm akışı
    Cevapla: "Submit",
    Atla: "Skip",
    İpucu: "Hint",
    "İpucu alınamadı": "Couldn't get hint",
    "Lichess bulmacalarında ipucu kapalı.":
      "Hints are disabled for Lichess puzzles.",
    Taş: "Piece",
    Hamle: "Move",
    Çözüm: "Solution",
    "Doğru cevap": "Correct answer",
    "Doğru!": "Correct!",
    "Doğru! Rakip cevap veriyor...": "Correct! Opponent responds...",
    "Yanlış.": "Wrong.",
    "Sıra sende.": "Your turn.",
    "Beyaz oynar": "White to move",
    "Siyah oynar": "Black to move",
    "Tek hamlede mat!": "Mate in one!",
    "İki hamlede mat bul.": "Find mate in two.",
    "Şimdi mat hamlesini bul!": "Now find the mating move!",
    "Bu pozisyonda en iyi hamleyi bul.": "Find the best move in this position.",
    "Bu pozisyona kadar oynanan hamle yok.":
      "No moves played up to this position.",
    "Önizleme — puan kazanamazsın.": "Preview — you won't earn points.",
    "Bu bulmacayı çözememiştin. İşte çözümü.":
      "You couldn't solve this puzzle. Here's the solution.",
    "Tebrikler! Bu bulmacayı çözmüştün.": "Congrats! You'd solved this puzzle.",
    "Tahta modülü yüklenemedi.": "Board module failed to load.",

    // Bulmaca tipleri / kaynak
    "Mat 1": "Mate in 1",
    "Mat 2": "Mate in 2",
    "Mat 3": "Mate in 3",
    "En İyi Hamle": "Best Move",
    Taktik: "Tactic",
    Kaynak: "Source",
    "Referans oyunlar": "Reference games",
    "Oyunu Chess.com'da Aç": "Open game on Chess.com",
    Zorluk: "Difficulty",

    // Paylaşım
    Paylaş: "Share",
    "Bu bulmacayı paylaş": "Share this puzzle",
    "Twitter'da paylaş": "Share on Twitter",
    "Paylaşılacak bulmaca yok.": "No puzzle to share.",
    "Link kopyalandı, Twitter açılıyor…": "Link copied, opening Twitter…",
    "Bu satranç taktiğini çözebilir misin? 🧩":
      "Can you solve this chess tactic? 🧩",

    // Günlük mücadele
    "Bugünün Mücadelesi": "Today's Challenge",
    "Bugünün mücadelesi tamamlandı! 🎉": "Today's challenge complete! 🎉",
    "Bugünkü hedefi tamamladın!": "You've completed today's goal!",
    "Bugün başla, seriyi kur": "Start today, build your streak",
    "tekrar bekliyor": "awaiting review",

    // Tema filtresi / performans
    Tema: "Theme",
    "Bu temadan çalış": "Practice this theme",
    Temizle: "Clear",
    "Tema Performansı": "Theme Performance",
    // Puzzle tema isimleri (server "label" TR gönderir; EN modda key→EN).
    __theme_fork__: "Fork",
    __theme_pin__: "Pin",
    __theme_skewer__: "Skewer",
    __theme_discovered_check__: "Discovered Check",
    __theme_double_check__: "Double Check",
    __theme_back_rank__: "Back Rank",
    __theme_hanging__: "Hanging Piece",
    __theme_capture__: "Capture",
    __theme_check__: "Check",
    __theme_promotion__: "Promotion",
    __theme_sacrifice__: "Sacrifice",
    "Bu kategoride henüz yeterli oyun yok.":
      "Not enough games in this category yet.",
    "Bullet, Blitz, Rapid ve Günlük oyunlar farklı tempolarda analiz ediliyor — her havuzun kendi zayıflıkları olur.":
      "Bullet, Blitz, Rapid and Daily games are analyzed at different time controls — each pool has its own weaknesses.",
    "Bu temadaki tüm bulmacaları çözdün — tekrar pratiği.":
      "You've solved all puzzles in this theme — review practice.",
    "Bu temadaki tüm bulmacaları çözdün! Başka bir tema dene veya tema filtresini kaldır.":
      "You've solved all puzzles in this theme! Try another theme or clear the filter.",
    "Tüm bulmacaları çözdün — tekrar pratiği başlıyor.":
      "You've solved all puzzles — review practice begins.",
    "Kendi bulmacaların tükendiği için Lichess bulmacası gösteriliyor.":
      "Your own puzzles are exhausted, showing a Lichess puzzle.",

    // İstatistik etiketleri (büyük harf rozetler)
    Rating: "Rating",
    Seri: "Streak",
    "En İyi": "Best",
    ÇÖZÜM: "SOLVED",
    Deneme: "Attempts",
    Toplam: "Total",
    ÇÖZÜLDÜ: "SOLVED",
    ÖNİZLEME: "PREVIEW",
    YENİ: "NEW",
    BAŞARISIZ: "FAILED",
    çözüldü: "solved",
    deneme: "attempts",
    hamle: "moves",
    puan: "points",
    "gün üst üste": "day streak",
    Bugün: "Today",
    Günlük: "Daily",
    Liste: "List",
    Sen: "You",
    "Henüz sıralamada değilsin.": "You're not on the leaderboard yet.",

    // Başarımlar
    "Toplam Başarım": "Total Achievements",
    Kazanıldı: "Earned",
    "Yeni Başarım": "New Achievement",
    "Henüz başarım yok.": "No achievements yet.",

    // Kota / limit (upgrade modalı)
    "Limit Doldu": "Limit Reached",
    "Premium Özellik": "Premium Feature",
    "Bu özellik": "This feature",
    "Premium üyelik gerektirir.": "Requires a Premium membership.",
    "Premium ile sınırsız kullan.": "Go unlimited with Premium.",
    "sonrası sıfırlanır.": "after which it resets.",
    "Sesli koç (TTS)": "Voice coach (TTS)",
    "Oyun sonrası analiz": "Post-game analysis",
    "Sesli koç review": "Voice coach review",
    "Puzzle ipucu": "Puzzle hint",
    "Günlük ipucu hakkın doldu.": "You've used today's hints.",
    "Günlük oyun çekme limitin doldu.":
      "You've reached today's game import limit.",

    // Coach-review oynatıcı navigasyonu
    Başa: "To start",
    Sona: "To end",
    İleri: "Forward",
    "Değerlendirme çubuğu": "Evaluation bar",

    // Avatar — PGN fallback uyarısı
    "Oyun bağlantısı otomatik algılanamadı. Lütfen chess.com'da Share → PGN ile <b>zaman damgaları (clock) açık</b> olarak kopyalanmış PGN metnini aşağıya yapıştırın.":
      "Couldn't auto-detect the game link. Please copy the PGN on chess.com via Share → PGN with <b>clock timestamps enabled</b> and paste it below.",
  };

  // ─── Durum ────────────────────────────────────────────
  let _lang = "en"; // varsayılan EN — kullanıcı isterse TR'ye geçer
  let _ready = false;
  const _listeners = new Set();

  // chrome.storage.local'dan asenkron oku (script yüklenir yüklenmez başlat)
  try {
    chrome.storage.local.get(["fs_lang"], (res) => {
      if (chrome.runtime.lastError) {
        _ready = true;
        return;
      }
      const stored = res && res.fs_lang;
      if (stored === "tr" || stored === "en") {
        _lang = stored;
      }
      _ready = true;
      _emit();
    });
  } catch (_) {
    _ready = true;
  }

  function _emit() {
    _listeners.forEach((cb) => {
      try {
        cb(_lang);
      } catch (_) {}
    });
  }

  function t(src) {
    if (src == null) return "";
    const s = String(src);
    if (_lang === "tr") return s; // kaynak = TR
    const en = DICT_EN[s];
    return en !== undefined ? en : s; // sözlükte yoksa orijinal döner
  }

  function getLang() {
    return _lang;
  }

  function setLang(lang) {
    if (lang !== "tr" && lang !== "en") return Promise.resolve(_lang);
    if (lang === _lang) return Promise.resolve(_lang);
    _lang = lang;
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ fs_lang: lang }, () => {
          _emit();
          resolve(lang);
        });
      } catch (_) {
        _emit();
        resolve(lang);
      }
    });
  }

  function toggleLang() {
    return setLang(_lang === "en" ? "tr" : "en");
  }

  function onChange(cb) {
    if (typeof cb !== "function") return () => {};
    _listeners.add(cb);
    return () => _listeners.delete(cb);
  }

  window.ForkSightI18n = {
    t,
    getLang,
    setLang,
    toggleLang,
    onChange,
    isReady: () => _ready,
  };
})();
