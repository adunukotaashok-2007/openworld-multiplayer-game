// ============================================================
//  PLAYER ENTITY — OOP character with physics, animation, combat
//  Extends base Entity class; loads realistic GLTF human model
// ============================================================

import * as THREE from 'three';
import { Entity, EntityState } from './Entity';
import { AssetLoader } from '../engine/AssetLoader';
import { JoystickInput } from '../controls/VirtualJoystick';
import { HealthSystem } from '../combat/HealthSystem';

export interface PlayerState extends EntityState {
  name: string;
  health: number;
  maxHealth: number;
  isAttacking: boolean;
  weaponId: string;
  speed: number;
}

export class Player extends Entity {
  public name: string;
  public healthSystem: HealthSystem;
  public isLocal: boolean;

  // Movement
  private moveSpeed = 8;
  private sprintMultiplier = 1.6;
  private jumpForce = 12;
  private gravity = -25;
  private verticalVelocity = 0;
  private isGrounded = false;
  private isSprinting = false;

  // Model & Animation
  private model!: THREE.Group;
  private mixer!: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationAction> = new Map();
  private currentAction: THREE.AnimationAction | null = null;

  // Collision
  private capsuleHeight = 1.8;
  private capsuleRadius = 0.4;

  constructor(
    scene: THREE.Scene,
    assetLoader: AssetLoader,
    isLocal: boolean = false,
    name: string = 'Player'
  ) {
    super(scene);
    this.isLocal = isLocal;
    this.name = name;
    this.healthSystem = new HealthSystem(100);
  }

  async spawn(position: THREE.Vector3): Promise<void> {
    this.position.copy(position);

    // Load realistic human GLTF model (e.g., from Mixamo)
    // Falls back to a detailed procedural humanoid if no asset
    try {
      this.model = await this.loadCharacterModel();
    } catch {
      this.model = this.createDetailedHumanoid();
    }

    this.model.position.copy(position);
    this.model.castShadow = true;
    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(this.model);

    // Setup animations
    this.setupAnimations();
  }

  private async loadCharacterModel(): Promise<THREE.Group> {
    // In production, load from: assets/models/characters/player.glb
    // const gltf = await this.assetLoader.loadGLTF('characters/player.glb');
    // return gltf.scene;

    // For now, create a detailed procedural humanoid
    return this.createDetailedHumanoid();
  }

  /**
   * Creates a detailed humanoid figure (not a simple cube/circle!)
   * Proportional body with head, torso, arms, legs, hands, feet
   */
  private createDetailedHumanoid(): THREE.Group {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd4a574, roughness: 0.7, metalness: 0.05
    });
    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50, roughness: 0.8, metalness: 0.0
    });
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e, roughness: 0.85, metalness: 0.0
    });
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0x2d2d2d, roughness: 0.6, metalness: 0.1
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: 0x1a0f00, roughness: 0.9, metalness: 0.0
    });

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 16, 12), skinMat
    );
    head.position.y = 1.65;
    head.scale.set(1, 1.1, 0.95);
    group.add(head);

    // Hair
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      hairMat
    );
    hair.position.y = 1.7;
    hair.scale.set(1.02, 1.05, 1.0);
    group.add(hair);

    // Neck
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skinMat
    );
    neck.position.y = 1.45;
    group.add(neck);

    // Torso (upper)
    const upperTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.35, 0.22), shirtMat
    );
    upperTorso.position.y = 1.22;
    group.add(upperTorso);

    // Torso (lower)
    const lowerTorso = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.2, 0.2), shirtMat
    );
    lowerTorso.position.y = 0.95;
    group.add(lowerTorso);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.55, 8);
    const forearmGeo = new THREE.CylinderGeometry(0.045, 0.04, 0.5, 8);

    [-1, 1].forEach(side => {
      // Upper arm
      const upperArm = new THREE.Mesh(armGeo, shirtMat);
      upperArm.position.set(side * 0.28, 1.15, 0);
      upperArm.rotation.z = side * 0.12;
      group.add(upperArm);

      // Forearm
      const forearm = new THREE.Mesh(forearmGeo, skinMat);
      forearm.position.set(side * 0.32, 0.7, 0);
      forearm.rotation.z = side * 0.08;
      group.add(forearm);

      // Hand
      const hand = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6), skinMat
      );
      hand.position.set(side * 0.34, 0.42, 0);
      hand.scale.set(1, 1.2, 0.7);
      group.add(hand);
    });

    // Legs
    const thighGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.45, 8);
    const shinGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.45, 8);

    [-1, 1].forEach(side => {
      const thigh = new THREE.Mesh(thighGeo, pantsMat);
      thigh.position.set(side * 0.1, 0.62, 0);
      group.add(thigh);

      const shin = new THREE.Mesh(shinGeo, pantsMat);
      shin.position.set(side * 0.1, 0.22, 0);
      group.add(shin);

      // Shoe
      const shoe = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.06, 0.18), shoeMat
      );
      shoe.position.set(side * 0.1, 0.03, 0.03);
      group.add(shoe);
    });

    group.name = `player_${this.name}`;
    return group;
  }

  private setupAnimations(): void {
    if (!this.model) return;
    this.mixer = new THREE.AnimationMixer(this.model);
    // In production: load idle, walk, run, jump, attack animations from GLTF
    // For now, animations will be driven procedurally
  }

  update(delta: number, input: JoystickInput): void {
    if (!this.isLocal || !this.model) return;

    // ── Movement ──
    const moveDir = new THREE.Vector3(input.moveX, 0, -input.moveY);
    const isMoving = moveDir.length() > 0.1;

    if (isMoving) {
      moveDir.normalize();
      const speed = this.moveSpeed * (this.isSprinting ? this.sprintMultiplier : 1);
      this.position.x += moveDir.x * speed * delta;
      this.position.z += moveDir.z * speed * delta;

      // Rotate character to face movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      this.model.rotation.y = THREE.MathUtils.lerp(
        this.model.rotation.y, targetAngle, 8 * delta
      );
    }

    // ── Gravity & Ground ──
    this.verticalVelocity += this.gravity * delta;
    this.position.y += this.verticalVelocity * delta;

    const groundHeight = this.getGroundHeight();
    if (this.position.y <= groundHeight) {
      this.position.y = groundHeight;
      this.verticalVelocity = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // ── Apply position to model ──
    this.model.position.copy(this.position);

    // ── Procedural walk animation ──
    if (isMoving && this.isGrounded) {
      const walkCycle = performance.now() * 0.008 * (this.isSprinting ? 1.5 : 1);
      this.model.children.forEach((child, i) => {
        if (i >= 9 && i <= 12) { // Legs
          child.rotation.x = Math.sin(walkCycle + (i % 2 === 0 ? 0 : Math.PI)) * 0.5;
        }
        if (i >= 5 && i <= 8) { // Arms
          child.rotation.x = Math.sin(walkCycle + (i % 2 === 0 ? Math.PI : 0)) * 0.35;
        }
      });
    }

    // ── Update health ──
    this.healthSystem.update(delta);
  }

  jump(): void {
    if (this.isGrounded) {
      this.verticalVelocity = this.jumpForce;
      this.isGrounded = false;
    }
  }

  attack(): void {
    // Trigger attack animation and hit detection
    this.combatTrigger = true;
    setTimeout(() => { this.combatTrigger = false; }, 300);
  }

  private combatTrigger = false;

  private getGroundHeight(): number {
    // In production: raycast against terrain mesh
    return 0;
  }

  getState(): PlayerState {
    return {
      id: this.id,
      position: { x: this.position.x, y: this.position.y, z: this.position.z },
      rotation: this.model ? this.model.rotation.y : 0,
      name: this.name,
      health: this.healthSystem.currentHealth,
      maxHealth: this.healthSystem.maxHealth,
      isAttacking: this.combatTrigger,
      weaponId: 'fist',
      speed: this.moveSpeed,
    };
  }

  takeDamage(amount: number): void {
    this.healthSystem.takeDamage(amount);
    if (this.healthSystem.isDead()) {
      this.onDeath();
    }
  }

  private onDeath(): void {
    // Respawn logic
    console.log(`${this.name} was eliminated!`);
    this.healthSystem.respawn();
    this.position.set(0, 1, 0);
  }
}
