import * as THREE from 'three';

const RCMP_RED = 0xcc0000;
const RCMP_BLUE = 0x1a1a4a;
const RAIDER_GREEN = 0x3d5c3a;

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

function part(geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  return m;
}

function addShadow(group, r = 0.2) {
  const s = new THREE.Mesh(
    new THREE.CircleGeometry(r, 12),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 })
  );
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.02;
  group.add(s);
}

/** RCMP Mountie — red serge jacket, campaign hat */
export function createMountie() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.38, 4, 8), mat(RCMP_RED));
  body.position.y = 0.42;
  body.castShadow = true;
  group.add(body);

  const pants = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.3, 8), mat(RCMP_BLUE));
  pants.position.y = 0.18;
  group.add(pants);

  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 12), mat(0x111111));
  hatBrim.position.y = 0.78;
  group.add(hatBrim);

  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.18, 12), mat(0x111111));
  hatTop.position.y = 0.9;
  group.add(hatTop);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.18), mat(0xf2cd00));
  stripe.position.set(0, 0.5, 0.1);
  group.add(stripe);

  addShadow(group);
  return group;
}

/** Saskatchewan raider — prairie outlaw */
export function createRaider() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.36, 4, 8), mat(RAIDER_GREEN));
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);

  const bandana = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.2), mat(0x8b0000));
  bandana.position.set(0, 0.68, 0.08);
  group.add(bandana);

  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 8), mat(0x4a3020));
  hat.position.y = 0.82;
  group.add(hat);

  addShadow(group);
  return group;
}

/** Polar bear from the Northwest Territories */
export function createPolarBear() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 5, 10), mat(0xf0f0f0));
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), mat(0xf5f5f5));
  head.position.set(0, 0.95, 0.28);
  group.add(head);

  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(0xdddddd));
  snout.position.set(0, 0.88, 0.48);
  group.add(snout);

  const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), mat(0xe8e8e8));
  ear1.position.set(-0.12, 1.1, 0.22);
  const ear2 = ear1.clone();
  ear2.position.x = 0.12;
  group.add(ear1, ear2);

  addShadow(group, 0.32);
  return group;
}

/** Giant BC rat — sneaks in from the coast */
export function createBcRat() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), mat(0x5a4a3a));
  body.scale.set(1.4, 0.8, 1.8);
  body.position.y = 0.18;
  body.castShadow = true;
  group.add(body);

  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.35, 6), mat(0x4a3a2a));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.28, 0.14, 0);
  group.add(tail);

  const ear1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), mat(0x6a5a4a));
  ear1.position.set(-0.08, 0.28, 0.12);
  const ear2 = ear1.clone();
  ear2.position.set(0.08, 0.28, 0.12);
  group.add(ear1, ear2);

  addShadow(group, 0.14);
  return group;
}

/** Smuggler crossing up from the States */
export function createBorderRunner() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.34, 4, 8), mat(0x8b7355));
  body.position.y = 0.38;
  body.castShadow = true;
  group.add(body);

  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.18), mat(0x2a4a2a));
  pack.position.set(0, 0.48, -0.12);
  group.add(pack);

  const sombrero = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12), mat(0xccaa44));
  sombrero.position.y = 0.72;
  group.add(sombrero);
  const sombreroTop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 10), mat(0xccaa44));
  sombreroTop.position.y = 0.82;
  group.add(sombreroTop);

  addShadow(group);
  return group;
}

/**
 * CF-18 Hornet — detailed mesh, nose points +Z (game forward).
 */
export function createFighterJet() {
  const jet = new THREE.Group();
  const body = 0x6a7a8a;
  const dark = 0x3a4550;
  const maple = 0xcc0000;

  // Fuselage
  jet.add(part(new THREE.CapsuleGeometry(0.22, 1.35, 6, 12), body, 0, 0, 0.1, Math.PI / 2, 0, 0));
  jet.add(part(new THREE.BoxGeometry(0.28, 0.26, 0.55), dark, 0, 0.02, -0.55));

  // Nose & cockpit
  jet.add(part(new THREE.ConeGeometry(0.2, 0.55, 10), body, 0, 0.04, 1.05, -Math.PI / 2, 0, 0));
  const canopy = part(new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x223344, 0, 0.18, 0.45);
  canopy.material.transparent = true;
  canopy.material.opacity = 0.85;
  jet.add(canopy);

  // Main wings
  const wingGeo = new THREE.BoxGeometry(2.1, 0.06, 0.55);
  const wing = part(wingGeo, body, 0, -0.02, 0.05);
  wing.rotation.z = 0.08;
  jet.add(wing);

  // Wing pylons
  jet.add(part(new THREE.BoxGeometry(0.08, 0.12, 0.35), 0x222222, -0.75, -0.1, 0.15));
  jet.add(part(new THREE.BoxGeometry(0.08, 0.12, 0.35), 0x222222, 0.75, -0.1, 0.15));
  // Bombs on pylons (visual)
  jet.add(part(new THREE.CylinderGeometry(0.07, 0.09, 0.38, 8), 0x1a1a1a, -0.75, -0.28, 0.15, 0, 0, Math.PI / 2));
  jet.add(part(new THREE.CylinderGeometry(0.07, 0.09, 0.38, 8), 0x1a1a1a, 0.75, -0.28, 0.15, 0, 0, Math.PI / 2));

  // Twin tail
  jet.add(part(new THREE.BoxGeometry(0.06, 0.42, 0.28), body, -0.14, 0.32, -0.72));
  jet.add(part(new THREE.BoxGeometry(0.06, 0.42, 0.28), body, 0.14, 0.32, -0.72));
  jet.add(part(new THREE.BoxGeometry(0.38, 0.06, 0.22), body, 0, 0.38, -0.78));

  // Engines
  jet.add(part(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 10), dark, -0.22, -0.08, -0.35, Math.PI / 2, 0, 0));
  jet.add(part(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 10), dark, 0.22, -0.08, -0.35, Math.PI / 2, 0, 0));

  // Maple leaf tail flash
  const leaf = part(new THREE.CircleGeometry(0.14, 10), maple, 0, 0.2, -0.88, -Math.PI / 2, 0, 0);
  jet.add(leaf);

  // Afterburner glow (animated via userData)
  const exhaust = part(new THREE.SphereGeometry(0.1, 8, 8), 0xff6622, 0, -0.02, -0.95);
  exhaust.material.emissive = 0xff4400;
  exhaust.material.emissiveIntensity = 0.6;
  jet.userData.exhaust = exhaust;
  jet.add(exhaust);

  jet.traverse((c) => {
    if (c.isMesh) c.castShadow = true;
  });

  return jet;
}
