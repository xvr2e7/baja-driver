// terrainTrees.js
import * as THREE from "three";


export function addTrees(
  scene,
  terrainMesh,
  getHeightAndNormal,
  {
    count = 60,
    terrainSize = 400,
    avoidRadius = 8,
    minScale = 1.2,
    maxScale = 1.9,
    trunkColor = 0x5b3a29,
    leafColor = 0x1f7a2f,
    avoidSteep = 0.8,
    clusters = { enabled: false, n: 8, radius: 10 },
  } = {}
) {
  // infer terrain size like rock code

  const size = terrainSize;
  const half = size / 2;

  const group = new THREE.Group();
  group.name = "trees";

  // simple reusable geometries & materials
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.22, 1.6, 8);
  trunkGeo.translate(0, 0.8, 0); // base at y=0
  const trunkMat = new THREE.MeshStandardMaterial({ color: trunkColor, roughness: 0.95 });

  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.8 });

  // helper: sample point in circle
  function samplePointInCircle(cx, cz, r) {
    const t = 2 * Math.PI * Math.random();
    const u = Math.random() + Math.random();
    const rad = u > 1 ? 2 - u : u;
    return { x: cx + Math.cos(t) * rad * r, z: cz + Math.sin(t) * rad * r };
  }

  // optional cluster centers
  let clusterCenters = null;
  if (clusters && clusters.enabled) {
    clusterCenters = [];
    for (let i = 0; i < clusters.n; i++) {
      clusterCenters.push({
        x: (Math.random() - 0.5) * size,
        z: (Math.random() - 0.5) * size,
      });
    }
  }

  let placed = 0;
  let attempts = 0;
  const maxAttempts = Math.max(500, count * 20);
  while (placed < count && attempts < maxAttempts) {
    attempts++;

    // pick sample XY (clustered or uniform)
    let x, z;
    if (clusterCenters) {
      const cc = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
      const pt = samplePointInCircle(cc.x, cc.z, clusters.radius);
      x = pt.x;
      z = pt.z;
    } else {
      x = (Math.random() - 0.5) * size;
      z = (Math.random() - 0.5) * size;
    }

    // avoid outside bounds
    if (x < -half + 0.001 || x > half - 0.001 || z < -half + 0.001 || z > half - 0.001) continue;

    // avoid spawn center (where car likely starts)
    if (Math.hypot(x, z) < avoidRadius && Math.random() > 0.15) continue;

    const s = getHeightAndNormal(x, z);
    if (!s) continue;
    const n = s.normal.clone().normalize();

    // reject steep slopes
    if (n.y < avoidSteep) {
      // give small chance to place on sloping ground for variety
      if (Math.random() > 0.12) continue;
    }

    // create a tree group
    const tree = new THREE.Group();

    // random scale for height
    const scale = THREE.MathUtils.lerp(minScale, maxScale, Math.random());

    // trunk
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.castShadow = true;
    trunk.receiveShadow = false;
    trunk.scale.setScalar(scale);
    tree.add(trunk);

    // leaves: 2 or 3 stacked cones (slightly varied)
    const cones = 4;
    for (let c = 0; c < cones; c++) {
      const h = 1.2 * scale * (0.6 - c * 0.12);
      const rad = 0.9 * scale * (1 - c * 0.12);
      const coneGeo = new THREE.ConeGeometry(rad, h, 10);
      coneGeo.translate(0, (0.2 + c * 0.25) * scale + 0.6 * scale, 0);
      const cone = new THREE.Mesh(coneGeo, leafMat);
      cone.castShadow = true;
      tree.add(cone);
    }

    // position slighty sunk to avoid floating
    const posY = s.height + 0.02; // small lift so trunk base isn't buried too deep
    tree.position.set(x, posY, z);

    // align up to terrain normal and random yaw
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, n);
    const yaw = (Math.random() - 0.5) * Math.PI * 2;
    q.multiply(new THREE.Quaternion().setFromAxisAngle(n, yaw));
    tree.quaternion.copy(q);

    // small random rotation/scale jitter
    tree.scale.multiplyScalar(0.9 + Math.random() * 0.4);

    group.add(tree);
    placed++;
  }

  scene.add(group);
  return group;
}
