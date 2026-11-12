import * as THREE from 'three';
import { spawnSkinned } from './assets.js';
import { Animator } from './anim.js';
import { sfx } from './audio.js';
import { hud } from './hud.js';

export const BOSS = {
  label: 'BIG GRUMBLE', model: 'zWarrior', height: 6.2, radius: 1.9, hp: 3200, speed: 1.7,
  tint: 0xff7ab8, eyes: 0xfff06a, coins: 300, xp: 500, goo: 10,
  stompRadius: 7.5, stompDmg: 20, lobDmg: 12, chargeDmg: 22, chargeSpeed: 13, critMult: 3,
};

const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
const ringGeo = new THREE.RingGeometry(0.9, 1, 48); ringGeo.rotateX(-Math.PI / 2);
const discGeo = new THREE.CircleGeometry(1, 32); discGeo.rotateX(-Math.PI / 2);
const blobGeo = new THREE.SphereGeometry(0.45, 12, 10);
const _v = new THREE.Vector3();

/**
 * The City Square boss. Same interface as Zombie (pos, radius, height, alive, gone, damage, freeze, update, dispose, party).
 * Attacks: stomp shockwave (jump over it), slime lobs (move off the markers), charge (side-step, then it is dizzy).
 * Weakness: the wind-up key on its back, and any hit while it is dizzy, deal triple damage.
 */
export class Boss {
  constructor(G, x, z) {
    const T = BOSS;
    this.G = G; this.T = T; this.type = 'boss'; this.isBoss = true;
    const { obj, clips } = spawnSkinned(T.model, T.height);
    this.obj = obj;
    this.mats = [];
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      if (o.material.name === 'Glow') { o.material.color.set(T.eyes); if (o.material.emissive) o.material.emissive.set(T.eyes); }
      else { o.material.color.set(T.tint); o.material.emissive.set(0x5a1030); o.material.emissiveIntensity = 1; this.mats.push(o.material); }
    });
    this.baseScale = obj.scale.x;
    this.pos = obj.position; this.pos.set(x, 0, z);
    this.height = T.height; this.radius = T.radius;
    this.hp = this.maxHp = T.hp; this.alive = true; this.gone = false;
    this.flash = 0; this.squash = 0; this.stunT = 0;
    this.heading = Math.atan2(G.player.pos.x - x, G.player.pos.z - z);
    obj.rotation.y = this.heading;
    this.anim = new Animator(obj, clips);
    this.blobs = []; this.markers = [];
    this.cooldown = 2.2; this.summoned = 0; this.lastAttack = ''; this.hintT = 22;

    // The weak spot: a big glowing toy wind-up key sticking out of its back
    const key = this.key = new THREE.Group(), k = 1 / this.baseScale;
    const keyMat = this.keyMat = new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffc400, emissiveIntensity: 1.1, roughness: 0.3 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.1, 10), keyMat); stem.rotation.x = Math.PI / 2; stem.position.z = -0.55; key.add(stem);
    for (const sx of [-0.42, 0.42]) { const loop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 10, 20), keyMat); loop.position.set(sx, 0, -1.25); key.add(loop); }
    key.position.set(0, 3.4 * k, -1.1 * k); key.scale.setScalar(k);
    obj.add(key);

    this.setState('spawn');
    this.dur = this.anim.play('Spawn_Ground', { once: true, fade: 0, speed: 0.6 });
    G.scene.add(obj);
    hud.banner('⚠ ' + T.label + ' ⚠', 'Something huge is climbing out…');
    sfx.splash();
  }

  setState(s) { this.state = s; this.t = 0; }

  get dizzy() { return this.state === 'dizzy'; }

  walk() { this.setState('chase'); this.anim.play('Walking_A', { speed: 0.75, fade: 0.2 }); }

  marker(x, z, radius, color, life, fill = false) {
    const mesh = new THREE.Mesh(fill ? discGeo : ringGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: fill ? 0.35 : 0.9, depthWrite: false }));
    mesh.position.set(x, 0.05, z); mesh.scale.setScalar(radius);
    this.G.scene.add(mesh);
    const m = { mesh, life, max: life, radius, fill };
    this.markers.push(m);
    return m;
  }

  damage(amount, dirX, dirZ) {
    if (!this.alive || this.state === 'spawn') return false;
    // A shot travelling the same way the boss faces is hitting its back, where the key is.
    const len = Math.hypot(dirX, dirZ);
    const back = len > 0.01 && (dirX / len) * Math.sin(this.heading) + (dirZ / len) * Math.cos(this.heading) > 0.35;
    const crit = back || this.dizzy;
    if (crit) {
      amount *= this.T.critMult;
      _v.set(this.pos.x, this.height * 0.75, this.pos.z);
      this.G.fx.popup(_v, 'CRITICAL x3!', 'big');
      this.hintT = 1e9;
    }
    this.hp -= amount;
    this.flash = 1; this.squash = Math.max(this.squash, crit ? 1 : 0.4);
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    return false;
  }

  die() {
    this.alive = false;
    this.setState('dying');
    this.dur = this.anim.play('Death_A', { once: true, fade: 0.1, speed: 0.55 });
    for (const b of this.blobs) this.G.scene.remove(b.mesh);
    this.blobs.length = 0;
    this.G.onKill(this);
  }

  party() { if (this.alive && this.state !== 'party') { this.setState('party'); this.anim.play('Cheer', { fade: 0.25 }); } }

  /** Freeze / bubble / zap only stagger the boss for a moment. */
  freeze(seconds) {
    if (!this.alive || this.state === 'charge' || this.state === 'spawn') return;
    this.stunT = Math.min(1.2, seconds); this.flash = 1;
  }

  pickAttack(dist) {
    const opts = dist > 10 ? ['charge', 'lob', 'charge'] : dist < 6 ? ['stomp', 'stomp', 'lob'] : ['stomp', 'lob', 'charge'];
    let a = opts[(Math.random() * opts.length) | 0];
    if (a === this.lastAttack) a = opts[(opts.indexOf(a) + 1) % opts.length];
    this.lastAttack = a;
    const T = this.T;
    if (a === 'stomp') {
      this.setState('stomp'); this.hitDone = false;
      this.anim.play('Unarmed_Melee_Attack_Kick', { once: true, speed: 0.55, fade: 0.15, restart: true });
      this.marker(this.pos.x, this.pos.z, T.stompRadius, 0xff4d6d, 1.15);
      this.marker(this.pos.x, this.pos.z, T.stompRadius, 0xff4d6d, 1.15, true);
    } else if (a === 'lob') {
      this.setState('lob'); this.hitDone = false;
      this.anim.play('Throw', { once: true, speed: 0.8, fade: 0.15, restart: true });
    } else {
      this.setState('windup');
      this.anim.play('Taunt', { speed: 1.4, fade: 0.15 });
      hud.banner('IT\'S CHARGING!', 'Get out of the way');
    }
  }

  throwBlobs() {
    const G = this.G, p = G.player, b = G.level.bounds;
    for (let i = 0; i < 3; i++) {
      const tx = THREE.MathUtils.clamp(p.pos.x + (i ? (Math.random() - 0.5) * 7 : 0), b.minX, b.maxX);
      const tz = THREE.MathUtils.clamp(p.pos.z + (i ? (Math.random() - 0.5) * 7 : 0), b.minZ, b.maxZ);
      const mesh = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0xb565f0 }));
      G.scene.add(mesh);
      const time = 1.25 + i * 0.18;
      this.blobs.push({ mesh, sx: this.pos.x, sz: this.pos.z, sy: this.height * 0.8, tx, tz, t: 0, time });
      this.marker(tx, tz, 2.1, 0xb565f0, time);
      this.marker(tx, tz, 2.1, 0xb565f0, time, true);
    }
    sfx.dodge();
  }

  update(dt) {
    const G = this.G, T = this.T, p = G.player, pos = this.pos;
    this.t += dt;
    const stunned = this.alive && this.stunT > 0;
    if (stunned) this.stunT -= dt; else this.anim.update(dt);

    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 5); for (const m of this.mats) m.emissive.setRGB(0.35 + this.flash * 0.6, 0.06 + this.flash * 0.6, 0.19 + this.flash * 0.6); }
    let sx = 1, sy = 1;
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 4);
      const k = Math.sin(this.squash * Math.PI * 2) * this.squash * 0.14;
      sx = 1 + k * 0.6; sy = 1 - k;
    }
    this.keyMat.emissiveIntensity = 0.9 + Math.sin(G.time * 6) * 0.5 + (this.dizzy ? 1.2 : 0);

    // Telegraph markers
    for (let i = this.markers.length - 1; i >= 0; i--) {
      const m = this.markers[i];
      m.life -= dt;
      const k = 1 - Math.max(0, m.life / m.max);
      if (m.fill) { m.mesh.scale.setScalar(m.radius * k); m.mesh.material.opacity = 0.2 + k * 0.3; }
      if (m.life <= 0) { G.scene.remove(m.mesh); m.mesh.material.dispose(); this.markers.splice(i, 1); }
    }
    // Slime blobs in flight
    for (let i = this.blobs.length - 1; i >= 0; i--) {
      const b = this.blobs[i];
      b.t += dt;
      const k = Math.min(1, b.t / b.time);
      b.mesh.position.set(b.sx + (b.tx - b.sx) * k, b.sy * (1 - k) + Math.sin(k * Math.PI) * 7, b.sz + (b.tz - b.sz) * k);
      if (k >= 1) {
        _v.set(b.tx, 0.4, b.tz);
        G.fx.burst(_v, 0xb565f0, 22, 5, 5, 1.4); G.fx.ring(_v, 0xb565f0, 2.4, 0.4);
        G.dropSlime(b.tx, b.tz);
        if (Math.hypot(p.pos.x - b.tx, p.pos.z - b.tz) < 2.2 && p.pos.y < 1.5) G.hurtPlayer(T.lobDmg, { pos: _v });
        sfx.pop();
        G.scene.remove(b.mesh); b.mesh.material.dispose(); this.blobs.splice(i, 1);
      }
    }

    const dx = p.pos.x - pos.x, dz = p.pos.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const phase2 = this.hp < this.maxHp * 0.5;
    const b = G.level.bounds;

    if (stunned) {
      // briefly staggered
    } else if (this.state === 'spawn') {
      if (this.t >= this.dur) { this.setState('roar'); this.anim.play('Taunt', { fade: 0.2 }); sfx.lose(); G.fx.shake = 0.8; }
    } else if (this.state === 'roar') {
      if (this.t >= 1.6) this.walk();
    } else if (this.state === 'chase') {
      this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-3 * dt));
      if (dist > this.radius + 1.2) { pos.x += Math.sin(this.heading) * T.speed * (phase2 ? 1.3 : 1) * dt; pos.z += Math.cos(this.heading) * T.speed * (phase2 ? 1.3 : 1) * dt; }
      this.cooldown -= dt;
      // Call for help at two-thirds and one-third health
      const want = this.hp < this.maxHp * 0.33 ? 2 : this.hp < this.maxHp * 0.66 ? 1 : 0;
      if (this.summoned < want) {
        this.summoned++;
        this.setState('roar'); this.anim.play('Taunt', { fade: 0.2 });
        hud.banner('BACKUP!', 'Big Grumble calls his friends');
        sfx.wave();
        for (const type of ['walker', 'runner', 'walker', 'goozer']) G.spawnMinion(type);
      } else if (this.cooldown <= 0 && !p.dead) {
        this.cooldown = phase2 ? 1.6 : 2.5;
        this.pickAttack(dist);
      }
      this.hintT -= dt;
      if (this.hintT <= 0) { this.hintT = 30; hud.banner('HINT', 'What is that glowing key on its back?'); }
    } else if (this.state === 'stomp') {
      if (!this.hitDone && this.t >= 1.15) {
        this.hitDone = true;
        G.fx.ring(pos, 0xff4d6d, T.stompRadius, 0.5); G.fx.ring(pos, 0xffffff, T.stompRadius * 0.7, 0.4);
        _v.set(pos.x, 0.3, pos.z); G.fx.burst(_v, 0xffd0dc, 50, T.stompRadius, 5, 1.4);
        G.fx.shake = Math.max(G.fx.shake, 0.9);
        sfx.splash();
        if (dist < T.stompRadius && p.pos.y < 0.5) G.hurtPlayer(T.stompDmg, this);   // jump to avoid it
      }
      if (this.t >= 1.9) this.walk();
    } else if (this.state === 'lob') {
      this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-6 * dt));
      if (!this.hitDone && this.t >= 0.55) { this.hitDone = true; this.throwBlobs(); }
      if (this.t >= 1.5) this.walk();
    } else if (this.state === 'windup') {
      this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-7 * dt));
      this.flash = Math.max(this.flash, 0.35 + Math.sin(this.t * 30) * 0.2);
      if (this.t >= 1.0) { this.setState('charge'); this.hitDone = false; this.anim.play('Running_B', { speed: 1.5, fade: 0.1 }); sfx.dodge(); }
    } else if (this.state === 'charge') {
      pos.x += Math.sin(this.heading) * T.chargeSpeed * dt; pos.z += Math.cos(this.heading) * T.chargeSpeed * dt;
      _v.set(pos.x, 0.2, pos.z); G.fx.burst(_v, 0xffffff, 2, 2, 2, 1);
      if (!this.hitDone && dist < this.radius + 1.0) { this.hitDone = true; G.hurtPlayer(T.chargeDmg, this); }
      const wall = pos.x <= b.minX + this.radius || pos.x >= b.maxX - this.radius || pos.z <= b.minZ + this.radius || pos.z >= b.maxZ - this.radius;
      if (wall || this.t >= 1.4) {
        this.setState('dizzy');
        this.anim.play('Idle', { fade: 0.2 });
        if (wall) { G.fx.shake = Math.max(G.fx.shake, 0.7); sfx.hurt(); }
        _v.set(pos.x, this.height + 0.4, pos.z); G.fx.popup(_v, '💫 DIZZY!', 'big');
        hud.banner('IT\'S DIZZY!', 'Splash it now — triple damage');
      }
    } else if (this.state === 'dizzy') {
      this.obj.rotation.z = Math.sin(this.t * 5) * 0.12;
      if (this.t >= (phase2 ? 2.8 : 3.6)) { this.obj.rotation.z = 0; this.walk(); }
    } else if (this.state === 'dying') {
      if (Math.random() < dt * 14) {
        _v.set(pos.x + (Math.random() - 0.5) * 3, Math.random() * this.height, pos.z + (Math.random() - 0.5) * 3);
        G.fx.burst(_v, [0xff7ab8, 0xffe066, 0x5ad8ff, 0xffffff][(Math.random() * 4) | 0], 14, 5, 6, 1.5);
        G.fx.shake = Math.max(G.fx.shake, 0.3);
      }
      if (this.t >= this.dur + 0.4) {
        const k = 1 - Math.min(1, (this.t - this.dur - 0.4) / 0.5);
        sx *= k; sy *= k;
        this.obj.rotation.y += dt * 16;
        if (k <= 0 && !this.gone) { this.gone = true; G.onPop(this); }
      }
    } else if (this.state === 'party') {
      this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-4 * dt));
    }

    if (this.state !== 'dying') {
      this.obj.rotation.y = this.heading;
      for (const c of G.level.colliders) {
        const ex = pos.x - c.x, ez = pos.z - c.z, R = c.r + this.radius * 0.7, d2 = ex * ex + ez * ez;
        if (d2 < R * R && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = c.x + ex / d * R; pos.z = c.z + ez / d * R; }
      }
      pos.x = THREE.MathUtils.clamp(pos.x, b.minX + 1, b.maxX - 1); pos.z = THREE.MathUtils.clamp(pos.z, b.minZ + 1, b.maxZ - 1);
      // The boss is too big to shove: it pushes the hunter out of the way instead
      const R = this.radius + 0.5, ddx = p.pos.x - pos.x, ddz = p.pos.z - pos.z, d = Math.hypot(ddx, ddz) || 0.001;
      if (d < R && !p.dead) { p.pos.x = pos.x + ddx / d * R; p.pos.z = pos.z + ddz / d * R; }
    }
    const s = this.baseScale;
    this.obj.scale.set(s * sx, s * sy, s * sx);
  }

  dispose() {
    const scene = this.G.scene;
    scene.remove(this.obj);
    for (const m of this.markers) { scene.remove(m.mesh); m.mesh.material.dispose(); }
    for (const b of this.blobs) { scene.remove(b.mesh); b.mesh.material.dispose(); }
    this.obj.traverse(o => { if (o.isMesh) o.material.dispose(); });
  }
}
