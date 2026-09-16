// ============================================================
//  ROOM MANAGER — OOP Room lifecycle & player distribution
// ============================================================

const Room = require('./Room');
const Logger = require('../utils/Logger');

class RoomManager {
  constructor(maxRooms = 50, maxPlayersPerRoom = 20) {
    this.rooms = new Map();
    this.maxRooms = maxRooms;
    this.maxPlayersPerRoom = maxPlayersPerRoom;
    this.roomIdCounter = 0;
  }

  createRoom(settings = {}) {
    if (this.rooms.size >= this.maxRooms) {
      throw new Error('Server full: maximum rooms reached');
    }
    const roomId = `room_${++this.roomIdCounter}_${Date.now()}`;
    const room = new Room(roomId, {
      maxPlayers: settings.maxPlayers || this.maxPlayersPerRoom,
      mapName: settings.mapName || 'default_city',
      gameMode: settings.gameMode || 'free_roam',
      enableBots: settings.enableBots ?? true,
      botCount: settings.botCount || 5,
      ...settings
    });
    this.rooms.set(roomId, room);
    Logger.info(`Room created: ${roomId} (${room.settings.gameMode})`);
    return room;
  }

  joinRoom(roomId, playerData) {
    let room = this.rooms.get(roomId);
    if (!room) {
      room = this.createRoom({ mapName: 'default_city' });
    }
    if (room.isFull()) {
      // Find or create another room
      room = this.findAvailableRoom() || this.createRoom();
    }
    room.addPlayer(playerData);
    return room;
  }

  findAvailableRoom() {
    for (const [, room] of this.rooms) {
      if (!room.isFull() && room.isActive()) return room;
    }
    return null;
  }

  removePlayerFromAllRooms(playerId) {
    for (const [, room] of this.rooms) {
      if (room.hasPlayer(playerId)) {
        room.removePlayer(playerId);
        if (room.isEmpty()) {
          this.rooms.delete(room.id);
          Logger.info(`Room destroyed (empty): ${room.id}`);
        }
        return;
      }
    }
  }

  updateAllRooms(deltaTime) {
    for (const [, room] of this.rooms) {
      room.update(deltaTime);
    }
  }

  getPublicRoomList() {
    const list = [];
    for (const [, room] of this.rooms) {
      list.push({
        id: room.id,
        mapName: room.settings.mapName,
        gameMode: room.settings.gameMode,
        players: room.getPlayerCount(),
        maxPlayers: room.settings.maxPlayers,
        ping: 0
      });
    }
    return list;
  }

  getTotalPlayerCount() {
    let count = 0;
    for (const [, room] of this.rooms) count += room.getPlayerCount();
    return count;
  }

  getActiveRoomCount() {
    return this.rooms.size;
  }
}

module.exports = RoomManager;
