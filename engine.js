/*
 * Magic Sort web — motor de reglas.
 *
 * 
 *  - BottleItem.Height fija la capacidad de CADA botella: 4 en la colección clásica,
 *    12/16 en botellas largas (una botella que ocupa 2-3 filas del tablero).
 *  - Cada ColorId aparece tantas veces como la capacidad de la botella que lo recibe
 *    (4 en clásico, 12 en diarias). Verificado sobre el corpus extraído.
 *  - Un movimiento vierte el tramo superior completo del mismo color, hasta llenar el destino.
 *  - Un nivel está resuelto cuando toda botella está vacía o llena de un único color.
 *
 * Bloqueadores (OverBoardItemModel -> CurtainItem / PlasterItem / TagItem) ocultan
 * información y se destruyen por eventos; no restringen vertidos (si lo hicieran,
 * cientos de niveles shipped quedarían irresolubles — ver README).
 *
 * Sin dependencias: <script> clásico (window.MagicSortEngine) o CommonJS para tests.
 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MagicSortEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CAPACITY = 4;

  /* ---------- RNG determinista (mulberry32) ---------- */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rng) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /* ---------- capacidades ---------- */
  function capsOf(state) {
    if (state.caps && state.caps.length === state.bottles.length) return state.caps;
    var caps = [];
    for (var i = 0; i < state.bottles.length; i++) caps.push(state.caps ? (state.caps[i] || CAPACITY) : CAPACITY);
    return caps;
  }

  function capacityAt(state, index) {
    var caps = capsOf(state);
    return caps[index] || CAPACITY;
  }

  /* ---------- consultas sobre una botella ---------- */
  function topColor(bottle) {
    return bottle.length ? bottle[bottle.length - 1] : -1;
  }

  function topRun(bottle) {
    if (!bottle.length) return 0;
    var color = bottle[bottle.length - 1];
    var n = 1;
    for (var i = bottle.length - 2; i >= 0; i--) {
      if (bottle[i] === color) n++;
      else break;
    }
    return n;
  }

  function isUniform(bottle) {
    if (!bottle.length) return true;
    for (var i = 1; i < bottle.length; i++) if (bottle[i] !== bottle[0]) return false;
    return true;
  }

  function isBottleComplete(bottle, cap) {
    return bottle.length > 0 && bottle.length === (cap || CAPACITY) && isUniform(bottle);
  }

  function isComplete(state, index) {
    return isBottleComplete(state.bottles[index], capacityAt(state, index));
  }

  /* ---------- bloqueadores ---------- */
  // state.blockers: { [bottleIndex]: { type, color } }
  function blockerOf(state, index) {
    return (state.blockers && state.blockers[index]) || null;
  }

  // Curtain y Plaster declaran HidesWaterColors: el jugador no ve el contenido.
  // Tag no oculta; solo marca la botella hasta que se resuelve.
  function isHidden(state, index) {
    var b = blockerOf(state, index);
    return !!b && (b.type === "curtain" || b.type === "plaster");
  }

  /* ---------- reglas de vertido ---------- */
  function pourAmount(state, from, to) {
    if (from === to) return 0;
    var bottles = state.bottles;
    var src = bottles[from];
    var dst = bottles[to];
    if (!src || !dst) return 0;
    var cap = capacityAt(state, to);
    if (!src.length || dst.length >= cap) return 0;
    var color = topColor(src);
    if (dst.length && topColor(dst) !== color) return 0;
    return Math.min(topRun(src), cap - dst.length);
  }

  function pour(state, from, to) {
    var n = pourAmount(state, from, to);
    if (!n) return null;
    var bottles = state.bottles.map(function (b) { return b.slice(); });
    var caps = capsOf(state).slice();
    for (var i = 0; i < n; i++) bottles[to].push(bottles[from].pop());
    var next = { bottles: bottles, caps: caps, blockers: state.blockers };
    next.blockers = resolveBlockers(state, next);
    return { state: next, count: n, color: bottles[to][bottles[to].length - 1] };
  }

  /*
   * Resolución de bloqueadores tras un vertido:
   *  - Plaster: se rompe cuando una botella vecina (índice ±1) queda completa.
   *  - Tag: se libera cuando se completa una botella del color etiquetado.
   *  - Curtain: se retira cuando se completa cualquier botella (revela el contenido).
   */
  function resolveBlockers(prev, next) {
    if (!prev.blockers) return prev.blockers;
    var completed = [];
    for (var i = 0; i < next.bottles.length; i++) {
      if (isBottleComplete(next.bottles[i], capacityAt(next, i))) completed.push(i);
    }
    if (!completed.length) return prev.blockers;

    var changed = false;
    var out = {};
    Object.keys(prev.blockers).forEach(function (key) { out[key] = prev.blockers[key]; });
    Object.keys(prev.blockers).forEach(function (key) {
      var index = Number(key);
      var b = prev.blockers[key];
      var drop = false;
      if (b.type === "plaster") {
        drop = completed.some(function (c) { return Math.abs(c - index) === 1; });
      } else if (b.type === "tag") {
        drop = completed.some(function (c) {
          return b.color < 0 || next.bottles[c][0] === b.color;
        });
      } else if (b.type === "curtain") {
        drop = true;
      }
      if (drop) { delete out[key]; changed = true; }
    });
    return changed ? out : prev.blockers;
  }

  function isWon(state) {
    for (var i = 0; i < state.bottles.length; i++) {
      var b = state.bottles[i];
      if (!b.length) continue;
      if (!isBottleComplete(b, capacityAt(state, i))) return false;
    }
    return true;
  }

  function keyOf(state) {
    return state.bottles
      .map(function (b) { return b.join("."); })
      .sort()
      .join("|");
  }

  /* ---------- generación de movimientos ---------- */
  function candidateMoves(state) {
    var bottles = state.bottles;
    var moves = [];
    var firstEmpty = -1;
    for (var i = 0; i < bottles.length; i++) {
      if (!bottles[i].length) { firstEmpty = i; break; }
    }
    for (var from = 0; from < bottles.length; from++) {
      var src = bottles[from];
      if (!src.length) continue;
      // Ojo: NO se descarta una botella completa como origen. En niveles de botella
      // mágica el color objetivo ocupa varias botellas de 4 ya llenas que deben
      // volcarse dentro de la botella grande (SuperChargerType.MagicBottle).
      var uniform = isUniform(src);
      for (var to = 0; to < bottles.length; to++) {
        if (to === from) continue;
        var dst = bottles[to];
        if (!dst.length) {
          if (to !== firstEmpty) continue; // botellas vacías simétricas: solo una
          if (uniform) continue;           // mover un tramo entero a otro vacío no aporta
        }
        var n = pourAmount(state, from, to);
        if (n) moves.push({ from: from, to: to, count: n });
      }
    }
    return moves;
  }

  function scoreMove(state, move) {
    var dst = state.bottles[move.to];
    var cap = capacityAt(state, move.to);
    var score = 0;
    if (dst.length + move.count === cap) score += 100;
    if (dst.length) score += 20;
    score += move.count * 2;
    if (state.bottles[move.from].length === move.count) score += 10;
    return score;
  }

  /* ---------- solver (DFS + memo) ---------- */
  function solve(start, options) {
    var opts = options || {};
    var limit = opts.limit || 400000;
    var seen = Object.create(null);
    var stack = [{ state: start, path: [] }];
    var expanded = 0;
    seen[keyOf(start)] = true;
    while (stack.length) {
      var node = stack.pop();
      if (isWon(node.state)) {
        return { solvable: true, moves: node.path, expanded: expanded };
      }
      if (++expanded > limit) return { solvable: false, exhausted: true, expanded: expanded };
      var moves = candidateMoves(node.state).sort(function (a, b) {
        return scoreMove(node.state, a) - scoreMove(node.state, b);
      });
      for (var i = 0; i < moves.length; i++) {
        var res = pour(node.state, moves[i].from, moves[i].to);
        if (!res) continue;
        var k = keyOf(res.state);
        if (seen[k]) continue;
        seen[k] = true;
        stack.push({ state: res.state, path: node.path.concat([moves[i]]) });
      }
    }
    return { solvable: false, expanded: expanded };
  }

  function isSolvable(state, options) {
    return solve(state, options).solvable;
  }

  /* ---------- niveles ---------- */
  function normalizeLevel(raw) {
    var bottles = raw.bottles.map(function (b) {
      return b.filter(function (c) { return c !== null && c !== undefined && c >= 0; });
    });
    var caps = (raw.caps && raw.caps.length === bottles.length
      ? raw.caps.slice()
      : bottles.map(function (b, i) {
          var declared = raw.caps && raw.caps[i];
          return declared || Math.max(CAPACITY, b.length);
        }));
    var blockers = {};
    (raw.blockers || []).forEach(function (bl) {
      var idx = (bl.b !== undefined ? bl.b : 0) | 0;
      if (!blockers[idx]) blockers[idx] = { type: bl.type, color: bl.color };
    });
    return {
      id: raw.id,
      number: raw.n,
      tier: raw.tier,
      variant: raw.variant,
      colors: raw.colors,
      caps: caps,
      bottles: bottles,
      blockers: blockers,
      grid: raw.grid || null
    };
  }

  /*
   * Botella mágica (SuperChargerType.MagicBottle = 1): botella de capacidad 10/11/16
   * sembrada con N unidades de un único color; el nivel contiene exactamente
   * `capacidad` unidades de ese color. Llenarla es el objetivo del nivel.
   */
  function findMagicBottle(level) {
    var counts = new Map();
    level.bottles.forEach(function (b) {
      b.forEach(function (c) { counts.set(c, (counts.get(c) || 0) + 1); });
    });
    for (var i = 0; i < level.bottles.length; i++) {
      var cap = level.caps[i];
      if (cap <= 4) continue;
      var water = level.bottles[i];
      if (!water.length) continue;
      var uniform = true;
      for (var k = 1; k < water.length; k++) if (water[k] !== water[0]) { uniform = false; break; }
      if (uniform && counts.get(water[0]) === cap) return i;
    }
    return -1;
  }

  function stateFromLevel(level) {
    return {
      bottles: level.bottles.map(function (b) { return b.slice(); }),
      caps: (level.caps || []).slice(),
      blockers: Object.assign({}, level.blockers)
    };
  }

  /* ---------- generación procedural (respaldo / niveles extra) ---------- */
  function difficultyFor(level) {
    var lvl = Math.max(1, Math.floor(level));
    return {
      colors: Math.min(10, 3 + Math.floor((lvl - 1) / 3)),
      empties: lvl <= 2 ? 3 : 2
    };
  }

  function deal(colors, empties, cap, rng) {
    var pool = [];
    for (var c = 0; c < colors; c++) {
      for (var k = 0; k < cap; k++) pool.push(c);
    }
    shuffle(pool, rng);
    var bottles = [];
    for (var i = 0; i < colors; i++) {
      var b = pool.slice(i * cap, (i + 1) * cap);
      if (isUniform(b)) return null;
      bottles.push(b);
    }
    for (var e = 0; e < empties; e++) bottles.push([]);
    return bottles;
  }

  function generate(levelNumber, options) {
    var opts = options || {};
    var diff = difficultyFor(levelNumber);
    var attempts = opts.attempts || 40;
    for (var a = 0; a < attempts; a++) {
      var seed = ((levelNumber + 1) * 2654435761) ^ (a * 40503);
      var rng = mulberry32(seed);
      var bottles = deal(diff.colors, diff.empties, CAPACITY, rng);
      if (!bottles) continue;
      var caps = bottles.map(function () { return CAPACITY; });
      var state = { bottles: bottles, caps: caps, blockers: {} };
      if (isSolvable(state, { limit: opts.limit || 200000 })) {
        return {
          id: "generated-" + levelNumber,
          number: levelNumber,
          tier: 0,
          variant: 0,
          colors: diff.colors,
          caps: caps,
          bottles: bottles,
          blockers: {},
          grid: null
        };
      }
    }
    return null;
  }

  return {
    CAPACITY: CAPACITY,
    topColor: topColor,
    topRun: topRun,
    isUniform: isUniform,
    isBottleComplete: isBottleComplete,
    isComplete: isComplete,
    capacityAt: capacityAt,
    isHidden: isHidden,
    blockerOf: blockerOf,
    pourAmount: pourAmount,
    pour: pour,
    isWon: isWon,
    keyOf: keyOf,
    candidateMoves: candidateMoves,
    solve: solve,
    isSolvable: isSolvable,
    normalizeLevel: normalizeLevel,
    findMagicBottle: findMagicBottle,
    stateFromLevel: stateFromLevel,
    difficultyFor: difficultyFor,
    generate: generate,
    mulberry32: mulberry32
  };
});
