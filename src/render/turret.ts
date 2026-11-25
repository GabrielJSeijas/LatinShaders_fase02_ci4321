// Torreta (Persona A)
// Es una jerarquia padre -> hijo. Cada pieza usa la caja o el cilindro unitario
// y su matriz es la del padre por la suya:
//
//   base   = T(turretX, 0, 0)
//   |- ruedas = base . T(+-x, r, +-z) . Rz(90) . S(...)
//   |- chasis = base . T(0, y, 0) . S(ancho, alto, fondo)
//   |- barras = base . ...   (en power.ts)
//   \- pivote = base . T(0, PIVOT_HEIGHT, 0) . Rx(pitch)
//      |- cabeza = pivote . S(...)
//      |- tubo   = pivote . Rx(-90) . T(0, L/2, 0) . S(r, L, r)
//      \- punta  = pivote . T(0, 0, -(L - ml/2)) . Rx(-90) . S(...)
//
// El pivote cuelga de base y no del chasis. El chasis tiene escala 2.4 x 0.5 x 3.0
// y si el canon fuera hijo suyo heredaria esa escala: saldria aplastado y al rotar
// se deformaria distinto en cada angulo. Por eso la escala va solo en las hojas,
// y base y pivote solo llevan traslacion y rotacion.
//
// muzzleTransform mantiene la misma firma que la version provisional, B no tiene
// que cambiar nada.
import { mat3, mat4, vec3 } from 'gl-matrix';
import { COLOR_TURRET } from '../constants';
import { drawMesh } from '../geometry/mesh';
import type { Mesh } from '../geometry/mesh';
import { state } from '../state';
import type { FixedFunction } from '../vendor/ff/ff';

const DEG_TO_RAD = Math.PI / 180;
const QUARTER_TURN = Math.PI / 2; // para pasar el eje +Y del cilindro a otro eje

// --- medidas (unidades de mundo)
// la idea es que parezca un vehiculo: ruedas en el suelo, chasis encima y una
// cabeza mas chica con un canon largo

const CHASSIS_WIDTH = 2.4;
const CHASSIS_HEIGHT = 0.5;
const CHASSIS_DEPTH = 3.0;
const CHASSIS_Y = 0.55; // la base del chasis queda sobre el eje de las ruedas

const WHEEL_RADIUS = 0.3; // con esto tocan el suelo
const WHEEL_WIDTH = 0.18;
const WHEEL_X = 1.15;
const WHEEL_Z = 1.0;

// altura del eje del canon, justo encima del chasis
export const PIVOT_HEIGHT = 1.0;

const HEAD_WIDTH = 1.3;
const HEAD_HEIGHT = 0.65;
const HEAD_DEPTH = 1.5;

// largo del tubo desde el pivote hasta la boca
export const BARREL_LENGTH = 1.9;
const BARREL_RADIUS = 0.1;

// la boca es un anillo un poco mas gordo al final del tubo
const MUZZLE_LENGTH = 0.24;
const MUZZLE_RADIUS = 0.15;

export type TurretMeshes = { box: Mesh; cylinder: Mesh };

// temporales, dibujar la torreta no crea matrices nuevas
const mBase = mat4.create();
const mPivot = mat4.create();
const mNode = mat4.create();
const mRotation = mat3.create();
const v3 = vec3.create();

// raiz: solo mueve en X
export function baseTransform(out: mat4): void {
  vec3.set(v3, state.turretX, 0, 0);
  mat4.fromTranslation(out, v3);
}

// Pivote: base, subida a la altura del eje y rotada por el pitch.
// En el pivote el canon apunta a -Z, y Rx(pitch) lo lleva a
// (0, sin(pitch), -cos(pitch)): 90 grados es vertical y 5 casi horizontal.
function pivotTransform(out: mat4): void {
  baseTransform(out);
  vec3.set(v3, 0, PIVOT_HEIGHT, 0);
  mat4.translate(out, out, v3);
  mat4.rotateX(out, out, state.pitchDeg * DEG_TO_RAD);
}

// hijo = padre . T . S, y lo dibuja
function drawChildTS(
  gl: WebGL2RenderingContext,
  ff: FixedFunction,
  mesh: Mesh,
  parent: mat4,
  tx: number,
  ty: number,
  tz: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  mat4.copy(mNode, parent);
  vec3.set(v3, tx, ty, tz);
  mat4.translate(mNode, mNode, v3);
  vec3.set(v3, sx, sy, sz);
  mat4.scale(mNode, mNode, v3);
  drawMesh(gl, ff, mesh, mNode, COLOR_TURRET);
}

export function drawTurret(gl: WebGL2RenderingContext, ff: FixedFunction, meshes: TurretMeshes): void {
  baseTransform(mBase);

  // --- hijos de base (no giran con el canon)

  // chasis, la escala se queda aqui
  drawChildTS(gl, ff, meshes.box, mBase, 0, CHASSIS_Y, 0, CHASSIS_WIDTH, CHASSIS_HEIGHT, CHASSIS_DEPTH);

  // 4 ruedas. Rz(90) acuesta el cilindro para que el eje quede en X
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      mat4.copy(mNode, mBase);
      vec3.set(v3, sx * WHEEL_X, WHEEL_RADIUS, sz * WHEEL_Z);
      mat4.translate(mNode, mNode, v3);
      mat4.rotateZ(mNode, mNode, QUARTER_TURN);
      vec3.set(v3, WHEEL_RADIUS, WHEEL_WIDTH, WHEEL_RADIUS);
      mat4.scale(mNode, mNode, v3);
      drawMesh(gl, ff, meshes.cylinder, mNode, COLOR_TURRET);
    }
  }

  // --- hijos del pivote (giran con el pitch)
  pivotTransform(mPivot);

  // cabeza centrada en el pivote, gira sobre su centro
  drawChildTS(gl, ff, meshes.box, mPivot, 0, 0, 0, HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH);

  // tubo: Rx(-90) pasa el eje del cilindro de +Y a -Z y despues lo corremos media
  // longitud para que empiece en el pivote (si no quedaria centrado en el)
  mat4.copy(mNode, mPivot);
  mat4.rotateX(mNode, mNode, -QUARTER_TURN);
  vec3.set(v3, 0, BARREL_LENGTH / 2, 0);
  mat4.translate(mNode, mNode, v3);
  vec3.set(v3, BARREL_RADIUS, BARREL_LENGTH, BARREL_RADIUS);
  mat4.scale(mNode, mNode, v3);
  drawMesh(gl, ff, meshes.cylinder, mNode, COLOR_TURRET);

  // punta: la movemos sobre -Z del pivote para que termine justo en -BARREL_LENGTH
  mat4.copy(mNode, mPivot);
  vec3.set(v3, 0, 0, -(BARREL_LENGTH - MUZZLE_LENGTH / 2));
  mat4.translate(mNode, mNode, v3);
  mat4.rotateX(mNode, mNode, -QUARTER_TURN);
  vec3.set(v3, MUZZLE_RADIUS, MUZZLE_LENGTH, MUZZLE_RADIUS);
  mat4.scale(mNode, mNode, v3);
  drawMesh(gl, ff, meshes.cylinder, mNode, COLOR_TURRET);
}

// Donde esta la boca del canon y hacia donde apunta.
// Sale de la misma matriz del pivote que usa drawTurret, asi que la bala sale
// justo de la punta que se dibuja.
//   pos: el punto (0, 0, -BARREL_LENGTH) del pivote pasado a mundo. Es un punto
//        (w = 1), le afecta la traslacion.
//   dir: el vector (0, 0, -1). Es una direccion (w = 0), solo le afecta la
//        rotacion, por eso usamos la 3x3. Con la 4x4 se le sumaria la posicion de
//        la torreta y apuntaria a cualquier lado.
// Los vec3 de out los pone quien llama.
export function muzzleTransform(out: { pos: vec3; dir: vec3 }): void {
  pivotTransform(mPivot);

  vec3.set(v3, 0, 0, -BARREL_LENGTH);
  vec3.transformMat4(out.pos, v3, mPivot);

  // la 3x3 del pivote es solo rotacion, ya deberia salir unitario, pero
  // normalizamos por si acaso
  mat3.fromMat4(mRotation, mPivot);
  vec3.set(v3, 0, 0, -1);
  vec3.transformMat3(out.dir, v3, mRotation);
  vec3.normalize(out.dir, out.dir);
}
