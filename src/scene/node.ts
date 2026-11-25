// Arbol de escena (Gabriel)
// Cada nodo tiene una transformacion LOCAL (respecto a su padre) e hijos.
// La matriz de MUNDO sale de multiplicar hacia abajo:  world = world(padre) * local
// El orden importa: primero se aplica la del padre, luego la del hijo.
//
// La escala NO va en `local`: va aparte, en `size`, y solo se usa al dibujar.
// Asi los hijos no heredan la escala del padre (si el chasis es 2.4 x 0.5 x 3 y el
// canon fuera su hijo, saldria aplastado). local solo lleva traslacion y rotacion.
//
// Un nodo sin `mesh` es solo un "pivote" (ej. la torreta, el eje del canon).
import { mat4, vec3 } from 'gl-matrix';
import type { Mesh } from '../geometry/mesh';
import { drawMesh } from '../geometry/mesh';
import type { Color, FixedFunction } from '../vendor/ff/ff';

export class SceneNode {
  readonly local = mat4.create();
  readonly world = mat4.create();
  readonly children: SceneNode[] = [];
  mesh: Mesh | null = null;
  size = vec3.fromValues(1, 1, 1); // escala de la malla, solo para dibujar
  color: Color = [1, 1, 1, 1];
  texture: WebGLTexture | null = null;

  add(child: SceneNode): SceneNode {
    this.children.push(child);
    return child;
  }

  // local = T(x, y, z) . Ry(yaw) . Rx(pitch), todo en radianes
  setLocal(x: number, y: number, z: number, yaw = 0, pitch = 0): void {
    mat4.fromTranslation(this.local, [x, y, z]);
    mat4.rotateY(this.local, this.local, yaw);
    mat4.rotateX(this.local, this.local, pitch);
  }
}

// Recorre el arbol de arriba hacia abajo calculando las matrices de mundo.
// La raiz no tiene padre, su mundo es su local.
export function updateWorld(node: SceneNode, parentWorld?: mat4): void {
  if (parentWorld) mat4.multiply(node.world, parentWorld, node.local);
  else mat4.copy(node.world, node.local);
  for (const child of node.children) updateWorld(child, node.world);
}

const model = mat4.create();

// Dibuja el nodo y todos sus hijos (las matrices de mundo ya deben estar al dia)
export function drawNode(gl: WebGL2RenderingContext, ff: FixedFunction, node: SceneNode): void {
  if (node.mesh) {
    mat4.scale(model, node.world, node.size); // modelo = mundo . escala
    drawMesh(gl, ff, node.mesh, model, node.color, node.texture);
  }
  for (const child of node.children) drawNode(gl, ff, child);
}
