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

export function createBodyFrameState(
  worldLandmarks
) {
  const LS = worldLandmarks?.[MP.LEFT_SHOULDER];
  const RS = worldLandmarks?.[MP.RIGHT_SHOULDER];
  const LH = worldLandmarks?.[MP.LEFT_HIP];
  const RH = worldLandmarks?.[MP.RIGHT_HIP];

  if (!LS || !RS || !LH || !RH) {
    return null;
  }

  const leftShoulder = landmarkToVector3(LS);
  const rightShoulder = landmarkToVector3(RS);
  const leftHip = landmarkToVector3(LH);
  const rightHip = landmarkToVector3(RH);

  const shoulderRight = rightShoulder
    .clone()
    .sub(leftShoulder);

  const hipRight = rightHip
    .clone()
    .sub(leftHip);

  if (
    shoulderRight.lengthSq() < EPSILON ||
    hipRight.lengthSq() < EPSILON
  ) {
    return null;
  }

  const bodyRight = shoulderRight
    .normalize()
    .add(hipRight.normalize());

  const shoulderCenter = midpoint3D(
    leftShoulder,
    rightShoulder
  );

  const hipCenter = midpoint3D(
    leftHip,
    rightHip
  );

  const bodyUp = shoulderCenter
    .clone()
    .sub(hipCenter);

  const matrix = createFrame(
    bodyRight,
    bodyUp
  );

  if (!matrix) {
    return null;
  }

  const bodyRightFinal = new THREE.Vector3();
  const bodyUpFinal = new THREE.Vector3();
  const bodyFront = new THREE.Vector3();

  matrix.extractBasis(
    bodyRightFinal,
    bodyUpFinal,
    bodyFront
  );

  return {
    bodyRight: bodyRightFinal.normalize(),
    bodyUp: bodyUpFinal.normalize(),
    bodyFront: bodyFront.normalize(),
    bodyQuaternion: new THREE.Quaternion()
      .setFromRotationMatrix(matrix),
    matrix
  };
}

// =====================================================
// Upper Body Frame
// =====================================================

export function createUpperBodyFrame(
  worldLandmarks
) {
  return createBodyFrameState(
    worldLandmarks
  )?.matrix ?? null;
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
