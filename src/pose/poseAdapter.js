import * as THREE from 'three';

import {
  getArmAngle,
  getJointAngle,
  getSpineAngle,
  getLegAngle
} from '../utils/poseMath.js';

const MAX_ARM =
  THREE.MathUtils.degToRad(85);

const MAX_ELBOW =
  THREE.MathUtils.degToRad(130);

const MAX_SPINE =
  THREE.MathUtils.degToRad(45);

const MAX_HIP =
  THREE.MathUtils.degToRad(55);

const MAX_KNEE =
  THREE.MathUtils.degToRad(130);

const SPINE_AMPLIFICATION = 4.0;

export function createPoseFromLandmarks(
  landmarks,
  calibration
) {
  const pose = {};

  const LS = landmarks[11];
  const RS = landmarks[12];

  const LE = landmarks[13];
  const RE = landmarks[14];

  const LW = landmarks[15];
  const RW = landmarks[16];

  const LH = landmarks[23];
  const RH = landmarks[24];

  const LK = landmarks[25];
  const RK = landmarks[26];

  const LA = landmarks[27];
  const RA = landmarks[28];

  // ======================
  // ARMS
  // ======================
  if (
    LS?.visibility > 0.5 &&
    RS?.visibility > 0.5 &&
    LE?.visibility > 0.5 &&
    RE?.visibility > 0.5
  ) {
    pose.rightArm = THREE.MathUtils.clamp(
      getArmAngle(LS, LE),
      -MAX_ARM,
      MAX_ARM
    );

    pose.leftArm = THREE.MathUtils.clamp(
      getArmAngle(RS, RE),
      -MAX_ARM,
      MAX_ARM
    );
  }

  // ======================
  // ELBOW
  // ======================
  if (
    LS?.visibility > 0.5 &&
    LE?.visibility > 0.5 &&
    LW?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(
        LS,
        LE,
        LW
      );

    pose.rightElbow =
      THREE.MathUtils.clamp(
        bend,
        0,
        MAX_ELBOW
      );
  }

  if (
    RS?.visibility > 0.5 &&
    RE?.visibility > 0.5 &&
    RW?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(
        RS,
        RE,
        RW
      );

    pose.leftElbow =
      THREE.MathUtils.clamp(
        bend,
        0,
        MAX_ELBOW
      );
  }

  // ======================
  // SPINE
  // ======================
  if (
    LS?.visibility > 0.5 &&
    RS?.visibility > 0.5 &&
    LH?.visibility > 0.5 &&
    RH?.visibility > 0.5
  ) {
    const raw =
      getSpineAngle(
        LS,
        RS,
        LH,
        RH
      );

    const corrected =
      calibration.hasCalibrated
        ? raw - calibration.spineOffset
        : raw;

    pose.spine =
      THREE.MathUtils.clamp(
        corrected *
          SPINE_AMPLIFICATION,
        -MAX_SPINE,
        MAX_SPINE
      );
  }

  // ======================
  // HIPS
  // ======================
  if (
    LH?.visibility > 0.5 &&
    LK?.visibility > 0.5
  ) {
    pose.rightHip =
      THREE.MathUtils.clamp(
        getLegAngle(LH, LK),
        -MAX_HIP,
        MAX_HIP
      );
  }

  if (
    RH?.visibility > 0.5 &&
    RK?.visibility > 0.5
  ) {
    pose.leftHip =
      THREE.MathUtils.clamp(
        getLegAngle(RH, RK),
        -MAX_HIP,
        MAX_HIP
      );
  }

  // ======================
  // KNEES
  // ======================
  if (
    LH?.visibility > 0.5 &&
    LK?.visibility > 0.5 &&
    LA?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(
        LH,
        LK,
        LA
      );

    pose.rightKnee =
      THREE.MathUtils.clamp(
        bend,
        0,
        MAX_KNEE
      );
  }

  if (
    RH?.visibility > 0.5 &&
    RK?.visibility > 0.5 &&
    RA?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(
        RH,
        RK,
        RA
      );

    pose.leftKnee =
      THREE.MathUtils.clamp(
        bend,
        0,
        MAX_KNEE
      );
  }

  return pose;
}