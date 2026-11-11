import * as THREE from 'three';
import { spawnStatic, sizeOf } from './assets.js';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function box(w, h, d, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function roadTexture() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#565b6b'; g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 260; i++) {           // speckle + patches
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`;
    const s = 6 + Math.random() * 50;
    g.fillRect(Math.random() * c.width, Math.random() * c.height, s, s * (0.3 + Math.random()));
  }
  g.fillStyle = '#f4f1e6';                  // edge lines
  g.fillRect(0, 26, c.width, 12); g.fillRect(0, c.height - 38, c.width, 12);
  g.fillStyle = '#ffd23f';                  // dashed centre line
  for (let x = 30; x < c.width; x += 170) g.fillRect(x, c.height / 2 - 8, 96, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function makeCar(color) {
  const car = new THREE.Group();
  const body = mat(color, { roughness: 0.45 }), glass = mat(0xbfeaff, { roughness: 0.2 }), dark = mat(0x2b2d3a);
  box(4.2, 0.85, 1.9, body, 0, 0.75, 0, car);
  box(2.3, 0.75, 1.7, body, -0.2, 1.5, 0, car);
  box(2.0, 0.5, 1.74, glass, -0.2, 1.5, 0, car);
  box(0.12, 0.3, 1.5, mat(0xfff6b0, { emissive: 0xfff2a0, emissiveIntensity: 0.6 }), 2.1, 0.85, 0, car);
  box(0.12, 0.25, 1.5, mat(0xff5a5a), -2.1, 0.85, 0, car);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14); wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [[1.35, 0.95], [1.35, -0.95], [-1.35, 0.95], [-1.35, -0.95]]) {
    const w = new THREE.Mesh(wheelGeo, dark); w.position.set(x, 0.42, z); w.castShadow = true; car.add(w);
  }
  return car;
}

function makeTree() {
  const t = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 8), mat(0x9b6a43));
  trunk.position.y = 0.8; trunk.castShadow = true; t.add(trunk);
  const leaves = mat(0x57d16a);
  for (const [x, y, z, r] of [[0, 2.3, 0, 1.05], [0.6, 1.9, 0.2, 0.7], [-0.5, 2.0, -0.3, 0.75], [0, 3.0, 0.1, 0.7]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaves);
    b.position.set(x, y, z); b.castShadow = true; t.add(b);
  }
  box(1.3, 0.35, 1.3, mat(0xc98b5e), 0, 0.17, 0, t);
  return t;
}

function makeLamp() {
  const l = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 4, 8), mat(0x3d4663));
  pole.position.y = 2; pole.castShadow = true; l.add(pole);
  box(0.9, 0.08, 0.08, mat(0x3d4663), 0.4, 3.95, 0, l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(0xfff3b8, { emissive: 0xffe58a, emissiveIntensity: 1.2 }));
  bulb.position.set(0.85, 3.8, 0); l.add(bulb);
  return l;
}

function makeHydrant() {
  const h = new THREE.Group(), red = mat(0xff4d4d, { roughness: 0.5 });
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.7, 10), red); b.position.y = 0.35; b.castShadow = true; h.add(b);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), red); cap.position.y = 0.72; h.add(cap);
  box(0.62, 0.14, 0.14, red, 0, 0.45, 0, h);
  return h;
}

function makeBarrier(len) {
  const b = new THREE.Group();
  const n = Math.round(len / 1.0);
  for (let i = 0; i < n; i++) box(0.3, 0.5, len / n, mat(i % 2 ? 0xffffff : 0xff8a2a), 0, 0.95, -len / 2 + (i + 0.5) * (len / n), b);
  box(0.2, 0.9, 0.2, mat(0x555b70), 0, 0.45, -len / 2 + 0.3, b);
  box(0.2, 0.9, 0.2, mat(0x555b70), 0, 0.45, len / 2 - 0.3, b);
  return b;
}

/** Encounter 1 - Abandoned Street. */
export function buildStreet(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];   // {x, z, r, h}  vertical cylinders
  const occluders = [];   // meshes the camera should not clip through
  const bounds = { minX: -21, maxX: 21, minZ: -9.5, maxZ: 9.5 };

  // Ground: grass base, pavement, road
  const base = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), mat(0x86d46b));
  base.rotation.x = -Math.PI / 2; base.position.y = -0.02; base.receiveShadow = true; group.add(base);
  const pave = new THREE.Mesh(new THREE.PlaneGeometry(130, 24), mat(0xd7dde8));
  pave.rotation.x = -Math.PI / 2; pave.position.y = -0.005; pave.receiveShadow = true; group.add(pave);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(130, 12), new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.95 }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; group.add(road);
  for (const z of [6.15, -6.15]) box(130, 0.16, 0.3, mat(0xaab2c2), 0, 0.08, z, group);   // kerbs

  // Buildings along both sides
  const letters = 'abcdefgh';
  let n = 0;
  for (const side of [-1, 1]) {
    for (let x = -36; x <= 36; x += 9) {
      const key = 'building-' + letters[(n++ * 3 + (side > 0 ? 1 : 0)) % letters.length];
      const b = spawnStatic(key), s = sizeOf(key);
      const k = 8.6 / Math.max(s.x, s.z);
      b.scale.set(k, k * (0.9 + ((n * 7) % 5) * 0.12), k);
      b.position.set(x, 0, side * 16.2);
      b.rotation.y = side > 0 ? Math.PI : 0;
      group.add(b);
    }
  }
  // Skyscrapers closing off both ends of the street
  [['sky-a', -47, -5], ['sky-b', -47, 6], ['sky-c', 47, -6], ['sky-a', 47, 5], ['sky-b', -40, 26], ['sky-c', 40, -26]].forEach(([key, x, z]) => {
    const b = spawnStatic(key), s = sizeOf(key), k = 11 / Math.max(s.x, s.z);
    b.scale.setScalar(k); b.position.set(x, 0, z); b.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(b);
  });

  // Barricades at the street ends
  for (const x of [-22.6, 22.6]) {
    for (const z of [-7.5, -2.5, 2.5, 7.5]) { const b = makeBarrier(4.4); b.position.set(x, 0, z); group.add(b); }
  }

  // Cover: abandoned cars and crates
  const cars = [[-8, -2.2, 0.25, 0xff6b6b], [9, 2.6, Math.PI + 0.35, 0x4dabf7], [15.5, -6.9, Math.PI / 2, 0xffd43b]];
  for (const [x, z, rot, color] of cars) {
    const car = makeCar(color);
    car.position.set(x, 0, z); car.rotation.y = rot; group.add(car);
    car.traverse(o => { if (o.isMesh) occluders.push(o); });
    for (const d of [-1.15, 1.15]) colliders.push({ x: x + Math.cos(rot) * d, z: z - Math.sin(rot) * d, r: 1.25, h: 1.9 });
  }
  const crateK = 1.5 / sizeOf('crate').x;
  for (const [x, z, rot] of [[-14, 3.5, 0.3], [-12.6, 4.6, 1.1], [2, -6.6, 0.5], [3.4, 6.8, 0.2], [-2.5, 1.2, 0.8]]) {
    const c = spawnStatic('crate');
    c.scale.setScalar(crateK); c.position.set(x, 0, z); c.rotation.y = rot; group.add(c);
    c.traverse(o => { if (o.isMesh) occluders.push(o); });
    colliders.push({ x, z, r: 0.95, h: sizeOf('crate').y * crateK });
  }

  // Street furniture on the pavements
  for (const x of [-18, -6, 6, 18]) {
    for (const side of [-1, 1]) {
      const lamp = makeLamp(); lamp.position.set(x, 0, side * 8.9); lamp.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2; group.add(lamp);
      colliders.push({ x, z: side * 8.9, r: 0.25, h: 4 });
    }
  }
  for (const [x, z] of [[-11.5, 8.4], [11.5, -8.4], [0.5, 8.6], [-0.5, -8.6]]) {
    const t = makeTree(); t.position.set(x, 0, z); t.rotation.y = x; group.add(t);
    colliders.push({ x, z, r: 0.8, h: 3.5 });
  }
  for (const [x, z] of [[-4, 7.2], [13, 7.4], [-15.5, -7.3]]) {
    const h = makeHydrant(); h.position.set(x, 0, z); group.add(h);
    colliders.push({ x, z, r: 0.35, h: 0.9 });
  }

  // Spawn points: glowing manholes spread around the arena so zombies come from every direction
  const spawns = [[-18, -4.5], [18, 4.5], [-17, 6.5], [17, -4], [-5, -8], [6, 8], [0, -4.5], [-19, 1]].map(([x, z]) => ({ x, z }));
  const holeGeo = new THREE.CircleGeometry(0.95, 24); holeGeo.rotateX(-Math.PI / 2);
  const rimGeo = new THREE.RingGeometry(0.95, 1.2, 24); rimGeo.rotateX(-Math.PI / 2);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x1d2433 });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0x9dff5a });
  for (const s of spawns) {
    const hole = new THREE.Mesh(holeGeo, holeMat); hole.position.set(s.x, 0.02, s.z); group.add(hole);
    const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.set(s.x, 0.025, s.z); group.add(rim);
  }

  // Clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 4, 10, 8), cloudMat);
      p.position.set(j * 5 - 8, Math.random() * 2, Math.random() * 3); p.scale.y = 0.5; c.add(p);
    }
    c.position.set(-110 + i * 20 + Math.random() * 8, 48 + Math.random() * 16, -90 + ((i * 53) % 180));
    group.add(c);
  }

  // Places where power-ups can appear (clear of props)
  const pickupSpots = [[-10, 5.5], [10, -5.5], [-16, -1.5], [16, 1], [4, -2.5], [-7, 7], [10, 7.5], [-9, -7.5], [0, 0.5], [-18, 4]].map(([x, z]) => ({ x, z }));

  return { index: 1, name: 'Abandoned Street', group, bounds, colliders, occluders, spawns, pickupSpots, start: { x: 0, z: 3.5 } };
}
