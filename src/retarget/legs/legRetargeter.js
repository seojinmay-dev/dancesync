import * as THREE from 'three';

import {
  MP
} from '../core/skeletonMap.js';

import {
  getKneeBend
} from '../core/retargetMath3D.js';

import {
  createLowerBodyFrame,
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

export function createLegRetargeter(
  character
) {
  const MAX_KNEE =
    THREE.MathUtils.degToRad(135);

  const KNEE_DEAD_ZONE =
    THREE.MathUtils.degToRad(3);

  const configs = {
    userLeftUpperLeg: {
      bone:
        character.bones.rightUpLeg,

      childBone:
        character.bones.rightLeg,

      fromIndex:
        MP.LEFT_HIP,

      toIndex:
        MP.LEFT_KNEE,

      mirrorX:
        true
    },

    userRightUpperLeg: {
      bone:
        character.bones.leftUpLeg,

      childBone:
        character.bones.leftLeg,

      fromIndex:
        MP.RIGHT_HIP,

      toIndex:
        MP.RIGHT_KNEE,

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
    createFrameSmoother(0.06);

  const rightUpLeg =
    character.bones.rightUpLeg;

  const leftUpLeg =
    character.bones.leftUpLeg;

  const rightLeg =
    character.bones.rightLeg;

  const leftLeg =
    character.bones.leftLeg;

  const rightFoot =
    character.model.getObjectByName(
      'mixamorigRightFoot'
    );

  const leftFoot =
    character.model.getObjectByName(
      'mixamorigLeftFoot'
    );

  if (
    !rightFoot ||
    !leftFoot
  ) {
    throw new Error(
      'Foot bone을 찾지 못했습니다.'
    );
  }

  const rightLegRestQuaternion =
    rightLeg.quaternion.clone();

  const leftLegRestQuaternion =
    leftLeg.quaternion.clone();

  const rightKneeAxis =
    calculateKneeAxis(
      rightUpLeg,
      rightLeg,
      rightFoot
    );

  const leftKneeAxis =
    calculateKneeAxis(
      leftUpLeg,
      leftLeg,
      leftFoot
    );

  let neutralLeftKnee = 0;
  let neutralRightKnee = 0;

  let targetRightKnee = 0;
  let targetLeftKnee = 0;

  let currentRightKnee = 0;
  let currentLeftKnee = 0;

  let calibrated = false;

  function calculateKneeAxis(
    upperLeg,
    leg,
    foot
  ) {
    character.model.updateMatrixWorld(
      true
    );

    const hipPos =
      new THREE.Vector3();

    const kneePos =
      new THREE.Vector3();

    const anklePos =
      new THREE.Vector3();

    upperLeg.getWorldPosition(
      hipPos
    );

    leg.getWorldPosition(
      kneePos
    );

    foot.getWorldPosition(
      anklePos
    );

    const thighDirection =
      new THREE.Vector3()
        .subVectors(
          kneePos,
          hipPos
        )
        .normalize();

    const shinDirection =
      new THREE.Vector3()
        .subVectors(
          anklePos,
          kneePos
        )
        .normalize();

    /*
      thigh와 shin이 만드는 평면의 normal.
      이 축을 중심으로 무릎이 접힌다고 본다.
    */
    const axisWorld =
      new THREE.Vector3()
        .crossVectors(
          thighDirection,
          shinDirection
        );

    /*
      T-pose에서 거의 완전히 일자인 경우
      cross가 0에 가까울 수 있으므로
      fallback 축 사용.
    */
    if (
      axisWorld.lengthSq() <
      0.000001
    ) {
      axisWorld.set(
        1,
        0,
        0
      );

      /*
        Character body frame의 local X축을
        world 방향으로 변환.
      */
      axisWorld.transformDirection(
        characterBodyFrame
      );
    }

    axisWorld.normalize();

    /*
      world axis
      → Leg parent local axis
    */
    const parentWorldQuaternion =
      new THREE.Quaternion();

    leg.parent.getWorldQuaternion(
      parentWorldQuaternion
    );

    return axisWorld
      .applyQuaternion(
        parentWorldQuaternion
          .clone()
          .invert()
      )
      .normalize();
  }

  function calibrate(
    worldLandmarks
  ) {
    const frame =
      createLowerBodyFrame(
        worldLandmarks
      );

    if (!frame) {
      return false;
    }

    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      if (
        !calibrateDirectionBone(
          config,
          states[key],
          worldLandmarks,
          frame
        )
      ) {
        return false;
      }
    }

    const leftBend =
      getKneeBend(
        worldLandmarks[
          MP.LEFT_HIP
        ],
        worldLandmarks[
          MP.LEFT_KNEE
        ],
        worldLandmarks[
          MP.LEFT_ANKLE
        ]
      );

    const rightBend =
      getKneeBend(
        worldLandmarks[
          MP.RIGHT_HIP
        ],
        worldLandmarks[
          MP.RIGHT_KNEE
        ],
        worldLandmarks[
          MP.RIGHT_ANKLE
        ]
      );

    if (
      leftBend === null ||
      rightBend === null
    ) {
      return false;
    }

    neutralLeftKnee =
      leftBend;

    neutralRightKnee =
      rightBend;

    targetRightKnee = 0;
    targetLeftKnee = 0;

    currentRightKnee = 0;
    currentLeftKnee = 0;

    rightLeg.quaternion.copy(
      rightLegRestQuaternion
    );

    leftLeg.quaternion.copy(
      leftLegRestQuaternion
    );

    frameSmoother.reset();

    calibrated = true;

    return true;
  }

  function updateKnees(
    worldLandmarks
  ) {
    const leftBend =
      getKneeBend(
        worldLandmarks[
          MP.LEFT_HIP
        ],
        worldLandmarks[
          MP.LEFT_KNEE
        ],
        worldLandmarks[
          MP.LEFT_ANKLE
        ]
      );

    if (leftBend !== null) {
      let bend =
        Math.max(
          0,
          leftBend -
            neutralLeftKnee
        );

      if (
        bend <
        KNEE_DEAD_ZONE
      ) {
        bend = 0;
      } else {
        bend -=
          KNEE_DEAD_ZONE;
      }

      targetRightKnee =
        THREE.MathUtils.clamp(
          bend,
          0,
          MAX_KNEE
        );
    }

    const rightBend =
      getKneeBend(
        worldLandmarks[
          MP.RIGHT_HIP
        ],
        worldLandmarks[
          MP.RIGHT_KNEE
        ],
        worldLandmarks[
          MP.RIGHT_ANKLE
        ]
      );

    if (rightBend !== null) {
      let bend =
        Math.max(
          0,
          rightBend -
            neutralRightKnee
        );

      if (
        bend <
        KNEE_DEAD_ZONE
      ) {
        bend = 0;
      } else {
        bend -=
          KNEE_DEAD_ZONE;
      }

      targetLeftKnee =
        THREE.MathUtils.clamp(
          bend,
          0,
          MAX_KNEE
        );
    }
  }

  function setPose(
    worldLandmarks
  ) {
    if (!calibrated) {
      return;
    }

    const frame =
      frameSmoother.update(
        createLowerBodyFrame(
          worldLandmarks
        )
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

    updateKnees(
      worldLandmarks
    );
  }

  function update() {
    if (!calibrated) {
      return;
    }

    // ==============================
    // UpperLeg
    // ==============================

    for (
      const [key, config]
      of Object.entries(configs)
    ) {
      applyDirectionBone(
        config,
        states[key],
        0.08
      );
    }

    character.model.updateMatrixWorld(
      true
    );

    // ==============================
    // Knee
    // ==============================

    currentRightKnee =
      THREE.MathUtils.lerp(
        currentRightKnee,
        targetRightKnee,
        0.15
      );

    currentLeftKnee =
      THREE.MathUtils.lerp(
        currentLeftKnee,
        targetLeftKnee,
        0.15
      );

    const rightKneeRotation =
      new THREE.Quaternion()
        .setFromAxisAngle(
          rightKneeAxis,
          currentRightKnee
        );

    const leftKneeRotation =
      new THREE.Quaternion()
        .setFromAxisAngle(
          leftKneeAxis,
          currentLeftKnee
        );

    rightLeg.quaternion
      .copy(
        rightLegRestQuaternion
      )
      .multiply(
        rightKneeRotation
      );

    leftLeg.quaternion
      .copy(
        leftLegRestQuaternion
      )
      .multiply(
        leftKneeRotation
      );

    character.model.updateMatrixWorld(
      true
    );
  }

  function reset() {
    calibrated = false;

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

    rightLeg.quaternion.copy(
      rightLegRestQuaternion
    );

    leftLeg.quaternion.copy(
      leftLegRestQuaternion
    );

    neutralLeftKnee = 0;
    neutralRightKnee = 0;

    targetRightKnee = 0;
    targetLeftKnee = 0;

    currentRightKnee = 0;
    currentLeftKnee = 0;
  }

  return {
    calibrate,
    setPose,
    update,
    reset
  };
}