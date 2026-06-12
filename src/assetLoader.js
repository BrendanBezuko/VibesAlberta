import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Resolve public asset paths for local dev (/) and GitHub Pages (/repo-name/). */
const asset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

/**
 * KayKit CC0 props & environment only — buildings are custom Alberta models.
 * https://kaylousberg.itch.io/ · https://itch.io/game-assets/free/tag-3d
 */
export const PROP_ASSETS = {
  police_car: asset('/assets/city/gltf/car_police.gltf'),
  oil_barrel: asset('/assets/props/gltf/Barrel_A.gltf'),
  oil_barrel_b: asset('/assets/props/gltf/Barrel_B.gltf'),
};

export const NATURE_ASSETS = {
  mountains: [
    asset('/assets/nature/gltf/decoration/nature/mountain_A_grass.gltf'),
    asset('/assets/nature/gltf/decoration/nature/mountain_B_grass.gltf'),
    asset('/assets/nature/gltf/decoration/nature/mountain_C_grass.gltf'),
  ],
  trees: [
    asset('/assets/nature/gltf/decoration/nature/tree_single_A.gltf'),
    asset('/assets/nature/gltf/decoration/nature/tree_single_B.gltf'),
    asset('/assets/nature/gltf/decoration/nature/trees_A_small.gltf'),
    asset('/assets/nature/gltf/decoration/nature/trees_A_medium.gltf'),
  ],
  rocks: [
    asset('/assets/nature/gltf/decoration/nature/rock_single_A.gltf'),
    asset('/assets/nature/gltf/decoration/nature/rock_single_B.gltf'),
  ],
  hills: [
    asset('/assets/nature/gltf/decoration/nature/hill_single_A.gltf'),
    asset('/assets/nature/gltf/decoration/nature/hill_single_B.gltf'),
  ],
};

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

export class AssetLoader {
  constructor() {
    this.loader = new GLTFLoader();
    this.cache = new Map();
  }

  async loadAll(onProgress) {
    const paths = [
      ...Object.values(PROP_ASSETS),
      ...NATURE_ASSETS.mountains,
      ...NATURE_ASSETS.trees,
      ...NATURE_ASSETS.rocks,
      ...NATURE_ASSETS.hills,
    ];
    const unique = [...new Set(paths)];
    let done = 0;

    await Promise.all(
      unique.map(async (path) => {
        try {
          await this.load(path);
        } catch (err) {
          console.warn(`Optional asset missing: ${path}`, err.message);
        }
        done++;
        onProgress?.(done / unique.length, path);
      })
    );
  }

  async load(path) {
    if (this.cache.has(path)) return this.cache.get(path);

    const gltf = await new Promise((resolve, reject) => {
      this.loader.load(path, resolve, undefined, reject);
    });

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.cache.set(path, gltf);
    return gltf;
  }

  clone(path) {
    const gltf = this.cache.get(path);
    if (!gltf) return null;
    const object = gltf.scene.clone(true);
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return object;
  }

  createProp(path, scale = 1, rotationY = 0) {
    const object = this.clone(path);
    if (!object) return null;
    object.scale.setScalar(scale);
    object.rotation.y = rotationY;
    _box.setFromObject(object);
    object.position.y = -_box.min.y;
    return object;
  }

  createNature(path, scale = 1) {
    return this.createProp(path, scale, Math.random() * Math.PI * 2);
  }

  attachBuildingProps(buildingMesh, type) {
    const slot = buildingMesh.userData.propSlot;
    if (!slot) return;

    if (slot.type === 'police_car' && this.cache.has(PROP_ASSETS.police_car)) {
      const car = this.createProp(PROP_ASSETS.police_car, 0.55, Math.PI / 2);
      if (car) {
        car.position.set(slot.x, 0, slot.z);
        buildingMesh.add(car);
      }
    }

    if (type === 'oil_rig') {
      const offsets = [[0.35, 0.3], [-0.3, 0.35], [0.2, -0.35]];
      offsets.forEach(([x, z], i) => {
        const path = i % 2 ? PROP_ASSETS.oil_barrel_b : PROP_ASSETS.oil_barrel;
        if (!this.cache.has(path)) return;
        const barrel = this.createProp(path, 0.35);
        if (barrel) {
          barrel.position.set(x, 0, z);
          buildingMesh.add(barrel);
        }
      });
    }
  }
}
