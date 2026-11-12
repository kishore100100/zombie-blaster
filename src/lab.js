// The laboratory between encounters: spend coins on upgrades, spend goo on crafted ammo.

export const UPGRADES = [
  { id: 'damage', icon: '💥', name: 'Blaster damage', desc: '+20% damage per level', costs: [60, 110, 170, 240, 320] },
  { id: 'rate', icon: '⚡', name: 'Shooting speed', desc: '8% faster per level', costs: [60, 110, 170, 240, 320] },
  { id: 'tank', icon: '💧', name: 'Tank capacity', desc: '+6 shots per level', costs: [40, 80, 130, 190, 260] },
  { id: 'health', icon: '❤', name: 'Max health', desc: '+20 health per level', costs: [50, 100, 160, 230, 310] },
  { id: 'special', icon: '🌊', name: 'Super Splash cooldown', desc: '2.5 seconds shorter per level', costs: [50, 100, 160, 230] },
];

export const RECIPES = [
  { id: 'sticky', icon: '🍯', name: 'Sticky Shots', desc: 'Every hit slows the zombie for 2 seconds', goo: 6 },
  { id: 'splash', icon: '💦', name: 'Splash Rounds', desc: 'Every hit also soaks zombies standing nearby', goo: 10 },
];

export function newProgress() {
  return { up: { damage: 0, rate: 0, tank: 0, health: 0, special: 0 }, crafted: { sticky: false, splash: false } };
}

/** Draw the lab lists. `wallet` = { coins, goo }. */
export function renderLab(prog, wallet, $) {
  $('labCoins').textContent = wallet.coins;
  $('labGoo').textContent = wallet.goo;
  $('labUp').innerHTML = UPGRADES.map(u => {
    const lvl = prog.up[u.id], max = u.costs.length, cost = u.costs[lvl];
    const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
    const btn = lvl >= max ? '<button class="buy" disabled>MAX</button>'
      : `<button class="buy" data-buy="${u.id}" ${wallet.coins < cost ? 'disabled' : ''}>${cost} 🪙</button>`;
    return `<div class="labrow"><span class="lico">${u.icon}</span><div class="ltxt"><b>${u.name}</b><small>${u.desc}</small><div class="pips">${pips}</div></div>${btn}</div>`;
  }).join('');
  $('labCraft').innerHTML = RECIPES.map(r => {
    const have = prog.crafted[r.id];
    const btn = have ? '<button class="buy" disabled>CRAFTED ✓</button>'
      : `<button class="buy goo" data-craft="${r.id}" ${wallet.goo < r.goo ? 'disabled' : ''}>${r.goo} 🧪</button>`;
    return `<div class="labrow"><span class="lico">${r.icon}</span><div class="ltxt"><b>${r.name}</b><small>${r.desc}</small></div>${btn}</div>`;
  }).join('');
}
