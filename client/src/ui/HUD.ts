// ============================================================
//  HUD — Heads-Up Display for health, minimap, weapons, kills
//  Mobile-optimized touch-friendly overlay
// ============================================================

import { Player } from '../entities/Player';

export class HUD {
  private healthBarFill: HTMLElement;
  private healthText: HTMLElement;
  private weaponIcon: HTMLImageElement;
  private ammoCount: HTMLElement;
  private playerCountEl: HTMLElement;
  private killFeed: HTMLElement;
  private minimapCanvas: HTMLCanvasElement;
  private minimapCtx: CanvasRenderingContext2D;

  private killFeedEntries: { text: string; time: number }[] = [];
  private maxKillFeedEntries = 5;

  constructor() {
    this.healthBarFill = document.getElementById('health-bar-fill')!;
    this.healthText = document.getElementById('health-text')!;
    this.weaponIcon = document.getElementById('weapon-icon') as HTMLImageElement;
    this.ammoCount = document.getElementById('ammo-count')!;
    this.playerCountEl = document.getElementById('p-count')!;
    this.killFeed = document.getElementById('kill-feed')!;
    this.minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;

    this.bindActionButtons();
  }

  private bindActionButtons(): void {
    const btnAttack = document.getElementById('btn-attack')!;
    const btnJump = document.getElementById('btn-jump')!;
    const btnInteract = document.getElementById('btn-interact')!;
    const btnCrouch = document.getElementById('btn-crouch')!;

    btnAttack.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('game:attack'));
    });

    btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('game:jump'));
    });

    btnInteract.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('game:interact'));
    });

    btnCrouch.addEventListener('touchstart', (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('game:crouch'));
    });
  }

  update(player: Player): void {
    this.updateHealthBar(player);
    this.updateMinimap(player);
  }

  private updateHealthBar(player: Player): void {
    const hp = player.healthSystem.currentHealth;
    const maxHp = player.healthSystem.maxHealth;
    const percent = (hp / maxHp) * 100;

    this.healthBarFill.style.width = `${percent}%`;
    this.healthText.textContent = `${Math.ceil(hp)} / ${maxHp}`;

    // Color based on health
    if (percent > 60) {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #22c55e, #4ade80)';
    } else if (percent > 30) {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
    } else {
      this.healthBarFill.style.background = 'linear-gradient(90deg, #ef4444, #f87171)';
    }
  }

  private updateMinimap(player: Player): void {
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const scale = 0.5; // pixels per world unit

    ctx.clearRect(0, 0, w, h);

    // Background
    ctx.fillStyle = 'rgba(0, 20, 0, 0.7)';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 15) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
    }

    // Player dot (center)
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    const rot = player.getState().rotation;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(rot) * 10, cy - Math.cos(rot) * 10);
    ctx.stroke();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
  }

  addKillFeedEntry(killer: string, victim: string, weapon: string): void {
    const entry = `${killer} [${weapon}] ${victim}`;
    this.killFeedEntries.push({ text: entry, time: Date.now() });

    if (this.killFeedEntries.length > this.maxKillFeedEntries) {
      this.killFeedEntries.shift();
    }

    this.renderKillFeed();
  }

  private renderKillFeed(): void {
    const now = Date.now();
    this.killFeedEntries = this.killFeedEntries.filter(e => now - e.time < 5000);

    this.killFeed.innerHTML = this.killFeedEntries
      .map(e => `<div class="kill-entry">${e.text}</div>`)
      .join('');
  }

  setPlayerCount(count: number): void {
    this.playerCountEl.textContent = String(count);
  }

  setWeapon(weaponName: string, icon: string, ammo: string): void {
    this.weaponIcon.alt = weaponName;
    this.ammoCount.textContent = ammo;
  }
}
