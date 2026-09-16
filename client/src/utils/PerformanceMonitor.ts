// ============================================================
//  PERFORMANCE MONITOR — Adaptive quality scaling for mobile
// ============================================================

export class PerformanceMonitor {
  private frames = 0;
  private lastTime = performance.now();
  public fps = 60;
  public onLowPerformance: (() => void) | null = null;
  private lowFpsCount = 0;

  update(): void {
    this.frames++;
    const now = performance.now();

    if (now - this.lastTime >= 1000) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
      this.frames = 0;
      this.lastTime = now;

      // Throttle down if consistently below 30 FPS on weak mobile chipsets
      if (this.fps < 28) {
        this.lowFpsCount++;
        if (this.lowFpsCount >= 3) {
          this.onLowPerformance?.();
          this.lowFpsCount = 0;
        }
      } else {
        this.lowFpsCount = 0;
      }
    }
  }
}
