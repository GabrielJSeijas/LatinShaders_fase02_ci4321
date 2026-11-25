# Notas - Persona B (entrada, fisica, colision)

Lo que fuimos decidiendo y los problemas que salieron, para el video y el PDF.

## Checkpoint 1 - juego jugable (2026-10-31)

### Objetivo
Hacer todo lo de `src/game/`: flechas con limites y movimiento suave, fuerza con 1/2/3/F,
disparo con Espacio, R para reiniciar, el vuelo parabolico y la colision con los objetivos.
Sin tocar `state.ts` ni `main.ts`, y sin cambiar las firmas de `stepProjectile` y
`muzzleTransform` porque la parte de render las usa.

### Decisiones

- **Paso fijo con acumulador.** El dt del frame no se usa para integrar, solo se suma a
  un acumulador y la bala avanza de a `FIXED_DT = 1/120 s`. A 30 FPS salen unos 4 pasos
  por frame y a 144 salen 0 o 1, pero las posiciones son las mismas (paso 1, paso 2...).
  Lo unico que cambia es cuantas se alcanzan a dibujar.
- **Colision y suelo en cada paso, no una vez por frame.** Si se revisa por frame, a 30 FPS
  la bala avanza como 0.5 unidades entre revisiones y puede atravesar un objetivo que a
  144 FPS si golpea. Por eso `updatePhysics` llama a `hitTest()` dentro del while.
  `checkCollisions()` quedo solo porque `main.ts` la llama.
- **Maximo 15 pasos por frame**, por si algun frame tarda demasiado. Con el `MAX_DT = 0.1`
  de `main.ts` nunca pasa de 12, asi que en la practica no se activa.
- **Esfera contra esfera** comparando al cuadrado:
  `|bala - objetivo|^2 <= (r_bala + r_objetivo)^2`, asi no hace falta sacar raiz.
- **La bala termina cuando el borde de abajo toca el suelo** (`y - r <= 0`), no el centro.
  Si le pega a un objetivo tambien se para, o sea un tiro tumba uno solo.
- **Bala en reposo pegada a la punta**: mientras no vuela, `updatePhysics` copia la
  posicion de `muzzleTransform`.
- **Disparo**: `vel = dir * POWER_SPEEDS[power - 1]`. `dir` ya viene normalizado, asi que la
  rapidez es justo la de la fuerza elegida. El acumulador se pone en 0 al disparar.
- **Dos tipos de tecla.** Para las flechas importa si estan apretadas (un `Set`); las demas
  se guardan en una cola y `processInput` las procesa una vez por frame. El auto-repeat se
  ignora (`e.repeat`), asi mantener Espacio no dispara varias veces.
- **Movimiento suave (el extra).** La flecha no mueve la posicion, dice a que velocidad
  queremos ir (+max, -max o 0). La velocidad real se acerca a esa con una aceleracion
  (0.25 s hasta la maxima) y frena mas rapido al soltar o al cambiar de sentido. Todo con
  dt. Torreta a 4 u/s, canon a 60 grados/s.
- **Limites inclusivos.** Si se pasa, se recorta al valor del limite y la velocidad queda en
  0, asi 5 y 90 grados (y x = -4 / 4) se pueden alcanzar de verdad.
- **Con la bala en el aire se puede mover, apuntar y cambiar la fuerza**, solo cuenta para el
  siguiente tiro. Espacio no hace nada hasta que la bala termine.
- **Detalles del teclado**: `preventDefault` en flechas y Espacio porque si no la pagina hace
  scroll. Con Ctrl/Alt/Cmd la tecla se le deja al navegador (Ctrl+R recarga, no reinicia el
  juego). Si se pierde el foco de la ventana se sueltan las flechas, porque el `keyup` nunca
  llega y la torreta seguia moviendose sola.

### Prueba de 30 vs 144 FPS (`src/game/fps-check.ts`)

Con `npm run dev` abierto, en la consola del navegador:

```js
(await import('/src/game/fps-check.ts')).fpsCheck()
```

Le pasa al `updatePhysics` real frames de 1/30 y de 1/144 y compara cada posicion con una
corrida de referencia de un paso por frame. Prueba las 3 fuerzas con 5, 30, 45, 60 y 90
grados y ademas busca un tiro que le pegue a cada objetivo. Ojo que al final reinicia la
partida.

Resultados:

- En los 18 casos: 0 puntos fuera de la curva, mismo punto final y mismo objetivo tumbado.
- La ultima columna es para comparar: integrando directo con el dt del frame (sin paso fijo)
  el mismo tiro cae hasta ~0.3 unidades mas lejos o mas cerca segun los FPS. Ese es el error
  que nos evita el acumulador.
- Tiros que aciertan con la torreta real (pivote a 1.0, tubo de 1.9), con la torreta en la x
  del objetivo: objetivo 0 con fuerza 1 a 5 grados, objetivo 1 con fuerza 2 a 20.5 y objetivo
  2 con fuerza 3 a 17. Cada fuerza le pega al menos a uno. (Con la torreta provisional eran
  10.5, 24.5 y 19.5.)

### Limitador de FPS

Para grabar la comparacion hacia falta poder bajar los FPS. Yo propuse una version con
`setTimeout`, pero A lo hizo saltando frames de `requestAnimationFrame` con `?fps=N` en la
URL, que es mas simple. La diferencia es que asi solo se pueden bajar los FPS: para mostrar
144 hay que grabar en un monitor de 144 Hz. Esta explicado en `main.ts` y en las notas de A.

### Dificultades

- **Probar sin navegador.** El proyecto no tiene test runner y Node no entiende los imports
  sin extension que usa Vite. Lo resolvimos compilando con `vite build --ssr` y corriendo eso
  con Node. Para el teclado usamos un `window` falso (un `EventTarget`) y le mandamos eventos.
- **Al arrancar desde quieto frenaba en vez de acelerar.** La primera version decidia frenar
  cuando los signos de la velocidad y del objetivo no coincidian, pero `Math.sign(0)` es 0,
  entonces al arrancar usaba la desaceleracion. Lo cambiamos a `vel * target < 0`, que solo
  se cumple cuando cambia de sentido.
- **A 144 FPS el primer frame no da ningun paso** (1/144 es menos que 1/120) y la bala sigue
  en la punta. En la prueba contamos la punta como primer punto de la curva.

### Integracion con la torreta real (2026-10-31)

Se mezclo `main` (torreta, objetivos, bala, barras de fuerza y vista previa) en `juego` sin
conflictos, porque A no toco `src/game/` ni `state.ts` y `muzzleTransform` quedo con la misma
firma. Pasaron el build, `fpsCheck()` (tambien desde el navegador) y las pruebas del teclado.
Tambien lo probamos jugando: la torreta llega a los dos limites, el canon sube a 90 y con
fuerza 3 se tumba el objetivo del fondo.

Habia una diferencia con la vista previa: la linea terminaba cuando el centro llegaba a
y = 0 y la bala real cuando el borde toca el suelo, asi que la linea quedaba 0.15 mas
larga. Se lo dijimos a A y ya lo corrigio.

### Pendientes

- Si en el checkpoint 2 cambian `POWER_SPEEDS` o los objetivos, correr `fpsCheck()` de nuevo
  para ver que cada fuerza siga acertando alguno.
- A 144 Hz con `FIXED_DT = 1/120` hay frames sin paso y la bala se puede ver un poco a
  saltos. Se arreglaria interpolando entre los dos ultimos pasos al dibujar, pero habria que
  agregar un campo a `state.ts`. Lo dejamos como mejora opcional.
