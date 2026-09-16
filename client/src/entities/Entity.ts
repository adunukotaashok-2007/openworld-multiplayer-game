// ============================================================
//  BASE ENTITY — Abstract OOP class for all game objects
//  Players, NPCs, Vehicles, Projectiles all extend this
// ============================================================

import * as THREE from 'three';

export interface EntityState {
  id: string;
  position: { x: number; y: number; z: number };
  rotation: number;
}

let entityIdCounter = 0;

export abstract class Entity {
  public readonly id: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public rotation: number = 0;
  public isActive: boolean = true;
  public entityType: string = 'entity';

  protected scene: THREE.Scene;
  protected mesh: THREE.Object3D | null = null;

  constructor(scene: THREE.Scene) {
    this.id = `entity_${++entityIdCounter}_${Date.now()}`;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.scene = scene;
  }

  abstract update(delta: number, ...args: any[]): void;
  abstract getState(): EntityState;

  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    if (this.mesh) this.mesh.position.copy(this.position);
  }

  setRotation(y: number): void {
    this.rotation = y;
    if (this.mesh) this.mesh.rotation.y = y;
  }

  getDistanceTo(other: Entity): number {
    return this.position.distanceTo(other.position);
  }

  getDistanceToPosition(pos: THREE.Vector3): number {
    return this.position.distanceTo(pos);
  }

  destroy(): void {
    this.isActive = false;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach(m => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    }
  }
}
