// Tanque armado como arbol de escena (Gabriel)
//
//   tank (T(x, 0, z) . Ry(yaw base))                    <- raiz
//   |- chasis, 4 ruedas, 3 barras de fuerza             (hojas, giran con la base)
//   \- turret (Ry(yaw torreta))                          <- gira respecto a la base
//      \- pivot (T(0, PIVOT_HEIGHT, 0) . Rx(pitch))     <- eje del canon, sube y baja
//         |- cabeza, tubo, punta                        (hojas)
//
// Orden de las transformaciones: pivot.world = tank . turret . pivot. Primero se
// mueve y gira la base, luego la torreta gira sobre la base y al final el canon
// sube y baja sobre la torreta. Por eso la bala sale de la punta aunque el tanque
// este movido y girado: la punta se saca de pivot.world.
//
// La escala va solo en las hojas (size), base, turret y pivot solo mueven y rotan.
// muzzleTransform mantiene la misma firma que en la fase 1.
import { mat3, mat4, vec3 } from 'gl-matrix';
import { COLOR_POWER_OFF, COLOR_POWER_ON, COLOR_TURRET, TANK_COLORS } from '../constants';
import type { Mesh } from '../geometry/mesh';
import { SceneNode, drawNode, updateWorld } from '../scene/node';
import { state } from '../state';
import type { FixedFunction } from '../vendor/ff/ff';

const DEG_TO_RAD = Math.PI / 180;
const QUARTER_TURN = Math.PI / 2; // para pasar el eje +Y del cilindro a otro eje

// --- medidas (unidades de mundo)
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

// barras de fuerza pegadas a la cara +Z del chasis (la de atras del tanque)
const BAR_COUNT = 3;
const BAR_WIDTH = 0.55;
const BAR_HEIGHT = 0.1;
const BAR_DEPTH = 0.06;
const BAR_BASE_Y = 0.4;
const BAR_SPACING = 0.15;
const BAR_Z = 1.5 + BAR_DEPTH / 2;

export type TankMeshes = { box: Mesh; cylinder: Mesh };

// nodos del tanque, se arman una vez en createTank
const tank = new SceneNode();
const turret = new SceneNode();
const pivot = new SceneNode();
const bars: SceneNode[] = [];
const bodyParts: SceneNode[] = []; // las piezas con camo, cambian de color con la V

function leaf(parent: SceneNode, mesh: Mesh, x: number, y: number, z: number, sx: number, sy: number, sz: number): SceneNode {
  const node = new SceneNode();
  node.mesh = mesh;
  node.setLocal(x, y, z);
  vec3.set(node.size, sx, sy, sz);
  node.color = COLOR_TURRET;
  parent.add(node);
  return node;
}

// Arma el arbol. camo es la textura neutra que se tine con la tecla V.
export function createTank(meshes: TankMeshes, camo: WebGLTexture): void {
  tank.add(turret);
  turret.add(pivot);

  // --- hijos de tank
  const chassis = leaf(tank, meshes.box, 0, CHASSIS_Y, 0, CHASSIS_WIDTH, CHASSIS_HEIGHT, CHASSIS_DEPTH);
  bodyParts.push(chassis);

  // 4 ruedas. Rz(90) acuesta el cilindro para que el eje quede en X
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wheel = leaf(tank, meshes.cylinder, sx * WHEEL_X, WHEEL_RADIUS, sz * WHEEL_Z, WHEEL_RADIUS, WHEEL_WIDTH, WHEEL_RADIUS);
      mat4.rotateZ(wheel.local, wheel.local, QUARTER_TURN);
    }
  }

  for (let i = 0; i < BAR_COUNT; i++) {
    bars.push(leaf(tank, meshes.box, 0, BAR_BASE_Y + i * BAR_SPACING, BAR_Z, BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH));
  }

  // --- hijos del pivote (giran con el pitch)
  // cabeza centrada en el pivote, gira sobre su centro
  bodyParts.push(leaf(pivot, meshes.box, 0, 0, 0, HEAD_WIDTH, HEAD_HEIGHT, HEAD_DEPTH));

  // tubo: Rx(-90) pasa el eje del cilindro de +Y a -Z y despues lo corremos media
  // longitud para que empiece en el pivote (si no quedaria centrado en el)
  const tube = leaf(pivot, meshes.cylinder, 0, 0, -BARREL_LENGTH / 2, BARREL_RADIUS, BARREL_LENGTH, BARREL_RADIUS);
  mat4.rotateX(tube.local, tube.local, -QUARTER_TURN);

  // punta: sobre -Z del pivote para que termine justo en -BARREL_LENGTH
  const tip = leaf(pivot, meshes.cylinder, 0, 0, -(BARREL_LENGTH - MUZZLE_LENGTH / 2), MUZZLE_RADIUS, MUZZLE_LENGTH, MUZZLE_RADIUS);
  mat4.rotateX(tip.local, tip.local, -QUARTER_TURN);

  for (const part of bodyParts) part.texture = camo;
}

// Pasa el state a las matrices locales y recalcula todo el arbol.
// Se llama en el update y dentro de muzzleTransform, asi nunca queda viejo.
export function updateTank(): void {
  tank.setLocal(state.tank.x, 0, state.tank.z, state.tank.yawDeg * DEG_TO_RAD);
  turret.setLocal(0, 0, 0, state.tank.turretYawDeg * DEG_TO_RAD);
  // Rx(pitch): el canon apunta a -Z y Rx lo lleva a (0, sin(pitch), -cos(pitch)),
  // o sea 90 grados es vertical y 5 casi horizontal
  pivot.setLocal(0, PIVOT_HEIGHT, 0, 0, state.pitchDeg * DEG_TO_RAD);

  const color = TANK_COLORS[state.colorIndex];
  for (const part of bodyParts) part.color = color;
  for (let i = 0; i < BAR_COUNT; i++) bars[i].color = i < state.power ? COLOR_POWER_ON : COLOR_POWER_OFF;

  updateWorld(tank);
}

export function drawTurret(gl: WebGL2RenderingContext, ff: FixedFunction): void {
  drawNode(gl, ff, tank);
}

const mRotation = mat3.create();
const v3 = vec3.create();

// Donde esta la boca del canon y hacia donde apunta (en mundo).
//   pos: el punto (0, 0, -BARREL_LENGTH) del pivote pasado a mundo. Es un punto
//        (w = 1), le afecta la traslacion.
//   dir: el vector (0, 0, -1). Es una direccion (w = 0), solo le afecta la
//        rotacion, por eso usamos la 3x3. Con la 4x4 se le sumaria la posicion del
//        tanque y apuntaria a cualquier lado.
//   up (opcional): hacia donde es "arriba" visto desde el canon (perpendicular a
//        dir siempre). Lo usa la camara de primera persona.
// Los vec3 de out los pone quien llama.
export function muzzleTransform(out: { pos: vec3; dir: vec3; up?: vec3 }): void {
  updateTank();

  vec3.set(v3, 0, 0, -BARREL_LENGTH);
  vec3.transformMat4(out.pos, v3, pivot.world);

  // la 3x3 del pivote es solo rotacion (la escala no esta en los nodos)
  mat3.fromMat4(mRotation, pivot.world);
  vec3.set(v3, 0, 0, -1);
  vec3.transformMat3(out.dir, v3, mRotation);
  vec3.normalize(out.dir, out.dir);

  if (out.up) {
    vec3.set(v3, 0, 1, 0);
    vec3.transformMat3(out.up, v3, mRotation);
    vec3.normalize(out.up, out.up);
  }
}
