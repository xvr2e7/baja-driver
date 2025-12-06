import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { setupRenderer } from "./rendering/RendererSetup.js";
import { LightingManager } from "./rendering/LightingManager.js";
import { createTerrain } from "./world/TerrainGenerator.js";
import { CameraRig } from "./rendering/CameraController.js";
import { BlockCar } from "./physics/VehicleDynamics.js";
import { addRocks } from "./world/rocks.js";
import {
  buildRockColliders,
  resolveCarCollisions,
} from "./physics/collision.js";
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

const TERRAIN_SIZE = 400;

const { terrainMesh, getHeightAndNormal } = createTerrain({
  size: TERRAIN_SIZE,
  segments: 200,
  amp: 2.2,
  freqX: 0.12,
  freqZ: 0.16,
});

terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

//prcedule rocks
const rocks = addRocks(scene, terrainMesh, getHeightAndNormal, {
  count: 300,
  minScale: 0.25,
  maxScale: 1.2,
  color: 0x6a5a48,
  avoidRadius: 10,
  avoidSteep: 0.55,
  cluster: { enabled: true, clusters: 12, clusterRadius: 10 },
});
const rockColliders = buildRockColliders(rocks, {
  baseRadius: 0.9,
  breakable: false,
});

// ---------------------------------------------------------------------------
// Obstacles (Palm Trees)
// ---------------------------------------------------------------------------

const obstacles = [];

// separate loaders for palm trees, so we don't interfere with car loaders
const palmMtlLoader = new MTLLoader();
const palmObjLoader = new OBJLoader();

// how many trees to spawn
const TREE_COUNT = 60;
// keep a margin from the very edge so they don't float off cliffs
const EDGE_MARGIN = 30;

palmMtlLoader.load("/models/PalmTree.mtl", (materials) => {
  materials.preload();
  palmObjLoader.setMaterials(materials);

  for (let i = 0; i < TREE_COUNT; i++) {
    // random X/Z within the terrain bounds, with a margin
    const x = (Math.random() - 0.5) * (TERRAIN_SIZE - 2 * EDGE_MARGIN);
    const z = (Math.random() - 0.5) * (TERRAIN_SIZE - 2 * EDGE_MARGIN);

    const { height } = getHeightAndNormal(x, z);

    // group acts as the obstacle for physics
    const palm = new THREE.Group();
    palm.position.set(x, height, z);

    // smaller physics radius to match a thinner trunk
    palm.userData.radius = 1.2;

    scene.add(palm);
    obstacles.push(palm);

    // load the visual palm tree model and attach to the group
    palmObjLoader.load("/models/PalmTree.obj", (object) => {
      object.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // slightly smaller trees
      object.scale.set(0.9, 0.9, 0.9);
      object.position.set(0, 0, 0);

      palm.add(object);
    });
  }
});

// ---------------------------------------------------------------------------
// Lighting with day/night cycle
// ---------------------------------------------------------------------------

const lighting = new LightingManager(scene, {
  cycleSpeed: 0.015,
  startTime: 0.45,
});

// ---------------------------------------------------------------------------
// Physics car
// ---------------------------------------------------------------------------
const listener1 = new THREE.AudioListener();
const car = new BlockCar({
  width: 2,
  height: 1,
  length: 3,
  start: new THREE.Vector3(0, 10, 0),
  audioListener: listener1,
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

const listener = new THREE.AudioListener();
car.mesh.add(listener);
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load("/models/car-straring-sound-126708.mp3", function (buffer) {
  sound.setBuffer(buffer);
  sound.setLoop(false);
  sound.setVolume(0.5);
  sound.play();
});

mtlLoader.load("/models/Car.mtl", (materials) => {
  materials.preload();
  objLoader.setMaterials(materials);

  objLoader.load("/models/Car.obj", (object) => {
    object.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    // Adjust the car model so it sits nicely on the block
    object.scale.set(0.6, 0.6, 0.6);
    object.position.set(0, -0.5, 0);
    object.rotation.y = 0;

    car.mesh.add(object);
  });
});

// ---------------------------------------------------------------------------
// Camera rig
// ---------------------------------------------------------------------------

const cameraRig = new CameraRig({
  minHeightAboveTerrain: 1.5, // Camera stays at least 1.5 units above ground
  getHeightAndNormal: getHeightAndNormal,
});
scene.add(cameraRig.root);
cameraRig.attachTo(car.mesh);

// ---------------------------------------------------------------------------
// Control UI
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

// Controls help (hidden by default, press ? to show)
const controlsHelp = document.createElement("div");
controlsHelp.style.cssText = `
  position: fixed;
  bottom: 10px;
  right: 10px;
  color: white;
  font-family: monospace;
  font-size: 12px;
  background: rgba(0,0,0,0.5);
  padding: 8px 12px;
  border-radius: 4px;
  z-index: 1000;
  line-height: 1.6;
  display: none;
`;
controlsHelp.innerHTML = `
  C — Toggle camera mode<br>
  T — Time display<br>
  Space — Pause/unpause day/night cycle<br>
  +/- — Adjust time<br>
  Mouse — Rotate camera (manual mode)<br>
  Scroll — Zoom (manual mode)<br>
  ? — Hide controls
`;
document.body.appendChild(controlsHelp);

const helpHint = document.createElement("div");
helpHint.style.cssText = `
  position: fixed;
  bottom: 10px;
  right: 10px;
  color: white;
  font-family: monospace;
  font-size: 12px;
  background: rgba(0,0,0,0.5);
  padding: 6px 10px;
  border-radius: 4px;
  z-index: 1000;
`;
helpHint.textContent = "? — Help";
document.body.appendChild(helpHint);

window.addEventListener("keydown", (e) => {
  if (e.key === "r" || e.key === "R") {
    cameraRig.toggleCameraMode();
    cameraModeIndicator.textContent =
      cameraRig.cameraMode === "follow" ? "Camera: Follow" : "Camera: Manual";
  }
  if (e.key === "t" || e.key === "T") {
    showTime = !showTime;
    timeDisplay.style.display = showTime ? "block" : "none";
  }
  if (e.key === " ") {
    e.preventDefault();
    lighting.togglePause();
  }
  if (e.key === "=" || e.key === "+") {
    lighting.setTimeOfDay(lighting.timeOfDay + 0.02);
  }
  if (e.key === "-" || e.key === "_") {
    lighting.setTimeOfDay(lighting.timeOfDay - 0.02);
  }
  if (e.key === "?" || e.key === "/") {
    const isVisible = controlsHelp.style.display !== "none";
    controlsHelp.style.display = isVisible ? "none" : "block";
    helpHint.style.display = isVisible ? "block" : "none";
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
  // pass obstacles into the physics update
  car.update(dt, getHeightAndNormal, obstacles);
  cameraRig.update(dt);
  lighting.update(dt);

  resolveCarCollisions(car, rockColliders, null, {
    restitution: 0.45,
    friction: 0.7,
    carRadiusFactor: 0.6,
    breakThreshold: 6.5,
    debug: false,
  });

  if (showTime) {
    timeDisplay.textContent = `Time: ${lighting.getTimeString()} | Press +/- to adjust`;
  }

  renderer.render(scene, cameraRig.camera);
}

animate();
