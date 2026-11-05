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

  // Paleta exacta del juego: ColorConfig.Color de cada ColorId (assets del APK).
  var COLORS = {
    "-1": "#04010d",
    0: "#0198d8", 1: "#1616bf", 2: "#e45900", 3: "#70a502", 4: "#0b3c01",
    5: "#5d64a6", 6: "#6b0052", 7: "#70322b", 8: "#fcc006", 9: "#5f1e8e",
    10: "#fe6fd7", 11: "#c40602", 12: "transparent", 13: "#262626",
    17: "#067c65", 18: "#b08000", 19: "#d72c89", 20: "#00ce95",
    21: "#9d54f4", 22: "#b0ab85"
  };
  // Capas laterales del agua: el juego pinta el borde izquierdo con FrontColor y el
  // derecho con BackColor (WaterView._leftSprite / _rightSprite). Es sombreado
  // HORIZONTAL: no toca la unión entre colores.
  var FRONTS = {
    0: "#0098d7", 1: "#94a6ff", 2: "#ffb04f", 3: "#74e97f", 4: "#5cc75f",
    5: "#8d7ffd", 6: "#d98bc8", 7: "#8d8472", 8: "#faea9c", 9: "#cd8bff",
    10: "#ffb6f3", 11: "#ffb6b1", 13: "#e8e8e8", 17: "#02a886", 18: "#d18425",
    19: "#ff8dec", 20: "#00ce95", 21: "#cd8bff", 22: "#c3be93"
  };
  var BACKS = {
    0: "#51a8ec", 1: "#2d2bd9", 2: "#cc6519", 3: "#85bd0c", 4: "#0b3d02",
    5: "#6e73c8", 6: "#8f0d70", 7: "#943e37", 8: "#f9cb0d", 9: "#7f34b7",
    10: "#fe6fd8", 11: "#dc231f", 13: "#4a4a4a", 17: "#07b08a", 18: "#b18000",
    19: "#ff45cd", 20: "#00ce95", 21: "#7f34b7", 22: "#c5b75c"
  };

  // Brillo del tapón al completar (ColorConfig.StopperGlowColor del APK).
  var GLOWS = {
    0: "#0198d8", 1: "#1616bf", 2: "#e45900", 3: "#70a502", 4: "#0b3c01",
    5: "#5d64a6", 6: "#6b0052", 7: "#70322b", 8: "#fcc006", 9: "#5f1e8e",
    10: "#fe6fd7", 11: "#c40602", 13: "#262626", 17: "#016f59", 18: "#e0a403",
    19: "#ff3dca", 20: "#01d8ab", 21: "#5f1e8e", 22: "#bfb98e"
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

  /* ---------------- música de fondo (MagicSort_Gameplay_Final) ---------------- */
  var music = null;
  var MUSIC_VOLUME = 0.30;

  function startMusic() {
    if (!save.sound) return;
    if (!music) {
      music = new Audio("sounds/gameplay_music" + audioExt);
      music.loop = true;
      music.preload = "auto";
      music.volume = MUSIC_VOLUME;
    }
    var p = music.play();
    if (p && p.catch) p.catch(function () {});
  }

  function stopMusic() {
    if (!music) return;
    music.pause();
  }

  function syncMusic() {
    if (save.sound) startMusic(); else stopMusic();
  }

  /* ---------------- utilidades ---------------- */
  function hint(text) { hintEl.textContent = text; }

  // El agua del juego es color plano: la profundidad la da la elipse de la
  // superficie y el vidrio. Nada de degradados por tramo.
  function tint(hex) {
    return hex;
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

  function render() {
    boardEl.textContent = "";
    var st = game.state;
    function rowNode(row) {
      var rowEl = document.createElement("div");
      rowEl.className = "row";
      row.forEach(function (index) { rowEl.appendChild(bottleEl(index)); });
      return rowEl;
    }
    if (game.magicIndex >= 0) {
      boardEl.className = "board magic";
      var col = document.createElement("div");
      col.className = "magic-col";
      col.appendChild(bottleEl(game.magicIndex));
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

  /* ---------------- agua: un nodo por tramo de color ----------------
     Agrupar unidades del mismo color evita los biseles internos (que hacían
     que una columna llena pareciera una pila de discos) y permite animar el
     nivel como una sola superficie continua. */
  function bottleHidden(index) {
    return index !== game.magicIndex && !game.revealed && E.isHidden(game.state, index);
  }

  function runNode(color, start, count, isTop) {
    var node = document.createElement("span");
    node.className = "liquid" + (isTop ? " top" : "");
    node.style.setProperty("--i", String(start));
    node.style.setProperty("--n", String(count));
    node.style.setProperty("--c", tint(COLORS[color] || "#888"));
    if (FRONTS[color]) node.style.setProperty("--c-front", FRONTS[color]);
    if (BACKS[color]) node.style.setProperty("--c-back", BACKS[color]);
    node.dataset.color = String(color);
    if (isTop) {
      var surf = SURFACE_SPRITES[color];
      if (surf) node.style.setProperty("--surface", 'url("sprites/' + surf + '")');
    }
    return node;
  }

  function runsOf(bottle) {
    var runs = [];
    (bottle || []).forEach(function (color, i) {
      var last = runs[runs.length - 1];
      if (last && last.color === color) last.n += 1;
      else runs.push({ color: color, i: i, n: 1 });
    });
    return runs;
  }

  function paintWater(water, index) {
    water.textContent = "";
    var runs = runsOf(game.state.bottles[index] || []);
    var hidden = bottleHidden(index);
    runs.forEach(function (run, k) {
      var node = runNode(run.color, run.i, run.n, k === runs.length - 1);
      if (hidden) node.classList.add("hidden-fill");
      water.appendChild(node);
    });
  }

  function bottleEl(index) {
    var st = game.state;
    var bottle = st.bottles[index];
    var cap = st.caps[index] || 4;
    // La botella mágica siempre muestra su color semilla (el OBIM 6 que trae es
    // parte del arte del "pillow", no un bloqueador real).
    var el = document.createElement("button");
    el.type = "button";
    el.className = "bottle";
    el.dataset.index = String(index);
    el.style.setProperty("--cap", String(cap));
    el.setAttribute("aria-label", "Botella " + (index + 1) + ", " + bottle.length + " de " + cap);
    if (index === game.magicIndex) el.classList.add("magic");
    if (game.selected === index) el.classList.add("selected");
    if (E.isComplete(st, index)) {
      el.classList.add("complete");
      el.style.setProperty("--glow", GLOWS[E.topColor(bottle)] || "#59f0a8");
    }

    var glass = document.createElement("span");
    glass.className = "glass";
    var water = document.createElement("span");
    water.className = "water";
    paintWater(water, index);
    glass.appendChild(water);
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
      // En el juego, tocar un destino inválido cancela la selección sola
      // (Selection.TryCancel -> Deselect): la botella vuelve a su sitio.
      var why = !st.bottles[index].length || E.topColor(st.bottles[index]) !== E.topColor(st.bottles[game.selected])
        ? "Ese color no coincide." : "Esa botella está llena.";
      game.selected = null;
      render();
      sfx("place");
      hint(why + " Selección cancelada.");
      return;
    }
    animatePour(game.selected, index, res);
  }

  function animatePour(from, to, res) {
    game.busy = true;
    var fromEl = boardEl.querySelector('[data-index="' + from + '"]');
    var toEl = boardEl.querySelector('[data-index="' + to + '"]');
    if (!fromEl || !toEl) { game.busy = false; return; }

    var amount = res.count;
    var color = res.color;
    var colorCss = COLORS[color] || "#888";
    var startLevel = res.state.bottles[to].length - amount;

    var stageRect = document.querySelector(".stage").getBoundingClientRect();
    var fRect = fromEl.getBoundingClientRect();
    var tRect = toEl.getBoundingClientRect();
    var padTop = parseFloat(getComputedStyle(fromEl).paddingTop) || 14;
    var fOffset = transformOffset(fromEl);
    // getBoundingClientRect incluye el translateY de "selected"; la pose de
    // vertido se aplica sobre la posición de layout.
    var layoutLeft = fRect.left - fOffset.x;
    var layoutTop = fRect.top - fOffset.y;
    var mouthX = layoutLeft + fRect.width / 2;
    var mouthY = layoutTop + padTop;
    var dstX = tRect.left + tRect.width / 2;
    var dstY = tRect.top + padTop;
    var dir = dstX >= mouthX ? 1 : -1;

    // Rotación real del juego: BottleAnimationConfig._rotationsByHeights mapea
    // las celdas libres del destino a grados. Con el frasco casi lleno apenas
    // se inclina; con espacio se acuesta sobre la boca.
    var free = (res.state.caps[to] || 4) - startLevel;
    var ROTATIONS = [35, 65, 80, 85, 100, 105];   // EmptyCell 0..5
    var angle = ROTATIONS[Math.max(0, Math.min(ROTATIONS.length - 1, free))];

    // escala para que el cuerpo inclinado no se salga del escenario
    var rad = angle * Math.PI / 180;
    var bodyLen = fromEl.offsetHeight - padTop;
    var bodyW = fromEl.offsetWidth;
    var sideReach = Math.sin(rad) * bodyLen + Math.abs(Math.cos(rad)) * bodyW / 2;
    var upReach = Math.abs(Math.cos(rad)) * bodyLen + Math.sin(rad) * bodyW / 2;
    var sideRoom = dir === 1 ? dstX - stageRect.left - 10 : stageRect.right - dstX - 10;
    var upRoom = dstY - stageRect.top - 10;
    var scale = Math.min(1, sideRoom / Math.max(1, sideReach), upRoom / Math.max(1, upReach));
    scale = Math.max(0.5, Math.min(1, scale));

    var dx = dstX - mouthX;
    var dy = dstY - mouthY;
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    var lift = Math.max(12, Math.min(seg * 0.45, 24));    // _bottleSelectionAnimationHeight
    var hover = Math.max(18, Math.min(seg * 0.75, 34));   // _heightOffset sobre la boca destino
    var RISE_MS = 140, MOVE_MS = 210, TILT_MS = 130;

    // 1) la botella se eleva en su sitio (selección)
    fromEl.classList.remove("selected");
    fromEl.classList.add("pouring");
    fromEl.style.transformOrigin = "50% " + padTop + "px";
    fromEl.style.transitionDuration = RISE_MS + "ms";
    fromEl.style.transitionTimingFunction = "cubic-bezier(.3,.9,.3,1)";
    fromEl.style.transform = "translate(0px, " + (-lift) + "px)";
    toEl.style.zIndex = "3";
    sfx("select");
    hint("Vertiendo…");

    // 2) se aplica el resultado del vertido
    game.history.push({
      bottles: game.state.bottles.map(function (b) { return b.slice(); }),
      blockers: Object.assign({}, game.state.blockers)
    });
    game.state = res.state;
    game.moves += 1;
    game.selected = null;
    movesLabel.textContent = String(game.moves);

    var unitMs = Math.max(75, Math.min(140, 520 / amount));
    var pourMs = amount * unitMs;
    var ARRIVE = RISE_MS + MOVE_MS;

    // 3) se traslada hasta la boca del destino (sin inclinarse todavía)
    setTimeout(function () {
      fromEl.style.transitionDuration = MOVE_MS + "ms";
      fromEl.style.transitionTimingFunction = "cubic-bezier(.33,.1,.25,1)";
      fromEl.style.transform = "translate(" + dx + "px, " + (dy - hover) + "px)";
    }, RISE_MS);

    // 4) se inclina sobre la boca y el líquido se corre hacia el pico
    setTimeout(function () {
      fromEl.style.transitionDuration = TILT_MS + "ms";
      fromEl.style.transitionTimingFunction = "cubic-bezier(.3,.85,.35,1)";
      fromEl.style.transform = "translate(" + dx + "px, " + (dy - hover) + "px) rotate(" +
        (dir * angle) + "deg) scale(" + scale.toFixed(3) + ")";
      var fromWater = fromEl.querySelector(".glass .water");
      var oldLevel = res.state.bottles[from].length + amount;
      var cap = res.state.caps[from] || 4;
      if (fromWater) shiftWaterToMouth(fromWater, Math.max(0, cap - oldLevel), TILT_MS);
    }, ARRIVE);

    // fase 5: cae el agua y el origen se vacía en sincronía
    setTimeout(function () {
      var toWater = toEl.querySelector(".glass .water");
      var fromWater = fromEl.querySelector(".glass .water");
      if (!toWater || !fromWater) {
        game.busy = false;
        return;
      }
      fillWater(toWater, to, amount, color, startLevel, pourMs);
      drainWater(fromWater, amount, pourMs);
      var stream = showStream(toEl, colorCss, startLevel, amount, pourMs);
      sfxPour(amount);
      squish(toEl);

      for (var u = 0; u < amount; u++) {
        (function (unit) {
          setTimeout(function () {
            splashAtUnit(toEl, startLevel + unit + 1, colorCss);
          }, Math.round((unit + 1) * unitMs));
        })(u);
      }

      setTimeout(function () {
        paintWater(toWater, to);
        settleWater(fromWater, from, 180);
        fromEl.classList.remove("pouring");
        fromEl.style.transitionDuration = "";
        fromEl.style.transitionTimingFunction = "";
        fromEl.style.transform = "";
        fromEl.classList.toggle("complete", E.isComplete(game.state, from));
        toEl.style.zIndex = "";
        removeStream(stream);

        var completed = E.isComplete(game.state, to);
        if (completed) {
          toEl.classList.add("complete");
          pulse(toEl);
          setTimeout(function () { sfx("cork"); }, 120);
          setTimeout(function () { sfx("complete"); }, 260);
        }
        setTimeout(function () {
          fromEl.style.transformOrigin = "";
          sfx("place");
          game.busy = false;
          updateBoosterButtons();
          if (E.isWon(game.state)) { finishLevel(); return; }
          hint(completed ? "¡Botella completada!" : "Sigue así: " + remainingBottles() + " botellas por resolver.");
        }, 200);
      }, pourMs + 80);
    }, ARRIVE + TILT_MS);
  }

  function transformOffset(el) {
    var match = /matrix\(([^)]+)\)/.exec(getComputedStyle(el).transform || "");
    if (!match) return { x: 0, y: 0 };
    var v = match[1].split(",");
    return { x: parseFloat(v[4]) || 0, y: parseFloat(v[5]) || 0 };
  }

  /* --- animaciones parciales (sin re-render completo) --- */
  // El destino crece como un solo nivel continuo. Si el color entrante coincide
  // con el tramo superior, se estira ese mismo tramo; si no, se crea uno nuevo
  // desde altura 0 para que la superficie suba desde la boca hasta el nivel final.
  function fillWater(water, index, amount, color, startLevel, pourMs) {
    var top = water.querySelector(".liquid:last-child");
    var oldTop = startLevel > 0 ? game.state.bottles[index][startLevel - 1] : null;
    var node;
    var base = 0;
    if (top && oldTop === color) {
      node = top;
      base = parseFloat(node.style.getPropertyValue("--n")) || 1;
    } else {
      node = runNode(color, startLevel, 0, true);
      if (top) top.classList.remove("top");
      if (bottleHidden(index)) node.classList.add("hidden-fill");
      water.appendChild(node);
      void node.offsetHeight;   // fija el estado inicial (altura 0) antes de animar
    }
    node.style.setProperty("--pour-ms", pourMs + "ms");
    node.classList.add("flow");
    node.style.setProperty("--n", String(base + amount));
  }

  // Al inclinar la botella, el líquido cae hacia la boca: todo el stack se
  // corre `shift` celdas y deja el aire en la base.
  function shiftWaterToMouth(water, shift, ms) {
    if (!shift) return;
    var runs = Array.prototype.slice.call(water.querySelectorAll(".liquid"));
    runs.forEach(function (node) {
      var i = parseFloat(node.style.getPropertyValue("--i")) || 0;
      node.style.setProperty("--pour-ms", ms + "ms");
      node.classList.add("flow");
      node.style.setProperty("--i", String(i + shift));
    });
  }

  function drainWater(water, amount, pourMs) {
    var runs = Array.prototype.slice.call(water.querySelectorAll(".liquid"));
    var top = runs[runs.length - 1];
    if (!top) return;
    var topN = parseFloat(top.style.getPropertyValue("--n")) || 1;
    var left = Math.max(0, topN - amount);

    // La botella está boca abajo: el aire entra por la base y el líquido que
    // queda se corre hacia la boca. Todo el stack sube `amount` celdas y el
    // tramo superior se acorta, manteniendo su superficie fija en la boca.
    runs.forEach(function (node) {
      var i = parseFloat(node.style.getPropertyValue("--i")) || 0;
      node.style.setProperty("--pour-ms", pourMs + "ms");
      node.classList.add("flow");
      node.style.setProperty("--i", String(i + amount));
      if (node === top) node.style.setProperty("--n", String(left));
    });

    if (left > 0) return;

    // el tramo que queda debajo pasa a ser la superficie; su elipse ya está
    // lista detrás del tramo que se está yendo, así no hay salto.
    var next = runs[runs.length - 2];
    if (next) {
      next.classList.add("top");
      var color = parseInt(next.dataset.color, 10);
      var surf = SURFACE_SPRITES[color];
      if (surf) next.style.setProperty("--surface", 'url("sprites/' + surf + '")');
    }
    setTimeout(function () {
      if (top.parentNode) top.parentNode.removeChild(top);
    }, pourMs + 40);
  }

  // Al volver la botella a su posición, el líquido restante baja de la boca
  // al fondo con la misma duración que la rotación.
  function settleWater(water, index, ms) {
    var finalRuns = runsOf(game.state.bottles[index] || []);
    var nodes = Array.prototype.slice.call(water.querySelectorAll(".liquid"));
    var live = nodes.filter(function (node) {
      return (parseFloat(node.style.getPropertyValue("--n")) || 0) > 0;
    });
    if (live.length !== finalRuns.length) { paintWater(water, index); return; }
    for (var k = 0; k < live.length; k++) {
      if (parseInt(live[k].dataset.color, 10) !== finalRuns[k].color) {
        paintWater(water, index);
        return;
      }
    }
    live.forEach(function (node, k) {
      var run = finalRuns[k];
      var isTop = k === live.length - 1;
      node.classList.toggle("top", isTop);
      if (isTop) {
        var surf = SURFACE_SPRITES[run.color];
        if (surf) node.style.setProperty("--surface", 'url("sprites/' + surf + '")');
      } else {
        node.style.removeProperty("--surface");
      }
      node.style.setProperty("--pour-ms", ms + "ms");
      node.classList.add("flow");
      node.style.setProperty("--i", String(run.i));
      node.style.setProperty("--n", String(run.n));
    });
    setTimeout(function () { paintWater(water, index); }, ms + 40);
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

  // Chorro pegado a la boca: nace en el borde del destino y su punta baja
  // hasta la superficie, que sube en sincronía con la transición del nivel.
  function showStream(toEl, color, startLevel, amount, pourMs) {
    var boardRect = boardEl.getBoundingClientRect();
    var t = toEl.getBoundingClientRect();
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    var cap = parseInt(toEl.style.getPropertyValue("--cap"), 10) || 4;
    var padTop = parseFloat(getComputedStyle(toEl).paddingTop) || 14;
    var lseg = seg * (1 - 0.52 / cap);
    var glassTop = t.top - boardRect.top + padTop;
    var glassBottom = t.top - boardRect.top + t.height;
    var x = t.left - boardRect.left + t.width / 2;
    var width = Math.max(5, Math.round(seg * 0.20));

    function surfaceY(level) {
      return glassBottom - level * lseg;
    }

    var node = document.createElement("span");
    node.className = "stream";
    node.style.left = x + "px";
    node.style.top = glassTop + "px";
    node.style.setProperty("--stream-w", width + "px");
    node.style.setProperty("--stream-color", color);
    node.style.height = Math.max(2, surfaceY(startLevel) - glassTop) + "px";
    boardEl.appendChild(node);

    var start = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - start) / Math.max(1, pourMs));
      var h = Math.max(2, surfaceY(startLevel + amount * p) - glassTop);
      node.style.height = h + "px";
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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
    startMusic();
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
    syncMusic();
  });
  window.addEventListener("resize", function () {
    if (game) boardEl.style.setProperty("--seg", computeSeg(game.level, game.magicIndex) + "px");
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "z" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); doUndo(); }
    if (ev.key === "r" && !ev.ctrlKey && !ev.metaKey) doRestart();
  });

  // ?flat deja el agua en color plano (para comparar)
  if (/[?&]flat\b/.test(location.search)) document.body.classList.add("flat-water");

  /* ---------------- arranque ---------------- */
  $("btnSound").textContent = save.sound ? "🔊" : "🔇";
  document.addEventListener("pointerdown", function once() {
    document.removeEventListener("pointerdown", once);
    startMusic();
  });
  buildModeTabs();
  loadMode(save.mode, save.levelsByMode[save.mode] || 0);

  window.__magicSort = {
    startLevel: startLevel,
    loadMode: loadMode,
    state: function () { return game; },
    click: onBottleClick,
    save: function () { return save; },
    levelCount: function () { return LEVELS.length; },
    music: function () {
      return music ? { paused: music.paused, volume: music.volume, loop: music.loop, time: music.currentTime, src: music.src } : null;
    },
    modes: function () { return Object.keys(CATALOG).map(function (m) { return { key: m, label: CATALOG[m].label, count: CATALOG[m].levels.length }; }); }
  };
})();
