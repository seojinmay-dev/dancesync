import {
  createUpperBodyFrame,
  createFrameSmoother
} from '../core/bodyFrames.js';

import {
  createCharacterBodyFrame,
  createDirectionState,
  getUserDirectionLocal,
  calibrateDirectionBone,
  updateDirectionBoneTarget,
  applyDirectionBone,
  resetDirectionBone
} from '../core/boneRetarget.js';

export function createArmRetargeter(
  character
) {
  const leftHand =
    character.model.getObjectByName(
      'mixamorigLeftHand'
    );

  const rightHand =
    character.model.getObjectByName(
      'mixamorigRightHand'
    );

  if (
    !leftHand ||
    !rightHand
  ) {
    throw new Error(
      '손 bone을 찾지 못했습니다.'
    );
  }

  const configs = {
    userLeftUpperArm: {
      bone:
        character.bones.rightArm,

      childBone:
        character.bones.rightForeArm,

      fromJoint:
        'leftShoulder',

      toJoint:
        'leftElbow',

      group:
        'upperArm',

      mirrorX:
        true
    },

    userLeftForeArm: {
      bone:
        character.bones.rightForeArm,

      childBone:
        rightHand,

      fromJoint:
        'leftElbow',

      toJoint:
        'leftWrist',

      group:
        'foreArm',

      preserveBodyFrontDepth:
        true,

      mirrorX:
        true
    },

    userRightUpperArm: {
      bone:
        character.bones.leftArm,

      childBone:
        character.bones.leftForeArm,

      fromJoint:
        'rightShoulder',

      toJoint:
        'rightElbow',

      group:
        'upperArm',

      mirrorX:
        true
    },

    userRightForeArm: {
      bone:
        character.bones.leftForeArm,

      childBone:
        leftHand,

      fromJoint:
        'rightElbow',

      toJoint:
        'rightWrist',

      group:
        'foreArm',

      preserveBodyFrontDepth:
        true,

      mirrorX:
        true
    }
  };

  const restCharacterBodyFrame =
    createCharacterBodyFrame(
      character
    );

  const states = {};

  for (
    const [key, config]
    of Object.entries(configs)
  ) {
    states[key] =
      createDirectionState(
        character,
        config,
        restCharacterBodyFrame
      );
  }

  const frameSmoother =
    createFrameSmoother(
      0.08
    );

  let calibrated =
    false;

  const debug = {};

  function updateArmPlaneDebug(
    key,
    upperConfig,
    foreConfig,
    pose,
    bodyFrame,
    foreState
  ) {
    const upperDirection =
      getUserDirectionLocal(
        upperConfig,
        pose,
        bodyFrame
      );

    const foreDirection =
      getUserDirectionLocal(
        foreConfig,
        pose,
        bodyFrame
      );

    if (!upperDirection || !foreDirection) {
      return false;
    }

    const armPlaneNormal =
      new THREE.Vector3()
        .crossVectors(
          upperDirection,
          foreDirection
        );

    const planeIsStable =
      armPlaneNormal.lengthSq() >= 0.0025;

    if (planeIsStable) {
      armPlaneNormal.normalize();
    }

    const depthDelta =
      foreDirection.z -
      foreState.neutralUserDirection.z;

    debug[key] = {
      upperArmDirectionLocal:
        upperDirection.toArray(),
      foreArmDirectionLocal:
        foreDirection.toArray(),
      armPlaneNormalLocal:
        armPlaneNormal.toArray(),
      planeFrontDot:
        planeIsStable
          ? armPlaneNormal.z
          : null,
      frontBack:
        Math.abs(depthDelta) < 0.02
          ? 'neutral'
          : depthDelta > 0
            ? 'body-front +Z'
            : 'body-back -Z',
      depthDelta,
      targetQuaternion:
        foreState.targetQuaternion.toArray()
    };

    return planeIsStable;
  }

  function calibrate(
    pose
  ) {
    const frame =
      createUpperBodyFrame(
        pose
      );

    if (!frame) {
      return false;
    }

    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      const success =
        calibrateDirectionBone(
          config,
          states[key],
          pose,
          frame
        );

      if (!success) {
        return false;
      }
    }

    frameSmoother.reset();

    calibrated =
      true;

    return true;
  }

  function setPose(
    pose
  ) {
    if (!calibrated) {
      return;
    }

    const rawFrame =
      createUpperBodyFrame(
        pose
      );

    const frame =
      frameSmoother.update(
        rawFrame
      );

    if (!frame) {
      return;
    }

    const characterBodyFrame =
      createCharacterBodyFrame(
        character
      );

    configs.userLeftForeArm.depthConstraintActive =
      updateArmPlaneDebug(
        'userLeft',
        configs.userLeftUpperArm,
        configs.userLeftForeArm,
        pose,
        frame,
        states.userLeftForeArm
      );

    configs.userRightForeArm.depthConstraintActive =
      updateArmPlaneDebug(
        'userRight',
        configs.userRightUpperArm,
        configs.userRightForeArm,
        pose,
        frame,
        states.userRightForeArm
      );

    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      updateDirectionBoneTarget(
        character,
        config,
        states[key],
        pose,
        frame,
        characterBodyFrame
      );
    }

    debug.userLeft.targetQuaternion =
      states.userLeftForeArm.targetQuaternion.toArray();

    debug.userRight.targetQuaternion =
      states.userRightForeArm.targetQuaternion.toArray();
  }

  function update() {
    if (!calibrated) {
      return;
    }

    // UpperArm 먼저
    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      if (
        config.group !==
        'upperArm'
      ) {
        continue;
      }

      applyDirectionBone(
        config,
        states[key],
        0.12
      );
    }

    character.model.updateMatrixWorld(
      true
    );

    // ForeArm 다음
    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      if (
        config.group !==
        'foreArm'
      ) {
        continue;
      }

      applyDirectionBone(
        config,
        states[key],
        0.14
      );
    }

    character.model.updateMatrixWorld(
      true
    );
  }

  function reset() {
    calibrated =
      false;

    frameSmoother.reset();

    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      resetDirectionBone(
        config,
        states[key]
      );
    }

    character.model.updateMatrixWorld(
      true
    );
  }

  return {
    calibrate,
    setPose,
    update,
    reset,

    getDebugState() {
      return debug;
    }
  };
}
import * as THREE from 'three';
