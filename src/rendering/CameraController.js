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

    this._getHeightAndNormal = null;

    // Minimum height above terrain
    this.minHeightAboveTerrain = options.minHeightAboveTerrain ?? 1.5;

    window.addEventListener("mousedown", () => (this._dragging = true));
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

  update() {
    if (!this.target) return;

    // Keep rig at target position
    this.target.getWorldPosition(this._tmp);
    this.root.position.lerp(this._tmp, 0.2);

    // Clamp camera above terrain
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
