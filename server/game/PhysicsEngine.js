// ============================================================
//  PHYSICS ENGINE — Server-side authoritative validation
//  Handles simple collision checking (Sphere / AABB / Terrain)
// ============================================================

class PhysicsEngine {
  constructor() {
    this.gravity = -25.0;
    this.worldBounds = 250; // Size/boundaries of map
    this.obstacleMap = [];
    this.buildObstacleGrid();
  }

  buildObstacleGrid() {
    // Generate simple geometric representation of buildings for validation
    this.obstacles = [
      { minX: -35, maxX: -25, minZ: -35, maxZ: -25 }, // Building 1
      { minX: -34, maxX: -26, minZ: -16, maxZ: -4  }, // Building 2
      { minX: -36, maxX: -24, minZ: 5,   maxZ: 15  }, // Building 3
      { minX: -15, maxX: -5,  minZ: -35, maxZ: -25 }, // Building 4
      { minX: 3,   maxX: 17,  minZ: -37, maxZ: -23 }, // Building 5
      { minX: 6,   maxX: 14,  minZ: 6,   maxZ: 14  }, // Building 6
      { minX: 25,  maxX: 35,  minZ: -15, maxZ: -5  }, // Building 7
      { minX: 24,  maxX: 36,  minZ: 4,   maxZ: 16  }, // Building 8
    ];
  }

  update(deltaTime, players, bots) {
    // Update real players
    for (const [id, player] of players) {
      this.applySimpleGravity(player, deltaTime);
      this.resolveWorldCollisions(player);
    }

    // Update offline/controlled AI bots
    for (const [id, bot] of bots) {
      this.applySimpleGravity(bot, deltaTime);
      this.resolveWorldCollisions(bot);
    }
  }

  applySimpleGravity(entity, dt) {
    if (entity.position.y > 0) {
      entity.position.y += this.gravity * dt;
    }
    if (entity.position.y < 0) {
      entity.position.y = 0; // Snap back on ground
    }
  }

  resolveWorldCollisions(entity) {
    // ── Map Bound checking ──
    entity.position.x = Math.max(-this.worldBounds, Math.min(this.worldBounds, entity.position.x));
    entity.position.z = Math.max(-this.worldBounds, Math.min(this.worldBounds, entity.position.z));

    // ── Obstacle/Building collision ──
    const radius = 0.5; // Player collision radius thickness
    for (const obs of this.obstacles) {
      if (this.isOverlapping(entity.position, radius, obs)) {
        this.pushOutFromObstacle(entity.position, radius, obs);
      }
    }
  }

  isOverlapping(pos, r, box) {
    return (pos.x + r > box.minX && pos.x - r < box.maxX &&
            pos.z + r > box.minZ && pos.z - r < box.maxZ);
  }

  pushOutFromObstacle(pos, r, box) {
    // Calculate overlap depths
    const leftOverlap  = (pos.x + r) - box.minX;
    const rightOverlap = box.maxX - (pos.x - r);
    const frontOverlap = (pos.z + r) - box.minZ;
    const backOverlap  = box.maxZ - (pos.z - r);

    const minOverlap = Math.min(leftOverlap, rightOverlap, frontOverlap, backOverlap);

    if (minOverlap === leftOverlap)  pos.x -= leftOverlap;
    else if (minOverlap === rightOverlap) pos.x += rightOverlap;
    else if (minOverlap === frontOverlap) pos.z -= frontOverlap;
    else if (minOverlap === backOverlap)  pos.z += backOverlap;
  }
}

module.exports = PhysicsEngine;
