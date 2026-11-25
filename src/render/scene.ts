// Camara fija, luz y suelo (Persona A)
//
// Como la camara no se mueve en todo el juego, la ubicamos midiendo en vez de a
// ojo. Proyectamos a NDC lo que tiene que caber (los extremos de la torreta, los
// objetivos y las parabolas de las 3 fuerzas) y miramos:
//   - separacion: que tanto se separan los objetivos en pantalla (sin sombras ni
//     texturas es lo unico que deja ver cual esta mas lejos)
//   - ancho: cuanto ocupa el recorrido de la torreta
//   - arco: que tanto se ve curva la parabola
//
// Lo que salio:
//   - con la camara justo detras (yaw 0) el arco da 0. La parabola esta en el plano
//     YZ y si la camara tambien, se ve como una linea recta.
//   - con poquito yaw ya se arregla. Probando yaw 0..30 y pitch 5..28, yaw 6 y
//     pitch 12 dio el arco mas grande (0.320) y sigue viendose casi desde atras.
//     Una vista de tres cuartos (yaw 45, pitch 40) separaba 6% mas los objetivos
//     pero aplanaba el arco 62% y achicaba la torreta 67%.
//   - cerca de yaw 20 con pitch bajo los tres objetivos quedan uno encima del otro
//     (separacion 0.024), hay que evitarlo.
//
// La distancia (21.23) se ajusto para que lo mas extremo quede al 92% del cuadro.
// La tuvimos que recalcular despues de modelar la torreta porque la silueta se sale
// mas que x = +-4: la rueda de afuera llega a 1.24 del centro, asi que la silueta
// llega a +-5.24 (calculamos con 1.45 para tener margen).
//
// Que queda fuera de cuadro: con 45 grados de FOV no cabe a la vez la torreta y un
// tiro vertical a fuerza 3 (sube como 15 m). Para que entrara habia que alejar la
// camara 61% y la torreta casi no se veria, asi que preferimos encuadrar el juego.
// En el peor caso (x de -4 a 4):
//   fuerza 1: cabe con cualquier angulo
//   fuerza 2: hasta 69 grados
//   fuerza 3: hasta 52 grados
// Los tiros que le pegan a algun objetivo van entre 5 y 21 grados, asi que caben
// sobrados. Los muy altos se salen por arriba y vuelven a entrar.
import { mat4, vec3 } from 'gl-matrix';
import { CANVAS_HEIGHT, CANVAS_WIDTH, COLOR_GROUND, COLOR_GROUND_MARK } from '../constants';
import { drawMesh } from '../geometry/mesh';
import type { Mesh } from '../geometry/mesh';
import { LIGHTING } from '../vendor/ff/ff';
import type { FixedFunction } from '../vendor/ff/ff';

// --- camara
// detras de la torreta (+Z), arriba y 6 grados hacia +X
export const CAMERA_EYE: readonly [number, number, number] = [2.17, 5.91, 12.65];
// mira entre la torreta y el objetivo del medio
export const CAMERA_TARGET: readonly [number, number, number] = [0, 1.5, -8];
export const CAMERA_FOVY = Math.PI / 4;
// el near no lo bajamos de mas porque la precision del depth depende de far/near
export const CAMERA_NEAR = 0.5;
export const CAMERA_FAR = 1200;

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
export const GROUND_CENTER_Z = -300; // corrido hacia el fondo

// Marcas en el suelo cada 5 unidades. No las piden, pero sin ellas no hay forma de
// saber si un objetivo esta lejos y alto o cerca y bajo.
export const DISTANCE_MARK_Z: readonly number[] = [-5, -10, -15, -20, -25];
export const SHOW_DISTANCE_MARKS = true; // false para el suelo liso
const MARK_WIDTH = 20;
const MARK_DEPTH = 0.3;
const MARK_HEIGHT = 0.06; // un poco encima del suelo para que no haya z-fighting

// temporales para no crear matrices en cada frame
const model = mat4.create();
const view = mat4.create();
const projection = mat4.create();
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

// Camara y luz. Solo al arrancar, no cambian.
export function setupScene(ff: FixedFunction): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([GLOBAL_AMBIENT, GLOBAL_AMBIENT, GLOBAL_AMBIENT, 1]);
  ff.setLight(0, {
    position: LIGHT_POSITION,
    diffuse: [LIGHT_DIFFUSE, LIGHT_DIFFUSE, LIGHT_DIFFUSE, 1],
  });
  ff.enableLight(0);

  mat4.lookAt(view, CAMERA_EYE, CAMERA_TARGET, [0, 1, 0]);
  ff.setViewMatrix(view);

  // aspect del buffer (4:3), no del tamano del canvas en pantalla
  mat4.perspective(projection, CAMERA_FOVY, CANVAS_WIDTH / CANVAS_HEIGHT, CAMERA_NEAR, CAMERA_FAR);
  ff.setProjectionMatrix(projection);
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
