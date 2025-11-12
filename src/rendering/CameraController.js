import * as THREE from "three";

export class CameraRig {
  constructor() {
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
    // keep rig at target position
    this.target.getWorldPosition(this._tmp);
    this.root.position.lerp(this._tmp, 0.2);
  }
}
