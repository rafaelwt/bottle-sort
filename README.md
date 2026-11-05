# Magic Sort — versión web

Juego de ordenar líquidos por color, jugable en el navegador. Sin dependencias, sin build y sin
backend: se abre el `index.html` y listo.

```bash
xdg-open index.html                                   # doble clic
python3 -m http.server 8080                           # o servirlo para el móvil
node --test test/engine.test.cjs                      # tests
```

## Cómo se juega

Cada botella tiene una capacidad (4 celdas en el modo clásico, 12 en las diarias).
Tocas una botella con líquido y luego otra para verter.

- Se vierte **todo el tramo superior del mismo color**, hasta llenar el destino.
- Solo se puede verter sobre un color igual o sobre una botella vacía.
- Una botella queda resuelta cuando está **llena de un solo color**; al completarse aparece su
  tapón y suena el corcho.
- El nivel se gana cuando todas las botellas están vacías o resueltas.
- Si no queda **ningún vertido posible** y el nivel no está resuelto, el juego se detiene y ofrece
  salida: añadir botella (cuando no hay espacio), mezclar, deshacer o reiniciar. El nivel no se
  pierde y el cronómetro se frena mientras decidís.

**Botella mágica**: en su modo aparece una botella alta a la izquierda, sembrada con unas pocas
unidades de un color. Hay que llenarla entera con ese color (su capacidad completa) para resolver
el nivel.

**Bloqueadores**: la cortina y la cinta ocultan el contenido de una botella; la etiqueta la marca.
No impiden verter: se destruyen al completar botellas (la cinta, al completar una botella vecina).

La selección se cancela sola: si tocas un destino que no corresponde (otro color o sin espacio),
la botella vuelve a su sitio, igual que en el juego original.

## Modos

| Modo | Niveles | Capacidad |
|---|---|---|
| Clásico (4) | 885 | 4 |
| Diarias (12) | 399 | 12 |
| Botella mágica | 274 | 10 / 11 / 16 |
| Bloqueadores | 1 346 | 4 |

Se cambia desde el mapa de niveles (botón **✦** arriba a la izquierda). El progreso, las estrellas
y las monedas se guardan en `localStorage`.

## Boosters

| Booster | Qué hace |
|---|---|
| **Deshacer** | revierte el último vertido (historial real) |
| **Mezclar** | rearma el tablero: parte de una disposición canónica resuelta y la desarma moviendo una unidad por vez; cada paso es reversible con un vertido legal, así que el resultado **siempre tiene solución** |
| **Botella** | añade una botella vacía |
| **Revelar** | muestra el contenido oculto por cortinas y cintas |

Las monedas y los usos son ilimitados (modo exploración). La barra de estrellas usa un objetivo
calculado por nivel: óptimo por BFS cuando el espacio de estados lo permite; si no, una cota del
solver.

## Estructura

```
index.html            UI y contenedores
styles.css            tema, vidrio, agua, chorro, corcho
engine.js             reglas puras (UMD: navegador y Node)
app.js                bucle de juego, DOM, audio, animaciones
data/catalog.json     catálogo por modo (fuente canónica)
data/levels.js        el mismo catálogo como script (permite file://)
sounds/               efectos + música de partida (gameplay_music.ogg|mp3)
sprites/              vidrio de botella, superficies de agua, corcho
test/engine.test.cjs  12 tests
```

## Formato de un nivel

```jsonc
{
  "id": "v3magicsort_v3magicsort5_difficulty1-1",
  "n": 5, "tier": 1, "variant": 1,   // dificultad y variante
  "colors": 4,                        // colores distintos
  "caps":  [4, 4, 4, 4, 4, 4],        // capacidad de cada botella
  "bottles": [[2,1,0,4], [1,0,2,4], [1,4,1,2], [2,2,0,4], [], []],  // 0-22 = ColorId
  "blockers": [{"b": 0, "type": "curtain", "color": 0}],
  "grid":  [{"x": 2.1, "y": 0}]       // posición de cada botella en el tablero
}
```

`bottles[i]` se llena de abajo hacia arriba y su largo no puede superar `caps[i]`.
En los niveles normales cada color aparece exactamente `caps` veces.

## Capas de la botella

El frasco se dibuja en capas:

1. `.water` — las bandas de líquido, **recortadas** por `sprites/mask.png` (silueta interior del
   frasco). Esto es lo que evita que el color se vea "detrás" del vidrio.
2. `.frame` — el vidrio delantero (`sprites/bottle_front.png`) como `border-image`: mantiene el
   cuello y el fondo redondeado a cualquier altura de botella.
3. `sprites/surface-<color>.png` — la elipse de superficie en el tope de cada líquido.
4. `.cork` — tapón apoyado en la boca y halo del color del agua (`--glow`, `StopperGlowColor`).

El contenedor de agua arranca debajo del cuello (`top: calc(var(--seg) * 0.52)`), por eso el
líquido nunca aparece en la boca de la botella.

El agua va **de color plano** (`Color` de cada `ColorConfig`) con un borde horizontal de 8 % a cada
lado: `FrontColor` a la izquierda y `BackColor` a la derecha, que son las dos capas de sprite con
las que el juego da volumen al cilindro (`WaterView._leftSprite` / `_rightSprite`). Al ser
horizontal, la unión entre dos colores sigue siendo una línea recta.

`index.html?flat` deja el agua totalmente plana para comparar. La paleta completa y la explicación
de por qué no se usa 3D están en `docs/logic/palette.md`.

## Animación y audio

El vertido sigue la secuencia del original: la botella **se eleva** en su sitio (90 ms), **se
traslada** sobre la boca del destino (210 ms), **se inclina** y recién entonces cae el agua
(~130 ms + 520 ms de chorro), llenando el destino **unidad por unidad** con un *squash* de
1.07/0.95 → 0.97/1.04 → 1. El origen se vacía en sincronía; al completarse una botella suena el
corcho y aparece el tapón en la boca.

El ángulo de inclinación no es fijo: sale de `_rotationsByHeights` del juego (35° con el destino
casi lleno, 105° con mucho espacio). Los valores están en `docs/logic/palette.md`.

**El agua se mantiene nivelada** mientras la botella se inclina: la superficie libre queda
horizontal y el líquido se recorta contra ese plano (como `WaterItem.RotateWaters` en el juego).
Con ángulos chicos (destino casi lleno) el agua queda apoyada en la base; pasando la horizontal
corre hacia la boca.

La música (`sounds/gameplay_music.*`, `MagicSort_Gameplay_Final`) suena en bucle desde el primer
toque. El botón de **ajustes** (engranaje, arriba a la derecha) abre un panel con dos
interruptores independientes, como en el juego: **Sonido** (efectos) y **Música**. Cada uno
guarda su estado en `localStorage`.

El fondo tiene el campo de estrellas y destellos de 4 puntas que titilan (respetan
`prefers-reduced-motion`).

El HUD muestra **tiempo** del nivel: cuenta para arriba y se detiene al ganar. No hay límite: es
solo para saber cuánto tardaste. El mejor tiempo de cada nivel se guarda en `localStorage`.

El sonido del vertido depende de la cantidad (`1` a `8` unidades tienen clip propio).
Todo se reproduce con elementos `Audio` clonados para tolerar solapamientos y funcionar desde
`file://`.

## Laboratorio

`lab/three-water.html` es una prueba de concepto del agua con three.js (dos cilindros
concéntricos con `FrontColor`/`BackColor`) más una nota de por qué el juego no necesita 3D.
No forma parte de la app y no se carga desde `index.html`.

## Pendiente

- Bloqueadores que restringen movimientos (hielo, arcilla) y objetos especiales: cajas con llave,
  generadores, duende, alfombra.
- Colores ocultos (`?`), `MagicSeal`/`Ivy` (370 niveles del catálogo los usan) y botellas especiales
  distintas de la mágica (BestSort, Chargeable, SingleUse, RainbowWater, KeySort).
- Detección de "sin jugadas" y flujo de reintento; animación de entrada al nivel.
- Eventos, vidas/energía, tienda y clasificaciones.
- Escalado del tablero para pantallas muy pequeñas (5+ filas).

## Material de referencia

En `docs/` está el material de referencia para pulir esta versión: 5 743 sprites, 108 clips de
audio, el índice de 329 animaciones y la documentación de las clases, enums, formato de nivel,
mapas de animación/audio y —en `docs/logic/palette.md` + `configs.json`— la paleta exacta y los
valores de animación del juego (tiempos, curvas y tabla de rotación).
