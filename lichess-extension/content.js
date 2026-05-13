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

  // ─── Stealth: Eski instance temizliği + non-enumerable globals ───
  // Tüm state tek bir non-enumerable property altında. Object.keys(window)
  // bunu listelemez; "taktik" substring taraması da boş döner. Property adı
  // generic (chess game ref) — fingerprint taşımaz.
  const _STEALTH_SLOT = "__cgr$_";
  const _prevState = window[_STEALTH_SLOT];
  if (_prevState && typeof _prevState.cleanup === "function") {
    try {
      _prevState.cleanup();
    } catch (_) {
      /* ignore */
    }
  }
  if (_prevState && _prevState.hostId) {
    const _h = document.getElementById(_prevState.hostId);
    if (_h) _h.remove();
  }
  if (_prevState && _prevState.overlayId) {
    const _o = document.getElementById(_prevState.overlayId);
    if (_o) _o.remove();
  }
  const _stealthState = {
    hostId: STEALTH_IDS.host,
    overlayId: STEALTH_IDS.overlay,
    cleanup: null,
  };
  try {
    Object.defineProperty(window, _STEALTH_SLOT, {
      value: _stealthState,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  } catch (_) {
    window[_STEALTH_SLOT] = _stealthState;
  }

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
        "ForkSight is an advanced chess analysis tool powered by the Stockfish engine. It provides real-time tactical analysis with visual arrows on the board.<br><br><b>⚠️ Disclaimer:</b> This tool was created for <b>educational purposes only</b>. It is designed to help players learn, study positions and improve their chess understanding. We strongly advise against using it for cheating in rated games. Fair play makes chess beautiful.<br><br><b>Version:</b> 2.1.3",
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
      coachHint: "Hint",
      coachHintsLeft: "{0}/{1}",
      coachBlunderAlert: "\u26A0\uFE0F Blunder Alert:",
      coachTacticDetect: "\uD83C\uDFAF Tactic Detection:",
      coachVoice: "\uD83D\uDD0A Voice Coach:",
      voiceTactic: "Tactic available!",
      voiceBlunder: "Blunder. Best move was {0}.",
      voiceInaccuracy: "Inaccuracy. Better was {0}.",
      onbTitle: "Welcome to ForkSight",
      onbStep1:
        "Switch between Full and Coach modes. Coach gives educational hints — not raw best moves.",
      onbStep2:
        "Insights highlight threats and ideas right on the board. Hover the panel to focus a square.",
      onbStep3:
        "Stuck? Use the Hint button — limited to 5 per game so you keep thinking.",
      onbStep4:
        "Enable Voice Coach to hear critical insights spoken in your language.",
      onbNext: "Next",
      onbBack: "Back",
      onbSkip: "Skip",
      onbDone: "Got it",
      onbReplay: "Replay tour",
      summaryTitle: "Game Summary",
      summaryAccuracy: "Accuracy",
      summaryMoves: "Moves analyzed",
      summaryPerfect: "Excellent",
      summaryGood: "Good",
      summaryOk: "OK",
      summaryInacc: "Inaccuracies",
      summaryBlunder: "Blunders",
      summaryTactics: "Tactics seen",
      summaryHints: "Hints used",
      summaryClose: "Close",
      summaryEmpty: "No coach analysis this game.",
      themeLabel: "Theme",
      themeDark: "Dark",
      themeLight: "Light",
      themeHC: "High contrast",
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
      // Position insights
      insightQueenOut:
        "Opponent's queen is overextended on {0} — try to trap it.",
      insightKingExposed:
        "Opponent's king is exposed on {0} — look for an attack.",
      insightPassedPawn: "{0} is a passed pawn — advance it to promote.",
      insightOpenFile: "{0}-file is open — pressure it with your rook.",
      insightSemiOpen: "{0}-file: your rook faces a weak enemy pawn — use it.",
      insightIsolated: "Opponent's {0} pawn is isolated — press that weakness.",
      insightDoubled:
        "Opponent has doubled pawns on the {0}-file — target that structure.",
      insightOutpost:
        "Your knight on {0} is on a strong outpost — keep it there.",
      insightBackward:
        "Opponent's {0} pawn is backward and hard to defend — pressure the {1}-file.",
      planBigAdv:
        "You have a large advantage — keep pressing with {0}, don't trade.",
      planAdv: "You're ahead — tighten the position with {0}.",
      planSlightAdv: "Slight edge — strengthen the center with {0}.",
      planBigDis:
        "Difficult position — play {0} for best defense, seek counter-play.",
      planDis: "You're behind — stabilize with {0}, try to complicate.",
      planSlightDis: "Slightly behind — regain balance with {0}.",
      planEqual: "Balanced — plan with {0}{1}.",
      planAfter: " after ",
      planMate: "There's a mate threat — don't miss it!",
      planCheck: "Give check to gain tempo.",
      planCapture: "Capture a piece for material gain.",
      planCastle: "Castle to safety.",
      tacticAlert: "⚡ Critical opportunity! Play {0} (edge: +{1}).",
      posAdvantage: "You're ahead — press and avoid trades.",
      posDifficult: "Tough position — consolidate and seek counter-play.",
      posEqual: "Balanced position. Try to control the center.",
      liveAnalysis: "LIVE ANALYSIS",
      analysisPending: "⏳ WAITING FOR ANALYSIS",
      engineSettings: "ENGINE SETTINGS",
      engineDepth: "ENGINE DEPTH",
      depthFast: "Fast",
      depthBalanced: "Balanced",
      depthDeep: "Deep",
      engineLabel: "Engine: Stockfish 16",
      statusLabel: "Status:",
      engineActive: "Active",
      engineThinking: "Thinking…",
      engineError: "Error",
      welcomeSub: "Enjoy your analyses.",
      evalLabel: "EVALUATION",
      confidenceLabel: "CONFIDENCE",
      threatLabel: "THREAT",
      posEvalLabel: "POSITION EVALUATION",
      hintSubLabel: "Helps you find a better move on the next turn.",
      planCardTitle: "SUGGESTED PLAN",
      detectCardTitle: "LATEST DETECTION",
      // Faz 1 — Phase chips
      phaseOpening: "Opening",
      phaseMiddlegame: "Middlegame",
      phaseEndgame: "Endgame",
      // Faz 1 — Theme chips
      themeTactic: "Tactical",
      themePositional: "Positional",
      themeEndgame: "Endgame",
      themeDefense: "Defense",
      themeOpening: "Opening",
      // Faz 1 — Human eval labels
      humanEvalCrushing: "Crushing",
      humanEvalWinning: "Winning position",
      humanEvalBigAdv: "Big advantage",
      humanEvalAdv: "Comfortable edge",
      humanEvalSlightAdv: "Slight edge",
      humanEvalEqual: "Balanced",
      humanEvalSlightDis: "Slightly worse",
      humanEvalDis: "Difficult",
      humanEvalBigDis: "Bad position",
      humanEvalLost: "Losing",
      humanEvalCrushed: "Lost",
      humanEvalMate: "Mate in {0}",
      humanEvalGettingMated: "Mated in {0}",
      // Faz 1 — Empty / skeleton states
      planEmpty: "Waiting for your move…",
      detectEmpty: "Analyzing position…",
      planAnalyzing: "Computing best plan…",
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
        "ForkSight, Stockfish motoru tarafından desteklenen gelişmiş bir satranç analiz aracıdır. Tahta üzerinde görsel oklar ile gerçek zamanlı taktik analiz sunar.<br><br><b>⚠️ Uyarı:</b> Bu araç yalnızca <b>eğitim amaçlı</b> oluşturulmuştur. Oyuncuların öğrenmesine, pozisyonları çalışmasına ve satranç anlayışlarını geliştirmesine yardımcı olmak için tasarlanmıştır. Dereceli oyunlarda hile yapmak için kullanmamanızı şiddetle tavsiye ederiz. Adil oyun satrancı güzel kılar.<br><br><b>Sürüm:</b> 2.1.3",
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
      coachHint: "İpucu",
      coachHintsLeft: "{0}/{1}",
      coachBlunderAlert: "\u26A0\uFE0F Blunder Uyarısı:",
      coachTacticDetect: "\uD83C\uDFAF Taktik Algılama:",
      coachVoice: "\uD83D\uDD0A Sesli Koç:",
      voiceTactic: "Taktik var!",
      voiceBlunder: "Hata. En iyi hamle {0} idi.",
      voiceInaccuracy: "Yanlışlık. Daha iyisi {0} idi.",
      onbTitle: "ForkSight'a Hoş Geldin",
      onbStep1:
        "Full ve Coach modları arasında geç. Coach, ham en iyi hamle yerine eğitsel ipuçları verir.",
      onbStep2:
        "İçgörüler, tehditleri ve fikirleri doğrudan tahtada vurgular. Bir kareye odaklanmak için panele hover yap.",
      onbStep3:
        "Tıkandın mı? Hint butonunu kullan — düşünmeyi sürdürmen için maç başına 5 ile sınırlı.",
      onbStep4: "Sesli Koç'u aç; kritik içgörüler dilinde sesli okunsun.",
      onbNext: "İleri",
      onbBack: "Geri",
      onbSkip: "Geç",
      onbDone: "Anladım",
      onbReplay: "Turu tekrar oynat",
      summaryTitle: "Maç Özeti",
      summaryAccuracy: "Doğruluk",
      summaryMoves: "Analiz edilen hamle",
      summaryPerfect: "Mükemmel",
      summaryGood: "İyi",
      summaryOk: "Orta",
      summaryInacc: "Yanlışlık",
      summaryBlunder: "Blunder",
      summaryTactics: "Görülen taktik",
      summaryHints: "Kullanılan ipucu",
      summaryClose: "Kapat",
      summaryEmpty: "Bu maçta koç analizi yok.",
      themeLabel: "Tema",
      themeDark: "Koyu",
      themeLight: "Açık",
      themeHC: "Yüksek kontrast",
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
      // Position insights
      insightQueenOut:
        "Rakibin veziri {0}'de çok ilerde — tuzağa düşürmeyi deneyebilirsin.",
      insightKingExposed:
        "Rakibin şahı {0}'de açıkta — saldırı fırsatı arayabilirsin.",
      insightPassedPawn: "{0} geçmiş piyon — terfiye ilerlet, baskı kur.",
      insightOpenFile: "{0} dosyası tamamen açık — kalenle baskı kur.",
      insightSemiOpen:
        "{0} dosyasında kalen var, rakip piyon zayıf — yarı açık dosyayı kullan.",
      insightIsolated:
        "Rakibin {0} piyonu izole ve desteksiz — bu zayıflığa baskı yap.",
      insightDoubled:
        "Rakibin {0} dosyasında çiftlenmiş piyonu var — bu yapısal zayıflığı hedef al.",
      insightOutpost: "Atın {0}'de güçlü bir üssü var — bu pozisyonu koru.",
      insightBackward:
        "Rakibin {0} piyonu geri kalmış ve savunması zor — {1} dosyasından baskı yap.",
      planBigAdv:
        "Büyük avantajın var — {0} ile baskıyı sürdür, takas yapmaktan kaçın.",
      planAdv: "Üstünsün — {0} ile pozisyonu sıkıştır.",
      planSlightAdv: "Hafif avantajlısın — {0} ile merkezi güçlendir.",
      planBigDis:
        "Çok zor pozisyon — {0} ile en iyi savunmayı yap, aktif karşı oyun ara.",
      planDis: "Geriddesin — {0} ile denge kur, karmaşıklaştırmaya çalış.",
      planSlightDis: "Hafif geride kalıyorsun — {0} ile dengeyi yakala.",
      planEqual: "Dengeli pozisyon — {0}{1} ile plan yap.",
      planAfter: " sonrası ",
      planMate: "Mat tehdidi var — bunu kaçırma!",
      planCheck: "Şah vererek tempo kazan.",
      planCapture: "Taş alarak materyal kazan.",
      planCastle: "Rok yaparak şahını güvene al.",
      tacticAlert: "⚡ Kritik hamle fırsatı! {0} oyna (avantaj: +{1}).",
      posAdvantage:
        "Avantajlı pozisyondasın — baskıyı artır ve takas yapmaktan kaçın.",
      posDifficult: "Zor bir pozisyon — sağlamlaş ve karşı oyun ara.",
      posEqual: "Dengeli pozisyon. Merkezi kontrol etmeye çalış.",
      liveAnalysis: "CANLI ANALİZ",
      analysisPending: "⏳ ANALİZ BEKLENİYOR",
      engineSettings: "ENGINE AYARLARI",
      engineDepth: "MOTOR DERİNLİĞİ",
      depthFast: "Hızlı",
      depthBalanced: "Dengeli",
      depthDeep: "Derin",
      engineLabel: "Motor: Stockfish 16",
      statusLabel: "Durum:",
      engineActive: "Aktif",
      engineThinking: "Düşünüyor…",
      engineError: "Hata",
      welcomeSub: "Keyifli analizler.",
      evalLabel: "DEĞERLENDİRME",
      confidenceLabel: "GÜVEN",
      threatLabel: "TEHDİT",
      posEvalLabel: "POZİSYON DEĞERLENDİRMESİ",
      hintSubLabel: "Sonraki hamlede daha iyi seçenek bulmana yardımcı olur.",
      planCardTitle: "ÖNERİLEN PLAN",
      detectCardTitle: "SON TESPİT",
      // Faz 1 — Faz chip'leri
      phaseOpening: "Açılış",
      phaseMiddlegame: "Orta Oyun",
      phaseEndgame: "Oyun Sonu",
      // Faz 1 — Tema chip'leri
      themeTactic: "Taktik",
      themePositional: "Pozisyonel",
      themeEndgame: "Oyun Sonu",
      themeDefense: "Savunma",
      themeOpening: "Açılış",
      // Faz 1 — İnsani değerlendirme
      humanEvalCrushing: "Ezici üstünlük",
      humanEvalWinning: "Kazanan pozisyon",
      humanEvalBigAdv: "Büyük avantaj",
      humanEvalAdv: "Rahat üstünlük",
      humanEvalSlightAdv: "Küçük üstünlük",
      humanEvalEqual: "Dengeli",
      humanEvalSlightDis: "Hafif geride",
      humanEvalDis: "Zor pozisyon",
      humanEvalBigDis: "Kötü pozisyon",
      humanEvalLost: "Kaybediyorsun",
      humanEvalCrushed: "Kayıp pozisyon",
      humanEvalMate: "{0} hamlede mat",
      humanEvalGettingMated: "{0} hamlede mat olacaksın",
      // Faz 1 — Boş durum
      planEmpty: "Hamleni bekliyorum…",
      detectEmpty: "Pozisyon analiz ediliyor…",
      planAnalyzing: "En iyi plan hesaplanıyor…",
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
        "ForkSight ist ein fortschrittliches Schachanalyse-Tool, das von der Stockfish-Engine angetrieben wird. Es bietet Echtzeit-Taktikanalyse mit visuellen Pfeilen auf dem Brett.<br><br><b>⚠️ Hinweis:</b> Dieses Tool wurde ausschließlich für <b>Bildungszwecke</b> erstellt. Es soll Spielern helfen, zu lernen, Positionen zu studieren und ihr Schachverständnis zu verbessern. Wir raten dringend davon ab, es zum Schummeln in gewerteten Partien zu verwenden. Faires Spiel macht Schach schön.<br><br><b>Version:</b> 2.1.3",
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
      coachHint: "Hinweis",
      coachHintsLeft: "{0}/{1}",
      coachBlunderAlert: "\u26A0\uFE0F Patzer-Warnung:",
      coachTacticDetect: "\uD83C\uDFAF Taktik-Erkennung:",
      coachVoice: "\uD83D\uDD0A Sprach-Coach:",
      voiceTactic: "Taktik verfügbar!",
      voiceBlunder: "Patzer. Bester Zug war {0}.",
      voiceInaccuracy: "Ungenauigkeit. Besser war {0}.",
      onbTitle: "Willkommen bei ForkSight",
      onbStep1:
        "Wechsle zwischen Full- und Coach-Modus. Coach gibt lehrreiche Hinweise statt roher bester Züge.",
      onbStep2:
        "Insights heben Drohungen und Ideen direkt am Brett hervor. Hover über das Panel, um ein Feld zu fokussieren.",
      onbStep3:
        "Hängst du fest? Nutze den Hint-Button — auf 5 pro Partie begrenzt, damit du selbst weiterdenkst.",
      onbStep4:
        "Aktiviere den Sprach-Coach, um kritische Insights in deiner Sprache zu hören.",
      onbNext: "Weiter",
      onbBack: "Zurück",
      onbSkip: "Überspringen",
      onbDone: "Verstanden",
      onbReplay: "Tour wiederholen",
      summaryTitle: "Spielzusammenfassung",
      summaryAccuracy: "Genauigkeit",
      summaryMoves: "Analysierte Züge",
      summaryPerfect: "Ausgezeichnet",
      summaryGood: "Gut",
      summaryOk: "OK",
      summaryInacc: "Ungenauigkeiten",
      summaryBlunder: "Patzer",
      summaryTactics: "Gesehene Taktiken",
      summaryHints: "Genutzte Hinweise",
      summaryClose: "Schließen",
      summaryEmpty: "Keine Coach-Analyse in diesem Spiel.",
      themeLabel: "Thema",
      themeDark: "Dunkel",
      themeLight: "Hell",
      themeHC: "Hoher Kontrast",
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
      // Position insights
      insightQueenOut:
        "Der gegnerische Dame steht auf {0} sehr weit vor — versuche sie einzufangen.",
      insightKingExposed:
        "Der gegnerische König steht auf {0} exponiert — suche einen Angriff.",
      insightPassedPawn: "{0} ist ein Freibauer — vorrücken für Umwandlung.",
      insightOpenFile: "{0}-Linie ist offen — übe Druck mit deinem Turm aus.",
      insightSemiOpen:
        "{0}-Linie: dein Turm trifft auf einen schwachen Bauern — nutze die halboffene Linie.",
      insightIsolated:
        "Gegnerischer {0}-Bauer ist isoliert — greife diese Schwäche an.",
      insightDoubled:
        "Gegner hat verdoppelte Bauern auf der {0}-Linie — ziele auf diese Struktur.",
      insightOutpost:
        "Dein Springer auf {0} steht auf einem starken Außenposten — halte ihn dort.",
      insightBackward:
        "Gegnerischer {0}-Bauer ist rückständig und schwer zu verteidigen — übe Druck auf der {1}-Linie aus.",
      planBigAdv:
        "Du hast einen großen Vorteil — drücke weiter mit {0}, vermeide Tausch.",
      planAdv: "Du führst — verenге die Stellung mit {0}.",
      planSlightAdv: "Leichter Vorteil — stärke das Zentrum mit {0}.",
      planBigDis:
        "Schwierige Stellung — spiele {0} als beste Verteidigung, suche Gegenspiel.",
      planDis:
        "Du liegst zurück — stabilisiere mit {0}, versuche zu verkomplizieren.",
      planSlightDis: "Leicht im Rückstand — gleiche mit {0} aus.",
      planEqual: "Ausgewogene Stellung — plane mit {0}{1}.",
      planAfter: " nach ",
      planMate: "Mattdrohung vorhanden — nicht verpassen!",
      planCheck: "Schach geben für Tempo.",
      planCapture: "Figur schlagen für Materialgewinn.",
      planCastle: "Rochieren für Königssicherheit.",
      tacticAlert: "⚡ Kritische Gelegenheit! Spiele {0} (Vorteil: +{1}).",
      posAdvantage: "Du führst — erhöhe den Druck und vermeide Tausch.",
      posDifficult: "Schwierige Stellung — konsolidiere und suche Gegenspiel.",
      posEqual:
        "Ausgeglichene Stellung. Versuche das Zentrum zu kontrollieren.",
      liveAnalysis: "LIVE-ANALYSE",
      analysisPending: "⏳ WARTE AUF ANALYSE",
      engineSettings: "ENGINE-EINSTELLUNGEN",
      engineDepth: "MOTOR-TIEFE",
      depthFast: "Schnell",
      depthBalanced: "Ausgewogen",
      depthDeep: "Tief",
      engineLabel: "Motor: Stockfish 16",
      statusLabel: "Status:",
      engineActive: "Aktiv",
      engineThinking: "Denkt…",
      engineError: "Fehler",
      welcomeSub: "Viel Spaß beim Analysieren.",
      evalLabel: "BEWERTUNG",
      confidenceLabel: "KONFIDENZ",
      threatLabel: "BEDROHUNG",
      posEvalLabel: "POSITIONSBEWERTUNG",
      hintSubLabel: "Hilft dir, im nächsten Zug eine bessere Option zu finden.",
      planCardTitle: "EMPFOHLENER PLAN",
      detectCardTitle: "LETZTE ERKENNUNG",
      // Faz 1
      phaseOpening: "Eröffnung",
      phaseMiddlegame: "Mittelspiel",
      phaseEndgame: "Endspiel",
      themeTactic: "Taktisch",
      themePositional: "Positionell",
      themeEndgame: "Endspiel",
      themeDefense: "Verteidigung",
      themeOpening: "Eröffnung",
      humanEvalCrushing: "Überlegene Stellung",
      humanEvalWinning: "Gewinnstellung",
      humanEvalBigAdv: "Großer Vorteil",
      humanEvalAdv: "Komfortabler Vorteil",
      humanEvalSlightAdv: "Leichter Vorteil",
      humanEvalEqual: "Ausgeglichen",
      humanEvalSlightDis: "Leicht schlechter",
      humanEvalDis: "Schwierig",
      humanEvalBigDis: "Schlechte Stellung",
      humanEvalLost: "Verloren",
      humanEvalCrushed: "Aussichtslos",
      humanEvalMate: "Matt in {0}",
      humanEvalGettingMated: "Matt in {0} erleidest",
      planEmpty: "Warte auf deinen Zug…",
      detectEmpty: "Analysiere Stellung…",
      planAnalyzing: "Berechne besten Plan…",
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
  // 8C: Top-1-match guard (anti-detection) — son N hamlenin rank takibi
  let recentMoveRanks = []; // 0=top, 1=2nd, 2=3rd ...
  const TOP1_GUARD_WINDOW = 20;
  const TOP1_GUARD_THRESHOLD = 0.78;
  // v2.1: Anti-Ban v2 — gelişmiş insansı zamanlama state'i
  let _ab_lastEval = null; // önceki analizde seçilen hamlenin eval'i
  let _ab_lastThinkTime = 1500; // auto-correlation
  let _ab_lastTopMove = null; // bilgi amaçlı
  let totalGames = { wins: 0, losses: 0, draws: 0 };
  let consecutiveTimeouts = 0;
  let stealthMode = false;
  let coachMode = false;
  let evalHistory = []; // sparkline history
  let coachPrevEval = null; // eval before player's move
  let coachBestMove = null; // best move before player moved
  let coachHintsUsed = 0;
  let coachMaxHints = 5;
  let coachErrors = 0;
  let coachTactics = 0;
  // Faz 6B: per-bucket counters for end-of-game summary
  let coachMoveCount = 0;
  let coachPerfectCount = 0;
  let coachGoodCount = 0;
  let coachOkCount = 0;
  let coachInaccCount = 0;
  let coachBlunderCount = 0;
  let coachSummaryShown = false;
  // Faz 6C: theme preset (dark | light | hc)
  let currentTheme = "dark";
  let coachBlunderAlert = true;
  let coachTacticDetect = true;
  // Faz 4: Voice coach (off by default — opt-in)
  let coachVoiceOn = false;
  let coachVoiceLastFen = "";
  let coachVoiceLastSpoken = "";
  let coachAutoAnalyzing = false;
  let coachHintTimer = null;
  let isGuest = true; // Misafir modu (varsayılan: true — giriş yapılana kadar)
  let isPremium = false;
  let isStreamer = false;
  // Faz 11: Streamer / phone companion state
  let streamSession = null;
  let streamWs = null;
  let streamReconnectAttempts = 0;
  let streamPingTimer = null;
  let streamLastPongAt = 0;
  let streamPushTimer = null;
  let streamPendingState = null;
  let streamLastSendAt = 0;
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
    /* ─── Design Token System ─── */
    :host {
      --bg:           #0B0F17;
      --card:         #111827;
      --border:       rgba(255,255,255,0.07);
      --accent:       #22C55E;
      --accent-hover: #16A34A;
      --accent-glow:  rgba(34,197,94,0.25);
      --coach:        #8B5CF6;
      --coach-bg:     rgba(139,92,246,0.12);
      --coach-border: rgba(139,92,246,0.3);
      --warn:         #F59E0B;
      --danger:       #EF4444;
      --danger-hover: #DC2626;
      --text:         #E5E7EB;
      --text-muted:   #6B7280;
      --text-dim:     #9CA3AF;
      --font:         "Inter", system-ui, -apple-system, sans-serif;
    }

    /* ─── Panel Container ─── */
    .taktik-panel {
      position: fixed; top: 8px; right: 8px; width: 290px;
      background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
      z-index: 99999;
      font-family: var(--font); font-size: 13px;
      color: var(--text); user-select: none; pointer-events: auto;
      max-height: calc(100vh - 16px);
      display: flex; flex-direction: column; overflow: hidden;
    }

    /* ─── Header ─── */
    .taktik-header {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 14px; background:var(--card);
      border-bottom: 1px solid var(--border);
      color:var(--text); font-weight:700; font-size:15px;
    }
    .taktik-title { pointer-events:none; }

    /* ─── Body ─── */
    .taktik-body { padding:12px 14px; display:flex; flex-direction:column; gap:8px; }
    .taktik-body.taktik-collapsed { display:none; }

    /* ─── Buttons ─── */
    .taktik-btn {
      padding:9px 0; border:none; border-radius:8px; cursor:pointer;
      font-size:13px; font-weight:600; font-family:var(--font);
      transition:background 0.15s, transform 0.1s, box-shadow 0.15s;
      width:100%;
    }
    .taktik-analyze-btn {
      background:linear-gradient(180deg,var(--accent) 0%,var(--accent-hover) 100%); color:#fff;
      font-size:14px; font-weight:700; padding:11px 0; border-radius:10px;
      letter-spacing:0.3px;
      box-shadow:0 2px 8px rgba(34,197,94,0.20), inset 0 1px 0 rgba(255,255,255,0.15);
    }
    .taktik-analyze-btn:hover {
      background:linear-gradient(180deg,#26D068 0%,var(--accent) 100%); transform:translateY(-1px);
      box-shadow:0 6px 20px var(--accent-glow), inset 0 1px 0 rgba(255,255,255,0.18);
    }
    .taktik-analyze-btn:active { transform:translateY(0); background:var(--accent-hover); }
    .taktik-analyze-btn.scanning {
      background:linear-gradient(90deg,var(--accent-hover),var(--accent),#4ADE80,var(--accent),var(--accent-hover));
      background-size:300% 100%;
      animation:taktik-scan 1.5s linear infinite;
    }
    .taktik-clear-btn { background:#1F2937; color:var(--text); }
    .taktik-clear-btn:hover { background:#374151; }
    .taktik-stealth-btn {
      background:var(--coach-bg); color:#A78BFA;
      border:1px solid var(--coach-border); border-radius:8px; font-size:12px;
    }
    .taktik-stealth-btn:hover { background:rgba(139,92,246,0.2); }
    .taktik-reset-btn { background:var(--danger); color:#fff; }
    .taktik-reset-btn:hover { background:var(--danger-hover); }
    .taktik-btn-mini {
      background:transparent; border:none; color:var(--text-dim);
      font-size:15px; cursor:pointer; padding:0 4px; line-height:1;
      transition:color 0.15s;
    }
    .taktik-btn-mini:hover { color:var(--text); }
    /* Streamer butonu — diğer mini butonlarla uyumlu, durumu küçük nokta ile belli et */
    .taktik-stream-btn { position:relative; }
    .taktik-stream-btn.is-active { color:#34D399; }
    .taktik-stream-btn.is-connecting { color:#FBBF24; }
    .taktik-stream-btn.is-locked { opacity:.55; }
    .taktik-stream-btn.is-locked:hover { opacity:1; color:#FBBF24; }
    .taktik-stream-btn.is-active::after,
    .taktik-stream-btn.is-connecting::after {
      content:""; position:absolute; top:1px; right:1px;
      width:6px; height:6px; border-radius:50%;
      background:#34D399; box-shadow:0 0 0 1px var(--panel-bg, #0f172a);
    }
    .taktik-stream-btn.is-connecting::after {
      background:#FBBF24;
      animation: taktik-stream-pulse 1.1s ease-in-out infinite;
    }
    @keyframes taktik-stream-pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50% { opacity:0.45; transform:scale(0.75); }
    }

    /* ─── Setting Rows ─── */
    .taktik-row { display:flex; align-items:center; gap:8px; padding:2px 0; }
    .taktik-row label { font-size:12px; color:var(--text-muted); white-space:nowrap; }
    .taktik-row select, .taktik-row input[type="range"] { flex:1; }
    .taktik-row select {
      background:#1F2937; color:var(--text);
      border:1px solid var(--border); border-radius:6px;
      padding:3px 6px; font-size:12px; font-family:var(--font);
      outline:none; cursor:pointer;
    }
    .taktik-row select:focus { border-color:var(--accent); }

    /* ─── Sliders ─── */
    .taktik-depth { accent-color:var(--accent); }
    .taktik-depth-val { font-weight:700; color:var(--text); min-width:22px; text-align:center; font-size:13px; }

    /* ─── FEN Display ─── */
    .taktik-fen {
      font-family:"Consolas",monospace; font-size:9px; color:var(--text-muted);
      word-break:break-all; max-height:28px; overflow:hidden; cursor:text; user-select:text;
    }

    /* ─── Status Bar ─── */
    .taktik-status { font-size:12px; padding:5px 8px; border-radius:6px; text-align:center; font-weight:500; }
    .taktik-status-info    { background:rgba(255,255,255,0.04); color:var(--text-muted); }
    .taktik-status-working { background:rgba(34,197,94,0.08);   color:var(--accent); }
    .taktik-status-success { background:rgba(34,197,94,0.10);   color:#4ADE80; }
    .taktik-status-error   { background:rgba(239,68,68,0.10);   color:#F87171; }

    /* ─── Moves List ─── */
    .taktik-moves {
      max-height:140px; overflow-y:auto;
      font-family:"Consolas",monospace; font-size:11px; line-height:1.6;
    }
    .taktik-moves::-webkit-scrollbar { width:3px; }
    .taktik-moves::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }
    .taktik-move-row { padding:2px 6px; color:var(--text-dim); }

    /* ─── Toggle Switch ─── */
    .taktik-auto-row { align-items:center; }
    .taktik-switch { position:relative; display:inline-block; width:38px; height:21px; flex-shrink:0; }
    .taktik-switch input { opacity:0; width:0; height:0; }
    .taktik-slider {
      position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0;
      background:#374151; border-radius:21px; transition:background 0.2s;
    }
    .taktik-slider::before {
      content:""; position:absolute; height:15px; width:15px;
      left:3px; bottom:3px; background:#fff; border-radius:50%;
      transition:transform 0.2s;
    }
    .taktik-switch input:checked + .taktik-slider { background:var(--accent); }
    .taktik-switch input:checked + .taktik-slider::before { transform:translateX(17px); }
    .taktik-auto-label, .taktik-autoplay-label,
    .taktik-antiban-label, .taktik-automatch-label {
      font-size:11px; font-weight:600; color:var(--text-muted); margin-left:2px;
    }
    .taktik-autoplay-color {
      background:#1F2937; color:var(--text); border:1px solid var(--border);
      border-radius:5px; padding:2px 5px; font-size:11px; margin-left:4px;
      font-family:var(--font);
    }

    /* ─── Highlights ─── */
    .taktik-highlight { border-radius:0; transition:opacity 0.2s; }
    .taktik-coach-miss { border-radius:0; transition:opacity 0.3s; pointer-events:none; z-index:46; position:absolute; width:12.5%; height:12.5%; }

    /* ─── Scroll Area ─── */
    .taktik-scroll-area {
      overflow-y: auto; overflow-x: hidden; flex: 1;
      scrollbar-width: thin; scrollbar-color: var(--border) transparent;
    }
    .taktik-scroll-area::-webkit-scrollbar { width: 4px; }
    .taktik-scroll-area::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    /* ─── Mode Tabs ─── */
    .taktik-mode-tabs { display:flex; background:var(--bg); border-bottom:1px solid var(--border); flex-shrink:0; }
    .taktik-mode-tab {
      flex:1; padding:10px 0; border:none; background:transparent;
      color:var(--text-muted); font-size:13px; font-weight:600;
      font-family:var(--font); cursor:pointer;
      border-bottom:2px solid transparent; transition:all 0.2s;
    }
    .taktik-mode-tab[data-mode="full"].active  { color:var(--accent); border-bottom-color:var(--accent); }
    .taktik-mode-tab[data-mode="coach"].active { color:var(--coach);  border-bottom-color:var(--coach); }
    .taktik-mode-tab:hover:not(.active) { color:var(--text); background:rgba(255,255,255,0.03); }

    /* ─── Coach Body ─── */
    .taktik-coach-body { padding:12px 14px; display:flex; flex-direction:column; gap:10px; position:relative; }
    .taktik-coach-body.taktik-collapsed { display:none; }
    .taktik-coach-lock { display:none; position:absolute; inset:0; z-index:50; background:rgba(8,10,18,0.72); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); padding:18px 16px; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#e9eef5; box-sizing:border-box; }
    .taktik-coach-body.taktik-locked > .taktik-coach-lock { display:flex; }
    .taktik-coach-body.taktik-locked > :not(.taktik-coach-lock) { filter:blur(3px) saturate(.6); pointer-events:none; user-select:none; }
    .taktik-coach-lock-icon { font-size:44px; filter:drop-shadow(0 0 16px rgba(255,215,0,.45)); margin-bottom:6px; }
    .taktik-coach-lock-title { font-size:16px; font-weight:800; color:#ffd86b; margin:0 0 6px; }
    .taktik-coach-lock-desc { font-size:12px; color:#bcc6d4; line-height:1.55; margin:0 0 12px; max-width:280px; }
    .taktik-coach-lock-list { list-style:none; padding:0; margin:0 0 14px; text-align:left; display:flex; flex-direction:column; gap:5px; max-width:280px; }
    .taktik-coach-lock-list li { font-size:11.5px; color:#cdd5e0; display:flex; gap:8px; }
    .taktik-coach-lock-list li b { color:#ffd86b; }
    .taktik-coach-lock-cta { display:inline-block; padding:9px 22px; background:linear-gradient(135deg,#ffd86b,#ffaa3a); color:#1a1a2e; font-weight:800; font-size:13px; border-radius:10px; border:none; cursor:pointer; box-shadow:0 4px 18px rgba(255,200,60,.35); }
    .taktik-coach-lock-cta:hover { transform:translateY(-1px); }

    /* ─── Eval Bar ─── */
    .taktik-eval-container {
      background:rgba(255,255,255,0.04); border-radius:8px;
      overflow:hidden; position:relative; height:28px;
    }
    .taktik-eval-fill {
      height:100%; background:#888; width:50%;
      transition:width 0.5s ease, background 0.5s ease; border-radius:8px;
    }
    .taktik-eval-text {
      position:absolute; top:50%; left:50%;
      transform:translate(-50%,-50%);
      font-size:11px; font-weight:700; color:var(--text);
      text-shadow:0 1px 3px rgba(0,0,0,0.8);
    }

    /* ─── Move Feedback ─── */
    .taktik-move-feedback {
      display:none; padding:10px 12px; border-radius:8px; font-size:13px;
      font-weight:700; text-align:center;
    }
    .taktik-feedback-perfect {
      background:rgba(252,211,77,0.10); color:#FCD34D;
      border:1px solid rgba(252,211,77,0.30);
    }
    .taktik-feedback-good {
      background:rgba(34,197,94,0.10); color:#4ADE80;
      border:1px solid rgba(34,197,94,0.25);
    }
    .taktik-feedback-ok {
      background:rgba(245,158,11,0.10); color:#FCD34D;
      border:1px solid rgba(245,158,11,0.25);
    }
    .taktik-feedback-bad {
      background:rgba(239,68,68,0.10); color:#F87171;
      border:1px solid rgba(239,68,68,0.25);
    }
    .taktik-feedback-blunder {
      background:rgba(239,68,68,0.15); color:#F87171;
      border:1px solid var(--danger); animation:taktik-shake 0.5s;
    }
    @keyframes taktik-shake {
      0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)}
      40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)}
    }

    /* ─── Tactic Alert ─── */
    .taktik-tactic-alert {
      display:none; padding:8px 12px; border-radius:8px; font-size:13px; font-weight:700;
      text-align:center; background:var(--coach-bg);
      color:var(--coach); border:1px solid var(--coach-border);
      animation:taktik-pulse 1.5s infinite;
    }
    @keyframes taktik-pulse { 0%,100%{opacity:1} 50%{opacity:0.65} }

    /* ─── Coach Stats & Hint ─── */
    .taktik-coach-stats {
      font-size:11px; color:var(--text-muted); text-align:center; padding:4px;
    }
    .taktik-hint-btn {
      display:inline-flex; align-items:center; justify-content:center; gap:6px;
      padding:8px 14px; border-radius:8px; cursor:pointer;
      font-size:12px; font-weight:600; font-family:var(--font);
      background:rgba(245,158,11,0.14); color:var(--warn);
      border:1px solid rgba(245,158,11,0.35);
      transition:background 0.15s, transform 0.1s;
      flex-shrink:0; white-space:nowrap;
    }
    .taktik-hint-btn:hover { background:rgba(245,158,11,0.24); }
    .taktik-hint-btn:active { transform:scale(0.97); }
    .taktik-hint-btn:disabled {
      background:rgba(255,255,255,0.04); color:var(--text-muted);
      cursor:not-allowed; border-color:var(--border);
    }
    .taktik-hint-btn-icon { font-size:14px; line-height:1; }
    .taktik-hint-btn-label { line-height:1; }

    /* ─── Micro Interaction Keyframes ─── */
    @keyframes taktik-pulse-dot {
      0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.35;transform:scale(0.75)}
    }
    @keyframes taktik-engine-thinking {
      0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)}
    }
    @keyframes taktik-scan {
      0%{background-position:0% 0%} 100%{background-position:300% 0%}
    }
    @keyframes taktik-toast-in {
      from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)}
    }
    @keyframes taktik-toast-out {
      from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(6px)}
    }

    /* ─── Toast Notification ─── */
    .taktik-toast {
      position:fixed; bottom:20px; right:20px;
      background:var(--card); border:1px solid var(--border);
      color:var(--text); padding:10px 16px; border-radius:10px;
      font-size:12px; font-family:var(--font); z-index:999999;
      display:flex; align-items:center; gap:8px;
      box-shadow:0 8px 24px rgba(0,0,0,0.5);
      animation:taktik-toast-in 0.25s ease;
      pointer-events:none;
    }
    .taktik-toast.taktik-toast-success { border-color:rgba(34,197,94,0.4); }
    .taktik-toast.taktik-toast-error   { border-color:rgba(239,68,68,0.4); }
    .taktik-toast.taktik-toast-warn    { border-color:rgba(245,158,11,0.4); }

    /* ─── FAZ 2: Header New Layout ─── */
    .taktik-header { flex-direction:column !important; align-items:stretch !important; gap:6px; }
    .taktik-header-top { display:flex; align-items:center; gap:8px; }
    .taktik-header-bottom { display:flex; align-items:center; gap:4px; }
    .taktik-header-left { display:flex; align-items:center; gap:10px; min-width:0; flex:1; overflow:hidden; }
    .taktik-logo { font-size:24px; line-height:1; flex-shrink:0; }
    .taktik-brand { font-size:15px; font-weight:700; color:var(--text); }
    .taktik-subtitle { font-size:10px; color:var(--text-muted); margin-top:1px; letter-spacing:0.3px; }
    .taktik-header-right { display:flex; align-items:center; gap:4px; flex-shrink:0; }
    .taktik-user-badge {
      font-size:11px; font-weight:600; padding:2px 7px;
      background:rgba(255,255,255,0.05); border-radius:20px;
      color:var(--text-dim); border:1px solid var(--border); white-space:nowrap;
      overflow:hidden; text-overflow:ellipsis;
    }
    .taktik-lang-sel {
      font-size:11px; padding:2px 4px;
      background:#1F2937; color:var(--text);
      border:1px solid var(--border); border-radius:5px;
      cursor:pointer; font-family:var(--font); max-width:44px;
    }
    .taktik-lang-sel:focus { outline:none; border-color:var(--accent); }
    .taktik-status-dot {
      width:8px; height:8px; border-radius:50%; background:var(--accent);
      animation:taktik-pulse-dot 2s infinite; flex-shrink:0;
    }
    .taktik-status-dot.thinking { animation:taktik-engine-thinking 0.6s infinite; }

    /* ─── FAZ 4: Section Cards ─── */
    .taktik-section {
      background:var(--card); border:1px solid var(--border); border-radius:10px;
      padding:12px; display:flex; flex-direction:column; gap:8px;
      transition:transform 0.15s, box-shadow 0.15s, background 0.15s, border-color 0.15s;
    }
    .taktik-section:hover { transform:translateY(-1px); background:var(--card-hover); border-color:var(--border-strong); box-shadow:0 6px 20px rgba(0,0,0,0.4); }
    .taktik-section-label {
      font-size:10px; font-weight:600; letter-spacing:0.8px;
      text-transform:uppercase; color:var(--text-muted);
    }
    .taktik-section-label-row { display:flex; justify-content:space-between; align-items:center; }
    .taktik-depth-big { font-size:22px; font-weight:700; color:var(--text); }
    .taktik-slider-labels {
      display:flex; justify-content:space-between;
      font-size:10px; color:var(--text-muted); margin-top:2px;
    }

    /* ─── FAZ 4a: Live Analysis Cards ─── */
    .taktik-live-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; }
    .taktik-live-card {
      background:rgba(255,255,255,0.04); border:1px solid var(--border);
      border-radius:8px; padding:8px 6px; text-align:center;
    }
    .taktik-live-card-label {
      font-size:9px; font-weight:600; letter-spacing:0.5px;
      text-transform:uppercase; color:var(--text-muted); margin-bottom:4px;
    }
    .taktik-live-score { font-size:20px; font-weight:700; color:var(--text); line-height:1.1; }
    .taktik-live-verdict { font-size:10px; color:var(--text-muted); margin-top:2px; }
    .taktik-confidence-pct { font-size:18px; font-weight:700; color:var(--accent); }
    .taktik-confidence-bar-wrap { height:3px; background:rgba(255,255,255,0.08); border-radius:2px; margin-top:4px; overflow:hidden; }
    .taktik-confidence-bar { height:100%; background:var(--accent); border-radius:2px; width:0; transition:width 0.4s ease; }
    .taktik-threat-badge { font-size:13px; font-weight:600; padding:3px 0; color:var(--text-muted); }
    .taktik-threat-badge.active { color:var(--danger); }

    /* ─── FAZ 4e: Footer ─── */
    .taktik-footer { padding:8px 0 2px; border-top:1px solid var(--border); margin-top:2px; }
    .taktik-engine-info {
      font-size:10px; color:var(--text-muted);
      display:flex; align-items:center; gap:6px; margin-bottom:6px;
    }
    .taktik-engine-dot {
      width:6px; height:6px; border-radius:50%; background:var(--accent); display:inline-block; flex-shrink:0;
    }
    .taktik-engine-dot.thinking { animation:taktik-engine-thinking 0.6s infinite; }
    .taktik-engine-status-text { color:var(--accent); font-weight:600; }
    .taktik-welcome-card {
      display:flex; align-items:center; gap:8px;
      background:rgba(34,197,94,0.06); border:1px solid rgba(34,197,94,0.15);
      border-radius:8px; padding:8px 10px;
    }
    .taktik-welcome-icon { font-size:16px; flex-shrink:0; }
    .taktik-welcome-name { font-size:12px; font-weight:600; color:var(--text); }
    .taktik-welcome-sub { font-size:10px; color:var(--text-muted); }

    /* ─── FAZ 5: Coach Redesign ─── */
    .taktik-eval-section { overflow:hidden; }
    .taktik-eval-row { display:flex; align-items:center; gap:12px; min-width:0; }
    .taktik-eval-score { font-size:26px; font-weight:700; color:var(--text); line-height:1; }
    .taktik-eval-verdict { font-size:11px; color:var(--text-muted); margin-top:3px; }
    .taktik-sparkline {
      display:block; border-radius:4px; opacity:0.85;
      flex:1 1 0; min-width:0;
      width:100%; height:64px; max-height:64px;
    }
    .taktik-hint-card {
      display:flex; align-items:center; gap:12px;
      background:linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04));
      border:1px solid rgba(245,158,11,0.22);
      border-radius:10px; padding:10px 12px;
      transition:border-color 0.15s, background 0.15s;
    }
    .taktik-hint-card:hover {
      border-color:rgba(245,158,11,0.40);
      background:linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.06));
    }
    .taktik-hint-card-info {
      display:flex; align-items:center; gap:10px;
      flex:1 1 auto; min-width:0;
    }
    .taktik-hint-card-icon {
      font-size:18px; line-height:1; flex-shrink:0;
      filter:drop-shadow(0 0 6px rgba(245,158,11,0.45));
    }
    .taktik-hint-card-text { display:flex; flex-direction:column; gap:3px; min-width:0; flex:1; }
    .taktik-hint-card-title-row { display:flex; align-items:center; gap:6px; min-width:0; }
    .taktik-hint-card-title {
      font-size:12px; font-weight:700; color:var(--warn);
      letter-spacing:0.2px; line-height:1.2;
    }
    .taktik-hints-left-chip {
      display:inline-flex; align-items:center;
      padding:1px 6px; border-radius:8px;
      font-size:9px; font-weight:700; letter-spacing:0.3px;
      background:rgba(245,158,11,0.18); color:var(--warn);
      line-height:1.4;
    }
    .taktik-hint-card-sub {
      font-size:10px; color:var(--text-muted); line-height:1.35;
      overflow:hidden; text-overflow:ellipsis;
    }
    /* Legacy classes kept as no-ops for back-compat */
    .taktik-hint-card-top, .taktik-hint-card-left { display:contents; }
    .taktik-hint-icon { font-size:16px; flex-shrink:0; }
    .taktik-hint-title { font-size:12px; font-weight:700; color:var(--warn); }
    .taktik-hint-sub { font-size:10px; color:var(--text-muted); line-height:1.4; }
    .taktik-coach-card {
      display:flex; align-items:flex-start; gap:10px;
      background:var(--card); border:1px solid var(--border);
      border-radius:10px; padding:10px 12px;
    }
    .taktik-coach-card-icon { font-size:16px; flex-shrink:0; margin-top:1px; }
    .taktik-coach-card-title {
      font-size:10px; font-weight:600; letter-spacing:0.5px;
      text-transform:uppercase; color:var(--text-muted); margin-bottom:3px;
    }
    .taktik-plan-text, .taktik-detect-text { font-size:12px; color:var(--text-dim); line-height:1.4; }

    /* ─── Faz 1: chips, severity bar, skeleton, insight rows ─── */
    .taktik-chip {
      display:inline-flex; align-items:center;
      padding:1px 7px; border-radius:10px;
      font-size:9px; font-weight:700; letter-spacing:0.4px;
      text-transform:uppercase; line-height:1.4;
      flex-shrink:0;
    }
    .taktik-chip.chip-tactic { background:rgba(239,68,68,0.15); color:#F87171; }
    .taktik-chip.chip-positional { background:rgba(139,92,246,0.18); color:#A78BFA; }
    .taktik-chip.chip-endgame { background:rgba(245,158,11,0.18); color:#FCD34D; }
    .taktik-chip.chip-defense { background:rgba(59,130,246,0.18); color:#60A5FA; }
    .taktik-chip.chip-opening { background:rgba(34,197,94,0.18); color:#4ADE80; }
    .taktik-chip.chip-phase { background:rgba(255,255,255,0.06); color:var(--text-muted); }
    .taktik-chip.chip-phase-opening { color:#4ADE80; }
    .taktik-chip.chip-phase-middlegame { color:#A78BFA; }
    .taktik-chip.chip-phase-endgame { color:#FCD34D; }

    .taktik-plan-meta {
      display:flex; align-items:center; gap:6px;
      flex-wrap:wrap; margin-bottom:6px;
    }
    .taktik-eval-pill {
      font-size:10px; font-weight:600;
      padding:1px 7px; border-radius:10px;
      background:rgba(255,255,255,0.05); color:var(--text-dim);
    }
    .taktik-plan-row, .taktik-insight-row {
      display:flex; flex-direction:column; gap:3px;
      padding:5px 0;
      border-top:1px solid rgba(255,255,255,0.04);
    }
    .taktik-plan-row:first-of-type, .taktik-insight-row:first-of-type {
      border-top:none; padding-top:2px;
    }
    .taktik-plan-row { flex-direction:row; align-items:center; gap:6px; }
    .taktik-plan-line, .taktik-insight-text {
      font-size:12px; color:var(--text-dim); line-height:1.4; flex:1;
    }
    .taktik-insight-line {
      display:flex; align-items:center; gap:6px;
    }
    .taktik-severity-bar {
      height:2px; background:rgba(255,255,255,0.06);
      border-radius:2px; overflow:hidden; margin-top:2px;
    }
    .taktik-severity-fill {
      height:100%; background:linear-gradient(90deg,#7c5cff,#9b87ff);
      transition:width 0.4s ease;
    }
    .taktik-plan-empty, .taktik-empty-text {
      font-size:11px; color:var(--text-muted); font-style:italic;
      padding:4px 0;
    }

    @keyframes taktik-shimmer {
      0% { background-position:-200% 0; }
      100% { background-position:200% 0; }
    }
    .taktik-skeleton-wrap {
      display:flex; flex-direction:column; gap:5px; padding:2px 0;
    }
    .taktik-skeleton-line {
      height:8px; border-radius:4px;
      background:linear-gradient(90deg,
        rgba(255,255,255,0.04),
        rgba(255,255,255,0.10),
        rgba(255,255,255,0.04));
      background-size:200% 100%;
      animation:taktik-shimmer 1.5s ease-in-out infinite;
    }
    .taktik-skeleton-line.short { width:60%; }

    /* ─── Faz 3: Animations & microinteractions ─── */
    @keyframes taktik-fade-in-up {
      from { opacity:0; transform:translateY(6px); }
      to   { opacity:1; transform:translateY(0); }
    }
    @keyframes taktik-pop-in {
      0%   { opacity:0; transform:scale(0.96); }
      60%  { opacity:1; transform:scale(1.015); }
      100% { opacity:1; transform:scale(1); }
    }
    @keyframes taktik-sev-grow {
      from { transform:scaleX(0); transform-origin:left center; }
      to   { transform:scaleX(1); transform-origin:left center; }
    }
    @keyframes taktik-square-fade {
      from { opacity:0; transform:scale(0.85); }
      to   { opacity:1; transform:scale(1); }
    }
    @keyframes taktik-arrow-draw {
      from { stroke-dashoffset:120; opacity:0; }
      to   { stroke-dashoffset:0; opacity:0.55; }
    }
    @keyframes taktik-arrow-head-fade {
      from { opacity:0; transform:scale(0.6); transform-box:fill-box; transform-origin:center; }
      to   { opacity:0.55; transform:scale(1); }
    }
    @keyframes taktik-glow-pulse {
      0%,100% { box-shadow:0 0 0 1px rgba(124,92,255,0.0); }
      50%     { box-shadow:0 0 0 2px rgba(124,92,255,0.45), 0 0 14px rgba(124,92,255,0.30); }
    }
    @keyframes taktik-feedback-bounce {
      0%   { opacity:0; transform:translateY(-8px) scale(0.92); }
      60%  { opacity:1; transform:translateY(2px)  scale(1.02); }
      100% { opacity:1; transform:translateY(0)    scale(1); }
    }
    @keyframes taktik-think-dot {
      0%,80%,100% { opacity:0.25; transform:translateY(0); }
      40%         { opacity:1;    transform:translateY(-2px); }
    }
    @keyframes taktik-tactic-glow {
      0%,100% { box-shadow:0 0 0 1px rgba(245,158,11,0.30), 0 0 0 rgba(245,158,11,0); }
      50%     { box-shadow:0 0 0 2px rgba(245,158,11,0.55), 0 0 18px rgba(245,158,11,0.35); }
    }

    .taktik-insight-row {
      animation:taktik-fade-in-up 0.32s cubic-bezier(.2,.8,.2,1) both;
    }
    .taktik-insight-row:nth-child(2) { animation-delay:0.06s; }
    .taktik-insight-row:nth-child(3) { animation-delay:0.12s; }
    .taktik-insight-row:nth-child(4) { animation-delay:0.18s; }

    .taktik-plan-row {
      animation:taktik-fade-in-up 0.28s cubic-bezier(.2,.8,.2,1) both;
    }
    .taktik-plan-row:nth-child(2) { animation-delay:0.05s; }

    .taktik-plan-card[style*="display:"], .taktik-detect-card[style*="display:"] {
      animation:taktik-pop-in 0.28s cubic-bezier(.2,.8,.2,1) both;
    }
    .taktik-insight-row:first-of-type {
      border-radius:6px;
      animation:
        taktik-fade-in-up 0.32s cubic-bezier(.2,.8,.2,1) both,
        taktik-glow-pulse 2.4s ease-in-out 0.4s 2;
    }

    .taktik-severity-fill {
      animation:taktik-sev-grow 0.55s cubic-bezier(.2,.8,.2,1) both;
    }

    .taktik-coach-insight-hl {
      animation:taktik-square-fade 0.32s cubic-bezier(.2,.8,.2,1) both;
    }
    .taktik-coach-insight-hl:nth-of-type(2) { animation-delay:0.05s; }
    .taktik-coach-insight-hl:nth-of-type(3) { animation-delay:0.10s; }
    .taktik-coach-insight-hl:nth-of-type(4) { animation-delay:0.15s; }

    .taktik-ghost-line {
      stroke-dasharray:14 10;
      stroke-dashoffset:0;
      animation:taktik-arrow-draw 0.45s cubic-bezier(.2,.8,.2,1) both;
    }
    .taktik-ghost-head {
      animation:taktik-arrow-head-fade 0.35s cubic-bezier(.2,.8,.2,1) 0.20s both;
    }

    .taktik-move-feedback {
      animation:taktik-feedback-bounce 0.40s cubic-bezier(.2,.8,.2,1) both;
    }

    .taktik-coach-status.taktik-thinking { color:var(--text-dim); }
    .taktik-think-dots {
      display:inline-flex; gap:3px; margin-left:6px; vertical-align:middle;
    }
    .taktik-think-dots > span {
      width:4px; height:4px; border-radius:50%;
      background:currentColor; opacity:0.25;
      animation:taktik-think-dot 1.1s ease-in-out infinite;
    }
    .taktik-think-dots > span:nth-child(2) { animation-delay:0.16s; }
    .taktik-think-dots > span:nth-child(3) { animation-delay:0.32s; }

    .taktik-tactic-alert {
      animation:taktik-tactic-glow 1.6s ease-in-out infinite !important;
    }

    .taktik-eval-pill {
      transition:background 0.3s, color 0.3s;
    }

    .taktik-coach-status {
      font-size:11px; padding:5px 8px; border-radius:6px; text-align:center;
      background:rgba(255,255,255,0.04); color:var(--text-muted);
    }

    /* ═══ Faz 5: Onboarding overlay ═══ */
    .taktik-onb-scrim {
      position:absolute; inset:0; background:rgba(8,12,18,0.78);
      backdrop-filter:blur(2px); z-index:200;
      display:flex; align-items:center; justify-content:center;
      animation:taktik-fade-in-up 0.18s ease-out;
      border-radius:14px;
    }
    .taktik-onb-card {
      width:88%; max-width:320px;
      background:linear-gradient(160deg, #1a2333 0%, #131a26 100%);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:12px; padding:16px 16px 12px;
      box-shadow:0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;
      display:flex; flex-direction:column; gap:10px;
      animation:taktik-pop-in 0.22s cubic-bezier(.2,.9,.3,1.2);
    }
    .taktik-onb-head { display:flex; align-items:center; gap:8px; }
    .taktik-onb-icon {
      width:28px; height:28px; border-radius:8px;
      background:linear-gradient(135deg, var(--accent), #2563eb);
      display:flex; align-items:center; justify-content:center;
      font-size:15px; flex-shrink:0;
    }
    .taktik-onb-title {
      font-size:13px; font-weight:700; color:var(--text);
      letter-spacing:0.2px; flex:1;
    }
    .taktik-onb-step-num {
      font-size:10px; color:var(--text-muted); font-weight:700;
      background:rgba(255,255,255,0.06); padding:2px 6px; border-radius:8px;
    }
    .taktik-onb-body {
      font-size:12px; line-height:1.5; color:var(--text-muted);
      min-height:60px;
    }
    .taktik-onb-dots {
      display:flex; justify-content:center; gap:6px; margin:2px 0 4px;
    }
    .taktik-onb-dot {
      width:6px; height:6px; border-radius:50%;
      background:rgba(255,255,255,0.15); transition:all 0.2s;
    }
    .taktik-onb-dot.active {
      background:var(--accent); width:18px; border-radius:3px;
    }
    .taktik-onb-actions {
      display:flex; align-items:center; gap:8px; margin-top:4px;
    }
    .taktik-onb-skip {
      background:transparent; border:none; color:var(--text-muted);
      font-size:11px; cursor:pointer; padding:6px 8px;
      transition:color 0.15s;
    }
    .taktik-onb-skip:hover { color:var(--text); }
    .taktik-onb-spacer { flex:1; }
    .taktik-onb-btn {
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);
      color:var(--text); font-size:11px; font-weight:600;
      padding:6px 12px; border-radius:7px; cursor:pointer;
      transition:all 0.15s;
    }
    .taktik-onb-btn:hover {
      background:rgba(255,255,255,0.1); border-color:rgba(255,255,255,0.16);
    }
    .taktik-onb-btn.primary {
      background:linear-gradient(135deg, var(--accent), #2563eb);
      border-color:transparent; color:#fff;
    }
    .taktik-onb-btn.primary:hover { filter:brightness(1.1); }

    /* ═══ Faz 6B: Game summary modal ═══ */
    .taktik-sum-acc-wrap {
      display:flex; flex-direction:column; align-items:center; gap:6px;
      padding:6px 0 4px;
    }
    .taktik-sum-acc-num {
      font-size:30px; font-weight:800; line-height:1;
      background:linear-gradient(135deg, var(--accent), #2563eb);
      -webkit-background-clip:text; background-clip:text; color:transparent;
      letter-spacing:-0.5px;
    }
    .taktik-sum-acc-label {
      font-size:10px; color:var(--text-muted); text-transform:uppercase;
      letter-spacing:1px; font-weight:700;
    }
    .taktik-sum-acc-bar {
      width:100%; height:6px; background:rgba(255,255,255,0.06);
      border-radius:3px; overflow:hidden; margin-top:2px;
    }
    .taktik-sum-acc-fill {
      height:100%; background:linear-gradient(90deg, var(--danger), var(--warn) 50%, var(--accent));
      border-radius:3px; transition:width 0.6s ease-out;
    }
    .taktik-sum-grid {
      display:grid; grid-template-columns:1fr 1fr; gap:6px;
      margin-top:8px;
    }
    .taktik-sum-cell {
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.06);
      border-radius:8px; padding:6px 8px;
      display:flex; flex-direction:column; gap:2px;
    }
    .taktik-sum-cell-label {
      font-size:10px; color:var(--text-muted); font-weight:600;
      letter-spacing:0.3px;
    }
    .taktik-sum-cell-val {
      font-size:14px; color:var(--text); font-weight:700;
    }
    .taktik-sum-cell.good .taktik-sum-cell-val { color:var(--accent); }
    .taktik-sum-cell.bad .taktik-sum-cell-val { color:var(--danger); }
    .taktik-sum-cell.warn .taktik-sum-cell-val { color:var(--warn); }
    .taktik-sum-empty {
      font-size:12px; color:var(--text-muted); text-align:center;
      padding:16px 0;
    }

    /* ═══ Faz 6C: Theme presets ═══ */
    :host([data-theme="light"]) {
      --bg:           #F8FAFC;
      --surface:      #FFFFFF;
      --card:         #F1F5F9;
      --card-hover:   #E2E8F0;
      --border:       rgba(15,23,42,0.08);
      --border-strong:rgba(15,23,42,0.16);
      --accent:       #16A34A;
      --accent-hover: #15803D;
      --accent-glow:  rgba(22,163,74,0.20);
      --coach:        #7C3AED;
      --coach-bg:     rgba(124,58,237,0.10);
      --coach-border: rgba(124,58,237,0.28);
      --warn:         #D97706;
      --danger:       #DC2626;
      --danger-hover: #B91C1C;
      --idle:         #94A3B8;
      --text:         #0F172A;
      --text-muted:   #64748B;
      --text-dim:     #475569;
    }
    :host([data-theme="light"]) .taktik-panel {
      box-shadow: 0 12px 40px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.04);
    }
    :host([data-theme="light"]) .taktik-onb-scrim,
    :host([data-theme="light"]) .taktik-onb-card {
      color:var(--text);
    }
    :host([data-theme="light"]) .taktik-onb-scrim { background:rgba(241,245,249,0.85); }
    :host([data-theme="light"]) .taktik-onb-card {
      background:linear-gradient(160deg, #FFFFFF 0%, #F1F5F9 100%);
      border-color:rgba(15,23,42,0.10);
    }
    :host([data-theme="light"]) .taktik-sum-cell,
    :host([data-theme="light"]) .taktik-onb-btn {
      background:rgba(15,23,42,0.05);
      border-color:rgba(15,23,42,0.08);
    }
    :host([data-theme="light"]) .taktik-sum-acc-bar { background:rgba(15,23,42,0.08); }
    :host([data-theme="light"]) .taktik-onb-dot { background:rgba(15,23,42,0.15); }

    :host([data-theme="hc"]) {
      --bg:           #000000;
      --surface:      #050505;
      --card:         #0A0A0A;
      --card-hover:   #141414;
      --border:       rgba(255,255,255,0.35);
      --border-strong:rgba(255,255,255,0.55);
      --accent:       #00FF7F;
      --accent-hover: #00E673;
      --accent-glow:  rgba(0,255,127,0.45);
      --coach:        #C084FC;
      --coach-bg:     rgba(192,132,252,0.18);
      --coach-border: rgba(192,132,252,0.55);
      --warn:         #FFD60A;
      --danger:       #FF453A;
      --danger-hover: #FF6961;
      --idle:         #A1A1AA;
      --text:         #FFFFFF;
      --text-muted:   #D4D4D8;
      --text-dim:     #E4E4E7;
    }
    :host([data-theme="hc"]) .taktik-panel {
      border-width:2px;
      box-shadow: 0 0 0 2px var(--border-strong), 0 12px 40px rgba(0,0,0,0.9);
    }
    :host([data-theme="hc"]) .taktik-onb-card {
      border-width:2px; border-color:var(--border-strong);
      background:#0A0A0A;
    }
    :host([data-theme="hc"]) .taktik-sum-cell {
      border-width:2px;
    }
  `;

  // ─── Premium Popup ──────────────────────────────────────
  // Re-evaluate Coach mode lock overlay after auth/premium changes
  function refreshCoachLock() {
    try {
      if (!panelEl) return;
      const cb = panelEl.querySelector(".taktik-coach-body");
      if (!cb) return;
      if (isPremium) cb.classList.remove("taktik-locked");
      else cb.classList.add("taktik-locked");
    } catch (_) {}
  }

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
    isPremium = false;
    isStreamer = false;
    try {
      closeStreamSession(false);
    } catch (e) {}
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
      ["taktik_lang", "taktik_token", "taktik_user", "taktik_theme"],
      async (saved) => {
        if (saved.taktik_lang && LANGS[saved.taktik_lang])
          currentLang = saved.taktik_lang;
        if (
          saved.taktik_theme &&
          ["dark", "light", "hc"].includes(saved.taktik_theme)
        )
          currentTheme = saved.taktik_theme;
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
              isStreamer = !!resp.is_streamer;
              refreshCoachLock();
              refreshStreamButton();
              tryRehydrateStream();
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
        <div class="taktik-login-header">
          <div class="taktik-login-header-logo">♟</div>
          <div class="taktik-login-header-brand">ForkSight</div>
          <div class="taktik-login-header-sub">Realtime Chess Intelligence</div>
        </div>
        <div class="taktik-login-body">
          <div class="taktik-lang-row">
            <label>${t("langLabel")}</label>
            <select class="taktik-login-lang">
              <option value="en"${currentLang === "en" ? " selected" : ""}>English</option>
              <option value="tr"${currentLang === "tr" ? " selected" : ""}>Türkçe</option>
              <option value="de"${currentLang === "de" ? " selected" : ""}>Deutsch</option>
            </select>
          </div>
          <input type="text" class="taktik-login-user" placeholder="${t("usernamePH")}" autocomplete="off" />
          <input type="password" class="taktik-login-pass" placeholder="${t("passwordPH")}" autocomplete="off" />
          <div class="taktik-login-error" style="display:none"></div>
          <button class="taktik-btn taktik-login-submit">${t("loginBtn")}</button>
          <button class="taktik-btn taktik-login-guest taktik-login-guest-btn">${t("guestBtn")}</button>
          <button class="taktik-btn taktik-login-register taktik-login-register-btn">${t("registerBtn")}</button>
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
        background: #0B0F17; border: 1px solid rgba(34,197,94,0.3); border-radius: 14px;
        padding: 0; width: 300px; z-index: 99999;
        font-family: "Inter", system-ui, -apple-system, sans-serif;
        box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(34,197,94,0.08);
      }
      .taktik-login-header {
        padding: 20px 20px 16px;
        text-align: center;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .taktik-login-header-logo { font-size: 28px; margin-bottom: 6px; }
      .taktik-login-header-brand { font-size: 16px; font-weight: 700; color: #E5E7EB; }
      .taktik-login-header-sub { font-size: 11px; color: #6B7280; margin-top: 2px; }
      .taktik-login-body {
        padding: 16px 20px 20px; display: flex; flex-direction: column; gap: 10px;
      }
      .taktik-login-body input {
        padding: 10px 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
        background: #111827; color: #E5E7EB; font-size: 13px; outline: none;
        font-family: inherit; width: 100%;
        transition: border-color 0.15s;
      }
      .taktik-login-body input:focus { border-color: #22C55E; }
      .taktik-login-error {
        color: #F87171; font-size: 12px; text-align: center; padding: 4px 0;
      }
      .taktik-login-submit {
        background: #22C55E !important; color: #fff !important;
        font-size: 14px !important; font-weight: 700 !important;
        padding: 11px !important; border-radius: 9px !important;
      }
      .taktik-login-submit:hover { background: #16A34A !important; }
      .taktik-login-guest-btn {
        background: #1F2937 !important; color: #9CA3AF !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        font-size: 12px !important; padding: 9px !important;
        border-radius: 8px !important;
      }
      .taktik-login-guest-btn:hover { background: #374151 !important; color: #E5E7EB !important; }
      .taktik-login-register-btn {
        background: transparent !important; color: #22C55E !important;
        border: 1px solid rgba(34,197,94,0.3) !important;
        font-size: 12px !important; padding: 8px !important;
        border-radius: 8px !important;
      }
      .taktik-login-register-btn:hover { border-color: #22C55E !important; background: rgba(34,197,94,0.06) !important; }
      .taktik-lang-row {
        display: flex; align-items: center; gap: 8px;
      }
      .taktik-lang-row label { font-size: 12px; color: #6B7280; white-space: nowrap; }
      .taktik-lang-row select {
        flex: 1; padding: 8px 10px; border: 1px solid rgba(255,255,255,0.08);
        border-radius: 8px; background: #111827; color: #E5E7EB;
        font-size: 12px; font-family: inherit; outline: none; cursor: pointer;
      }
      .taktik-lang-row select:focus { border-color: #22C55E; }
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
      const labelEl = modal.querySelector(".taktik-lang-row label");
      if (labelEl) labelEl.textContent = t("langLabel");
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
          isStreamer = !!resp.is_streamer;
          refreshCoachLock();
          refreshStreamButton();
          tryRehydrateStream();
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
          isStreamer = !!resp.is_streamer;
          refreshCoachLock();
          refreshStreamButton();
          tryRehydrateStream();
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
      const httpUrl = r.taktik_api_base || "https://forksight.net";
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

  function analyzeViaWS(fen, depth, multipv, max_time, mode) {
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
          JSON.stringify({
            fen,
            depth,
            multipv,
            max_time,
            token,
            mode: mode || "manual",
          }),
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
    // FAZ 6: Scanning animasyonu
    const _analyzeBtn = panelEl?.querySelector(".taktik-analyze-btn");
    if (_analyzeBtn) _analyzeBtn.classList.add("scanning");
    const _statusDot = panelEl?.querySelector(".taktik-status-dot");
    if (_statusDot) _statusDot.classList.add("thinking");

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

    // Faz 9: server-side feature gating mode flag
    const reqMode = autoPlayEnabled ? "autoplay" : autoMode ? "auto" : "manual";

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
          reqMode,
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
                mode: reqMode,
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
      if (
        autoPlayEnabled &&
        response.moves.length > 0 &&
        !isAutoplayBlockedPage()
      ) {
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
          // 8C: Top-1 guard — son N hamlede çok fazla top-1 varsa zorla 2nd-best
          if (
            antiBanEnabled &&
            !bookMove &&
            response.moves.length >= 2 &&
            chosen.move === response.moves[0].move &&
            _shouldForceSubOptimal()
          ) {
            const _s1 = parseScore(response.moves[0].score);
            const _s2 = parseScore(response.moves[1].score);
            if (Math.abs(_s1 - _s2) < 1.5) {
              chosen = {
                move: response.moves[1].move,
                delay: chosen.delay + 600,
              };
              console.log("[Taktik] 🛡️ Top-1 guard → 2nd best");
            }
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
            // 8C: oynanan hamlenin rank'ını takibe al
            if (antiBanEnabled) {
              const _rk = response.moves.findIndex(
                (m) => m.move === chosen.move,
              );
              _trackPlayedRank(_rk >= 0 ? _rk : 0);
            }
            const _fenBefore = fenNow;
            playMoveOnBoard(chosen.move);
            moveCounter++;
            // v2.1.1: hamlenin tahtaya yansıdığını doğrula (abort/cancel koruma)
            setTimeout(() => {
              try {
                const fenAfter = readBoardFEN();
                if (fenAfter === _fenBefore) {
                  console.warn(
                    "[Taktik] Move not registered (FEN unchanged) — match may have been aborted/cancelled",
                  );
                  if (moveCounter > 0) moveCounter--;
                  if (autoPlayEnabled && !isAnalyzing) {
                    setTimeout(() => analyzePosition(), 800);
                  }
                }
              } catch (_) {}
            }, 2500);
          }, delayMs);
        }
      }
    } catch (err) {
      updateStatus(`❌ ${err.message}`, "error");
    }

    isAnalyzing = false;
  }

  // ─── Faz 5: Onboarding Tour ───────────────────────────
  function _onbSteps() {
    return [
      { icon: "♟", body: t("onbStep1") },
      { icon: "🎯", body: t("onbStep2") },
      { icon: "💡", body: t("onbStep3") },
      { icon: "🔊", body: t("onbStep4") },
    ];
  }
  function closeOnboarding(markDone = true) {
    if (!shadowRoot) return;
    const scrim = shadowRoot.querySelector(".taktik-onb-scrim");
    if (scrim) scrim.remove();
    if (markDone) {
      try {
        chrome.storage.local.set({ taktik_onboarded: true });
      } catch (_) {}
    }
  }
  function showOnboarding(step) {
    if (!shadowRoot || !panelEl) return;
    const steps = _onbSteps();
    const idx = Math.max(0, Math.min(step | 0, steps.length - 1));
    const cur = steps[idx];
    const isLast = idx === steps.length - 1;
    const isFirst = idx === 0;
    const existing = shadowRoot.querySelector(".taktik-onb-scrim");
    if (existing) existing.remove();
    const scrim = document.createElement("div");
    scrim.className = "taktik-onb-scrim";
    const dotsHtml = steps
      .map(
        (_, i) =>
          `<span class="taktik-onb-dot${i === idx ? " active" : ""}"></span>`,
      )
      .join("");
    scrim.innerHTML = `
      <div class="taktik-onb-card" role="dialog" aria-modal="true">
        <div class="taktik-onb-head">
          <div class="taktik-onb-icon">${cur.icon}</div>
          <div class="taktik-onb-title">${t("onbTitle")}</div>
          <div class="taktik-onb-step-num">${idx + 1}/${steps.length}</div>
        </div>
        <div class="taktik-onb-body">${cur.body}</div>
        <div class="taktik-onb-dots">${dotsHtml}</div>
        <div class="taktik-onb-actions">
          <button class="taktik-onb-skip" data-onb="skip">${t("onbSkip")}</button>
          <span class="taktik-onb-spacer"></span>
          ${isFirst ? "" : `<button class="taktik-onb-btn" data-onb="back">${t("onbBack")}</button>`}
          <button class="taktik-onb-btn primary" data-onb="${isLast ? "done" : "next"}">${isLast ? t("onbDone") : t("onbNext")}</button>
        </div>
      </div>
    `;
    panelEl.appendChild(scrim);
    scrim.querySelectorAll("[data-onb]").forEach((btn) => {
      btn.onclick = (e) => {
        const action = e.currentTarget.getAttribute("data-onb");
        if (action === "skip" || action === "done") closeOnboarding(true);
        else if (action === "back") showOnboarding(idx - 1);
        else if (action === "next") showOnboarding(idx + 1);
      };
    });
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) closeOnboarding(true);
    });
  }

  // ─── Faz 6B: End-of-game Coach Summary ────────────────
  function _coachAccuracy() {
    if (coachMoveCount <= 0) return 0;
    const total =
      coachPerfectCount * 100 +
      coachGoodCount * 90 +
      coachOkCount * 70 +
      coachInaccCount * 40 +
      coachBlunderCount * 0;
    return Math.max(0, Math.min(100, Math.round(total / coachMoveCount)));
  }
  function showCoachGameSummary() {
    if (!shadowRoot || !panelEl) return;
    if (coachSummaryShown) return;
    coachSummaryShown = true;
    const existing = shadowRoot.querySelector(".taktik-onb-scrim");
    if (existing) existing.remove();
    const acc = _coachAccuracy();
    const empty = coachMoveCount <= 0;
    const scrim = document.createElement("div");
    scrim.className = "taktik-onb-scrim";
    const body = empty
      ? `<div class="taktik-sum-empty">${t("summaryEmpty")}</div>`
      : `
        <div class="taktik-sum-acc-wrap">
          <div class="taktik-sum-acc-num">${acc}%</div>
          <div class="taktik-sum-acc-label">${t("summaryAccuracy")}</div>
          <div class="taktik-sum-acc-bar"><div class="taktik-sum-acc-fill" style="width:0%"></div></div>
        </div>
        <div class="taktik-sum-grid">
          <div class="taktik-sum-cell"><div class="taktik-sum-cell-label">${t("summaryMoves")}</div><div class="taktik-sum-cell-val">${coachMoveCount}</div></div>
          <div class="taktik-sum-cell good"><div class="taktik-sum-cell-label">${t("summaryPerfect")}</div><div class="taktik-sum-cell-val">${coachPerfectCount}</div></div>
          <div class="taktik-sum-cell good"><div class="taktik-sum-cell-label">${t("summaryGood")}</div><div class="taktik-sum-cell-val">${coachGoodCount}</div></div>
          <div class="taktik-sum-cell"><div class="taktik-sum-cell-label">${t("summaryOk")}</div><div class="taktik-sum-cell-val">${coachOkCount}</div></div>
          <div class="taktik-sum-cell warn"><div class="taktik-sum-cell-label">${t("summaryInacc")}</div><div class="taktik-sum-cell-val">${coachInaccCount}</div></div>
          <div class="taktik-sum-cell bad"><div class="taktik-sum-cell-label">${t("summaryBlunder")}</div><div class="taktik-sum-cell-val">${coachBlunderCount}</div></div>
          <div class="taktik-sum-cell"><div class="taktik-sum-cell-label">${t("summaryTactics")}</div><div class="taktik-sum-cell-val">${coachTactics}</div></div>
          <div class="taktik-sum-cell"><div class="taktik-sum-cell-label">${t("summaryHints")}</div><div class="taktik-sum-cell-val">${coachHintsUsed}/${coachMaxHints}</div></div>
        </div>`;
    scrim.innerHTML = `
      <div class="taktik-onb-card" role="dialog" aria-modal="true">
        <div class="taktik-onb-head">
          <div class="taktik-onb-icon">🎯</div>
          <div class="taktik-onb-title">${t("summaryTitle")}</div>
        </div>
        ${body}
        <div class="taktik-onb-actions">
          <span class="taktik-onb-spacer"></span>
          <button class="taktik-onb-btn primary" data-sum="close">${t("summaryClose")}</button>
        </div>
      </div>
    `;
    panelEl.appendChild(scrim);
    if (!empty) {
      requestAnimationFrame(() => {
        const fill = scrim.querySelector(".taktik-sum-acc-fill");
        if (fill) fill.style.width = `${acc}%`;
      });
    }
    const close = () => {
      if (scrim.parentNode) scrim.remove();
    };
    scrim.querySelectorAll("[data-sum]").forEach((b) => (b.onclick = close));
    scrim.addEventListener("click", (e) => {
      if (e.target === scrim) close();
    });
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
    // Faz 6C: apply current theme preset on host
    try {
      shadowHost.dataset.theme = currentTheme || "dark";
    } catch (_) {}

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
      <!-- ═══ FAZ 2: YENİ HEADER ═══ -->
      <div class="taktik-header">
        <!-- Row 1: brand -->
        <div class="taktik-header-top">
          <span class="taktik-logo">♟</span>
          <div style="min-width:0">
            <div class="taktik-brand">ForkSight</div>
            <div class="taktik-subtitle">Realtime Chess Intelligence</div>
          </div>
          <span style="flex:1"></span>
          <span class="taktik-status-dot" title="${t("engineLabel")}"></span>
        </div>
        <!-- Row 2: user + controls -->
        <div class="taktik-header-bottom">
          ${userBadge ? `<span class="taktik-user-badge">${userBadge.replace(/<span[^>]*>|<\/span>/g, "")}</span>` : ""}
          <select class="taktik-lang-sel" title="${t("langLabel")}">
            <option value="en"${currentLang === "en" ? " selected" : ""}>EN</option>
            <option value="tr"${currentLang === "tr" ? " selected" : ""}>TR</option>
            <option value="de"${currentLang === "de" ? " selected" : ""}>DE</option>
          </select>
          <select class="taktik-lang-sel taktik-theme-sel" title="${t("themeLabel")}">
            <option value="dark"${currentTheme === "dark" ? " selected" : ""}>🌙</option>
            <option value="light"${currentTheme === "light" ? " selected" : ""}>☀️</option>
            <option value="hc"${currentTheme === "hc" ? " selected" : ""}>⚫</option>
          </select>
          <span style="flex:1"></span>
          <button class="taktik-btn-mini taktik-stream-btn" title="📡 Telefon Companion (Streamer)" style="display:none">📡</button>
          <button class="taktik-btn-mini taktik-tour-btn" title="${t("onbReplay")}">?</button>
          <button class="taktik-btn-mini taktik-about-btn" title="${t("aboutTitle")}">⚙</button>
          <button class="taktik-btn-mini taktik-logout-btn" title="${t("logoutTitle")}">⏻</button>
          <button class="taktik-btn-mini taktik-toggle-btn" title="${t("minimizeTitle")}">—</button>
        </div>
      </div>

      <!-- ═══ FAZ 3: MODE TABS ═══ -->
      <div class="taktik-mode-tabs">
        <button class="taktik-mode-tab active" data-mode="full">${t("fullTab")}</button>
        <button class="taktik-mode-tab" data-mode="coach">${t("coachTab")}</button>
      </div>

      <!-- Scroll wrapper -->
      <div class="taktik-scroll-area">

      <!-- ═══ FAZ 4: FULL BODY ═══ -->
      <div class="taktik-body taktik-full-body">

        <!-- FAZ 4a: CANLI ANALİZ KARTI -->
        <div class="taktik-section taktik-live-section">
          <div class="taktik-section-label">${t("liveAnalysis")}</div>
          <div class="taktik-live-placeholder" style="text-align:center;padding:10px 0;font-size:11px;color:var(--text-muted);letter-spacing:0.5px">${t("analysisPending")}</div>
          <div class="taktik-live-grid" style="display:none">
            <div class="taktik-live-card">
              <div class="taktik-live-card-label">${t("evalLabel")}</div>
              <div class="taktik-live-score">—</div>
              <div class="taktik-live-verdict">—</div>
            </div>
            <div class="taktik-live-card">
              <div class="taktik-live-card-label">${t("confidenceLabel")}</div>
              <div class="taktik-confidence-pct">—</div>
              <div class="taktik-confidence-bar-wrap"><div class="taktik-confidence-bar"></div></div>
            </div>
            <div class="taktik-live-card">
              <div class="taktik-live-card-label">${t("threatLabel")}</div>
              <div class="taktik-threat-badge">—</div>
            </div>
          </div>
        </div>

        <!-- FAZ 4b: ENGINE AYARLARI -->
        <div class="taktik-section taktik-collapsible-section">
          <div class="taktik-section-label-row taktik-collapsible-header" style="cursor:pointer;user-select:none">
            <span class="taktik-section-label">${t("engineSettings")}</span>
            <span class="taktik-collapse-arrow" style="font-size:11px;color:var(--text-muted);transition:transform 0.2s;transform:rotate(180deg)">▼</span>
          </div>
          <div class="taktik-collapsible-body" style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
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
            <input type="range" class="taktik-elo-slider" min="0" max="2800" step="100" value="0" style="flex:1;accent-color:var(--warn)" title="${t("eloCeilingOff")}">
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
          <div class="taktik-row">
            <label>${t("movesLabel")}</label>
            <select class="taktik-mpv">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3" selected>3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
            <label style="margin-left:10px">${t("turnLabel")}</label>
            <select class="taktik-turn">
              <option value="auto">${t("automatic")}</option>
              <option value="w">${t("white")}</option>
              <option value="b">${t("black")}</option>
            </select>
          </div>
          </div><!-- /taktik-collapsible-body -->
        </div>

        <!-- FAZ 4c: MOTOR DERİNLİĞİ -->
        <div class="taktik-section">
          <div class="taktik-section-label-row">
            <span class="taktik-section-label">${t("engineDepth")}</span>
            <span class="taktik-depth-val taktik-depth-big">${settings.depth}</span>
          </div>
          <input type="range" class="taktik-depth" min="5" max="25" value="${settings.depth}" style="width:100%;margin:6px 0 4px;accent-color:var(--accent)">
          <div class="taktik-slider-labels">
            <span>${t("depthFast")}</span><span>${t("depthBalanced")}</span><span>${t("depthDeep")}</span>
          </div>
        </div>

        <!-- FAZ 4d: BUTONLAR -->
        <button class="taktik-btn taktik-analyze-btn">${t("analyzeBtn")}</button>
        <button class="taktik-btn taktik-clear-btn">${t("clearBtn")}</button>
        <button class="taktik-btn taktik-stealth-btn">${t("stealthBtn")}</button>
        <button class="taktik-btn taktik-reset-btn">${t("resetBtn")}</button>

        <!-- Durum + FEN + Hamleler -->
        <div class="taktik-fen" title="FEN">—</div>
        <div class="taktik-status">${t("defaultStatus")}</div>
        <div class="taktik-moves"></div>

        <!-- FAZ 4e: FOOTER -->
        <div class="taktik-footer">
          <div class="taktik-engine-info">
            <span class="taktik-engine-dot"></span>
            ${t("engineLabel")} &nbsp;|&nbsp; ${t("statusLabel")} <span class="taktik-engine-status-text">${t("engineActive")}</span>
          </div>
          ${
            !isGuest && loggedInUser
              ? `
          <div class="taktik-welcome-card">
            <span class="taktik-welcome-icon">✅</span>
            <div>
              <div class="taktik-welcome-name">${t("welcome", loggedInUser)}</div>
              <div class="taktik-welcome-sub">${t("welcomeSub")}</div>
            </div>
          </div>`
              : ""
          }
        </div>
      </div>

      <!-- ═══ FAZ 5: KOÇ MODU ═══ -->
      <div class="taktik-coach-body" style="display:none">

        <!-- Premium gate overlay (shown when !isPremium) -->
        <div class="taktik-coach-lock">
          <div class="taktik-coach-lock-icon">👑</div>
          <h3 class="taktik-coach-lock-title">${currentLang === "tr" ? "Koç Modu Premium'a Özel" : currentLang === "de" ? "Coach-Modus nur für Premium" : "Coach Mode is Premium-only"}</h3>
          <p class="taktik-coach-lock-desc">${currentLang === "tr" ? "Eğitsel ipuçları, blunder uyarıları, taktik tespiti ve sesli koç sadece Premium üyelerde aktif." : currentLang === "de" ? "Lerntipps, Blunder-Warnungen, Taktikerkennung und Sprachcoach sind nur für Premium aktiv." : "Educational hints, blunder alerts, tactic detection and voice coach are unlocked for Premium members."}</p>
          <ul class="taktik-coach-lock-list">
            <li>🎯 <span><b>${currentLang === "tr" ? "İpuçları" : currentLang === "de" ? "Hinweise" : "Hints"}</b> — ${currentLang === "tr" ? "maç başına 5 stratejik ipucu" : currentLang === "de" ? "5 strategische Hinweise pro Partie" : "5 strategic hints per game"}</span></li>
            <li>⚠️ <span><b>${currentLang === "tr" ? "Blunder Uyarısı" : "Blunder Alert"}</b> — ${currentLang === "tr" ? "hatalı hamleleri anında uyarır" : currentLang === "de" ? "warnt sofort vor Fehlern" : "instant warnings on bad moves"}</span></li>
            <li>🎯 <span><b>${currentLang === "tr" ? "Taktik Tespiti" : currentLang === "de" ? "Taktikerkennung" : "Tactic Detection"}</b> — ${currentLang === "tr" ? "forks, pins, skewers algılar" : currentLang === "de" ? "erkennt Gabeln, Fesselungen, Spieße" : "spots forks, pins, skewers"}</span></li>
            <li>🔊 <span><b>${currentLang === "tr" ? "Sesli Koç" : currentLang === "de" ? "Sprachcoach" : "Voice Coach"}</b> — ${currentLang === "tr" ? "kritik içgörüleri seslendirir" : currentLang === "de" ? "liest kritische Erkenntnisse vor" : "speaks critical insights aloud"}</span></li>
            <li>📈 <span><b>${currentLang === "tr" ? "Maç Analizi" : currentLang === "de" ? "Partieanalyse" : "Game Analysis"}</b> — ${currentLang === "tr" ? "oyun sonu performans özeti" : currentLang === "de" ? "Leistungsbericht nach der Partie" : "post-game performance report"}</span></li>
          </ul>
          <button class="taktik-coach-lock-cta">${currentLang === "tr" ? "👑 Premium'a Geç" : currentLang === "de" ? "👑 Premium freischalten" : "👑 Upgrade to Premium"}</button>
        </div>

        <!-- FAZ 5a: POZİSYON DEĞERLENDİRME -->
        <div class="taktik-section taktik-eval-section">
          <div class="taktik-section-label">${t("posEvalLabel")}</div>
          <div class="taktik-eval-row">
            <div>
              <div class="taktik-eval-score">—</div>
              <div class="taktik-eval-verdict">${t("coachEqual")}</div>
            </div>
            <canvas class="taktik-sparkline" width="180" height="64"></canvas>
          </div>
          <!-- Hidden but present for JS compat (updateEvalBar) -->
          <div style="display:none">
            <div class="taktik-eval-fill"></div>
            <div class="taktik-eval-text">${t("coachEqual")}</div>
          </div>
        </div>

        <!-- Move feedback -->
        <div class="taktik-move-feedback taktik-feedback-good" style="display:none"></div>
        <div class="taktik-tactic-alert" style="display:none">${t("coachTacticFound")}</div>

        <!-- FAZ 5b: İPUCU KARTI -->
        <div class="taktik-hint-card">
          <div class="taktik-hint-card-info">
            <span class="taktik-hint-card-icon">💡</span>
            <div class="taktik-hint-card-text">
              <div class="taktik-hint-card-title-row">
                <span class="taktik-hint-card-title">${t("coachHint")}</span>
                <span class="taktik-hints-left-chip taktik-hints-left">${t("coachHintsLeft", coachMaxHints, coachMaxHints)}</span>
              </div>
              <div class="taktik-hint-card-sub">${t("hintSubLabel")}</div>
            </div>
          </div>
          <button class="taktik-hint-btn" type="button">
            <span class="taktik-hint-btn-icon">🔑</span>
            <span class="taktik-hint-btn-label">${t("coachHint")}</span>
          </button>
        </div>

        <!-- Blunder & Tactic toggles -->
        <div class="taktik-section" style="padding:10px 12px;gap:6px;display:flex;flex-direction:column;">
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
          <div class="taktik-row taktik-auto-row">
            <label>${t("coachVoice")}</label>
            <label class="taktik-switch">
              <input type="checkbox" class="taktik-coach-voice-toggle">
              <span class="taktik-slider"></span>
            </label>
          </div>
        </div>

        <!-- Depth -->
        <div class="taktik-section">
          <div class="taktik-section-label-row">
            <span class="taktik-section-label">${t("coachDepth")}</span>
            <span class="taktik-coach-depth-val taktik-depth-big">${settings.depth}</span>
          </div>
          <input type="range" class="taktik-coach-depth" min="5" max="25" value="${settings.depth}" style="width:100%;margin:6px 0 4px;accent-color:var(--coach)">
          <div class="taktik-slider-labels">
            <span>${t("depthFast")}</span><span>${t("depthBalanced")}</span><span>${t("depthDeep")}</span>
          </div>
        </div>

        <!-- FAZ 5c: PLAN & TESPİT KARTLARI -->
        <div class="taktik-coach-card taktik-plan-card" style="display:none">
          <span class="taktik-coach-card-icon">🔮</span>
          <div>
            <div class="taktik-coach-card-title">${t("planCardTitle")}</div>
            <div class="taktik-plan-text">—</div>
          </div>
        </div>
        <div class="taktik-coach-card taktik-detect-card" style="display:none">
          <span class="taktik-coach-card-icon">🎯</span>
          <div>
            <div class="taktik-coach-card-title">${t("detectCardTitle")}</div>
            <div class="taktik-detect-text">—</div>
          </div>
        </div>

        <!-- Stealth + stats + status -->
        <button class="taktik-btn taktik-stealth-btn">${t("stealthBtn")}</button>
        <div class="taktik-coach-stats">${t("coachGameStats", 0, 0)}</div>
        <div class="taktik-coach-status">${t("coachWaiting")}</div>
      </div>

      </div><!-- /taktik-scroll-area -->
    `;

    shadowRoot.appendChild(panelEl);

    // Event listeners
    panelEl.querySelector(".taktik-analyze-btn").onclick = analyzePosition;

    // Engine Ayarları collapse toggle
    const collHeader = panelEl.querySelector(".taktik-collapsible-header");
    if (collHeader) {
      collHeader.onclick = () => {
        const body = collHeader.parentElement.querySelector(
          ".taktik-collapsible-body",
        );
        const arrow = collHeader.querySelector(".taktik-collapse-arrow");
        const isOpen = body.style.display === "flex";
        body.style.display = isOpen ? "none" : "flex";
        if (arrow) arrow.style.transform = isOpen ? "" : "rotate(180deg)";
      };
    }

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
          if (!isPremium) {
            // Premium-gated: show lock overlay, do NOT start observers
            if (coachBody) coachBody.classList.add("taktik-locked");
          } else {
            if (coachBody) coachBody.classList.remove("taktik-locked");
            startCoachObserver();
          }
        } else {
          coachMode = false;
          if (fullBody) fullBody.style.display = "";
          if (coachBody) coachBody.style.display = "none";
          stopCoachObserver();
          clearArrows();
        }
      };
    });

    // ─── Coach lock CTA → Premium popup ───
    const coachLockCta = panelEl.querySelector(".taktik-coach-lock-cta");
    if (coachLockCta) coachLockCta.onclick = () => showPremiumPopup();

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

    const coachVoiceToggle = panelEl.querySelector(
      ".taktik-coach-voice-toggle",
    );
    if (coachVoiceToggle)
      coachVoiceToggle.onchange = () => {
        coachVoiceOn = coachVoiceToggle.checked;
        if (coachVoiceOn) {
          warmVoiceOnce();
          speak(t("coachStarted") || "Voice coach on", { priority: true });
        } else {
          try {
            window.speechSynthesis?.cancel();
          } catch {
            /* ignore */
          }
        }
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
    eloSlider.oninput = () => {
      const v = parseInt(eloSlider.value);
      settings.eloCeiling = v;
      eloSlider.title = v === 0 ? t("eloCeilingOff") : String(v);
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
    const scrollArea = panelEl.querySelector(".taktik-scroll-area");
    let isCollapsed = false;
    toggleBtn.onclick = () => {
      isCollapsed = !isCollapsed;
      if (isCollapsed) {
        if (scrollArea) scrollArea.style.display = "none";
        if (modeTabs) modeTabs.style.display = "none";
        toggleBtn.textContent = "+";
      } else {
        if (modeTabs) modeTabs.style.display = "flex";
        if (scrollArea) scrollArea.style.display = "";
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

    // Faz 11: Stream (telefon companion) butonu
    {
      const sb = panelEl.querySelector(".taktik-stream-btn");
      if (sb) sb.onclick = () => openStreamModal();
      refreshStreamButton();
    }

    // Hakkında butonu
    // Faz 6C: Theme switcher (instant via host dataset)
    {
      const themeSel = panelEl.querySelector(".taktik-theme-sel");
      if (themeSel) {
        themeSel.onchange = (e) => {
          const v = e.target.value;
          if (!["dark", "light", "hc"].includes(v)) return;
          currentTheme = v;
          try {
            if (shadowHost) shadowHost.dataset.theme = v;
            chrome.storage.local.set({ taktik_theme: v });
          } catch (_) {}
        };
      }
    }

    panelEl.querySelector(".taktik-about-btn").onclick = () => showAboutModal();

    // Faz 5: Onboarding tour butonu
    const tourBtn = panelEl.querySelector(".taktik-tour-btn");
    if (tourBtn) tourBtn.onclick = () => showOnboarding(0);
    try {
      chrome.storage.local.get(["taktik_onboarded"], (r) => {
        if (!r || !r.taktik_onboarded) {
          setTimeout(() => showOnboarding(0), 900);
        }
      });
    } catch (_) {}

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
    // FAZ 6: Drive status-dot + engine-status-text from status type
    const dot = panelEl?.querySelector(".taktik-status-dot");
    const engineDot = panelEl?.querySelector(".taktik-engine-dot");
    const engineTxt = panelEl?.querySelector(".taktik-engine-status-text");
    if (dot) {
      dot.classList.remove("thinking", "error", "warn", "idle");
      if (type === "working") dot.classList.add("thinking");
      else if (type === "error") dot.classList.add("error");
      else if (type === "warn") dot.classList.add("warn");
    }
    if (engineDot) {
      engineDot.classList.remove("thinking");
      if (type === "working") engineDot.classList.add("thinking");
    }
    if (engineTxt) {
      if (type === "error") {
        engineTxt.textContent = t("engineError") || "Error";
        engineTxt.style.color = "var(--danger)";
      } else if (type === "working") {
        engineTxt.textContent = t("engineThinking") || t("engineActive");
        engineTxt.style.color = "var(--warn)";
      } else {
        engineTxt.textContent = t("engineActive");
        engineTxt.style.color = "var(--accent)";
      }
    }
    // FAZ 6: Analiz bitince scanning animasyonunu kaldır
    if (type !== "working") {
      panelEl
        ?.querySelector(".taktik-analyze-btn")
        ?.classList.remove("scanning");
    }
  }

  function updateFenDisplay(fen) {
    const el = panelEl?.querySelector(".taktik-fen");
    if (el) el.textContent = fen;
  }

  // FAZ 6: Toast bildirimi
  function showToast(message, type = "info", duration = 2500) {
    if (!shadowRoot) return;
    const existing = shadowRoot.querySelector(".taktik-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = `taktik-toast taktik-toast-${type}`;
    const icons = { success: "✓", error: "✕", warn: "⚠", info: "ℹ" };
    toast.textContent = `${icons[type] || ""} ${message}`;
    shadowRoot.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "taktik-toast-out 0.25s ease forwards";
      setTimeout(() => toast.remove(), 260);
    }, duration);
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
    updateLiveCards(moves);
  }

  function updateLiveCards(moves) {
    if (!panelEl || !moves || moves.length === 0) return;

    // First call: hide placeholder, show grid
    const placeholder = panelEl.querySelector(".taktik-live-placeholder");
    const grid = panelEl.querySelector(".taktik-live-grid");
    if (placeholder) placeholder.style.display = "none";
    if (grid) grid.style.display = "grid";

    // DEĞERLENDİRME
    const scoreEl = panelEl.querySelector(".taktik-live-score");
    const verdictEl = panelEl.querySelector(".taktik-live-verdict");
    if (scoreEl) {
      const raw = moves[0].score || "—";
      const num = parseScore(raw);
      scoreEl.textContent = raw;
      if (num > 0.5) {
        scoreEl.style.color = "#4ADE80";
        if (verdictEl) verdictEl.textContent = t("coachWinning");
      } else if (num < -0.5) {
        scoreEl.style.color = "#F87171";
        if (verdictEl) verdictEl.textContent = t("coachLosing");
      } else {
        scoreEl.style.color = "var(--text)";
        if (verdictEl) verdictEl.textContent = t("coachEqual");
      }
    }

    const confEl = panelEl.querySelector(".taktik-confidence-pct");
    const confBar = panelEl.querySelector(".taktik-confidence-bar");
    if (confEl) {
      let confidence = 85;
      if (moves.length >= 2) {
        const gap = Math.abs(
          parseScore(moves[0].score) - parseScore(moves[1].score),
        );
        confidence = Math.min(99, Math.round(50 + gap * 14));
      }
      confEl.textContent = `${confidence}%`;
      if (confBar) confBar.style.width = `${confidence}%`;
    }

    const threatEl = panelEl.querySelector(".taktik-threat-badge");
    if (threatEl) {
      const pv0 = moves[0].pv_san || moves[0].pv_uci || [];
      const ourMove = pv0[0] || "";
      const oppReply = pv0[1] || "";
      const scoreDiff =
        moves.length >= 2
          ? Math.abs(parseScore(moves[0].score) - parseScore(moves[1].score))
          : 0;

      if (ourMove.includes("#") || oppReply.includes("#")) {
        threatEl.textContent = "🟥 Mat";
        threatEl.classList.add("active");
      } else if (ourMove.includes("+")) {
        threatEl.textContent = "⚡ Şah";
        threatEl.classList.add("active");
      } else if (oppReply.includes("+") || oppReply.includes("x")) {
        threatEl.textContent = "⚠️ Tehdit";
        threatEl.classList.add("active");
      } else if (scoreDiff > 2) {
        threatEl.textContent = "✨ Taktik";
        threatEl.classList.add("active");
      } else {
        threatEl.textContent = "—";
        threatEl.classList.remove("active");
      }
    }

    // Faz 11: push to phone companion (if active)
    try {
      streamPushFromMoves(moves);
    } catch (e) {}
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
    // Faz 2: also clear board overlay when coach is stopped
    if (typeof clearCoachInsightHighlights === "function")
      clearCoachInsightHighlights();
  }

  // ─── Position insight engine (Faz 1: severity + theme + phase) ────────────

  const PIECE_WEIGHTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

  function detectGamePhase(myPieces, oppPieces) {
    const sumMat = (pcs) => {
      let s = 0;
      for (const [k, arr] of Object.entries(pcs))
        s += (PIECE_WEIGHTS[k] || 0) * arr.length;
      return s;
    };
    const total = sumMat(myPieces) + sumMat(oppPieces);
    if (total >= 65) return "opening";
    if (total >= 30) return "middlegame";
    return "endgame";
  }

  function humanEvalLabel(score) {
    if (score > 50)
      return {
        key: "humanEvalMate",
        arg: Math.max(1, Math.round(100 - score)),
      };
    if (score < -50)
      return {
        key: "humanEvalGettingMated",
        arg: Math.max(1, Math.round(100 + score)),
      };
    if (score >= 5) return { key: "humanEvalCrushing" };
    if (score >= 3) return { key: "humanEvalWinning" };
    if (score >= 1.5) return { key: "humanEvalBigAdv" };
    if (score >= 0.7) return { key: "humanEvalAdv" };
    if (score >= 0.3) return { key: "humanEvalSlightAdv" };
    if (score > -0.3) return { key: "humanEvalEqual" };
    if (score > -0.7) return { key: "humanEvalSlightDis" };
    if (score > -1.5) return { key: "humanEvalDis" };
    if (score > -3) return { key: "humanEvalBigDis" };
    if (score > -5) return { key: "humanEvalLost" };
    return { key: "humanEvalCrushed" };
  }

  function humanEvalText(score) {
    const { key, arg } = humanEvalLabel(score);
    return arg !== undefined ? t(key, arg) : t(key);
  }

  function analyzePositionInsights(fenBoard, playerColor, moves) {
    const rows = fenBoard.split("/");
    const board = rows.map((row) => {
      const cells = [];
      for (const ch of row) {
        if (ch >= "1" && ch <= "8")
          for (let i = 0; i < +ch; i++) cells.push(".");
        else cells.push(ch);
      }
      return cells;
    });

    const isWhite = playerColor === "w";
    const isMine = (p) =>
      isWhite
        ? p === p.toUpperCase() && p !== "."
        : p === p.toLowerCase() && p !== ".";

    const myPieces = {};
    const oppPieces = {};
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const p = board[r][f];
        if (p === ".") continue;
        const key = p.toLowerCase();
        if (isMine(p)) {
          if (!myPieces[key]) myPieces[key] = [];
          myPieces[key].push([r, f]);
        } else {
          if (!oppPieces[key]) oppPieces[key] = [];
          oppPieces[key].push([r, f]);
        }
      }
    }

    const fileNames = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const sq = (r, f) => fileNames[f] + (8 - r);
    const insights = [];
    const planHints = [];
    const phase = detectGamePhase(myPieces, oppPieces);

    const push = (text, severity, theme, squares) =>
      insights.push({ text, severity, theme, squares: squares || [] });

    if (oppPieces["q"]) {
      for (const [r, f] of oppPieces["q"]) {
        const oppQueenRank = isWhite ? r : 7 - r;
        if (oppQueenRank >= 4)
          push(t("insightQueenOut", sq(r, f)), 0.75, "tactic", [sq(r, f)]);
      }
    }

    if (oppPieces["k"]) {
      const [kr, kf] = oppPieces["k"][0];
      const oppKingRank = isWhite ? kr : 7 - kr;
      const isExposed = oppKingRank >= 1 && kf >= 3 && kf <= 5;
      if (isExposed)
        push(t("insightKingExposed", sq(kr, kf)), 0.85, "tactic", [sq(kr, kf)]);
    }

    if (myPieces["p"]) {
      for (const [r, f] of myPieces["p"]) {
        const myPawnRank = isWhite ? 7 - r : r;
        if (myPawnRank < 4) continue;
        const blocked = (oppPieces["p"] || []).some(
          ([pr, pf]) =>
            pf >= f - 1 && pf <= f + 1 && (isWhite ? pr < r : pr > r),
        );
        if (!blocked) {
          const sev = 0.5 + (myPawnRank - 4) * 0.15;
          push(
            t("insightPassedPawn", sq(r, f)),
            Math.min(0.95, sev),
            "endgame",
            [sq(r, f)],
          );
        }
      }
    }

    if (myPieces["r"]) {
      for (const [, f] of myPieces["r"]) {
        const hasOwnPawn = (myPieces["p"] || []).some(([, ff]) => ff === f);
        const hasOppPawn = (oppPieces["p"] || []).some(([, ff]) => ff === f);
        if (!hasOwnPawn && !hasOppPawn)
          push(t("insightOpenFile", fileNames[f]), 0.6, "positional", [
            fileNames[f] + "-file",
          ]);
        else if (!hasOwnPawn && hasOppPawn)
          push(t("insightSemiOpen", fileNames[f]), 0.45, "positional", [
            fileNames[f] + "-file",
          ]);
      }
    }

    if (oppPieces["p"]) {
      const oppPawnFiles = oppPieces["p"].map(([, f]) => f);
      for (const [r, f] of oppPieces["p"]) {
        const onStartRank = isWhite ? r === 1 : r === 6;
        if (onStartRank) continue;
        const isIsolated =
          !oppPawnFiles.includes(f - 1) && !oppPawnFiles.includes(f + 1);
        if (isIsolated)
          push(t("insightIsolated", sq(r, f)), 0.4, "positional", [sq(r, f)]);
      }
    }

    if (oppPieces["p"]) {
      const fileCounts = {};
      for (const [, f] of oppPieces["p"])
        fileCounts[f] = (fileCounts[f] || 0) + 1;
      for (const [f, cnt] of Object.entries(fileCounts)) {
        if (cnt >= 2)
          push(t("insightDoubled", fileNames[f]), 0.35, "positional", [
            fileNames[f] + "-file",
          ]);
      }
    }

    if (myPieces["n"]) {
      for (const [r, f] of myPieces["n"]) {
        const myRank = isWhite ? 7 - r : r;
        if (myRank < 4) continue;
        const controlled = (oppPieces["p"] || []).some(([pr, pf]) =>
          isWhite
            ? pr === r + 1 && Math.abs(pf - f) === 1
            : pr === r - 1 && Math.abs(pf - f) === 1,
        );
        if (!controlled)
          push(t("insightOutpost", sq(r, f)), 0.55, "positional", [sq(r, f)]);
      }
    }

    if (oppPieces["p"]) {
      const oppPawnFiles = oppPieces["p"].map(([, f]) => f);
      for (const [r, f] of oppPieces["p"]) {
        const oppPawnRank = isWhite ? r : 7 - r;
        if (oppPawnRank < 2 || oppPawnRank > 5) continue;
        const supportedBehind = (oppPieces["p"] || []).some(([pr, pf]) => {
          const behindRank = isWhite ? pr > r : pr < r;
          return Math.abs(pf - f) === 1 && behindRank;
        });
        const iHaveNoOwnPawn = !(myPieces["p"] || []).some(
          ([, ff]) => ff === f,
        );
        if (
          !supportedBehind &&
          iHaveNoOwnPawn &&
          !oppPawnFiles.includes(f - 1) &&
          !oppPawnFiles.includes(f + 1)
        )
          continue;
        if (!supportedBehind && iHaveNoOwnPawn)
          push(
            t("insightBackward", sq(r, f), fileNames[f]),
            0.45,
            "positional",
            [sq(r, f)],
          );
      }
    }

    const pushPlan = (text, theme) => planHints.push({ text, theme });
    if (moves && moves.length > 0) {
      const pv = moves[0].pv_san || moves[0].pv_uci || [];
      const bestText = pv[0] || moves[0].move || "";
      const score = parseScore(moves[0].score);
      if (bestText) {
        if (score > 3) pushPlan(t("planBigAdv", bestText), "tactic");
        else if (score > 1) pushPlan(t("planAdv", bestText), "positional");
        else if (score > 0.3)
          pushPlan(t("planSlightAdv", bestText), "positional");
        else if (score < -3) pushPlan(t("planBigDis", bestText), "defense");
        else if (score < -1) pushPlan(t("planDis", bestText), "defense");
        else if (score < -0.3)
          pushPlan(t("planSlightDis", bestText), "defense");
        else
          pushPlan(
            t("planEqual", bestText, pv[1] ? t("planAfter") + pv[1] : ""),
            "positional",
          );
      }
      if (pv[0]?.includes?.("#")) pushPlan(t("planMate"), "tactic");
      else if (pv[0]?.includes?.("+")) pushPlan(t("planCheck"), "tactic");
      if (pv[0]?.includes?.("x") && !pv[0]?.includes?.("+"))
        pushPlan(t("planCapture"), "tactic");
      if (pv[0]?.startsWith?.("O-O")) pushPlan(t("planCastle"), "positional");
    }

    insights.sort((a, b) => b.severity - a.severity);

    return { insights, planHints, phase };
  }

  // ─── Faz 1: Render helpers for plan / detect cards ──────────────────────────
  const THEME_CLASS = {
    tactic: "chip-tactic",
    positional: "chip-positional",
    endgame: "chip-endgame",
    defense: "chip-defense",
    opening: "chip-opening",
  };
  const THEME_LABEL = {
    tactic: "themeTactic",
    positional: "themePositional",
    endgame: "themeEndgame",
    defense: "themeDefense",
    opening: "themeOpening",
  };
  const PHASE_LABEL = {
    opening: "phaseOpening",
    middlegame: "phaseMiddlegame",
    endgame: "phaseEndgame",
  };

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function renderChip(theme) {
    const cls = THEME_CLASS[theme] || "chip-positional";
    const lbl = t(THEME_LABEL[theme] || "themePositional");
    return `<span class="taktik-chip ${cls}">${escapeHtml(lbl)}</span>`;
  }

  function renderPhaseChip(phase) {
    if (!phase) return "";
    const lbl = t(PHASE_LABEL[phase] || "phaseMiddlegame");
    return `<span class="taktik-chip chip-phase chip-phase-${phase}">${escapeHtml(lbl)}</span>`;
  }

  function renderInsightList(insights, max = 3) {
    if (!insights || insights.length === 0) return "";
    return insights
      .slice(0, max)
      .map((ins) => {
        const sev = Math.max(0, Math.min(1, ins.severity || 0.5));
        const pct = Math.round(sev * 100);
        const sqAttr = (ins.squares || []).join(",");
        const theme = ins.theme || "positional";
        return `
        <div class="taktik-insight-row" data-squares="${escapeHtml(sqAttr)}" data-theme="${escapeHtml(theme)}">
          <div class="taktik-insight-line">
            ${renderChip(ins.theme)}
            <span class="taktik-insight-text">${escapeHtml(ins.text)}</span>
          </div>
          <div class="taktik-severity-bar"><div class="taktik-severity-fill" style="width:${pct}%"></div></div>
        </div>`;
      })
      .join("");
  }

  function renderPlanBody(planHints, phase, playerEval) {
    const evalText = humanEvalText(playerEval);
    const head = `
      <div class="taktik-plan-meta">
        ${renderPhaseChip(phase)}
        <span class="taktik-eval-pill">${escapeHtml(evalText)}</span>
      </div>`;
    if (!planHints || planHints.length === 0) {
      return (
        head +
        `<div class="taktik-plan-empty">${escapeHtml(t("planEmpty"))}</div>`
      );
    }
    const items = planHints
      .slice(0, 2)
      .map(
        (p) => `
      <div class="taktik-plan-row">
        ${renderChip(p.theme)}
        <span class="taktik-plan-line">${escapeHtml(p.text)}</span>
      </div>`,
      )
      .join("");
    return head + items;
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
        response = await analyzeViaWS(fen, depth, multipv, 0, "manual");
      }
      if (!response) {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "analyze",
              data: { fen, depth, multipv, max_time: 0, mode: "manual" },
            },
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

      // Position insights (plan + detect)
      const { insights, planHints, phase } = analyzePositionInsights(
        fenBoard,
        playerColor,
        response.moves,
      );

      // ── ÖNERİLEN PLAN — Faz 1: phase chip + human eval + multi plan rows ──
      const planCard = panelEl?.querySelector(".taktik-plan-card");
      const planText = panelEl?.querySelector(".taktik-plan-text");
      if (planCard && planText) {
        // Faz 3: remember previous eval pill text for count-up animation
        const prevEvalText = planText.dataset.prevEvalPill || "";
        planText.innerHTML = renderPlanBody(planHints, phase, playerEval);
        const newEvalText = humanEvalText(playerEval);
        const pill = planText.querySelector(".taktik-eval-pill");
        if (pill) {
          pill.dataset.prevEvalText = prevEvalText;
          animateEvalPill(pill, newEvalText);
        }
        planText.dataset.prevEvalPill = newEvalText;
        planCard.style.display = "";
      }

      // Faz 2: clear previous board overlay before redrawing
      clearCoachInsightHighlights();

      if (isPlayerTurn) {
        coachPrevEval = playerEval;
        coachBestMove = bestMove;
        updateCoachStatus(t("coachWaiting"));

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
          const detectCard = panelEl?.querySelector(".taktik-detect-card");
          const detectText = panelEl?.querySelector(".taktik-detect-text");
          if (gap > 1.5 && playerEval > 0) {
            coachTactics++;
            showTacticAlert(true);
            updateCoachStats();
            if (detectCard && detectText) {
              const bestSan =
                response.moves[0].pv_san?.[0] || response.moves[0].move;
              const tacticInsight = {
                text: t("tacticAlert", bestSan, gap.toFixed(1)),
                severity: Math.min(0.99, 0.7 + gap / 20),
                theme: "tactic",
                squares: [],
              };
              const merged = [tacticInsight, ...insights];
              detectText.innerHTML = renderInsightList(merged, 3);
              detectCard.style.display = "";
            }
          } else {
            showTacticAlert(false);
            if (detectCard && detectText) {
              if (insights.length > 0) {
                detectText.innerHTML = renderInsightList(insights, 3);
              } else {
                const fallback =
                  playerEval > 1.5
                    ? "posAdvantage"
                    : playerEval < -1.5
                      ? "posDifficult"
                      : "posEqual";
                const theme =
                  playerEval > 1.5
                    ? "tactic"
                    : playerEval < -1.5
                      ? "defense"
                      : "positional";
                detectText.innerHTML = renderInsightList(
                  [{ text: t(fallback), severity: 0.4, theme, squares: [] }],
                  1,
                );
              }
              detectCard.style.display = "";
            }
          }
        } else {
          showTacticAlert(false);
          const detectCard = panelEl?.querySelector(".taktik-detect-card");
          const detectText = panelEl?.querySelector(".taktik-detect-text");
          if (detectCard && detectText) {
            if (insights.length > 0) {
              detectText.innerHTML = renderInsightList(insights, 3);
            } else {
              const fallback =
                playerEval > 1.5
                  ? "posAdvantage"
                  : playerEval < -1.5
                    ? "posDifficult"
                    : "posEqual";
              const theme =
                playerEval > 1.5
                  ? "tactic"
                  : playerEval < -1.5
                    ? "defense"
                    : "positional";
              detectText.innerHTML = renderInsightList(
                [{ text: t(fallback), severity: 0.4, theme, squares: [] }],
                1,
              );
            }
            detectCard.style.display = "";
          }
        }

        // Faz 2: paint board with insight squares ONLY.
        // Best-move ghost arrow is intentionally NOT drawn here — it would turn
        // Coach mode into an unlimited-hints cheat. Use the Get Hint button.
        {
          const detectTextEl = panelEl?.querySelector(".taktik-detect-text");
          wireInsightHover(detectTextEl);
          drawCoachInsightHighlights(insights);
        }

        // Faz 4: Voice — speak top critical insight once per FEN
        if (coachVoiceOn && fenBoard !== coachVoiceLastFen) {
          coachVoiceLastFen = fenBoard;
          const top = insights && insights[0];
          if (top && (top.severity || 0) >= 0.6 && top.text) {
            speak(top.text);
          }
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
    // Legacy hidden bar
    const fill = panelEl.querySelector(".taktik-eval-fill");
    const text = panelEl.querySelector(".taktik-eval-text");
    // New coach UI elements
    const scoreEl = panelEl.querySelector(".taktik-eval-score");
    const verdictEl = panelEl.querySelector(".taktik-eval-verdict");

    const clamped = Math.max(-10, Math.min(10, playerEval));
    const pct = Math.round(50 + clamped * 5);
    if (fill) fill.style.width = Math.max(2, Math.min(98, pct)) + "%";

    const displayEval = Math.max(-99, Math.min(99, playerEval));
    let evalStr, verdict, color;

    if (displayEval > 0.5) {
      evalStr = `+${displayEval.toFixed(2)}`;
      verdict = t("coachWinning");
      color = "#4ADE80";
      if (fill) fill.style.background = color;
      if (text) {
        text.style.color = color;
        text.textContent = `+${displayEval.toFixed(1)} ${verdict}`;
      }
    } else if (displayEval < -0.5) {
      evalStr = displayEval.toFixed(2);
      verdict = t("coachLosing");
      color = "#F87171";
      if (fill) fill.style.background = color;
      if (text) {
        text.style.color = color;
        text.textContent = `${displayEval.toFixed(1)} ${verdict}`;
      }
    } else {
      evalStr = `${displayEval >= 0 ? "+" : ""}${displayEval.toFixed(2)}`;
      verdict = t("coachEqual");
      color = "#9CA3AF";
      if (fill) {
        fill.style.background = "#888";
      }
      if (text) {
        text.style.color = "#888";
        text.textContent = `${displayEval >= 0 ? "+" : ""}${displayEval.toFixed(1)} ${verdict}`;
      }
    }

    if (scoreEl) {
      scoreEl.textContent = evalStr;
      scoreEl.style.color = color;
    }
    if (verdictEl) {
      verdictEl.textContent = verdict;
      verdictEl.style.color = color;
    }

    evalHistory.push(playerEval);
    if (evalHistory.length > 40) evalHistory.shift();
    drawSparkline();
  }

  function drawSparkline() {
    if (!panelEl) return;
    const canvas = panelEl.querySelector(".taktik-sparkline");
    if (!canvas || evalHistory.length < 2) return;
    const cssW = canvas.clientWidth || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    const dpr = window.devicePixelRatio || 1;
    if (
      canvas.width !== Math.round(cssW * dpr) ||
      canvas.height !== Math.round(cssH * dpr)
    ) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = cssW,
      H = cssH;
    ctx.clearRect(0, 0, W, H);
    const MIN = -5,
      MAX = 5;
    const toY = (v) =>
      H - ((Math.max(MIN, Math.min(MAX, v)) - MIN) / (MAX - MIN)) * H;
    const toX = (i) => (i / (evalHistory.length - 1)) * W;
    const zeroY = toY(0);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(W, zeroY);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
    const last = evalHistory[evalHistory.length - 1];
    const lineColor = last >= 0 ? "#22C55E" : "#8B5CF6";
    const fillTop =
      last >= 0 ? "rgba(34,197,94,0.45)" : "rgba(139,92,246,0.45)";
    const fillBot = last >= 0 ? "rgba(34,197,94,0)" : "rgba(139,92,246,0)";
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, fillTop);
    grad.addColorStop(1, fillBot);
    ctx.beginPath();
    ctx.moveTo(toX(0), H);
    evalHistory.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
    ctx.lineTo(toX(evalHistory.length - 1), H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    evalHistory.forEach((v, i) =>
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)),
    );
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;
    const lx = toX(evalHistory.length - 1);
    const ly = toY(last);
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
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

  // ─── Faz 2: Coach insight overlay (square highlights + ghost arrow) ───
  const COACH_THEME_FILL = {
    tactic: "rgba(239,68,68,0.32)",
    positional: "rgba(139,92,246,0.28)",
    endgame: "rgba(245,158,11,0.30)",
    defense: "rgba(59,130,246,0.28)",
    opening: "rgba(34,197,94,0.28)",
  };
  const COACH_THEME_STROKE = {
    tactic: "#F87171",
    positional: "#A78BFA",
    endgame: "#FCD34D",
    defense: "#60A5FA",
    opening: "#4ADE80",
  };

  let coachSvg = null;

  function ensureCoachSvg() {
    if (!boardEl) return null;
    if (coachSvg && coachSvg.parentElement === boardEl) return coachSvg;
    coachSvg = svgEl("svg", {
      viewBox: `0 0 ${VIEWBOX} ${VIEWBOX}`,
      preserveAspectRatio: "xMidYMid meet",
    });
    coachSvg.style.cssText =
      "position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:48;";
    boardEl.style.position = "relative";
    boardEl.appendChild(coachSvg);
    return coachSvg;
  }

  function parseAlgebraic(s) {
    if (!s || typeof s !== "string") return null;
    if (/^[a-h]-file$/.test(s)) return { file: s.charCodeAt(0) - 96 };
    if (/^[a-h][1-8]$/.test(s))
      return { col: s.charCodeAt(0) - 96, row: parseInt(s[1], 10) };
    return null;
  }

  function clearCoachInsightHighlights() {
    if (boardEl)
      boardEl
        .querySelectorAll(".taktik-coach-insight-hl")
        .forEach((el) => el.remove());
    if (coachSvg) coachSvg.innerHTML = "";
  }

  function drawCoachInsightHighlights(insights) {
    if (!boardEl || !coachMode) return;
    if (!insights || insights.length === 0) return;
    const flip = isFlipped();
    insights.slice(0, 3).forEach((ins, idx) => {
      const fill = COACH_THEME_FILL[ins.theme] || COACH_THEME_FILL.positional;
      const stroke =
        COACH_THEME_STROKE[ins.theme] || COACH_THEME_STROKE.positional;
      const ringWidth = idx === 0 ? 2.5 : 1.5;
      (ins.squares || []).forEach((sq) => {
        const p = parseAlgebraic(sq);
        if (!p) return;
        if (p.col && p.row) {
          const pctX = flip ? (8 - p.col) * 12.5 : (p.col - 1) * 12.5;
          const pctY = flip ? (p.row - 1) * 12.5 : (8 - p.row) * 12.5;
          const div = document.createElement("div");
          div.className = "taktik-coach-insight-hl";
          div.dataset.square = sq;
          div.dataset.theme = ins.theme || "positional";
          div.style.cssText = `
            position:absolute;
            left:${pctX}%;top:${pctY}%;
            width:12.5%;height:12.5%;
            background:${fill};
            box-shadow:inset 0 0 0 ${ringWidth}px ${stroke};
            pointer-events:none;
            z-index:44;
            transition:filter 0.15s, transform 0.15s;
          `;
          boardEl.appendChild(div);
        } else if (p.file) {
          const pctX = flip ? (8 - p.file) * 12.5 : (p.file - 1) * 12.5;
          const div = document.createElement("div");
          div.className = "taktik-coach-insight-hl";
          div.dataset.square = sq;
          div.dataset.theme = ins.theme || "positional";
          div.style.cssText = `
            position:absolute;
            left:${pctX}%;top:0;
            width:12.5%;height:100%;
            background:${fill};
            box-shadow:inset 0 0 0 ${ringWidth}px ${stroke};
            opacity:0.55;
            pointer-events:none;
            z-index:43;
            transition:filter 0.15s, opacity 0.15s;
          `;
          boardEl.appendChild(div);
        }
      });
    });
  }

  function drawCoachGhostArrow(uciMove, theme = "tactic") {
    if (!coachMode || !uciMove || uciMove.length < 4) return;
    const svg = ensureCoachSvg();
    if (!svg) return;
    const c = uciToCoords(uciMove);
    const from = sqToPixel(c.fromCol, c.fromRow);
    const to = sqToPixel(c.toCol, c.toRow);
    const stroke = COACH_THEME_STROKE[theme] || COACH_THEME_STROKE.tactic;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = 28;
    const lineEndX = to.x - headLen * Math.cos(angle);
    const lineEndY = to.y - headLen * Math.sin(angle);
    const line = svgEl("line", {
      x1: from.x,
      y1: from.y,
      x2: lineEndX,
      y2: lineEndY,
      stroke,
      "stroke-width": 9,
      "stroke-linecap": "round",
      "stroke-dasharray": "14 10",
      opacity: "0.55",
      class: "taktik-ghost-line",
    });
    const spread = Math.PI / 5.5;
    const p1x = to.x - headLen * 1.6 * Math.cos(angle - spread);
    const p1y = to.y - headLen * 1.6 * Math.sin(angle - spread);
    const p2x = to.x - headLen * 1.6 * Math.cos(angle + spread);
    const p2y = to.y - headLen * 1.6 * Math.sin(angle + spread);
    const head = svgEl("polygon", {
      points: `${to.x},${to.y} ${p1x},${p1y} ${p2x},${p2y}`,
      fill: stroke,
      opacity: "0.55",
      class: "taktik-ghost-head",
    });
    svg.appendChild(line);
    svg.appendChild(head);
  }

  function wireInsightHover(container) {
    if (!container || !boardEl) return;
    const rows = container.querySelectorAll(
      ".taktik-insight-row[data-squares]",
    );
    rows.forEach((row) => {
      const squares = (row.dataset.squares || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (squares.length === 0) return;
      const setEmphasis = (on) => {
        squares.forEach((sq) => {
          const hl = boardEl.querySelector(
            `.taktik-coach-insight-hl[data-square="${CSS.escape(sq)}"]`,
          );
          if (hl) {
            hl.style.filter = on ? "brightness(1.6) saturate(1.4)" : "";
            hl.style.transform = on ? "scale(1.04)" : "";
          }
        });
      };
      row.addEventListener("mouseenter", () => setEmphasis(true));
      row.addEventListener("mouseleave", () => setEmphasis(false));
    });
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

  // ─── Faz 4: Voice coach (TTS) ───────────────────────────────
  const VOICE_LANG_MAP = { en: "en-US", tr: "tr-TR", de: "de-DE" };
  let _voiceWarmed = false;
  function _stripForSpeech(str) {
    return String(str || "")
      .replace(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu,
        "",
      )
      .replace(/[•·►▶◆◇★☆]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  function speak(text, { dedupe = true, priority = false } = {}) {
    if (!coachVoiceOn) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = _stripForSpeech(text);
    if (!clean) return;
    if (dedupe && clean === coachVoiceLastSpoken) return;
    try {
      if (priority) window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = VOICE_LANG_MAP[currentLang] || "en-US";
      u.rate = 1.05;
      u.pitch = 1.0;
      u.volume = 0.85;
      window.speechSynthesis.speak(u);
      coachVoiceLastSpoken = clean;
    } catch {
      /* ignore */
    }
  }
  function warmVoiceOnce() {
    if (_voiceWarmed) return;
    _voiceWarmed = true;
    try {
      window.speechSynthesis?.getVoices?.();
    } catch {
      /* ignore */
    }
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
      coachPerfectCount++;
    } else if (evalChange >= -0.3) {
      fb.classList.add("taktik-feedback-good");
      fb.textContent = t("coachGood", changeStr);
      coachGoodCount++;
    } else if (evalChange >= -1.0) {
      fb.classList.add("taktik-feedback-ok");
      fb.textContent = t("coachOk", changeStr);
      coachOkCount++;
    } else if (evalChange >= -2.0) {
      fb.classList.add("taktik-feedback-bad");
      fb.textContent = t("coachInaccuracy", changeStr, bestMove);
      coachErrors++;
      coachInaccCount++;
      updateCoachStats();
      showCoachMiss(bestMove);
      speak(t("voiceInaccuracy", bestMove || ""), { priority: true });
    } else {
      fb.classList.add("taktik-feedback-blunder");
      fb.textContent = t("coachBlunder", changeStr, bestMove);
      coachErrors++;
      coachBlunderCount++;
      updateCoachStats();
      showCoachMiss(bestMove);
      speak(t("voiceBlunder", bestMove || ""), { priority: true });
    }
    coachMoveCount++;

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
    if (show) speak(t("voiceTactic"), { priority: true });
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
    if (!status) return;
    // Faz 3: animated thinking dots when message ends with "..." (or hourglass placeholder)
    const isThinking =
      typeof msg === "string" &&
      (/\.\.\.$|⏳/.test(msg) || msg === t("engineThinking"));
    if (isThinking) {
      status.classList.add("taktik-thinking");
      const clean = String(msg)
        .replace(/\s*\.{3,}\s*$/, "")
        .trim();
      status.innerHTML =
        escapeHtml(clean) +
        '<span class="taktik-think-dots"><span></span><span></span><span></span></span>';
    } else {
      status.classList.remove("taktik-thinking");
      status.textContent = msg;
    }
  }

  // Faz 3: smooth count-up animation for eval pill numbers
  function animateEvalPill(pillEl, newText) {
    if (!pillEl) return;
    const prev = pillEl.dataset.prevEvalText;
    pillEl.dataset.prevEvalText = newText;
    const numRe = /(-?\d+(?:\.\d+)?)/;
    const m1 = prev && prev.match(numRe);
    const m2 = newText.match(numRe);
    if (!m1 || !m2 || prev === newText) {
      pillEl.textContent = newText;
      return;
    }
    const from = parseFloat(m1[1]);
    const to = parseFloat(m2[1]);
    const prefix = newText.slice(0, m2.index);
    const suffix = newText.slice(m2.index + m2[1].length);
    const isInt = !m2[1].includes(".");
    const dur = 280;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const cur = from + (to - from) * eased;
      const txt =
        prefix + (isInt ? Math.round(cur).toString() : cur.toFixed(1)) + suffix;
      pillEl.textContent = txt;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
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
        response = await analyzeViaWS(fen, depth, 1, 0, "manual");
      }
      if (!response) {
        response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(
            {
              type: "analyze",
              data: { fen, depth, multipv: 1, max_time: 0, mode: "manual" },
            },
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
    // Faz 6B
    coachMoveCount = 0;
    coachPerfectCount = 0;
    coachGoodCount = 0;
    coachOkCount = 0;
    coachInaccCount = 0;
    coachBlunderCount = 0;
    coachSummaryShown = false;
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

  // ─── v2.1 Anti-Ban yardımcıları ──────────────────────────────────
  // Lognormal: insan think-time'ı asimetrik / uzun-kuyruklu dağılır
  function lognormalRandom(meanMs, sigmaLog) {
    const z = gaussianRandom(0, 1);
    const m = Math.max(50, meanMs);
    const mu = Math.log(m) - (sigmaLog * sigmaLog) / 2;
    return Math.exp(mu + sigmaLog * z);
  }

  // Materyal sayarına göre oyun fazı (moveCounter'dan güvenilir)
  function _materialPhase(fen) {
    try {
      const board = (fen || "").split(" ")[0] || "";
      const Q = (board.match(/[Qq]/g) || []).length;
      const R = (board.match(/[Rr]/g) || []).length;
      const Bn = (board.match(/[BbNn]/g) || []).length;
      const score = Q * 4 + R * 2 + Bn * 1;
      if (score >= 18) return "opening";
      if (score >= 10) return "middlegame";
      if (score >= 5) return "lategame";
      return "endgame";
    } catch (_) {
      return "middlegame";
    }
  }

  // Zorla en iyi: tek yasal hamle ya da devasa skor uçurumu
  function _isForcedMove(moves) {
    if (!moves || moves.length === 0) return null;
    if (moves.length === 1) return "only_legal";
    const s1 = parseScore(moves[0].score);
    const s2 = parseScore(moves[1].score);
    if (Math.abs(s1 - s2) > 4.0) return "huge_gap";
    return null;
  }

  // Ponder hit (soft proxy): rakip beklenen ana hattı oynadıysa eval ~ önceki
  function _isPonderHit(moves) {
    if (_ab_lastEval === null || !moves || moves.length === 0) return false;
    const cur = parseScore(moves[0].score);
    return Math.abs(cur - _ab_lastEval) < 0.35;
  }

  // Sürpriz hamle: rakip beklenmedik bir şey oynadı → eval büyük kayar
  function _isOpponentSurprise(moves) {
    if (_ab_lastEval === null || !moves || moves.length === 0) return false;
    const cur = parseScore(moves[0].score);
    return Math.abs(cur - _ab_lastEval) > 1.2;
  }

  // Kritik pozisyon: mat tehdidi, eval şoku ya da birden çok eşdeğer iyi hamle
  function _isCriticalPosition(moves, complexity) {
    if (!moves || moves.length === 0) return false;
    const top = moves[0].score || "";
    if (typeof top === "string" && top.startsWith("M")) return true;
    if (_isOpponentSurprise(moves)) return true;
    if (complexity >= 0.7 && moves.length >= 3) {
      const s1 = parseScore(moves[0].score);
      const s3 = parseScore(moves[2].score);
      if (Math.abs(s1 - s3) < 0.3) return true;
    }
    return false;
  }

  // 8C: Top-1-match guard helpers — çok fazla engine-best hamle = lichess
  // anti-cheat'inin en önemli sinyali. Son 20 hamleden %78'i top-1 ise bir
  // sonraki hamlede zorla 2nd-best oynanmalı (skor farkı küçükse).
  function _trackPlayedRank(rank) {
    recentMoveRanks.push(rank | 0);
    if (recentMoveRanks.length > TOP1_GUARD_WINDOW) recentMoveRanks.shift();
  }
  function _getTop1Rate() {
    if (recentMoveRanks.length < 8) return 0;
    let c = 0;
    for (const r of recentMoveRanks) if (r === 0) c++;
    return c / recentMoveRanks.length;
  }
  function _shouldForceSubOptimal() {
    return (
      recentMoveRanks.length >= 12 && _getTop1Rate() > TOP1_GUARD_THRESHOLD
    );
  }

  // 8D: Autoplay'in çalışmaması gereken sayfalar (puzzle/analiz/learn vb.)
  const _AUTOPLAY_BLOCK_PATTERNS =
    /^\/(puzzles?|analysis|study|training|practice|learn|editor|insights|openings?|coordinate|drill)(\/|$)/i;
  function isAutoplayBlockedPage() {
    try {
      return _AUTOPLAY_BLOCK_PATTERNS.test(location.pathname || "");
    } catch (_) {
      return false;
    }
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

    // ─── v2.1: Bağlam tespiti ───
    const fenNow = typeof readBoardFEN === "function" ? readBoardFEN() : "";
    const phase = _materialPhase(fenNow);
    const forcedReason = _isForcedMove(moves);
    const ponderHit = !forcedReason && _isPonderHit(moves);
    const surprise = !forcedReason && _isOpponentSurprise(moves);
    const critical = !forcedReason && _isCriticalPosition(moves, complexity);

    // ─── Zaman kontrolüne göre temel gecikme (Lognormal merkezleri) ───
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

    // ─── v2.1: Materyal fazı modülasyonu ───
    if (phase === "endgame") {
      meanDelay *= 0.65;
      stdDev *= 0.7;
    } else if (phase === "lategame") {
      meanDelay *= 0.85;
    } else if (phase === "opening" && moveCounter > 6) {
      meanDelay *= 0.9;
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

    // ─── v2.1: Bağlamsal süre düzenlemeleri ───
    if (forcedReason) {
      meanDelay = 250 + Math.random() * 350;
      stdDev = 140;
    } else if (ponderHit) {
      meanDelay *= 0.45;
      stdDev *= 0.6;
    } else if (critical) {
      meanDelay *= 2.6;
      stdDev *= 1.6;
    } else if (surprise) {
      meanDelay += 800 + Math.random() * 1200;
      stdDev *= 1.2;
    }

    // ─── Düşünme spike'ları (her 6-12 hamlede uzun düşünme) ───
    if (
      !forcedReason &&
      moveCounter > 3 &&
      moveCounter % (6 + Math.floor(Math.random() * 7)) === 0
    ) {
      meanDelay *= 2.2;
      stdDev *= 1.5;
    }

    // ─── Premove simülasyonu (bazen anında oyna) ───
    // v2.1.2: eşik gevşetildi + ponder-hit'te şans artırıldı
    let premoveActive = false;
    if (!forcedReason && complexity <= 0.25) {
      const premoveChance = ponderHit ? 0.55 : 0.18;
      if (Math.random() < premoveChance) {
        meanDelay = 120 + Math.random() * 280; // 120-400ms
        stdDev = 70;
        premoveActive = true;
      }
    }

    // ─── v2.1: Lognormal örnekleme (insan dağılımı) ───
    const sigmaLog = Math.max(
      0.18,
      Math.min(0.6, stdDev / Math.max(150, meanDelay)),
    );
    let delay = lognormalRandom(meanDelay, sigmaLog);

    // ─── v2.1: Auto-correlation ───
    // v2.1.2: forced ve premove'da auto-correlation atlanır
    if (!forcedReason && !premoveActive) {
      delay = 0.75 * delay + 0.25 * _ab_lastThinkTime;
    }
    _ab_lastThinkTime = delay;

    delay = Math.max(forcedReason ? 180 : 100, Math.round(delay));

    // ─── v2.1.1: Erken oyunda katı tavan (lichess ilk-hamle abort koruması) ───
    if (moveCounter === 0) delay = Math.min(delay, 4000);
    else if (moveCounter <= 2) delay = Math.min(delay, 5500);
    else if (moveCounter <= 4) delay = Math.min(delay, 7500);

    // ─── v2.1: Zaman bütçesi farkındalığı ───
    if (remaining < 999) {
      const expectedRemainingMoves = Math.max(20, 60 - moveCounter);
      const avgBudget = (remaining * 1000) / expectedRemainingMoves;
      delay = Math.min(delay, avgBudget * 2.5);
      delay = Math.min(delay, remaining * 400);
    }

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
        // v2.1: cache for next-call ponder/surprise detection
        _ab_lastEval = parseScore(moves[worstIdx].score);
        _ab_lastTopMove = moves[0].move;
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

    // v2.1: cache for next-call ponder/surprise detection
    _ab_lastEval = parseScore(moves[chosenIdx].score);
    _ab_lastTopMove = moves[0].move;
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
        txt.includes("time out") ||
        txt.includes("abort") ||
        txt.includes("flagged")
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
    // Method 1: result-wrap score notation (most reliable)
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
      // Method 2: status keywords inside result-wrap
      const statusText = (resultWrap.textContent || "").toLowerCase();
      const keywords = [
        "checkmate",
        "resign",
        "time out",
        "timeout",
        "draw",
        "stalemate",
        "wins",
        "aborted",
        "victorious",
        "flagged",
      ];
      if (keywords.some((kw) => statusText.includes(kw))) return true;
    }
    // Method 3: rresult element (Lichess round result)
    const rresult = document.querySelector(".rresult");
    if (rresult && rresult.textContent.trim()) return true;
    // Method 4: Rematch / New game links visible (means game is over)
    const rematch = document.querySelector(
      'a[href*="rematch"], form[action*="rematch"] button, .result__your-side a, .result__your-side button',
    );
    if (rematch && rematch.offsetParent !== null) return true;
    // Method 5: round__result / game__result div
    const roundResult = document.querySelector(".round__result, .game__result");
    if (roundResult && roundResult.offsetParent !== null) return true;
    return false;
  }

  function detectAndReportGameEnd() {
    if (Date.now() - lastGameEndDetected < 30000) return;
    if (!isGameEndDetected()) return;

    lastGameEndDetected = Date.now();

    // Faz 6B: show coach game summary modal once per game
    try {
      if (coachMode) showCoachGameSummary();
    } catch (_) {}

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
      recentMoveRanks = []; // 8C: yeni oyunda top-1 takibini sıfırla
      lastFen = "";

      // Lichess: Rematch butonuna tıkla, yoksa lobby'e git
      // Modern Lichess uses <a href="/GAMEID/rematch-of"> or form[action*="rematch"]
      const rematchBtn = document.querySelector(
        'a[href*="/rematch-of"], a[href*="rematch"], form[action*="rematch"] button, .result__your-side a.fbt, .result__your-side a',
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
    // Try lobby pool buttons first (if we're already on lobby page)
    const poolBtns = document.querySelectorAll(
      ".lobby__app [data-pool-id], .lobby__app .hook__btn, .lobby__start button",
    );
    if (poolBtns.length > 0) {
      const randomPool = poolBtns[Math.floor(Math.random() * poolBtns.length)];
      randomPool.click();
      updateStatus(t("searchingGame"), "working");
    } else {
      // Navigate to lichess lobby — append ?autoplay=1 to avoid redirect issues
      window.location.href = "https://lichess.org/";
      updateStatus(t("redirectLobby"), "working");
    }
    setTimeout(() => resetForNewGame(), 5000);
  }

  function resetForNewGame() {
    lastGameEndDetected = 0; // Reset cooldown so next game end can be detected
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

    // 8C-2: Decoy mouse hover — ~%30 olasılıkla ana hamleden önce
    // başka bir kareye fareyi götür (insan göz gezdirir gibi).
    let baseDelay = 0;
    if (Math.random() < 0.3) {
      const decoyCol = 1 + Math.floor(Math.random() * 8);
      const decoyRow = 1 + Math.floor(Math.random() * 8);
      const decoy = sqToClientXY(decoyCol, decoyRow);
      try {
        document.dispatchEvent(
          new MouseEvent("mousemove", {
            ...evtOpts,
            clientX: decoy.x,
            clientY: decoy.y,
          }),
        );
      } catch (_) {}
      baseDelay = 90 + Math.floor(Math.random() * 220);
    }

    // 1. mousedown: kaynak kareye bas (baseDelay ile geciktirilebilir)
    setTimeout(() => {
      boardEl.dispatchEvent(
        new MouseEvent("mousedown", {
          ...evtOpts,
          clientX: from.x,
          clientY: from.y,
          buttons: 1,
        }),
      );
    }, baseDelay);

    // 2. Bezier eğrisi boyunca adım adım sürükle
    let totalDelay = baseDelay + 30 + Math.floor(Math.random() * 30);
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
        const promoChar = uci[4];
        const promoMap = {
          q: "queen",
          r: "rook",
          b: "bishop",
          n: "knight",
        };
        const promoRole = promoMap[promoChar] || "queen";
        // 50ms aralıklarla 3 sn boyunca terfi seçicisini ara
        const start = Date.now();
        const poller = setInterval(() => {
          const candidates = [
            `#promotion-choice piece.${promoRole}`,
            `#promotion-choice .${promoRole}`,
            `square.cg-promotion piece.${promoRole}`,
            `.promotion-choice piece.${promoRole}`,
            `cg-container square.cg-promotion piece.${promoRole}`,
            // Yeni lichess: promotion choice butonları
            `#promotion-choice [data-piece='${promoChar}']`,
          ];
          let promoPiece = null;
          for (const sel of candidates) {
            try {
              promoPiece = document.querySelector(sel);
              if (promoPiece) break;
            } catch (_) {}
          }
          if (promoPiece) {
            clearInterval(poller);
            try {
              const r = promoPiece.getBoundingClientRect();
              const cx = r.left + r.width / 2;
              const cy = r.top + r.height / 2;
              const opts = {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                clientX: cx,
                clientY: cy,
              };
              promoPiece.dispatchEvent(new PointerEvent("pointerdown", opts));
              promoPiece.dispatchEvent(new MouseEvent("mousedown", opts));
              promoPiece.dispatchEvent(new PointerEvent("pointerup", opts));
              promoPiece.dispatchEvent(new MouseEvent("mouseup", opts));
              promoPiece.dispatchEvent(new MouseEvent("click", opts));
            } catch (_) {}
            updateStatus(
              t("movePlayed", uci) +
                " (terfi: " +
                promoChar.toUpperCase() +
                ")",
              "success",
            );
          } else if (Date.now() - start > 3000) {
            clearInterval(poller);
            updateStatus("⚠ Terfi menüsü bulunamadı", "warn");
          }
        }, 50);
      } else {
        updateStatus(t("movePlayed", uci), "success");
      }
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
  _stealthState.cleanup = function () {
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

  // ─── Faz 11: Streamer / Phone Companion Module ───────────
  function refreshStreamButton() {
    if (!panelEl) return;
    const btn = panelEl.querySelector(".taktik-stream-btn");
    if (!btn) return;
    btn.style.display = isGuest ? "none" : "";
    btn.classList.remove("is-active", "is-connecting", "is-locked");
    btn.textContent = "📡";
    if (!isStreamer) {
      btn.classList.add("is-locked");
      btn.title =
        "📡 Phone Companion — Streamer membership required (click for details)";
      return;
    }
    if (streamWs && streamWs.readyState === 1) {
      btn.classList.add("is-active");
      btn.title = "Phone companion active (click to stop)";
    } else if (streamSession) {
      btn.classList.add("is-connecting");
      btn.title = "Connecting…";
    } else {
      btn.title = "Start phone companion";
    }
  }

  async function openStreamModal() {
    if (!isStreamer) {
      showStreamerPaywall();
      return;
    }
    if (streamSession) {
      showStreamModalUI();
      return;
    }
    const apiBase = await new Promise((res) => {
      chrome.storage.local.get("taktik_api_base", (r) =>
        res(r.taktik_api_base || "https://forksight.net"),
      );
    });
    const token = await new Promise((res) => {
      chrome.storage.local.get("taktik_token", (r) =>
        res(r.taktik_token || ""),
      );
    });
    if (!token) {
      alert("Önce giriş yapın");
      return;
    }
    try {
      const r = await fetch(apiBase + "/stream/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert("Stream başlatılamadı: " + (err.detail || r.status));
        return;
      }
      const data = await r.json();
      streamSession = { ...data, api_base: apiBase, token };
      persistStreamSession(streamSession);
      openStreamWs();
      showStreamModalUI();
      refreshStreamButton();
    } catch (e) {
      alert("Sunucuya ulaşılamadı: " + e.message);
    }
  }

  function persistStreamSession(sess) {
    try {
      if (sess) {
        chrome.storage.local.set({ taktik_stream_session: sess });
      } else {
        chrome.storage.local.remove("taktik_stream_session");
      }
    } catch (e) {}
  }

  // Sayfa yenilemesi / oyun değişimi sonrası açık session varsa publisher olarak yeniden bağlan.
  async function tryRehydrateStream() {
    if (!isStreamer || isGuest) return;
    if (streamSession && streamWs && streamWs.readyState === 1) return;
    let apiBase = "https://forksight.net";
    let token = "";
    try {
      const r = await new Promise((res) =>
        chrome.storage.local.get(["taktik_api_base", "taktik_token"], res),
      );
      apiBase = r.taktik_api_base || apiBase;
      token = r.taktik_token || "";
    } catch (e) {}
    if (!token) return;
    try {
      const resp = await fetch(apiBase + "/stream/active", {
        method: "GET",
        headers: { Authorization: "Bearer " + token },
      });
      if (!resp.ok) {
        persistStreamSession(null);
        return;
      }
      const data = await resp.json();
      if (!data.active) {
        persistStreamSession(null);
        return;
      }
      streamSession = {
        session_id: data.session_id,
        pin: data.pin,
        qr_url: data.qr_url,
        expires_in: Math.max(0, (data.expires_at || 0) - Date.now() / 1000),
        api_base: apiBase,
        token,
      };
      persistStreamSession(streamSession);
      openStreamWs();
      refreshStreamButton();
    } catch (e) {
      /* sessiz: sunucu kapalı olabilir */
    }
  }

  function showStreamerPaywall() {
    const old = document.getElementById("taktik-streamer-paywall");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.id = "taktik-streamer-paywall";
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.78);backdrop-filter:blur(8px);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;padding:16px;";
    const mailTo =
      "mailto:mertcanyigit54@outlook.com?subject=" +
      encodeURIComponent("ForkSight Streamer Membership Request") +
      "&body=" +
      encodeURIComponent(
        "Hi,\n\nI'd like to get a ForkSight Streamer membership.\n\nPlan: (Monthly $5 / Lifetime $33)\nUsername: \nPayment preference: \n\nThanks.",
      );
    wrap.innerHTML = `
      <div style="background:#0f1422;border:1px solid #2a3142;border-radius:18px;padding:24px;max-width:440px;width:100%;color:#e8edf5;box-shadow:0 20px 60px rgba(0,0,0,.6);">
        <div style="text-align:center;font-size:34px;line-height:1;margin-bottom:6px;">📡</div>
        <div style="text-align:center;font-size:18px;font-weight:700;margin-bottom:4px;color:#FBBF24;">STREAMER MEMBERSHIP REQUIRED</div>
        <div style="text-align:center;font-size:12px;color:#9aa5b6;margin-bottom:16px;line-height:1.55;">
          The <b>Phone Companion</b> feature lets you mirror your desktop ForkSight
          analysis to your phone via QR code. The board, top 3 best-move arrows,
          depth and evaluation data stream live to your phone &mdash; without
          screen sharing, one device per session.
        </div>
        <div style="display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;">
          <div style="flex:1;min-width:170px;background:#1a2030;border:1px solid #2a3142;border-radius:12px;padding:14px;text-align:center;">
            <div style="font-size:11px;color:#9aa5b6;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Monthly</div>
            <div style="font-size:24px;font-weight:800;color:#fff;">$5<span style="font-size:12px;font-weight:500;color:#9aa5b6;">/mo</span></div>
            <div style="font-size:11px;color:#6b7585;margin-top:4px;">Renews every month</div>
          </div>
          <div style="flex:1;min-width:170px;background:linear-gradient(135deg,#1a2030,#1e2a40);border:1px solid #FBBF24;border-radius:12px;padding:14px;text-align:center;position:relative;">
            <div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#FBBF24;color:#0f1422;font-size:9px;font-weight:800;padding:2px 8px;border-radius:6px;letter-spacing:.06em;">MOST POPULAR</div>
            <div style="font-size:11px;color:#FBBF24;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;">Lifetime</div>
            <div style="font-size:24px;font-weight:800;color:#fff;">$33</div>
            <div style="font-size:11px;color:#6b7585;margin-top:4px;">One-time, forever</div>
          </div>
        </div>
        <a id="taktikPaywallBuy" href="https://github.com/sponsors/mrtcnygt0" target="_blank" rel="noopener"
           style="display:block;text-align:center;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#1a1a2e;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:800;margin-bottom:8px;cursor:pointer;box-shadow:0 4px 20px rgba(255,215,0,0.25);">
          🚀 Sponsor / Get Streamer
        </a>
        <div style="display:flex;gap:12px;justify-content:center;margin-bottom:12px;">
          <a href="https://mertcanyigit.com" target="_blank" rel="noopener" style="color:#6688aa;font-size:12px;text-decoration:none;">🌐 mertcanyigit.com</a>
          <a href="${mailTo}" style="color:#6688aa;font-size:12px;text-decoration:none;">✉ Contact</a>
        </div>
        <button id="taktikPaywallClose" style="background:transparent;color:#9aa5b6;border:1px solid #2a3142;padding:8px 18px;border-radius:10px;cursor:pointer;width:100%;font-size:12px;">Close</button>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById("taktikPaywallClose").onclick = () => wrap.remove();
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) wrap.remove();
    });
  }

  function showStreamModalUI() {
    if (!streamSession) return;
    const old = document.getElementById("taktik-stream-modal");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.id = "taktik-stream-modal";
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,.75);backdrop-filter:blur(8px);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;";
    const qrSrc =
      streamSession.api_base +
      "/stream/qr/" +
      encodeURIComponent(streamSession.session_id) +
      ".svg";
    wrap.innerHTML = `
      <div style="background:#1a1f2e;border:1px solid #2a3142;border-radius:18px;padding:24px;max-width:380px;width:90%;color:#e8edf5;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6);">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px;">📡 Telefon Companion</div>
        <div style="font-size:12px;color:#9aa5b6;margin-bottom:14px;line-height:1.5;">Telefonunuzla aşağıdaki QR'ı okutun.<br/>Tek cihaz, tek oturum.</div>
        <div style="background:#fff;border-radius:14px;padding:14px;display:inline-block;margin-bottom:12px;">
          <img src="${qrSrc}" alt="QR" style="display:block;width:220px;height:220px;" />
        </div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:24px;letter-spacing:.4em;font-weight:700;color:#ffd86b;margin:6px 0 14px;">${streamSession.pin}</div>
        <div style="font-size:11px;color:#6b7585;margin-bottom:14px;word-break:break-all;">${streamSession.qr_url}</div>
        <div id="taktikStreamStatus" style="font-size:12px;color:#9aa5b6;margin-bottom:14px;">${streamWs && streamWs.readyState === 1 ? "✓ Yayın aktif" : "Bağlantı bekleniyor…"}</div>
        <button id="taktikStreamStop" style="background:#ef4444;color:#fff;border:none;padding:10px 18px;border-radius:10px;font-weight:600;cursor:pointer;width:100%;margin-bottom:8px;">Yayını Durdur</button>
        <button id="taktikStreamClose" style="background:transparent;color:#9aa5b6;border:1px solid #2a3142;padding:8px 18px;border-radius:10px;cursor:pointer;width:100%;font-size:12px;">Kapat (yayın açık kalır)</button>
      </div>`;
    document.body.appendChild(wrap);
    document.getElementById("taktikStreamStop").onclick = () => {
      closeStreamSession(true);
      wrap.remove();
    };
    document.getElementById("taktikStreamClose").onclick = () => wrap.remove();
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) wrap.remove();
    });
  }

  function openStreamWs() {
    if (!streamSession) return;
    if (streamWs) {
      try {
        streamWs.close();
      } catch (e) {}
    }
    const apiBase = streamSession.api_base;
    const wsBase = apiBase.replace(/^http/, "ws");
    const url = `${wsBase}/ws/stream/${encodeURIComponent(streamSession.session_id)}?role=publisher&token=${encodeURIComponent(streamSession.token)}`;
    try {
      streamWs = new WebSocket(url);
    } catch (e) {
      return;
    }
    streamWs.onopen = () => {
      streamReconnectAttempts = 0;
      streamLastPongAt = Date.now();
      streamPingTimer = setInterval(() => {
        if (!streamWs || streamWs.readyState !== 1) return;
        try {
          streamWs.send(JSON.stringify({ type: "ping" }));
        } catch (e) {}
        if (Date.now() - streamLastPongAt > 30000) {
          try {
            streamWs.close();
          } catch (e) {}
        }
      }, 8000);
      try {
        streamPushFromMoves(window.__taktikLastMoves || null);
      } catch (e) {}
      refreshStreamButton();
      const s = document.getElementById("taktikStreamStatus");
      if (s) s.textContent = "✓ Yayın aktif (telefon bağlanmayı bekliyor)";
    };
    streamWs.onmessage = (ev) => {
      let m;
      try {
        m = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      handleStreamMessage(m);
    };
    streamWs.onclose = () => {
      if (streamPingTimer) {
        clearInterval(streamPingTimer);
        streamPingTimer = null;
      }
      streamWs = null;
      refreshStreamButton();
      if (streamSession) {
        streamReconnectAttempts++;
        const delay = Math.min(
          1500 * Math.pow(1.5, streamReconnectAttempts),
          15000,
        );
        setTimeout(() => {
          if (streamSession) openStreamWs();
        }, delay);
      }
    };
    streamWs.onerror = () => {};
  }

  function handleStreamMessage(m) {
    const s = document.getElementById("taktikStreamStatus");
    if (m.type === "pong") {
      streamLastPongAt = Date.now();
      return;
    }
    if (m.type === "ready") {
      if (s)
        s.textContent = m.subscriber_present
          ? "📱 Telefon bağlı"
          : "✓ Yayın aktif (telefon bekleniyor)";
      return;
    }
    if (m.type === "subscriber_joined") {
      if (s) s.textContent = "📱 Telefon bağlandı";
      return;
    }
    if (m.type === "subscriber_left") {
      if (s) s.textContent = "Telefon ayrıldı";
      return;
    }
    if (m.type === "error") {
      if (s) s.textContent = "Hata: " + (m.error || "?");
      if (
        ["streamer_required", "auth_failed", "session_not_found"].includes(
          m.error,
        )
      ) {
        closeStreamSession(false);
      }
      return;
    }
    if (m.type === "settings_update") {
      applyRemoteSetting(m.key, m.value);
      return;
    }
  }

  function applyRemoteSetting(key, value) {
    try {
      if (key === "depth") {
        const v = Math.max(5, Math.min(25, parseInt(value, 10) || 18));
        settings.depth = v;
        const sl = panelEl && panelEl.querySelector(".taktik-depth");
        const lab = panelEl && panelEl.querySelector(".taktik-depth-val");
        if (sl) sl.value = v;
        if (lab) lab.textContent = v;
      } else if (key === "multipv") {
        const v = Math.max(1, Math.min(5, parseInt(value, 10) || 3));
        settings.multipv = v;
        const sel = panelEl && panelEl.querySelector(".taktik-mpv");
        if (sel) sel.value = String(v);
      } else if (key === "auto") {
        const tg = panelEl && panelEl.querySelector(".taktik-auto-toggle");
        if (tg) {
          tg.checked = !!value;
          tg.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else if (key === "mode") {
        const autoTg = panelEl && panelEl.querySelector(".taktik-auto-toggle");
        const apTg =
          panelEl && panelEl.querySelector(".taktik-autoplay-toggle");
        if (value === "manual") {
          if (autoTg && autoTg.checked) {
            autoTg.checked = false;
            autoTg.dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (apTg && apTg.checked) {
            apTg.checked = false;
            apTg.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (value === "auto") {
          if (apTg && apTg.checked) {
            apTg.checked = false;
            apTg.dispatchEvent(new Event("change", { bubbles: true }));
          }
          if (autoTg && !autoTg.checked) {
            autoTg.checked = true;
            autoTg.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } else if (value === "autoplay") {
          if (apTg && !apTg.checked) {
            apTg.checked = true;
            apTg.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }
    } catch (e) {}
  }

  function parseScoreSafe(s) {
    if (typeof s !== "string") return 0;
    if (s.startsWith("M")) return s.includes("-") ? -99 : 99;
    const v = parseFloat(s);
    return isNaN(v) ? 0 : v;
  }

  function streamPushFromMoves(moves) {
    if (moves && moves.length) window.__taktikLastMoves = moves;
    if (!streamWs || streamWs.readyState !== 1) return;
    const useMoves = moves || window.__taktikLastMoves;
    if (!useMoves || !useMoves.length) return;
    let fen = "";
    try {
      fen = typeof readBoardFEN === "function" ? readBoardFEN() || "" : "";
    } catch (e) {}
    const best_moves = useMoves.slice(0, 5).map((m) => ({
      move: (m.pv_uci && m.pv_uci[0]) || m.move || "",
      san:
        (m.pv_san && m.pv_san[0]) || m.san || (m.pv_uci && m.pv_uci[0]) || "",
      eval: parseScoreSafe(m.score),
    }));
    const evalNum = parseScoreSafe(useMoves[0].score);
    let orientation = "white";
    try {
      // Birden fazla DOM sinyaline bak \u2014 lichess s\u00fcr\u00fcm\u00fc/sayfaya g\u00f6re de\u011fi\u015fiyor.
      const cg = document.querySelector(
        ".cg-wrap, cg-container, .cg-board-wrap",
      );
      if (cg) {
        const cls = cg.className || "";
        if (/orientation-black|orientation\s*=\s*"?black"?/i.test(cls)) {
          orientation = "black";
        } else {
          // Bazen ana cg-wrap yerine alt cg-board-wrap class al\u0131r
          const inner = cg.querySelector(
            ".cg-wrap.orientation-black, .orientation-black",
          );
          if (inner) orientation = "black";
        }
      }
      if (orientation === "white" && typeof getPlayerColor === "function") {
        if (getPlayerColor() === "b") orientation = "black";
      }
    } catch (e) {}
    const state = {
      fen,
      orientation,
      eval: evalNum,
      best_moves,
      depth: settings.depth,
      multipv: settings.multipv,
      auto: !!(typeof autoMode !== "undefined" && autoMode),
      lang: typeof currentLang === "string" && currentLang ? currentLang : "en",
      mode:
        typeof autoPlayEnabled !== "undefined" && autoPlayEnabled
          ? "autoplay"
          : typeof autoMode !== "undefined" && autoMode
            ? "auto"
            : "manual",
    };
    const now = Date.now();
    if (now - streamLastSendAt < 200) {
      streamPendingState = state;
      if (!streamPushTimer) {
        streamPushTimer = setTimeout(() => {
          streamPushTimer = null;
          const p = streamPendingState;
          streamPendingState = null;
          if (p && streamWs && streamWs.readyState === 1) {
            try {
              streamWs.send(JSON.stringify({ type: "state", data: p }));
              streamLastSendAt = Date.now();
            } catch (e) {}
          }
        }, 220);
      }
      return;
    }
    streamLastSendAt = now;
    try {
      streamWs.send(JSON.stringify({ type: "state", data: state }));
    } catch (e) {}
  }

  function closeStreamSession(notifyServer) {
    const sess = streamSession;
    streamSession = null;
    persistStreamSession(null);
    if (streamPingTimer) {
      clearInterval(streamPingTimer);
      streamPingTimer = null;
    }
    if (streamWs) {
      try {
        streamWs.close();
      } catch (e) {}
      streamWs = null;
    }
    refreshStreamButton();
    if (notifyServer && sess) {
      try {
        fetch(sess.api_base + "/stream/stop", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + sess.token,
          },
          body: JSON.stringify({ session_id: sess.session_id }),
        }).catch(() => {});
      } catch (e) {}
    }
  }

  function softCloseStreamOnUnload() {
    if (streamPingTimer) {
      clearInterval(streamPingTimer);
      streamPingTimer = null;
    }
    if (streamWs) {
      try {
        streamWs.close();
      } catch (e) {}
      streamWs = null;
    }
  }

  window.addEventListener("pagehide", softCloseStreamOnUnload);
})();
