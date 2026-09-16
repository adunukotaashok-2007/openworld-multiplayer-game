// ============================================================
//  NETWORK MANAGER — WebSocket multiplayer via Socket.io
//  Handles connection, state sync, chat, combat events
// ============================================================

import { io, Socket } from 'socket.io-client';
import { RemotePlayer } from '../entities/RemotePlayer';
import { PlayerState } from '../entities/Player';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export class NetworkManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  public connectionState: ConnectionState = 'disconnected';
  public remotePlayers: Map<string, RemotePlayer> = new Map();
  public playerName: string = '';
  public roomId: string = '';
  private isOffline: boolean = false;

  // Callbacks
  public onPlayerJoined: ((state: PlayerState) => void) | null = null;
  public onPlayerLeft: ((playerId: string) => void) | null = null;
  public onPlayerUpdate: ((state: PlayerState) => void) | null = null;
  public onChatMessage: ((sender: string, message: string) => void) | null = null;
  public onCombatEvent: ((data: any) => void) | null = null;
  public onConnectionChange: ((state: ConnectionState) => void) | null = null;

  constructor(serverUrl: string = '') {
    this.serverUrl = serverUrl || this.detectServerUrl();
  }

  private detectServerUrl(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return 'http://localhost:3000';
      }
      return `https://${host}`;
    }
    return 'http://localhost:3000';
  }

  async connect(playerName: string): Promise<void> {
    if (this.isOffline) return;
    this.playerName = playerName;
    this.setConnectionState('connecting');

    return new Promise((resolve, reject) => {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        timeout: 10000,
        query: { playerName }
      });

      this.socket.on('connect', () => {
        console.log('🌐 Connected to server:', this.socket!.id);
        this.setConnectionState('connected');
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        console.warn('Disconnected:', reason);
        this.setConnectionState('disconnected');
      });

      this.socket.on('connect_error', (err) => {
        console.error('Connection error:', err.message);
        this.setConnectionState('error');
        reject(err);
      });

      this.bindServerEvents();

      setTimeout(() => {
        if (this.connectionState === 'connecting') {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  private bindServerEvents(): void {
    if (!this.socket) return;

    this.socket.on('room_joined', (data: { roomId: string; players: PlayerState[] }) => {
      this.roomId = data.roomId;
      data.players.forEach(state => {
        if (state.id !== this.socket!.id) {
          this.addRemotePlayer(state);
        }
      });
    });

    this.socket.on('player_joined', (state: PlayerState) => {
      this.addRemotePlayer(state);
      this.onPlayerJoined?.(state);
    });

    this.socket.on('player_left', (playerId: string) => {
      this.removeRemotePlayer(playerId);
      this.onPlayerLeft?.(playerId);
    });

    this.socket.on('players_update', (states: PlayerState[]) => {
      states.forEach(state => {
        if (state.id !== this.socket!.id) {
          const remote = this.remotePlayers.get(state.id);
          if (remote) {
            remote.applyState(state);
          }
          this.onPlayerUpdate?.(state);
        }
      });
    });

    this.socket.on('chat_broadcast', (data: { sender: string; message: string }) => {
      this.onChatMessage?.(data.sender, data.message);
    });

    this.socket.on('combat_result', (data: any) => {
      this.onCombatEvent?.(data);
    });
  }

  joinRoom(roomId: string): void {
    this.socket?.emit('join_room', { roomId, playerName: this.playerName });
  }

  sendPlayerState(state: PlayerState): void {
    if (!this.socket || this.isOffline) return;
    this.socket.emit('player_input', state);
  }

  sendChatMessage(message: string): void {
    if (!this.socket || !message.trim()) return;
    this.socket.emit('chat_message', {
      sender: this.playerName,
      message: message.trim().substring(0, 120)
    });
  }

  sendCombatEvent(eventData: { type: string; targetId?: string; damage?: number }): void {
    this.socket?.emit('combat_event', eventData);
  }

  private addRemotePlayer(state: PlayerState): void {
    if (this.remotePlayers.has(state.id)) return;
    // Note: scene reference would be injected in production
    console.log(`👤 Player joined: ${state.name}`);
  }

  private removeRemotePlayer(playerId: string): void {
    const player = this.remotePlayers.get(playerId);
    if (player) {
      player.destroy();
      this.remotePlayers.delete(playerId);
      console.log(`👤 Player left: ${playerId}`);
    }
  }

  setOfflineMode(offline: boolean): void {
    this.isOffline = offline;
    if (offline) {
      this.setConnectionState('connected');
    }
  }

  spawnBot(name: string, position: { x: number; y: number; z: number }): void {
    // For offline mode: create local bot entities
    console.log(`🤖 Bot spawned: ${name} at (${position.x}, ${position.z})`);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
    this.onConnectionChange?.(state);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.remotePlayers.forEach(p => p.destroy());
    this.remotePlayers.clear();
  }

  getPing(): number {
    return 0; // Socket.io doesn't expose ping directly; use custom ping
  }
}
