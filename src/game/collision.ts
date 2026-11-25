// Colisiones
//  - bala contra objetivo: esfera contra esfera (de la fase 1)
//  - tanque contra obstaculo: AABB contra AABB (fase 2)
import { vec3 } from 'gl-matrix';
import { OBSTACLES, PROJECTILE_RADIUS, state } from '../state';
import type { Obstacle } from '../state';

// La llama updatePhysics despues de cada paso fijo. Devuelve true si le dio a algo.
// Esfera contra esfera: hay choque si la distancia entre centros es <= a la suma
// de los radios. Comparamos todo al cuadrado para no sacar raiz.
export function hitTest(): boolean {
  const projectile = state.projectile;
  if (!projectile.flying) return false;

  for (const target of state.targets) {
    if (!target.alive) continue;
    const reach = PROJECTILE_RADIUS + target.radius;
    if (vec3.squaredDistance(projectile.pos, target.pos) <= reach * reach) {
      // con el primer objetivo que toca la bala se para, no tumba dos
      target.alive = false;
      projectile.flying = false;
      state.score += 1;
      return true;
    }
  }
  return false;
}

// --- AABB (caja alineada con los ejes) ---
// Una caja AABB se guarda con su centro y su medio tamano. Dos cajas se tocan si
// en CADA eje las distancias entre centros son menores que la suma de los medios
// tamanos (si en un solo eje estan separadas, no se tocan).
export type AABB = { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number };

const push = vec3.create(); // lo reusamos para no crear un vec3 por llamada

// Devuelve [hay choque, vector para sacar a `a` de `b`].
// El vector es lo que hay que SUMARLE a la posicion de `a` para que deje de tocar
// a `b`. Se elige el eje (X o Z) donde el solapamiento es menor: es la salida mas
// corta. Asi, si el tanque choca de lado con una pared, solo se frena ese lado y
// puede seguir deslizandose por la otra direccion.
// Ojo: el vector es el mismo objeto en cada llamada; copialo si lo vas a guardar.
export function aabbCollision(a: AABB, b: AABB): [boolean, vec3] {
  vec3.zero(push);
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  const dz = a.cz - b.cz;
  const overlapX = a.hx + b.hx - Math.abs(dx);
  const overlapY = a.hy + b.hy - Math.abs(dy);
  const overlapZ = a.hz + b.hz - Math.abs(dz);

  // algun eje separado: no hay choque
  if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) return [false, push];

  // empujamos por el eje con menos solapamiento, hacia el lado donde esta `a`
  if (overlapX < overlapZ) push[0] = dx >= 0 ? overlapX : -overlapX;
  else push[2] = dz >= 0 ? overlapZ : -overlapZ;
  return [true, push];
}

// el tanque se trata como una caja cuadrada que no gira (mas simple que una caja
// girada, y alcanza para que no atraviese los obstaculos)
const TANK_HALF_SIZE = 1.5;
const TANK_HEIGHT = 1.4;
const tankBox: AABB = { cx: 0, cy: TANK_HEIGHT / 2, cz: 0, hx: TANK_HALF_SIZE, hy: TANK_HEIGHT / 2, hz: TANK_HALF_SIZE };
const obstacleBox: AABB = { cx: 0, cy: 0, cz: 0, hx: 0, hy: 0, hz: 0 };

export function obstacleToAABB(o: Obstacle, out: AABB): AABB {
  out.cx = o.x;
  out.cy = o.sy / 2; // las cajas estan apoyadas en el suelo
  out.cz = o.z;
  out.hx = o.sx / 2;
  out.hy = o.sy / 2;
  out.hz = o.sz / 2;
  return out;
}

// Revisa el tanque contra todos los obstaculos y lo saca de los que toca.
function collideTank(): void {
  for (const obstacle of OBSTACLES) {
    tankBox.cx = state.tank.x;
    tankBox.cz = state.tank.z;
    const [hit, out] = aabbCollision(tankBox, obstacleToAABB(obstacle, obstacleBox));
    if (hit) {
      state.tank.x += out[0];
      state.tank.z += out[2];
      state.tank.speed = 0; // choco: se frena
    }
  }
}

// main.ts la llama despues de la fisica
export function checkCollisions(): void {
  hitTest();
  collideTank();
}
