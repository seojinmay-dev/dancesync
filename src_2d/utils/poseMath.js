import * as THREE from 'three';

export function getArmAngle(shoulder, elbow) {
  const dx = elbow.x - shoulder.x;
  const dy = elbow.y - shoulder.y;

  return Math.atan2(-dy, Math.abs(dx));
}

export function getJointAngle(a, b, c) {
  const ba = new THREE.Vector2(
    a.x - b.x,
    a.y - b.y
  );

  const bc = new THREE.Vector2(
    c.x - b.x,
    c.y - b.y
  );

  ba.normalize();
  bc.normalize();

  const dot = THREE.MathUtils.clamp(
    ba.dot(bc),
    -1,
    1
  );

  return Math.acos(dot);
}

export function getSpineAngle(
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip
) {
  const shoulderCenterX =
    (leftShoulder.x + rightShoulder.x) / 2;

  const shoulderCenterY =
    (leftShoulder.y + rightShoulder.y) / 2;

  const hipCenterX =
    (leftHip.x + rightHip.x) / 2;

  const hipCenterY =
    (leftHip.y + rightHip.y) / 2;

  const dx = shoulderCenterX - hipCenterX;
  const dy = shoulderCenterY - hipCenterY;

  return Math.atan2(dx, -dy);
}

export function getLegAngle(hip, knee) {
  const dx = knee.x - hip.x;
  const dy = knee.y - hip.y;

  return Math.atan2(dx, dy);
}