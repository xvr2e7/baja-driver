import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { setupRenderer } from "./rendering/RendererSetup.js";
import { setupLighting } from "./rendering/LightingManager.js";
import { createTerrain } from "./world/TerrainGenerator.js";
import { CameraRig } from "./rendering/CameraController.js";
import { BlockCar } from "./physics/VehicleDynamics.js";
import {addRocks} from "./world/rocks.js";
import { buildRockColliders, resolveCarCollisions,  } from "./physics/collision.js";
// ---------------------------------------------------------------------------
// Scene & renderer
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = setupRenderer(document.querySelector("#app"));

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
  cluster: { enabled: true, clusters: 12, clusterRadius: 10 }
});
const rockColliders = buildRockColliders(rocks, { baseRadius: 0.9, breakable: false });

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
// Lighting
// ---------------------------------------------------------------------------

setupLighting(scene);

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

const mtlLoader = new MTLLoader();
const objLoader = new OBJLoader();

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

const cameraRig = new CameraRig();
scene.add(cameraRig.root);
cameraRig.attachTo(car.mesh);

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
  resolveCarCollisions(car, rockColliders, null,
  {restitution: 0.45,
  friction: 0.7,
  carRadiusFactor: 0.6,
  breakThreshold: 6.5,
  debug: false});

  renderer.render(scene, cameraRig.camera);
}

animate();
