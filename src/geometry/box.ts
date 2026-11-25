// Caja unitaria con normales planas (Persona A)
// Sirve para el suelo, el chasis, la cabeza y las barras de fuerza.
// Va de -0.5 a 0.5 en cada eje (lado 1), entonces scale(ancho, alto, fondo) da
// justo esas medidas.
//
// Son 24 vertices y no 8 porque cada vertice tiene una sola normal, y en cada
// esquina se juntan 3 caras que miran a lados distintos. Con 8 vertices habria
// que promediar la normal y las aristas se verian redondeadas.
// Asi que cada cara tiene sus 4 vertices: 6 x 4 = 24.
import { FLOATS_PER_VERTEX } from '../constants';
import { createMesh } from './mesh';
import type { Mesh } from './mesh';

const HALF = 0.5;

// Cada cara con su normal y dos ejes u, v sobre la cara, elegidos para que
// u x v = normal. Recorriendo las esquinas (-u,-v) (+u,-v) (+u,+v) (-u,+v) sale
// antihorario visto desde afuera, que es lo que pide el CULL_FACE.
type Axis3 = readonly [number, number, number];
const FACES: readonly { readonly normal: Axis3; readonly u: Axis3; readonly v: Axis3 }[] = [
  { normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] }, // +X
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] }, // -X
  { normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] }, // +Y
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] }, // -Y
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] }, // +Z
  { normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] }, // -Z
];

// signos de u y v para las 4 esquinas, en orden antihorario
const CORNER_SIGNS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

// Arma vertices e indices de la caja. No toca WebGL, asi se puede probar aparte.
// Lo generamos con la tabla en vez de escribir los 24 vertices a mano para no
// equivocarnos con el orden.
export function boxData(): { vertices: Float32Array; indices: Uint16Array } {
  const vertices = new Float32Array(FACES.length * 4 * FLOATS_PER_VERTEX); // 6 caras, 4 vertices, 8 floats
  const indices = new Uint16Array(FACES.length * 2 * 3); // 2 triangulos por cara

  let v = 0;
  let t = 0;
  for (let f = 0; f < FACES.length; f++) {
    const { normal, u, v: w } = FACES[f];
    for (const [su, sv] of CORNER_SIGNS) {
      // centro de la cara + lo que se mueve en u y en v
      for (let k = 0; k < 3; k++) {
        vertices[v++] = normal[k] * HALF + u[k] * su * HALF + w[k] * sv * HALF;
      }
      // misma normal en las 4 esquinas (sombreado plano)
      for (let k = 0; k < 3; k++) {
        vertices[v++] = normal[k];
      }
      // UV: cada cara usa toda la textura. su y sv van de -1 a 1, los pasamos a 0..1.
      // Con (u, v) de la cara, la textura se ve derecha desde afuera.
      vertices[v++] = (su + 1) / 2;
      vertices[v++] = (sv + 1) / 2;
    }

    // triangulos (0, 1, 2) y (0, 2, 3)
    const base = f * 4;
    indices[t++] = base;
    indices[t++] = base + 1;
    indices[t++] = base + 2;
    indices[t++] = base;
    indices[t++] = base + 2;
    indices[t++] = base + 3;
  }

  return { vertices, indices };
}

export function createBoxMesh(gl: WebGL2RenderingContext): Mesh {
  const { vertices, indices } = boxData();
  return createMesh(gl, vertices, indices);
}
