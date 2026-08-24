import * as THREE from 'three';

import {
  getDirection3D
} from './retargetMath3D.js';

export function createCharacterBodyFrame(
  character
) {
  const hips =
    character.model.getObjectByName(
      'mixamorigHips'
    );

  character.model.updateMatrixWorld(
    true
  );

  const leftShoulder =
    new THREE.Vector3();

  const rightShoulder =
    new THREE.Vector3();

  const hipPosition =
    new THREE.Vector3();

  character.bones.leftArm
    .getWorldPosition(
      leftShoulder
    );

  character.bones.rightArm
    .getWorldPosition(
      rightShoulder
    );

  hips.getWorldPosition(
    hipPosition
  );

  const shoulderCenter =
    new THREE.Vector3()
      .addVectors(
        leftShoulder,
        rightShoulder
      )
      .multiplyScalar(0.5);

  const right =
    new THREE.Vector3()
      .subVectors(
        rightShoulder,
        leftShoulder
      )
      .normalize();

  const up =
    new THREE.Vector3()
      .subVectors(
        shoulderCenter,
        hipPosition
      );

  up.addScaledVector(
    right,
    -up.dot(right)
  );

  up.normalize();

  const front =
    new THREE.Vector3()
      .crossVectors(
        right,
        up
      )
      .normalize();

  up
    .crossVectors(
      front,
      right
    )
    .normalize();

  const frame =
    new THREE.Matrix4();

  frame.makeBasis(
    right,
    up,
    front
  );

  return frame;
}

export function createDirectionState(
  character,
  config,
  characterBodyFrame
) {
  character.model.updateMatrixWorld(
    true
  );

  const bonePosition =
    new THREE.Vector3();

  const childPosition =
    new THREE.Vector3();

  config.bone.getWorldPosition(
    bonePosition
  );

  config.childBone.getWorldPosition(
    childPosition
  );

  const directionWorld =
    new THREE.Vector3()
      .subVectors(
        childPosition,
        bonePosition
      )
      .normalize();

  const parentWorldQuaternion =
    new THREE.Quaternion();

  config.bone.parent
    .getWorldQuaternion(
      parentWorldQuaternion
    );

  const restDirectionParent =
    directionWorld
      .clone()
      .applyQuaternion(
        parentWorldQuaternion
          .clone()
          .invert()
      )
      .normalize();

  const restDirectionBody =
    directionWorld
      .clone()
      .transformDirection(
        characterBodyFrame
          .clone()
          .invert()
      )
      .normalize();

  return {
    restQuaternion:
      config.bone.quaternion.clone(),

    targetQuaternion:
      config.bone.quaternion.clone(),

    restDirectionParent,
    restDirectionBody,

    neutralUserDirection:
      new THREE.Vector3(),

    hasNeutral: false
  };
}

export function getUserDirectionLocal(
  config,
  pose,
  bodyFrame
) {
  const from =
    pose?.joints?.[config.fromJoint];

  const to =
    pose?.joints?.[config.toJoint];

  const direction =
    getDirection3D(
      from,
      to
    );

  if (!direction) {
    return null;
  }

  const local =
    direction
      .clone()
      .transformDirection(
        bodyFrame
          .clone()
          .invert()
      )
      .normalize();

  if (config.mirrorX) {
    local.x *= -1;
  }

  return local.normalize();
}

export function calibrateDirectionBone(
  config,
  state,
  pose,
  bodyFrame
) {
  const neutral =
    getUserDirectionLocal(
      config,
      pose,
      bodyFrame
    );

  if (!neutral) {
    return false;
  }

  config.bone.quaternion.copy(
    state.restQuaternion
  );

  state.targetQuaternion.copy(
    state.restQuaternion
  );

  state.neutralUserDirection.copy(
    neutral
  );

  state.hasNeutral = true;

  return true;
}

export function updateDirectionBoneTarget(
  character,
  config,
  state,
  pose,
  bodyFrame,
  characterBodyFrame
) {
  if (!state.hasNeutral) {
    return;
  }

  const currentDirection =
    getUserDirectionLocal(
      config,
      pose,
      bodyFrame
    );

  if (!currentDirection) {
    return;
  }

  const userDelta =
    new THREE.Quaternion()
      .setFromUnitVectors(
        state.neutralUserDirection,
        currentDirection
      );

  const targetBodyDirection =
    state.restDirectionBody
      .clone()
      .applyQuaternion(
        userDelta
      )
      .normalize();

  if (
    config.preserveBodyFrontDepth &&
    config.depthConstraintActive
  ) {
    // 기존 XY direction quaternion은 유지하고, calibration 대비
    // bodyFront 성분만 명시적으로 보존한다. neutral에서는 정확히
    // Mixamo rest depth로 돌아간다.
    targetBodyDirection.z =
      state.restDirectionBody.z +
      (
        currentDirection.z -
        state.neutralUserDirection.z
      );

    targetBodyDirection.normalize();
  }

  const targetWorldDirection =
    targetBodyDirection
      .transformDirection(
        characterBodyFrame
      )
      .normalize();

  character.model.updateMatrixWorld(
    true
  );

  const parentWorldQuaternion =
    new THREE.Quaternion();

  config.bone.parent
    .getWorldQuaternion(
      parentWorldQuaternion
    );

  const targetDirectionParent =
    targetWorldDirection
      .clone()
      .applyQuaternion(
        parentWorldQuaternion
          .clone()
          .invert()
      )
      .normalize();

  const delta =
    new THREE.Quaternion()
      .setFromUnitVectors(
        state.restDirectionParent,
        targetDirectionParent
      );

  state.targetQuaternion
    .copy(delta)
    .multiply(
      state.restQuaternion
    );
}

export function applyDirectionBone(
  config,
  state,
  smoothing
) {
  config.bone.quaternion.slerp(
    state.targetQuaternion,
    smoothing
  );
}

export function resetDirectionBone(
  config,
  state
) {
  config.bone.quaternion.copy(
    state.restQuaternion
  );

  state.targetQuaternion.copy(
    state.restQuaternion
  );

  state.neutralUserDirection.set(
    0,
    0,
    0
  );

  state.hasNeutral = false;
}
