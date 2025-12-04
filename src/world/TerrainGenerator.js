import * as THREE from "three";

// base terrain height function (low rolling hills)
function baseHeightFn(x, z, amp, fx, fz) {
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
  freqX = 0.12,
  freqZ = 0.16,
} = {}) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const vertexCount = pos.count;

  const colors = new Float32Array(vertexCount * 3);
  const color = new THREE.Color();

  const halfSize = size / 2;
  const mountainWidth = size * 0.18; // width of the border band that becomes mountains
  const mountainAmp = amp * 12; // how tall the border mountains are

  for (let i = 0; i < vertexCount; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);

    // base rolling terrain
    const baseH = baseHeightFn(x, z, amp, freqX, freqZ);

    // distance to nearest edge of the terrain
    const distToEdge = Math.min(halfSize - Math.abs(x), halfSize - Math.abs(z));

    // 0 in the center, 1 near the outer edge of the mountain band
    let edgeFactor =
      1 - THREE.MathUtils.clamp(distToEdge / mountainWidth, 0, 1);

    // ease it with a power curve so it ramps up smoothly
    edgeFactor = Math.pow(edgeFactor, 2.2);

    const mountainH = edgeFactor * mountainAmp;

    const h = baseH + mountainH;
    pos.setY(i, h);

    // simple color gradient by height: sand -> grass -> rock -> snow
    const normalizedH = THREE.MathUtils.clamp(
      (h + mountainAmp * 0.2) / (mountainAmp * 1.4),
      0,
      1
    );

    if (normalizedH < 0.25) {
      // sand
      color.setRGB(0.85, 0.78, 0.62);
    } else if (normalizedH < 0.55) {
      // grass
      color.setRGB(0.25, 0.55, 0.25);
    } else if (normalizedH < 0.8) {
      // rock
      color.setRGB(0.45, 0.45, 0.45);
    } else {
      // snow caps
      color.setRGB(0.95, 0.95, 0.97);
    }

    const ci = i * 3;
    colors[ci] = color.r;
    colors[ci + 1] = color.g;
    colors[ci + 2] = color.b;
  }

  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  // ---------------------------------------------------------------------------
  // Smooth sampling of height & normal (bilinear interpolation)
  // ---------------------------------------------------------------------------

  const step = size / segments;

  function getHeightAndNormal(x, z) {
    const half = size / 2;
    // clamp to terrain bounds (tiny epsilon so we stay inside the last cell)
    const cx = THREE.MathUtils.clamp(x, -half + 0.001, half - 0.001);
    const cz = THREE.MathUtils.clamp(z, -half + 0.001, half - 0.001);

    // grid coordinates in [0, segments]
    const u = (cx + half) / step;
    const v = (cz + half) / step;

    const i0 = Math.floor(u);
    const j0 = Math.floor(v);
    const i1 = Math.min(i0 + 1, segments);
    const j1 = Math.min(j0 + 1, segments);

    const fu = u - i0; // fractional part in x
    const fv = v - j0; // fractional part in z

    const posAttr = geo.attributes.position;
    const nAttr = geo.attributes.normal;

    const index = (ix, iz) => iz * (segments + 1) + ix;

    // sample 4 corners: (i0,j0), (i1,j0), (i0,j1), (i1,j1)
    const i00 = index(i0, j0);
    const i10 = index(i1, j0);
    const i01 = index(i0, j1);
    const i11 = index(i1, j1);

    const h00 = posAttr.getY(i00);
    const h10 = posAttr.getY(i10);
    const h01 = posAttr.getY(i01);
    const h11 = posAttr.getY(i11);

    // bilinear interpolate height
    const w00 = (1 - fu) * (1 - fv);
    const w10 = fu * (1 - fv);
    const w01 = (1 - fu) * fv;
    const w11 = fu * fv;

    const height = h00 * w00 + h10 * w10 + h01 * w01 + h11 * w11;

    // bilinear interpolate normal components
    const nx =
      nAttr.getX(i00) * w00 +
      nAttr.getX(i10) * w10 +
      nAttr.getX(i01) * w01 +
      nAttr.getX(i11) * w11;

    const ny =
      nAttr.getY(i00) * w00 +
      nAttr.getY(i10) * w10 +
      nAttr.getY(i01) * w01 +
      nAttr.getY(i11) * w11;

    const nz =
      nAttr.getZ(i00) * w00 +
      nAttr.getZ(i10) * w10 +
      nAttr.getZ(i01) * w01 +
      nAttr.getZ(i11) * w11;

    const normal = new THREE.Vector3(nx, ny, nz).normalize();

    return { height, normal };
  }

  return { terrainMesh: mesh, getHeightAndNormal };
}
