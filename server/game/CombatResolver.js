// ============================================================
//  COMBAT RESOLVER — Processes hit validation, tracks health
//  Ensures no spoofed distance hacks or illegal fire intervals
// ============================================================

class CombatResolver {
  constructor() {
    this.weaponStats = {
      fist:    { range: 3.5, damage: 10, rate: 0.3 },
      sword:   { range: 4.5, damage: 25, rate: 0.6 },
      pistol:  { range: 45,  damage: 15, rate: 0.25 },
      rifle:   { range: 80,  damage: 12, rate: 0.1 },
      shotgun: { range: 12,  damage: 40, rate: 0.9 }
    };
    this.lastAttacks = new Map(); // tracks fire history
  }

  resolve(attackerId, action, players, bots) {
    const attacker = players.get(attackerId);
    if (!attacker) return null;

    const weapon = this.weaponStats[attacker.weapon || 'fist'];
    const now = Date.now();

    // ── Prevent spam fire limits (Anti-cheat) ──
    const lastAttack = this.lastAttacks.get(attackerId) || 0;
    if (now - lastAttack < (weapon.rate * 1000 * 0.85)) { // 15% tolerance
      return null;
    }
    this.lastAttacks.set(attackerId, now);

    // Find Target
    let target = players.get(action.targetId) || bots.get(action.targetId);
    if (!target) return null;

    // ── Check bounds/distances (Anti-distance-cheat) ──
    const dist = this.getDistance(attacker.position, target.position);
    if (dist > weapon.range + 2.5) { // 2.5 unit allowance lag buffer
      return {
        type: 'miss_cheat',
        reason: 'illegal distance hit detected'
      };
    }

    // Apply Hit
    target.health = Math.max(0, target.health - weapon.damage);
    const isEliminated = target.health <= 0;

    if (isEliminated) {
      target.health = 100; // Reset
      target.position = { x: 0, y: 1, z: 0 }; // Respawn
      attacker.kills = (attacker.kills || 0) + 1;
    }

    return {
      type: 'hit',
      damage: weapon.damage,
      attackerId: attackerId,
      targetId: action.targetId,
      targetHealth: target.health,
      eliminated: isEliminated
    };
  }

  getDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}

module.exports = CombatResolver;
