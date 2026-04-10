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

  // ─── Shadow DOM Host (panel Chess.com'un querySelector'ından gizlenir) ───
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
      newGameClicked: "🔍 New Game tab clicked…",
      startingGame: "🔍 Starting game…",
      autoStartFailed: "⚠ Auto start failed",
      movePlayed: "🤖 Move played: {0}",
      moveCancel: "Move cancelled — position or turn changed",
      waitingOpponent: "⏳ Opponent's turn — waiting…",
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
        "ForkSight is an advanced chess analysis tool powered by the Stockfish engine. It provides real-time tactical analysis with visual arrows on the board.<br><br><b>⚠️ Disclaimer:</b> This tool was created for <b>educational purposes only</b>. It is designed to help players learn, study positions and improve their chess understanding. We strongly advise against using it for cheating in rated games. Fair play makes chess beautiful.<br><br><b>Version:</b> 1.0",
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
      newGameClicked: "🔍 Yeni Oyun sekmesine tıklandı…",
      startingGame: "🔍 Oyun başlatılıyor…",
      autoStartFailed: "⚠ Otomatik başlatılamadı",
      movePlayed: "🤖 Hamle oynandı: {0}",
      moveCancel: "Hamle iptal — pozisyon veya sıra değişti",
      waitingOpponent: "⏳ Rakibin sırası — bekleniyor…",
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
        "ForkSight, Stockfish motoru tarafından desteklenen gelişmiş bir satranç analiz aracıdır. Tahta üzerinde görsel oklar ile gerçek zamanlı taktik analiz sunar.<br><br><b>⚠️ Uyarı:</b> Bu araç yalnızca <b>eğitim amaçlı</b> oluşturulmuştur. Oyuncuların öğrenmesine, pozisyonları çalışmasına ve satranç anlayışlarını geliştirmesine yardımcı olmak için tasarlanmıştır. Dereceli oyunlarda hile yapmak için kullanmamanızı şiddetle tavsiye ederiz. Adil oyun satrancı güzel kılar.<br><br><b>Sürüm:</b> 1.0",
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
      newGameClicked: "🔍 Neues Spiel-Tab geklickt…",
      startingGame: "🔍 Spiel wird gestartet…",
      autoStartFailed: "⚠ Automatischer Start fehlgeschlagen",
      movePlayed: "🤖 Zug gespielt: {0}",
      moveCancel: "Zug abgebrochen — Position oder Zugrecht geändert",
      waitingOpponent: "⏳ Gegner am Zug — warte…",
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
        "ForkSight ist ein fortschrittliches Schachanalyse-Tool, das von der Stockfish-Engine angetrieben wird. Es bietet Echtzeit-Taktikanalyse mit visuellen Pfeilen auf dem Brett.<br><br><b>⚠️ Hinweis:</b> Dieses Tool wurde ausschließlich für <b>Bildungszwecke</b> erstellt. Es soll Spielern helfen, zu lernen, Positionen zu studieren und ihr Schachverständnis zu verbessern. Wir raten dringend davon ab, es zum Schummeln in gewerteten Partien zu verwenden. Faires Spiel macht Schach schön.<br><br><b>Version:</b> 1.0",
      aboutCreator: "Ersteller",
      aboutLinks: "Links",
      premiumTitle: "ForkSight Premium",
      premiumSubtitle: "Immer einen Schritt voraus im Schach",
      premiumDepth: "Unbegrenzte Tiefe",
      premiumDepthDesc: "Analyse bis Stufe 30",
      premiumMpv: "Mehrere Varianten (5 PV)",
      premiumMpvDesc: "Die besten 5 Z\u00FCge gleichzeitig sehen",
      premiumAuto: "Auto-Analyse",
      premiumAutoDesc: "Jeder Zug wird sofort analysiert",
      premiumAutoplay: "Auto-Spielen",
      premiumAutoplayDesc: "Engine spielt automatisch den besten Zug",
      premiumAntiban: "Anti-Ban System",
      premiumAntibanDesc:
        "Erkennung verhindern mit zuf\u00E4lligen Verz\u00F6gerungen",
      premiumAutomatch: "Auto-Match",
      premiumAutomatchDesc: "Partien nacheinander finden und spielen",
      premiumCta: "\uD83D\uDE80 Auf Premium upgraden — ab $2.99/Mo.",
      premiumPrice: "Monatlich: $2.99 | Lebenslang: $19.99",
      premiumContact: "\u2709\uFE0F Kontakt",
      premiumLater: "Vielleicht sp\u00E4ter",
      premiumFreeMsg:
        "\u26A0\uFE0F Free-Konto \u2014 Voller Zugang mit Premium!",
    },
  };
  let currentLang = "en";
  function t(key, ...args) {
    const s = LANGS[currentLang]?.[key] || LANGS.en[key] || key;
    return args.length === 0
      ? s
      : s.replace(/\{(\d+)\}/g, (_, i) => args[i] ?? "");
  }

  // ─── Config ───────────────────────────────────────────
  const SVG_NS = "http://www.w3.org/2000/svg";
  const VIEWBOX = 800; // 8 kare × 100px
  const SQ = 100;

  const ARROW_COLORS = [
    "rgba(0, 180, 50, 0.9)", // 1. en iyi — yeşil
    "rgba(50, 140, 255, 0.85)", // 2. — mavi
    "rgba(255, 190, 0, 0.80)", // 3. — sarı
    "rgba(220, 50, 50, 0.75)", // 4. — kırmızı
    "rgba(170, 0, 255, 0.70)", // 5. — mor
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
  let boardEl = null;
  let svgOverlay = null;
  let panelEl = null;
  let isAnalyzing = false;
  let autoMode = false;
  let lastFen = "";
  let boardObserver = null;
  let autoDebounceTimer = null;
  let autoPlayEnabled = false;
  let autoPlayColor = "auto"; // "auto" | "w" | "b"
  let antiBanEnabled = false;
  let moveCounter = 0;
  let autoMatchEnabled = false;
  let autoMatchEndTime = null; // null = sınırsız
  let gameEndCheckTimer = null;
  let gameResultWatchTimer = null; // oyun sonucu izleyici (her zaman aktif)
  let lastGameEndDetected = 0; // aynı oyun sonunu tekrar algılamamak için
  let winStreak = 0; // ardı ardına galibiyet sayısı
  let throwThisGame = false; // bu oyunu kasitli mi kaybedecegiz
  let throwBlunderAt = 0; // kaçıncı hamlede blunder yapacak
  let totalGames = { wins: 0, losses: 0, draws: 0 };
  let consecutiveTimeouts = 0;
  let stealthMode = false;
  let isGuest = true;
  let isPremium = false;
  let loggedInUser = null;
  let wsConnection = null;
  let wsApiBase = null;
  let settings = {
    depth: 18,
    multipv: 3,
    turnOverride: "auto", // "auto" | "w" | "b"
    eloCeiling: 0, // 0 = off, 800-2800
  };

  // ─── Açılış Kitaplığı (ilk 6 hamle için engine gizleme) ───
  const OPENING_BOOK = {
    // Başlangıç pozisyonu
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w": [
      { move: "e2e4", weight: 40 },
      { move: "d2d4", weight: 35 },
      { move: "c2c4", weight: 12 },
      { move: "g1f3", weight: 10 },
      { move: "b1c3", weight: 3 },
    ],
    // 1.e4
    "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b": [
      { move: "e7e5", weight: 35 },
      { move: "c7c5", weight: 30 },
      { move: "e7e6", weight: 15 },
      { move: "c7c6", weight: 10 },
      { move: "d7d5", weight: 5 },
      { move: "g7g6", weight: 5 },
    ],
    // 1.d4
    "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b": [
      { move: "d7d5", weight: 35 },
      { move: "g8f6", weight: 35 },
      { move: "e7e6", weight: 15 },
      { move: "f7f5", weight: 5 },
      { move: "d7d6", weight: 5 },
      { move: "c7c5", weight: 5 },
    ],
    // 1.e4 e5
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "g1f3", weight: 60 },
      { move: "f1c4", weight: 15 },
      { move: "b1c3", weight: 10 },
      { move: "f2f4", weight: 8 },
      { move: "d2d4", weight: 7 },
    ],
    // 1.e4 c5 (Sicilian)
    "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "g1f3", weight: 55 },
      { move: "b1c3", weight: 20 },
      { move: "c2c3", weight: 12 },
      { move: "d2d4", weight: 8 },
      { move: "f2f4", weight: 5 },
    ],
    // 1.e4 e6 (French)
    "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "d2d4", weight: 65 },
      { move: "d2d3", weight: 15 },
      { move: "g1f3", weight: 10 },
      { move: "b1c3", weight: 10 },
    ],
    // 1.e4 c6 (Caro-Kann)
    "rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w": [
      { move: "d2d4", weight: 60 },
      { move: "b1c3", weight: 15 },
      { move: "g1f3", weight: 15 },
      { move: "c2c4", weight: 10 },
    ],
    // 1.d4 d5
    "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w": [
      { move: "c2c4", weight: 50 },
      { move: "g1f3", weight: 25 },
      { move: "b1c3", weight: 10 },
      { move: "c1f4", weight: 10 },
      { move: "e2e3", weight: 5 },
    ],
    // 1.d4 Nf6
    "rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w": [
      { move: "c2c4", weight: 50 },
      { move: "g1f3", weight: 25 },
      { move: "c1g5", weight: 10 },
      { move: "b1c3", weight: 10 },
      { move: "e2e3", weight: 5 },
    ],
    // 1.e4 e5 2.Nf3
    "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b": [
      { move: "b8c6", weight: 55 },
      { move: "g8f6", weight: 25 },
      { move: "d7d6", weight: 10 },
      { move: "f7f5", weight: 5 },
      { move: "d7d5", weight: 5 },
    ],
    // 1.e4 e5 2.Nf3 Nc6
    "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w": [
      { move: "f1b5", weight: 40 },
      { move: "f1c4", weight: 30 },
      { move: "d2d4", weight: 15 },
      { move: "b1c3", weight: 10 },
      { move: "d2d3", weight: 5 },
    ],
    // 1.d4 d5 2.c4 (QGD)
    "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b": [
      { move: "e7e6", weight: 40 },
      { move: "c7c6", weight: 25 },
      { move: "d5c4", weight: 20 },
      { move: "e7e5", weight: 10 },
      { move: "g8f6", weight: 5 },
    ],
    // 1.d4 Nf6 2.c4
    "rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b": [
      { move: "e7e6", weight: 35 },
      { move: "g7g6", weight: 30 },
      { move: "c7c5", weight: 15 },
      { move: "e7e5", weight: 10 },
      { move: "d7d5", weight: 10 },
    ],
    // 1.c4 (English)
    "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b": [
      { move: "e7e5", weight: 30 },
      { move: "g8f6", weight: 25 },
      { move: "c7c5", weight: 20 },
      { move: "e7e6", weight: 15 },
      { move: "g7g6", weight: 10 },
    ],
    // 1.Nf3 (Reti)
    "rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b": [
      { move: "d7d5", weight: 35 },
      { move: "g8f6", weight: 30 },
      { move: "c7c5", weight: 15 },
      { move: "e7e6", weight: 10 },
      { move: "g7g6", weight: 10 },
    ],
  };

  function getBookMove(fen) {
    // FEN'in sadece board + turn kısmını al (castling/ep/clocks'u yoksay)
    const parts = fen.split(" ");
    const key = parts[0] + " " + parts[1];
    const candidates = OPENING_BOOK[key];
    if (!candidates) return null;
    // Ağırlıklı rastgele seçim
    const totalWeight = candidates.reduce((s, c) => s + c.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) return c.move;
    }
    return candidates[0].move;
  }
  const PANEL_STYLES = `
    .taktik-panel {
      position: fixed; top: 10px; right: 10px; width: 280px;
      background: #1e1e1e; border: 1px solid #444; border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6); z-index: 99999;
      font-family: "Segoe UI", Arial, sans-serif; font-size: 12px;
      color: #ddd; overflow: hidden; user-select: none; pointer-events: auto;
    }
    .taktik-header { display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#2d8a4e; color:#fff; font-weight:bold; font-size:13px; }
    .taktik-title { pointer-events:none; }
    .taktik-body { padding:10px 12px; display:flex; flex-direction:column; gap:7px; }
    .taktik-body.taktik-collapsed { display:none; }
    .taktik-btn { padding:8px 0; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; transition:background 0.15s; width:100%; }
    .taktik-analyze-btn { background:#2d8a4e; color:#fff; font-size:15px; padding:10px 0; }
    .taktik-analyze-btn:hover { background:#35a85c; }
    .taktik-analyze-btn:active { background:#257a42; }
    .taktik-clear-btn { background:#444; color:#ccc; }
    .taktik-clear-btn:hover { background:#555; }
    .taktik-btn-mini { background:transparent; border:none; color:#fff; font-size:16px; cursor:pointer; padding:0 4px; line-height:1; }
    .taktik-btn-mini:hover { opacity:0.7; }
    .taktik-row { display:flex; align-items:center; gap:6px; }
    .taktik-row label { font-size:11px; color:#aaa; white-space:nowrap; }
    .taktik-row select, .taktik-row input[type="range"] { flex:1; }
    .taktik-row select { background:#333; color:#ddd; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:11px; }
    .taktik-depth { accent-color:#2d8a4e; }
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
    .taktik-switch input:checked + .taktik-slider { background:#2d8a4e; }
    .taktik-switch input:checked + .taktik-slider::before { transform:translateX(16px); }
    .taktik-auto-label, .taktik-autoplay-label { font-size:11px; font-weight:bold; color:#aaa; margin-left:4px; }
    .taktik-autoplay-color { background:#333; color:#ddd; border:1px solid #555; border-radius:4px; padding:2px 4px; font-size:10px; margin-left:4px; }
    .taktik-highlight { border-radius:0; transition:opacity 0.2s; }
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
    isPremium = false;
    loggedInUser = null;
    settings.depth = Math.min(settings.depth, 8);
    settings.multipv = 1;
    autoPlayEnabled = false;
    autoMode = false;
    antiBanEnabled = false;
    autoMatchEnabled = false;
    stopBoardWatch();
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
          <button class="taktik-btn taktik-login-register" style="background:transparent;border:1px solid #2d8a4e;margin-top:6px;font-size:12px">${t("registerBtn")}</button>
        </div>
      </div>
    `;

    const style = document.createElement("style");
    style.textContent = `
      .taktik-login-overlay {
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.7); z-index: 99998;
      }
      .taktik-login-box {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #1e1e1e; border: 2px solid #2d8a4e; border-radius: 12px;
        padding: 0; width: 320px; z-index: 99999; font-family: Arial, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
      }
      .taktik-login-header {
        background: #2d8a4e; color: #fff; padding: 12px 16px; font-size: 15px;
        font-weight: bold; border-radius: 10px 10px 0 0; text-align: center;
      }
      .taktik-login-body {
        padding: 20px 16px; display: flex; flex-direction: column; gap: 10px;
      }
      .taktik-login-body input {
        padding: 10px 12px; border: 1px solid #444; border-radius: 6px;
        background: #2a2a2a; color: #eee; font-size: 14px; outline: none;
      }
      .taktik-login-body input:focus { border-color: #2d8a4e; }
      .taktik-login-error {
        color: #ff5555; font-size: 13px; text-align: center; padding: 4px 0;
      }
      .taktik-login-submit {
        background: #2d8a4e !important; font-size: 14px !important;
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
      <button class="taktik-btn taktik-reg-submit" style="background:#2d8a4e">${t("registerSubmit")}</button>
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
      "position:fixed;top:20px;right:20px;background:#1e1e1e;border:2px solid #2d8a4e;border-radius:8px;padding:12px 18px;z-index:999999;color:#eee;font-size:13px;font-family:Arial,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:pointer";
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

  // ─── FEN Generation ───────────────────────────────────
  function getPieceCode(el) {
    for (const cls of el.classList) {
      if (
        cls.length === 2 &&
        (cls[0] === "w" || cls[0] === "b") &&
        "pnbrqk".includes(cls[1])
      ) {
        return cls;
      }
    }
    return null;
  }

  function readBoardFEN() {
    if (!boardEl) return null;
    let fen = "";
    for (let row = 8; row >= 1; row--) {
      let empty = 0;
      for (let col = 1; col <= 8; col++) {
        const sq = `${col}${row}`;
        const pieceEl = boardEl.querySelector(`.piece.square-${sq}`);
        if (!pieceEl) {
          empty++;
          continue;
        }
        const code = getPieceCode(pieceEl);
        if (!code) {
          empty++;
          continue;
        }
        if (empty > 0) {
          fen += empty;
          empty = 0;
        }
        fen += code[0] === "w" ? code[1].toUpperCase() : code[1];
      }
      if (empty > 0) fen += empty;
      if (row > 1) fen += "/";
    }
    return fen;
  }

  // ─── Castling Rights Detection ─────────────────────────
  function detectCastlingRights() {
    let wK = true,
      wQ = true,
      bK = true,
      bQ = true;

    // Board'dan doğrulama: şah/kale hala başlangıç karesinde mi?
    if (boardEl) {
      const at = (sq) => {
        const p = boardEl.querySelector(`.piece.square-${sq}`);
        return p ? getPieceCode(p) : null;
      };
      // Beyaz şah e1'de değilse rok yok
      if (at("51") !== "wk") {
        wK = false;
        wQ = false;
      }
      // Beyaz kale a1'de değilse vezir tarafı rok yok
      if (at("11") !== "wr") wQ = false;
      // Beyaz kale h1'de değilse şah tarafı rok yok
      if (at("81") !== "wr") wK = false;
      // Siyah şah e8'de değilse rok yok
      if (at("58") !== "bk") {
        bK = false;
        bQ = false;
      }
      // Siyah kale a8'de değilse vezir tarafı rok yok
      if (at("18") !== "br") bQ = false;
      // Siyah kale h8'de değilse şah tarafı rok yok
      if (at("88") !== "br") bK = false;
    }

    // Hamle listesinden kontrol: şah veya kale hareket ettiyse rok hakkı kayıp
    const plies = document.querySelectorAll(
      "vertical-move-list .node .move-text-component",
    );
    for (let i = 0; i < plies.length; i++) {
      const isWhite = i % 2 === 0;
      const ply = plies[i];
      const txt = (ply.textContent || "").trim();

      // Rok yapıldıysa hak biter
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

      // Figurine notasyon: icon-font-chess span'ı var mı
      const figurine = ply.querySelector("span.icon-font-chess");
      let isKingMove = false;
      let isRookMove = false;

      if (figurine) {
        const cls = figurine.className || "";
        if (cls.includes("king")) isKingMove = true;
        if (cls.includes("rook")) isRookMove = true;
      } else {
        // Algebraic notasyon
        if (/^K/.test(txt)) isKingMove = true;
        if (/^R/.test(txt)) isRookMove = true;
      }

      if (isKingMove) {
        if (isWhite) {
          wK = false;
          wQ = false;
        } else {
          bK = false;
          bQ = false;
        }
        continue;
      }

      if (isRookMove) {
        // Kaynak sütunu bulmaya çalış: Rae1 → a sütunu, Rhe1 → h sütunu
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
        // Belirsiz kale hamlesi (Re1 gibi) — board kontrolüne güven
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
  // Gerçek sırayı board'dan oku (override yok sayılır)
  function detectRealTurn() {
    if (!boardEl) return "w";

    // Yöntem 1: Son hamle highlight'ından taş rengini bul
    const highlights = boardEl.querySelectorAll(".highlight");
    for (const hl of highlights) {
      const sqClass = [...hl.classList].find((c) => c.startsWith("square-"));
      if (!sqClass) continue;
      const sq = sqClass.replace("square-", "");
      const piece = boardEl.querySelector(`.piece.square-${sq}`);
      if (!piece) continue;
      const code = getPieceCode(piece);
      if (code) {
        // Highlight'taki taş beyazsa beyaz hamle yaptı → siyahın sırası
        return code[0] === "w" ? "b" : "w";
      }
    }

    // Yöntem 2: Hamle listesi sayısı
    const plies = document.querySelectorAll(
      "vertical-move-list .node .move-text-component",
    );
    if (plies.length > 0) {
      return plies.length % 2 === 0 ? "w" : "b";
    }

    return "w";
  }

  function detectTurn() {
    if (settings.turnOverride !== "auto") return settings.turnOverride;
    return detectRealTurn();
  }

  function isFlipped() {
    return boardEl?.classList.contains("flipped") || false;
  }

  function getPlayerColor() {
    // Oyuncunun rengi: flipped ise siyah, değilse beyaz
    return isFlipped() ? "b" : "w";
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

    svgOverlay = svgEl("svg", {
      id: STEALTH_IDS.overlay,
      viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
      preserveAspectRatio: "xMidYMid meet",
    });
    svgOverlay.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:50;";

    boardEl.style.position = "relative";
    boardEl.appendChild(svgOverlay);
    return svgOverlay;
  }

  function clearArrows() {
    if (svgOverlay) svgOverlay.innerHTML = "";
    // Highlight div'leri temizle
    document.querySelectorAll(".taktik-highlight").forEach((el) => el.remove());
  }

  function drawArrow(svg, x1, y1, x2, y2, color, width) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = width * 2.2;
    const spread = Math.PI / 5.5;

    // Kısaltılmış çizgi (ok ucuna yer bırak)
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

    // Ok ucu (üçgen)
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

      // Kare highlight'ları
      drawSquareHighlight(c.fromCol, c.fromRow, HIGHLIGHT_COLORS[i]);
      drawSquareHighlight(c.toCol, c.toRow, HIGHLIGHT_COLORS[i]);

      // Ok
      drawArrow(
        svg,
        from.x,
        from.y,
        to.x,
        to.y,
        ARROW_COLORS[i],
        ARROW_WIDTHS[i],
      );

      // Skor etiketi
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
    // Elo tavanına göre derinlik sınırla
    if (settings.eloCeiling > 0) {
      const eloDepthCap = Math.round(
        3 + ((settings.eloCeiling - 800) * 17) / 2000,
      ); // 800→3, 1500→9, 2000→13, 2800→20
      effectiveDepth = Math.min(effectiveDepth, Math.max(3, eloDepthCap));
    }
    if (remaining < 5) {
      effectiveDepth = Math.min(effectiveDepth, 3);
    } else if (remaining < 10) {
      effectiveDepth = Math.min(effectiveDepth, 5);
    } else if (remaining < 20) {
      effectiveDepth = Math.min(effectiveDepth, 7);
    } else if (remaining < 40) {
      effectiveDepth = Math.min(effectiveDepth, 9);
    } else if (remaining < 60) {
      effectiveDepth = Math.min(effectiveDepth, 11);
    } else if (remaining < 120) {
      effectiveDepth = Math.min(effectiveDepth, 13);
    } else if (remaining < 300) {
      effectiveDepth = Math.min(effectiveDepth, 15);
    }

    // Kalan süreye göre server timeout'u hesapla
    let maxTime = 0; // 0 = server kendi belirler
    if (remaining < 5) {
      maxTime = 1.5;
    } else if (remaining < 10) {
      maxTime = 2;
    } else if (remaining < 20) {
      maxTime = 3;
    } else if (remaining < 40) {
      maxTime = 5;
    } else if (remaining < 60) {
      maxTime = 8;
    } else if (remaining < 120) {
      maxTime = 12;
    } else if (remaining < 300) {
      maxTime = 15;
    }

    updateStatus(
      t(
        "thinking",
        effectiveDepth,
        effectiveDepth < settings.depth ? " ⏱" : "",
      ),
      "working",
    );
    updateFenDisplay(fen);

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
          autoPlayEnabled
            ? antiBanEnabled
              ? Math.max(3, settings.multipv)
              : 1
            : settings.multipv,
          maxTime,
        );
      }
      if (!response) {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "analyze",
              data: {
                fen: fen,
                depth: effectiveDepth,
                multipv: autoPlayEnabled
                  ? antiBanEnabled
                    ? Math.max(3, settings.multipv)
                    : 1
                  : settings.multipv,
                max_time: maxTime,
              },
            },
            (resp) => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve(resp);
              }
            },
          );
        });
      }

      if (!response || !response.ok) {
        const errMsg = response?.error || t("serverConnFail");
        updateStatus(`❌ ${errMsg}`, "error");
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
        // Sıra kontrolü: gerçek board sırasını oku (turnOverride'ı yok say)
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

    // Shadow DOM host oluştur (Chess.com querySelector ile bulamaz)
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
      ? `<span style="margin-left:8px;font-size:11px;color:#ff9040;font-weight:600">${t("guest")}</span>`
      : isPremium
        ? `<span style="margin-left:8px;font-size:11px;color:#ffd700;font-weight:600">👑 ${loggedInUser}</span>`
        : `<span style="margin-left:8px;font-size:11px;color:#aaa;font-weight:600">✓ ${loggedInUser} <span style="color:#ff9040;font-size:10px">(Free)</span></span>`;
    panelEl.innerHTML = `
      <div class="taktik-header">
        <span class="taktik-title">${t("panelTitle")}${userBadge}</span>
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
      <div class="taktik-body">
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
    `;

    shadowRoot.appendChild(panelEl);

    // Event listeners
    panelEl.querySelector(".taktik-analyze-btn").onclick = analyzePosition;
    panelEl.querySelector(".taktik-clear-btn").onclick = () => {
      clearArrows();
      updateStatus(t("cleared"), "info");
      panelEl.querySelector(".taktik-moves").innerHTML = "";
    };
    panelEl.querySelector(".taktik-stealth-btn").onclick = () => {
      stealthMode = true;
      if (panelEl) panelEl.style.display = "none";
      clearArrows();
      if (svgOverlay) svgOverlay.style.display = "none";
      document
        .querySelectorAll(".taktik-highlight")
        .forEach((el) => el.remove());
    };

    panelEl.querySelector(".taktik-reset-btn").onclick = () => {
      if (!isPremium) {
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoReset"), "error");
        return;
      }
      resetEngine();
    };

    const depthSlider = panelEl.querySelector(".taktik-depth");
    const depthVal = panelEl.querySelector(".taktik-depth-val");
    depthSlider.oninput = () => {
      let val = parseInt(depthSlider.value);
      if (!isPremium && val > 8) {
        val = 8;
        depthSlider.value = 8;
      }
      settings.depth = val;
      depthVal.textContent = settings.depth;
    };

    panelEl.querySelector(".taktik-mpv").onchange = (e) => {
      if (!isPremium) {
        e.target.value = "1";
        if (!isGuest) showPremiumPopup();
        else updateStatus(t("guestNoMpv"), "error");
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
        analyzePosition(); // İlk açılışta hemen analiz
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
      // Oto oynama açılınca oto analiz de açık olmalı
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
        // Oto maç açılınca oto analiz + oto oyna da açık olmalı
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

    // Küçültme/büyütme toggle
    const toggleBtn = panelEl.querySelector(".taktik-toggle-btn");
    const body = panelEl.querySelector(".taktik-body");
    toggleBtn.onclick = () => {
      body.classList.toggle("taktik-collapsed");
      toggleBtn.textContent = body.classList.contains("taktik-collapsed")
        ? "+"
        : "—";
    };

    // Çıkış butonu
    panelEl.querySelector(".taktik-logout-btn").onclick = () => doLogout();

    // Hakkında butonu
    panelEl.querySelector(".taktik-about-btn").onclick = () => showAboutModal();

    // Dil değiştirme
    panelEl.querySelector(".taktik-lang-sel").onchange = (e) => {
      currentLang = e.target.value;
      chrome.storage.local.set({ taktik_lang: currentLang });
      // Mevcut durumu kaydet
      const savedAuto = autoMode;
      const savedAutoPlay = autoPlayEnabled;
      const savedAntiBan = antiBanEnabled;
      const savedAutoMatch = autoMatchEnabled;
      // Paneli yeniden oluştur
      if (shadowHost) {
        shadowHost.remove();
        shadowHost = null;
        shadowRoot = null;
      }
      panelEl = null;
      createPanel();
      // Durumu geri yükle
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

    // Sürükleme
    makeDraggable(panelEl, panelEl.querySelector(".taktik-header"));
  }

  // ─── Hakkında Modal ───────────────────────────────────
  function showAboutModal() {
    // Eski modal varsa kaldır
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
        <button id="forksight-about-close" style="position:absolute;top:10px;right:14px;background:none;border:none;color:#888;font-size:20px;cursor:pointer;line-height:1">&times;</button>
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
    document.getElementById("forksight-about-close").onclick = () =>
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
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      shadowRoot = null;
    }
    panelEl = null;
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

  /** Sayfadaki saat elementlerinden kalan süreyi (saniye) ve maç süresini oku */
  function getClockInfo() {
    // chess.com saat elementleri: .clock-time-monospace veya .clock-component
    const clocks = document.querySelectorAll(
      '.clock-time-monospace, .clock-component .clock-time, [class*="clock"] [class*="time"]',
    );
    let myClock = null;
    let oppClock = null;
    const flip = isFlipped();

    for (const c of clocks) {
      const rect = c.getBoundingClientRect();
      if (rect.height === 0) continue;
      // Alt saat = oyuncunun saati (flipped değilse), üst = rakip
      if (rect.top > window.innerHeight / 2) {
        myClock = c;
      } else {
        oppClock = c;
      }
    }

    function parseClockText(el) {
      if (!el) return null;
      const txt = (el.textContent || "").trim();
      // "3:42" veya "0:42" veya "10:00" formatı
      const m = txt.match(/(\d+):(\d+)(?:\.(\d+))?/);
      if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
      return null;
    }

    const mySeconds = parseClockText(myClock);
    const oppSeconds = parseClockText(oppClock);

    // Toplam maç süresi tahmini — başlangıç saatlerinin max'ı
    const maxSeen = Math.max(mySeconds || 0, oppSeconds || 0);
    let gameTimeControl = 300; // varsayılan 5dk
    if (maxSeen > 540)
      gameTimeControl = 600; // 10dk
    else if (maxSeen > 240)
      gameTimeControl = 300; // 5dk
    else if (maxSeen > 120)
      gameTimeControl = 180; // 3dk
    else if (maxSeen > 0) gameTimeControl = 60; // bullet

    return { mySeconds, oppSeconds, gameTimeControl };
  }

  // Gaussian dağılımlı rastgele sayı (Box-Muller transform)
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
      // 10dk+ Rapid
      meanDelay = 5000 + complexity * 6000; // 5-11s merkez
      stdDev = 2500;
    } else if (tc >= 300) {
      // 5dk Blitz
      meanDelay = 3000 + complexity * 5000; // 3-8s merkez
      stdDev = 1800;
    } else if (tc >= 180) {
      // 3dk Blitz
      meanDelay = 1500 + complexity * 3500; // 1.5-5s merkez
      stdDev = 1200;
    } else {
      // Bullet
      meanDelay = 600 + complexity * 1800; // 0.6-2.4s merkez
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
      meanDelay *= 2.2; // Uzun düşünme anı
      stdDev *= 1.5;
    }

    // ─── Premove simülasyonu (bazen anında oyna) ───
    if (complexity < 0.15 && Math.random() < 0.12) {
      // Çok kolay hamle — premove gibi hızlı
      meanDelay = 150 + Math.random() * 300;
      stdDev = 80;
    }

    let delay = gaussianRandom(meanDelay, stdDev);
    delay = Math.max(100, Math.round(delay));
    // Üst sınır: kalan sürenin %40'ı
    if (remaining < 999) delay = Math.min(delay, remaining * 400);

    // ─── Hamle seçimi — oyun fazına göre accuracy ───
    let chosenIdx = 0;
    const roll = Math.random();

    // Fazlara göre suboptimal hamle olasılıkları
    let p2nd = 0.05,
      p3rd = 0.01; // varsayılan: %5 2.hamle, %1 3.hamle

    if (moveCounter <= 6) {
      // Açılış: biraz daha çok hata (kitaptan sapma)
      p2nd = 0.2;
      p3rd = 0.05;
    } else if (moveCounter <= 20) {
      // Orta oyun: en çok hata burada
      p2nd = 0.25;
      p3rd = 0.08;
    } else if (moveCounter <= 35) {
      // Geç orta oyun
      p2nd = 0.18;
      p3rd = 0.05;
    } else {
      // Endgame: daha az hata (teknik oyun)
      p2nd = 0.1;
      p3rd = 0.02;
    }

    // Zaman baskısında daha çok hata
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
          delay += gaussianRandom(2000, 500); // düşünmüş gibi
        }
      }
    }

    return {
      move: moves[chosenIdx].move,
      delay: Math.max(100, Math.round(delay)),
    };
  }

  // ─── Throw Game Mantığı (Kasitli Kaybı) ────────────
  function shouldThrowNextGame() {
    // Her 3-6 galibiyetten sonra bir oyun kaybet
    const threshold = 3 + Math.floor(Math.random() * 4); // 3-6
    return winStreak >= threshold;
  }

  function setupThrowGame() {
    throwThisGame = true;
    // Normal oyna, ama 8-16. hamle civarında bir blunder yap
    throwBlunderAt = 8 + Math.floor(Math.random() * 9); // 8-16
  }

  function getThrowMove(moves) {
    // Throw modunda hamle seçimi:
    // - İlk N hamle: normal oyna (açılış normal görünsün)
    // - Blunder hamlesinde: en kötü hamleyi oyna
    // - Sonrasında: kalan pozisyona göre bazen kötü oyna

    if (moveCounter < throwBlunderAt - 2) {
      // Açılış: tamamen normal
      return null; // null = normal antiBan mantigi kullan
    }

    if (moveCounter >= throwBlunderAt - 2 && moveCounter < throwBlunderAt) {
      // Blunder'a yaklaşırken: %40 ihtimal 2. veya 3. hamle
      if (moves.length >= 2 && Math.random() < 0.4) {
        const idx = moves.length >= 3 ? (Math.random() < 0.5 ? 1 : 2) : 1;
        return moves[idx].move;
      }
      return null;
    }

    if (moveCounter === throwBlunderAt) {
      // Asıl blunder: en kötü hamleyi oyna (ama matça sürüklenmeyecek kadar)
      if (moves.length >= 3) {
        return moves[moves.length - 1].move; // En kötü
      } else if (moves.length >= 2) {
        return moves[1].move;
      }
      return null;
    }

    // Blunder sonrası: %50 ihtimal kötü oyna (pozisyonu kurtarmamak için)
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
    // ─── Yöntem 1: game-over-modal-title-component (chess.com güncel DOM) ───
    const titleEl = document.querySelector(
      '.game-over-modal-title-component, [data-cy="header-title-component"]',
    );
    if (titleEl) {
      const txt = (titleEl.textContent || "").toLowerCase();
      // WIN: TR/EN/DE
      if (/kazandın|you won|wins|gewonnen|hat gewonnen/.test(txt)) return "win";
      // LOSS: TR/EN/DE
      if (/kaybetti|you lost|lost|resign|verloren|aufgegeben/.test(txt))
        return "loss";
      // DRAW: TR/EN/DE
      if (/berabere|draw|stalemate|remis|patt|unentschieden/.test(txt))
        return "draw";
    }

    // ─── Yöntem 2: Skor notasyonu (1-0, 0-1, ½-½) → dil bağımsız ───
    const allEls = document.querySelectorAll(
      '[class*="game-over"], [class*="result"], .board-modal-container-container',
    );
    for (const el of allEls) {
      const t = (el.textContent || "").trim();
      if (
        t.includes("1-0") ||
        t.includes("0-1") ||
        t.includes("½-½") ||
        t.includes("1/2-1/2")
      ) {
        const playerColor = getPlayerColor();
        if (t.includes("1-0")) return playerColor === "w" ? "win" : "loss";
        if (t.includes("0-1")) return playerColor === "b" ? "win" : "loss";
        return "draw";
      }
    }

    // ─── Yöntem 3: Tüm sayfada geniş metin tarama (fallback) ───
    const bodyText = (document.body.innerText || "").toLowerCase();
    // Oyun İncelemesi / Game Review butonu göründüyse oyun bitmiştir
    if (/oyun incelemesi|game review|partieanalyse/.test(bodyText)) {
      // Title bulunamadı ama sayfa sonuç ipuçlarını tara
      if (/kazandın|you won|gewonnen/.test(bodyText)) return "win";
      if (/kaybetti|you lost|verloren/.test(bodyText)) return "loss";
      if (/berabere|draw|remis|stalemate/.test(bodyText)) return "draw";
    }

    return null;
  }

  function evaluateComplexity(moves) {
    // Skor farklarına göre karmaşıklık (0-1)
    if (moves.length < 2) return 0.2;
    const scores = moves.map((m) => parseScore(m.score));
    const spread = Math.abs(scores[0] - scores[scores.length - 1]);
    if (spread < 0.3) return 0.8; // Çok eşit = karmaşık karar
    if (spread < 1.0) return 0.5;
    return 0.2; // Net en iyi = basit
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
    // ─── Yöntem 1: game-over-modal-title-component var mı? ───
    const titleEl = document.querySelector(
      '.game-over-modal-title-component, [data-cy="header-title-component"]',
    );
    if (titleEl && titleEl.textContent.trim().length > 0) return true;

    // ─── Yöntem 2: game-over-modal-header-inner var mı? ───
    if (
      document.querySelector(
        ".game-over-modal-header-inner, .game-over-modal-header-header",
      )
    )
      return true;

    // ─── Yöntem 3: Skor notasyonu (1-0, 0-1, ½-½) ───
    const resultTexts = document.querySelectorAll(
      '[class*="game-over"], .result-text, .game-result',
    );
    for (const el of resultTexts) {
      const tx = (el.textContent || "").trim();
      if (/^(1-0|0-1|½-½|1\/2-1\/2)$/.test(tx)) return true;
    }

    // ─── Yöntem 4: "Oyun İncelemesi" / "Game Review" butonu ───
    const btns = document.querySelectorAll(
      'button, a, [role="button"], [class*="button"]',
    );
    for (const el of btns) {
      if (el.offsetParent === null) continue;
      const txt = (el.textContent || "").toLowerCase().trim();
      if (
        /oyun incelemesi|game review|partieanalyse/.test(txt) ||
        /yeni\s*\d|new\s*\d|neue.*\d/.test(txt)
      )
        return true;
    }
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
        // chess.com: Birden fazla selector stratejisi ile rakip adını bul
        // Strateji 1: Board üstündeki/altındaki oyuncu etiketleri
        const playerSelectors = [
          ".user-tagline-username",
          ".player-tagline-username",
          '[data-cy="user-tagline-username"]',
          '[class*="user-tagline"] a',
          ".board-layout-top .user-tagline-component a",
          ".board-layout-player-top [class*='username']",
          "[data-board-player-top] [class*='username']",
          ".player-component [class*='username']",
        ];
        const allPlayers = document.querySelectorAll(
          playerSelectors.join(", "),
        );
        const names = [];
        allPlayers.forEach((el) => {
          const n = el.textContent.trim().replace(/\s+/g, "");
          if (n && !names.includes(n)) names.push(n);
        });
        // loggedInUser = ForkSight kullanıcı adı, chess.com adı farklı olabilir
        // En az 2 isim bulduysak, ikisini de kaydet; birini rakip olarak ata
        if (names.length >= 2) {
          // Üstteki her zaman rakip
          opponentName = names[0];
        } else if (names.length === 1) {
          opponentName = names[0];
        }

        // Strateji 2: Oyun sonu modal'ındaki isimler
        if (!opponentName) {
          const modalNames = document.querySelectorAll(
            '.game-over-player-username, [class*="game-over"] [class*="username"], ' +
              '.game-review-player-name, [class*="player-name"]',
          );
          const foundNames = [];
          modalNames.forEach((el) => {
            const n = el.textContent.trim().replace(/\s+/g, "");
            if (n && !foundNames.includes(n)) foundNames.push(n);
          });
          if (foundNames.length >= 2) {
            // İlk isim genelde kazanan, ikinci kaybeden — hangisi rakip bilmiyoruz
            // loggedInUser kontrolü yapamayız (chess.com adı farklı olabilir)
            // İlkini rakip olarak ata
            opponentName = foundNames[0];
          } else if (foundNames.length === 1) {
            opponentName = foundNames[0];
          }
        }

        // Strateji 3: Sayfadaki tüm kullanıcı linklerinden dene
        if (!opponentName) {
          const userLinks = document.querySelectorAll(
            'a[href*="/member/"], a[href*="/user/"]',
          );
          const linkNames = [];
          userLinks.forEach((el) => {
            const n = el.textContent.trim().replace(/\s+/g, "");
            if (n && n.length > 1 && n.length < 30 && !linkNames.includes(n))
              linkNames.push(n);
          });
          if (linkNames.length >= 2) opponentName = linkNames[0];
          else if (linkNames.length === 1) opponentName = linkNames[0];
        }
      } catch (e) {}
      let timeControl = "";
      try {
        // Zaman kontrolünü birden fazla kaynaktan dene
        const tcEl = document.querySelector(
          '[data-cy="game-time-control"], .clock-component, ' +
            '.game-over-header-time-control, [class*="time-control"]',
        );
        if (tcEl) timeControl = tcEl.textContent.trim();
        // Eğer bulunamadıysa, URL'den çıkarmayı dene (chess.com/game/live/xxx has time in header)
        if (!timeControl) {
          const headerEl = document.querySelector(
            '.game-over-header-s, [class*="header"] [class*="time"]',
          );
          if (headerEl) timeControl = headerEl.textContent.trim();
        }
      } catch (e) {}
      chrome.runtime.sendMessage({
        type: "game_result",
        data: {
          site: "chess.com",
          game_id:
            (location.pathname.match(/\/game\/(?:live\/)?(\d+)/) || [])[1] ||
            "",
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
        `[Taktik] Seri: ${winStreak}W | Toplam: ${totalGames.wins}W/${totalGames.losses}L/${totalGames.draws}D | Throw: ${throwThisGame}`,
      );
      if (shouldThrowNextGame()) {
        setupThrowGame();
        console.log(
          `[Taktik] 🎭 Sonraki oyun kasıtlı kayıp (blunder hamle: ~${throwBlunderAt})`,
        );
      } else {
        throwThisGame = false;
      }
    }

    return true; // oyun bitti sinyali
  }

  // ─── Auto Match Farm (Otomatik Maç Arama) ────────────
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
      // Süre kontrolü
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

    // Rastgele gecikmeyle (3-8s) "Yeni Oyun" sekmesine git
    const delay = 3000 + Math.random() * 5000;
    updateStatus(t("gameOver", (delay / 1000).toFixed(1)), "working");
    setTimeout(() => {
      if (!autoMatchEnabled) return;
      moveCounter = 0;
      lastFen = "";

      // Strateji: Üst navdaki "Yeni Oyun" sekmesine tıkla → otomatik maç araması başlar
      const newGameTab = findNewGameTab();
      if (newGameTab) {
        forceClick(newGameTab);
        updateStatus(t("newGameClicked"), "working");
      }

      // 2s sonra "Oyunu Başlatın" / "Play" büyük butonunu ara ve tıkla
      let attempts = 0;
      const tryStart = () => {
        if (!autoMatchEnabled) return;
        attempts++;

        // Oyun zaten başladıysa (Beraberlik/Terk Et butonları = aktif oyun)
        const inGame = document.querySelector(
          '[class*="resign"], [class*="draw-offer"], [aria-label*="Resign"], [aria-label*="Terk"]',
        );
        if (inGame && inGame.offsetParent !== null) {
          resetForNewGame();
          return;
        }

        // "Oyunu Başlatın" butonunu bul
        const startBtn = findStartGameButton();
        if (startBtn) {
          forceClick(startBtn);
          updateStatus(t("startingGame"), "working");
          setTimeout(() => resetForNewGame(), 4000);
          return;
        }

        // Hâlâ "Yeni Oyun" sekmesine gidemediyse tekrar dene
        if (attempts <= 2) {
          const tab = findNewGameTab();
          if (tab) forceClick(tab);
        }

        if (attempts < 12) {
          setTimeout(tryStart, 2000);
        } else {
          updateStatus(t("autoStartFailed"), "error");
          resetForNewGame();
        }
      };

      setTimeout(tryStart, 2500);
    }, delay);
  }

  function findNewGameTab() {
    // Üst navdaki "Yeni Oyun" / "New Game" sekmesini bul
    // Bu sekmeye tıklayınca doğrudan maç arama ekranına gider
    const selectors = [
      '[data-tab="newGame"]',
      '[aria-label*="New Game"]',
      '[aria-label*="Yeni Oyun"]',
      '[aria-label*="Neues Spiel"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }

    // Metin tabanlı: üst navdaki sekmelerde ara
    const tabs = document.querySelectorAll(
      'a[class*="tab"], button[class*="tab"], [role="tab"], .ui_v5-button-component',
    );
    for (const tab of tabs) {
      if (tab.offsetParent === null) continue;
      if (tab.closest("#taktik-panel")) continue;
      const txt = (tab.textContent || "").toLowerCase().trim();
      if (
        txt.includes("yeni oyun") ||
        txt.includes("new game") ||
        txt.includes("neues spiel")
      ) {
        return tab;
      }
    }

    return null;
  }

  function simulateRealClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const evtOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
    };

    el.dispatchEvent(new PointerEvent("pointerdown", evtOpts));
    el.dispatchEvent(new MouseEvent("mousedown", evtOpts));
    el.dispatchEvent(new PointerEvent("pointerup", evtOpts));
    el.dispatchEvent(new MouseEvent("mouseup", evtOpts));
    el.dispatchEvent(new MouseEvent("click", evtOpts));
    // Bazı React bileşenleri için doğrudan .click() da lazım
    try {
      el.click();
    } catch (_) {}
  }

  function forceClick(el) {
    if (!el) return;

    // Yöntem 1: Native .click()
    try {
      el.click();
    } catch (_) {}

    // Yöntem 2: Tam fare olayları zinciri
    simulateRealClick(el);

    // Yöntem 3: İçindeki <a> etiketi varsa ona da tıkla
    const innerLink = el.tagName === "A" ? el : el.querySelector("a");
    if (innerLink && innerLink.href) {
      try {
        innerLink.click();
      } catch (_) {}
    }

    // Yöntem 4: Focus + Enter tuşu
    try {
      el.focus();
      el.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
        }),
      );
      el.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "Enter",
          code: "Enter",
          bubbles: true,
        }),
      );
    } catch (_) {}

    // Yöntem 5: React internal onClick handler'ı doğrudan çağır
    try {
      const reactKey = Object.keys(el).find(
        (k) =>
          k.startsWith("__reactFiber$") ||
          k.startsWith("__reactInternalInstance$"),
      );
      if (reactKey) {
        let fiber = el[reactKey];
        while (fiber) {
          if (fiber.memoizedProps?.onClick) {
            fiber.memoizedProps.onClick({
              preventDefault: () => {},
              stopPropagation: () => {},
            });
            break;
          }
          fiber = fiber.return;
        }
      }
    } catch (_) {}
  }

  function findStartGameButton() {
    // Chess.com "Oyunu Başlatın" / "Play" büyük yeşil butonu
    // Birden fazla selector dene
    const selectors = [
      'button[data-cy="new-game-button"]',
      'button[class*="create-game"]',
      'button[class*="play-quick"]',
      ".create-game-component button",
      ".new-game-quick-btn",
      ".play-quick-button",
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.offsetParent !== null) return btn; // görünür olmalı
    }

    // Metin tabanlı arama — tüm büyük butonlarda "Oyunu Başlat" / "Play" ara
    const allBtns = document.querySelectorAll(
      'button, [role="button"], a[class*="button"]',
    );
    for (const btn of allBtns) {
      if (btn.offsetParent === null) continue; // gizli olanları atla
      const txt = (btn.textContent || "").toLowerCase().trim();
      if (
        txt.includes("oyunu başlat") ||
        txt.includes("play") ||
        txt.includes("başlat")
      ) {
        // Paneldeki kendi butonlarımızı atla
        if (btn.closest("#taktik-panel")) continue;
        // Çok küçük olanları atla (en az 100px genişlik)
        const rect = btn.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 30) return btn;
      }
    }

    return null;
  }

  function resetForNewGame() {
    // Yeni oyun başladığında board watcher'ı yeniden başlat
    setTimeout(() => {
      if (autoMode) {
        boardEl = document.querySelector("wc-chess-board");
        if (boardEl) startBoardWatch();
      }
    }, 5000);
  }

  // ─── Auto Play (Otomatik Oynama) ──────────────────────

  // Bezier eğrisi ile insan benzeri fare yolu üret
  function humanMousePath(fromXY, toXY) {
    const steps = 12 + Math.floor(Math.random() * 10); // 12-21 adım
    const points = [];
    // Rastgele kavisli kontrol noktası
    const dist = Math.hypot(toXY.x - fromXY.x, toXY.y - fromXY.y);
    const curvature = dist * (0.15 + Math.random() * 0.25); // mesafeye orantılı sapma
    const angle = Math.atan2(toXY.y - fromXY.y, toXY.x - fromXY.x);
    const perpAngle =
      angle + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const cx = (fromXY.x + toXY.x) / 2 + Math.cos(perpAngle) * curvature;
    const cy = (fromXY.y + toXY.y) / 2 + Math.sin(perpAngle) * curvature;

    for (let i = 0; i <= steps; i++) {
      // Sigmoid easing: yavaş başla → hızlan → yavaş bitir
      let t = i / steps;
      t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      // Quadratic Bezier
      const x =
        (1 - t) * (1 - t) * fromXY.x + 2 * (1 - t) * t * cx + t * t * toXY.x;
      const y =
        (1 - t) * (1 - t) * fromXY.y + 2 * (1 - t) * t * cy + t * t * toXY.y;
      // Micro-jitter (±1-2px insan titremesi)
      const jx = (Math.random() - 0.5) * 3;
      const jy = (Math.random() - 0.5) * 3;
      // Adım gecikmeleri: ortalarda hızlı, uçlarda yavaş
      const speed = 8 + Math.random() * 10; // 8-18ms aralık
      points.push({ x: x + jx, y: y + jy, delay: Math.round(speed) });
    }
    // Son nokta kesin hedef (jitter yok)
    points[points.length - 1] = { x: toXY.x, y: toXY.y, delay: 5 };
    return points;
  }

  function playMoveOnBoard(uci) {
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
      return {
        x: boardRect.left + px,
        y: boardRect.top + py,
      };
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

    // 1) Mousedown kareye tıkla
    boardEl.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...evtOpts,
        clientX: from.x,
        clientY: from.y,
      }),
    );
    boardEl.dispatchEvent(
      new MouseEvent("mousedown", {
        ...evtOpts,
        clientX: from.x,
        clientY: from.y,
      }),
    );

    // 2) Bezier eğrisi boyunca adım adım sürükle
    let totalDelay = 30 + Math.floor(Math.random() * 30); // ilk bekleme 30-60ms
    for (let i = 1; i < path.length; i++) {
      const pt = path[i];
      totalDelay += pt.delay;
      setTimeout(() => {
        boardEl.dispatchEvent(
          new PointerEvent("pointermove", {
            ...evtOpts,
            clientX: pt.x,
            clientY: pt.y,
          }),
        );
        boardEl.dispatchEvent(
          new MouseEvent("mousemove", {
            ...evtOpts,
            clientX: pt.x,
            clientY: pt.y,
          }),
        );
      }, totalDelay);
    }

    // 3) Hedefte bırak
    totalDelay += 15 + Math.floor(Math.random() * 20); // 15-35ms son bekleme
    setTimeout(() => {
      boardEl.dispatchEvent(
        new PointerEvent("pointerup", {
          ...evtOpts,
          clientX: to.x,
          clientY: to.y,
        }),
      );
      boardEl.dispatchEvent(
        new MouseEvent("mouseup", { ...evtOpts, clientX: to.x, clientY: to.y }),
      );

      // Promosyon varsa (piyon son sıraya, 5. karakter)
      if (uci.length === 5) {
        setTimeout(
          () => {
            const promoMap = {
              q: "queen",
              r: "rook",
              b: "bishop",
              n: "knight",
            };
            const promoClass = promoMap[uci[4]] || "queen";
            const promoBtn = document.querySelector(
              `.promotion-piece.${promoClass}, [data-piece='${uci[4]}']`,
            );
            if (promoBtn) promoBtn.click();
          },
          200 + Math.floor(Math.random() * 200),
        );
      }

      updateStatus(t("movePlayed", uci), "success");
    }, totalDelay);
  }

  // ─── Auto Watch (Otomatik Mod) ────────────────────────
  function startBoardWatch() {
    stopBoardWatch();
    if (!boardEl) return;

    // Mevcut FEN'i kaydet
    lastFen = readBoardFEN() || "";

    boardObserver = new MutationObserver(() => {
      if (!autoMode || isAnalyzing) return;

      // Debounce — hamle animasyonu bitmesini bekle
      clearTimeout(autoDebounceTimer);
      autoDebounceTimer = setTimeout(() => {
        const currentFen = readBoardFEN();
        if (currentFen && currentFen !== lastFen) {
          lastFen = currentFen;

          // Oto oynama açıksa sadece sıra bizdeyken analiz yap
          if (autoPlayEnabled) {
            const myColor =
              autoPlayColor === "auto" ? getPlayerColor() : autoPlayColor;
            const currentTurn = detectRealTurn();
            if (currentTurn !== myColor) {
              // Sıra rakipte — bekle, analiz yapma
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
      attributeFilter: ["class"],
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
    boardEl = document.querySelector("wc-chess-board");
    if (!boardEl) return false;
    // Anti-fingerprint: rastgele gecikme ile başlat (1-3s)
    const initDelay = 1000 + Math.floor(Math.random() * 2000);
    setTimeout(() => showLoginModal(), initDelay);
    return true;
  }

  // İlk deneme
  if (!tryInit()) {
    // chess.com SPA — board dinamik yüklenir, MutationObserver ile bekle
    const obs = new MutationObserver(() => {
      if (tryInit()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // 30 saniye sonra observer'ı durdur (performans)
    setTimeout(() => obs.disconnect(), 30000);
  }
})();
