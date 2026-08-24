import * as THREE from 'three';

import {
  MP
} from '../core/skeletonMap.js';

import {
  midpoint2D
} from '../core/retargetMath3D.js';

import {
  findCharacterMotionRoot
} from '../core/characterRoot.js';

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

  // Hips와 모든 SkinnedMesh를 함께 포함하는 가장 가까운 조상을 찾는다.
  // X Bot GLB에서는 Scene wrapper가 아니라 scale 0.01의 Armature다.
  const motionRoot =
    findCharacterMotionRoot(character);

  const rootRestPosition =
    motionRoot.position.clone();

  const rootTargetPosition =
    motionRoot.position.clone();

  const rootRestWorldPosition =
    new THREE.Vector3();

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

  motionRoot.getWorldPosition(
    rootRestWorldPosition
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

    rootName: motionRoot.name,
    rootScale:
      motionRoot.scale.toArray(),
    hipsLocal:
      hips.position.toArray(),
    hipsWorld: [0, 0, 0],

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
    motionRoot.position.copy(
      rootRestPosition
    );

    rootTargetPosition.copy(
      rootRestPosition
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

    console.log('motion root:', {
      name: motionRoot.name,
      parent: motionRoot.parent?.name,
      scale: motionRoot.scale.toArray(),
      position: motionRoot.position.toArray(),
      hipsLocal: hips.position.toArray(),
      hipsWorld: hipsWorldPosition.toArray()
    });

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

    // moveX/moveY는 Three world 단위다. root parent에 scale/rotation이
    // 있어도 정확하도록 목표 world 위치를 parent-local로 변환한다.
    const targetWorld =
      rootRestWorldPosition
        .clone()
        .add(
          new THREE.Vector3(
            moveX,
            moveY,
            0
          )
        );

    rootTargetPosition.copy(
      motionRoot.parent.worldToLocal(
        targetWorld
      )
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
      rootTargetPosition.x;

    debug.targetY =
      rootTargetPosition.y;
  }

  // =====================================================
  // Update
  // =====================================================

  function update() {
    if (!calibrated) {
      return;
    }

    // ⭐ 캐릭터 전체 root 이동
    motionRoot.position.lerp(
      rootTargetPosition,
      POSITION_SMOOTHING
    );

    character.model.updateMatrixWorld(
      true
    );

    debug.actualX =
      motionRoot.position.x;

    debug.actualY =
      motionRoot.position.y;

    const currentHipsWorld =
      new THREE.Vector3();

    hips.getWorldPosition(
      currentHipsWorld
    );

    debug.hipsWorld =
      currentHipsWorld.toArray();
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

    motionRoot.position.copy(
      rootRestPosition
    );

    rootTargetPosition.copy(
      rootRestPosition
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
      rootRestPosition.x;

    debug.targetY =
      rootRestPosition.y;

    debug.actualX =
      rootRestPosition.x;

    debug.actualY =
      rootRestPosition.y;
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
