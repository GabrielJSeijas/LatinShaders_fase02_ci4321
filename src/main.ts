// Fase 2: tanque con movimiento, camaras, texturas y skybox (con FixedFunction 1.2)
// Aqui solo esta el arranque de WebGL y el game loop. Camara, luz y suelo estan
// en render/scene.ts, las mallas en geometry/ y cada cosa que se dibuja en render/.
//
// Cada frame hace:
//   1. processInput(dt)  teclado -> estado
//   2. update(dt)        fisica y colisiones
//   3. render(...)       dibujar
// render no cambia el estado y update no llama a WebGL.
import './style.css';
import { createFixedFunction } from './vendor/ff/ff';
import { CANVAS_HEIGHT, CANVAS_WIDTH, CLEAR_COLOR } from './constants';
import type { Mesh } from './geometry/mesh';
import { createSphereMesh } from './geometry/sphere';
import { createBoxMesh } from './geometry/box';
import { createCylinderMesh } from './geometry/cylinder';
import { drawScene, setupScene } from './render/scene';
import { createTank, drawTurret, updateTank } from './render/turret';
import { drawProjectile, drawTargets } from './render/targets';
import { applyCamera } from './render/camera';
import { drawSkybox } from './render/skybox';
import { drawObstacles } from './render/obstacles';
import { loadTexture } from './render/texture';
import skyUrl from './textures/sky.png';
import woodUrl from './textures/Wood_07-512x512.png';
import camoUrl from './textures/camo.png';
import { TEXTURE_2D } from './vendor/ff/ff';
import { createPreview, drawPreview } from './render/preview';
import { drawExplosion, isTurretDestroyed, updateExplosion } from './render/explosion';
import type { Preview } from './render/preview';
import { resetState } from './state';
import { processInput, setupInput } from './game/input';
import { updatePhysics } from './game/physics';
import { checkCollisions } from './game/collision';

type FF = ReturnType<typeof createFixedFunction>;

// tope del dt. Si la pestana estuvo oculta rAF se pausa y al volver el dt
// salia gigante (la bala pegaba un salto)
const MAX_DT = 0.1;

// Limitador de FPS para probar que la fisica no depende de los FPS:
//   http://localhost:5173/?fps=30
// No cambia nada del juego. Lo que hace es saltarse frames de rAF, asi que solo
// puede bajar los FPS (para 144 hace falta un monitor de 144 Hz) y redondea a un
// divisor de los Hz de la pantalla (en 60 Hz pedir 45 da 30).
// Por debajo de 10 FPS el MAX_DT hace que todo vaya mas lento que el tiempo real.
// Devuelve 0 si no hay ?fps=
function readFpsLimit(): number {
  const raw = new URLSearchParams(window.location.search).get('fps');
  if (raw === null) return 0;
  const fps = Number(raw);
  return Number.isFinite(fps) && fps > 0 ? fps : 0;
}

// 1 ms de margen. Sin esto ?fps=30 en 60 Hz daba 20: dos frames de 60 Hz suman
// justo 1/30 y por redondeo la comparacion fallaba y saltaba hasta el tercero.
const FRAME_SKIP_TOLERANCE = 0.001;

// Las mallas son unitarias y se crean una vez. El tamano y la posicion salen de
// la matriz de modelo, asi que con tres alcanza para toda la escena.
type Meshes = { sphere: Mesh; box: Mesh; cylinder: Mesh };
// texturas: se cargan una vez al arrancar. Angel puede agregar las suyas aqui
// (fuente, billboards) con loadTexture.
type Textures = { sky: WebGLTexture; wood: WebGLTexture; camo: WebGLTexture };

// --- 1. contexto WebGL2
function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('WebGL2 no esta disponible.');
  return gl;
}

// --- 2 a 4. shaders, buffers y layout
// los shaders los maneja FF; buffers y VAO se arman en geometry/mesh.ts

// --- 5. estado del pipeline
function setupState(gl: WebGL2RenderingContext, canvas: HTMLCanvasElement): void {
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE); // las caras de frente son las antihorarias
  // FF entrega el alfa (textura * material) pero la mezcla es estado del pipeline.
  // Con alfa 1 (todo lo opaco) no cambia nada; hace falta para billboards e interfaz.
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

// fase 2: simulacion, sin WebGL
function update(dt: number): void {
  updateTank(); // matrices del arbol del tanque con el state de este frame
  updatePhysics(dt);
  checkCollisions();
  // easter egg: mira como termino el vuelo y si toca hace explotar la bala.
  // Solo lee el estado.
  updateExplosion(dt);
}

// fase 3: dibujar. Cada modulo de render/ tiene sus matrices temporales, asi que
// un frame no crea matrices nuevas
function render(gl: WebGL2RenderingContext, ff: FF, meshes: Meshes, textures: Textures, preview: Preview): void {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // camara de la escena 3D: vista y proyeccion. Se pone en cada frame porque la
  // interfaz 2D (orto) cambia la proyeccion despues de dibujar la escena.
  applyCamera(ff);
  drawSkybox(gl, ff, meshes.sphere, textures.sky); // primero: todo se dibuja encima


  // easter egg: si el tanque se volo a si mismo no se dibuja nada del jugador
  // hasta la R. El estado sigue igual, solo no se dibuja.
  const destruido = isTurretDestroyed();

  drawScene(gl, ff, meshes.box); // suelo y marcas
  drawObstacles(gl, ff, meshes.box, textures.wood);
  if (!destruido) {
    drawTurret(gl, ff); // el tanque completo (incluye las barras de fuerza)
  }
  drawTargets(gl, ff, meshes.sphere);
  if (!destruido) {
    drawProjectile(gl, ff, meshes.sphere);
  }

  ff.disable(TEXTURE_2D); // lo que sigue no lleva textura
  // estos dos van sin luz y la vuelven a prender al terminar, por eso al final
  drawExplosion(gl, ff, meshes.sphere); // casi siempre no dibuja nada
  if (!destruido) {
    drawPreview(gl, ff, preview);
  }
}

async function run(canvas: HTMLCanvasElement): Promise<void> {
  const gl = getContext(canvas);
  const ff = createFixedFunction(gl, { debug: true });
  setupState(gl, canvas);
  setupScene(ff); // camara fija y luz, una sola vez

  const meshes: Meshes = {
    sphere: createSphereMesh(gl),
    box: createBoxMesh(gl),
    cylinder: createCylinderMesh(gl),
  };
  const preview = createPreview(gl);

  // el juego empieza cuando todas las texturas estan listas
  const textures: Textures = {
    sky: await loadTexture(gl, skyUrl),
    wood: await loadTexture(gl, woodUrl, { repeat: true }),
    camo: await loadTexture(gl, camoUrl),
  };
  createTank(meshes, textures.camo);

  setupInput();
  resetState();

  // sin ?fps= esto queda en 0 y no se salta ningun frame
  const fpsLimit = readFpsLimit();
  const minFrameSeconds = fpsLimit > 0 ? 1 / fpsLimit : 0;
  if (fpsLimit > 0) {
    console.info(`[fase2] limitador de FPS activo: objetivo ${fpsLimit} FPS.`);
  }

  let last: number | null = null; // en el primer frame dt = 0
  function frame(now: number): void {
    if (last === null) last = now;
    const elapsed = (now - last) / 1000;

    // con limitador se saltan frames; last no se toca para no perder tiempo
    if (elapsed >= minFrameSeconds - FRAME_SKIP_TOLERANCE) {
      const dt = Math.min(elapsed, MAX_DT);
      last = now;

      processInput(dt);
      update(dt);
      render(gl, ff, meshes, textures, preview);
    }

    // va al final: si algo revienta el loop se para en vez de llenar la consola
    // con el mismo error cada frame
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas).catch(console.error);
