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
sounds/*.ogg|mp3    efectos de sonido
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
- Al completar una botella se agrega `.complete`, que muestra `.cork` y el brillo `glow.png`.

## Convenciones

- JS sin módulos ES ni bundler: `engine.js` usa UMD para servir tanto al `<script>` como a Node.
- Todo el audio se reproduce con `Audio` clonado (`sfx(nombre)`), no con WebAudio, para que
  funcione desde `file://`.
- La animación de vertido es incremental (`addUnits`/`drainUnits`), nunca un re-render completo:
  si se re-renderiza, se pierde la fluidez.
- Al agregar un modo: exportarlo en `data/catalog.json` + `levels.js`, y añadir su test de
  solubilidad. `loadMode()` toma las claves del catálogo.
