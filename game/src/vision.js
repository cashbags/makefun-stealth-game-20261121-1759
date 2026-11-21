// vision.js — what a guard can see, and what hides the player.
// A guard spots Wick when three things are true: Wick is inside the
// guard's vision cone (distance + angle), nothing solid stands between
// them, and Wick is not hidden in cover. Sight is checked with a sampled
// raycast against walls and crates, so a cone stops at a wall exactly the
// way the player expects it to. Bushes do not block sight — they hide the
// player inside them instead, unless the guard is close enough to see in.

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Does the segment (x0,y0)-(x1,y1) cross any rectangle in `solids`?
// Sampled finely enough that no wall thinner than 8 px can be skipped.
export function segmentBlocked(x0, y0, x1, y1, solids) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    for (const s of solids) {
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
    }
  }
  return false;
}

// Point-in-rectangle test, used for walls, cover and the exit.
export function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// Is the player hidden inside a bush right now? A guard closer than
// BUSH_REVEAL can still see in — crouching in the open is not a plan.
export const BUSH_REVEAL = 95;
export function hiddenInCover(player, level, guard) {
  for (const c of level.cover) {
    if (c.kind !== 'bush') continue;
    if (!pointInRect(player.x, player.y, c)) continue;
    const d = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (d > BUSH_REVEAL) return true;
  }
  return false;
}

// Full visibility test for one guard. `solids` is walls + crates + statues.
export function canSeeGuard(guard, player, level, solids) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > guard.viewDist) return { seen: false, dist };
  const toPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(toPlayer, guard.angle)) > guard.fov / 2) {
    return { seen: false, dist };
  }
  if (segmentBlocked(guard.x, guard.y, player.x, player.y, solids)) {
    return { seen: false, dist };
  }
  if (hiddenInCover(player, level, guard)) return { seen: false, dist };
  return { seen: true, dist };
}

// How far the guard's cone reaches in a direction before a wall stops it.
// Used by the renderer so cones hug the walls instead of painting over them.
export function coneRayLength(guard, angle, solids, maxLen) {
  let low = 0;
  let high = maxLen;
  for (let i = 0; i < 10; i++) {
    const mid = (low + high) / 2;
    const x = guard.x + Math.cos(angle) * mid;
    const y = guard.y + Math.sin(angle) * mid;
    let hit = false;
    for (const s of solids) {
      if (pointInRect(x, y, s)) { hit = true; break; }
    }
    if (hit) high = mid;
    else low = mid;
  }
  return low;
}
