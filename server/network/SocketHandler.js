// ============================================================
//  SOCKET HANDLER — All Socket.io event processing
//  Validates input, routes to game systems, broadcasts state
// ============================================================

const Logger = require('../utils/Logger');
const PacketTypes = require('./PacketTypes');
const RateLimiter = require('./RateLimiter');

class SocketHandler {
  constructor(io, roomManager, gameLoop) {
    this.io = io;
    this.roomManager = roomManager;
    this.gameLoop = gameLoop;
    this.rateLimiter = new RateLimiter(30, 1000); // 30 msgs/sec
    this.playerRooms = new Map(); // socketId → roomId

    // Broadcast loop: send state to all rooms at tick rate
    setInterval(() => this.broadcastAllStates(), 1000 / 20);
  }

  handleConnection(socket) {
    Logger.info(`[NET] New connection: ${socket.id}`);
    socket.emit('connected', {
      serverTime: Date.now(),
      tickRate: this.gameLoop.tickRate
    });
  }

  handleJoinRoom(socket, data) {
    if (!this.rateLimiter.check(socket.id)) {
      socket.emit('error', { message: 'Rate limited' });
      return;
    }

    try {
      const room = this.roomManager.joinRoom(data.roomId || 'default', {
        socketId: socket.id,
        playerName: data.playerName || 'Player'
      });

      // Join Socket.io room
      socket.join(room.id);
      this.playerRooms.set(socket.id, room.id);

      // Send room state to joining player
      socket.emit('room_joined', {
        roomId: room.id,
        players: room.getBroadcastState(),
        settings: room.settings
      });

      // Notify others
      socket.to(room.id).emit('player_joined', {
        id: socket.id,
        name: data.playerName || 'Player',
        position: room.getSpawnPoint(),
        health: 100,
        maxHealth: 100,
        rotation: 0,
        isAttacking: false,
        weaponId: 'fist',
        speed: 8
      });

      Logger.info(`[NET] ${data.playerName} joined room ${room.id}`);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  }

  handleLeaveRoom(socket) {
    const roomId = this.playerRooms.get(socket.id);
    if (roomId) {
      socket.leave(roomId);
      this.roomManager.removePlayerFromAllRooms(socket.id);
      this.playerRooms.delete(socket.id);
      this.io.to(roomId).emit('player_left', socket.id);
    }
  }

  handlePlayerInput(socket, data) {
    if (!this.rateLimiter.check(socket.id)) return;

    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.roomManager.rooms.get(roomId);
    if (room) {
      room.updatePlayerInput(socket.id, data);
    }
  }

  handlePlayerAction(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.roomManager.rooms.get(roomId);
    if (!room) return;

    switch (data.type) {
      case 'jump':
        // Server validates jump
        break;
      case 'interact':
        // Server processes interaction
        break;
      case 'switch_weapon':
        const player = room.players.get(socket.id);
        if (player) player.weapon = data.weaponId;
        break;
    }
  }

  handleChatMessage(socket, data) {
    if (!this.rateLimiter.check(socket.id, 5)) return; // Stricter for chat

    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const message = String(data.message || '').substring(0, 120).trim();
    if (!message) return;

    // Basic profanity filter placeholder
    const cleanMessage = message.replace(/[<>]/g, '');

    this.io.to(roomId).emit('chat_broadcast', {
      sender: data.sender || 'Unknown',
      message: cleanMessage,
      timestamp: Date.now()
    });
  }

  handleCombatEvent(socket, data) {
    const roomId = this.playerRooms.get(socket.id);
    if (!roomId) return;

    const room = this.roomManager.rooms.get(roomId);
    if (!room) return;

    const result = room.resolveCombat(socket.id, data);
    if (result) {
      this.io.to(roomId).emit('combat_result', result);
    }
  }

  handleDisconnect(socket, reason) {
    Logger.info(`[NET] Disconnected: ${socket.id} (${reason})`);
    this.handleLeaveRoom(socket);
    this.rateLimiter.remove(socket.id);
  }

  broadcastAllStates() {
    for (const [roomId, room] of this.roomManager.rooms) {
      if (room.state !== 'playing') continue;
      const states = room.getBroadcastState();
      this.io.to(roomId).emit('players_update', states);
    }
  }
}

module.exports = SocketHandler;
