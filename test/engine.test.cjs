/*
 * Tests del motor y del catálogo de niveles.
 *   node --test test/engine.test.cjs
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const E = require(path.join(__dirname, "..", "engine.js"));
const CATALOG = require(path.join(__dirname, "..", "data", "catalog.json"));

const bt = (...cells) => cells;
const st4 = (bottles, blockers) => ({
  bottles,
  caps: bottles.map(() => 4),
  blockers: blockers || {}
});

test("reglas: vertido del tramo superior completo y tope de capacidad", () => {
  const st = st4([bt(0, 1, 1), bt(1), bt()]);
  assert.equal(E.pourAmount(st, 0, 1), 2, "vierte las dos unidades de color 1");
  const res = E.pour(st, 0, 1);
  assert.deepEqual(res.state.bottles[1], [1, 1, 1]);
  assert.deepEqual(res.state.bottles[0], [0]);
  assert.equal(E.pourAmount(st, 0, 2), 2, "verter a una botella vacía es legal");

  const tight = st4([bt(1, 1, 1), bt(2, 2, 1)]);
  assert.equal(E.pourAmount(tight, 0, 1), 1, "se detiene al llenar el destino");
});

test("reglas: no se vierte sobre un color distinto", () => {
  const st = st4([bt(0, 1), bt(2)]);
  assert.equal(E.pourAmount(st, 0, 1), 0);
  assert.equal(E.pour(st, 0, 1), null);
});

test("reglas: botella larga de 12 celdas acepta 12 unidades del mismo color", () => {
  const st = {
    bottles: [bt(3, 3, 3, 3, 3, 3, 3, 3, 3, 3), bt(3, 3), bt()],
    caps: [12, 4, 4],
    blockers: {}
  };
  assert.equal(E.pourAmount(st, 0, 1), 2, "solo caben 2 en la botella de capacidad 4");
  assert.equal(E.pourAmount(st, 0, 2), 4, "la botella vacía de capacidad 4 solo admite 4");
  const big = { bottles: [bt(5, 5, 5, 5, 5, 5), bt(5, 5, 5, 5, 5, 5), bt()], caps: [12, 12, 12], blockers: {} };
  const res = E.pour(big, 0, 1);
  assert.equal(res.count, 6);
  assert.equal(res.state.bottles[1].length, 12);
  assert.equal(E.isComplete(res.state, 1), true, "12 iguales completan una botella de 12");
});

test("reglas: victoria solo con botellas vacías o completas de un color", () => {
  assert.equal(E.isWon(st4([bt(0, 0, 0, 0), bt()])), true);
  assert.equal(E.isWon(st4([bt(0, 0, 0), bt()])), false);
  assert.equal(E.isWon(st4([bt(0, 0, 1, 1)])), false);
  // una botella larga vacía no cuenta como resuelta si tiene agua mezclada
  assert.equal(E.isWon({ bottles: [bt(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1)], caps: [12], blockers: {} }), false);
});

test("bloqueadores: ocultan contenido y no bloquean vertidos (modelo verificado)", () => {
  const st = st4([bt(1, 1, 1, 1), bt(2, 2, 2), bt()], {
    0: { type: "curtain", color: 1 },
    1: { type: "plaster", color: -1 }
  });
  assert.equal(E.isHidden(st, 0), true);
  assert.equal(E.isHidden(st, 1), true);
  assert.equal(E.isHidden(st, 2), false);
  assert.ok(E.pourAmount(st, 1, 2) > 0, "plaster no impide verter");
});

test("bloqueadores: se destruyen por eventos", () => {
  const st = st4([bt(1, 0, 0, 0), bt(0, 0, 0), bt(1)], { 2: { type: "curtain", color: 0 } });
  const res = E.pour(st, 0, 1);
  assert.ok(res);
  assert.equal(E.isComplete(res.state, 1), true);
  assert.equal(E.blockerOf(res.state, 2), null, "curtain se descorre");

  const st2 = st4([bt(1, 0, 0, 0), bt(0, 0, 0), bt(2, 2)], { 2: { type: "plaster", color: -1 } });
  const res2 = E.pour(st2, 0, 1);
  assert.ok(res2);
  assert.equal(E.blockerOf(res2.state, 2), null, "plaster vecino se rompe");
});

test("catálogo: integridad de niveles y capacidades", () => {
  const modes = Object.keys(CATALOG);
  assert.ok(modes.length >= 4, "hay 4 modos");
  for (const mode of modes) {
    assert.ok(CATALOG[mode].levels.length > 0, `${mode} tiene niveles`);
    for (const raw of CATALOG[mode].levels) {
      const lvl = E.normalizeLevel(raw);
      assert.equal(lvl.caps.length, lvl.bottles.length, `${lvl.id}: caps/botellas`);
      const caps = new Set(lvl.caps);
      const counts = new Map();
      lvl.bottles.forEach((b, i) => {
        assert.ok(b.length <= lvl.caps[i], `${lvl.id}: agua ${b.length} > capacidad ${lvl.caps[i]}`);
        for (const c of b) {
          assert.ok(c >= 0 && c <= 22, `${lvl.id}: ColorId fuera de rango (${c})`);
          counts.set(c, (counts.get(c) || 0) + 1);
        }
      });
      for (const [color, n] of counts) {
        assert.ok(caps.has(n), `${lvl.id}: color ${color} con ${n} unidades y capacidades ${[...caps]}`);
      }
      assert.equal(counts.size, lvl.colors, `${lvl.id}: CC=${lvl.colors} vs ${counts.size} colores`);
    }
  }
});

test("catálogo: colección clásica (4 celdas) resoluble 885/885", () => {
  const levels = CATALOG.classic.levels;
  assert.equal(levels.length, 885);
  const failures = [];
  for (const raw of levels) {
    const lvl = E.normalizeLevel(raw);
    if (!E.isSolvable(E.stateFromLevel(lvl), { limit: 200000 })) failures.push(lvl.id);
  }
  assert.deepEqual(failures, []);
});

test("catálogo: botellas largas (12 celdas) resolubles 399/399", () => {
  const levels = CATALOG.daily.levels;
  assert.equal(levels.length, 399);
  assert.ok(levels.every(l => Math.max(...l.caps) === 12));
  const failures = [];
  for (const raw of levels) {
    const lvl = E.normalizeLevel(raw);
    if (!E.isSolvable(E.stateFromLevel(lvl), { limit: 200000 })) failures.push(lvl.id);
  }
  assert.deepEqual(failures, []);
});

test("catálogo: modo bloqueadores resoluble 1346/1346", () => {
  const failures = [];
  for (const raw of CATALOG.blockers.levels) {
    const lvl = E.normalizeLevel(raw);
    if (!E.isSolvable(E.stateFromLevel(lvl), { limit: 200000 })) failures.push(lvl.id);
  }
  assert.deepEqual(failures, []);
});

test("botella mágica: detectada y resolubles 274/274 (SuperChargerType.MagicBottle)", () => {
  const levels = CATALOG.magic.levels;
  assert.equal(levels.length, 274);
  const failures = [];
  for (const raw of levels) {
    const lvl = E.normalizeLevel(raw);
    const magic = E.findMagicBottle(lvl);
    assert.ok(magic >= 0, `${lvl.id}: sin botella mágica`);
    assert.ok(lvl.caps[magic] > 4, `${lvl.id}: la mágica debe ser larga`);
    // el color de la botella mágica aparece exactamente `cap` veces
    const color = lvl.bottles[magic][0];
    let count = 0;
    lvl.bottles.forEach(b => b.forEach(c => { if (c === color) count++; }));
    assert.equal(count, lvl.caps[magic], `${lvl.id}: color de la mágica incompleto`);
    if (!E.isSolvable(E.stateFromLevel(lvl), { limit: 300000 })) failures.push(lvl.id);
  }
  assert.deepEqual(failures, []);
  // en clásico no hay botella mágica
  assert.equal(E.findMagicBottle(E.normalizeLevel(CATALOG.classic.levels[0])), -1);
});

test("generador procedural: niveles de respaldo también solubles", () => {
  for (const n of [1, 7, 20, 45]) {
    const level = E.generate(n);
    assert.ok(level, `nivel ${n} generado`);
    assert.ok(E.isSolvable(E.stateFromLevel(level), { limit: 200000 }), `nivel ${n} soluble`);
  }
});
