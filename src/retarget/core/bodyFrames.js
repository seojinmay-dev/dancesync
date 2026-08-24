import * as THREE from 'three';

import {
  midpoint3D
} from './retargetMath3D.js';

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
  pose
) {
  const bodyFrame = pose?.bodyFrame;

  if (!bodyFrame) {
    return null;
  }

  return {
    bodyRight: bodyFrame.right,
    bodyUp: bodyFrame.up,
    bodyFront: bodyFrame.front,
    bodyQuaternion: bodyFrame.quaternion,
    matrix: bodyFrame.matrix
  };
}

// =====================================================
// Upper Body Frame
// =====================================================

export function createUpperBodyFrame(
  pose
) {
  return createBodyFrameState(
    pose
  )?.matrix ?? null;
}

// =====================================================
// Lower Body Frame
// =====================================================

export function createLowerBodyFrame(
  pose
) {
  const LS = pose?.joints?.leftShoulder;
  const RS = pose?.joints?.rightShoulder;
  const LH = pose?.joints?.leftHip;
  const RH = pose?.joints?.rightHip;

  if (!LS || !RS || !LH || !RH) {
    return null;
  }

  const shoulderCenter =
    midpoint3D(
      LS,
      RS
    );

  const hipCenter =
    midpoint3D(
      LH,
      RH
    );

  const right =
    new THREE.Vector3().subVectors(
      RH,
      LH
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
