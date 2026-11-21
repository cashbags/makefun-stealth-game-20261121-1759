// patrol.js — guard movement along waypoint loops.
// A guard walks to each waypoint in turn, pauses there and looks around
// (a slow scan), then moves on. The patrol is fully learnable: same route,
// same timing, every loop. Chasing and investigating are layered on top by
// detection.js, which only ever overrides the guard's current target — the
// patrol itself never changes, so the player can always learn the rhythm.

export class Guard {
  constructor(def) {
    this.name = def.name;
    this.waypoints = def.waypoints;
    this.speed = def.speed;
    this.pause = def.pause;
    this.viewDist = def.viewDist;
    this.fov = def.fov;
    this.color = def.color;
    this.x = def.waypoints[0][0];
    this.y = def.waypoints[0][1];
    this.wpIndex = 1 % def.waypoints.length;
    this.wait = 0;
    // Facing angle in radians; starts facing along the first leg.
    this.angle = Math.atan2(
      def.waypoints[1 % def.waypoints.length][1] - this.y,
      def.waypoints[1 % def.waypoints.length][0] - this.x,
    );
    this.mode = 'patrol'; // patrol | investigate | chase | return
    this.target = null; // {x, y} for investigate / chase
    this.scanPhase = 0; // slow look-around while paused
    this.moved = 0; // distance moved this tick, for footstep audio
    this.suspicion = 0; // 0..100, owned by detection.js but kept here
    this.state = 'calm'; // calm | suspicious | alert | searching
    this.loseSight = 0; // seconds since the player was last seen
    this.lastSeen = null; // {x, y} of the player when last spotted
  }

  reset(def) {
    const fresh = new Guard(def);
    Object.assign(this, fresh);
  }

  // Advance one tick. `blocked(x, y)` answers whether a point is inside a
  // wall or a solid cover piece, so guards never walk through furniture.
  update(dt, blocked) {
    this.moved = 0;
    if (this.mode === 'patrol') {
      if (this.wait > 0) {
        this.wait -= dt;
        // Scan: sweep the facing angle slowly while standing still.
        this.scanPhase += dt;
        this.angle += Math.sin(this.scanPhase * 1.4) * dt * 0.5;
        return;
      }
      const [tx, ty] = this.waypoints[this.wpIndex];
      if (this.stepToward(tx, ty, this.speed, dt, blocked)) {
        this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
        this.wait = this.pause;
        this.scanPhase = 0;
      }
      return;
    }
    if (this.mode === 'investigate' || this.mode === 'chase') {
      const t = this.target;
      if (!t) { this.mode = 'return'; return; }
      const speed = this.mode === 'chase' ? this.speed * 1.55 : this.speed * 1.15;
      if (this.stepToward(t.x, t.y, speed, dt, blocked)) {
        if (this.mode === 'investigate') {
          this.wait = 1.6; // look around the spot, then give up
          this.mode = 'patrol';
          this.state = 'searching';
        }
      }
      return;
    }
    if (this.mode === 'return') {
      // Walk back to the nearest waypoint, then resume the patrol.
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < this.waypoints.length; i++) {
        const dx = this.waypoints[i][0] - this.x;
        const dy = this.waypoints[i][1] - this.y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = i; }
      }
      const [tx, ty] = this.waypoints[best];
      if (this.stepToward(tx, ty, this.speed, dt, blocked)) {
        this.wpIndex = (best + 1) % this.waypoints.length;
        this.mode = 'patrol';
        this.state = 'calm';
      }
    }
  }

  // Move toward (tx, ty) by at most speed*dt, sliding along blocked axes.
  // Returns true when the target is reached.
  stepToward(tx, ty, speed, dt, blocked) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const step = Math.min(dist, speed * dt);
    const nx = this.x + (dx / dist) * step;
    const ny = this.y + (dy / dist) * step;
    let movedX = 0;
    let movedY = 0;
    if (!blocked(nx, this.y)) { movedX = nx - this.x; this.x = nx; }
    if (!blocked(this.x, ny)) { movedY = ny - this.y; this.y = ny; }
    this.moved = Math.hypot(movedX, movedY);
    this.angle = Math.atan2(dy, dx);
    return step >= dist;
  }

  // Send this guard to look at a point (pebble distraction, or a glimpse).
  investigateAt(x, y) {
    if (this.mode === 'chase') return;
    this.mode = 'investigate';
    this.target = { x, y };
    this.state = 'suspicious';
  }

  // Full alert: run the player down.
  chaseAt(x, y) {
    this.mode = 'chase';
    this.target = { x, y };
    this.state = 'alert';
  }

  // The player broke line of sight: stop chasing, head home.
  giveUp() {
    if (this.mode === 'chase') {
      this.mode = 'return';
      this.target = null;
      this.state = 'searching';
    }
  }
}
