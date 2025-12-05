import * as THREE from "three";

export class BlockCar {
  constructor({
    width = 2,
    height = 1,
    length = 3,
    start = new THREE.Vector3(),
    audioListener = null,
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

    this.vel = new THREE.Vector3(); // world-space linear velocity
    this.heading = 0; // yaw (radians)
    this.turnSpeed = 1.2; // rad/s at full steer
    this.accel = 20; // m/s^2
    this.drag = 0.98;
    this.steer = 0;
    this.throttle = 0;

    this.boundsHalfSize = 180;

    // keyboard
    this._keys = new Set();
    window.addEventListener("keydown", (e) => this._keys.add(e.code));
    window.addEventListener("keyup", (e) => this._keys.delete(e.code));

    this._forward = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._quat = new THREE.Quaternion();

    if (!audioListener) {
      console.warn("BlockCar: No audioListener provided. Car sound disabled.");
    } else {
      this.listener = audioListener;
      this.engineSound = new THREE.Audio(this.listener);

      const audioLoader = new THREE.AudioLoader();
      audioLoader.load(
        "/models/muscle-car-engine-idling-437781.mp3",
        (buffer) => {
          this.engineSound.setBuffer(buffer);
          this.engineSound.setLoop(true);
          this.engineSound.setVolume(0.3);
        }
      );

      // attach sound to the car so it follows
      this.mesh.add(this.engineSound);
    }
    
  }

  _handleInput(dt) {
    // If camera is in free mode, ignore driving input
    if (typeof window !== "undefined" && window.__cameraMode === "free") {
      this.steer = 0;
      this.throttle = 0;
      return;
    }

    const left = this._keys.has("ArrowLeft") || this._keys.has("KeyA");
    const right = this._keys.has("ArrowRight") || this._keys.has("KeyD");
    const up = this._keys.has("ArrowUp") || this._keys.has("KeyW");
    const down = this._keys.has("ArrowDown") || this._keys.has("KeyS");

    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const throttleInput = (up ? 1 : 0) - (down ? 1 : 0);

    this.steer = steerInput;
    this.throttle = throttleInput;

    const speed = this.vel.length();
    this.heading +=
      this.steer * this.turnSpeed * dt * THREE.MathUtils.clamp(speed / 8, 0, 1);
  }

  update(dt, getHeightAndNormal, obstacles = []) {
    this._handleInput(dt);

    // forward in XZ from heading
    this._forward.set(Math.sin(this.heading), 0, Math.cos(this.heading));

    // acceleration along forward
    const accelVec = this._tmp
      .copy(this._forward)
      .multiplyScalar(this.accel * this.throttle);
    this.vel.add(accelVec.multiplyScalar(dt));

    // drag
    this.vel.multiplyScalar(this.drag);

    // integrate position (XZ only; Y comes from terrain)
    this.mesh.position.addScaledVector(this.vel, dt);

    // -----------------------------------------------------------------------
    // Simple obstacle collisions (bounce off palm trees)
    // -----------------------------------------------------------------------
    if (obstacles && obstacles.length > 0) {
      const carRadius = Math.max(this.width, this.length) * 0.5;

      for (const obs of obstacles) {
        if (!obs) continue;
        const obsPos = obs.position;
        const dx = this.mesh.position.x - obsPos.x;
        const dz = this.mesh.position.z - obsPos.z;

        const distSq = dx * dx + dz * dz;
        const obsRadius = obs.userData.radius || 3;
        const minDist = carRadius + obsRadius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.0001;
          const nx = dx / dist;
          const nz = dz / dist;

          // push car out of the obstacle
          const penetration = minDist - dist;
          this.mesh.position.x += nx * penetration;
          this.mesh.position.z += nz * penetration;

          // reflect velocity in XZ plane
          const dot = this.vel.x * nx + this.vel.z * nz;
          this.vel.x -= 2 * dot * nx;
          this.vel.z -= 2 * dot * nz;

          // lose some energy on bounce
          this.vel.multiplyScalar(0.65);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Invisible boundary wall before the mountains
    // -----------------------------------------------------------------------
    const limit = this.boundsHalfSize;
    let hitWall = false;
    let nxWall = 0;
    let nzWall = 0;

    // X boundaries
    if (this.mesh.position.x > limit) {
      this.mesh.position.x = limit;
      nxWall = -1;
      hitWall = true;
    } else if (this.mesh.position.x < -limit) {
      this.mesh.position.x = -limit;
      nxWall = 1;
      hitWall = true;
    }

    // Z boundaries
    if (this.mesh.position.z > limit) {
      this.mesh.position.z = limit;
      nzWall = -1;
      hitWall = true;
    } else if (this.mesh.position.z < -limit) {
      this.mesh.position.z = -limit;
      nzWall = 1;
      hitWall = true;
    }

    if (hitWall) {
      // combine normal (handles corners too)
      const len = Math.hypot(nxWall, nzWall) || 1;
      const nx = nxWall / len;
      const nz = nzWall / len;

      // reflect velocity across wall normal in XZ plane
      const dotWall = this.vel.x * nx + this.vel.z * nz;
      this.vel.x -= 2 * dotWall * nx;
      this.vel.z -= 2 * dotWall * nz;

      // lose most of the speed on impact
      this.vel.multiplyScalar(0.4);
    }

    // sample terrain for height + normal at current x,z
    const { height, normal } = getHeightAndNormal(
      this.mesh.position.x,
      this.mesh.position.z
    );

    // stick to ground
    this.mesh.position.y = height + this.height * 0.5 + 0.05;

    // orient: align up with terrain normal and yaw with heading
    const yawQuat = this._quat.setFromAxisAngle(this._up, this.heading);
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(
      this._up,
      normal.clone().normalize()
    );
    this.mesh.quaternion.copy(yawQuat).premultiply(alignQuat);
  }
}
