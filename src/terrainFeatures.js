import {
  GRID_COLS,
  GRID_ROWS,
  ALBERTA_HALF_X,
  ALBERTA_HALF_Z,
  ALBERTA_SHAPE,
  CELL,
  pointInPolygon,
} from './albertaMap.js';

export const TERRAIN_TYPES = {
  prairie: {
    id: 'prairie',
    label: 'Prairie',
    buildable: true,
    loggingOnly: false,
    tileColor: null,
    gridTint: 0xf2cd00,
    gridOpacity: 0.08,
  },
  lake: {
    id: 'lake',
    label: 'Lake',
    buildable: false,
    loggingOnly: false,
    tileColor: 0x3a7ab8,
    gridTint: 0x4488cc,
    gridOpacity: 0.15,
  },
  forest: {
    id: 'forest',
    label: 'Boreal Forest',
    buildable: true,
    loggingOnly: true,
    tileColor: 0x3d6b35,
    gridTint: 0x5a9a48,
    gridOpacity: 0.12,
  },
  mountain: {
    id: 'mountain',
    label: 'Mountains',
    buildable: false,
    loggingOnly: false,
    tileColor: 0x5a5a52,
    gridTint: 0x888877,
    gridOpacity: 0.1,
  },
};

/** Lakes & forest patches — normalised to grid 0–1. */
const LAKE_PATCHES = [
  { nx: 0.22, nz: 0.18, rx: 0.07, rz: 0.05 },
  { nx: 0.58, nz: 0.38, rx: 0.06, rz: 0.04 },
  { nx: 0.38, nz: 0.55, rx: 0.05, rz: 0.06 },
  { nx: 0.72, nz: 0.48, rx: 0.04, rz: 0.05 },
  { nx: 0.48, nz: 0.72, rx: 0.055, rz: 0.04 },
  { nx: 0.15, nz: 0.42, rx: 0.035, rz: 0.035 },
];

const FOREST_PATCHES = [
  { nx: 0.5, nz: 0.12, rx: 0.22, rz: 0.14 },
  { nx: 0.28, nz: 0.08, rx: 0.12, rz: 0.08 },
  { nx: 0.78, nz: 0.15, rx: 0.1, rz: 0.1 },
  { nx: 0.62, nz: 0.22, rx: 0.08, rz: 0.07 },
];

function hash2(gx, gz) {
  const s = Math.sin(gx * 127.1 + gz * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function gridToWorld(gx, gz) {
  return {
    x: gx * CELL - ALBERTA_HALF_X + CELL / 2,
    z: gz * CELL - ALBERTA_HALF_Z + CELL / 2,
  };
}

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) {
    const ex = px - ax;
    const ez = pz - az;
    return Math.sqrt(ex * ex + ez * ez);
  }
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * dx;
  const qz = az + t * dz;
  const ex = px - qx;
  const ez = pz - qz;
  return Math.sqrt(ex * ex + ez * ez);
}

function distToRockies(x, z) {
  const segs = [
    [ALBERTA_SHAPE[4], ALBERTA_SHAPE[0]],
    [ALBERTA_SHAPE[4], ALBERTA_SHAPE[3]],
  ];
  let min = Infinity;
  for (const [a, b] of segs) {
    const d = distToSegment(x, z, a.x, a.y, b.x, b.y);
    if (d < min) min = d;
  }
  return min;
}

function inEllipse(nx, nz, cx, cz, rx, rz) {
  const dx = (nx - cx) / rx;
  const dz = (nz - cz) / rz;
  return dx * dx + dz * dz <= 1;
}

export function classifyAlbertaCell(gx, gz, x, z) {
  const nx = gx / GRID_COLS;
  const nz = gz / GRID_ROWS;

  if (distToRockies(x, z) < 2.2) return 'mountain';

  for (const lake of LAKE_PATCHES) {
    if (inEllipse(nx, nz, lake.nx, lake.nz, lake.rx, lake.rz)) return 'lake';
  }

  if (nz < 0.28 && hash2(gx, gz) > 0.18) return 'forest';
  for (const patch of FOREST_PATCHES) {
    if (inEllipse(nx, nz, patch.nx, patch.nz, patch.rx, patch.rz) && hash2(gx + 3, gz + 7) > 0.22) {
      return 'forest';
    }
  }
  if (hash2(gx + 19, gz + 41) > 0.93 && nz > 0.15 && nz < 0.55) return 'forest';

  return 'prairie';
}

export function getAlbertaCellTerrain(gx, gz) {
  const { x, z } = gridToWorld(gx, gz);
  if (!pointInPolygon(x, z)) return null;
  return classifyAlbertaCell(gx, gz, x, z);
}

export function buildTerrainGrid() {
  const grid = [];
  for (let gz = 0; gz < GRID_ROWS; gz++) {
    const row = [];
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const { x, z } = gridToWorld(gx, gz);
      row.push(pointInPolygon(x, z) ? classifyAlbertaCell(gx, gz, x, z) : null);
    }
    grid.push(row);
  }
  return grid;
}

export function getTerrainAtGrid(gx, gz, terrainGrid) {
  if (gx < 0 || gz < 0 || gx >= GRID_COLS || gz >= GRID_ROWS) return null;
  return terrainGrid[gz]?.[gx] ?? null;
}

export function canBuildOnTerrain(terrainId, buildingType) {
  if (!terrainId) return false;
  const t = TERRAIN_TYPES[terrainId];
  if (!t?.buildable) return false;
  if (t.loggingOnly && buildingType !== 'lumber_mill') return false;
  if (buildingType === 'lumber_mill' && terrainId !== 'forest') return false;
  return true;
}

export function getTerrainBlockReason(terrainId, buildingType) {
  if (!terrainId) return 'Outside Alberta';
  const t = TERRAIN_TYPES[terrainId];
  if (!t.buildable) {
    if (terrainId === 'lake') return 'Cannot build on lakes';
    if (terrainId === 'mountain') return 'Cannot build in the mountains';
    return `Cannot build on ${t.label}`;
  }
  if (buildingType === 'lumber_mill' && terrainId !== 'forest') {
    return 'Lumber mills need boreal forest';
  }
  if (t.loggingOnly && buildingType !== 'lumber_mill') {
    return 'Boreal forest — lumber mills only';
  }
  return null;
}

/** Dense sample points along the Rockies border (Alberta side). */
export function getRockiesBorderSamples(step = 0.45) {
  const pts = [];
  for (const [ai, bi] of [
    [4, 0],
    [4, 3],
  ]) {
    const a = ALBERTA_SHAPE[ai];
    const b = ALBERTA_SHAPE[bi];
    const len = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const n = Math.ceil(len / step);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t;
      const z = a.y + (b.y - a.y) * t;
      const nx = b.x - a.x;
      const nz = b.y - a.y;
      const len2 = Math.sqrt(nx * nx + nz * nz) || 1;
      pts.push({
        x: x - (nx / len2) * 0.55,
        z: z - (nz / len2) * 0.55,
        along: t,
        nx,
        nz,
      });
    }
  }
  return pts;
}
