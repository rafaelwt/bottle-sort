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

**Botella mágica**: en su modo aparece una botella alta a la izquierda, sembrada con unas pocas
unidades de un color. Hay que llenarla entera con ese color (su capacidad completa) para resolver
el nivel.

**Bloqueadores**: la cortina y la cinta ocultan el contenido de una botella; la etiqueta la marca.
No impiden verter: se destruyen al completar botellas (la cinta, al completar una botella vecina).

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
| **Mezclar** | reparte de nuevo el líquido restante y **verifica que siga teniendo solución** antes de aceptar |
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
sounds/               efectos (vertido, corcho, victoria, bloqueadores, UI)
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
4. `.cork` + `sprites/glow.png` — tapón y brillo cuando la botella queda completa.

El contenedor de agua arranca debajo del cuello (`top: calc(var(--seg) * 0.52)`), por eso el
líquido nunca aparece en la boca de la botella.

## Animación y audio

El vertido se hace en cuatro tiempos: la botella se eleva y se traslada **encima del destino**,
se inclina 52°, cae un chorro del color vertido hasta la superficie y el frasco destino se llena
**unidad por unidad** (55–110 ms según cantidad) con un *squash* de 1.07/0.93 → 0.97/1.04 → 1.
El origen se vacía en sincronía; al completarse una botella suena el corcho y aparece el tapón.

El sonido del vertido depende de la cantidad (`1` a `8` unidades tienen clip propio).
Todo se reproduce con elementos `Audio` clonados para tolerar solapamientos y funcionar desde
`file://`.

## Pendiente

- Colores ocultos (`?`) y objetos especiales (generadores, cajas, duendes).
- Eventos, vidas/energía, tienda y clasificaciones.
- Escalado del tablero para pantallas muy pequeñas (5+ filas).

## Material de referencia

En `docs/` está el material de referencia para pulir esta versión: 5 743 sprites, 108 clips de
audio, el índice de 329 animaciones y la documentación de las clases, enums, formato de nivel y
mapas de animación/audio.
