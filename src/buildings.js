import * as THREE from 'three';
import { createAlbertaBuilding } from './albertaBuildings.js';

const CELL = 1;

export function createBuildingMesh(type, size, assetLoader) {
  const mesh = createAlbertaBuilding(type, size);
  if (assetLoader) {
    assetLoader.attachBuildingProps(mesh, type);
  }
  return mesh;
}

export function createGhostMesh(type, size, assetLoader) {
  const mesh = createBuildingMesh(type, size, assetLoader);
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.55;
    }
  });
  return mesh;
}

export function scaleBuildingByLevel(mesh, level) {
  const s = 1 + (level - 1) * 0.1;
  mesh.scale.set(s, s, s);
}

export function setGhostValidity(mesh, valid) {
  const tint = valid ? 0x88ff88 : 0xff8888;
  mesh.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material.color.setHex(tint);
      child.material.emissive?.setHex(valid ? 0x114411 : 0x441111);
    }
  });
}
