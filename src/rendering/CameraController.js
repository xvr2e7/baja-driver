import * as THREE from "three";

export class CameraRig {
  constructor(options = {}) {
    this.root = new THREE.Object3D();
    this.pivot = new THREE.Object3D(); // yaw
    this.pitch = new THREE.Object3D(); // pitch
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.root.add(this.pivot);
    this.pivot.add(this.pitch);
    this.pitch.add(this.camera);

    this.distance = 10;
    this.pitch.rotation.x = -0.35;
    this.camera.position.set(0, 0, this.distance);

    this.target = null;
    this._mouse = new THREE.Vector2();
    this._dragging = false;

    // Terrain height function (set via setTerrainSampler)
    this._getHeightAndNormal = null;

    // Minimum height above terrain
    this.minHeightAboveTerrain = options.minHeightAboveTerrain ?? 1.5;

    // -------------------------------------------------------------------------
    // Camera mode: 'follow' (default) or 'manual'
    // -------------------------------------------------------------------------
    this.cameraMode = "follow"; // Default is follow mode
    this._savedManualYaw = 0;
    this._savedManualPitch = -0.35;
    this._savedManualDistance = 10;

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
      // Only allow dragging in manual mode
      if (this.cameraMode === "manual") {
        this._dragging = true;
      }
      // Exit cinematic mode on user interaction
      if (this.cinematicMode) {
        this.setCinematicMode(false);
      }
    });
    window.addEventListener("mouseup", () => (this._dragging = false));
    window.addEventListener("mousemove", (e) => {
      if (!this._dragging || this.cameraMode !== "manual") return;
      const dx = e.movementX || 0;
      const dy = e.movementY || 0;
      this.pivot.rotation.y -= dx * 0.003;
      this.pitch.rotation.x = THREE.MathUtils.clamp(
        this.pitch.rotation.x - dy * 0.003,
        -1.2,
        0.2
      );
      // Save the manual camera state
      this._savedManualYaw = this.pivot.rotation.y;
      this._savedManualPitch = this.pitch.rotation.x;
    });
    window.addEventListener("wheel", (e) => {
      // Only allow zoom in manual mode
      if (this.cameraMode !== "manual") return;
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
      // Save the manual camera state
      this._savedManualDistance = this.distance;
    });

    this._tmp = new THREE.Vector3();
    this._cameraWorldPos = new THREE.Vector3();
  }

  // ---------------------------------------------------------------------------
  // Camera mode controls (follow vs manual)
  // ---------------------------------------------------------------------------

  toggleCameraMode() {
    if (this.cameraMode === "follow") {
      // Switch to manual mode - restore saved manual camera position
      this.cameraMode = "manual";
      this.pivot.rotation.y = this._savedManualYaw;
      this.pitch.rotation.x = this._savedManualPitch;
      this.distance = this._savedManualDistance;
      this.camera.position.z = this.distance;
    } else {
      // Switch to follow mode - save current manual position first
      this._savedManualYaw = this.pivot.rotation.y;
      this._savedManualPitch = this.pitch.rotation.x;
      this._savedManualDistance = this.distance;
      this.cameraMode = "follow";
      // Reset to default follow position
      this.pivot.rotation.y = 0;
      this.pitch.rotation.x = -0.35;
      this.distance = 10;
      this.camera.position.z = this.distance;
    }
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
  }

  attachTo(object3D) {
    this.target = object3D;
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.target) return;

    // Keep rig at target position
    this.target.getWorldPosition(this._tmp);
    this.root.position.lerp(this._tmp, 0.2);

    // In follow mode, maintain strict camera position behind the car
    if (this.cameraMode === "follow" && !this.cinematicMode) {
      // Match the car's rotation (yaw)
      this.pivot.rotation.y = this.target.rotation.y;
      // Keep fixed pitch and distance
      this.pitch.rotation.x = -0.35;
      this.distance = 10;
      this.camera.position.z = this.distance;
    }

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
  }
}
