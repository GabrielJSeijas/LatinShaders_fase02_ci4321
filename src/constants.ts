// Constantes: canvas, formato del vertice y colores.
// Los vertices se generan en src/geometry/, aqui no hay mallas.

// cielo, #87ceeb
export const CLEAR_COLOR: readonly [number, number, number, number] = [0x87 / 255, 0xce / 255, 0xeb / 255, 1];

// buffer de 1024x768 (4:3). El CSS lo escala, pero el buffer queda igual
export const CANVAS_WIDTH = 1024;
export const CANVAS_HEIGHT = 768;

// todas las mallas usan el mismo vertice intercalado: x, y, z, nx, ny, nz, u, v
export const FLOATS_PER_VERTEX = 8;
export const STRIDE_BYTES = FLOATS_PER_VERTEX * 4; // 8 floats de 4 bytes
export const NORMAL_OFFSET_BYTES = 3 * 4; // la normal empieza despues de x, y, z
export const UV_OFFSET_BYTES = 6 * 4; // las UV (u, v) van despues de la normal

// Colores RGBA en [0, 1]. Van como ambient y diffuse del material, asi que el
// lado en sombra sale mas oscuro pero no negro.
type RGBA = readonly [number, number, number, number];

export const COLOR_GROUND: RGBA = [0.42, 0.28, 0.16, 1];
export const COLOR_TURRET: RGBA = [0.22, 0.22, 0.24, 1];
export const COLOR_TARGET: RGBA = [0.85, 0.33, 0.13, 1];
export const COLOR_PROJECTILE: RGBA = [0.05, 0.05, 0.05, 1]; // no 0 puro, si no no se ve el volumen
export const COLOR_POWER_ON: RGBA = [0.45, 0.95, 0.4, 1];
export const COLOR_POWER_OFF: RGBA = [0.1, 0.28, 0.1, 1];
export const COLOR_PREVIEW: RGBA = [1, 1, 1, 1]; // la linea va sin luz
export const COLOR_WHITE: RGBA = [1, 1, 1, 1]; // material blanco: la textura se ve sin tenir
export const COLOR_GROUND_MARK: RGBA = [0.56, 0.40, 0.24, 1];

// Explosion del easter egg. Se dibuja sin luz, con setColor, entonces este es el
// color que se ve tal cual (el fuego no deberia tener sombra).
export const COLOR_BLAST_FLASH: RGBA = [1, 0.95, 0.75, 1];
export const COLOR_BLAST_PARTICLES: readonly RGBA[] = [
  [1, 0.85, 0.3, 1], // amarillo
  [1, 0.55, 0.12, 1], // naranja
  [0.85, 0.22, 0.08, 1], // rojo
  [0.35, 0.33, 0.33, 1], // humo
];

// Colores del tanque (tecla V). Se multiplican por la textura camo (gris/blanca),
// asi que el camo queda tenido de ese color.
export const TANK_COLORS: readonly RGBA[] = [
  [0.55, 0.75, 0.45, 1], // verde
  [0.85, 0.7, 0.35, 1], // arena
  [0.45, 0.6, 0.9, 1], // azul
  [0.9, 0.4, 0.35, 1], // rojo
];
