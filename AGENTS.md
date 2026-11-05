# AGENTS.md — Magic Sort (web)

Notas para quien trabaje en este proyecto. Sin dependencias externas, sin build.

## Estructura

```
index.html          UI y contenedores
styles.css          tema + animaciones (vidrio, agua, chorro, corcho)
engine.js           reglas puras (UMD: navegador y Node)
app.js              bucle de juego, DOM, audio, animación
data/catalog.json   catálogo de niveles por modo (fuente canónica)
data/levels.js      mismo catálogo como script (permite abrir con file://)
sounds/*.ogg|mp3    efectos de sonido + música de partida
sprites/*.png       vidrio de botella, superficies de agua, corcho
test/engine.test.cjs  node --test
```

## Reglas del juego (invariantes que no se pueden romper)

1. **Capacidad por botella**, no global: `caps[i]` puede ser 4, 10, 11 o 12/16.
2. Un vertido mueve **todo el tramo superior del mismo color** hasta llenar el destino:
   `cantidad = min(tramoSuperior(origen), capacidad(destino) - largo(destino))`.
3. Solo se vierte si el destino está vacío o su tope es del mismo color.
4. Botella resuelta ⇔ `largo === capacidad && todos iguales`. Nivel resuelto ⇔ todas vacías o resueltas.
5. En los niveles normales cada color aparece **exactamente `capacidad` veces**.
6. **Botella mágica** (`caps[i] >= 10` con agua de un solo color cuyo total == capacidad):
   es el objetivo del nivel, va en la columna izquierda y nunca se oculta.
7. **Bloqueadores** (`curtain`, `plaster`, `tag`) **no** restringen movimientos: ocultan o marcan.
   Se destruyen por eventos (completar una botella, una vecina, o el color etiquetado).
   Si se convierten en bloqueos duros, cientos de niveles dejan de tener solución.

## Reglas del solver (importante)

- `candidateMoves` **no** puede descartar una botella completa como origen: en niveles de
  botella mágica hay que volcar botellas de 4 ya llenas dentro de la grande.
- Las botellas vacías son simétricas: solo se considera la primera como destino.
- `solve()` es DFS con memo; `isSolvable()` se usa para validar mezclas y catálogo.

## Sin jugadas (stuck)

- `E.hasAnyMove(state)` es el chequeo del jugador (cualquier vertido legal, incluye los simétricos
  que `candidateMoves` descarta para el solver). No usar `candidateMoves` para decidir si el
  tablero está trabado.
- `checkStuck()` corre al terminar un vertido, al inicio del nivel y después de cada booster:
  congela el reloj, bloquea el tablero y abre `#stuckOverlay`.
- Salidas del cartel: `doExtra()` (botella nueva, la única salida si no hay espacio libre),
  `doShuffle()` (nunca devuelve un tablero sin solución), `doUndo()` y `doRestart()`.
- `doShuffle()` no reparte al azar: `canonicalLayout()` arma cada color agrupado (la botella
  grande recibe su color completo) y `scrambleUnits()` mueve una unidad por vez a una botella con
  otro tope; como cada paso es reversible con un vertido legal, el resultado es resoluble por
  construcción. El reparto al azar + solver queda sólo como plan B.

## Tests

```bash
node --test test/engine.test.cjs
```

Deben pasar los 12: reglas, bloqueadores, integridad del catálogo (capacidades y conteo de
colores) y solubilidad de los 4 modos (885 / 399 / 274 / 1346 niveles).

## Capas y dibujo (no romper)

- El líquido vive en `.glass > .water`, que tiene `mask: url("sprites/mask.png")`. Si se saca la
  máscara, el color se ve fuera del frasco.
- `.water` empieza debajo del cuello (`top: calc(var(--seg) * 0.52)`); no cambiar sin ajustar la
  máscara (`sprites/mask.png` es el cuerpo del frasco, recortado del sprite del frasco).
- El vidrio delantero es `.frame` con `border-image` de `sprites/bottle_front.png`; va **encima**
  del agua (z-index 6).
- Al completar una botella se agrega `.complete`, que muestra `.cork` (apoyado en la boca:
  `top: var(--pad-top)` con `translate(-50%, -82%)`) y el halo `--glow` del color del agua.
  **Sin anillo ni borde**: el juego no dibuja nada alrededor del frasco al completarlo.
- El agua usa `--c` = `ColorConfig.Color` y dos bordes **horizontales** de 8 %
  (`--c-front` / `--c-back` = `FrontColor` / `BackColor`), que son los `_leftSprite` / `_rightSprite`
  del juego. Nunca degradados **verticales** por tramo: un `rgba(0,0,0,.22)` al pie de cada banda
  hacía que las uniones de color parecieran mezcladas. `?flat` desactiva el sombreado para comparar.
- Nada de three.js: el agua del original son sprites 2D (`WaterView`), no mallas. Ver
  `docs/logic/palette.md`; `lab/three-water.html` es sólo la comparación.

## Convenciones

- JS sin módulos ES ni bundler: `engine.js` usa UMD para servir tanto al `<script>` como a Node.
- Todo el audio se reproduce con `Audio` clonado (`sfx(nombre)`), no con WebAudio, para que
  funcione desde `file://`.
- Audio con **dos interruptores separados**: `save.sfxOn` (efectos: "Sonido", corta `sfx()`) y
  `save.musicOn` (música, `syncMusic()`). El panel vive en `#settingsSheet` y se abre con el
  engranaje del HUD. No volver al `save.sound` único.
- Las estrellas del fondo son dos capas: `.bg-stars` (puntos, `stars-breathe`) y `.bg-sparkles`
  (destellos de 4 puntas generados en `buildSparkles()`, `sparkle-twinkle`). Ambas con
  `z-index: 0` y `pointer-events: none`; no las subas de capa.
- La animación de vertido es incremental (`addUnits`/`drainUnits`), nunca un re-render completo:
  si se re-renderiza, se pierde la fluidez.
- Al inclinar, el agua se recorta con un plano horizontal (`tiltLiquid`): el clipping va en
  `.water` (coordenadas locales) y la elipse de superficie se dibuja aparte en `.glass`
  (`.surface`), porque el `clip-path` de `.water` la cortaría al medio. Si se toca la geometría
  hay que mantener el invariante: **área recortada = nivel de líquido** (se resuelve por bisección).
- `shiftWaterToMouth` se escala con el ángulo (`(angle-70)/35`): por debajo de 90° el líquido queda
  en la base, no en la boca.
- El cronómetro (`timeLabel`) cuenta para arriba y no limita nada; se guarda el mejor tiempo por
  nivel en `save.bestTime["modo:índice"]`.
- La selección no dibuja borde ni halo (el juego no lo hace): `.selected` solo eleva la botella.
- Un destino inválido **deselecciona** (`Selection.Deselect` del original): no dejar la botella
  elevada esperando otro toque.
- El ángulo de vertido sale de `_rotationsByHeights` (celdas libres → grados), no de una constante.
- Al agregar un modo: exportarlo en `data/catalog.json` + `levels.js`, y añadir su test de
  solubilidad. `loadMode()` toma las claves del catálogo.
