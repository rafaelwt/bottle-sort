/*
 * Magic Sort web — UI y bucle de juego.
 *
 * Fuentes de la lógica y los datos (ver README):
 *  - Reglas: water-sort con capacidad POR BOTELLA (4 clásico, 12/16 botellas largas).
 *  - Niveles: 3 613 TextAssets de com.grandgames.magicsort 0.0.3420 en 4 modos.
 *  - Economía/boosters: modelos RemoteConfig del mismo APK.
 *
 * Monedas ilimitadas por defecto (modo exploración).
 */
(function () {
  "use strict";

  var E = window.MagicSortEngine;
  var CATALOG = window.MAGIC_SORT_CATALOG || {};

  var COLORS = {
    0: "#4fc3f7", 1: "#1e6fd9", 2: "#ff8a3d", 3: "#8bc34a", 4: "#2e7d32",
    5: "#f2f2f2", 6: "#7b1030", 7: "#8d5524", 8: "#ffd23f", 9: "#9b30ff",
    10: "#ff6fae", 11: "#e53935", 12: "transparent", 13: "#9e9e9e",
    14: "#ff4d6d", 15: "#ffb703", 16: "#219ebc", 17: "#00c853", 18: "#d4a017",
    19: "#d81b60", 20: "#4dd0b1", 21: "#b39ddb", 22: "#d9c7a3"
  };
  var COLOR_NAMES = {
    0: "azul claro", 1: "azul", 2: "naranja", 3: "verde claro", 4: "verde", 5: "blanco",
    6: "vino", 7: "marrón", 8: "amarillo", 9: "violeta", 10: "rosa", 11: "rojo",
    13: "gris", 17: "esmeralda", 18: "mostaza", 19: "fucsia", 20: "menta",
    21: "lavanda", 22: "beige"
  };

  // Economía leída de los modelos RemoteConfig del APK.
  var ECO = {
    initialCoins: 1000,
    initialBoosters: { undo: 3, shuffle: 3, extra: 3, reveal: 3 },
    unlockBoostersAt: 15,
    price: { undo: 300, shuffle: 300, extra: 900, reveal: 900 },
    unlimitedCoins: true
  };

  // superficie del líquido: sprites Ellipse<Color> incluidos en sprites/
  var SURFACE_SPRITES = {
    0: "surface-0.png", 1: "surface-1.png", 2: "surface-2.png", 3: "surface-3.png",
    4: "surface-4.png", 5: "surface-5.png", 6: "surface-6.png", 7: "surface-7.png",
    8: "surface-8.png", 9: "surface-9.png", 10: "surface-10.png", 11: "surface-11.png",
    13: "surface-13.png", 17: "surface-17.png", 18: "surface-18.png", 19: "surface-19.png",
    20: "surface-20.png", 21: "surface-21.png", 22: "surface-22.png"
  };

  var SAVE_KEY = "magicsort.web.v2";

  /* ---------------- estado persistente ---------------- */
  function defaultSave() {
    var modes = Object.keys(CATALOG);
    var levelsByMode = {};
    modes.forEach(function (m) { levelsByMode[m] = 0; });
    return {
      mode: modes[0] || "classic",
      levelsByMode: levelsByMode,
      coins: ECO.initialCoins,
      unlimited: ECO.unlimitedCoins,
      boosters: Object.assign({}, ECO.initialBoosters),
      stars: {},
      best: {},
      sound: true
    };
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      var data = JSON.parse(raw);
      var base = defaultSave();
      return Object.assign(base, data, {
        boosters: Object.assign(base.boosters, data.boosters || {}),
        levelsByMode: Object.assign(base.levelsByMode, data.levelsByMode || {})
      });
    } catch (err) {
      return defaultSave();
    }
  }

  var save = loadSave();
  function persist() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (err) { /* modo privado */ }
  }

  /* ---------------- niveles ---------------- */
  var LEVELS = [];
  function modeLevels() {
    var def = CATALOG[save.mode];
    return def ? def.levels : [];
  }
  function modeLabel() {
    var def = CATALOG[save.mode];
    return def ? def.label : "";
  }

  function loadMode(mode, index) {
    if (!CATALOG[mode]) mode = Object.keys(CATALOG)[0];
    save.mode = mode;
    LEVELS = modeLevels().map(E.normalizeLevel);
    save.levelsByMode[mode] = Math.max(0, Math.min(LEVELS.length - 1, index || 0));
    persist();
    startLevel(save.levelsByMode[mode]);
  }

  /* ---------------- DOM ---------------- */
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $("board");
  var hintEl = $("hintLine");
  var levelLabel = $("levelLabel");
  var movesLabel = $("movesLabel");
  var coinsLabel = $("coinsLabel");
  var winOverlay = $("winOverlay");
  var levelsOverlay = $("levelsOverlay");
  var modeTabs = $("modeTabs");

  var game = null;

  /* ---------------- audio: clips originales del APK (sounds/*.ogg|mp3) ---------------- */
  var SFX_FILES = {
    select: "bottle_up", place: "bottle_down", complete: "green_check", win: "win_screen",
    button: "button", cork: "bottle_cork", curtain: "curtain", clay: "clay_break_v2", bubble: "bubble",
    pour1: "p_short_1", pour2: "p_short_2", pour3: "p_short_3", pour4: "p_short_4", pour5: "p_short_5",
    pour6: "n_short_6", pour7: "n_short_7", pour8: "n_short_8"
  };
  // SoundType del APK: PourShort1..5 (1-5 unidades), n_short_6..8 (6-8).
  var audioExt = (function () {
    try {
      var probe = document.createElement("audio");
      if (probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"')) return ".ogg";
    } catch (err) { /* sin Audio */ }
    return ".mp3";
  })();
  var sfxCache = {};

  function sfx(name) {
    if (!save.sound) return;
    var file = SFX_FILES[name];
    if (!file) return;
    var url = "sounds/" + file + audioExt;
    try {
      var base = sfxCache[url];
      if (!base) { base = new Audio(url); base.preload = "auto"; sfxCache[url] = base; }
      var node = base.cloneNode();
      node.volume = name.indexOf("pour") === 0 ? 0.5 : 0.65;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (err) { /* audio bloqueado: seguimos sin sonido */ }
  }

  function sfxPour(amount) { sfx("pour" + Math.max(1, Math.min(8, amount))); }

  /* ---------------- utilidades ---------------- */
  function hint(text) { hintEl.textContent = text; }

  function tint(hex) {
    return "linear-gradient(180deg, " + hex + " 0%, " + hex + " 62%, rgba(0,0,0,.22) 100%), " + hex;
  }

  // Filas por coordenada Y real del nivel; botellas largas ocupan su altura completa.
  function rowsOfLevel(level) {
    var rows = [];
    if (level.grid && level.grid.length === level.bottles.length) {
      var byY = new Map();
      level.grid.forEach(function (g, i) {
        var key = Math.round(g.y * 100) / 100;
        if (!byY.has(key)) byY.set(key, []);
        byY.get(key).push({ index: i, x: g.x });
      });
      Array.from(byY.keys()).sort(function (a, b) { return b - a; }).forEach(function (y) {
        rows.push(byY.get(y).sort(function (a, b) { return a.x - b.x; }).map(function (r) { return r.index; }));
      });
      return rows;
    }
    for (var i = 0; i < level.bottles.length; i += 6) {
      rows.push(Array.from({ length: Math.min(6, level.bottles.length - i) }, function (_, k) { return i + k; }));
    }
    return rows;
  }

  // Tamaño de celda para que el tablero entre en pantalla, sea 4 o 16 celdas de alto.
  function computeSeg(level, magicIndex) {
    var maxCap = 1;
    level.caps.forEach(function (c) { maxCap = Math.max(maxCap, c); });
    var rows = rowsOfLevel(level);
    var tallestRow = 0;
    rows.forEach(function (row) {
      var h = 0;
      row.forEach(function (i) { h = Math.max(h, level.caps[i]); });
      tallestRow = Math.max(tallestRow, h);
    });
    var stack = 0;
    rows.forEach(function (row) {
      var h = 0;
      row.forEach(function (i) { h = Math.max(h, level.caps[i]); });
      stack += h;
    });
    var availH = Math.max(220, window.innerHeight - 210);
    var availW = Math.max(220, Math.min(window.innerWidth - 20, 780));
    var perRowMax = 1;
    rows.forEach(function (row) { perRowMax = Math.max(perRowMax, row.length); });
    // CSS: ancho de botella = seg * 1.28 + 10, separación = clamp(4, 1.1vw, 14)
    var gap = Math.max(4, Math.min(14, window.innerWidth * 0.011));
    var slot = (availW - (perRowMax - 1) * gap) / perRowMax;
    var segByW = (slot - 10) / 1.28;
    var segByH, seg2W;
    if (magicIndex >= 0) {
      // la botella mágica manda en alto; a la derecha van las filas de botellas normales
      var bigCap = level.caps[magicIndex] || 16;
      var rowStack = 0;
      rows.forEach(function (row) {
        var h = 0;
        row.forEach(function (i) { if (i !== magicIndex) h = Math.max(h, level.caps[i]); });
        rowStack += h;
      });
      var n = Math.max(1, perRowMax - (rows.some(function (r) { return r.indexOf(magicIndex) >= 0; }) ? 1 : 0));
      var slotM = (availW - n * gap) / (n + 1);
      seg2W = (slotM - 10) / 1.28;
      segByH = Math.min(availH / bigCap, availH / Math.max(rowStack, 1));
      segByW = Math.min(segByW, seg2W);
    } else {
      segByH = availH / (stack + (rows.length - 1) * 0.6);
    }
    var seg = Math.floor(Math.min(segByH, segByW, 46));
    return Math.max(9, Math.min(46, seg || 44));
  }

  /* ---------------- partida ---------------- */
  function startLevel(index) {
    LEVELS = modeLevels().map(E.normalizeLevel);
    if (!LEVELS.length) { hint("Este modo no tiene niveles."); return; }
    var i = Math.max(0, Math.min(LEVELS.length - 1, index));
    var level = LEVELS[i];
    save.levelsByMode[save.mode] = i;
    persist();
    var magicIndex = E.findMagicBottle(level);
    var rows = rowsOfLevel(level);
    if (magicIndex >= 0) {
      rows = rows.map(function (row) { return row.filter(function (ix) { return ix !== magicIndex; }); })
                 .filter(function (row) { return row.length > 0; });
    }
    game = {
      index: i,
      level: level,
      magicIndex: magicIndex,
      state: E.stateFromLevel(level),
      history: [],
      moves: 0,
      selected: null,
      busy: false,
      done: false,
      revealed: false,
      rows: rows,
      par: computePar(level)
    };
    boardEl.style.setProperty("--seg", computeSeg(level, magicIndex) + "px");
    winOverlay.hidden = true;
    levelLabel.textContent = String(i + 1);
    coinsLabel.textContent = save.unlimited ? "∞" : String(save.coins);
    movesLabel.textContent = "0";
    hint(game.magicIndex >= 0
      ? "Llena la botella mágica con un solo color (" + level.caps[game.magicIndex] + " unidades)"
      : modeLabel() + " · " + level.colors + " colores · toca una botella y luego otra");
    render();
  }

  function computePar(level) {
    var st = E.stateFromLevel(level);
    var opt = bfsOptimal(st, 24000);
    if (opt) return opt;
    var sol = E.solve(st, { limit: 90000 });
    if (sol.solvable) return Math.max(level.colors + 2, Math.ceil(sol.moves.length * 0.8));
    return Math.max(level.colors + 2, level.colors * 3);
  }

  function bfsOptimal(state, limit) {
    var won = function (s) { return E.isWon(s); };
    var frontier = [state];
    var depth = [0];
    var seen = Object.create(null);
    seen[E.keyOf(state)] = true;
    var expanded = 0;
    while (frontier.length && expanded < limit) {
      var cur = frontier.shift();
      var d = depth.shift();
      if (won(cur)) return d;
      var moves = E.candidateMoves(cur);
      for (var i = 0; i < moves.length; i++) {
        var res = E.pour(cur, moves[i].from, moves[i].to);
        if (!res) continue;
        var k = E.keyOf(res.state);
        if (seen[k]) continue;
        seen[k] = true;
        expanded++;
        frontier.push(res.state);
        depth.push(d + 1);
      }
    }
    return null;
  }

  function render(enter) {
    boardEl.textContent = "";
    var st = game.state;
    function rowNode(row) {
      var rowEl = document.createElement("div");
      rowEl.className = "row";
      row.forEach(function (index) { rowEl.appendChild(bottleEl(index, enter)); });
      return rowEl;
    }
    if (game.magicIndex >= 0) {
      boardEl.className = "board magic";
      var col = document.createElement("div");
      col.className = "magic-col";
      col.appendChild(bottleEl(game.magicIndex, enter));
      var rowsWrap = document.createElement("div");
      rowsWrap.className = "rows";
      game.rows.forEach(function (row) { rowsWrap.appendChild(rowNode(row)); });
      boardEl.appendChild(col);
      boardEl.appendChild(rowsWrap);
    } else {
      boardEl.className = "board";
      game.rows.forEach(function (row) { boardEl.appendChild(rowNode(row)); });
    }
    movesLabel.textContent = String(game.moves);
    coinsLabel.textContent = save.unlimited ? "∞" : String(save.coins);
    updateBoosterButtons();
  }

  function bottleEl(index, enter) {
    var st = game.state;
    var bottle = st.bottles[index];
    var cap = st.caps[index] || 4;
    // La botella mágica siempre muestra su color semilla (el OBIM 6 que trae es
    // parte del arte del "pillow", no un bloqueador real).
    var hidden = index !== game.magicIndex && !game.revealed && E.isHidden(st, index);
    var el = document.createElement("button");
    el.type = "button";
    el.className = "bottle";
    el.dataset.index = String(index);
    el.style.setProperty("--cap", String(cap));
    el.setAttribute("aria-label", "Botella " + (index + 1) + ", " + bottle.length + " de " + cap);
    if (index === game.magicIndex) el.classList.add("magic");
    if (game.selected === index) el.classList.add("selected");
    if (E.isComplete(st, index)) el.classList.add("complete");

    var glass = document.createElement("span");
    glass.className = "glass";
    var water = document.createElement("span");
    water.className = "water";
    glass.appendChild(water);
    var surface = SURFACE_SPRITES[bottle[bottle.length - 1]];
    bottle.forEach(function (color, i) {
      var liq = document.createElement("span");
      liq.className = "liquid" + (i === bottle.length - 1 ? " top" : "");
      liq.style.setProperty("--i", String(i));
      liq.style.setProperty("--c", tint(COLORS[color] || "#888"));
      if (hidden) liq.classList.add("hidden-fill");
      if (i === bottle.length - 1 && surface) liq.style.setProperty("--surface", 'url("sprites/' + surface + '")');
      if (enter && enter.to === index && i >= bottle.length - enter.count) liq.classList.add("enter");
      water.appendChild(liq);
    });
    var frame = document.createElement("span");
    frame.className = "frame";
    glass.appendChild(frame);
    el.appendChild(glass);

    var cork = document.createElement("span");
    cork.className = "cork";
    el.appendChild(cork);

    var blocker = index === game.magicIndex ? null : E.blockerOf(st, index);
    if (blocker) {
      var node = document.createElement("span");
      node.className = "blocker " + blocker.type;
      if (blocker.type === "tag") node.style.setProperty("--tag-color", COLORS[blocker.color] || "#4fc3f7");
      el.appendChild(node);
    }
    return el;
  }

  function flashShake(index) {
    var el = boardEl.querySelector('[data-index="' + index + '"]');
    if (!el) return;
    el.classList.add("shake");
    setTimeout(function () { el.classList.remove("shake"); }, 340);
  }

  function onBottleClick(index) {
    if (!game || game.busy || game.done) return;
    var st = game.state;

    if (game.selected === null) {
      if (!st.bottles[index].length) {
        hint("Esa botella está vacía: elige una con líquido.");
        sfx("bubble");
        return;
      }
      game.selected = index;
      var top = E.topColor(st.bottles[index]);
      hint("Seleccionada: " + (COLOR_NAMES[top] || "color " + top) + ". Elige el destino.");
      render();
      return;
    }

    if (game.selected === index) {
      game.selected = null;
      sfx("place");
      hint("Selección cancelada.");
      render();
      return;
    }

    var res = E.pour(st, game.selected, index);
    if (!res) {
      flashShake(index);
      sfx("bubble");
      hint("No puedes verter ahí: el color no coincide o la botella está llena.");
      return;
    }
    animatePour(game.selected, index, res);
  }

  function animatePour(from, to, res) {
    game.busy = true;
    var fromEl = boardEl.querySelector('[data-index="' + from + '"]');
    var toEl = boardEl.querySelector('[data-index="' + to + '"]');
    var dir = "right";
    if (fromEl && toEl) {
      dir = toEl.getBoundingClientRect().left >= fromEl.getBoundingClientRect().left ? "right" : "left";
    }
    var sign = dir === "right" ? 1 : -1;   // dir es string: nunca usarlo en aritmética
    var amount = res.count;
    var color = COLORS[res.color] || "#888";
    var startLevel = res.state.bottles[to].length - amount;

    // 1) la botella sube y se traslada sobre el destino, luego se inclina
    //    (BottleAnimationConfig: _riseBottleDuration + _moveToTargetSpeed/_moveToTargetAnimationCurve)
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    if (fromEl && toEl) {
      var fr = fromEl.getBoundingClientRect();
      var tr = toEl.getBoundingClientRect();
      var shiftX = (tr.left + tr.width / 2) - (fr.left + fr.width / 2) - sign * (fr.width * 0.52);
      var shiftY = -(fr.height * 0.34) - seg * 0.5;
      fromEl.classList.add("pouring");
      fromEl.style.transform = "translate(" + shiftX + "px, " + shiftY + "px) rotate(" + (dir === "right" ? 52 : -52) + "deg)";
      toEl.style.zIndex = "3";
    }
    var stream = showStream(fromEl, toEl, color, dir, startLevel, seg);
    sfx("select");

    // 2) se aplica el resultado del vertido (_applyResultForTargetAt)
    game.history.push({
      bottles: game.state.bottles.map(function (b) { return b.slice(); }),
      blockers: Object.assign({}, game.state.blockers)
    });
    game.state = res.state;
    game.moves += 1;
    game.selected = null;
    movesLabel.textContent = String(game.moves);

    var stagger = Math.max(55, Math.min(110, 420 / amount)); // _animationDelay por unidad
    boardEl.style.setProperty("--stagger", stagger + "ms");
    setTimeout(function () {
      sfxPour(amount);                        // PourShort/Mid/Long según cantidad
      addUnits(toEl, to, amount, stagger);     // el destino se llena gota a gota
      for (var u = 0; u < amount; u++) {
        (function (unit) {
          setTimeout(function () {
            splashAtUnit(toEl, startLevel + unit + 1, color);
          }, unit * stagger + 30);
        })(u);
      }
      drainUnits(fromEl, from, amount, stagger); // el origen se vacía en sincronía
      squish(toEl);                            // _shrink / _stretch del frasco
      setTimeout(function () {
        removeStream(stream);
        if (fromEl) {
          fromEl.classList.remove("pouring");
          fromEl.style.transform = "";
        }
        if (toEl) toEl.style.zIndex = "";
        sfx("place");
        game.busy = false;
        updateBoosterButtons();
        var completed = E.isComplete(game.state, to);
        if (completed) {
          sfx("cork");              // SoundType.BottleCork: aparece el tapón
          if (toEl) toEl.classList.add("complete");
          pulse(toEl);
          setTimeout(function () { sfx("complete"); }, 140);
        }
        if (E.isWon(game.state)) { finishLevel(); return; }
        hint(completed ? "¡Botella completada!" : "Sigue así: " + remainingBottles() + " botellas por resolver.");
      }, amount * stagger + 190);
    }, 190);
  }

  /* --- animaciones parciales (sin re-render completo) --- */
  function liquidNode(colorIndex, index, k) {
    var liq = document.createElement("span");
    liq.className = "liquid" + (index === 0 ? "" : "");
    liq.style.setProperty("--i", String(index));
    liq.style.setProperty("--c", tint(colorOf(colorIndex)));
    liq.classList.add("enter");
    if (k) liq.style.setProperty("--k", String(k));
    return liq;
  }

  function addUnits(el, bottleIndex, amount, stagger) {
    if (!el) return;
    var glass = el.querySelector(".glass .water");
    var bottle = game.state.bottles[bottleIndex];
    var hidden = bottleIndex !== game.magicIndex && !game.revealed && E.isHidden(game.state, bottleIndex);
    for (var u = 0; u < amount; u++) {
      var index = bottle.length - amount + u;
      var node = liquidNode(bottle[index], index, u);
      if (index === bottle.length - 1) {
        var surf = SURFACE_SPRITES[bottle[index]];
        if (surf) node.style.setProperty("--surface", 'url("sprites/' + surf + '")');
      }
      if (hidden) node.classList.add("hidden-fill");
      if (index === bottle.length - 1) node.classList.add("top");
      glass.appendChild(node);
    }
    // re-marcar la superficie superior
    var olds = glass.querySelectorAll(".liquid.top");
    for (var i = 0; i < olds.length; i++) olds[i].classList.remove("top");
    var last = glass.querySelector('.liquid[style*="--i: ' + (bottle.length - 1) + '"]');
    if (last) last.classList.add("top");
  }

  function drainUnits(el, bottleIndex, amount, stagger) {
    if (!el) return;
    var liquids = Array.prototype.slice.call(el.querySelectorAll(".glass .water .liquid"));
    liquids.sort(function (a, b) {
      return parseFloat(b.style.getPropertyValue("--i")) - parseFloat(a.style.getPropertyValue("--i"));
    });
    liquids.slice(0, amount).forEach(function (node, k) {
      node.style.setProperty("--k", String(k));
      node.classList.add("drain");
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 260 + k * 0.0);
    });
  }

  function squish(el) {
    if (!el) return;
    el.classList.add("squash");
    setTimeout(function () { el.classList.remove("squash"); }, 320);
  }

  function pulse(el) {
    if (!el) return;
    el.classList.add("just-complete");
    setTimeout(function () { el.classList.remove("just-complete"); }, 620);
  }

  function colorOf(index) {
    return COLORS[index] || "#888";
  }

  function showStream(fromEl, toEl, color, dir, startLevel, seg) {
    if (!fromEl || !toEl) return null;
    var board = boardEl.getBoundingClientRect();
    var s = fromEl.getBoundingClientRect();
    var t = toEl.getBoundingClientRect();
    var unit = seg || 44;
    var cap = parseInt(toEl.style.getPropertyValue("--cap")) || 4;
    var lunit = unit * (1 - 0.52 / cap);
    // boca: ya trasladada sobre el destino; cae casi vertical hasta la superficie
    var sign = dir === "right" ? 1 : -1;
    var x1 = t.left - board.left + t.width / 2 + sign * 4;
    var y1 = s.top - board.top + s.height * 0.30;
    var x2 = t.left - board.left + t.width / 2 - sign * 2;
    var y2 = t.top - board.top + t.height - startLevel * lunit;
    var dx = x2 - x1, dy = Math.max(8, y2 - y1);
    var len = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;

    var node = document.createElement("span");
    node.className = "stream";
    node.style.left = x1 + "px";
    node.style.top = y1 + "px";
    node.style.height = Math.max(18, len - 22) + "px";
    node.style.transform = "rotate(" + (angle - 90) + "deg)";
    node.style.setProperty("--stream-color", color);
    boardEl.appendChild(node);
    return node;
  }

  // una salpicadura y tres gotas por cada unidad que cae en el frasco
  function splashAtUnit(toEl, unitIndex, color) {
    if (!toEl) return;
    var board = boardEl.getBoundingClientRect();
    var t = toEl.getBoundingClientRect();
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    var cap = parseInt(toEl.style.getPropertyValue("--cap")) || 4;
    var lseg = seg * (1 - 0.52 / cap);
    var x = t.left - board.left + t.width / 2;
    var y = t.top - board.top + t.height - unitIndex * lseg;
    var splash = document.createElement("span");
    splash.className = "splash";
    splash.style.left = x + "px";
    splash.style.top = y + "px";
    splash.style.setProperty("--splash-color", color);
    boardEl.appendChild(splash);
    setTimeout(function () { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 380);

    for (var i = 0; i < 3; i++) {
      var drop = document.createElement("span");
      drop.className = "droplet";
      drop.style.left = x + "px";
      drop.style.top = y + "px";
      drop.style.setProperty("--splash-color", color);
      drop.style.setProperty("--dx", ((i - 1) * 9 + (Math.random() * 6 - 3)) + "px");
      drop.style.setProperty("--dy", (-14 - Math.random() * 10) + "px");
      boardEl.appendChild(drop);
      (function (node) { setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 460); })(drop);
    }
  }

  function removeStream(node) {
    if (!node) return;
    node.classList.add("fade");
    setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 180);
  }

  function remainingBottles() {
    var pending = 0;
    for (var i = 0; i < game.state.bottles.length; i++) {
      if (game.state.bottles[i].length && !E.isComplete(game.state, i)) pending++;
    }
    return pending;
  }

  function finishLevel() {
    game.done = true;
    var par = game.par || 20;
    var stars = game.moves <= par ? 3 : game.moves <= Math.round(par * 1.5) ? 2 : 1;
    var reward = game.level.tier >= 5 ? 100 : game.level.tier >= 3 ? 60 : 20;
    var key = save.mode + ":" + game.index;

    if (stars > (save.stars[key] || 0)) save.stars[key] = stars;
    if (!save.best[key] || game.moves < save.best[key]) save.best[key] = game.moves;
    if (!save.unlimited) save.coins += reward;
    persist();

    $("winSub").textContent = game.moves + " movimientos · par " + par;
    $("winCoins").textContent = save.unlimited ? "monedas ∞" : "+" + reward;
    var starEls = $("winStars").children;
    for (var i = 0; i < starEls.length; i++) starEls[i].className = i < stars ? "on" : "";
    winOverlay.hidden = false;
    sfx("win");
    render();
  }

  /* ---------------- boosters ---------------- */
  function boosterUnlocked() {
    return save.unlimited || game.index + 1 >= ECO.unlockBoostersAt;
  }

  function spendBooster(kind) {
    if (save.unlimited) return true;
    if (save.boosters[kind] > 0) {
      save.boosters[kind] -= 1;
      persist();
      return true;
    }
    if (boosterUnlocked() && save.coins >= ECO.price[kind]) {
      save.coins -= ECO.price[kind];
      persist();
      hint("Compraste " + kind + " por " + ECO.price[kind] + " monedas.");
      return true;
    }
    hint("Sin usos de " + kind + " y no alcanza para comprar (" + ECO.price[kind] + " monedas).");
    sfx("bubble");
    return false;
  }

  function updateBoosterButtons() {
    ["undo", "shuffle", "extra", "reveal"].forEach(function (kind) {
      var btn = document.querySelector('[data-booster="' + kind + '"]');
      if (!btn) return;
      var countEl = btn.querySelector("[data-count]");
      if (countEl) {
        if (save.unlimited) { countEl.textContent = "∞"; countEl.hidden = false; }
        else {
          var left = save.boosters[kind] || 0;
          countEl.textContent = String(left);
          countEl.hidden = left === 0 && !boosterUnlocked();
        }
      }
      if (kind === "undo") btn.disabled = !game || game.history.length === 0 || game.busy;
      else if (kind === "reveal") btn.disabled = !game || game.revealed || game.busy;
      else btn.disabled = !game || game.busy || game.done;
    });
  }

  function doUndo() {
    if (!game || !game.history.length || game.busy) return;
    if (!spendBooster("undo")) return;
    var snap = game.history.pop();
    game.state = { bottles: snap.bottles, caps: game.state.caps.slice(), blockers: snap.blockers };
    game.selected = null;
    game.moves = Math.max(0, game.moves - 1);
    hint("Movimiento deshecho.");
    render();
  }

  function doShuffle() {
    if (!game || game.busy || game.done) return;
    if (!spendBooster("shuffle")) return;

    var state = game.state;
    var shape = state.bottles.map(function (b) { return b.length; });
    var pool = [];
    state.bottles.forEach(function (b) { pool.push.apply(pool, b); });
    var rng = E.mulberry32((game.index + 1) * 7919 + game.moves * 31 + (Date.now() % 1000));

    for (var attempt = 0; attempt < 25; attempt++) {
      var shuffled = shuffleArray(pool.slice(), rng);
      var bottles = [];
      var cursor = 0;
      for (var i = 0; i < shape.length; i++) {
        bottles.push(shuffled.slice(cursor, cursor + shape[i]));
        cursor += shape[i];
      }
      var candidate = { bottles: bottles, caps: state.caps.slice(), blockers: Object.assign({}, state.blockers) };
      if (E.isSolvable(candidate, { limit: 40000 })) {
        game.history.push({
          bottles: state.bottles.map(function (b) { return b.slice(); }),
          blockers: Object.assign({}, state.blockers)
        });
        game.state = candidate;
        game.selected = null;
        game.moves += 1;
        hint("Mezclado (solución verificada).");
        render();
        return;
      }
    }
    hint("No se encontró una mezcla resoluble; no se gastó el uso.");
    render();
  }

  function shuffleArray(list, rng) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  function doExtra() {
    if (!game || game.busy || game.done) return;
    if (!spendBooster("extra")) return;
    var cap = game.level.caps[game.level.caps.length - 1] || 4;
    game.history.push({
      bottles: game.state.bottles.map(function (b) { return b.slice(); }),
      blockers: Object.assign({}, game.state.blockers)
    });
    game.state.bottles.push([]);
    game.state.caps = game.state.caps.concat([cap]);
    game.rows = appendRowCell(game.rows, game.state.bottles.length - 1);
    boardEl.style.setProperty("--seg", computeSeg(game.level, game.magicIndex) + "px");
    hint("Botella extra añadida.");
    render();
  }

  function appendRowCell(rows, index) {
    var copy = rows.map(function (r) { return r.slice(); });
    var last = copy[copy.length - 1] || [];
    if (last.length < 7) last.push(index);
    else copy.push([index]);
    return copy;
  }

  function doReveal() {
    if (!game || game.revealed || game.busy) return;
    if (!spendBooster("reveal")) return;
    game.revealed = true;
    hint("Contenidos revelados por este nivel.");
    render();
  }

  function doRestart() {
    if (!game || game.busy) return;
    sfx("button");
    startLevel(game.index);
    hint("Nivel reiniciado.");
  }

  /* ---------------- mapa de niveles ---------------- */
  function buildModeTabs() {
    modeTabs.textContent = "";
    Object.keys(CATALOG).forEach(function (mode) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mode-tab" + (mode === save.mode ? " active" : "");
      btn.textContent = CATALOG[mode].label;
      btn.addEventListener("click", function () {
        levelsOverlay.hidden = true;
        loadMode(mode, 0);
      });
      modeTabs.appendChild(btn);
    });
  }

  function buildLevelsGrid() {
    var grid = $("levelsGrid");
    grid.textContent = "";
    LEVELS.forEach(function (level, i) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "level-cell";
      cell.textContent = String(i + 1);
      if (save.stars[save.mode + ":" + i]) cell.classList.add("done");
      if (i === game.index) cell.classList.add("current");
      cell.addEventListener("click", function () {
        levelsOverlay.hidden = true;
        startLevel(i);
      });
      grid.appendChild(cell);
    });
  }

  /* ---------------- eventos ---------------- */
  boardEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest(".bottle");
    if (!btn) return;
    onBottleClick(Number(btn.dataset.index));
  });

  $("btnUndo").addEventListener("click", doUndo);
  $("btnShuffle").addEventListener("click", doShuffle);
  $("btnExtra").addEventListener("click", doExtra);
  $("btnReveal").addEventListener("click", doReveal);
  $("btnRestart").addEventListener("click", doRestart);
  $("btnNext").addEventListener("click", function () {
    startLevel(Math.min(LEVELS.length - 1, game.index + 1));
  });
  $("btnLevels").addEventListener("click", function () {
    buildModeTabs();
    buildLevelsGrid();
    levelsOverlay.hidden = false;
  });
  $("btnCloseLevels").addEventListener("click", function () { levelsOverlay.hidden = true; });
  levelsOverlay.addEventListener("click", function (ev) {
    if (ev.target === levelsOverlay) levelsOverlay.hidden = true;
  });
  $("btnSound").addEventListener("click", function () {
    save.sound = !save.sound;
    persist();
    this.textContent = save.sound ? "🔊" : "🔇";
  });
  window.addEventListener("resize", function () {
    if (game) boardEl.style.setProperty("--seg", computeSeg(game.level, game.magicIndex) + "px");
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "z" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); doUndo(); }
    if (ev.key === "r" && !ev.ctrlKey && !ev.metaKey) doRestart();
  });

  /* ---------------- arranque ---------------- */
  $("btnSound").textContent = save.sound ? "🔊" : "🔇";
  buildModeTabs();
  loadMode(save.mode, save.levelsByMode[save.mode] || 0);

  window.__magicSort = {
    startLevel: startLevel,
    loadMode: loadMode,
    state: function () { return game; },
    click: onBottleClick,
    save: function () { return save; },
    levelCount: function () { return LEVELS.length; },
    modes: function () { return Object.keys(CATALOG).map(function (m) { return { key: m, label: CATALOG[m].label, count: CATALOG[m].levels.length }; }); }
  };
})();
