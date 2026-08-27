/**
 * Per-coach narration personality packs (TR + EN).
 * Used by coach-review.js (analysis) and profile-panel.js (quiz TTS).
 *
 * Personalities:
 *   tilki    — playful tactics fox (legacy default tone)
 *   victoria — composed strategist, plans & structure
 *   boris    — blunt honesty, no sugar-coating
 *   kai      — calculation / precision focus
 *   lena     — energetic motivator
 */
(function () {
  const EMOTION = {
    blunder: "mistake",
    mistake: "worried",
    inaccuracy: "neutral",
    solid: "neutral",
    best: "neutral",
    good: "winning",
    great: "winning",
    brilliant: "happy",
    mateThreat: "opportunity",
    book: "neutral",
  };

  function L(self, opp, neutral) {
    return { self: self, opp: opp, neutral: neutral };
  }

  function pack(cats) {
    const out = {};
    for (const key of Object.keys(cats)) {
      out[key] = { emotion: EMOTION[key] || "neutral", lines: cats[key] };
    }
    return out;
  }

  // ── Tilki (current / legacy voice) ───────────────────────────────────
  const TILKI_TR = pack({
    blunder: L(
      [
        "Tüh, burası ağır bir hata.",
        "Bu hamle pozisyonu ciddi şekilde bozdu.",
        "Burada büyük bir fırsat kaçırdın — değerlendirme keskin düştü.",
      ],
      [
        "Rakibin burada ağır bir hata yaptı — değerlendirme senin lehine döndü.",
        "Bu rakibin için büyük bir gaf; avantajı sana hediye etti.",
        "Rakibinden affedilmez bir hamle geldi.",
      ],
      [
        "Ciddi bir hata — pozisyon belirgin biçimde bozuldu.",
        "Büyük bir gaf; değerlendirme keskin düştü.",
        "Affedilmez bir kayıp; çok daha güçlü bir seçenek vardı.",
      ],
    ),
    mistake: L(
      [
        "Burada bir hata var.",
        "Bu hamle değerlendirmeni düşürdü.",
        "Daha keskin bir hamle vardı.",
      ],
      [
        "Rakibinden zayıf bir hamle — değerlendirme sana döndü.",
        "Rakibin burada bir hata yaptı.",
        "Rakibin daha sağlam bir seçeneği kaçırdı.",
      ],
      ["Hata; pozisyon kötüleşti.", "Daha iyisi mümkündü.", "İdeal değil; daha sağlam bir seçenek vardı."],
    ),
    inaccuracy: L(
      [
        "Küçük bir yanlışlık — büyük zarar yok ama daha keskini vardı.",
        "Hafif konum kaybı; pozisyon hâlâ oynanabilir.",
        "Ufak bir kayma; pozisyonu hâlâ kontrol edebilirsin.",
      ],
      [
        "Rakibinden ufak bir yanlışlık — sana küçük bir fırsat doğdu.",
        "Rakibin hafif bir konum kaybetti.",
        "Rakibin tam isabeti bulamadı.",
      ],
      [
        "Küçük bir yanlışlık — büyük zarar yok.",
        "Hafif konum kaybı; pozisyon hâlâ oynanabilir.",
        "İdeal değil ama dengeyi bozmadı.",
      ],
    ),
    solid: L(
      ["Sağlam, makul bir hamle.", "Pozisyonu koruyan iyi bir tercih.", "Dengeyi sürdüren bir hamle."],
      [
        "Rakibinden sağlam bir hamle.",
        "Rakibin pozisyonunu koruyan makul bir tercih.",
        "Rakibin dengeyi sürdürüyor.",
      ],
      ["Sağlam, makul bir hamle.", "Pozisyonu koruyan bir tercih.", "Dengeyi sürdüren bir hamle."],
    ),
    best: L(
      [
        "En iyi hamle — motorla aynı seçimi yaptın.",
        "Tam isabet; bundan daha iyisi yoktu.",
        "Doğru tercih, pozisyonu en iyi şekilde sürdürdün.",
      ],
      [
        "Rakibin en iyi hamleyi buldu — motorla aynı seçim.",
        "Rakibinden tam isabet; bundan daha iyisi yoktu.",
        "Rakibin doğru tercihi yaptı, pozisyonunu en iyi şekilde sürdürdü.",
      ],
      [
        "En iyi hamle — motorla aynı seçim.",
        "Tam isabet; bundan daha iyisi yoktu.",
        "Doğru tercih, pozisyonu en iyi şekilde sürdürüyor.",
      ],
    ),
    good: L(
      [
        "Güzel hamle — değerlendirme lehine döndü.",
        "İyi seçim; küçük bir avantaj kazandın.",
        "Etkili bir hamle; pozisyonun biraz daha rahatladı.",
      ],
      [
        "Rakibinden güzel bir hamle — değerlendirme onun lehine döndü.",
        "Rakibin iyi seçim yaptı; küçük bir avantaj kazandı.",
        "Etkili bir hamle; rakibinin pozisyonu biraz daha rahatladı.",
      ],
      [
        "Güzel hamle — değerlendirme lehine döndü.",
        "İyi seçim; küçük bir avantaj kazanıldı.",
        "Etkili bir hamle; pozisyon biraz daha rahatladı.",
      ],
    ),
    great: L(
      [
        "Çok iyi bir hamle — pozisyon belirgin biçimde lehine döndü.",
        "Harika seçim, rakibine ciddi sorun çıkardın.",
        "Güçlü bir tercih; avantajın gözle görülür şekilde büyüdü.",
      ],
      [
        "Rakibinden çok iyi bir hamle — pozisyon onun lehine döndü.",
        "Rakibin harika bir seçim yaptı; sana ciddi sorun çıkardı.",
        "Rakibinden güçlü bir tercih; avantajı gözle görülür şekilde büyüdü.",
      ],
      [
        "Çok iyi bir hamle — pozisyon belirgin biçimde döndü.",
        "Harika seçim; rakibe ciddi sorun çıkardı.",
        "Güçlü bir tercih; avantaj gözle görülür şekilde büyüdü.",
      ],
    ),
    brilliant: L(
      [
        "Mükemmel! Değerlendirme net biçimde lehine döndü.",
        "Çok güçlü bir hamle yaptın — pozisyon büyük ölçüde kazanıyor.",
        "Harika tercih; rakibine ciddi sorun bıraktın.",
      ],
      [
        "Rakibin mükemmel oynadı — değerlendirme onun lehine net biçimde döndü.",
        "Rakibinden çok güçlü bir hamle; pozisyon onun için büyük ölçüde kazanıyor.",
        "Rakibinin harika bir tercihi; sana ciddi bir sorun bıraktı.",
      ],
      [
        "Mükemmel! Değerlendirme net biçimde döndü.",
        "Çok güçlü bir hamle — pozisyon büyük ölçüde kazançlı.",
        "Harika tercih; rakibe ciddi bir sorun bıraktı.",
      ],
    ),
    mateThreat: L(
      ["Şah-mat tehdidi belirdi — fırsatı kollamalısın.", "Burada mat ufukta; dikkatli oyna."],
      ["Rakibin mat tehdidi kuruyor — dikkatli olmalısın!", "Rakibin mat hattını arıyor; uyanık ol."],
      ["Şah-mat tehdidi belirdi.", "Burada mat ufukta — dikkat!"],
    ),
    book: L(
      ["Açılış teorisi — bilinen hatlardan birini oynadın.", "Bilindik bir açılış hamlesi."],
      ["Rakibin açılış teorisinden oynadı — bilinen bir hat.", "Bilindik bir açılış hamlesi rakibinden."],
      ["Açılış teorisi — bilinen hatlardan biri.", "Bilindik bir açılış hamlesi."],
    ),
  });

  const TILKI_EN = pack({
    blunder: L(
      [
        "That was a serious mistake — your position took a clear hit.",
        "You blundered; the evaluation dropped sharply.",
        "Unforgiveable loss here; a much stronger option was available.",
      ],
      [
        "Your opponent blundered — their position is clearly worse now.",
        "A blunder from your opponent; the evaluation swung sharply in your favor.",
        "An unforgiveable loss for your opponent — the advantage is yours.",
      ],
      [
        "A serious mistake — the position deteriorated clearly.",
        "A blunder; the evaluation dropped sharply.",
        "An unforgiveable loss; a much stronger option was available.",
      ],
    ),
    mistake: L(
      [
        "You made a mistake; your position got worse.",
        "Better was possible — this move lowered your evaluation.",
        "Not ideal; a more solid option was on the table.",
      ],
      [
        "Your opponent made a mistake; their position got worse.",
        "A weak move from your opponent — the evaluation swung your way.",
        "Not ideal for your opponent; they had a more solid option.",
      ],
      [
        "A mistake; the position deteriorated.",
        "Better was possible — this move lowered the evaluation.",
        "Not ideal; a more solid option was available.",
      ],
    ),
    inaccuracy: L(
      [
        "A small inaccuracy — no big damage, but something sharper was there.",
        "A slight loss of ground; the position is still playable.",
        "Not ideal but you didn't disturb the balance.",
      ],
      [
        "A small inaccuracy from your opponent — a tiny chance opened up for you.",
        "Your opponent lost a bit of ground; still roughly balanced.",
        "Your opponent's move wasn't ideal but didn't disturb the balance.",
      ],
      [
        "A small inaccuracy — no big damage.",
        "A slight loss of ground; the position is still playable.",
        "Not ideal but balance was preserved.",
      ],
    ),
    solid: L(
      ["A solid, reasonable move.", "A good choice that holds the position.", "A move that keeps the balance."],
      [
        "A solid move from your opponent.",
        "A reasonable choice that keeps your opponent's position together.",
        "Your opponent holds the balance.",
      ],
      ["A solid, reasonable move.", "A choice that holds the position.", "A move that keeps the balance."],
    ),
    best: L(
      [
        "Best move — you matched the engine's choice.",
        "Spot on; nothing was better.",
        "Right call — you handled the position optimally.",
      ],
      [
        "Your opponent found the best move — same as the engine.",
        "Spot on from your opponent; nothing was better.",
        "Your opponent made the right call and handled the position optimally.",
      ],
      ["Best move — same as the engine.", "Spot on; nothing was better.", "The right call; the position is held optimally."],
    ),
    good: L(
      [
        "Nice move — the evaluation swung your way.",
        "Good choice; you picked up a small edge.",
        "Effective move; your position eased up a bit.",
      ],
      [
        "Nice move from your opponent — the evaluation swung their way.",
        "Your opponent picked a good move; they got a small edge.",
        "An effective move; your opponent's position eased up a bit.",
      ],
      ["Nice move — the evaluation shifted.", "Good choice; a small edge was gained.", "An effective move; the position eased up."],
    ),
    great: L(
      [
        "Excellent move — the position clearly swung your way.",
        "Great choice — you handed your opponent serious problems.",
        "A strong call; your advantage grew visibly.",
      ],
      [
        "An excellent move from your opponent — the position swung their way.",
        "A great choice from your opponent; they handed you serious problems.",
        "A strong call from your opponent; their advantage grew visibly.",
      ],
      [
        "An excellent move — the position clearly turned.",
        "A great choice; serious problems for the opponent.",
        "A strong call; the advantage grew visibly.",
      ],
    ),
    brilliant: L(
      [
        "Brilliant! The evaluation clearly swung your way.",
        "A very strong move — the position is largely winning.",
        "A great choice; you've left your opponent in serious trouble.",
      ],
      [
        "Your opponent played brilliantly — the evaluation clearly swung their way.",
        "A very strong move from your opponent; the position is largely winning for them.",
        "A great choice from your opponent; they've left you in serious trouble.",
      ],
      [
        "Brilliant! The evaluation clearly turned.",
        "A very strong move — the position is largely winning.",
        "A great choice; serious trouble for the other side.",
      ],
    ),
    mateThreat: L(
      ["A mate threat appeared — watch for the chance.", "Mate is on the horizon here; play carefully."],
      ["Your opponent is building a mate threat — be careful!", "Your opponent is looking for a mating line; stay alert."],
      ["A mate threat appeared.", "Mate is on the horizon — careful!"],
    ),
    book: L(
      ["Opening theory — you played one of the known lines.", "A well-known opening move."],
      ["Your opponent played opening theory — a known line.", "A well-known opening move from your opponent."],
      ["Opening theory — one of the known lines.", "A well-known opening move."],
    ),
  });

  // ── Victoria — strategist ────────────────────────────────────────────
  const VICTORIA_TR = pack({
    blunder: L(
      [
        "Bu hamle planını kökünden bozdu — yapı çöktü.",
        "Stratejik bir kırılma: avantajını tek hamlede bıraktın.",
        "Burada uzun vadeli planın dağıldı; yeniden kurmak zorundayız.",
      ],
      [
        "Rakibin planı çöktü — senin için net bir stratejik fırsat doğdu.",
        "Rakibin yapısal bir hata yaptı; inisiyatif artık sende.",
        "Rakibin uzun vadeli fikrini kendi eliyle bozdu.",
      ],
      ["Ciddi bir stratejik kırılma.", "Plan dağıldı; pozisyon bozuldu.", "Yapısal bir çöküş."],
    ),
    mistake: L(
      [
        "Planın buradan sapıyor — daha temiz bir hat vardı.",
        "Bu tercih yapısal dengeyi zayıflattı.",
        "Stratejik olarak daha tutarlı bir hamle seçilebilirdi.",
      ],
      [
        "Rakibin planında bir gedik açıldı.",
        "Rakibin stratejik olarak yanlış yön seçti.",
        "Rakibin yapısını zayıflatan bir tercih yaptı.",
      ],
      ["Plan sapması.", "Daha tutarlı bir hat mümkündü.", "Stratejik denge bozuldu."],
    ),
    inaccuracy: L(
      [
        "Küçük bir sapma — planın hâlâ ayakta, ama daha temiz bir yol vardı.",
        "Hafif bir yapısal kayıp; yeniden hizalanabilirsin.",
        "İnce ayar kaçtı; büyük resim bozulmadı.",
      ],
      [
        "Rakibin planında ufak bir çatlak — değerlendir.",
        "Rakibin hafif yapısal kayıp verdi.",
        "Rakibin en temiz hattı kaçırdı.",
      ],
      ["Küçük sapma.", "Hafif yapısal kayıp.", "Plan hâlâ toparlanabilir."],
    ),
    solid: L(
      ["Temiz ve planlı bir hamle.", "Yapıyı koruyan olgun bir tercih.", "Stratejik dengeni sürdürdün."],
      ["Rakibin planını koruyan sağlam bir hamle.", "Rakibin yapısını muhafaza ediyor.", "Rakibin dengeli ilerliyor."],
      ["Planlı ve sağlam.", "Yapıyı koruyan tercih.", "Stratejik denge."],
    ),
    best: L(
      [
        "En doğru plan hamlesi — tam istediğim gibi.",
        "Stratejik isabet; pozisyonu en temiz şekilde taşıdın.",
        "Planınla motor aynı satırda — çok iyi.",
      ],
      [
        "Rakibin en temiz plan hamlesini buldu.",
        "Rakibin stratejik olarak isabetli oynadı.",
        "Rakibin planını en iyi şekilde sürdürdü.",
      ],
      ["En temiz plan hamlesi.", "Stratejik isabet.", "Plan doğru işliyor."],
    ),
    good: L(
      [
        "İyi bir plan adımı — inisiyatif hafifçe sende.",
        "Yapıyı lehine çeviren zarif bir tercih.",
        "Stratejik küçük bir kazanç; devam et.",
      ],
      [
        "Rakibin planını ilerletti — dikkat.",
        "Rakibin yapısal bir avantaj aldı.",
        "Rakibin inisiyatifi biraz aldı.",
      ],
      ["İyi plan adımı.", "Yapısal küçük kazanç.", "İnisiyatif kaydı."],
    ),
    great: L(
      [
        "Güçlü stratejik darbe — rakibin planı zorlanıyor.",
        "Çok temiz bir plan hamlesi; avantajın netleşti.",
        "Uzun vadeli fikrin burada meyve verdi.",
      ],
      [
        "Rakibin güçlü bir plan hamlesi yaptı.",
        "Rakibin stratejik olarak seni zorladı.",
        "Rakibin uzun vadeli fikri işliyor — karşı plan şart.",
      ],
      ["Güçlü stratejik darbe.", "Plan meyve verdi.", "Avantaj netleşti."],
    ),
    brilliant: L(
      [
        "Müthiş plan! Pozisyon senin senaryona girdi.",
        "Stratejik bir şaheser — rakibin fikri çöktü.",
        "Bu hamleyle bütün tahtayı kendi planına bağladın.",
      ],
      [
        "Rakibin planı mükemmel işledi — senaryo onlarda.",
        "Rakibinden stratejik bir şaheser.",
        "Rakibin bütün tahtayı kendi fikrine bağladı.",
      ],
      ["Müthiş plan.", "Stratejik şaheser.", "Senaryo değişti."],
    ),
    mateThreat: L(
      ["Mat tehdidi planın parçası olabilir — netleştir.", "Burada mat fikri doğdu; soğukkanlı ilerle."],
      ["Rakibin mat planı kuruyor — savunma planını netleştir!", "Rakibin mat fikri var; yapısal savunma şart."],
      ["Mat tehdidi belirdi.", "Mat planı ufukta."],
    ),
    book: L(
      ["Teorik hat — sağlam bir plan temeli attın.", "Bilinen açılış planlarından biri."],
      ["Rakibin teorik bir hat seçti.", "Rakibin bilinen bir açılış planında."],
      ["Teorik hat.", "Bilinen açılış planı."],
    ),
  });

  const VICTORIA_EN = pack({
    blunder: L(
      [
        "That move shattered your plan — the structure collapsed.",
        "A strategic break: you gave away the advantage in one move.",
        "Your long-term idea fell apart here; we rebuild from scratch.",
      ],
      [
        "Your opponent's plan collapsed — a clear strategic chance for you.",
        "A structural error from your opponent; initiative is yours.",
        "They wrecked their own long-term idea.",
      ],
      ["A serious strategic break.", "The plan collapsed.", "A structural collapse."],
    ),
    mistake: L(
      [
        "Your plan drifts here — a cleaner line existed.",
        "This choice weakened your structure.",
        "A more consistent strategic move was available.",
      ],
      [
        "A crack opened in your opponent's plan.",
        "Your opponent chose the wrong strategic direction.",
        "They weakened their own structure.",
      ],
      ["Plan drift.", "A more consistent line existed.", "Strategic balance slipped."],
    ),
    inaccuracy: L(
      [
        "A slight drift — plan intact, but a cleaner path was there.",
        "Mild structural loss; you can realign.",
        "Fine-tuning missed; the big picture holds.",
      ],
      [
        "A small crack in your opponent's plan — note it.",
        "Your opponent gave a mild structural concession.",
        "They missed the cleanest line.",
      ],
      ["Slight drift.", "Mild structural loss.", "The plan can recover."],
    ),
    solid: L(
      ["Clean, planned move.", "A mature choice that holds the structure.", "You kept your strategic balance."],
      ["A solid move that protects their plan.", "Your opponent preserves structure.", "They progress in balance."],
      ["Planned and solid.", "Structure held.", "Strategic balance."],
    ),
    best: L(
      [
        "The right plan move — exactly what I wanted.",
        "Strategic precision; you carried the position cleanly.",
        "Your plan matched the engine line — excellent.",
      ],
      [
        "Your opponent found the cleanest plan move.",
        "Strategically precise from your opponent.",
        "They carried their plan optimally.",
      ],
      ["Cleanest plan move.", "Strategic precision.", "The plan is working."],
    ),
    good: L(
      [
        "Good plan step — initiative leans your way.",
        "An elegant choice that tips the structure your way.",
        "A small strategic gain; keep going.",
      ],
      [
        "Your opponent advanced their plan — careful.",
        "They gained a structural edge.",
        "Initiative tipped slightly toward them.",
      ],
      ["Good plan step.", "Small structural gain.", "Initiative shifted."],
    ),
    great: L(
      [
        "Strong strategic blow — their plan is under pressure.",
        "A very clean plan move; your edge clarified.",
        "Your long-term idea paid off here.",
      ],
      [
        "A strong plan move from your opponent.",
        "They pressed you strategically.",
        "Their long-term idea is working — you need a counter-plan.",
      ],
      ["Strong strategic blow.", "The plan paid off.", "The edge clarified."],
    ),
    brilliant: L(
      [
        "Superb planning! The position entered your scenario.",
        "A strategic masterpiece — their idea collapsed.",
        "You tied the whole board to your plan with this move.",
      ],
      [
        "Your opponent's plan worked perfectly — their scenario now.",
        "A strategic masterpiece from your opponent.",
        "They tied the whole board to their idea.",
      ],
      ["Superb planning.", "Strategic masterpiece.", "The scenario flipped."],
    ),
    mateThreat: L(
      ["A mate threat may fit your plan — clarify it.", "A mating idea appeared; stay composed."],
      ["Your opponent is building a mate plan — firm up defense!", "They have a mating idea; structural defense needed."],
      ["A mate threat appeared.", "A mate plan is on the horizon."],
    ),
    book: L(
      ["Theoretical line — a solid plan foundation.", "One of the known opening plans."],
      ["Your opponent chose a theoretical line.", "They're in a known opening plan."],
      ["Theoretical line.", "Known opening plan."],
    ),
  });

  // ── Boris — blunt honesty ────────────────────────────────────────────
  const BORIS_TR = pack({
    blunder: L(
      [
        "Açık söyleyeyim: bu bir gaf. Pozisyonun çöktü.",
        "Affetmem — burada çok kötü oynadın.",
        "Bu hamleyle oyunu kendi elinle zorlaştırdın.",
      ],
      [
        "Rakibin gaf yaptı. Merhamet yok — cezalandır.",
        "Rakibin affedilmez bir hata verdi; kullan.",
        "Rakibin kendini gömdü. Fırsat sende.",
      ],
      ["Gaf. Net.", "Pozisyon çöktü.", "Affedilmez hata."],
    ),
    mistake: L(
      [
        "Hata. Daha iyisini görmedin.",
        "Zayıf hamle — bunu kendine yedirtme.",
        "Burada gevşedin. Sert ol.",
      ],
      [
        "Rakibin hata yaptı. Merhamet gösterme.",
        "Rakibin zayıf kaldı — sıkıştır.",
        "Rakibin yanlış seçti. Cezalandır.",
      ],
      ["Hata.", "Zayıf hamle.", "Daha iyisi vardı."],
    ),
    inaccuracy: L(
      [
        "İdeal değil. Küçük ama gereksiz bir kayıp.",
        "Hafif gevşeklik — alışkanlık olmasın.",
        "Tam isabet değil. Daha net oynayabilirdin.",
      ],
      [
        "Rakibin ufak kaçırdı. Not et.",
        "Rakibin gevşedi — küçük fırsat.",
        "Rakibin tam isabet bulamadı.",
      ],
      ["İdeal değil.", "Küçük kayıp.", "Daha neti vardı."],
    ),
    solid: L(
      ["İdare eder. Sağlam.", "Kabul edilebilir — abartma.", "Dengeli. Devam."],
      ["Rakibin sağlam duruyor.", "Rakibin idare eder bir hamle yaptı.", "Rakibin dengeyi korudu."],
      ["Sağlam.", "İdare eder.", "Denge."],
    ),
    best: L(
      [
        "Doğru. Başka laf yok.",
        "En iyisi bu — böyle devam.",
        "İsabet. Motor da bunu isterdi.",
      ],
      [
        "Rakibin en iyisini buldu. Saygı duy, ama ezilme.",
        "Rakibin doğru oynadı.",
        "Rakibin isabetli — gevşeme.",
      ],
      ["Doğru hamle.", "En iyisi.", "İsabet."],
    ),
    good: L(
      [
        "İyi. Avantajı aldın — sıkı tut.",
        "Güzel hamle. Abartmadan devam.",
        "İşine yaradı. Böyle sert kal.",
      ],
      [
        "Rakibin iyi vurdu. Toparlan.",
        "Rakibin avantaj aldı — uyanık ol.",
        "Rakibin işini gördü. Sertleş.",
      ],
      ["İyi hamle.", "Avantaj kaydı.", "İşe yaradı."],
    ),
    great: L(
      [
        "Güçlü. Rakibini köşeye sıkıştırdın.",
        "İşte bu — gerçek baskı.",
        "Sert ve doğru. Avantaj büyüdü.",
      ],
      [
        "Rakibin sert vurdu. Savun.",
        "Rakibin seni sıkıştırdı — boş verme.",
        "Rakibinden güçlü hamle. Dayan.",
      ],
      ["Güçlü hamle.", "Sert baskı.", "Avantaj büyüdü."],
    ),
    brilliant: L(
      [
        "Bravo. Bu seviyede oynarsan kimse seni hafife alamaz.",
        "Mükemmel darbe — rakibin bitiyor.",
        "İşte gerçek güç. Böyle devam et.",
      ],
      [
        "Rakibin mükemmel vurdu. Gerçekçi ol — zor durumdasın.",
        "Rakibinden acımasız bir hamle.",
        "Rakibin seni köşeye sıkıştırdı. Diren.",
      ],
      ["Mükemmel darbe.", "Acımasız isabet.", "Oyun döndü."],
    ),
    mateThreat: L(
      ["Mat tehdidi var. Bitir veya öl.", "Mat kapıda — net ol!"],
      ["Rakibin mat arıyor. Uyan!", "Mat tehdidi — savun, yoksa biter."],
      ["Mat tehdidi.", "Mat kapıda."],
    ),
    book: L(
      ["Teori. Temel doğru — şimdi düşünmeye başla.", "Bilinen hat. Ezbere güvenme."],
      ["Rakibin teoriden geliyor.", "Rakibin bilinen hatta."],
      ["Teori.", "Bilinen hat."],
    ),
  });

  const BORIS_EN = pack({
    blunder: L(
      [
        "I'll be blunt: that was a blunder. Your position collapsed.",
        "No excuses — you played terribly here.",
        "You made the game harder for yourself with that move.",
      ],
      [
        "Your opponent blundered. No mercy — punish it.",
        "An unforgivable error from them; use it.",
        "They buried themselves. Chance is yours.",
      ],
      ["Blunder. Clear.", "Position collapsed.", "Unforgivable error."],
    ),
    mistake: L(
      [
        "Mistake. You missed something better.",
        "Weak move — don't let this become habit.",
        "You went soft here. Stay hard.",
      ],
      [
        "Your opponent erred. Show no mercy.",
        "They went weak — squeeze.",
        "Wrong choice from them. Punish it.",
      ],
      ["Mistake.", "Weak move.", "Better existed."],
    ),
    inaccuracy: L(
      [
        "Not ideal. Small but unnecessary loss.",
        "Slight looseness — don't make it a habit.",
        "Not precise. You could have been cleaner.",
      ],
      [
        "They missed slightly. Note it.",
        "Opponent loosened up — small chance.",
        "They weren't precise.",
      ],
      ["Not ideal.", "Small loss.", "Cleaner existed."],
    ),
    solid: L(
      ["Acceptable. Solid.", "Fine — don't overrate it.", "Balanced. Continue."],
      ["Opponent is solid.", "An acceptable move from them.", "They hold the balance."],
      ["Solid.", "Acceptable.", "Balance."],
    ),
    best: L(
      ["Correct. Nothing else to say.", "Best — keep doing that.", "Spot on. Engine would approve."],
      [
        "Opponent found the best. Respect it, don't fold.",
        "They played correctly.",
        "Accurate from them — stay sharp.",
      ],
      ["Correct move.", "Best.", "Spot on."],
    ),
    good: L(
      [
        "Good. You took the edge — hold it.",
        "Nice move. Continue without drama.",
        "It worked. Stay tough.",
      ],
      [
        "Opponent hit well. Recover.",
        "They took an edge — wake up.",
        "They got what they wanted. Toughen up.",
      ],
      ["Good move.", "Edge shifted.", "It worked."],
    ),
    great: L(
      [
        "Strong. You cornered them.",
        "That's real pressure.",
        "Hard and correct. Advantage grew.",
      ],
      [
        "Opponent hit hard. Defend.",
        "They squeezed you — don't give up.",
        "Strong move from them. Endure.",
      ],
      ["Strong move.", "Hard pressure.", "Advantage grew."],
    ),
    brilliant: L(
      [
        "Bravo. Play like this and no one underestimates you.",
        "Perfect strike — they're finished.",
        "That's real power. Keep it up.",
      ],
      [
        "Opponent struck perfectly. Be realistic — you're in trouble.",
        "A ruthless move from them.",
        "They cornered you. Resist.",
      ],
      ["Perfect strike.", "Ruthless accuracy.", "Game flipped."],
    ),
    mateThreat: L(
      ["Mate threat. Finish it or die.", "Mate is at the door — be clear!"],
      ["Opponent is hunting mate. Wake up!", "Mate threat — defend or it's over."],
      ["Mate threat.", "Mate at the door."],
    ),
    book: L(
      ["Theory. Foundation is fine — now start thinking.", "Known line. Don't trust memory alone."],
      ["Opponent comes from theory.", "They're on a known line."],
      ["Theory.", "Known line."],
    ),
  });

  // ── Kai — calculation ────────────────────────────────────────────────
  const KAI_TR = pack({
    blunder: L(
      [
        "Hesap kırıldı — kritik bir ara hamleyi kaçırdın.",
        "Derinlik yetmedi; varyant burada çöktü.",
        "Bu hamle hesap ağacındaki en kötü yaprak.",
      ],
      [
        "Rakibin hesabı çöktü — varyant senin lehine.",
        "Rakibin kritik ara hamleyi kaçırdı.",
        "Rakibin hesap derinliği burada yetersiz kaldı.",
      ],
      ["Hesap kırıldı.", "Varyant çöktü.", "Kritik ara kaçtı."],
    ),
    mistake: L(
      [
        "Hesapta bir düğüm atlandı — daha derin bakılmalıydı.",
        "Bu satırın devamı zayıf; alternatif hesap et.",
        "Kısa hesap hatası — bir tempo daha say.",
      ],
      [
        "Rakibin hesabında gedik var.",
        "Rakibin varyantı eksik bıraktı.",
        "Rakibin derinliği yetmedi.",
      ],
      ["Hesap hatası.", "Varyant eksik.", "Daha derin bakılmalıydı."],
    ),
    inaccuracy: L(
      [
        "Neredeyse doğru — ama bir ara hamle daha temizdi.",
        "Hesap iyiydi, seçim biraz yüzeysel kaldı.",
        "Küçük bir hesap sapması; düzeltilebilir.",
      ],
      [
        "Rakibin hesabı neredeyse tuttu — küçük sapma.",
        "Rakibin bir ara hamleyi kaçırdı.",
        "Rakibin seçimi biraz yüzeysel.",
      ],
      ["Küçük hesap sapması.", "Neredeyse doğru.", "Daha temiz ara vardı."],
    ),
    solid: L(
      ["Hesabı tutan sağlam hamle.", "Güvenli satır — varyant kontrol altında.", "Doğru derinlik, doğru tempo."],
      ["Rakibin hesabı tutuyor.", "Rakibin güvenli satırda.", "Rakibin temposu doğru."],
      ["Hesap tutuyor.", "Güvenli satır.", "Tempo doğru."],
    ),
    best: L(
      [
        "En doğru hesap — bu satırın zirvesi.",
        "Tam derinlik; alternatif yoktu.",
        "Hesap ağacında en iyi yaprak bu.",
      ],
      [
        "Rakibin en doğru hesabı buldu.",
        "Rakibin derinliği isabetli.",
        "Rakibin en iyi satırı seçti.",
      ],
      ["En doğru hesap.", "Tam derinlik.", "En iyi satır."],
    ),
    good: L(
      [
        "İyi hesap — değerlendirme lehine kaydı.",
        "Doğru satır seçimi; küçük net kazanç.",
        "Derinlik işe yaradı.",
      ],
      [
        "Rakibin iyi hesapladı — dikkat.",
        "Rakibin doğru satırı buldu.",
        "Rakibin derinliği avantaj getirdi.",
      ],
      ["İyi hesap.", "Doğru satır.", "Derinlik kazandırdı."],
    ),
    great: L(
      [
        "Derin ve isabetli — rakibin varyantı bozuldu.",
        "Güçlü hesap; avantaj netleşti.",
        "Kritik ara hamleyi doğru gördün.",
      ],
      [
        "Rakibin derin hesap yaptı.",
        "Rakibin kritik arayı gördü.",
        "Rakibin varyantı seni zorluyor.",
      ],
      ["Derin isabet.", "Kritik ara bulundu.", "Avantaj netleşti."],
    ),
    brilliant: L(
      [
        "Mükemmel hesap zinciri — pozisyon çözüldü.",
        "Bu satırı sonuna kadar doğru gördün.",
        "Hesap ustalığı; rakibin cevabı kalmadı.",
      ],
      [
        "Rakibin hesap zinciri mükemmel.",
        "Rakibin satırı sonuna kadar gördü.",
        "Rakibin hesabı seni çözdü — diren.",
      ],
      ["Mükemmel hesap zinciri.", "Satır çözüldü.", "Hesap ustalığı."],
    ),
    mateThreat: L(
      ["Mat varyantı doğdu — satırı sonuna kadar hesapla.", "Mat tehdidi: her ara hamleyi say."],
      ["Rakibin mat satırını hesaplıyor — savunmayı derinleştir!", "Mat tehdidi; ara hamleleri kaçırma."],
      ["Mat varyantı.", "Mat satırı aktif."],
    ),
    book: L(
      ["Teorik satır — şimdi kendi hesabın başlıyor.", "Bilinen hamle; derinlik buradan sonra kritik."],
      ["Rakibin teorik satırda.", "Rakibin bilinen hatta — hesap yakında başlar."],
      ["Teorik satır.", "Bilinen hamle."],
    ),
  });

  const KAI_EN = pack({
    blunder: L(
      [
        "Calculation broke — you missed a critical in-between move.",
        "Not deep enough; the line collapsed here.",
        "This is the worst leaf in the calculation tree.",
      ],
      [
        "Opponent's calculation collapsed — line favors you.",
        "They missed a critical in-between move.",
        "Their calculation depth failed here.",
      ],
      ["Calculation broke.", "Line collapsed.", "Critical in-between missed."],
    ),
    mistake: L(
      [
        "A node skipped in the calc — needed more depth.",
        "This line's continuation is weak; compute alternatives.",
        "Short-calc error — count one more tempo.",
      ],
      [
        "A gap in your opponent's calculation.",
        "They left the line incomplete.",
        "Their depth wasn't enough.",
      ],
      ["Calc error.", "Incomplete line.", "Needed more depth."],
    ),
    inaccuracy: L(
      [
        "Almost right — but one cleaner in-between existed.",
        "Calc was fine; the choice was a bit shallow.",
        "Small calc drift; recoverable.",
      ],
      [
        "Opponent's calc nearly held — slight drift.",
        "They missed an in-between move.",
        "Their choice was a bit shallow.",
      ],
      ["Small calc drift.", "Almost right.", "Cleaner in-between existed."],
    ),
    solid: L(
      ["Solid move that holds the calc.", "Safe line — variation under control.", "Right depth, right tempo."],
      ["Opponent's calc holds.", "They're on a safe line.", "Their tempo is correct."],
      ["Calc holds.", "Safe line.", "Tempo correct."],
    ),
    best: L(
      [
        "Best calculation — peak of this line.",
        "Full depth; no alternative.",
        "Best leaf in the tree.",
      ],
      [
        "Opponent found the best calculation.",
        "Accurate depth from them.",
        "They chose the best line.",
      ],
      ["Best calculation.", "Full depth.", "Best line."],
    ),
    good: L(
      [
        "Good calc — evaluation tipped your way.",
        "Right line choice; small clean gain.",
        "Depth paid off.",
      ],
      [
        "Opponent calculated well — careful.",
        "They found the right line.",
        "Their depth earned an edge.",
      ],
      ["Good calc.", "Right line.", "Depth paid off."],
    ),
    great: L(
      [
        "Deep and accurate — their line broke.",
        "Strong calculation; edge clarified.",
        "You saw the critical in-between.",
      ],
      [
        "Opponent calculated deeply.",
        "They saw the critical in-between.",
        "Their line is pressuring you.",
      ],
      ["Deep accuracy.", "Critical in-between found.", "Edge clarified."],
    ),
    brilliant: L(
      [
        "Perfect calculation chain — position solved.",
        "You saw this line all the way through.",
        "Calculation mastery; no answer left for them.",
      ],
      [
        "Opponent's calculation chain is perfect.",
        "They saw the line to the end.",
        "Their calc solved you — resist.",
      ],
      ["Perfect calc chain.", "Line solved.", "Calculation mastery."],
    ),
    mateThreat: L(
      ["A mate line appeared — calculate it to the end.", "Mate threat: count every in-between."],
      ["Opponent is calculating a mate line — deepen defense!", "Mate threat; don't miss in-betweens."],
      ["Mate variation.", "Mate line active."],
    ),
    book: L(
      ["Theoretical line — your own calc starts now.", "Known move; depth matters after this."],
      ["Opponent is on a theoretical line.", "Known line — calc starts soon."],
      ["Theoretical line.", "Known move."],
    ),
  });

  // ── Lena — motivator ─────────────────────────────────────────────────
  const LENA_TR = pack({
    blunder: L(
      [
        "Olur böyleleri — nefes al, buradan öğrenip güçleneceğiz!",
        "Bu hamle ağır geldi ama vazgeçmek yok. Kalkıyoruz.",
        "Tamam, canım yandı. Şimdi aynı hatayı bir daha yapmayacağız.",
      ],
      [
        "Rakibin tökezledi — bu senin anın, hadi!",
        "Rakibin büyük kaçırdı; fırsatı kaçırma!",
        "Rakibin düştü — sen yüksel!",
      ],
      ["Ağır hata — ama oyun bitmedi.", "Tökezleme.", "Öğrenme anı."],
    ),
    mistake: L(
      [
        "Küçük bir düşüş — moral bozma, toparlanırız!",
        "Hata oldu; bir sonraki hamlede daha keskin olacağız.",
        "Tamam, not aldık. Devam, sen güçlüsün!",
      ],
      [
        "Rakibin hata yaptı — senin turın!",
        "Rakibin gevşedi; enerjiyi sen al!",
        "Fırsat doğdu — hadi kullan!",
      ],
      ["Hata — toparlanırız.", "Not aldık.", "Devam!"],
    ),
    inaccuracy: L(
      [
        "Neredeyse! Bir tık daha net olabiliriz.",
        "Küçük kayma — tempo bozulmasın, devam!",
        "İyi niyetli hamle, biraz daha isabet gelecek.",
      ],
      [
        "Rakibin ufak kaçırdı — uyanık ol!",
        "Küçük fırsat — enerjiyi koru.",
        "Rakibin tam isabeti kaçırdı.",
      ],
      ["Neredeyse!", "Küçük kayma.", "Tempo koru."],
    ),
    solid: L(
      ["Güzel ve sakin — böyle istikrar!", "Sağlam adım; ritmini seviyorum.", "Dengeli oynuyorsun, aferin!"],
      ["Rakibin sağlam duruyor — sen de ritmini bozma.", "Rakibin dengeli.", "Rakibin sakin ilerliyor."],
      ["Sağlam adım.", "İstikrar.", "Denge iyi."],
    ),
    best: L(
      [
        "İşte bu! En iyisi — enerjiyi hissettim!",
        "Tam isabet, süper! Böyle devam!",
        "Doğru seçim — koç olarak gurur duydum!",
      ],
      [
        "Rakibin en iyisini buldu — sen de yükselt seviyeyi!",
        "Rakibin isabetli; motivasyonunu kaybetme!",
        "Rakibin güçlü — sen daha güçlüsün, göster!",
      ],
      ["İşte bu!", "Tam isabet!", "En iyisi!"],
    ),
    good: L(
      [
        "Güzel gidiş! Avantaj sana bakıyor — gülümse!",
        "İyi hamle, momentum sende!",
        "Evet! Küçük kazanımlar birikir.",
      ],
      [
        "Rakibin iyi vurdu — toparlan, sen de vur!",
        "Rakibin momentum aldı; sen de yakala!",
        "Rakibin güzel oynadı — seviye atla!",
      ],
      ["Güzel gidiş!", "Momentum!", "Küçük kazanım!"],
    ),
    great: L(
      [
        "Vay canına! Bu hamleyle sahneyi aldın!",
        "Harika enerji — rakibin zor durumda!",
        "İşte kazanma alışkanlığı! Böyle devam!",
      ],
      [
        "Rakibin sahneyi aldı — sen de ateşlen!",
        "Rakibin harika vurdu; moralini yüksek tut!",
        "Rakibin güçlü — sen daha coşkulu ol!",
      ],
      ["Vay canına!", "Sahne senin!", "Kazanma alışkanlığı!"],
    ),
    brilliant: L(
      [
        "İNANILMAZ! Bu seviyede oynamaya devam et!",
        "Efsane hamle — herkes bunu konuşur!",
        "İşte yıldız anın! Gurur duydum!",
      ],
      [
        "Rakibin efsane vurdu — ama sen de yıldızsın, cevap ver!",
        "Rakibin inanılmaz oynadı; başını dik tut!",
        "Rakibin parladı — sıradaki parlama senin!",
      ],
      ["İnanılmaz!", "Efsane hamle!", "Yıldız anı!"],
    ),
    mateThreat: L(
      ["Mat kokusu var — hadi bitir bunu!", "Mat kapıda; coşkuyla ama net oyna!"],
      ["Rakibin mat arıyor — uyan, savun, geri dön!", "Mat tehdidi; panik yok, net savun!"],
      ["Mat kokusu!", "Mat kapıda!"],
    ),
    book: L(
      ["Teori tamam — şimdi kendi tarzınla parlıyoruz!", "Bilinen hamle; ritmini koru!"],
      ["Rakibin teoride — sen de hazır ol!", "Bilinen hat; enerjiyi sakla."],
      ["Teori tamam.", "Bilinen hamle."],
    ),
  });

  const LENA_EN = pack({
    blunder: L(
      [
        "It happens — breathe, we'll learn and come back stronger!",
        "That one hurt, but quitting isn't an option. We rise.",
        "Okay, that stung. We won't repeat this mistake.",
      ],
      [
        "Opponent stumbled — this is your moment, go!",
        "They missed big; don't waste the chance!",
        "They fell — you rise!",
      ],
      ["Heavy mistake — but the game isn't over.", "A stumble.", "A learning moment."],
    ),
    mistake: L(
      [
        "A small dip — don't drop morale, we recover!",
        "Mistake made; next move we play sharper.",
        "Noted. Keep going — you're strong!",
      ],
      [
        "Opponent erred — your turn!",
        "They loosened up; take the energy!",
        "Chance appeared — use it!",
      ],
      ["Mistake — we recover.", "Noted.", "Keep going!"],
    ),
    inaccuracy: L(
      [
        "Almost! We can be a touch cleaner.",
        "Slight slip — keep the tempo, go!",
        "Good intent; sharper accuracy coming.",
      ],
      [
        "Opponent missed slightly — stay alert!",
        "Small chance — keep your energy.",
        "They weren't fully precise.",
      ],
      ["Almost!", "Slight slip.", "Keep tempo."],
    ),
    solid: L(
      ["Nice and calm — love that consistency!", "Solid step; great rhythm.", "Balanced play — well done!"],
      ["Opponent is solid — keep your rhythm too.", "They're balanced.", "They progress calmly."],
      ["Solid step.", "Consistency.", "Balance is good."],
    ),
    best: L(
      [
        "That's it! Best move — I felt the energy!",
        "Spot on, super! Keep it up!",
        "Right call — proud of you as your coach!",
      ],
      [
        "Opponent found the best — raise your level too!",
        "Accurate from them; don't lose motivation!",
        "They're strong — you're stronger, show it!",
      ],
      ["That's it!", "Spot on!", "Best!"],
    ),
    good: L(
      [
        "Nice flow! Edge looks your way — smile!",
        "Good move, momentum is yours!",
        "Yes! Small wins stack up.",
      ],
      [
        "Opponent hit well — recover and hit back!",
        "They took momentum; catch it!",
        "Nice play from them — level up!",
      ],
      ["Nice flow!", "Momentum!", "Small win!"],
    ),
    great: L(
      [
        "Wow! You took the stage with that move!",
        "Amazing energy — they're in trouble!",
        "That's a winning habit! Keep going!",
      ],
      [
        "Opponent took the stage — fire up!",
        "They hit great; keep morale high!",
        "They're strong — be even more fired up!",
      ],
      ["Wow!", "Stage is yours!", "Winning habit!"],
    ),
    brilliant: L(
      [
        "INCREDIBLE! Keep playing at this level!",
        "Legendary move — people will talk about this!",
        "That's your star moment! So proud!",
      ],
      [
        "Opponent went legendary — but you're a star too, answer!",
        "Incredible from them; keep your head high!",
        "They shone — next shine is yours!",
      ],
      ["Incredible!", "Legendary move!", "Star moment!"],
    ),
    mateThreat: L(
      ["Mate is in the air — finish this!", "Mate at the door; play with energy and clarity!"],
      ["Opponent is hunting mate — wake up, defend, come back!", "Mate threat; no panic, defend clean!"],
      ["Mate in the air!", "Mate at the door!"],
    ),
    book: L(
      ["Theory done — now we shine in your style!", "Known move; keep the rhythm!"],
      ["Opponent is in theory — stay ready!", "Known line; save your energy."],
      ["Theory done.", "Known move."],
    ),
  });


  // ── Şero — street-cat tough love (ForkSight original) ───────────────
  const SERO_TR = pack({
    blunder: L(
      [
        "Ulan bu ne? Ağır gaf — pozisyonun çöktü.",
        "Sokakta böyle oynarsan yerler seni. Büyük hata.",
        "Affetmem bunu. Tek hamlede oyunu zorlaştırdın.",
      ],
      [
        "Rakibin gaf yaptı. Merhamet yok — cezalandır.",
        "Rakibin kendini gömdü. Fırsat sende, kaçırma.",
        "Rakibinden affedilmez hata. Sokak kuralı: vur.",
      ],
      ["Ağır gaf.", "Pozisyon çöktü.", "Affedilmez hata."],
    ),
    mistake: L(
      [
        "Hata. Daha iyisini görmedin — uyan.",
        "Zayıf hamle. Sokakta gevşeyen kaybeder.",
        "Burada yumuşadın. Sertleş.",
      ],
      [
        "Rakibin hata yaptı. Sıkıştır.",
        "Rakibin gevşedi — affetme.",
        "Rakibin yanlış seçti. Cezalandır.",
      ],
      ["Hata.", "Zayıf hamle.", "Daha iyisi vardı."],
    ),
    inaccuracy: L(
      [
        "İdeal değil. Küçük ama gereksiz — alışkanlık yapma.",
        "Hafif kayma. Temiz oyna, lafa gerek yok.",
        "Neredeyse… ama tam isabet değil.",
      ],
      [
        "Rakibin ufak kaçırdı. Not et.",
        "Rakibin gevşedi — küçük fırsat.",
        "Rakibin tam isabeti bulamadı.",
      ],
      ["İdeal değil.", "Küçük kayma.", "Daha temizi vardı."],
    ),
    solid: L(
      ["İdare eder. Sağlam dur.", "Kabul. Abartma, devam.", "Dengeli. Sokak da bunu ister."],
      ["Rakibin sağlam duruyor.", "Rakibin idare eder bir hamle yaptı.", "Rakibin dengeyi korudu."],
      ["Sağlam.", "İdare eder.", "Denge."],
    ),
    best: L(
      [
        "İşte bu. Doğru hamle — başka laf yok.",
        "En iyisi bu. Böyle oyna, kimse seni yemez.",
        "İsabet. Motor da bunu isterdi, ben de.",
      ],
      [
        "Rakibin en iyisini buldu. Saygı duy, ama ezilme.",
        "Rakibin doğru oynadı — uyanık kal.",
        "Rakibin isabetli. Gevşeme.",
      ],
      ["Doğru hamle.", "En iyisi.", "İsabet."],
    ),
    good: L(
      [
        "İyi. Avantajı aldın — sıkı tut.",
        "Güzel hamle. Lafı uzatmadan devam.",
        "İşine yaradı. Sert kal.",
      ],
      [
        "Rakibin iyi vurdu. Toparlan.",
        "Rakibin avantaj aldı — uyan.",
        "Rakibin işini gördü. Sertleş.",
      ],
      ["İyi hamle.", "Avantaj kaydı.", "İşe yaradı."],
    ),
    great: L(
      [
        "Güçlü. Rakibini köşeye sıkıştırdın — böyle devam.",
        "İşte sokak zekâsı. Baskı büyüdü.",
        "Sert ve doğru. Avantaj net.",
      ],
      [
        "Rakibin sert vurdu. Savun, kaçma.",
        "Rakibin seni sıkıştırdı — boş verme.",
        "Rakibinden güçlü hamle. Dayan.",
      ],
      ["Güçlü hamle.", "Sert baskı.", "Avantaj büyüdü."],
    ),
    brilliant: L(
      [
        "Vay anasını — mükemmel darbe. Böyle oyna.",
        "Efsane hamle. Sokakta da masada da bu lazım.",
        "İşte gerçek güç. Gurur duydum, azıcık.",
      ],
      [
        "Rakibin mükemmel vurdu. Gerçekçi ol — zor durumdasın.",
        "Rakibinden acımasız isabet. Diren.",
        "Rakibin seni köşeye sıkıştırdı. Kaçma, savaş.",
      ],
      ["Mükemmel darbe.", "Acımasız isabet.", "Oyun döndü."],
    ),
    mateThreat: L(
      ["Mat kokusu var. Bitir bunu — yoksa yerler seni.", "Mat kapıda. Net ol!"],
      ["Rakibin mat arıyor. Uyan, savun!", "Mat tehdidi — panik yok, sert savun."],
      ["Mat tehdidi.", "Mat kapıda."],
    ),
    book: L(
      ["Teori. Temel tamam — şimdi kendi kafanla oyna.", "Bilinen hat. Ezbere güvenme, düşün."],
      ["Rakibin teoriden geliyor.", "Rakibin bilinen hatta."],
      ["Teori.", "Bilinen hat."],
    ),
  });

  const SERO_EN = pack({
    blunder: L(
      [
        "What was that? Heavy blunder — your position collapsed.",
        "Play like that on the street and you get eaten. Big mistake.",
        "I don't forgive that. You made the game harder in one move.",
      ],
      [
        "Opponent blundered. No mercy — punish it.",
        "They buried themselves. Chance is yours — take it.",
        "Unforgivable error from them. Street rule: strike.",
      ],
      ["Heavy blunder.", "Position collapsed.", "Unforgivable error."],
    ),
    mistake: L(
      [
        "Mistake. You missed better — wake up.",
        "Weak move. Soft players lose on the street.",
        "You went soft here. Toughen up.",
      ],
      [
        "Opponent erred. Squeeze them.",
        "They loosened — don't forgive it.",
        "Wrong choice from them. Punish it.",
      ],
      ["Mistake.", "Weak move.", "Better existed."],
    ),
    inaccuracy: L(
      [
        "Not ideal. Small but unnecessary — don't make it habit.",
        "Slight slip. Play clean, no chatter.",
        "Almost… but not precise.",
      ],
      [
        "They missed slightly. Note it.",
        "Opponent loosened — small chance.",
        "They weren't fully precise.",
      ],
      ["Not ideal.", "Slight slip.", "Cleaner existed."],
    ),
    solid: L(
      ["Acceptable. Stay solid.", "Fine. Don't overrate it — continue.", "Balanced. Street wants that too."],
      ["Opponent is solid.", "An acceptable move from them.", "They hold the balance."],
      ["Solid.", "Acceptable.", "Balance."],
    ),
    best: L(
      [
        "That's it. Correct move — nothing else to say.",
        "Best. Play like this and nobody eats you.",
        "Spot on. Engine would approve — so do I.",
      ],
      [
        "Opponent found the best. Respect it, don't fold.",
        "They played correctly — stay sharp.",
        "Accurate from them. Don't go soft.",
      ],
      ["Correct move.", "Best.", "Spot on."],
    ),
    good: L(
      [
        "Good. You took the edge — hold it.",
        "Nice move. Keep going without drama.",
        "It worked. Stay tough.",
      ],
      [
        "Opponent hit well. Recover.",
        "They took an edge — wake up.",
        "They got what they wanted. Toughen up.",
      ],
      ["Good move.", "Edge shifted.", "It worked."],
    ),
    great: L(
      [
        "Strong. You cornered them — keep it up.",
        "That's street smarts. Pressure grew.",
        "Hard and correct. Edge is clear.",
      ],
      [
        "Opponent hit hard. Defend, don't run.",
        "They squeezed you — don't give up.",
        "Strong move from them. Endure.",
      ],
      ["Strong move.", "Hard pressure.", "Advantage grew."],
    ),
    brilliant: L(
      [
        "Damn — perfect strike. Play like that.",
        "Legendary move. Need that on the street and at the board.",
        "That's real power. I'm a little proud.",
      ],
      [
        "Opponent struck perfectly. Be realistic — you're in trouble.",
        "Ruthless accuracy from them. Resist.",
        "They cornered you. Don't run — fight.",
      ],
      ["Perfect strike.", "Ruthless accuracy.", "Game flipped."],
    ),
    mateThreat: L(
      ["Mate is in the air. Finish it — or get finished.", "Mate at the door. Be clear!"],
      ["Opponent is hunting mate. Wake up, defend!", "Mate threat — no panic, defend hard."],
      ["Mate threat.", "Mate at the door."],
    ),
    book: L(
      ["Theory. Foundation done — now think with your own head.", "Known line. Don't trust memory alone."],
      ["Opponent comes from theory.", "They're on a known line."],
      ["Theory.", "Known line."],
    ),
  });

  const PACKS = {
    tilki: { tr: TILKI_TR, en: TILKI_EN },
    victoria: { tr: VICTORIA_TR, en: VICTORIA_EN },
    boris: { tr: BORIS_TR, en: BORIS_EN },
    kai: { tr: KAI_TR, en: KAI_EN },
    lena: { tr: LENA_TR, en: LENA_EN },
    sero: { tr: SERO_TR, en: SERO_EN },
  };

  // Summary intro tiers: outstanding | strong | ok | tough | fallback
  const SUMMARY = {
    tilki: {
      tr: {
        outstanding: (a) =>
          "Olağanüstü bir oyun çıkardın — doğruluğun %" + a + ". Hadi hamleleri birlikte inceleyelim.",
        strong: (a) =>
          "Güzel bir performans! Doğruluğun %" + a + ". Birkaç kritik anı birlikte gözden geçirelim.",
        ok: () => "İyi iş — yine de geliştirebileceğin yerler var. İncelemeyi başlatalım.",
        tough: () => "Birkaç zorlu an olmuş; ama merak etme, her oyun öğretir. Beraber bakalım.",
        fallback: () => "Oyunu inceledim. Hazır olduğunda 'İncelemeyi Başlat' diyebilirsin.",
      },
      en: {
        outstanding: (a) =>
          "An outstanding game — your accuracy is " + a + "%. Let's look at the moves together.",
        strong: (a) =>
          "Nice performance! Your accuracy is " + a + "%. Let's review a few critical moments together.",
        ok: () => "Good job — still, there's room to improve. Let's start the review.",
        tough: () => "A few tough moments — but don't worry, every game teaches us. Let's look together.",
        fallback: () => "I've reviewed the game. When you're ready, hit 'Start Review'.",
      },
    },
    victoria: {
      tr: {
        outstanding: (a) =>
          "Planın çok temiz işledi — doğruluğun %" + a + ". Kritik anları birlikte yapılandıralım.",
        strong: (a) =>
          "Sağlam bir strateji performansı: %" + a + ". Birkaç kırılma noktasını inceleyelim.",
        ok: () => "İyi temel — planını daha tutarlı hale getirebiliriz. İncelemeye geçelim.",
        tough: () => "Plan yer yer dağıldı; sorun değil, yeniden kurarız. Beraber bakalım.",
        fallback: () => "Oyunu stratejik olarak taradım. Hazırsan incelemeyi başlatalım.",
      },
      en: {
        outstanding: (a) =>
          "Your plan ran cleanly — accuracy " + a + "%. Let's structure the critical moments together.",
        strong: (a) =>
          "Solid strategic performance at " + a + "%. Let's examine a few break points.",
        ok: () => "Good foundation — we can make your plan more consistent. Let's review.",
        tough: () => "The plan frayed in places; we'll rebuild. Let's look together.",
        fallback: () => "I've scanned the game strategically. Ready when you are to start review.",
      },
    },
    boris: {
      tr: {
        outstanding: (a) =>
          "Sert ve doğru oynadın — %" + a + ". Şimdi zayıf noktaları da göreceğiz; hazır ol.",
        strong: (a) =>
          "İyi iş: %" + a + ". Ama kusursuz değildi — hataları birlikte yüzleştireceğiz.",
        ok: () => "İdare eder. Gelişim için acı gerçeklere bakacağız. Başla.",
        tough: () => "Zayıf anlar çoktu. Kaçma — yüzleş, öğren, güçlen.",
        fallback: () => "Oyunu inceledim. Hazırsan başlıyoruz — yumuşak konuşmayacağım.",
      },
      en: {
        outstanding: (a) =>
          "Hard and correct — " + a + "%. Now we face the weak spots too; be ready.",
        strong: (a) =>
          "Decent: " + a + "%. Not flawless — we'll confront the mistakes together.",
        ok: () => "Acceptable. We'll look at hard truths to improve. Start.",
        tough: () => "Too many weak moments. Don't run — face them, learn, get stronger.",
        fallback: () => "I've reviewed it. When you're ready we begin — I won't soften it.",
      },
    },
    kai: {
      tr: {
        outstanding: (a) =>
          "Hesap derinliğin yüksek — %" + a + ". Kritik satırları satır satır açalım.",
        strong: (a) =>
          "İyi hesap performansı: %" + a + ". Birkaç düğüm noktasını birlikte çözelim.",
        ok: () => "Temel doğru — derinliği artıracak yerler var. İncelemeye geç.",
        tough: () => "Hesap yer yer kırıldı; varyantları yeniden kuracağız.",
        fallback: () => "Oyunu hesap odaklı taradım. Hazırsan incelemeyi başlat.",
      },
      en: {
        outstanding: (a) =>
          "High calculation depth — " + a + "%. Let's open the critical lines move by move.",
        strong: (a) =>
          "Solid calc performance at " + a + "%. We'll unpack a few key nodes together.",
        ok: () => "Foundation is fine — places to deepen. Start the review.",
        tough: () => "Calculation broke in places; we'll rebuild the lines.",
        fallback: () => "I've scanned the game for calculation. Ready when you start review.",
      },
    },

    sero: {
      tr: {
        outstanding: (a) =>
          "Sert ve doğru oynadın — %" + a + ". Şimdi zayıf noktaları da göreceğiz; kaçma.",
        strong: (a) =>
          "İdare eder: %" + a + ". Kusursuz değildi — hatalarla yüzleşeceğiz.",
        ok: () => "Eh işte. Gelişmek istiyorsan acı gerçeklere bakacağız. Başla.",
        tough: () => "Zayıf anlar çoktu. Kaçma — yüzleş, öğren, güçlen.",
        fallback: () => "Oyunu inceledim. Hazırsan başlıyoruz — yumuşak konuşmayacağım.",
      },
      en: {
        outstanding: (a) =>
          "Hard and correct — " + a + "%. Now we face the weak spots too; don't run.",
        strong: (a) =>
          "Decent: " + a + "%. Not flawless — we'll confront the mistakes.",
        ok: () => "Meh. If you want to improve, we look at hard truths. Start.",
        tough: () => "Too many weak moments. Don't run — face them, learn, get stronger.",
        fallback: () => "I've reviewed it. When you're ready we begin — I won't soften it.",
      },
    },
    lena: {
      tr: {
        outstanding: (a) =>
          "Harika enerji! Doğruluğun %" + a + ". Hadi en parlak anları birlikte yaşayalım!",
        strong: (a) =>
          "Süper performans — %" + a + "! Kritik anlarda seni daha da coşturacağız.",
        ok: () => "İyi iş çıkardın! Gelişim noktaları var — birlikte yükselteceğiz!",
        tough: () => "Zor anlar oldu ama moralini bozma — her oyun seni büyütür. Bakalım!",
        fallback: () => "Oyunu inceledim! Hazır olduğunda 'İncelemeyi Başlat' — yanındayım!",
      },
      en: {
        outstanding: (a) =>
          "Amazing energy! Accuracy " + a + "%. Let's relive the brightest moments!",
        strong: (a) =>
          "Super performance — " + a + "%! We'll fire you up even more on the key moments.",
        ok: () => "Good job! Growth points ahead — we'll climb them together!",
        tough: () => "Tough spots happened — don't drop morale; every game grows you. Let's look!",
        fallback: () => "I've reviewed the game! When you're ready, hit Start Review — I've got you!",
      },
    },
  };

  const HINTS = {
    // kind → { tr|en → { self|opp|neutral } }
    matWin: {
      tilki: {
        tr: { self: "Bu hamleyle malzeme kazandın.", opp: "Rakibin bu hamleyle malzeme kazandı.", neutral: "Bu hamleyle malzeme kazanıldı." },
        en: { self: "You won material with this move.", opp: "Your opponent won material with this move.", neutral: "Material was won on this move." },
      },
      victoria: {
        tr: { self: "Malzeme kazancı planını güçlendirdi.", opp: "Rakibin malzeme ile planını güçlendirdi.", neutral: "Malzeme dengesi değişti." },
        en: { self: "Material gain strengthened your plan.", opp: "Material strengthened their plan.", neutral: "Material balance shifted." },
      },
      boris: {
        tr: { self: "Malzeme aldın. Sıkı tut.", opp: "Rakibin malzeme aldı. Toparlan.", neutral: "Malzeme el değiştirdi." },
        en: { self: "You took material. Hold it.", opp: "Opponent took material. Recover.", neutral: "Material changed hands." },
      },
      kai: {
        tr: { self: "Hesap malzeme kazancı getirdi.", opp: "Rakibin hesabı malzeme getirdi.", neutral: "Malzeme hesabı sonuç verdi." },
        en: { self: "Calculation netted material.", opp: "Their calculation netted material.", neutral: "Material calculation paid off." },
      },
      lena: {
        tr: { self: "Malzeme sende — süper!", opp: "Rakibin malzeme aldı — toparlanırız!", neutral: "Malzeme el değiştirdi!" },
        en: { self: "Material is yours — super!", opp: "They took material — we'll bounce back!", neutral: "Material changed hands!" },
      },
    },
    matLoss: {
      tilki: {
        tr: { self: "Eşit olmayan bir değişim — malzeme verdin.", opp: "Rakibin için kayıplı bir değişim oldu.", neutral: "Kayıplı bir değişim." },
        en: { self: "An unequal trade — you gave up material.", opp: "A losing trade for your opponent.", neutral: "A losing trade." },
      },
      victoria: {
        tr: { self: "Malzeme kaybı planını zayıflattı.", opp: "Rakibin malzeme kaybetti — planı zayıfladı.", neutral: "Malzeme kayıplı değişim." },
        en: { self: "Material loss weakened your plan.", opp: "They lost material — plan weakened.", neutral: "A losing material trade." },
      },
      boris: {
        tr: { self: "Malzeme verdin. Pahalı hata.", opp: "Rakibin malzeme verdi. Cezalandır.", neutral: "Kayıplı değişim." },
        en: { self: "You gave material. Costly.", opp: "They gave material. Punish it.", neutral: "Losing trade." },
      },
      kai: {
        tr: { self: "Hesap kayıplı değişime götürdü.", opp: "Rakibin hesabı kayıplı değişime gitti.", neutral: "Kayıplı malzeme hesabı." },
        en: { self: "Calc led to a losing trade.", opp: "Their calc led to a losing trade.", neutral: "Losing material calc." },
      },
      lena: {
        tr: { self: "Malzeme gitti — moral bozma, telafi ederiz!", opp: "Rakibin malzeme kaybetti — fırsat!", neutral: "Kayıplı değişim — devam!" },
        en: { self: "Material gone — don't drop morale, we'll recover!", opp: "They lost material — chance!", neutral: "Losing trade — keep going!" },
      },
    },
    matEqual: {
      tilki: {
        tr: { self: "Mantıklı, denk bir taş değişimi yaptın.", opp: "Rakibin denk bir taş değişimi yaptı.", neutral: "Mantıklı, denk bir taş değişimi." },
        en: { self: "A sensible, equal trade.", opp: "Your opponent made an equal trade.", neutral: "A sensible, equal trade." },
      },
      victoria: {
        tr: { self: "Denk değişim — yapı korunuyor.", opp: "Rakibin denk değişim yaptı.", neutral: "Denk değişim." },
        en: { self: "Equal trade — structure held.", opp: "Equal trade from them.", neutral: "Equal trade." },
      },
      boris: {
        tr: { self: "Denk takas. İdare eder.", opp: "Rakibin denk takas yaptı.", neutral: "Denk takas." },
        en: { self: "Even trade. Fine.", opp: "Even trade from them.", neutral: "Even trade." },
      },
      kai: {
        tr: { self: "Denk değişim — hesap dengede.", opp: "Rakibin denk değişim seçti.", neutral: "Denk değişim." },
        en: { self: "Equal trade — calc balanced.", opp: "They chose an equal trade.", neutral: "Equal trade." },
      },
      lena: {
        tr: { self: "Denk değişim — temiz iş!", opp: "Rakibin denk değişti.", neutral: "Denk değişim!" },
        en: { self: "Equal trade — clean!", opp: "Equal trade from them.", neutral: "Equal trade!" },
      },
    },
    hung: {
      tilki: {
        tr: { self: "Bu hamleden sonra bir taşını boşta bıraktın.", opp: "Rakibin bu hamleden sonra bir taşını boşta bıraktı.", neutral: "Bu hamleden sonra bir taş savunmasız kaldı." },
        en: { self: "After this move you left a piece hanging.", opp: "After this move your opponent left a piece hanging.", neutral: "A piece was left undefended after this move." },
      },
      victoria: {
        tr: { self: "Bir taşın savunmasız kaldı — yapısal açık.", opp: "Rakibin bir taşını savunmasız bıraktı.", neutral: "Savunmasız taş." },
        en: { self: "A piece left undefended — structural hole.", opp: "They left a piece undefended.", neutral: "Undefended piece." },
      },
      boris: {
        tr: { self: "Taşını boşta bıraktın. Affetmem.", opp: "Rakibin taşını boşta bıraktı. Al.", neutral: "Boşta taş." },
        en: { self: "You left a piece hanging. No excuses.", opp: "They left a piece hanging. Take it.", neutral: "Hanging piece." },
      },
      kai: {
        tr: { self: "Hesapta savunmasız taş kaldı.", opp: "Rakibin hesabında savunmasız taş var.", neutral: "Savunmasız taş hesabı." },
        en: { self: "Calc left a piece hanging.", opp: "Their calc left a piece hanging.", neutral: "Hanging piece in the calc." },
      },
      lena: {
        tr: { self: "Taş boşta kaldı — tamam, bundan öğreniyoruz!", opp: "Rakibin taşı boşta — fırsat!", neutral: "Boşta taş — dikkat!" },
        en: { self: "Piece left hanging — okay, we learn from this!", opp: "Their piece is hanging — chance!", neutral: "Hanging piece — careful!" },
      },
    },
    exploit: {
      tilki: {
        tr: { self: "Rakibinin zayıf kaldığı bir hat buldun.", opp: "Rakibin zayıf kaldığın bir hat buldu.", neutral: "Pozisyondaki zayıf bir hat keşfedildi." },
        en: { self: "You found a line that exploited your opponent's weakness.", opp: "Your opponent found a line where you stayed weak.", neutral: "A line exploiting a weakness was found." },
      },
      victoria: {
        tr: { self: "Rakibin yapısındaki zayıf noktayı işledin.", opp: "Rakibin senin yapısal zayıflığını işledi.", neutral: "Yapısal zayıflık işlendi." },
        en: { self: "You worked their structural weakness.", opp: "They worked your structural weakness.", neutral: "A structural weakness was exploited." },
      },
      boris: {
        tr: { self: "Zayıflığı gördün ve vurdun. Doğru.", opp: "Rakibin zayıflığını gördü. Sertleş.", neutral: "Zayıflık cezalandırıldı." },
        en: { self: "You saw the weakness and hit it. Correct.", opp: "They saw your weakness. Toughen up.", neutral: "Weakness punished." },
      },
      kai: {
        tr: { self: "Zayıf hattı hesaplayıp doğru işledin.", opp: "Rakibin zayıf hattını hesapladı.", neutral: "Zayıf hat hesaplandı." },
        en: { self: "You calculated and exploited the weak line.", opp: "They calculated your weak line.", neutral: "Weak line calculated." },
      },
      lena: {
        tr: { self: "Zayıflığı buldun — harika av!", opp: "Rakibin zayıflığını buldu — toparlan!", neutral: "Zayıf hat bulundu!" },
        en: { self: "You found the weakness — great hunt!", opp: "They found your weakness — recover!", neutral: "Weak line found!" },
      },
    },
  };

  const QUIZ = {
    tilki: {
      tr: {
        correctTheme: (lbl) => "Aferin! Bu güzel bir " + lbl + " hamlesiydi.",
        correct: () => "Aferin, doğru hamle!",
        wrongSan: (san) => "Yanlış. Doğru hamle " + san + " idi.",
        wrong: () => "Yanlış. Tekrar dene.",
      },
      en: {
        correctTheme: (lbl) => "Nice! That was a sharp " + lbl + " move.",
        correct: () => "Well done, correct move!",
        wrongSan: (san) => "Wrong. The correct move was " + san + ".",
        wrong: () => "Wrong. Try again.",
      },
    },
    victoria: {
      tr: {
        correctTheme: (lbl) => "Temiz plan: güzel bir " + lbl + " hamlesi.",
        correct: () => "Doğru — planınla uyumlu bir tercih.",
        wrongSan: (san) => "Plan sapması. Doğrusu " + san + " idi.",
        wrong: () => "Bu hat planına uymuyor. Tekrar dene.",
      },
      en: {
        correctTheme: (lbl) => "Clean plan: a fine " + lbl + " move.",
        correct: () => "Correct — consistent with your plan.",
        wrongSan: (san) => "Plan drift. Correct was " + san + ".",
        wrong: () => "That line doesn't fit the plan. Try again.",
      },
    },
    boris: {
      tr: {
        correctTheme: (lbl) => "Doğru. Sert bir " + lbl + " — böyle devam.",
        correct: () => "Doğru. Başka laf yok.",
        wrongSan: (san) => "Yanlış. Doğrusu " + san + ". Kendine yedirme.",
        wrong: () => "Yanlış. Tekrar — daha keskin ol.",
      },
      en: {
        correctTheme: (lbl) => "Correct. A hard " + lbl + " — keep it up.",
        correct: () => "Correct. Nothing else to say.",
        wrongSan: (san) => "Wrong. It was " + san + ". Don't excuse it.",
        wrong: () => "Wrong. Again — be sharper.",
      },
    },
    kai: {
      tr: {
        correctTheme: (lbl) => "Hesap tuttu: doğru bir " + lbl + ".",
        correct: () => "Doğru satır — hesabın isabetli.",
        wrongSan: (san) => "Hesap kırıldı. Doğru hamle " + san + ".",
        wrong: () => "Yanlış satır. Derinliği artır, tekrar dene.",
      },
      en: {
        correctTheme: (lbl) => "Calc held: a correct " + lbl + ".",
        correct: () => "Correct line — accurate calculation.",
        wrongSan: (san) => "Calc broke. Correct move was " + san + ".",
        wrong: () => "Wrong line. Add depth, try again.",
      },
    },

    sero: {
      tr: {
        correctTheme: (lbl) => "Doğru. Sert bir " + lbl + " — böyle devam.",
        correct: () => "Doğru. Başka laf yok.",
        wrongSan: (san) => "Yanlış. Doğrusu " + san + ". Kendine yedirme.",
        wrong: () => "Yanlış. Tekrar — daha keskin ol.",
      },
      en: {
        correctTheme: (lbl) => "Correct. A hard " + lbl + " — keep it up.",
        correct: () => "Correct. Nothing else to say.",
        wrongSan: (san) => "Wrong. It was " + san + ". Don't excuse it.",
        wrong: () => "Wrong. Again — be sharper.",
      },
    },
    lena: {
      tr: {
        correctTheme: (lbl) => "Harika! Güzel bir " + lbl + " — enerjiyi hissettim!",
        correct: () => "Aferin! Doğru hamle, böyle devam!",
        wrongSan: (san) => "Olur! Doğrusu " + san + " idi — bir daha, sen yaparsın!",
        wrong: () => "Yanlış ama moral bozma — tekrar dene!",
      },
      en: {
        correctTheme: (lbl) => "Awesome! A sharp " + lbl + " — I felt the energy!",
        correct: () => "Yes! Correct move — keep that fire!",
        wrongSan: (san) => "It happens! Correct was " + san + " — again, you've got this!",
        wrong: () => "Wrong, but don't drop morale — try again!",
      },
    },
  };

  function normCoach(id) {
    const s = String(id || "tilki").toLowerCase();
    return PACKS[s] ? s : "tilki";
  }

  function langKey(lang) {
    return String(lang || "tr").toLowerCase().startsWith("en") ? "en" : "tr";
  }

  function getCategories(coachId, lang) {
    const c = normCoach(coachId);
    const l = langKey(lang);
    return PACKS[c][l] || PACKS.tilki[l];
  }

  function summaryIntro(coachId, lang, tier, accuracyStr) {
    const c = normCoach(coachId);
    const l = langKey(lang);
    const pack = (SUMMARY[c] && SUMMARY[c][l]) || SUMMARY.tilki[l];
    const fn = pack[tier] || pack.fallback;
    return typeof fn === "function" ? fn(accuracyStr) : pack.fallback();
  }

  function contextualHintLine(coachId, lang, kind, perspective) {
    const c = normCoach(coachId);
    const l = langKey(lang);
    const byKind = HINTS[kind];
    if (!byKind) return "";
    // Şero shares Boris's blunt short-hint tone when no dedicated pack.
    const pack = byKind[c] || (c === "sero" ? byKind.boris : null) || byKind.tilki;
    const langPack = pack[l] || pack.tr;
    const p =
      perspective === "self" || perspective === "opp" ? perspective : "neutral";
    return (langPack && langPack[p]) || "";
  }

  function quizPhrase(coachId, lang, kind, arg) {
    const c = normCoach(coachId);
    const l = langKey(lang);
    const pack = (QUIZ[c] && QUIZ[c][l]) || QUIZ.tilki[l];
    if (kind === "correctTheme") return pack.correctTheme(arg || "");
    if (kind === "correct") return pack.correct();
    if (kind === "wrongSan") return pack.wrongSan(arg || "");
    return pack.wrong();
  }

  window.ForkSightCoachNarration = {
    getCategories: getCategories,
    summaryIntro: summaryIntro,
    contextualHintLine: contextualHintLine,
    quizPhrase: quizPhrase,
    coaches: Object.keys(PACKS),
  };
})();
