import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const KENNEY_BLASTER = 'assets/blaster-kit/Models/GLB format/';
const KENNEY_CITY = 'assets/city-kit/Models/GLB format/';

const FILES = {
  hunter: 'assets/characters/hunter/Rogue_Hooded.glb',
  zMinion: 'assets/characters/zombies/Skeleton_Minion.glb',
  zRogue: 'assets/characters/zombies/Skeleton_Rogue.glb',
  zWarrior: 'assets/characters/zombies/Skeleton_Warrior.glb',
  zMage: 'assets/characters/zombies/Skeleton_Mage.glb',
  blaster: KENNEY_BLASTER + 'blaster-g.glb',
  crate: KENNEY_BLASTER + 'crate-medium.glb',
  crateSmall: KENNEY_BLASTER + 'crate-small.glb',
};
'abcdefgh'.split('').forEach(l => { FILES['building-' + l] = KENNEY_CITY + `building-${l}.glb`; });
'abc'.split('').forEach(l => { FILES['sky-' + l] = KENNEY_CITY + `building-skyscraper-${l}.glb`; });

const cache = {};
const loader = new GLTFLoader();

export async function loadAll(onProgress) {
  const keys = Object.keys(FILES);
  let done = 0;
  await Promise.all(keys.map(async key => {
    const gltf = await loader.loadAsync(encodeURI(FILES[key]));
    gltf.scene.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = !o.isSkinnedMesh; if (o.isSkinnedMesh) o.frustumCulled = false; }
    });
    gltf.scene.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3());
    cache[key] = { scene: gltf.scene, clips: gltf.animations, size };
    onProgress(++done / keys.length);
  }));
}

export function sizeOf(key) { return cache[key].size; }

/** Animated character clone, scaled so it stands `height` units tall. */
export function spawnSkinned(key, height) {
  const src = cache[key];
  const obj = SkeletonUtils.clone(src.scene);
  obj.scale.setScalar(height / src.size.y);
  return { obj, clips: src.clips };
}

/** Static prop clone (shares geometry and materials). */
export function spawnStatic(key) {
  return cache[key].scene.clone(true);
}
