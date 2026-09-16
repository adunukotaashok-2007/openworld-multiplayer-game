// ============================================================
//  ASSET LOADER — GLTF, Textures, and Audio asset cache
//  Provides procedural fallback generation if models are loading
// ============================================================

import * as THREE from 'three';

export class AssetLoader {
  private loadingManager: THREE.LoadingManager;
  private textureLoader: THREE.TextureLoader;
  private textureCache: Map<string, THREE.Texture> = new Map();
  private modelCache: Map<string, any> = new Map();

  constructor() {
    this.loadingManager = new THREE.LoadingManager();
    this.textureLoader = new THREE.TextureLoader(this.loadingManager);
  }

  async loadEssentialAssets(): Promise<void> {
    // Generates procedural fallback textures directly into memory
    this.generateNoiseTexture('dirt_diffuse', '#57412a');
    this.generateNoiseTexture('grass_diffuse', '#3b6b2c');
    this.generateNoiseTexture('road_asphalt', '#2a2a2a');
  }

  private generateNoiseTexture(name: string, hexColor: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = hexColor;
    ctx.fillRect(0, 0, 256, 256);

    // Noise speckles
    const imgData = ctx.getImageData(0, 0, 256, 256);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 20;
      d[i] = Math.min(255, Math.max(0, d[i] + n));
      d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
      d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    this.textureCache.set(name, texture);
  }

  getTexture(name: string): THREE.Texture | undefined {
    return this.textureCache.get(name);
  }
}
