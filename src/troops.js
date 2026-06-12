export const MAX_MOUNTIES_PER_POST = 10;

export function getAutoTrainInterval(troopDef, buildingLevel = 1) {
  return troopDef.trainTime / (1 + (buildingLevel - 1) * 0.35);
}

export const TROOP_DEFS = {
  mountie: {
    name: 'Mountie',
    hp: 90,
    damage: 18,
    speed: 4.5,
    range: 1.2,
    cost: { wheat: 50, oil: 30 },
    trainTime: 4,
    building: 'rcmp_post',
    icon: '⭐',
  },
  fighter: {
    name: 'CF-18 Fighter',
    hp: 70,
    damage: 28,
    speed: 14,
    patrolSpeed: 8,
    range: 18,
    flyHeight: 8,
    bombDamage: 55,
    bombRadius: 3.8,
    bombsPerRun: 4,
    cost: { oil: 50, wheat: 30 },
    trainTime: 6,
    building: 'air_wing',
    icon: '✈️',
  },
};
