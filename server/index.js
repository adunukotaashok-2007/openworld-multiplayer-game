// ============================================================
//  OPENWORLD GAME SERVER — Node.js + Socket.io
//  Handles real-time multiplayer, rooms, game loop, combat
// ============================================================

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config');
const RoomManager = require('./rooms/RoomManager');
const GameLoop = require('./game/GameLoop');
const SocketHandler = require('./network/SocketHandler');
const Logger = require('./utils/Logger');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 30000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling']
});

// ── Core Systems ──
const roomManager = new RoomManager(config.MAX_ROOMS, config.MAX_PLAYERS_PER_ROOM);
const gameLoop = new GameLoop(config.TICK_RATE);
const socketHandler = new SocketHandler(io, roomManager, gameLoop);

// ── REST API for lobby info ──
app.get('/api/rooms', (req, res) => {
  res.json(roomManager.getPublicRoomList());
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    players: roomManager.getTotalPlayerCount(),
    rooms: roomManager.getActiveRoomCount(),
    uptime: process.uptime()
  });
});

// ── Socket Connection ──
io.on('connection', (socket) => {
  Logger.info(`Player connected: ${socket.id}`);
  socketHandler.handleConnection(socket);

  socket.on('join_room', (data) => socketHandler.handleJoinRoom(socket, data));
  socket.on('leave_room', () => socketHandler.handleLeaveRoom(socket));
  socket.on('player_input', (data) => socketHandler.handlePlayerInput(socket, data));
  socket.on('player_action', (data) => socketHandler.handlePlayerAction(socket, data));
  socket.on('chat_message', (data) => socketHandler.handleChatMessage(socket, data));
  socket.on('combat_event', (data) => socketHandler.handleCombatEvent(socket, data));
  socket.on('disconnect', (reason) => socketHandler.handleDisconnect(socket, reason));
});

// ── Start Game Loop ──
gameLoop.start((deltaTime) => {
  roomManager.updateAllRooms(deltaTime);
});

// ── Start Server ──
const PORT = process.env.PORT || config.PORT;
server.listen(PORT, () => {
  Logger.info(`🎮 Game Server running on port ${PORT}`);
  Logger.info(`📡 Tick rate: ${config.TICK_RATE} Hz`);
  Logger.info(`🏠 Max rooms: ${config.MAX_ROOMS}`);
});

module.exports = { app, server, io };
