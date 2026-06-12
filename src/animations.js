import * as THREE from 'three';
import { updateBuildingHpBar } from './buildingHealth.js';

export class AnimationSystem {
  constructor() {
    this.time = 0;
  }

  update(dt, buildings, camera) {
    this.time += dt;

    for (const building of buildings) {
      updateBuildingHpBar(building, camera);

      if (building._hitFlash > 0) {
        building._hitFlash -= dt;
        const flash = Math.sin(building._hitFlash * 30) * 0.5 + 0.5;
        building.mesh.traverse((child) => {
          if (child.isMesh && child.material?.emissive) {
            child.material.emissive.setHex(flash > 0.5 ? 0x442222 : 0x000000);
          }
        });
      }

      if (building.type === 'oil_rig' && building.mesh.userData.pump) {
        building.mesh.userData.pump.rotation.z = Math.sin(this.time * 3) * 0.35;
      }

      if (building.type === 'wheat_farm') {
        building.mesh.children.forEach((child, i) => {
          if (child.geometry?.type === 'BoxGeometry' && child.position.y > 0.15 && child.position.y < 0.7) {
            child.rotation.z = Math.sin(this.time * 2 + i) * 0.06;
          }
        });
      }

      if (building.type === 'lookout' && building.mesh.userData.scope) {
        building.mesh.userData.scope.rotation.y = Math.sin(this.time * 0.8) * 0.6;
      }
    }
  }
}

export function createSelectionRing(scene) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.7, 32),
    new THREE.MeshBasicMaterial({ color: 0xf2cd00, transparent: true, opacity: 0.85, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  ring.visible = false;
  scene.add(ring);
  return ring;
}

export function updateSelectionRing(ring, building, grid) {
  if (!building) {
    ring.visible = false;
    return;
  }
  const { x, z } = grid.gridToWorld(building.gx, building.gz, building.size);
  ring.position.set(x, 0.12, z);
  ring.scale.setScalar(building.size * 0.9);
  ring.visible = true;
  ring.material.opacity = 0.6 + Math.sin(Date.now() * 0.005) * 0.25;
}
