const $ = id => document.getElementById(id);
const cache = {};

function text(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function width(id, f) { const v = Math.round(Math.max(0, Math.min(1, f)) * 1000) / 10; if (cache['w' + id] !== v) { cache['w' + id] = v; $(id).style.width = v + '%'; } }
function toggle(id, cls, on) { const k = id + cls; if (cache[k] !== on) { cache[k] = on; $(id).classList.toggle(cls, on); } }

let bannerTimer = 0;

export const hud = {
  $,
  show(id, on = true) { $(id).classList.toggle('hidden', !on); },

  update(s) {
    text('hpText', Math.ceil(s.hp)); width('hpFill', s.hp / s.maxHp);
    text('ammoText', s.reloading ? 'REFILLING' : s.ammo); width('ammoFill', s.reloading ? s.reloadFrac : s.ammo / s.maxAmmo);
    text('ammoBig', s.rapid ? '∞' : s.ammo); text('ammoMax', s.maxAmmo);
    text('wState', s.reloading ? 'REFILLING…' : s.rapid ? 'RAPID FIRE' : '');
    text('kills', s.kills); text('coins', s.coins); text('xp', s.xp); text('goo', s.goo);
    toggle('bossBar', 'hidden', !s.boss);
    if (s.boss) { text('bossName', s.boss.name); width('bossFill', s.boss.frac); toggle('bossBar', 'weak', s.boss.weak); }
    text('locNum', s.locNum); text('locName', s.locName);
    text('waveNum', s.wave); text('waveMax', s.waveMax); text('zLeft', s.left);
    text('comboNum', s.combo); width('comboFill', s.comboFrac); text('comboNext', s.comboNext);
    toggle('combo', 'off', s.combo < 1);
    width('qFill', s.qFrac); toggle('abilQ', 'cd', s.qFrac < 1);
    width('tSpecialFill', s.qFrac); toggle('tSpecial', 'cd', s.qFrac < 1);
    width('shiftFill', s.dodgeFrac); toggle('abilShift', 'cd', s.dodgeFrac < 1);
    toggle('crosshair', 'hot', s.onTarget);
    toggle('crosshair', 'show', s.crosshair);
    const buffs = s.buffs.join('|');
    if (cache.buffs !== buffs) { cache.buffs = buffs; $('buffs').innerHTML = s.buffs.map(b => `<div class="buff">${b}</div>`).join(''); }
  },

  bumpCombo() { const c = $('combo'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); },
  kick() { const c = $('crosshair'); c.classList.add('kick'); setTimeout(() => c.classList.remove('kick'), 50); },
  hurt() { const v = $('vignette'); v.classList.add('on'); setTimeout(() => v.classList.remove('on'), 60); },

  banner(title, sub = '') {
    const b = $('banner');
    b.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 1900);
  },

  results(r) {
    $('stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= r.stars ? '' : 'dim'}">⭐</span>`).join('');
    $('rtable').innerHTML = r.rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    $('rewards').innerHTML = r.rewards.map(t => `<span>${t}</span>`).join('');
  },
};
