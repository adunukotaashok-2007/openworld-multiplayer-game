// ============================================================
//  COMBAT SYSTEM — Weapons, attacks, hit detection, abilities
//  Server-authoritative: client predicts, server validates
// ============================================================

import * as THREE from 'three';
import { Player } from '../entities/Player';

export interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  range: number;
  fireRate: number;    // Attacks per second
  isMelee: boolean;
  projectileSpeed?: number;
  icon: string;
}

const WEAPONS: Record<string, WeaponDef> = {
  fist: {
    id: 'fist', name: 'Fists', damage: 10, range: 2.5,
    fireRate: 2.0, isMelee: true, icon: '👊'
  },
  sword: {
    id: 'sword', name: 'Steel Sword', damage: 25, range: 3.5,
    fireRate: 1.2, isMelee: true, icon: '⚔️'
  },
  pistol: {
    id: 'pistol', name: 'Pistol', damage: 15, range: 50,
    fireRate: 3.0, isMelee: false, projectileSpeed: 80, icon: '🔫'
  },
  rifle: {
    id: 'rifle', name: 'Assault Rifle', damage: 12, range: 80,
    fireRate: 8.0, isMelee: false, projectileSpeed: 120, icon: '🎯'
  },
  shotgun: {
    id: 'shotgun', name: 'Shotgun', damage: 40, range: 15,
    fireRate: 0.8, isMelee: false, projectileSpeed: 60, icon: '💥'
  },
  rocket: {
    id: 'rocket', name: 'Rocket Launcher', damage: 80, range: 100,
    fireRate: 0.4, isMelee: false, projectileSpeed: 35, icon: '🚀'
  }
};

export class CombatSystem {
  private player: Player;
  private scene: THREE.Scene;
  private currentWeapon: WeaponDef;
  private lastAttackTime: number = 0;
  private isAttacking: boolean = false;
  private attackCooldown: number = 0;

  // Raycaster for hit detection
  private raycaster: THREE.Raycaster;
  private hitMarkers: THREE.Mesh[] = [];

  // Abilities
  private abilities: Ability[] = [];
  private activeAbility: Ability | null = null;

  constructor(player: Player, scene: THREE.Scene) {
    this.player = player;
    this.scene = scene;
    this.currentWeapon = WEAPONS.fist;
    this.raycaster = new THREE.Raycaster();
    this.setupDefaultAbilities();
  }

  private setupDefaultAbilities(): void {
    this.abilities = [
      {
        id: 'sprint_burst', name: 'Sprint Burst',
        cooldown: 8, currentCooldown: 0, duration: 3,
        description: '2x speed for 3 seconds'
      },
      {
        id: 'shield', name: 'Energy Shield',
        cooldown: 15, currentCooldown: 0, duration: 4,
        description: 'Block 50% damage for 4 seconds'
      },
      {
        id: 'heal', name: 'Quick Heal',
        cooldown: 20, currentCooldown: 0, duration: 0,
        description: 'Restore 30 HP instantly'
      }
    ];
  }

  equipWeapon(weaponId: string): boolean {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return false;
    this.currentWeapon = weapon;
    this.attackCooldown = 0;
    console.log(`🗡️ Equipped: ${weapon.name}`);
    return true;
  }

  attack(): boolean {
    const now = performance.now() / 1000;
    const cooldown = 1 / this.currentWeapon.fireRate;

    if (now - this.lastAttackTime < cooldown) return false;

    this.lastAttackTime = now;
    this.isAttacking = true;
    this.attackCooldown = 0.3;

    if (this.currentWeapon.isMelee) {
      this.performMeleeAttack();
    } else {
      this.performRangedAttack();
    }

    return true;
  }

  private performMeleeAttack(): void {
    // Sphere cast in front of player
    const attackPos = this.player.position.clone();
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.getState().rotation);
    attackPos.add(forward.multiplyScalar(this.currentWeapon.range * 0.5));

    // Check hits (client-side prediction)
    const hits = this.sphereCast(attackPos, this.currentWeapon.range * 0.5);
    if (hits.length > 0) {
      this.showHitEffect(attackPos);
      console.log(`⚔️ Melee hit! Damage: ${this.currentWeapon.damage}`);
    }
  }

  private performRangedAttack(): void {
    const origin = this.player.position.clone();
    origin.y += 1.4; // Eye height

    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.player.getState().rotation
    );

    this.raycaster.set(origin, direction);
    this.raycaster.far = this.currentWeapon.range;

    // Create projectile visual
    this.createProjectileVisual(origin, direction);
    console.log(`🔫 Fired ${this.currentWeapon.name}! Damage: ${this.currentWeapon.damage}`);
  }

  private sphereCast(center: THREE.Vector3, radius: number): THREE.Intersection[] {
    // Simplified: use raycaster in multiple directions
    const hits: THREE.Intersection[] = [];
    const directions = [
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    ];
    directions.forEach(dir => {
      this.raycaster.set(center, dir);
      this.raycaster.far = radius;
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);
      hits.push(...intersects);
    });
    return hits;
  }

  private createProjectileVisual(origin: THREE.Vector3, direction: THREE.Vector3): void {
    const geo = new THREE.SphereGeometry(0.08, 6, 4);
    const mat = new THREE.MeshBasicMaterial({
      color: this.currentWeapon.id === 'rocket' ? 0xff4400 : 0xffff00
    });
    const bullet = new THREE.Mesh(geo, mat);
    bullet.position.copy(origin);
    this.scene.add(bullet);

    // Animate projectile
    const speed = this.currentWeapon.projectileSpeed || 80;
    const maxDist = this.currentWeapon.range;
    let traveled = 0;

    const animate = () => {
      if (traveled >= maxDist) {
        this.scene.remove(bullet);
        geo.dispose();
        mat.dispose();
        return;
      }
      const step = speed * 0.016;
      bullet.position.add(direction.clone().multiplyScalar(step));
      traveled += step;
      requestAnimationFrame(animate);
    };
    animate();
  }

  private showHitEffect(position: THREE.Vector3): void {
    const geo = new THREE.RingGeometry(0.2, 0.5, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000, side: THREE.DoubleSide, transparent: true, opacity: 1
    });
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(position);
    ring.position.y += 1;
    ring.lookAt(this.player.position);
    this.scene.add(ring);
    this.hitMarkers.push(ring);

    // Fade out
    let opacity = 1;
    const fade = () => {
      opacity -= 0.05;
      mat.opacity = opacity;
      ring.scale.multiplyScalar(1.05);
      if (opacity <= 0) {
        this.scene.remove(ring);
        geo.dispose();
        mat.dispose();
      } else {
        requestAnimationFrame(fade);
      }
    };
    fade();
  }

  useAbility(abilityIndex: number): boolean {
    const ability = this.abilities[abilityIndex];
    if (!ability || ability.currentCooldown > 0) return false;

    ability.currentCooldown = ability.cooldown;

    switch (ability.id) {
      case 'heal':
        this.player.healthSystem.heal(30);
        console.log('💚 Healed 30 HP!');
        break;
      case 'sprint_burst':
        console.log('⚡ Sprint Burst activated!');
        break;
      case 'shield':
        console.log('🛡️ Shield activated!');
        break;
    }
    return true;
  }

  update(delta: number): void {
    // Attack animation cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
      if (this.attackCooldown <= 0) {
        this.isAttacking = false;
      }
    }

    // Ability cooldowns
    this.abilities.forEach(a => {
      if (a.currentCooldown > 0) {
        a.currentCooldown = Math.max(0, a.currentCooldown - delta);
      }
    });

    // Clean up old hit markers
    this.hitMarkers = this.hitMarkers.filter(m => m.parent !== null);
  }

  getCurrentWeapon(): WeaponDef {
    return this.currentWeapon;
  }

  getAbilities(): Ability[] {
    return this.abilities;
  }
}

interface Ability {
  id: string;
  name: string;
  cooldown: number;
  currentCooldown: number;
  duration: number;
  description: string;
}
