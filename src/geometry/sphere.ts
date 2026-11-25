// Esfera unitaria por latitud/longitud (Persona A)
// Para los objetivos y la bala. Radio 1 en el origen; el tamano y la posicion
// los pone la matriz de modelo.
//
// theta: desde el polo norte (+Y), 0 a PI      (latitud)
// phi:   alrededor de Y, 0 a 2*PI             (longitud)
//   y = cos(theta)
//   r = sin(theta)     radio del anillo a esa altura
//   x = r * sin(phi)
//   z = r * cos(phi)   (phi = 0 cae en +Z)
import { FLOATS_PER_VERTEX } from '../constants';
import { createMesh } from './mesh';
import type { Mesh } from './mesh';

export const SPHERE_LAT_BANDS = 16; // anillos de polo a polo
export const SPHERE_LON_BANDS = 24; // divisiones alrededor de Y

// Arma vertices e indices. No toca WebGL.
// La normal es igual a la posicion: en una esfera de radio 1 centrada en el
// origen el vector centro -> punto ya es perpendicular a la superficie y mide 1.
// Los triangulos van antihorarios desde afuera; si estuvieran al reves el
// CULL_FACE se comeria justo las caras que mira la camara.
export function sphereData(
  latBands: number = SPHERE_LAT_BANDS,
  lonBands: number = SPHERE_LON_BANDS,
): { vertices: Float32Array; indices: Uint16Array } {
  if (latBands < 2 || lonBands < 3) {
    throw new RangeError(`sphereData: hacen falta al menos 2 bandas de latitud y 3 de longitud (recibido ${latBands}, ${lonBands}).`);
  }

  // una columna extra para la costura: phi = 0 y phi = 2*PI son el mismo punto
  // pero lo repetimos. Asi los indices quedan parejos y si despues ponemos
  // texturas ese vertice necesita u = 0 y u = 1.
  const rings = latBands + 1;
  const columns = lonBands + 1;
  const vertexCount = rings * columns;
  if (vertexCount > 65536) {
    throw new RangeError(`sphereData: ${vertexCount} vertices no caben en indices Uint16.`);
  }

  const vertices = new Float32Array(vertexCount * FLOATS_PER_VERTEX);
  let v = 0;
  for (let i = 0; i < rings; i++) {
    const theta = (i * Math.PI) / latBands;
    const y = Math.cos(theta);
    const ringRadius = Math.sin(theta);
    for (let j = 0; j < columns; j++) {
      const phi = (j * 2 * Math.PI) / lonBands;
      const x = ringRadius * Math.sin(phi);
      const z = ringRadius * Math.cos(phi);
      vertices[v++] = x; // posicion
      vertices[v++] = y;
      vertices[v++] = z;
      vertices[v++] = x; // normal (= posicion)
      vertices[v++] = y;
      vertices[v++] = z;
      // UV: u da la vuelta con la longitud (0 a 1) y v baja del polo norte (1) al
      // sur (0), asi la imagen se ve con el arriba arriba. La costura repetida
      // tiene u = 0 y u = 1.
      vertices[v++] = j / lonBands;
      vertices[v++] = 1 - i / latBands;
    }
  }

  // 2 triangulos por celda menos en las bandas de los polos, donde uno de los dos
  // tendria area 0 porque la fila del polo es un solo punto
  const triangleCount = lonBands * (2 * latBands - 2);
  const indices = new Uint16Array(triangleCount * 3);
  let t = 0;
  for (let i = 0; i < latBands; i++) {
    for (let j = 0; j < lonBands; j++) {
      // "top" es el lado mas cerca del polo norte
      const topLeft = i * columns + j;
      const topRight = topLeft + 1;
      const bottomLeft = (i + 1) * columns + j;
      const bottomRight = bottomLeft + 1;

      // antihorario desde afuera: (v1 - v0) x (v2 - v0) apunta hacia afuera
      if (i !== latBands - 1) {
        // en la banda del polo sur bottomLeft y bottomRight son el mismo punto
        indices[t++] = topLeft;
        indices[t++] = bottomLeft;
        indices[t++] = bottomRight;
      }
      if (i !== 0) {
        // en la del polo norte topLeft y topRight son el mismo punto
        indices[t++] = topLeft;
        indices[t++] = bottomRight;
        indices[t++] = topRight;
      }
    }
  }

  return { vertices, indices };
}

export function createSphereMesh(
  gl: WebGL2RenderingContext,
  latBands: number = SPHERE_LAT_BANDS,
  lonBands: number = SPHERE_LON_BANDS,
): Mesh {
  const { vertices, indices } = sphereData(latBands, lonBands);
  return createMesh(gl, vertices, indices);
}
