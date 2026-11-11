import * as THREE from 'three';

const MAX_DROPS = 700;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color(), _v = new THREE.Vector3();

/** Water droplets, splash rings, floating text and screen shake. */
export class FX {
  constructor(scene, camera, popupLayer) {
    this.scene = scene; this.camera = camera; this.layer = popupLayer;
    this.drops = [];
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 7, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }), MAX_DROPS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, _c.set(0xffffff));
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.rings = [];
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 40);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.shake = 0;
  }

  burst(pos, color, n = 10, speed = 4, up = 3, size = 1) {
    for (let i = 0; i < n && this.drops.length < MAX_DROPS; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
      this.drops.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * r, vy: up * (0.4 + Math.random()), vz: Math.sin(a) * r,
        life: 0.45 + Math.random() * 0.45, max: 0.9, size: size * (0.6 + Math.random() * 0.9), color,
      });
    }
  }

  ring(pos, color, radius = 2, dur = 0.4) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.position.set(pos.x, 0.06, pos.z);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur, radius });
  }

  /** Floating comic text at a world position. */
  popup(worldPos, text, cls = '') {
    _v.copy(worldPos).project(this.camera);
    if (_v.z > 1) return;
    const el = document.createElement('div');
    el.className = 'popup ' + cls;
    el.textContent = text;
    el.style.left = ((_v.x * 0.5 + 0.5) * 100) + '%';
    el.style.top = ((-_v.y * 0.5 + 0.5) * 100) + '%';
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  update(dt) {
    const d = this.drops;
    let n = 0;
    for (let i = d.length - 1; i >= 0; i--) {
      const p = d[i];
      p.life -= dt;
      p.vy -= 14 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.03) { p.y = 0.03; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      if (p.life <= 0) { d[i] = d[d.length - 1]; d.pop(); }
    }
    for (const p of d) {
      const k = Math.max(0.05, Math.min(1, p.life / 0.35)) * p.size;
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(k, k, k));
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, _c.set(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.dur), e = 1 - (1 - k) * (1 - k);
      r.mesh.scale.setScalar(0.2 + e * r.radius);
      r.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); }
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
  }
}
