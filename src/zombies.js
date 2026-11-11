import * as THREE from 'three';
import { spawnSkinned } from './assets.js';
import { Animator } from './anim.js';

export const ZTYPES = {
  walker: { label: 'Walker', model: 'zMinion', height: 1.95, radius: 0.55, hp: 30, speed: 1.6, dmg: 10, range: 1.5, tint: 0x8fe05a, eyes: 0xfff06a,
    walk: 'Walking_D_Skeletons', walkSpeed: 1.0, attack: 'Unarmed_Melee_Attack_Punch_A', atkSpeed: 0.9, wobble: 0.55, wobbleFreq: 1.3, stagger: 0.3, coins: 5, xp: 10 },
  runner: { label: 'Runner', model: 'zRogue', height: 1.7, radius: 0.48, hp: 20, speed: 4.4, dmg: 8, range: 1.4, tint: 0xd7f25a, eyes: 0xff8a3d,
    walk: 'Running_C', walkSpeed: 1.25, attack: 'Unarmed_Melee_Attack_Punch_B', atkSpeed: 1.3, wobble: 0.8, wobbleFreq: 2.6, stagger: 0.22, coins: 8, xp: 15 },
  brute: { label: 'Brute', model: 'zWarrior', height: 3.1, radius: 0.95, hp: 150, speed: 1.15, dmg: 22, range: 2.3, tint: 0x55c9a0, eyes: 0xff5a5a,
    walk: 'Walking_A', walkSpeed: 0.7, attack: 'Unarmed_Melee_Attack_Kick', atkSpeed: 0.7, wobble: 0.25, wobbleFreq: 0.8, stagger: 0, coins: 25, xp: 50 },
  goozer: { label: 'Goozer', model: 'zMage', height: 2.0, radius: 0.55, hp: 45, speed: 1.9, dmg: 10, range: 1.5, tint: 0xc77dff, eyes: 0x8dffb0,
    walk: 'Walking_B', walkSpeed: 1.0, attack: 'Unarmed_Melee_Attack_Punch_A', atkSpeed: 0.9, wobble: 0.6, wobbleFreq: 1.6, stagger: 0.3, coins: 12, xp: 25, slime: true },
};

const barGeo = new THREE.PlaneGeometry(1, 1);
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export class Zombie {
  constructor(G, type, x, z) {
    const T = ZTYPES[type];
    this.G = G; this.T = T; this.type = type;
    const { obj, clips } = spawnSkinned(T.model, T.height);
    this.obj = obj;
    this.mats = [];
    obj.traverse(o => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      if (o.material.name === 'Glow') { o.material.color.set(T.eyes); if (o.material.emissive) o.material.emissive.set(T.eyes); }
      else { o.material.color.set(T.tint); this.mats.push(o.material); }
    });
    this.baseScale = obj.scale.x;
    this.pos = obj.position;
    this.pos.set(x, 0, z);
    this.height = T.height; this.radius = T.radius;
    this.hp = this.maxHp = Math.round(T.hp * (G.level.hpMult || 1)); this.alive = true;
    this.slimeT = 0.8; this.gone = false;
    this.kb = new THREE.Vector3();
    this.flash = 0; this.squash = 0; this.phase = Math.random() * Math.PI * 2;
    this.heading = Math.atan2(G.player.pos.x - x, G.player.pos.z - z);
    obj.rotation.y = this.heading;
    this.anim = new Animator(obj, clips);
    this.state = 'spawn'; this.t = 0;
    this.dur = this.anim.play('Spawn_Ground', { once: true, fade: 0 });
    G.scene.add(obj);

    // Health bar (shown once damaged)
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x1d2433, depthTest: false }));
    bg.scale.set(1.1 * T.radius * 2, 0.16, 1);
    this.fill = new THREE.Mesh(barGeo, new THREE.MeshBasicMaterial({ color: 0x7dff6a, depthTest: false }));
    this.fill.position.z = 0.01;
    this.barW = 1.0 * T.radius * 2;
    this.fill.scale.set(this.barW, 0.1, 1);
    this.bar.add(bg, this.fill);
    this.bar.renderOrder = 10; bg.renderOrder = 10; this.fill.renderOrder = 11;
    this.bar.visible = false;
    G.scene.add(this.bar);
  }

  setState(s) { this.state = s; this.t = 0; }

  walk() { this.setState('chase'); this.anim.play(this.T.walk, { speed: this.T.walkSpeed }); }

  damage(amount, dirX, dirZ) {
    if (!this.alive) return false;
    this.hp -= amount;
    this.flash = 1; this.squash = 1;
    this.kb.x += dirX * (this.T.stagger ? 3.5 : 1); this.kb.z += dirZ * (this.T.stagger ? 3.5 : 1);
    this.bar.visible = true;
    const f = Math.max(0, this.hp / this.maxHp);
    this.fill.scale.x = Math.max(0.001, this.barW * f);
    this.fill.position.x = -this.barW * (1 - f) / 2;
    this.fill.material.color.setHSL(f * 0.33, 0.9, 0.6);
    if (this.hp <= 0) { this.die(); return true; }
    if (this.T.stagger && this.state !== 'spawn' && !(this.frozenT > 0)) { this.setState('stagger'); this.anim.play(Math.random() < 0.5 ? 'Hit_A' : 'Hit_B', { once: true, fade: 0.05, restart: true }); }
    return false;
  }

  die() {
    this.alive = false;
    this.bar.visible = false;
    this.setState('dying');
    this.dur = Math.min(1.1, this.anim.play(Math.random() < 0.5 ? 'Death_A' : 'Death_B', { once: true, fade: 0.08, speed: 1.4 }));
    this.G.onKill(this);
  }

  /** Called when the player is knocked out: zombies celebrate. */
  party() { if (this.alive && this.state !== 'party') { this.setState('party'); this.anim.play('Cheer', { fade: 0.25 }); } }

  /** Encase the zombie in ice: it stops moving and attacking but can still be splashed. */
  freeze(seconds) {
    if (!this.alive) return;
    this.frozenT = Math.max(this.frozenT || 0, seconds);
    for (const m of this.mats) m.color.set(0xa8ecff);
  }

  update(dt) {
    const G = this.G, T = this.T, p = G.player, pos = this.pos;
    let frozen = this.alive && this.frozenT > 0;
    if (frozen) {
      this.frozenT -= dt;
      if (this.frozenT <= 0) { frozen = false; for (const m of this.mats) m.color.set(T.tint); this.squash = 1; }
    } else if (this.frozenT > 0) { this.frozenT = 0; for (const m of this.mats) m.color.set(T.tint); }   // defeated while frozen
    if (!frozen) { this.t += dt; this.anim.update(dt); }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 5);
      for (const m of this.mats) m.emissive.setScalar(this.flash * 0.8);
    }
    let sx = 1, sy = 1;
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 4.5);
      const k = Math.sin(this.squash * Math.PI * 2) * this.squash * 0.28;
      sx = 1 + k * 0.6; sy = 1 - k;
    }

    pos.x += this.kb.x * dt; pos.z += this.kb.z * dt;
    this.kb.multiplyScalar(Math.exp(-9 * dt));

    const dx = p.pos.x - pos.x, dz = p.pos.z - pos.z;
    const dist = Math.hypot(dx, dz) || 0.001;

    if (frozen) {
      // held in place until the ice melts
    } else if (this.state === 'spawn') {
      if (this.t >= this.dur) this.walk();
    } else if (this.state === 'chase') {
      const near = THREE.MathUtils.smoothstep(dist, 2, 8);
      const ang = Math.atan2(dx, dz) + Math.sin(G.time * T.wobbleFreq + this.phase) * T.wobble * near;
      let mx = Math.sin(ang), mz = Math.cos(ang);
      for (const o of G.zombies) {      // keep some personal space
        if (o === this || !o.alive) continue;
        const ex = pos.x - o.pos.x, ez = pos.z - o.pos.z, R = this.radius + o.radius + 0.5;
        const d2 = ex * ex + ez * ez;
        if (d2 < R * R && d2 > 1e-5) { const d = Math.sqrt(d2), push = (R - d) / R * 1.8; mx += ex / d * push; mz += ez / d * push; }
      }
      if (this.detourT > 0) {       // blocked by a prop a moment ago: walk around it instead of pushing into it
        this.detourT -= dt;
        const a = this.detourDir * 1.3, c = Math.cos(a), s = Math.sin(a);
        const nx = mx * c + mz * s, nz = -mx * s + mz * c;
        mx = nx; mz = nz;
      }
      const len = Math.hypot(mx, mz) || 1;
      mx /= len; mz /= len;
      this.fromX = pos.x; this.fromZ = pos.z; this.stepLen = T.speed * dt;
      pos.x += mx * T.speed * dt; pos.z += mz * T.speed * dt;
      if (T.slime) {            // Goozers leave a trail of slowing slime
        this.slimeT -= dt;
        if (this.slimeT <= 0) { this.slimeT = 1.1; G.dropSlime(pos.x, pos.z); }
      }
      this.heading = lerpAngle(this.heading, Math.atan2(mx, mz), 1 - Math.exp(-8 * dt));
      if (dist < T.range && !p.dead) {
        this.setState('attack'); this.hitDone = false;
        this.dur = this.anim.play(T.attack, { once: true, speed: T.atkSpeed, fade: 0.1, restart: true });
      }
    } else if (this.state === 'attack') {
      this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
      if (!this.hitDone && this.t >= this.dur * 0.45) {
        this.hitDone = true;
        if (dist < T.range + 0.7) G.hurtPlayer(T.dmg, this);
      }
      if (this.t >= this.dur) this.walk();
    } else if (this.state === 'stagger') {
      if (this.t >= T.stagger) this.walk();
    } else if (this.state === 'dying') {
      if (this.t >= this.dur) {
        const k = 1 - Math.min(1, (this.t - this.dur) / 0.3);
        sx *= k; sy *= k;
        this.obj.rotation.y += dt * 14;
        if (k <= 0 && !this.gone) { this.gone = true; G.onPop(this); }
      }
    } else if (this.state === 'party') {
      this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), 1 - Math.exp(-4 * dt));
    }

    if (this.state !== 'dying') {
      this.obj.rotation.y = this.heading;
      // Stay out of props, the player and the arena walls
      for (const c of G.level.colliders) {
        const ex = pos.x - c.x, ez = pos.z - c.z, R = c.r + this.radius, d2 = ex * ex + ez * ez;
        if (d2 < R * R && d2 > 1e-6) { const d = Math.sqrt(d2); pos.x = c.x + ex / d * R; pos.z = c.z + ez / d * R; }
      }
      const R = this.radius + 0.35;
      if (dist < R) { pos.x = p.pos.x - dx / dist * R; pos.z = p.pos.z - dz / dist * R; }
      const b = G.level.bounds;
      pos.x = THREE.MathUtils.clamp(pos.x, b.minX, b.maxX); pos.z = THREE.MathUtils.clamp(pos.z, b.minZ, b.maxZ);
      if (this.state === 'chase' && this.stepLen && !frozen) {
        // Notice when props stop us from making progress and take a detour
        const made = Math.hypot(pos.x - this.fromX, pos.z - this.fromZ);
        this.stuckT = made < this.stepLen * 0.4 ? (this.stuckT || 0) + dt : Math.max(0, (this.stuckT || 0) - dt * 0.5);
        if (this.stuckT > 0.3 && !(this.detourT > 0)) {
          this.detourDir = this.detourDir && Math.random() < 0.7 ? this.detourDir : (Math.random() < 0.5 ? 1 : -1);
          this.detourT = 1.2; this.stuckT = 0;
        }
        this.stepLen = 0;
      }
    }

    const s = this.baseScale;
    this.obj.scale.set(s * sx, s * sy, s * sx);
    if (this.bar.visible) {
      this.bar.position.set(pos.x, this.height + 0.35, pos.z);
      this.bar.quaternion.copy(G.camera.quaternion);
    }
  }

  dispose() {
    this.G.scene.remove(this.obj);
    this.G.scene.remove(this.bar);
    this.obj.traverse(o => { if (o.isMesh) o.material.dispose(); });
    this.bar.children.forEach(c => c.material.dispose());
  }
}
