/**
 * Every word the interface says, in both languages.
 *
 * Kept as one flat map rather than split per screen: it is the only way to see
 * at a glance that a phrase reads the same everywhere, and the whole file is
 * small enough to hold in your head.
 *
 * `{name}` placeholders are filled by the t() helper.
 */
export const STRINGS = {
  'app.name': { en: 'hifz', tr: 'hifz' },
  'app.tagline': {
    en: 'Memorise it, and keep it.',
    tr: 'Ezberle ve unutma.',
  },

  // --- language ------------------------------------------------------------
  'lang.question': { en: 'Which language?', tr: 'Hangi dil?' },
  'lang.turkish': { en: 'Türkçe', tr: 'Türkçe' },
  'lang.english': { en: 'English', tr: 'English' },
  'lang.change': { en: 'You can change this later in Settings.', tr: 'Daha sonra Ayarlar’dan değiştirebilirsin.' },

  // --- onboarding ----------------------------------------------------------
  'intro.1.title': { en: 'You recite. The app listens or waits.', tr: 'Sen okursun. Uygulama dinler ya da bekler.' },
  'intro.1.body': {
    en: 'Each ayah appears hidden. Recite it from memory — out loud or in your head.',
    tr: 'Her ayet gizli gelir. Ezberinden oku — sesli ya da içinden.',
  },
  'intro.2.title': { en: 'Then you check yourself.', tr: 'Sonra kendini kontrol edersin.' },
  'intro.2.body': {
    en: 'Reveal the ayah and say honestly whether you had it. Nobody is marking you.',
    tr: 'Ayeti aç ve dürüstçe söyle: bildin mi, bilmedin mi. Kimse sana not vermiyor.',
  },
  'intro.3.title': { en: 'It decides when you see it again.', tr: 'Ne zaman tekrar göreceğine o karar verir.' },
  'intro.3.body': {
    en: 'What you knew comes back later. What you missed comes back sooner.',
    tr: 'Bildiğin ayet ileride, unuttuğun ayet daha erken karşına çıkar.',
  },
  'intro.start': { en: 'Start', tr: 'Başla' },
  'intro.skip': { en: 'Skip', tr: 'Geç' },

  // --- navigation ----------------------------------------------------------
  'nav.today': { en: 'Today', tr: 'Bugün' },
  'nav.library': { en: 'Library', tr: 'Kütüphane' },
  'nav.progress': { en: 'Progress', tr: 'Durum' },
  'nav.settings': { en: 'Settings', tr: 'Ayarlar' },
  'nav.skip': { en: 'Skip to content', tr: 'İçeriğe geç' },

  // --- today ---------------------------------------------------------------
  'today.due': {
    en: '{count} to test — about {minutes} min.',
    tr: 'Test edilecek {count} ayet var — yaklaşık {minutes} dk.',
  },
  'today.nothingDue': { en: 'Nothing due to test right now.', tr: 'Şu an test edilecek bir şey yok.' },
  'today.start': { en: 'Start testing', tr: 'Teste başla' },
  'today.addMore': { en: 'Add more to your plan', tr: 'Ezber listene ekle' },
  'today.emptyTitle': { en: 'Nothing here yet.', tr: 'Henüz bir şey yok.' },
  'today.emptyBody': {
    en: 'Pick a surah to memorise, or add a text of your own.',
    tr: 'Ezberlemek için bir sure seç ya da kendi metnini ekle.',
  },
  'today.openQuran': { en: 'Open the Qur’an', tr: 'Kur’an’ı aç' },
  'today.addOwn': { en: 'Add my own text', tr: 'Kendi metnimi ekle' },
  'today.learning': { en: 'Working on', tr: 'Üzerinde çalıştıkların' },
  'today.studyWaiting': {
    en: '{count} waiting to be studied.',
    tr: 'Çalışılmayı bekleyen {count} ayet var.',
  },
  'today.studyStart': { en: 'Start studying', tr: 'Çalışmaya başla' },
  'today.nothingToStudy': { en: 'Nothing waiting to be studied.', tr: 'Çalışılacak bir şey yok.' },
  // The two lists: one is where you learn it, one is where you prove it.
  'today.reviewHeading': { en: 'Testing', tr: 'Test' },
  'today.studyHeading': { en: 'Study', tr: 'Çalışma' },
  'today.coldTitle': {
    en: '{count} you haven’t seen in over a month.',
    tr: 'Bir aydır bakmadığın {count} bölüm var.',
  },
  'today.coldStart': { en: 'Test them cold', tr: 'Baştan test et' },
  'today.dueShort': { en: '{count} due', tr: '{count} test' },

  // --- library -------------------------------------------------------------
  'library.title': { en: 'Library', tr: 'Kütüphane' },
  'library.quran': { en: 'Qur’an', tr: 'Kur’an' },
  'library.mine': { en: 'My texts', tr: 'Metinlerim' },
  'library.addText': { en: 'Add a text', tr: 'Metin ekle' },
  'library.noneOfMine': {
    en: 'Nothing of your own yet. A poem, a duʿāʾ, a speech — anything works.',
    tr: 'Henüz kendi metnin yok. Şiir, dua, konuşma — her şey olur.',
  },
  'library.filter.all': { en: 'All', tr: 'Hepsi' },
  'library.filter.inPlan': { en: 'In my plan', tr: 'Listemde' },
  'library.filter.weak': { en: 'Shaky', tr: 'Zayıf' },
  'library.filter.unchecked': { en: 'Not checked', tr: 'Kontrol edilmedi' },
  'library.sort.order': { en: 'In order', tr: 'Sıralı' },
  'library.sort.weakest': { en: 'Weakest first', tr: 'Önce zayıflar' },
  'library.sort.checked': { en: 'Last checked', tr: 'Son kontrol' },
  'library.segments': { en: '{count} ayah', tr: '{count} ayet' },
  'library.segmentsGeneric': { en: '{count} lines', tr: '{count} satır' },
  'library.inPlan': { en: '{count} in plan', tr: '{count} listemde' },
  'library.noMatch': { en: 'Nothing matches that filter.', tr: 'Bu filtreye uyan bir şey yok.' },

  // --- text detail ---------------------------------------------------------
  'text.addAll': { en: 'Memorise this surah', tr: 'Bu sureyi ezberle' },
  'text.addSelected': { en: 'Add {count} to my plan', tr: '{count} ayeti listeme ekle' },
  'text.addOne': { en: 'Add to my plan', tr: 'Listeme ekle' },
  'text.practise': { en: 'Test this surah', tr: 'Bu sureyi test et' },
  'text.addToStudy': { en: 'Add to study ({count})', tr: 'Çalışmaya ekle ({count})' },
  'text.addToReview': { en: 'Add to testing ({count})', tr: 'Teste ekle ({count})' },
  'text.addAllToStudy': { en: 'Add the whole surah to study', tr: 'Tüm sureyi çalışmaya ekle' },
  'text.addAllToReview': { en: 'Add the whole surah to testing', tr: 'Tüm sureyi teste ekle' },
  'text.study': { en: 'Study ({count})', tr: 'Çalış ({count})' },
  'text.aimedAtAll': { en: 'The whole surah — {count} ayah', tr: 'Tüm sure — {count} ayet' },
  'text.aimedAtSelection': { en: '{count} ayah selected', tr: '{count} ayet seçildi' },
  'text.studyCount': { en: 'Memorise ({count})', tr: 'Ezberle ({count})' },
  'text.testCount': { en: 'Test ({count})', tr: 'Test et ({count})' },
  'text.selectAll': { en: 'Select all', tr: 'Hepsini seç' },
  'text.selectNone': { en: 'Clear selection', tr: 'Seçimi temizle' },
  'text.studyAll': { en: 'Start memorising', tr: 'Ezberlemeye başla' },
  'text.reviewAll': { en: 'Test the whole thing', tr: 'Baştan sona test et' },
  'text.reviewNow': { en: 'Test ({count})', tr: 'Test et ({count})' },
  'text.onStudyList': { en: '{count} to study', tr: 'Çalışılacak {count} ayet' },
  'text.onReviewList': { en: '{count} being tested', tr: 'Testte {count} ayet' },
  'text.notAddedYet': { en: 'Not on either list yet.', tr: 'Henüz iki listede de yok.' },
  'text.added': { en: 'Added.', tr: 'Eklendi.' },
  'text.inPlanCount': { en: '{done} of {total} in your plan', tr: '{total} ayetin {done} tanesi listende' },
  'text.selected': { en: '{count} selected', tr: '{count} seçildi' },
  'text.words': { en: 'Word by word', tr: 'Kelime kelime' },
  'text.play': { en: 'Listen', tr: 'Dinle' },
  // Not every text is a surah — one you typed in yourself is not.
  'text.playAll': { en: 'Listen to the whole thing', tr: 'Baştan sona dinle' },
  'text.playFromHere': { en: 'Listen from here on', tr: 'Buradan itibaren dinle' },
  'text.audioError': {
    en: 'The recitation could not be played. Check your connection.',
    tr: 'Okuyuş çalınamadı. Bağlantını kontrol et.',
  },
  'text.stop': { en: 'Stop', tr: 'Dur' },
  'text.display': { en: 'What to show', tr: 'Neler görünsün' },
  'text.turkish': { en: 'Turkish', tr: 'Türkçe meal' },
  'text.english': { en: 'English', tr: 'İngilizce meal' },
  'text.transliteration': { en: 'Latin letters', tr: 'Latin harfleri' },
  'text.intent': { en: 'What are you doing with this?', tr: 'Bununla ne yapıyorsun?' },
  'text.alsoSchedule': { en: 'Also test me on the meaning', tr: 'Anlamını da sor' },
  'text.notOnDevice': { en: 'This text is not on this device.', tr: 'Bu metin bu cihazda yok.' },
  'text.backToLibrary': { en: 'Back to the library', tr: 'Kütüphaneye dön' },

  // --- memorising ----------------------------------------------------------
  'memorize.cta': { en: 'Start memorising', tr: 'Ezberlemeye başla' },
  'memorize.ctaMore': { en: 'Memorise the next ones', tr: 'Sıradakileri ezberle' },
  'memorize.allDone': { en: 'The whole surah is in your plan.', tr: 'Surenin tamamı listende.' },
  'memorize.howMany': { en: 'How many ayah this session?', tr: 'Bu oturumda kaç ayet?' },
  'memorize.goal': { en: 'Today’s goal: {range}', tr: 'Bugünkü hedef: {range}' },
  'memorize.ayahOf': { en: 'Ayah {n} of {total}', tr: '{total} ayetten {n}.' },

  'memorize.step.listen': { en: 'Listen', tr: 'Dinle' },
  'memorize.step.listenBody': {
    en: 'Play it three times and follow the words. Do not try to recite yet.',
    tr: 'Üç kez dinle ve kelimeleri takip et. Henüz okumaya çalışma.',
  },
  'memorize.step.along': { en: 'Read along', tr: 'Birlikte oku' },
  'memorize.step.alongBody': {
    en: 'Play it again and recite with the voice, out loud.',
    tr: 'Tekrar çal ve sesle birlikte, yüksek sesle oku.',
  },
  'memorize.step.alone': { en: 'On your own', tr: 'Tek başına' },
  'memorize.step.aloneBody': {
    en: 'Now recite it without looking. Tap a word only if you are stuck.',
    tr: 'Şimdi bakmadan oku. Sadece takılırsan bir kelimeye dokun.',
  },
  'memorize.step.join': { en: 'Join it up', tr: 'Öncekiyle birleştir' },
  'memorize.step.joinBody': {
    en: 'Recite from {from} through {to} without stopping.',
    tr: '{from} ayetinden {to} ayetine kadar durmadan oku.',
  },
  'memorize.step.whole': { en: 'The whole passage', tr: 'Tamamı' },
  'memorize.step.wholeBody': {
    en: 'Last one: recite {range} from beginning to end.',
    tr: 'Son adım: {range} bölümünü baştan sona oku.',
  },
  'memorize.playCount': { en: '{done} / {total} plays', tr: '{done} / {total} dinleme' },
  'memorize.play': { en: 'Play', tr: 'Çal' },
  'memorize.replay': { en: 'Play again', tr: 'Tekrar çal' },
  'memorize.continue': { en: 'Continue', tr: 'Devam' },
  'memorize.reveal': { en: 'Show it', tr: 'Göster' },
  'memorize.gotIt': { en: 'I had it', tr: 'Bildim' },
  'memorize.repeat': { en: 'Again from the top', tr: 'Baştan tekrar' },
  'memorize.doneTitle': { en: '{range} memorised.', tr: '{range} ezberlendi.' },
  'memorize.doneBody': {
    en: 'It is in your plan now, and it will come back tomorrow so it stays.',
    tr: 'Artık listende. Kalıcı olması için yarın tekrar karşına çıkacak.',
  },
  'memorize.leave': { en: 'Stop for now', tr: 'Şimdilik bırak' },

  // --- review --------------------------------------------------------------
  'review.leave': { en: 'Leave', tr: 'Çık' },
  'review.recallPrompt': {
    en: 'Recite it from memory. Tap a word if you are stuck.',
    tr: 'Ezberinden oku. Takılırsan bir kelimeye dokun.',
  },
  'review.whatComesNext': { en: 'What comes after this?', tr: 'Bundan sonrası ne?' },
  'review.whatDoesItMean': { en: 'What does it mean?', tr: 'Anlamı ne?' },
  'review.whichAyah': { en: 'Which ayah is this?', tr: 'Bu hangi ayet?' },
  'review.show': { en: 'Show the answer', tr: 'Cevabı göster' },
  'review.recite': { en: 'Recite it out loud', tr: 'Sesli oku ve kontrol et' },
  'review.didYouRemember': { en: 'Did you remember it?', tr: 'Hatırladın mı?' },
  'review.recitedWell': { en: 'You recited it correctly.', tr: 'Doğru okudun.' },
  'review.next': { en: 'Next', tr: 'Sıradaki' },
  'review.recitedPartly': {
    en: 'Some words were not heard. You decide.',
    tr: 'Bazı kelimeler duyulmadı. Kararı sen ver.',
  },
  'review.grade.again': { en: 'No idea', tr: 'Hiç bilemedim' },
  'review.grade.hard': { en: 'Barely', tr: 'Zor hatırladım' },
  'review.grade.good': { en: 'Yes', tr: 'Evet' },
  'review.grade.easy': { en: 'Easily', tr: 'Çok kolay' },
  'review.gradeHint': {
    en: 'Answer honestly — this is only used to time the next review.',
    tr: 'Dürüst cevapla — bu sadece bir sonraki tekrarın zamanını belirler.',
  },
  'review.easyOffAfterPeek': {
    en: '“Easily” is off because you looked.',
    tr: '«Çok kolay» kapalı, çünkü baktın.',
  },
  'review.peeks': { en: '{count} word looked at', tr: '{count} kelimeye baktın' },
  'review.peeksPlural': { en: '{count} words looked at', tr: '{count} kelimeye baktın' },
  'review.learnTitle': { en: 'New — read it a few times first', tr: 'Yeni — önce birkaç kez oku' },
  'review.ready': { en: 'I’m ready to try', tr: 'Denemeye hazırım' },
  'review.nothingDue': { en: 'Nothing to review. Enjoy the quiet.', tr: 'Tekrar yok. Keyfini çıkar.' },
  'review.nothingCold': {
    en: 'Nothing has been left alone for a month yet.',
    tr: 'Henüz bir aydır dokunulmamış bir şey yok.',
  },
  'review.backToToday': { en: 'Back to today', tr: 'Bugüne dön' },
  'review.doneTitle': { en: 'Done — {count} reviewed.', tr: 'Bitti — {count} tekrar yaptın.' },
  'review.doneNoneMissed': { en: 'Nothing missed.', tr: 'Hiçbirini kaçırmadın.' },
  'review.doneMissed': {
    en: '{count} missed — those come back sooner.',
    tr: '{count} tanesini bilemedin — onlar daha erken gelecek.',
  },
  'review.coldResult': {
    en: 'You recalled {passed} of {total} first time.',
    tr: '{total} bölümün {passed} tanesini ilk seferde hatırladın.',
  },
  'review.coldNote': {
    en: 'That is the honest number. The rest are back in the schedule.',
    tr: 'Gerçek rakam bu. Diğerleri tekrar listesine döndü.',
  },
  'review.coldLabel': { en: 'cold check', tr: 'soğuk test' },
  'review.loading': { en: 'Loading…', tr: 'Yükleniyor…' },
  'review.confusedWith': { en: 'Careful — this is almost the same as', tr: 'Dikkat — buna çok benziyor' },
  'review.confusedIdentical': {
    en: 'These are word for word the same. Only their place tells them apart.',
    tr: 'Bunlar kelimesi kelimesine aynı. Sadece yerleri farklı.',
  },
  'review.confusedDiffer': {
    en: 'The words that tell them apart are marked.',
    tr: 'Ayıran kelimeler işaretli.',
  },

  // --- recitation ----------------------------------------------------------
  'recite.needModel': {
    en: 'To check your recitation the app needs a listening model, about {mb} MB. It downloads once and stays on your device. Your voice is never uploaded.',
    tr: 'Okuyuşunu kontrol edebilmek için yaklaşık {mb} MB’lık bir dinleme modeli gerekiyor. Bir kez iner ve cihazında kalır. Sesin hiçbir yere gönderilmez.',
  },
  'recite.download': { en: 'Download it', tr: 'İndir' },
  'recite.downloading': { en: 'Downloading… {percent}%', tr: 'İniyor… %{percent}' },
  'recite.start': { en: 'Start reciting', tr: 'Okumaya başla' },
  'recite.stop': { en: 'I’m done', tr: 'Bitirdim' },
  'recite.listening': { en: 'Listening… {seconds}s', tr: 'Dinliyor… {seconds} sn' },
  'recite.thinking': { en: 'Checking…', tr: 'Kontrol ediliyor…' },
  'recite.allHeard': { en: 'Heard every word.', tr: 'Bütün kelimeleri duydu.' },
  'recite.missed': { en: '{count} word was not heard.', tr: '{count} kelimeyi duymadı.' },
  'recite.missedPlural': { en: '{count} words were not heard.', tr: '{count} kelimeyi duymadı.' },
  'recite.heard': { en: 'It heard:', tr: 'Duyduğu:' },
  'recite.notAJudge': {
    en: 'It can mishear. You decide the grade.',
    tr: 'Yanlış duyabilir. Notu sen ver.',
  },
  'recite.tryAgain': { en: 'Try again', tr: 'Tekrar dene' },
  'recite.heardNothing': {
    en: 'Nothing was heard. Check the microphone and try again.',
    tr: 'Hiçbir şey duyulmadı. Mikrofonu kontrol edip tekrar dene.',
  },
  'recite.offer': { en: 'Recite it and let the app listen', tr: 'Sesli oku, uygulama dinlesin' },
  'recite.noMic': {
    en: 'This browser cannot record, so reciting is not available here.',
    tr: 'Bu tarayıcı ses kaydedemiyor, bu yüzden okuma kontrolü burada çalışmaz.',
  },
  'recite.denied': {
    en: 'The microphone was not allowed, so nothing can be heard.',
    tr: 'Mikrofona izin verilmedi, bu yüzden bir şey duyulamıyor.',
  },
  'recite.failed': { en: 'That recording could not be read.', tr: 'Bu kayıt okunamadı.' },
  'recite.downloadFailed': { en: 'The model could not be downloaded.', tr: 'Model indirilemedi.' },
  // Which recogniser, and where the audio goes — said next to the button.
  'recite.browserNote': {
    en: 'Using your browser’s speech recognition. Some browsers send the audio to their own servers.',
    tr: 'Tarayıcının ses tanımasını kullanıyor. Bazı tarayıcılar sesi kendi sunucularına gönderir.',
  },
  'recite.onDeviceNote': {
    en: 'Listening on this device. Nothing is sent anywhere.',
    tr: 'Bu cihazda dinliyor. Hiçbir yere gönderilmiyor.',
  },
  'recite.useOnDevice': { en: 'Keep it on this device', tr: 'Cihazımdan çıkmasın' },
  'recite.useOnDeviceDownload': {
    en: 'Keep it on this device ({mb} MB)',
    tr: 'Cihazımdan çıkmasın ({mb} MB)',
  },
  'recite.useBrowser': { en: 'use the browser instead', tr: 'tarayıcınınkini kullan' },
  'recite.useBrowserInstead': {
    en: 'Or use your browser’s recognition — nothing to download',
    tr: 'Ya da tarayıcının ses tanımasını kullan — indirme yok',
  },
  'recite.listeningNow': { en: 'Listening…', tr: 'Dinliyor…' },
  'recite.speechNetwork': {
    en: 'Your browser’s speech recognition could not be reached. Check the connection, or switch to the on-device model.',
    tr: 'Tarayıcının ses tanımasına ulaşılamadı. Bağlantını kontrol et ya da cihaz içi modele geç.',
  },
  'recite.speechUnavailable': {
    en: 'This browser cannot recognise speech in this language. The on-device model can.',
    tr: 'Bu tarayıcı bu dilde konuşmayı tanıyamıyor. Cihaz içi model tanıyabilir.',
  },
  'recite.modelStopped': {
    en: 'The on-device model stopped — this device may not have the memory for it. Your browser’s recognition works without a download.',
    tr: 'Cihaz içi model durdu — bu cihazın belleği yetmemiş olabilir. Tarayıcının ses tanıması indirme gerektirmez.',
  },
  'recite.tapToStart': { en: 'Tap and recite', tr: 'Dokun ve oku' },
  'recite.tapHint': {
    en: 'Words appear as they are heard. Nothing is shown before you say it.',
    tr: 'Kelimeler sen söyledikçe çıkar. Söylemeden hiçbir şey görünmez.',
  },
  'recite.speakNow': { en: 'Go ahead — I’m listening.', tr: 'Başla, dinliyorum.' },
  'recite.great': { en: 'That’s it!', tr: 'Aferin, oldu!' },
  'recite.almost': { en: 'Nearly there.', tr: 'Az kaldı.' },
  'recite.notCaught': { en: 'I couldn’t make that out.', tr: 'Bunu çıkaramadım.' },
  'recite.matched': { en: '{done} of {total} words heard', tr: '{total} kelimenin {done} tanesi duyuldu' },
  'recite.continue': { en: 'Continue', tr: 'Devam et' },
  'recite.silence': {
    en: 'The microphone picked up nothing. Hold the phone closer and try again.',
    tr: 'Mikrofon hiç ses almadı. Telefonu biraz yaklaştırıp tekrar dene.',
  },
  'recite.ratherSelfCheck': { en: 'Check it myself instead', tr: 'Kendim kontrol edeyim' },

  'review.praise1': { en: 'Well done.', tr: 'Eline sağlık.' },
  'review.praise2': { en: 'That is a sitting finished.', tr: 'Bir oturuşu tamamladın.' },
  'review.praise3': { en: 'Kept, one more day.', tr: 'Bir gün daha korudun.' },
  'review.praise4': { en: 'Steady work.', tr: 'İstikrarlı gidiyorsun.' },

  'memorize.donePraise': { en: 'You learned it.', tr: 'Ezberledin.' },
  'memorize.reviewNow': { en: 'Test it now', tr: 'Şimdi test et' },

  // --- rhythm --------------------------------------------------------------
  'rhythm.todayDone': { en: '{count} done today. Good.', tr: 'Bugün {count} tane yaptın. Güzel.' },
  'rhythm.todayNone': { en: 'Nothing reviewed yet today.', tr: 'Bugün henüz tekrar yapmadın.' },
  'rhythm.kept': { en: '{count} lines kept', tr: 'Koruduğun {count} satır' },
  'rhythm.window': {
    en: 'You sat down on {days} of the last {total} days.',
    tr: 'Son {total} günün {days} gününde oturdun.',
  },
  'rhythm.windowEmpty': { en: 'Today can be the first.', tr: 'İlk gün bugün olabilir.' },

  // --- playback ------------------------------------------------------------
  'audio.browserVoice': {
    en: 'Read by your device’s voice — there is no recording for this text.',
    tr: 'Cihazının sesiyle okunuyor — bu metnin kaydı yok.',
  },

  // --- the cumulative test -------------------------------------------------
  'test.title': { en: 'Test my memory', tr: 'Ezberimi test et' },
  'test.progress': { en: 'Step {step} of {total}', tr: '{total} adımın {step}. adımı' },
  'test.single': { en: 'Ayah {ref}', tr: 'Ayet {ref}' },
  'test.join': { en: '{from} through {to}, joined', tr: '{from} – {to} arası, birleşik' },
  'test.whole': { en: 'All of it — {from} to {to}', tr: 'Tamamı — {from} – {to}' },
  'test.singleBody': {
    en: 'Recite this ayah from memory.',
    tr: 'Bu ayeti ezberinden oku.',
  },
  'test.joinBody': {
    en: 'Recite it straight through, without stopping between the ayah. This is the part that breaks.',
    tr: 'Ayetler arasında durmadan baştan sona oku. Kopma tam burada olur.',
  },
  'test.knew': { en: 'I had it', tr: 'Bildim' },
  'test.missed': { en: 'I lost it', tr: 'Kaçırdım' },
  'test.leave': { en: 'Leave the test', tr: 'Testten çık' },
  'test.nothing': { en: 'Nothing to test here yet.', tr: 'Burada test edilecek bir şey yok.' },
  'test.score': { en: '{passed} of {total}', tr: '{total} adımın {passed} tanesi' },
  'test.doneWhole': { en: 'You recited the whole thing.', tr: 'Tamamını okudun.' },
  'test.donePartly': { en: 'Test finished.', tr: 'Test bitti.' },
  'test.doneBody': {
    en: 'The joins you lost are where to start next time.',
    tr: 'Kaçırdığın birleşimler bir dahaki sefere başlanacak yer.',
  },
  'test.again': { en: 'Run it again', tr: 'Tekrar çalıştır' },
  'common.back': { en: 'Back', tr: 'Geri' },

  // --- about ---------------------------------------------------------------
  'about.title': { en: 'About hifz', tr: 'hifz hakkında' },
  'about.what': {
    en: 'A free, open app for memorising text word for word and keeping it memorised.',
    tr: 'Metni kelimesi kelimesine ezberlemek ve ezberde tutmak için ücretsiz, açık bir uygulama.',
  },
  'about.privacy': { en: 'Your data', tr: 'Verilerin' },
  'about.privacyBody': {
    en: 'Everything stays on this device. There is no account and no server. The one exception is the recitation check: unless you download the on-device model, your browser’s own speech recognition may send the audio to its vendor.',
    tr: 'Her şey bu cihazda kalır. Hesap yok, sunucu yok. Tek istisna okuma kontrolü: cihaz içi modeli indirmediysen tarayıcının kendi ses tanıması sesi kendi sağlayıcısına gönderebilir.',
  },
  'about.sources': { en: 'Where the text comes from', tr: 'Metnin kaynağı' },
  'about.translations': { en: 'Translations', tr: 'Mealler' },
  'about.transliteration': { en: 'Transliteration', tr: 'Latin harfleri' },
  'about.licences': { en: 'Licences', tr: 'Lisanslar' },
  'about.audio': { en: 'Recitation audio', tr: 'Okuyuş kaydı' },
  'about.audioBody': {
    en: 'Streamed from an external Qur’an audio service when you press play. No audio is bundled with the app.',
    tr: 'Çal’a bastığında dış bir Kur’an ses servisinden akar. Uygulamayla birlikte hiçbir ses dosyası gelmez.',
  },
  'about.code': { en: 'Source code', tr: 'Kaynak kodu' },
  'about.build': { en: 'Build {id}', tr: 'Sürüm {id}' },
  'about.backToSettings': { en: 'Back to settings', tr: 'Ayarlara dön' },
  'settings.about': { en: 'About, sources and licences', tr: 'Hakkında, kaynaklar ve lisanslar' },

  // --- status --------------------------------------------------------------
  'intent.learning': { en: 'Learning', tr: 'Ezberliyorum' },
  'intent.maintaining': { en: 'Keeping it', tr: 'Koruyorum' },
  'intent.paused': { en: 'Paused', tr: 'Durdurdum' },
  'intent.not_started': { en: 'Not started', tr: 'Başlamadım' },
  'evidence.untested': { en: 'Not checked yet', tr: 'Henüz kontrol edilmedi' },
  'evidence.weak': { en: 'Shaky', tr: 'Zayıf' },
  'evidence.fair': { en: 'Holding', tr: 'İdare eder' },
  'evidence.strong': { en: 'Solid', tr: 'Sağlam' },
  'evidence.cold_verified': { en: 'Cold-checked', tr: 'Soğuk test edildi' },
  'method.self_grade': { en: 'Self-checked', tr: 'Kendin kontrol ettin' },
  'method.recite_asr': { en: 'Recited', tr: 'Okudun' },
  'method.order_tap': { en: 'Reconstructed', tr: 'Sıraladın' },
  'method.type_initials': { en: 'Typed', tr: 'Yazdın' },
  'when.justNow': { en: 'just now', tr: 'az önce' },
  'when.hours': { en: '{count}h ago', tr: '{count} saat önce' },
  'when.yesterday': { en: 'yesterday', tr: 'dün' },
  'when.days': { en: '{count} days ago', tr: '{count} gün önce' },
  'when.months': { en: '{count} months ago', tr: '{count} ay önce' },
  'when.years': { en: '{count} years ago', tr: '{count} yıl önce' },

  // --- progress ------------------------------------------------------------
  'progress.title': { en: 'Progress', tr: 'Durum' },
  'progress.summary': {
    en: '{count} items in your plan. Days add up on Today; what is proved is here.',
    tr: 'Listende {count} parça var. Günler Bugün’de birikir; kanıtlanan burada.',
  },
  'progress.empty': {
    en: 'Nothing in your plan yet, so there is nothing honest to show.',
    tr: 'Listende henüz bir şey yok, gösterecek dürüst bir rakam da yok.',
  },
  'progress.evidence': { en: 'How solid it is', tr: 'Ne kadar sağlam' },
  'progress.coldChecks': { en: 'Cold checks', tr: 'Soğuk testler' },
  'progress.noColdChecks': {
    en: 'None yet. One is offered when something has been left alone for a month.',
    tr: 'Henüz yok. Bir şey bir aydır bekleyince teklif edilir.',
  },
  'progress.lookAlike': { en: 'Passages that look alike', tr: 'Birbirine benzeyen yerler' },
  'progress.lookAlikeBody': {
    en: 'Where recitation takes the wrong turn. Found among the texts on this device.',
    tr: 'Okurken yanlış yere sapılan yerler. Bu cihazdaki metinler arasından bulundu.',
  },
  'progress.noLookAlike': { en: 'Nothing here reads like anything else yet.', tr: 'Henüz birbirine benzeyen bir şey yok.' },
  'progress.weakJoins': { en: 'Weakest joins', tr: 'En zayıf geçişler' },
  'progress.weakJoinsBody': {
    en: 'The places most likely to break next. Tap one to practise it.',
    tr: 'İlk kopması muhtemel yerler. Çalışmak için birine dokun.',
  },
  'progress.noJoins': { en: 'No joins in your plan yet.', tr: 'Listende henüz geçiş yok.' },
  'progress.identical': { en: 'identical', tr: 'birebir aynı' },
  'progress.alike': { en: '{percent}% alike', tr: '%{percent} benzer' },
  'progress.notChecked': { en: 'not checked', tr: 'kontrol edilmedi' },

  // --- settings ------------------------------------------------------------
  'settings.title': { en: 'Settings', tr: 'Ayarlar' },
  'settings.language': { en: 'Language', tr: 'Dil' },
  'settings.appearance': { en: 'Appearance', tr: 'Görünüm' },
  'settings.theme.auto': { en: 'Match my device', tr: 'Cihazıma uy' },
  'settings.theme.light': { en: 'Light', tr: 'Açık' },
  'settings.theme.dark': { en: 'Dark', tr: 'Koyu' },
  'settings.meanings': { en: 'Meanings', tr: 'Mealler' },
  'settings.trEdition': { en: 'Turkish translation', tr: 'Türkçe meal' },
  'settings.enEdition': { en: 'English translation', tr: 'İngilizce meal' },
  'settings.editionsLater': {
    en: 'Open a surah first and the available translations appear here.',
    tr: 'Önce bir sure aç, mevcut mealler burada görünecek.',
  },
  'translit.easy': { en: 'Easy to read', tr: 'Kolay okunur' },
  'translit.scholarly': { en: 'Scholarly', tr: 'Akademik' },
  'translit.aligned': { en: 'Word by word', tr: 'Kelime kelime' },
  'settings.transliteration': { en: 'Latin letters', tr: 'Latin harfleri' },
  'settings.showTranslit': { en: 'Show the ayah in Latin letters', tr: 'Ayeti Latin harfleriyle de göster' },
  'settings.translitNote': {
    en: 'Never shown during a test — it would be the answer.',
    tr: 'Test sırasında asla gösterilmez — cevabın kendisi olurdu.',
  },
  'settings.reciteGroup': { en: 'Checking your recitation', tr: 'Okuyuşunu kontrol etme' },
  'settings.reciteEnable': { en: 'Let me recite out loud and be checked', tr: 'Sesli okuyup kontrol edilebileyim' },
  'settings.reciteNote': {
    en: 'Offered on every review screen. It uses your browser’s own speech recognition by default — nothing to download, though some browsers send the audio to their servers. You can switch to a listener that runs entirely on this device; that one costs a one-time download of about {mb} MB.',
    tr: 'Her tekrar ekranında sunuluyor. Varsayılan olarak tarayıcının kendi ses tanımasını kullanır — indirme yok, ama bazı tarayıcılar sesi kendi sunucularına gönderir. Tamamen bu cihazda çalışan dinleyiciye geçebilirsin; o bir kerelik yaklaşık {mb} MB indirme ister.',
  },
  'settings.pace': { en: 'Pace', tr: 'Tempo' },
  'settings.newPerDay': { en: 'New ayah per day — {count}', tr: 'Günde yeni ayet — {count}' },
  'settings.newPerDayNote': {
    en: 'How many new ones to start each day. Lower is easier to keep up with.',
    tr: 'Her gün kaç yeni ayete başlanacağı. Düşük tutmak devam etmeyi kolaylaştırır.',
  },
  'settings.audio': { en: 'Recitation audio', tr: 'Okuyucu' },
  'settings.audioNote': {
    en: 'Audio streams from the internet, so it needs a connection.',
    tr: 'Ses internetten geldiği için bağlantı gerektirir.',
  },
  'settings.install': { en: 'On this device', tr: 'Bu cihazda' },
  'settings.installed': { en: 'Installed. It opens like any other app.', tr: 'Yüklendi. Diğer uygulamalar gibi açılır.' },
  'settings.installBody': {
    en: 'Install it and it opens from your home screen and works with no connection.',
    tr: 'Yükle; ana ekrandan açılır ve internetsiz de çalışır.',
  },
  'settings.installAction': { en: 'Install', tr: 'Yükle' },
  'settings.installIos': {
    en: 'To install: tap Share, then Add to Home Screen.',
    tr: 'Yüklemek için: Paylaş’a dokun, sonra Ana Ekrana Ekle.',
  },
  'settings.installOther': {
    en: 'Your browser installs this from its own menu — look for Install or Add to Home Screen.',
    tr: 'Tarayıcın bunu kendi menüsünden yükler — Yükle ya da Ana Ekrana Ekle seçeneğine bak.',
  },
  'settings.data': { en: 'Your data', tr: 'Verilerin' },
  'settings.dataNote': {
    en: 'Everything is stored in this browser. Nothing is sent anywhere.',
    tr: 'Her şey bu tarayıcıda saklanır. Hiçbir yere gönderilmez.',
  },
  'settings.export': { en: 'Export everything', tr: 'Her şeyi dışa aktar' },
  'settings.delete': { en: 'Delete everything', tr: 'Her şeyi sil' },
  'settings.deleteConfirm': { en: 'Yes, delete it all', tr: 'Evet, hepsini sil' },
  'settings.deleteWarning': {
    en: 'This removes every text and every review on this device. Export first if you want it back.',
    tr: 'Bu cihazdaki bütün metinleri ve tekrarları siler. Geri istiyorsan önce dışa aktar.',
  },
  'settings.cancel': { en: 'Cancel', tr: 'Vazgeç' },
  'settings.replayIntro': { en: 'Show the introduction again', tr: 'Tanıtımı tekrar göster' },

  // --- add text ------------------------------------------------------------
  'add.title': { en: 'Add a text', tr: 'Metin ekle' },
  'add.step': { en: 'Step {step} of 3', tr: 'Adım {step} / 3' },
  'add.name': { en: 'Name', tr: 'Adı' },
  'add.namePlaceholder': { en: 'A duʿāʾ, a poem, a speech…', tr: 'Bir dua, şiir, konuşma…' },
  'add.text': { en: 'The text', tr: 'Metin' },
  'add.textPlaceholder': {
    en: 'Paste it here. One line per piece is easiest.',
    tr: 'Buraya yapıştır. Her satıra bir parça en kolayı.',
  },
  'add.detected': {
    en: '{count} pieces detected. This stays on your device — it is never uploaded.',
    tr: '{count} parça bulundu. Bu cihazda kalır — hiçbir yere gönderilmez.',
  },
  'add.next': { en: 'Next', tr: 'Devam' },
  'add.back': { en: 'Back', tr: 'Geri' },
  'add.splitHow': { en: 'How should it be split?', tr: 'Nasıl bölünsün?' },
  'add.mergeUp': { en: 'Join with the one above', tr: 'Üsttekiyle birleştir' },
  'add.split': { en: 'Split in two', tr: 'İkiye böl' },
  'add.pieces': { en: '{count} pieces', tr: '{count} parça' },
  'add.alsoJoins': { en: 'Also test me on the joins between them', tr: 'Aralarındaki geçişleri de sor' },
  'add.joinsNote': {
    en: 'Where memorisation actually breaks.',
    tr: 'Ezberin asıl koptuğu yer burasıdır.',
  },
  'add.save': { en: 'Add to my plan', tr: 'Listeme ekle' },
  'add.saveLater': { en: 'Just save it', tr: 'Sadece kaydet' },
  'add.strategy.newline': { en: 'One per line', tr: 'Her satır bir parça' },
  'add.strategy.blank_line': { en: 'Blank line between pieces', tr: 'Boş satır arası' },
  'add.strategy.sentence': { en: 'One per sentence', tr: 'Her cümle bir parça' },
  'add.strategy.verse_marker': { en: 'At verse marks', tr: 'Ayet işaretlerinde' },
  'add.strategy.word_count': { en: 'Every few words', tr: 'Birkaç kelimede bir' },
  'add.wordsPer': { en: 'Words per piece — {count}', tr: 'Parça başına kelime — {count}' },

  // --- misc ----------------------------------------------------------------
  'common.loading': { en: 'Loading…', tr: 'Yükleniyor…' },
  'common.notFound': { en: 'Nothing here.', tr: 'Burada bir şey yok.' },
  'offline.notDownloaded': {
    en: 'This one has not been downloaded yet, and it could not be fetched just now.',
    tr: 'Bu henüz indirilmemiş ve şu anda getirilemedi.',
  },
  'offline.keptNote': {
    en: 'Anything you have already opened stays available offline.',
    tr: 'Daha önce açtığın her şey internetsiz de açılır.',
  },
  'sw.updateReady': { en: 'A newer version is ready.', tr: 'Yeni bir sürüm hazır.' },
  'sw.reload': { en: 'Reload', tr: 'Yenile' },
  'sw.later': { en: 'Later', tr: 'Sonra' },
  'sw.offlineReady': { en: 'Ready to work offline.', tr: 'İnternetsiz çalışmaya hazır.' },
  'sw.dismiss': { en: 'OK', tr: 'Tamam' },
} as const

export type StringKey = keyof typeof STRINGS
