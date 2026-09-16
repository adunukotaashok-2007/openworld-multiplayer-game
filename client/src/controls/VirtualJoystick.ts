// ============================================================
//  VIRTUAL JOYSTICK — Dual-touch joystick for mobile movement
//  Left stick = movement, Right stick = camera look
// ============================================================

export interface JoystickInput {
  moveX: number;   // -1 to 1
  moveY: number;   // -1 to 1
  lookX: number;   // -1 to 1
  lookY: number;   // -1 to 1
  isMoving: boolean;
  isLooking: boolean;
}

export class VirtualJoystick {
  private leftStick: StickState;
  private rightStick: StickState;
  private leftTouchId: number | null = null;
  private rightTouchId: number | null = null;
  private stickRadius = 60;
  private deadZone = 0.1;

  // Visual elements
  private leftBase!: HTMLDivElement;
  private leftKnob!: HTMLDivElement;
  private rightBase!: HTMLDivElement;
  private rightKnob!: HTMLDivElement;

  constructor() {
    this.leftStick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    this.rightStick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
    this.createVisualElements();
    this.bindEvents();
  }

  private createVisualElements(): void {
    // Left joystick visual
    this.leftBase = this.createStickBase('joystick-base-left', '20vw', '25vh');
    this.leftKnob = this.createStickKnob('joystick-knob-left');
    this.leftBase.appendChild(this.leftKnob);
    this.leftBase.style.opacity = '0';

    // Right joystick visual
    this.rightBase = this.createStickBase('joystick-base-right', '75vw', '25vh');
    this.rightKnob = this.createStickKnob('joystick-knob-right');
    this.rightBase.appendChild(this.rightKnob);
    this.rightBase.style.opacity = '0';

    document.body.appendChild(this.leftBase);
    document.body.appendChild(this.rightBase);
  }

  private createStickBase(id: string, left: string, bottom: string): HTMLDivElement {
    const el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'fixed',
      left, bottom,
      width: `${this.stickRadius * 2}px`,
      height: `${this.stickRadius * 2}px`,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.08)',
      border: '2px solid rgba(255,255,255,0.15)',
      transform: 'translate(-50%, 50%)',
      zIndex: '55',
      transition: 'opacity 0.2s',
      pointerEvents: 'none',
    });
    return el;
  }

  private createStickKnob(id: string): HTMLDivElement {
    const el = document.createElement('div');
    el.id = id;
    Object.assign(el.style, {
      position: 'absolute',
      width: '50px', height: '50px',
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.25)',
      border: '2px solid rgba(255,255,255,0.4)',
      top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
    });
    return el;
  }

  private bindEvents(): void {
    const leftZone = document.getElementById('joystick-zone-left')!;
    const rightZone = document.getElementById('joystick-zone-right')!;

    leftZone.addEventListener('touchstart', (e) => this.onTouchStart(e, 'left'), { passive: false });
    leftZone.addEventListener('touchmove', (e) => this.onTouchMove(e, 'left'), { passive: false });
    leftZone.addEventListener('touchend', (e) => this.onTouchEnd(e, 'left'), { passive: false });
    leftZone.addEventListener('touchcancel', (e) => this.onTouchEnd(e, 'left'), { passive: false });

    rightZone.addEventListener('touchstart', (e) => this.onTouchStart(e, 'right'), { passive: false });
    rightZone.addEventListener('touchmove', (e) => this.onTouchMove(e, 'right'), { passive: false });
    rightZone.addEventListener('touchend', (e) => this.onTouchEnd(e, 'right'), { passive: false });
    rightZone.addEventListener('touchcancel', (e) => this.onTouchEnd(e, 'right'), { passive: false });
  }

  private onTouchStart(e: TouchEvent, side: 'left' | 'right'): void {
    e.preventDefault();
    const touch = e.changedTouches[0];
    if (side === 'left' && this.leftTouchId === null) {
      this.leftTouchId = touch.identifier;
      this.leftStick = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        dx: 0, dy: 0
      };
      this.leftBase.style.left = `${touch.clientX}px`;
      this.leftBase.style.bottom = `${window.innerHeight - touch.clientY}px`;
      this.leftBase.style.opacity = '1';
    } else if (side === 'right' && this.rightTouchId === null) {
      this.rightTouchId = touch.identifier;
      this.rightStick = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        dx: 0, dy: 0
      };
      this.rightBase.style.opacity = '1';
    }
  }

  private onTouchMove(e: TouchEvent, side: 'left' | 'right'): void {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (side === 'left' && touch.identifier === this.leftTouchId) {
        this.leftStick.dx = touch.clientX - this.leftStick.startX;
        this.leftStick.dy = touch.clientY - this.leftStick.startY;
        this.updateKnobVisual(this.leftKnob, this.leftStick.dx, this.leftStick.dy);
      } else if (side === 'right' && touch.identifier === this.rightTouchId) {
        this.rightStick.dx = touch.clientX - this.rightStick.startX;
        this.rightStick.dy = touch.clientY - this.rightStick.startY;
        this.updateKnobVisual(this.rightKnob, this.rightStick.dx, this.rightStick.dy);
      }
    }
  }

  private onTouchEnd(e: TouchEvent, side: 'left' | 'right'): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (side === 'left' && touch.identifier === this.leftTouchId) {
        this.leftTouchId = null;
        this.leftStick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
        this.leftKnob.style.transform = 'translate(-50%, -50%)';
        this.leftBase.style.opacity = '0';
      } else if (side === 'right' && touch.identifier === this.rightTouchId) {
        this.rightTouchId = null;
        this.rightStick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
        this.rightKnob.style.transform = 'translate(-50%, -50%)';
        this.rightBase.style.opacity = '0';
      }
    }
  }

  private updateKnobVisual(knob: HTMLDivElement, dx: number, dy: number): void {
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, this.stickRadius);
    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * clampedDist;
    const ny = Math.sin(angle) * clampedDist;
    knob.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
  }

  private normalizeStick(stick: StickState): { x: number; y: number } {
    const dist = Math.sqrt(stick.dx * stick.dx + stick.dy * stick.dy);
    if (dist < this.deadZone * this.stickRadius) return { x: 0, y: 0 };
    const clamped = Math.min(dist, this.stickRadius);
    return {
      x: (stick.dx / dist) * (clamped / this.stickRadius),
      y: (stick.dy / dist) * (clamped / this.stickRadius)
    };
  }

  getInput(): JoystickInput {
    const move = this.normalizeStick(this.leftStick);
    const look = this.normalizeStick(this.rightStick);
    return {
      moveX: move.x,
      moveY: move.y,
      lookX: look.x,
      lookY: look.y,
      isMoving: this.leftStick.active,
      isLooking: this.rightStick.active,
    };
  }
}

interface StickState {
  active: boolean;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}
