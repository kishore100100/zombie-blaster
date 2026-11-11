import * as THREE from 'three';

// Bones that belong to the upper body; everything else is treated as lower body.
const UPPER = /^(spine|chest|head|upperarm|lowerarm|wrist|hand|handslot|elbowIK)/;

/**
 * Thin wrapper around AnimationMixer with cross-fading.
 * Parts: 'full' (whole skeleton), or 'lower' + 'upper' so legs can run while arms aim.
 */
export class Animator {
  constructor(root, clips) {
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = {};
    clips.forEach(c => { this.clips[c.name] = c; });
    this.actions = {};
    this.cur = {};
  }

  _action(name, part) {
    const key = part + ':' + name;
    if (!this.actions[key]) {
      let clip = this.clips[name];
      if (!clip) { console.warn('Missing animation', name); return null; }
      if (part !== 'full') {
        const wantUpper = part === 'upper';
        clip = new THREE.AnimationClip(name + '_' + part, clip.duration, clip.tracks.filter(t => UPPER.test(t.name) === wantUpper));
      }
      this.actions[key] = this.mixer.clipAction(clip);
    }
    return this.actions[key];
  }

  /** Returns the playback duration in seconds. */
  play(name, { part = 'full', fade = 0.15, once = false, speed = 1, restart = false } = {}) {
    const a = this._action(name, part);
    if (!a) return 0;
    const dur = a.getClip().duration / speed;
    const prev = this.cur[part];
    a.timeScale = speed;
    if (prev === a) {
      if (restart) { a.time = 0; a.paused = false; a.enabled = true; }
      return dur;
    }
    a.reset();
    a.timeScale = speed;
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = once;
    a.setEffectiveWeight(1);
    a.fadeIn(fade).play();
    if (prev) prev.fadeOut(fade);
    this.cur[part] = a;
    return dur;
  }

  /** Play one clip on both body halves (for split characters). */
  playBoth(name, opts = {}) {
    this.play(name, { ...opts, part: 'lower' });
    return this.play(name, { ...opts, part: 'upper' });
  }

  update(dt) { this.mixer.update(dt); }
}
