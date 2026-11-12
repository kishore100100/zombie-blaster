import * as THREE from 'three';

/** Power-ups that appear around the arena. `time` = seconds the weapon upgrade lasts; no time = instant effect. */
export const POWERUPS = {
  triple: { label: 'TRIPLE SHOT', sub: 'Three water blobs per shot', color: 0xff8a3d, icon: '🔱', time: 15, weight: 3 },
  rapid: { label: 'RAPID FIRE', sub: 'Unlimited water, double speed', color: 0xffe066, icon: '⚡', time: 10, weight: 3 },
  power: { label: 'POWER SOAKER', sub: 'Triple damage', color: 0xff5ad1, icon: '💥', time: 15, weight: 3 },
  freeze: { label: 'MEGA FREEZE', sub: 'Nearby zombies frozen solid', color: 0x8be9ff, icon: '❄️', weight: 2 },
  bubble: { label: 'BUBBLE STORM', sub: 'Nearest zombies trapped in bubbles', color: 0x9be7ff, icon: '🫧', weight: 2 },
  electric: { label: 'ELECTRIC BLAST', sub: 'Zaps and stuns everything nearby', color: 0xfff27a, icon: '🌩️', weight: 2 },
  heal: { label: 'FRESH WATER', sub: '+40 health', color: 0x7dff6a, icon: '💚', weight: 1 },
};

const gemGeo = new THREE.OctahedronGeometry(0.45, 0);
const beamGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 16, 1, true);
beamGeo.translate(0, 4.5, 0);
const ringGeo = new THREE.RingGeometry(0.75, 0.95, 32);
ringGeo.rotateX(-Math.PI / 2);
const iconCache = {};

function iconTexture(icon) {
  if (!iconCache[icon]) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    g.font = '92px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(icon, 64, 70);
    iconCache[icon] = new THREE.CanvasTexture(c);
    iconCache[icon].colorSpace = THREE.SRGBColorSpace;
  }
  return iconCache[icon];
}

export class Pickup {
  constructor(scene, type, x, z) {
    const P = POWERUPS[type];
    this.scene = scene; this.type = type; this.P = P;
    this.x = x; this.z = z; this.life = 28; this.t = Math.random() * 6;
    const g = this.group = new THREE.Group();
    g.position.set(x, 0, z);

    this.gem = new THREE.Mesh(gemGeo, new THREE.MeshStandardMaterial({ color: P.color, emissive: P.color, emissiveIntensity: 0.7, roughness: 0.25, flatShading: true }));
    this.gem.castShadow = true;
    g.add(this.gem);

    this.beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: P.color, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
    g.add(this.beam);

    this.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: P.color, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.position.y = 0.04;
    g.add(this.ring);

    this.icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(P.icon), depthWrite: false }));
    this.icon.scale.setScalar(0.9);
    g.add(this.icon);

    scene.add(g);
  }

  update(dt) {
    this.t += dt; this.life -= dt;
    const bob = Math.sin(this.t * 2.4) * 0.14;
    this.gem.position.y = 1.0 + bob;
    this.gem.rotation.y += dt * 2.2;
    this.icon.position.y = 1.95 + bob;
    this.ring.scale.setScalar(1 + Math.sin(this.t * 4) * 0.12);
    this.beam.material.opacity = 0.18 + Math.sin(this.t * 3) * 0.06;
    // blink before disappearing
    this.group.visible = this.life > 5 || Math.sin(this.life * 14) > -0.2;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const m of [this.gem, this.beam, this.ring, this.icon]) m.material.dispose();
  }
}

/** Weighted random power-up type; healing only shows up when it would be useful. */
export function rollPowerup(hpFrac) {
  const pool = [];
  for (const [type, P] of Object.entries(POWERUPS)) {
    let w = P.weight;
    if (type === 'heal') w = hpFrac < 0.6 ? 4 : 0;
    for (let i = 0; i < w; i++) pool.push(type);
  }
  return pool[(Math.random() * pool.length) | 0];
}
