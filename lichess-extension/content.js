(function () {
  "use strict";

  // ─── Stealth: Random ID üretimi (DOM fingerprint önleme) ───
  const _rid = () => "_" + Math.random().toString(36).slice(2, 9);
  const STEALTH_IDS = {
    panel: _rid(),
    overlay: _rid(),
    host: _rid(),
    loginModal: _rid(),
    premiumPopup: _rid(),
    aboutModal: _rid(),
  };

  // ─── Eski instance temizliği (extension reload koruması) ───
  if (typeof window.__taktikCleanup === "function") {
    try {
      window.__taktikCleanup();
    } catch (e) {
      /* ignore */
    }
  }
  // Eski Shadow DOM host'u kaldır
  if (window.__taktikHostId) {
    const oldHost = document.getElementById(window.__taktikHostId);
    if (oldHost) oldHost.remove();
  }
  // Eski SVG overlay'ı kaldır
  if (window.__taktikOverlayId) {
    const oldOverlay = document.getElementById(window.__taktikOverlayId);
    if (oldOverlay) oldOverlay.remove();
  }
  window.__taktikHostId = STEALTH_IDS.host;
  window.__taktikOverlayId = STEALTH_IDS.overlay;

  // ─── Shadow DOM Host (panel Lichess'in querySelector'ından gizlenir) ───
  let shadowHost = null;
  let shadowRoot = null;

  // ─── i18n ──────────────────────────────────────────────
  const LANGS = {
    en: {
      loginTitle: "ForkSight — Login",
      usernamePH: "Username",
      passwordPH: "Password",
      loginBtn: "🔑 Login",
      guestBtn: "👤 Continue as Guest",
      loginRequired: "Username and password required!",
      loggingIn: "⏳ Logging in...",
      loginFailed: "Login failed!",
      serverFailed: "Server connection failed!",
      langLabel: "Language:",
      panelTitle: "ForkSight",
      guest: "👤 Guest",
      logoutTitle: "Logout",
      minimizeTitle: "Minimize",
      autoAnalysis: "Auto Analysis:",
      off: "Off",
      on: "On",
      autoPlay: "Auto Play:",
      me: "Me",
      white: "White",
      black: "Black",
      antiBan: "🛡️ Anti-Ban:",
      eloCeiling: "🎯 Elo Cap:",
      eloCeilingOff: "Off",
      bookMove: "📖 Book move: {0} ({1}s)",
      stealthOn: "👻 Stealth ON (F4)",
      stealthOff: "👁️ Stealth OFF (F4)",
      stealthBtn: "👻 Hide (F4)",
      min10: "10m",
      min30: "30m",
      hour1: "1 hour",
      hour2: "2 hours",
      day1: "1 day",
      unlimited: "Unlimited",
      analyzeBtn: "⚡ ANALYZE (F2)",
      clearBtn: "🧹 Clear (F3)",
      resetBtn: "🔄 Engine Reset",
      depth: "Depth:",
      movesLabel: "Moves:",
      turnLabel: "Turn:",
      automatic: "Automatic",
      defaultStatus: "F2: Analyze — F3: Clear",
      guestMode: "👤 Guest mode — limited access",
      welcome: "✅ Welcome, {0}!",
      engineResetting: "🔄 Engine resetting...",
      engineResetDone: "✅ Engine reset done",
      resetError: "❌ Reset error: {0}",
      boardNotFound: "❌ Board not found!",
      readingBoard: "⏳ Reading board…",
      boardReadError: "❌ Board could not be read!",
      thinking: "⏳ Stockfish thinking… (d={0}{1})",
      serverConnFail: "Server connection failed",
      timeoutMsg: "⚠️ Timeout ({0}/3) — retrying",
      timeoutReset: "🔄 3 consecutive timeouts — resetting engine...",
      mateStalemate: "♚ Checkmate or stalemate!",
      movesFound: "✅ {0} moves ({1}s)",
      playingMove: "🤖 {0} {1} will be played ({2}s)",
      cleared: "Cleared",
      guestNoReset: "❌ Engine reset not available in guest mode",
      guestNoMpv: "❌ Move count cannot be changed in guest mode",
      guestNoAuto: "❌ Auto analysis not available in guest mode",
      guestNoAutoPlay: "❌ Auto play not available in guest mode",
      guestNoAntiBan: "❌ Anti-ban not available in guest mode",
      guestNoAutoMatch: "❌ Auto match not available in guest mode",
      autoMatchActive: "🔄 Auto match active",
      autoMatchExpired: "⏰ Auto match time expired",
      activeInf: "∞ Active",
      gameOver: "🔄 Game over! New match ({0}s)…",
      rematchSent: "🔍 Rematch sent…",
      searchingGame: "🔍 Searching for new game…",
      redirectLobby: "🔍 Redirecting to lobby…",
      movePlayed: "🤖 Move played: {0}",
      waitingOpponent: "⏳ Opponent's turn — waiting…",
      moveCancel: "Move cancelled — position or turn changed",
      registerBtn: "📝 Register",
      registerTitle: "ForkSight — Register",
      confirmPH: "Confirm password",
      registerSubmit: "📝 Create Account",
      backToLogin: "← Back to Login",
      registering: "⏳ Registering...",
      registerRequired: "All fields are required!",
      registerPassMismatch: "Passwords do not match!",
      registerPassShort: "Password must be at least 6 characters!",
      registerUserShort: "Username must be at least 3 characters!",
      registerFailed: "Registration failed!",
      registerClosed: "Registration is currently closed",
      updateAvailable: "🔄 New version available! Please update extension.",
      wsConnected: "⚡ WebSocket connected",
      wsProgress: "⏳ depth {0}…",
      aboutTitle: "About ForkSight",
      aboutText:
        "ForkSight is an advanced chess analysis tool powered by the Stockfish engine. It provides real-time tactical analysis with visual arrows on the board.<br><br><b>⚠️ Disclaimer:</b> This tool was created for <b>educational purposes only</b>. It is designed to help players learn, study positions and improve their chess understanding. We strongly advise against using it for cheating in rated games. Fair play makes chess beautiful.<br><br><b>Version:</b> 1.6",
      aboutCreator: "Creator",
      aboutLinks: "Links",
      premiumTitle: "ForkSight Premium",
      premiumSubtitle: "Stay one step ahead in chess",
      premiumDepth: "Unlimited Depth",
      premiumDepthDesc: "Analysis up to level 30",
      premiumMpv: "Multiple Variants (5 PV)",
      premiumMpvDesc: "See the best 5 moves at once",
      premiumAuto: "Auto Analysis",
      premiumAutoDesc: "Every move analyzed instantly",
      premiumAutoplay: "Auto Play",
      premiumAutoplayDesc: "Engine plays the best move automatically",
      premiumAntiban: "Anti-Ban System",
      premiumAntibanDesc: "Detection prevention with random delays",
      premiumAutomatch: "Auto Match",
      premiumAutomatchDesc: "Find and play matches consecutively",
      premiumCta: "\uD83D\uDE80 Upgrade to Premium — from $2.99/mo",
      premiumPrice: "Monthly: $2.99 | Lifetime: $19.99",
      premiumContact: "\u2709\uFE0F Contact",
      premiumLater: "Maybe Later",
      premiumFreeMsg:
        "\u26A0\uFE0F Free account \u2014 Get full access with Premium!",
      coachTab: "\uD83C\uDF93 Coach",
      fullTab: "\u2694\uFE0F Full",
      coachEvalBar: "Evaluation",
      coachHint: "\uD83D\uDCA1 Hint",
      coachHintsLeft: "{0}/{1} \uD83D\uDD11",
      coachBlunderAlert: "\u26A0\uFE0F Blunder Alert:",
      coachTacticDetect: "\uD83C\uDFAF Tactic Detection:",
      coachLastMove: "Last Move:",
      coachPerfect: "\uD83C\uDFC6 Excellent move!",
      coachGood: "\u2705 Good move ({0})",
      coachOk: "\uD83D\uDD38 Not bad ({0})",
      coachInaccuracy: "\u274C Inaccuracy ({0}) Better: {1}",
      coachBlunder: "\uD83D\uDC80 Blunder! ({0}) You missed: {1}",
      coachWinning: "Winning",
      coachEqual: "Equal",
      coachLosing: "Losing",
      coachGameStats: "\uD83D\uDCC8 This game: {0} errors, {1} tactics",
      coachTacticFound: "\uD83C\uDFAF TACTIC AVAILABLE!",
      coachNoHints: "No hints left this game",
      coachHintShown: "\uD83D\uDCA1 Best move shown (5s)",
      coachWaiting: "Waiting for your move\u2026",
      coachDepth: "Coach Depth",
    },
    tr: {
      loginTitle: "ForkSight — Giriş",
      usernamePH: "Kullanıcı adı",
      passwordPH: "Şifre",
      loginBtn: "🔑 Giriş Yap",
      guestBtn: "👤 Misafir Olarak Devam Et",
      loginRequired: "Kullanıcı adı ve şifre gerekli!",
      loggingIn: "⏳ Giriş yapılıyor...",
      loginFailed: "Giriş başarısız!",
      serverFailed: "Sunucu bağlantısı başarısız!",
      langLabel: "Dil:",
      panelTitle: "ForkSight",
      guest: "👤 Misafir",
      logoutTitle: "Çıkış Yap",
      minimizeTitle: "Küçült",
      autoAnalysis: "Oto Analiz:",
      off: "Kapalı",
      on: "Açık",
      autoPlay: "Oto Oyna:",
      me: "Ben",
      white: "Beyaz",
      black: "Siyah",
      antiBan: "🛡️ Anti-Ban:",
      eloCeiling: "🎯 Elo Tavanı:",
      eloCeilingOff: "Kapalı",
      bookMove: "📖 Kitap hamlesi: {0} ({1}s)",
      stealthOn: "👻 Gizli mod AÇIK (F4)",
      stealthOff: "👁️ Gizli mod KAPALI (F4)",
      stealthBtn: "👻 Gizle (F4)",
      min10: "10dk",
      min30: "30dk",
      hour1: "1 saat",
      hour2: "2 saat",
      day1: "1 gün",
      unlimited: "Sınırsız",
      analyzeBtn: "⚡ TAKTİK VER (F2)",
      clearBtn: "🧹 Temizle (F3)",
      resetBtn: "🔄 Engine Reset",
      depth: "Derinlik:",
      movesLabel: "Hamle:",
      turnLabel: "Sıra:",
      automatic: "Otomatik",
      defaultStatus: "F2: Analiz — F3: Temizle",
      guestMode: "👤 Misafir modu — sınırlı erişim",
      welcome: "✅ Hoş geldin, {0}!",
      engineResetting: "🔄 Engine resetleniyor...",
      engineResetDone: "✅ Engine resetlendi",
      resetError: "❌ Reset hatası: {0}",
      boardNotFound: "❌ Tahta bulunamadı!",
      readingBoard: "⏳ Tahta okunuyor…",
      boardReadError: "❌ Tahta okunamadı!",
      thinking: "⏳ Stockfish düşünüyor… (d={0}{1})",
      serverConnFail: "Sunucu bağlantısı başarısız",
      timeoutMsg: "⚠️ Timeout ({0}/3) — tekrar denenecek",
      timeoutReset: "🔄 3 ardışık timeout — engine resetleniyor...",
      mateStalemate: "♚ Mat veya pat!",
      movesFound: "✅ {0} hamle ({1}s)",
      playingMove: "🤖 {0} {1} oynanacak ({2}s)",
      cleared: "Temizlendi",
      guestNoReset: "❌ Misafir modunda engine reset kullanılamaz",
      guestNoMpv: "❌ Misafir modunda hamle sayısı değiştirilemez",
      guestNoAuto: "❌ Misafir modunda oto analiz kullanılamaz",
      guestNoAutoPlay: "❌ Misafir modunda oto oynama kullanılamaz",
      guestNoAntiBan: "❌ Misafir modunda anti-ban kullanılamaz",
      guestNoAutoMatch: "❌ Misafir modunda oto maç kullanılamaz",
      autoMatchActive: "🔄 Oto maç aktif",
      autoMatchExpired: "⏰ Oto maç süresi doldu",
      activeInf: "∞ Aktif",
      gameOver: "🔄 Oyun bitti! Yeni maç ({0}s)…",
      rematchSent: "🔍 Rematch gönderildi…",
      searchingGame: "🔍 Yeni oyun aranıyor…",
      redirectLobby: "🔍 Lobby'e yönlendiriliyor…",
      movePlayed: "🤖 Hamle oynandı: {0}",
      waitingOpponent: "⏳ Rakibin sırası — bekleniyor…",
      moveCancel: "Hamle iptal — pozisyon veya sıra değişti",
      registerBtn: "📝 Kayıt Ol",
      registerTitle: "ForkSight — Kayıt",
      confirmPH: "Şifre tekrar",
      registerSubmit: "📝 Hesap Oluştur",
      backToLogin: "← Girişe Dön",
      registering: "⏳ Kayıt yapılıyor...",
      registerRequired: "Tüm alanlar zorunlu!",
      registerPassMismatch: "Şifreler eşleşmiyor!",
      registerPassShort: "Şifre en az 6 karakter olmalı!",
      registerUserShort: "Kullanıcı adı en az 3 karakter olmalı!",
      registerFailed: "Kayıt başarısız!",
      registerClosed: "Kayıt şu anda kapalı",
      updateAvailable: "🔄 Yeni sürüm mevcut! Lütfen eklentiyi güncelleyin.",
      wsConnected: "⚡ WebSocket bağlandı",
      wsProgress: "⏳ derinlik {0}…",
      aboutTitle: "ForkSight Hakkında",
      aboutText:
        "ForkSight, Stockfish motoru tarafından desteklenen gelişmiş bir satranç analiz aracıdır. Tahta üzerinde görsel oklar ile gerçek zamanlı taktik analiz sunar.<br><br><b>⚠️ Uyarı:</b> Bu araç yalnızca <b>eğitim amaçlı</b> oluşturulmuştur. Oyuncuların öğrenmesine, pozisyonları çalışmasına ve satranç anlayışlarını geliştirmesine yardımcı olmak için tasarlanmıştır. Dereceli oyunlarda hile yapmak için kullanmamanızı şiddetle tavsiye ederiz. Adil oyun satrancı güzel kılar.<br><br><b>Sürüm:</b> 1.6",
      aboutCreator: "Yaratıcı",
      aboutLinks: "Bağlantılar",
      premiumTitle: "ForkSight Premium",
      premiumSubtitle: "Satrançta bir adım önde olun",
      premiumDepth: "Sınırsız Derinlik",
      premiumDepthDesc: "30 seviyeye kadar analiz",
      premiumMpv: "Çoklu Varyant (5 PV)",
      premiumMpvDesc: "En iyi 5 hamleyi aynı anda gör",
      premiumAuto: "Otomatik Analiz",
      premiumAutoDesc: "Her hamle anında analiz edilir",
      premiumAutoplay: "Otomatik Oynama",
      premiumAutoplayDesc: "Motor en iyi hamleyi otomatik oynar",
      premiumAntiban: "Anti-Ban Sistemi",
      premiumAntibanDesc: "Rastgele gecikmelerle tespit önleme",
      premiumAutomatch: "Otomatik Maç",
      premiumAutomatchDesc: "Art arda maç bul ve oyna",
      premiumCta: "🚀 Premium'a Geç — ₺99/ay",
      premiumPrice: "Aylık: ₺99 | Ömür Boyu: ₺799",
      premiumContact: "✉️ İletişim",
      premiumLater: "Belki Daha Sonra",
      premiumFreeMsg: "⚠️ Free hesap — Premium ile tüm özelliklere erişin!",
      coachTab: "\uD83C\uDF93 Koç",
      fullTab: "\u2694\uFE0F Tam",
      coachEvalBar: "Değerlendirme",
      coachHint: "\uD83D\uDCA1 İpucu",
      coachHintsLeft: "{0}/{1} \uD83D\uDD11",
      coachBlunderAlert: "\u26A0\uFE0F Blunder Uyarısı:",
      coachTacticDetect: "\uD83C\uDFAF Taktik Algılama:",
      coachLastMove: "Son Hamle:",
      coachPerfect: "\uD83C\uDFC6 Mükemmel hamle!",
      coachGood: "\u2705 İyi hamle ({0})",
      coachOk: "\uD83D\uDD38 Fena değil ({0})",
      coachInaccuracy: "\u274C Hata ({0}) Daha iyi: {1}",
      coachBlunder: "\uD83D\uDC80 Blunder! ({0}) Kaçırdığın: {1}",
      coachWinning: "Kazanıyor",
      coachEqual: "Eşit",
      coachLosing: "Kaybediyor",
      coachGameStats: "\uD83D\uDCC8 Bu maç: {0} hata, {1} taktik",
      coachTacticFound: "\uD83C\uDFAF TAKTİK MEVCUT!",
      coachNoHints: "Bu maçta ipucu hakkın kalmadı",
      coachHintShown: "\uD83D\uDCA1 En iyi hamle gösterildi (5sn)",
      coachWaiting: "Hamlenizi bekliyorum\u2026",
      coachDepth: "Koç Derinliği",
    },
    de: {
      loginTitle: "ForkSight — Anmeldung",
      usernamePH: "Benutzername",
      passwordPH: "Passwort",
      loginBtn: "🔑 Anmelden",
      guestBtn: "👤 Als Gast fortfahren",
      loginRequired: "Benutzername und Passwort erforderlich!",
      loggingIn: "⏳ Anmeldung läuft...",
      loginFailed: "Anmeldung fehlgeschlagen!",
      serverFailed: "Serververbindung fehlgeschlagen!",
      langLabel: "Sprache:",
      panelTitle: "ForkSight",
      guest: "👤 Gast",
      logoutTitle: "Abmelden",
      minimizeTitle: "Minimieren",
      autoAnalysis: "Auto-Analyse:",
      off: "Aus",
      on: "An",
      autoPlay: "Auto-Spielen:",
      me: "Ich",
      white: "Weiß",
      black: "Schwarz",
      antiBan: "🛡️ Anti-Ban:",
      eloCeiling: "🎯 Elo-Grenze:",
      eloCeilingOff: "Aus",
      bookMove: "📖 Buchzug: {0} ({1}s)",
      stealthOn: "👻 Tarnmodus AN (F4)",
      stealthOff: "👁️ Tarnmodus AUS (F4)",
      stealthBtn: "👻 Verbergen (F4)",
      min10: "10Min",
      min30: "30Min",
      hour1: "1 Std",
      hour2: "2 Std",
      day1: "1 Tag",
      unlimited: "Unbegrenzt",
      analyzeBtn: "⚡ ANALYSIEREN (F2)",
      clearBtn: "🧹 Löschen (F3)",
      resetBtn: "🔄 Engine Reset",
      depth: "Tiefe:",
      movesLabel: "Züge:",
      turnLabel: "Zug:",
      automatic: "Automatisch",
      defaultStatus: "F2: Analyse — F3: Löschen",
      guestMode: "👤 Gastmodus — eingeschränkter Zugang",
      welcome: "✅ Willkommen, {0}!",
      engineResetting: "🔄 Engine wird zurückgesetzt...",
      engineResetDone: "✅ Engine zurückgesetzt",
      resetError: "❌ Reset-Fehler: {0}",
      boardNotFound: "❌ Brett nicht gefunden!",
      readingBoard: "⏳ Brett wird gelesen…",
      boardReadError: "❌ Brett konnte nicht gelesen werden!",
      thinking: "⏳ Stockfish denkt nach… (d={0}{1})",
      serverConnFail: "Serververbindung fehlgeschlagen",
      timeoutMsg: "⚠️ Timeout ({0}/3) — wird erneut versucht",
      timeoutReset: "🔄 3 Timeouts nacheinander — Engine wird zurückgesetzt...",
      mateStalemate: "♚ Schachmatt oder Patt!",
      movesFound: "✅ {0} Züge ({1}s)",
      playingMove: "🤖 {0} {1} wird gespielt ({2}s)",
      cleared: "Gelöscht",
      guestNoReset: "❌ Engine Reset im Gastmodus nicht verfügbar",
      guestNoMpv: "❌ Zuganzahl im Gastmodus nicht änderbar",
      guestNoAuto: "❌ Auto-Analyse im Gastmodus nicht verfügbar",
      guestNoAutoPlay: "❌ Auto-Spielen im Gastmodus nicht verfügbar",
      guestNoAntiBan: "❌ Anti-Ban im Gastmodus nicht verfügbar",
      guestNoAutoMatch: "❌ Auto-Match im Gastmodus nicht verfügbar",
      autoMatchActive: "🔄 Auto-Match aktiv",
      autoMatchExpired: "⏰ Auto-Match Zeit abgelaufen",
      activeInf: "∞ Aktiv",
      gameOver: "🔄 Spiel vorbei! Neues Match ({0}s)…",
      rematchSent: "🔍 Revanche gesendet…",
      searchingGame: "🔍 Neues Spiel wird gesucht…",
      redirectLobby: "🔍 Weiterleitung zur Lobby…",
      movePlayed: "🤖 Zug gespielt: {0}",
      waitingOpponent: "⏳ Gegner am Zug — warte…",
      moveCancel: "Zug abgebrochen — Position oder Zugrecht geändert",
      registerBtn: "📝 Registrieren",
      registerTitle: "ForkSight — Registrierung",
      confirmPH: "Passwort bestätigen",
      registerSubmit: "📝 Konto erstellen",
      backToLogin: "← Zurück zur Anmeldung",
      registering: "⏳ Registrierung läuft...",
      registerRequired: "Alle Felder sind erforderlich!",
      registerPassMismatch: "Passwörter stimmen nicht überein!",
      registerPassShort: "Passwort muss mindestens 6 Zeichen lang sein!",
      registerUserShort: "Benutzername muss mindestens 3 Zeichen lang sein!",
      registerFailed: "Registrierung fehlgeschlagen!",
      registerClosed: "Registrierung ist derzeit geschlossen",
      updateAvailable:
        "🔄 Neue Version verfügbar! Bitte Extension aktualisieren.",
      wsConnected: "⚡ WebSocket verbunden",
      wsProgress: "⏳ Tiefe {0}…",
      aboutTitle: "Über ForkSight",
      aboutText:
        "ForkSight ist ein fortschrittliches Schachanalyse-Tool, das von der Stockfish-Engine angetrieben wird. Es bietet Echtzeit-Taktikanalyse mit visuellen Pfeilen auf dem Brett.<br><br><b>⚠️ Hinweis:</b> Dieses Tool wurde ausschließlich für <b>Bildungszwecke</b> erstellt. Es soll Spielern helfen, zu lernen, Positionen zu studieren und ihr Schachverständnis zu verbessern. Wir raten dringend davon ab, es zum Schummeln in gewerteten Partien zu verwenden. Faires Spiel macht Schach schön.<br><br><b>Version:</b> 1.6",
      aboutCreator: "Ersteller",
      aboutLinks: "Links",
      premiumTitle: "ForkSight Premium",
      premiumSubtitle: "Immer einen Schritt voraus im Schach",
      premiumDepth: "Unbegrenzte Tiefe",
      premiumDepthDesc: "Analyse bis Stufe 30",
      premiumMpv: "Mehrere Varianten (5 PV)",
      premiumMpvDesc: "Die besten 5 Züge gleichzeitig sehen",
      premiumAuto: "Auto-Analyse",
      premiumAutoDesc: "Jeder Zug wird sofort analysiert",
      premiumAutoplay: "Auto-Spielen",
      premiumAutoplayDesc: "Engine spielt automatisch den besten Zug",
      premiumAntiban: "Anti-Ban System",
      premiumAntibanDesc: "Erkennung verhindern mit zufälligen Verzögerungen",
      premiumAutomatch: "Auto-Match",
      premiumAutomatchDesc: "Partien nacheinander finden und spielen",
      premiumCta: "\uD83D\uDE80 Auf Premium upgraden \u2014 ab $2.99/Mo.",
      premiumPrice: "Monatlich: $2.99 | Lebenslang: $19.99",
      premiumContact: "\u2709\uFE0F Kontakt",
      premiumLater: "Vielleicht später",
      premiumFreeMsg:
        "\u26A0\uFE0F Free-Konto \u2014 Voller Zugang mit Premium!",
      coachTab: "\uD83C\uDF93 Coach",
      fullTab: "\u2694\uFE0F Voll",
      coachEvalBar: "Bewertung",
      coachHint: "\uD83D\uDCA1 Hinweis",
      coachHintsLeft: "{0}/{1} \uD83D\uDD11",
      coachBlunderAlert: "\u26A0\uFE0F Patzer-Warnung:",
      coachTacticDetect: "\uD83C\uDFAF Taktik-Erkennung:",
      coachLastMove: "Letzter Zug:",
      coachPerfect: "\uD83C\uDFC6 Ausgezeichneter Zug!",
      coachGood: "\u2705 Guter Zug ({0})",
      coachOk: "\uD83D\uDD38 Nicht schlecht ({0})",
      coachInaccuracy: "\u274C Ungenauigkeit ({0}) Besser: {1}",
      coachBlunder: "\uD83D\uDC80 Patzer! ({0}) Verpasst: {1}",
      coachWinning: "Gewinnend",
      coachEqual: "Ausgeglichen",
      coachLosing: "Verlierend",
      coachGameStats: "\uD83D\uDCC8 Dieses Spiel: {0} Fehler, {1} Taktiken",
      coachTacticFound: "\uD83C\uDFAF TAKTIK VERFÜGBAR!",
      coachNoHints: "Keine Hinweise mehr",
      coachHintShown: "\uD83D\uDCA1 Bester Zug gezeigt (5s)",
      coachWaiting: "Warten auf Ihren Zug\u2026",
      coachDepth: "Coach-Tiefe",
    },
  };
  function _detectLang() {
    const bl = (navigator.language || "en").split("-")[0].toLowerCase();
    return LANGS[bl] ? bl : "en";
  }
  let currentLang = _detectLang();
  function t(key, ...args) {
    const s = LANGS[currentLang]?.[key] || LANGS.en[key] || key;
    return args.length === 0
      ? s
      : s.replace(/\{(\d+)\}/g, (_, i) => args[i] ?? "");
  }

  // ─── Config ───────────────────────────────────────────
  const SVG_NS = "http://www.w3.org/2000/svg";
  const VIEWBOX = 800;
  const SQ = 100;

  const ARROW_COLORS = [
    "rgba(0, 180, 50, 0.9)",
    "rgba(50, 140, 255, 0.85)",
    "rgba(255, 190, 0, 0.80)",
    "rgba(220, 50, 50, 0.75)",
    "rgba(170, 0, 255, 0.70)",
  ];
  const ARROW_WIDTHS = [14, 11, 9, 7, 6];

  const HIGHLIGHT_COLORS = [
    "rgba(0, 180, 50, 0.35)",
    "rgba(50, 140, 255, 0.30)",
    "rgba(255, 190, 0, 0.28)",
    "rgba(220, 50, 50, 0.25)",
    "rgba(170, 0, 255, 0.22)",
  ];

  // ─── State ────────────────────────────────────────────
  let boardEl = null; // cg-board element
  let cgWrap = null; // div.cg-wrap
  let svgOverlay = null;
  let panelEl = null;
  let isAnalyzing = false;
  let autoMode = false;
  let lastFen = "";
  let boardObserver = null;
  let autoDebounceTimer = null;
  let autoPlayEnabled = false;
  let autoPlayColor = "auto";
  let antiBanEnabled = false;
  let moveCounter = 0;
  let autoMatchEnabled = false;
  let autoMatchEndTime = null;
  let gameEndCheckTimer = null;
  let gameResultWatchTimer = null;
  let lastGameEndDetected = 0;
  let winStreak = 0;
  let throwThisGame = false;
  let throwBlunderAt = 0;
  let totalGames = { wins: 0, losses: 0, draws: 0 };
  let consecutiveTimeouts = 0;
  let stealthMode = false;
  let coachMode = false;
  let coachPrevEval = null; // eval before player's move
  let coachBestMove = null; // best move before player moved
  let coachHintsUsed = 0;
  let coachMaxHints = 5;
  let coachErrors = 0;
  let coachTactics = 0;
  let coachBlunderAlert = true;
  let coachTacticDetect = true;
  let coachAutoAnalyzing = false;
  let coachHintTimer = null;
  let isGuest = true; // Misafir modu (varsayılan: true — giriş yapılana kadar)
  let isPremium = false;
  let loggedInUser = null;
  let wsConnection = null;
  let wsApiBase = null;
  let settings = {
    depth: 18,
    multipv: 3,
    turnOverride: "auto",
    eloCeiling: 0,
  };

  // ─── Açılış Kitaplığı (ilk 6 hamle için engine gizleme) ───
  const OPENING_BOOK = {
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": [
      { move: "e2e4", weight: 40 },
      { move: "d2d4", weight: 35 },
      { move: "c2c4", weight: 12 },
      { move: "g1f3", weight: 10 },
      { move: "b1c3", weight: 3 },
    ],
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
      { move: "e7e5", weight: 35 },
      { move: "c7c5", weight: 30 },
      { move: "e7e6", weight: 15 },
      { move: "c7c6", weight: 10 },
      { move: "d7d5", weight: 5 },
      { move: "g7g6", weight: 5 },
    ],
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": [
      { move: "d7d5", weight: 35 },
      { move: "g8f6", weight: 35 },
      { move: "e7e6", weight: 15 },
      { move: "f7f5", weight: 5 },
      { move: "d7d6", weight: 5 },
      { move: "c7c5", weight: 5 },
    ],
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "g1f3", weight: 60 },
      { move: "f1c4", weight: 15 },
      { move: "b1c3", weight: 10 },
      { move: "f2f4", weight: 8 },
      { move: "d2d4", weight: 7 },
    ],
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "g1f3", weight: 55 },
      { move: "b1c3", weight: 20 },
      { move: "c2c3", weight: 12 },
      { move: "d2d4", weight: 8 },
      { move: "f2f4", weight: 5 },
    ],
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "d2d4", weight: 65 },
      { move: "d2d3", weight: 15 },
      { move: "g1f3", weight: 10 },
      { move: "b1c3", weight: 10 },
    ],
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "d2d4", weight: 60 },
      { move: "b1c3", weight: 15 },
      { move: "g1f3", weight: 15 },
      { move: "c2c4", weight: 10 },
    ],
    "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w": [
      { move: "c2c4", weight: 50 },
      { move: "g1f3", weight: 25 },
      { move: "b1c3", weight: 10 },
      { move: "c1f4", weight: 10 },
      { move: "e2e3", weight: 5 },
    ],
    "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w": [
      { move: "c2c4", weight: 50 },
      { move: "g1f3", weight: 25 },
      { move: "c1g5", weight: 10 },
      { move: "b1c3", weight: 10 },
      { move: "e2e3", weight: 5 },
    ],
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
      { move: "b8c6", weight: 55 },
      { move: "g8f6", weight: 25 },
      { move: "d7d6", weight: 10 },
      { move: "f7f5", weight: 5 },
      { move: "d7d5", weight: 5 },
    ],
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
      { move: "f1b5", weight: 40 },
      { move: "f1c4", weight: 30 },
      { move: "d2d4", weight: 15 },
      { move: "b1c3", weight: 10 },
      { move: "d2d3", weight: 5 },
    ],
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b": [
      { move: "e7e6", weight: 40 },
      { move: "c7c6", weight: 25 },
      { move: "d5c4", weight: 20 },
      { move: "e7e5", weight: 10 },
      { move: "g8f6", weight: 5 },
    ],
    "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b": [
      { move: "e7e6", weight: 35 },
      { move: "g7g6", weight: 30 },
      { move: "c7c5", weight: 15 },
      { move: "e7e5", weight: 10 },
      { move: "d7d5", weight: 10 },
    ],
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b": [
      { move: "e7e5", weight: 30 },
      { move: "g8f6", weight: 25 },
      { move: "c7c5", weight: 20 },
      { move: "e7e6", weight: 15 },
      { move: "g7g6", weight: 10 },
    ],
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b": [
      { move: "d7d5", weight: 35 },
      { move: "g8f6", weight: 30 },
      { move: "c7c5", weight: 15 },
      { move: "e7e6", weight: 10 },
      { move: "g7g6", weight: 10 },
    ],
  };

  function getBookMove(fen) {
    const parts = fen.split(" ");
    const key = parts[0] + " " + parts[1];
    const candidates = OPENING_BOOK[key];
    if (!candidates) return null;
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) return c.move;
    }
    return candidates[0].move;
  }

  // ─── Panel CSS (Shadow DOM içine enjekte edilir) ───
  const PANEL_STYLES = `
    .taktik-panel {
      position: fixed; top: 10px; right: 10px; width: 280px;
      background: #1e1e1e; border: 1px solid #444; border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6); z-index: 99999;
      font-family: "Segoe UI", Arial, sans-serif; font-size: 12px;
      color: #ddd; overflow: hidden; user-select: none; pointer-events: auto;
    }
    .taktik-header { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#bf811d; color:#fff; font-weight:bold; font-size:13px; }
    .taktik-title { pointer-events:none; }
    .taktik-body { padding:10px 12px; display:flex; flex-direction:column; gap:7px; }
    .taktik-body.taktik-collapsed { display:none; }
    .taktik-btn { padding:8px 0; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; transition:background 0.15s; width:100%; }
    .taktik-analyze-btn { background:#bf811d; color:#fff; font-size:15px; padding:10px 0; }
    .taktik-analyze-btn:hover { background:#d4922a; }
    .taktik-analyze-btn:active { background:#a87118; }
    .taktik-clear-btn { background:#444; color:#ccc; }
    .taktik-clear-btn:hover { background:#555; }
    .taktik-btn-mini { background:transparent; border:none; color:#fff; font-size:16px; cursor:pointer; padding:0 4px; line-height:1; }
    .taktik-btn-mini:hover { opacity:0.7; }
    .taktik-row { display:flex; align-items:center; gap:6px; }
    .taktik-row label { font-size:11px; color:#aaa; white-space:nowrap; }
    .taktik-row select, .taktik-row input[type="range"] { flex:1; }
    .taktik-row select { background:#333; color:#ddd; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:11px; }
    .taktik-depth { accent-color:#bf811d; }
    .taktik-depth-val { font-weight:bold; color:#fff; min-width:20px; text-align:center; }
    .taktik-fen { font-family:"Consolas",monospace; font-size:9px; color:#888; word-break:break-all; max-height:28px; overflow:hidden; cursor:text; user-select:text; }
    .taktik-status { font-size:11px; padding:4px 6px; border-radius:4px; text-align:center; }
    .taktik-status-info { background:#2a2a2a; color:#aaa; }
    .taktik-status-working { background:#2a3a2a; color:#80d080; }
    .taktik-status-success { background:#1e3a1e; color:#5ddf5d; }
    .taktik-status-error { background:#3a1e1e; color:#ee6666; }
    .taktik-moves { max-height:140px; overflow-y:auto; font-family:"Consolas",monospace; font-size:11px; line-height:1.5; }
    .taktik-moves::-webkit-scrollbar { width:4px; }
    .taktik-moves::-webkit-scrollbar-thumb { background:#555; border-radius:2px; }
    .taktik-move-row { padding:2px 6px; }
    .taktik-auto-row { align-items:center; }
    .taktik-switch { position:relative; display:inline-block; width:36px; height:20px; flex-shrink:0; }
    .taktik-switch input { opacity:0; width:0; height:0; }
    .taktik-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:#555; border-radius:20px; transition:background 0.2s; }
    .taktik-slider::before { content:""; position:absolute; height:14px; width:14px; left:3px; bottom:3px; background:#ddd; border-radius:50%; transition:transform 0.2s; }
    .taktik-switch input:checked + .taktik-slider { background:#bf811d; }
    .taktik-switch input:checked + .taktik-slider::before { transform:translateX(16px); }
    .taktik-auto-label, .taktik-autoplay-label { font-size:11px; font-weight:bold; color:#aaa; margin-left:4px; }
    .taktik-autoplay-color { background:#333; color:#ddd; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:10px; margin-left:4px; }
    .taktik-highlight { border-radius:0; transition:opacity 0.2s; }
    .taktik-mode-tabs { display:flex; border-bottom:1px solid #444; }
    .taktik-mode-tab { flex:1; padding:6px 0; border:none; background:#2a2a2a; color:#888; font-size:12px; font-weight:bold; cursor:pointer; transition:all 0.2s; }
    .taktik-mode-tab:first-child { border-radius:0; }
    .taktik-mode-tab:last-child { border-radius:0; }
    .taktik-mode-tab.active { background:#1e1e1e; color:#fff; border-bottom:2px solid #7c4dff; }
    .taktik-mode-tab:hover:not(.active) { background:#333; }
    .taktik-coach-body { padding:10px; display:flex; flex-direction:column; gap:8px; }
    .taktik-eval-container { background:#1a1a1a; border-radius:8px; overflow:hidden; position:relative; height:28px; }
    .taktik-eval-fill { height:100%; background:#888; width:50%; transition:width 0.5s ease, background 0.5s ease; border-radius:8px; }
    .taktik-eval-text { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:11px; font-weight:bold; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.8); }
    .taktik-move-feedback { display:none; padding:10px; border-radius:8px; font-size:13px; font-weight:bold; text-align:center; }
    .taktik-feedback-perfect { background:rgba(76,175,80,0.2); color:#4CAF50; border:1px solid #4CAF50; }
    .taktik-feedback-good { background:rgba(139,195,74,0.2); color:#8BC34A; border:1px solid #8BC34A; }
    .taktik-feedback-ok { background:rgba(255,193,7,0.15); color:#FFC107; border:1px solid #FFC107; }
    .taktik-feedback-bad { background:rgba(255,152,0,0.15); color:#FF9800; border:1px solid #FF9800; }
    .taktik-feedback-blunder { background:rgba(244,67,54,0.2); color:#f44336; border:1px solid #f44336; animation:taktik-shake 0.5s; }
    @keyframes taktik-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
    @keyframes taktik-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .taktik-coach-miss { border-radius:0; transition:opacity 0.3s; pointer-events:none; z-index:46; position:absolute; width:12.5%; height:12.5%; }
    .taktik-tactic-alert { display:none; background:rgba(124,77,255,0.2); border:1px solid #7c4dff; color:#b388ff; padding:8px; border-radius:8px; text-align:center; font-weight:bold; animation:taktik-pulse 1.5s infinite; }
    .taktik-coach-stats { font-size:11px; color:#888; text-align:center; padding:4px; }
    .taktik-hint-btn { padding:8px 0; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; background:#FF9800; color:#fff; width:100%; transition:background 0.15s; }
    .taktik-hint-btn:hover { background:#F57C00; }
    .taktik-hint-btn:disabled { background:#555; color:#888; cursor:not-allowed; }
  `;

  // ─── Premium Popup ──────────────────────────────────────
  function showPremiumPopup() {
    if (document.getElementById(STEALTH_IDS.premiumPopup)) return;
    const overlay = document.createElement("div");
    overlay.id = STEALTH_IDS.premiumPopup;
    overlay.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:999999;display:flex;align-items:center;justify-content:center">
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);border-radius:20px;padding:40px 36px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5),0 0 40px rgba(233,196,106,0.15);border:1px solid rgba(233,196,106,0.3);position:relative;text-align:center">
          
          <div style="font-size:56px;margin-bottom:12px;filter:drop-shadow(0 0 20px rgba(255,215,0,0.5))">👑</div>
          
          <h2 style="color:#ffd700;font-size:24px;font-weight:800;margin:0 0 8px;text-shadow:0 0 20px rgba(255,215,0,0.3)">${t("premiumTitle")}</h2>
          <p style="color:#8899aa;font-size:13px;margin:0 0 24px">${t("premiumSubtitle")}</p>

          <div style="text-align:left;margin-bottom:24px">
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span style="font-size:20px">🎯</span>
              <div><div style="color:#e0e0e0;font-weight:600;font-size:14px">${t("premiumDepth")}</div><div style="color:#667;font-size:12px">${t("premiumDepthDesc")}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span style="font-size:20px">📊</span>
              <div><div style="color:#e0e0e0;font-weight:600;font-size:14px">${t("premiumMpv")}</div><div style="color:#667;font-size:12px">${t("premiumMpvDesc")}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span style="font-size:20px">⚡</span>
              <div><div style="color:#e0e0e0;font-weight:600;font-size:14px">${t("premiumAuto")}</div><div style="color:#667;font-size:12px">${t("premiumAutoDesc")}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span style="font-size:20px">🤖</span>
              <div><div style="color:#e0e0e0;font-weight:600;font-size:14px">${t("premiumAutoplay")}</div><div style="color:#667;font-size:12px">${t("premiumAutoplayDesc")}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.08)">
              <span style="font-size:20px">🛡️</span>
              <div><div style="color:#e0e0e0;font-weight:600;font-size:14px">${t("premiumAntiban")}</div><div style="color:#667;font-size:12px">${t("premiumAntibanDesc")}</div></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0">
              <span style="font-size:20px">🔄</span>
              <div><div style="color:#e0e0e0;font-weight:600;font-size:14px">${t("premiumAutomatch")}</div><div style="color:#667;font-size:12px">${t("premiumAutomatchDesc")}</div></div>
            </div>
          </div>

          <a href="https://github.com/sponsors/mrtcnygt0" target="_blank" style="display:block;padding:14px 24px;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#1a1a2e;font-weight:800;font-size:16px;border-radius:12px;text-decoration:none;margin-bottom:8px;box-shadow:0 4px 20px rgba(255,215,0,0.3)">
            ${t("premiumCta")}
          </a>
          <p style="color:#8899aa;font-size:11px;margin:0 0 12px;letter-spacing:0.5px">${t("premiumPrice")}</p>

          <div style="display:flex;gap:12px;justify-content:center;margin-bottom:16px">
            <a href="https://mertcanyigit.com" target="_blank" style="color:#6688aa;font-size:12px;text-decoration:none">🌐 mertcanyigit.com</a>
            <a href="mailto:mertcanyigit54@outlook.com" style="color:#6688aa;font-size:12px;text-decoration:none">${t("premiumContact")}</a>
          </div>

          <button class="taktik-premium-close" style="background:transparent;border:1px solid #445;color:#889;padding:8px 24px;border-radius:8px;cursor:pointer;font-size:13px">
            ${t("premiumLater")}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    // Event listener'ları CSP-uyumlu şekilde ekle (inline onclick yerine)
    overlay
      .querySelector(".taktik-premium-close")
      .addEventListener("click", () => overlay.remove());
    overlay.querySelector("div").addEventListener("click", (e) => {
      if (e.target === overlay.querySelector("div")) overlay.remove();
    });
  }

  // ─── Auth (Giriş Sistemi) ─────────────────────────────
  function applyGuestRestrictions() {
    isGuest = true;
    loggedInUser = null;
    // Misafir kısıtlamaları
    settings.depth = Math.min(settings.depth, 8);
    settings.multipv = 1;
    autoPlayEnabled = false;
    autoMode = false;
    antiBanEnabled = false;
    autoMatchEnabled = false;
    stopBoardWatch();
  }

  function removeGuestRestrictions() {
    isGuest = false;
    // isPremium server'dan gelir
  }

  function showLoginModal() {
    // Kayıtlı oturum varsa token ile otomatik giriş
    chrome.storage.local.get(
      ["taktik_lang", "taktik_token", "taktik_user"],
      async (saved) => {
        if (saved.taktik_lang && LANGS[saved.taktik_lang])
          currentLang = saved.taktik_lang;
        if (saved.taktik_token && saved.taktik_user) {
          try {
            const resp = await new Promise((resolve, reject) => {
              chrome.runtime.sendMessage({ type: "verify_token" }, (r) => {
                if (chrome.runtime.lastError)
                  reject(new Error(chrome.runtime.lastError.message));
                else resolve(r);
              });
            });
            if (resp && resp.ok) {
              loggedInUser = resp.username || saved.taktik_user;
              isGuest = false;
              isPremium = !!resp.is_premium;
              onAuthComplete();
              return;
            }
          } catch (e) {
            /* sunucu kapalı, normal modal göster */
          }
        }
        showLoginModalUI();
      },
    );
  }

  function showLoginModalUI() {
    // Eski modal varsa kaldır
    const old = document.getElementById(STEALTH_IDS.loginModal);
    if (old) old.remove();

    const modal = document.createElement("div");
    modal.id = STEALTH_IDS.loginModal;
    modal.innerHTML = `
      <div class="taktik-login-overlay"></div>
      <div class="taktik-login-box">
        <div class="taktik-login-header">${t("loginTitle")}</div>
        <div class="taktik-login-body">
          <div style="display:flex;align-items:center;gap:8px">
            <label style="color:#aaa;font-size:13px;white-space:nowrap">${t("langLabel")}</label>
            <select class="taktik-login-lang" style="flex:1;padding:8px;border:1px solid #444;border-radius:6px;background:#2a2a2a;color:#eee;font-size:13px">
              <option value="en"${currentLang === "en" ? " selected" : ""}>English</option>
              <option value="tr"${currentLang === "tr" ? " selected" : ""}>Türkçe</option>
              <option value="de"${currentLang === "de" ? " selected" : ""}>Deutsch</option>
            </select>
          </div>
          <input type="text" class="taktik-login-user" placeholder="${t("usernamePH")}" autocomplete="off" />
          <input type="password" class="taktik-login-pass" placeholder="${t("passwordPH")}" autocomplete="off" />
          <div class="taktik-login-error" style="display:none"></div>
          <button class="taktik-btn taktik-login-submit">${t("loginBtn")}</button>
          <button class="taktik-btn taktik-login-guest" style="background:#555;margin-top:6px">${t("guestBtn")}</button>
          <button class="taktik-btn taktik-login-register" style="background:transparent;border:1px solid #bf811d;margin-top:6px;font-size:12px">${t("registerBtn")}</button>
        </div>
      </div>
    `;

    // Stiller
    const style = document.createElement("style");
    style.textContent = `
      .taktik-login-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.7); z-index: 99998;
      }
      .taktik-login-box {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #1e1e1e; border: 2px solid #bf811d; border-radius: 12px;
        padding: 0; width: 320px; z-index: 99999; font-family: Arial, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      }
      .taktik-login-header {
        background: #bf811d; color: #fff; padding: 12px 16px; font-size: 15px;
        font-weight: bold; border-radius: 10px 10px 0 0; text-align: center;
      }
      .taktik-login-body {
        padding: 20px 16px; display: flex; flex-direction: column; gap: 10px;
      }
      .taktik-login-body input {
        padding: 10px 12px; border: 1px solid #444; border-radius: 6px;
        background: #2a2a2a; color: #eee; font-size: 14px; outline: none;
      }
      .taktik-login-body input:focus { border-color: #bf811d; }
      .taktik-login-error {
        color: #ff5555; font-size: 13px; text-align: center; padding: 4px 0;
      }
      .taktik-login-submit {
        background: #bf811d !important; font-size: 14px !important;
      }
    `;
    modal.appendChild(style);
    document.body.appendChild(modal);

    const userInput = modal.querySelector(".taktik-login-user");
    const passInput = modal.querySelector(".taktik-login-pass");
    const errorDiv = modal.querySelector(".taktik-login-error");
    const submitBtn = modal.querySelector(".taktik-login-submit");
    const guestBtn = modal.querySelector(".taktik-login-guest");
    const registerBtn = modal.querySelector(".taktik-login-register");
    const langSel = modal.querySelector(".taktik-login-lang");

    langSel.onchange = () => {
      currentLang = langSel.value;
      modal.querySelector(".taktik-login-header").textContent = t("loginTitle");
      langSel.previousElementSibling.textContent = t("langLabel");
      userInput.placeholder = t("usernamePH");
      passInput.placeholder = t("passwordPH");
      submitBtn.textContent = t("loginBtn");
      guestBtn.textContent = t("guestBtn");
    };

    async function doLogin() {
      const username = userInput.value.trim();
      const password = passInput.value.trim();
      if (!username || !password) {
        errorDiv.style.display = "block";
        errorDiv.textContent = t("loginRequired");
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = t("loggingIn");
      errorDiv.style.display = "none";

      try {
        const resp = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: "login", data: { username, password } },
            (r) => {
              if (chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message));
              else resolve(r);
            },
          );
        });
        if (resp && resp.ok) {
          loggedInUser = resp.username;
          isGuest = false;
          isPremium = !!resp.is_premium;
          chrome.storage.local.set({
            taktik_user: username,
            taktik_lang: currentLang,
          });
          modal.remove();
          onAuthComplete();
        } else {
          errorDiv.style.display = "block";
          errorDiv.textContent = resp?.error || t("loginFailed");
          submitBtn.disabled = false;
          submitBtn.textContent = t("loginBtn");
        }
      } catch (e) {
        errorDiv.style.display = "block";
        errorDiv.textContent = t("serverFailed");
        submitBtn.disabled = false;
        submitBtn.textContent = t("loginBtn");
      }
    }

    submitBtn.onclick = doLogin;
    passInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doLogin();
    });
    userInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") passInput.focus();
    });

    guestBtn.onclick = () => {
      chrome.storage.local.set({ taktik_lang: currentLang });
      applyGuestRestrictions();
      modal.remove();
      onAuthComplete();
    };

    registerBtn.onclick = () => showRegisterForm(modal);

    userInput.focus();
  }

  function showRegisterForm(modal) {
    const body = modal.querySelector(".taktik-login-body");
    const header = modal.querySelector(".taktik-login-header");
    header.textContent = t("registerTitle");
    body.innerHTML = `
      <input type="text" class="taktik-reg-user" placeholder="${t("usernamePH")}" autocomplete="off" />
      <input type="password" class="taktik-reg-pass" placeholder="${t("passwordPH")}" autocomplete="off" />
      <input type="password" class="taktik-reg-confirm" placeholder="${t("confirmPH")}" autocomplete="off" />
      <div class="taktik-login-error" style="display:none"></div>
      <button class="taktik-btn taktik-reg-submit" style="background:#bf811d">${t("registerSubmit")}</button>
      <button class="taktik-btn taktik-reg-back" style="background:transparent;border:1px solid #555;margin-top:6px;font-size:12px">${t("backToLogin")}</button>
    `;
    const regUser = body.querySelector(".taktik-reg-user");
    const regPass = body.querySelector(".taktik-reg-pass");
    const regConfirm = body.querySelector(".taktik-reg-confirm");
    const regError = body.querySelector(".taktik-login-error");
    const regSubmit = body.querySelector(".taktik-reg-submit");
    const regBack = body.querySelector(".taktik-reg-back");

    regBack.onclick = () => {
      modal.remove();
      showLoginModalUI();
    };

    regSubmit.onclick = async () => {
      const username = regUser.value.trim();
      const password = regPass.value;
      const confirm = regConfirm.value;
      regError.style.display = "none";
      if (!username || !password || !confirm) {
        regError.style.display = "block";
        regError.textContent = t("registerRequired");
        return;
      }
      if (username.length < 3) {
        regError.style.display = "block";
        regError.textContent = t("registerUserShort");
        return;
      }
      if (password.length < 6) {
        regError.style.display = "block";
        regError.textContent = t("registerPassShort");
        return;
      }
      if (password !== confirm) {
        regError.style.display = "block";
        regError.textContent = t("registerPassMismatch");
        return;
      }
      regSubmit.disabled = true;
      regSubmit.textContent = t("registering");
      try {
        const resp = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: "register", data: { username, password } },
            (r) => {
              if (chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message));
              else resolve(r);
            },
          );
        });
        if (resp && resp.ok) {
          loggedInUser = resp.username;
          isGuest = false;
          isPremium = !!resp.is_premium;
          chrome.storage.local.set({
            taktik_user: username,
            taktik_lang: currentLang,
          });
          modal.remove();
          onAuthComplete();
        } else {
          regError.style.display = "block";
          regError.textContent = resp?.error || t("registerFailed");
          regSubmit.disabled = false;
          regSubmit.textContent = t("registerSubmit");
        }
      } catch (e) {
        regError.style.display = "block";
        regError.textContent = t("serverFailed");
        regSubmit.disabled = false;
        regSubmit.textContent = t("registerSubmit");
      }
    };
    regUser.focus();
  }

  function onAuthComplete() {
    createPanel();
    if (isGuest) {
      updateStatus(t("guestMode"), "info");
    } else if (!isPremium) {
      updateStatus(t("premiumFreeMsg"), "info");
    } else {
      updateStatus(t("welcome", loggedInUser), "success");
    }
    applyUIRestrictions();
    connectWebSocket();
    checkExtensionVersion();
    startGameResultWatch();
  }

  // ─── WebSocket ────────────────────────────────────────
  function connectWebSocket() {
    if (!isPremium) return;
    chrome.storage.local.get("taktik_api_base", (r) => {
      const httpUrl = r.taktik_api_base || "https://forksight.mertcanyigit.com";
      wsApiBase = httpUrl;
      const wsUrl = httpUrl.replace(/^http/, "ws") + "/ws";
      try {
        wsConnection = new WebSocket(wsUrl);
        wsConnection.onopen = () => {
          /* bağlandı */
        };
        wsConnection.onclose = () => {
          wsConnection = null;
        };
        wsConnection.onerror = () => {
          wsConnection = null;
        };
      } catch (e) {
        wsConnection = null;
      }
    });
  }

  function analyzeViaWS(fen, depth, multipv, max_time) {
    return new Promise((resolve) => {
      if (!wsConnection || wsConnection.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      chrome.storage.local.get("taktik_token", (r) => {
        const token = r.taktik_token || "";
        let lastProgress = null;
        const handler = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "progress") {
              lastProgress = msg;
              updateStatus(t("wsProgress", msg.depth), "info");
            } else if (msg.type === "result") {
              wsConnection.removeEventListener("message", handler);
              resolve(msg.data);
            } else if (msg.type === "error") {
              wsConnection.removeEventListener("message", handler);
              resolve(null);
            }
          } catch (e) {
            resolve(null);
          }
        };
        wsConnection.addEventListener("message", handler);
        wsConnection.send(
          JSON.stringify({ fen, depth, multipv, max_time, token }),
        );
        setTimeout(() => {
          wsConnection.removeEventListener("message", handler);
          resolve(null);
        }, 30000);
      });
    });
  }

  // ─── Versiyon Kontrolü ────────────────────────────────
  function checkExtensionVersion() {
    chrome.runtime.sendMessage({ type: "version" }, (resp) => {
      if (chrome.runtime.lastError || !resp || resp.error) return;
      if (resp.min_extension_version) {
        const current = chrome.runtime.getManifest?.()?.version || "1.0";
        if (current < resp.min_extension_version) {
          showUpdateToast();
        }
      }
    });
  }

  function showUpdateToast() {
    const toast = document.createElement("div");
    toast.style.cssText =
      "position:fixed;top:20px;right:20px;background:#1e1e1e;border:2px solid #bf811d;border-radius:8px;padding:12px 18px;z-index:999999;color:#eee;font-size:13px;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:pointer";
    toast.textContent = t("updateAvailable");
    toast.onclick = () => toast.remove();
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 10000);
  }

  function applyUIRestrictions() {
    if (!panelEl || isPremium) return;
    // Non-premium: depth max 8
    settings.depth = Math.min(settings.depth, 8);
    settings.multipv = 1;
    const depthSlider = panelEl.querySelector(".taktik-depth");
    if (depthSlider) {
      depthSlider.max = "8";
      depthSlider.value = String(settings.depth);
      const depthVal = panelEl.querySelector(".taktik-depth-val");
      if (depthVal) depthVal.textContent = String(settings.depth);
    }
    // Multipv 1'e sabitle
    const mpvSel = panelEl.querySelector(".taktik-mpv");
    if (mpvSel) {
      mpvSel.value = "1";
      settings.multipv = 1;
    }
    // Toggle'ları kapat (disabled yapmadan — onclick premium popup gösterecek)
    const resetToggle = (sel) => {
      const el = panelEl.querySelector(sel);
      if (el) el.checked = false;
    };
    resetToggle(".taktik-auto-toggle");
    resetToggle(".taktik-autoplay-toggle");
    resetToggle(".taktik-antiban-toggle");
    resetToggle(".taktik-automatch-toggle");
    // Engine reset butonunu soluklaştır
    const resetBtn = panelEl.querySelector(".taktik-reset-btn");
    if (resetBtn) {
      resetBtn.style.opacity = "0.5";
    }
  }

  // ─── Helpers ──────────────────────────────────────────
  async function resetEngine() {
    updateStatus(t("engineResetting"), "info");
    try {
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "reset" }, resolve);
      });
      if (resp && resp.ok) {
        consecutiveTimeouts = 0;
        updateStatus(t("engineResetDone"), "success");
      } else {
        updateStatus(t("resetError", resp?.error || "unknown"), "error");
      }
    } catch (e) {
      updateStatus(t("resetError", e.message), "error");
    }
  }

  function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  // ─── Lichess Board Helpers ────────────────────────────
  function findBoard() {
    // Birden fazla selector dene (Lichess SPA'da DOM değişebilir)
    cgWrap = document.querySelector(".cg-wrap");
    if (!cgWrap) cgWrap = document.querySelector("cg-wrap")?.parentElement;
    if (!cgWrap) return null;
    boardEl = cgWrap.querySelector("cg-board");
    if (!boardEl) boardEl = document.querySelector("cg-board");
    return boardEl;
  }

  function isFlipped() {
    return cgWrap?.classList.contains("orientation-black") || false;
  }

  function getPlayerColor() {
    return isFlipped() ? "b" : "w";
  }

  /**
   * Lichess'te taşlar <piece class="white king" style="transform: translate(Xpx, Ypx)">
   * Pozisyon = translate piksel değerinden hesaplanır.
   */
  function readBoardFEN() {
    // Her okumada board referansını yenile (SPA navigasyonu)
    if (!boardEl || !boardEl.isConnected) findBoard();
    if (!boardEl) return null;
    const boardRect = boardEl.getBoundingClientRect();
    if (boardRect.width === 0) {
      // Board stale olabilir, yeniden bul
      findBoard();
      if (!boardEl) return null;
      const retryRect = boardEl.getBoundingClientRect();
      if (retryRect.width === 0) return null;
      return readBoardFENInner(retryRect.width / 8);
    }
    return readBoardFENInner(boardRect.width / 8);
  }

  function readBoardFENInner(sqSize) {
    // 8x8 grid — null ile başlat
    const grid = Array.from({ length: 8 }, () => Array(8).fill(null));

    const pieces = boardEl.querySelectorAll("piece:not(.ghost):not(.fading)");
    for (const p of pieces) {
      // Sınıf: "white king", "black pawn" vb.
      const cls = p.className;
      if (cls.includes("dragging")) continue; // sürüklenen taşı atla

      let color = null,
        role = null;
      if (cls.includes("white")) color = "w";
      else if (cls.includes("black")) color = "b";
      else continue;

      if (cls.includes("king")) role = "k";
      else if (cls.includes("queen")) role = "q";
      else if (cls.includes("rook")) role = "r";
      else if (cls.includes("bishop")) role = "b";
      else if (cls.includes("knight")) role = "n";
      else if (cls.includes("pawn")) role = "p";
      else continue;

      // Pozisyonu translate'den oku
      let px, py;
      const inlineTransform = p.style.transform || "";
      const mTranslate = inlineTransform.match(
        /translate\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\)/,
      );
      if (mTranslate) {
        px = parseFloat(mTranslate[1]);
        py = parseFloat(mTranslate[2]);
      } else {
        // Fallback: computedStyle'dan matrix() oku
        const computed = window.getComputedStyle(p).transform || "";
        const mMatrix = computed.match(
          /matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/,
        );
        if (mMatrix) {
          px = parseFloat(mMatrix[1]);
          py = parseFloat(mMatrix[2]);
        } else {
          continue;
        }
      }

      // Piksel → kare
      let col, row;
      if (isFlipped()) {
        col = 7 - Math.round(px / sqSize);
        row = Math.round(py / sqSize);
      } else {
        col = Math.round(px / sqSize);
        row = 7 - Math.round(py / sqSize);
      }

      if (col < 0 || col > 7 || row < 0 || row > 7) continue;

      const fenChar = color === "w" ? role.toUpperCase() : role;
      grid[7 - row][col] = fenChar;
    }

    // Grid → FEN string
    let fen = "";
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        if (grid[r][c]) {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          fen += grid[r][c];
        } else {
          empty++;
        }
      }
      if (empty > 0) fen += empty;
      if (r < 7) fen += "/";
    }
    return fen;
  }

  // ─── Castling Rights Detection ─────────────────────────
  function detectCastlingRights() {
    let wK = true,
      wQ = true,
      bK = true,
      bQ = true;

    // Board'dan doğrulama: taşlar başlangıç karesinde mi?
    if (!boardEl || !boardEl.isConnected) findBoard();
    if (boardEl) {
      const boardRect = boardEl.getBoundingClientRect();
      const sqSize = boardRect.width / 8;
      if (sqSize > 0) {
        const pieceAt = (fileIdx, rankIdx) => {
          // file: 0=a, rankIdx: 0=1. sıra
          let px, py;
          if (isFlipped()) {
            px = (7 - fileIdx) * sqSize;
            py = rankIdx * sqSize;
          } else {
            px = fileIdx * sqSize;
            py = (7 - rankIdx) * sqSize;
          }
          const pieces = boardEl.querySelectorAll(
            "piece:not(.ghost):not(.fading)",
          );
          for (const p of pieces) {
            let ppx, ppy;
            const inlineT = p.style.transform || "";
            const mT = inlineT.match(
              /translate\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\)/,
            );
            if (mT) {
              ppx = parseFloat(mT[1]);
              ppy = parseFloat(mT[2]);
            } else {
              const comp = window.getComputedStyle(p).transform || "";
              const mM = comp.match(
                /matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/,
              );
              if (mM) {
                ppx = parseFloat(mM[1]);
                ppy = parseFloat(mM[2]);
              } else {
                continue;
              }
            }
            if (
              Math.abs(ppx - px) < sqSize * 0.3 &&
              Math.abs(ppy - py) < sqSize * 0.3
            ) {
              return p.className;
            }
          }
          return null;
        };

        // e1 = file 4, rank 0
        const e1 = pieceAt(4, 0);
        if (!e1 || !e1.includes("white") || !e1.includes("king")) {
          wK = false;
          wQ = false;
        }
        // a1 = file 0, rank 0
        const a1 = pieceAt(0, 0);
        if (!a1 || !a1.includes("white") || !a1.includes("rook")) wQ = false;
        // h1 = file 7, rank 0
        const h1 = pieceAt(7, 0);
        if (!h1 || !h1.includes("white") || !h1.includes("rook")) wK = false;
        // e8 = file 4, rank 7
        const e8 = pieceAt(4, 7);
        if (!e8 || !e8.includes("black") || !e8.includes("king")) {
          bK = false;
          bQ = false;
        }
        // a8 = file 0, rank 7
        const a8 = pieceAt(0, 7);
        if (!a8 || !a8.includes("black") || !a8.includes("rook")) bQ = false;
        // h8 = file 7, rank 7
        const h8 = pieceAt(7, 7);
        if (!h8 || !h8.includes("black") || !h8.includes("rook")) bK = false;
      }
    }

    // Hamle listesinden kontrol
    const moveTags = document.querySelectorAll(
      "l4x kwdb, .moves kwdb, .tview2 kwdb, move",
    );
    for (let i = 0; i < moveTags.length; i++) {
      const isWhite = i % 2 === 0;
      const txt = (moveTags[i].textContent || "").trim();

      if (txt.includes("O-O")) {
        if (isWhite) {
          wK = false;
          wQ = false;
        } else {
          bK = false;
          bQ = false;
        }
        continue;
      }
      if (/^K/.test(txt)) {
        if (isWhite) {
          wK = false;
          wQ = false;
        } else {
          bK = false;
          bQ = false;
        }
        continue;
      }
      if (/^R/.test(txt)) {
        const colMatch = txt.match(/^R([a-h])/);
        if (colMatch) {
          const srcCol = colMatch[1];
          if (isWhite) {
            if (srcCol === "a") wQ = false;
            if (srcCol === "h") wK = false;
          } else {
            if (srcCol === "a") bQ = false;
            if (srcCol === "h") bK = false;
          }
        }
      }
    }

    let rights = "";
    if (wK) rights += "K";
    if (wQ) rights += "Q";
    if (bK) rights += "k";
    if (bQ) rights += "q";
    return rights || "-";
  }

  // ─── Turn Detection ───────────────────────────────────
  function detectRealTurn() {
    // Yöntem 1: Lichess'te aktif saat = oynayacak tarafın saati
    const runningClock = document.querySelector(".rclock.running");
    if (runningClock) {
      if (runningClock.classList.contains("rclock-bottom")) {
        return getPlayerColor();
      } else {
        return getPlayerColor() === "w" ? "b" : "w";
      }
    }

    // Yöntem 2: Hamle sayısından
    const moveTags = document.querySelectorAll(
      "l4x kwdb, .moves kwdb, .tview2 kwdb, move",
    );
    if (moveTags.length > 0) {
      return moveTags.length % 2 === 0 ? "w" : "b";
    }

    return "w";
  }

  function detectTurn() {
    if (settings.turnOverride !== "auto") return settings.turnOverride;
    return detectRealTurn();
  }

  // ─── Square → Pixel (SVG coordinates) ─────────────────
  function sqToPixel(col, row) {
    const flip = isFlipped();
    const x = flip ? (8 - col) * SQ + SQ / 2 : (col - 1) * SQ + SQ / 2;
    const y = flip ? (row - 1) * SQ + SQ / 2 : (8 - row) * SQ + SQ / 2;
    return { x, y };
  }

  function uciToCoords(uci) {
    return {
      fromCol: uci.charCodeAt(0) - 96,
      fromRow: parseInt(uci[1]),
      toCol: uci.charCodeAt(2) - 96,
      toRow: parseInt(uci[3]),
    };
  }

  // ─── SVG Overlay ──────────────────────────────────────
  function ensureOverlay() {
    if (svgOverlay && svgOverlay.parentElement) return svgOverlay;
    if (!boardEl || !boardEl.isConnected) findBoard();
    if (!boardEl) return null;

    svgOverlay = svgEl("svg", {
      id: STEALTH_IDS.overlay,
      viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
      preserveAspectRatio: "xMidYMid meet",
    });
    svgOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;";

    // Lichess'te cg-board zaten position:relative
    boardEl.appendChild(svgOverlay);
    return svgOverlay;
  }

  function clearArrows() {
    if (svgOverlay) svgOverlay.innerHTML = "";
    document.querySelectorAll(".taktik-highlight").forEach((el) => el.remove());
  }

  function drawArrow(svg, x1, y1, x2, y2, color, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = width * 2.2;
    const spread = Math.PI / 5.5;

    const lineEndX = x2 - headLen * Math.cos(angle);
    const lineEndY = y2 - headLen * Math.sin(angle);

    const line = svgEl("line", {
      x1,
      y1,
      x2: lineEndX,
      y2: lineEndY,
      stroke: color,
      "stroke-width": width,
      "stroke-linecap": "round",
    });

    const p1x = x2 - headLen * 1.8 * Math.cos(angle - spread);
    const p1y = y2 - headLen * 1.8 * Math.sin(angle - spread);
    const p2x = x2 - headLen * 1.8 * Math.cos(angle + spread);
    const p2y = y2 - headLen * 1.8 * Math.sin(angle + spread);

    const head = svgEl("polygon", {
      points: `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`,
      fill: color,
    });

    svg.appendChild(line);
    svg.appendChild(head);
  }

  function drawSquareHighlight(col, row, color) {
    const flip = isFlipped();
    const pctX = flip ? (8 - col) * 12.5 : (col - 1) * 12.5;
    const pctY = flip ? (row - 1) * 12.5 : (8 - row) * 12.5;

    const div = document.createElement("div");
    div.className = "taktik-highlight";
    div.style.cssText = `
      position:absolute;
      left:${pctX}%;top:${pctY}%;
      width:12.5%;height:12.5%;
      background:${color};
      pointer-events:none;
      z-index:45;
    `;
    boardEl.appendChild(div);
  }

  function renderMoves(moves) {
    if (stealthMode) return;
    const svg = ensureOverlay();
    clearArrows();

    for (let i = 0; i < moves.length && i < ARROW_COLORS.length; i++) {
      const m = moves[i];
      const c = uciToCoords(m.move);
      const from = sqToPixel(c.fromCol, c.fromRow);
      const to = sqToPixel(c.toCol, c.toRow);

      drawSquareHighlight(c.fromCol, c.fromRow, HIGHLIGHT_COLORS[i]);
      drawSquareHighlight(c.toCol, c.toRow, HIGHLIGHT_COLORS[i]);

      drawArrow(
        svg,
        from.x,
        from.y,
        to.x,
        to.y,
        ARROW_COLORS[i],
        ARROW_WIDTHS[i],
      );

      if (m.score) {
        const label = svgEl("text", {
          x: to.x + 18,
          y: to.y - 14,
          fill: ARROW_COLORS[i],
          "font-size": "22",
          "font-weight": "bold",
          "font-family": "Arial, sans-serif",
          "paint-order": "stroke",
          stroke: "rgba(0,0,0,0.7)",
          "stroke-width": "4",
        });
        label.textContent = m.score;
        svg.appendChild(label);
      }
    }
  }

  // ─── Server Communication ────────────────────────────
  async function analyzePosition() {
    if (isAnalyzing) return;
    // Board referansını yenile
    findBoard();
    if (!boardEl) {
      updateStatus(t("boardNotFound"), "error");
      return;
    }

    isAnalyzing = true;
    updateStatus(t("readingBoard"), "working");
    clearArrows();

    const fenBoard = readBoardFEN();
    if (!fenBoard) {
      updateStatus(t("boardReadError"), "error");
      isAnalyzing = false;
      return;
    }

    const turn = detectTurn();
    const castling = detectCastlingRights();
    const fen = `${fenBoard} ${turn} ${castling} - 0 1`;

    // Kalan süreye göre derinliği otomatik ayarla
    const clock = getClockInfo();
    const remaining = clock.mySeconds ?? 999;
    let effectiveDepth = settings.depth;
    if (!isPremium) effectiveDepth = Math.min(effectiveDepth, 8);
    if (remaining < 5) effectiveDepth = Math.min(effectiveDepth, 3);
    else if (remaining < 10) effectiveDepth = Math.min(effectiveDepth, 5);
    else if (remaining < 20) effectiveDepth = Math.min(effectiveDepth, 7);
    else if (remaining < 40) effectiveDepth = Math.min(effectiveDepth, 9);
    else if (remaining < 60) effectiveDepth = Math.min(effectiveDepth, 11);
    else if (remaining < 120) effectiveDepth = Math.min(effectiveDepth, 13);
    else if (remaining < 300) effectiveDepth = Math.min(effectiveDepth, 15);

    // ─── Elo tavanına göre derinlik sınırı ───
    if (settings.eloCeiling > 0) {
      const eloDepthCap = Math.round(
        3 + ((settings.eloCeiling - 800) * 17) / 2000,
      ); // 800→3, 1500→9, 2000→13, 2800→20
      effectiveDepth = Math.min(effectiveDepth, Math.max(3, eloDepthCap));
    }

    // Kalan süreye göre server timeout'u
    let maxTime = 0;
    if (remaining < 5) maxTime = 1.5;
    else if (remaining < 10) maxTime = 2;
    else if (remaining < 20) maxTime = 3;
    else if (remaining < 40) maxTime = 5;
    else if (remaining < 60) maxTime = 8;
    else if (remaining < 120) maxTime = 12;
    else if (remaining < 300) maxTime = 15;

    updateStatus(
      t(
        "thinking",
        effectiveDepth,
        effectiveDepth < settings.depth ? " ⏱" : "",
      ),
      "working",
    );
    updateFenDisplay(fen);

    // Anti-ban açıkken en az 3 hamle lazım (suboptimal seçim için)
    // Anti-ban kapalıysa auto-play'de 1 yeterli (hız için)
    const effectiveMultipv = autoPlayEnabled
      ? antiBanEnabled
        ? Math.max(3, settings.multipv)
        : 1
      : settings.multipv;

    try {
      // WebSocket ile dene (varsa), yoksa HTTP fallback
      let response = null;
      if (
        wsConnection &&
        wsConnection.readyState === WebSocket.OPEN &&
        !isGuest
      ) {
        response = await analyzeViaWS(
          fen,
          effectiveDepth,
          effectiveMultipv,
          maxTime,
        );
      }
      if (!response) {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "analyze",
              data: {
                fen,
                depth: effectiveDepth,
                multipv: effectiveMultipv,
                max_time: maxTime,
              },
            },
            (resp) => {
              if (chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message));
              else resolve(resp);
            },
          );
        });
      }

      if (!response || !response.ok) {
        updateStatus(`❌ ${response?.error || t("serverConnFail")}`, "error");
        isAnalyzing = false;
        return;
      }

      if (response.moves.length === 0) {
        if (response.timeout) {
          consecutiveTimeouts++;
          if (consecutiveTimeouts >= 3) {
            updateStatus(t("timeoutReset"), "error");
            isAnalyzing = false;
            await resetEngine();
            if (autoMode) setTimeout(() => analyzePosition(), 500);
            return;
          }
          updateStatus(t("timeoutMsg", consecutiveTimeouts), "error");
          isAnalyzing = false;
          if (autoMode) setTimeout(() => analyzePosition(), 1000);
          return;
        }
        updateStatus(t("mateStalemate"), "info");
        isAnalyzing = false;
        return;
      }

      renderMoves(response.moves);
      updateMoveList(response.moves);
      consecutiveTimeouts = 0;
      updateStatus(
        t("movesFound", response.moves.length, response.time),
        "success",
      );

      // Otomatik oynama
      if (autoPlayEnabled && response.moves.length > 0) {
        const apColor =
          autoPlayColor === "auto" ? getPlayerColor() : autoPlayColor;
        const realTurn = detectRealTurn();
        if (realTurn === apColor) {
          // ─── Açılış kitaplığı: ilk 6 hamlede engine pattern'i gizle ───
          let chosen;
          const currentFen = readBoardFEN();
          const bookMove =
            antiBanEnabled && moveCounter < 6 ? getBookMove(currentFen) : null;
          if (bookMove) {
            const bookDelay = gaussianRandom(1200 + Math.random() * 2000, 500);
            chosen = {
              move: bookMove,
              delay: Math.max(300, Math.round(bookDelay)),
            };
            updateStatus(
              t("bookMove", bookMove, (chosen.delay / 1000).toFixed(1)),
              "working",
            );
          } else {
            chosen = antiBanEnabled
              ? antiBanChooseMove(response.moves)
              : { move: response.moves[0].move, delay: 50 };
          }
          const delayMs = chosen.delay;
          const fenAtDecision = currentFen;
          if (!bookMove) {
            updateStatus(
              t(
                "playingMove",
                antiBanEnabled ? "🛡️" : "",
                chosen.move,
                (delayMs / 1000).toFixed(1),
              ),
              "working",
            );
          }
          setTimeout(() => {
            const fenNow = readBoardFEN();
            const turnNow = detectRealTurn();
            if (fenNow !== fenAtDecision || turnNow !== apColor) {
              console.log("[Taktik] " + t("moveCancel"));
              return;
            }
            playMoveOnBoard(chosen.move);
            moveCounter++;
          }, delayMs);
        }
      }
    } catch (err) {
      updateStatus(`❌ ${err.message}`, "error");
    }

    isAnalyzing = false;
  }

  // ─── UI Panel ─────────────────────────────────────────
  function createPanel() {
    if (panelEl) return;

    // Shadow DOM host oluştur (Lichess querySelector ile bulamaz)
    shadowHost = document.createElement("div");
    shadowHost.id = STEALTH_IDS.host;
    shadowHost.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;z-index:99999;pointer-events:none;";
    document.body.appendChild(shadowHost);
    shadowRoot = shadowHost.attachShadow({ mode: "closed" });

    // Style'ları Shadow DOM içine enjekte et
    const styleEl = document.createElement("style");
    styleEl.textContent = PANEL_STYLES;
    shadowRoot.appendChild(styleEl);

    panelEl = document.createElement("div");
    panelEl.id = STEALTH_IDS.panel;
    panelEl.setAttribute("class", "taktik-panel");
    const userBadge = isGuest
      ? `<span style="color:#aaa;font-size:11px;margin-left:6px">${t("guest")}</span>`
      : isPremium
        ? `<span style="color:#ffd700;font-size:11px;margin-left:6px">👑 ${loggedInUser}</span>`
        : `<span style="color:#aaa;font-size:11px;margin-left:6px">✓ ${loggedInUser} <span style="color:#ff9040;font-size:10px">(Free)</span></span>`;
    panelEl.innerHTML = `
      <div class="taktik-header">
        <span class="taktik-title">${t("panelTitle")} ${userBadge}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <select class="taktik-lang-sel" title="${t("langLabel")}" style="font-size:11px;padding:1px 2px;background:#333;color:#eee;border:1px solid #555;border-radius:4px;cursor:pointer">
            <option value="en"${currentLang === "en" ? " selected" : ""}>EN</option>
            <option value="tr"${currentLang === "tr" ? " selected" : ""}>TR</option>
            <option value="de"${currentLang === "de" ? " selected" : ""}>DE</option>
          </select>
          <button class="taktik-btn-mini taktik-about-btn" title="${t("aboutTitle")}" style="font-size:13px;color:#8bb8ff;cursor:pointer">ℹ</button>
          <button class="taktik-btn-mini taktik-logout-btn" title="${t("logoutTitle")}" style="font-size:12px;color:#ff5555">⏻</button>
          <button class="taktik-btn-mini taktik-toggle-btn" title="${t("minimizeTitle")}">—</button>
        </div>
      </div>
      <div class="taktik-mode-tabs">
        <button class="taktik-mode-tab active" data-mode="full">${t("fullTab")}</button>
        <button class="taktik-mode-tab" data-mode="coach">${t("coachTab")}</button>
      </div>
      <div class="taktik-body taktik-full-body">
        <div class="taktik-row taktik-auto-row">
          <label>${t("autoAnalysis")}</label>
          <label class="taktik-switch">
            <input type="checkbox" class="taktik-auto-toggle">
            <span class="taktik-slider"></span>
          </label>
          <span class="taktik-auto-label">${t("off")}</span>
        </div>
        <div class="taktik-row taktik-auto-row">
          <label>${t("autoPlay")}</label>
          <label class="taktik-switch">
            <input type="checkbox" class="taktik-autoplay-toggle">
            <span class="taktik-slider"></span>
          </label>
          <span class="taktik-autoplay-label">${t("off")}</span>
          <select class="taktik-autoplay-color">
            <option value="auto">${t("me")}</option>
            <option value="w">${t("white")}</option>
            <option value="b">${t("black")}</option>
          </select>
        </div>
        <div class="taktik-row taktik-auto-row">
          <label>${t("antiBan")}</label>
          <label class="taktik-switch">
            <input type="checkbox" class="taktik-antiban-toggle">
            <span class="taktik-slider"></span>
          </label>
          <span class="taktik-antiban-label">${t("off")}</span>
        </div>
        <div class="taktik-row">
          <label>${t("eloCeiling")}</label>
          <input type="range" class="taktik-elo-slider" min="0" max="2800" step="100" value="0" style="flex:1;accent-color:#ff9040">
          <span class="taktik-elo-val" style="font-weight:bold;color:#ff9040;min-width:32px;text-align:center;font-size:11px">${t("eloCeilingOff")}</span>
        </div>
        <div class="taktik-row taktik-auto-row">
          <label>${t("autoMatch")}</label>
          <label class="taktik-switch">
            <input type="checkbox" class="taktik-automatch-toggle">
            <span class="taktik-slider"></span>
          </label>
          <span class="taktik-automatch-label">${t("off")}</span>
          <select class="taktik-automatch-duration">
            <option value="10">${t("min10")}</option>
            <option value="30">${t("min30")}</option>
            <option value="60" selected>${t("hour1")}</option>
            <option value="120">${t("hour2")}</option>
            <option value="1440">${t("day1")}</option>
            <option value="0">${t("unlimited")}</option>
          </select>
        </div>
        <button class="taktik-btn taktik-analyze-btn">${t("analyzeBtn")}</button>
        <button class="taktik-btn taktik-clear-btn">${t("clearBtn")}</button>
        <button class="taktik-btn taktik-stealth-btn" style="background:#1a1a2e;color:#7c7cff;margin-top:4px;font-size:11px">${t("stealthBtn")}</button>
        <button class="taktik-btn taktik-reset-btn" style="background:#c62828;margin-top:4px">${t("resetBtn")}</button>

        <div class="taktik-row">
          <label>${t("depth")}</label>
          <input type="range" class="taktik-depth" min="5" max="25" value="${settings.depth}">
          <span class="taktik-depth-val">${settings.depth}</span>
        </div>
        <div class="taktik-row">
          <label>${t("movesLabel")}</label>
          <select class="taktik-mpv">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3" selected>3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
          <label style="margin-left:8px">${t("turnLabel")}</label>
          <select class="taktik-turn">
            <option value="auto">${t("automatic")}</option>
            <option value="w">${t("white")}</option>
            <option value="b">${t("black")}</option>
          </select>
        </div>

        <div class="taktik-fen" title="FEN">—</div>
        <div class="taktik-status">${t("defaultStatus")}</div>
        <div class="taktik-moves"></div>
      </div>
      <div class="taktik-coach-body" style="display:none">
        <div style="font-size:11px;color:#888;text-align:center;margin-bottom:2px">${t("coachEvalBar")}</div>
        <div class="taktik-eval-container">
          <div class="taktik-eval-fill"></div>
          <div class="taktik-eval-text">0.0 ${t("coachEqual")}</div>
        </div>
        <div class="taktik-move-feedback"></div>
        <div class="taktik-tactic-alert">${t("coachTacticFound")}</div>
        <button class="taktik-hint-btn">${t("coachHint")} <span class="taktik-hints-left">${t("coachHintsLeft", coachMaxHints, coachMaxHints)}</span></button>
        <div class="taktik-row taktik-auto-row">
          <label>${t("coachBlunderAlert")}</label>
          <label class="taktik-switch">
            <input type="checkbox" class="taktik-coach-blunder-toggle" checked>
            <span class="taktik-slider"></span>
          </label>
        </div>
        <div class="taktik-row taktik-auto-row">
          <label>${t("coachTacticDetect")}</label>
          <label class="taktik-switch">
            <input type="checkbox" class="taktik-coach-tactic-toggle" checked>
            <span class="taktik-slider"></span>
          </label>
        </div>
        <div class="taktik-row">
          <label>${t("coachDepth")}</label>
          <input type="range" class="taktik-coach-depth" min="5" max="25" value="${settings.depth}">
          <span class="taktik-coach-depth-val">${settings.depth}</span>
        </div>
        <button class="taktik-btn taktik-stealth-btn" style="background:#1a1a2e;color:#7c7cff;margin-top:4px;font-size:11px">${t("stealthBtn")}</button>
        <div class="taktik-coach-stats">${t("coachGameStats", 0, 0)}</div>
        <div class="taktik-coach-status" style="font-size:11px;color:#888;text-align:center;padding:4px">${t("coachWaiting")}</div>
      </div>
    `;

    shadowRoot.appendChild(panelEl);

    // Event listeners
    panelEl.querySelector(".taktik-analyze-btn").onclick = analyzePosition;
    panelEl.querySelector(".taktik-clear-btn").onclick = () => {
      clearArrows();
      updateStatus(t("cleared"), "info");
      panelEl.querySelector(".taktik-moves").innerHTML = "";
    };
    panelEl.querySelectorAll(".taktik-stealth-btn").forEach((btn) => {
      btn.onclick = () => {
        stealthMode = true;
        if (panelEl) panelEl.style.display = "none";
        clearArrows();
        if (svgOverlay) svgOverlay.style.display = "none";
        document
          .querySelectorAll(".taktik-highlight")
          .forEach((el) => el.remove());
      };
    });
    panelEl.querySelector(".taktik-reset-btn").onclick = () => {
      if (!isPremium) {
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoReset"), "error");
        return;
      }
      resetEngine();
    };

    // ─── Coach Mode Event Handlers ─────────────────────────
    panelEl.querySelectorAll(".taktik-mode-tab").forEach((tab) => {
      tab.onclick = () => {
        panelEl
          .querySelectorAll(".taktik-mode-tab")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const mode = tab.dataset.mode;
        const fullBody = panelEl.querySelector(".taktik-full-body");
        const coachBody = panelEl.querySelector(".taktik-coach-body");
        if (mode === "coach") {
          coachMode = true;
          if (fullBody) fullBody.style.display = "none";
          if (coachBody) coachBody.style.display = "flex";
          clearArrows();
          startCoachObserver();
        } else {
          coachMode = false;
          if (fullBody) fullBody.style.display = "";
          if (coachBody) coachBody.style.display = "none";
          stopCoachObserver();
          clearArrows();
        }
      };
    });

    panelEl.querySelector(".taktik-hint-btn").onclick = () => {
      if (!isPremium && !isGuest) {
        showPremiumPopup();
        return;
      }
      if (coachHintsUsed >= coachMaxHints) {
        updateCoachStatus(t("coachNoHints"));
        return;
      }
      coachHintsUsed++;
      const hintsLeft = panelEl.querySelector(".taktik-hints-left");
      if (hintsLeft)
        hintsLeft.textContent = t(
          "coachHintsLeft",
          coachMaxHints - coachHintsUsed,
          coachMaxHints,
        );
      showCoachHint();
    };

    const coachBlunderToggle = panelEl.querySelector(
      ".taktik-coach-blunder-toggle",
    );
    if (coachBlunderToggle)
      coachBlunderToggle.onchange = () => {
        coachBlunderAlert = coachBlunderToggle.checked;
      };

    const coachTacticToggle = panelEl.querySelector(
      ".taktik-coach-tactic-toggle",
    );
    if (coachTacticToggle)
      coachTacticToggle.onchange = () => {
        coachTacticDetect = coachTacticToggle.checked;
      };

    const coachDepthSlider = panelEl.querySelector(".taktik-coach-depth");
    const coachDepthVal = panelEl.querySelector(".taktik-coach-depth-val");
    if (coachDepthSlider) {
      coachDepthSlider.oninput = () => {
        let val = parseInt(coachDepthSlider.value);
        if (!isPremium && val > 8) {
          val = 8;
          coachDepthSlider.value = "8";
        }
        coachDepthVal.textContent = val;
        settings.depth = val;
      };
    }

    const depthSlider = panelEl.querySelector(".taktik-depth");
    const depthVal = panelEl.querySelector(".taktik-depth-val");
    depthSlider.oninput = () => {
      let val = parseInt(depthSlider.value);
      if (!isPremium && val > 8) {
        val = 8;
        depthSlider.value = "8";
      }
      settings.depth = val;
      depthVal.textContent = settings.depth;
    };

    panelEl.querySelector(".taktik-mpv").onchange = (e) => {
      if (!isPremium) {
        e.target.value = "1";
        settings.multipv = 1;
        if (!isGuest) showPremiumPopup();
        return;
      }
      settings.multipv = parseInt(e.target.value);
    };
    panelEl.querySelector(".taktik-turn").onchange = (e) => {
      settings.turnOverride = e.target.value;
    };

    // Otomatik mod toggle
    const autoToggle = panelEl.querySelector(".taktik-auto-toggle");
    const autoLabel = panelEl.querySelector(".taktik-auto-label");
    autoToggle.onchange = () => {
      if (!isPremium) {
        autoToggle.checked = false;
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoAuto"), "error");
        return;
      }
      autoMode = autoToggle.checked;
      autoLabel.textContent = autoMode ? t("on") : t("off");
      autoLabel.style.color = autoMode ? "#5ddf5d" : "#aaa";
      if (autoMode) {
        startBoardWatch();
        analyzePosition();
      } else {
        stopBoardWatch();
      }
    };

    // Otomatik oynama toggle
    const autoPlayToggle = panelEl.querySelector(".taktik-autoplay-toggle");
    const autoPlayLabel = panelEl.querySelector(".taktik-autoplay-label");
    const autoPlayColorSel = panelEl.querySelector(".taktik-autoplay-color");
    autoPlayToggle.onchange = () => {
      if (!isPremium) {
        autoPlayToggle.checked = false;
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoAutoPlay"), "error");
        return;
      }
      autoPlayEnabled = autoPlayToggle.checked;
      autoPlayLabel.textContent = autoPlayEnabled ? t("on") : t("off");
      autoPlayLabel.style.color = autoPlayEnabled ? "#ff9040" : "#aaa";
      if (autoPlayEnabled && !autoMode) {
        autoToggle.checked = true;
        autoToggle.onchange();
      }
    };
    autoPlayColorSel.onchange = () => {
      autoPlayColor = autoPlayColorSel.value;
    };

    // Anti-ban toggle
    const antiBanToggle = panelEl.querySelector(".taktik-antiban-toggle");
    const antiBanLabel = panelEl.querySelector(".taktik-antiban-label");
    antiBanToggle.onchange = () => {
      if (!isPremium) {
        antiBanToggle.checked = false;
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoAntiBan"), "error");
        return;
      }
      antiBanEnabled = antiBanToggle.checked;
      antiBanLabel.textContent = antiBanEnabled ? t("on") : t("off");
      antiBanLabel.style.color = antiBanEnabled ? "#ff5050" : "#aaa";
      if (antiBanEnabled) {
        settings.multipv = Math.max(settings.multipv, 3);
        const mpvSel = panelEl.querySelector(".taktik-mpv");
        if (mpvSel) mpvSel.value = String(settings.multipv);
      }
    };

    // Elo ceiling slider
    const eloSlider = panelEl.querySelector(".taktik-elo-slider");
    const eloVal = panelEl.querySelector(".taktik-elo-val");
    eloSlider.oninput = () => {
      const v = parseInt(eloSlider.value);
      settings.eloCeiling = v;
      eloVal.textContent = v === 0 ? t("eloCeilingOff") : String(v);
      eloVal.style.color = v === 0 ? "#aaa" : "#ff9040";
    };

    // Oto maç toggle
    const autoMatchToggle = panelEl.querySelector(".taktik-automatch-toggle");
    const autoMatchLabel = panelEl.querySelector(".taktik-automatch-label");
    const autoMatchDuration = panelEl.querySelector(
      ".taktik-automatch-duration",
    );
    autoMatchToggle.onchange = () => {
      if (!isPremium) {
        autoMatchToggle.checked = false;
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoAutoMatch"), "error");
        return;
      }
      if (autoMatchToggle.checked) {
        const mins = parseInt(autoMatchDuration.value);
        startAutoMatch(mins);
        if (!autoPlayEnabled) {
          const apt = panelEl.querySelector(".taktik-autoplay-toggle");
          if (apt && !apt.checked) {
            apt.checked = true;
            apt.onchange();
          }
        }
      } else {
        stopAutoMatch();
      }
    };
    autoMatchDuration.onchange = () => {
      if (autoMatchEnabled) {
        const mins = parseInt(autoMatchDuration.value);
        autoMatchEndTime = mins > 0 ? Date.now() + mins * 60000 : null;
        updateAutoMatchTimer();
      }
    };

    // Küçültme/büyütme
    const toggleBtn = panelEl.querySelector(".taktik-toggle-btn");
    const fullBody = panelEl.querySelector(".taktik-full-body");
    const coachBody = panelEl.querySelector(".taktik-coach-body");
    const modeTabs = panelEl.querySelector(".taktik-mode-tabs");
    let isCollapsed = false;
    toggleBtn.onclick = () => {
      isCollapsed = !isCollapsed;
      if (isCollapsed) {
        if (fullBody) fullBody.style.display = "none";
        if (coachBody) coachBody.style.display = "none";
        if (modeTabs) modeTabs.style.display = "none";
        toggleBtn.textContent = "+";
      } else {
        if (modeTabs) modeTabs.style.display = "flex";
        if (coachMode) {
          if (fullBody) fullBody.style.display = "none";
          if (coachBody) coachBody.style.display = "flex";
        } else {
          if (fullBody) fullBody.style.display = "";
          if (coachBody) coachBody.style.display = "none";
        }
        toggleBtn.textContent = "—";
      }
    };

    // Çıkış butonu
    panelEl.querySelector(".taktik-logout-btn").onclick = () => doLogout();

    // Hakkında butonu
    panelEl.querySelector(".taktik-about-btn").onclick = () => showAboutModal();

    // Dil değiştirme
    panelEl.querySelector(".taktik-lang-sel").onchange = (e) => {
      currentLang = e.target.value;
      chrome.storage.local.set({ taktik_lang: currentLang });
      const savedAuto = autoMode;
      const savedAutoPlay = autoPlayEnabled;
      const savedAntiBan = antiBanEnabled;
      const savedAutoMatch = autoMatchEnabled;
      panelEl.remove();
      panelEl = null;
      createPanel();
      if (savedAuto) {
        const el = panelEl.querySelector(".taktik-auto-toggle");
        if (el) el.checked = true;
        const lb = panelEl.querySelector(".taktik-auto-label");
        if (lb) {
          lb.textContent = t("on");
          lb.style.color = "#5ddf5d";
        }
      }
      if (savedAutoPlay) {
        const el = panelEl.querySelector(".taktik-autoplay-toggle");
        if (el) el.checked = true;
        const lb = panelEl.querySelector(".taktik-autoplay-label");
        if (lb) {
          lb.textContent = t("on");
          lb.style.color = "#ff9040";
        }
      }
      if (savedAntiBan) {
        const el = panelEl.querySelector(".taktik-antiban-toggle");
        if (el) el.checked = true;
        const lb = panelEl.querySelector(".taktik-antiban-label");
        if (lb) {
          lb.textContent = t("on");
          lb.style.color = "#ff5050";
        }
      }
      if (savedAutoMatch) {
        const el = panelEl.querySelector(".taktik-automatch-toggle");
        if (el) el.checked = true;
        updateAutoMatchTimer();
      }
      if (isGuest) applyUIRestrictions();
    };

    makeDraggable(panelEl, panelEl.querySelector(".taktik-header"));
  }

  // ─── Hakkında Modal ───────────────────────────────────
  function showAboutModal() {
    const old = document.getElementById(STEALTH_IDS.aboutModal);
    if (old) {
      old.remove();
      return;
    }

    const logoUrl = chrome.runtime.getURL("icon.png");
    const overlay = document.createElement("div");
    overlay.id = STEALTH_IDS.aboutModal;
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',Arial,sans-serif";
    overlay.innerHTML = `
      <div style="background:#1a1a2e;border:1px solid #333;border-radius:16px;padding:28px 32px;max-width:420px;width:90%;color:#ddd;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.6)">
        <button style="position:absolute;top:10px;right:14px;background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1">&times;</button>
        <div style="text-align:center;margin-bottom:16px">
          <img src="${logoUrl}" style="width:80px;height:80px;border-radius:12px;margin-bottom:8px" alt="ForkSight">
          <h2 style="margin:0;font-size:20px;color:#7ec87e;font-weight:700">ForkSight</h2>
        </div>
        <p style="font-size:12.5px;line-height:1.7;color:#bbb;margin-bottom:16px">${t("aboutText")}</p>
        <div style="border-top:1px solid #333;padding-top:12px">
          <div style="font-size:11px;color:#888;margin-bottom:6px;font-weight:600">${t("aboutCreator")}</div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <span style="font-size:13px;font-weight:600;color:#eee">Mert Can Yiğit</span>
          </div>
          <div style="font-size:11px;color:#888;margin-bottom:6px;font-weight:600">${t("aboutLinks")}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <a href="https://github.com/mrtcnygt0" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;background:#24292e;color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </a>
            <a href="https://mertcanyigit.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:5px 12px;background:#2d5a2d;color:#fff;border-radius:6px;text-decoration:none;font-size:11px;font-weight:600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              Website
            </a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
    overlay.querySelector("button[style*='position:absolute']").onclick = () =>
      overlay.remove();
  }

  function doLogout() {
    chrome.storage.local.remove([
      "taktik_user",
      "taktik_lang",
      "taktik_token",
      "taktik_refresh_token",
      "taktik_is_admin",
    ]);
    chrome.runtime.sendMessage({ type: "logout" });
    if (wsConnection) {
      try {
        wsConnection.close();
      } catch (e) {}
      wsConnection = null;
    }
    loggedInUser = null;
    isGuest = true;
    autoMode = false;
    autoPlayEnabled = false;
    antiBanEnabled = false;
    autoMatchEnabled = false;
    stopBoardWatch();
    stopAutoMatch();
    stopGameResultWatch();
    clearArrows();
    if (panelEl) {
      panelEl.remove();
      panelEl = null;
    }
    showLoginModal();
  }

  function makeDraggable(el, handle) {
    let dx = 0,
      dy = 0,
      x = 0,
      y = 0;
    handle.style.cursor = "grab";
    handle.onmousedown = (e) => {
      if (["BUTTON", "SELECT", "OPTION"].includes(e.target.tagName)) return;
      e.preventDefault();
      x = e.clientX;
      y = e.clientY;
      handle.style.cursor = "grabbing";
      document.onmousemove = (ev) => {
        dx = ev.clientX - x;
        dy = ev.clientY - y;
        x = ev.clientX;
        y = ev.clientY;
        el.style.top = el.offsetTop + dy + "px";
        el.style.left = el.offsetLeft + dx + "px";
        el.style.right = "auto";
      };
      document.onmouseup = () => {
        handle.style.cursor = "grab";
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }

  function updateStatus(text, type) {
    const el = panelEl?.querySelector(".taktik-status");
    if (!el) return;
    el.textContent = text;
    el.className = `taktik-status taktik-status-${type || "info"}`;
  }

  function updateFenDisplay(fen) {
    const el = panelEl?.querySelector(".taktik-fen");
    if (el) el.textContent = fen;
  }

  function updateMoveList(moves) {
    const el = panelEl?.querySelector(".taktik-moves");
    if (!el) return;
    el.innerHTML = moves
      .map((m, i) => {
        const color = ARROW_COLORS[i] || "#ccc";
        const pv = m.pv_san?.join(" ") || m.pv_uci?.join(" ") || "";
        return `<div class="taktik-move-row" style="border-left:3px solid ${color};padding-left:6px;margin:3px 0">
          <strong>${m.score}</strong> ${pv}
        </div>`;
      })
      .join("");
  }

  // ─── Coach Mode Logic ─────────────────────────────────
  let coachObserver = null;
  let coachLastFen = "";
  let coachLastAnalyzedFen = "";
  let coachDebounceTimer = null;

  function countMoves() {
    // Lichess move list: kwdb elements or move elements
    const moveTags = document.querySelectorAll(
      "l4x kwdb, .moves kwdb, .tview2 kwdb, move",
    );
    return moveTags.length;
  }

  function startCoachObserver() {
    if (coachObserver) return;
    if (!boardEl) return;
    coachLastFen = readBoardFEN() || "";
    coachLastAnalyzedFen = "";
    coachObserver = new MutationObserver(() => {
      if (!coachMode) return;
      // Skip while a piece is being dragged
      if (boardEl.querySelector("piece.dragging")) return;
      const fen = readBoardFEN();
      if (fen && fen !== coachLastFen) {
        coachLastFen = fen;
        updateCoachStatus("⏳ ...");
        // Debounce: wait for clocks/move-list to update
        if (coachDebounceTimer) clearTimeout(coachDebounceTimer);
        coachDebounceTimer = setTimeout(() => {
          // Skip if still dragging
          if (boardEl.querySelector("piece.dragging")) return;
          // Re-read FEN to verify board settled
          const settled = readBoardFEN();
          if (settled && settled === coachLastFen) coachAnalyze();
        }, 600);
      }
    });
    coachObserver.observe(boardEl, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    // Initial analysis with delay
    setTimeout(() => coachAnalyze(), 500);
  }

  function stopCoachObserver() {
    if (coachObserver) {
      coachObserver.disconnect();
      coachObserver = null;
    }
    if (coachDebounceTimer) {
      clearTimeout(coachDebounceTimer);
      coachDebounceTimer = null;
    }
  }

  async function coachAnalyze() {
    if (isAnalyzing || !coachMode) return;
    if (!boardEl) return;
    // Never analyze while a piece is being dragged
    if (boardEl.querySelector("piece.dragging")) return;

    const fenBoard = readBoardFEN();
    if (!fenBoard) return;

    // Skip if same position already analyzed (avoids drag/animation re-triggers)
    if (fenBoard === coachLastAnalyzedFen) return;
    coachLastAnalyzedFen = fenBoard;

    isAnalyzing = true;

    const playerColor = getPlayerColor();

    // Use robust turn detection (clock + highlight + move count fallbacks)
    const turn = detectRealTurn();
    const isPlayerTurn = turn === playerColor;

    const castling = detectCastlingRights();
    const fen = `${fenBoard} ${turn} ${castling} - 0 1`;

    updateCoachStatus("⏳ ...");

    const depth = Math.min(settings.depth, isPremium ? 25 : 8);
    const multipv = 3;

    try {
      let response = null;
      if (
        wsConnection &&
        wsConnection.readyState === WebSocket.OPEN &&
        !isGuest
      ) {
        response = await analyzeViaWS(fen, depth, multipv, 0);
      }
      if (!response) {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: "analyze", data: { fen, depth, multipv, max_time: 0 } },
            (resp) => {
              if (chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message));
              else resolve(resp);
            },
          );
        });
      }

      if (!response || !response.ok || response.moves.length === 0) {
        isAnalyzing = false;
        return;
      }

      const rawScore = parseScore(response.moves[0].score);
      const bestMove = response.moves[0].move;
      // Clamp mate scores to avoid wild eval bar swings
      const clampedScore = Math.max(-15, Math.min(15, rawScore));
      // Engine score is from side-to-move perspective → convert to white's, then player's
      const whiteEval = turn === "w" ? clampedScore : -clampedScore;
      const playerEval = playerColor === "w" ? whiteEval : -whiteEval;

      updateEvalBar(playerEval);

      if (isPlayerTurn) {
        // Player's turn → opponent just moved → store eval for future comparison
        // Keep previous feedback/highlights visible until player moves
        coachPrevEval = playerEval;
        coachBestMove = bestMove;
        updateCoachStatus(t("coachWaiting"));

        // Tactic detection: big gap between 1st and 2nd best move
        if (coachTacticDetect && response.moves.length >= 2) {
          const s1 = Math.max(
            -15,
            Math.min(15, parseScore(response.moves[0].score)),
          );
          const s2 = Math.max(
            -15,
            Math.min(15, parseScore(response.moves[1].score)),
          );
          const gap = Math.abs(s1 - s2);
          if (gap > 1.5 && playerEval > 0) {
            coachTactics++;
            showTacticAlert(true);
            updateCoachStats();
          } else {
            showTacticAlert(false);
          }
        } else {
          showTacticAlert(false);
        }
      } else {
        // Opponent's turn → player just moved → evaluate move quality
        // Clear previous feedback/highlights now that player made a new move
        clearCoachMiss();
        clearCoachFeedback();
        showTacticAlert(false);
        if (coachPrevEval !== null) {
          const evalChange = playerEval - coachPrevEval;
          showMoveFeedback(evalChange, coachBestMove);
          const changeStr =
            (evalChange >= 0 ? "+" : "") + evalChange.toFixed(1);
          updateCoachStatus(
            `${t("coachLastMove")} ${changeStr} (${playerEval >= 0 ? "+" : ""}${playerEval.toFixed(1)})`,
          );
        } else {
          updateCoachStatus(
            `${t("coachLastMove")} (${playerEval >= 0 ? "+" : ""}${playerEval.toFixed(1)})`,
          );
        }
        coachPrevEval = null;
        coachBestMove = null;
      }

      isAnalyzing = false;
    } catch (e) {
      isAnalyzing = false;
      updateCoachStatus("⚠️");
    }
  }

  function updateEvalBar(playerEval) {
    if (!panelEl) return;
    const fill = panelEl.querySelector(".taktik-eval-fill");
    const text = panelEl.querySelector(".taktik-eval-text");
    if (!fill || !text) return;

    // Clamp for display bar width (-10..+10)
    const clamped = Math.max(-10, Math.min(10, playerEval));
    const pct = Math.round(50 + clamped * 5);

    fill.style.width = Math.max(2, Math.min(98, pct)) + "%";
    const displayEval = Math.max(-99, Math.min(99, playerEval));
    if (displayEval > 0.5) {
      fill.style.background = "#4CAF50";
      text.style.color = "#4CAF50";
      text.textContent = `+${displayEval.toFixed(1)} ${t("coachWinning")}`;
    } else if (displayEval < -0.5) {
      fill.style.background = "#f44336";
      text.style.color = "#f44336";
      text.textContent = `${displayEval.toFixed(1)} ${t("coachLosing")}`;
    } else {
      fill.style.background = "#888";
      text.style.color = "#888";
      text.textContent = `${displayEval >= 0 ? "+" : ""}${displayEval.toFixed(1)} ${t("coachEqual")}`;
    }
  }

  let coachMissTimer = null;
  let coachFeedbackTimer = null;

  function clearCoachMiss() {
    if (boardEl)
      boardEl
        .querySelectorAll(".taktik-coach-miss")
        .forEach((el) => el.remove());
    if (coachMissTimer) {
      clearTimeout(coachMissTimer);
      coachMissTimer = null;
    }
  }

  function clearCoachFeedback() {
    if (!panelEl) return;
    const fb = panelEl.querySelector(".taktik-move-feedback");
    if (fb) fb.style.display = "none";
    if (coachFeedbackTimer) {
      clearTimeout(coachFeedbackTimer);
      coachFeedbackTimer = null;
    }
  }

  function showCoachMiss(uciMove) {
    if (!uciMove || uciMove.length < 4 || !boardEl) return;
    clearCoachMiss();
    const flip = isFlipped();
    const fromCol = uciMove.charCodeAt(0) - 96;
    const fromRow = parseInt(uciMove[1]);
    const toCol = uciMove.charCodeAt(2) - 96;
    const toRow = parseInt(uciMove[3]);

    const makeDiv = (col, row, color) => {
      const pctX = flip ? (8 - col) * 12.5 : (col - 1) * 12.5;
      const pctY = flip ? (row - 1) * 12.5 : (8 - row) * 12.5;
      const div = document.createElement("div");
      div.className = "taktik-coach-miss";
      div.style.cssText = `
        position:absolute;
        left:${pctX}%;top:${pctY}%;
        width:12.5%;height:12.5%;
        background:${color};
        pointer-events:none;
        z-index:46;
        border-radius:0;
        transition:opacity 0.3s;
      `;
      boardEl.appendChild(div);
    };
    makeDiv(fromCol, fromRow, "rgba(255, 100, 100, 0.45)"); // light red — piece origin
    makeDiv(toCol, toRow, "rgba(200, 30, 30, 0.55)"); // dark red — target square
    // Safety fallback: auto-clear after 30s if player never moves
    coachMissTimer = setTimeout(() => clearCoachMiss(), 30000);
  }

  function showMoveFeedback(evalChange, bestMove) {
    if (!panelEl) return;
    const fb = panelEl.querySelector(".taktik-move-feedback");
    if (!fb) return;

    fb.style.display = "block";
    fb.className = "taktik-move-feedback";
    const changeStr = (evalChange >= 0 ? "+" : "") + evalChange.toFixed(1);

    if (evalChange >= 0.2) {
      fb.classList.add("taktik-feedback-perfect");
      fb.textContent = t("coachPerfect");
    } else if (evalChange >= -0.3) {
      fb.classList.add("taktik-feedback-good");
      fb.textContent = t("coachGood", changeStr);
    } else if (evalChange >= -1.0) {
      fb.classList.add("taktik-feedback-ok");
      fb.textContent = t("coachOk", changeStr);
    } else if (evalChange >= -2.0) {
      fb.classList.add("taktik-feedback-bad");
      fb.textContent = t("coachInaccuracy", changeStr, bestMove);
      coachErrors++;
      updateCoachStats();
      showCoachMiss(bestMove);
    } else {
      fb.classList.add("taktik-feedback-blunder");
      fb.textContent = t("coachBlunder", changeStr, bestMove);
      coachErrors++;
      updateCoachStats();
      showCoachMiss(bestMove);
    }

    // Safety fallback: auto-hide after 30s if player never moves
    if (coachFeedbackTimer) clearTimeout(coachFeedbackTimer);
    coachFeedbackTimer = setTimeout(() => {
      if (fb) fb.style.display = "none";
      coachFeedbackTimer = null;
    }, 30000);
  }

  function showTacticAlert(show) {
    if (!panelEl) return;
    const alert = panelEl.querySelector(".taktik-tactic-alert");
    if (alert) alert.style.display = show ? "block" : "none";
  }

  function updateCoachStats() {
    if (!panelEl) return;
    const stats = panelEl.querySelector(".taktik-coach-stats");
    if (stats)
      stats.textContent = t("coachGameStats", coachErrors, coachTactics);
  }

  function updateCoachStatus(msg) {
    if (!panelEl) return;
    const status = panelEl.querySelector(".taktik-coach-status");
    if (status) status.textContent = msg;
  }

  async function showCoachHint() {
    if (isAnalyzing) return;
    if (!boardEl) return;

    isAnalyzing = true;
    updateCoachStatus(t("coachHintShown"));

    const fenBoard = readBoardFEN();
    if (!fenBoard) {
      isAnalyzing = false;
      return;
    }

    const turn = detectTurn();
    const castling = detectCastlingRights();
    const fen = `${fenBoard} ${turn} ${castling} - 0 1`;
    const depth = Math.min(settings.depth, isPremium ? 25 : 8);

    try {
      let response = null;
      if (
        wsConnection &&
        wsConnection.readyState === WebSocket.OPEN &&
        !isGuest
      ) {
        response = await analyzeViaWS(fen, depth, 1, 0);
      }
      if (!response) {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            { type: "analyze", data: { fen, depth, multipv: 1, max_time: 0 } },
            (resp) => {
              if (chrome.runtime.lastError)
                reject(new Error(chrome.runtime.lastError.message));
              else resolve(resp);
            },
          );
        });
      }

      if (response && response.ok && response.moves.length > 0) {
        renderMoves([response.moves[0]]);
        if (coachHintTimer) clearTimeout(coachHintTimer);
        coachHintTimer = setTimeout(() => {
          clearArrows();
          coachHintTimer = null;
        }, 5000);
      }
      isAnalyzing = false;
    } catch (e) {
      isAnalyzing = false;
    }
  }

  function resetCoachState() {
    coachPrevEval = null;
    coachBestMove = null;
    coachHintsUsed = 0;
    coachErrors = 0;
    coachTactics = 0;
    if (panelEl) {
      const hintsLeft = panelEl.querySelector(".taktik-hints-left");
      if (hintsLeft)
        hintsLeft.textContent = t(
          "coachHintsLeft",
          coachMaxHints,
          coachMaxHints,
        );
      updateCoachStats();
      const fb = panelEl.querySelector(".taktik-move-feedback");
      if (fb) fb.style.display = "none";
      showTacticAlert(false);
    }
  }

  // ─── Keyboard Shortcuts ───────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "F2") {
      e.preventDefault();
      analyzePosition();
    }
    if (e.key === "F3") {
      e.preventDefault();
      clearArrows();
      updateStatus(t("cleared"), "info");
      if (panelEl) panelEl.querySelector(".taktik-moves").innerHTML = "";
    }
    if (e.key === "F4") {
      e.preventDefault();
      stealthMode = !stealthMode;
      if (stealthMode) {
        if (panelEl) panelEl.style.display = "none";
        clearArrows();
        if (svgOverlay) svgOverlay.style.display = "none";
        document
          .querySelectorAll(".taktik-highlight")
          .forEach((el) => el.remove());
      } else {
        if (panelEl) panelEl.style.display = "";
        if (svgOverlay) svgOverlay.style.display = "";
      }
    }
  });

  // ─── Anti-Ban Mantığı ─────────────────────────────────
  function getClockInfo() {
    // Lichess saat: div.rclock div.time
    const clocks = document.querySelectorAll(".rclock .time");
    let myClock = null,
      oppClock = null;

    for (const c of clocks) {
      const rclock = c.closest(".rclock");
      if (!rclock) continue;
      if (rclock.classList.contains("rclock-bottom")) {
        myClock = c;
      } else if (rclock.classList.contains("rclock-top")) {
        oppClock = c;
      }
    }

    function parseClockText(el) {
      if (!el) return null;
      const txt = (el.textContent || "").replace(/\s/g, "").trim();
      // "4:32" veya "0:15.3" formatı
      const m = txt.match(/(\d+):(\d+)/);
      if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
      // Sadece saniye "15.3"
      const s = txt.match(/^(\d+)\.?\d*$/);
      if (s) return parseInt(s[1]);
      return null;
    }

    const mySeconds = parseClockText(myClock);
    const oppSeconds = parseClockText(oppClock);

    const maxSeen = Math.max(mySeconds || 0, oppSeconds || 0);
    let gameTimeControl = 300;
    if (maxSeen > 540) gameTimeControl = 600;
    else if (maxSeen > 240) gameTimeControl = 300;
    else if (maxSeen > 120) gameTimeControl = 180;
    else if (maxSeen > 0) gameTimeControl = 60;

    return { mySeconds, oppSeconds, gameTimeControl };
  }

  // ─── Gaussian dağılım (Box-Muller) ───
  function gaussianRandom(mean, stddev) {
    let u1, u2;
    do {
      u1 = Math.random();
    } while (u1 === 0);
    u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  }

  function antiBanChooseMove(moves) {
    // ─── Throw Game kontrolü ───
    if (throwThisGame && moves.length >= 2) {
      const throwMove = getThrowMove(moves);
      if (throwMove) {
        const throwDelay = gaussianRandom(3500, 1000);
        return {
          move: throwMove,
          delay: Math.round(Math.max(1000, throwDelay)),
        };
      }
    }

    const complexity = moves.length >= 3 ? evaluateComplexity(moves) : 0.3;
    const clock = getClockInfo();
    const remaining = clock.mySeconds ?? 120;
    const tc = clock.gameTimeControl;

    // ─── Zaman kontrolüne göre temel gecikme (Gaussian merkezleri) ───
    let meanDelay, stdDev;
    if (tc >= 600) {
      meanDelay = 5000 + complexity * 6000;
      stdDev = 2500;
    } else if (tc >= 300) {
      meanDelay = 3000 + complexity * 5000;
      stdDev = 1800;
    } else if (tc >= 180) {
      meanDelay = 1500 + complexity * 3500;
      stdDev = 1200;
    } else {
      meanDelay = 600 + complexity * 1800;
      stdDev = 600;
    }

    // ─── Kalan süreye göre hızlandır ───
    let timePressFactor = 1.0;
    if (remaining < 10) timePressFactor = 0.15;
    else if (remaining < 20) timePressFactor = 0.25;
    else if (remaining < 30) timePressFactor = 0.35;
    else if (remaining < 60) timePressFactor = 0.5;
    else if (remaining < 120) timePressFactor = 0.7;
    meanDelay *= timePressFactor;
    stdDev *= timePressFactor;

    // ─── Düşünme spike'ları (her 6-12 hamlede uzun düşünme) ───
    if (
      moveCounter > 3 &&
      moveCounter % (6 + Math.floor(Math.random() * 7)) === 0
    ) {
      meanDelay *= 2.2;
      stdDev *= 1.5;
    }

    // ─── Premove simülasyonu (bazen anında oyna) ───
    if (complexity < 0.15 && Math.random() < 0.12) {
      meanDelay = 150 + Math.random() * 300;
      stdDev = 80;
    }

    let delay = gaussianRandom(meanDelay, stdDev);
    delay = Math.max(100, Math.round(delay));
    if (remaining < 999) delay = Math.min(delay, remaining * 400);

    // ─── Hamle seçimi — oyun fazına göre accuracy ───
    let chosenIdx = 0;
    const roll = Math.random();

    let p2nd = 0.05,
      p3rd = 0.01;

    if (moveCounter <= 6) {
      p2nd = 0.2;
      p3rd = 0.05;
    } else if (moveCounter <= 20) {
      p2nd = 0.25;
      p3rd = 0.08;
    } else if (moveCounter <= 35) {
      p2nd = 0.18;
      p3rd = 0.05;
    } else {
      p2nd = 0.1;
      p3rd = 0.02;
    }

    if (remaining < 30) {
      p2nd += 0.15;
      p3rd += 0.08;
    } else if (remaining < 60) {
      p2nd += 0.08;
      p3rd += 0.03;
    }

    // ─── Kritik pozisyon tespiti: skor farkı kontrolü ───
    // Taş değişimi, asılı taş kurtarma gibi zorunlu hamlelerde
    // en iyi hamleden sapma yapılmamalı
    let forceBest = false;
    if (moves.length >= 2) {
      const s1 = parseScore(moves[0].score);
      const s2 = parseScore(moves[1].score);
      const gap = Math.abs(s1 - s2);
      if (gap > 2.0) {
        // Büyük fark: taş kaybı riski — zorla en iyi hamle
        forceBest = true;
      } else if (gap > 1.0) {
        // Orta fark: olasılıkları çok düşür
        p2nd *= 0.15;
        p3rd *= 0.05;
      }
    }

    // ─── Elo tavanı: hedef Elo'ya göre hata oranını ayarla ───
    if (settings.eloCeiling > 0 && !forceBest) {
      const elo = settings.eloCeiling;
      const errorMult = Math.max(0.05, 3.0 - (elo - 800) * (2.95 / 2000));
      p2nd *= errorMult;
      p3rd *= errorMult;
      if (
        elo <= 1200 &&
        moves.length >= 3 &&
        Math.random() < (1200 - elo) / 2000
      ) {
        const worstIdx = Math.min(
          moves.length - 1,
          2 + Math.floor(Math.random() * (moves.length - 2)),
        );
        return {
          move: moves[worstIdx].move,
          delay: Math.max(100, Math.round(delay)),
        };
      }
    }

    if (!forceBest && moves.length >= 3) {
      const s1 = parseScore(moves[0].score);
      const s2 = parseScore(moves[1].score);
      const s3 = parseScore(moves[2].score);
      const diff12 = Math.abs(s1 - s2);
      const diff13 = Math.abs(s1 - s3);

      if (diff12 < 0.3) p2nd += 0.25;
      else if (diff12 < 0.7) p2nd += 0.1;
      if (diff13 < 0.5) p3rd += 0.08;

      if (roll < p3rd && diff13 < 1.5) chosenIdx = 2;
      else if (roll < p2nd + p3rd && diff12 < 2.0) chosenIdx = 1;
    } else if (!forceBest && moves.length === 2) {
      const s1 = parseScore(moves[0].score);
      const s2 = parseScore(moves[1].score);
      if (Math.abs(s1 - s2) < 0.5) p2nd += 0.15;
      if (roll < p2nd && Math.abs(s1 - s2) < 2.0) chosenIdx = 1;
    }

    // ─── Periyodik insan hatası (her 8-15 hamlede) ───
    if (
      !forceBest &&
      moveCounter > 0 &&
      moveCounter % (8 + Math.floor(Math.random() * 8)) === 0
    ) {
      if (moves.length >= 2) {
        const s1 = parseScore(moves[0].score);
        const s2 = parseScore(moves[1].score);
        if (Math.abs(s1 - s2) < 1.0) {
          chosenIdx = 1;
          delay += gaussianRandom(2000, 500);
        }
      }
    }

    return {
      move: moves[chosenIdx].move,
      delay: Math.max(100, Math.round(delay)),
    };
  }

  // ─── Throw Game ───────────────────────────────────────
  function shouldThrowNextGame() {
    const threshold = 3 + Math.floor(Math.random() * 4);
    return winStreak >= threshold;
  }

  function setupThrowGame() {
    throwThisGame = true;
    throwBlunderAt = 8 + Math.floor(Math.random() * 9);
  }

  function getThrowMove(moves) {
    if (moveCounter < throwBlunderAt - 2) return null;
    if (moveCounter >= throwBlunderAt - 2 && moveCounter < throwBlunderAt) {
      if (moves.length >= 2 && Math.random() < 0.4) {
        const idx = moves.length >= 3 ? (Math.random() < 0.5 ? 1 : 2) : 1;
        return moves[idx].move;
      }
      return null;
    }
    if (moveCounter === throwBlunderAt) {
      if (moves.length >= 3) return moves[moves.length - 1].move;
      else if (moves.length >= 2) return moves[1].move;
      return null;
    }
    if (moveCounter > throwBlunderAt) {
      if (moves.length >= 2 && Math.random() < 0.5) {
        const idx = Math.min(
          moves.length - 1,
          1 + Math.floor(Math.random() * (moves.length - 1)),
        );
        return moves[idx].move;
      }
    }
    return null;
  }

  function detectGameResult() {
    // Lichess sonuç: div.result-wrap > p.result (dil bağımsız notasyon)
    const resultEl = document.querySelector(".result-wrap .result, .status");
    if (resultEl) {
      const t = (resultEl.textContent || "").trim();
      if (t === "1-0" || t === "0-1" || t === "½-½" || t === "1/2-1/2") {
        const playerColor = getPlayerColor();
        if (t === "1-0") return playerColor === "w" ? "win" : "loss";
        if (t === "0-1") return playerColor === "b" ? "win" : "loss";
        return "draw";
      }
    }
    // Status mesajından (Lichess çoğunlukla İngilizce ama çok dilli olabilir)
    const statusEl = document.querySelector(".result-wrap .status, .rresult");
    if (statusEl) {
      const txt = (statusEl.textContent || "").toLowerCase();
      // WIN
      if (
        txt.includes("checkmate") ||
        txt.includes("wins") ||
        txt.includes("victorious")
      ) {
        if (txt.includes("white"))
          return getPlayerColor() === "w" ? "win" : "loss";
        if (txt.includes("black"))
          return getPlayerColor() === "b" ? "win" : "loss";
        return "win";
      }
      // DRAW
      if (
        txt.includes("draw") ||
        txt.includes("stalemate") ||
        txt.includes("½")
      )
        return "draw";
      // LOSS (resign/timeout → kimin olduğunu anla)
      if (
        txt.includes("resign") ||
        txt.includes("timeout") ||
        txt.includes("abort")
      ) {
        // Lichess: "White resigned" veya "Black left the game"
        if (txt.includes("white"))
          return getPlayerColor() === "w" ? "loss" : "win";
        if (txt.includes("black"))
          return getPlayerColor() === "b" ? "loss" : "win";
        return "loss";
      }
    }
    return null;
  }

  function evaluateComplexity(moves) {
    if (moves.length < 2) return 0.2;
    const scores = moves.map((m) => parseScore(m.score));
    const spread = Math.abs(scores[0] - scores[scores.length - 1]);
    if (spread < 0.3) return 0.8;
    if (spread < 1.0) return 0.5;
    return 0.2;
  }

  function parseScore(scoreStr) {
    if (!scoreStr) return 0;
    if (scoreStr.startsWith("M")) {
      const m = parseInt(scoreStr.slice(1));
      return m > 0 ? 100 - m : -100 - m;
    }
    return parseFloat(scoreStr) || 0;
  }

  // ─── Oyun Sonucu İzleyici (her zaman aktif) ────────────
  function startGameResultWatch() {
    stopGameResultWatch();
    gameResultWatchTimer = setInterval(() => {
      detectAndReportGameEnd();
    }, 3000);
  }

  function stopGameResultWatch() {
    if (gameResultWatchTimer) {
      clearInterval(gameResultWatchTimer);
      gameResultWatchTimer = null;
    }
  }

  function isGameEndDetected() {
    // Yöntem 1: Lichess result-wrap
    const resultWrap = document.querySelector(".result-wrap");
    if (resultWrap) {
      const resultText = (
        resultWrap.querySelector(".result")?.textContent || ""
      ).trim();
      if (
        resultText === "1-0" ||
        resultText === "0-1" ||
        resultText === "½-½"
      ) {
        return true;
      }
    }
    // Yöntem 2: Lichess oyun sonu durumu (status)
    const statusText = document.querySelector(".result-wrap .status, .rresult");
    if (statusText) {
      const txt = (statusText.textContent || "").toLowerCase();
      const keywords = [
        "checkmate",
        "resign",
        "timeout",
        "draw",
        "stalemate",
        "wins",
        "aborted",
        "victorious",
      ];
      if (keywords.some((kw) => txt.includes(kw))) return true;
    }
    // Yöntem 3: Rematch butonu görünmesi
    const rematch = document.querySelector(
      'button.rematch, a.rematch, [data-act="rematch"]',
    );
    if (rematch && rematch.offsetParent !== null) return true;
    return false;
  }

  function detectAndReportGameEnd() {
    if (Date.now() - lastGameEndDetected < 30000) return;
    if (!isGameEndDetected()) return;

    lastGameEndDetected = Date.now();

    // ─── Oyun sonucunu sunucuya bildir ───
    const gameResult = detectGameResult();
    if (gameResult && loggedInUser) {
      const playerColor = getPlayerColor();
      let opponentName = "";
      try {
        // Lichess: Birden fazla strateji ile rakip adını bul
        // Strateji 1: .ruser-top (üstteki oyuncu = rakip)
        const topUser = document.querySelector(
          ".ruser-top .username, .ruser-top a.user-link, .ruser-top .text",
        );
        if (topUser) {
          opponentName = topUser.textContent.trim();
        }
        // Strateji 2: tüm .ruser'lardan dene
        if (!opponentName) {
          const allUsers = document.querySelectorAll(
            ".ruser .username, .ruser a.user-link, .ruser .text",
          );
          const names = [];
          allUsers.forEach((el) => {
            const n = el.textContent.trim();
            if (n && !names.includes(n)) names.push(n);
          });
          if (names.length >= 2) {
            opponentName = names[0];
          } else if (names.length === 1) {
            opponentName = names[0];
          }
        }
        // Strateji 3: game__meta içindeki kullanıcı bilgisi
        if (!opponentName) {
          const metaUsers = document.querySelectorAll(
            ".game__meta a.user-link, .round__app a.user-link",
          );
          const found = [];
          metaUsers.forEach((el) => {
            const n = el.textContent.trim();
            if (n && !found.includes(n)) found.push(n);
          });
          if (found.length >= 1) opponentName = found[0];
        }
      } catch (e) {}
      let timeControl = "";
      try {
        const tcEl = document.querySelector(
          ".setup .time, .game__meta .header .setup span",
        );
        if (tcEl) timeControl = tcEl.textContent.trim();
      } catch (e) {}
      chrome.runtime.sendMessage({
        type: "game_result",
        data: {
          site: "lichess.org",
          game_id:
            (location.pathname.match(/\/(\w{8,12})(?:\/|$)/) || [])[1] || "",
          result: gameResult,
          color: playerColor === "w" ? "white" : "black",
          opponent: opponentName.slice(0, 50),
          time_control: timeControl.slice(0, 30),
          auto_played: autoPlayEnabled,
        },
      });
      console.log(
        `[Taktik] 🎮 Oyun sonucu bildirildi: ${gameResult} vs ${opponentName}`,
      );
    }

    // ─── Anti-ban: sonucu kaydet ve throw kararı ver ───
    if (antiBanEnabled) {
      const result = gameResult || detectGameResult();
      if (result === "win") {
        totalGames.wins++;
        winStreak++;
      } else if (result === "loss") {
        totalGames.losses++;
        winStreak = 0;
        throwThisGame = false;
      } else if (result === "draw") {
        totalGames.draws++;
      }
      console.log(
        `[Taktik] Seri: ${winStreak}W | Toplam: ${totalGames.wins}W/${totalGames.losses}L/${totalGames.draws}D`,
      );
      if (shouldThrowNextGame()) {
        setupThrowGame();
        console.log(
          `[Taktik] 🎭 Sonraki oyun kasıtlı kayıp (hamle: ~${throwBlunderAt})`,
        );
      } else {
        throwThisGame = false;
      }
    }

    return true;
  }

  // ─── Auto Match Farm ─────────────────────────────────
  function startAutoMatch(durationMinutes) {
    autoMatchEnabled = true;
    autoMatchEndTime =
      durationMinutes > 0 ? Date.now() + durationMinutes * 60000 : null;
    lastGameEndDetected = 0;
    startGameEndWatch();
    updateAutoMatchTimer();
    updateStatus(t("autoMatchActive"), "success");
  }

  function stopAutoMatch() {
    autoMatchEnabled = false;
    autoMatchEndTime = null;
    stopGameEndWatch();
    const label = panelEl?.querySelector(".taktik-automatch-label");
    if (label) {
      label.textContent = t("off");
      label.style.color = "#aaa";
    }
    const toggle = panelEl?.querySelector(".taktik-automatch-toggle");
    if (toggle) toggle.checked = false;
  }

  function updateAutoMatchTimer() {
    const label = panelEl?.querySelector(".taktik-automatch-label");
    if (!label) return;
    if (!autoMatchEnabled) {
      label.textContent = t("off");
      label.style.color = "#aaa";
      return;
    }
    if (!autoMatchEndTime) {
      label.textContent = t("activeInf");
      label.style.color = "#50ff50";
      return;
    }
    const remaining = autoMatchEndTime - Date.now();
    if (remaining <= 0) {
      stopAutoMatch();
      updateStatus(t("autoMatchExpired"), "info");
      return;
    }
    const totalMins = Math.ceil(remaining / 60000);
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    label.textContent = hrs > 0 ? `${hrs}s ${mins}dk` : `${totalMins}dk`;
    label.style.color = "#50ff50";
  }

  function startGameEndWatch() {
    stopGameEndWatch();
    gameEndCheckTimer = setInterval(() => {
      if (!autoMatchEnabled) {
        stopGameEndWatch();
        return;
      }
      if (autoMatchEndTime && Date.now() > autoMatchEndTime) {
        stopAutoMatch();
        updateStatus(t("autoMatchExpired"), "info");
        return;
      }
      updateAutoMatchTimer();
      checkGameEnd();
    }, 2500);
  }

  function stopGameEndWatch() {
    if (gameEndCheckTimer) {
      clearInterval(gameEndCheckTimer);
      gameEndCheckTimer = null;
    }
  }

  function checkGameEnd() {
    // detectAndReportGameEnd tüm sonuç tespiti ve raporlamayı yapar
    // true dönerse oyun bitmiş demektir, auto-match navigasyonuna devam et
    if (!detectAndReportGameEnd()) return;

    // Yeni maç başlat
    const delay = 3000 + Math.random() * 5000;
    updateStatus(t("gameOver", (delay / 1000).toFixed(1)), "working");
    setTimeout(() => {
      if (!autoMatchEnabled) return;
      moveCounter = 0;
      lastFen = "";

      // Lichess: Rematch butonuna tıkla, yoksa lobby'e git
      const rematchBtn = document.querySelector(
        'button.rematch, a.rematch, [data-act="rematch"]',
      );
      if (rematchBtn && rematchBtn.offsetParent !== null) {
        rematchBtn.click();
        updateStatus(t("rematchSent"), "working");
        setTimeout(() => {
          // Rematch kabul edilmemişse lobby'e git
          if (!document.querySelector("cg-board")) {
            navigateToLobby();
          } else {
            resetForNewGame();
          }
        }, 8000);
        return;
      }

      navigateToLobby();
    }, delay);
  }

  function navigateToLobby() {
    // Anasayfaya git veya mevcut pool'da yeni oyun ara
    const poolBtns = document.querySelectorAll(
      ".lobby__app .hook__btn, .lobby__start button, [data-id]",
    );
    if (poolBtns.length > 0) {
      // Lobby zaten açıksa bir pool'a tıkla
      const randomPool = poolBtns[Math.floor(Math.random() * poolBtns.length)];
      randomPool.click();
      updateStatus(t("searchingGame"), "working");
    } else {
      window.location.href = "https://lichess.org/";
      updateStatus(t("redirectLobby"), "working");
    }
    setTimeout(() => resetForNewGame(), 5000);
  }

  function resetForNewGame() {
    setTimeout(() => {
      if (autoMode) {
        findBoard();
        if (boardEl) startBoardWatch();
      }
    }, 5000);
  }

  // ─── Auto Play (Otomatik Oynama) ──────────────────────

  // Bezier eğrisi ile insan benzeri fare yolu üret
  function humanMousePath(fromXY, toXY) {
    const steps = 12 + Math.floor(Math.random() * 10); // 12-21 adım
    const points = [];
    const dist = Math.hypot(toXY.x - fromXY.x, toXY.y - fromXY.y);
    const curvature = dist * (0.15 + Math.random() * 0.25);
    const angle = Math.atan2(toXY.y - fromXY.y, toXY.x - fromXY.x);
    const perpAngle =
      angle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const cx = (fromXY.x + toXY.x) / 2 + Math.cos(perpAngle) * curvature;
    const cy = (fromXY.y + toXY.y) / 2 + Math.sin(perpAngle) * curvature;

    for (let i = 0; i <= steps; i++) {
      let t = i / steps;
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x =
        (1 - t) * (1 - t) * fromXY.x + 2 * (1 - t) * t * cx + t * t * toXY.x;
      const y =
        (1 - t) * (1 - t) * fromXY.y + 2 * (1 - t) * t * cy + t * t * toXY.y;
      const jx = (Math.random() - 0.5) * 3;
      const jy = (Math.random() - 0.5) * 3;
      const speed = 8 + Math.random() * 10;
      points.push({ x: x + jx, y: y + jy, delay: Math.round(speed) });
    }
    points[points.length - 1] = { x: toXY.x, y: toXY.y, delay: 5 };
    return points;
  }

  function playMoveOnBoard(uci) {
    if (!boardEl || !boardEl.isConnected) findBoard();
    if (!boardEl || uci.length < 4) return;

    const fromCol = uci.charCodeAt(0) - 96;
    const fromRow = parseInt(uci[1]);
    const toCol = uci.charCodeAt(2) - 96;
    const toRow = parseInt(uci[3]);

    const boardRect = boardEl.getBoundingClientRect();
    const sqSize = boardRect.width / 8;
    const flip = isFlipped();

    function sqToClientXY(col, row) {
      const px = flip
        ? (8 - col) * sqSize + sqSize / 2
        : (col - 1) * sqSize + sqSize / 2;
      const py = flip
        ? (row - 1) * sqSize + sqSize / 2
        : (8 - row) * sqSize + sqSize / 2;
      return { x: boardRect.left + px, y: boardRect.top + py };
    }

    const from = sqToClientXY(fromCol, fromRow);
    const to = sqToClientXY(toCol, toRow);
    const path = humanMousePath(from, to);

    const evtOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
    };

    // ─── Chessground Drag Simülasyonu (Bezier eğrisi ile) ───
    // inject.js isTrusted bypass'ı sağlıyor

    // 1. mousedown: kaynak kareye bas
    boardEl.dispatchEvent(
      new MouseEvent("mousedown", {
        ...evtOpts,
        clientX: from.x,
        clientY: from.y,
        buttons: 1,
      }),
    );

    // 2. Bezier eğrisi boyunca adım adım sürükle
    let totalDelay = 30 + Math.floor(Math.random() * 30);
    for (let i = 1; i < path.length; i++) {
      const pt = path[i];
      totalDelay += pt.delay;
      setTimeout(() => {
        document.dispatchEvent(
          new MouseEvent("mousemove", {
            ...evtOpts,
            clientX: pt.x,
            clientY: pt.y,
            buttons: 1,
          }),
        );
      }, totalDelay);
    }

    // 3. Hedefte bırak
    totalDelay += 15 + Math.floor(Math.random() * 20);
    setTimeout(() => {
      document.dispatchEvent(
        new MouseEvent("mouseup", {
          ...evtOpts,
          clientX: to.x,
          clientY: to.y,
          buttons: 0,
        }),
      );

      // Promosyon
      if (uci.length === 5) {
        setTimeout(() => {
          const promoMap = {
            q: "queen",
            r: "rook",
            b: "bishop",
            n: "knight",
          };
          const promoRole = promoMap[uci[4]] || "queen";
          const promoPiece = document.querySelector(
            `square.cg-promotion piece.${promoRole}, .promotion-choice piece.${promoRole}`,
          );
          if (promoPiece)
            promoPiece.dispatchEvent(
              new MouseEvent("click", { bubbles: true }),
            );
        }, 300);
      }

      updateStatus(t("movePlayed", uci), "success");
    }, totalDelay);
  }

  // ─── Auto Watch (Otomatik Mod) ────────────────────────
  function startBoardWatch() {
    stopBoardWatch();
    if (!boardEl || !boardEl.isConnected) findBoard();
    if (!boardEl) return;

    lastFen = readBoardFEN() || "";

    boardObserver = new MutationObserver(() => {
      if (!autoMode || isAnalyzing) return;

      clearTimeout(autoDebounceTimer);
      autoDebounceTimer = setTimeout(() => {
        const currentFen = readBoardFEN();
        if (currentFen && currentFen !== lastFen) {
          lastFen = currentFen;

          if (autoPlayEnabled) {
            const myColor =
              autoPlayColor === "auto" ? getPlayerColor() : autoPlayColor;
            const currentTurn = detectRealTurn();
            if (currentTurn !== myColor) {
              updateStatus(t("waitingOpponent"), "info");
              return;
            }
          }

          analyzePosition();
        }
      }, 150);
    });

    boardObserver.observe(boardEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  function stopBoardWatch() {
    if (boardObserver) {
      boardObserver.disconnect();
      boardObserver = null;
    }
    clearTimeout(autoDebounceTimer);
  }

  // ─── Cleanup kayıt (reload koruması) ───────────────────
  window.__taktikCleanup = function () {
    autoMode = false;
    autoPlayEnabled = false;
    autoMatchEnabled = false;
    antiBanEnabled = false;
    isAnalyzing = false;
    stopBoardWatch();
    stopGameEndWatch();
    clearTimeout(autoDebounceTimer);
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
      panelEl = null;
    }
    if (svgOverlay) {
      svgOverlay.remove();
      svgOverlay = null;
    }
  };

  // ─── Board Detection & Init ───────────────────────────
  function tryInit() {
    if (!findBoard()) return false;
    // Anti-fingerprint: rastgele gecikme ile başlat (1-3s)
    const initDelay = 1000 + Math.floor(Math.random() * 2000);
    setTimeout(() => showLoginModal(), initDelay);
    return true;
  }

  if (!tryInit()) {
    const obs = new MutationObserver(() => {
      if (tryInit()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => obs.disconnect(), 30000);
  }
})();
