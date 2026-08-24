import * as THREE from 'three';

const EPSILON = 0.000001;

export function landmarkToVector3(landmark) {
  return new THREE.Vector3(
    landmark.x,
    landmark.y,
    landmark.z
  );
}

export function midpoint3D(a, b) {
  return new THREE.Vector3(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2,
    (a.z + b.z) / 2
  );
}

export function midpoint2D(a, b) {
  return new THREE.Vector2(
    (a.x + b.x) / 2,
    (a.y + b.y) / 2
  );
}

export function getDirection3D(from, to) {
  if (!from || !to) {
    return null;
  }

  const direction = new THREE.Vector3(
    to.x - from.x,
    to.y - from.y,
    to.z - from.z
  );

  if (direction.lengthSq() < EPSILON) {
    return null;
  }

  return direction.normalize();
}

export function getJointAngle3D(a, b, c) {
  if (!a || !b || !c) {
    return null;
  }

  const ba = new THREE.Vector3(
    a.x - b.x,
    a.y - b.y,
    a.z - b.z
  );

  const bc = new THREE.Vector3(
    c.x - b.x,
    c.y - b.y,
    c.z - b.z
  );

  if (
    ba.lengthSq() < EPSILON ||
    bc.lengthSq() < EPSILON
  ) {
    return null;
  }

  ba.normalize();
  bc.normalize();

  const dot = THREE.MathUtils.clamp(
    ba.dot(bc),
    -1,
    1
  );

  return Math.acos(dot);
}

export function getKneeBend(
  hip,
  knee,
  ankle
) {
  const angle = getJointAngle3D(
    hip,
    knee,
    ankle
  );

  if (angle === null) {
    return null;
  }

  return Math.PI - angle;
}