// Cilindro unitario (Persona A)
// Para el tubo, la boca del canon y las ruedas. Radio 1, altura 1, eje en +Y
// (de y = -0.5 a 0.5). Despues se escala con scale(r, largo, r) y se rota.
// Igual que en la esfera, phi = 0 cae en +Z:  x = sin(phi), z = cos(phi)
//
// Las tapas tienen sus propios vertices. El costado lleva normales radiales
// (suaves, para que se vea redondo) y las tapas normales planas (+Y / -Y) para
// que el borde quede marcado. Como un vertice tiene una sola normal, los del
// borde hay que duplicarlos. Es lo mismo que pasa con la caja.
import { FLOATS_PER_VERTEX } from '../constants';
import { createMesh } from './mesh';
import type { Mesh } from './mesh';

export const CYLINDER_SEGMENTS = 24;

// Orden del buffer:
//   1. costado: anillo de arriba y de abajo, (segments + 1) vertices cada uno
//   2. tapa de arriba: centro + (segments + 1) del borde, normal (0, 1, 0)
//   3. tapa de abajo: igual pero con normal (0, -1, 0)
export function cylinderData(segments: number = CYLINDER_SEGMENTS): {
  vertices: Float32Array;
  indices: Uint16Array;
} {
  if (segments < 3) {
    throw new RangeError(`cylinderData: hacen falta al menos 3 divisiones (recibido ${segments}).`);
  }

  const columns = segments + 1; // +1 por la costura, como en la esfera
  const TOP = 0.5;
  const BOTTOM = -0.5;

  const vertexCount = 2 * columns + 2 * (1 + columns);
  // costado: 2 triangulos por division, cada tapa: 1
  const triangleCount = 2 * segments + 2 * segments;

  const vertices = new Float32Array(vertexCount * FLOATS_PER_VERTEX);
  const indices = new Uint16Array(triangleCount * 3);
  let v = 0;
  let t = 0;

  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number, u: number, w: number): void => {
    vertices[v++] = x;
    vertices[v++] = y;
    vertices[v++] = z;
    vertices[v++] = nx;
    vertices[v++] = ny;
    vertices[v++] = nz;
    vertices[v++] = u;
    vertices[v++] = w;
  };

  // --- 1. costado
  // la normal (sin phi, 0, cos phi) ya mide 1, y arriba y abajo comparten la misma
  const lateralTop = 0;
  const lateralBottom = columns;
  for (const y of [TOP, BOTTOM]) {
    for (let j = 0; j < columns; j++) {
      const phi = (j * 2 * Math.PI) / segments;
      const x = Math.sin(phi);
      const z = Math.cos(phi);
      // UV: u da la vuelta (0 a 1), v = 1 arriba y 0 abajo
      push(x, y, z, x, 0, z, j / segments, y === TOP ? 1 : 0);
    }
  }
  // mismo orden que en la esfera
  for (let j = 0; j < segments; j++) {
    const topLeft = lateralTop + j;
    const topRight = topLeft + 1;
    const bottomLeft = lateralBottom + j;
    const bottomRight = bottomLeft + 1;
    indices[t++] = topLeft;
    indices[t++] = bottomLeft;
    indices[t++] = bottomRight;
    indices[t++] = topLeft;
    indices[t++] = bottomRight;
    indices[t++] = topRight;
  }

  // --- 2 y 3. tapas, cada una es un abanico desde el centro
  for (const [y, ny] of [
    [TOP, 1],
    [BOTTOM, -1],
  ] as const) {
    const center = v / FLOATS_PER_VERTEX;
    // UV de las tapas: el circulo dentro del cuadrado de la textura, centro en (0.5, 0.5)
    push(0, y, 0, 0, ny, 0, 0.5, 0.5);
    for (let j = 0; j < columns; j++) {
      const phi = (j * 2 * Math.PI) / segments;
      const sx = Math.sin(phi);
      const cz = Math.cos(phi);
      push(sx, y, cz, 0, ny, 0, 0.5 + 0.5 * sx, 0.5 + 0.5 * cz);
    }
    const ring = center + 1;
    for (let j = 0; j < segments; j++) {
      // (centro, j, j+1) es antihorario visto desde +Y; la tapa de abajo se ve
      // desde -Y, asi que ahi va al reves
      indices[t++] = center;
      if (ny > 0) {
        indices[t++] = ring + j;
        indices[t++] = ring + j + 1;
      } else {
        indices[t++] = ring + j + 1;
        indices[t++] = ring + j;
      }
    }
  }

  return { vertices, indices };
}

export function createCylinderMesh(gl: WebGL2RenderingContext, segments: number = CYLINDER_SEGMENTS): Mesh {
  const { vertices, indices } = cylinderData(segments);
  return createMesh(gl, vertices, indices);
}
