// Malla generica (VAO + numero de indices) y como dibujarla con FF. (Persona A)
//
// Esfera, caja y cilindro usan el mismo vertice intercalado:
//
//   x   y   z    nx  ny  nz
//   0   4   8    12  16  20    <- offset en bytes
//   |---------- 24 bytes ----------|   <- stride
//
// Usamos un solo buffer intercalado en vez de uno por atributo, asi cada vertice
// queda junto en memoria.
import { mat3 } from 'gl-matrix';
import type { ReadonlyMat4 } from 'gl-matrix';
import { ATTRIB } from '../vendor/ff/ff';
import type { Color, FixedFunction } from '../vendor/ff/ff';
import { NORMAL_OFFSET_BYTES, STRIDE_BYTES } from '../constants';

// con el VAO y la cantidad de indices ya se puede dibujar
export type Mesh = {
  readonly vao: WebGLVertexArrayObject;
  readonly indexCount: number;
};

// Sube la malla a la GPU. Se llama una vez por primitiva al arrancar, nunca en el
// loop. STATIC_DRAW porque los vertices no cambian, lo que cambia es la matriz.
// Los indices van antihorarios vistos desde afuera (por el CULL_FACE).
export function createMesh(gl: WebGL2RenderingContext, vertices: Float32Array, indices: Uint16Array): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);

  // ojo: el VAO no guarda cual ARRAY_BUFFER esta ligado, guarda lo que se le
  // dice en vertexAttribPointer
  const vertexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // sin ATTRIB.COLOR: con LIGHTING el color sale del material y si lo activamos
  // FF tira un aviso de que lo ignora
  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);

  // el ELEMENT_ARRAY_BUFFER si se queda guardado en el VAO
  const indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  gl.bindVertexArray(null);
  return { vao, indexCount: indices.length };
}

// se reusa en cada drawMesh para no crear una mat3 cada vez
const normalMatrix = mat3.create();

// Dibuja una malla con un color y una matriz de modelo.
// El mismo color va de ambient y diffuse (asi la sombra no queda negra).
// La matriz normal hay que pasarla a mano porque FF no la calcula al hacer
// setModelMatrix. Es la inversa transpuesta de la 3x3 del modelo; con escalas no
// uniformes (el suelo, el tubo) si usamos la del modelo las normales quedan
// torcidas y la luz se ve mal. FF en debug avisa "normal matrix may be stale".
export function drawMesh(
  gl: WebGL2RenderingContext,
  ff: FixedFunction,
  mesh: Mesh,
  model: ReadonlyMat4,
  color: Color,
): void {
  ff.setMaterial({ ambient: color, diffuse: color });
  ff.setModelMatrix(model);
  mat3.normalFromMat4(normalMatrix, model);
  ff.setNormalMatrix(normalMatrix);

  gl.bindVertexArray(mesh.vao);
  ff.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
}
