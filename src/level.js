import * as THREE from 'three';
import { spawnStatic, sizeOf } from './assets.js';

// ---------- Shared building blocks ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });
const basic = color => new THREE.MeshBasicMaterial({ color });
const BRIGHT = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xda77f2, 0xff922b, 0x38d9a9, 0xf783ac];

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

function checker(a, b, line, rx, ry) {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    g.strokeStyle = line; g.lineWidth = 3; g.strokeRect(0, 0, w / 2, h / 2); g.strokeRect(w / 2, h / 2, w / 2, h / 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
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

function sign(text, bg, fg, w, h, x, y, z, parent, rotY = 0) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: signTexture(text, bg, fg), side: THREE.DoubleSide }));
  m.position.set(x, y, z); m.rotation.y = rotY; parent.add(m);
  return m;
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
  l.userData.bulb = bulb;
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

/** A market stall / kiosk with a striped awning. */
function makeStall(color) {
  const k = new THREE.Group();
  box(2.6, 1.1, 2.0, mat(0xffffff), 0, 0.55, 0, k);
  for (let i = 0; i < 5; i++) box(0.6, 0.22, 2.6, mat(i % 2 ? 0xffffff : color), -1.2 + i * 0.6, 2.7, 0, k);
  for (const [px, pz] of [[-1.2, -0.9], [1.2, -0.9], [-1.2, 0.9], [1.2, 0.9]]) box(0.12, 1.6, 0.12, mat(0x8d99ae), px, 1.9, pz, k);
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(BRIGHT[i % 8])); b.position.set(-0.9 + i * 0.36, 1.25, 0.3); k.add(b); }
  return k;
}

/** Collects props, colliders, camera occluders, hidden spawn points and little animations for one level. */
function kit(group) {
  const colliders = [], occluders = [], spawns = [], life = [];
  const occlude = obj => obj.traverse(o => { if (o.isMesh) occluders.push(o); });
  const K = {
    colliders, occluders, spawns, life,
    car(x, z, rot, color) {
      const car = makeCar(color);
      car.position.set(x, 0, z); car.rotation.y = rot; group.add(car); occlude(car);
      for (const d of [-1.15, 0, 1.15]) colliders.push({ x: x + Math.cos(rot) * d, z: z - Math.sin(rot) * d, r: 1.25, h: 1.9 });
      return car;
    },
    crate(x, z, rot) {
      const k = 1.5 / sizeOf('crate').x, c = spawnStatic('crate');
      c.scale.setScalar(k); c.position.set(x, 0, z); c.rotation.y = rot; group.add(c); occlude(c);
      colliders.push({ x, z, r: 0.95, h: sizeOf('crate').y * k });
    },
    tree(x, z) { const t = makeTree(); t.position.set(x, 0, z); t.rotation.y = x; group.add(t); colliders.push({ x, z, r: 0.8, h: 3.5 }); },
    lamp(x, z, rot, height = 4) { const l = makeLamp(height); l.position.set(x, 0, z); l.rotation.y = rot; group.add(l); colliders.push({ x, z, r: 0.25, h: height }); return l; },
    solid(obj, x, z, r, h) { obj.position.set(x, 0, z); group.add(obj); occlude(obj); colliders.push({ x, z, r, h }); return obj; },
    /** A row of circles = one long solid obstacle. */
    wall(x1, z1, x2, z2, r, h) {
      const len = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(len / (r * 1.2)));
      for (let i = 0; i <= n; i++) colliders.push({ x: x1 + (x2 - x1) * i / n, z: z1 + (z2 - z1) * i / n, r, h });
    },
    /**
     * Hidden spawn: zombies start out of sight behind a doorway at (x, z) and walk out along the normal (nx, nz).
     * `prop` draws a dark doorway there; `back` = how far behind the opening they start; `reach` = how far they walk in.
     */
    door(x, z, nx, nz, { prop = true, back = 1.5, reach = 3.2 } = {}) {
      if (prop) {
        const d = new THREE.Group();
        box(1.9, 2.9, 0.2, mat(0xf1f3f5), 0, 1.45, 0, d);
        box(1.5, 2.6, 0.24, mat(0x23263a), 0, 1.3, 0.02, d);
        d.position.set(x + nx * 0.06, 0, z + nz * 0.06); d.rotation.y = Math.atan2(nx, nz); group.add(d);
      }
      spawns.push({ x: x + nx * reach, z: z + nz * reach, from: { x: x - nx * back, z: z - nz * back } });
    },
    /** Hidden spawn where a zombie pops up from behind cover (no marker on the ground). */
    rise(x, z) { spawns.push({ x, z }); },
    /** Kenney buildings; returns the centre of each front wall so doors can be put on them. */
    buildings(keys, places, rot, width = 8.6) {
      return places.map(([x, z], i) => {
        const key = keys[i % keys.length], b = spawnStatic(key), s = sizeOf(key), k = width / Math.max(s.x, s.z);
        b.scale.set(k, k * (0.9 + ((i * 7) % 5) * 0.12), k);
        b.position.set(x, 0, z); b.rotation.y = rot; group.add(b);
        const nx = Math.sin(rot), nz = Math.cos(rot), half = s.z * k / 2;
        return { x: x + nx * half, z: z + nz * half, nx, nz };
      });
    },
    clouds(color = 0xffffff) {
      const cloudMat = new THREE.MeshBasicMaterial({ color, fog: false }), all = [];
      for (let i = 0; i < 12; i++) {
        const c = new THREE.Group();
        for (let j = 0; j < 4; j++) {
          const p = new THREE.Mesh(new THREE.SphereGeometry(4 + Math.random() * 4, 10, 8), cloudMat);
          p.position.set(j * 5 - 8, Math.random() * 2, Math.random() * 3); p.scale.y = 0.5; c.add(p);
        }
        c.position.set(-110 + i * 20 + Math.random() * 8, 48 + Math.random() * 16, -90 + ((i * 53) % 180));
        group.add(c); all.push(c);
      }
      life.push(dt => { for (const c of all) { c.position.x += dt * 1.2; if (c.position.x > 130) c.position.x = -130; } });
    },
    /** A little flock circling overhead. */
    birds(cx, cz, radius, height, n = 5) {
      const flock = new THREE.Group(), wingGeo = new THREE.BoxGeometry(0.9, 0.05, 0.28), m = basic(0x343a55), birds = [];
      for (let i = 0; i < n; i++) {
        const b = new THREE.Group(), l = new THREE.Mesh(wingGeo, m), r = new THREE.Mesh(wingGeo, m);
        l.position.x = -0.42; r.position.x = 0.42; b.add(l, r);
        b.userData = { a: i * 1.1, r: radius * (0.7 + (i % 3) * 0.2), h: height + (i % 2) * 2.5, l, r2: r, s: 0.35 + (i % 3) * 0.06 };
        flock.add(b); birds.push(b);
      }
      group.add(flock);
      life.push((dt, t) => {
        for (const b of birds) {
          const u = b.userData; u.a += dt * u.s;
          b.position.set(cx + Math.cos(u.a) * u.r, u.h + Math.sin(t * 0.7 + u.a) * 0.8, cz + Math.sin(u.a) * u.r);
          b.rotation.y = -u.a;
          const flap = Math.sin(t * 9 + u.a * 3) * 0.6; u.l.rotation.z = flap; u.r2.rotation.z = -flap;
        }
      });
    },
    /** A bunch of balloons bobbing on strings. */
    balloons(x, z, n = 3) {
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.36, 12, 10), mat(BRIGHT[(i * 3 + ((x * 7) | 0) + 8) % 8], { roughness: 0.3 }));
        b.scale.y = 1.2; b.position.set((i - (n - 1) / 2) * 0.5, 3.1 + (i % 2) * 0.45, (i % 2) * 0.25);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 4), basic(0xffffff)); s.position.set(b.position.x * 0.6, 1.9, 0);
        g.add(b, s);
      }
      g.position.set(x, 0, z); group.add(g);
      const ph = x * 1.3 + z;
      life.push((dt, t) => { g.position.y = Math.sin(t * 1.6 + ph) * 0.18; g.rotation.z = Math.sin(t * 1.1 + ph) * 0.06; });
    },
    /** Rows of coloured party lights as one instanced mesh. */
    bunting(rows, x1, x2, y, sag, count = 34) {
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.17, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), rows.length * (count + 1));
      const m4 = new THREE.Matrix4(), col = new THREE.Color();
      let n = 0;
      for (const z of rows) for (let i = 0; i <= count; i++) {
        m4.makeTranslation(x1 + (x2 - x1) * i / count, y - Math.sin(i / count * Math.PI) * sag, z);
        mesh.setMatrixAt(n, m4); mesh.setColorAt(n, col.set(BRIGHT[i % 5])); n++;
      }
      group.add(mesh);
    },
    spin(obj, speed) { life.push(dt => { obj.rotation.y += dt * speed; }); },
  };
  return K;
}

/** Wrap a level up: keep spawn entry points inside the arena and expose the animation hook. */
function finish(level, K) {
  const b = level.bounds;
  for (const s of K.spawns) {
    s.x = THREE.MathUtils.clamp(s.x, b.minX + 0.8, b.maxX - 0.8);
    s.z = THREE.MathUtils.clamp(s.z, b.minZ + 0.8, b.maxZ - 0.8);
  }
  return { ...level, colliders: K.colliders, occluders: K.occluders, spawns: K.spawns, update(dt, t, G) { for (const f of K.life) f(dt, t, G); } };
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
  const north = K.buildings(['a', 'd', 'g', 'b', 'e', 'h', 'c', 'f'].map(B), xs.map(x => [x, -16.2]), 0);
  const south = K.buildings(['e', 'h', 'c', 'f', 'a', 'd', 'g', 'b'].map(B), xs.map(x => [x, 16.2]), Math.PI);
  // Zombies shamble out of the front doors of the houses along the street
  for (const f of [...north, ...south]) if (Math.abs(f.x) < 20) K.door(f.x + ((f.x * 13) % 3) - 1, f.z, f.nx, f.nz);
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
  K.rise(-19.5, -8.2); K.rise(19.5, 8.2);        // ...and a couple crawl out from behind the barricades
  K.clouds(); K.birds(0, 0, 16, 15);

  return finish({
    name: 'Abandoned Street', group,
    bounds: { minX: -21, maxX: 21, minZ: -9.5, maxZ: 9.5 }, camPad: { x: 1.2, z: 1.6 },
    pickupSpots: pts([[-10, 5.5], [10, -5.5], [-16, -1.5], [16, 1], [4, -2.5], [-7, 7], [10, 7.5], [-9, -7.5], [0, 0.5], [-18, 4]]),
    start: { x: 0, z: 3.5 }, startYaw: 0, exitYaw: -Math.PI / 2, hpMult: 1,
    waves: [[['walker', 5]], [['walker', 5], ['runner', 3]], [['walker', 4], ['runner', 3], ['brute', 1]]],
    env: { sky: 0x8fd3ff, fog: 0xbfe8ff, fogNear: 45, fogFar: 130, sun: 0xfff1d0, sunI: 2.4, sunPos: [16, 30, 14], hemiSky: 0xffffff, hemiGround: 0x9fd67a, hemiI: 1.7 },
  }, K);
}

// ---------- 2 · Shopping Mall ----------
function makeShop(name, color, awning) {
  const g = new THREE.Group(), w = 7.6, h = 4.6, d = 2.6;
  box(w, h, d, mat(color), 0, h / 2, -d / 2, g);                                                   // front face sits at z = 0
  box(4.2, 1.9, 0.14, mat(0xcff1ff, { emissive: 0x9fdcff, emissiveIntensity: 0.35, roughness: 0.2 }), -1.3, 1.65, 0.02, g);   // window
  box(1.6, 2.6, 0.14, mat(0x23263a), 2.4, 1.3, 0.02, g);                                           // doorway
  const aw = box(w, 0.22, 1.5, mat(awning), 0, 3.05, 0.65, g); aw.rotation.x = 0.28;
  sign(name, '#ffffff', '#' + new THREE.Color(awning).getHexString(), 5.2, 1.15, 0, 4.0, 0.03, g);
  box(w, 3.4, d, mat(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45)), 0, h + 1.7, -d / 2, g);   // upper floor
  box(w, 0.5, 0.16, mat(0xffffff), 0, h + 0.5, 0.35, g);                                           // balcony rail
  for (const x of [-2.4, 0, 2.4]) box(1.3, 1.3, 0.1, mat(0xbfeaff, { roughness: 0.2 }), x, h + 2.0, 0.02, g);
  return g;
}

function buildMall(scene) {
  const group = new THREE.Group(); scene.add(group);
  const K = kit(group);

  ground(240, 240, mat(0xb9a6e8), -0.02, group);
  ground(60, 44, new THREE.MeshStandardMaterial({ map: checker('#fff4e2', '#ffd9c2', 'rgba(160,120,110,.35)', 15, 11), roughness: 0.6 }), 0, group);

  // Shops on all four sides - every shop doorway is a place zombies can wander out of
  const shops = [
    ['BURGERS', 0xffb3a7, 0xff5a4d], ['TOYS', 0xa7d8ff, 0x2f8fff], ['ICE CREAM', 0xffc9ec, 0xff5ab8], ['BOOKS', 0xc9f0b0, 0x3fae4a],
    ['SHOES', 0xffe3a3, 0xff9a1f], ['PETS', 0xcab8ff, 0x7a4dff], ['DONUTS', 0xffd0b0, 0xe8590c], ['GAMES', 0xa8f0e0, 0x0ca678],
    ['HATS', 0xffc2c2, 0xe03131], ['CANDY', 0xffd6f5, 0xd6336c], ['MUSIC', 0xb8e0ff, 0x1971c2], ['PLANTS', 0xd3f9c8, 0x2f9e44],
    ['PIZZA', 0xffe8b0, 0xf08c00], ['KITES', 0xc5f6fa, 0x0c8599], ['COMICS', 0xffd8a8, 0xd9480f], ['SOCKS', 0xe5dbff, 0x7048e8],
    ['TEA', 0xd8f5a2, 0x5c940d], ['BIKES', 0xa5d8ff, 0x1864ab], ['CAKES', 0xfcc2d7, 0xc2255c], ['GADGETS', 0x96f2d7, 0x087f5b],
    ['PUZZLES', 0xffec99, 0xe67700], ['ROBOTS', 0xbac8ff, 0x3b5bdb],
  ];
  let si = 0;
  const place = (x, z, rot) => {
    const [n, c, a] = shops[si++ % shops.length], s = makeShop(n, c, a);
    s.position.set(x, 0, z); s.rotation.y = rot; group.add(s);
    const nx = Math.sin(rot), nz = Math.cos(rot);                       // door is 2.4 to the shop's right
    K.door(x + Math.cos(rot) * 2.4, z - Math.sin(rot) * 2.4, nx, nz, { prop: false, back: 1.4, reach: 3 });
  };
  for (const x of [-22.8, -15.2, -7.6, 0, 7.6, 15.2, 22.8]) { place(x, -19.2, 0); place(x, 19.2, Math.PI); }
  for (const z of [-11.4, -3.8, 3.8, 11.4]) { place(27.6, z, -Math.PI / 2); place(-27.6, z, Math.PI / 2); }
  for (const [x, z] of [[-28.6, -19.8], [28.6, -19.8], [-28.6, 19.8], [28.6, 19.8]]) box(4.4, 9, 4.4, mat(0xfff4e2), x, 4.5, z, group);

  // Fountain in the middle, with a little spray
  const f = new THREE.Group();
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.3, 0.7, 28), mat(0xe9ecf5)); basin.position.y = 0.35; basin.castShadow = true; basin.receiveShadow = true; f.add(basin);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 28), mat(0x5ad8ff, { emissive: 0x2fb8ff, emissiveIntensity: 0.5, roughness: 0.15 })); water.position.y = 0.68; f.add(water);
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.2, 14), mat(0xe9ecf5)); pillar.position.y = 1.5; pillar.castShadow = true; f.add(pillar);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.4, 0.4, 20), mat(0xe9ecf5)); bowl.position.y = 2.7; bowl.castShadow = true; f.add(bowl);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), mat(0x9be7ff, { emissive: 0x5ad8ff, emissiveIntensity: 0.8 })); top.position.y = 3.2; f.add(top);
  K.solid(f, 0, 0, 3.4, 3.4);
  const sprayAt = new THREE.Vector3(0, 3.5, 0);
  let sprayT = 0;
  K.life.push((dt, t, G) => { sprayT -= dt; if (sprayT <= 0) { sprayT = 0.09; G.fx.burst(sprayAt, 0x9be7ff, 2, 1.6, 4.5, 0.8); } });

  // Carousel that keeps turning
  const car = new THREE.Group(), ride = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.3, 24), mat(0xff8787)); base.position.y = 0.15; base.receiveShadow = true; car.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.6, 10), mat(0xffe066)); pole.position.y = 1.9; ride.add(pole);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 1.3, 12), mat(0x4dabf7)); roof.position.y = 4.2; roof.castShadow = true; ride.add(roof);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    box(0.5, 0.7, 0.9, mat(BRIGHT[i]), Math.cos(a) * 1.7, 1.0, Math.sin(a) * 1.7, ride).rotation.y = -a;
    box(0.06, 2.6, 0.06, mat(0xffffff), Math.cos(a) * 1.7, 2.3, Math.sin(a) * 1.7, ride);
  }
  car.add(ride);
  K.solid(car, -16, 8.5, 2.7, 4.5);
  K.spin(ride, 0.7);

  // Food court with parasol tables
  for (const [x, z, c] of [[14, -9.5, 0xff6b6b], [18.8, -6, 0xffd43b], [20.2, -12, 0x69db7c], [15, 8, 0x4dabf7], [20, 11, 0xda77f2]]) {
    const t = new THREE.Group();
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 16), mat(0xffffff)); tt.position.y = 0.85; tt.castShadow = true; t.add(tt);
    const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.7, 8), mat(0x8d99ae)); tp.position.y = 1.35; t.add(tp);
    const um = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 10), mat(c)); um.position.y = 2.9; um.castShadow = true; t.add(um);
    for (const a of [0.6, 2.7, 4.8]) box(0.45, 0.5, 0.45, mat(c), Math.cos(a) * 1.25, 0.25, Math.sin(a) * 1.25, t);
    K.solid(t, x, z, 1.25, 3.2);
  }
  for (const [x, z, c] of [[-12, -1, 0xff8787], [12, 1, 0x74c0fc], [-17, -11, 0xffd43b]]) { K.solid(makeStall(c), x, z, 1.8, 2.8); K.balloons(x + 1.6, z + 1.1); }
  for (const [x, z, rot] of [[0, 5.8, 0], [0, -5.8, Math.PI], [6, 0, Math.PI / 2], [-6, 0, -Math.PI / 2], [-22, 0, Math.PI / 2], [22, -0.5, -Math.PI / 2]]) {
    const b = new THREE.Group();
    box(2.3, 0.18, 0.7, mat(0xd9a066), 0, 0.5, 0, b); box(2.3, 0.6, 0.14, mat(0xd9a066), 0, 0.95, -0.28, b);
    for (const px of [-0.95, 0.95]) box(0.14, 0.5, 0.6, mat(0x5c677d), px, 0.25, 0, b);
    b.rotation.y = rot;
    K.solid(b, x, z, 1.05, 1.2);
  }
  for (const [x, z] of [[-22, 14], [22, -15.5], [-7, -12], [7, 12.5], [-22.5, -5.5], [23, 5]]) K.tree(x, z);
  for (const [x, z, rot] of [[-10, -14, 0.4], [10.5, 14.5, 1.0], [5.5, -13.5, 0.2], [-3, 13, 0.7]]) K.crate(x, z, rot);
  K.balloons(-4.5, -15.5, 4); K.balloons(9, 16, 4); K.balloons(24, -3); K.balloons(-24, 9);
  K.bunting([-14, -7, 0, 7, 14], -27, 27, 9.2, 2.2, 44);
  K.clouds(0xfff0fa);

  return finish({
    name: 'Shopping Mall', group,
    bounds: { minX: -25.6, maxX: 25.6, minZ: -17.4, maxZ: 17.4 }, camPad: { x: 1, z: 1 },
    pickupSpots: pts([[-6, -12], [8, -14], [-20, -3], [22, 4], [-6, 12], [9, 5], [0, -9], [0, 9], [-21, -14], [22, 15], [-9, 4], [9, -4], [-11, 14]]),
    start: { x: 0, z: 12.5 }, startYaw: 0, exitYaw: Math.PI / 2, hpMult: 1.15,
    waves: [
      [['walker', 6], ['runner', 3]],
      [['walker', 5], ['runner', 4], ['goozer', 2]],
      [['walker', 5], ['runner', 5], ['goozer', 3], ['brute', 1]],
    ],
    env: { sky: 0xc9b6ff, fog: 0xe2d4ff, fogNear: 45, fogFar: 135, sun: 0xfff6e0, sunI: 2.0, sunPos: [10, 32, 12], hemiSky: 0xffffff, hemiGround: 0xffd9c2, hemiI: 1.9 },
  }, K);
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
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(9, 6);
  ground(68, 44, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.95 }), 0, group);

  // Four rows of bays; some hold parked cars, and zombies pop up out of some of the empty ones
  const rows = [[-16.2, -Math.PI / 2], [-2.7, -Math.PI / 2], [2.7, Math.PI / 2], [16.2, Math.PI / 2]];
  const lines = [], hazards = [];
  let ci = 0;
  rows.forEach(([z, rot], ri) => {
    for (let i = 0; i <= 17; i++) {
      const x = -27.2 + i * 3.2;
      lines.push([x - 1.6, z, 5.2, 0.14]);
      const blocked = Math.abs(x) < 2.5 && ri > 0;                       // keep the start area and its sight-line open
      const filled = !blocked && ((i * 7 + ri * 3 + ((i * i) % 3)) % 5) < 2;
      if (filled) {
        const car = K.car(x, z, rot, [...BRIGHT, 0xe9ecef][ci++ % 9]);
        if (ci % 5 === 0) for (const s of [-0.8, 0.8]) hazards.push(box(0.2, 0.14, 0.3, basic(0xffa94d), 2.05, 1.0, s, car));
      } else if (!blocked && (i + ri * 2) % 4 === 1 && Math.abs(z) > 5) K.rise(x, z);
    }
  });
  lines.push([0, -13.5, 0.14, 58], [0, 13.5, 0.14, 58], [0, 0, 0.14, 58]);
  const lineMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), basic(0xf4f1e6), lines.length);
  const m4 = new THREE.Matrix4();
  lines.forEach(([x, z, lz, lx], i) => { m4.makeScale(lx, 1, lz); m4.setPosition(x, 0.012, z); lineMesh.setMatrixAt(i, m4); });
  group.add(lineMesh);
  for (const z of [-9.4, 9.4]) for (let x = -26; x <= 26; x += 6.5) { const d = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.02, 0.24), basic(0xffd23f)); d.position.set(x, 0.013, z); group.add(d); }
  K.life.push((dt, t) => { const on = (t * 2) % 1 < 0.5; for (const h of hazards) h.visible = on; });

  // A broken-down bus and a food truck in the driving lanes
  const bus = new THREE.Group();
  box(9.5, 2.5, 2.5, mat(0xffd43b, { roughness: 0.5 }), 0, 1.75, 0, bus); box(9.6, 0.9, 2.54, mat(0xbfeaff, { roughness: 0.2 }), 0, 2.2, 0, bus);
  box(9.6, 0.25, 2.56, mat(0x343a40), 0, 0.75, 0, bus);
  const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 14); wheelGeo.rotateX(Math.PI / 2);
  for (const [x, z] of [[3.2, 1.2], [3.2, -1.2], [-3.2, 1.2], [-3.2, -1.2]]) { const w = new THREE.Mesh(wheelGeo, mat(0x2b2d3a)); w.position.set(x, 0.55, z); bus.add(w); }
  bus.position.set(-15, 0, 9.4); bus.rotation.y = 0.12; group.add(bus); bus.traverse(o => { if (o.isMesh) K.occluders.push(o); });
  K.wall(-19.2, 9.9, -10.8, 8.9, 1.5, 3);
  K.door(-15.5, 7.9, 0, -1, { prop: false, back: 1.5, reach: 2.5 });           // out of the bus door
  const truck = new THREE.Group();
  box(5.2, 2.4, 2.3, mat(0xff8787, { roughness: 0.5 }), 0, 1.7, 0, truck); box(1.6, 1.5, 2.2, mat(0xffffff), 3.2, 1.25, 0, truck);
  box(3.4, 0.14, 1.5, mat(0xffffff), -0.3, 2.3, 1.7, truck).rotation.x = 0.25;
  box(3, 1, 0.1, mat(0x343a40), -0.3, 1.7, 1.17, truck);
  for (const [x, z] of [[2.9, 1.1], [2.9, -1.1], [-1.6, 1.1], [-1.6, -1.1]]) { const w = new THREE.Mesh(wheelGeo, mat(0x2b2d3a)); w.position.set(x, 0.5, z); truck.add(w); }
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 12), mat(0xffe8cc)); cone.position.set(-0.5, 4.3, 0); cone.rotation.x = Math.PI; truck.add(cone);
  const scoop = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), mat(0xff9ecb)); scoop.position.set(-0.5, 5.2, 0); truck.add(scoop);
  truck.position.set(15, 0, -9.6); group.add(truck); truck.traverse(o => { if (o.isMesh) K.occluders.push(o); });
  K.wall(12.6, -9.6, 18.6, -9.6, 1.45, 3);
  K.life.push((dt, t) => { scoop.position.y = 5.2 + Math.sin(t * 2) * 0.12; cone.rotation.y = scoop.rotation.y = t * 0.8; });
  K.balloons(11.4, -7.6, 4);

  // Lamps (one flickers), ticket booth with a swinging barrier, trolley bays, cones, crates
  const flick = K.lamp(-22, -9.6, 0, 6.5);
  K.lamp(22, 9.6, Math.PI, 6.5); K.lamp(4, -9.6, 0, 6.5); K.lamp(-4, 9.6, Math.PI, 6.5);
  K.life.push((dt, t) => { flick.userData.bulb.material.emissiveIntensity = Math.sin(t * 23) * Math.sin(t * 7.3) > 0.2 ? 1.3 : 0.15; });
  const booth = new THREE.Group();
  box(2.4, 2.4, 2.4, mat(0xffe066), 0, 1.2, 0, booth); box(2.9, 0.25, 2.9, mat(0xff6b6b), 0, 2.55, 0, booth);
  box(1.6, 0.9, 0.1, mat(0xbfeaff, { roughness: 0.2 }), 0, 1.6, 1.22, booth);
  const armPivot = new THREE.Group(); armPivot.position.set(1.3, 1.1, 0.6); booth.add(armPivot);
  box(4.2, 0.16, 0.16, mat(0xffffff), 2.1, 0, 0, armPivot);
  K.solid(booth, -28.5, -9.4, 1.9, 2.7);
  K.life.push((dt, t) => { armPivot.rotation.z = 0.35 + Math.sin(t * 0.9) * 0.35; });
  for (const [x, z] of [[27.5, 9.4], [27.5, -9.6]]) {
    const bay = new THREE.Group();
    for (const zz of [-0.9, 0.9]) box(3.6, 0.9, 0.12, mat(0x4dabf7), 0, 0.55, zz, bay);
    for (let i = 0; i < 3; i++) box(0.9, 0.55, 0.7, mat(0xced4da), -1.1 + i * 1.05, 0.65, 0, bay);
    K.solid(bay, x, z, 1.9, 1.2);
  }
  const coneGeo = new THREE.ConeGeometry(0.28, 0.75, 10), coneMat = mat(0xff8a2a);
  for (const [x, z] of [[-9, 6.6], [-7.6, 7.4], [-21.5, 7.2], [9.5, -6.8], [20.5, -7], [1, -8]]) { const c = new THREE.Mesh(coneGeo, coneMat); c.position.set(x, 0.38, z); c.castShadow = true; group.add(c); }
  for (const [x, z, rot] of [[-6, -9.8, 0.3], [8.5, 9.9, 0.9], [-27.5, 6, 0.1], [24, -4.5, 0.5], [-2, 7.5, 1.2]]) K.crate(x, z, rot);

  // Hedges with gaps the horde squeezes through, the supermarket behind, the city around
  const hedge = mat(0x4fbf5f);
  const hedgeRow = (z, gaps) => { let x = -34; for (const g of [...gaps, 99]) { const end = Math.min(34, g - 1.6); if (end > x) box(end - x, 1.3, 1.4, hedge, (x + end) / 2, 0.65, z, group); x = g + 1.6; } };
  const hedgeCol = (x, gaps) => { let z = -22; for (const g of [...gaps, 99]) { const end = Math.min(22, g - 1.6); if (end > z) box(1.4, 1.3, end - z, hedge, x, 0.65, (z + end) / 2, group); z = g + 1.6; } };
  hedgeRow(-21.6, [-2.6, 2.6]); hedgeRow(21.6, [-18, 12]); hedgeCol(-33.2, [-3, 13]); hedgeCol(33.2, [-12, 4]);
  for (const x of [-18, 12]) K.door(x, 21.6, 0, -1, { prop: false, back: 3, reach: 4 });
  for (const z of [-3, 13]) K.door(-33.2, z, 1, 0, { prop: false, back: 3, reach: 4 });
  for (const z of [-12, 4]) K.door(33.2, z, -1, 0, { prop: false, back: 3, reach: 4 });
  const market = new THREE.Group();
  box(50, 9, 9, mat(0xfff4e2), 0, 4.5, 0, market); box(50.4, 1.8, 9.4, mat(0xff5a4d), 0, 8.6, 0, market);
  box(10, 4, 0.2, mat(0x23263a), 0, 2, 4.6, market);
  for (const x of [-17, 17]) box(11, 2.6, 0.2, mat(0xcff1ff, { roughness: 0.2 }), x, 2.6, 4.6, market);
  sign('MEGA MART', '#ff5a4d', '#ffffff', 16, 3.6, 0, 8.6, 4.75, market);
  market.position.set(0, 0, -31); group.add(market);
  for (const x of [-2.6, 2.6]) K.door(x, -26.4, 0, 1, { prop: false, back: 1.5, reach: 8 });   // out of the supermarket entrance
  const xs = [-45, -36, -27, -18, -9, 0, 9, 18, 27, 36, 45];
  K.buildings(['c', 'f', 'a', 'h', 'd', 'b', 'g', 'e'].map(B), xs.map(x => [x, 32]), Math.PI);
  K.buildings(['g', 'b', 'e', 'a'].map(B), [-16, -5, 6, 17].map(z => [-43, z]), Math.PI / 2);
  K.buildings(['d', 'h', 'c', 'f'].map(B), [-16, -5, 6, 17].map(z => [43, z]), -Math.PI / 2);
  K.clouds(0xffe3d0); K.birds(0, 0, 22, 17, 7);

  return finish({
    name: 'Parking Lot', group,
    bounds: { minX: -31, maxX: 31, minZ: -19.4, maxZ: 19.4 }, camPad: { x: 0.8, z: 0.8 },
    pickupSpots: pts([[-24, -9.4], [-12, -9.4], [0, -11], [9, -11.5], [24, -11], [-25, 9.4], [-6.5, 11], [4, 11.5], [14, 9.4], [22, 12], [-29.5, 0], [29.5, 0], [0, 0.2]]),
    start: { x: 0, z: 8.6 }, startYaw: 0, exitYaw: 0, hpMult: 1.3,
    waves: [
      [['walker', 6], ['runner', 3], ['goozer', 2]],
      [['walker', 6], ['runner', 5], ['goozer', 2], ['brute', 1]],
      [['walker', 6], ['runner', 6], ['goozer', 3], ['brute', 2]],
    ],
    env: { sky: 0xffb38a, fog: 0xffcfae, fogNear: 50, fogFar: 150, sun: 0xffc78a, sunI: 2.5, sunPos: [-22, 20, 12], hemiSky: 0xffe2d0, hemiGround: 0xb7c98a, hemiI: 1.6 },
  }, K);
}

// ---------- 4 · Supermarket ----------
function buildMarket(scene) {
  const group = new THREE.Group(); scene.add(group);
  const K = kit(group);

  ground(240, 240, mat(0xdfe6f5), -0.02, group);
  ground(58, 42, new THREE.MeshStandardMaterial({ map: checker('#f7fbff', '#cfe6ff', 'rgba(90,120,170,.25)', 14, 10), roughness: 0.5 }), 0, group);

  // Walls with the Mega Mart red band
  const wallMat = mat(0xfff4e2), band = mat(0xff5a4d);
  const wallSeg = (w, d, x, z) => { box(w, 7, d, wallMat, x, 3.5, z, group); box(w + 0.1, 0.9, d + 0.1, band, x, 5.4, z, group); };
  wallSeg(58, 1, 0, -19); wallSeg(1, 39, -28, 0); wallSeg(1, 39, 28, 0);
  for (const x of [-17, 17]) wallSeg(24, 1, x, 19);
  box(10, 2.4, 1, wallMat, 0, 5.8, 19, group);
  box(10, 4.4, 0.2, mat(0xcff1ff, { roughness: 0.2, transparent: true, opacity: 0.4 }), 0, 2.2, 19.1, group);

  // Hidden ways in: stock-room doors along the back, staff doors on the sides, and the front entrance
  for (const x of [-21, -7, 7, 21]) K.door(x, -18.5, 0, 1, { reach: 3 });
  sign('STOCK ROOM', '#343a55', '#ffffff', 5, 1, 0, 3.6, -18.45, group);
  K.door(0, -18.5, 0, 1, { reach: 3 });
  for (const [x, nx] of [[-27.5, 1], [27.5, -1]]) for (const z of [-14.5, 12.5]) K.door(x, z, nx, 0, { reach: 3 });
  K.door(0, 19.4, 0, -1, { prop: false, back: 3, reach: 3.5 });

  // Six aisles of shelves full of colourful products (one instanced mesh for all the products)
  const shelfXs = [-17.5, -10.5, -3.5, 3.5, 10.5, 17.5], names = ['FRUIT', 'SNACKS', 'CEREAL', 'DRINKS', 'SWEETS', 'PASTA'];
  const N = 14, perShelf = 2 * 3 * N;
  const products = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.52, 0.56), mat(0xffffff, { roughness: 0.6 }), shelfXs.length * perShelf);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  let pi = 0;
  shelfXs.forEach((x, si) => {
    K.occluders.push(box(1.3, 2.7, 10.8, mat(0xe9ecf5), x, 1.35, -4, group));
    box(1.5, 0.12, 11, mat(0x8d99ae), x, 2.76, -4, group);
    for (const side of [-1, 1]) for (let lv = 0; lv < 3; lv++) for (let i = 0; i < N; i++) {
      m4.makeTranslation(x + side * 0.7, 0.5 + lv * 0.85, -8.9 + i * 0.75);
      products.setMatrixAt(pi, m4);
      products.setColorAt(pi, col.set(BRIGHT[(i * 3 + lv * 5 + si * 2 + (side > 0 ? 1 : 0)) % 8]));
      pi++;
    }
    K.wall(x, -8.9, x, 0.9, 0.9, 2.8);
    sign(names[si], '#ffffff', '#ff5a4d', 3.4, 0.85, x, 4.6, 1.8, group);
    box(0.05, 2.2, 0.05, mat(0x8d99ae), x, 6.1, 1.8, group);
  });
  products.castShadow = true; group.add(products);

  // Checkouts with blinking SALE signs
  const sales = [];
  shelfXs.forEach((x, i) => {
    const c = new THREE.Group();
    box(1.2, 1.0, 3.2, mat(0xced4da), 0, 0.5, 0, c); box(0.9, 0.06, 2.4, mat(0x343a40), 0, 1.03, -0.2, c);
    box(0.6, 0.5, 0.5, mat(0x4dabf7), 0, 1.3, 1.2, c);
    c.position.set(x, 0, 10.4); group.add(c); c.traverse(o => { if (o.isMesh) K.occluders.push(o); });
    K.wall(x, 9.2, x, 11.6, 0.85, 1.6);
    if (i % 2 === 0) sales.push(sign('SALE', '#ffe066', '#e03131', 2.2, 0.8, x, 3.6, 10.4, group));
    else K.balloons(x + 0.9, 11.6, 2);
  });
  K.life.push((dt, t) => sales.forEach((s, i) => { s.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.12); s.rotation.z = Math.sin(t * 3 + i) * 0.08; }));

  // Fruit stands, bakery and deli counters, freezers, promo stacks
  for (const [x, z] of [[-22.5, 4.5], [22.5, 4.5], [0, 5]]) {
    const s = new THREE.Group();
    box(2.4, 0.9, 2.4, mat(0xd9a066), 0, 0.45, 0, s);
    for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), mat(BRIGHT[i % 4])); b.position.set(-0.8 + (i % 4) * 0.53, 1.05, -0.8 + ((i / 4) | 0) * 0.53); s.add(b); }
    K.solid(s, x, z, 1.6, 1.3);
  }
  for (const [x, name, rot] of [[-26.6, 'BAKERY', Math.PI / 2], [26.6, 'DELI', -Math.PI / 2]]) {
    box(1.4, 1.1, 14, mat(0xffe8cc), x, 0.55, -5, group); box(1.5, 0.1, 14.1, mat(0xd9a066), x, 1.15, -5, group);
    sign(name, '#ff5a4d', '#ffffff', 6, 1.3, x + (x < 0 ? -0.8 : 0.8), 4.2, -5, group, rot);
    for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(x < 0 ? 0xe8a45c : 0xff8fa3)); b.scale.y = 0.6; b.position.set(x, 1.4, -10.5 + i * 1.8); group.add(b); }
  }
  for (const x of [-14, 14]) { box(9, 1.2, 1.3, mat(0xcff1ff, { roughness: 0.2 }), x, 0.6, -17.6, group); box(9, 0.1, 1.3, mat(0x4dabf7), x, 1.25, -17.6, group); }
  for (const [x, z, rot] of [[-14, 5.5, 0.3], [14, 5.6, 0.6], [-7, 14.5, 1.0], [7.5, 14.8, 0.2], [-23, -12, 0.5], [23.2, -11.5, 0.9]]) K.crate(x, z, rot);

  // Strip lights and slowly turning ceiling fans
  const lightMat = basic(0xffffff);
  for (const x of [-21, -14, -7, 0, 7, 14, 21]) for (const z of [-11, -1, 9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 5), lightMat); l.position.set(x, 7.6, z); group.add(l); }
  for (const [x, z] of [[-14, 5], [0, -4], [14, 5], [-21, -12], [21, -12], [0, 13]]) {
    const fan = new THREE.Group();
    for (let i = 0; i < 3; i++) { const b = box(2.6, 0.06, 0.45, mat(0x8d99ae), 1.3, 0, 0, new THREE.Group()); b.parent.rotation.y = i * 2.094; fan.add(b.parent); }
    box(0.08, 1, 0.08, mat(0x8d99ae), 0, 0.5, 0, fan);
    fan.position.set(x, 6.4, z); group.add(fan);
    K.spin(fan, 2.2);
  }

  return finish({
    name: 'Supermarket', group,
    bounds: { minX: -25.6, maxX: 25.6, minZ: -16.8, maxZ: 16.8 }, camPad: { x: 0.6, z: 0.8 },
    pickupSpots: pts([[-21, -6], [-14, -2], [-7, -7], [0, -3], [7, -7], [14, -2], [21, -6], [-7, 6], [7, 6], [-21, 13], [21, 13], [0, 14.5], [-14, -13.5], [14, -13.5]]),
    start: { x: 0, z: 12.6 }, startYaw: 0, exitYaw: Math.PI, hpMult: 1.45,
    waves: [
      [['walker', 7], ['runner', 4], ['goozer', 2]],
      [['walker', 6], ['runner', 6], ['goozer', 3], ['brute', 1]],
      [['walker', 7], ['runner', 6], ['goozer', 4], ['brute', 2]],
    ],
    env: { sky: 0xeaf2ff, fog: 0xeaf2ff, fogNear: 60, fogFar: 160, sun: 0xffffff, sunI: 2.0, sunPos: [6, 34, 10], hemiSky: 0xffffff, hemiGround: 0xdfe6f5, hemiI: 2.0 },
  }, K);
}

// ---------- 5 · City Square (boss) ----------
function buildSquare(scene) {
  const group = new THREE.Group(); scene.add(group);
  const K = kit(group);

  ground(300, 300, mat(0x7fc96a), -0.02, group);
  const paving = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e8dccb'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#dccdb6' : '#efe5d6'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  });
  paving.wrapS = paving.wrapT = THREE.RepeatWrapping; paving.repeat.set(17, 14);
  ground(68, 56, new THREE.MeshStandardMaterial({ map: paving, roughness: 0.8 }), 0, group);
  for (const [r1, r2, c] of [[8.4, 9, 0xff8a2a], [14.4, 14.8, 0xffd43b]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 72), basic(c)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; group.add(ring); }

  // The city all around; the townsfolk-turned-zombies come out of the front doors
  const xs = [-36, -27, -18, -9, 0, 9, 18, 27, 36], zs = [-22.5, -13.5, -4.5, 4.5, 13.5, 22.5];
  const fronts = [
    ...K.buildings(['a', 'd', 'g', 'b', 'e', 'h', 'c'].map(B), xs.filter(x => x).map(x => [x, -32.5]), 0),
    ...K.buildings(['e', 'h', 'c', 'f', 'a', 'd', 'g'].map(B), xs.map(x => [x, 32.5]), Math.PI),
    ...K.buildings(['f', 'b', 'h', 'c', 'a', 'e'].map(B), zs.map(z => [-38.5, z]), Math.PI / 2),
    ...K.buildings(['d', 'g', 'b', 'e', 'c', 'h'].map(B), zs.map(z => [38.5, z]), -Math.PI / 2),
  ];
  fronts.forEach((f, i) => { if (i % 3 !== 1 && Math.abs(f.x) < 34 && Math.abs(f.z) < 30) K.door(f.x, f.z, f.nx, f.nz, { reach: 8 }); });

  // Clock tower with a turning hand
  const tower = new THREE.Group();
  box(5, 15, 5, mat(0xffe3a3), 0, 7.5, 0, tower); box(6, 1, 6, mat(0xff8a2a), 0, 15.5, 0, tower);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4, 4.5, 4), mat(0xff5a4d)); roof.position.y = 18.2; roof.rotation.y = Math.PI / 4; tower.add(roof);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.7, 28), basic(0xffffff)); face.position.set(0, 12, 2.52); tower.add(face);
  const hands = new THREE.Group(); hands.position.set(0, 12, 2.56); tower.add(hands);
  box(0.16, 1.3, 0.05, mat(0x343a40), 0, 0.6, 0, hands);
  const hour = new THREE.Group(); hour.position.set(0, 12, 2.57); tower.add(hour); box(0.18, 0.9, 0.05, mat(0x343a40), 0, 0.4, 0, hour); hour.rotation.z = -1.1;
  tower.position.set(0, 0, -30.5); group.add(tower);
  K.life.push(dt => { hands.rotation.z -= dt * 0.5; });

  // Stone pillars = cover from the boss
  for (const [x, z] of [[-10, -7], [10, -7], [-10, 8], [10, 8], [-21, 0.5], [21, 0.5]]) {
    const p = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.05, 4.6, 14), mat(0xe9ecf5)); c.position.y = 2.3; c.castShadow = true; p.add(c);
    box(2.6, 0.5, 2.6, mat(0xced4da), 0, 0.25, 0, p);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 14, 10), mat(0xffe066, { emissive: 0xffc400, emissiveIntensity: 0.6 })); orb.position.y = 5.2; p.add(orb);
    K.solid(p, x, z, 1.35, 5);
    K.life.push((dt, t) => { orb.material.emissiveIntensity = 0.5 + Math.sin(t * 2 + x) * 0.3; });
  }
  // Market stalls, flags, trees, lamps
  for (const [x, z, c, rot] of [[-17, 19.2, 0xff8787, Math.PI], [-8, 19.2, 0x74c0fc, Math.PI], [8, 19.2, 0xffd43b, Math.PI], [17, 19.2, 0x69db7c, Math.PI], [-17, -19.2, 0xda77f2, 0], [17, -19.2, 0xff922b, 0]]) {
    const s = makeStall(c); s.rotation.y = rot; K.solid(s, x, z, 1.8, 2.8);
    K.balloons(x + 1.7, z + (z > 0 ? -1.2 : 1.2));
  }
  for (const [x, z, c] of [[-25, -19, 0xff6b6b], [25, -19, 0x4dabf7], [-25, 19, 0xffd43b], [25, 19, 0x69db7c]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 8, 8), mat(0xced4da)); pole.position.set(x, 4, z); pole.castShadow = true; group.add(pole);
    const flag = new THREE.Group(); flag.position.set(x, 7.2, z); group.add(flag);
    box(2.4, 1.3, 0.05, mat(c), 1.25, 0, 0, flag);
    K.colliders.push({ x, z, r: 0.3, h: 8 });
    K.life.push((dt, t) => { flag.rotation.y = Math.sin(t * 1.7 + x) * 0.5; flag.rotation.z = Math.sin(t * 2.6 + z) * 0.07; });
  }
  for (const [x, z] of [[-25.5, -9], [25.5, -9], [-25.5, 10], [25.5, 10], [-12, -19.5], [12, -19.5], [0, 20]]) K.tree(x, z);
  for (const [x, z, rot] of [[-13, 15, 0], [13, 15, Math.PI], [-13, -14.5, 0], [13, -14.5, Math.PI], [-24, 4.5, 0], [24, -4, Math.PI]]) K.lamp(x, z, rot, 5);
  K.bunting([-18, -9, 9, 18], -30, 30, 10, 2.4, 44);
  K.clouds(0xe7dcff); K.birds(0, -6, 20, 19, 8);

  return finish({
    name: 'City Square', group, boss: true, bossSpawn: { x: 0, z: -5 },
    bounds: { minX: -27, maxX: 27, minZ: -21, maxZ: 21 }, camPad: { x: 1.2, z: 1.2 },
    pickupSpots: pts([[-16, -11], [16, -11], [-16, 12], [16, 12], [0, 16], [0, -17], [-6, 3], [6, 3], [-24, 7], [24, -7], [-22, -15], [22, 15]]),
    start: { x: 0, z: 14.5 }, startYaw: 0, exitYaw: 0, hpMult: 1.5,
    waves: [[['boss', 1]]],
    env: { sky: 0x8f7df2, fog: 0xb3a6f7, fogNear: 50, fogFar: 150, sun: 0xffd6a8, sunI: 2.3, sunPos: [-14, 26, 12], hemiSky: 0xe2dcff, hemiGround: 0x9a8fd6, hemiI: 1.7 },
  }, K);
}

/** Chapter 1 - The Outbreak. Levels are built on first use and kept. */
export const LEVELS = [
  { name: 'Abandoned Street', build: buildStreet },
  { name: 'Shopping Mall', build: buildMall },
  { name: 'Parking Lot', build: buildParking },
  { name: 'Supermarket', build: buildMarket },
  { name: 'City Square', build: buildSquare },
];
