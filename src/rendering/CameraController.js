import * as THREE from "three";

export class CameraRig {
  constructor() {
    this.root = new THREE.Object3D();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.mode = "follow"; // "follow" | "free"
    this.target = null;

    // Expose mode globally so car can see it
    if (typeof window !== "undefined") {
      window.__cameraMode = this.mode;
    }

    // --- Follow-mode settings ---
    this.followDistance = 12;
    this.followHeight = 5;
    this.followLookOffset = 1.5;
    this.followLerp = 8;

    // --- Free-roam settings ---
    this.freePosition = new THREE.Vector3(0, 10, 25);
    this.yaw = 0;
    this.pitch = -0.3;
    this.moveSpeed = 35;
    this.lookSpeed = 0.0025;

    this._up = new THREE.Vector3(0, 1, 0);
    this._targetPos = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();

    this._keys = new Set();
    this._mouseDown = false;

    this.camera.position.copy(this.freePosition);
    this.camera.lookAt(0, 0, 0);

    this._onKeyDown = (e) => this._handleKeyDown(e);
    this._onKeyUp = (e) => this._handleKeyUp(e);
    this._onMouseDown = (e) => this._handleMouseDown(e);
    this._onMouseUp = (e) => this._handleMouseUp(e);
    this._onMouseMove = (e) => this._handleMouseMove(e);
    this._onWheel = (e) => this._handleWheel(e);

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
    window.addEventListener("mousedown", this._onMouseDown);
    window.addEventListener("mouseup", this._onMouseUp);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("wheel", this._onWheel, { passive: true });
  }

  attachTo(object3D) {
    this.target = object3D;
  }

  _setMode(mode) {
    this.mode = mode;
    if (typeof window !== "undefined") {
      window.__cameraMode = mode; // tell the world (BlockCar) what mode we’re in
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  _handleKeyDown(event) {
    if (event.code === "KeyC") {
      // Toggle follow <-> free
      if (this.mode === "follow") {
        // go to free: start from current camera pose
        this._setMode("free");
        this.freePosition.copy(this.camera.position);

        this.camera.getWorldDirection(this._forward).normalize();
        this.yaw = Math.atan2(this._forward.x, this._forward.z);
        this.pitch = Math.asin(
          THREE.MathUtils.clamp(this._forward.y, -0.999, 0.999)
        );
      } else {
        // back to follow
        this._setMode("follow");
      }
      return;
    }

    this._keys.add(event.code);
  }

  _handleKeyUp(event) {
    this._keys.delete(event.code);
  }

  _handleMouseDown(event) {
    // Allow ANY mouse button / trackpad click to start rotating in free mode
    if (this.mode === "free") {
      this._mouseDown = true;
    }
  }

  _handleMouseUp(event) {
    if (this.mode === "free") {
      this._mouseDown = false;
    }
  }

  _handleMouseMove(event) {
    if (!this._mouseDown || this.mode !== "free") return;

    this.yaw -= event.movementX * this.lookSpeed;
    this.pitch -= event.movementY * this.lookSpeed;

    const maxPitch = Math.PI / 2 - 0.05;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -maxPitch, maxPitch);
  }

  _handleWheel(event) {
    if (this.mode !== "free") return;

    this._forward
      .set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      )
      .normalize();

    const delta = Math.sign(event.deltaY) * 5;
    this.freePosition.addScaledVector(this._forward, delta);
  }

  // ---------------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------------

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // Update per-frame
  // ---------------------------------------------------------------------------

  update(dt = 0.016) {
    if (this.mode === "follow") {
      this._updateFollow(dt);
    } else {
      this._updateFree(dt);
    }
  }

  _updateFollow(dt) {
    if (!this.target) return;

    this.target.getWorldPosition(this._targetPos);
    this.target.getWorldDirection(this._forward).normalize();

    this._camPos
      .copy(this._targetPos)
      .addScaledVector(this._up, this.followHeight)
      .addScaledVector(this._forward, -this.followDistance);

    const lerpFactor = 1 - Math.exp(-this.followLerp * dt);
    this.camera.position.lerp(this._camPos, lerpFactor);

    this._lookAt
      .copy(this._targetPos)
      .addScaledVector(this._up, this.followLookOffset);
    this.camera.lookAt(this._lookAt);

    this.root.position.lerp(this._targetPos, 0.2);
  }

  _updateFree(dt) {
    this._forward
      .set(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      )
      .normalize();

    this._right.crossVectors(this._forward, this._up).normalize();

    const move = new THREE.Vector3();

    if (this._keys.has("KeyW") || this._keys.has("ArrowUp")) {
      move.add(this._forward);
    }
    if (this._keys.has("KeyS") || this._keys.has("ArrowDown")) {
      move.sub(this._forward);
    }
    if (this._keys.has("KeyA") || this._keys.has("ArrowLeft")) {
      move.sub(this._right);
    }
    if (this._keys.has("KeyD") || this._keys.has("ArrowRight")) {
      move.add(this._right);
    }
    if (this._keys.has("Space")) {
      move.add(this._up);
    }
    if (this._keys.has("ShiftLeft") || this._keys.has("ShiftRight")) {
      move.sub(this._up);
    }

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.moveSpeed * dt);
      this.freePosition.add(move);
    }

    this.camera.position.copy(this.freePosition);
    this.camera.lookAt(this.freePosition.clone().add(this._forward));
  }
}
