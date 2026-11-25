// Prueba de que la bala vuela igual a 30 y a 144 FPS (Persona B)
// No es parte del juego, main.ts no lo importa. Para correrlo, con npm run dev
// abierto, en la consola del navegador:
//
//   (await import('/src/game/fps-check.ts')).fpsCheck()
//
// Le pasa al updatePhysics de verdad frames de 1/30 y 1/144 y compara cada
// posicion con una corrida de referencia (un paso por frame).
// ojo: al final llama a resetState, asi que reinicia la partida.
import { vec3 } from 'gl-matrix';
import { PROJECTILE_RADIUS, resetState, state } from '../state';
import { checkCollisions } from './collision';
import { FIXED_DT, fireProjectile, stepProjectile, updatePhysics } from './physics';

const MAX_FLIGHT_TIME = 10; // segundos, ningun tiro dura tanto

type Flight = {
  samples: string[]; // posicion al final de cada frame, como "x,y,z"
  hit: number; // indice del objetivo que tumbo, -1 si ninguno
};

// lo pasamos a texto para comparar exacto (el toString de JS no redondea)
function key(v: vec3): string {
  return `${v[0]},${v[1]},${v[2]}`;
}

type Shot = { power: 1 | 2 | 3; pitchDeg: number; turretX: number };

function fire(shot: Shot): void {
  resetState();
  state.power = shot.power;
  state.pitchDeg = shot.pitchDeg;
  state.turretX = shot.turretX;
  fireProjectile();
}

// simula un tiro con el mismo loop del juego, con frames de dt segundos
function simulate(shot: Shot, dt: number): Flight {
  fire(shot);
  // metemos la punta del canon como primer punto porque a 144 FPS el primer
  // frame es mas corto que FIXED_DT y la bala todavia no se movio
  const samples = [key(state.projectile.pos)];
  for (let t = 0; t < MAX_FLIGHT_TIME && state.projectile.flying; t += dt) {
    updatePhysics(dt);
    checkCollisions();
    samples.push(key(state.projectile.pos));
  }
  return { samples, hit: state.targets.findIndex((target) => !target.alive) };
}

// para comparar: integrando directo con el dt del frame, sin paso fijo
function naiveLanding(shot: Shot, fps: number): vec3 {
  fire(shot);
  const pos = vec3.clone(state.projectile.pos);
  const vel = vec3.clone(state.projectile.vel);
  for (let t = 0; t < MAX_FLIGHT_TIME && pos[1] - PROJECTILE_RADIUS > 0; t += 1 / fps) {
    stepProjectile(pos, vel, 1 / fps);
  }
  return pos;
}

// cuantos puntos del vuelo no estan en la curva de referencia
function offCurve(flight: Flight, curve: Set<string>): number {
  return flight.samples.filter((sample) => !curve.has(sample)).length;
}

// Busca un tiro que le pegue a cada objetivo (torreta en la x del objetivo,
// probando las 3 fuerzas y angulos de medio en medio grado). Es para que la
// prueba tambien pase por la colision.
function shotsAtTargets(): Shot[] {
  resetState();
  const xs = state.targets.map((target) => target.pos[0]);
  const shots: Shot[] = [];
  xs.forEach((turretX, i) => {
    for (const power of [1, 2, 3] as const) {
      for (let pitchDeg = 5; pitchDeg <= 90; pitchDeg += 0.5) {
        const shot = { power, pitchDeg, turretX };
        if (simulate(shot, FIXED_DT).hit === i) {
          shots.push(shot);
          return;
        }
      }
    }
  });
  return shots;
}

// Imprime la tabla y devuelve true si a 30 y 144 FPS todo coincide
// (mismos puntos, mismo final y mismo objetivo).
export function fpsCheck(): boolean {
  const shots: Shot[] = [];
  for (const power of [1, 2, 3] as const) {
    for (const pitchDeg of [5, 30, 45, 60, 90]) shots.push({ power, pitchDeg, turretX: 0 });
  }
  shots.push(...shotsAtTargets());

  const rows = [];
  let allOk = true;
  for (const shot of shots) {
    // con un paso por frame cada frame es un punto de la curva
    const reference = simulate(shot, FIXED_DT);
    const curve = new Set(reference.samples);
    const at30 = simulate(shot, 1 / 30);
    const at144 = simulate(shot, 1 / 144);

    const end = reference.samples[reference.samples.length - 1];
    const ok =
      offCurve(at30, curve) === 0 &&
      offCurve(at144, curve) === 0 &&
      at30.samples[at30.samples.length - 1] === end &&
      at144.samples[at144.samples.length - 1] === end &&
      at30.hit === reference.hit &&
      at144.hit === reference.hit;
    allOk &&= ok;

    rows.push({
      x: shot.turretX,
      fuerza: shot.power,
      angulo: shot.pitchDeg,
      'frames 30': at30.samples.length - 1,
      'frames 144': at144.samples.length - 1,
      'fuera de curva (30/144)': `${offCurve(at30, curve)}/${offCurve(at144, curve)}`,
      'objetivo (30/144)': `${at30.hit}/${at144.hit}`,
      'mismo final': ok ? 'si' : 'NO',
      'sin paso fijo: diferencia al caer': vec3.distance(naiveLanding(shot, 30), naiveLanding(shot, 144)).toFixed(3),
    });
  }

  console.table(rows);
  console.log(
    allOk
      ? 'OK: a 30 y a 144 FPS la bala recorre exactamente los mismos puntos.'
      : 'FALLO: hay diferencias entre 30 y 144 FPS (ver tabla).',
  );
  resetState();
  return allOk;
}
