import {
  createArmRetargeter
} from './arms/armRetargeter.js';

import {
  createLegRetargeter
} from './legs/legRetargeter.js';

import {
  createPelvisRetargeter
} from './pelvis/pelvisRetargeter.js';

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

    calibrated =
      armSuccess &&
      legSuccess &&
      pelvisSuccess;

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

    return calibrated;
  }

  function setPose(
    worldLandmarks,
    landmarks
  ) {
    if (!calibrated) {
      return;
    }

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
          pelvis.getDebugState()
      };
    },

    isCalibrated() {
      return calibrated;
    }
  };
}