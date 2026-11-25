# Fase 1: Apuntar al objetivo

Juego 3D en WebGL2 y TypeScript. Una torreta le dispara a tres objetivos que están a
distinta distancia y altura. Se puede mover la torreta, inclinar el cañón, elegir la fuerza
y disparar.

Toda la geometría (esferas, cajas y cilindros) se genera por código. Para dibujar usamos el
módulo **FixedFunction (FF)** de la materia, que imita el pipeline fijo de OpenGL 2: no hay
shaders propios, hay una sola luz direccional y ninguna textura.

CI4321 Computación Gráfica I, Universidad Simón Bolívar.

## Equipo

- Gabriel Seijas: escena y colores, modelado de la torreta, indicador de fuerza y vista
  previa de la trayectoria.
- Angel Valero: física del tiro parabólico, movimiento e inclinación con límites,
  colisiones y teclado.

## Requisitos

- Node.js 18 o superior
- npm
- Un navegador con soporte de WebGL2

## Cómo ejecutarlo

```
npm install
npm run dev
```

Y abrir `http://localhost:5173` en el navegador.

## Controles

| Tecla | Acción |
| --- | --- |
| <kbd>←</kbd> <kbd>→</kbd> | Mover la torreta horizontalmente (límites: -4 a 4) |
| <kbd>↑</kbd> <kbd>↓</kbd> | Inclinar el cañón (límites: 5° a 90°; 90° es vertical) |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | Elegir el nivel de fuerza |
| <kbd>F</kbd> | Pasar al siguiente nivel de fuerza |
| <kbd>Espacio</kbd> | Disparar |
| <kbd>R</kbd> | Reiniciar la escena |

La fuerza se ve en las tres barras verdes del frente de la torreta (las prendidas en verde
claro y las apagadas en verde oscuro). La línea blanca que sale del cañón es la vista previa
de la trayectoria; mientras la bala está volando no se muestra.

## Otros comandos

| Comando | Acción |
| --- | --- |
| `npm run build` | Comprueba los tipos con `tsc` y compila a `dist/` |
| `npm run preview` | Sirve localmente el `dist/` ya compilado |
| `npx tsc --noEmit` | Solo la comprobación de tipos |

### Probar que la física no depende de los FPS

Con `?fps=` en la URL se limitan los FPS:

```
http://localhost:5173/?fps=30
```

Si se dispara con la misma fuerza y el mismo ángulo con distintos FPS, la bala cae en el
mismo punto, porque la física avanza en pasos fijos de 1/120 s con un acumulador. El
limitador solo puede bajar los FPS: `?fps=30` sirve en cualquier pantalla, pero para ver 144
FPS hace falta un monitor de 144 Hz. Además redondea a un divisor de los Hz de la pantalla,
porque se salta frames enteros (en 60 Hz, pedir 45 da 30).

También hay una prueba automática. Con `npm run dev` abierto, en la consola del navegador:

```js
(await import('/src/game/fps-check.ts')).fpsCheck()
```

Simula los mismos tiros a 30 y a 144 FPS y muestra una tabla comparando los resultados
(reinicia la partida al terminar).

## Estructura del proyecto

```
index.html                    página y canvas
src/main.ts                   arranque de WebGL y game loop
src/constants.ts              tamaño del canvas, layout del vértice y paleta
src/state.ts                  estado compartido entre los dos integrantes
src/geometry/
  mesh.ts                     malla genérica: VAO intercalado y drawMesh
  sphere.ts                   esfera unitaria por latitud y longitud
  box.ts                      caja unitaria de 24 vértices, normales planas
  cylinder.ts                 cilindro unitario, lateral suave y tapas planas
src/render/
  scene.ts                    cámara fija, iluminación y suelo
  turret.ts                   jerarquía de la torreta y muzzleTransform
  targets.ts                  los tres objetivos y la bala
  power.ts                    indicador de nivel de fuerza
  preview.ts                  vista previa de trayectoria (VBO dinámico)
  explosion.ts                easter egg: la bala te cae encima con un tiro vertical
src/game/
  input.ts                    teclado
  physics.ts                  tiro parabólico con paso fijo
  collision.ts                colisión bala-objetivo
  fps-check.ts                prueba de 30 vs 144 FPS (no es parte del juego)
src/vendor/ff/                FF v1.0 (no se modifica)
docs/notas-A.md               bitácora de Gabriel (render)
docs/notas-B.md               bitácora de Angel (física y teclado)
```

## El game loop

Cada frame hace tres cosas en este orden:

1. `processInput(dt)` aplica lo que se apretó en el teclado.
2. `update(dt)` mueve la física y revisa las colisiones.
3. `render(...)` dibuja.

Las mantuvimos separadas: `render` no cambia el estado y `update` no llama a WebGL. El `dt`
tiene un tope de 0.1 s, porque `requestAnimationFrame` se pausa cuando la pestaña está
oculta y al volver la bala pegaba un salto. La física avanza en pasos fijos de 1/120 s con un
acumulador, así que la trayectoria sale igual a 30, 60 o 144 FPS.

## Notas de implementación

- Las tres mallas son unitarias y se suben a la GPU una sola vez. El tamaño y la posición de
  cada cosa salen de su matriz de modelo, así que con una esfera alcanza para los tres
  objetivos y la bala.
- La torreta es una jerarquía padre → hijo. La escala va solo en las hojas, nunca en un nodo
  que tenga hijos; si no, la escala del chasis deformaría el cañón.
- `muzzleTransform` saca la posición y la dirección de la boca de la misma matriz del pivote
  que se usa para dibujar, entonces la bala sale de la punta que se ve.
- La vista previa usa la misma función y el mismo paso que el vuelo real, por eso la línea
  coincide con la trayectoria.
- FF corre con `debug: true` y avisa en la consola si hay matrices con NaN, una matriz normal
  vieja o errores de GL. La consola tiene que quedar limpia.

## Problemas frecuentes

- **Página en blanco o "WebGL2 no está disponible."** Activar la aceleración por hardware en
  el navegador o probar con otro.
- **El puerto 5173 está ocupado.** Cerrar el otro proceso o usar `npx vite --port 3000`.
