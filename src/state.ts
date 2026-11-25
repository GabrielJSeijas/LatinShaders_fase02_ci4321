// Estado del juego, lo comparten las dos partes.
// B (input/fisica) lo modifica y A (render) solo lo lee para dibujar.
// Aqui no va nada de WebGL.
import { vec3 } from 'gl-matrix';

// el tanque no sale de este cuadrado (el suelo es mas grande)
export const ARENA_HALF = 60;

// Camaras, se cambia con la C. cameraMode es el indice.
export const CAMERA_NAMES = ['Tercera persona', 'Cenital', 'Primera persona'] as const;
export type CameraMode = 0 | 1 | 2; // 0 tercera persona, 1 cenital, 2 primera persona

// Obstaculos: cajas alineadas con los ejes (AABB). x, z es el centro; sx, sy, sz el tamano.
export type Obstacle = { x: number; z: number; sx: number; sy: number; sz: number };
export const OBSTACLES: readonly Obstacle[] = [
  { x: 6, z: -3, sx: 2, sy: 2, sz: 2 },
  { x: -7, z: -9, sx: 3, sy: 2, sz: 3 },
  { x: 9, z: -15, sx: 2, sy: 3, sz: 2 },
  { x: -4, z: 6, sx: 2, sy: 1.5, sz: 2 },
  // pared al fondo hecha de bloques iguales, asi la textura no se estira
  { x: -3, z: -26, sx: 2, sy: 2.5, sz: 1 },
  { x: -1, z: -26, sx: 2, sy: 2.5, sz: 1 },
  { x: 1, z: -26, sx: 2, sy: 2.5, sz: 1 },
  { x: 3, z: -26, sx: 2, sy: 2.5, sz: 1 },
];

// angulo del canon en grados, los dos extremos se pueden alcanzar
export const PITCH_MIN_DEG = 5;
export const PITCH_MAX_DEG = 90;

export const PROJECTILE_RADIUS = 0.15; // se usa para dibujar y para la colision
export const TARGET_RADIUS = 0.8;

export type Target = { pos: vec3; radius: number; alive: boolean };

// x, y, z de los objetivos. La torreta esta en z = 0 y dispara hacia -Z, por eso
// las z son negativas. Cada uno a distinta distancia y altura (lo pide el enunciado).
// TODO checkpoint 2: ajustarlos junto con POWER_SPEEDS
const INITIAL_TARGETS: readonly (readonly [number, number, number])[] = [
  [-2.0, 1.2, -6.0], // cerca y bajo, fuerza 1
  [1.5, 2.4, -12.0], // medio y alto, fuerza 2
  [-0.5, 1.6, -19.0], // lejos, fuerza 3
];

const INITIAL_PITCH_DEG = 30;

// Es un solo objeto y nadie lo reasigna, asi las referencias que se guardan
// (por ej. a projectile.pos) siguen sirviendo despues de reiniciar.
export const state = {
  // Tanque en el plano XZ. yawDeg es el giro de la base (0 = mira a -Z, como en la
  // fase 1) y turretYawDeg el de la torreta RESPECTO a la base. speed va en u/s
  // (positivo = avanza).
  tank: { x: 0, z: 0, yawDeg: 0, turretYawDeg: 0, speed: 0 },
  pitchDeg: INITIAL_PITCH_DEG,
  power: 1 as 1 | 2 | 3, // POWER_SPEEDS[power - 1]
  // una sola bala a la vez; si no esta volando se dibuja en la punta del canon
  projectile: { flying: false, pos: vec3.create(), vel: vec3.create() },
  targets: [] as Target[],
  cameraMode: 0 as CameraMode, // camara activa (para la interfaz de Angel)
  score: 0, // puntaje: sube 1 por cada objetivo destruido (para la interfaz de Angel)
  colorIndex: 0, // color del tanque, indice en TANK_COLORS (tecla V)
  // cuantas veces se reinicio. Lo usa el easter egg para saber que hubo una
  // partida nueva: basta con comparar con el valor anterior.
  resetCount: 0,
};

// Vuelve todo al inicio. Se usa al arrancar y con la R.
export function resetState(): void {
  state.resetCount++;
  state.tank.x = 0;
  state.tank.z = 0;
  state.tank.yawDeg = 0;
  state.tank.turretYawDeg = 0;
  state.tank.speed = 0;
  state.pitchDeg = INITIAL_PITCH_DEG;
  state.power = 1;
  state.cameraMode = 0;
  state.score = 0;
  state.colorIndex = 0;

  state.projectile.flying = false;
  vec3.zero(state.projectile.pos);
  vec3.zero(state.projectile.vel);

  if (state.targets.length !== INITIAL_TARGETS.length) {
    // la primera vez se crean los objetivos
    state.targets = INITIAL_TARGETS.map(([x, y, z]) => ({
      pos: vec3.fromValues(x, y, z),
      radius: TARGET_RADIUS,
      alive: true,
    }));
    return;
  }

  // con la R reusamos los mismos objetos en vez de crear nuevos
  for (let i = 0; i < state.targets.length; i++) {
    const target = state.targets[i];
    const [x, y, z] = INITIAL_TARGETS[i];
    vec3.set(target.pos, x, y, z);
    target.radius = TARGET_RADIUS;
    target.alive = true;
  }
}
