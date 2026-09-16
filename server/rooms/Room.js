// ============================================================
//  ROOM — Single game room with players, game state, physics
//  Server-authoritative world simulation
// ============================================================

const PlayerState = require('../players/PlayerState');
const PhysicsEngine = require('../game/PhysicsEngine');
const CombatResolver = require('../game/CombatResolver');
const SpatialHash = require('../utils/SpatialHash');
const Logger = require('../utils/Logger');

class Room {
  constructor(id, settings) {
    this.id = id;
    this.settings = settings;
    this.players = new Map();      // socketId → PlayerState
    this.bots = new Map();         // botId → BotState
    this.physics = new PhysicsEngine();
    this.combat = new CombatResolver();
    this.spatialHash = new SpatialHash(20); // 20-unit cells
    this.createdAt = Date.now();
    this.lastUpdate = Date.now();
    this.tickCount = 0;
    this.state = 'waiting';        // waiting | playing | ended
  }

  addPlayer(playerData) {
    if (this.isFull()) return false;

    const player = new PlayerState({
      id: playerData.socketId,
      name: playerData.playerName || 'Anonymous',
      position: this.getSpawnPoint(),
      health: 100,
      maxHealth: 100,
      weapon: 'fist',
      score: 0,
      kills: 0,
      deaths: 0
    });

    this.players.set(playerData.socketId, player);
    Logger.info(`[${this.id}] Player joined: ${player.name} (${this.players.size}/${this.settings.maxPlayers})`);

    if (this.players.size >= 2 && this.state === 'waiting') {
      this.startGame();
    }

    return true;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      Logger.info(`[${this.id}] Player left: ${player.name}`);
      this.players.delete(socketId);
    }
  }

  hasPlayer(socketId) {
    return this.players.has(socketId);
  }

  isFull() {
    return this.players.size >= this.settings.maxPlayers;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  isActive() {
    return this.state === 'playing' || this.state === 'waiting';
  }

  getPlayerCount() {
    return this.players.size + this.bots.size;
  }

  getSpawnPoint() {
    const spawns = [
      { x: 0, y: 1, z: 0 },
      { x: 20, y: 1, z: 20 },
      { x: -20, y: 1, z: -20 },
      { x: 20, y: 1, z: -20 },
      { x: -20, y: 1, z: 20 },
      { x: 40, y: 1, z: 0 },
      { x: -40, y: 1, z: 0 },
      { x: 0, y: 1, z: 40 },
    ];
    return spawns[Math.floor(Math.random() * spawns.length)];
  }

  startGame() {
    this.state = 'playing';
    Logger.info(`[${this.id}] Game started! Mode: ${this.settings.gameMode}`);

    // Spawn bots if enabled
    if (this.settings.enableBots) {
      this.spawnBots(this.settings.botCount);
    }
  }

  spawnBots(count) {
    const botNames = ['Bot_Alpha', 'Bot_Bravo', 'Bot_Charlie', 'Bot_Delta',
                      'Bot_Echo', 'Bot_Foxtrot', 'Bot_Golf', 'Bot_Hotel'];
    for (let i = 0; i < count; i++) {
      const botId = `bot_${this.id}_${i}`;
      const bot = new PlayerState({
        id: botId,
        name: botNames[i % botNames.length],
        position: this.getSpawnPoint(),
        health: 100,
        maxHealth: 100,
        weapon: 'pistol',
        isBot: true
      });
      this.bots.set(botId, bot);
    }
    Logger.info(`[${this.id}] Spawned ${count} bots`);
  }

  updatePlayerInput(socketId, inputData) {
    const player = this.players.get(socketId);
    if (!player) return;

    // Validate & apply movement (anti-cheat: clamp speed)
    const maxSpeed = 12;
    const dx = inputData.position.x - player.position.x;
    const dy = inputData.position.y - player.position.y;
    const dz = inputData.position.z - player.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist < maxSpeed * 0.1) { // Reasonable per-tick movement
      player.position.x = inputData.position.x;
      player.position.y = inputData.position.y;
      player.position.z = inputData.position.z;
      player.rotation = inputData.rotation;
    }

    // Update spatial hash
    this.spatialHash.update(player.id, player.position);
  }

  resolveCombat(attackerId, eventData) {
    const result = this.combat.resolve(attackerId, eventData, this.players, this.bots);
    return result;
  }

  update(deltaTime) {
    if (this.state !== 'playing') return;
    this.tickCount++;
    this.lastUpdate = Date.now();

    // Update physics for all entities
    this.physics.update(deltaTime, this.players, this.bots);

    // Update bot AI (simplified server-side)
    this.updateBots(deltaTime);

    // Rebuild spatial hash every 5 ticks
    if (this.tickCount % 5 === 0) {
      this.spatialHash.rebuild([...this.players.values(), ...this.bots.values()]);
    }
  }

  updateBots(deltaTime) {
    for (const [, bot] of this.bots) {
      // Simple patrol AI on server (full AI via Python service)
      const time = Date.now() * 0.001;
      const patrolRadius = 20;
      const offset = parseInt(bot.id.split('_').pop()) * 1.5;

      bot.position.x = Math.sin(time * 0.3 + offset) * patrolRadius;
      bot.position.z = Math.cos(time * 0.3 + offset) * patrolRadius;
      bot.rotation = time * 0.3 + offset + Math.PI / 2;
    }
  }

  getBroadcastState() {
    const states = [];
    for (const [, player] of this.players) {
      states.push(player.toNetworkState());
    }
    for (const [, bot] of this.bots) {
      states.push(bot.toNetworkState());
    }
    return states;
  }
}

module.exports = Room;
