// Indicador de fuerza (Persona A)
// Tres barras en la cara del chasis que da a la camara. Cuelgan de base, igual que
// el resto de la torreta: se mueven con ella en X pero no giran con el canon
// (eso es del pivote).
// Las tres son la misma caja, solo cambia la altura y el color.
import { mat4, vec3 } from 'gl-matrix';
import { COLOR_POWER_OFF, COLOR_POWER_ON } from '../constants';
import { drawMesh } from '../geometry/mesh';
import type { Mesh } from '../geometry/mesh';
import { state } from '../state';
import type { FixedFunction } from '../vendor/ff/ff';
import { baseTransform } from './turret';

const BAR_COUNT = 3;
// placas finitas pegadas al chasis
const BAR_WIDTH = 0.55;
const BAR_HEIGHT = 0.1;
const BAR_DEPTH = 0.06;
const BAR_BASE_Y = 0.4; // barra de abajo
const BAR_SPACING = 0.15;
// la cara +Z del chasis esta en 1.5 (fondo 3.0). Le sumamos medio grosor para que
// la barra sobresalga y no haya z-fighting
const BAR_Z = 1.5 + BAR_DEPTH / 2;

const mBase = mat4.create();
const mBar = mat4.create();
const v3 = vec3.create();

// Se prenden las barras con indice < power, o sea con fuerza 2 se prenden las dos
// de abajo. Las apagadas se dibujan oscuras para que se vea cuanto falta.
export function drawPower(gl: WebGL2RenderingContext, ff: FixedFunction, box: Mesh): void {
  baseTransform(mBase);

  for (let i = 0; i < BAR_COUNT; i++) {
    mat4.copy(mBar, mBase);
    vec3.set(v3, 0, BAR_BASE_Y + i * BAR_SPACING, BAR_Z);
    mat4.translate(mBar, mBar, v3);
    vec3.set(v3, BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH);
    mat4.scale(mBar, mBar, v3);

    const encendida = i < state.power;
    drawMesh(gl, ff, box, mBar, encendida ? COLOR_POWER_ON : COLOR_POWER_OFF);
  }
}
