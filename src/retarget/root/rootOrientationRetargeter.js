import * as THREE from 'three';

import {
  createBodyFrameState
} from '../core/bodyFrames.js';

import {
  findCharacterMotionRoot
} from '../core/characterRoot.js';

const YAW_SMOOTHING = 0.12;
const MIRRORED_SCREEN_YAW_SIGN = -1;

export function createRootOrientationRetargeter(
  character
) {
  const root = findCharacterMotionRoot(character);
  const restQuaternion = root.quaternion.clone();
  const targetQuaternion = root.quaternion.clone();
  const neutralFront = new THREE.Vector3();
  const neutralUp = new THREE.Vector3();
  const currentFront = new THREE.Vector3();

  let calibrated = false;
  let yawDelta = 0;

  const debug = {
    neutralBodyFront: [0, 0, 0],
    currentBodyFront: [0, 0, 0],
    yawDeltaDegrees: 0,
    rootName: root.name,
    rootQuaternionBefore: restQuaternion.toArray(),
    rootTargetQuaternion: targetQuaternion.toArray(),
    rootActualQuaternion: root.quaternion.toArray()
  };

  function horizontalFront(frame) {
    const front = frame.bodyFront.clone();
    const up = frame.bodyUp;

    front.addScaledVector(
      up,
      -front.dot(up)
    );

    return front.lengthSq() > 0.000001
      ? front.normalize()
      : null;
  }

  function calibrate(worldLandmarks) {
    const frame = createBodyFrameState(worldLandmarks);
    const front = frame && horizontalFront(frame);

    if (!front) {
      return false;
    }

    neutralFront.copy(front);
    neutralUp.copy(frame.bodyUp);
    currentFront.copy(front);
    yawDelta = 0;

    root.quaternion.copy(restQuaternion);
    targetQuaternion.copy(restQuaternion);
    character.model.updateMatrixWorld(true);

    debug.neutralBodyFront = neutralFront.toArray();
    debug.currentBodyFront = currentFront.toArray();
    debug.yawDeltaDegrees = 0;
    debug.rootQuaternionBefore = restQuaternion.toArray();
    debug.rootTargetQuaternion = targetQuaternion.toArray();
    debug.rootActualQuaternion = root.quaternion.toArray();

    calibrated = true;

    console.log('[Root yaw calibration]', debug);
    return true;
  }

  function setPose(worldLandmarks) {
    if (!calibrated) return;

    const frame = createBodyFrameState(worldLandmarks);
    const front = frame && horizontalFront(frame);

    if (!front) return;

    currentFront.copy(front);

    const cross = new THREE.Vector3()
      .crossVectors(neutralFront, currentFront);

    yawDelta = Math.atan2(
      cross.dot(neutralUp),
      THREE.MathUtils.clamp(
        neutralFront.dot(currentFront),
        -1,
        1
      )
    ) * MIRRORED_SCREEN_YAW_SIGN;

    const parentWorldQuaternion = new THREE.Quaternion();
    root.parent.getWorldQuaternion(parentWorldQuaternion);

    // MediaPipe bodyUp은 MediaPipe 공간의 벡터다. root 회전축에는
    // Three.js world-up을 root parent-local로 변환해 사용한다.
    const yawAxisParent = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(
        parentWorldQuaternion.clone().invert()
      )
      .normalize();

    targetQuaternion
      .setFromAxisAngle(yawAxisParent, yawDelta)
      .multiply(restQuaternion);

    debug.currentBodyFront = currentFront.toArray();
    debug.yawDeltaDegrees = THREE.MathUtils.radToDeg(yawDelta);
    debug.rootTargetQuaternion = targetQuaternion.toArray();
  }

  function update() {
    if (!calibrated) return;

    root.quaternion.slerp(
      targetQuaternion,
      YAW_SMOOTHING
    );

    character.model.updateMatrixWorld(true);
    debug.rootActualQuaternion = root.quaternion.toArray();
  }

  function reset() {
    calibrated = false;
    yawDelta = 0;
    neutralFront.set(0, 0, 0);
    neutralUp.set(0, 0, 0);
    currentFront.set(0, 0, 0);
    root.quaternion.copy(restQuaternion);
    targetQuaternion.copy(restQuaternion);
    character.model.updateMatrixWorld(true);
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
