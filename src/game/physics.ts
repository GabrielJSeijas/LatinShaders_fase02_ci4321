// Fisica de la bala (Persona B)
// ojo: preview.ts usa stepProjectile y FIXED_DT, si les cambian la firma hay que avisar
import { vec3 } from 'gl-matrix';
import { muzzleTransform } from '../render/turret';
import { PROJECTILE_RADIUS, state } from '../state';
import { hitTest } from './collision';

export const GRAVITY = 9.8;

// rapidez inicial para fuerza 1, 2 y 3 (se usa con power - 1)
// TODO: ajustar junto con los objetivos en el checkpoint 2
export const POWER_SPEEDS: readonly [number, number, number] = [8, 12, 16];

// paso fijo de la simulacion, la bala siempre avanza de a 1/120 s
export const FIXED_DT = 1 / 120;

// Un paso de Euler semi-implicito: primero la velocidad y despues la posicion con
// la velocidad nueva. Es mas estable que el explicito y cuesta lo mismo.
// Cambia pos y vel directamente, no toca el state.
export function stepProjectile(pos: vec3, vel: vec3, dt: number): void {
  vel[1] -= GRAVITY * dt; // la gravedad solo va en -Y
  pos[0] += vel[0] * dt;
  pos[1] += vel[1] * dt;
  pos[2] += vel[2] * dt;
}

// tope de pasos por frame por si un frame tarda muchisimo (con MAX_DT = 0.1 de
// main.ts nunca pasa de 12, pero por si acaso)
const MAX_STEPS_PER_FRAME = 15;

// tiempo que todavia falta por simular
let accumulator = 0;

const muzzle = { pos: vec3.create(), dir: vec3.create() };

// Dispara desde la punta del canon. Devuelve false si ya hay una bala volando.
export function fireProjectile(): boolean {
  const projectile = state.projectile;
  if (projectile.flying) return false;

  muzzleTransform(muzzle);
  vec3.copy(projectile.pos, muzzle.pos);
  // dir ya viene normalizado, asi que la rapidez queda igual a POWER_SPEEDS
  vec3.scale(projectile.vel, muzzle.dir, POWER_SPEEDS[state.power - 1]);
  projectile.flying = true;
  accumulator = 0;
  return true;
}

// El dt del frame no se usa para integrar, solo se va sumando al acumulador y
// la bala avanza de a FIXED_DT. A 30 FPS salen como 4 pasos por frame y a 144
// salen 0 o 1, pero las posiciones son las mismas. Por eso la parabola no cambia
// con los FPS.
// La colision y el suelo los revisamos en cada paso. Si lo hacemos una vez por
// frame, a 30 FPS la bala avanza mucho entre revisiones y puede atravesar un
// objetivo sin pegarle.
export function updatePhysics(dt: number): void {
  const projectile = state.projectile;

  if (!projectile.flying) {
    // sin bala en el aire la dejamos pegada a la punta del canon
    accumulator = 0;
    muzzleTransform(muzzle);
    vec3.copy(projectile.pos, muzzle.pos);
    vec3.zero(projectile.vel);
    return;
  }

  accumulator += dt;
  let steps = 0;
  while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
    stepProjectile(projectile.pos, projectile.vel, FIXED_DT);
    accumulator -= FIXED_DT;
    steps++;

    if (hitTest()) break; // le dio a un objetivo
    // toca el suelo cuando el borde de abajo llega a 0, no el centro
    if (projectile.pos[1] - PROJECTILE_RADIUS <= 0) {
      projectile.flying = false;
      break;
    }
  }
  // si se llego al tope botamos lo que sobro
  if (accumulator >= FIXED_DT) accumulator = 0;
}
