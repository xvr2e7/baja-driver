import * as THREE from "three";
const TERRAIN_MIN_X = -199;
const TERRAIN_MAX_X =  199;
const TERRAIN_MIN_Z = -199;
const TERRAIN_MAX_Z =  199;
export class BlockCar {
  constructor({
    width = 2,
    height = 1,
    length = 3,
    start = new THREE.Vector3(),
  } = {}) {
    this.width = width;
    this.height = height;
    this.length = length;

    const geo = new THREE.BoxGeometry(width, height, length);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3366ff,
      roughness: 0.5,
      metalness: 0.1,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.copy(start);

    this.vel = new THREE.Vector3(); // world-space linear velocity (x,z used for planar motion)
    this.vy = 0; // vertical velocity (y)
    this.heading = 0; // yaw (radians)
    this.turnSpeed = 1.8; // rad/s at full steer
    this.accel = 20;             // m/s^2 forward thrust
    this.maxForwardSpeed = 4;   // m/s forward top speed
    this.maxReverseSpeed = -8;   // m/s reverse top speed
    this.drag = 1.2;             // forward drag (per second)
    this.lateralGrip = 8.5;      // lateral damping (higher = less sliding)
    this.steerResponsiveness = 1.0; // multiplier for steer feel

    // throttle smoothing (prevents jarring instant accel)
    this.targetThrottle = 0;     // raw input goal (+1..-1)
    this.throttle = 0;           // smoothed throttle
    this.throttleSmooth = 8.0;   // higher = faster response

    // vertical / suspension
    this.mass = 250;               // effective mass for vertical dynamics
    this.gravity = -9.81;
    this.suspensionRest = 0.12;    // nominal clearance above ground
    this._wn = 22.0;               // natural frequency (rad/s)
    this._zeta = 1.0;              // damping ratio (1.0 = critical damping)
    this.heightSmoothTau = 0.06;   // time-constant for smoothing terrain target height
    this._smoothedTargetY = NaN;   // internal smoothed height target, init on first update
    this._initialized = false;     // set true on first update
    this.maxVy = 25;               // clamp vertical speed (m/s)
    this.maxUpOffset = 0.6;        // limit how far the target height is allowed to jump upward instantly

    // inputs/state
    this.steer = 0;              // -1..+1
    this.throttleInput = 0;      // raw input read each frame

    // keyboard
    this._keys = new Set();
    window.addEventListener("keydown", (e) => this._keys.add(e.code));
    window.addEventListener("keyup", (e) => this._keys.delete(e.code));
    const xOff = width * 0.45;
    const zOff = length * 0.42;
    this._contactOffsets = [
      new THREE.Vector3(xOff, 0, zOff),
      new THREE.Vector3(-xOff, 0, zOff),
      new THREE.Vector3(xOff, 0, -zOff),
      new THREE.Vector3(-xOff, 0, -zOff),
    ];

    this._forward = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._quat = new THREE.Quaternion();
    this._right = new THREE.Vector3();
  }

  _handleInput(dt) {
    const left = this._keys.has("ArrowLeft") || this._keys.has("KeyA");
    const right = this._keys.has("ArrowRight") || this._keys.has("KeyD");
    const up = this._keys.has("ArrowUp") || this._keys.has("KeyW");
    const down = this._keys.has("ArrowDown") || this._keys.has("KeyS");

    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const throttleInput = (down ? 1 : 0) - (up ? 1 : 0);

    // NOTE: do NOT directly set this.throttle here (that bypasses smoothing).
    this.steer = THREE.MathUtils.clamp(steerInput, -1, 1);
    this.targetThrottle = THREE.MathUtils.clamp(throttleInput, -1, 1);

    // steering is scaled by speed so it doesn't insta-spin when stopped
    const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    const speedFactor = THREE.MathUtils.clamp(speed / 6, 0, 1); // tweak divisor for steering at low speed
    this.heading += this.steer * this.turnSpeed * dt * speedFactor * this.steerResponsiveness;
  }

  _sampleTerrain(getHeightAndNormal) {
    const f = this._forward;
    const r = this._right;
    // compute basis (ensure forward/right are up-to-date)
    f.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    r.set(f.z, 0, -f.x);

    let totalH = 0;
    const avgNormal = new THREE.Vector3(0, 0, 0);
    let valid = 0;

    for (let i = 0; i < this._contactOffsets.length; i++) {
      const off = this._contactOffsets[i];
      // world pos = vehicle center + forward*offset.z + right*offset.x
      const wx = this.mesh.position.x + f.x * off.z + r.x * off.x;
      const wz = this.mesh.position.z + f.z * off.z + r.z * off.x;
      let sample = null;
      if (typeof getHeightAndNormal === "function") {
        try {
          sample = getHeightAndNormal(wx, wz);
        } catch (e) {
          sample = null;
        }
      }
      if (!sample) {
        // fallback: use center sample if corner failed
        if (typeof getHeightAndNormal === "function") {
          try { sample = getHeightAndNormal(this.mesh.position.x, this.mesh.position.z); } catch(e){ sample = null; }
        }
      }
      if (sample) {
        totalH += sample.height;
        avgNormal.add(sample.normal);
        valid++;
      }
    }

    if (valid === 0) {
      // fallback to flat ground at y=0
      return { height: 0, normal: new THREE.Vector3(0, 1, 0) };
    }

    avgNormal.divideScalar(valid).normalize();
    return { height: totalH / valid, normal: avgNormal };
  }

  update(dt, getHeightAndNormal) {
    // handle input (sets heading and targetThrottle)
    this._handleInput(dt);

    // smooth throttle towards target (exponential smoothing)
    const alpha = 1 - Math.exp(-this.throttleSmooth * dt);
    this.throttle += (this.targetThrottle - this.throttle) * alpha;

    // compute forward and right bases
    this._forward.set(Math.sin(this.heading), 0, Math.cos(this.heading)).normalize();
    this._right.set(this._forward.z, 0, -this._forward.x).normalize();

    // forward and lateral components of current world velocity
    const vForward = this._forward.dot(this.vel);
    const vLateral = this._right.dot(this.vel);

    // integrate longitudinal (forward) velocity from throttle
    let newVForward = vForward + this.accel * this.throttle * dt;

    // clamp forward/reverse speeds
    if (newVForward > this.maxForwardSpeed) newVForward = this.maxForwardSpeed;
    if (newVForward < this.maxReverseSpeed) newVForward = this.maxReverseSpeed;

    // apply forward drag (exponential damping)
    const forwardDamp = Math.exp(-this.drag * dt);
    newVForward *= forwardDamp;

    // apply lateral "grip" damping to remove sliding
    const lateralDamp = Math.exp(-this.lateralGrip * dt);
    const newVLateral = vLateral * lateralDamp;

    // combine back into world XZ velocity (leave y alone for now)
    this.vel.copy(this._forward).multiplyScalar(newVForward).addScaledVector(this._right, newVLateral);
    // tiny velocity snap-to-zero to avoid perpetual micro-slide
    if (this.vel.x * this.vel.x + this.vel.z * this.vel.z < 1e-4) {
      this.vel.x = 0;
      this.vel.z = 0;
    }

    // integrate horizontal position (XZ)
    this.mesh.position.addScaledVector(this.vel, dt);

    let bounced = false;

if (this.mesh.position.x < TERRAIN_MIN_X) {
  this.mesh.position.x = TERRAIN_MIN_X;
  this.vel.x = -this.vel.x * 0.25; // reflect + damping
  bounced = true;
}
if (this.mesh.position.x > TERRAIN_MAX_X) {
  this.mesh.position.x = TERRAIN_MAX_X;
  this.vel.x = -this.vel.x * 0.25;
  bounced = true;
}
if (this.mesh.position.z < TERRAIN_MIN_Z) {
  this.mesh.position.z = TERRAIN_MIN_Z;
  this.vel.z = -this.vel.z * 0.25;
  bounced = true;
}
if (this.mesh.position.z > TERRAIN_MAX_Z) {
  this.mesh.position.z = TERRAIN_MAX_Z;
  this.vel.z = -this.vel.z * 0.25;
  bounced = true;
}

if (bounced) {
  // soften throttle so car doesn't immediately jam into the wall again
  this.targetThrottle = 0;
  this.throttle *= 0.3;
}

    // sample terrain (use averaged corners)
    const { height: sampledH, normal } = this._sampleTerrain(getHeightAndNormal);

    // compute the desired (target) car center Y based on terrain and suspensionRest
    const nominalTargetY = sampledH + this.height * 0.5 + 0.05; // small clearance
    // limit sudden upward jumps in target to avoid explosions on steep bumps
    let targetY = nominalTargetY;
    if (Number.isFinite(this._smoothedTargetY)) {
      const maxUp = this._smoothedTargetY + this.maxUpOffset;
      if (targetY > maxUp) targetY = maxUp;
    }

    // initialize smoothed target on first run
    if (!this._initialized || Number.isNaN(this._smoothedTargetY)) {
      this._smoothedTargetY = targetY;
      this.mesh.position.y = this._smoothedTargetY;
      this.vy = 0;
      this._initialized = true;
    }

    // low-pass filter the targetY to avoid instantaneous jumps (time-constant -> alpha)
    const alphaH = 1 - Math.exp(-dt / Math.max(1e-6, this.heightSmoothTau));
    this._smoothedTargetY += (targetY - this._smoothedTargetY) * alphaH;

    // ---- vertical dynamics: spring-damper towards _smoothedTargetY ----
    // spring stiffness and damping
    const k = this.mass * this._wn * this._wn; // spring constant
    const c = 2 * this._zeta * this.mass * this._wn; // damping coeff
    const y = this.mesh.position.y;
    const yErr = y - this._smoothedTargetY; // displacement from target
    const Fspr = -k * yErr - c * this.vy; // spring-damper force (N)

    // provide a static support force that cancels gravity at the equilibrium target
    const supportForce = -this.mass * this.gravity; // mass * -g  (upward)
    // total acceleration (include gravity as well, but supportForce cancels it at target)
    const a = (Fspr + supportForce) / this.mass + this.gravity;

    // integrate vertical velocity and clamp
    this.vy += a * dt;
    this.vy = THREE.MathUtils.clamp(this.vy, -this.maxVy, this.maxVy);

    // integrate vertical position
    this.mesh.position.y += this.vy * dt;

    // prevent penetrating the smoothed target (hard contact)
    if (this.mesh.position.y < this._smoothedTargetY) {
      this.mesh.position.y = this._smoothedTargetY;
      if (this.vy < 0) this.vy = 0;
    }

    // orient: yaw + align up to terrain normal
    const yawQuat = this._quat.setFromAxisAngle(this._up, this.heading);
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(this._up, normal.clone().normalize());
    this.mesh.quaternion.copy(yawQuat).premultiply(alignQuat);
  }
}
