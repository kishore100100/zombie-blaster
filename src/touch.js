// On-screen controls for phones and tablets: left thumb = move stick, right thumb = look, buttons = actions.

const STICK_RADIUS = 56;

export const touch = {
  enabled: false,
  move: { f: 0, r: 0, active: false },
};

/**
 * @param {object} api  { look(dx, dy), fire(bool), action(name), playing() }
 */
export function initTouch(api) {
  const layer = document.getElementById('touch');
  const base = document.getElementById('stickBase'), knob = document.getElementById('stickKnob');
  const touches = new Map();   // identifier -> { kind: 'stick' | 'look' | 'fire', x, y, ox, oy }

  function enable() {
    if (touch.enabled) return;
    touch.enabled = true;
    document.body.classList.add('touch');
  }
  touch.enable = enable;
  if (new URLSearchParams(location.search).has('touch') || (window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches)) enable();
  window.addEventListener('touchstart', enable, { once: true, passive: true });

  function setStick(dx, dy) {
    const len = Math.hypot(dx, dy), k = len > STICK_RADIUS ? STICK_RADIUS / len : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.move.r = dx / STICK_RADIUS; touch.move.f = -dy / STICK_RADIUS;
  }
  function releaseStick() {
    touch.move.f = touch.move.r = 0; touch.move.active = false;
    base.classList.remove('on'); knob.style.transform = '';
    base.style.left = ''; base.style.top = '';
  }

  layer.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!api.playing()) return;
    for (const t of e.changedTouches) {
      const btn = t.target.closest ? t.target.closest('[data-act]') : null;
      if (btn) {
        const act = btn.dataset.act;
        btn.classList.add('down');
        if (act === 'fire') { api.fire(true); touches.set(t.identifier, { kind: 'fire', x: t.clientX, y: t.clientY, btn }); }
        else { api.action(act); touches.set(t.identifier, { kind: 'btn', btn }); }
      } else if (t.clientX < innerWidth * 0.42 && !touch.move.active) {
        touch.move.active = true;
        base.style.left = t.clientX + 'px'; base.style.top = t.clientY + 'px';
        base.classList.add('on');
        touches.set(t.identifier, { kind: 'stick', ox: t.clientX, oy: t.clientY });
      } else {
        touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
      }
    }
  }, { passive: false });

  layer.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      if (s.kind === 'stick') setStick(t.clientX - s.ox, t.clientY - s.oy);
      else if (s.kind === 'look' || s.kind === 'fire') {     // dragging on the fire button also aims
        api.look(t.clientX - s.x, t.clientY - s.y);
        s.x = t.clientX; s.y = t.clientY;
      }
    }
  }, { passive: false });

  const end = e => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      touches.delete(t.identifier);
      if (s.btn) s.btn.classList.remove('down');
      if (s.kind === 'stick') releaseStick();
      if (s.kind === 'fire') api.fire(false);
    }
  };
  layer.addEventListener('touchend', end, { passive: false });
  layer.addEventListener('touchcancel', end, { passive: false });

  /** Drop every active touch (used when the game pauses or a round ends). */
  touch.reset = () => {
    for (const s of touches.values()) if (s.btn) s.btn.classList.remove('down');
    touches.clear(); releaseStick(); api.fire(false);
  };
}
