/* Hindi Flashcards — vanilla JS, no build step. */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var titleEl = document.getElementById("title");
  var backBtn = document.getElementById("backBtn");
  var settingsBtn = document.getElementById("settingsBtn");

  var DATA = null;
  var BLANK = "___";
  var STORE_SETTINGS = "hfc.settings";
  var STORE_PROGRESS = "hfc.progress";

  // ---------- storage ----------
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }
  var settings = Object.assign(
    { name: "", city: "", age: "", grade: "", gender: "boy", dir: "hi-en" },
    load(STORE_SETTINGS, {})
  );
  var progress = load(STORE_PROGRESS, {});

  // ---------- helpers ----------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    });
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function deckById(id) {
    if (id === "all") return { id: "all", title: "All", hi: "सब", roman: "sab", icon: "🔀" };
    return DATA.decks.filter(function (d) { return d.id === id; })[0];
  }
  function cardsFor(id) {
    return DATA.cards.filter(function (c) { return id === "all" || c.deck === id; });
  }

  // Resolve a card into display strings: gender form + Settings blanks filled.
  function fill(text) {
    if (!text) return text;
    return text.replace(/\{(name|city|age|grade)\}/g, function (_, k) {
      return (settings[k] || "").trim() || BLANK;
    });
  }
  function view(card) {
    var girl = settings.gender === "girl" && card.formBy !== "listener";
    return {
      hi: fill(girl && card.hi_f ? card.hi_f : card.hi),
      roman: fill(girl && card.roman_f ? card.roman_f : card.roman),
      en: fill(card.en),
      zh: card.zh && card.zh !== "—" ? fill(card.zh) : "",
      py: fill(card.py || ""),
    };
  }

  // ---------- speech: Web Speech API, or the Android TextToSpeech bridge ----------
  var Speech = {
    voices: {},
    has: function (lang) {
      if (window.AndroidTTS) { try { return window.AndroidTTS.hasLang(lang); } catch (e) { return false; } }
      return !!this.voices[lang];
    },
    refresh: function () {
      if (!("speechSynthesis" in window)) return;
      var vs = speechSynthesis.getVoices(), found = {};
      ["hi-IN", "zh-CN", "en-US"].forEach(function (lang) {
        var base = lang.split("-")[0];
        var exact = vs.filter(function (v) { return v.lang.replace("_", "-").toLowerCase() === lang.toLowerCase(); });
        var loose = vs.filter(function (v) { return v.lang.toLowerCase().indexOf(base) === 0; });
        if (base === "zh") loose = loose.filter(function (v) { return !/HK|TW|yue/i.test(v.lang + v.name); });
        found[lang] = exact[0] || loose[0] || null;
      });
      this.voices = found;
    },
    speak: function (text, lang) {
      text = (text || "").split(BLANK).join(" ");
      if (window.AndroidTTS) { window.AndroidTTS.speak(text, lang); return; }
      if (!this.voices[lang]) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.voice = this.voices[lang]; u.lang = lang; u.rate = 0.85;
      speechSynthesis.speak(u);
    },
  };
  if ("speechSynthesis" in window) {
    Speech.refresh();
    speechSynthesis.addEventListener("voiceschanged", function () { Speech.refresh(); render(); });
  }
  window.addEventListener("ttsready", function () { render(); }); // fired by the Android wrapper

  function speakBtn(text, lang, label) {
    if (!text || !Speech.has(lang)) return null;
    return h("button", {
      class: "speak", "aria-label": "Say it" + (label ? " in " + label : ""),
      onclick: function (e) { e.stopPropagation(); Speech.speak(text, lang); },
      onpointerdown: function (e) { e.stopPropagation(); },
    }, ["🔊"]);
  }

  // ---------- progress ----------
  function deckProgress(id) { return progress[id] || { stars: 0, plays: 0 }; }
  function starsEl(n, big) {
    var s = ""; for (var i = 0; i < 3; i++) s += i < n ? "★" : "☆";
    return h("span", { class: "stars" + (big ? " big" : ""), "aria-label": n + " of 3 stars" }, [s]);
  }

  // ---------- router ----------
  var current = null; // per-view state that survives re-render (study session)
  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/");
    return { name: parts[0] || "home", deck: parts[1] || null };
  }
  function go(path) { location.hash = "#/" + path; }
  window.addEventListener("hashchange", function () { current = null; render(); window.scrollTo(0, 0); });
  backBtn.addEventListener("click", function () { go(""); });
  settingsBtn.addEventListener("click", function () { go("settings"); });

  function render() {
    if (!DATA) return;
    var r = route();
    backBtn.hidden = r.name === "home";
    settingsBtn.hidden = r.name === "settings";
    app.innerHTML = "";
    var deck = r.deck && deckById(r.deck);
    if ((r.name === "study" || r.name === "list" || r.name === "trio") && !deck) r.name = "home";
    if (r.name === "study") renderStudy(deck);
    else if (r.name === "list") renderList(deck);
    else if (r.name === "trio") renderTrio(deck);
    else if (r.name === "settings") renderSettings();
    else renderHome();
  }
  function setTitle(main, sub) {
    titleEl.innerHTML = "";
    titleEl.appendChild(document.createTextNode(main + " "));
    if (sub) titleEl.appendChild(h("span", { lang: "hi", class: "sub" }, [sub]));
  }

  // ---------- home ----------
  function renderHome() {
    titleEl.innerHTML = '<span lang="hi">हिंदी</span> Flashcards';
    var grid = h("div", { class: "deck-grid" });
    DATA.decks.concat([deckById("all")]).forEach(function (d) {
      var p = deckProgress(d.id), n = cardsFor(d.id).length;
      grid.appendChild(h("section", { class: "deck deck-" + d.id }, [
        h("button", { class: "deck-main", onclick: function () { go("study/" + d.id); } }, [
          h("span", { class: "deck-icon", lang: "hi", "aria-hidden": "true" }, [d.icon]),
          h("span", { class: "deck-title" }, [d.title]),
          h("span", { class: "deck-hi", lang: "hi" }, [d.hi]),
          h("span", { class: "deck-meta" }, [starsEl(p.stars), " " + n + " cards"]),
        ]),
        h("div", { class: "deck-alt" }, [
          h("button", { onclick: function () { go("list/" + d.id); }, "aria-label": d.title + " side-by-side table" }, ["☰ Table"]),
          h("button", { onclick: function () { go("trio/" + d.id); }, "aria-label": d.title + " three-up cards" }, ["▦ 3-up"]),
        ]),
      ]));
    });
    app.appendChild(h("p", { class: "hello" }, [
      settings.name ? "नमस्ते, " + settings.name + "! " : "नमस्ते! ",
      h("span", { class: "muted" }, ["Pick a deck to play."]),
    ]));
    app.appendChild(grid);
  }

  // ---------- study ----------
  function newSession(deck) {
    var dir = settings.dir;
    var queue = shuffle(cardsFor(deck.id)).map(function (c) {
      var side = dir === "mixed" ? (Math.random() < 0.5 ? "hi" : "en") : dir === "en-hi" ? "en" : "hi";
      return { card: c, side: side, misses: 0 };
    });
    return { kind: "study", deck: deck.id, queue: queue, total: queue.length, done: 0, firstTry: 0, flipped: false, finished: false };
  }

  function renderStudy(deck) {
    setTitle(deck.title, deck.hi);
    if (!current || current.kind !== "study" || current.deck !== deck.id) current = newSession(deck);
    var s = current;
    if (s.finished) return renderDone(deck, s);

    var item = s.queue[0], v = view(item.card), c = item.card;

    var bar = h("div", { class: "progress" }, [h("div", { class: "progress-fill", style: "width:" + Math.round(100 * s.done / s.total) + "%" })]);
    var dirSel = h("div", { class: "seg small", role: "group", "aria-label": "Card direction" },
      [["hi-en", "हि → En"], ["en-hi", "En → हि"], ["mixed", "Mix"]].map(function (o) {
        return h("button", {
          class: settings.dir === o[0] ? "on" : "", "aria-pressed": String(settings.dir === o[0]),
          onclick: function () { settings.dir = o[0]; save(STORE_SETTINGS, settings); current = newSession(deck); render(); },
        }, [o[1]]);
      }));

    var front = h("div", { class: "face front" }, item.side === "hi" ? hindiFace(c, v, false) : englishFace(c, v));
    var back = h("div", { class: "face back" }, answerFace(c, v));
    var cardEl = h("div", { class: "flashcard" + (s.flipped ? " flipped" : ""), role: "button", tabindex: "0",
      "aria-label": s.flipped ? "Card answer. Tap to flip back." : "Card. Tap to flip." }, [
      h("div", { class: "flip-inner" }, [front, back]),
    ]);

    function flip() { s.flipped = !s.flipped; cardEl.classList.toggle("flipped", s.flipped); }
    function answer(ok) {
      var it = s.queue.shift();
      if (ok) { s.done++; if (it.misses === 0) s.firstTry++; }
      else { it.misses++; s.queue.splice(Math.min(3, s.queue.length), 0, it); } // comes back after ~3 cards
      s.flipped = false;
      if (!s.queue.length) finish(deck, s);
      render();
    }
    s.answer = answer; s.flip = flip;
    addSwipe(cardEl, flip, function () { answer(true); }, function () { answer(false); });

    app.appendChild(h("div", { class: "study" }, [
      h("div", { class: "study-head" }, [h("span", { class: "count" }, [(s.done + 1 > s.total ? s.total : s.done + 1) + " / " + s.total]), dirSel]),
      bar,
      cardEl,
      h("p", { class: "swipe-hint" }, ["Tap to flip · swipe → got it · swipe ← again"]),
      h("div", { class: "answer-row" }, [
        h("button", { class: "big again", onclick: function () { answer(false); } }, ["↺ Again"]),
        h("button", { class: "big got", onclick: function () { answer(true); } }, ["✓ Got it"]),
      ]),
    ]));
  }

  function swatch(c) { return c.color ? h("div", { class: "swatch", style: "background:" + c.color, "aria-hidden": "true" }) : null; }

  function hindiFace(c, v, small) {
    return [
      h("div", { class: "dev" + (c.deck === "sentences" ? " dev-sentence" : "") + (small ? " dev-small" : ""), lang: "hi" }, [v.hi]),
      h("div", { class: "roman" }, [v.roman]),
      speakBtn(v.hi, "hi-IN", "Hindi"),
    ];
  }
  function englishFace(c, v) {
    return [swatch(c), h("div", { class: "en-big" }, [v.en]), speakBtn(v.en, "en-US", "English")];
  }
  function answerFace(c, v) {
    return [
      swatch(c),
      h("div", { class: "dev dev-mid" + (c.deck === "sentences" ? " dev-sentence" : ""), lang: "hi" }, [v.hi]),
      h("div", { class: "roman" }, [v.roman]),
      h("div", { class: "en" }, [v.en, c.digit ? h("span", { class: "digit", lang: "hi" }, [" · " + c.digit]) : null]),
      c.ex ? h("div", { class: "example" }, [
        h("span", { lang: "hi", class: "ex-hi" }, [c.ex.hi]), " " + c.ex.roman + " = " + c.ex.en,
        speakBtn(c.ex.hi, "hi-IN", "Hindi"),
      ]) : null,
      c.hint ? h("div", { class: "hint" }, [c.hint]) : null,
      speakBtn(v.hi, "hi-IN", "Hindi"),
    ];
  }

  function finish(deck, s) {
    s.finished = true;
    var ratio = s.firstTry / s.total;
    s.stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    var p = deckProgress(deck.id);
    progress[deck.id] = { stars: Math.max(p.stars || 0, s.stars), plays: (p.plays || 0) + 1, last: s.stars, lastAt: Date.now() };
    save(STORE_PROGRESS, progress);
  }

  function renderDone(deck, s) {
    app.appendChild(h("div", { class: "done" }, [
      h("div", { class: "cheer", lang: "hi" }, [s.stars === 3 ? "शाबाश!" : s.stars === 2 ? "बहुत अच्छे!" : "अच्छा!"]),
      h("div", { class: "roman" }, [s.stars === 3 ? "Shaabaash! (Well done!)" : s.stars === 2 ? "Bahut achchhe! (Very good!)" : "Achchha! (Good!)"]),
      starsEl(s.stars, true),
      h("p", {}, [s.firstTry + " of " + s.total + " right the first time."]),
      h("div", { class: "answer-row" }, [
        h("button", { class: "big got", onclick: function () { current = newSession(deck); render(); } }, ["Play again"]),
        h("button", { class: "big plain", onclick: function () { go(""); } }, ["All decks"]),
      ]),
    ]));
  }

  // Tap / swipe on a card. Tap → onTap; swipe right/left past threshold → onRight/onLeft.
  function addSwipe(el, onTap, onRight, onLeft) {
    var x0 = null, y0 = 0, dx = 0, id = null;
    el.addEventListener("pointerdown", function (e) { x0 = e.clientX; y0 = e.clientY; dx = 0; id = e.pointerId; el.style.transition = "none"; });
    el.addEventListener("pointermove", function (e) {
      if (x0 === null || e.pointerId !== id) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - y0)) {
        if (el.setPointerCapture) try { el.setPointerCapture(id); } catch (err) { /* ignore */ }
        el.style.transform = "translateX(" + dx + "px) rotate(" + dx / 25 + "deg)";
        el.classList.toggle("lean-got", dx > 60); el.classList.toggle("lean-again", dx < -60);
      }
    });
    function end() {
      if (x0 === null) return;
      el.style.transition = ""; el.style.transform = "";
      el.classList.remove("lean-got", "lean-again");
      var d = dx; x0 = null;
      if (d > 90 && onRight) onRight();
      else if (d < -90 && onLeft) onLeft();
      else if (Math.abs(d) < 8) onTap();
    }
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", function () { x0 = null; el.style.transition = ""; el.style.transform = ""; });
    el.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onTap(); } });
  }

  document.addEventListener("keydown", function (e) {
    if (!current || e.target.tagName === "INPUT") return;
    if (current.kind === "study" && !current.finished) {
      if (e.key === "ArrowRight") current.answer(true);
      else if (e.key === "ArrowLeft") current.answer(false);
      else if (e.key === " " && e.target === document.body) { e.preventDefault(); current.flip(); }
    } else if (current.kind === "trio") {
      if (e.key === "ArrowRight") current.move(1);
      else if (e.key === "ArrowLeft") current.move(-1);
    }
  });

  // ---------- side by side: table ----------
  function triCells(c) {
    var v = view(c);
    return {
      en: h("div", { class: "cell cell-en", "data-label": "English" }, [
        swatch(c), h("div", { class: "cell-main" }, [v.en]), speakBtn(v.en, "en-US", "English"),
      ]),
      hi: h("div", { class: "cell cell-hi", "data-label": "हिंदी" }, [
        h("div", { class: "cell-main dev-cell", lang: "hi" }, [v.hi, c.digit ? h("span", { class: "digit" }, [" " + c.digit]) : null]),
        h("div", { class: "cell-sub" }, [v.roman]),
        c.ex ? h("div", { class: "cell-ex" }, [h("span", { lang: "hi" }, [c.ex.hi]), " " + c.ex.roman + " · " + c.ex.en]) : null,
        speakBtn(v.hi, "hi-IN", "Hindi"),
      ]),
      zh: h("div", { class: "cell cell-zh" + (v.zh ? "" : " empty"), "data-label": "中文" }, v.zh ? [
        h("div", { class: "cell-main zh-cell", lang: "zh-Hans" }, [v.zh]),
        h("div", { class: "cell-sub" }, [v.py]),
        speakBtn(v.zh, "zh-CN", "Chinese"),
      ] : [h("div", { class: "cell-main" }, ["—"])]),
    };
  }

  function sideNav(deck, mode) {
    return h("div", { class: "seg", role: "group", "aria-label": "View" }, [
      h("button", { class: mode === "list" ? "on" : "", onclick: function () { go("list/" + deck.id); } }, ["☰ Table"]),
      h("button", { class: mode === "trio" ? "on" : "", onclick: function () { go("trio/" + deck.id); } }, ["▦ 3-up"]),
      h("button", { onclick: function () { go("study/" + deck.id); } }, ["▶ Play"]),
    ]);
  }

  function renderList(deck) {
    setTitle(deck.title, deck.hi);
    var rows = cardsFor(deck.id).map(function (c) {
      var t = triCells(c);
      return h("div", { class: "tri-row", role: "row" }, [t.en, t.hi, t.zh]);
    });
    app.appendChild(sideNav(deck, "list"));
    app.appendChild(h("div", { class: "tri-table", role: "table", "aria-label": deck.title + " in English, Hindi and Chinese" }, [
      h("div", { class: "tri-row tri-headrow", role: "row" }, [
        h("div", { class: "cell head" }, ["English"]),
        h("div", { class: "cell head", lang: "hi" }, ["हिंदी"]),
        h("div", { class: "cell head", lang: "zh-Hans" }, ["中文"]),
      ]),
    ].concat(rows)));
  }

  // ---------- side by side: 3-up cards ----------
  function renderTrio(deck) {
    setTitle(deck.title, deck.hi);
    var list = cardsFor(deck.id);
    if (!current || current.kind !== "trio" || current.deck !== deck.id) current = { kind: "trio", deck: deck.id, i: 0 };
    var s = current;
    s.move = function (d) { s.i = (s.i + d + list.length) % list.length; render(); };
    var t = triCells(list[s.i]);
    var trio = h("div", { class: "trio" }, [
      h("div", { class: "trio-card" }, [h("div", { class: "trio-label" }, ["English"]), t.en]),
      h("div", { class: "trio-card" }, [h("div", { class: "trio-label", lang: "hi" }, ["हिंदी"]), t.hi]),
      h("div", { class: "trio-card" }, [h("div", { class: "trio-label", lang: "zh-Hans" }, ["中文"]), t.zh]),
    ]);
    addSwipe(trio, function () {}, function () { s.move(-1); }, function () { s.move(1); });
    app.appendChild(sideNav(deck, "trio"));
    app.appendChild(trio);
    app.appendChild(h("div", { class: "answer-row" }, [
      h("button", { class: "big plain", onclick: function () { s.move(-1); }, "aria-label": "Previous card" }, ["‹ Back"]),
      h("span", { class: "count" }, [(s.i + 1) + " / " + list.length]),
      h("button", { class: "big plain", onclick: function () { s.move(1); }, "aria-label": "Next card" }, ["Next ›"]),
    ]));
  }

  // ---------- settings ----------
  function renderSettings() {
    setTitle("Settings", "सेटिंग्स");
    function field(key, label, hi, type, ph) {
      return h("label", { class: "field" }, [
        h("span", {}, [label + " ", h("span", { lang: "hi", class: "muted" }, [hi])]),
        h("input", { type: type || "text", value: settings[key], placeholder: ph || "", inputmode: type === "number" ? "numeric" : null,
          oninput: function (e) { settings[key] = e.target.value; save(STORE_SETTINGS, settings); } }),
      ]);
    }
    function seg(key, opts, label) {
      return h("div", { class: "field" }, [
        h("span", {}, [label]),
        h("div", { class: "seg", role: "group", "aria-label": label }, opts.map(function (o) {
          return h("button", { class: settings[key] === o[0] ? "on" : "", "aria-pressed": String(settings[key] === o[0]),
            onclick: function () { settings[key] = o[0]; save(STORE_SETTINGS, settings); render(); } }, [o[1]]);
        })),
      ]);
    }
    app.appendChild(h("div", { class: "settings" }, [
      h("p", { class: "muted" }, ["These fill the blanks in the Sentences deck."]),
      field("name", "My name", "मेरा नाम", "text", "Asha"),
      field("city", "My city", "मेरा शहर", "text", "Delhi"),
      field("age", "My age", "मेरी आयु", "number", "7"),
      field("grade", "My grade", "मेरी कक्षा", "number", "2"),
      seg("gender", [["boy", "👦 Boy · rehta / ka"], ["girl", "👧 Girl · rehti / ki"]], "I am a"),
      seg("dir", [["hi-en", "Hindi → English"], ["en-hi", "English → Hindi"], ["mixed", "Mixed"]], "Card front"),
      h("div", { class: "field" }, [
        h("span", {}, ["Voices"]),
        h("p", { class: "muted" }, [
          ["hi-IN", "zh-CN", "en-US"].map(function (l) { return l + (Speech.has(l) ? " ✓" : " ✗"); }).join(" · "),
          " — speaker buttons appear only for languages with a voice.",
        ]),
      ]),
      h("button", { class: "big plain danger", onclick: function () {
        if (confirm("Reset all stars and progress?")) { progress = {}; save(STORE_PROGRESS, progress); go(""); }
      } }, ["Reset progress"]),
    ]));
  }

  // ---------- boot ----------
  fetch("data/cards.json").then(function (r) { return r.json(); }).then(function (d) {
    DATA = d; render();
  }).catch(function (e) {
    app.textContent = "Could not load cards: " + e.message;
  });

  var isAndroidShell = location.hostname === "appassets.androidplatform.net";
  if ("serviceWorker" in navigator && !isAndroidShell && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
