// Easter egg (Persona A, no lo pide el enunciado)
// Si subes el canon casi a 90 y disparas, la bala te cae encima, explota y se
// lleva el tanque: no se dibuja mas la torreta, las barras, la bala ni la linea
// hasta que aprietes R.
//
// No toca nada de src/game/, solo mira state.projectile.flying:
//   false -> true: se acaba de disparar, guardamos el angulo
//   volando: si el tiro fue casi vertical y la bala viene bajando dentro de la
//            silueta del tanque, explota ahi
// Si la bala no cae sobre el tanque no pasa nada, cae normal.
//
// La explosion tiene particulas que se mueven, asi que tiene una parte de update
// (updateExplosion, sin WebGL) y una de render (drawExplosion, no cambia nada).
// Su estado vive aqui y no en state.ts porque es solo un efecto visual.
import { mat3, mat4, vec3 } from 'gl-matrix';
import { COLOR_BLAST_FLASH, COLOR_BLAST_PARTICLES } from '../constants';
import type { Mesh } from '../geometry/mesh';
import { state } from '../state';
import { LIGHTING } from '../vendor/ff/ff';
import type { FixedFunction } from '../vendor/ff/ff';

const TRIGGER_PITCH_DEG = 85; // angulo minimo para que cuente

// A 90 grados la bala sube y baja recta y cae justo donde salio. Si esperabamos a
// que tocara el suelo la explosion salia en y = 0.06, debajo del chasis (0.3 a 0.8),
// y el tanque la tapaba casi toda (se veia como el 7% de las chispas). Por eso
// explota cuando choca con el tanque.
const TANK_TOP_Y = 1.35; // por encima del chasis y la cabeza
// medio ancho y medio fondo del tanque, con un poco de margen
const TANK_HALF_X = 1.35;
const TANK_HALF_Z = 1.6;

const DURATION = 1.5; // segundos
const FLASH_DURATION = 0.22;
const FLASH_RADIUS = 0.85;

const PARTICLE_COUNT = 28;
const PARTICLE_RADIUS = 0.13; // se van achicando hasta desaparecer
const SPEED_MIN = 2.4;
const SPEED_MAX = 5.6;
const PARTICLE_GRAVITY = 9.8; // la misma que la bala
const BOUNCE = 0.35; // cuanta velocidad queda al rebotar
const FRICTION = 0.7; // roce en cada rebote

type Particle = { pos: vec3; vel: vec3; colorIndex: number };

// Direcciones en la media esfera de arriba con el metodo de Fibonacci (quedan
// repartidas parejas, sin amontonarse en el polo). Solo arriba porque explota
// contra el suelo. Se calculan una vez al cargar.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const directions: vec3[] = [];
const speeds: number[] = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const y = (i + 0.5) / PARTICLE_COUNT; // de 0 a 1
  const ringRadius = Math.sqrt(1 - y * y);
  const theta = i * GOLDEN_ANGLE;
  directions.push(vec3.fromValues(ringRadius * Math.cos(theta), y, ringRadius * Math.sin(theta)));
  // rapidez variada sin Math.random, asi sale igual siempre (mejor para el video)
  const t = (i * 0.6180339887) % 1;
  speeds.push(SPEED_MIN + (SPEED_MAX - SPEED_MIN) * t);
}

// las particulas se crean una vez y se reusan
const particles: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  pos: vec3.create(),
  vel: vec3.create(),
  colorIndex: i % COLOR_BLAST_PARTICLES.length,
}));

let elapsed = DURATION; // si llega a DURATION es que no hay explosion
const flashCenter = vec3.create();
let wasFlying = false; // como estaba la bala en el frame anterior
let launchPitchDeg = 0;
let alreadyBlown = false; // para no explotar dos veces con el mismo tiro
// queda en true hasta que se reinicia. El state no cambia, la torreta sigue ahi
// para la fisica, solo no se dibuja
let turretDestroyed = false;
let lastResetCount = -1; // para darnos cuenta de que se apreto R

const model = mat4.create();
const normalIdentity = mat3.create();
const v3 = vec3.create();

function trigger(center: vec3): void {
  elapsed = 0;
  vec3.copy(flashCenter, center);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    vec3.copy(particles[i].pos, center);
    vec3.scale(particles[i].vel, directions[i], speeds[i]);
  }
}

// para las pruebas
export function isExploding(): boolean {
  return elapsed < DURATION;
}

// main.ts lo usa para no dibujar las cosas del jugador hasta la R
export function isTurretDestroyed(): boolean {
  return turretDestroyed;
}

// Parte del update: mira el state, ve si toca explotar y mueve las particulas.
// No usa WebGL ni cambia el state.
export function updateExplosion(dt: number): void {
  // si resetCount cambio es que se reinicio: vuelve el tanque y se corta lo que hubiera
  if (state.resetCount !== lastResetCount) {
    lastResetCount = state.resetCount;
    turretDestroyed = false;
    alreadyBlown = false;
    elapsed = DURATION;
  }

  const flying = state.projectile.flying;

  if (flying && !wasFlying) {
    // recien disparada
    launchPitchDeg = state.pitchDeg;
    alreadyBlown = false;
  } else if (flying && launchPitchDeg >= TRIGGER_PITCH_DEG && !alreadyBlown) {
    // Tiene que venir bajando, si no explotaria apenas sale (cuando sube pasa por
    // el mismo lugar)
    const pos = state.projectile.pos;
    const bajando = state.projectile.vel[1] < 0;
    const sobreElTanque =
      Math.abs(pos[0] - state.turretX) <= TANK_HALF_X && Math.abs(pos[2]) <= TANK_HALF_Z;
    if (bajando && sobreElTanque && pos[1] <= TANK_TOP_Y && !turretDestroyed) {
      trigger(pos);
      alreadyBlown = true;
      turretDestroyed = true;
    }
  }
  // Si no cae sobre el tanque no hay explosion. Al principio tambien explotaba al
  // tocar el suelo, pero salia detras o debajo del tanque y casi no se veia.
  wasFlying = flying;

  if (elapsed >= DURATION) return;
  elapsed += dt;

  // Las particulas caen con el mismo Euler semi-implicito que la bala y rebotan
  // perdiendo velocidad. El "suelo" de cada una esta en su radio porque lo que
  // movemos es el centro.
  const floor = PARTICLE_RADIUS;
  for (const p of particles) {
    p.vel[1] -= PARTICLE_GRAVITY * dt;
    p.pos[0] += p.vel[0] * dt;
    p.pos[1] += p.vel[1] * dt;
    p.pos[2] += p.vel[2] * dt;
    if (p.pos[1] < floor) {
      p.pos[1] = floor;
      p.vel[1] = -p.vel[1] * BOUNCE;
      p.vel[0] *= FRICTION;
      p.vel[2] *= FRICTION;
    }
  }
}

// esfera en center con ese radio, sin luz
function drawBall(
  gl: WebGL2RenderingContext,
  ff: FixedFunction,
  sphere: Mesh,
  center: vec3,
  radius: number,
): void {
  vec3.set(v3, center[0], center[1], center[2]);
  mat4.fromTranslation(model, v3);
  vec3.set(v3, radius, radius, radius);
  mat4.scale(model, model, v3);
  ff.setModelMatrix(model);
  gl.bindVertexArray(sphere.vao);
  ff.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
}

// Parte del render. Va sin luz igual que la vista previa: el fuego tiene luz
// propia, y con iluminacion media chispa quedaba en sombra y parecian piedras.
// Al final se vuelve a prender la luz.
export function drawExplosion(gl: WebGL2RenderingContext, ff: FixedFunction, sphere: Mesh): void {
  if (elapsed >= DURATION) return;

  ff.disable(LIGHTING);
  ff.setNormalMatrix(normalIdentity);

  // destello: crece hasta el 40% de su vida y despues se achica
  if (elapsed < FLASH_DURATION) {
    const t = elapsed / FLASH_DURATION;
    const curva = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
    ff.setColor(COLOR_BLAST_FLASH);
    drawBall(gl, ff, sphere, flashCenter, FLASH_RADIUS * curva);
  }

  // las chispas se achican parejo durante toda la explosion
  const restante = 1 - elapsed / DURATION;
  const radio = PARTICLE_RADIUS * restante;
  if (radio > 0.001) {
    for (const p of particles) {
      ff.setColor(COLOR_BLAST_PARTICLES[p.colorIndex]);
      drawBall(gl, ff, sphere, p.pos, radio);
    }
  }

  ff.enable(LIGHTING);
}
