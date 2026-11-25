// Skybox (Gabriel): una esfera enorme con la textura del cielo, vista desde adentro.
// Se dibuja primero, sin luz, sin escribir profundidad y centrada en la camara,
// asi parece infinitamente lejos y todo lo demas se dibuja encima.
// Como la vemos por dentro, los triangulos estan "al reves": en vez de descartar
// las caras de atras descartamos las de adelante (cullFace FRONT).
import { mat4, vec3 } from 'gl-matrix';
import { COLOR_WHITE } from '../constants';
import type { Mesh } from '../geometry/mesh';
import { LIGHTING, TEXTURE_2D } from '../vendor/ff/ff';
import type { FixedFunction } from '../vendor/ff/ff';
import { cameraEye } from './camera';

const SKY_RADIUS = 500; // menor que el far de la camara (1200)

const model = mat4.create();
const scaling = vec3.fromValues(SKY_RADIUS, SKY_RADIUS, SKY_RADIUS);

export function drawSkybox(gl: WebGL2RenderingContext, ff: FixedFunction, sphere: Mesh, sky: WebGLTexture): void {
  ff.disable(LIGHTING); // el cielo tiene su propia luz
  ff.enable(TEXTURE_2D);
  ff.setColor(COLOR_WHITE);
  gl.bindTexture(gl.TEXTURE_2D, sky);

  mat4.fromTranslation(model, cameraEye());
  mat4.scale(model, model, scaling);
  ff.setModelMatrix(model);

  gl.depthMask(false);
  gl.cullFace(gl.FRONT);
  gl.bindVertexArray(sphere.vao);
  ff.drawElements(gl.TRIANGLES, sphere.indexCount, gl.UNSIGNED_SHORT, 0);
  gl.cullFace(gl.BACK);
  gl.depthMask(true);

  ff.enable(LIGHTING);
}
