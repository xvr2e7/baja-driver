import * as THREE from "three";
import { setupRenderer } from "./rendering/RendererSetup.js";
import { setupLighting } from "./rendering/LightingManager.js";
import { createTerrain } from "./world/TerrainGenerator.js";
import { CameraRig } from "./rendering/CameraController.js";
import { BlockCar } from "./physics/VehicleDynamics.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = setupRenderer(document.querySelector("#app"));

const { terrainMesh, getHeightAndNormal } = createTerrain({
  size: 400, // world size (x,z)
  segments: 200, // grid resolution
  amp: 2.2, // bump amplitude
  freqX: 0.12,
  freqZ: 0.16,
});
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

const lights = setupLighting(scene);

// block “car”
const car = new BlockCar({
  width: 2,
  height: 1,
  length: 3,
  start: new THREE.Vector3(0, 10, 0), // start above ground; it will settle on first update
});
scene.add(car.mesh);

// camera
const cameraRig = new CameraRig();
scene.add(cameraRig.root);
cameraRig.attachTo(car.mesh); // follow target

// resize
addEventListener("resize", () => {
  cameraRig.onResize();
  renderer.setSize(innerWidth, innerHeight);
});

// main loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  car.update(dt, getHeightAndNormal);
  cameraRig.update(dt);

  renderer.render(scene, cameraRig.camera);
}
animate();
