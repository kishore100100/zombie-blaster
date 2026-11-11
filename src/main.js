import * as THREE from 'three';
import { loadAll, spawnSkinned, spawnStatic, sizeOf } from './assets.js';
import { Animator } from './anim.js';
import { FX } from './fx.js';
import { sfx, initAudio, setVolume } from './audio.js';
import { buildStreet } from './level.js';
import { hud } from './hud.js';
import { Zombie } from './zombies.js';
import { Pickup, rollPowerup } from './pickups.js';

// ?nolock lets the game run without pointer lock (used for automated play-testing).
const NOLOCK = new URLSearchParams(location.search).has('nolock');

// ---------- Tuning ----------
const CFG = {
  moveSpeed: 6.4, jumpVel: 8.6, gravity: 24,
  dodgeSpeed: 13, dodgeTime: 0.42, dodgeCooldown: 0.9,
  fireInterval: 0.17, rapidInterval: 0.075, damage: 10, projSpeed: 42,
  maxAmmo: 30, reloadTime: 1.1, maxHp: 100,
  comboWindow: 4.5, rapidTime: 8, specialCooldown: 18,
  camDist: 4.6, camShoulder: 0.85, camHeight: 1.75, sens: 0.0023,
  camMinY: 1.0, pitchUp: 0.42, pitchDown: -1.0,   // camera never drops below waist height
  sprintMult: 1.45, aimMoveMult: 0.6, aimSens: 0.6, aimDist: 2.5, aimFov: 44, fov: 62,
};
const WAVES = [
  [['walker', 5]],
  [['walker', 5], ['runner', 3]],
  [['walker', 4], ['runner', 3], ['brute', 1]],
];
const BLASTER_YAW = 2.07 + Math.PI;
const POP_WORDS =['SPLOOSH!', 'SOGGY!', 'BLOOP!', 'DRENCHED!', 'SPLAT!', 'WASHED UP!', 'KER-SPLASH!'];
const WATER = [0x5ad8ff, 0x9be7ff, 0xffffff];

// ---------- Renderer / scene ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3ff);
scene.fog = new THREE.Fog(0xbfe8ff, 45, 130);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
camera.rotation.order = 'YXZ';

scene.add(new THREE.HemisphereLight(0xffffff, 0x9fd67a, 1.7));
const sun = new THREE.DirectionalLight(0xfff1d0, 2.4);
sun.position.set(16, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 26, bottom: -26, near: 1, far: 90 });
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
scene.add(sun);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------- Game state ----------
const fx = new FX(scene, camera, document.getElementById('popups'));
const keys = {};
let firing = false;
let aiming = false;     // right mouse button held: zoomed over-the-shoulder aim
let aimK = 0;           // 0..1 smoothed aim blend
let mode = 'loading';   // loading | title | playing | paused | victory | dying | results | gameover

const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, pitch: -0.12, onGround: true,
  hp: CFG.maxHp, maxHp: CFG.maxHp, ammo: CFG.maxAmmo, maxAmmo: CFG.maxAmmo,
  reloadT: 0, fireT: 0, aimT: 0, dodgeT: 0, dodgeCd: 0, dodgeDir: new THREE.Vector3(), invuln: 0,
  specialCd: 0, rapidT: 0, tripleT: 0, powerT: 0, lockT: 0, recoil: 0, dead: false, model: null, anim: null, blaster: null,
};
const stats = { kills: 0, coins: 0, xp: 0, shots: 0, hits: 0, damageTaken: 0, bestCombo: 0, time: 0 };
const combo = { n: 0, t: 0 };
const wave = { idx: -1, queue: [], gap: 0 };
const projectiles = [];
const pickups = [];
let pickupTimer = 0;
let megaPending = 0, victoryT = 0, onTarget = false;

const G = { scene, camera, player, fx, level: null, zombies: [], time: 0, onKill, onPop, hurtPlayer };
window.game = { G, player, stats, combo, wave, CFG, renderer, scene, camera, get mode() { return mode; }, set mode(m) { mode = m; } };

const projGeo = new THREE.SphereGeometry(0.16, 10, 8);
const projMat = new THREE.MeshBasicMaterial({ color: 0x7fe3ff });
const projMatPower = new THREE.MeshBasicMaterial({ color: 0xff7ade });
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3(), _aim = new THREE.Vector3(), _muzzle = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const camPos = new THREE.Vector3();
const clamp = THREE.MathUtils.clamp;

// ---------- Setup ----------
async function boot() {
  await loadAll(f => { hud.$('loadFill').style.width = (f * 100) + '%'; });
  G.level = buildStreet(scene);
  buildPlayer();
  resetEncounter();
  updateCamera(0, true);
  hud.show('loading', false);
  hud.show('title');
  mode = 'title';
  requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
}

function buildPlayer() {
  const { obj, clips } = spawnSkinned('hunter', 1.95);
  for (const n of ['Knife', 'Knife_Offhand', '1H_Crossbow', '2H_Crossbow', 'Throwable']) { const o = obj.getObjectByName(n); if (o) o.visible = false; }
  player.model = obj;
  player.anim = new Animator(obj, clips);
  const hand = obj.getObjectByName('handslotr');
  const blaster = spawnStatic('blaster');
  const s = sizeOf('blaster');
  blaster.scale.setScalar(0.95 / Math.max(s.x, s.y, s.z) / obj.scale.x);
  blaster.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(0x66e0ff); } });
  if (hand) hand.add(blaster); else obj.add(blaster);
  // The aiming pose holds the hand slot at an angle; turn the blaster so its barrel points where the hunter looks.
  blaster.rotation.y = BLASTER_YAW;
  player.blaster = blaster;
  scene.add(obj);
}

function resetEncounter() {
  for (const z of G.zombies) z.dispose();
  G.zombies.length = 0;
  for (const p of projectiles) scene.remove(p.mesh);
  projectiles.length = 0;
  for (const k of pickups) k.dispose();
  pickups.length = 0; pickupTimer = 6;
  Object.assign(stats, { kills: 0, coins: 0, xp: 0, shots: 0, hits: 0, damageTaken: 0, bestCombo: 0, time: 0 });
  combo.n = 0; combo.t = 0; megaPending = 0;
  const p = player;
  p.pos.set(G.level.start.x, 0, G.level.start.z); p.vel.set(0, 0, 0);
  p.yaw = 0; p.pitch = -0.12; p.onGround = true;
  Object.assign(p, { hp: p.maxHp, ammo: p.maxAmmo, reloadT: 0, fireT: 0, aimT: 0, dodgeT: 0, dodgeCd: 0, invuln: 0, specialCd: 0, rapidT: 0, tripleT: 0, powerT: 0, lockT: 0, dead: false });
  p.anim.playBoth('Idle', { fade: 0 });
  wave.idx = -1; wave.queue = []; wave.gap = 1.6;
  G.time = 0;
}

// ---------- Input ----------
addEventListener('keydown', e => {
  if (['Space', 'Tab', 'KeyQ', 'KeyE'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (mode === 'playing') {
    if (e.code === 'Space') jump();
    if (e.code === 'KeyC') dodge();
    if (e.code === 'KeyQ') special();
    if (e.code === 'KeyR') startReload();
  }
  if (e.code === 'KeyP' || (e.code === 'Escape' && NOLOCK)) { if (mode === 'playing') pause(); else if (mode === 'paused') resume(); }
  if ((e.code === 'KeyE' || e.code === 'Enter') && (mode === 'results' || mode === 'gameover')) startGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; firing = false; aiming = false; });
canvas.addEventListener('mousedown', e => {
  if (mode !== 'playing') return;
  if (e.button === 0) firing = true;
  if (e.button === 2) aiming = true;
  if (!NOLOCK && document.pointerLockElement !== canvas) lock();
});
addEventListener('mouseup', e => { if (e.button === 0) firing = false; if (e.button === 2) aiming = false; });
addEventListener('mousemove', e => {
  if (mode !== 'playing') return;
  // Turning is unlimited (full 360) once the mouse is captured. If capture has not happened yet the
  // mouse still steers, but the cursor can run into the window edge - the hint tells the player to click.
  const sens = CFG.sens * (aiming ? CFG.aimSens : 1);
  player.yaw -= e.movementX * sens;
  player.pitch = clamp(player.pitch - e.movementY * sens * (settings.invert ? -1 : 1), CFG.pitchDown, CFG.pitchUp);
  cursorX = e.clientX / innerWidth;
});
let cursorX = 0.5;
/** Without mouse capture the cursor stops at the window edge, so resting it there keeps the camera turning. */
function edgeTurn(dt) {
  if (NOLOCK || document.pointerLockElement === canvas) return;
  const edge = 0.1;
  if (cursorX < edge) player.yaw += (edge - cursorX) / edge * 2.8 * dt;
  else if (cursorX > 1 - edge) player.yaw -= (cursorX - (1 - edge)) / edge * 2.8 * dt;
}
let hintShown = false, hintTimer = 0;
/** If the mouse could not be captured, say so once for a few seconds - never a permanent message. */
function updateLockHint() {
  const need = !NOLOCK && mode === 'playing' && document.pointerLockElement !== canvas;
  if (!need) { hud.show('lockHint', false); return; }
  if (hintShown) return;
  hintShown = true;
  hud.show('lockHint', true);
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => hud.show('lockHint', false), 4500);
}
document.addEventListener('pointerlockerror', updateLockHint);
addEventListener('contextmenu', e => e.preventDefault());
let everLocked = false;
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (locked) everLocked = true;
  // Only treat losing the mouse as "pause" if we actually had it (Esc). A failed capture just shows the hint.
  else if (!NOLOCK && everLocked && mode === 'playing') pause();
  updateLockHint();
});

function lock() {
  if (NOLOCK) return;
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(updateLockHint); } catch (e) { /* not supported */ }
  setTimeout(updateLockHint, 300);
}
function unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

function startGame() {
  initAudio();
  ['title', 'results', 'gameover', 'pause'].forEach(id => hud.show(id, false));
  hud.show('hud');
  resetEncounter();
  mode = 'playing';
  lock();
  hud.banner(`${G.level.index} · ${G.level.name.toUpperCase()}`, 'Chapter 1 — The Outbreak');
}
function menuPage(id) { ['menuMain', 'menuSettings', 'menuHelp'].forEach(p => hud.show(p, p === id)); }
function pause() { mode = 'paused'; firing = false; menuPage('menuMain'); hud.show('pause'); unlock(); updateLockHint(); }
function resume() { hud.show('pause', false); mode = 'playing'; lock(); }
function quitToTitle() {
  resetEncounter();
  ['pause', 'results', 'gameover', 'hud'].forEach(id => hud.show(id, false));
  hud.show('title');
  mode = 'title'; victoryT = 0;
  updateCamera(0, true);
}

// ---------- Settings (saved in the browser) ----------
const settings = { volume: 50, sens: 100, invert: false };
try { Object.assign(settings, JSON.parse(localStorage.getItem('zb-settings') || '{}')); } catch (e) { /* storage unavailable */ }
const BASE_SENS = CFG.sens;
function applySettings(save = true) {
  setVolume(settings.volume / 100);
  CFG.sens = BASE_SENS * settings.sens / 100;
  hud.$('optVolume').value = settings.volume; hud.$('optVolumeVal').textContent = settings.volume + '%';
  hud.$('optSens').value = settings.sens; hud.$('optSensVal').textContent = settings.sens + '%';
  hud.$('optInvert').checked = settings.invert;
  if (save) try { localStorage.setItem('zb-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ }
}
hud.$('optVolume').oninput = e => { settings.volume = +e.target.value; applySettings(); };
hud.$('optVolume').onchange = () => sfx.coin();     // preview the new volume
hud.$('optSens').oninput = e => { settings.sens = +e.target.value; applySettings(); };
hud.$('optInvert').onchange = e => { settings.invert = e.target.checked; applySettings(); };
applySettings(false);

hud.$('btnPause').onclick = e => { e.currentTarget.blur(); if (mode === 'playing') pause(); };
hud.$('btnSettings').onclick = () => menuPage('menuSettings');
hud.$('btnHelp').onclick = () => menuPage('menuHelp');
hud.$('btnQuit').onclick = quitToTitle;
document.querySelectorAll('[data-back]').forEach(b => { b.onclick = () => menuPage('menuMain'); });

hud.$('btnPlay').onclick = startGame;
hud.$('btnAgain').onclick = startGame;
hud.$('btnRetry').onclick = startGame;
hud.$('btnRestartP').onclick = startGame;
hud.$('btnResume').onclick = resume;

// ---------- Player actions ----------
function jump() {
  const p = player;
  if (!p.onGround || p.dead || p.dodgeT > 0) return;
  p.vel.y = CFG.jumpVel; p.onGround = false;
  sfx.jump();
}

function dodge() {
  const p = player;
  if (p.dead || p.dodgeCd > 0 || !p.onGround) return;
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let fx_ = f, r_ = r;
  if (!f && !r) fx_ = -1;                               // no input: hop backwards
  p.dodgeDir.set(-sy * fx_ + cy * r_, 0, -cy * fx_ - sy * r_).normalize();
  p.dodgeT = CFG.dodgeTime; p.dodgeCd = CFG.dodgeCooldown; p.invuln = Math.max(p.invuln, CFG.dodgeTime);
  const clip = Math.abs(r_) > Math.abs(fx_) ? (r_ > 0 ? 'Dodge_Right' : 'Dodge_Left') : (fx_ > 0 ? 'Dodge_Forward' : 'Dodge_Backward');
  p.anim.playBoth(clip, { once: true, fade: 0.06, restart: true, speed: 1.2 });
  p.lockT = CFG.dodgeTime;
  sfx.dodge();
}

function startReload() {
  const p = player;
  if (p.reloadT > 0 || p.ammo >= p.maxAmmo || p.dead) return;
  p.reloadT = CFG.reloadTime;
  sfx.reload();
}

function special() {
  const p = player;
  if (p.dead || p.specialCd > 0) return;
  p.specialCd = CFG.specialCooldown;
  hud.banner('SUPER SPLASH!');
  splash(p.pos, 8, 45, 0x5ad8ff);
}

/** Area water attack centred on a point. */
function splash(center, radius, dmg, color) {
  sfx.splash();
  fx.ring(center, color, radius, 0.55);
  fx.ring(center, 0xffffff, radius * 0.7, 0.4);
  _v.set(center.x, 0.6, center.z);
  fx.burst(_v, color, 70, radius * 1.1, 7, 1.6);
  fx.shake = Math.max(fx.shake, 0.6);
  for (const z of G.zombies) {
    if (!z.alive) continue;
    const dx = z.pos.x - center.x, dz = z.pos.z - center.z, d = Math.hypot(dx, dz);
    if (d > radius + z.radius) continue;
    const k = d > 0.01 ? 1 / d : 0;
    z.damage(dmg, dx * k * 2.5, dz * k * 2.5);
  }
}

function getMuzzle(out) {
  const p = player, sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  return out.set(p.pos.x - sy * 0.75 + cy * 0.38, p.pos.y + 1.28, p.pos.z - cy * 0.75 - sy * 0.38);
}

/** Where the crosshair points, with a little aim assist toward zombies near the ray. */
function computeAim(out) {
  camera.getWorldDirection(_dir);
  const o = camera.position;
  let best = null, bestT = 1e9;
  for (const z of G.zombies) {
    if (!z.alive) continue;
    _v.set(z.pos.x, z.pos.y + z.height * 0.55, z.pos.z).sub(o);
    const t = _v.dot(_dir);
    if (t < 2 || t > bestT) continue;
    const d = _v.addScaledVector(_dir, -t).length();
    if (d < z.radius + 0.45) { best = z; bestT = t; }
  }
  onTarget = !!best;
  if (best) {
    out.copy(o).addScaledVector(_dir, bestT);
    _v.set(best.pos.x, best.pos.y + best.height * 0.55, best.pos.z);
    return out.lerp(_v, 0.5);
  }
  let t = 70;
  if (_dir.y < -0.001) t = Math.min(t, -o.y / _dir.y);
  return out.copy(o).addScaledVector(_dir, Math.max(t, 7));
}

function shoot() {
  const p = player;
  const rapid = p.rapidT > 0;
  p.fireT = rapid ? CFG.rapidInterval : CFG.fireInterval;
  if (!rapid) p.ammo--;
  p.aimT = 0.7; p.recoil = 1;
  getMuzzle(_muzzle);
  _v.copy(_aim).sub(_muzzle).normalize();
  const power = p.powerT > 0;
  const spread = p.tripleT > 0 ? [-0.085, 0, 0.085] : [0];
  for (const a of spread) {
    // rotate the shot direction around the vertical axis for the side blobs
    const c = Math.cos(a), s = Math.sin(a);
    const vel = new THREE.Vector3(_v.x * c + _v.z * s, _v.y, -_v.x * s + _v.z * c).multiplyScalar(CFG.projSpeed);
    const mesh = new THREE.Mesh(projGeo, power ? projMatPower : projMat);
    mesh.position.copy(_muzzle);
    const k = power ? 1.5 : 1;
    mesh.scale.set(0.8 * k, 0.8 * k, 2.6 * k);
    scene.add(mesh);
    projectiles.push({ mesh, pos: mesh.position, vel, life: 1.6, dmg: CFG.damage * (power ? 3 : 1), power });
    stats.shots++;
  }
  fx.burst(_muzzle, power ? 0xff9ae6 : 0xffffff, 3, 1.5, 1, 0.6);
  sfx.shoot();
  hud.kick();
  if (p.ammo <= 0 && !rapid) startReload();
}

// ---------- Callbacks from zombies ----------
function onKill(z) {
  stats.kills++;
  combo.n++; combo.t = CFG.comboWindow;
  stats.bestCombo = Math.max(stats.bestCombo, combo.n);
  stats.coins += z.T.coins; stats.xp += z.T.xp;
  _v.set(z.pos.x, z.height + 0.4, z.pos.z);
  fx.popup(_v, POP_WORDS[(Math.random() * POP_WORDS.length) | 0], 'big');
  sfx.combo(combo.n);
  hud.bumpCombo();
  if (combo.n === 3) { stats.coins += 15; hud.banner('COMBO x3', '+15 bonus coins'); sfx.coin(); }
  if (combo.n === 5) { player.rapidT = CFG.rapidTime; hud.banner('RAPID FIRE!', 'Unlimited water for 8 seconds'); sfx.power(); }
  if (combo.n % 10 === 0) megaPending = 0.35;
}

function onPop(z) {
  _v.set(z.pos.x, 0.9, z.pos.z);
  fx.burst(_v, z.T.tint, 16, 4, 5, 1.3);
  fx.burst(_v, 0xffffff, 8, 3, 6, 0.9);
  fx.ring(z.pos, z.T.tint, 1.6, 0.35);
  _v.y = 1.6;
  fx.popup(_v, '+' + z.T.coins + ' 🪙', 'coin');
  sfx.pop();
}

function hurtPlayer(dmg, z) {
  const p = player;
  if (p.dead || mode !== 'playing') return;
  if (p.invuln > 0) {
    if (p.dodgeT > 0) { _v.set(p.pos.x, 2.3, p.pos.z); fx.popup(_v, 'DODGED!', 'coin'); }
    return;
  }
  p.hp -= dmg; stats.damageTaken += dmg;
  p.invuln = 0.7;
  combo.n = 0; combo.t = 0;
  const dx = p.pos.x - z.pos.x, dz = p.pos.z - z.pos.z, d = Math.hypot(dx, dz) || 1;
  p.vel.x += dx / d * 7; p.vel.z += dz / d * 7;
  fx.shake = Math.max(fx.shake, 0.5);
  hud.hurt(); sfx.hurt();
  _v.set(p.pos.x, 2.3, p.pos.z); fx.popup(_v, '-' + dmg, 'bad');
  if (p.hp <= 0) {
    p.hp = 0; p.dead = true; firing = false;
    p.anim.playBoth('Death_A', { once: true, fade: 0.1 });
    mode = 'dying'; victoryT = 0;
    sfx.lose();
    for (const o of G.zombies) o.party();
  } else if (p.dodgeT <= 0) {
    p.anim.play('Hit_A', { part: 'upper', once: true, fade: 0.05, restart: true });
    p.upperLock = 0.3;
  }
}

// ---------- Update ----------
function updatePlayer(dt) {
  const p = player;
  p.fireT -= dt; p.aimT -= dt; p.dodgeCd -= dt; p.invuln -= dt; p.specialCd -= dt; p.rapidT -= dt; p.tripleT -= dt; p.powerT -= dt; p.lockT -= dt;
  p.upperLock = (p.upperLock || 0) - dt;
  p.recoil = Math.max(0, p.recoil - dt * 9);

  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let f = 0, r = 0;
  if (!p.dead && mode === 'playing') { f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0); r = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0); }
  let mx = -sy * f + cy * r, mz = -cy * f - sy * r;
  const len = Math.hypot(mx, mz);
  if (len > 0) { mx /= len; mz /= len; }
  const isAiming = aiming && !p.dead && mode === 'playing';
  const sprint = (keys.ShiftLeft || keys.ShiftRight) && f > 0 && !isAiming && !firing && p.onGround;
  const speed = CFG.moveSpeed * (f < 0 ? 0.72 : 1) * (sprint ? CFG.sprintMult : isAiming ? CFG.aimMoveMult : 1);
  aimK += ((isAiming ? 1 : 0) - aimK) * (1 - Math.exp(-12 * dt));
  if (isAiming) p.aimT = Math.max(p.aimT, 0.15);

  if (p.dodgeT > 0) {
    p.dodgeT -= dt;
    const k = 0.35 + 0.65 * (p.dodgeT / CFG.dodgeTime);
    p.vel.x = p.dodgeDir.x * CFG.dodgeSpeed * k; p.vel.z = p.dodgeDir.z * CFG.dodgeSpeed * k;
  } else {
    const a = 1 - Math.exp(-(p.onGround ? 14 : 5) * dt);
    p.vel.x += (mx * speed - p.vel.x) * a; p.vel.z += (mz * speed - p.vel.z) * a;
  }
  p.vel.y -= CFG.gravity * dt;
  p.pos.addScaledVector(p.vel, dt);
  if (p.pos.y <= 0) { p.pos.y = 0; p.vel.y = 0; p.onGround = true; }

  for (const c of G.level.colliders) {
    if (p.pos.y > c.h) continue;
    const ex = p.pos.x - c.x, ez = p.pos.z - c.z, R = c.r + 0.42, d2 = ex * ex + ez * ez;
    if (d2 < R * R && d2 > 1e-6) { const d = Math.sqrt(d2); p.pos.x = c.x + ex / d * R; p.pos.z = c.z + ez / d * R; }
  }
  const b = G.level.bounds;
  p.pos.x = clamp(p.pos.x, b.minX, b.maxX); p.pos.z = clamp(p.pos.z, b.minZ, b.maxZ);

  // Weapon
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) p.ammo = p.maxAmmo; }
  computeAim(_aim);
  if (firing && !p.dead && mode === 'playing' && p.dodgeT <= 0 && p.fireT <= 0) {
    if (p.rapidT > 0 || (p.ammo > 0 && p.reloadT <= 0)) shoot();
    else if (p.reloadT <= 0) { startReload(); sfx.empty(); p.fireT = 0.2; }
  }

  // Model + animation
  p.model.position.copy(p.pos);
  if (!p.dead && mode !== 'victory') p.model.rotation.y = p.yaw + Math.PI;
  if (!p.dead && mode !== 'victory' && p.lockT <= 0) {
    let lower = 'Idle', spd = 1;
    if (!p.onGround) lower = 'Jump_Idle';
    else if (len > 0) {
      if (f < 0) { lower = 'Walking_Backwards'; spd = 1.5; }
      else if (f === 0) lower = r > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left';
      else { lower = 'Running_A'; spd = sprint ? 1.35 : 1; }
      if (isAiming) spd *= 0.7;
    }
    p.anim.play(lower, { part: 'lower', speed: spd, fade: 0.12 });
    if (p.upperLock <= 0) p.anim.play(p.aimT > 0 ? '1H_Ranged_Aiming' : lower, { part: 'upper', speed: spd, fade: 0.1 });
  }
  p.anim.update(dt);
  if (p.blaster) {   // recoil kick straight back along the barrel
    const k = -p.recoil * 0.14 / p.model.scale.x;
    p.blaster.position.set(Math.sin(BLASTER_YAW) * k, 0, Math.cos(BLASTER_YAW) * k);
  }
}

function updateProjectiles(dt) {
  const b = G.level.bounds;
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const pr = projectiles[i];
    _v.copy(pr.pos);
    pr.vel.y -= 3.5 * dt;
    pr.pos.addScaledVector(pr.vel, dt);
    pr.life -= dt;
    let hit = null, hitT = 2;
    const dx = pr.pos.x - _v.x, dz = pr.pos.z - _v.z, dy = pr.pos.y - _v.y, len2 = dx * dx + dz * dz;
    for (const z of G.zombies) {
      if (!z.alive) continue;
      let t = len2 > 1e-8 ? ((z.pos.x - _v.x) * dx + (z.pos.z - _v.z) * dz) / len2 : 0;
      t = clamp(t, 0, 1);
      const ex = _v.x + dx * t - z.pos.x, ez = _v.z + dz * t - z.pos.z, y = _v.y + dy * t;
      const R = z.radius + 0.18;
      if (ex * ex + ez * ez < R * R && y > z.pos.y - 0.1 && y < z.pos.y + z.height + 0.2 && t < hitT) { hit = z; hitT = t; }
    }
    let done = false;
    if (hit) {
      pr.pos.set(_v.x + dx * hitT, _v.y + dy * hitT, _v.z + dz * hitT);
      const l = Math.sqrt(len2) || 1;
      stats.hits++;
      hit.damage(pr.dmg, dx / l, dz / l);
      fx.burst(pr.pos, pr.power ? 0xff9ae6 : WATER[(Math.random() * 3) | 0], pr.power ? 16 : 9, 3.5, 3.5, pr.power ? 1.4 : 1);
      _v2.set(pr.pos.x, pr.pos.y + 0.3, pr.pos.z);
      fx.popup(_v2, String(pr.dmg), pr.power ? 'coin' : '');
      sfx.hit();
      done = true;
    } else if (pr.pos.y <= 0.05) {
      pr.pos.y = 0.05;
      fx.burst(pr.pos, 0x9be7ff, 6, 2.5, 3, 0.8); fx.ring(pr.pos, 0x9be7ff, 0.7, 0.25);
      done = true;
    } else if (pr.life <= 0 || pr.pos.x < b.minX - 4 || pr.pos.x > b.maxX + 4 || pr.pos.z < b.minZ - 5 || pr.pos.z > b.maxZ + 5) {
      fx.burst(pr.pos, 0x9be7ff, 6, 2.5, 2, 0.8);
      done = true;
    } else {
      for (const c of G.level.colliders) {
        const ex = pr.pos.x - c.x, ez = pr.pos.z - c.z;
        if (pr.pos.y < c.h && ex * ex + ez * ez < c.r * c.r * 0.8) { fx.burst(pr.pos, 0x9be7ff, 6, 2.5, 2, 0.8); done = true; break; }
      }
    }
    if (done) { scene.remove(pr.mesh); projectiles.splice(i, 1); }
    else pr.mesh.lookAt(_v2.copy(pr.pos).add(pr.vel));
  }
}

function updateWaves(dt) {
  for (let i = wave.queue.length - 1; i >= 0; i--) {
    const q = wave.queue[i];
    q.delay -= dt;
    if (q.delay <= 0) {
      wave.queue.splice(i, 1);
      const z = new Zombie(G, q.type, q.x, q.z);
      G.zombies.push(z);
      fx.ring(z.pos, 0x9dff5a, 1.8, 0.5);
      _v.set(q.x, 0.3, q.z); fx.burst(_v, 0x9dff5a, 10, 2.5, 5, 1);
    }
  }
  if (wave.queue.length || G.zombies.length) return;
  if (wave.idx >= WAVES.length - 1) return victory();
  wave.gap -= dt;
  if (wave.gap > 0) return;
  wave.idx++; wave.gap = 2.2;
  const list = [];
  for (const [type, n] of WAVES[wave.idx]) for (let i = 0; i < n; i++) list.push(type);
  list.sort(() => Math.random() - 0.5);
  // Farthest-first shuffle of spawn points so each wave arrives from several directions
  const pts = G.level.spawns.filter(s => Math.hypot(s.x - player.pos.x, s.z - player.pos.z) > 7).sort(() => Math.random() - 0.5);
  list.forEach((type, i) => {
    const s = pts[i % pts.length];
    wave.queue.push({ type, x: s.x + (Math.random() - 0.5) * 0.8, z: s.z + (Math.random() - 0.5) * 0.8, delay: 0.4 + i * 0.7 });
  });
  spawnPickup();
  if (wave.idx > 0) hud.banner('WAVE ' + (wave.idx + 1), wave.idx === WAVES.length - 1 ? 'Something big is coming…' : 'Here they come!');
  sfx.wave();
}

// ---------- Power-up pickups ----------
function spawnPickup() {
  if (pickups.length >= 2) return;
  const p = player;
  const spots = G.level.pickupSpots.filter(s => Math.hypot(s.x - p.pos.x, s.z - p.pos.z) > 6 && !pickups.some(k => k.x === s.x && k.z === s.z));
  if (!spots.length) return;
  const s = spots[(Math.random() * spots.length) | 0];
  const k = new Pickup(scene, rollPowerup(p.hp / p.maxHp), s.x, s.z);
  pickups.push(k);
  fx.ring(k.group.position, k.P.color, 2.2, 0.6);
  pickupTimer = 13;
}

function collectPickup(k) {
  const p = player, P = k.P;
  if (k.type === 'triple') p.tripleT = P.time;
  if (k.type === 'rapid') p.rapidT = P.time;
  if (k.type === 'power') p.powerT = P.time;
  if (k.type === 'heal') p.hp = Math.min(p.maxHp, p.hp + 40);
  if (k.type === 'freeze') {
    fx.ring(p.pos, 0x8be9ff, 13, 0.6); fx.ring(p.pos, 0xffffff, 9, 0.45);
    for (const z of G.zombies) if (z.alive && Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z) < 13) {
      z.freeze(5);
      _v.set(z.pos.x, z.height * 0.6, z.pos.z); fx.burst(_v, 0xd8f6ff, 10, 2, 2, 1);
    }
  }
  if (P.time) { p.ammo = p.maxAmmo; p.reloadT = 0; }      // weapon upgrades come with a full tank
  _v.set(k.x, 1, k.z);
  fx.burst(_v, P.color, 26, 5, 6, 1.3); fx.ring(_v, P.color, 3, 0.45);
  hud.banner(P.icon + ' ' + P.label, P.sub);
  sfx.power();
}

function updatePickups(dt) {
  const p = player;
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i];
    k.update(dt);
    const near = !p.dead && Math.hypot(k.x - p.pos.x, k.z - p.pos.z) < 1.5 && p.pos.y < 2.2;
    if (near) collectPickup(k);
    if (near || k.life <= 0) { k.dispose(); pickups.splice(i, 1); }
  }
  pickupTimer -= dt;
  if (pickupTimer <= 0 && wave.idx >= 0) { pickupTimer = 13; spawnPickup(); }
}

function victory() {
  mode = 'victory'; victoryT = 0; firing = false;
  player.anim.playBoth('Cheer', { fade: 0.2 });
  hud.banner('ENCOUNTER CLEAR!');
  sfx.victory();
}

function showResults() {
  mode = 'results';
  unlock();
  const acc = stats.shots ? Math.round(stats.hits / stats.shots * 100) : 0;
  const rewards = [], noDamage = stats.damageTaken === 0;
  let bonus = 0;
  if (noDamage) { bonus += 50; rewards.push('Untouched +50 🪙'); }
  if (acc >= 70) { bonus += 25; rewards.push('Sharpshooter +25 🪙'); }
  if (stats.bestCombo >= 10) { bonus += 25; rewards.push('Combo master +25 🪙'); }
  stats.coins += bonus;
  const stars = 1 + (acc >= 55 ? 1 : 0) + (stats.damageTaken <= 30 ? 1 : 0);
  const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
  rewards.unshift(`${stats.coins} 🪙 coins`, `${stats.xp} ⭐ XP`);
  hud.results({
    stars,
    rows: [['Zombies splashed', stats.kills], ['Accuracy', acc + '%'], ['Best combo', 'x' + stats.bestCombo], ['Damage taken', stats.damageTaken], ['Time', `${m}:${String(s).padStart(2, '0')}`]],
    rewards,
  });
  hud.show('results');
}

function updateCamera(dt, snap = false) {
  const p = player;
  if (mode === 'victory' || mode === 'dying' || mode === 'results' || mode === 'gameover') {
    // Slow orbit around the hunter
    const a = p.yaw + Math.PI + victoryT * 0.5;
    _v.set(p.pos.x + Math.sin(a) * 4.8, 2.4, p.pos.z + Math.cos(a) * 4.8);
    camPos.lerp(_v, snap ? 1 : 1 - Math.exp(-3 * dt));
    camera.position.copy(camPos);
    camera.lookAt(p.pos.x, 1.2, p.pos.z);
    if (mode === 'victory') p.model.rotation.y = Math.atan2(camPos.x - p.pos.x, camPos.z - p.pos.z);
    return;
  }
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  // pivot = over the right shoulder; camera sits behind it along the view direction
  const px = p.pos.x + cy * CFG.camShoulder, py = Math.max(p.pos.y, 0) + CFG.camHeight, pz = p.pos.z - sy * CFG.camShoulder;
  _dir.set(-sy * cp, sp, -cy * cp);
  let dist = CFG.camDist + (CFG.aimDist - CFG.camDist) * aimK;
  const fov = CFG.fov + (CFG.aimFov - CFG.fov) * aimK;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  raycaster.set(_v.set(px, py, pz), _v2.copy(_dir).negate());
  raycaster.far = dist + 0.3;
  const hits = raycaster.intersectObjects(G.level.occluders, false);
  if (hits.length) dist = Math.max(1.2, hits[0].distance - 0.3);
  // Looking up swings the camera down behind the hunter: pull it in closer instead of letting it sink to the road.
  if (sp > 0.001) dist = Math.min(dist, Math.max(1.4, (py - CFG.camMinY) / sp));
  _v.set(px - _dir.x * dist, py - _dir.y * dist, pz - _dir.z * dist);
  const b = G.level.bounds;
  _v.x = clamp(_v.x, b.minX - 1.2, b.maxX + 1.2); _v.z = clamp(_v.z, b.minZ - 1.6, b.maxZ + 1.6);   // stay in front of the building facades _v.y = Math.max(CFG.camMinY, _v.y);
  camPos.lerp(_v, snap ? 1 : 1 - Math.exp(-22 * dt));
  camera.position.copy(camPos);
  if (fx.shake > 0) {
    const s = fx.shake * 0.25;
    camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s;
  }
  camera.rotation.set(p.pitch, p.yaw, 0);
}

function update(dt) {
  G.time += dt;
  if (mode === 'playing') { stats.time += dt; edgeTurn(dt); }

  updatePlayer(dt);
  updateProjectiles(dt);
  for (let i = G.zombies.length - 1; i >= 0; i--) {
    const z = G.zombies[i];
    z.update(dt);
    if (z.gone) { z.dispose(); G.zombies.splice(i, 1); }
  }
  if (mode === 'playing') {
    updateWaves(dt);
    updatePickups(dt);
    if (combo.n > 0) { combo.t -= dt; if (combo.t <= 0) combo.n = 0; }
    if (megaPending > 0) {
      megaPending -= dt;
      if (megaPending <= 0) { hud.banner('MEGA SPLASH!', 'x' + combo.n + ' combo'); splash(player.pos, 11, 70, 0xffe066); }
    }
  } else if (mode === 'victory' || mode === 'dying') {
    victoryT += dt;
    if (mode === 'victory' && victoryT > 3.2) showResults();
    if (mode === 'dying' && victoryT > 2.6) {
      mode = 'gameover'; unlock();
      hud.$('goText').textContent = `You splashed ${stats.kills} zombie${stats.kills === 1 ? '' : 's'} and reached wave ${wave.idx + 1}.`;
      hud.show('gameover');
    }
  }
  fx.update(dt);
  updateCamera(dt);

  const p = player;
  const left = wave.queue.length + G.zombies.filter(z => z.alive).length;
  const nextAt = combo.n < 3 ? 3 : combo.n < 5 ? 5 : Math.ceil((combo.n + 1) / 10) * 10;
  const buffs = [];
  if (p.rapidT > 0) buffs.push(`⚡ RAPID FIRE ${Math.ceil(p.rapidT)}s`);
  if (p.tripleT > 0) buffs.push(`🔱 TRIPLE SHOT ${Math.ceil(p.tripleT)}s`);
  if (p.powerT > 0) buffs.push(`💥 POWER SOAKER ${Math.ceil(p.powerT)}s`);
  hud.update({
    hp: p.hp, maxHp: p.maxHp, ammo: p.ammo, maxAmmo: p.maxAmmo,
    reloading: p.reloadT > 0, reloadFrac: 1 - p.reloadT / CFG.reloadTime, rapid: p.rapidT > 0,
    kills: stats.kills, coins: stats.coins, xp: stats.xp,
    locNum: G.level.index, locName: G.level.name, wave: Math.max(1, wave.idx + 1), waveMax: WAVES.length, left,
    combo: combo.n, comboFrac: combo.t / CFG.comboWindow,
    comboNext: nextAt === 3 ? 'x3 → bonus coins' : nextAt === 5 ? 'x5 → RAPID FIRE' : `x${nextAt} → MEGA SPLASH`,
    qFrac: 1 - Math.max(0, p.specialCd) / CFG.specialCooldown, dodgeFrac: 1 - Math.max(0, p.dodgeCd) / CFG.dodgeCooldown,
    onTarget, buffs,
    crosshair: mode === 'playing' && !p.dead && (aiming || p.aimT > 0),   // only while aiming or shooting
  });
}

let last = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (mode === 'playing' || mode === 'victory' || mode === 'dying') update(dt);
  else if (mode === 'title' || mode === 'results' || mode === 'gameover') {
    // keep the scene alive behind menus
    victoryT += dt;
    player.anim.update(dt);
    for (const z of G.zombies) z.update(dt);
    fx.update(dt);
    updateCamera(dt);
  }
  renderer.render(scene, camera);
}
// Manual stepping hook for automated tests (advances the simulation without waiting for frames).
window.game.step = (seconds, dt = 1 / 60) => { for (let t = 0; t < seconds; t += dt) if (mode === 'playing' || mode === 'victory' || mode === 'dying') update(dt); renderer.render(scene, camera); };
window.game.setFiring = v => { firing = v; };
window.game.pickups = pickups;
window.game.spawnPickupAt = (type, x, z) => { const k = new Pickup(scene, type, x, z); pickups.push(k); return k; };

boot().catch(err => {
  console.error(err);
  document.getElementById('loadText').textContent = 'Could not load the game: ' + err.message;
});
