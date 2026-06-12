import * as THREE from 'three';
import {
  ResourceManager,
  BUILDING_DEFS,
  HQ_UPGRADE_COSTS,
  getUpgradeCost,
  getEffectiveRate,
  getEffectiveDefense,
  getBarrierHp,
} from './resources.js';
import { createBuildingMesh, createGhostMesh, setGhostValidity, scaleBuildingByLevel } from './buildings.js';
import { createTerrain, setupLighting } from './terrain.js';
import { GridSystem } from './grid.js';
import { IsometricCamera } from './camera.js';
import { UIManager } from './ui.js';
import { CombatSystem } from './combat.js';
import { AnimationSystem, createSelectionRing, updateSelectionRing } from './animations.js';
import { AssetLoader } from './assetLoader.js';
import { getBuildingAttackRadius } from './forceField.js';

let buildingIdCounter = 1;

export class Game {
  static async create(canvas, onLoadProgress) {
    const game = new Game(canvas);
    game.assetLoader = new AssetLoader();

    try {
      await game.assetLoader.loadAll((pct, path) => {
        onLoadProgress?.(pct, path);
      });
    } catch (err) {
      console.warn('KayKit assets failed to load — using procedural fallback.', err);
      game.assetLoader = null;
    }

    game.initWorld();
    return game;
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.assetLoader = null;
    this.grid = null;
    this.rm = new ResourceManager();
    this.buildings = [];
    this.placement = null;
    this.selectedBuilding = null;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.isoCam = null;
    this.ui = null;
    this.combat = null;
    this.animations = new AnimationSystem();
    this.selectionRing = null;
    this.mouse = { x: 0, y: 0 };
    this.clock = new THREE.Clock();
    /** Saved fence layout — rebuilt free after each raid. */
    this.fenceBlueprint = [];
  }

  isRaidActive() {
    return !!this.combat?.raidActive;
  }

  canPlaceFence() {
    return !this.isRaidActive();
  }

  recordFence(building) {
    if (building.type !== 'fence') return;
    const entry = {
      gx: building.gx,
      gz: building.gz,
      level: building.level ?? 1,
      rotation: building.rotation ?? 0,
    };
    const idx = this.fenceBlueprint.findIndex((f) => f.gx === entry.gx && f.gz === entry.gz);
    if (idx >= 0) this.fenceBlueprint[idx] = entry;
    else this.fenceBlueprint.push(entry);
  }

  rebuildFences() {
    let rebuilt = 0;
    for (const spec of this.fenceBlueprint) {
      const exists = this.buildings.some(
        (b) => b.type === 'fence' && b.gx === spec.gx && b.gz === spec.gz
      );
      if (exists) continue;
      if (!this.grid.canPlace(spec.gx, spec.gz, 1, 'fence')) continue;
      this.addBuilding('fence', spec.gx, spec.gz, 1, spec.level, spec.rotation);
      rebuilt++;
    }
    if (rebuilt > 0) {
      this.ui.showToast(`🪵 Rebuilt ${rebuilt} ranch fence${rebuilt > 1 ? 's' : ''}`, 'success');
    }
  }

  initWorld() {
    createTerrain(this.scene, this.assetLoader);
    setupLighting(this.scene);

    this.grid = new GridSystem();
    this.isoCam = new IsometricCamera(this.canvas, new THREE.Vector3(0, 0, 0));
    this.combat = new CombatSystem(this.scene, this);
    this.ui = new UIManager(this.rm, this);
    this.selectionRing = createSelectionRing(this.scene);

    this.placeHQ();
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.animate();
  }

  getBuildingDef(building) {
    return BUILDING_DEFS[building.type];
  }

  trainAtSelected() {
    const building = this.selectedBuilding;
    if (!building) {
      this.ui.showToast('Select a building first', 'warn');
      return false;
    }
    const def = BUILDING_DEFS[building.type];
    if (!def?.trains) {
      this.ui.showToast('This building cannot train units', 'warn');
      return false;
    }
    if (!this.combat) {
      this.ui.showToast('Combat system not ready', 'warn');
      return false;
    }
    return this.combat.trainUnit(building, def.trains);
  }

  placeHQ() {
    const size = BUILDING_DEFS.hq.size;
    let gx = Math.floor(this.grid.gridSize / 2) - Math.floor(size / 2);
    let gz = Math.floor(this.grid.gridRows / 2) - Math.floor(size / 2);

    if (!this.grid.canPlace(gx, gz, size, 'hq')) {
      outer: for (let r = 0; r < 8; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (this.grid.canPlace(gx + dx, gz + dz, size, 'hq')) {
              gx += dx;
              gz += dz;
              break outer;
            }
          }
        }
      }
    }
    this.addBuilding('hq', gx, gz, size);
  }

  applyBuildingRotation(mesh, rotation = 0) {
    mesh.rotation.y = ((rotation % 4) + 4) % 4 * (Math.PI / 2);
  }

  addBuilding(type, gx, gz, size, level = 1, rotation = 0) {
    const id = buildingIdCounter++;
    const { x, z } = this.grid.gridToWorld(gx, gz, size);
    const mesh = createBuildingMesh(type, size, this.assetLoader);
    mesh.position.set(x, 0, z);
    if (BUILDING_DEFS[type]?.rotatable) {
      this.applyBuildingRotation(mesh, rotation);
    }
    scaleBuildingByLevel(mesh, level);
    this.scene.add(mesh);

    const def = BUILDING_DEFS[type];
    const building = {
      id, type, gx, gz, size, level, mesh,
      rotation: def.rotatable ? ((rotation % 4) + 4) % 4 : 0,
      attackRadius: getBuildingAttackRadius(size, level),
      _hitFlash: 0,
    };
    if (def.barrier) {
      building.maxHp = getBarrierHp(building);
      building.hp = building.maxHp;
    }
    this.buildings.push(building);
    this.grid.occupy(id, gx, gz, size);
    this.combat?.invalidateCaches();

    if (def.storageBonus) {
      this.rm.addCapacity(def.storageBonus);
    }
    if (type === 'fence') {
      this.recordFence(building);
    }

    return building;
  }

  destroyBuilding(building) {
    this.grid.release(building.id);
    this.scene.remove(building.mesh);
    this.buildings = this.buildings.filter((b) => b.id !== building.id);
    this.combat?.invalidateCaches();
    if (this.selectedBuilding?.id === building.id) {
      this.selectedBuilding = null;
      updateSelectionRing(this.selectionRing, null);
      this.ui.hideInfoPanel();
    }
  }

  upgradeBuilding(building) {
    const def = BUILDING_DEFS[building.type];
    const level = building.level ?? 1;
    if (level >= (def.maxLevel ?? 3)) return false;

    if (building.type === 'hq') {
      const cost = HQ_UPGRADE_COSTS[level + 1];
      if (!cost || !this.rm.canAfford(cost)) return false;
      this.rm.spend(cost);
      building.level = level + 1;
      this.rm.hqLevel = building.level;
      for (const key of Object.keys(this.rm.capacity)) {
        this.rm.capacity[key] += 1000;
      }
      this.rm.notify();
    } else {
      const cost = getUpgradeCost(building);
      if (!cost || !this.rm.canAfford(cost)) return false;
      this.rm.spend(cost);
      building.level = level + 1;
      if (def.storageBonus) {
        this.rm.addCapacity(def.storageBonus);
      }
    }

    scaleBuildingByLevel(building.mesh, building.level);
    building.attackRadius = getBuildingAttackRadius(building.size, building.level);
    if (def.barrier) {
      const prevMax = building.maxHp ?? getBarrierHp({ ...building, level: level });
      building.maxHp = getBarrierHp(building);
      building.hp = Math.min(building.maxHp, (building.hp ?? prevMax) + (building.maxHp - prevMax));
      this.recordFence(building);
    }
    this.ui.showBuildingInfo(building);
    this.ui.showToast(`⬆️ ${def.name} upgraded to Lv.${building.level}!`, 'success');
    return true;
  }

  startPlacement(type) {
    if (type === 'hq') return;
    if (type === 'fence' && !this.canPlaceFence()) {
      this.ui.showToast('Cannot build fences during a raid', 'warn');
      return;
    }
    const def = BUILDING_DEFS[type];
    if (!this.rm.canAfford(def.cost)) return;

    this.cancelPlacement();
    const ghost = createGhostMesh(type, def.size, this.assetLoader);
    this.scene.add(ghost);
    this.placement = { type, size: def.size, ghost, rotation: 0 };
    this.applyBuildingRotation(ghost, 0);
    this.selectedBuilding = null;
    updateSelectionRing(this.selectionRing, null);
  }

  rotateFence() {
    const type = this.placement?.type ?? this.selectedBuilding?.type;
    if (!BUILDING_DEFS[type]?.rotatable) return;

    if (this.placement) {
      this.placement.rotation = (this.placement.rotation + 1) % 4;
      this.applyBuildingRotation(this.placement.ghost, this.placement.rotation);
      return;
    }

    const building = this.selectedBuilding;
    building.rotation = (building.rotation + 1) % 4;
    this.applyBuildingRotation(building.mesh, building.rotation);
    if (building.type === 'fence') this.recordFence(building);
  }

  startFencePlacement() {
    this.startPlacement('fence');
    if (this.placement) this.ui.setActiveButton('fence');
  }

  cancelPlacement() {
    if (!this.placement) return;
    this.scene.remove(this.placement.ghost);
    this.placement = null;
  }

  tryPlace(gx, gz) {
    if (!this.placement) return false;
    const { type, size, ghost } = this.placement;
    const def = BUILDING_DEFS[type];

    if (type === 'fence' && !this.canPlaceFence()) {
      this.ui.showToast('Cannot build fences during a raid', 'warn');
      return false;
    }

    const blockReason = this.grid.getPlacementBlockReason(gx, gz, size, type);
    if (blockReason || !this.rm.canAfford(def.cost)) {
      this.ui.showToast(blockReason ?? 'Cannot place here', 'warn');
      return false;
    }

    this.rm.spend(def.cost);
    const rotation = def.rotatable ? (this.placement.rotation ?? 0) : 0;
    const building = this.addBuilding(type, gx, gz, size, 1, rotation);
    this.scene.remove(ghost);
    this.placement = null;
    this.ui.onPlacementEnd();
    this.ui.showToast(`Built ${def.name}`, 'success');
    this.selectBuilding(building);
    return true;
  }

  selectBuilding(building) {
    this.selectedBuilding = building;
    updateSelectionRing(this.selectionRing, building, this.grid);
    this.ui.showBuildingInfo(building);
  }

  pickBuilding(ndc) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.isoCam.camera);

    const meshes = this.buildings.map((b) => b.mesh);
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;

    let obj = hits[0].object;
    while (obj.parent && !this.buildings.some((b) => b.mesh === obj)) {
      obj = obj.parent;
    }
    return this.buildings.find((b) => b.mesh === obj) ?? null;
  }

  bindInput() {
    let dragStart = null;

    this.canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragStart = { x: e.clientX, y: e.clientY, time: Date.now() };
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button !== 0 || !dragStart) return;

      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - dragStart.time;

      if (dist < 6 && elapsed < 300) {
        const ndc = this.isoCam.getNDC(e);

        if (this.placement) {
          const gridPos = this.grid.raycastGround(this.isoCam.camera, ndc, this.groundPlane);
          if (gridPos) this.tryPlace(gridPos.gx, gridPos.gz);
        } else {
          const building = this.pickBuilding(ndc);
          if (building) {
            this.selectBuilding(building);
          } else {
            this.selectedBuilding = null;
            updateSelectionRing(this.selectionRing, null);
            this.ui.hideInfoPanel();
          }
        }
      }

      dragStart = null;
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.cancelPlacement();
        this.ui.onPlacementEnd();
      } else if (e.key === 'r' || e.key === 'R') {
        this.rotateFence();
      } else if (e.key === 'f' || e.key === 'F') {
        if (this.placement?.type === 'fence') {
          this.cancelPlacement();
          this.ui.onPlacementEnd();
        } else {
          this.startFencePlacement();
        }
      } else if (e.key === 't' || e.key === 'T') {
        this.trainAtSelected();
      }
    });
  }

  updatePlacementGhost() {
    if (!this.placement) return;

    const ndc = this.isoCam.getNDC({ clientX: this.mouse.x, clientY: this.mouse.y });
    const gridPos = this.grid.raycastGround(this.isoCam.camera, ndc, this.groundPlane);
    if (!gridPos) return;

    const { gx, gz } = gridPos;
    const { size, ghost, rotation = 0 } = this.placement;
    const { x, z } = this.grid.gridToWorld(gx, gz, size);
    ghost.position.set(x, 0, z);
    if (BUILDING_DEFS[this.placement.type]?.rotatable) {
      this.applyBuildingRotation(ghost, rotation);
    }
    ghost.position.y = Math.sin(Date.now() * 0.006) * 0.04;

    const def = BUILDING_DEFS[this.placement.type];
    const raidBlocked = this.placement.type === 'fence' && !this.canPlaceFence();
    const valid =
      !raidBlocked &&
      !this.grid.getPlacementBlockReason(gx, gz, size, this.placement.type) &&
      this.rm.canAfford(def.cost);
    setGhostValidity(ghost, valid);
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.isoCam?.resize(w, h);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.rm.tickProducers(this.buildings, dt, getEffectiveRate);
    this.rm.tickUpkeep(this.buildings, dt);
    this.combat?.update(dt);
    this.animations.update(dt, this.buildings);
    this.updatePlacementGhost();

    if (this.selectedBuilding) {
      updateSelectionRing(this.selectionRing, this.selectedBuilding, this.grid);
    }

    this.renderer.render(this.scene, this.isoCam.camera);
  }
}
