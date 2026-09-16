// ============================================================
//  SPATIAL HASH — Optimizes network sync lookup
//  Divides the infinite open world into discrete cell bucketing
// ============================================================

class SpatialHash {
  constructor(cellSize = 20) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  getKey(position) {
    const x = Math.floor(position.x / this.cellSize);
    const z = Math.floor(position.z / this.cellSize);
    return `${x},${z}`;
  }

  rebuild(entities) {
    this.grid.clear();
    for (const ent of entities) {
      this.update(ent.id, ent.position);
    }
  }

  update(entityId, position) {
    if (!position) return;
    const key = this.getKey(position);

    if (!this.grid.has(key)) {
      this.grid.set(key, new Set());
    }
    this.grid.get(key).add(entityId);
  }

  getNearby(position, range = 1) {
    const centerKey = this.getKey(position);
    const [cx, cz] = centerKey.split(',').map(Number);
    const nearby = new Set();

    for (let dx = -range; dx <= range; dx++) {
      for (let dz = -range; dz <= range; dz++) {
        const key = `${cx + dx},${cz + dz}`;
        if (this.grid.has(key)) {
          this.grid.get(key).forEach(id => nearby.add(id));
        }
      }
    }
    return Array.from(nearby);
  }
}

module.exports = SpatialHash;
