import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { setupRenderer } from "./rendering/RendererSetup.js";
import { setupLighting } from "./rendering/LightingManager.js";
import { createTerrain } from "./world/TerrainGenerator.js";
import {addRocks} from "./world/rocks.js";
import { addTrees } from "./world/trees.js";
import { CameraRig } from "./rendering/CameraController.js";
import { BlockCar } from "./physics/VehicleDynamics.js";
import { buildRockColliders, buildTreeColliders, resolveCarCollisions,  } from "./physics/collision.js";


// ---------------------------------------------------------------------------
// Scene & renderer
// ---------------------------------------------------------------------------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = setupRenderer(document.querySelector("#app"));

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


const trees = addTrees(scene, terrainMesh, getHeightAndNormal, {
  count: 60,
  avoidRadius: 10,
  minScale: 1.2,
  maxScale: 1.9,
  clusters: { enabled: true, n: 10, radius: 12 },
});
const treeColliders = buildTreeColliders(trees, { baseRadius: 1.2 });

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

mtlLoader.load("/models/WombatTyphoon.mtl", (materials) => {
  materials.preload();
  objLoader.setMaterials(materials);

  objLoader.load(
    "/models/WombatTyphoon.obj",

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
  car.update(dt, getHeightAndNormal);
  
  resolveCarCollisions(car, rockColliders, treeColliders,
  {restitution: 0.45,
  friction: 0.7,
  carRadiusFactor: 0.6,
  breakThreshold: 6.5,
  debug: false});

  cameraRig.update(dt);

  renderer.render(scene, cameraRig.camera);
}

animate();
