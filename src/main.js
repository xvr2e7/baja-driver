import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { setupRenderer } from "./rendering/RendererSetup.js";
import { LightingManager } from "./rendering/LightingManager.js";
import { createTerrain } from "./world/TerrainGenerator.js";
import { CameraRig } from "./rendering/CameraController.js";
import { BlockCar } from "./physics/VehicleDynamics.js";

// ---------------------------------------------------------------------------
// Scene & renderer
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = setupRenderer(document.querySelector("#app"));

// Enable VSM shadows for softer look
renderer.shadowMap.type = THREE.VSMShadowMap;

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

const { terrainMesh, getHeightAndNormal } = createTerrain({
  size: 400,
  segments: 200,
  amp: 2.2,
  freqX: 0.12,
  freqZ: 0.16,
});

terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

// ---------------------------------------------------------------------------
// Lighting with day/night cycle
// ---------------------------------------------------------------------------

const lighting = new LightingManager(scene, {
  cycleSpeed: 0.015, // Adjust for faster/slower day-night cycle
  startTime: 0.45, // Start near noon
});

// ---------------------------------------------------------------------------
// Physics car
// ---------------------------------------------------------------------------

const car = new BlockCar({
  width: 2,
  height: 1,
  length: 3,
  start: new THREE.Vector3(0, 10, 0),
});

scene.add(car.mesh);

// Hide the blue block but keep it for physics
car.mesh.traverse((child) => {
  if (child.isMesh) {
    child.material.transparent = true;
    child.material.opacity = 0.0;
    child.material.depthWrite = false;
  }
});

// Add headlights to the car
lighting.createCarHeadlights(car.mesh);

const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();

mtlLoader.load("/models/Car.mtl", (materials) => {
  materials.preload();
  objLoader.setMaterials(materials);

  objLoader.load(
    "/models/Car.obj",

    (object) => {
      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Adjust the wombat model so it sits nicely on the car
      object.scale.set(0.6, 0.6, 0.6);
      object.position.set(0, -0.5, 0);
      object.rotation.y = Math.PI;

      // Attach the wombat visual mesh to the car's physics body
      car.mesh.add(object);
    }
  );
});

// ---------------------------------------------------------------------------
// Camera rig
// ---------------------------------------------------------------------------

const cameraRig = new CameraRig({
  minHeightAboveTerrain: 1.5, // Camera stays at least 1.5 units above ground
});
scene.add(cameraRig.root);
cameraRig.attachTo(car.mesh);

// Connect terrain height sampling to camera
cameraRig.setTerrainSampler(getHeightAndNormal);

// ---------------------------------------------------------------------------
// Time control UI ( press T to toggle time display, +/- to adjust)
// ---------------------------------------------------------------------------

let showTime = false;
const timeDisplay = document.createElement("div");
timeDisplay.style.cssText = `
  position: fixed;
  top: 10px;
  left: 10px;
  color: white;
  font-family: monospace;
  font-size: 14px;
  background: rgba(0,0,0,0.5);
  padding: 8px 12px;
  border-radius: 4px;
  display: none;
  z-index: 1000;
`;
document.body.appendChild(timeDisplay);

window.addEventListener("keydown", (e) => {
  if (e.key === "t" || e.key === "T") {
    showTime = !showTime;
    timeDisplay.style.display = showTime ? "block" : "none";
  }
  if (e.key === "=" || e.key === "+") {
    lighting.setTimeOfDay(lighting.timeOfDay + 0.02);
  }
  if (e.key === "-" || e.key === "_") {
    lighting.setTimeOfDay(lighting.timeOfDay - 0.02);
  }
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

addEventListener("resize", () => {
  cameraRig.onResize();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(0.033, clock.getDelta());

  car.update(dt, getHeightAndNormal);
  cameraRig.update(dt);
  lighting.update(dt);

  // Update time display
  if (showTime) {
    timeDisplay.textContent = `Time: ${lighting.getTimeString()} | Press +/- to adjust`;
  }

  renderer.render(scene, cameraRig.camera);
}

animate();
