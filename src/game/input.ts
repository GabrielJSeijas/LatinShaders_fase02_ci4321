// Teclado (Persona B)
//   <- / ->   mover la torreta en X
//   ^ / v     subir/bajar el canon (5 a 90 grados)
//   1 2 3     fuerza, F la va rotando
//   Espacio   disparar
//   R         reiniciar
//
// Los listeners solo guardan que tecla se toco, y processInput lo aplica una vez
// por frame (igual que en el ejemplo del cubo).
// Las flechas van en `held` porque nos importa si siguen apretadas; el resto va en
// `pressed` porque cuenta cada pulsacion.
import {
  PITCH_MAX_DEG,
  PITCH_MIN_DEG,
  resetState,
  state,
  TURRET_X_MAX,
  TURRET_X_MIN,
} from '../state';
import { fireProjectile } from './physics';

// torreta: u/s y u/s^2
const TURRET_MAX_SPEED = 4;
const TURRET_ACCEL = 16; // ~0.25 s hasta la vel. maxima
const TURRET_DECEL = 24;

// canon: grados/s y grados/s^2
const PITCH_MAX_SPEED = 60;
const PITCH_ACCEL = 240;
const PITCH_DECEL = 360;

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

const ACTIONS = new Set(['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3', 'KeyF', 'Space', 'KeyR']);

const held = new Set<string>();
const pressed: string[] = [];

// velocidad actual de cada eje, para el movimiento suave
const turretVel = { value: 0 };
const pitchVel = { value: 0 };

export function setupInput(): void {
  window.addEventListener('keydown', (e) => {
    if (ARROWS.has(e.code)) {
      e.preventDefault(); // si no, la pagina hace scroll
      held.add(e.code);
      return;
    }
    // con Ctrl/Alt/Cmd dejamos la tecla al navegador (Ctrl+R tiene que recargar)
    if (!ACTIONS.has(e.code) || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault(); // Espacio tambien hace scroll
    if (!e.repeat) pressed.push(e.code); // ignoramos el auto-repeat
  });

  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });

  // si se cambia de ventana con una flecha apretada nunca llega el keyup
  // y la torreta se quedaba moviendose sola
  window.addEventListener('blur', () => {
    held.clear();
  });
}

// mueve current hacia target como mucho maxDelta, sin pasarse
function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

// La flecha no mueve directo la posicion, solo dice a que velocidad queremos ir.
// La velocidad real se acerca a esa con accel (o decel cuando frena), y con eso
// se mueve. Todo multiplicado por dt para que no dependa de los FPS.
// En los limites recortamos al valor exacto (asi 5 y 90 se pueden alcanzar) y
// ponemos la velocidad en 0.
function moveAxis(
  value: number,
  vel: { value: number },
  direction: number,
  maxSpeed: number,
  accel: number,
  decel: number,
  min: number,
  max: number,
  dt: number,
): number {
  const target = direction * maxSpeed;
  // frena si se solto la tecla o si cambio de sentido
  const braking = target === 0 || vel.value * target < 0;
  vel.value = approach(vel.value, target, (braking ? decel : accel) * dt);

  const next = value + vel.value * dt;
  if (next <= min || next >= max) {
    vel.value = 0;
    return Math.min(Math.max(next, min), max);
  }
  return next;
}

function handleAction(code: string): void {
  switch (code) {
    case 'Digit1':
    case 'Numpad1':
      state.power = 1;
      break;
    case 'Digit2':
    case 'Numpad2':
      state.power = 2;
      break;
    case 'Digit3':
    case 'Numpad3':
      state.power = 3;
      break;
    case 'KeyF':
      // 1 -> 2 -> 3 -> 1
      state.power = ((state.power % 3) + 1) as 1 | 2 | 3;
      break;
    case 'Space':
      fireProjectile(); // si ya hay bala en el aire no hace nada
      break;
    case 'KeyR':
      resetState();
      turretVel.value = 0;
      pitchVel.value = 0;
      break;
  }
}

// Se llama una vez por frame antes del update. Se puede mover y apuntar aunque
// la bala este volando, solo cuenta para el siguiente tiro.
export function processInput(dt: number): void {
  for (const code of pressed) handleAction(code);
  pressed.length = 0;

  // si estan apretadas las dos opuestas se cancelan
  const xDir = (held.has('ArrowRight') ? 1 : 0) - (held.has('ArrowLeft') ? 1 : 0);
  const pitchDir = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);

  state.turretX = moveAxis(
    state.turretX, turretVel, xDir,
    TURRET_MAX_SPEED, TURRET_ACCEL, TURRET_DECEL,
    TURRET_X_MIN, TURRET_X_MAX, dt,
  );
  state.pitchDeg = moveAxis(
    state.pitchDeg, pitchVel, pitchDir,
    PITCH_MAX_SPEED, PITCH_ACCEL, PITCH_DECEL,
    PITCH_MIN_DEG, PITCH_MAX_DEG, dt,
  );
}
