import * as THREE from 'three';

function seededRandom(seed) {
  let s = Math.abs(Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453);
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function rockyMaterial(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

const COLORS = {
  grass: 0x3f6234,
  forest: 0x2f4a28,
  rock: 0x6a645c,
  rockDark: 0x524e48,
  snow: 0xf2f6fa,
};

/** Green foothills, grey rock slopes, snow cap. */
export function createSimpleMountain(scale, seed) {
  const group = new THREE.Group();
  const rng = seededRandom(seed);
  const height = scale * (2.1 + rng() * 1.1);
  const radius = scale * (0.65 + rng() * 0.2);
  const segments = 6;

  const greenH = height * 0.44;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.58, radius * 1.08, greenH, segments),
    rockyMaterial(rng() > 0.5 ? COLORS.grass : COLORS.forest)
  );
  base.position.y = greenH * 0.5;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const rockH = height * 0.36;
  const rockR = radius * 0.58;
  const rock = new THREE.Mesh(
    new THREE.ConeGeometry(rockR, rockH, segments),
    rockyMaterial(rng() > 0.4 ? COLORS.rock : COLORS.rockDark)
  );
  rock.position.y = greenH + rockH * 0.46;
  rock.castShadow = true;
  rock.receiveShadow = true;
  group.add(rock);

  const snowH = height * 0.26;
  const snow = new THREE.Mesh(
    new THREE.ConeGeometry(rockR * 0.44, snowH, segments),
    rockyMaterial(COLORS.snow)
  );
  snow.position.y = greenH + rockH * 0.82 + snowH * 0.42;
  snow.castShadow = true;
  group.add(snow);

  return group;
}

export function addMountainToScene(group, x, z, mountain, yaw = 0) {
  const mount = mountain.clone(true);
  mount.rotation.y = yaw;
  mount.position.set(x, 0, z);
  group.add(mount);
}
