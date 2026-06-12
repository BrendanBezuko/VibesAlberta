import * as THREE from 'three';
import { BUILDING_DEFS } from './resources.js';

const CELL = 1;
const AB_BLUE = 0x003f87;
const AB_GOLD = 0xf2cd00;
const PRAIRIE_GOLD = 0xd4a82a;
const BARN_RED = 0x8b2500;
const RCMP_RED = 0xcc0000;

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, emissive: 0x000000, ...opts });
}

function part(geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  return part(new THREE.BoxGeometry(w, h, d), color, x, y + h / 2, z);
}

function addShadow(group, w, d) {
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.92, d * 0.92),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
}

/** Alberta Legislature — Beaux-Arts dome & colonnade */
export function buildLegislature(group, w, d) {
  group.add(box(w * 0.98, 0.25, d * 0.98, 0x8a8a8a));
  group.add(box(w * 0.85, 0.55, d * 0.55, AB_BLUE, 0, 0.25, 0));
  group.add(box(w * 0.7, 0.35, d * 0.12, 0xeeeeee, 0, 0.55, d * 0.28));

  for (let i = -2; i <= 2; i++) {
    group.add(box(0.1, 0.55, 0.1, 0xdddddd, i * 0.22, 0.25, d * 0.3));
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(w * 0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    mat(AB_GOLD, { emissive: 0x332200 })
  );
  dome.position.set(0, 1.05, 0);
  group.add(dome);

  const cupola = part(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), 0x666666, 0, 1.35, 0);
  group.add(cupola);

  const flag = box(0.35, 0.18, 0.02, AB_GOLD, 0.2, 1.55, 0);
  group.add(flag);
  const pole = box(0.03, 0.9, 0.03, 0x888888, 0.05, 1.1, 0);
  group.add(pole);
}

/** Oil sands pumpjack — nodding donkey */
export function buildPumpjack(group, w, d) {
  group.add(box(w * 0.85, 0.12, d * 0.85, 0x3a3a3a));

  const samson = box(0.14, 1.1, 0.14, 0x2a2a2a, 0, 0.12, 0);
  group.add(samson);

  const pumpGroup = new THREE.Group();
  pumpGroup.position.set(0, 0.9, 0);

  const beam = box(1.1, 0.1, 0.12, 0x555555);
  pumpGroup.add(beam);

  const head = box(0.35, 0.55, 0.25, 0x1a1a1a, 0.42, 0.15, 0);
  pumpGroup.add(head);

  const counter = box(0.2, 0.35, 0.2, 0x444444, -0.42, -0.1, 0);
  pumpGroup.add(counter);

  const horse = box(0.08, 0.5, 0.08, 0xff6600, 0.42, -0.35, 0);
  pumpGroup.add(horse);

  group.add(pumpGroup);
  group.userData.pump = pumpGroup;

  group.add(box(0.5, 0.35, 0.5, 0x1a1a1a, w * 0.3, 0.12, d * 0.25));
  group.add(part(new THREE.CylinderGeometry(0.18, 0.2, 0.4, 10), 0x111111, -w * 0.25, 0.32, -d * 0.2));
}

/** Prairie wheat farm with red barn */
export function buildWheatFarm(group, w, d) {
  const soil = box(w * 0.98, 0.08, d * 0.98, 0x5c4520);
  group.add(soil);

  for (let row = -3; row <= 3; row++) {
    for (let col = -3; col <= 3; col++) {
      if (row > 1 && col > 0) continue;
      const h = 0.35 + ((row * 7 + col * 3) % 5) * 0.04;
      const stalk = box(0.05, h, 0.05, PRAIRIE_GOLD, col * 0.18, 0.08, row * 0.18);
      stalk.position.y = 0.08 + h / 2;
      group.add(stalk);
    }
  }

  group.add(box(w * 0.38, 0.55, d * 0.32, BARN_RED, -w * 0.22, 0.08, d * 0.18));
  const roof = part(new THREE.ConeGeometry(w * 0.3, 0.4, 4), 0x4a2010, -w * 0.22, 0.78, d * 0.18);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  const silo = part(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 10), 0xaaaaaa, -w * 0.05, 0.35, d * 0.28);
  group.add(silo);
}

/** Boreal lumber mill */
export function buildLumberMill(group, w, d) {
  group.add(box(w * 0.9, 0.18, d * 0.9, 0x5c3d2e));
  group.add(box(w * 0.55, 0.65, d * 0.42, 0x7a5c3e, 0, 0.18, 0));
  group.add(box(0.14, 0.75, 0.14, 0x333333, w * 0.28, 0.18, -d * 0.18));

  for (let i = 0; i < 4; i++) {
    const log = part(new THREE.CylinderGeometry(0.09, 0.1, 0.55, 7), 0x4a3020, -w * 0.3 + i * 0.2, 0.35, d * 0.28);
    log.rotation.z = Math.PI / 2;
    group.add(log);
  }

  const tree = part(new THREE.ConeGeometry(0.28, 0.7, 7), 0x2d5a27, w * 0.28, 0.55, d * 0.22);
  group.add(tree);
}

/** Oil tank farm — storage depot */
export function buildOilDepot(group, w, d) {
  group.add(box(w * 0.95, 0.12, d * 0.95, 0x444444));

  for (let i = 0; i < 3; i++) {
    const tank = part(
      new THREE.CylinderGeometry(w * 0.18, w * 0.2, 0.85, 12),
      0x2a2a2a,
      -w * 0.24 + i * w * 0.24,
      0.42,
      -d * 0.08
    );
    group.add(tank);
    const cap = part(new THREE.SphereGeometry(w * 0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x333333, -w * 0.24 + i * w * 0.24, 0.85, -d * 0.08);
    group.add(cap);
  }

  group.add(box(w * 0.35, 0.08, d * 0.55, 0xff6600, 0, 0.55, d * 0.22));
  group.add(box(0.08, 0.45, 0.08, 0x555555, w * 0.35, 0.22, d * 0.35));
}

/** Prairie grain elevator — iconic Alberta silhouette */
export function buildGrainElevator(group, w, d) {
  const silo = part(new THREE.CylinderGeometry(w * 0.28, w * 0.3, 1.5, 14), 0xb8b8b8, 0, 0.75, 0);
  group.add(silo);

  const roof = part(new THREE.ConeGeometry(w * 0.32, 0.45, 14), 0x888888, 0, 1.72, 0);
  group.add(roof);

  const annex = box(w * 0.45, 0.5, d * 0.35, 0x9a9a9a, w * 0.28, 0.25, 0);
  group.add(annex);

  group.add(box(w * 0.12, 0.12, d * 0.5, AB_GOLD, -w * 0.15, 0.9, 0));
}

/** RCMP detachment */
export function buildRCMPPost(group, w, d) {
  group.add(box(w * 0.92, 0.14, d * 0.92, 0xeeeeee));
  group.add(box(w * 0.78, 0.72, d * 0.58, RCMP_RED, 0, 0.14, 0));
  group.add(box(w * 0.82, 0.1, d * 0.62, 0x2a2a2a, 0, 0.9, 0));

  const badge = part(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16), AB_GOLD, 0, 0.55, d * 0.3);
  badge.rotation.x = Math.PI / 2;
  group.add(badge);

  group.add(box(0.04, 0.85, 0.04, 0x666666, w * 0.35, 0.55, d * 0.35));
  const mountieFlag = box(0.28, 0.16, 0.02, AB_GOLD, w * 0.35 + 0.12, 0.95, d * 0.35);
  group.add(mountieFlag);

  group.userData.propSlot = { x: w * 0.3, z: -d * 0.28, type: 'police_car' };
}

/** Ranch fence */
export function buildRanchFence(group, w, d) {
  group.add(box(0.09, 0.55, 0.09, 0x6b4423, -w * 0.38, 0, 0));
  group.add(box(0.09, 0.55, 0.09, 0x6b4423, w * 0.38, 0, 0));
  group.add(box(w * 0.82, 0.05, 0.05, 0x8b6914, 0, 0.38, 0));
  group.add(box(w * 0.82, 0.05, 0.05, 0x8b6914, 0, 0.18, 0));

  const wire = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.38, 0.008, 4, 24, Math.PI),
    mat(0x333333)
  );
  wire.rotation.x = Math.PI / 2;
  wire.position.y = 0.28;
  group.add(wire);
}

/** Cold Lake air wing hangar */
export function buildAirWing(group, w, d) {
  group.add(box(w * 0.95, 0.2, d * 0.95, 0x555555));
  group.add(box(w * 0.85, 0.55, d * 0.7, 0x667788, 0, 0.1, 0));

  const door = box(w * 0.55, 0.42, 0.06, 0x334455, 0, 0.21, d * 0.33);
  group.add(door);

  const tower = box(0.18, 0.9, 0.18, 0x444444, w * 0.32, 0.45, -d * 0.22);
  group.add(tower);

  const radar = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, 0.12), mat(0x8899aa));
  radar.position.set(w * 0.32, 0.95, -d * 0.22);
  group.add(radar);

  const stripe = box(w * 0.7, 0.06, 0.08, AB_BLUE, 0, 0.62, d * 0.3);
  group.add(stripe);
}

/** Rocky Mountain fire lookout */
export function buildLookout(group, w, d) {
  const rock = part(new THREE.DodecahedronGeometry(w * 0.38, 0), 0x6a6a6a, 0, 0.22, 0);
  rock.scale.set(1.2, 0.5, 1.1);
  group.add(rock);

  group.add(box(w * 0.35, 1.1, d * 0.35, 0x5c4030, 0, 0.35, 0));
  group.add(box(w * 0.5, 0.08, d * 0.5, AB_BLUE, 0, 1.0, 0));

  const cab = box(w * 0.42, 0.35, d * 0.42, 0xeeeeee, 0, 1.25, 0);
  group.add(cab);

  const scope = box(0.12, 0.08, 0.25, 0x222222, 0, 1.48, d * 0.18);
  group.add(scope);
  group.userData.scope = scope;

  const rail1 = box(w * 0.48, 0.04, 0.04, 0x444444, 0, 1.42, d * 0.2);
  const rail2 = box(w * 0.48, 0.04, 0.04, 0x444444, 0, 1.42, -d * 0.2);
  group.add(rail1, rail2);
}

export function createAlbertaBuilding(type, size) {
  const def = BUILDING_DEFS[type];
  const group = new THREE.Group();
  group.userData = { type, size, isAlberta: true };

  const w = size * CELL;
  const d = size * CELL;

  switch (type) {
    case 'hq': buildLegislature(group, w, d); break;
    case 'oil_rig': buildPumpjack(group, w, d); break;
    case 'wheat_farm': buildWheatFarm(group, w, d); break;
    case 'lumber_mill': buildLumberMill(group, w, d); break;
    case 'grain_silo': buildGrainElevator(group, w, d); break;
    case 'oil_depot': buildOilDepot(group, w, d); break;
    case 'rcmp_post': buildRCMPPost(group, w, d); break;
    case 'fence': buildRanchFence(group, w, d); break;
    case 'lookout': buildLookout(group, w, d); break;
    case 'air_wing': buildAirWing(group, w, d); break;
    default:
      group.add(box(w * 0.8, 0.6, d * 0.8, def.color));
  }

  addShadow(group, w, d);
  return group;
}
