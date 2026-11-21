// render.js — everything the player sees, drawn on one canvas.
// Top-down, flat vector art with a night palette: dark slate floors, warm
// lantern glow, gold vision cones that turn red on alert. Cones are clipped
// by walls ray by ray (see vision.coneRayLength), so what the player sees
// is exactly what the guard sees. The HUD is drawn on the same canvas so
// screenshots always carry the game state: level name, lanterns, score,
// lives, pebbles, and the suspicion meter that fills as a guard spots you.

import { coneRayLength, pointInRect } from './vision.js';

export const VIEW = { w: 960, h: 600 };

const PALETTE = {
  floor: '#1c2433',
  floorAlt: '#202a3d',
  wall: '#3a4660',
  wallEdge: '#55648a',
  bush: '#2f6b3a',
  bushEdge: '#4da45e',
  crate: '#7a5a33',
  crateEdge: '#a97f45',
  statue: '#6b7280',
  statueEdge: '#9ca3af',
  exit: '#34d399',
  exitEdge: '#a7f3d0',
  player: '#fbbf24',
  playerCloak: '#78350f',
  lantern: '#fde68a',
  hudBg: 'rgba(10, 14, 24, 0.82)',
  text: '#e5e7eb',
  dim: '#9ca3af',
  alert: '#ef4444',
  warn: '#f59e0b',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.flash = 0; // near-miss flash, 0..1, decays in draw()
  }

  draw(state) {
    const ctx = this.ctx;
    const level = state.level;
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);
    this.drawFloor(ctx, state.time);
    this.drawCover(ctx, level);
    this.drawLanterns(ctx, state);
    this.drawExit(ctx, level, state.time);
    this.drawGuards(ctx, state);
    this.drawPebbles(ctx, state);
    this.drawPlayer(ctx, state);
    this.drawLighting(ctx, state);
    this.drawHud(ctx, state);
    if (state.screen !== 'play') this.drawOverlay(ctx, state);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(239, 68, 68, ${this.flash * 0.22})`;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      this.flash = Math.max(0, this.flash - 0.02);
    }
  }

  drawFloor(ctx, time) {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    // Checker tiles, faint, so the floor reads as stone at a glance.
    ctx.fillStyle = PALETTE.floorAlt;
    for (let y = 0; y < 600; y += 60) {
      for (let x = 0; x < 960; x += 60) {
        if (((x + y) / 60) % 2 === 0) ctx.fillRect(x, y, 60, 60);
      }
    }
    // A faint flicker of torchlight along the top edge.
    const flicker = 0.05 + 0.02 * Math.sin(time * 2.1);
    ctx.fillStyle = `rgba(251, 191, 36, ${flicker})`;
    ctx.fillRect(0, 0, VIEW.w, 16);
  }

  drawCover(ctx, level) {
    for (const c of level.cover) {
      if (c.kind === 'bush') {
        ctx.fillStyle = PALETTE.bush;
        roundRect(ctx, c.x, c.y, c.w, c.h, 18);
        ctx.fill();
        ctx.fillStyle = PALETTE.bushEdge;
        for (let i = 0; i < 5; i++) {
          const bx = c.x + 12 + i * ((c.w - 24) / 4);
          ctx.beginPath();
          ctx.arc(bx, c.y + c.h / 2, 11, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (c.kind === 'crate') {
        ctx.fillStyle = PALETTE.crate;
        roundRect(ctx, c.x, c.y, c.w, c.h, 4);
        ctx.fill();
        ctx.strokeStyle = PALETTE.crateEdge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + c.w, c.y + c.h);
        ctx.moveTo(c.x + c.w, c.y);
        ctx.lineTo(c.x, c.y + c.h);
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.statue;
        ctx.beginPath();
        ctx.arc(c.x + c.w / 2, c.y + c.h / 2, Math.min(c.w, c.h) / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.statueEdge;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
    // Walls on top of the floor, with a lit edge.
    for (const w of level.walls) {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = PALETTE.wallEdge;
      if (w.h <= 24) ctx.fillRect(w.x, w.y, w.w, 3);
      else ctx.fillRect(w.x, w.y, 3, w.h);
    }
  }

  drawLanterns(ctx, state) {
    for (const L of state.lanterns) {
      if (L.taken) continue;
      const bob = Math.sin(state.time * 2 + L.x) * 2;
      const glow = ctx.createRadialGradient(L.x, L.y + bob, 2, L.x, L.y + bob, 46);
      glow.addColorStop(0, 'rgba(253, 230, 138, 0.55)');
      glow.addColorStop(1, 'rgba(253, 230, 138, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(L.x - 46, L.y + bob - 46, 92, 92);
      ctx.fillStyle = PALETTE.lantern;
      roundRect(ctx, L.x - 7, L.y + bob - 10, 14, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.fillRect(L.x - 9, L.y + bob - 13, 18, 4);
    }
  }

  drawExit(ctx, level, time) {
    const e = level.exit;
    const pulse = 0.5 + 0.3 * Math.sin(time * 3);
    const glow = ctx.createRadialGradient(
      e.x + e.w / 2, e.y + e.h / 2, 4,
      e.x + e.w / 2, e.y + e.h / 2, 70,
    );
    glow.addColorStop(0, `rgba(52, 211, 153, ${pulse})`);
    glow.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(e.x - 42, e.y - 42, e.w + 84, e.h + 84);
    ctx.fillStyle = '#064e3b';
    roundRect(ctx, e.x, e.y, e.w, e.h, 6);
    ctx.fill();
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = PALETTE.exitEdge;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', e.x + e.w / 2, e.y + e.h / 2 + 5);
  }

  drawGuards(ctx, state) {
    const solids = state.solids;
    for (const g of state.guards) {
      // Vision cone, clipped by walls ray by ray.
      const coneColor = g.state === 'alert'
        ? 'rgba(239, 68, 68, 0.34)'
        : g.state === 'suspicious' || g.state === 'searching'
          ? 'rgba(245, 158, 11, 0.30)'
          : 'rgba(251, 191, 36, 0.26)';
      ctx.fillStyle = coneColor;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      const rays = 14;
      for (let i = 0; i <= rays; i++) {
        const a = g.angle - g.fov / 2 + (g.fov * i) / rays;
        const len = coneRayLength(g, a, solids, g.viewDist);
        ctx.lineTo(g.x + Math.cos(a) * len, g.y + Math.sin(a) * len);
      }
      ctx.closePath();
      ctx.fill();
      // Guard body: a ring in the guard's own colour, facing tick, name.
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + Math.cos(g.angle) * 20, g.y + Math.sin(g.angle) * 20);
      ctx.stroke();
      ctx.fillStyle = '#f9fafb';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.name, g.x, g.y - 20);
      // "?" while suspicious, "!" while alerting.
      if (g.state === 'suspicious' || g.state === 'searching') {
        ctx.fillStyle = PALETTE.warn;
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('?', g.x, g.y - 32);
      } else if (g.state === 'alert') {
        ctx.fillStyle = PALETTE.alert;
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText('!', g.x, g.y - 32);
      }
      // Last-seen marker: where the guard thinks you are. A pulsing ring
      // tells the player exactly what the guard is hunting, so a chase
      // reads as fair instead of psychic.
      if ((g.state === 'alert' || g.state === 'searching') && g.lastSeen) {
        const pulse = 10 + 4 * Math.sin(state.time * 6);
        ctx.strokeStyle = g.state === 'alert' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(245, 158, 11, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.lastSeen.x, g.lastSeen.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(g.lastSeen.x - 6, g.lastSeen.y - 6);
        ctx.lineTo(g.lastSeen.x + 6, g.lastSeen.y + 6);
        ctx.moveTo(g.lastSeen.x + 6, g.lastSeen.y - 6);
        ctx.lineTo(g.lastSeen.x - 6, g.lastSeen.y + 6);
        ctx.stroke();
      }
    }
  }

  drawPebbles(ctx, state) {
    for (const p of state.pebbles) {
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(209, 213, 219, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4 + p.age * 14, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawPlayer(ctx, state) {
    const p = state.player;
    // Lantern glow around Wick — the one light that is always yours.
    const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, 70);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.35)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(p.x - 70, p.y - 70, 140, 140);
    ctx.fillStyle = PALETTE.playerCloak;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.player;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Hood point shows facing; crouch ring shows sneak mode.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 9, p.y + Math.sin(p.angle) * 9, 4, 0, Math.PI * 2);
    ctx.fill();
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawLighting(ctx, state) {
    // A soft vignette: the edges of the manor are darker than the middle,
    // so the eye reads lit floor as safe and dark corners as risky.
    const grad = ctx.createRadialGradient(480, 300, 220, 480, 300, 620);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(2, 6, 18, 0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    if (state.alert) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, VIEW.w - 6, VIEW.h - 6);
    }
  }

  drawHud(ctx, state) {
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 8, 8, 944, 40, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.level.name, 20, 33);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = PALETTE.dim;
    ctx.fillText(state.level.hint, 250, 33);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 14px sans-serif';
    const got = state.lanterns.filter((L) => L.taken).length;
    ctx.fillText(`Lanterns ${got}/${state.lanterns.length}   Score ${state.score}   Lives ${state.lives}   Pebbles ${state.pebblesLeft}`, 940, 33);
    // Suspicion meter, top centre: fills gold, then red.
    const top = state.topSuspicion;
    const mw = 220;
    const mx = 480 - mw / 2;
    ctx.fillStyle = '#0f172a';
    roundRect(ctx, mx, 56, mw, 10, 5);
    ctx.fill();
    if (top > 0) {
      ctx.fillStyle = top >= 70 ? PALETTE.alert : top >= 35 ? PALETTE.warn : '#fbbf24';
      roundRect(ctx, mx, 56, mw * (top / 100), 10, 5);
      ctx.fill();
    }
    ctx.fillStyle = top >= 70 ? PALETTE.alert : PALETTE.dim;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(top >= 100 ? 'ALERT!' : top >= 70 ? 'NEAR MISS — BREAK LINE OF SIGHT' : top >= 35 ? 'SPOTTED — HIDE!' : 'UNSEEN', 480, 80);
    // Pebble hint at the bottom.
    ctx.fillStyle = 'rgba(229, 231, 235, 0.75)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('WASD / arrows move · Shift sneak · Click tosses a pebble · P pause · R restart · M mute', 12, 592);
  }

  drawOverlay(ctx, state) {
    ctx.fillStyle = 'rgba(2, 6, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    const cx = 480;
    if (state.screen === 'title') {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 54px sans-serif';
      ctx.fillText('SHADOW LANTERN', cx, 190);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '17px sans-serif';
      ctx.fillText('Steal every lantern. Reach the green exit. Never let the cones find you.', cx, 235);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '14px sans-serif';
      ctx.fillText('WASD / arrows to move · Shift to sneak · Click to toss a pebble', cx, 268);
      ctx.fillText('Bushes hide you · Crates and walls block sight · Being seen fills the meter —', cx, 292);
      ctx.fillText('break line of sight before it hits the top and the guard gives up.', cx, 314);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Press ENTER or click to begin', cx, 380);
    } else if (state.screen === 'level-clear') {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('LEVEL CLEAR', cx, 230);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '18px sans-serif';
      ctx.fillText(`Lanterns ${state.clearedLanterns}/${state.lanterns.length} · Time bonus +${state.timeBonus} · Ghost bonus +${state.ghostBonus}`, cx, 280);
      ctx.fillText(`Score ${state.score}`, cx, 312);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(state.isLastLevel ? 'Press ENTER for the final tally' : 'Press ENTER for the next floor', cx, 370);
    } else if (state.screen === 'caught') {
      ctx.fillStyle = PALETTE.alert;
      ctx.font = 'bold 44px sans-serif';
      ctx.fillText('CAUGHT!', cx, 230);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '18px sans-serif';
      ctx.fillText(state.lives > 0 ? `The guard grabbed your cloak. ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left — try the floor again.` : 'Out of lives.', cx, 280);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText(state.lives > 0 ? 'Press ENTER to retry the floor' : 'Press ENTER to start over', cx, 340);
    } else if (state.screen === 'win') {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 48px sans-serif';
      ctx.fillText('THE MANOR IS YOURS', cx, 210);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '19px sans-serif';
      ctx.fillText(`Every lantern stolen, every floor crossed unseen enough.`, cx, 260);
      ctx.fillText(`Final score ${state.score} · Best ${state.best}`, cx, 295);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 17px sans-serif';
      ctx.fillText('Press ENTER to play again', cx, 360);
    } else if (state.screen === 'paused') {
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 40px sans-serif';
      ctx.fillText('PAUSED', cx, 260);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '16px sans-serif';
      ctx.fillText('Press P to resume', cx, 300);
    }
  }
}
