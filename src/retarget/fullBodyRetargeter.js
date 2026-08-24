import {
  createArmRetargeter
} from './arms/armRetargeter.js';

import {
  createLegRetargeter
} from './legs/legRetargeter.js';

import {
  createPelvisRetargeter
} from './pelvis/pelvisRetargeter.js';

import {
  createRootOrientationRetargeter
} from './root/rootOrientationRetargeter.js';

export function createFullBodyRetargeter(
  character
) {
  const arms =
    createArmRetargeter(
      character
    );

  const legs =
    createLegRetargeter(
      character
    );

  const pelvis =
    createPelvisRetargeter(
      character
    );

  const rootOrientation =
    createRootOrientationRetargeter(
      character
    );

  let calibrated = false;

  function calibrate(
    worldLandmarks,
    landmarks
  ) {
    const armSuccess =
      arms.calibrate(
        worldLandmarks
      );

    const legSuccess =
      legs.calibrate(
        worldLandmarks
      );

    const pelvisSuccess =
      pelvis.calibrate(
        landmarks
      );

    const rootOrientationSuccess =
      rootOrientation.calibrate(
        worldLandmarks
      );

    calibrated =
      armSuccess &&
      legSuccess &&
      pelvisSuccess &&
      rootOrientationSuccess;

    console.log(
      'Arm:',
      armSuccess
    );

    console.log(
      'Leg:',
      legSuccess
    );

    console.log(
      'Pelvis:',
      pelvisSuccess
    );

    console.log(
      'Root orientation:',
      rootOrientationSuccess
    );

    return calibrated;
  }

  function setPose(
    worldLandmarks,
    landmarks
  ) {
    if (!calibrated) {
      return;
    }

    rootOrientation.setPose(
      worldLandmarks
    );

    // Limb target은 이번 frame에 실제 적용된 root orientation을
    // 기준으로 계산해야 root yaw를 parent inverse가 상쇄하지 않는다.
    rootOrientation.update();

    character.model.updateMatrixWorld(
      true
    );

    pelvis.setPose(
      landmarks
    );

    arms.setPose(
      worldLandmarks
    );

    legs.setPose(
      worldLandmarks
    );
  }

  function update() {
    if (!calibrated) {
      return;
    }

    pelvis.update();

    character.model.updateMatrixWorld(
      true
    );

    arms.update();

    character.model.updateMatrixWorld(
      true
    );

    legs.update();

    character.model.updateMatrixWorld(
      true
    );
  }

  function reset() {
    arms.reset();
    legs.reset();
    pelvis.reset();
    rootOrientation.reset();

    calibrated = false;
  }

  return {
    calibrate,
    setPose,
    update,
    reset,

    getDebugState() {
      return {
        pelvis:
          pelvis.getDebugState(),
        rootOrientation:
          rootOrientation.getDebugState()
      };
    },

    isCalibrated() {
      return calibrated;
    }
  };
}
