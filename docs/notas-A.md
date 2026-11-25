# Notas - Persona A (escena, torreta, indicador de fuerza, vista previa)

Lo que fuimos decidiendo y los problemas que salieron, para el video y el PDF.

## Checkpoint 0 - esqueleto y contrato (2026-10-27)

### Objetivo
Dejar en `main` las carpetas, el estado compartido (`src/state.ts`) y los stubs de
Persona B, para poder trabajar en paralelo sin pisarnos.

### Decisiones

- **El estado es un solo objeto y nadie lo reasigna.** `state` es `const` y `resetState()`
  cambia los valores adentro. Asi si el render guarda una referencia a `state.projectile.pos`
  o a un `Target`, sigue sirviendo despues de apretar R.
- **La torreta esta en `z = 0` y dispara hacia `-Z`.** Los objetivos tienen z negativa y la
  camara va detras (z positiva) y arriba. De ahi sale la direccion del canon:
  `dir = (0, sin(pitch), -cos(pitch))`. Con 90 grados da `(0, 1, 0)` (vertical) y con 5 queda
  casi horizontal.
- **`muzzleTransform(out)` llena un objeto en vez de devolver uno nuevo.** Se llama varias
  veces por frame (bala en reposo, disparo, vista previa) y si devolviera `{ pos, dir }`
  crearia vectores nuevos cada vez. Asi quien llama tiene sus vectores y los reusa, igual que
  las matrices temporales de `main.ts`.
- **Esa firma no cambia**, es lo que usa B. La primera version calcula `pos` y `dir` con
  trigonometria y la final los saca de la jerarquia de matrices, pero da el mismo resultado,
  asi que B no tiene que tocar nada.
- **Euler semi-implicito en `stepProjectile`.** Primero se actualiza la velocidad con la
  gravedad y despues la posicion con la velocidad nueva. Cuesta lo mismo que el explicito y es
  mas estable. Lo que me importa: la vista previa usa la misma funcion y el mismo `FIXED_DT`,
  asi que la linea coincide con el vuelo real.

### Dificultades

- **`noUnusedParameters: true` en `tsconfig.json` no deja compilar los stubs vacios.**
  `export function processInput(dt: number) {}` da error. Le puse `_dt` (TypeScript ignora
  los que empiezan con guion bajo) y anote que B lo cambia cuando lo implemente.
  `updatePhysics` si usa `dt`, con un acumulador provisional.
- **`docs/enunciado.pdf` no estaba en el repo** cuando empece. Trabajamos con lo que
  acordamos en el equipo; hay que revisar contra el PDF cuando lo suban.

### Pendientes que afectan a render

- Las posiciones de los objetivos (`INITIAL_TARGETS`) y las rapideces (`POWER_SPEEDS`) son
  provisionales. En el checkpoint 2 se ajustan juntas para que cada fuerza le pegue a por lo
  menos un objetivo.
- El cubo del ejemplo base sigue en `main.ts` como `TEMPORAL`. Se borra cuando entren la
  torreta y los objetivos. (Ya se borro.)

## Temas para explicar en el video

- Normales de la esfera: por que la normal es igual a la posicion en una esfera unitaria.
- Caja de 24 vertices y no de 8: cada vertice tiene una sola normal y cada cara necesita la suya.
- Jerarquia de la torreta y por que la escala no se hereda a los hijos.
- La matriz normal: por que es la inversa transpuesta de la 3x3 del modelo y por que FF no la
  calcula solo con `setModelMatrix`.
- VBO dinamico (`DYNAMIC_DRAW`) en la vista previa, reusando el mismo `Float32Array`.

## Paso 1 - geometry/mesh.ts

- **Un solo buffer intercalado** (`x y z nx ny nz`, stride 24, la normal empieza en el byte
  12) en vez de un buffer por atributo. Asi cada vertice queda junto en memoria.
- **El VAO no guarda cual `ARRAY_BUFFER` esta ligado**, guarda lo que se le dio en
  `vertexAttribPointer`. El `ELEMENT_ARRAY_BUFFER` si queda guardado. Esto confunde bastante,
  asi que lo deje anotado en el codigo.
- **Sin `ATTRIB.COLOR`.** Con `LIGHTING` el color sale del material, y si se activa el color
  por vertice FF en modo debug avisa que lo ignora. Un warning menos.
- **La `mat3` de la matriz normal es una sola temporal del modulo.** `drawMesh` se llama
  muchas veces por frame (suelo, 5 piezas de la torreta, 3 objetivos, 3 barras, la bala) y asi
  no se crea ninguna matriz nueva por frame.
- `STATIC_DRAW` porque la geometria no cambia. Lo que cambia cada frame es la matriz de modelo.

## Paso 2 - geometry/sphere.ts

- **Normal = posicion.** En una esfera de radio 1 en el origen, el vector del centro al punto
  es perpendicular a la superficie y ya mide 1. Por eso cada vertice repite sus coordenadas,
  una vez como posicion y otra como normal, sin normalizar nada.
- **Una sola malla para todas las esferas.** Es unitaria y en el origen; el radio (objetivo o
  bala) y la posicion los pone la matriz de modelo.
- **Columna de costura repetida.** Hay `lonBands + 1` columnas: phi = 0 y phi = 2*PI son el
  mismo punto pero se guarda dos veces. Ahora no hace falta, pero los indices quedan mas
  simples y con texturas seria necesario (ese vertice lleva u = 0 de un lado y u = 1 del otro).
- **Triangulos en los polos.** Cada celda da dos triangulos, menos en las bandas de los polos,
  donde la fila del polo es un solo punto y uno de los dos tendria area 0. Ese se salta.
  Total: `lonBands * (2*latBands - 2)` triangulos.
  *Problema:* en la primera version tenia las dos condiciones al reves (saltaba el triangulo
  bueno y mandaba el degenerado). Lo encontre revisando el area minima de los triangulos.
- **Antihorario visto desde afuera.** Con `CULL_FACE` activo, si el orden queda al reves la
  esfera desaparece, porque se descartan justo las caras que mira la camara. El orden bueno
  por celda es `(topLeft, bottomLeft, bottomRight)` y `(topLeft, bottomRight, topRight)`.
- **Como lo probe.** `sphereData()` no usa WebGL, asi que se puede probar fuera del navegador.
  Con 4 combinaciones de bandas revise: indices dentro de rango, normal igual a la posicion,
  `|normal| = 1` (error < 4e-8), ningun triangulo degenerado, y que en cada triangulo
  `(v1-v0) x (v2-v0)` apunte hacia afuera (producto punto con el centroide positivo).

## Paso 3 - geometry/box.ts

- **24 vertices y no 8.** El cubo tiene 8 esquinas pero cada vertice guarda una sola normal,
  y en cada esquina se juntan 3 caras que miran a lados distintos. Para que las aristas se vean
  marcadas cada cara lleva sus 4 vertices: 6 x 4 = 24. Con 8 y la normal promediada las aristas
  se verian redondeadas.
- **La genero con una tabla en vez de escribirla a mano.** Cada cara tiene su normal y dos ejes
  u y v con `u x v = normal`. Si se recorren las esquinas `(-u,-v), (+u,-v), (+u,+v), (-u,+v)`
  queda antihorario desde afuera sin tener que pensarlo: los lados son 2u y 2v y su producto
  cruz es `4*(u x v) = 4*normal`, hacia afuera. Asi no dependo de escribir bien 24 lineas.
- **Lado 1 centrada en el origen** (de -0.5 a 0.5), asi `scale(ancho, alto, fondo)` da esas
  medidas tal cual y la misma malla sirve para el suelo, el chasis y las barras.
- **Como lo probe.** `boxData()` tampoco usa WebGL: 24 vertices, 36 indices, coordenadas en
  +-0.5, 8 esquinas distintas repetidas 3 veces cada una (o sea, "24 y no 8"), las 4 esquinas
  de cada cara con la misma normal unitaria, 6 normales distintas, area total 6.000000, ningun
  degenerado, y en cada triangulo la normal calculada coincide con la guardada (cos = 1), que
  comprueba de una el orden y el sombreado plano.

## Lo que encontre leyendo los shaders de FF (ff.vert.glsl)

Dos cosas que afectan todo el render y que hay que explicar en el video:

- **FF normaliza la normal despues de la matriz normal**: `normalize(u_normalMatrix * a_normal)`.
  Por eso la escala no uniforme del suelo (caja aplastada a 40 x 0.2 x 80) no da problema y no
  hay que renormalizar nada nosotros. Igual hay que pasar la matriz normal: sin ella la normal
  se transforma con la matriz de modelo y queda torcida, y normalizarla no la endereza.
- **La luz se calcula por vertice (Gouraud)**: todo esta en el vertex shader y el fragment
  solo interpola `v_primary`. Eso implica:
  - En una cara plana con luz direccional y sin especular, Gouraud da el valor exacto porque
    `n` y `l` son iguales en toda la cara. El suelo sale de un color parejo.
  - El especular si depende del vector al ojo, que cambia en cada vertice. Si algun dia se usa
    `shininess > 0`, una cara grande con 4 vertices mostraria el brillo mal. Por ahora el
    especular es 0 (lo que trae FF por defecto), asi que no afecta.
  - El shader recorta `primary` a [0, 1]. Con `globalAmbient = 0.3` y `diffuse = 1.0`, un
    color de 0.85 llega a `0.85*0.3 + 0.85*1 = 1.105` donde `n . l = 1`, se recorta y lo mas
    iluminado pierde el degradado. Lo arreglo en el paso 5.

## Paso 5 - render/scene.ts (camara, luz y suelo)

### La camara la calculamos en vez de ponerla a ojo

La camara no se mueve en todo el juego, asi que el encuadre hay que poder justificarlo. Hice
un script que proyecta a NDC lo que si o si tiene que caber (los extremos de la torreta, los
objetivos con su radio y las parabolas de las 3 fuerzas), ajusta la distancia para que lo mas
extremo quede al 90% del cuadro y mide tres cosas que se pelean entre si:

1. **Separacion**: que tanto se separan los objetivos en pantalla. Sin texturas ni sombras es
   lo unico que deja ver la profundidad.
2. **Ancho**: cuanto ocupa el recorrido de la torreta. Si es chico, la torreta y las barras no
   se ven bien.
3. **Arco**: que tanto se aleja la parabola, en pantalla, de la recta entre la salida y la
   caida. O sea, si se nota que es curva.

**Lo mas curioso: con la camara justo detras (yaw = 0) el arco da 0.000.** No es un error. La
parabola esta en el plano YZ y si la camara esta en ese mismo plano, toda la trayectoria se
ve como una linea recta. Por eso la camara no puede ir justo detras.

**Con poquito yaw alcanza.** Con 6 grados el arco ya llega al 76% de su maximo y se mantiene
la vista casi desde atras, que hace mas facil apuntar en X. Una vista de tres cuartos (yaw 45,
pitch 40) solo separa 6% mas los objetivos y a cambio aplana el arco 62% y achica la torreta 67%.

**Hay un angulo que evitar.** Cerca de yaw 20 con pitch bajo los tres objetivos quedan uno
encima del otro en pantalla (separacion 0.024).

Quedo: ojo en `(1.8, 5.1, 8.8)` mirando a `(0, 1.5, -8)`, o sea yaw 6 y pitch 12.

*Problema:* al principio solo maximizaba la separacion, y eso mandaba la camara al picado
maximo (el borde de la busqueda). Faltaba medir el arco. Ademas, dividir cada medida por su
maximo hacia que la separacion ganara siempre, porque su maximo salia de un caso degenerado.
Lo cambie a normalizar por el rango que realmente aparecia.

### Lo que dejamos fuera de cuadro

No cabe a la vez el recorrido de la torreta (8 unidades de ancho a 9 de distancia) y lo mas
alto de un tiro vertical a fuerza 3 (15 metros). Para que entrara habia que alejar la camara
61% y la torreta casi no se veria, asi que preferimos encuadrar el juego y no todos los tiros
posibles. En el peor caso (x de -4 a 4): fuerza 1 cabe con cualquier angulo, fuerza 2 hasta 63
grados y fuerza 3 hasta 48. Hasta 45 grados cabe todo con cualquier fuerza, y los tiros que
aciertan van entre 10 y 30. Los muy altos se salen por arriba y vuelven a entrar, como en
cualquier juego de artilleria.

### Luz: ambiente + difusa = 1

El vertex shader calcula `ka * ambienteGlobal + kd * difuso * max(n.l, 0)` y recorta a [0, 1].
Con `ka = kd = color`, el maximo es `color * (ambiente + difuso)`; si esa suma pasa de 1, lo mas
iluminado se satura. El ejemplo base traia 0.2 + 1.0 = 1.2 y el naranja de los objetivos (0.85)
llegaba a 1.02. Con **0.25 + 0.75 = 1** llega justo a 1 sin pasarse. Lo revise con los siete
colores de la paleta.

### El tamano del suelo

El suelo es la caja escalada a 900 x 0.2 x 900. El tamano sale de una cuenta: en el borde del
fondo (786 unidades) el frustum mide 434 de semiancho, asi que con 450 no se ven los lados. La
primera version de 600 dejaba ver los bordes y parecia una pasarela con cielo a los costados.
El borde del fondo queda 0.39 grados debajo del horizonte, asi que se ve como horizonte y no
como un escalon.

### Marcas de distancia (no las pide el enunciado)

Cinco franjas cada 5 unidades. Sin texturas ni sombras no hay forma de saber si un objetivo
esta lejos y alto o cerca y bajo, y las franjas ayudan con eso. Usan la misma caja, asi que no
agregan geometria, y estan apoyadas encima del suelo (alto 0.06) en vez de en el mismo plano,
para que no haya z-fighting. Se apagan con `SHOW_DISTANCE_MARKS = false`.

### Planos de recorte

`near = 0.5` y `far = 1200`. No bajamos mas el near porque la precision del depth buffer
depende de far/near, no solo de far.

## Paso 4 - geometry/cylinder.ts

Cilindro de radio 1 y altura 1, eje en +Y, centrado en el origen. Es el tubo, la boca y las
cuatro ruedas.

- **Las tapas tienen sus propios vertices y el costado no.** El costado lleva normales
  radiales para que se vea redondo; las tapas, normales planas (+Y y -Y) para que el borde se
  vea marcado. El vertice del borde no puede tener las dos normales, asi que se duplica. Es lo
  mismo que en la caja pero solo donde hace falta: en el costado los dos anillos si comparten
  la normal por columna. Con 24 divisiones quedan 102 vertices.
- **Las dos tapas van en sentido contrario.** `(centro, j, j+1)` es antihorario visto desde +Y;
  en la tapa de abajo hay que invertirlo, porque "desde afuera" ahi es desde -Y.
- **Como lo probe.** Normales unitarias, en el costado `ny = 0` y `(nx, nz) == (x, z)`, los dos
  anillos con la misma normal por columna, tapas con normal (0, +-1, 0), todos los puntos a
  radio 0 o 1 y en `y = +-0.5`, ningun degenerado, y cada triangulo mirando hacia afuera.
  Tambien que el area del costado sube con las divisiones y se acerca a 2*pi sin pasarse
  (12 -> 6.2117, 48 -> 6.2787, 360 -> 6.2831, limite 6.28319).

## Paso 6 - render/turret.ts (checkpoint 1)

Jerarquia de 8 piezas:

```
base    = T(turretX, 0, 0)
|- chasis = base . T(0, 0.55, 0) . S(2.4, 0.5, 3.0)            caja
|- 4 ruedas = base . T(+-1.15, 0.3, +-1.0) . Rz(90) . S(0.3, 0.18, 0.3)   cilindros
|- 3 barras = base . ...                                       (power.ts)
\- pivote  = base . T(0, 1.0, 0) . Rx(pitch)
   |- cabeza = pivote . S(1.3, 0.65, 1.5)                      caja
   |- tubo   = pivote . Rx(-90) . T(0, 0.95, 0) . S(0.1, 1.9, 0.1)
   \- punta  = pivote . T(0, 0, -1.78) . Rx(-90) . S(0.15, 0.24, 0.15)
```

### Por que la escala no se hereda

El chasis mide 2.4 x 0.5 x 3.0, su matriz tiene una escala muy no uniforme. Si el pivote
colgara del chasis, esa escala pasaria a la cabeza y al tubo y el canon saldria aplastado en Y
y estirado en Z. Y encima al girar se deformaria distinto en cada angulo, porque escalar y
despues rotar no es lo mismo que rotar y despues escalar. Por eso el pivote cuelga de `base`.
La regla que seguimos: **base y pivote solo llevan traslacion y rotacion, y la escala va al
final, en la hoja.**

### muzzleTransform: el punto con w = 1 y la direccion con w = 0

Los dos salen de la misma matriz del pivote que usa el dibujo, asi que la bala sale de la
punta que se ve, sin repetir la trigonometria en dos lugares.

- `pos` es el punto `(0, 0, -BARREL_LENGTH)` del pivote, transformado como punto (w = 1), asi
  que le afecta la traslacion.
- `dir` es el vector `(0, 0, -1)`, transformado como direccion (w = 0): solo le afecta la
  rotacion. Por eso uso la 3x3 (`mat3.fromMat4` + `vec3.transformMat3`) y no la 4x4. Con
  `vec3.transformMat4` se le sumaria la posicion de la torreta y apuntaria a cualquier lado.

En el pivote el canon apunta a -Z, y `Rx(pitch)` lleva `(0,0,-1)` a
`(0, sin(pitch), -cos(pitch))`: 90 grados vertical y 5 casi horizontal.

### Como lo probe

Cambie `drawMesh` por una version que guarda la matriz de cada pieza, y con esas matrices revise:

1. `muzzleTransform` da lo mismo que la formula en 35 combinaciones de posicion y angulo
   (error maximo 1.2e-7 en posicion y 2.2e-8 en direccion), y `|dir| = 1` siempre.
2. Con pitch 90 la direccion es `(0, 1, 0)`; con pitch 5, `z = -0.9962`.
3. Moviendo la torreta 3 en X, las 8 matrices se mueven +3 en X y nada mas, o sea hay una
   sola raiz.
4. La cabeza tiene su propia escala (1.3, 0.65, 1.5) y no multiplicada por la del chasis.
5. La punta dibujada coincide con la boca de `muzzleTransform` (error maximo 2.4e-7) en 12
   combinaciones.
6. El tubo empieza en el pivote `(0, 1, 0)` y termina en la boca.
7. Las ruedas tocan el suelo: recorriendo todo el borde, el punto mas bajo es `y = 0.000000`.

*Problema:* la prueba 7 fallo al principio, pero el error estaba en la prueba. Despues de
`Rz(90)` el eje del cilindro queda en X, entonces la direccion radial es `(+-1, 0, 0)` y yo
estaba probando `(0, 0, +-1)`. Lo arregle recorriendo todo el borde en vez de dos puntos.

## Paso 7 - render/targets.ts

- Objetivos y bala usan la misma esfera unitaria, solo cambia la posicion, el radio y el color.
- Los objetivos con `alive === false` no se dibujan. Render solo lee el estado; el que pone
  `alive` en false es la colision, en el update.
- La bala en reposo se dibuja en la boca con `muzzleTransform`, no con una posicion guardada.
  Asi sigue al canon sola cuando se mueve la torreta o cambia el angulo.

## Paso 8 - render/power.ts

- Las tres barras cuelgan de `base`, igual que la torreta. Se mueven con ella en X pero no
  giran con el canon (eso es del pivote). Es lo que queriamos: el indicador va con el vehiculo
  y no se mueve cuando sube el canon.
- Se prenden de forma acumulada (`i < state.power`): con fuerza 2 se prenden las dos de abajo.
  Las apagadas se dibujan verde oscuro para que se vea cuantas faltan.
- Van en la cara +Z del chasis (z = 1.5), la que da a la camara, y sobresalen medio grosor
  para que no haya z-fighting.

## Paso 9 - render/preview.ts (extra)

- **No tiene su propia fisica.** Usa el mismo `stepProjectile` y el mismo `FIXED_DT` que el
  vuelo, sobre copias de la posicion y la velocidad, asi que la linea coincide con el tiro.
- **VBO dinamico.** Los puntos cambian cada frame, entonces el buffer se reserva una vez con el
  tamano maximo y `DYNAMIC_DRAW`, y despues solo se reescribe con `bufferSubData` (nunca otra
  vez `bufferData`). El mismo `Float32Array` se reusa siempre. `bufferSubData` cuenta el
  offset y el largo en elementos del array, asi que subimos solo los `count * 3` floats que se
  usaron.
- **Su propio formato de vertice.** Solo posicion: stride de 12 bytes en vez de 24, sin normal
  porque no se ilumina.
- **Sin luz.** Se dibuja con `disable(LIGHTING)` y `setColor`, una linea no tiene normal.
  Despues se vuelve a prender la luz y se deja la matriz normal en identidad para que FF no se
  quede con una vieja.
- Guardo un punto cada 2 pasos. La fisica va a 1/120 s para que sea la misma curva, pero con un
  punto cada 1/60 s la linea ya se ve lisa. El tiro mas largo (3.58 s) usa unos 215 puntos de 400.
- El ultimo punto se interpola en el cruce con `y = 0` para que la linea termine en el suelo y
  no debajo. (Despues lo cambie a `y = PROJECTILE_RADIUS`, ver la revision de B.)
- En WebGL2 la linea es de 1 pixel en la practica (`lineWidth` mayor a 1 no funciona), asi
  que queda finita.

## Recalculo de la camara al terminar la torreta

Al terminar la torreta hubo que **recalcular la distancia de la camara**. El primer calculo
suponia que la torreta llegaba hasta `x = +-4`, pero el cuerpo sobresale 1.45 del centro y la
silueta llega a `x = +-5.45`. Con el encuadre viejo la torreta se salia de cuadro en los
extremos (max|ndc| = 1.310). El angulo quedo igual, solo cambio la distancia: 17.27 -> 21.23,
o sea el ojo paso de `(1.8, 5.1, 8.8)` a `(2.17, 5.91, 12.65)`.

Rehaciendo la busqueda con la silueta bien salio algo que confirma lo que habiamos elegido:
**yaw 6 / pitch 12 da arco 0.320, el maximo de toda la busqueda** (yaw 0..30, pitch 5..28).
Y yaw = 0 sigue dando arco 0.000000.

*Problema:* en el recalculo tomaba el arco como el minimo sobre todas las trayectorias,
incluidas las de 5 grados, que son casi rectas igual y bajaban el minimo a 0.03 sin que tuviera
que ver con la camara. Lo cambie a medir el arco solo con las de 45 grados.

## Revision final de la escena

Con todos los valores finales del codigo:

```
torreta en ambos extremos      max|ndc| = 0.920   cabe
los 3 objetivos (con radio)    max|ndc| = 0.276   cabe
marcas de distancia            max|ndc| = 0.263   cabe
angulo maximo en cuadro:  fuerza 1 -> 90    fuerza 2 -> 69    fuerza 3 -> 52
cada fuerza acierta:      fuerza 1 -> obj 1    fuerza 2 -> obj 1, 2    fuerza 3 -> obj 1, 2, 3
los 3 objetivos son alcanzables
vista previa: peor caso 3.58 s -> ~215 puntos de 400
suelo: esquina mas lejana a 789 (far 1200), semiancho necesario 436 vs 450
0 fallos
```

Lo de que **cada fuerza le pegue al menos a un objetivo** ya se cumple con los valores
provisionales, asi que probablemente no haya que tocar `INITIAL_TARGETS` ni `POWER_SPEEDS`.

## Correcciones despues de la revision de B

B reviso el render y encontro tres cosas. Las tres tenian razon y ninguna rompia nada.

### 1. La linea de la vista previa era 0.15 mas larga que el vuelo

`preview.ts` cortaba en `y <= 0` y `physics.ts` termina el vuelo en `y <= PROJECTILE_RADIUS`.
La linea es el centro de la bala, y el centro se para cuando el borde de abajo toca el suelo,
no cuando el centro llega a 0. Con el corte viejo la prediccion no coincidia con donde caia.

Lo cambie como sugirio B: el corte y la interpolacion usan `PROJECTILE_RADIUS`. Lo probe
corriendo el `preview.ts` real con un `gl` y un `ff` falsos que guardan lo que se sube al VBO,
y comparando el ultimo punto con un vuelo de referencia en 15 combinaciones de fuerza y angulo:
**error 0.00e+0** en todas. De paso confirme que `drawPreview` deja la luz prendida al salir y
que no dibuja nada mientras la bala vuela.

### 2. La F no salia en la ayuda de index.html

En el README si estaba, en la pagina no. Ya esta.

### 3. Limitador de FPS para las pruebas del checkpoint 2

Esta en `main.ts` con `?fps=30` en la URL. Se salta frames de `requestAnimationFrame` hasta
juntar el tiempo pedido, sin tocar `last` al saltar para no perder tiempo. El
`requestAnimationFrame` va al final de la funcion y el salto es un `if` y no un `return`: asi,
si algo tira una excepcion, el loop se para en vez de repetir el mismo error cada frame.

**Bug que aparecio al probarlo.** La primera version comparaba `elapsed >= minFrameSeconds`
directo y daba **20.3 FPS en vez de 30** en 60 Hz. Pedir 30 en 60 Hz es dejar pasar un frame
de cada dos, y dos frames de 60 Hz suman justo 1/30; por el redondeo la comparacion fallaba y
saltaba hasta el tercero. Con `?fps=72` en 144 Hz pasaba lo mismo (daba 52.5). Lo arregle con
1 ms de margen (`FRAME_SKIP_TOLERANCE`).

Despues del arreglo, simulando 10 s:

```
pantalla  ?fps=   FPS efectivos
  60 Hz     -        60.00
  60 Hz    30        29.90     <- antes daba 20.30
  60 Hz    20        19.90
  60 Hz    45        29.90     <- redondea a un divisor de 60
 144 Hz     -       144.00
 144 Hz    30        28.70
 144 Hz    60        47.90     <- divisor de 144
 144 Hz    72        71.90     <- antes daba 52.50
  30 Hz    60        29.90     <- solo baja, no sube
```

En todos los casos la suma de los `dt` usados mas lo que falta por consumir da el tiempo real,
o sea el limitador no pierde ni inventa tiempo.

*Para la integracion:* que la parabola sea igual con distintos FPS depende del acumulador de
`game/physics.ts`, que es de B. El limitador solo sirve para mostrarlo; la prueba es del
checkpoint 2.

## Extra: la bala te cae encima con un tiro vertical

Easter egg que se nos ocurrio en el equipo, en `src/render/explosion.ts`. Si subes el canon
del todo y disparas, la bala vuelve a caer, explota (un destello y 28 chispas) y **se lleva el
tanque**: la torreta, las barras, la bala y la linea dejan de dibujarse y hay que apretar
**R** para seguir.

### Como se detecta sin tocar `src/game/`

El modulo no cambia el estado, solo lo mira. Con `state.projectile` alcanza:

- `flying` pasa de `false` a `true`: se acaba de disparar, se guarda `state.pitchDeg`.
- **mientras vuela**: si la bala viene bajando (`vel[1] < 0`) y entra en la silueta del
  tanque, explota ahi. Lo de que venga bajando es para que no explote apenas sale, cuando
  todavia va subiendo por el mismo lugar.

Si la bala no cae sobre el tanque, cae normal y no pasa nada.

### Problema: funcionaba pero no se veia

La primera version esperaba a que la bala tocara el suelo. Probe que la explosion se
activaba, pero no que se viera, y no se veia.

Con el canon a 90 la direccion es `(0, 1, 0)`: la bala sube recta, x y z no cambian, y cae por
donde salio. Sale de `(turretX, 2.9, 0)` y cae en `(turretX, 0.064, 0)`, justo **debajo del
chasis** (que va de y = 0.3 a 0.8), entre las ruedas. Trazando la recta del ojo a cada chispa
contra la caja del chasis:

```
el centro de la explosion lo tapa el chasis: SI
chispas visibles: 0 de 28 en los primeros 0.3 s, en promedio 2 de 28 (7%)
el destello asoma solo el 7% de su altura, y dura 0.22 s
```

Me paso lo mismo que con la separacion de los objetivos: probar que algo pasa no es lo mismo
que probar que se ve. Lo arregle haciendo que la bala explote al chocar con el tanque cuando
cae, que tiene mas sentido. Ahora la explosion sale entre y = 1.1 y 1.35, encima del chasis.

### Cuando explota

El angulo minimo depende de la fuerza, porque con mas rapidez la bala se mueve mas en Z y se
pasa del tanque:

```
ang   fuerza 1          fuerza 2          fuerza 3
 84   no explota        no explota        no explota
 85   y=1.29 z=-1.42    no explota        no explota
 87   y=1.33 z=-0.85    no explota        no explota
 88   y=1.34 z=-0.57    y=1.30 z=-1.14    no explota
 89   y=1.35 z=-0.28    y=1.31 z=-0.57    y=1.08 z=-0.97
 90   y=1.19 z= 0.00    y=1.32 z= 0.00    y=1.09 z= 0.00
```

Con el canon al tope (90) explota con cualquier fuerza, que es como lo va a encontrar el jugador.

### Como se "destruye" el tanque sin tocar el estado

El tanque no se borra, solo se deja de dibujar. `explosion.ts` tiene `isTurretDestroyed()` y
el render se salta `drawTurret`, `drawPower`, `drawProjectile` y `drawPreview` mientras sea
true. El estado queda igual: la torreta sigue en su lugar y la fisica y el teclado siguen
andando, solo que no se ve. Es la misma separacion de siempre: render decide que se ve, no que
existe.

**Como sabemos que se apreto R.** Habia que saber cuando empieza una partida nueva, asi que
agregue `state.resetCount`, un contador que solo sube con `resetState()`. Use un contador y no
un booleano porque asi solo hay que compararlo con el ultimo valor visto y nadie tiene que
acordarse de volverlo a false. Es un campo nuevo en `state.ts`, pero no cambia nada de lo que
ya habia, asi que B no tiene que tocar nada.

### Decisiones

- **Sin luz**, con `disable(LIGHTING)` y `setColor`, igual que la vista previa. El fuego tiene
  luz propia; con iluminacion la mitad de cada chispa quedaba en sombra y parecian piedras.
- **Usa la misma esfera** de los objetivos y la bala. Nada de geometria nueva: 29 esferas en
  el frame con mas cosas.
- **Direcciones con el metodo de Fibonacci** en la media esfera de arriba. Reparte los 28
  puntos parejo, sin amontonarse en el polo como pasa sorteando angulos, y solo arriba porque
  explota contra el suelo.
- **Sin `Math.random`.** Las rapideces salen de la parte decimal de `i` por la razon aurea, que
  reparte bien los valores en [0, 1). Asi la explosion sale igual siempre, mejor para el video.
- **Las chispas usan el mismo Euler semi-implicito y la misma gravedad** que la bala, y rebotan
  perdiendo velocidad. Su suelo esta en su radio y no en `y = 0`, porque igual que con la bala
  lo que se mueve es el centro.
- **Dos partes, como el resto del loop.** `updateExplosion(dt)` va en el update y no usa WebGL;
  `drawExplosion(...)` va en el render y no cambia nada. El estado del efecto esta en el modulo
  y no en `state.ts` porque es solo visual.

### Como lo probe

Con la fisica y la colision reales de B:

```
angulos 5, 30, 60, 80, 84 -> NO explota con ninguna fuerza
la explosion sale entre y = 1.08 y y = 1.35: el chasis nunca la tapa
tiro a 90 que le pega a un objetivo -> NO explota (la bala queda en y = 2.4)
una sola explosion por tiro
duracion medida desde que explota: 1.50 s
la luz queda prendida despues de cada drawExplosion
el estado del juego queda igual despues de 120 frames de updateExplosion
esferas dibujadas: 29 con destello, 28 despues, 0 cuando termina

tanque destruido y tecla R:
  el tanque desaparece al volarse y sigue sin aparecer cuando terminan las chispas
  mover, apuntar y disparar NO lo traen de vuelta, solo resetState()
  R en plena explosion la corta y limpia todo
  3 veces seguidas volar + R: siempre funciona
  un tiro normal (30 grados) no destruye nada
  resetCount solo sube, y solo con resetState
0 fallos
```

*Problema:* la prueba del tiro que le pega a un objetivo fallaba al principio, pero el error
estaba en la prueba: la explosion del caso anterior seguia activa (dura 1.1 s y la prueba solo
avanzaba 3 frames), entonces `isExploding()` daba true por lo que quedaba. Lo arregle apagando
cualquier explosion pendiente antes de cada medicion.
