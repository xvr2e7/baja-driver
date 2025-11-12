import * as THREE from "three";

export function setupLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xffffff, 0x554433, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(60, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 120;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 300;
  scene.add(sun);

  return { hemi, sun };
}
