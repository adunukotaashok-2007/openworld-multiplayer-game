// ============================================================
//  MAIN ENTRY POINT — Bootstraps the entire game client
//  Handles loading screen → menu → game transitions
// ============================================================

import { GameEngine } from './engine/GameEngine';

class GameApp {
  private engine!: GameEngine;
  private currentState: 'loading' | 'menu' | 'playing' = 'loading';

  async boot(): Promise<void> {
    console.log('🎮 OpenWorld Multiplayer — Booting…');

    // Force landscape on mobile
    this.lockOrientation();

    // Show loading screen
    this.showScreen('loading');

    try {
      // Initialize engine
      const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
      this.engine = new GameEngine();
      await this.engine.init(canvas);

      // Transition to menu
      this.showScreen('menu');
      this.bindMenuEvents();

    } catch (error) {
      console.error('Fatal boot error:', error);
      this.showFatalError(String(error));
    }
  }

  private bindMenuEvents(): void {
    const btnPlay = document.getElementById('btn-play')!;
    const btnOffline = document.getElementById('btn-offline')!;
    const nameInput = document.getElementById('player-name') as HTMLInputElement;

    btnPlay.addEventListener('click', () => this.startGame(nameInput.value, true));
    btnOffline.addEventListener('click', () => this.startGame(nameInput.value, false));

    // Touch feedback
    [btnPlay, btnOffline].forEach(btn => {
      btn.addEventListener('touchstart', () => btn.style.transform = 'scale(0.95)');
      btn.addEventListener('touchend', () => btn.style.transform = 'scale(1)');
    });
  }

  private async startGame(playerName: string, online: boolean): Promise<void> {
    const name = playerName.trim() || `Player_${Math.floor(Math.random() * 9999)}`;
    this.engine.localPlayer.name = name;

    this.showScreen('playing');

    if (online) {
      await this.engine.network.connect(name);
      this.engine.network.joinRoom('default');
    } else {
      this.engine.network.setOfflineMode(true);
      this.spawnBots(8);
    }

    this.engine.start();
  }

  private spawnBots(count: number): void {
    const botNames = [
      'Shadow', 'Viper', 'Ghost', 'Storm', 'Blaze',
      'Frost', 'Raven', 'Titan', 'Nova', 'Hawk'
    ];
    for (let i = 0; i < count; i++) {
      this.engine.network.spawnBot(
        botNames[i % botNames.length],
        {
          x: (Math.random() - 0.5) * 80,
          y: 1,
          z: (Math.random() - 0.5) * 80
        }
      );
    }
  }

  private showScreen(screen: 'loading' | 'menu' | 'playing'): void {
    this.currentState = screen;
    const loading = document.getElementById('loading-screen')!;
    const menu = document.getElementById('main-menu')!;
    const hud = document.getElementById('hud')!;
    const actions = document.getElementById('action-buttons')!;
    const chatToggle = document.getElementById('chat-toggle')!;

    loading.classList.toggle('hidden', screen !== 'loading');
    menu.classList.toggle('hidden', screen !== 'menu');
    hud.classList.toggle('hidden', screen !== 'playing');
    actions.classList.toggle('hidden', screen !== 'playing');
    chatToggle.classList.toggle('hidden', screen !== 'playing');
  }

  private lockOrientation(): void {
    if (screen.orientation && 'lock' in screen.orientation) {
      (screen.orientation as any).lock('landscape').catch(() => {});
    }
  }

  private showFatalError(msg: string): void {
    const el = document.getElementById('load-status')!;
    el.textContent = `❌ Error: ${msg}`;
    el.style.color = '#ff4444';
  }
}

// ── Boot when DOM ready ──
window.addEventListener('DOMContentLoaded', () => {
  const app = new GameApp();
  app.boot();
});
