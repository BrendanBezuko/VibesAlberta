import * as THREE from 'three';
import {
  GRID_COLS,
  GRID_ROWS,
  CELL,
  ALBERTA_HALF_X,
  ALBERTA_HALF_Z,
  buildAlbertaMask,
  getGridOffset,
} from './albertaMap.js';
import {
  buildTerrainGrid,
  getTerrainAtGrid,
  canBuildOnTerrain,
  getTerrainBlockReason,
} from './terrainFeatures.js';

export class GridSystem {
  constructor() {
    this.gridSize = GRID_COLS;
    this.gridRows = GRID_ROWS;
    this.cellSize = CELL;
    this.occupancy = new Map();
    this.halfW = ALBERTA_HALF_X;
    this.halfH = ALBERTA_HALF_Z;
    this.offset = getGridOffset();
    this.albertaMask = buildAlbertaMask();
    this.terrainGrid = buildTerrainGrid();
  }

  key(gx, gz) {
    return `${gx},${gz}`;
  }

  isAlbertaCell(gx, gz) {
    if (gx < 0 || gz < 0 || gx >= GRID_COLS || gz >= GRID_ROWS) return false;
    return this.albertaMask[gz][gx];
  }

  getTerrain(gx, gz) {
    return getTerrainAtGrid(gx, gz, this.terrainGrid);
  }

  footprintInAlberta(gx, gz, size) {
    for (let x = gx; x < gx + size; x++) {
      for (let z = gz; z < gz + size; z++) {
        if (!this.isAlbertaCell(x, z)) return false;
      }
    }
    return true;
  }

  footprintTerrainOk(gx, gz, size, buildingType) {
    for (let x = gx; x < gx + size; x++) {
      for (let z = gz; z < gz + size; z++) {
        const terrain = this.getTerrain(x, z);
        if (!canBuildOnTerrain(terrain, buildingType)) return false;
      }
    }
    return true;
  }

  getPlacementBlockReason(gx, gz, size, buildingType) {
    if (!this.inBounds(gx, gz, size)) return 'Out of bounds';
    if (!this.footprintInAlberta(gx, gz, size)) return 'Outside Alberta';
    for (let x = gx; x < gx + size; x++) {
      for (let z = gz; z < gz + size; z++) {
        const terrain = this.getTerrain(x, z);
        const reason = getTerrainBlockReason(terrain, buildingType);
        if (reason) return reason;
      }
    }
    if (this.isOccupied(gx, gz, size)) return 'Already occupied';
    return null;
  }

  worldToGrid(worldX, worldZ) {
    const gx = Math.floor((worldX - this.offset.x + this.halfW) / this.cellSize);
    const gz = Math.floor((worldZ - this.offset.z + this.halfH) / this.cellSize);
    return { gx, gz };
  }

  gridToWorld(gx, gz, size = 1) {
    const offset = ((size - 1) * this.cellSize) / 2;
    const x = gx * this.cellSize - this.halfW + this.cellSize / 2 + offset + this.offset.x;
    const z = gz * this.cellSize - this.halfH + this.cellSize / 2 + offset + this.offset.z;
    return { x, z };
  }

  inBounds(gx, gz, size = 1) {
    return gx >= 0 && gz >= 0 && gx + size <= GRID_COLS && gz + size <= GRID_ROWS;
  }

  isOccupied(gx, gz, size = 1, excludeId = null) {
    for (let x = gx; x < gx + size; x++) {
      for (let z = gz; z < gz + size; z++) {
        const cell = this.occupancy.get(this.key(x, z));
        if (cell && cell !== excludeId) return true;
      }
    }
    return false;
  }

  canPlace(gx, gz, size, buildingType = null, excludeId = null) {
    return (
      this.inBounds(gx, gz, size) &&
      this.footprintInAlberta(gx, gz, size) &&
      this.footprintTerrainOk(gx, gz, size, buildingType) &&
      !this.isOccupied(gx, gz, size, excludeId)
    );
  }

  occupy(id, gx, gz, size) {
    for (let x = gx; x < gx + size; x++) {
      for (let z = gz; z < gz + size; z++) {
        this.occupancy.set(this.key(x, z), id);
      }
    }
  }

  release(id) {
    for (const [key, val] of this.occupancy.entries()) {
      if (val === id) this.occupancy.delete(key);
    }
  }

  raycastGround(camera, ndc, groundPlane) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    const intersects = raycaster.ray.intersectPlane(groundPlane, hit);
    if (!intersects) return null;
    return this.worldToGrid(hit.x, hit.z);
  }
}
