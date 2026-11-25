// Camaras (Gabriel). Se cambia con la C: state.cameraMode.
//   0 tercera persona: detras del tanque, mirando hacia donde mira la base
//   1 cenital: desde arriba, el norte (-Z) queda arriba de la pantalla
//   2 primera persona: desde la punta del canon, mirando por donde saldria la bala
// applyCamera se llama al principio de cada frame de render: pone la vista y la
// proyeccion de la escena 3D. (La interfaz de Angel cambia la proyeccion a
// ortografica despues de dibujar la escena, y el frame siguiente se vuelve a poner.)
import { mat4, vec3 } from 'gl-matrix';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '../constants';
import { state } from '../state';
import type { FixedFunction } from '../vendor/ff/ff';
import { muzzleTransform } from './turret';

const FOVY = Math.PI / 4;
const NEAR = 0.5;
const FAR = 1200;

// tercera persona
const FOLLOW_DISTANCE = 9; // detras del tanque
const FOLLOW_HEIGHT = 5; // arriba del suelo
const FOLLOW_LOOK_AHEAD = 4; // mira un poco delante del tanque

// cenital
const TOP_HEIGHT = 35;

const view = mat4.create();
const projection = mat4.create();
const eye = vec3.create();
const target = vec3.create();
const up = vec3.fromValues(0, 1, 0);
const muzzle = { pos: vec3.create(), dir: vec3.create(), up: vec3.create() };

// donde esta el ojo de la camara actual (el skybox lo usa para seguirla)
export function cameraEye(): vec3 {
  return eye;
}

export function applyCamera(ff: FixedFunction): void {
  const { x, z, yawDeg } = state.tank;

  if (state.cameraMode === 0) {
    // la direccion hacia donde mira la base: (-sin yaw, 0, -cos yaw)
    const yaw = (yawDeg * Math.PI) / 180;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    vec3.set(eye, x - fx * FOLLOW_DISTANCE, FOLLOW_HEIGHT, z - fz * FOLLOW_DISTANCE);
    vec3.set(target, x + fx * FOLLOW_LOOK_AHEAD, 1, z + fz * FOLLOW_LOOK_AHEAD);
    vec3.set(up, 0, 1, 0);
  } else if (state.cameraMode === 1) {
    vec3.set(eye, x, TOP_HEIGHT, z);
    vec3.set(target, x, 0, z);
    // mirando hacia abajo, "arriba" de la pantalla es -Z (no puede ser +Y, es paralelo a la vista)
    vec3.set(up, 0, 0, -1);
  } else {
    muzzleTransform(muzzle);
    vec3.copy(eye, muzzle.pos);
    vec3.add(target, muzzle.pos, muzzle.dir);
    vec3.copy(up, muzzle.up); // el up sale del canon, asi con 90 grados no se degenera
  }

  mat4.lookAt(view, eye, target, up);
  ff.setViewMatrix(view);
  // aspect del buffer (4:3), no del tamano del canvas en pantalla
  mat4.perspective(projection, FOVY, CANVAS_WIDTH / CANVAS_HEIGHT, NEAR, FAR);
  ff.setProjectionMatrix(projection);
}
