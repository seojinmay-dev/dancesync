import * as THREE from 'three';

import {
  landmarkToVector3,
  midpoint3D
} from './retargetMath3D.js';

import {
  MP
} from './skeletonMap.js';

const EPSILON = 0.000001;

function createFrame(
  right,
  up
) {
  if (
    right.lengthSq() < EPSILON ||
    up.lengthSq() < EPSILON
  ) {
    return null;
  }

  right.normalize();

  up.addScaledVector(
    right,
    -up.dot(right)
  );

  if (up.lengthSq() < EPSILON) {
    return null;
  }

  up.normalize();

  const front = new THREE.Vector3()
    .crossVectors(
      right,
      up
    );

  if (front.lengthSq() < EPSILON) {
    return null;
  }

  front.normalize();

  up
    .crossVectors(
      front,
      right
    )
    .normalize();

  const frame = new THREE.Matrix4();

  frame.makeBasis(
    right,
    up,
    front
  );

  return frame;
}

// =====================================================
// Upper Body Frame
// =====================================================

export function createUpperBodyFrame(
  worldLandmarks
) {
  const LS =
    worldLandmarks?.[MP.LEFT_SHOULDER];

  const RS =
    worldLandmarks?.[MP.RIGHT_SHOULDER];

  const LH =
    worldLandmarks?.[MP.LEFT_HIP];

  const RH =
    worldLandmarks?.[MP.RIGHT_HIP];

  if (!LS || !RS || !LH || !RH) {
    return null;
  }

  const leftShoulder =
    landmarkToVector3(LS);

  const rightShoulder =
    landmarkToVector3(RS);

  const leftHip =
    landmarkToVector3(LH);

  const rightHip =
    landmarkToVector3(RH);

  const shoulderRight =
    new THREE.Vector3().subVectors(
      rightShoulder,
      leftShoulder
    );

  const hipRight =
    new THREE.Vector3().subVectors(
      rightHip,
      leftHip
    );

  if (
    shoulderRight.lengthSq() < EPSILON ||
    hipRight.lengthSq() < EPSILON
  ) {
    return null;
  }

  shoulderRight.normalize();
  hipRight.normalize();

  const right =
    new THREE.Vector3().addVectors(
      shoulderRight,
      hipRight
    );

  const shoulderCenter =
    midpoint3D(
      leftShoulder,
      rightShoulder
    );

  const hipCenter =
    midpoint3D(
      leftHip,
      rightHip
    );

  const up =
    new THREE.Vector3().subVectors(
      shoulderCenter,
      hipCenter
    );

  return createFrame(
    right,
    up
  );
}

// =====================================================
// Lower Body Frame
// =====================================================

export function createLowerBodyFrame(
  worldLandmarks
) {
  const LS =
    worldLandmarks?.[MP.LEFT_SHOULDER];

  const RS =
    worldLandmarks?.[MP.RIGHT_SHOULDER];

  const LH =
    worldLandmarks?.[MP.LEFT_HIP];

  const RH =
    worldLandmarks?.[MP.RIGHT_HIP];

  if (!LS || !RS || !LH || !RH) {
    return null;
  }

  const leftShoulder =
    landmarkToVector3(LS);

  const rightShoulder =
    landmarkToVector3(RS);

  const leftHip =
    landmarkToVector3(LH);

  const rightHip =
    landmarkToVector3(RH);

  const shoulderCenter =
    midpoint3D(
      leftShoulder,
      rightShoulder
    );

  const hipCenter =
    midpoint3D(
      leftHip,
      rightHip
    );

  const right =
    new THREE.Vector3().subVectors(
      rightHip,
      leftHip
    );

  const up =
    new THREE.Vector3().subVectors(
      shoulderCenter,
      hipCenter
    );

  return createFrame(
    right,
    up
  );
}

// =====================================================
// Smoother
// =====================================================

export function createFrameSmoother(
  smoothing = 0.08
) {
  const quaternion =
    new THREE.Quaternion();

  let initialized = false;

  function update(rawFrame) {
    if (!rawFrame) {
      return null;
    }

    const rawQuaternion =
      new THREE.Quaternion()
        .setFromRotationMatrix(
          rawFrame
        );

    if (!initialized) {
      quaternion.copy(
        rawQuaternion
      );

      initialized = true;
    } else {
      quaternion.slerp(
        rawQuaternion,
        smoothing
      );
    }

    return new THREE.Matrix4()
      .makeRotationFromQuaternion(
        quaternion
      );
  }

  function reset() {
    quaternion.identity();
    initialized = false;
  }

  return {
    update,
    reset
  };
}