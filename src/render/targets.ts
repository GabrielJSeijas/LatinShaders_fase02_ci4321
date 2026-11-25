// Objetivos y bala (Persona A)
// Usan la misma esfera unitaria, solo cambia la matriz (posicion y radio) y el color.
import { mat4, vec3 } from 'gl-matrix';
import { COLOR_PROJECTILE, COLOR_TARGET } from '../constants';
import { drawMesh } from '../geometry/mesh';
import type { Mesh } from '../geometry/mesh';
import { PROJECTILE_RADIUS, state } from '../state';
import type { FixedFunction } from '../vendor/ff/ff';
import { muzzleTransform } from './turret';

const model = mat4.create();
const v3 = vec3.create();
const muzzle = { pos: vec3.create(), dir: vec3.create() };

// model = T(centro) . S(radio)
function placeSphere(center: vec3 | readonly [number, number, number], radius: number): void {
  vec3.set(v3, center[0], center[1], center[2]);
  mat4.fromTranslation(model, v3);
  vec3.set(v3, radius, radius, radius);
  mat4.scale(model, model, v3);
}

// Solo los que siguen vivos. El alive lo cambia la colision en el update,
// aqui solo se lee.
export function drawTargets(gl: WebGL2RenderingContext, ff: FixedFunction, sphere: Mesh): void {
  for (const target of state.targets) {
    if (!target.alive) continue;
    placeSphere(target.pos, target.radius);
    drawMesh(gl, ff, sphere, model, COLOR_TARGET);
  }
}

// Si esta volando va donde diga la fisica. Si no, la ponemos en la punta del
// canon con muzzleTransform, asi sigue a la torreta cuando se mueve.
export function drawProjectile(gl: WebGL2RenderingContext, ff: FixedFunction, sphere: Mesh): void {
  if (state.projectile.flying) {
    placeSphere(state.projectile.pos, PROJECTILE_RADIUS);
  } else {
    muzzleTransform(muzzle);
    placeSphere(muzzle.pos, PROJECTILE_RADIUS);
  }
  drawMesh(gl, ff, sphere, model, COLOR_PROJECTILE);
}
