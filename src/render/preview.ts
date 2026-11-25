// Vista previa de la trayectoria (Persona A, es un extra)
// Dibuja con LINE_STRIP por donde iria la bala si disparas ahora. No tiene su
// propia fisica, usa el mismo stepProjectile y FIXED_DT que el vuelo de verdad,
// por eso la linea coincide con el tiro.
//
// Diferencias con el resto del render:
//   - el VBO es DYNAMIC_DRAW porque los puntos cambian cada frame. Se crea una vez
//     y despues solo se reescribe con bufferSubData, siempre con el mismo array.
//   - el vertice es solo posicion (stride 12), sin normal.
//   - se dibuja sin luz y con setColor, una linea no tiene normal. Despues se
//     vuelve a prender la luz.
import { mat3, mat4, vec3 } from 'gl-matrix';
import { COLOR_PREVIEW } from '../constants';
import { FIXED_DT, POWER_SPEEDS, stepProjectile } from '../game/physics';
import { PROJECTILE_RADIUS, state } from '../state';
import { ATTRIB, LIGHTING } from '../vendor/ff/ff';
import type { FixedFunction } from '../vendor/ff/ff';
import { muzzleTransform } from './turret';

// guardando un punto cada 2 pasos, 400 puntos son ~6.7 s; el tiro mas largo
// (fuerza 3 vertical) dura como 3.3 s
export const PREVIEW_MAX_POINTS = 400;
// la fisica va cada 1/120 s pero con un punto cada 1/60 la linea ya se ve lisa
const SAMPLE_EVERY = 2;
const MAX_SECONDS = 8; // por si acaso, para que el for no se quede pegado

export type Preview = {
  readonly vao: WebGLVertexArrayObject;
  readonly buffer: WebGLBuffer;
};

const points = new Float32Array(PREVIEW_MAX_POINTS * 3); // x, y, z por punto
// copias para simular sin tocar el state
const simPos = vec3.create();
const simVel = vec3.create();
const prevPos = vec3.create();
const muzzle = { pos: vec3.create(), dir: vec3.create() };
const identity4 = mat4.create();
const identity3 = mat3.create();

// El buffer se reserva una vez con el tamano maximo. DYNAMIC_DRAW le avisa al
// driver que va a cambiar seguido; despues solo usamos bufferSubData.
export function createPreview(gl: WebGL2RenderingContext): Preview {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, points.byteLength, gl.DYNAMIC_DRAW);

  // solo posicion. El color sale de ff.setColor
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, 3 * 4, 0);

  gl.bindVertexArray(null);
  return { vao, buffer };
}

// simula el tiro actual y llena points, devuelve cuantos puntos quedaron
function buildTrajectory(): number {
  muzzleTransform(muzzle);
  vec3.copy(simPos, muzzle.pos);
  // la misma velocidad inicial que usa fireProjectile
  vec3.scale(simVel, muzzle.dir, POWER_SPEEDS[state.power - 1]);

  let count = 0;
  const write = (p: vec3): void => {
    points[count * 3] = p[0];
    points[count * 3 + 1] = p[1];
    points[count * 3 + 2] = p[2];
    count++;
  };
  write(simPos);

  const maxSteps = Math.ceil(MAX_SECONDS / FIXED_DT);
  for (let step = 1; step <= maxSteps && count < PREVIEW_MAX_POINTS; step++) {
    vec3.copy(prevPos, simPos);
    stepProjectile(simPos, simVel, FIXED_DT);

    if (simPos[1] <= PROJECTILE_RADIUS) {
      // Cortamos en y = radio y no en 0 porque la linea es el centro de la bala,
      // y el vuelo termina cuando el borde toca el suelo (igual que en physics.ts).
      // Antes cortaba en 0 y quedaba 0.15 mas larga.
      // Interpolamos para que termine justo en el cruce.
      const t = (prevPos[1] - PROJECTILE_RADIUS) / (prevPos[1] - simPos[1]);
      vec3.lerp(simPos, prevPos, simPos, t);
      write(simPos);
      break;
    }
    if (step % SAMPLE_EVERY === 0) write(simPos);
  }
  return count;
}

// Solo se ve cuando no hay bala volando (ahi ya se ve el tiro real).
export function drawPreview(gl: WebGL2RenderingContext, ff: FixedFunction, preview: Preview): void {
  if (state.projectile.flying) return;

  const count = buildTrajectory();
  if (count < 2) return;

  // subimos solo lo que se uso (bufferSubData cuenta en elementos, no en bytes)
  gl.bindVertexArray(preview.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, preview.buffer);
  gl.bufferSubData(gl.ARRAY_BUFFER, 0, points, 0, count * 3);

  // los puntos ya estan en mundo, por eso model = identidad. La normal tambien en
  // identidad para no dejar una vieja cuando se prenda la luz otra vez
  ff.disable(LIGHTING);
  ff.setColor(COLOR_PREVIEW);
  ff.setModelMatrix(identity4);
  ff.setNormalMatrix(identity3);
  ff.drawArrays(gl.LINE_STRIP, 0, count);
  ff.enable(LIGHTING);
}
