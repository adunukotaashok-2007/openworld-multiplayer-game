// ============================================================
//  SCENE MANAGER — Scene Graph Lifecycle, Fog, and Entity Registry
// ============================================================

import * as THREE from 'three';
import { Entity } from '../entities/Entity';

export class SceneManager {
  private scene: THREE.Scene;
  private entities: Map<string, Entity> = new Map();
  private staticObjects: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupEnvironment();
  }

  private setupEnvironment(): void {
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x94b8d7, 0.0035);
  }

  public registerEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
  }

  public unregisterEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity.destroy();
      this.entities.delete(id);
    }
  }

  public registerStaticObstacle(obj: THREE.Object3D): void {
    this.staticObjects.push(obj);
  }

  public getStaticObstacles(): THREE.Object3D[] {
    return this.staticObjects;
  }

  public update(delta: number): void {
    for (const [, entity] of this.entities) {
      if (entity.isActive) {
        entity.update(delta);
      }
    }
  }

  public clear(): void {
    for (const [, entity] of this.entities) {
      entity.destroy();
    }
    this.entities.clear();
    this.staticObjects = [];
  }
}
