// Cajas y paredes texturizadas (Gabriel). Las posiciones estan en state.ts (OBSTACLES)
// y son las mismas que usa la colision AABB del tanque.
import { mat4, vec3 } from 'gl-matrix';
import { COLOR_WHITE } from '../constants';
import { drawMesh } from '../geometry/mesh';
import type { Mesh } from '../geometry/mesh';
import { OBSTACLES } from '../state';
import type { FixedFunction } from '../vendor/ff/ff';

const model = mat4.create();
const v3 = vec3.create();

// model = T(centro, apoyada en el suelo) . S(tamano), material blanco para que la
// textura se vea tal cual
export function drawObstacles(gl: WebGL2RenderingContext, ff: FixedFunction, box: Mesh, texture: WebGLTexture): void {
  for (const o of OBSTACLES) {
    vec3.set(v3, o.x, o.sy / 2, o.z);
    mat4.fromTranslation(model, v3);
    vec3.set(v3, o.sx, o.sy, o.sz);
    mat4.scale(model, model, v3);
    drawMesh(gl, ff, box, model, COLOR_WHITE, texture);
  }
}
