import {
  MP
} from '../core/skeletonMap.js';

import {
  createUpperBodyFrame,
  createFrameSmoother
} from '../core/bodyFrames.js';

import {
  createCharacterBodyFrame,
  createDirectionState,
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

      fromIndex:
        MP.LEFT_SHOULDER,

      toIndex:
        MP.LEFT_ELBOW,

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

      fromIndex:
        MP.LEFT_ELBOW,

      toIndex:
        MP.LEFT_WRIST,

      group:
        'foreArm',

      mirrorX:
        true
    },

    userRightUpperArm: {
      bone:
        character.bones.leftArm,

      childBone:
        character.bones.leftForeArm,

      fromIndex:
        MP.RIGHT_SHOULDER,

      toIndex:
        MP.RIGHT_ELBOW,

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

      fromIndex:
        MP.RIGHT_ELBOW,

      toIndex:
        MP.RIGHT_WRIST,

      group:
        'foreArm',

      mirrorX:
        true
    }
  };

  const characterBodyFrame =
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
        characterBodyFrame
      );
  }

  const frameSmoother =
    createFrameSmoother(
      0.08
    );

  let calibrated =
    false;

  function calibrate(
    worldLandmarks
  ) {
    const frame =
      createUpperBodyFrame(
        worldLandmarks
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
          worldLandmarks,
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
    worldLandmarks
  ) {
    if (!calibrated) {
      return;
    }

    const rawFrame =
      createUpperBodyFrame(
        worldLandmarks
      );

    const frame =
      frameSmoother.update(
        rawFrame
      );

    if (!frame) {
      return;
    }

    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      updateDirectionBoneTarget(
        character,
        config,
        states[key],
        worldLandmarks,
        frame,
        characterBodyFrame
      );
    }
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
    reset
  };
}