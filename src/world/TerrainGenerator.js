import * as THREE from "three";

// simple deterministic height function (no external noise lib)
function heightFn(x, z, amp, fx, fz) {
  return (
    amp *
    (Math.sin(x * fx) * 0.6 +
      Math.cos(z * fz) * 0.4 +
      Math.sin((x + z) * 0.08) * 0.3)
  );
}

export function createTerrain({
  size = 400,
  segments = 200,
  amp = 2,
  freqX = 0.1,
  freqZ = 0.1,
} = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  // displace vertices
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightFn(x, z, amp, freqX, freqZ);
    pos.setY(i, h);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xc2b280,
    roughness: 0.95,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // helper for sampling height & normal at arbitrary (x,z) by barycentric lookup
  // we’ll do a quick approximate sample by nearest vertex (fast & simple for demo)
  const half = size / 2;
  const step = size / segments;

  function getHeightAndNormal(x, z) {
    // clamp to terrain bounds
    const cx = THREE.MathUtils.clamp(x, -half + 0.001, half - 0.001);
    const cz = THREE.MathUtils.clamp(z, -half + 0.001, half - 0.001);

    const ix = Math.round((cx + half) / step);
    const iz = Math.round((cz + half) / step);

    const index = iz * (segments + 1) + ix;
    const h = pos.getY(index);

    // compute normal from geometry normal buffer
    const nAttr = geo.attributes.normal;
    const nx = nAttr.getX(index);
    const ny = nAttr.getY(index);
    const nz = nAttr.getZ(index);
    const normal = new THREE.Vector3(nx, ny, nz).normalize();

    return { height: h, normal };
  }

  return { terrainMesh: mesh, getHeightAndNormal };
}
