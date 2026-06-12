/** Invisible combat buffer — keeps enemies outside buildings so they stay visible. */

export function getBuildingAttackRadius(size, level = 1) {
  const levelScale = 1 + (level - 1) * 0.08;
  return (size * 0.52 + 0.65) * levelScale;
}

/** Closest point on the buffer ring where a unit should stand to attack. */
export function getApproachPoint(bx, bz, ux, uz, radius) {
  const dx = ux - bx;
  const dz = uz - bz;
  const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
  return {
    x: bx + (dx / dist) * radius,
    z: bz + (dz / dist) * radius,
  };
}
