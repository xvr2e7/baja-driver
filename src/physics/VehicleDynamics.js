import * as THREE from "three";

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

    this.vel = new THREE.Vector3(); // world-space linear velocity
    this.heading = 0; // yaw (radians)
    this.turnSpeed = 1.8; // rad/s at full steer
    this.accel = 10; // m/s^2
    this.drag = 0.98;
    this.steer = 0;
    this.throttle = 0;

    // keyboard
    this._keys = new Set();
    window.addEventListener("keydown", (e) => this._keys.add(e.code));
    window.addEventListener("keyup", (e) => this._keys.delete(e.code));

    this._forward = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._quat = new THREE.Quaternion();
  }

  _handleInput(dt) {
    const left = this._keys.has("ArrowLeft") || this._keys.has("KeyA");
    const right = this._keys.has("ArrowRight") || this._keys.has("KeyD");
    const up = this._keys.has("ArrowUp") || this._keys.has("KeyW");
    const down = this._keys.has("ArrowDown") || this._keys.has("KeyS");

    const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
    const throttleInput = (down ? 1 : 0) - (up ? 1 : 0) ;

    this.steer = steerInput;
    this.throttle = throttleInput;

    // rotate heading proportional to steer and current speed (car-like)
    const speed = this.vel.length();
    this.heading +=
      this.steer * this.turnSpeed * dt * THREE.MathUtils.clamp(speed / 8, 0, 1);
  }

  update(dt, getHeightAndNormal) {
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
    const { height, normal } = getHeightAndNormal(
      this.mesh.position.x,
      this.mesh.position.z
    );

    // stick to ground
    this.mesh.position.y = height + this.height * 0.5 + 0.05;

    // orient: align up with terrain normal and yaw with heading
    const yawQuat = this._quat.setFromAxisAngle(this._up, this.heading);
    // compute a quaternion that sets 'up' to the terrain normal
    const alignQuat = new THREE.Quaternion().setFromUnitVectors(
      this._up,
      normal.clone().normalize()
    );
    this.mesh.quaternion.copy(yawQuat).premultiply(alignQuat);
  }
}
