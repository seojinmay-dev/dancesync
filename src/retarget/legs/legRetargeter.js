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

    const kneePos =
      new THREE.Vector3();

    const anklePos =
      new THREE.Vector3();

    leg.getWorldPosition(
      kneePos
    );

    foot.getWorldPosition(
      anklePos
    );

    // Foot의 bind/rest 위치가 이 모델에서 Leg의 실제 길이 축이다.
    const shinDirection =
      new THREE.Vector3()
        .subVectors(
          anklePos,
          kneePos
        )
        .normalize();

    // Foot -> ToeBase의 bind 방향은 이 skeleton 자체가 정의하는
    // 캐릭터 앞쪽이다. body-frame cross product의 부호를 앞/뒤로
    // 추측하지 않고 실제 발 hierarchy에서 뒤쪽을 구한다.
    const toe = foot.children.find(
      (child) =>
        child.name.includes('ToeBase')
    );

    if (!toe) {
      throw new Error(
        `${foot.name}: ToeBase bone을 찾지 못했습니다.`
      );
    }

    const toePosition =
      new THREE.Vector3();

    toe.getWorldPosition(
      toePosition
    );

    const footForwardWorld =
      toePosition
        .sub(anklePos)
        .normalize();

    const backwardWorld =
      footForwardWorld.negate();

    const bendDirection =
      backwardWorld
        .clone()
        .addScaledVector(
          shinDirection,
          -backwardWorld.dot(
            shinDirection
          )
        );

    if (bendDirection.lengthSq() < 0.000001) {
      throw new Error(
        `${leg.name}: bind pose에서 knee bend plane을 계산할 수 없습니다.`
      );
    }

    bendDirection.normalize();

    // axis × shin = backward가 되도록 부호까지 bind pose에서 유도한다.
    const axisWorld =
      new THREE.Vector3()
        .crossVectors(
          shinDirection,
          bendDirection
        )
        .normalize();

    // 아래 update()는 restQuaternion * hingeQuaternion 순서다.
    // 따라서 hinge axis도 parent-local이 아닌 Leg bone-local이어야 한다.
    const legWorldQuaternion =
      new THREE.Quaternion();

    leg.getWorldQuaternion(
      legWorldQuaternion
    );

    const axisLocal = axisWorld
      .applyQuaternion(
        legWorldQuaternion
          .clone()
          .invert()
      )
      .normalize();

    console.log(
      `[Knee bind] ${leg.name}`,
      {
        upperLeg: upperLeg.name,
        foot: foot.name,
        toe: toe.name,
        shinLocal: foot.position
          .clone()
          .normalize()
          .toArray(),
        footForwardWorld:
          backwardWorld
            .clone()
            .negate()
            .toArray(),
        hingeAxisLocal:
          axisLocal.toArray(),
        restQuaternion:
          leg.quaternion.toArray()
      }
    );

    return axisLocal;
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

    const characterBodyFrame =
      createCharacterBodyFrame(
        character
      );

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
