// Carga de texturas (Gabriel). Basado en createTexture de lab/05_texture_webgl.
// Es la funcion que usa todo el equipo (tambien Angel para la fuente y los billboards).
//
//   const tex = await loadTexture(gl, url);                        // LINEAR, sin repetir
//   const pixel = await loadTexture(gl, fuenteUrl, { filter: gl.NEAREST });
//   const pared = await loadTexture(gl, maderaUrl, { repeat: true });
//
// Para usarla al dibujar: gl.bindTexture(gl.TEXTURE_2D, tex) (la unidad activa es
// TEXTURE_UNIT) y ff.enable(TEXTURE_2D). drawMesh ya lo hace si le pasas la textura.
import { TEXTURE_UNIT } from '../vendor/ff/ff';

export type TextureOptions = {
  filter?: number; // gl.LINEAR (por defecto) o gl.NEAREST (pixel art, fuentes)
  repeat?: boolean; // true: gl.REPEAT, false: CLAMP_TO_EDGE (por defecto)
};

export async function loadTexture(
  gl: WebGL2RenderingContext,
  url: string,
  options: TextureOptions = {},
): Promise<WebGLTexture> {
  const filter = options.filter ?? gl.LINEAR;
  const wrap = options.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;

  const image = new Image();
  image.src = url;
  await image.decode(); // espera a que la imagen termine de cargar

  gl.activeTexture(gl.TEXTURE0 + TEXTURE_UNIT); // FF solo lee esta unidad
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // la imagen empieza por arriba pero en GL t = 0 es abajo, hay que voltearla.
  // Es estado global: se queda prendido para todas las texturas.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  // sin mipmaps el MIN_FILTER por defecto da negro, por eso lo ponemos siempre
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  return texture;
}
