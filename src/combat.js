import * as THREE from 'three';
import {
  createMountie,
  createRaider,
  createPolarBear,
  createBcRat,
  createBorderRunner,
  createFighterJet,
} from './albertaUnits.js';
import {
  getSaskatchewanSpawn,
  getNWTSpawn,
  getBcSpawn,
  getMontanaSpawn,
} from './albertaMap.js';
import { getBuildingAttackRadius, getApproachPoint } from './forceField.js';
import {
  findBlockingFence,
  findFenceCrossing,
  getFenceApproachPoint,
  getFenceSegment,
  distanceToSegment,
} from './fenceBarrier.js';
import { isInAlberta } from './combatRules.js';
import { TROOP_DEFS, getAutoTrainInterval, MAX_MOUNTIES_PER_POST } from './troops.js';
import { BUILDING_DEFS, formatCost } from './resources.js';
import { updateBuildingHpBar } from './buildingHealth.js';
import {
  initFighterState,
  flyToward,
  dropBomb,
  updateBombs as tickBombs,
  spawnExplosion,
  updateExplosions,
} from './fighterBomber.js';

export { TROOP_DEFS };

export const ENEMY_DEFS = {
  raider: {
    name: 'Saskatchewan Raider',
    hp: 45,
    damage: 10,
    speed: 2.8,
    range: 1.0,
    steal: 40,
    attackRate: 1.2,
    waveHpBonus: 5,
    spawn: getSaskatchewanSpawn,
    create: createRaider,
    hpBarScale: 1,
  },
  polar_bear: {
    name: 'Polar Bear',
    hp: 130,
    damage: 24,
    speed: 2.4,
    range: 1.3,
    steal: 70,
    attackRate: 1.6,
    waveHpBonus: 12,
    spawn: getNWTSpawn,
    create: createPolarBear,
    hpBarScale: 1.25,
  },
  bc_rat: {
    name: 'BC Rat',
    hp: 22,
    damage: 5,
    speed: 5.2,
    range: 0.85,
    steal: 12,
    attackRate: 0.85,
    waveHpBonus: 3,
    spawn: getBcSpawn,
    create: createBcRat,
    hpBarScale: 0.7,
  },
  border_runner: {
    name: 'Border Runner',
    hp: 38,
    damage: 9,
    speed: 3.4,
    range: 1.0,
    steal: 35,
    attackRate: 1.1,
    waveHpBonus: 4,
    spawn: getMontanaSpawn,
    create: createBorderRunner,
    hpBarScale: 1,
  },
};

const WAVE_INTERVAL = 75;

function getWaveScaling(wave) {
  const w = Math.max(1, wave);
  return {
    enemyCount: Math.min(5 + w * 3 + Math.floor(w * w * 0.12), 45),
    hpQuadratic: Math.floor(w * w * 0.2),
    damageBonus: Math.floor(w * 1.5 + w * w * 0.07),
    speedMult: 1 + Math.min(w * 0.03, 0.7),
    attackRateMult: Math.max(0.42, 1 - w * 0.024),
    stealMult: 1 + w * 0.07,
    polarBearChance: Math.min(0.92, 0.1 + w * 0.06),
    polarBearCount: 1 + Math.floor(w / 5),
    bcRatChance: Math.min(0.9, 0.15 + w * 0.05),
    bcRatCount: 1 + Math.floor(w / 3) + (w >= 10 ? 2 : w >= 6 ? 1 : 0),
    runnerChance: Math.min(0.95, 0.22 + w * 0.05),
    runnerCount: 1 + Math.floor(w / 4),
    spawnDelayMult: Math.max(0.5, 1 - w * 0.014),
    nextRaidInterval: Math.max(40, WAVE_INTERVAL - Math.floor(w * 2)),
  };
}

export class CombatSystem {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.troops = [];
    this.fighters = [];
    this.raiders = [];
    this.wave = 0;
    this.waveTimer = WAVE_INTERVAL;
    this.waveInterval = WAVE_INTERVAL;
    this.raidActive = false;
    this.training = [];
    this.projectiles = [];
    this.bombs = [];
    this.explosions = [];
    this.deathParticles = [];
    this._trainingUiTimer = 0;
    this._cachesStale = true;
    this._vFrom = new THREE.Vector3();
    this._vTo = new THREE.Vector3();
    this._vDir = new THREE.Vector3();
    this._vNext = new THREE.Vector3();
  }

  invalidateCaches() {
    this._cachesStale = true;
  }

  refreshCombatCaches() {
    if (this._cachesStale || !this._nonHqTargets) {
      this._nonHqTargets = [];
      this._hqTarget = null;
      this._buildingPosById = new Map();
      for (const b of this.game.buildings) {
        const pos = this.buildingWorldPos(b);
        this._buildingPosById.set(b.id, pos);
        if (b.type === 'hq') {
          this._hqTarget = { building: b, pos };
        } else {
          this._nonHqTargets.push({ building: b, pos });
        }
      }
      this._cachesStale = false;
    }

    this._raiderTargetBuilding = new Map();
    for (const r of this.raiders) {
      this._raiderTargetBuilding.set(r.id, this.findRaiderBuildingTarget(r));
    }

    this._engageableRaiders = [];
    for (const r of this.raiders) {
      if (this.isRaiderEngageable(r)) this._engageableRaiders.push(r);
    }

    this._combatUnits = this.troops.length || this.fighters.length
      ? this.troops.concat(this.fighters)
      : [];
  }

  findRaiderBuildingTarget(raider) {
    const pos = raider.mesh.position;
    let nearest = null;
    let minDist = Infinity;
    for (const { building, pos: bpos } of this._nonHqTargets ?? []) {
      const d = pos.distanceTo(bpos);
      if (d < minDist) {
        minDist = d;
        nearest = building;
      }
    }
    if (nearest) return nearest;
    return this._hqTarget?.building ?? this.hq ?? null;
  }

  isRaiderEngageable(raider) {
    const { x, z } = raider.mesh.position;
    if (isInAlberta(x, z)) return true;
    const target = this._raiderTargetBuilding?.get(raider.id);
    if (!target) return false;
    const goal = this._buildingPosById?.get(target.id);
    if (!goal) return false;
    const fence = findBlockingFence(raider.mesh.position, goal, this.game.buildings, this.game.grid);
    if (!fence) return false;
    const seg = getFenceSegment(fence, this.game.grid);
    return distanceToSegment(x, z, seg) < (raider.range ?? 1) + 0.55;
  }

  findNearestEngageableRaider(pos, maxRange = Infinity) {
    let nearest = null;
    let minDistSq = maxRange * maxRange;
    for (const r of this._engageableRaiders) {
      const dx = pos.x - r.mesh.position.x;
      const dz = pos.z - r.mesh.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearest = r;
      }
    }
    return nearest;
  }

  countMountiesForBuilding(buildingId) {
    let n = 0;
    for (const t of this.troops) {
      if (t.homeBuildingId === buildingId) n++;
    }
    return n;
  }

  get hq() {
    return this.game.buildings.find((b) => b.type === 'hq');
  }

  update(dt) {
    if (this.game.gameOver) return;
    this.refreshCombatCaches();
    this.updateTraining(dt);
    this.updateAutoTraining(dt);
    this.updateWaveTimer(dt);
    this.updateTroops(dt);
    this.updateFighters(dt);
    this.updateBombs(dt);
    this.updateRaiders(dt);
    this.updateDefenses(dt);
    this.updateProjectiles(dt);
    this.updateExplosionFx(dt);
    this.updateDeathParticles(dt);
  }

  updateWaveTimer(dt) {
    if (this.raidActive || this.game.gameOver) return;
    this.waveTimer -= dt;
    this.game.ui.setRaidTimer(this.waveTimer, this.waveInterval);
    if (this.waveTimer <= 0) {
      this.startRaid();
    }
  }

  triggerRaidNow() {
    if (this.game.gameOver) return false;
    if (this.raidActive) {
      this.game.ui.showToast('Already under attack!', 'warn');
      return false;
    }
    this.startRaid(true);
    return true;
  }

  startRaid(early = false) {
    this.wave++;
    this.raidActive = true;
    const scaling = getWaveScaling(this.wave);
    this.waveTimer = scaling.nextRaidInterval;
    this.waveInterval = scaling.nextRaidInterval;

    if (this.game.placement?.type === 'fence') {
      this.game.cancelPlacement();
      this.game.ui.onPlacementEnd();
    }
    this.game.ui.updateBuildButtons();
    const count = scaling.enemyCount;
    const spawnGap = Math.floor(400 * scaling.spawnDelayMult);

    if (early) {
      this.game.ui.showToast(`⚔️ Early raid! Wave ${this.wave} incoming!`, 'raid');
    } else {
      this.game.ui.showToast(`⚔️ Wave ${this.wave}! Invaders approaching Alberta!`, 'raid');
    }

    let delay = 0;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.spawnEnemy('raider'), delay);
      delay += spawnGap;
    }

    if (Math.random() < scaling.polarBearChance) {
      for (let i = 0; i < scaling.polarBearCount; i++) {
        setTimeout(() => {
          this.spawnEnemy('polar_bear');
          if (i === 0) this.game.ui.showToast('🐻‍❄️ Polar bear coming down from the NWT!', 'warn');
        }, 1500 + i * 900 + Math.random() * 2000);
      }
    }

    if (Math.random() < scaling.bcRatChance) {
      for (let i = 0; i < scaling.bcRatCount; i++) {
        setTimeout(() => {
          this.spawnEnemy('bc_rat');
          if (i === 0) this.game.ui.showToast('🐀 Giant rats sneaking in from BC!', 'warn');
        }, 800 + i * 500 + Math.random() * 1200);
      }
    }

    const runners = Math.random() < scaling.runnerChance
      ? scaling.runnerCount + Math.floor(Math.random() * Math.min(3, 1 + Math.floor(this.wave / 8)))
      : 0;
    for (let i = 0; i < runners; i++) {
      setTimeout(() => {
        this.spawnEnemy('border_runner');
        if (i === 0) this.game.ui.showToast('🏃 Smugglers crossing up from the States!', 'warn');
      }, 1200 + i * 450 + Math.random() * 1500);
    }
  }

  spawnEnemy(type) {
    const def = ENEMY_DEFS[type];
    if (!def) return;

    const pos = def.spawn();
    const mesh = def.create();
    mesh.position.set(pos.x, 0, pos.z);
    this.scene.add(mesh);

    const scaling = getWaveScaling(this.wave);
    const waveBonus = (def.waveHpBonus ?? 0) * this.wave;
    const hp = Math.floor(def.hp + waveBonus + scaling.hpQuadratic);

    const enemy = {
      id: Math.random(),
      mesh,
      type,
      hp,
      maxHp: hp,
      damage: Math.floor(def.damage + scaling.damageBonus),
      speed: def.speed * scaling.speedMult,
      range: def.range,
      attackCooldown: 0,
      steal: Math.floor(def.steal * scaling.stealMult),
      attackRate: (def.attackRate ?? 1.2) * scaling.attackRateMult,
    };
    this.raiders.push(enemy);
    this.addHpBar(mesh, enemy, def.hpBarScale ?? 1);
  }

  makeTroop(type, mesh, extras = {}) {
    const def = TROOP_DEFS[type];
    return {
      id: Math.random(),
      mesh,
      type,
      hp: def.hp,
      maxHp: def.hp,
      damage: def.damage,
      speed: def.speed,
      range: def.range,
      attackCooldown: 0,
      home: null,
      ...extras,
    };
  }

  addHpBar(mesh, unit, yScale = 1) {
    const y = 1.0 * yScale;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.06),
      new THREE.MeshBasicMaterial({ color: 0x330000 })
    );
    bg.position.y = y;
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x44cc44 })
    );
    fill.position.set(0, y, 0.01);
    mesh.add(bg, fill);
    unit.hpBar = fill;
  }

  updateHpBar(unit) {
    if (!unit.hpBar) return;
    const pct = Math.max(0, unit.hp / unit.maxHp);
    unit.hpBar.scale.x = pct;
    unit.hpBar.position.x = -(0.48 * (1 - pct)) / 2;
    unit.hpBar.material.color.setHex(pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xcccc44 : 0xcc4444);
  }

  trainUnit(building, unitType) {
    if (!building) {
      this.game.ui.showToast('Select a building first', 'warn');
      return false;
    }
    const def = TROOP_DEFS[unitType];
    if (!def) {
      this.game.ui.showToast(`Unknown unit type: ${unitType}`, 'warn');
      return false;
    }
    if (def.building !== building.type) {
      const need = BUILDING_DEFS[def.building]?.name ?? def.building;
      this.game.ui.showToast(`Train ${def.name} at a ${need}`, 'warn');
      return false;
    }
    if (!this.game.rm.canAfford(def.cost)) {
      this.game.ui.showToast(`Need ${formatCost(def.cost)} to train`, 'warn');
      return false;
    }
    if (this.getTrainingFor(building).length >= 2) {
      this.game.ui.showToast('This building training queue is full (max 2)', 'warn');
      return false;
    }
    if (this.training.length >= 6) {
      this.game.ui.showToast('Global training queue full — wait for units to deploy.', 'warn');
      return false;
    }
    this.game.rm.spend(def.cost);
    this.training.push({ building, timeLeft: def.trainTime, def, unitType });
    this.game.ui.showToast(`${unitType === 'fighter' ? '✈️' : '⭐'} ${def.name} training started...`, 'info');
    if (this.game.selectedBuilding?.id === building.id) {
      this.game.ui.showBuildingInfo(building);
    }
    return true;
  }

  trainMountie(building) {
    return this.trainUnit(building, 'mountie');
  }

  trainFighter(building) {
    return this.trainUnit(building, 'fighter');
  }

  getTrainingFor(building) {
    return this.training.filter((t) => t.building.id === building.id);
  }

  updateAutoTraining(dt) {
    for (const building of this.game.buildings) {
      const def = BUILDING_DEFS[building.type];
      if (!def?.autoTrains) continue;

      const troopDef = TROOP_DEFS[def.autoTrains];
      if (!troopDef) continue;

      const interval = getAutoTrainInterval(troopDef, building.level ?? 1);
      building._autoTrainTimer = (building._autoTrainTimer ?? 0) + dt;

      if (building._autoTrainTimer < interval) continue;

      if (!this.game.rm.canAfford(troopDef.cost)) continue;
      if (this.countMountiesForBuilding(building.id) >= MAX_MOUNTIES_PER_POST) continue;

      this.game.rm.spend(troopDef.cost);
      this.spawnMountie(building);
      building._autoTrainTimer = 0;

      if (this.game.selectedBuilding?.id === building.id) {
        this.game.ui.refreshBuildingInfo(building);
      }
    }

    this._autoTrainUiTimer = (this._autoTrainUiTimer ?? 0) - dt;
    const sel = this.game.selectedBuilding;
    if (sel && BUILDING_DEFS[sel.type]?.autoTrains && this._autoTrainUiTimer <= 0) {
      this.game.ui.refreshBuildingInfo(sel);
      this._autoTrainUiTimer = 1;
    }
  }

  updateTraining(dt) {
    let queueChanged = false;
    for (let i = this.training.length - 1; i >= 0; i--) {
      const t = this.training[i];
      t.timeLeft -= dt;
      if (t.timeLeft <= 0) {
        if (t.unitType === 'fighter') {
          this.spawnFighter(t.building);
        } else {
          this.spawnMountie(t.building);
        }
        this.training.splice(i, 1);
        queueChanged = true;
        this.game.ui.showToast(`${t.unitType === 'fighter' ? '✈️' : '⭐'} ${t.def.name} deployed!`, 'success');
        if (this.game.selectedBuilding?.id === t.building.id) {
          this.game.ui.showBuildingInfo(t.building);
        }
      }
    }
    this._trainingUiTimer -= dt;
    if (this._trainingUiTimer <= 0 && this.training.length > 0 && this.game.selectedBuilding) {
      const sel = this.game.selectedBuilding;
      if (this.training.some((t) => t.building.id === sel.id)) {
        this.game.ui.refreshBuildingInfo(sel);
        this._trainingUiTimer = 0.4;
      }
    }
  }

  spawnMountie(building) {
    const { x, z } = this.game.grid.gridToWorld(building.gx, building.gz, building.size);
    const mesh = createMountie();
    mesh.position.set(x + (Math.random() - 0.5), 0, z + (Math.random() - 0.5));
    this.scene.add(mesh);

    const troop = this.makeTroop('mountie', mesh, { home: { x, z }, homeBuildingId: building.id });
    this.troops.push(troop);
    this.addHpBar(mesh, troop);
  }

  spawnFighter(building) {
    const { x, z } = this.game.grid.gridToWorld(building.gx, building.gz, building.size);
    const def = TROOP_DEFS.fighter;
    const mesh = createFighterJet();
    mesh.position.set(x + 1.2, def.flyHeight, z);
    mesh.scale.setScalar(1.2);
    this.scene.add(mesh);

    const fighter = this.makeTroop('fighter', mesh, {
      home: { x, z },
      flyHeight: def.flyHeight,
      flight: initFighterState({ x, z }, def.flyHeight),
    });
    this.fighters.push(fighter);
    this.addHpBar(mesh, fighter, 0.6);
  }

  findEnemyCluster(jet, maxRange) {
    const pts = [];
    const maxRangeSq = maxRange * maxRange;
    const jx = jet.mesh.position.x;
    const jz = jet.mesh.position.z;
    for (const r of this._engageableRaiders) {
      const dx = jx - r.mesh.position.x;
      const dz = jz - r.mesh.position.z;
      if (dx * dx + dz * dz <= maxRangeSq) pts.push(r.mesh.position);
    }
    if (pts.length === 0) return null;
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    return { x: cx, z: cz, count: pts.length };
  }

  damageRaidersInRadius(pos, radius, damage) {
    let hits = 0;
    for (const r of this.raiders) {
      const dx = r.mesh.position.x - pos.x;
      const dz = r.mesh.position.z - pos.z;
      if (dx * dx + dz * dz <= radius * radius) {
        this.damageUnit(r, damage);
        hits++;
      }
    }
    return hits;
  }

  updateBombs(dt) {
    const def = TROOP_DEFS.fighter;
    tickBombs(dt, this.bombs, this.scene, (pos, damage) => {
      spawnExplosion(this.scene, this.explosions, pos, def.bombRadius);
      const hits = this.damageRaidersInRadius(pos, def.bombRadius, damage);
      if (hits > 0) {
        this.game.ui.showToast(`💥 Bomb hit — ${hits} enemy${hits > 1 ? 'ies' : ''} damaged!`, 'success');
      }
    });
  }

  updateExplosionFx(dt) {
    updateExplosions(dt, this.explosions, this.scene);
  }

  updateTroops(dt) {
    for (let i = this.troops.length - 1; i >= 0; i--) {
      const troop = this.troops[i];
      if (troop.hp <= 0) {
        this.removeUnit(troop, this.troops, i);
        continue;
      }

      const target = this.findNearestEngageableRaider(troop.mesh.position);
      if (target) {
        this.moveToward(troop, target.mesh.position, dt);
        const dist = troop.mesh.position.distanceTo(target.mesh.position);
        troop.attackCooldown -= dt;
        if (dist < troop.range && troop.attackCooldown <= 0) {
          this.damageUnit(target, troop.damage);
          troop.attackCooldown = 0.8;
          this.bumpAnimation(troop.mesh);
        }
      } else if (troop.home) {
        this.moveToward(troop, new THREE.Vector3(troop.home.x, 0, troop.home.z), dt, 0.5);
      }
      this.updateHpBar(troop);
      this.faceTarget(troop.mesh, target?.mesh.position ?? troop.mesh.position.clone().add(new THREE.Vector3(1, 0, 0)));
    }
  }

  updateFighters(dt) {
    const def = TROOP_DEFS.fighter;
    const bob = (id) => Math.sin(Date.now() * 0.002 + id) * 0.12;

    for (let i = this.fighters.length - 1; i >= 0; i--) {
      const jet = this.fighters[i];
      if (jet.hp <= 0) {
        this.removeUnit(jet, this.fighters, i);
        continue;
      }

      const fp = jet.flight ?? (jet.flight = initFighterState(jet.home ?? { x: 0, z: 0 }, def.flyHeight));
      const pos = jet.mesh.position;
      let turnRate = 0;
      let targetY = def.flyHeight;

      const cluster = this.findEnemyCluster(jet, def.range);

      if (fp.state === 'patrol') {
        fp.patrolAngle += dt * 0.55;
        const orbitR = cluster ? 11 : 8;
        const cx = cluster?.x ?? fp.home.x;
        const cz = cluster?.z ?? fp.home.z;
        const orbit = { x: cx + Math.sin(fp.patrolAngle) * orbitR, z: cz + Math.cos(fp.patrolAngle) * orbitR };
        turnRate = flyToward(jet, orbit, dt, def.patrolSpeed);

        if (cluster) {
          fp.state = 'inbound';
          fp.strikePoint = { x: cluster.x, z: cluster.z };
          fp.bombsLeft = def.bombsPerRun;
          fp.strikeDist = 0;
          fp.bombCooldown = 0.15;
          const dx = pos.x - cluster.x;
          const dz = pos.z - cluster.z;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          fp.approachPoint = { x: cluster.x + (dx / len) * 16, z: cluster.z + (dz / len) * 16 };
        }
      } else if (fp.state === 'inbound') {
        targetY = def.flyHeight - 1.8;
        const aim = fp.approachPoint ?? fp.strikePoint;
        turnRate = flyToward(jet, aim, dt, def.speed);

        const sp = fp.strikePoint;
        if (sp) {
          const dx = pos.x - sp.x;
          const dz = pos.z - sp.z;
          if (dx * dx + dz * dz < 14) {
            fp.state = 'strike';
            fp.strikeDist = 0;
          }
        }

        if (!cluster) {
          fp.state = 'egress';
          fp.egressTimer = 2.5;
        }
      } else if (fp.state === 'strike') {
        targetY = def.flyHeight - 2.5;
        const yaw = jet.mesh.rotation.y;
        pos.x += Math.sin(yaw) * def.speed * dt;
        pos.z += Math.cos(yaw) * def.speed * dt;
        fp.strikeDist += def.speed * dt;

        fp.bombCooldown -= dt;
        if (fp.bombCooldown <= 0 && fp.bombsLeft > 0) {
          dropBomb(this.scene, this.bombs, jet, def.bombDamage);
          fp.bombsLeft--;
          fp.bombCooldown = 0.38;
        }

        if ((fp.bombsLeft <= 0 && fp.strikeDist > 7) || fp.strikeDist > 18) {
          fp.state = 'egress';
          fp.egressTimer = 3;
        } else if (!cluster) {
          fp.state = 'egress';
          fp.egressTimer = 2;
        }
      } else if (fp.state === 'egress') {
        targetY = def.flyHeight;
        const away = {
          x: pos.x + Math.sin(jet.mesh.rotation.y) * 14,
          z: pos.z + Math.cos(jet.mesh.rotation.y) * 14,
        };
        turnRate = flyToward(jet, away, dt, def.speed * 0.85);
        fp.egressTimer -= dt;
        if (fp.egressTimer <= 0) {
          fp.state = 'patrol';
          fp.strikePoint = null;
          fp.approachPoint = null;
        }
      }

      const desiredY = targetY + bob(jet.id);
      pos.y += (desiredY - pos.y) * Math.min(1, dt * 4);

      fp.bank = THREE.MathUtils.lerp(fp.bank, Math.max(-0.55, Math.min(0.55, turnRate * 0.2)), dt * 6);
      const pitchTarget = fp.state === 'strike' ? -0.35 : fp.state === 'egress' ? 0.12 : 0;
      fp.pitch = THREE.MathUtils.lerp(fp.pitch, pitchTarget, dt * 4);
      jet.mesh.rotation.z = fp.bank;
      jet.mesh.rotation.x = fp.pitch;

      const exhaust = jet.mesh.userData.exhaust;
      if (exhaust) {
        const thrust = fp.state === 'strike' ? 1.4 : 1;
        exhaust.material.emissiveIntensity = 0.45 + Math.sin(Date.now() * 0.02) * 0.15 * thrust;
        exhaust.scale.setScalar(0.85 + thrust * 0.25);
      }

      this.updateHpBar(jet);
    }
  }

  updateRaiders(dt) {
    if (this.game.gameOver) return;

    for (let i = this.raiders.length - 1; i >= 0; i--) {
      const raider = this.raiders[i];
      if (raider.hp <= 0) {
        this.removeUnit(raider, this.raiders, i);
        continue;
      }

      const targetTroop = this._combatUnits.length
        ? this.findNearest(raider.mesh.position, this._combatUnits)
        : null;
      const targetBuilding = this._raiderTargetBuilding.get(raider.id) ?? this.findTargetBuilding(raider);

      if (targetTroop) {
        this.moveToward(raider, targetTroop.mesh.position, dt);
        const dist = raider.mesh.position.distanceTo(targetTroop.mesh.position);
        raider.attackCooldown -= dt;
        if (dist < raider.range && raider.attackCooldown <= 0) {
          this.damageUnit(targetTroop, raider.damage);
          raider.attackCooldown = raider.attackRate ?? ENEMY_DEFS.raider.attackRate;
        }
      } else if (targetBuilding) {
        const pos = this.buildingWorldPos(targetBuilding);
        const blockingFence = findBlockingFence(
          raider.mesh.position,
          pos,
          this.game.buildings,
          this.game.grid
        );

        if (blockingFence) {
          const seg = getFenceSegment(blockingFence, this.game.grid);
          const approach = getFenceApproachPoint(seg, raider.mesh.position.x, raider.mesh.position.z);
          this.moveToward(raider, new THREE.Vector3(approach.x, 0, approach.z), dt, 0.15);
          const dist = distanceToSegment(raider.mesh.position.x, raider.mesh.position.z, seg);
          raider.attackCooldown -= dt;
          if (dist < raider.range + 0.4 && raider.attackCooldown <= 0) {
            this.damageBarrier(raider, blockingFence);
            raider.attackCooldown = raider.attackRate ?? ENEMY_DEFS.raider.attackRate;
          }
          this.faceTarget(raider.mesh, new THREE.Vector3(seg.cx, 0, seg.cz));
        } else {
          const shieldR = targetBuilding.attackRadius ?? getBuildingAttackRadius(targetBuilding.size, targetBuilding.level);
          const approach = getApproachPoint(
            pos.x, pos.z,
            raider.mesh.position.x, raider.mesh.position.z,
            shieldR
          );
          this.moveToward(raider, new THREE.Vector3(approach.x, 0, approach.z), dt, 0.12);
          const dist = raider.mesh.position.distanceTo(pos);
          raider.attackCooldown -= dt;
          if (dist <= shieldR + raider.range && raider.attackCooldown <= 0) {
            this.raidBuilding(raider, targetBuilding);
            raider.attackCooldown = raider.attackRate ?? ENEMY_DEFS.raider.attackRate;
          }
          this.faceTarget(raider.mesh, pos);
        }
      }
      this.updateHpBar(raider);
    }

    if (this.raidActive && this.raiders.length === 0) {
      this.raidActive = false;
      const bonus = 50 + this.wave * 25;
      this.game.rm.add('oil', bonus);
      this.game.rm.add('wheat', bonus);
      this.game.rebuildFences();
      this.game.ui.updateBuildButtons();
      this.game.ui.showToast(`🎉 Raid repelled! +${bonus} oil & wheat`, 'success');
    }
  }

  updateDefenses(dt) {
    for (const building of this.game.buildings) {
      const def = this.game.getBuildingDef(building);
      if (!def.defense || def.barrier) continue;

      building._defenseCooldown = (building._defenseCooldown ?? 0) - dt;
      if (building._defenseCooldown > 0) continue;

      const pos = this.buildingWorldPos(building);
      const range = building.type === 'lookout' ? 6 : 2.5;
      const target = this.findNearestEngageableRaider(pos, range);
      if (!target) continue;

      if (building.type === 'lookout') {
        const oilCost = (def.defenseOilCost ?? 0) * (building.level ?? 1);
        if (oilCost > 0 && !this.game.rm.canAfford({ oil: oilCost })) continue;
        if (oilCost > 0) this.game.rm.spend({ oil: oilCost });
      }

      building._defenseCooldown = building.type === 'lookout' ? 1.5 : 2.5;
      const dmg = def.defense * (building.level ?? 1) * 0.3;
      this.damageUnit(target, dmg);
      this.spawnProjectile(pos, target.mesh.position, building.type === 'lookout' ? 0xf2cd00 : 0x8b6914);
    }
  }

  spawnProjectile(from, to, color, speed = 12) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(from);
    if (from.y < 1) mesh.position.y = 1.2;
    this.scene.add(mesh);
    this.projectiles.push({ mesh, target: to.clone(), speed, life: 1 });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      const dir = p.target.clone().sub(p.mesh.position).normalize();
      p.mesh.position.add(dir.multiplyScalar(p.speed * dt));
      if (p.life <= 0 || p.mesh.position.distanceTo(p.target) < 0.3) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  raidBuilding(raider, building) {
    const def = this.game.getBuildingDef(building);
    const enemyDef = ENEMY_DEFS[raider.type] ?? ENEMY_DEFS.raider;
    if (def.produces) {
      const stolen = Math.min(raider.steal ?? enemyDef.steal, this.game.rm.resources[def.produces] ?? 0);
      if (stolen > 0) {
        this.game.rm.resources[def.produces] -= stolen;
        this.game.rm.notify();
        this.game.ui.showToast(`💀 ${enemyDef.name} stole ${stolen} ${def.produces}!`, 'warn');
      }
    }
    this.damageBuilding(raider, building);
  }

  findTargetBuilding(raider) {
    if (this._raiderTargetBuilding?.has(raider.id)) {
      return this._raiderTargetBuilding.get(raider.id);
    }
    return this.findRaiderBuildingTarget(raider);
  }

  buildingWorldPos(building) {
    const { x, z } = this.game.grid.gridToWorld(building.gx, building.gz, building.size);
    return new THREE.Vector3(x, 0, z);
  }

  findNearest(pos, units, maxRange = Infinity) {
    let nearest = null;
    let minDistSq = maxRange * maxRange;
    for (const u of units) {
      const dx = pos.x - u.mesh.position.x;
      const dz = pos.z - u.mesh.position.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearest = u;
      }
    }
    return nearest;
  }

  moveToward(unit, target, dt, stopDist = 0.3) {
    const meshPos = unit.mesh.position;
    const from = this._vFrom.copy(meshPos);
    const to = target.isVector3 ? target : this._vTo.set(target.x, target.y ?? 0, target.z);
    const dir = this._vDir.subVectors(to, from);
    const dist = dir.length();
    if (dist < stopDist) return;
    dir.multiplyScalar(1 / dist);
    const step = Math.min(unit.speed * dt, Math.max(0, dist - stopDist));
    const next = this._vNext.copy(from).addScaledVector(dir, step);

    const hit = findFenceCrossing(from.x, from.z, next.x, next.z, this.game.buildings, this.game.grid);
    if (hit) {
      const stop = Math.max(0, hit.t - 0.06) * step;
      meshPos.copy(from).addScaledVector(dir, stop);
      if (unit.flyHeight != null) meshPos.y = unit.flyHeight;
      return;
    }
    meshPos.copy(next);
    if (unit.flyHeight != null) meshPos.y = unit.flyHeight;
  }

  damageBuilding(attacker, building) {
    const damage = attacker.damage ?? ENEMY_DEFS[attacker.type]?.damage ?? 10;
    building.hp = Math.max(0, (building.hp ?? 0) - damage);
    building._hitFlash = 0.35;
    this.bumpAnimation(attacker.mesh);
    updateBuildingHpBar(building, this.game.isoCam?.camera);

    if (building.hp <= 0) {
      this.destroyRaidTarget(attacker, building);
    } else if (this.game.selectedBuilding?.id === building.id) {
      this.game.ui.showBuildingInfo(building);
    }
  }

  destroyRaidTarget(attacker, building) {
    if (building.type === 'hq') {
      this.game.gameOver();
      this.game.destroyBuilding(building);
      return;
    }

    const who = ENEMY_DEFS[attacker.type]?.name ?? 'Invaders';
    const def = BUILDING_DEFS[building.type];
    const buildingType = building.type;
    this.game.destroyBuilding(building);
    if (buildingType === 'fence') {
      this.game.ui.showToast(`🪵 ${who} broke through a ranch fence!`, 'warn');
    } else {
      this.game.ui.showToast(`💥 ${who} destroyed your ${def?.name ?? 'building'}!`, 'warn');
    }
  }

  damageBarrier(attacker, building) {
    this.damageBuilding(attacker, building);
  }

  faceTarget(mesh, target) {
    const dir = target.clone().sub(mesh.position);
    dir.y = 0;
    if (dir.lengthSq() > 0.001) {
      mesh.rotation.y = Math.atan2(dir.x, dir.z);
    }
  }

  damageUnit(unit, amount) {
    unit.hp -= amount;
    if (unit.hp <= 0) {
      this.spawnDeathParticles(unit.mesh.position);
    }
  }

  spawnDeathParticles(pos) {
    const spawnCount = Math.min(4, 40 - this.deathParticles.length);
    for (let i = 0; i < spawnCount; i++) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xcc8844 })
      );
      p.position.set(pos.x, 0.5, pos.z);
      this.scene.add(p);
      this.deathParticles.push({
        mesh: p,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4),
        life: 0.55,
      });
    }
  }

  updateDeathParticles(dt) {
    for (let i = this.deathParticles.length - 1; i >= 0; i--) {
      const p = this.deathParticles[i];
      p.life -= dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 9.8 * dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.deathParticles.splice(i, 1);
      }
    }
  }

  bumpAnimation(mesh) {
    const orig = mesh.scale.y;
    mesh.scale.y = orig * 0.8;
    setTimeout(() => { mesh.scale.y = orig; }, 100);
  }

  removeUnit(unit, arr, index) {
    this.scene.remove(unit.mesh);
    arr.splice(index, 1);
  }
}
