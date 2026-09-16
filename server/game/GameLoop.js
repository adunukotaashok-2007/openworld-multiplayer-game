// ============================================================
//  FIXED-TIMESTEP GAME LOOP — Server-side authoritative loop
// ============================================================

class GameLoop {
  constructor(tickRate = 20) {
    this.tickRate = tickRate;
    this.tickInterval = 1000 / tickRate;
    this.lastTime = 0;
    this.accumulator = 0;
    this.running = false;
    this.tickCallback = null;
    this.tickCount = 0;
    this._rafId = null;
  }

  start(callback) {
    if (this.running) return;
    this.running = true;
    this.tickCallback = callback;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  stop() {
    this.running = false;
    if (this._rafId) clearTimeout(this._rafId);
  }

  _loop(currentTime) {
    if (!this.running) return;

    const frameTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += Math.min(frameTime, 250); // Cap to prevent spiral

    while (this.accumulator >= this.tickInterval) {
      const dt = this.tickInterval / 1000; // Convert to seconds
      if (this.tickCallback) {
        this.tickCallback(dt);
      }
      this.accumulator -= this.tickInterval;
      this.tickCount++;
    }

    this._rafId = setTimeout(() => this._loop(performance.now()), 1);
  }

  getTickCount() {
    return this.tickCount;
  }
}

module.exports = GameLoop;
