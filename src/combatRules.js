import { pointInPolygon } from './albertaMap.js';
import { findBlockingFence, getFenceSegment, distanceToSegment } from './fenceBarrier.js';

export function isInAlberta(x, z) {
  return pointInPolygon(x, z);
}

/** True when an enemy is pounding a ranch fence (shootable before they enter Alberta). */
export function isAttackingBarrier(enemy, game) {
  const combat = game.combat;
  const targetBuilding = combat.findTargetBuilding(enemy);
  if (!targetBuilding) return false;

  const goal = combat.buildingWorldPos(targetBuilding);
  const fence = findBlockingFence(enemy.mesh.position, goal, game.buildings, game.grid);
  if (!fence) return false;

  const seg = getFenceSegment(fence, game.grid);
  const dist = distanceToSegment(enemy.mesh.position.x, enemy.mesh.position.z, seg);
  return dist < (enemy.range ?? 1) + 0.55;
}

/** Defenders may only fire once invaders are inside Alberta, or while breaking a fence. */
export function canEngageEnemy(enemy, game) {
  const { x, z } = enemy.mesh.position;
  if (isInAlberta(x, z)) return true;
  return isAttackingBarrier(enemy, game);
}
