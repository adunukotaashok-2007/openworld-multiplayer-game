// ============================================================
//  RENDER PIPELINE — Mobile rendering passes & performance logic
// ============================================================

import * as THREE from 'three';

export class RenderPipeline {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  render(): void {
    // Directly renders with tone-mapping and color space active on WebGL context
    this.renderer.render(this.scene, this.camera);
  }

  setQuality(lowPowerMode: boolean): void {
    if (lowPowerMode) {
      this.renderer.setPixelRatio(1.0);
      this.renderer.shadowMap.enabled = false;
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.enabled = true;
    }
  }
}
