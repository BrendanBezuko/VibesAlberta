import * as THREE from 'three';

function getBarY(building) {
  const size = building.size ?? 1;
  if (building.type === 'fence') return 0.72;
  if (building.type === 'hq') return 3.1;
  if (building.type === 'lookout') return 2.6;
  if (building.type === 'air_wing') return 2.2;
  return 1.05 + size * 0.48;
}

function getBarWidth(building) {
  const size = building.size ?? 1;
  return 0.52 + size * 0.34;
}

export function addBuildingHpBar(building) {
  if (building.hpBar || building.maxHp == null) return;

  const width = getBarWidth(building);
  const barH = 0.08 + (building.size ?? 1) * 0.018;
  const fillW = width * 0.94;
  const y = getBarY(building);

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(width, barH),
    new THREE.MeshBasicMaterial({
      color: 0x330000,
      transparent: true,
      opacity: 0.85,
      depthTest: false,
    })
  );
  bg.position.y = y;
  bg.renderOrder = 999;

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(fillW, barH * 0.68),
    new THREE.MeshBasicMaterial({
      color: 0x44cc44,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    })
  );
  fill.position.set(0, y, 0.01);
  fill.renderOrder = 1000;

  building.mesh.add(bg, fill);
  building.hpBarBg = bg;
  building.hpBar = fill;
  building._hpBarFillWidth = fillW;
  updateBuildingHpBar(building);
}

export function updateBuildingHpBar(building, camera) {
  if (!building.hpBar || building.maxHp == null) return;

  const pct = Math.max(0, (building.hp ?? 0) / building.maxHp);
  const w = building._hpBarFillWidth ?? 0.48;
  building.hpBar.scale.x = pct;
  building.hpBar.position.x = -(w * (1 - pct)) / 2;
  building.hpBar.material.color.setHex(
    pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xcccc44 : 0xcc4444
  );

  const full = pct >= 0.999;
  building.hpBarBg.material.opacity = full ? 0.5 : 0.92;
  building.hpBar.material.opacity = full ? 0.65 : 0.98;

  if (camera) {
    building.hpBarBg.lookAt(camera.position);
    building.hpBar.lookAt(camera.position);
  }
}
