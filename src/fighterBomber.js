import * as THREE from 'three';

const GRAVITY = 22;

export function initFighterState(home, flyHeight) {
  return {
    state: 'patrol',
    home: { ...home },
    flyHeight,
    patrolAngle: Math.random() * Math.PI * 2,
    bank: 0,
    pitch: 0,
    bombCooldown: 0,
    bombsLeft: 0,
    strikePoint: null,
    egressPoint: null,
    speed: 0,
  };
}

/** Smooth flight toward a world point; returns turn rate for banking. */
export function flyToward(jet, target, dt, speed) {
  const pos = jet.mesh.position;
  const dx = target.x - pos.x;
  const dz = target.z - pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.15) return 0;

  const desiredYaw = Math.atan2(dx, dz);
  let yawDiff = desiredYaw - jet.mesh.rotation.y;
  while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
  while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

  const turnRate = Math.max(-2.8, Math.min(2.8, yawDiff * 4)) * dt;
  jet.mesh.rotation.y += turnRate;

  const step = Math.min(speed * dt, dist);
  pos.x += Math.sin(jet.mesh.rotation.y) * step;
  pos.z += Math.cos(jet.mesh.rotation.y) * step;

  return turnRate / dt;
}

export function dropBomb(scene, bombs, jet, damage) {
  const pos = jet.mesh.position.clone();
  const yaw = jet.mesh.rotation.y;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 0.45, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.position.copy(pos);
  mesh.position.add(forward.clone().multiplyScalar(-0.6));
  mesh.position.y -= 0.35;
  scene.add(mesh);

  bombs.push({
    mesh,
    vel: forward.multiplyScalar(6).add(new THREE.Vector3((Math.random() - 0.5) * 0.8, -2, (Math.random() - 0.5) * 0.8)),
    damage,
    spin: (Math.random() - 0.5) * 8,
  });
}

export function updateBombs(dt, bombs, scene, onExplode) {
  for (let i = bombs.length - 1; i >= 0; i--) {
    const b = bombs[i];
    b.vel.y -= GRAVITY * dt;
    b.mesh.position.add(b.vel.clone().multiplyScalar(dt));
    b.mesh.rotation.z += b.spin * dt;

    if (b.mesh.position.y <= 0.25) {
      onExplode(b.mesh.position.clone(), b.damage);
      scene.remove(b.mesh);
      bombs.splice(i, 1);
    }
  }
}

export function spawnExplosion(scene, explosions, pos, radius = 3.5) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffaa22, transparent: true, opacity: 0.95, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(pos.x, 0.15, pos.z);
  scene.add(ring);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9 })
  );
  core.position.set(pos.x, 0.5, pos.z);
  scene.add(core);

  const particles = [];
  for (let p = 0; p < 10; p++) {
    const part = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: p % 2 ? 0xff6600 : 0x333333, transparent: true, opacity: 1 })
    );
    part.position.copy(pos);
    part.position.y = 0.4;
    const vel = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5 + 2, (Math.random() - 0.5) * 6);
    scene.add(part);
    particles.push({ mesh: part, vel });
  }

  explosions.push({ ring, core, particles, life: 0.55, maxLife: 0.55, radius });
}

export function updateExplosions(dt, explosions, scene) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const ex = explosions[i];
    ex.life -= dt;
    const t = 1 - ex.life / ex.maxLife;
    const scale = 1 + t * ex.radius * 2.2;
    ex.ring.scale.set(scale, scale, 1);
    ex.ring.material.opacity = Math.max(0, 0.95 * (1 - t));
    ex.core.scale.setScalar(1 + t * 3);
    ex.core.material.opacity = Math.max(0, 0.9 * (1 - t * 1.2));
    ex.core.position.y = 0.5 + t * 1.5;

    for (const p of ex.particles) {
      p.vel.y -= GRAVITY * 0.5 * dt;
      p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
      p.mesh.material.opacity = Math.max(0, 1 - t * 1.3);
    }

    if (ex.life <= 0) {
      scene.remove(ex.ring);
      scene.remove(ex.core);
      for (const p of ex.particles) scene.remove(p.mesh);
      explosions.splice(i, 1);
    }
  }
}
