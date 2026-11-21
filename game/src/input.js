// input.js — keyboard + mouse, nothing else.
// WASD / arrows move, Shift sneaks (slower, quieter, harder to spot),
// mouse click tosses a pebble to that spot (limited supply), P pauses,
// R restarts the level, M mutes. The click position is converted from the
// canvas's on-screen box into playfield coordinates, so the pebble lands
// where the player pointed even when the canvas is scaled.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.canvas = canvas;
    this.clicks = []; // queued {x, y} in playfield coordinates
    this.onFirstGesture = null;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      if (this.onFirstGesture) { this.onFirstGesture(); this.onFirstGesture = null; }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    canvas.addEventListener('mousedown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 960;
      const y = ((e.clientY - rect.top) / rect.height) * 600;
      this.clicks.push({ x, y });
      if (this.onFirstGesture) { this.onFirstGesture(); this.onFirstGesture = null; }
    });
    // Keep the game from scrolling the page when the player holds keys.
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(key) {
    return this.keys.has(key);
  }

  // Movement vector from the held keys, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('a') || this.down('ArrowLeft')) x -= 1;
    if (this.down('d') || this.down('ArrowRight')) x += 1;
    if (this.down('w') || this.down('ArrowUp')) y -= 1;
    if (this.down('s') || this.down('ArrowDown')) y += 1;
    if (x === 0 && y === 0) return { x: 0, y: 0 };
    const len = Math.hypot(x, y);
    return { x: x / len, y: y / len };
  }

  get sneaking() {
    return this.down('Shift');
  }

  // Consume one queued click, if any.
  takeClick() {
    return this.clicks.shift() || null;
  }

  pressedOnce(key) {
    if (!this.down(key)) return false;
    this.keys.delete(key);
    return true;
  }
}
