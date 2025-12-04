import * as THREE from "three";

export class CameraRig {
  constructor(options = {}) {
    this.root = new THREE.Object3D();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.mode = "follow"; // "follow" | "free"
    this.target = null;

<<<<<<< HEAD
    // Terrain height function (set via setTerrainSampler)
    this._getHeightAndNormal = null;

    // Minimum height above terrain
    this.minHeightAboveTerrain = options.minHeightAboveTerrain ?? 1.5;

    // -------------------------------------------------------------------------
    // Cinematic mode
    // -------------------------------------------------------------------------
    this.cinematicMode = false;
    this._cinematicTime = 0;
    this._cinematicPhase = 0;
    this._phaseDuration = 0;
    this._phaseElapsed = 0;

    // Cinematic state targets
    this._cinematic = {
      targetYaw: 0,
      targetPitch: -0.35,
      targetDistance: 10,
      startYaw: 0,
      startPitch: -0.35,
      startDistance: 10,
      // For orbit shots
      orbitSpeed: 0,
      // Easing function for current phase
      easing: (t) => t,
    };

    // Store manual camera state to restore after cinematic
    this._manualState = {
      yaw: 0,
      pitch: -0.35,
      distance: 10,
    };

    window.addEventListener("mousedown", () => {
      this._dragging = true;
      // Exit cinematic mode on user interaction
      if (this.cinematicMode) {
        this.setCinematicMode(false);
      }
    });
    window.addEventListener("mouseup", () => (this._dragging = false));
    window.addEventListener("mousemove", (e) => {
      if (!this._dragging) return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      this.pivot.rotation.y -= dx * 0.003;
      this.pitch.rotation.x = THREE.MathUtils.clamp(
        this.pitch.rotation.x - dy * 0.003,
        -1.2,
        0.2
      );
    });
    window.addEventListener("wheel", (e) => {
      // Exit cinematic mode on scroll
      if (this.cinematicMode) {
        this.setCinematicMode(false);
      }
      this.distance = THREE.MathUtils.clamp(
        this.distance + e.deltaY * 0.002,
        4,
        30
      );
      this.camera.position.z = this.distance;
    });

    this._tmp = new THREE.Vector3();
    this._cameraWorldPos = new THREE.Vector3();
  }

  // ---------------------------------------------------------------------------
  // Cinematic mode controls
  // ---------------------------------------------------------------------------

  setCinematicMode(enabled) {
    if (enabled && !this.cinematicMode) {
      // Store current manual state
      this._manualState.yaw = this.pivot.rotation.y;
      this._manualState.pitch = this.pitch.rotation.x;
      this._manualState.distance = this.distance;

      // Initialize cinematic
      this._cinematicTime = 0;
      this._phaseElapsed = 0;
      this._cinematicPhase = -1; // Will increment to 0 on first update
      this._initNextPhase();
    } else if (!enabled && this.cinematicMode) {
      // Restore manual state smoothly
      this._cinematic.startYaw = this.pivot.rotation.y;
      this._cinematic.startPitch = this.pitch.rotation.x;
      this._cinematic.startDistance = this.distance;
      this._cinematic.targetYaw = this._manualState.yaw;
      this._cinematic.targetPitch = this._manualState.pitch;
      this._cinematic.targetDistance = this._manualState.distance;
    }
    this.cinematicMode = enabled;
  }

  toggleCinematicMode() {
    this.setCinematicMode(!this.cinematicMode);
  }

  _initNextPhase() {
    this._cinematicPhase = (this._cinematicPhase + 1) % 6;
    this._phaseElapsed = 0;

    const c = this._cinematic;
    c.startYaw = this.pivot.rotation.y;
    c.startPitch = this.pitch.rotation.x;
    c.startDistance = this.distance;
    c.orbitSpeed = 0;

    // Different cinematic phases
    switch (this._cinematicPhase) {
      case 0: // Dramatic zoom out + orbit
        this._phaseDuration = 4;
        c.targetDistance = 25;
        c.targetPitch = -0.5;
        c.orbitSpeed = 0.3;
        c.easing = this._easeInOutCubic;
        break;

      case 1: // Close-up chase cam
        this._phaseDuration = 3;
        c.targetDistance = 5;
        c.targetPitch = -0.15;
        c.targetYaw = c.startYaw; // Maintain current angle
        c.orbitSpeed = 0;
        c.easing = this._easeOutQuad;
        break;

      case 2: // Sweeping side view
        this._phaseDuration = 5;
        c.targetDistance = 15;
        c.targetPitch = -0.25;
        c.targetYaw = c.startYaw + Math.PI * 0.75;
        c.orbitSpeed = 0;
        c.easing = this._easeInOutSine;
        break;

      case 3: // High angle overview
        this._phaseDuration = 4;
        c.targetDistance = 20;
        c.targetPitch = -1.0;
        c.targetYaw = c.startYaw + Math.PI * 0.25;
        c.orbitSpeed = 0.15;
        c.easing = this._easeInOutCubic;
        break;

      case 4: // Low angle dramatic
        this._phaseDuration = 3.5;
        c.targetDistance = 8;
        c.targetPitch = 0.1;
        c.targetYaw = c.startYaw - Math.PI * 0.5;
        c.orbitSpeed = -0.2;
        c.easing = this._easeOutCubic;
        break;

      case 5: // Full 360 orbit
        this._phaseDuration = 6;
        c.targetDistance = 12;
        c.targetPitch = -0.4;
        c.orbitSpeed = 0.8;
        c.easing = this._easeInOutSine;
        break;
    }
  }

  _updateCinematic(dt) {
    this._cinematicTime += dt;
    this._phaseElapsed += dt;

    const c = this._cinematic;
    const t = Math.min(this._phaseElapsed / this._phaseDuration, 1);
    const eased = c.easing(t);

    // Interpolate distance and pitch
    this.distance = THREE.MathUtils.lerp(
      c.startDistance,
      c.targetDistance,
      eased
    );
    this.camera.position.z = this.distance;

    this.pitch.rotation.x = THREE.MathUtils.lerp(
      c.startPitch,
      c.targetPitch,
      eased
    );

    // Handle yaw - either orbit or interpolate to target
    if (c.orbitSpeed !== 0) {
      this.pivot.rotation.y += c.orbitSpeed * dt;
    } else if (c.targetYaw !== undefined) {
      this.pivot.rotation.y = THREE.MathUtils.lerp(
        c.startYaw,
        c.targetYaw,
        eased
      );
    }

    // Add subtle breathing motion
    const breathe = Math.sin(this._cinematicTime * 1.5) * 0.02;
    this.pitch.rotation.x += breathe;

    // Transition to next phase
    if (t >= 1) {
      this._initNextPhase();
    }
  }

  // Easing functions
  _easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }

  _easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  _easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
  }

  setTerrainSampler(fn) {
    this._getHeightAndNormal = fn;
=======
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
>>>>>>> main
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

<<<<<<< HEAD
  update(dt) {
    if (!this.target) return;

    // Keep rig at target position
    this.target.getWorldPosition(this._tmp);
    this.root.position.lerp(this._tmp, 0.2);

    // Run cinematic updates if in cinematic mode
    if (this.cinematicMode) {
      this._updateCinematic(dt);
    }

    // Clamp camera above terrain (works in both modes)
    this._clampCameraAboveTerrain();
  }

  _clampCameraAboveTerrain() {
    if (!this._getHeightAndNormal) return;

    // Get camera's world position
    this.camera.getWorldPosition(this._cameraWorldPos);

    const camX = this._cameraWorldPos.x;
    const camY = this._cameraWorldPos.y;
    const camZ = this._cameraWorldPos.z;

    // Sample terrain height at camera's XZ position
    const { height: terrainHeight } = this._getHeightAndNormal(camX, camZ);
    const minY = terrainHeight + this.minHeightAboveTerrain;

    // If camera is below minimum height, adjust the pitch to bring it up
    if (camY < minY) {
      // Calculate how much we need to raise the camera
      const deficit = minY - camY;

      // Adjust pitch rotation to raise camera
      const pitchAdjustment = Math.min(deficit * 0.05, 0.02);
      this.pitch.rotation.x = THREE.MathUtils.clamp(
        this.pitch.rotation.x - pitchAdjustment,
        -1.2,
        0.2
      );

      // If pitch adjustment alone isn't enough (at max pitch), reduce distance
      this.camera.getWorldPosition(this._cameraWorldPos);
      if (this._cameraWorldPos.y < minY && this.pitch.rotation.x <= -1.19) {
        // Reduce distance to pull camera closer and higher
        this.distance = Math.max(4, this.distance - 0.1);
        this.camera.position.z = this.distance;
      }
    }
=======
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
>>>>>>> main
  }
}
