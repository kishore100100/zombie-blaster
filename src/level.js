import * as THREE from 'three';
import { spawnStatic, sizeOf } from './assets.js';

// ---------- Shared building blocks ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function box(w, h, d, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function ground(w, d, material, y, parent) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2; m.position.y = y; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function signTexture(text, bg, fg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = fg; g.font = '700 74px Fredoka, "Trebuchet MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4, w - 40);
  });
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

function makeLamp(height = 4) {
  const l = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, height, 8), mat(0x3d4663));
  pole.position.y = height / 2; pole.castShadow = true; l.add(pole);
  box(0.9, 0.08, 0.08, mat(0x3d4663), 0.4, height - 0.05, 0, l);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat(0xfff3b8, { emissive: 0xffe58a, emissiveIntensity: 1.2 }));
  bulb.position.set(0.85, height - 0.2, 0); l.add(bulb);
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

/** Small helper that collects props, colliders and camera occluders for one level. */
function kit(group) {
  const colliders = [], occluders = [];
  const occlude = obj => obj.traverse(o => { if (o.isMesh) occluders.push(o); });
  return {
    colliders, occluders,
    car(x, z, rot, color) {
      const car = makeCar(color);
      car.position.set(x, 0, z); car.rotation.y = rot; group.add(car); occlude(car);
      for (const d of [-1.15, 0, 1.15]) colliders.push({ x: x + Math.cos(rot) * d, z: z - Math.sin(rot) * d, r: 1.25, h: 1.9 });
    },
    crate(x, z, rot) {
      const k = 1.5 / sizeOf('crate').x, c = spawnStatic('crate');
      c.scale.setScalar(k); c.position.set(x, 0, z); c.rotation.y = rot; group.add(c); occlude(c);
      colliders.push({ x, z, r: 0.95, h: sizeOf('crate').y * k });
    },
    tree(x, z) { const t = makeTree(); t.position.set(x, 0, z); t.rotation.y = x; group.add(t); colliders.push({ x, z, r: 0.8, h: 3.5 }); },
    lamp(x, z, rot, height = 4) { const l = makeLamp(height); l.position.set(x, 0, z); l.rotation.y = rot; group.add(l); colliders.push({ x, z, r: 0.25, h: height }); },
    solid(obj, x, z, r, h) { obj.position.set(x, 0, z); group.add(obj); occlude(obj); colliders.push({ x, z, r, h }); },
    /** Glowing floor markers where zombies climb out. */
    spawnMarkers(spawns, color = 0x9dff5a) {
      const holeGeo = new THREE.CircleGeometry(0.95, 24); holeGeo.rotateX(-Math.PI / 2);
      const rimGeo = new THREE.RingGeometry(0.95, 1.2, 24); rimGeo.rotateX(-Math.PI / 2);
      const holeMat = new THREE.MeshBasicMaterial({ color: 0x1d2433 }), rimMat = new THREE.MeshBasicMaterial({ color });
      for (const s of spawns) {
        const hole = new THREE.Mesh(holeGeo, holeMat); hole.position.set(s.x, 0.02, s.z); group.add(hole);
        const rim = new THREE.Mesh(rimGeo, rimMat); rim.position.set(s.x, 0.025, s.z); group.add(rim);
      }
    },
    buildingRow(keys, xs, z, rot, width = 8.6) {
      xs.forEach((x, i) => {
        const key = keys[i % keys.length], b = spawnStatic(key), s = sizeOf(key), k = width / Math.max(s.x, s.z);
        b.scale.set(k, k * (0.9 + ((i * 7) % 5) * 0.12), k);
        b.position.set(x, 0, z); b.rotation.y = rot; group.add(b);
      });
    },
    clouds(color = 0xffffff) {
      const cloudMat = new THREE.MeshBasicMaterial({ color, fog: false });
      for (let i = 0; i < 12; i++) {
        const c = new THREE.Group();
        for (let j = 0; j < 4; j++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 4, 10, 8), cloudMat);
          p.position.set(j * 5 - 8, Math.random() * 2, Math.random() * 3); p.scale.y = 0.5; c.add(p);
        }
        c.position.set(-110 + i * 20 + Math.random() * 8, 48 + Math.random() * 16, -90 + ((i * 53) % 180));
        group.add(c);
      }
    },
  };
}

const pts = list => list.map(([x, z]) => ({ x, z }));
const B = l => 'building-' + l;

// ---------- 1 · Abandoned Street ----------
function buildStreet(scene) {
  const group = new THREE.Group(); scene.add(group);
  const K = kit(group);

  ground(300, 300, mat(0x86d46b), -0.02, group);
  ground(130, 24, mat(0xd7dde8), -0.005, group);
  const roadTex = canvasTexture(2048, 512, (g, w, h) => {
    g.fillStyle = '#565b6b'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`;
      const s = 6 + Math.random() * 50;
      g.fillRect(Math.random() * w, Math.random() * h, s, s * (0.3 + Math.random()));
    }
    g.fillStyle = '#f4f1e6'; g.fillRect(0, 26, w, 12); g.fillRect(0, h - 38, w, 12);
    g.fillStyle = '#ffd23f';
    for (let x = 30; x < w; x += 170) g.fillRect(x, h / 2 - 8, 96, 16);
  });
  ground(130, 12, new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 }), 0, group);
  for (const z of [6.15, -6.15]) box(130, 0.16, 0.3, mat(0xaab2c2), 0, 0.08, z, group);

  const xs = [-36, -27, -18, -9, 0, 9, 18, 27, 36];
  K.buildingRow(['a', 'd', 'g', 'b', 'e', 'h', 'c', 'f'].map(B), xs, -16.2, 0);
  K.buildingRow(['e', 'h', 'c', 'f', 'a', 'd', 'g', 'b'].map(B), xs, 16.2, Math.PI);
  [['sky-a', -47, -5], ['sky-b', -47, 6], ['sky-c', 47, -6], ['sky-a', 47, 5], ['sky-b', -40, 26], ['sky-c', 40, -26]].forEach(([key, x, z]) => {
    const b = spawnStatic(key), s = sizeOf(key), k = 11 / Math.max(s.x, s.z);
    b.scale.setScalar(k); b.position.set(x, 0, z); b.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; group.add(b);
  });
  for (const x of [-22.6, 22.6]) for (const z of [-7.5, -2.5, 2.5, 7.5]) { const b = makeBarrier(4.4); b.position.set(x, 0, z); group.add(b); }

  K.car(-8, -2.2, 0.25, 0xff6b6b); K.car(9, 2.6, Math.PI + 0.35, 0x4dabf7); K.car(15.5, -6.9, Math.PI / 2, 0xffd43b);
  for (const [x, z, rot] of [[-14, 3.5, 0.3], [-12.6, 4.6, 1.1], [2, -6.6, 0.5], [3.4, 6.8, 0.2], [-2.5, 1.2, 0.8]]) K.crate(x, z, rot);
  for (const x of [-18, -6, 6, 18]) for (const side of [-1, 1]) K.lamp(x, side * 8.9, side > 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const [x, z] of [[-11.5, 8.4], [11.5, -8.4], [0.5, 8.6], [-0.5, -8.6]]) K.tree(x, z);
  for (const [x, z] of [[-4, 7.2], [13, 7.4], [-15.5, -7.3]]) { const h = makeHydrant(); h.position.set(x, 0, z); group.add(h); K.colliders.push({ x, z, r: 0.35, h: 0.9 }); }

  const spawns = pts([[-18, -4.5], [18, 4.5], [-17, 6.5], [17, -4], [-5, -8], [6, 8], [0, -4.5], [-19, 1]]);
  K.spawnMarkers(spawns);
  K.clouds();

  return {
    name: 'Abandoned Street', group, colliders: K.colliders, occluders: K.occluders, spawns,
    bounds: { minX: -21, maxX: 21, minZ: -9.5, maxZ: 9.5 }, camPad: { x: 1.2, z: 1.6 },
    pickupSpots: pts([[-10, 5.5], [10, -5.5], [-16, -1.5], [16, 1], [4, -2.5], [-7, 7], [10, 7.5], [-9, -7.5], [0, 0.5], [-18, 4]]),
    start: { x: 0, z: 3.5 }, startYaw: 0, exitYaw: -Math.PI / 2, hpMult: 1,
    waves: [[['walker', 5]], [['walker', 5], ['runner', 3]], [['walker', 4], ['runner', 3], ['brute', 1]]],
    env: { sky: 0x8fd3ff, fog: 0xbfe8ff, fogNear: 45, fogFar: 130, sun: 0xfff1d0, sunI: 2.4, sunPos: [16, 30, 14], hemiSky: 0xffffff, hemiGround: 0x9fd67a, hemiI: 1.7 },
  };
}

// ---------- 2 · Shopping Mall ----------
function makeShop(name, color, awning) {
  const g = new THREE.Group(), w = 7.6, h = 4.6, d = 2.6;
  box(w, h, d, mat(color), 0, h / 2, -d / 2, g);                                                   // front face sits at z = 0
  box(4.2, 1.9, 0.14, mat(0xcff1ff, { emissive: 0x9fdcff, emissiveIntensity: 0.35, roughness: 0.2 }), -1.3, 1.65, 0.02, g);   // window
  box(1.6, 2.6, 0.14, mat(0x343a5a), 2.4, 1.3, 0.02, g);                                           // doorway
  const aw = box(w, 0.22, 1.5, mat(awning), 0, 3.05, 0.65, g); aw.rotation.x = 0.28;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.15), new THREE.MeshBasicMaterial({ map: signTexture(name, '#ffffff', '#' + new THREE.Color(awning).getHexString()) }));
  sign.position.set(0, 4.0, 0.03); g.add(sign);
  box(w, 3.4, d, mat(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45)), 0, h + 1.7, -d / 2, g);   // upper floor
  box(w, 0.5, 0.16, mat(0xffffff), 0, h + 0.5, 0.35, g);                                           // balcony rail
  for (const x of [-2.4, 0, 2.4]) box(1.3, 1.3, 0.1, mat(0xbfeaff, { roughness: 0.2 }), x, h + 2.0, 0.02, g);
  return g;
}

function buildMall(scene) {
  const group = new THREE.Group(); scene.add(group);
  const K = kit(group);

  ground(200, 200, mat(0xb9a6e8), -0.02, group);
  const tile = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#fff4e2'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd9c2'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    g.strokeStyle = 'rgba(160,120,110,.35)'; g.lineWidth = 3; g.strokeRect(0, 0, w / 2, h / 2); g.strokeRect(w / 2, h / 2, w / 2, h / 2);
  });
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping; tile.repeat.set(9, 7.5);
  ground(37, 30, new THREE.MeshStandardMaterial({ map: tile, roughness: 0.6 }), 0, group);

  // Shop fronts on all four sides
  const shops = [
    ['BURGERS', 0xffb3a7, 0xff5a4d], ['TOYS', 0xa7d8ff, 0x2f8fff], ['ICE CREAM', 0xffc9ec, 0xff5ab8], ['BOOKS', 0xc9f0b0, 0x3fae4a],
    ['SHOES', 0xffe3a3, 0xff9a1f], ['PETS', 0xcab8ff, 0x7a4dff], ['DONUTS', 0xffd0b0, 0xe8590c], ['GAMES', 0xa8f0e0, 0x0ca678],
    ['HATS', 0xffc2c2, 0xe03131], ['CANDY', 0xffd6f5, 0xd6336c], ['MUSIC', 0xb8e0ff, 0x1971c2], ['PLANTS', 0xd3f9c8, 0x2f9e44], ['PIZZA', 0xffe8b0, 0xf08c00], ['KITES', 0xc5f6fa, 0x0c8599],
  ];
  let si = 0;
  const place = (x, z, rot) => { const [n, c, a] = shops[si++ % shops.length]; const s = makeShop(n, c, a); s.position.set(x, 0, z); s.rotation.y = rot; group.add(s); };
  for (const x of [-11.4, -3.8, 3.8, 11.4]) { place(x, -14.4, 0); place(x, 14.4, Math.PI); }
  for (const z of [-7.6, 0, 7.6]) { place(18.4, z, -Math.PI / 2); place(-18.4, z, Math.PI / 2); }
  for (const [x, z] of [[-17, -13], [17, -13], [-17, 13], [17, 13]]) box(3.4, 9, 3.4, mat(0xfff4e2), x * 1.03, 4.5, z * 1.05, group);   // corner pillars

  // Fountain in the middle
  const f = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.7, 28), mat(0xe9ecf5)); basin.position.y = 0.35; basin.castShadow = true; basin.receiveShadow = true; f.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.1, 28), mat(0x5ad8ff, { emissive: 0x2fb8ff, emissiveIntensity: 0.5, roughness: 0.15 })); water.position.y = 0.68; f.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 14), mat(0xe9ecf5)); pillar.position.y = 1.5; pillar.castShadow = true; f.add(pillar);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 20), mat(0xe9ecf5)); bowl.position.y = 2.7; bowl.castShadow = true; f.add(bowl);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), mat(0x9be7ff, { emissive: 0x5ad8ff, emissiveIntensity: 0.8 })); top.position.y = 3.2; f.add(top);
  K.solid(f, 0, 0, 3.0, 3.4);

  // Kiosks, benches, planters, crates
  for (const [x, z, c] of [[-10, 0, 0xff8787], [10, 0, 0x74c0fc]]) {
    const k = new THREE.Group();
    box(2.4, 1.2, 2.4, mat(0xffffff), 0, 0.6, 0, k);
    for (let i = 0; i < 4; i++) box(0.6, 0.25, 2.9, mat(i % 2 ? 0xffffff : c), -0.9 + i * 0.6, 2.6, 0, k);
    for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) box(0.12, 1.4, 0.12, mat(0x8d99ae), px, 1.9, pz, k);
    K.solid(k, x, z, 1.8, 2.8);
  }
  for (const [x, z, rot] of [[0, 5.2, 0], [0, -5.2, Math.PI], [5.4, 0, Math.PI / 2], [-5.4, 0, -Math.PI / 2]]) {
    const b = new THREE.Group();
    box(2.3, 0.18, 0.7, mat(0xd9a066), 0, 0.5, 0, b); box(2.3, 0.6, 0.14, mat(0xd9a066), 0, 0.95, -0.28, b);
    for (const px of [-0.95, 0.95]) box(0.14, 0.5, 0.6, mat(0x5c677d), px, 0.25, 0, b);
    b.rotation.y = rot;
    K.solid(b, x, z, 1.05, 1.2);
  }
  for (const [x, z] of [[-9, -6.5], [9, -6.5], [-9, 6.5], [9, 6.5]]) K.tree(x, z);
  for (const [x, z, rot] of [[-14, -10, 0.4], [13.6, 9.6, 1.0], [5.5, -9.5, 0.2]]) K.crate(x, z, rot);

  // Strings of party lights overhead
  const bulbGeo = new THREE.SphereGeometry(0.16, 8, 6);
  const bulbMats = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2].map(c => new THREE.MeshBasicMaterial({ color: c }));
  for (const z of [-8, 0, 8]) for (let i = 0; i <= 28; i++) {
    const x = -17 + i * (34 / 28), sag = Math.sin(i / 28 * Math.PI) * 1.6;
    const b = new THREE.Mesh(bulbGeo, bulbMats[i % bulbMats.length]); b.position.set(x, 8.6 - sag, z); group.add(b);
  }

  // Zombies come out of the shop doorways
  const spawns = pts([[-9, -12.4], [6.2, -12.4], [-6.2, 12.4], [9, 12.4], [16.4, -5.2], [16.4, 10], [-16.4, 5.2], [-16.4, -10]]);
  K.spawnMarkers(spawns, 0xff8ad8);
  K.clouds(0xfff0fa);

  return {
    name: 'Shopping Mall', group, colliders: K.colliders, occluders: K.occluders, spawns,
    bounds: { minX: -17, maxX: 17, minZ: -13, maxZ: 13 }, camPad: { x: 0.9, z: 0.9 },
    pickupSpots: pts([[-6, -9], [6, -9], [-13, 4], [13, -4], [-5, 9], [6, 9], [0, -9.5], [-13.5, -6], [13.5, 6], [4.5, 4]]),
    start: { x: 0, z: 9.5 }, startYaw: 0, exitYaw: Math.PI / 2, hpMult: 1.15,
    waves: [
      [['walker', 5], ['runner', 2]],
      [['walker', 4], ['runner', 3], ['goozer', 2]],
      [['walker', 4], ['runner', 4], ['goozer', 2], ['brute', 1]],
    ],
    env: { sky: 0xc9b6ff, fog: 0xe2d4ff, fogNear: 40, fogFar: 120, sun: 0xfff6e0, sunI: 2.0, sunPos: [10, 32, 12], hemiSky: 0xffffff, hemiGround: 0xffd9c2, hemiI: 1.9 },
  };
}

// ---------- 3 · Parking Lot ----------
function buildParking(scene) {
  const group = new THREE.Group(); scene.add(group);
  const K = kit(group);

  ground(300, 300, mat(0x7fc96a), -0.02, group);
  const asphalt = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#4d5263'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + Math.random() * 0.05})`;
      const s = 3 + Math.random() * 22; g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(6, 4);
  ground(50, 32, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }), 0, group);

  // Painted parking bays (one instanced mesh)
  const lines = [];
  for (let x = -20.8; x <= 20.9; x += 3.2) { lines.push([x, -10.6, 5.2, 0.14], [x, 10.6, 5.2, 0.14]); }
  for (let x = -14.4; x <= 14.5; x += 3.2) lines.push([x, 0, 10.4, 0.14]);
  lines.push([0, 0, 0.14, 29], [0, -8, 0.14, 41.8], [0, 8, 0.14, 41.8]);          // centre divider + row fronts (stored as [x, z, lenZ, lenX])
  const lineMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshBasicMaterial({ color: 0xf4f1e6 }), lines.length);
  const m4 = new THREE.Matrix4();
  lines.forEach(([x, z, lz, lx], i) => { m4.makeScale(lx, 1, lz); m4.setPosition(x, 0.012, z); lineMesh.setMatrixAt(i, m4); });
  group.add(lineMesh);
  // yellow arrows / lane dashes
  for (const z of [-5.6, 5.6]) for (let x = -18; x <= 18; x += 6) { const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 0.22), new THREE.MeshBasicMaterial({ color: 0xffd23f })); d.position.set(x, 0.013, z); group.add(d); }

  // Parked cars = cover
  const colors = [0xff6b6b, 0x4dabf7, 0xffd43b, 0x69db7c, 0xda77f2, 0xff922b, 0x38d9a9, 0xf783ac, 0xe9ecef];
  let ci = 0;
  const up = Math.PI / 2, down = -Math.PI / 2;
  for (const x of [-19.2, -12.8, -6.4, 3.2, 12.8, 19.2]) K.car(x, -10.8, ci % 2 ? up : down, colors[ci++ % colors.length]);
  // the bay behind the start point stays empty so the camera has room
  for (const x of [-16, -9.6, 6.4, 16]) K.car(x, 10.8, ci % 2 ? up : down, colors[ci++ % colors.length]);
  for (const x of [-12.8, -3.2, 6.4]) K.car(x, -2.7, down, colors[ci++ % colors.length]);
  for (const x of [-9.6, 3.2, 12.8]) K.car(x, 2.7, up, colors[ci++ % colors.length]);

  // Light poles, ticket booth, trolley bay, crates
  K.lamp(-16.2, 0, 0, 6.5); K.lamp(16.2, 0, Math.PI, 6.5);
  const booth = new THREE.Group();
  box(2.4, 2.4, 2.4, mat(0xffe066), 0, 1.2, 0, booth); box(2.9, 0.25, 2.9, mat(0xff6b6b), 0, 2.55, 0, booth);
  box(1.6, 0.9, 0.1, mat(0xbfeaff, { roughness: 0.2 }), 0, 1.6, 1.22, booth);
  const arm = box(4.2, 0.16, 0.16, mat(0xffffff), 3.2, 1.1, 0.6, booth); arm.rotation.z = 0.25;
  K.solid(booth, -20.2, -5.9, 1.9, 2.7);
  const bay = new THREE.Group();
  for (const z of [-0.9, 0.9]) box(3.6, 0.9, 0.12, mat(0x4dabf7), 0, 0.55, z, bay);
  for (let i = 0; i < 3; i++) box(0.9, 0.55, 0.7, mat(0xced4da), -1.1 + i * 1.05, 0.65, 0, bay);
  K.solid(bay, 20, 5.9, 1.9, 1.2);
  for (const [x, z, rot] of [[-3, -6.5, 0.3], [9.5, 6.4, 0.9], [-20, 6.4, 0.1], [20.2, -1.5, 0.5]]) K.crate(x, z, rot);

  // Hedges around the lot, supermarket behind, city around
  const hedge = mat(0x4fbf5f);
  box(52, 1.3, 1.4, hedge, 0, 0.65, -15.2, group); box(52, 1.3, 1.4, hedge, 0, 0.65, 15.2, group);
  box(1.4, 1.3, 31, hedge, -24.6, 0.65, 0, group); box(1.4, 1.3, 31, hedge, 24.6, 0.65, 0, group);
  const market = new THREE.Group();
  box(44, 9, 9, mat(0xfff4e2), 0, 4.5, 0, market); box(44.4, 1.8, 9.4, mat(0xff5a4d), 0, 8.6, 0, market);
  box(10, 4, 0.2, mat(0xcff1ff, { emissive: 0x9fdcff, emissiveIntensity: 0.4, roughness: 0.2 }), 0, 2, 4.6, market);
  for (const x of [-15, 15]) box(9, 2.6, 0.2, mat(0xcff1ff, { roughness: 0.2 }), x, 2.6, 4.6, market);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 3.6), new THREE.MeshBasicMaterial({ map: signTexture('MEGA MART', '#ff5a4d', '#ffffff') }));
  sign.position.set(0, 8.6, 4.75); market.add(sign);
  market.position.set(0, 0, -24); group.add(market);
  const xs = [-36, -27, -18, -9, 0, 9, 18, 27, 36];
  K.buildingRow(['c', 'f', 'a', 'h', 'd', 'b', 'g', 'e'].map(B), xs, 25, Math.PI);
  K.buildingRow(['g', 'b', 'e', 'a'].map(B), [-16, -5.5, 5.5, 16], 0, 0);   // placeholder row, moved below
  // (re-position the last four as side streets)
  const side = group.children.slice(-4);
  side[0].position.set(-34, 0, -9); side[0].rotation.y = Math.PI / 2;
  side[1].position.set(-34, 0, 4); side[1].rotation.y = Math.PI / 2;
  side[2].position.set(34, 0, -6); side[2].rotation.y = -Math.PI / 2;
  side[3].position.set(34, 0, 7); side[3].rotation.y = -Math.PI / 2;

  const spawns = pts([[-21, -6], [21, -6.2], [-21, 2.5], [21, 2], [0, -6], [10, 6], [-9, 6], [-21, 9]]);
  K.spawnMarkers(spawns, 0xffe066);
  K.clouds(0xffe3d0);

  return {
    name: 'Parking Lot', group, colliders: K.colliders, occluders: K.occluders, spawns,
    bounds: { minX: -23, maxX: 23, minZ: -13.6, maxZ: 13.6 }, camPad: { x: 0.6, z: 0.6 },
    pickupSpots: pts([[-14, -6], [-6, -6], [6, -6], [15, -6], [-14, 6], [-4, 6], [5, 6], [15, 6], [-19.5, 0], [19.5, 0], [0, 0.2]]),
    start: { x: 0, z: 6 }, startYaw: 0, exitYaw: 0, hpMult: 1.3,
    waves: [
      [['walker', 5], ['runner', 3], ['goozer', 1]],
      [['walker', 5], ['runner', 4], ['goozer', 2], ['brute', 1]],
      [['walker', 5], ['runner', 5], ['goozer', 3], ['brute', 2]],
    ],
    env: { sky: 0xffb38a, fog: 0xffcfae, fogNear: 45, fogFar: 135, sun: 0xffc78a, sunI: 2.5, sunPos: [-22, 20, 12], hemiSky: 0xffe2d0, hemiGround: 0xb7c98a, hemiI: 1.6 },
  };
}

/** Chapter 1 - The Outbreak. Levels are built on first use and kept. */
export const LEVELS = [
  { name: 'Abandoned Street', build: buildStreet },
  { name: 'Shopping Mall', build: buildMall },
  { name: 'Parking Lot', build: buildParking },
];
