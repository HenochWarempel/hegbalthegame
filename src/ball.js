import * as THREE from 'three';
import { COURT } from './court.js';

export const GRAVITY = -13.5;
const RADIUS = 0.115;

// Solve a projectile's launch velocity so it starts at `start`, peaks at
// world-space height `apexY`, and arrives at `target`. Used by both the AI
// and the human aiming helper so shots reliably clear the hedge.
export function computeLaunchVelocity(start, target, apexY, gravity = GRAVITY) {
  const g = -Math.abs(gravity);
  const safeApex = Math.max(apexY, start.y + 0.05, target.y + 0.05);
  const t1 = Math.sqrt((2 * (safeApex - start.y)) / -g);
  const t2 = Math.sqrt((2 * Math.max(safeApex - target.y, 0.01)) / -g);
  const T = Math.max(t1 + t2, 0.15);
  return new THREE.Vector3(
    (target.x - start.x) / T,
    (safeApex - start.y) > 0 ? Math.sqrt(2 * -g * (safeApex - start.y)) : 0.1,
    (target.z - start.z) / T
  );
}

export class Ball {
  constructor(scene) {
    this.radius = RADIUS;
    this.position = new THREE.Vector3(0, RADIUS, -3);
    this.velocity = new THREE.Vector3();
    this.events = [];
    this.restingOnHedge = false;
    this.lastTouchTeam = null;
    this._wasAboveHedge = true;

    const geo = new THREE.SphereGeometry(RADIUS, 16, 12);
    const mat = new THREE.MeshLambertMaterial({ color: 0xf4f1e6 });
    this.mesh = new THREE.Mesh(geo, mat);
    // A couple of stripes so spin/rotation reads visually, like a football.
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    for (const rot of [0, Math.PI / 2]) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(RADIUS * 0.98, RADIUS * 0.08, 6, 16), stripeMat);
      stripe.rotation.x = Math.PI / 2;
      stripe.rotation.y = rot;
      this.mesh.add(stripe);
    }
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // Small contact shadow blob that scales with height for arcade-style readability.
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS * 1.4, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
  }

  place(x, y, z, vx = 0, vy = 0, vz = 0) {
    this.position.set(x, y, z);
    this.velocity.set(vx, vy, vz);
    this.restingOnHedge = false;
  }

  isOverHedgeX() {
    return Math.abs(this.position.x) <= COURT.hedge.halfLength + this.radius;
  }

  update(dt) {
    const substeps = 3;
    const sdt = dt / substeps;
    for (let i = 0; i < substeps; i++) this.step(sdt);

    this.mesh.position.copy(this.position);
    const spin = this.velocity.length() * dt * 4;
    this.mesh.rotation.x += spin;
    this.mesh.rotation.z += spin * 0.4;

    this.shadow.position.set(this.position.x, 0.011, this.position.z);
    const h = Math.max(this.position.y, 0);
    const s = Math.max(0.35, 1.4 - h * 0.35);
    this.shadow.scale.setScalar(s);
    this.shadow.material.opacity = Math.max(0.08, 0.35 - h * 0.03);
  }

  step(dt) {
    this.velocity.y += GRAVITY * dt;
    const prev = this.position.clone();
    this.position.addScaledVector(this.velocity, dt);

    this.handleHedge(prev);
    this.handleGround();
    this.checkResting();
  }

  handleHedge(prevPos) {
    // A ball already settled on top of the hedge sits right where the graze
    // zone below overlaps its resting height; without this guard, gravity's
    // tiny per-substep nudge would re-trigger "grazing" every step and knock
    // the resting velocity back up, fighting checkResting()'s clamp forever.
    if (this.restingOnHedge) return;

    const { halfLength, halfThickness, height } = COURT.hedge;
    const r = this.radius;
    const withinX = Math.abs(this.position.x) <= halfLength + r;
    const withinZ = Math.abs(this.position.z) <= halfThickness + r;
    const nearHeight = this.position.y - r < height;

    if (withinX && withinZ && nearHeight && this.position.y + r > 0) {
      if (this.position.y + r >= height - 0.02) {
        // Grazing the top edge of the hedge: let it continue, just tag the event.
        this.events.push({ type: 'hedge_graze' });
        this.velocity.y -= 0.3; // a little energy lost clipping the leaves
      } else {
        // Solid hit on the hedge face: the ball does not clear it.
        const cameFromNegZ = prevPos.z < 0;
        this.position.z = cameFromNegZ ? -(halfThickness + r + 0.01) : (halfThickness + r + 0.01);
        this.velocity.z *= -0.35;
        this.velocity.x *= 0.4;
        this.velocity.y = Math.max(this.velocity.y * 0.3, 0.5);
        this.events.push({ type: 'hedge_blocked' });
      }
    }
  }

  handleGround() {
    if (this.position.y - this.radius <= 0 && this.velocity.y < 0) {
      const impactSpeed = -this.velocity.y;
      this.position.y = this.radius;
      const onPavement = this.position.z < -0.3;
      const restitution = onPavement ? 0.56 : 0.4;
      const friction = onPavement ? 0.86 : 0.72;
      if (impactSpeed < 0.5) {
        // Resting contact: settle fully instead of emitting a spurious "bounce".
        this.velocity.set(0, 0, 0);
        return;
      }
      this.velocity.y = impactSpeed * restitution;
      this.velocity.x *= friction;
      this.velocity.z *= friction;
      const side = this.position.z < 0 ? 'A' : 'B';
      this.events.push({ type: 'bounce', side, x: this.position.x, z: this.position.z });
    }
  }

  checkResting() {
    const { halfLength, halfThickness, height } = COURT.hedge;
    const onTop = Math.abs(this.position.x) <= halfLength + this.radius &&
      Math.abs(this.position.z) <= halfThickness + this.radius + 0.05 &&
      Math.abs(this.position.y - (height + this.radius)) < 0.05 &&
      this.velocity.length() < 0.6;
    if (onTop) {
      this.velocity.multiplyScalar(0.7);
      this.position.y = height + this.radius;
      if (!this.restingOnHedge) this.events.push({ type: 'rest_on_hedge' });
      this.restingOnHedge = true;
    } else if (this.restingOnHedge && this.velocity.length() > 0.6) {
      this.restingOnHedge = false;
    }
  }

  drainEvents() {
    const e = this.events;
    this.events = [];
    return e;
  }
}
