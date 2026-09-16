// ============================================================
//  GAME ENGINE — Core OOP engine wrapping Three.js
//  Manages scene, camera, renderer, clock, and game systems
// ============================================================

import * as THREE from 'three';
import { SceneManager } from './SceneManager';
import { RenderPipeline } from './RenderPipeline';
import { AssetLoader } from './AssetLoader';
import { WorldBuilder } from '../world/WorldBuilder';
import { Player } from '../entities/Player';
import { VirtualJoystick } from '../controls/VirtualJoystick';
import { CameraController } from '../controls/CameraController';
import { NetworkManager } from '../network/NetworkManager';
import { CombatSystem } from '../combat/CombatSystem';
import { HUD } from '../ui/HUD';
import { ChatUI } from '../ui/ChatUI';
import { PerformanceMonitor } from '../utils/PerformanceMonitor';

export class GameEngine {
  // ── Core Three.js ──
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock: THREE.Clock;

  // ── Sub-systems (OOP composition) ──
  public sceneManager!: SceneManager;
  public renderPipeline!: RenderPipeline;
  public assetLoader!: AssetLoader;
  public worldBuilder!: WorldBuilder;
  public localPlayer!: Player;
  public joystick!: VirtualJoystick;
  public cameraController!: CameraController;
  public network!: NetworkManager;
  public combat!: CombatSystem;
  public hud!: HUD;
  public chat!: ChatUI;
  public perfMonitor!: PerformanceMonitor;

  // ── State ──
  private isRunning = false;
  private animationFrameId = 0;
  private isMobile: boolean;

  constructor() {
    this.clock = new THREE.Clock();
    this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // ── Initialize everything ──
  async init(canvas: HTMLCanvasElement): Promise<void> {
    this.updateLoadStatus('Creating renderer…', 10);

    // Renderer — optimized for mobile
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isMobile,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.isMobile
      ? THREE.BasicShadowMap
      : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.updateLoadStatus('Building scene…', 20);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x88aacc, 0.0025);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      65, window.innerWidth / window.innerHeight, 0.5, 1000
    );
    this.camera.position.set(0, 8, 15);

    // Sub-systems
    this.sceneManager = new SceneManager(this.scene);
    this.renderPipeline = new RenderPipeline(this.renderer, this.scene, this.camera);
    this.assetLoader = new AssetLoader();
    this.perfMonitor = new PerformanceMonitor();

    this.updateLoadStatus('Loading assets…', 30);
    await this.assetLoader.loadEssentialAssets();

    this.updateLoadStatus('Building world…', 50);
    this.worldBuilder = new WorldBuilder(this.scene, this.assetLoader);
    await this.worldBuilder.build();

    this.updateLoadStatus('Spawning player…', 70);
    this.localPlayer = new Player(this.scene, this.assetLoader, true);
    await this.localPlayer.spawn(new THREE.Vector3(0, 1, 0));

    this.updateLoadStatus('Setting up controls…', 80);
    this.joystick = new VirtualJoystick();
    this.cameraController = new CameraController(this.camera, this.localPlayer);
    this.combat = new CombatSystem(this.localPlayer, this.scene);

    this.updateLoadStatus('Connecting network…', 90);
    this.network = new NetworkManager();
    this.hud = new HUD();
    this.chat = new ChatUI(this.network);

    // Resize handler
    window.addEventListener('resize', () => this.onResize());

    this.updateLoadStatus('Ready!', 100);
  }

  // ── Start game loop ──
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.clock.start();
    this.loop();
  }

  // ── Main loop ──
  private loop = (): void => {
    if (!this.isRunning) return;
    this.animationFrameId = requestAnimationFrame(this.loop);

    const delta = Math.min(this.clock.getDelta(), 0.1); // Cap delta

    // Update systems
    const input = this.joystick.getInput();
    this.localPlayer.update(delta, input);
    this.cameraController.update(delta);
    this.combat.update(delta);
    this.network.sendPlayerState(this.localPlayer.getState());
    this.worldBuilder.update(delta);
    this.hud.update(this.localPlayer);
    this.perfMonitor.update();

    // Render
    this.renderPipeline.render();
  };

  stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private updateLoadStatus(text: string, percent: number): void {
    const statusEl = document.getElementById('load-status');
    const progressEl = document.getElementById('load-progress');
    if (statusEl) statusEl.textContent = text;
    if (progressEl) progressEl.style.width = `${percent}%`;
  }

  getScene(): THREE.Scene { return this.scene; }
  getCamera(): THREE.PerspectiveCamera { return this.camera; }
  getRenderer(): THREE.WebGLRenderer { return this.renderer; }
}
