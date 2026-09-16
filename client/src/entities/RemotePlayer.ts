// ============================================================
//  REMOTE PLAYER — Represents other players synced via network
//  Uses interpolation for smooth movement between server ticks
// ============================================================

import * as THREE from 'three';
import { Entity, EntityState } from './Entity';
import { PlayerState } from './Player';

interface PositionSnapshot {
  position: THREE.Vector3;
  rotation: number;
  timestamp: number;
}

export class RemotePlayer extends Entity {
  public name: string;
  public health: number = 100;
  public maxHealth: number = 100;
  public isAttacking: boolean = false;

  private model!: THREE.Group;
  private nameLabel!: THREE.Sprite;
  private healthBar!: THREE.Mesh;

  // Interpolation buffer
  private snapshots: PositionSnapshot[] = [];
  private interpolationDelay = 100; // ms
  private maxSnapshots = 10;

  constructor(scene: THREE.Scene, state: PlayerState) {
    super(scene);
    this.name = state.name;
    this.entityType = 'remote_player';
    this.createModel();
    this.createNameTag();
    this.applyState(state);
  }

  private createModel(): void {
    this.model = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xc4956a, roughness: 0.7
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0xcc3333, roughness: 0.8  // Red shirt to distinguish
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x222244, roughness: 0.85
    });

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), skinMat);
    head.position.y = 1.65;
    head.scale.set(1, 1.1, 0.95);
    this.model.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.22), shirtMat);
    torso.position.y = 1.15;
    this.model.add(torso);

    // Arms
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.04, 0.9, 6), skinMat
      );
      arm.position.set(side * 0.3, 1.0, 0);
      this.model.add(arm);
    });

    // Legs
    [-1, 1].forEach(side => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.055, 0.85, 6), pantsMat
      );
      leg.position.set(side * 0.1, 0.42, 0);
      this.model.add(leg);
    });

    this.model.traverse(child => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.mesh = this.model;
    this.scene.add(this.model);
  }

  private createNameTag(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.roundRect(0, 0, 256, 64, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({
      map: texture, transparent: true, depthTest: false
    });
    this.nameLabel = new THREE.Sprite(spriteMat);
    this.nameLabel.scale.set(2, 0.5, 1);
    this.nameLabel.position.y = 2.2;
    this.model.add(this.nameLabel);

    // Health bar above head
    const hbGeo = new THREE.PlaneGeometry(1.2, 0.1);
    const hbMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00, side: THREE.DoubleSide
    });
    this.healthBar = new THREE.Mesh(hbGeo, hbMat);
    this.healthBar.position.y = 2.0;
    this.model.add(this.healthBar);
  }

  applyState(state: PlayerState): void {
    this.snapshots.push({
      position: new THREE.Vector3(state.position.x, state.position.y, state.position.z),
      rotation: state.rotation,
      timestamp: performance.now()
    });

    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    this.health = state.health;
    this.maxHealth = state.maxHealth;
    this.isAttacking = state.isAttacking;

    // Update health bar color & scale
    const ratio = this.health / this.maxHealth;
    (this.healthBar.material as THREE.MeshBasicMaterial).color.setHex(
      ratio > 0.5 ? 0x00ff00 : ratio > 0.25 ? 0xffaa00 : 0xff0000
    );
    this.healthBar.scale.x = Math.max(ratio, 0.01);
  }

  update(delta: number): void {
    if (this.snapshots.length < 2) return;

    // Interpolate between snapshots for smooth movement
    const now = performance.now();
    const targetTime = now - this.interpolationDelay;

    let prev = this.snapshots[0];
    let next = this.snapshots[1];

    for (let i = 1; i < this.snapshots.length; i++) {
      if (this.snapshots[i].timestamp >= targetTime) {
        prev = this.snapshots[i - 1];
        next = this.snapshots[i];
        break;
      }
    }

    const timeDiff = next.timestamp - prev.timestamp;
    const t = timeDiff > 0 ? Math.min((targetTime - prev.timestamp) / timeDiff, 1) : 1;

    this.position.lerpVectors(prev.position, next.position, t);
    this.rotation = THREE.MathUtils.lerp(prev.rotation, next.rotation, t);

    this.model.position.copy(this.position);
    this.model.rotation.y = this.rotation;

    // Billboard name tag
    this.nameLabel.lookAt(
      this.model.position.x,
      this.model.position.y + 2.2,
      this.model.position.z + 10
    );
  }

  getState(): EntityState {
    return {
      id: this.id,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: this.rotation,
    };
  }

  destroy(): void {
    super.destroy();
  }
}
