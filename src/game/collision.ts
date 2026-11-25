// Colision bala-objetivo (Persona B)
// Esfera contra esfera: hay choque si la distancia entre centros es <= a la suma
// de los radios. Comparamos todo al cuadrado para no sacar raiz.
import { vec3 } from 'gl-matrix';
import { PROJECTILE_RADIUS, state } from '../state';

// La llama updatePhysics despues de cada paso fijo. Devuelve true si le dio a algo.
export function hitTest(): boolean {
  const projectile = state.projectile;
  if (!projectile.flying) return false;

  for (const target of state.targets) {
    if (!target.alive) continue;
    const reach = PROJECTILE_RADIUS + target.radius;
    if (vec3.squaredDistance(projectile.pos, target.pos) <= reach * reach) {
      // con el primer objetivo que toca la bala se para, no tumba dos
      target.alive = false;
      projectile.flying = false;
      return true;
    }
  }
  return false;
}

// main.ts la llama despues de la fisica. En realidad ya se reviso todo en
// updatePhysics, esto queda para no cambiar main.ts.
export function checkCollisions(): void {
  hitTest();
}
