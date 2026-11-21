// shots.js — deterministic screenshot scenes.
// A ?shot= URL composes one frozen moment of the game so a capture is the
// same every time: guards are parked at fixed patrol points, suspicion is
// set by hand, and the render loop never advances. The cover shot is the
// richest scene (level II, two cones, crates, the exit, a half-full meter);
// the others show a clean patrol, a full alert, and the win screen.

function placeGuard(game, index, x, y, angle) {
  const g = game.guards[index];
  if (!g) return;
  g.x = x;
  g.y = y;
  g.angle = angle;
  g.wait = 0;
}

export function applyShot(game, shot, seed) {
  if (shot === 'cover') {
    // Level II, mid-sneak: Wick crouched behind the hall crates while
    // Marlowe's cone sweeps past and Pell closes in. Meter half full.
    game.loadLevel(1);
    game.player.x = 560;
    game.player.y = 440;
    game.player.angle = -Math.PI / 2;
    game.player.sneaking = true;
    placeGuard(game, 0, 430, 290, 0.5);
    placeGuard(game, 1, 790, 380, Math.PI * 0.9);
    placeGuard(game, 2, 300, 200, Math.PI * 0.3);
    game.guards[0].suspicion = 55;
    game.guards[0].state = 'suspicious';
    game.guards[1].suspicion = 18;
    game.lanterns[0].taken = true;
    game.score = 150;
    game.topSuspicion = 55;
    game.screen = 'play';
  } else if (shot === 'patrol') {
    // Level I, clean patrol: both guards on their routes, Wick at the gate
    // behind the first bush, meter empty. The teaching moment.
    game.loadLevel(0);
    game.player.x = 180;
    game.player.y = 410;
    game.player.angle = 0;
    game.player.sneaking = true;
    placeGuard(game, 0, 420, 200, Math.PI / 2);
    placeGuard(game, 1, 790, 300, -Math.PI / 2);
    game.screen = 'play';
  } else if (shot === 'alert') {
    // Level II, full alert: Marlowe has Wick in the open and is closing in,
    // the meter is maxed and the red frame is up.
    game.loadLevel(1);
    game.player.x = 440;
    game.player.y = 300;
    game.player.angle = Math.PI;
    placeGuard(game, 0, 360, 300, 0);
    placeGuard(game, 1, 760, 200, Math.PI * 0.7);
    placeGuard(game, 2, 300, 460, -Math.PI * 0.4);
    game.guards[0].suspicion = 100;
    game.guards[0].state = 'alert';
    game.guards[0].mode = 'chase';
    game.guards[0].target = { x: game.player.x, y: game.player.y };
    game.guards[1].suspicion = 42;
    game.guards[1].state = 'suspicious';
    game.alert = true;
    game.topSuspicion = 100;
    game.renderer.flash = 0.6;
    game.screen = 'play';
  } else if (shot === 'win') {
    // Level III cleared: every lantern taken, the win tally on screen.
    game.loadLevel(2);
    game.score = 2450;
    game.lanterns.forEach((L) => { L.taken = true; });
    game.player.x = 880;
    game.player.y = 68;
    game.clearedLanterns = 5;
    game.timeBonus = 180;
    game.ghostBonus = 300;
    game.best = 2450;
    game.screen = 'win';
  } else {
    // Unknown shot name: fall back to the live title screen.
    game.screen = 'title';
  }
}
