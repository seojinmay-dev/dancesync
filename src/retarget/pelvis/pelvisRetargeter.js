import * as THREE from 'three';

import {
  MP
} from '../core/skeletonMap.js';

import {
  midpoint2D
} from '../core/retargetMath3D.js';

export function createPelvisRetargeter(
  character
) {
  // =====================================================
  // Mixamo Hips
  //
  // 지금 단계에서는 Hips rotation만 나중에 사용하고,
  // 화면상의 좌우/상하 이동은 character.model 자체를 이동시킨다.
  // =====================================================

  const hips =
    character.model.getObjectByName(
      'mixamorigHips'
    );

  const spine2 =
    character.model.getObjectByName(
      'mixamorigSpine2'
    );

  if (!hips) {
    throw new Error(
      'mixamorigHips를 찾지 못했습니다.'
    );
  }

  if (!spine2) {
    throw new Error(
      'mixamorigSpine2를 찾지 못했습니다.'
    );
  }

  // =====================================================
  // Model Root Position
  //
  // ⭐ 핵심
  //
  // 이전:
  // hips.position
  //
  // 현재:
  // character.model.position
  // =====================================================

  const modelRestPosition =
    character.model.position.clone();

  const modelTargetPosition =
    character.model.position.clone();

  // =====================================================
  // Calibration
  // =====================================================

  const neutralHipCenter =
    new THREE.Vector2();

  let calibrated =
    false;

  // =====================================================
  // Character Scale
  //
  // 캐릭터 몸통 길이를 기준으로
  // 화면 normalized 좌표를 캐릭터 크기에 맞춘다.
  // =====================================================

  character.model.updateMatrixWorld(
    true
  );

  const hipsWorldPosition =
    new THREE.Vector3();

  const chestWorldPosition =
    new THREE.Vector3();

  hips.getWorldPosition(
    hipsWorldPosition
  );

  spine2.getWorldPosition(
    chestWorldPosition
  );

  const characterTorsoLength =
    Math.max(
      hipsWorldPosition.distanceTo(
        chestWorldPosition
      ),
      0.001
    );

  // =====================================================
  // Movement Scale
  //
  // 현재는 디버깅 단계라 일부러 크게.
  //
  // 너무 많이 움직이면
  // 4.0 -> 2.0
  // =====================================================

  const MOVE_SCALE =
    characterTorsoLength * 4.0;

  // =====================================================
  // Smoothing
  // =====================================================

  const POSITION_SMOOTHING =
    0.25;

  // =====================================================
  // Debug
  // =====================================================

  const debug = {
    hipX: 0,
    hipY: 0,

    dx: 0,
    dy: 0,

    moveX: 0,
    moveY: 0,

    targetX: 0,
    targetY: 0,

    actualX: 0,
    actualY: 0,

    torsoLength:
      characterTorsoLength
  };

  // =====================================================
  // Image Hip Center
  //
  // 일반 landmarks:
  //
  // LEFT_HIP = 23
  // RIGHT_HIP = 24
  //
  // 화면 normalized coordinate를 사용한다.
  // =====================================================

  function getHipCenter(
    landmarks
  ) {
    const leftHip =
      landmarks?.[
        MP.LEFT_HIP
      ];

    const rightHip =
      landmarks?.[
        MP.RIGHT_HIP
      ];

    if (
      !leftHip ||
      !rightHip
    ) {
      return null;
    }

    return midpoint2D(
      leftHip,
      rightHip
    );
  }

  // =====================================================
  // Calibration
  // =====================================================

  function calibrate(
    landmarks
  ) {
    const center =
      getHipCenter(
        landmarks
      );

    if (!center) {
      console.error(
        'Pelvis calibration 실패: hip landmarks 없음'
      );

      return false;
    }

    // 현재 화면상의 골반 중심을
    // neutral position으로 저장
    neutralHipCenter.copy(
      center
    );

    // 캐릭터 root 위치 초기화
    character.model.position.copy(
      modelRestPosition
    );

    modelTargetPosition.copy(
      modelRestPosition
    );

    character.model.updateMatrixWorld(
      true
    );

    calibrated =
      true;

    console.log(
      '=============================='
    );

    console.log(
      'Pelvis Calibration 완료'
    );

    console.log(
      'neutral hip:',
      center.x,
      center.y
    );

    console.log(
      'character torso:',
      characterTorsoLength
    );

    console.log(
      'move scale:',
      MOVE_SCALE
    );

    console.log(
      '=============================='
    );

    return true;
  }

  // =====================================================
  // Pose
  // =====================================================

  function setPose(
    landmarks
  ) {
    if (!calibrated) {
      return;
    }

    const center =
      getHipCenter(
        landmarks
      );

    if (!center) {
      return;
    }

    // =================================================
    // 화면상의 이동량
    // =================================================

    const dx =
      center.x -
      neutralHipCenter.x;

    const dy =
      center.y -
      neutralHipCenter.y;

    // =================================================
    // X
    //
    // Webcam 화면은 CSS mirror 상태.
    //
    // 사용자 왼쪽 이동:
    // dx +
    //
    // 캐릭터 화면 왼쪽:
    // X -
    //
    // 따라서 -dx
    // =================================================

    const moveX =
      -dx *
      MOVE_SCALE;

    // =================================================
    // Y
    //
    // MediaPipe image:
    // 아래쪽 = y 증가
    //
    // Three.js:
    // 위쪽 = Y 증가
    //
    // 따라서 -dy
    // =================================================

    const moveY =
      -dy *
      MOVE_SCALE;

    // =================================================
    // Model Target Position
    //
    // Z는 지금 건드리지 않는다.
    // =================================================

    modelTargetPosition.set(
      modelRestPosition.x +
        moveX,

      modelRestPosition.y +
        moveY,

      modelRestPosition.z
    );

    // =================================================
    // Debug
    // =================================================

    debug.hipX =
      center.x;

    debug.hipY =
      center.y;

    debug.dx =
      dx;

    debug.dy =
      dy;

    debug.moveX =
      moveX;

    debug.moveY =
      moveY;

    debug.targetX =
      modelTargetPosition.x;

    debug.targetY =
      modelTargetPosition.y;
  }

  // =====================================================
  // Update
  // =====================================================

  function update() {
    if (!calibrated) {
      return;
    }

    // ⭐ 캐릭터 전체 root 이동
    character.model.position.lerp(
      modelTargetPosition,
      POSITION_SMOOTHING
    );

    character.model.updateMatrixWorld(
      true
    );

    debug.actualX =
      character.model.position.x;

    debug.actualY =
      character.model.position.y;
  }

  // =====================================================
  // Reset
  // =====================================================

  function reset() {
    calibrated =
      false;

    neutralHipCenter.set(
      0,
      0
    );

    character.model.position.copy(
      modelRestPosition
    );

    modelTargetPosition.copy(
      modelRestPosition
    );

    character.model.updateMatrixWorld(
      true
    );

    debug.hipX = 0;
    debug.hipY = 0;

    debug.dx = 0;
    debug.dy = 0;

    debug.moveX = 0;
    debug.moveY = 0;

    debug.targetX =
      modelRestPosition.x;

    debug.targetY =
      modelRestPosition.y;

    debug.actualX =
      modelRestPosition.x;

    debug.actualY =
      modelRestPosition.y;
  }

  // =====================================================
  // Public API
  // =====================================================

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