/*
 * Bottle Sort — UI y bucle de juego.
 *
 *  - Reglas: water-sort con capacidad POR BOTELLA (4 clásico, 12/16 botellas largas).
 *  - Niveles: 3 613 tableros en 4 modos.
 *  - Paleta, tiempos de animación y sonidos: valores del juego original.
 *
 * Monedas ilimitadas por defecto (modo exploración).
 */
(function () {
  "use strict";

  var E = window.MagicSortEngine;
  var CATALOG = window.MAGIC_SORT_CATALOG || {};

  // Paleta exacta: ColorConfig.Color de cada ColorId.
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

  // Color de las estrellas al completar (ColorConfig.ParticleWinColor).
  var STARS = {
    0: "#1a97e8", 1: "#2899db", 2: "#de752c", 3: "#5de21a", 4: "#61d925",
    5: "#4253e9", 6: "#d535a2", 7: "#d5533a", 8: "#deaf23", 9: "#9b3fd7",
    10: "#eb3aae", 11: "#f24f4f", 13: "#989898", 17: "#3ca893", 18: "#b08000",
    19: "#d72c89", 20: "#56c0a3", 21: "#9d54f4", 22: "#95906d"
  };

  // Brillo del tapón al completar (ColorConfig.StopperGlowColor).
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

  // Economía del juego (modelos RemoteConfig).
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
      bestTime: {},
      sfxOn: true,
      musicOn: true,
      speed: 1,
      animations: true
    };
  }

  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      var data = JSON.parse(raw);
      var base = defaultSave();
      if (typeof data.sound === "boolean") {   // guardado anterior: un solo interruptor
        base.sfxOn = data.sound;
        base.musicOn = data.sound;
      }
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
  var timeLabel = $("timeLabel");
  var coinsLabel = $("coinsLabel");
  var winOverlay = $("winOverlay");
  var levelsOverlay = $("levelsOverlay");
  var modeTabs = $("modeTabs");

  var game = null;

  /* ---------------- audio: clips originales (sounds/*.ogg|mp3) ---------------- */
  var SFX_FILES = {
    select: "bottle_up", place: "bottle_down", complete: "green_check", win: "win_screen",
    button: "button", cork: "bottle_cork", curtain: "curtain", clay: "clay_break_v2", bubble: "bubble",
    fill: "bottles_filled",
    pour1: "p_short_1", pour2: "p_short_2", pour3: "p_short_3", pour4: "p_short_4", pour5: "p_short_5",
    pour6: "n_short_6", pour7: "n_short_7", pour8: "n_short_8"
  };
  // SoundType: PourShort1..5 (1-5 unidades), n_short_6..8 (6-8).
  var audioExt = (function () {
    try {
      var probe = document.createElement("audio");
      if (probe.canPlayType && probe.canPlayType('audio/ogg; codecs="vorbis"')) return ".ogg";
    } catch (err) { /* sin Audio */ }
    return ".mp3";
  })();
  // Pool de audio: cada sonido reutiliza hasta POOL_MAX elementos terminados en
  // vez de clonar uno nuevo por reproducción. Crear HTMLAudioElement a mogollón
  // (4-6 por segundo en juego rápido) atasca el audio de Safari en iOS.
  var sfxCache = {};
  var POOL_MAX = 6;

  function sfx(name) {
    if (!save.sfxOn) return;
    var file = SFX_FILES[name];
    if (!file) return;
    var url = "sounds/" + file + audioExt;
    try {
      var entry = sfxCache[url];
      if (!entry) {
        entry = sfxCache[url] = { base: new Audio(url), pool: [] };
        entry.base.preload = "auto";
      }
      var node = entry.pool.pop();
      if (!node) {
        node = entry.base.cloneNode();
        node.addEventListener("ended", function () {
          // volver al pool sólo si no hay excedente
          var e = sfxCache[url];
          if (e && e.pool.length < POOL_MAX) e.pool.push(node);
        });
      }
      node.volume = name.indexOf("pour") === 0 ? 0.5 : 0.65;
      node.currentTime = 0;
      var p = node.play();
      if (p && p.catch) p.catch(function () {});
    } catch (err) { /* audio bloqueado: seguimos sin sonido */ }
  }

  function sfxPour(amount) { sfx("pour" + Math.max(1, Math.min(8, amount))); }

  /* ---------------- música de fondo (MagicSort_Gameplay_Final) ---------------- */
  var music = null;
  var MUSIC_VOLUME = 0.30;

  function startMusic() {
    if (!save.musicOn) return;
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
    if (save.musicOn) startMusic(); else stopMusic();
  }

  /* ---------------- utilidades ---------------- */
  function hint(text) { hintEl.textContent = text; }

  /* ---------------- sin jugadas (LevelWinOrStuckSystem.HasNoMove) ----------------
   * Si el tablero no tiene ningún vertido legal y el nivel no está resuelto, se frena
   * el reloj y se ofrece salida: mezclar (reparto con solución verificada), deshacer
   * o reiniciar. No es derrota: el nivel no se pierde.
   */
  var onStuckOverlay = null;

  function checkStuck() {
    if (!game || game.done || game.stuck) return;
    if (E.isWon(game.state)) return;
    if (E.hasAnyMove(game.state)) return;
    game.stuck = true;
    pauseClock();
    game.selected = null;
    render();
    hint("Sin jugadas: mezcla, deshace o reinicia.");
    if (onStuckOverlay) {
      $("stuckSub").textContent = "No queda ningún vertido posible (" +
        remainingBottles() + " botellas por resolver).";
      $("btnStuckUndo").hidden = game.history.length === 0;
      // sin espacio libre no hay mezcla posible: la salida es una botella nueva
      var free = 0;
      game.state.bottles.forEach(function (b, i) { free += (game.state.caps[i] || 4) - b.length; });
      var noRoom = free === 0;
      $("btnStuckShuffle").classList.toggle("primary", !noRoom);
      $("btnStuckShuffle").classList.toggle("ghost", noRoom);
      $("btnStuckShuffle").disabled = noRoom;
      $("btnStuckExtra").classList.toggle("primary", noRoom);
      $("btnStuckExtra").classList.toggle("ghost", !noRoom);
      onStuckOverlay.hidden = false;
    }
    sfx("bubble");
  }

  function clearStuck() {
    if (!game) return;
    game.stuck = false;
    if (onStuckOverlay) onStuckOverlay.hidden = true;
    resumeClock();
  }

  /* ---------------- velocidad / animaciones ----------------
   * `TM(ms)` escala cualquier espera: ÷ velocidad, y 0 si las animaciones están
   * apagadas. Para CSS se usa `applySpeed()`: pone `--sp` en :root (las duraciones
   * que dependen del juego lo leen) y pasa las animaciones en curso a
   * `playbackRate = velocidad` (cubre CSS y WAAPI).
   */
  function TM(ms) {
    if (!save.animations) return 0;
    return Math.max(0, Math.round(ms / (save.speed || 1)));
  }

  function applySpeed() {
    var root = document.documentElement;
    root.style.setProperty("--sp", String(save.speed || 1));
    root.classList.toggle("no-anim", !save.animations);
    if (save.animations && save.speed !== 1 && document.getAnimations) {
      document.getAnimations().forEach(function (a) {
        try { a.playbackRate = save.speed; } catch (err) { /* ignore */ }
      });
    }
  }

  // Cronómetro del nivel: cuenta para arriba, sin límite (solo para saber cuánto tardaste).
  function fmtTime(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var m = Math.floor(total / 60);
    var sec = total % 60;
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  function elapsedMs() {
    if (!game) return 0;
    if (!game.clockRunning) return game.accMs || 0;
    return Date.now() - game.startedAt;
  }
  function pauseClock() {
    if (!game || !game.clockRunning) return;
    game.accMs = Date.now() - game.startedAt;
    game.clockRunning = false;
  }
  function resumeClock() {
    if (!game || game.clockRunning) return;
    game.startedAt = Date.now() - (game.accMs || 0);
    game.clockRunning = true;
  }

  setInterval(function () {
    if (!game || game.done) return;
    timeLabel.textContent = fmtTime(elapsedMs());
  }, 500);

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

  /* Tamaño de celda para que el tablero entre en pantalla.
   * Modela el layout REAL (valores del CSS):
   *   alto de botella  = celdas * seg + PAD_TOP
   *   separación filas = clamp(16px, 3.4vh, 34px)
   *   ancho de botella = seg * 1.28 + 10
   *   separación columnas = clamp(4px, 1.1vw, 14px)
   * Trabaja sobre las filas REALES (game.rows), así al añadir una botella se re-acomoda.
   */
  var PAD_TOP = 14;

  function rowGapPx() { return Math.max(16, Math.min(34, window.innerHeight * 0.034)); }
  function colGapPx() { return Math.max(4, Math.min(14, window.innerWidth * 0.011)); }

  // Cuántas botellas caben en una fila con el tamaño de celda actual
  function maxBottlesPerRow() {
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 40;
    var availW = Math.max(220, Math.min(window.innerWidth - 20, 780));
    var gap = colGapPx();
    var w = seg * 1.28 + 10;
    return Math.max(1, Math.floor((availW + gap) / (w + gap)));
  }

  function segForRows(rows, caps, magicIndex) {
    var cells = 0, perRowMax = 1, nRows = 0;
    rows.forEach(function (row) {
      if (!row.length) return;
      nRows++;
      var h = 0;
      row.forEach(function (i) { h = Math.max(h, caps[i] || 4); });
      cells += h;
      perRowMax = Math.max(perRowMax, row.length);
    });
    if (!nRows) return 44;

    // Medidas REALES del contenedor: en pantallas angostas el HUD se parte en dos
    // líneas y un `innerHeight - 210` fijo dejaba el tablero debajo del HUD.
    var availH, availW;
    var stage = document.querySelector(".stage");
    if (stage && stage.clientHeight > 120) {
      var hintH = hintEl ? hintEl.offsetHeight + 12 : 30;
      availH = Math.max(180, stage.clientHeight - hintH - 14);
      availW = Math.max(220, Math.min(stage.clientWidth - 20, 780));
    } else {
      availH = Math.max(180, window.innerHeight - 210);
      availW = Math.max(220, Math.min(window.innerWidth - 20, 780));
    }
    var rowGap = rowGapPx();
    var colGap = colGapPx();

    // alto disponible para celdas, descontando padding de botellas y separaciones
    var cellsBudget = availH - PAD_TOP * nRows - rowGap * (nRows - 1);
    var segByH = cellsBudget / Math.max(cells, 1);

    if (magicIndex >= 0) {
      var bigCap = caps[magicIndex] || 16;
      segByH = Math.min(segByH, (availH - PAD_TOP) / Math.max(bigCap, 1));
    }

    // ancho: en modo mágico la columna de la botella grande ocupa su propio espacio
    var columns = perRowMax + (magicIndex >= 0 ? 1 : 0);
    var slot = (availW - (columns - 1) * colGap) / columns;
    var segByW = (slot - 10) / 1.28;

    var seg = Math.floor(Math.min(segByH, segByW, 46));
    return Math.max(9, Math.min(46, seg || 44));
  }

  function computeSeg(level, magicIndex) {
    return segForRows(rowsOfLevel(level), level.caps, magicIndex);
  }

  // Recalcula el tamaño de celda con las filas en pantalla (tras añadir/deshacer botella).
  function refreshSeg() {
    var seg = segForRows(game.rows, game.state.caps, game.magicIndex);
    boardEl.style.setProperty("--seg", seg + "px");
    return seg;
  }

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
      par: computePar(level),
      startedAt: Date.now(),
      accMs: 0,
      clockRunning: true,
      timeMs: 0,
      stuck: false
    };
    boardEl.style.setProperty("--seg", computeSeg(level, magicIndex) + "px");
    winOverlay.hidden = true;
    if (onStuckOverlay) onStuckOverlay.hidden = true;
    levelLabel.textContent = String(i + 1);
    coinsLabel.textContent = save.unlimited ? "∞" : String(save.coins);
    movesLabel.textContent = "0";
    timeLabel.textContent = "0:00";
    hint(game.magicIndex >= 0
      ? "Llena la botella mágica con un solo color (" + level.caps[game.magicIndex] + " unidades)"
      : modeLabel() + " · " + level.colors + " colores · toca una botella y luego otra");
    render();
    checkStuck();
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
    var bottle = st.bottles[index] || [];
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

  // Selección SIN re-render: la botella ya existe, sólo cambia la clase.
  // (Antes cada click reconstruía el tablero entero: en móviles eso saturaba
  // el main thread al tocar rápido.)
  function setSelected(index) {
    var prev = game.selected;
    game.selected = index;
    if (prev !== null && prev !== index) {
      var prevEl = boardEl.querySelector('[data-index="' + prev + '"]');
      if (prevEl) prevEl.classList.remove("selected");
    }
    if (index !== null) {
      var el = boardEl.querySelector('[data-index="' + index + '"]');
      if (el) el.classList.add("selected");
    }
  }

  function onBottleClick(index) {
    if (!game || game.busy || game.done || game.stuck) return;
    var st = game.state;

    if (game.selected === null) {
      if (!st.bottles[index].length) {
        hint("Esa botella está vacía: elige una con líquido.");
        sfx("bubble");
        return;
      }
      var top = E.topColor(st.bottles[index]);
      setSelected(index);
      hint("Seleccionada: " + (COLOR_NAMES[top] || "color " + top) + ". Elige el destino.");
      return;
    }

    if (game.selected === index) {
      setSelected(null);
      sfx("place");
      hint("Selección cancelada.");
      return;
    }

    var res = E.pour(st, game.selected, index);
    if (!res) {
      // En el juego, tocar un destino inválido cancela la selección sola
      // (Selection.TryCancel -> Deselect): la botella vuelve a su sitio.
      var why = !st.bottles[index].length || E.topColor(st.bottles[index]) !== E.topColor(st.bottles[game.selected])
        ? "Ese color no coincide." : "Esa botella está llena.";
      setSelected(null);
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
    var fromWaterEl = fromEl.querySelector(".glass .water");
    var waterW = fromWaterEl ? fromWaterEl.offsetWidth : 0;
    var waterH = fromWaterEl ? fromWaterEl.offsetHeight : 0;
    var waterLeft = 0, waterTop = 0;
    if (fromWaterEl) {
      var wr = fromWaterEl.getBoundingClientRect();
      waterLeft = wr.left - fRect.left;
      waterTop = wr.top - fRect.top;
    }
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    var lift = Math.max(12, Math.min(seg * 0.45, 24));    // _bottleSelectionAnimationHeight
    var hover = Math.max(18, Math.min(seg * 0.75, 34));   // _heightOffset sobre la boca destino
    var RISE_MS = TM(140), MOVE_MS = TM(210), TILT_MS = TM(130);

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

    var unitMs = save.animations ? Math.max(75, Math.min(140, 520 / amount)) / (save.speed || 1) : 0;
    var streamMs = Math.max(1, Math.round(amount * unitMs));
    var pourMs = TM(amount * Math.max(75, Math.min(140, 520 / amount)));
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
      if (fromWater) {
        // El líquido solo corre hacia la boca cuando la botella pasa de la horizontal
        // (>90°). Con ángulos chicos (destino casi lleno) queda apoyado en la base.
        var runToMouth = Math.max(0, Math.min(1, (angle - 70) / 35));
        shiftWaterToMouth(fromWater,
          (Math.max(0, cap - oldLevel) * runToMouth).toFixed(2) * 1, TILT_MS);
        // superficie nivelada: el agua no se va con la botella
        tiltLiquid(fromWater, {
          waterW: waterW, waterH: waterH, waterLeft: waterLeft, waterTop: waterTop,
          layoutTop: layoutTop, dx: dx, dy: dy - hover,
          pivotX: fromEl.offsetWidth / 2, pivotY: padTop,
          rad: (dir * angle) * Math.PI / 180, deg: dir * angle, scale: scale,
          fraction: Math.min(1, oldLevel / cap),
          seg: seg,
          surface: SURFACE_SPRITES[color]
        });
      }
    }, ARRIVE);

    // fase 5: cae el agua y el origen se vacía en sincronía
    setTimeout(function () {
      var toWater = toEl.querySelector(".glass .water");
      var fromWater = fromEl.querySelector(".glass .water");
      if (!toWater || !fromWater) {
        game.busy = false;
        return;
      }
      // la gota y el chorro van en FrontColor (capa clara del agua): del mismo
      // color que el líquido serían invisibles al caer por dentro del frasco.
      var dropColor = FRONTS[color] || colorCss;
      var finalLevel = startLevel + amount;

      fillWater(toWater, to, amount, color, startLevel);
      drainWater(fromWater, amount, pourMs);
      var stream = showStream(toEl, colorCss, startLevel, amount, streamMs, hover + seg * 0.2, dropColor);
      sfxPour(amount);
      squish(toEl);
      for (var u = 0; u < amount; u++) {
        (function (unit) {
          var at = Math.round((unit + 1) * unitMs);
          // nivel del agua en el momento del impacto, sobre _moveUpCurve
          var lvlThen = startLevel + amount * riseProgress(Math.min(1, (at + 40) / Math.max(1, TM(RISE_MS_FULL))));
          setTimeout(function () {
            dropBlob(toEl, lvlThen, finalLevel, dropColor);
          }, Math.max(0, at - 150));
          setTimeout(function () {
            splashAtUnit(toEl, Math.max(startLevel, lvlThen), dropColor);
          }, at);
        })(u);
      }

      setTimeout(function () {
        paintWater(toWater, to);
        untiltLiquid(fromWater);
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
          celebrate(to, E.topColor(game.state.bottles[to]));
          sfx("fill");                                 // SoundType.BottlesFilled
          setTimeout(function () { sfx("cork"); }, TM(110)); // SoundType.BottleCork
        }
        setTimeout(function () {
          fromEl.style.transformOrigin = "";
          sfx("place");
          game.busy = false;
          updateBoosterButtons();
          if (E.isWon(game.state)) { finishLevel(); return; }
          hint(completed ? "¡Botella completada!" : "Sigue así: " + remainingBottles() + " botellas por resolver.");
          checkStuck();
        }, TM(200));
      }, pourMs + TM(80));
    }, ARRIVE + TILT_MS);
  }


  /* ---------------- líquido nivelado al inclinar (WaterItem.RotateWaters) ----------------
   * El juego mantiene la superficie del agua horizontal cuando el frasco se inclina: los
   * tramos de color siguen el eje de la botella, pero la superficie libre queda plana.
   * Acá se recorta el contenedor con una línea horizontal en coordenadas de pantalla y se
   * dibuja encima la elipse de superficie, girada para quedar nivelada.
   */
  function tiltLiquid(waterEl, opts) {
    if (!waterEl) return null;
    var W = opts.waterW, H = opts.waterH;
    var rad = opts.rad, k = opts.scale;
    var cx = opts.pivotX, cy = opts.pivotY;

    // y de pantalla de un punto (x,y) del agua:  A*x + B*y + C
    var A = Math.sin(rad) * k;
    var B = Math.cos(rad) * k;
    var C = opts.layoutTop + opts.dy +
      k * (Math.sin(rad) * (opts.waterLeft - cx) + Math.cos(rad) * (opts.waterTop - cy));

    var quad = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    var ys = quad.map(function (p) { return A * p.x + B * p.y + C; });
    var lo = Math.min.apply(null, ys), hi = Math.max.apply(null, ys);

    // área del polígono recortado por la mitad y >= S
    function clipAt(S) {
      var out = [];
      for (var i = 0; i < quad.length; i++) {
        var p = quad[i], q = quad[(i + 1) % quad.length];
        var dp = (A * p.x + B * p.y + C) - S;
        var dq = (A * q.x + B * q.y + C) - S;
        if (dp >= 0) out.push(p);
        if ((dp >= 0) !== (dq >= 0)) {
          var t = dp / (dp - dq);
          out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
        }
      }
      return out;
    }
    function area(poly) {
      var a = 0;
      for (var i = 0; i < poly.length; i++) {
        var p = poly[i], q = poly[(i + 1) % poly.length];
        a += p.x * q.y - q.x * p.y;
      }
      return Math.abs(a) / 2;
    }

    var target = Math.max(0.02, Math.min(0.98, opts.fraction)) * (W * H);
    var a1 = lo, b1 = hi;
    for (var it = 0; it < 28; it++) {
      var mid = (a1 + b1) / 2;
      if (area(clipAt(mid)) > target) a1 = mid; else b1 = mid;
    }
    var S = (a1 + b1) / 2;
    var poly = clipAt(S);
    if (poly.length < 3) return null;

    waterEl.classList.add("tilted");
    waterEl.style.clipPath = "polygon(" + poly.map(function (p) {
      return p.x.toFixed(1) + "px " + p.y.toFixed(1) + "px";
    }).join(", ") + ")";

    // segmento donde la superficie corta el agua (para la elipse nivelada)
    var seg = [];
    for (var i = 0; i < quad.length; i++) {
      var p = quad[i], q = quad[(i + 1) % quad.length];
      var dp = (A * p.x + B * p.y + C) - S;
      var dq = (A * q.x + B * q.y + C) - S;
      if ((dp >= 0) !== (dq >= 0)) {
        var t = dp / (dp - dq);
        seg.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      }
    }
    if (seg.length < 2) return null;

    var p1 = seg[0], p2 = seg[1];
    var len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    // la elipse va en el .glass (hermano del agua) para que el recorte no la corte
    var host = waterEl.parentNode || waterEl;
    var surf = document.createElement("span");
    surf.className = "surface";
    surf.style.left = (mx - len / 2 + (waterEl.offsetLeft || 0)) + "px";
    surf.style.top = (my + (waterEl.offsetTop || 0)) + "px";
    surf.style.width = len + "px";
    surf.style.height = Math.max(6, opts.seg * 0.42) + "px";
    surf.style.transform = "translateY(-50%) rotate(" + (-opts.deg).toFixed(2) + "deg)";
    if (opts.surface) surf.style.setProperty("--surface", 'url("sprites/' + opts.surface + '")');
    host.appendChild(surf);
    return surf;
  }

  function untiltLiquid(waterEl) {
    if (!waterEl) return;
    waterEl.classList.remove("tilted");
    waterEl.style.clipPath = "";
    var host = waterEl.parentNode;
    if (!host) return;
    var surf = host.querySelector(".surface");
    if (surf) host.removeChild(surf);
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
  /* El juego no estira el nivel de una vez: por cada unidad que entra, el agua
   * SUBE 0.28 s con overshoot (_moveUpCurve + _moveUpOffset 0.5) y se asienta en
   * 0.05 s (_moveDownDuration). Antes de subir cae una gota (blob) desde la boca
   * hasta la superficie.
   */
  var RISE_MS_FULL = 280; // _moveUpDuration

  /* El agua NO sube a saltos: hace UNA sola subida por vertido, con la curva del
   * juego (`BottleFillAnimationConfig._moveUpCurve`: 0 -> 0.72 en el 31 % del
   * tiempo -> 1, con overshoot de `_moveUpOffset`) durante `_moveUpDuration`
   * (0.28 s). Mientras sube, la superficie levanta una onda
   * (`EclipseAnimationConfig`: altura 0.035 -> 0 en `transitionStartDuration`
   * 0.3 s, recorriendo a `speed` 150) que se amortigua al llegar.
   */
  // _moveUpCurve del juego: (0,0) (0.312,0.721) (1,1), con tramos suavizados
  var RISE_CURVE = [[0, 0], [0.312, 0.721], [1, 1]];
  function riseProgress(t) {
    t = Math.max(0, Math.min(1, t));
    for (var i = 1; i < RISE_CURVE.length; i++) {
      var a = RISE_CURVE[i - 1], b = RISE_CURVE[i];
      if (t <= b[0]) {
        var u = (t - a[0]) / (b[0] - a[0] || 1);
        u = u * u * (3 - 2 * u);              // smoothstep: entra y sale suave
        return a[1] + (b[1] - a[1]) * u;
      }
    }
    return 1;
  }

  function fillWater(water, index, amount, color, startLevel) {
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
      void node.offsetHeight;   // estado inicial en altura 0 antes de animar
    }

    var riseMs = TM(RISE_MS_FULL);
    node.style.setProperty("--pour-ms", riseMs + "ms");
    node.classList.add("flow", "rising");
    node.style.setProperty("--n", String(base + amount));

    // la onda: pico al entrar el agua y amortiguación en _transitionStartDuration
    setTimeout(function () {
      node.classList.remove("rising");
      node.classList.add("settling");
      setTimeout(function () { node.classList.remove("settling"); }, TM(320));
    }, riseMs);
  }

  function shiftWaterToMouth(water, shift, ms) {
    shift = Number(shift) || 0;
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
    }, pourMs + TM(40));
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

  /* ---------------- estrellas al completar la botella ----------------
   * El juego tira un burst de partículas con el color del agua (ParticleWinColor)
   * alrededor del frasco, junto con el tapón.
   */
  function celebrate(index, colorId) {
    if (!save.animations) return;
    var el = boardEl.querySelector('[data-index="' + index + '"]');
    if (!el) return;
    var board = boardEl.getBoundingClientRect();
    var r = el.getBoundingClientRect();
    var cx = r.left - board.left + r.width / 2;
    var cy = r.top - board.top + r.height * 0.46;
    var color = STARS[colorId] || "#ffffff";
    var count = 14;

    for (var i = 0; i < count; i++) {
      var node = document.createElement("span");
      node.className = "star";
      var size = 12 + Math.random() * 14;
      node.style.setProperty("--size", size.toFixed(0) + "px");
      node.style.setProperty("--star-color", color);

      // espiral: cada estrella da 1.5-2.2 vueltas alrededor del frasco mientras sube,
      // con el radio creciendo y el tamaño/opacidad simulando profundidad.
      var a0 = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      var turns = 1.4 + Math.random() * 0.8;
      var radius = r.width * (0.34 + Math.random() * 0.12);
      var grow = r.width * (0.16 + Math.random() * 0.28);
      var rise = r.height * (0.45 + Math.random() * 0.35);
      var dur = 950 + Math.random() * 450;
      var delay = Math.random() * 180;

      if (node.animate) {
        var frames = [];
        var steps = 16;
        for (var k = 0; k <= steps; k++) {
          var t = k / steps;
          var ang = a0 + t * Math.PI * 2 * turns;
          var depth = Math.sin(ang);
          var rad = radius + grow * t;
          var x = cx + Math.cos(ang) * rad;
          var y = cy - rise * t + depth * rad * 0.16;
          var scale = (0.7 + 0.5 * (depth + 1) / 2) * (1 - 0.25 * t);
          var op = (t < 0.1 ? t / 0.1 : (t > 0.72 ? Math.max(0, (1 - t) / 0.28) : 1)) *
                   (0.55 + 0.45 * (depth + 1) / 2);   // atenuadas cuando pasan por atrás
          frames.push({
            transform: "translate(" + x.toFixed(1) + "px, " + y.toFixed(1) + "px) " +
                       "translate(-50%, -50%) scale(" + scale.toFixed(2) + ") rotate(" + (ang * 57.2958).toFixed(0) + "deg)",
            opacity: op.toFixed(2)
          });
        }
        node.style.left = "0px";
        node.style.top = "0px";
        node.animate(frames, {
          duration: Math.max(1, dur / (save.speed || 1)),
          delay: delay / (save.speed || 1),
          easing: "linear", fill: "both"
        });
      } else {
        // respaldo sin WAAPI: burst radial simple
        node.style.left = cx + "px";
        node.style.top = cy + "px";
        node.style.setProperty("--dx", (Math.cos(a0) * (radius + grow) * 1.6).toFixed(1) + "px");
        node.style.setProperty("--dy", ((Math.sin(a0) * (radius + grow) - rise * 0.6)).toFixed(1) + "px");
        node.style.setProperty("--dur", dur.toFixed(0) + "ms");
        node.style.setProperty("--delay", delay.toFixed(0) + "ms");
        node.style.animation = "star-burst " + dur.toFixed(0) + "ms cubic-bezier(.2,.7,.3,1) " +
          delay.toFixed(0) + "ms forwards";
      }

      boardEl.appendChild(node);
      (function (n, life) {
        setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, life);
      })(node, dur + delay + 150);
    }
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
  function showStream(toEl, color, startLevel, amount, pourMs, fromLift, lightColor) {
    var boardRect = boardEl.getBoundingClientRect();
    var t = toEl.getBoundingClientRect();
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    var cap = parseInt(toEl.style.getPropertyValue("--cap"), 10) || 4;
    var padTop = parseFloat(getComputedStyle(toEl).paddingTop) || 14;
    var lseg = seg * (1 - 0.52 / cap);
    var glassTop = t.top - boardRect.top + padTop;
    var glassBottom = t.top - boardRect.top + t.height;
    var x = t.left - boardRect.left + t.width / 2;
    // WATER_FALL del juego: cinta ancha, no un hilo
    var width = Math.max(11, Math.round(seg * 0.36));
    var top = Math.max(0, glassTop - (fromLift || 0));

    function surfaceY(level) {
      return glassBottom - level * lseg;
    }

    var node = document.createElement("span");
    node.className = "stream";
    node.style.left = x + "px";
    node.style.top = top + "px";
    node.style.setProperty("--stream-w", width + "px");
    node.style.setProperty("--stream-color", color);
    if (lightColor) node.style.setProperty("--stream-light", lightColor);
    node.style.height = Math.max(2, surfaceY(startLevel) - top) + "px";
    boardEl.appendChild(node);

    var start = performance.now();
    function tick(now) {
      var p = Math.min(1, (now - start) / Math.max(1, pourMs));
      var h = Math.max(2, surfaceY(startLevel + amount * p) - top);
      node.style.height = h + "px";
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return node;
  }

  // una salpicadura y tres gotas por cada unidad que cae en el frasco
  /* Gota que cae dentro del frasco desde la boca hasta la superficie (el "blob" del
   * juego: WaterItem/ItemPartType.Blob, BlobMoveInsideBottleAnimation). Se estira al
   * caer y se aplasta al tocar el agua. Vive en el .glass para que el vidrio la recorte. */
  function dropBlob(toEl, fromLevel, toLevel, color) {
    if (!toEl || !save.animations) return;
    var glass = toEl.querySelector(".glass");
    if (!glass) return;
    var seg = parseFloat(getComputedStyle(boardEl).getPropertyValue("--seg")) || 44;
    var cap = parseInt(toEl.style.getPropertyValue("--cap")) || 4;
    var lseg = seg * (1 - 0.52 / cap);
    // gota que cae POR DENTRO: ~0.6 unidades (el blob de 2.3 u de BlobXYSizeForHeight
    // es el de selección, que flota sobre la boca, no el que cae)
    var w = Math.max(10, seg * 0.62);
    var h = w * (2.5 / 2.3);
    // el nivel sube mientras la gota cae: apuntar a la superficie de ese instante
    var yStart = glass.offsetHeight - fromLevel * lseg;
    var yFinal = glass.offsetHeight - toLevel * lseg;
    var yEnd = yStart + (yFinal - yStart) * 0.75;

    var blob = document.createElement("span");
    blob.className = "blob";
    blob.style.width = w + "px";
    blob.style.height = h + "px";
    // corrida a un lado del chorro para que no la parta al medio
    blob.style.left = (glass.offsetWidth * 0.62) + "px";
    blob.style.top = (-h * 0.6) + "px";
    blob.style.setProperty("--blob-color", color);
    glass.appendChild(blob);

    var fall = 165;   // _BlobMoveToBottomMinMaxDuration max
    if (blob.animate) {
      blob.animate([
        { transform: "translate(-50%, " + (-h * 0.5) + "px) scale(.78)", opacity: 0 },
        { transform: "translate(-50%, " + (-h * 0.2) + "px) scale(.9, 1.02)", opacity: 1, offset: .12 },
        { transform: "translate(-50%, " + (yEnd * 0.72) + "px) scale(.94, 1.1)", opacity: 1, offset: .78 },
        // impacto: se aplasta (BlobScaleCurve) y se absorbe (BlobEndSize 1.85x2.0)
        { transform: "translate(-50%, " + (yEnd - h * 0.34) + "px) scale(1.55, .5)", opacity: .95, offset: .93 },
        { transform: "translate(-50%, " + (yEnd - h * 0.10) + "px) scale(.8)", opacity: 0 }
      ], { duration: Math.max(1, (fall + 90) / (save.speed || 1)), easing: "linear", fill: "forwards" });
    }
    setTimeout(function () { if (blob.parentNode) blob.parentNode.removeChild(blob); }, fall + 120);
  }

  function splashAtUnit(toEl, unitIndex, color) {
    if (!toEl || !save.animations) return;
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
    game.timeMs = elapsedMs();
    game.clockRunning = false;
    timeLabel.textContent = fmtTime(game.timeMs);
    var par = game.par || 20;
    var stars = game.moves <= par ? 3 : game.moves <= Math.round(par * 1.5) ? 2 : 1;
    var reward = game.level.tier >= 5 ? 100 : game.level.tier >= 3 ? 60 : 20;
    var key = save.mode + ":" + game.index;

    if (stars > (save.stars[key] || 0)) save.stars[key] = stars;
    if (!save.best[key] || game.moves < save.best[key]) save.best[key] = game.moves;
    if (!save.unlimited) save.coins += reward;
    persist();

    var bestTime = save.bestTime[key];
    var isBestTime = !bestTime || game.timeMs < bestTime;
    if (isBestTime) save.bestTime[key] = game.timeMs;
    persist();
    $("winSub").textContent = game.moves + " movimientos · " + fmtTime(game.timeMs) +
      (isBestTime ? " · ¡mejor tiempo!" : " · mejor " + fmtTime(bestTime)) + " · par " + par;
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
    // la botella extra (o cualquier botella agregada) deja de existir: limpiar filas
    game.rows = game.rows
      .map(function (row) { return row.filter(function (ix) { return ix < game.state.bottles.length; }); })
      .filter(function (row) { return row.length > 0; });
    game.selected = null;
    game.moves = Math.max(0, game.moves - 1);
    hint("Movimiento deshecho.");
    clearStuck();
    render();
    checkStuck();
  }


  /* ---------------- mezcla garantizada ----------------
   * Repartir al azar y rezar para que tenga solución casi nunca funciona cuando el
   * tablero está trabado. En su lugar: se arma una disposición canónica (cada color
   * agrupado, que es el estado resuelto) y se la "desarma" con movimientos inversos
   * de vertidos legales. Cada movimiento inverso se valida simulando el vertido
   * directo: si vuelve al estado anterior, el resultado es resoluble por construcción
   * (basta con deshacer los pasos en orden).
   */
  function sameBottles(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].length !== b[i].length) return false;
      for (var j = 0; j < a[i].length; j++) if (a[i][j] !== b[i][j]) return false;
    }
    return true;
  }

  // Disposición canónica: cada color agrupado y, si se puede, entrando justo en una
  // botella (así las botellas mágicas de 10/11/16 reciben su color completo).
  function canonicalLayout(state) {
    var counts = {};
    state.bottles.forEach(function (b) {
      b.forEach(function (c) { counts[c] = (counts[c] || 0) + 1; });
    });
    var bottles = state.bottles.map(function () { return []; });
    var caps = state.caps.slice();
    var order = bottles.map(function (_, i) { return i; })
      .sort(function (a, b) { return (caps[b] || 4) - (caps[a] || 4) || a - b; });

    order.forEach(function (i) {
      var cap = caps[i] || 4;
      while (bottles[i].length < cap) {
        var space = cap - bottles[i].length;
        var left = Object.keys(counts).filter(function (c) { return counts[c] > 0; });
        if (!left.length) break;
        var exact = left.filter(function (c) { return counts[c] === space; })[0];
        var pick = exact != null ? exact : left.sort(function (a, b) { return counts[b] - counts[a]; })[0];
        var n = Math.min(space, counts[pick]);
        for (var k = 0; k < n; k++) bottles[i].push(Number(pick));
        counts[pick] -= n;
      }
    });
    return { bottles: bottles, caps: caps, blockers: Object.assign({}, state.blockers) };
  }

  function moveUnits(state, from, to, k) {
    var bottles = state.bottles.map(function (b) { return b.slice(); });
    var moved = bottles[from].splice(bottles[from].length - k, k);
    bottles[to] = bottles[to].concat(moved);
    return { bottles: bottles, caps: state.caps.slice(), blockers: Object.assign({}, state.blockers) };
  }

  /* Desarma la disposición canónica moviendo UNA unidad por vez a otra botella cuyo
   * tope sea de otro color (o esté vacía). Ese movimiento siempre es reversible con un
   * vertido legal (el vertido de vuelta mueve exactamente esa unidad), así que el
   * tablero resultante tiene solución: basta con deshacer los pasos en orden inverso.
   * Mezclar con permutaciones al azar, en cambio, casi nunca da un tablero resoluble.
   */
  function scrambleUnits(base, rng, steps) {
    var cur = { bottles: base.bottles.map(function (b) { return b.slice(); }),
                caps: base.caps.slice(), blockers: Object.assign({}, base.blockers) };
    var applied = 0;
    for (var s = 0; s < steps; s++) {
      var moved = false;
      for (var t = 0; t < 80 && !moved; t++) {
        var a = Math.floor(rng() * cur.bottles.length);
        var b = Math.floor(rng() * cur.bottles.length);
        if (a === b) continue;
        var src = cur.bottles[a], dst = cur.bottles[b];
        if (!src.length || dst.length >= (cur.caps[b] || 4)) continue;
        var color = src[src.length - 1];
        if (dst.length && dst[dst.length - 1] === color) continue;  // el vertido de vuelta movería más de 1
        var cand = moveUnits(cur, a, b, 1);
        var back = E.pour(cand, b, a);
        if (back && sameBottles(back.state.bottles, cur.bottles)) {
          cur = cand;
          moved = true;
          applied++;
        }
      }
      if (!moved) break;
    }
    return { state: cur, steps: applied };
  }

  function doShuffle() {
    if (!game || game.busy || game.done) return;
    if (!spendBooster("shuffle")) return;

    var state = game.state;
    var rng = E.mulberry32((game.index + 1) * 7919 + game.moves * 31 + (Date.now() % 1000));

    // 1) mezcla garantizada: disposición canónica desarmada unidad por unidad.
    //    Si la canónica ya es un tablero resuelto (cada color entra justo en las
    //    botellas), el resultado es resoluble por construcción: basta con deshacer
    //    los pasos en orden inverso. Si no (formas raras), se verifica con el solver.
    var canonical = canonicalLayout(state);
    var canonicalSolved = E.isWon(canonical);
    var units = canonical.bottles.reduce(function (n, b) { return n + b.length; }, 0);
    var candidate = null;
    var usable = false;
    for (var pass = 0; pass < 4 && !usable; pass++) {
      var scrambled = scrambleUnits(canonical, rng, Math.max(8, units * 2) + pass * 6).state;
      var cand = { bottles: scrambled.bottles, caps: state.caps.slice(),
                   blockers: Object.assign({}, state.blockers) };
      // la reversibilidad garantiza solución; igual pedimos que cambie y que se pueda jugar
      var ok = !sameBottles(cand.bottles, state.bottles) && !E.isWon(cand) && E.hasAnyMove(cand) &&
               (canonicalSolved || E.isSolvable(cand, { limit: 20000 }));
      if (ok) {
        candidate = cand;
        usable = true;
      }
    }

    // 2) plan B: reparto al azar verificado con el solver
    if (!usable) {
      var shape = state.bottles.map(function (b) { return b.length; });
      var pool = [];
      state.bottles.forEach(function (b) { pool.push.apply(pool, b); });
      for (var attempt = 0; attempt < 40 && !usable; attempt++) {
        var shuffled = shuffleArray(pool.slice(), rng);
        var bottles = [];
        var cursor = 0;
        for (var i = 0; i < shape.length; i++) {
          bottles.push(shuffled.slice(cursor, cursor + shape[i]));
          cursor += shape[i];
        }
        candidate = { bottles: bottles, caps: state.caps.slice(),
                      blockers: Object.assign({}, state.blockers) };
        usable = E.isSolvable(candidate, { limit: 40000 });
      }
    }

    if (!usable) {
      hint("No se encontró una mezcla resoluble; no se gastó el uso.");
      render();
      return;
    }

    game.history.push({
      bottles: state.bottles.map(function (b) { return b.slice(); }),
      blockers: Object.assign({}, state.blockers)
    });
    game.state = candidate;
    game.selected = null;
    game.moves += 1;
    hint("Mezclado (solución verificada).");
    clearStuck();
    render();
    checkStuck();
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
    refreshSeg();
    hint("Botella extra añadida.");
    clearStuck();
    render();
    checkStuck();
  }

  // Coloca la botella nueva en la última fila si cabe; si no, abre una fila nueva.
  // El tope es el menor entre lo que entra a lo ancho y la densidad que ya usa el
  // nivel: si se usara sólo el ancho, al encogerse el `--seg` cabrían más botellas
  // en la misma fila y el tablero entraría en un bucle de encogimiento.
  function appendRowCell(rows, index) {
    var copy = rows.map(function (r) { return r.slice(); });
    if (!copy.length) return [[index]];
    var densa = 1;
    copy.forEach(function (r) { densa = Math.max(densa, r.length); });
    var max = Math.max(1, Math.min(maxBottlesPerRow(), densa));
    var last = copy[copy.length - 1];
    if (last.length < max) last.push(index);
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
        closeLevels();
        loadMode(mode, 0);
      });
      modeTabs.appendChild(btn);
    });
  }

  // Grid con DELEGACIÓN: un solo listener en el contenedor (antes: 885-1346
  // listeners, uno por celda) y construcción en un DocumentFragment. Al cerrar
  // el overlay se vacía el grid: antes los ~1 800 nodos quedaban en el DOM para
  // siempre aunque el mapa estuviera oculto.
  function closeLevels() {
    levelsOverlay.hidden = true;
    $("levelsGrid").textContent = "";
  }

  function buildLevelsGrid() {
    var grid = $("levelsGrid");
    grid.textContent = "";
    var frag = document.createDocumentFragment();
    LEVELS.forEach(function (level, i) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "level-cell";
      cell.textContent = String(i + 1);
      cell.dataset.i = String(i);
      if (save.stars[save.mode + ":" + i]) cell.classList.add("done");
      if (game && i === game.index) cell.classList.add("current");
      frag.appendChild(cell);
    });
    grid.appendChild(frag);
  }

  /* ---------------- eventos ---------------- */
  boardEl.addEventListener("click", function (ev) {
    startMusic();
    var btn = ev.target.closest(".bottle");
    if (!btn) return;
    onBottleClick(Number(btn.dataset.index));
  });

  onStuckOverlay = $("stuckOverlay");
  $("btnStuckShuffle").addEventListener("click", function () { sfx("button"); doShuffle(); });
  $("btnStuckExtra").addEventListener("click", function () { sfx("button"); doExtra(); });
  $("btnStuckUndo").addEventListener("click", function () { sfx("button"); doUndo(); });
  $("btnStuckRestart").addEventListener("click", function () { sfx("button"); doRestart(); });

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
  $("btnCloseLevels").addEventListener("click", closeLevels);
  levelsOverlay.addEventListener("click", function (ev) {
    if (ev.target === levelsOverlay) closeLevels();
  });
  $("levelsGrid").addEventListener("click", function (ev) {
    var cell = ev.target.closest(".level-cell");
    if (!cell) return;
    closeLevels();
    startLevel(Number(cell.dataset.i));
  });
  var settingsSheet = $("settingsSheet");

  function syncSpeedUi() {
    document.querySelectorAll(".speed-chip").forEach(function (chip) {
      chip.setAttribute("aria-pressed", Number(chip.dataset.speed) === (save.speed || 1) ? "true" : "false");
    });
    $("btnAnim").setAttribute("aria-pressed", save.animations ? "true" : "false");
    $("animState").textContent = save.animations
      ? (save.speed > 1 ? "Activadas · ×" + save.speed : "Activadas")
      : "Desactivadas";
  }

  function syncAudioUi() {
    $("btnSfx").setAttribute("aria-pressed", save.sfxOn ? "true" : "false");
    $("btnMusic").setAttribute("aria-pressed", save.musicOn ? "true" : "false");
    $("sfxState").textContent = save.sfxOn ? "Activado" : "Silenciado";
    $("musicState").textContent = save.musicOn ? "Activada" : "Silenciada";
  }

  $("btnSettings").addEventListener("click", function () {
    settingsSheet.hidden = false;
  });
  $("btnCloseSettings").addEventListener("click", function () { settingsSheet.hidden = true; });
  settingsSheet.addEventListener("click", function (ev) {
    if (ev.target === settingsSheet) settingsSheet.hidden = true;
  });
  $("btnSfx").addEventListener("click", function () {
    save.sfxOn = !save.sfxOn;
    persist(); syncAudioUi();
    if (save.sfxOn) sfx("button");
  });
  document.querySelectorAll(".speed-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      save.speed = Number(chip.dataset.speed) || 1;
      persist();
      applySpeed();
      syncSpeedUi();
      sfx("button");
    });
  });

  $("btnAnim").addEventListener("click", function () {
    save.animations = !save.animations;
    persist();
    applySpeed();
    syncSpeedUi();
    if (save.sfxOn) sfx("button");
  });

  $("btnMusic").addEventListener("click", function () {
    save.musicOn = !save.musicOn;
    persist(); syncAudioUi(); syncMusic();
    if (save.sfxOn) sfx("button");
  });
  window.addEventListener("resize", function () {
    if (game) refreshSeg();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !settingsSheet.hidden) { settingsSheet.hidden = true; return; }
    if (ev.key === "z" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); doUndo(); }
    if (ev.key === "r" && !ev.ctrlKey && !ev.metaKey) doRestart();
  });

  // destellos de 4 puntas repartidos por el fondo
  (function buildSparkles() {
    var host = document.getElementById("bgSparkles");
    if (!host) return;
    var count = 14;
    for (var i = 0; i < count; i++) {
      var sp = document.createElement("span");
      var size = 5 + Math.random() * 11;
      sp.style.width = size + "px";
      sp.style.height = size + "px";
      sp.style.left = (Math.random() * 96 + 2).toFixed(2) + "%";
      sp.style.top = (Math.random() * 88 + 4).toFixed(2) + "%";
      sp.style.setProperty("--dur", (7 + Math.random() * 8).toFixed(2) + "s");
      sp.style.setProperty("--delay", (-Math.random() * 12).toFixed(2) + "s");
      sp.style.setProperty("--peak", (0.45 + Math.random() * 0.45).toFixed(2));
      // dos variantes de sprite (dorada y blanca) para dar variedad sin filtros:
      // `background` en línea pisaba la imagen y dejaba un cuadrado plano.
      sp.style.setProperty("--spark",
        'url("sprites/' + (Math.random() < 0.45 ? "star-white.png" : "star.png") + '")');
      host.appendChild(sp);
    }
  })();

  // ?flat deja el agua en color plano (para comparar)
  if (/[?&]flat\b/.test(location.search)) document.body.classList.add("flat-water");

  /* ---------------- arranque ---------------- */
  syncAudioUi();
  syncSpeedUi();
  applySpeed();
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
    checkStuck: checkStuck,
    debug: function () { return { canonicalLayout: canonicalLayout, scrambleUnits: scrambleUnits, sameBottles: sameBottles }; },
    save: function () { return save; },
    levelCount: function () { return LEVELS.length; },
    music: function () {
      return music ? { paused: music.paused, volume: music.volume, loop: music.loop, time: music.currentTime, src: music.src } : null;
    },
    modes: function () { return Object.keys(CATALOG).map(function (m) { return { key: m, label: CATALOG[m].label, count: CATALOG[m].levels.length }; }); }
  };
})();
