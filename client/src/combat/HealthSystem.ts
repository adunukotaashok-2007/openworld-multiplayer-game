// ============================================================
//  HEALTH SYSTEM — HP, damage, healing, death, respawn
// ============================================================

export class HealthSystem {
  public currentHealth: number;
  public maxHealth: number;
  public isDeadFlag: boolean = false;
  public shieldAmount: number = 0;
  public maxShield: number = 50;

  private regenerationRate: number = 1;   // HP per second
  private regenDelay: number = 5;          // Seconds after last damage
  private timeSinceDamage: number = 999;
  private invulnerableTime: number = 0;

  // Events
  public onDamageTaken: ((amount: number) => void) | null = null;
  public onHealed: ((amount: number) => void) | null = null;
  public onDeath: (() => void) | null = null;
  public onRespawn: (() => void) | null = null;

  constructor(maxHealth: number = 100) {
    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;
  }

  takeDamage(amount: number): number {
    if (this.isDeadFlag || this.invulnerableTime > 0) return 0;

    this.timeSinceDamage = 0;
    let actualDamage = amount;

    // Shield absorbs first
    if (this.shieldAmount > 0) {
      const shieldAbsorb = Math.min(this.shieldAmount, actualDamage);
      this.shieldAmount -= shieldAbsorb;
      actualDamage -= shieldAbsorb;
    }

    this.currentHealth = Math.max(0, this.currentHealth - actualDamage);
    this.onDamageTaken?.(actualDamage);

    if (this.currentHealth <= 0) {
      this.die();
    }

    return actualDamage;
  }

  heal(amount: number): number {
    if (this.isDeadFlag) return 0;
    const before = this.currentHealth;
    this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    const actualHeal = this.currentHealth - before;
    if (actualHeal > 0) {
      this.onHealed?.(actualHeal);
    }
    return actualHeal;
  }

  addShield(amount: number): void {
    this.shieldAmount = Math.min(this.maxShield, this.shieldAmount + amount);
  }

  private die(): void {
    this.isDeadFlag = true;
    this.currentHealth = 0;
    this.onDeath?.();
  }

  respawn(): void {
    this.isDeadFlag = false;
    this.currentHealth = this.maxHealth;
    this.shieldAmount = 0;
    this.invulnerableTime = 3; // 3 seconds invulnerability
    this.timeSinceDamage = 999;
    this.onRespawn?.();
  }

  isDead(): boolean {
    return this.isDeadFlag;
  }

  getHealthPercent(): number {
    return this.currentHealth / this.maxHealth;
  }

  update(delta: number): void {
    if (this.isDeadFlag) return;

    // Invulnerability countdown
    if (this.invulnerableTime > 0) {
      this.invulnerableTime -= delta;
    }

    // Health regeneration
    this.timeSinceDamage += delta;
    if (this.timeSinceDamage >= this.regenDelay && this.currentHealth < this.maxHealth) {
      this.currentHealth = Math.min(
        this.maxHealth,
        this.currentHealth + this.regenerationRate * delta
      );
    }
  }
}
