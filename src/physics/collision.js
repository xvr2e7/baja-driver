// collision_helpers_reliable.js
import * as THREE from "three";

function _getInstanceCount(inst) {
  if (!inst) return 0;
  if (typeof inst.count === "number") return inst.count;
  if (inst.instanceMatrix && typeof inst.instanceMatrix.count === "number") return inst.instanceMatrix.count;
  if (inst.instanceMatrix && inst.instanceMatrix.array) return Math.floor(inst.instanceMatrix.array.length / 16);
  return 0;
}

/**
 * buildRockColliders(instOrGroup, opts)
 * - Accepts InstancedMesh / Group / Mesh
 * - Returns array of colliders with pos (world) and radius. For instanced colliders instanceId is set.
 */
export function buildRockColliders(instOrGroup, { baseRadius = 1.0, breakable = true } = {}) {
  const colliders = [];
  if (!instOrGroup) return colliders;
  const tmpMat = new THREE.Matrix4();
  const worldMat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  try {
    if (typeof instOrGroup.getMatrixAt === "function") {
      const inst = instOrGroup;
      inst.updateMatrixWorld(true);
      worldMat.copy(inst.matrixWorld);
      const count = _getInstanceCount(inst);
      for (let i = 0; i < count; i++) {
        try {
          inst.getMatrixAt(i, tmpMat);            // instance -> object space
          tmpMat.premultiply(worldMat);           // now instance in world space
          tmpMat.decompose(pos, quat, scale);
          const smax = Math.max(Math.abs(scale.x || 1), Math.abs(scale.y || 1), Math.abs(scale.z || 1));
          const r = Math.max(0.01, baseRadius * smax);
          colliders.push({
            pos: pos.clone(),
            radius: r,
            baseRadius,
            instanceId: i,   // IMPORTANT: set instance index
            inst,
            breakable: !!breakable,
            broken: false,
            lastDist: Infinity,
          });
        } catch (err) {
          console.warn("buildRockColliders: getMatrixAt failed for index", i, err);
        }
      }
      return colliders;
    }

    if (instOrGroup.children && instOrGroup.children.length > 0) {
      instOrGroup.updateMatrixWorld(true);
      for (let i = 0; i < instOrGroup.children.length; i++) {
        const child = instOrGroup.children[i];
        child.getWorldPosition(pos);
        child.getWorldScale(scale);
        const smax = Math.max(Math.abs(scale.x||1), Math.abs(scale.y||1), Math.abs(scale.z||1));
        colliders.push({
          pos: pos.clone(),
          radius: Math.max(0.01, baseRadius * smax),
          baseRadius,
          mesh: child,
          breakable: false,
          broken: false,
          lastDist: Infinity,
        });
      }
      return colliders;
    }

    if (instOrGroup.isMesh || instOrGroup.type === "Mesh") {
      const mesh = instOrGroup;
      mesh.updateMatrixWorld(true);
      mesh.getWorldPosition(pos);
      mesh.getWorldScale(scale);
      const smax = Math.max(Math.abs(scale.x||1), Math.abs(scale.y||1), Math.abs(scale.z||1));
      colliders.push({
        pos: pos.clone(),
        radius: Math.max(0.01, baseRadius * smax),
        baseRadius,
        mesh,
        breakable: false,
        broken: false,
        lastDist: Infinity,
      });
      return colliders;
    }
  } catch (err) {
    console.error("buildRockColliders: unexpected error", err);
    return colliders;
  }

  return colliders;
}

export function updateRockCollidersWorldPositions(colliders) {
  if (!Array.isArray(colliders)) return;
  const tmpMat = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (!c) continue;
    try {
      if (c.inst && typeof c.instanceId === "number") {
        c.inst.getMatrixAt(c.instanceId, tmpMat);
        c.inst.updateMatrixWorld(true);
        tmpMat.premultiply(c.inst.matrixWorld);
        tmpMat.decompose(pos, quat, scale);
        c.pos.copy(pos);
        const smax = Math.max(Math.abs(scale.x||1), Math.abs(scale.y||1), Math.abs(scale.z||1));
        c.radius = Math.max(0.01, (c.baseRadius || 1.0) * smax);
      } else if (c.mesh) {
        c.mesh.getWorldPosition(c.pos);
        const sc = new THREE.Vector3();
        c.mesh.getWorldScale(sc);
        const smax = Math.max(Math.abs(sc.x||1), Math.abs(sc.y||1), Math.abs(sc.z||1));
        c.radius = Math.max(0.01, (c.baseRadius || 1.0) * smax);
      }
    } catch (err) {
      console.warn("updateRockCollidersWorldPositions: failed for collider", i, err);
    }
  }
}


/**
 * Build tree colliders from a Group of tree children.
 * If you later move the group, call updateTreeCollidersPositions().
 */
export function buildTreeColliders(treeGroup, { baseRadius = 1.0 } = {}) {
  const colliders = [];
  if (!treeGroup || !Array.isArray(treeGroup.children)) return colliders;
  for (let i = 0; i < treeGroup.children.length; i++) {
    try {
      const child = treeGroup.children[i];
      const pos = new THREE.Vector3();
      child.getWorldPosition(pos);
      const scale = new THREE.Vector3();
      child.getWorldScale(scale);
      const r = baseRadius * Math.max(Math.abs(scale.x || 1), Math.abs(scale.y || 1), Math.abs(scale.z || 1));
      colliders.push({
        pos: pos.clone(),
        radius: Math.max(0.05, r),
        mesh: child,
        breakable: false,
        broken: false,
        lastDist: Infinity,
      });
    } catch (err) {
      console.warn("buildTreeColliders: failed for child", i, err);
    }
  }
  return colliders;
}

export function updateTreeCollidersPositions(treeColliders) {
  if (!Array.isArray(treeColliders)) return;
  for (let i = 0; i < treeColliders.length; i++) {
    const c = treeColliders[i];
    try {
      if (!c || !c.mesh) continue;
      c.mesh.getWorldPosition(c.pos);
      const scale = new THREE.Vector3();
      c.mesh.getWorldScale(scale);
      c.radius = Math.max(0.05, c.radius * Math.max(Math.abs(scale.x || 1), Math.abs(scale.y || 1), Math.abs(scale.z || 1)));
    } catch (err) {
      console.warn("updateTreeCollidersPositions: failed for collider", i, err);
    }
  }
}

/**
 * Resolve collisions and optionally return true if any collision occurred.
 * - returns { any: boolean, hits: number }
 */
export function resolveCarCollisions(car, rockColliders = [], treeColliders = [], options = {}) {
  const { restitution = 0.45, friction = 0.6, carRadiusFactor = 0.7, breakThreshold = 6.0, debug = false } = options;
  try {
    if (!car || !car.mesh) return { any: false, hits: 0 };
    // ensure car.vel exists
    car.vel = car.vel || new THREE.Vector3();

    const carCenter = new THREE.Vector3();
    car.mesh.getWorldPosition(carCenter);
    const carRadius = Math.max(0.05, Math.max(car.width || 2, car.length || 3) * carRadiusFactor);

    const tmpD = new THREE.Vector3();
    const normal = new THREE.Vector3();
    let hits = 0;

    const handle = (c) => {
      if (!c || c.broken) return;
      tmpD.subVectors(carCenter, c.pos);
      let dist = tmpD.length();
      if (dist === 0) {
        normal.set(1, 0, 0);
        dist = 1e-6;
      } else {
        normal.copy(tmpD).divideScalar(dist);
      }
      const penetration = (carRadius + (c.radius || 0)) - dist;
      c.lastDist = dist;
      if (penetration > 0) {
        hits++;
        // push car out
        car.mesh.position.addScaledVector(normal, penetration + 1e-4);
        car.mesh.getWorldPosition(carCenter); // update center

        // velocity response (horizontal)
        const vel = car.vel;
        const velNorm = vel.dot(normal);
        if (velNorm < 0) {
          const impulse = normal.clone().multiplyScalar((1 + restitution) * velNorm);
          vel.sub(impulse);
          vel.multiplyScalar(Math.max(0, friction));
          car.vel.copy(vel);
        } else {
          car.vel.multiplyScalar(0.98);
        }

        if (typeof car.vy === "number") car.vy *= 0.6;

        // breakable
        const hitSpeed = car.vel.length();
        if (c.breakable && !c.broken && hitSpeed > breakThreshold) {
          c.broken = true;
          if (c.inst && typeof c.instanceId === "number") {
            try {
              const tmpM = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
              c.inst.setMatrixAt(c.instanceId, tmpM);
              c.inst.instanceMatrix.needsUpdate = true;
            } catch (err) {
              console.warn("resolveCarCollisions: failed to remove instance", err);
            }
          }
        }
      }
    };

    if (Array.isArray(rockColliders)) for (let i = 0; i < rockColliders.length; i++) handle(rockColliders[i]);
    if (Array.isArray(treeColliders)) for (let i = 0; i < treeColliders.length; i++) handle(treeColliders[i]);

    if (debug && hits > 0) console.log("resolveCarCollisions: hits=", hits);
    return { any: hits > 0, hits };
  } catch (err) {
    console.error("resolveCarCollisions: unexpected error", err);
    return { any: false, hits: 0 };
  }
}
