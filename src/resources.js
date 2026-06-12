export const BUILDING_DEFS = {
  hq: {
    id: 'hq',
    name: 'Alberta Legislature',
    description: 'The heart of your prairie empire. Upgrade to boost capacity and unlock stronger buildings.',
    size: 3,
    cost: {},
    produces: null,
    rate: 0,
    color: 0x003f87,
    accent: 0xf2cd00,
    maxLevel: 3,
    baseHp: 480,
  },
  oil_rig: {
    id: 'oil_rig',
    name: 'Oil Rig',
    description: 'Pumps black gold from the Alberta sands.',
    size: 2,
    cost: { oil: 150 },
    produces: 'oil',
    rate: 8,
    color: 0x2a2a2a,
    accent: 0xff6600,
    maxLevel: 3,
    baseHp: 200,
  },
  wheat_farm: {
    id: 'wheat_farm',
    name: 'Wheat Farm',
    description: 'Golden prairie wheat fields.',
    size: 2,
    cost: { wheat: 100 },
    produces: 'wheat',
    rate: 10,
    color: 0xc4a035,
    accent: 0xf2cd00,
    maxLevel: 3,
    baseHp: 180,
  },
  lumber_mill: {
    id: 'lumber_mill',
    name: 'Lumber Mill',
    description: 'Processes timber from the boreal forest. Build only on forest tiles.',
    size: 2,
    cost: { lumber: 120 },
    produces: 'lumber',
    rate: 7,
    color: 0x5c3d2e,
    accent: 0x4a7c3f,
    maxLevel: 3,
    baseHp: 200,
  },
  grain_silo: {
    id: 'grain_silo',
    name: 'Grain Silo',
    description: 'Stores surplus wheat.',
    size: 1,
    cost: { wheat: 200 },
    produces: null,
    rate: 0,
    color: 0xcccccc,
    accent: 0xf2cd00,
    storageBonus: { wheat: 500 },
    maxLevel: 2,
    baseHp: 140,
  },
  oil_depot: {
    id: 'oil_depot',
    name: 'Oil Storage Depot',
    description: 'Tank farm for surplus crude — expands oil capacity.',
    size: 2,
    cost: { oil: 220, lumber: 80 },
    produces: null,
    rate: 0,
    color: 0x3a3a3a,
    accent: 0xff6600,
    storageBonus: { oil: 800 },
    maxLevel: 2,
    baseHp: 160,
  },
  rcmp_post: {
    id: 'rcmp_post',
    name: 'RCMP Outpost',
    description: 'Automatically deploys Mounties to patrol and fight raiders.',
    size: 2,
    cost: { oil: 250, lumber: 150 },
    produces: null,
    rate: 0,
    color: 0xcc0000,
    accent: 0xf2cd00,
    autoTrains: 'mountie',
    maxLevel: 2,
    baseHp: 240,
  },
  fence: {
    id: 'fence',
    name: 'Ranch Fence',
    description: 'Blocks raider paths — drag to draw a line, R to rotate, F to toggle build mode. Rebuilds free after raids.',
    size: 1,
    rotatable: true,
    barrier: true,
    barrierHp: 60,
    cost: { lumber: 50 },
    produces: null,
    rate: 0,
    color: 0x8b6914,
    accent: 0x6b4423,
    maxLevel: 3,
  },
  lookout: {
    id: 'lookout',
    name: 'Mountain Lookout',
    description: 'Rocky Mountain watchtower with ranged defense. Burns oil to run.',
    size: 1,
    cost: { oil: 180, lumber: 100 },
    produces: null,
    rate: 0,
    color: 0x6b6b6b,
    accent: 0x003f87,
    defense: 50,
    upkeep: { oil: 2.5 },
    defenseOilCost: 6,
    maxLevel: 3,
    baseHp: 150,
  },
  air_wing: {
    id: 'air_wing',
    name: 'Cold Lake Air Wing',
    description: 'Train CF-18 fighters. Jets only engage invaders inside Alberta.',
    size: 2,
    cost: { oil: 400, lumber: 200, wheat: 150 },
    produces: null,
    rate: 0,
    color: 0x556677,
    accent: 0xcc0000,
    trains: 'fighter',
    maxLevel: 2,
    baseHp: 220,
  },
};

export const HQ_UPGRADE_COSTS = {
  2: { oil: 500, wheat: 500, lumber: 500 },
  3: { oil: 1200, wheat: 1200, lumber: 1200 },
};

const RESOURCE_ICONS = { oil: '🛢️', wheat: '🌾', lumber: '🌲' };

export function formatCost(cost) {
  return Object.entries(cost)
    .map(([k, v]) => `${v}${RESOURCE_ICONS[k] ?? k}`)
    .join(' ');
}

export function getUpgradeCost(building) {
  const def = BUILDING_DEFS[building.type];
  const level = building.level ?? 1;
  if (level >= (def.maxLevel ?? 3)) return null;

  const scaled = {};
  for (const [key, val] of Object.entries(def.cost)) {
    scaled[key] = Math.floor(val * (0.6 + level * 0.5));
  }
  if (Object.keys(scaled).length === 0) {
    return { oil: 200 * level, wheat: 200 * level, lumber: 200 * level };
  }
  return scaled;
}

export function getEffectiveRate(building) {
  const def = BUILDING_DEFS[building.type];
  if (!def.produces || !def.rate) return 0;
  const level = building.level ?? 1;
  return def.rate * (1 + (level - 1) * 0.5);
}

export function getEffectiveDefense(building) {
  const def = BUILDING_DEFS[building.type];
  if (!def.defense) return 0;
  return def.defense * (building.level ?? 1);
}

export function getEffectiveUpkeep(building) {
  const def = BUILDING_DEFS[building.type];
  if (!def?.upkeep) return null;
  const level = building.level ?? 1;
  const upkeep = {};
  for (const [key, rate] of Object.entries(def.upkeep)) {
    upkeep[key] = rate * level;
  }
  return upkeep;
}

export function getBuildingHp(building) {
  const def = BUILDING_DEFS[building.type];
  if (!def) return 0;
  const level = building.level ?? 1;
  if (def.barrier) {
    return (def.barrierHp ?? 50) * level;
  }
  const base = def.baseHp ?? 150;
  return Math.floor(base * (1 + (level - 1) * 0.4));
}

export function getBarrierHp(building) {
  return getBuildingHp(building);
}

export class ResourceManager {
  constructor() {
    this.resources = { oil: 600, wheat: 600, lumber: 600 };
    this.capacity = { oil: 2000, wheat: 2000, lumber: 2000 };
    this.hqLevel = 1;
    this.listeners = [];
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  notify() {
    for (const fn of this.listeners) fn(this.resources, this.capacity, this.hqLevel);
  }

  canAfford(cost) {
    for (const [key, amount] of Object.entries(cost)) {
      if ((this.resources[key] ?? 0) < amount) return false;
    }
    return true;
  }

  spend(cost) {
    if (!this.canAfford(cost)) return false;
    for (const [key, amount] of Object.entries(cost)) {
      this.resources[key] -= amount;
    }
    this.notify();
    return true;
  }

  add(resource, amount) {
    const cap = this.capacity[resource] ?? Infinity;
    this.resources[resource] = Math.min(cap, (this.resources[resource] ?? 0) + amount);
    this.notify();
  }

  addCapacity(bonuses) {
    for (const [key, amount] of Object.entries(bonuses)) {
      this.capacity[key] = (this.capacity[key] ?? 2000) + amount;
    }
    this.notify();
  }

  removeCapacity(bonuses) {
    for (const [key, amount] of Object.entries(bonuses)) {
      const next = Math.max(500, (this.capacity[key] ?? 2000) - amount);
      this.capacity[key] = next;
      this.resources[key] = Math.min(next, this.resources[key] ?? 0);
    }
    this.notify();
  }

  upgradeHQ() {
    const next = this.hqLevel + 1;
    const cost = HQ_UPGRADE_COSTS[next];
    if (!cost || !this.canAfford(cost)) return false;
    this.spend(cost);
    this.hqLevel = next;
    for (const key of Object.keys(this.capacity)) {
      this.capacity[key] += 1000;
    }
    this.notify();
    return true;
  }

  tickProducers(buildings, dt, getRate) {
    for (const b of buildings) {
      const def = BUILDING_DEFS[b.type];
      if (!def?.produces) continue;
      const rate = getRate ? getRate(b) : def.rate;
      if (rate > 0) this.add(def.produces, rate * dt);
    }
  }

  tickUpkeep(buildings, dt) {
    let changed = false;
    for (const b of buildings) {
      const def = BUILDING_DEFS[b.type];
      if (!def?.upkeep) continue;
      const level = b.level ?? 1;
      for (const [resource, rate] of Object.entries(def.upkeep)) {
        const drain = rate * level * dt;
        if (drain <= 0) continue;
        const prev = this.resources[resource] ?? 0;
        this.resources[resource] = Math.max(0, prev - drain);
        if (this.resources[resource] !== prev) changed = true;
      }
    }
    if (changed) this.notify();
  }
}
