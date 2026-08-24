import * as THREE from 'three';

export function createFullBodyRetargeter(character) {
  // =====================================================
  // Mixamo Bones
  // =====================================================

  const hips =
    character.model.getObjectByName(
      'mixamorigHips'
    );

  const leftHand =
    character.model.getObjectByName(
      'mixamorigLeftHand'
    );

  const rightHand =
    character.model.getObjectByName(
      'mixamorigRightHand'
    );

  if (
    !hips ||
    !leftHand ||
    !rightHand
  ) {
    throw new Error(
      '필요한 Mixamo bone을 찾지 못했습니다.'
    );
  }

  // =====================================================
  // Constants
  // =====================================================

  const EPSILON = 0.000001;

  const UPPER_ARM_SMOOTHING = 0.12;
  const FORE_ARM_SMOOTHING = 0.14;

  const UPPER_LEG_SMOOTHING = 0.08;

  const KNEE_SMOOTHING = 0.12;

  // 골반 위치 이동 smoothing
  const HIP_POSITION_SMOOTHING = 0.14;

  // 골반 이동을 눈에 띄게 보기 위한 값
  // 나중에 줄여도 됨
  const HIP_MOVE_SCALE_X = 3.0;
  const HIP_MOVE_SCALE_Y = 3.0;

  // 무릎 최대 굽힘
  const MAX_KNEE_BEND =
    THREE.MathUtils.degToRad(135);

  // 작은 오차 제거
  const KNEE_DEAD_ZONE =
    THREE.MathUtils.degToRad(5);

  // =====================================================
  // Direction Mapping
  //
  // mirror 화면 기준
  //
  // 사용자 왼쪽 -> 캐릭터 오른쪽
  // 사용자 오른쪽 -> 캐릭터 왼쪽
  // =====================================================

  const directionChains = {
    // =========================
    // USER LEFT ARM
    // =========================

    userLeftUpperArm: {
      name: '왼쪽 위팔',

      bone:
        character.bones.rightArm,

      childBone:
        character.bones.rightForeArm,

      fromIndex: 11,
      toIndex: 13,

      group: 'upperArm',
      frameType: 'upper',

      mirrorX: true
    },

    userLeftForeArm: {
      name: '왼쪽 아래팔',

      bone:
        character.bones.rightForeArm,

      childBone:
        rightHand,

      fromIndex: 13,
      toIndex: 15,

      group: 'foreArm',
      frameType: 'upper',

      mirrorX: true
    },

    // =========================
    // USER RIGHT ARM
    // =========================

    userRightUpperArm: {
      name: '오른쪽 위팔',

      bone:
        character.bones.leftArm,

      childBone:
        character.bones.leftForeArm,

      fromIndex: 12,
      toIndex: 14,

      group: 'upperArm',
      frameType: 'upper',

      mirrorX: true
    },

    userRightForeArm: {
      name: '오른쪽 아래팔',

      bone:
        character.bones.leftForeArm,

      childBone:
        leftHand,

      fromIndex: 14,
      toIndex: 16,

      group: 'foreArm',
      frameType: 'upper',

      mirrorX: true
    },

    // =========================
    // USER LEFT THIGH
    // =========================

    userLeftUpperLeg: {
      name: '왼쪽 허벅지',

      bone:
        character.bones.rightUpLeg,

      childBone:
        character.bones.rightLeg,

      fromIndex: 23,
      toIndex: 25,

      group: 'upperLeg',
      frameType: 'lower',

      mirrorX: true
    },

    // =========================
    // USER RIGHT THIGH
    // =========================

    userRightUpperLeg: {
      name: '오른쪽 허벅지',

      bone:
        character.bones.leftUpLeg,

      childBone:
        character.bones.leftLeg,

      fromIndex: 24,
      toIndex: 26,

      group: 'upperLeg',
      frameType: 'lower',

      mirrorX: true
    }
  };

  // =====================================================
  // Bone 검사
  // =====================================================

  for (
    const [key, config]
    of Object.entries(directionChains)
  ) {
    if (
      !config.bone ||
      !config.childBone
    ) {
      throw new Error(
        `${key}: Mixamo bone을 찾지 못했습니다.`
      );
    }
  }

  // =====================================================
  // State
  // =====================================================

  let calibrated = false;

  const states = {};

  const characterBodyFrame =
    new THREE.Matrix4();

  for (
    const [key, config]
    of Object.entries(directionChains)
  ) {
    states[key] = {
      restQuaternion:
        config.bone.quaternion.clone(),

      targetQuaternion:
        config.bone.quaternion.clone(),

      restDirectionParent:
        new THREE.Vector3(),

      restDirectionBody:
        new THREE.Vector3(),

      neutralUserDirection:
        new THREE.Vector3(),

      hasNeutral:
        false
    };
  }

  // =====================================================
  // Knee State
  //
  // 중요:
  // quaternion 자유회전 안 씀.
  //
  // Mixamo X Bot에서 이미 확인한
  // local rotation.z 방식 사용.
  // =====================================================

  const rightLeg =
    character.bones.rightLeg;

  const leftLeg =
    character.bones.leftLeg;

  const rightLegRestZ =
    rightLeg.rotation.z;

  const leftLegRestZ =
    leftLeg.rotation.z;

  let targetRightKneeBend = 0;
  let targetLeftKneeBend = 0;

  let currentRightKneeBend = 0;
  let currentLeftKneeBend = 0;

  let neutralLeftKneeBend = 0;
  let neutralRightKneeBend = 0;

  // =====================================================
  // Hips Position
  // =====================================================

  const hipsRestPosition =
    hips.position.clone();

  const hipsTargetPosition =
    hips.position.clone();

  const neutralHipCenter =
    new THREE.Vector2();

  let hasNeutralHipPosition = false;

  // =====================================================
  // Body frame smoothing
  // =====================================================

  const smoothedUpperQuaternion =
    new THREE.Quaternion();

  const smoothedLowerQuaternion =
    new THREE.Quaternion();

  let hasUpperFrame = false;
  let hasLowerFrame = false;

  // =====================================================
  // Utils
  // =====================================================

  function toVector3(
    landmark
  ) {
    return new THREE.Vector3(
      landmark.x,
      landmark.y,
      landmark.z
    );
  }

  function midpoint3D(
    a,
    b
  ) {
    return new THREE.Vector3(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      (a.z + b.z) / 2
    );
  }

  function midpoint2D(
    a,
    b
  ) {
    return new THREE.Vector2(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2
    );
  }

  function getDirection(
    from,
    to
  ) {
    if (!from || !to) {
      return null;
    }

    const direction =
      new THREE.Vector3(
        to.x - from.x,
        to.y - from.y,
        to.z - from.z
      );

    if (
      direction.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    return direction.normalize();
  }

  // =====================================================
  // Joint Angle 3D
  // =====================================================

  function getJointAngle3D(
    a,
    b,
    c
  ) {
    if (!a || !b || !c) {
      return null;
    }

    const ba =
      new THREE.Vector3(
        a.x - b.x,
        a.y - b.y,
        a.z - b.z
      );

    const bc =
      new THREE.Vector3(
        c.x - b.x,
        c.y - b.y,
        c.z - b.z
      );

    if (
      ba.lengthSq() < EPSILON ||
      bc.lengthSq() < EPSILON
    ) {
      return null;
    }

    ba.normalize();
    bc.normalize();

    const dot =
      THREE.MathUtils.clamp(
        ba.dot(bc),
        -1,
        1
      );

    return Math.acos(dot);
  }

  function getKneeBend(
    hip,
    knee,
    ankle
  ) {
    const angle =
      getJointAngle3D(
        hip,
        knee,
        ankle
      );

    if (angle === null) {
      return null;
    }

    return THREE.MathUtils.clamp(
      Math.PI - angle,
      0,
      MAX_KNEE_BEND
    );
  }

  // =====================================================
  // Upper Body Frame
  //
  // 팔용
  // =====================================================

  function createUpperBodyFrame(
    worldLandmarks
  ) {
    const LS =
      worldLandmarks?.[11];

    const RS =
      worldLandmarks?.[12];

    const LH =
      worldLandmarks?.[23];

    const RH =
      worldLandmarks?.[24];

    if (
      !LS ||
      !RS ||
      !LH ||
      !RH
    ) {
      return null;
    }

    const leftShoulder =
      toVector3(LS);

    const rightShoulder =
      toVector3(RS);

    const leftHip =
      toVector3(LH);

    const rightHip =
      toVector3(RH);

    // -----------------------------
    // RIGHT
    // -----------------------------

    const shoulderRight =
      new THREE.Vector3()
        .subVectors(
          rightShoulder,
          leftShoulder
        );

    const hipRight =
      new THREE.Vector3()
        .subVectors(
          rightHip,
          leftHip
        );

    if (
      shoulderRight.lengthSq() <
        EPSILON ||
      hipRight.lengthSq() <
        EPSILON
    ) {
      return null;
    }

    shoulderRight.normalize();
    hipRight.normalize();

    const right =
      new THREE.Vector3()
        .addVectors(
          shoulderRight,
          hipRight
        );

    if (
      right.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    right.normalize();

    // -----------------------------
    // UP
    // -----------------------------

    const shoulderCenter =
      midpoint3D(
        leftShoulder,
        rightShoulder
      );

    const hipCenter =
      midpoint3D(
        leftHip,
        rightHip
      );

    const up =
      new THREE.Vector3()
        .subVectors(
          shoulderCenter,
          hipCenter
        );

    up.addScaledVector(
      right,
      -up.dot(right)
    );

    if (
      up.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    up.normalize();

    // -----------------------------
    // FRONT
    // -----------------------------

    const front =
      new THREE.Vector3()
        .crossVectors(
          right,
          up
        );

    if (
      front.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    front.normalize();

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

  // =====================================================
  // Lower Frame
  //
  // 허벅지용
  //
  // 골반축 + 몸통축
  // =====================================================

  function createLowerBodyFrame(
    worldLandmarks
  ) {
    const LS =
      worldLandmarks?.[11];

    const RS =
      worldLandmarks?.[12];

    const LH =
      worldLandmarks?.[23];

    const RH =
      worldLandmarks?.[24];

    if (
      !LS ||
      !RS ||
      !LH ||
      !RH
    ) {
      return null;
    }

    const leftShoulder =
      toVector3(LS);

    const rightShoulder =
      toVector3(RS);

    const leftHip =
      toVector3(LH);

    const rightHip =
      toVector3(RH);

    const shoulderCenter =
      midpoint3D(
        leftShoulder,
        rightShoulder
      );

    const hipCenter =
      midpoint3D(
        leftHip,
        rightHip
      );

    const right =
      new THREE.Vector3()
        .subVectors(
          rightHip,
          leftHip
        );

    if (
      right.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    right.normalize();

    const up =
      new THREE.Vector3()
        .subVectors(
          shoulderCenter,
          hipCenter
        );

    up.addScaledVector(
      right,
      -up.dot(right)
    );

    if (
      up.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    up.normalize();

    const front =
      new THREE.Vector3()
        .crossVectors(
          right,
          up
        );

    if (
      front.lengthSq() <
      EPSILON
    ) {
      return null;
    }

    front.normalize();

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

  // =====================================================
  // Frame smoothing
  // =====================================================

  function smoothFrame(
    rawFrame,
    storedQuaternion,
    initialized,
    amount
  ) {
    if (!rawFrame) {
      return {
        frame: null,
        initialized
      };
    }

    const rawQuaternion =
      new THREE.Quaternion()
        .setFromRotationMatrix(
          rawFrame
        );

    if (!initialized) {
      storedQuaternion.copy(
        rawQuaternion
      );

      initialized = true;
    } else {
      storedQuaternion.slerp(
        rawQuaternion,
        amount
      );
    }

    return {
      frame:
        new THREE.Matrix4()
          .makeRotationFromQuaternion(
            storedQuaternion
          ),

      initialized
    };
  }

  function getSmoothedUpperFrame(
    worldLandmarks
  ) {
    const result =
      smoothFrame(
        createUpperBodyFrame(
          worldLandmarks
        ),

        smoothedUpperQuaternion,

        hasUpperFrame,

        0.08
      );

    hasUpperFrame =
      result.initialized;

    return result.frame;
  }

  function getSmoothedLowerFrame(
    worldLandmarks
  ) {
    const result =
      smoothFrame(
        createLowerBodyFrame(
          worldLandmarks
        ),

        smoothedLowerQuaternion,

        hasLowerFrame,

        0.06
      );

    hasLowerFrame =
      result.initialized;

    return result.frame;
  }

  // =====================================================
  // Character Body Frame
  // =====================================================

  function createCharacterBodyFrame() {
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
        .multiplyScalar(
          0.5
        );

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

  // =====================================================
  // Mixamo Rest Direction
  // =====================================================

  function calculateRestDirections(
    bone,
    childBone
  ) {
    character.model.updateMatrixWorld(
      true
    );

    const bonePosition =
      new THREE.Vector3();

    const childPosition =
      new THREE.Vector3();

    bone.getWorldPosition(
      bonePosition
    );

    childBone.getWorldPosition(
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

    bone.parent.getWorldQuaternion(
      parentWorldQuaternion
    );

    const parentLocal =
      directionWorld
        .clone()
        .applyQuaternion(
          parentWorldQuaternion
            .clone()
            .invert()
        )
        .normalize();

    const bodyLocal =
      directionWorld
        .clone()
        .transformDirection(
          characterBodyFrame
            .clone()
            .invert()
        )
        .normalize();

    return {
      parentLocal,
      bodyLocal
    };
  }

  // =====================================================
  // Character 초기 Rest 데이터
  // =====================================================

  characterBodyFrame.copy(
    createCharacterBodyFrame()
  );

  for (
    const [key, config]
    of Object.entries(
      directionChains
    )
  ) {
    const directions =
      calculateRestDirections(
        config.bone,
        config.childBone
      );

    states[key]
      .restDirectionParent
      .copy(
        directions.parentLocal
      );

    states[key]
      .restDirectionBody
      .copy(
        directions.bodyLocal
      );
  }

  // =====================================================
  // User direction -> local
  // =====================================================

  function getUserDirectionLocal(
    config,
    worldLandmarks,
    bodyFrame
  ) {
    const from =
      worldLandmarks?.[
        config.fromIndex
      ];

    const to =
      worldLandmarks?.[
        config.toIndex
      ];

    const direction =
      getDirection(
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

  // =====================================================
  // Bone Target Quaternion
  // =====================================================

  function calculateTargetQuaternion(
    bone,
    restDirectionParent,
    restQuaternion,
    targetDirectionWorld
  ) {
    character.model.updateMatrixWorld(
      true
    );

    const parentWorldQuaternion =
      new THREE.Quaternion();

    bone.parent.getWorldQuaternion(
      parentWorldQuaternion
    );

    const targetDirectionParent =
      targetDirectionWorld
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
          restDirectionParent,
          targetDirectionParent
        );

    return delta.multiply(
      restQuaternion
    );
  }

  // =====================================================
  // Direction Retarget
  //
  // 팔 / 허벅지
  // =====================================================

  function retargetDirectionBone(
    key,
    config,
    bodyFrame,
    worldLandmarks
  ) {
    const state =
      states[key];

    if (!state.hasNeutral) {
      return;
    }

    const currentDirection =
      getUserDirectionLocal(
        config,
        worldLandmarks,
        bodyFrame
      );

    if (!currentDirection) {
      return;
    }

    // neutral -> current
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

    const targetWorldDirection =
      targetBodyDirection
        .transformDirection(
          characterBodyFrame
        )
        .normalize();

    state.targetQuaternion.copy(
      calculateTargetQuaternion(
        config.bone,
        state.restDirectionParent,
        state.restQuaternion,
        targetWorldDirection
      )
    );
  }

  // =====================================================
  // Knee
  //
  // ⭐ 핵심 변경
  //
  // LowerLeg quaternion 계산 안 함.
  //
  // 3D 관절각만 측정하고
  // Mixamo Leg.rotation.z로 적용.
  // =====================================================

  function updateKnees(
    worldLandmarks
  ) {
    // ===============================================
    // 사용자 LEFT
    // MediaPipe:
    // 23 Hip
    // 25 Knee
    // 27 Ankle
    //
    // -> 캐릭터 RIGHT LEG
    // ===============================================

    const leftBend =
      getKneeBend(
        worldLandmarks?.[23],
        worldLandmarks?.[25],
        worldLandmarks?.[27]
      );

    if (leftBend !== null) {
      let bend =
        leftBend -
        neutralLeftKneeBend;

      bend =
        Math.max(
          0,
          bend
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

      targetRightKneeBend =
        THREE.MathUtils.clamp(
          bend,
          0,
          MAX_KNEE_BEND
        );
    }

    // ===============================================
    // 사용자 RIGHT
    // -> 캐릭터 LEFT LEG
    // ===============================================

    const rightBend =
      getKneeBend(
        worldLandmarks?.[24],
        worldLandmarks?.[26],
        worldLandmarks?.[28]
      );

    if (rightBend !== null) {
      let bend =
        rightBend -
        neutralRightKneeBend;

      bend =
        Math.max(
          0,
          bend
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

      targetLeftKneeBend =
        THREE.MathUtils.clamp(
          bend,
          0,
          MAX_KNEE_BEND
        );
    }
  }

  // =====================================================
  // 골반 Position
  //
  // 일반 landmarks 사용
  // =====================================================

  function getImageHipCenter(
    landmarks
  ) {
    const LH =
      landmarks?.[23];

    const RH =
      landmarks?.[24];

    if (!LH || !RH) {
      return null;
    }

    return midpoint2D(
      LH,
      RH
    );
  }

  function updateHipPosition(
    landmarks
  ) {
    if (!hasNeutralHipPosition) {
      return;
    }

    const currentHipCenter =
      getImageHipCenter(
        landmarks
      );

    if (!currentHipCenter) {
      return;
    }

    const dx =
      currentHipCenter.x -
      neutralHipCenter.x;

    const dy =
      currentHipCenter.y -
      neutralHipCenter.y;

    /*
      video는 mirror되어 있음.

      화면에서 내가 왼쪽으로 움직이면
      캐릭터도 화면 왼쪽으로 가게 X 반전.
    */

    const moveX =
      -dx *
      HIP_MOVE_SCALE_X;

    /*
      image 좌표:
      아래가 +

      Three.js:
      위가 +

      따라서 Y 반전
    */

    const moveY =
      -dy *
      HIP_MOVE_SCALE_Y;

    hipsTargetPosition.set(
      hipsRestPosition.x +
        moveX,

      hipsRestPosition.y +
        moveY,

      hipsRestPosition.z
    );
  }

  // =====================================================
  // Calibration
  // =====================================================

  function calibrate(
    worldLandmarks,
    landmarks
  ) {
    if (
      !worldLandmarks ||
      !landmarks
    ) {
      console.error(
        'Calibration 데이터 부족'
      );

      return false;
    }

    const upperFrame =
      createUpperBodyFrame(
        worldLandmarks
      );

    const lowerFrame =
      createLowerBodyFrame(
        worldLandmarks
      );

    const imageHipCenter =
      getImageHipCenter(
        landmarks
      );

    if (
      !upperFrame ||
      !lowerFrame ||
      !imageHipCenter
    ) {
      console.error(
        'Calibration 계산 실패'
      );

      return false;
    }

    // ===============================================
    // 골반 position neutral
    // ===============================================

    neutralHipCenter.copy(
      imageHipCenter
    );

    hasNeutralHipPosition =
      true;

    hips.position.copy(
      hipsRestPosition
    );

    hipsTargetPosition.copy(
      hipsRestPosition
    );

    // ===============================================
    // Direction bone reset
    // ===============================================

    for (
      const [key, config]
      of Object.entries(
        directionChains
      )
    ) {
      const state =
        states[key];

      config.bone.quaternion.copy(
        state.restQuaternion
      );

      state.targetQuaternion.copy(
        state.restQuaternion
      );
    }

    // ===============================================
    // 무릎 reset
    // ===============================================

    rightLeg.rotation.z =
      rightLegRestZ;

    leftLeg.rotation.z =
      leftLegRestZ;

    targetRightKneeBend = 0;
    targetLeftKneeBend = 0;

    currentRightKneeBend = 0;
    currentLeftKneeBend = 0;

    character.model.updateMatrixWorld(
      true
    );

    // ===============================================
    // 팔/허벅지 neutral
    // ===============================================

    for (
      const [key, config]
      of Object.entries(
        directionChains
      )
    ) {
      const bodyFrame =
        config.frameType ===
        'upper'
          ? upperFrame
          : lowerFrame;

      const neutralDirection =
        getUserDirectionLocal(
          config,
          worldLandmarks,
          bodyFrame
        );

      if (!neutralDirection) {
        console.error(
          `${config.name} neutral 계산 실패`
        );

        return false;
      }

      states[key]
        .neutralUserDirection
        .copy(
          neutralDirection
        );

      states[key].hasNeutral =
        true;
    }

    // ===============================================
    // Knee neutral
    // ===============================================

    const leftKneeBend =
      getKneeBend(
        worldLandmarks[23],
        worldLandmarks[25],
        worldLandmarks[27]
      );

    const rightKneeBend =
      getKneeBend(
        worldLandmarks[24],
        worldLandmarks[26],
        worldLandmarks[28]
      );

    if (
      leftKneeBend === null ||
      rightKneeBend === null
    ) {
      console.error(
        '무릎 neutral 계산 실패'
      );

      return false;
    }

    neutralLeftKneeBend =
      leftKneeBend;

    neutralRightKneeBend =
      rightKneeBend;

    // ===============================================
    // smoothing reset
    // ===============================================

    hasUpperFrame = false;
    hasLowerFrame = false;

    smoothedUpperQuaternion.identity();
    smoothedLowerQuaternion.identity();

    calibrated = true;

    console.log(
      '====================================='
    );

    console.log(
      'DanceSync 안정화 Retargeting 완료'
    );

    console.log(
      'Arms = 3D Quaternion'
    );

    console.log(
      'UpperLeg = 3D Quaternion'
    );

    console.log(
      'Knee = Local Z Hinge'
    );

    console.log(
      'Pelvis = 2D Position'
    );

    console.log(
      'Pelvis Rotation = OFF'
    );

    console.log(
      '====================================='
    );

    return true;
  }

  // =====================================================
  // Set Pose
  // =====================================================

  function setPose(
    worldLandmarks,
    landmarks
  ) {
    if (!calibrated) {
      return;
    }

    if (
      !worldLandmarks ||
      !landmarks
    ) {
      return;
    }

    const upperFrame =
      getSmoothedUpperFrame(
        worldLandmarks
      );

    const lowerFrame =
      getSmoothedLowerFrame(
        worldLandmarks
      );

    if (
      !upperFrame ||
      !lowerFrame
    ) {
      return;
    }

    // ===============================================
    // 1. 골반 position
    // ===============================================

    updateHipPosition(
      landmarks
    );

    // ===============================================
    // 2. 팔 + 허벅지
    // ===============================================

    for (
      const [key, config]
      of Object.entries(
        directionChains
      )
    ) {
      const bodyFrame =
        config.frameType ===
        'upper'
          ? upperFrame
          : lowerFrame;

      retargetDirectionBone(
        key,
        config,
        bodyFrame,
        worldLandmarks
      );
    }

    // ===============================================
    // 3. 무릎
    // ===============================================

    updateKnees(
      worldLandmarks
    );
  }

  // =====================================================
  // Update
  // =====================================================

  function update() {
    if (!calibrated) {
      return;
    }

    // ===============================================
    // Pelvis position
    // ===============================================

    hips.position.lerp(
      hipsTargetPosition,
      HIP_POSITION_SMOOTHING
    );

    character.model.updateMatrixWorld(
      true
    );

    // ===============================================
    // UpperArm
    // ===============================================

    updateGroup(
      'upperArm',
      UPPER_ARM_SMOOTHING
    );

    character.model.updateMatrixWorld(
      true
    );

    // ===============================================
    // ForeArm
    // ===============================================

    updateGroup(
      'foreArm',
      FORE_ARM_SMOOTHING
    );

    character.model.updateMatrixWorld(
      true
    );

    // ===============================================
    // UpperLeg
    // ===============================================

    updateGroup(
      'upperLeg',
      UPPER_LEG_SMOOTHING
    );

    character.model.updateMatrixWorld(
      true
    );

    // ===============================================
    // Knee
    //
    // Euler Z만 적용
    // ===============================================

    currentRightKneeBend =
      THREE.MathUtils.lerp(
        currentRightKneeBend,
        targetRightKneeBend,
        KNEE_SMOOTHING
      );

    currentLeftKneeBend =
      THREE.MathUtils.lerp(
        currentLeftKneeBend,
        targetLeftKneeBend,
        KNEE_SMOOTHING
      );

    /*
      예전 X Bot 테스트에서
      실제로 잘 동작했던 부호 그대로.
    */

    rightLeg.rotation.z =
      rightLegRestZ -
      currentRightKneeBend;

    leftLeg.rotation.z =
      leftLegRestZ +
      currentLeftKneeBend;

    character.model.updateMatrixWorld(
      true
    );
  }

  function updateGroup(
    groupName,
    smoothing
  ) {
    for (
      const [key, config]
      of Object.entries(
        directionChains
      )
    ) {
      if (
        config.group !==
        groupName
      ) {
        continue;
      }

      const state =
        states[key];

      config.bone.quaternion.slerp(
        state.targetQuaternion,
        smoothing
      );
    }
  }

  // =====================================================
  // Reset
  // =====================================================

  function reset() {
    calibrated = false;

    hasNeutralHipPosition =
      false;

    hasUpperFrame = false;
    hasLowerFrame = false;

    smoothedUpperQuaternion.identity();
    smoothedLowerQuaternion.identity();

    // ===============================================
    // Hips
    // ===============================================

    hips.position.copy(
      hipsRestPosition
    );

    hipsTargetPosition.copy(
      hipsRestPosition
    );

    // ===============================================
    // Direction Bones
    // ===============================================

    for (
      const [key, config]
      of Object.entries(
        directionChains
      )
    ) {
      const state =
        states[key];

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

      state.hasNeutral =
        false;
    }

    // ===============================================
    // Knees
    // ===============================================

    rightLeg.rotation.z =
      rightLegRestZ;

    leftLeg.rotation.z =
      leftLegRestZ;

    targetRightKneeBend = 0;
    targetLeftKneeBend = 0;

    currentRightKneeBend = 0;
    currentLeftKneeBend = 0;

    neutralLeftKneeBend = 0;
    neutralRightKneeBend = 0;

    character.model.updateMatrixWorld(
      true
    );
  }

  // =====================================================
  // Public API
  // =====================================================

  return {
    calibrate,
    setPose,
    update,
    reset,

    isCalibrated() {
      return calibrated;
    }
  };
}