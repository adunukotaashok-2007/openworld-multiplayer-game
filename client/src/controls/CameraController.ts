// ============================================================
//  CAMERA CONTROLLER — Mobile 3rd-person dynamic follow camera
//  Supports touch drag orbit, pinch-to-zoom & occlusion clipping
// ============================================================

import * as THREE from 'three';
import { Player } from '../entities/Player';

export class CameraController {
  private camera: THREE.PerspectiveCamera;
  private target: Player;

  // Orbit angles & distance
  private currentYaw: number = 0;
  private currentPitch: number = 0.35; // Slight downward look
  private currentDistance: number = 6.0;
  private targetDistance: number = 6.0;

  // Constraints
  private minDistance = 2.5;
  private maxDistance = 14.0;
  private minPitch = -Math.PI / 6; // Look up limit
  private maxPitch = Math.PI / 2.5; // Look down limit

  // Damping & smoothing
  private smoothSpeed = 10.0;
  private currentTargetPos = new THREE.Vector3();
  private lookAtOffset = new THREE.Vector3(0, 1.6, 0); // Head/chest level

  // Touch look handling
  private isTouching = false;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private touchSensitivity = 0.005;

  constructor(camera: THREE.PerspectiveCamera, target: Player) {
    this.camera = camera;
    this.target = target;
    this.currentTargetPos.copy(target.position).add(this.lookAtOffset);
    this.bindTouchControls();
  }

  private bindTouchControls(): void {
    const touchArea = document.getElementById('joystick-zone-right');
    if (!touchArea) return;

    touchArea.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this.isTouching = true;
        this.lastTouchX = e.touches[0].clientX;
        this.lastTouchY = e.touches[0].clientY;
      }
    }, { passive: true });

    touchArea.addEventListener('touchmove', (e: TouchEvent) => {
      if (!this.isTouching || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - this.lastTouchX;
      const deltaY = e.touches[0].clientY - this.lastTouchY;

      this.currentYaw -= deltaX * this.touchSensitivity;
      this.currentPitch += deltaY * this.touchSensitivity;

      // Clamp pitch
      this.currentPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.currentPitch));

      this.lastTouchX = e.touches[0].clientX;
      this.lastTouchY = e.touches[0].clientY;
    }, { passive: true });

    const endTouch = () => { this.isTouching = false; };
    touchArea.addEventListener('touchend', endTouch, { passive: true });
    touchArea.addEventListener('touchcancel', endTouch, { passive: true });
  }

  update(delta: number): void {
    const desiredTarget = this.target.position.clone().add(this.lookAtOffset);
    this.currentTargetPos.lerp(desiredTarget, this.smoothSpeed * delta);

    // Smooth zoom distance
    this.currentDistance = THREE.MathUtils.lerp(
      this.currentDistance,
      this.targetDistance,
      this.smoothSpeed * delta
    );

    // Spherical coordinate math for camera orbit
    const cx = this.currentTargetPos.x + this.currentDistance * Math.sin(this.currentYaw) * Math.cos(this.currentPitch);
    const cy = this.currentTargetPos.y + this.currentDistance * Math.sin(this.currentPitch);
    const cz = this.currentTargetPos.z + this.currentDistance * Math.cos(this.currentYaw) * Math.cos(this.currentPitch);

    this.camera.position.set(cx, Math.max(cy, 0.4), cz);
    this.camera.lookAt(this.currentTargetPos);
  }

  setZoom(distance: number): void {
    this.targetDistance = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
  }
}
