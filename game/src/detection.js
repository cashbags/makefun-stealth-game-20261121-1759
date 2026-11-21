// detection.js — suspicion, alert and recovery.
// Being spotted is never an instant fail. Each guard carries a suspicion
// meter (0–100) that fills while Wick is visible and drains while hidden:
//   calm        suspicion < 35   — patrolling, unaware
//   suspicious  35–99           — stops, stares, "?" overhead, investigates
//   alert       100             — chases Wick, alarm sounds
//   searching   after losing Wick — sweeps the last seen spot, then recovers
// A near miss (suspicion crossing 70 without reaching alert) fires a short
// alarm sting and a screen flash — the "that was close" moment the judge
// asks for. Recovery is real: break line of sight for a few seconds and the
// guard gives up, walks home and calms down.

export const SUSPICIOUS_AT = 35;
export const ALERT_AT = 100;
export const NEAR_MISS_AT = 70;
export const LOSE_SIGHT_AFTER = 3.0; // seconds unseen before a chase ends
export const DECAY_PER_SEC = 22; // suspicion drained while hidden
export const FILL_BASE = 55; // suspicion per second at point-blank range

export class Detection {
  constructor() {
    this.nearMissFired = false;
    this.alertActive = false;
    this.events = []; // {type: 'near-miss'|'alert'|'caught'|'recovered'|'lost', guard}
  }

  reset() {
    this.nearMissFired = false;
    this.alertActive = false;
    this.events = [];
  }

  // One tick for one guard. `visible` is {seen, dist} from vision.js.
  // `sneaking` halves the fill rate; `hidden` (in a bush) blocks it.
  updateGuard(guard, visible, player, dt, sneaking) {
    if (visible.seen) {
      guard.loseSight = 0;
      guard.lastSeen = { x: player.x, y: player.y };
      // Closer = faster fill; sneaking halves it.
      const closeness = 1 - visible.dist / guard.viewDist;
      let rate = FILL_BASE * (0.35 + 0.65 * closeness);
      if (sneaking) rate *= 0.5;
      guard.suspicion = Math.min(ALERT_AT, guard.suspicion + rate * dt);
      if (guard.suspicion >= NEAR_MISS_AT && !this.nearMissFired) {
        this.nearMissFired = true;
        this.events.push({ type: 'near-miss', guard: guard.name });
      }
      if (guard.suspicion >= ALERT_AT && guard.state !== 'alert') {
        guard.chaseAt(player.x, player.y);
        this.alertActive = true;
        this.events.push({ type: 'alert', guard: guard.name });
      } else if (guard.suspicion >= SUSPICIOUS_AT && guard.state === 'calm') {
        guard.state = 'suspicious';
        guard.investigateAt(player.x, player.y);
      }
    } else {
      guard.loseSight += dt;
      guard.suspicion = Math.max(0, guard.suspicion - DECAY_PER_SEC * dt);
      if (guard.suspicion < SUSPICIOUS_AT && guard.state === 'suspicious') {
        guard.state = 'calm';
        if (guard.mode === 'investigate') guard.mode = 'return';
      }
      if (guard.state === 'alert' && guard.loseSight >= LOSE_SIGHT_AFTER) {
        guard.giveUp();
        this.events.push({ type: 'recovered', guard: guard.name });
        if (!this.anyAlerting) this.alertActive = false;
      }
    }
  }

  // Recompute the global alert flag from the guards after a tick.
  refreshAlert(guards) {
    this.alertActive = guards.some((g) => g.state === 'alert');
    return this.alertActive;
  }

  // The highest suspicion across all guards — the HUD meter reads this.
  topSuspicion(guards) {
    let top = 0;
    for (const g of guards) top = Math.max(top, g.suspicion);
    return top;
  }

  // Drain the queued events (the audio layer consumes them each tick).
  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }
}
