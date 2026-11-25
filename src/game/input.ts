// Teclado
//   W / S       avanzar / retroceder (segun hacia donde mira la base)
//   A / D       girar la base a la izquierda / derecha
//   <- / ->     girar la torreta a la izquierda / derecha
//   ^ / v       subir/bajar el canon (5 a 90 grados)
//   1 2 3       fuerza, F la va rotando
//   Espacio     disparar
//   C           cambiar de camara
//   V           cambiar el color del tanque
//   R           reiniciar
//
// Los listeners solo guardan que tecla se toco, y processInput lo aplica una vez
// por frame (igual que en el ejemplo del cubo).
// Las teclas de movimiento van en `held` porque nos importa si siguen apretadas; el
// resto va en `pressed` porque cuenta cada pulsacion.
import { ARENA_HALF, PITCH_MAX_DEG, PITCH_MIN_DEG, resetState, state } from '../state';
import { TANK_COLORS } from '../constants';
import { fireProjectile } from './physics';

const DEG_TO_RAD = Math.PI / 180;

// avance del tanque: u/s y u/s^2
const TANK_MAX_SPEED = 5;
const TANK_ACCEL = 14;
const TANK_DECEL = 20;

// giro de la base y de la torreta: grados/s (el giro es directo, sin aceleracion)
const BASE_TURN_SPEED = 90;
const TURRET_TURN_SPEED = 80;

// canon: grados/s y grados/s^2
const PITCH_MAX_SPEED = 60;
const PITCH_ACCEL = 240;
const PITCH_DECEL = 360;

const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);

const ACTIONS = new Set(['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3', 'KeyF', 'Space', 'KeyR', 'KeyC', 'KeyV']);

const held = new Set<string>();
const pressed: string[] = [];

// velocidad actual del canon, para el movimiento suave
const pitchVel = { value: 0 };

export function setupInput(): void {
  window.addEventListener('keydown', (e) => {
    if (ARROWS.has(e.code) || MOVE_KEYS.has(e.code)) {
      if (ARROWS.has(e.code)) e.preventDefault(); // si no, la pagina hace scroll
      if (!e.ctrlKey && !e.altKey && !e.metaKey) held.add(e.code); // Ctrl+R / Ctrl+W son del navegador
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
  // y el tanque se quedaba moviendose solo
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
    case 'KeyC':
      // 0 -> 1 -> 2 -> 0
      state.cameraMode = ((state.cameraMode + 1) % 3) as 0 | 1 | 2;
      break;
    case 'KeyV':
      state.colorIndex = (state.colorIndex + 1) % TANK_COLORS.length;
      break;
    case 'KeyR':
      resetState();
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
  const forward = (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0);
  const turnBase = (held.has('KeyA') ? 1 : 0) - (held.has('KeyD') ? 1 : 0); // A = izquierda = giro positivo
  const turnTurret = (held.has('ArrowLeft') ? 1 : 0) - (held.has('ArrowRight') ? 1 : 0);
  const pitchDir = (held.has('ArrowUp') ? 1 : 0) - (held.has('ArrowDown') ? 1 : 0);

  const tank = state.tank;
  tank.yawDeg += turnBase * BASE_TURN_SPEED * dt;
  tank.turretYawDeg += turnTurret * TURRET_TURN_SPEED * dt;

  // la velocidad se acerca a la deseada con aceleracion (o freno al soltar)
  const target = forward * TANK_MAX_SPEED;
  const braking = target === 0 || tank.speed * target < 0;
  tank.speed = approach(tank.speed, target, (braking ? TANK_DECEL : TANK_ACCEL) * dt);

  // con yaw = 0 el tanque mira a -Z. Girar yaw alrededor de Y lleva (0, 0, -1) a
  // (-sin(yaw), 0, -cos(yaw)), esa es la direccion de avance.
  const yaw = tank.yawDeg * DEG_TO_RAD;
  tank.x += -Math.sin(yaw) * tank.speed * dt;
  tank.z += -Math.cos(yaw) * tank.speed * dt;
  tank.x = Math.min(Math.max(tank.x, -ARENA_HALF), ARENA_HALF);
  tank.z = Math.min(Math.max(tank.z, -ARENA_HALF), ARENA_HALF);

  state.pitchDeg = moveAxis(
    state.pitchDeg, pitchVel, pitchDir,
    PITCH_MAX_SPEED, PITCH_ACCEL, PITCH_DECEL,
    PITCH_MIN_DEG, PITCH_MAX_DEG, dt,
  );
}
