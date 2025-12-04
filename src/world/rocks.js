// addRocks_reliable.js
import * as THREE from "three";

/**
 * addRocksReliable(scene, terrainMesh, getHeightAndNormal, opts)
 * Returns the InstancedMesh (always) and ensures matrices are set.
 */
export function addRocks(scene, terrainMesh, getHeightAndNormal, {
  count = 300,
  minScale = 0.18,
  maxScale = 1.1,
  color = 0x6d5b4a,
  avoidSteep = 0.55,
  avoidRadius = 8,          // clear area around origin (car spawn)
  cluster = { enabled: false, clusters: 8, clusterRadius: 8 },
  jitterVertex = false,
} = {}) {
  
  const terrainSize = 400;
  const half = terrainSize / 2;

  const baseGeo = new THREE.IcosahedronGeometry(1, 1);
  if (jitterVertex) {
    const pos = baseGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const rx = 1 + (Math.random() - 0.5) * 0.28;
      const ry = 1 + (Math.random() - 0.5) * 0.28;
      const rz = 1 + (Math.random() - 0.5) * 0.28;
      pos.setXYZ(i, pos.getX(i) * rx, pos.getY(i) * ry, pos.getZ(i) * rz);
    }
    baseGeo.computeVertexNormals();
  }

  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.03 });
  const inst = new THREE.InstancedMesh(baseGeo, mat, count);
  inst.castShadow = true; inst.receiveShadow = true;

  // optional clustering centers
  let clusterCenters = null;
  if (cluster && cluster.enabled) {
    clusterCenters = [];
    for (let i = 0; i < cluster.clusters; i++) {
      clusterCenters.push({
        x: (Math.random() - 0.5) * terrainSize,
        z: (Math.random() - 0.5) * terrainSize,
      });
    }
  }

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    let placed = false, tries = 0;
    while (!placed && tries++ < 32) {
      let x, z;
      if (clusterCenters) {
        const cc = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
        const t = 2 * Math.PI * Math.random();
        const u = Math.random() + Math.random(); const r = u > 1 ? 2 - u : u;
        x = cc.x + Math.cos(t) * r * cluster.clusterRadius;
        z = cc.z + Math.sin(t) * r * cluster.clusterRadius;
      } else {
        x = (Math.random() - 0.5) * terrainSize;
        z = (Math.random() - 0.5) * terrainSize;
      }

      // avoid spawn radius
      if (Math.hypot(x, z) < avoidRadius) continue;
      if (x < -half + 0.001 || x > half - 0.001 || z < -half + 0.001 || z > half - 0.001) continue;

      const s = getHeightAndNormal(x, z);
      if (!s) continue;
      const n = s.normal.clone().normalize();
      if (n.y < avoidSteep && Math.random() > 0.6) continue;

      // place and orient
      const y = s.height - (0.02 + Math.random() * 0.06);
      dummy.position.set(x, y, z);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), n);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(n, Math.random() * Math.PI * 2));
      dummy.quaternion.copy(q);
      const sScale = THREE.MathUtils.lerp(minScale, maxScale, Math.random()) * (0.85 + Math.random() * 0.6);
      dummy.scale.setScalar(sScale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix); // set matrix for this instance (crucial)
      placed = true;
    }
    if (!placed) {
      dummy.position.set((Math.random()-0.5)*4, 0.1, (Math.random()-0.5)*4);
      dummy.scale.setScalar(minScale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
  }

  // finalize instance matrices and add to scene
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  // ensure matrixWorld is up-to-date
  inst.updateMatrixWorld(true);

  return inst;
}