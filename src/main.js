import { createScene } from './three/scene.js';
import { loadCharacter } from './three/character.js';

import {
  createCameraView,
  startCamera
} from './pose/camera.js';

import {
  createPoseLandmarker
} from './pose/poseLandmarker.js';

import {
  createPoseFromLandmarks
} from './pose/poseAdapter.js';

import {
  createRetargeter
} from './retarget/retargeter.js';

import {
  createCalibration
} from './calibration/calibration.js';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

// THREE
const three = createScene();

// CALIBRATION / UI
const calibration =
  createCalibration();

// CAMERA
const video =
  createCameraView();

// CHARACTER
const character =
  await loadCharacter(
    three.scene
  );

// RETARGETER
const retargeter =
  createRetargeter(
    character
  );

// MEDIAPIPE
calibration.status.innerText =
  'MediaPipe 준비 중...';

const poseLandmarker =
  await createPoseLandmarker();

calibration.status.innerText =
  '카메라 준비 중...';

await startCamera(video);

calibration.status.innerText =
  'Pose 감지 준비 완료';

// VIDEO FRAME STATE
let lastVideoTime = -1;

// POSE DETECTION
function detectPose() {
  if (
    video.readyState < 2 ||
    video.currentTime ===
      lastVideoTime
  ) {
    return;
  }

  lastVideoTime =
    video.currentTime;

  const result =
    poseLandmarker.detectForVideo(
      video,
      performance.now()
    );

  if (
    !result.landmarks ||
    result.landmarks.length === 0
  ) {
    calibration.status.innerText =
      '사람을 찾는 중...';

    return;
  }

  const landmarks =
    result.landmarks[0];

  calibration.setLandmarks(
    landmarks
  );

  const pose =
    createPoseFromLandmarks(
      landmarks,
      calibration.state
    );

  retargeter.setPose(pose);

  if (
    !calibration.isCountingDown()
  ) {
    calibration.status.innerText =
      calibration.state.hasCalibrated
        ? 'Pose 감지 중 · 보정 완료'
        : 'Pose 감지 중 · 자세 보정 필요';
  }
}

// ANIMATION
function animate() {
  requestAnimationFrame(
    animate
  );

  detectPose();

  retargeter.update();

  three.controls.update();

  three.renderer.render(
    three.scene,
    three.camera
  );
}

animate();

// RESIZE
window.addEventListener(
  'resize',
  three.resize
);