import * as THREE from 'three';
import {
  MAP_HALF_X,
  MAP_HALF_Z,
  ALBERTA_HALF_X,
  ALBERTA_HALF_Z,
  ALBERTA_SHAPE,
  REGIONS,
  CELL,
  makeRegionLabel,
  pointInPolygon,
  getRegionAt,
  GRID_COLS,
  GRID_ROWS,
} from './albertaMap.js';
import { TERRAIN_TYPES, getRockiesBorderSamples, getAlbertaCellTerrain } from './terrainFeatures.js';
import { createSimpleMountain, addMountainToScene } from './mountains.js';
import { NATURE_ASSETS } from './assetLoader.js';

const Y_GROUND = 0;

export function createTerrain(scene, assetLoader) {
  createOceanBase(scene);
  createRegionLand(scene);
  createAlbertaBorder(scene);
  createPlayableGrid(scene);
  createMapFrame(scene);
  createWestBorderMountains(scene);
  createBcMountains(scene);
  createForestTrees(scene, assetLoader);
  createRegionLabels(scene);
  createAlbertaSky(scene);
  return { flat: true };
}

function createOceanBase(scene) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF_X * 2, MAP_HALF_Z * 2),
    new THREE.MeshLambertMaterial({ color: 0x1a2838, side: THREE.DoubleSide })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = Y_GROUND - 0.02;
  scene.add(mesh);
}

function prairieColor(cx, cz) {
  const patch = Math.sin(cx * 0.8 + cz * 1.0) * 0.5 + 0.5;
  return new THREE.Color().setHSL(0.11 + patch * 0.05, 0.42 + patch * 0.2, 0.38 + patch * 0.1).getHex();
}

function createRegionLand(scene) {
  const albertaGroup = new THREE.Group();
  const borderGroup = new THREE.Group();
  const lakeGroup = new THREE.Group();

  for (let x = -MAP_HALF_X; x < MAP_HALF_X; x++) {
    for (let z = -MAP_HALF_Z; z < MAP_HALF_Z; z++) {
      const cx = x + CELL / 2;
      const cz = z + CELL / 2;
      const region = getRegionAt(cx, cz);
      if (region === 'wilderness') continue;

      const isAlberta = region === 'alberta';
      const isBc = region === 'bc';
      let color = REGIONS[region].color;

      if (isBc) {
        color = TERRAIN_TYPES.mountain.tileColor;
      } else if (isAlberta) {
        const gx = Math.floor(cx + ALBERTA_HALF_X - CELL / 2);
        const gz = Math.floor(cz + ALBERTA_HALF_Z - CELL / 2);
        const terrain = getAlbertaCellTerrain(gx, gz) ?? 'prairie';

        if (terrain === 'lake') {
          const water = new THREE.Mesh(
            new THREE.PlaneGeometry(CELL * 0.96, CELL * 0.96),
            new THREE.MeshLambertMaterial({
              color: 0x4a9fd4,
              transparent: true,
              opacity: 0.92,
              side: THREE.DoubleSide,
            })
          );
          water.rotation.x = -Math.PI / 2;
          water.position.set(cx, Y_GROUND + 0.03, cz);
          lakeGroup.add(water);
          continue;
        }

        color = TERRAIN_TYPES[terrain]?.tileColor ?? prairieColor(cx, cz);
        if (terrain === 'prairie') color = prairieColor(cx, cz);
      }

      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.98, CELL * 0.98),
        new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
      );
      tile.rotation.x = -Math.PI / 2;
      tile.position.set(cx, Y_GROUND + (isAlberta ? 0.02 : 0.01), cz);
      tile.receiveShadow = true;

      if (isAlberta) albertaGroup.add(tile);
      else borderGroup.add(tile);
    }
  }

  scene.add(borderGroup);
  scene.add(albertaGroup);
  scene.add(lakeGroup);
}

function createPlayableGrid(scene) {
  const group = new THREE.Group();

  for (let gz = 0; gz < GRID_ROWS; gz++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      const cx = gx * CELL - ALBERTA_HALF_X + CELL / 2;
      const cz = gz * CELL - ALBERTA_HALF_Z + CELL / 2;
      if (!pointInPolygon(cx, cz)) continue;

      const terrain = getAlbertaCellTerrain(gx, gz) ?? 'prairie';

      const def = TERRAIN_TYPES[terrain];
      const cell = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL * 0.9, CELL * 0.9),
        new THREE.MeshBasicMaterial({
          color: def.gridTint,
          transparent: true,
          opacity: def.gridOpacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      cell.rotation.x = -Math.PI / 2;
      cell.position.set(cx, Y_GROUND + 0.04, cz);
      group.add(cell);
    }
  }
  scene.add(group);
}

function createAlbertaBorder(scene) {
  const points = ALBERTA_SHAPE.map((p) => new THREE.Vector3(p.x, Y_GROUND + 0.05, p.y));
  points.push(points[0].clone());
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: 0xf2cd00 })
    )
  );
}

function createMapFrame(scene) {
  const corners = [
    new THREE.Vector3(-MAP_HALF_X, Y_GROUND + 0.06, -MAP_HALF_Z),
    new THREE.Vector3(MAP_HALF_X, Y_GROUND + 0.06, -MAP_HALF_Z),
    new THREE.Vector3(MAP_HALF_X, Y_GROUND + 0.06, MAP_HALF_Z),
    new THREE.Vector3(-MAP_HALF_X, Y_GROUND + 0.06, MAP_HALF_Z),
    new THREE.Vector3(-MAP_HALF_X, Y_GROUND + 0.06, -MAP_HALF_Z),
  ];
  scene.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(corners),
      new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.45 })
    )
  );
}

function createWestBorderMountains(scene) {
  const group = new THREE.Group();
  const samples = getRockiesBorderSamples(0.95);

  samples.forEach((p, i) => {
    if (i % 2 !== 0) return;

    const scale = 1.4 + (i % 4) * 0.3 + (p.along ?? 0) * 0.45;
    const seed = i * 13.7 + p.x * 0.31 + p.z * 0.19;
    const yaw = (seed % 1) * Math.PI * 2;
    addMountainToScene(group, p.x, p.z, createSimpleMountain(scale, seed), yaw);
  });

  scene.add(group);
}

function createBcMountains(scene) {
  const group = new THREE.Group();
  let idx = 0;

  for (let x = -MAP_HALF_X; x < MAP_HALF_X; x += 2) {
    for (let z = -MAP_HALF_Z; z < MAP_HALF_Z; z += 2) {
      const cx = x + CELL / 2;
      const cz = z + CELL / 2;
      if (getRegionAt(cx, cz) !== 'bc') continue;

      const hash = Math.abs(Math.sin(x * 73.2 + z * 19.5) * 43758.5453) % 1;
      if (hash < 0.58) continue;

      const scale = 1.15 + hash * 1.05;
      const ox = (hash - 0.5) * 0.9;
      const oz = (hash * 0.61 - 0.3) * 0.9;
      const seed = idx * 9.13 + x * 0.17 + z * 0.23;
      addMountainToScene(group, cx + ox, cz + oz, createSimpleMountain(scale, seed), hash * Math.PI * 2);
      idx++;
    }
  }

  scene.add(group);
}

function addForestTree(group, cx, cz, hash, assetLoader) {
  const jitterX = (hash - 0.5) * 0.45;
  const jitterZ = (hash * 0.71 - 0.35) * 0.45;
  const treeScale = 1.05 + hash * 0.55;

  if (assetLoader?.cache.has(NATURE_ASSETS.trees[0])) {
    const pick = hash > 0.55 ? 2 + Math.floor(hash * 2) % 2 : Math.floor(hash * 2) % 2;
    const tree = assetLoader.createNature(NATURE_ASSETS.trees[pick], treeScale);
    if (tree) {
      tree.position.set(cx + jitterX, Y_GROUND, cz + jitterZ);
      group.add(tree);
      return;
    }
  }

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.85, 7),
    new THREE.MeshLambertMaterial({ color: 0x4a3020 })
  );
  trunk.position.set(cx + jitterX, 0.42, cz + jitterZ);
  trunk.castShadow = true;

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 1.15, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a5528 })
  );
  crown.position.set(cx + jitterX, 1.2, cz + jitterZ);
  crown.castShadow = true;

  const crown2 = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.75, 8),
    new THREE.MeshLambertMaterial({ color: 0x356832 })
  );
  crown2.position.set(cx + jitterX, 1.55, cz + jitterZ);

  group.add(trunk, crown, crown2);
}

function createForestTrees(scene, assetLoader) {
  const group = new THREE.Group();
  for (let gz = 0; gz < GRID_ROWS; gz++) {
    for (let gx = 0; gx < GRID_COLS; gx++) {
      if (getAlbertaCellTerrain(gx, gz) !== 'forest') continue;
      const cx = gx * CELL - ALBERTA_HALF_X + CELL / 2;
      const cz = gz * CELL - ALBERTA_HALF_Z + CELL / 2;
      if (!pointInPolygon(cx, cz)) continue;

      const hash = Math.sin(gx * 47.3 + gz * 91.1) * 43758.5453 % 1;
      if (hash < 0.28) continue;

      addForestTree(group, cx, cz, hash, assetLoader);

      if (hash > 0.62) {
        const hash2 = Math.sin(gx * 19.1 + gz * 53.7) * 43758.5453 % 1;
        addForestTree(group, cx + (hash2 - 0.5) * 0.5, cz + (hash2 * 0.8 - 0.4) * 0.5, hash2, assetLoader);
      }
    }
  }
  scene.add(group);
}

function createRegionLabels(scene) {
  const labels = [
    { text: 'Northwest Territories', x: 0, z: -(ALBERTA_HALF_Z + 1), color: '#e8f4ff', scale: 1 },
    { text: 'Montana', x: 0, z: ALBERTA_HALF_Z + 1, color: '#ddccaa', scale: 0.85 },
    { text: 'British Columbia', x: -(ALBERTA_HALF_X + 1), z: -6, color: '#a8d4ff', scale: 0.85 },
    { text: 'Saskatchewan', x: ALBERTA_HALF_X + 1, z: 0, color: '#f2cd00', scale: 0.85 },
  ];

  for (const l of labels) {
    const sprite = makeRegionLabel(l.text, l.color);
    sprite.position.set(l.x, 2, l.z);
    sprite.scale.multiplyScalar(l.scale);
    scene.add(sprite);
  }
}

function createAlbertaSky(scene) {
  scene.background = new THREE.Color(0x7eb8e6);
  scene.fog = new THREE.Fog(0xa8cce8, 60, 145);
}

export function setupLighting(scene) {
  scene.add(new THREE.AmbientLight(0xfff8ee, 0.62));

  const sun = new THREE.DirectionalLight(0xffe8c0, 1.1);
  sun.position.set(18, 36, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 90;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x88bbee, 0.3);
  fill.position.set(-16, 18, -10);
  scene.add(fill);
}
