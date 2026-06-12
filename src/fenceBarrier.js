/** Ranch fence line geometry — blocks movement across the fence, not along it. */

const HALF_LEN = 0.42;

export function getFenceSegment(building, grid) {
  const { x, z } = grid.gridToWorld(building.gx, building.gz, building.size);
  const rot = ((building.rotation ?? 0) % 4 + 4) % 4;

  if (rot % 2 === 0) {
    return { ax: x - HALF_LEN, az: z, bx: x + HALF_LEN, bz: z, cx: x, cz: z, rot };
  }
  return { ax: x, az: z - HALF_LEN, bx: x, bz: z + HALF_LEN, cx: x, cz: z, rot };
}

function cross2d(ax, az, bx, bz, cx, cz) {
  return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}

/** True if segments AB and CD intersect (excluding shared endpoints). */
export function segmentsIntersect(ax, az, bx, bz, cx, cz, dx, dz) {
  const d1 = cross2d(cx, cz, dx, dz, ax, az);
  const d2 = cross2d(cx, cz, dx, dz, bx, bz);
  const d3 = cross2d(ax, az, bx, bz, cx, cz);
  const d4 = cross2d(ax, az, bx, bz, dx, dz);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

export function segmentIntersection(ax, az, bx, bz, cx, cz, dx, dz) {
  const denom = (ax - bx) * (cz - dz) - (az - bz) * (cx - dx);
  if (Math.abs(denom) < 1e-9) return null;

  const t = ((ax - cx) * (cz - dz) - (az - cz) * (cx - dx)) / denom;
  const u = -((ax - bx) * (az - cz) - (az - bz) * (ax - cx)) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;

  return { x: ax + t * (bx - ax), z: az + t * (bz - az), t };
}

export function distanceToSegment(px, pz, seg) {
  const dx = seg.bx - seg.ax;
  const dz = seg.bz - seg.az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-9) {
    const ex = px - seg.ax;
    const ez = pz - seg.az;
    return Math.sqrt(ex * ex + ez * ez);
  }
  let t = ((px - seg.ax) * dx + (pz - seg.az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const qx = seg.ax + t * dx;
  const qz = seg.az + t * dz;
  const ex = px - qx;
  const ez = pz - qz;
  return Math.sqrt(ex * ex + ez * ez);
}

export function isFenceIntact(building) {
  return building.type === 'fence' && (building.hp ?? 0) > 0;
}

/** Fence on the direct path from unit to goal. */
export function findBlockingFence(from, to, buildings, grid) {
  let best = null;
  let bestDist = Infinity;

  for (const building of buildings) {
    if (!isFenceIntact(building)) continue;

    const seg = getFenceSegment(building, grid);
    if (!segmentsIntersect(from.x, from.z, to.x, to.z, seg.ax, seg.az, seg.bx, seg.bz)) continue;

    const d = distanceToSegment(from.x, from.z, seg);
    if (d < bestDist) {
      bestDist = d;
      best = building;
    }
  }
  return best;
}

/** Fence crossed by a movement step. */
export function findFenceCrossing(ax, az, bx, bz, buildings, grid) {
  let hit = null;
  let bestT = Infinity;

  for (const building of buildings) {
    if (!isFenceIntact(building)) continue;

    const seg = getFenceSegment(building, grid);
    const cross = segmentIntersection(ax, az, bx, bz, seg.ax, seg.az, seg.bx, seg.bz);
    if (!cross || cross.t >= bestT) continue;

    bestT = cross.t;
    hit = { fence: building, x: cross.x, z: cross.z, t: cross.t };
  }
  return hit;
}

/** Stand just on the attacker's side of the fence line. */
export function getFenceApproachPoint(seg, ux, uz, standOff = 0.55) {
  const midX = (seg.ax + seg.bx) * 0.5;
  const midZ = (seg.az + seg.bz) * 0.5;

  if (seg.rot % 2 === 0) {
    return {
      x: Math.max(seg.ax, Math.min(seg.bx, ux)),
      z: midZ + (uz < midZ ? -standOff : standOff),
    };
  }
  return {
    x: midX + (ux < midX ? -standOff : standOff),
    z: Math.max(seg.az, Math.min(seg.bz, uz)),
  };
}
