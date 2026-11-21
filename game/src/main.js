// main.js — the game loop and the rules that hold it together.
// Screens: title → play → level-clear → (next floor) → win, with caught /
// paused in between. Wick moves with WASD/arrows, sneaks with Shift, and
// tosses pebbles with the mouse; guards patrol, spot, chase and recover
// through patrol.js / vision.js / detection.js. Score: 150 per lantern,
// 500 per floor cleared, a time bonus, and a ghost bonus when no guard ever
// reached full alert on that floor. Best score survives in localStorage.

import { LEVELS, PLAYFIELD } from './levels.js';
import { Guard } from './patrol.js';
import { canSeeGuard, pointInRect } from './vision.js';
import { Detection } from './detection.js';
import { SoundBank } from './audio.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { makeRng, hashSeed } from './random.js';
import { applyShot } from './shots.js';

const PLAYER_R = 12;
const WALK_SPEED = 165;
const SNEAK_SPEED = 85;
const PEBBLES_PER_LEVEL = 3;
const LANTERN_SCORE = 150;
const CLEAR_SCORE = 500;
const GHOST_BONUS = 300;
const BEST_KEY = 'shadow-lantern-best';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sounds = new SoundBank();
    this.detection = new Detection();
    this.input.onFirstGesture = () => this.sounds.ensure();
    this.screen = 'title';
    this.levelIndex = 0;
    this.score = 0;
    this.lives = 3;
    this.best = 0;
    try { this.best = Number(window.localStorage.getItem(BEST_KEY) || 0); } catch { this.best = 0; }
    this.time = 0;
    this.levelTime = 0;
    this.ghostRun = true; // false once any guard hits full alert this floor
    this.stepAcc = 0; // distance accumulator for footstep sounds
    this.guardStepAcc = 0;
    this.loadLevel(0);
  }

  get level() { return LEVELS[this.levelIndex]; }

  // Solids are walls plus crates and statues (they block movement and
  // sight); bushes block neither, they only hide.
  get solids() {
    const solids = [...this.level.walls];
    for (const c of this.level.cover) {
      if (c.kind !== 'bush') solids.push(c);
    }
    return solids;
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.rng = makeRng(hashSeed(def.id) ^ 0x9e3779b9);
    this.guards = def.guards.map((g) => new Guard(g));
    this.lanterns = def.lanterns.map((L) => ({ ...L, taken: false }));
    this.player = {
      x: def.playerStart.x, y: def.playerStart.y,
      angle: -Math.PI / 2, sneaking: false, moving: false,
    };
    this.pebbles = [];
    this.pebblesLeft = PEBBLES_PER_LEVEL;
    this.detection.reset();
    this.levelTime = 0;
    this.ghostRun = true;
    this.alert = false;
    this.topSuspicion = 0;
    this.timeBonus = 0;
    this.ghostBonus = 0;
    this.clearedLanterns = 0;
  }

  blockedAt(x, y) {
    if (x < 16 + PLAYER_R || x > PLAYFIELD.w - 16 - PLAYER_R) return true;
    if (y < 16 + PLAYER_R || y > PLAYFIELD.h - 16 - PLAYER_R) return true;
    for (const s of this.solids) {
      if (x + PLAYER_R > s.x && x - PLAYER_R < s.x + s.w &&
          y + PLAYER_R > s.y && y - PLAYER_R < s.y + s.h) return true;
    }
    return false;
  }

  start() {
    // A ?shot= URL freezes a composed scene for screenshots instead of
    // running the live game; ?seed= pins the random stream.
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const seed = Number(params.get('seed') || 7);
    this.rng = makeRng(seed);
    if (shot) {
      applyShot(this, shot, seed);
      this.renderer.draw(this.snapshot());
      return;
    }
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.time += dt;
      this.tick(dt);
      this.renderer.draw(this.snapshot());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  snapshot() {
    return {
      level: this.level, guards: this.guards, lanterns: this.lanterns,
      player: this.player, pebbles: this.pebbles, solids: this.solids,
      screen: this.screen, score: this.score, lives: this.lives,
      pebblesLeft: this.pebblesLeft, time: this.time, alert: this.alert,
      topSuspicion: this.topSuspicion, best: this.best,
      clearedLanterns: this.clearedLanterns, timeBonus: this.timeBonus,
      ghostBonus: this.ghostBonus, isLastLevel: this.levelIndex === LEVELS.length - 1,
    };
  }

  tick(dt) {
    if (this.input.pressedOnce('m')) this.sounds.enabled = !this.sounds.enabled;
    if (this.screen === 'title') {
      if (this.input.pressedOnce('Enter') || this.input.takeClick()) {
        this.screen = 'play';
        this.sounds.ensure();
      }
      return;
    }
    if (this.screen === 'paused') {
      if (this.input.pressedOnce('p') || this.input.pressedOnce('Escape')) this.screen = 'play';
      return;
    }
    if (this.screen === 'level-clear') {
      if (this.input.pressedOnce('Enter')) {
        if (this.levelIndex === LEVELS.length - 1) {
          this.screen = 'win';
          this.saveBest();
        } else {
          this.loadLevel(this.levelIndex + 1);
          this.screen = 'play';
        }
      }
      return;
    }
    if (this.screen === 'caught') {
      if (this.input.pressedOnce('Enter')) {
        if (this.lives <= 0) {
          this.score = 0;
          this.lives = 3;
          this.loadLevel(0);
        } else {
          this.loadLevel(this.levelIndex);
        }
        this.screen = 'play';
      }
      return;
    }
    if (this.screen === 'win') {
      if (this.input.pressedOnce('Enter')) {
        this.score = 0;
        this.lives = 3;
        this.loadLevel(0);
        this.screen = 'play';
      }
      return;
    }
    // --- screen === 'play' ---
    if (this.input.pressedOnce('p') || this.input.pressedOnce('Escape')) {
      this.screen = 'paused';
      return;
    }
    if (this.input.pressedOnce('r')) {
      this.loadLevel(this.levelIndex);
      return;
    }
    this.levelTime += dt;
    this.updatePlayer(dt);
    this.updateGuards(dt);
    this.updatePebbles(dt);
    this.checkPickups();
    this.checkExit();
    this.checkCaught();
    for (const ev of this.detection.drainEvents()) {
      if (ev.type === 'near-miss') {
        this.sounds.alarm(false);
        this.renderer.flash = 1;
      } else if (ev.type === 'alert') {
        this.sounds.alarm(true);
        this.ghostRun = false;
      }
    }
    this.topSuspicion = this.detection.topSuspicion(this.guards);
    this.alert = this.detection.refreshAlert(this.guards);
  }

  updatePlayer(dt) {
    const mv = this.input.moveVector();
    const sneaking = this.input.sneaking;
    const speed = sneaking ? SNEAK_SPEED : WALK_SPEED;
    const p = this.player;
    p.sneaking = sneaking;
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.angle = Math.atan2(mv.y, mv.x);
      const nx = p.x + mv.x * speed * dt;
      const ny = p.y + mv.y * speed * dt;
      if (!this.blockedAt(nx, p.y)) p.x = nx;
      if (!this.blockedAt(p.x, ny)) p.y = ny;
      // Footsteps: soft ticks, louder when running.
      this.stepAcc += speed * dt;
      if (this.stepAcc > (sneaking ? 34 : 46)) {
        this.stepAcc = 0;
        this.sounds.footstep(false, 0, sneaking ? 0.05 : 0.12);
      }
    }
    const click = this.input.takeClick();
    if (click && this.pebblesLeft > 0) {
      this.pebblesLeft -= 1;
      this.pebbles.push({ x: click.x, y: click.y, age: 0 });
      this.sounds.toss();
      // Guards within earshot walk over to look.
      for (const g of this.guards) {
        const d = Math.hypot(g.x - click.x, g.y - click.y);
        if (d < 260) g.investigateAt(click.x, click.y);
      }
      this.sounds.pebbleLand();
    }
  }

  updateGuards(dt) {
    const blocked = (x, y) => {
      for (const s of this.solids) {
        if (x > s.x && x < s.x + s.w && y > s.y && y < s.y + s.h) return true;
      }
      return x < 16 || x > PLAYFIELD.w - 16 || y < 16 || y > PLAYFIELD.h - 16;
    };
    for (const g of this.guards) {
      g.update(dt, blocked);
      const visible = canSeeGuard(g, this.player, this.level, this.solids);
      this.detection.updateGuard(g, visible, this.player, dt, this.player.sneaking);
      // Guard footsteps: volume by distance, pan by direction.
      if (g.moved > 0) {
        this.guardStepAcc += g.moved;
        if (this.guardStepAcc > 52) {
          this.guardStepAcc = 0;
          const d = Math.hypot(g.x - this.player.x, g.y - this.player.y);
          const vol = Math.max(0, 0.22 * (1 - d / 420));
          const pan = Math.max(-1, Math.min(1, (g.x - this.player.x) / 300));
          this.sounds.footstep(true, pan, vol);
        }
      }
      // A chasing guard re-aims at Wick's live position while it sees him.
      if (g.state === 'alert' && visible.seen) g.target = { x: this.player.x, y: this.player.y };
    }
  }

  updatePebbles(dt) {
    for (const p of this.pebbles) p.age += dt;
    this.pebbles = this.pebbles.filter((p) => p.age < 2.5);
  }

  checkPickups() {
    for (const L of this.lanterns) {
      if (L.taken) continue;
      if (Math.hypot(L.x - this.player.x, L.y - this.player.y) < 26) {
        L.taken = true;
        this.score += LANTERN_SCORE;
        this.sounds.pickup();
      }
    }
  }

  checkExit() {
    if (!pointInRect(this.player.x, this.player.y, this.level.exit)) return;
    this.clearedLanterns = this.lanterns.filter((L) => L.taken).length;
    this.timeBonus = Math.max(0, Math.round(300 - this.levelTime * 2));
    this.ghostBonus = this.ghostRun ? GHOST_BONUS : 0;
    this.score += CLEAR_SCORE + this.timeBonus + this.ghostBonus;
    this.sounds.win();
    this.screen = 'level-clear';
  }

  checkCaught() {
    for (const g of this.guards) {
      if (g.state !== 'alert') continue;
      if (Math.hypot(g.x - this.player.x, g.y - this.player.y) < 22) {
        this.lives -= 1;
        this.sounds.caught();
        this.screen = 'caught';
        return;
      }
    }
  }

  saveBest() {
    if (this.score > this.best) {
      this.best = this.score;
      try { window.localStorage.setItem(BEST_KEY, String(this.best)); } catch { /* private mode */ }
    }
  }
}

// Boot: the page holds one canvas; the game owns everything below it.
const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
