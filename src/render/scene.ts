// Luz y suelo (fase 1: Persona A). La camara ahora esta en render/camera.ts.
import { mat4, vec3 } from 'gl-matrix';
import { COLOR_GROUND, COLOR_GROUND_MARK } from '../constants';
import { drawMesh } from '../geometry/mesh';
import type { Mesh } from '../geometry/mesh';
import { LIGHTING } from '../vendor/ff/ff';
import type { FixedFunction } from '../vendor/ff/ff';

// --- luz
// Ambiente + difusa = 1. FF hace ka*ambiente + kd*difusa*max(n.l, 0) y recorta a
// [0, 1]; con ka = kd = color, si la suma pasa de 1 lo mas iluminado se satura.
export const GLOBAL_AMBIENT = 0.25;
export const LIGHT_DIFFUSE = 0.75;
// w = 0 es luz direccional y el xyz apunta hacia la luz. Viene de arriba, un poco
// a la derecha y de frente, del lado de la camara, asi vemos las caras con luz.
const LIGHT_POSITION: readonly [number, number, number, number] = [0.5, 1, 0.6, 0];

// --- suelo
// Es enorme a proposito. En el borde del fondo (759 unidades) el frustum mide 419
// de semiancho, con 450 los lados no se ven. Con 600 se veian los bordes y parecia
// una pasarela flotando. Igual es una sola caja, no cuesta nada.
export const GROUND_SIZE = 900;
export const GROUND_THICKNESS = 0.2; // la cara de arriba queda en y = 0
export const GROUND_CENTER_Z = 0; // centrado: el tanque ahora se mueve por todos lados

// Marcas en el suelo cada 5 unidades. No las piden, pero sin ellas no hay forma de
// saber si un objetivo esta lejos y alto o cerca y bajo.
export const DISTANCE_MARK_Z: readonly number[] = [-5, -10, -15, -20, -25, -30];
export const SHOW_DISTANCE_MARKS = true; // false para el suelo liso
const MARK_WIDTH = 20;
const MARK_DEPTH = 0.3;
const MARK_HEIGHT = 0.06; // un poco encima del suelo para que no haya z-fighting

// temporales para no crear matrices en cada frame
const model = mat4.create();
const translation = vec3.create();
const scaling = vec3.create();

// model = T * S
function placeScaled(tx: number, ty: number, tz: number, sx: number, sy: number, sz: number): void {
  vec3.set(translation, tx, ty, tz);
  vec3.set(scaling, sx, sy, sz);
  mat4.identity(model);
  mat4.translate(model, model, translation);
  mat4.scale(model, model, scaling);
}

// Luz. Solo al arrancar, no cambia.
export function setupScene(ff: FixedFunction): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([GLOBAL_AMBIENT, GLOBAL_AMBIENT, GLOBAL_AMBIENT, 1]);
  ff.setLight(0, {
    position: LIGHT_POSITION,
    diffuse: [LIGHT_DIFFUSE, LIGHT_DIFFUSE, LIGHT_DIFFUSE, 1],
  });
  ff.enableLight(0);

}

// Suelo y marcas. El suelo es la caja escalada muy no uniforme, pero no pasa nada
// porque FF normaliza la normal despues de la matriz normal. Y como es una cara
// plana con luz direccional, el Gouraud de FF da justo lo mismo en toda la cara.
export function drawScene(gl: WebGL2RenderingContext, ff: FixedFunction, box: Mesh): void {
  // bajamos medio grosor para que la cara de arriba quede en y = 0
  placeScaled(0, -GROUND_THICKNESS / 2, GROUND_CENTER_Z, GROUND_SIZE, GROUND_THICKNESS, GROUND_SIZE);
  drawMesh(gl, ff, box, model, COLOR_GROUND);

  if (!SHOW_DISTANCE_MARKS) return;
  for (const z of DISTANCE_MARK_Z) {
    placeScaled(0, MARK_HEIGHT / 2, z, MARK_WIDTH, MARK_HEIGHT, MARK_DEPTH);
    drawMesh(gl, ff, box, model, COLOR_GROUND_MARK);
  }
}
