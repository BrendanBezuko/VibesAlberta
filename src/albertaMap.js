import * as THREE from 'three';

/** Rectangular map — Alberta is taller north–south than east–west (like the real province). */
export const BORDER_WIDTH = 2;
export const ALBERTA_HALF_X = 16;
export const ALBERTA_HALF_Z = 28;
export const MAP_HALF_X = ALBERTA_HALF_X + BORDER_WIDTH;
export const MAP_HALF_Z = ALBERTA_HALF_Z + BORDER_WIDTH;
export const CELL = 1;
export const GRID_COLS = ALBERTA_HALF_X * 2;
export const GRID_ROWS = ALBERTA_HALF_Z * 2;

/** @deprecated use ALBERTA_HALF_X / ALBERTA_HALF_Z */
export const ALBERTA_HALF = ALBERTA_HALF_X;
/** @deprecated use MAP_HALF_X / MAP_HALF_Z */
export const MAP_HALF = Math.max(MAP_HALF_X, MAP_HALF_Z);

/**
 * Alberta silhouette (normalised 0–1).
 * Skinny SW "toe" at nz=1 → south → bottom of screen (+z).
 */
const ALBERTA_NORM = [
  [0.05, 0.03], // NW
  [0.95, 0.03], // NE
  [0.95, 0.97], // SE
  [0.36, 0.97], // SW toe (bottom)
  [0.05, 0.40], // 120°W pivot
];

export const ALBERTA_SHAPE = ALBERTA_NORM.map(
  ([nx, nz]) =>
    new THREE.Vector2(
      -ALBERTA_HALF_X + nx * ALBERTA_HALF_X * 2,
      -ALBERTA_HALF_Z + nz * ALBERTA_HALF_Z * 2
    )
);

export const REGIONS = {
  alberta: { name: 'Alberta', color: 0x6b9a4a },
  bc: { name: 'British Columbia', color: 0x2d5a3d, rock: 0x5a5a5a },
  saskatchewan: { name: 'Saskatchewan', color: 0xd4b84a },
  nwt: { name: 'Northwest Territories', color: 0xb8d4e8 },
  montana: { name: 'Montana (USA)', color: 0xa89070 },
};

export function pointInPolygon(x, z, polygon = ALBERTA_SHAPE) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].y;
    const xj = polygon[j].x;
    const zj = polygon[j].y;
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isWestOfRockies(x, z) {
  const ax = ALBERTA_SHAPE[4].x;
  const az = ALBERTA_SHAPE[4].y;
  const bx = ALBERTA_SHAPE[3].x;
  const bz = ALBERTA_SHAPE[3].y;
  return (bx - ax) * (z - az) - (bz - az) * (x - ax) > 0;
}

export function getRegionAt(x, z) {
  if (Math.abs(x) > MAP_HALF_X || Math.abs(z) > MAP_HALF_Z) return 'wilderness';
  if (pointInPolygon(x, z)) return 'alberta';
  if (z < -ALBERTA_HALF_Z) return 'nwt';
  if (z > ALBERTA_HALF_Z) return 'montana';
  if (x > ALBERTA_HALF_X) return 'saskatchewan';
  if (x < -ALBERTA_HALF_X || isWestOfRockies(x, z)) return 'bc';

  const northZ = ALBERTA_SHAPE[0].y;
  const eastX = ALBERTA_SHAPE[1].x;
  const southZ = ALBERTA_SHAPE[3].y;
  if (x > eastX - CELL * 0.5) return 'saskatchewan';
  if (z < northZ + CELL * 0.5) return 'nwt';
  if (z > southZ - CELL * 0.5) return 'montana';
  return 'bc';
}

export function isPlayableAt(x, z) {
  return pointInPolygon(x, z);
}

export function buildAlbertaMask() {
  const mask = [];

  for (let gz = 0; gz < GRID_ROWS; gz++) {
    const row = [];
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const x = gx * CELL - ALBERTA_HALF_X + CELL / 2;
      const z = gz * CELL - ALBERTA_HALF_Z + CELL / 2;
      row.push(pointInPolygon(x, z));
    }
    mask.push(row);
  }
  return mask;
}

export function getGridOffset() {
  return { x: 0, z: 0 };
}

export function getSaskatchewanSpawn() {
  const x = ALBERTA_HALF_X + BORDER_WIDTH * 0.5 + Math.random() * 0.8;
  return { x, z: (Math.random() - 0.5) * ALBERTA_HALF_Z * 1.6 };
}

export function getNWTSpawn() {
  const z = -(ALBERTA_HALF_Z + BORDER_WIDTH * 0.5 + Math.random() * 0.8);
  return { x: (Math.random() - 0.5) * ALBERTA_HALF_X * 1.4, z };
}

export function getBcSpawn() {
  const x = -(ALBERTA_HALF_X + BORDER_WIDTH * 0.5 + Math.random() * 0.8);
  return { x, z: (Math.random() - 0.5) * ALBERTA_HALF_Z * 1.4 };
}

export function getMontanaSpawn() {
  const z = ALBERTA_HALF_Z + BORDER_WIDTH * 0.5 + Math.random() * 0.8;
  return { x: (Math.random() - 0.5) * ALBERTA_HALF_X * 1.6, z };
}

export function getBcRockWallPoints() {
  const pts = [];
  for (const [ai, bi] of [
    [4, 0],
    [3, 4],
  ]) {
    const a = ALBERTA_SHAPE[ai];
    const b = ALBERTA_SHAPE[bi];
    for (let s = 0; s <= 10; s++) {
      const t = s / 10;
      pts.push({
        x: a.x + (b.x - a.x) * t - 0.85,
        z: a.y + (b.y - a.y) * t,
      });
    }
  }
  return pts;
}

export function makeRegionLabel(text, color = '#ffffff') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,30,60,0.75)';
  ctx.fillRect(8, 20, 496, 88);
  ctx.font = 'bold 48px system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);

  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(4.5, 1.1, 1);
  return sprite;
}
