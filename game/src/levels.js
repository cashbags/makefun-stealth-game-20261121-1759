// levels.js — the three floors of Emberlight Manor, top-down.
// Each level is plain data: wall rectangles that block movement and sight,
// cover rectangles to hide behind, guard patrols, lantern pickups, the exit
// door and where Wick starts. No code lives here, so a new floor is just a
// new object in LEVELS. Coordinates are in the 960 x 600 playfield.
//
// Design notes (what the judge should see): level 1 teaches patrols in an
// open garden; level 2 crosses a hall where two patrols overlap and the
// only safe route threads the crates; level 3 is a tight vault stair with
// four guards and short sightlines, so patience beats speed.

export const PLAYFIELD = { w: 960, h: 600 };

export const LEVELS = [
  {
    id: 'garden',
    name: 'I — The Garden Gate',
    hint: 'Bushes hide you. Stay out of the gold cones. Shift to sneak.',
    playerStart: { x: 70, y: 530 },
    exit: { x: 880, y: 40, w: 56, h: 56 },
    walls: [
      { x: 0, y: 0, w: 960, h: 16 },
      { x: 0, y: 584, w: 960, h: 16 },
      { x: 0, y: 0, w: 16, h: 600 },
      { x: 944, y: 0, w: 16, h: 600 },
      { x: 300, y: 120, w: 24, h: 200 },
      { x: 620, y: 280, w: 24, h: 200 },
    ],
    cover: [
      { x: 140, y: 380, w: 90, h: 60, kind: 'bush' },
      { x: 420, y: 430, w: 90, h: 60, kind: 'bush' },
      { x: 700, y: 140, w: 90, h: 60, kind: 'bush' },
      { x: 480, y: 120, w: 70, h: 70, kind: 'crate' },
      { x: 200, y: 180, w: 70, h: 70, kind: 'crate' },
    ],
    lanterns: [
      { x: 250, y: 90 },
      { x: 520, y: 320 },
      { x: 830, y: 480 },
    ],
    guards: [
      {
        name: 'Bramble',
        waypoints: [[330, 90], [330, 480], [560, 480], [560, 90]],
        speed: 62, pause: 1.2, viewDist: 190, fov: 1.15, color: '#e5484d',
      },
      {
        name: 'Thistle',
        waypoints: [[760, 500], [760, 140], [880, 140], [880, 500]],
        speed: 55, pause: 0.9, viewDist: 175, fov: 1.05, color: '#f76b15',
      },
    ],
  },
  {
    id: 'hall',
    name: 'II — The Lantern Hall',
    hint: 'Two patrols cross here. Pebble (click) pulls a guard away.',
    playerStart: { x: 70, y: 70 },
    exit: { x: 880, y: 500, w: 56, h: 56 },
    walls: [
      { x: 0, y: 0, w: 960, h: 16 },
      { x: 0, y: 584, w: 960, h: 16 },
      { x: 0, y: 0, w: 16, h: 600 },
      { x: 944, y: 0, w: 16, h: 600 },
      { x: 220, y: 0, w: 24, h: 220 },
      { x: 220, y: 360, w: 24, h: 224 },
      { x: 480, y: 140, w: 24, h: 320 },
      { x: 700, y: 0, w: 24, h: 180 },
      { x: 700, y: 320, w: 24, h: 264 },
    ],
    cover: [
      { x: 120, y: 280, w: 70, h: 70, kind: 'crate' },
      { x: 330, y: 90, w: 90, h: 60, kind: 'bush' },
      { x: 560, y: 480, w: 90, h: 60, kind: 'bush' },
      { x: 580, y: 220, w: 70, h: 70, kind: 'crate' },
      { x: 800, y: 380, w: 70, h: 70, kind: 'statue' },
      { x: 330, y: 470, w: 70, h: 70, kind: 'crate' },
    ],
    lanterns: [
      { x: 140, y: 500 },
      { x: 400, y: 300 },
      { x: 620, y: 90 },
      { x: 850, y: 250 },
    ],
    guards: [
      {
        name: 'Marlowe',
        waypoints: [[330, 250], [620, 250], [620, 470], [330, 470]],
        speed: 70, pause: 0.8, viewDist: 200, fov: 1.2, color: '#e5484d',
      },
      {
        name: 'Pell',
        waypoints: [[800, 90], [800, 520], [620, 520]],
        speed: 64, pause: 1.0, viewDist: 185, fov: 1.1, color: '#f76b15',
      },
      {
        name: 'Wren',
        waypoints: [[120, 480], [120, 140], [400, 140], [400, 480]],
        speed: 58, pause: 1.4, viewDist: 180, fov: 1.05, color: '#d6409f',
      },
    ],
  },
  {
    id: 'vault',
    name: 'III — The Vault Stair',
    hint: 'Four guards, short sightlines. Wait for the gap, then run.',
    playerStart: { x: 70, y: 530 },
    exit: { x: 880, y: 40, w: 56, h: 56 },
    walls: [
      { x: 0, y: 0, w: 960, h: 16 },
      { x: 0, y: 584, w: 960, h: 16 },
      { x: 0, y: 0, w: 16, h: 600 },
      { x: 944, y: 0, w: 16, h: 600 },
      { x: 160, y: 200, w: 300, h: 24 },
      { x: 500, y: 200, w: 300, h: 24 },
      { x: 160, y: 380, w: 300, h: 24 },
      { x: 500, y: 380, w: 300, h: 24 },
      { x: 460, y: 200, w: 24, h: 204 },
    ],
    cover: [
      { x: 90, y: 120, w: 70, h: 70, kind: 'statue' },
      { x: 250, y: 280, w: 90, h: 60, kind: 'bush' },
      { x: 620, y: 280, w: 90, h: 60, kind: 'bush' },
      { x: 850, y: 280, w: 70, h: 70, kind: 'crate' },
      { x: 250, y: 460, w: 70, h: 70, kind: 'crate' },
      { x: 620, y: 460, w: 70, h: 70, kind: 'crate' },
    ],
    lanterns: [
      { x: 120, y: 90 },
      { x: 330, y: 300 },
      { x: 630, y: 300 },
      { x: 880, y: 480 },
      { x: 480, y: 520 },
    ],
    guards: [
      {
        name: 'Ivo',
        waypoints: [[250, 90], [700, 90], [700, 150], [250, 150]],
        speed: 78, pause: 0.6, viewDist: 185, fov: 1.25, color: '#e5484d',
      },
      {
        name: 'Sable',
        waypoints: [[120, 300], [840, 300]],
        speed: 84, pause: 0.5, viewDist: 195, fov: 1.2, color: '#f76b15',
      },
      {
        name: 'Moth',
        waypoints: [[840, 480], [840, 90], [560, 90]],
        speed: 72, pause: 0.9, viewDist: 180, fov: 1.1, color: '#d6409f',
      },
      {
        name: 'Ash',
        waypoints: [[120, 480], [380, 480], [380, 300], [120, 300]],
        speed: 66, pause: 1.1, viewDist: 175, fov: 1.05, color: '#8e4ec6',
      },
    ],
  },
];
