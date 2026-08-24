import {
  createScene
} from './three/scene.js';

import {
  loadCharacter
} from './three/character.js';

import {
  createCameraView,
  startCamera
} from './pose/camera.js';

import {
  createPoseLandmarker
} from './pose/poseLandmarker.js';

import {
  createFullBodyRetargeter
} from './retarget/fullBodyRetargeter.js';

// =====================================================
// Body 기본 설정
// =====================================================

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

// =====================================================
// Three.js Scene
// =====================================================

const three =
  createScene();

// =====================================================
// Webcam
// =====================================================

const video =
  createCameraView();

// =====================================================
// 상태 UI
// =====================================================

const status =
  document.createElement('div');

status.style.position =
  'absolute';

status.style.left =
  '20px';

status.style.top =
  '20px';

status.style.zIndex =
  '30';

status.style.padding =
  '10px 14px';

status.style.background =
  'rgba(0, 0, 0, 0.7)';

status.style.color =
  'white';

status.style.borderRadius =
  '8px';

status.style.fontFamily =
  'sans-serif';

status.style.fontSize =
  '14px';

status.innerText =
  '시스템 준비 중...';

document.body.appendChild(
  status
);

// =====================================================
// Calibration Button
// =====================================================

const calibrationButton =
  document.createElement('button');

calibrationButton.innerText =
  '5초 후 전신 보정';

calibrationButton.style.position =
  'absolute';

calibrationButton.style.left =
  '20px';

calibrationButton.style.top =
  '70px';

calibrationButton.style.zIndex =
  '30';

calibrationButton.style.padding =
  '10px 16px';

calibrationButton.style.border =
  'none';

calibrationButton.style.borderRadius =
  '8px';

calibrationButton.style.cursor =
  'pointer';

calibrationButton.style.fontSize =
  '14px';

document.body.appendChild(
  calibrationButton
);

// =====================================================
// Countdown UI
// =====================================================

const countdown =
  document.createElement('div');

countdown.style.position =
  'absolute';

countdown.style.left =
  '25%';

countdown.style.top =
  '50%';

countdown.style.transform =
  'translate(-50%, -50%)';

countdown.style.zIndex =
  '50';

countdown.style.fontSize =
  '120px';

countdown.style.fontWeight =
  'bold';

countdown.style.color =
  'white';

countdown.style.fontFamily =
  'sans-serif';

countdown.style.display =
  'none';

countdown.style.textShadow =
  '0 0 10px rgba(0,0,0,0.8)';

document.body.appendChild(
  countdown
);

// =====================================================
// Character Load
// =====================================================

status.innerText =
  '3D 캐릭터 불러오는 중...';

const character =
  await loadCharacter(
    three.scene
  );

// =====================================================
// Full Body Retargeter
// =====================================================

const retargeter =
  createFullBodyRetargeter(
    character
  );

// =====================================================
// MediaPipe
// =====================================================

status.innerText =
  'MediaPipe 준비 중...';

const poseLandmarker =
  await createPoseLandmarker();

// =====================================================
// Webcam Start
// =====================================================

status.innerText =
  '카메라 준비 중...';

await startCamera(
  video
);

status.innerText =
  '전신을 카메라에 맞춰 주세요';

// =====================================================
// Pose State
// =====================================================

let latestLandmarks =
  null;

let latestWorldLandmarks =
  null;

let lastVideoTime =
  -1;

let countingDown =
  false;

// =====================================================
// Calibration
// =====================================================

function startCalibration() {
  if (countingDown) {
    return;
  }

  countingDown =
    true;

  calibrationButton.disabled =
    true;

  let count =
    5;

  countdown.style.display =
    'block';

  countdown.innerText =
    count;

  status.innerText =
    '정면을 보고 T-pose로 서 주세요';

  const timer =
    setInterval(() => {
      count -= 1;

      if (count > 0) {
        countdown.innerText =
          count;

        return;
      }

      clearInterval(
        timer
      );

      // ===============================================
      // Landmark 검사
      // ===============================================

      if (
        !latestLandmarks ||
        !latestWorldLandmarks
      ) {
        countdown.innerText =
          '✕';

        status.innerText =
          '전신 landmark를 찾지 못했습니다';

        finishCalibrationUI();

        return;
      }

      // ===============================================
      // Calibration
      // ===============================================

      const success =
        retargeter.calibrate(
          latestWorldLandmarks,
          latestLandmarks
        );

      countdown.innerText =
        success
          ? '✓'
          : '✕';

      status.innerText =
        success
          ? '전신 3D 보정 완료'
          : '보정 실패';

      finishCalibrationUI();
    }, 1000);
}

function finishCalibrationUI() {
  setTimeout(() => {
    countdown.style.display =
      'none';

    calibrationButton.disabled =
      false;

    countingDown =
      false;
  }, 700);
}

// =====================================================
// Calibration Button
// =====================================================

calibrationButton.addEventListener(
  'click',
  startCalibration
);

// =====================================================
// Space Shortcut
// =====================================================

window.addEventListener(
  'keydown',
  (event) => {
    if (
      event.code ===
      'Space'
    ) {
      event.preventDefault();

      startCalibration();
    }
  }
);

// =====================================================
// MediaPipe Pose Detection
// =====================================================

function detectPose() {
  if (
    video.readyState < 2
  ) {
    return;
  }

  // 같은 영상 frame에서
  // 중복 inference 방지
  if (
    video.currentTime ===
    lastVideoTime
  ) {
    return;
  }

  lastVideoTime =
    video.currentTime;

  // ===================================================
  // PoseLandmarker 실행
  // ===================================================

  const result =
    poseLandmarker.detectForVideo(
      video,
      performance.now()
    );

  // ===================================================
  // 일반 landmarks
  //
  // 화면 좌표
  // pelvis position에 사용
  // ===================================================

  const landmarks =
    result.landmarks?.[0];

  // ===================================================
  // worldLandmarks
  //
  // 3D pose
  // arms / legs에 사용
  // ===================================================

  const worldLandmarks =
    result.worldLandmarks?.[0];

  if (
    !landmarks ||
    !worldLandmarks
  ) {
    if (!countingDown) {
      status.innerText =
        '사람을 찾는 중...';
    }

    return;
  }

  // ===================================================
  // 최신 Pose 저장
  // ===================================================

  latestLandmarks =
    landmarks;

  latestWorldLandmarks =
    worldLandmarks;

  // ===================================================
  // Retarget
  // ===================================================

  if (
    retargeter.isCalibrated()
  ) {
    retargeter.setPose(
      worldLandmarks,
      landmarks
    );

    if (!countingDown) {
      status.innerText =
        '3D 전신 추적 중';
    }
  } else {
    if (!countingDown) {
      status.innerText =
        '전신 인식 완료 · Space 또는 버튼으로 보정';
    }
  }
}

// =====================================================
// Animation Loop
// =====================================================

function animate() {
  requestAnimationFrame(
    animate
  );

  // MediaPipe
  detectPose();

  // 캐릭터 smoothing / bone 적용
  retargeter.update();

  // OrbitControls
  three.controls.update();

  // Render
  three.renderer.render(
    three.scene,
    three.camera
  );
}

animate();

// =====================================================
// Resize
// =====================================================

window.addEventListener(
  'resize',
  three.resize
);
