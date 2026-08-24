import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

document.body.style.margin = '0';
document.body.style.overflow = 'hidden';

// THREE.JS
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeeeeee);

const camera = new THREE.PerspectiveCamera(
  45,
  (window.innerWidth / 2) / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 1.5, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth / 2, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.right = '0';
renderer.domElement.style.top = '0';
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.enableDamping = true;

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3));

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);
directionalLight.position.set(3, 5, 3);
scene.add(directionalLight);

scene.add(new THREE.GridHelper(10, 10));

// WEBCAM
const video = document.createElement('video');
video.autoplay = true;
video.playsInline = true;
video.muted = true;
video.style.position = 'absolute';
video.style.left = '0';
video.style.top = '0';
video.style.width = '50vw';
video.style.height = '100vh';
video.style.objectFit = 'cover';
video.style.transform = 'scaleX(-1)';
document.body.appendChild(video);

// STATUS
const status = document.createElement('div');
status.innerText = '준비 중...';
status.style.position = 'absolute';
status.style.left = '20px';
status.style.top = '20px';
status.style.zIndex = '10';
status.style.padding = '10px 14px';
status.style.background = 'rgba(0,0,0,0.65)';
status.style.color = 'white';
status.style.fontFamily = 'sans-serif';
status.style.borderRadius = '8px';
document.body.appendChild(status);

// COUNTDOWN
const countdownDisplay = document.createElement('div');
countdownDisplay.style.position = 'absolute';
countdownDisplay.style.left = '25%';
countdownDisplay.style.top = '50%';
countdownDisplay.style.transform = 'translate(-50%, -50%)';
countdownDisplay.style.zIndex = '30';
countdownDisplay.style.fontSize = '120px';
countdownDisplay.style.fontWeight = 'bold';
countdownDisplay.style.color = 'white';
countdownDisplay.style.fontFamily = 'sans-serif';
countdownDisplay.style.textShadow = '0 0 15px rgba(0,0,0,0.8)';
countdownDisplay.style.display = 'none';
document.body.appendChild(countdownDisplay);

// CALIBRATION BUTTON
const calibrateButton = document.createElement('button');
calibrateButton.innerText = '3초 후 자세 보정';
calibrateButton.style.position = 'absolute';
calibrateButton.style.left = '20px';
calibrateButton.style.top = '70px';
calibrateButton.style.zIndex = '20';
calibrateButton.style.padding = '10px 16px';
calibrateButton.style.border = 'none';
calibrateButton.style.borderRadius = '8px';
calibrateButton.style.fontSize = '14px';
calibrateButton.style.cursor = 'pointer';
document.body.appendChild(calibrateButton);

// BONES
let character = null;

let leftArm, rightArm;
let leftForeArm, rightForeArm;

let spine, spine1, spine2;

let leftUpLeg, rightUpLeg;
let leftLeg, rightLeg;

// REST ROTATIONS
let leftArmRestX = 0;
let rightArmRestX = 0;

let leftForeArmRestZ = 0;
let rightForeArmRestZ = 0;

let spineRestZ = 0;
let spine1RestZ = 0;
let spine2RestZ = 0;

let leftUpLegRestZ = 0;
let rightUpLegRestZ = 0;

let leftLegRestZ = 0;
let rightLegRestZ = 0;

// TARGET VALUES
let targetLeftArm = 0;
let targetRightArm = 0;

let targetLeftElbow = 0;
let targetRightElbow = 0;

let targetSpine = 0;

let targetLeftHip = 0;
let targetRightHip = 0;

let targetLeftKnee = 0;
let targetRightKnee = 0;

// CURRENT VALUES
let currentLeftArm = 0;
let currentRightArm = 0;

let currentLeftElbow = 0;
let currentRightElbow = 0;

let currentSpine = 0;

let currentLeftHip = 0;
let currentRightHip = 0;

let currentLeftKnee = 0;
let currentRightKnee = 0;

// SMOOTHING
const ARM_SMOOTHING = 0.06;
const ELBOW_SMOOTHING = 0.08;
const SPINE_SMOOTHING = 0.12;
const HIP_SMOOTHING = 0.05;
const KNEE_SMOOTHING = 0.07;

// LIMITS
const MAX_ARM = THREE.MathUtils.degToRad(85);
const MAX_SPINE = THREE.MathUtils.degToRad(45);
const MAX_HIP = THREE.MathUtils.degToRad(55);
const MAX_ELBOW = THREE.MathUtils.degToRad(130);
const MAX_KNEE = THREE.MathUtils.degToRad(130);

// 몸통 움직임 증폭
const SPINE_AMPLIFICATION = 4.0;

// CALIBRATION
let latestLandmarks = null;
let spineCalibrationOffset = 0;
let hasCalibrated = false;
let isCountingDown = false;

// MODEL
const loader = new GLTFLoader();

loader.load(
  '/models/xbot.glb',
  (gltf) => {
    character = gltf.scene;
    scene.add(character);

    leftArm = character.getObjectByName('mixamorigLeftArm');
    rightArm = character.getObjectByName('mixamorigRightArm');

    leftForeArm = character.getObjectByName('mixamorigLeftForeArm');
    rightForeArm = character.getObjectByName('mixamorigRightForeArm');

    spine = character.getObjectByName('mixamorigSpine');
    spine1 = character.getObjectByName('mixamorigSpine1');
    spine2 = character.getObjectByName('mixamorigSpine2');

    leftUpLeg = character.getObjectByName('mixamorigLeftUpLeg');
    rightUpLeg = character.getObjectByName('mixamorigRightUpLeg');

    leftLeg = character.getObjectByName('mixamorigLeftLeg');
    rightLeg = character.getObjectByName('mixamorigRightLeg');

    if (
      !leftArm || !rightArm ||
      !leftForeArm || !rightForeArm ||
      !spine || !spine1 || !spine2 ||
      !leftUpLeg || !rightUpLeg ||
      !leftLeg || !rightLeg
    ) {
      console.error('필요한 Bone을 찾지 못했습니다.');
      return;
    }

    leftArmRestX = leftArm.rotation.x;
    rightArmRestX = rightArm.rotation.x;

    leftForeArmRestZ = leftForeArm.rotation.z;
    rightForeArmRestZ = rightForeArm.rotation.z;

    spineRestZ = spine.rotation.z;
    spine1RestZ = spine1.rotation.z;
    spine2RestZ = spine2.rotation.z;

    leftUpLegRestZ = leftUpLeg.rotation.z;
    rightUpLegRestZ = rightUpLeg.rotation.z;

    leftLegRestZ = leftLeg.rotation.z;
    rightLegRestZ = rightLeg.rotation.z;

    console.log('전신 Bone 로딩 성공');
  },
  undefined,
  (error) => {
    console.error('GLB 로딩 실패:', error);
  }
);

// MEDIAPIPE
let poseLandmarker = null;
let lastVideoTime = -1;

async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );

  poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.6,
    minPosePresenceConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  status.innerText = 'MediaPipe 준비 완료';
}

// CAMERA
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720
      },
      audio: false
    });

    video.srcObject = stream;
    await video.play();

    status.innerText = '웹캠 연결 완료';
  } catch (error) {
    console.error('웹캠 오류:', error);
    status.innerText = '웹캠 권한 오류';
  }
}

// HELPERS
function getArmAngle(shoulder, elbow) {
  const dx = elbow.x - shoulder.x;
  const dy = elbow.y - shoulder.y;

  return Math.atan2(-dy, Math.abs(dx));
}

function getJointAngle(a, b, c) {
  const ba = new THREE.Vector2(
    a.x - b.x,
    a.y - b.y
  );

  const bc = new THREE.Vector2(
    c.x - b.x,
    c.y - b.y
  );

  ba.normalize();
  bc.normalize();

  const dot = THREE.MathUtils.clamp(
    ba.dot(bc),
    -1,
    1
  );

  return Math.acos(dot);
}

function getSpineAngle(
  leftShoulder,
  rightShoulder,
  leftHip,
  rightHip
) {
  const shoulderCenterX =
    (leftShoulder.x + rightShoulder.x) / 2;

  const shoulderCenterY =
    (leftShoulder.y + rightShoulder.y) / 2;

  const hipCenterX =
    (leftHip.x + rightHip.x) / 2;

  const hipCenterY =
    (leftHip.y + rightHip.y) / 2;

  const dx = shoulderCenterX - hipCenterX;
  const dy = shoulderCenterY - hipCenterY;

  return Math.atan2(dx, -dy);
}

function getLegAngle(hip, knee) {
  const dx = knee.x - hip.x;
  const dy = knee.y - hip.y;

  return Math.atan2(dx, dy);
}

// CALIBRATION
function calibratePose() {
  if (!latestLandmarks) {
    status.innerText = '사람을 찾지 못했습니다';
    return;
  }

  const LS = latestLandmarks[11];
  const RS = latestLandmarks[12];
  const LH = latestLandmarks[23];
  const RH = latestLandmarks[24];

  if (
    !LS || !RS || !LH || !RH ||
    LS.visibility < 0.5 ||
    RS.visibility < 0.5 ||
    LH.visibility < 0.5 ||
    RH.visibility < 0.5
  ) {
    status.innerText = '어깨와 골반이 잘 보이도록 서 주세요';
    return;
  }

  spineCalibrationOffset = getSpineAngle(
    LS,
    RS,
    LH,
    RH
  );

  hasCalibrated = true;

  targetSpine = 0;
  currentSpine = 0;

  status.innerText = '자세 보정 완료!';

  console.log(
    'Spine calibration:',
    THREE.MathUtils.radToDeg(spineCalibrationOffset)
  );
}

// COUNTDOWN
function startCalibrationCountdown() {
  if (isCountingDown) return;

  isCountingDown = true;
  calibrateButton.disabled = true;

  let count = 3;

  countdownDisplay.style.display = 'block';
  countdownDisplay.innerText = count;

  status.innerText = '정면을 보고 편하게 서 주세요';

  const timer = setInterval(() => {
    count -= 1;

    if (count > 0) {
      countdownDisplay.innerText = count;
      return;
    }

    clearInterval(timer);

    countdownDisplay.innerText = '✓';

    calibratePose();

    setTimeout(() => {
      countdownDisplay.style.display = 'none';
      countdownDisplay.innerText = '';
      calibrateButton.disabled = false;
      isCountingDown = false;
    }, 700);
  }, 1000);
}

calibrateButton.addEventListener(
  'click',
  startCalibrationCountdown
);

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    startCalibrationCountdown();
  }
});

// TARGET UPDATE
function updateTargets(landmarks) {
  if (!character) return;

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

  // ARMS
  if (
    LS?.visibility > 0.5 &&
    RS?.visibility > 0.5 &&
    LE?.visibility > 0.5 &&
    RE?.visibility > 0.5
  ) {
    targetRightArm = THREE.MathUtils.clamp(
      getArmAngle(LS, LE),
      -MAX_ARM,
      MAX_ARM
    );

    targetLeftArm = THREE.MathUtils.clamp(
      getArmAngle(RS, RE),
      -MAX_ARM,
      MAX_ARM
    );
  }

  // LEFT ELBOW
  if (
    LS?.visibility > 0.5 &&
    LE?.visibility > 0.5 &&
    LW?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(LS, LE, LW);

    targetRightElbow = THREE.MathUtils.clamp(
      bend,
      0,
      MAX_ELBOW
    );
  }

  // RIGHT ELBOW
  if (
    RS?.visibility > 0.5 &&
    RE?.visibility > 0.5 &&
    RW?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(RS, RE, RW);

    targetLeftElbow = THREE.MathUtils.clamp(
      bend,
      0,
      MAX_ELBOW
    );
  }

  // SPINE
  if (
    LS?.visibility > 0.5 &&
    RS?.visibility > 0.5 &&
    LH?.visibility > 0.5 &&
    RH?.visibility > 0.5
  ) {
    const rawSpineAngle = getSpineAngle(
      LS,
      RS,
      LH,
      RH
    );

    const correctedSpineAngle =
      hasCalibrated
        ? rawSpineAngle - spineCalibrationOffset
        : rawSpineAngle;

    const amplifiedSpineAngle =
      correctedSpineAngle * SPINE_AMPLIFICATION;

    targetSpine = THREE.MathUtils.clamp(
      amplifiedSpineAngle,
      -MAX_SPINE,
      MAX_SPINE
    );
  }

  // USER LEFT LEG
  if (
    LH?.visibility > 0.5 &&
    LK?.visibility > 0.5
  ) {
    targetRightHip = THREE.MathUtils.clamp(
      getLegAngle(LH, LK),
      -MAX_HIP,
      MAX_HIP
    );
  }

  // USER RIGHT LEG
  if (
    RH?.visibility > 0.5 &&
    RK?.visibility > 0.5
  ) {
    targetLeftHip = THREE.MathUtils.clamp(
      getLegAngle(RH, RK),
      -MAX_HIP,
      MAX_HIP
    );
  }

  // LEFT KNEE
  if (
    LH?.visibility > 0.5 &&
    LK?.visibility > 0.5 &&
    LA?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(LH, LK, LA);

    targetRightKnee = THREE.MathUtils.clamp(
      bend,
      0,
      MAX_KNEE
    );
  }

  // RIGHT KNEE
  if (
    RH?.visibility > 0.5 &&
    RK?.visibility > 0.5 &&
    RA?.visibility > 0.5
  ) {
    const bend =
      Math.PI -
      getJointAngle(RH, RK, RA);

    targetLeftKnee = THREE.MathUtils.clamp(
      bend,
      0,
      MAX_KNEE
    );
  }
}

// CHARACTER UPDATE
function updateCharacter() {
  if (!character) return;

  // ARMS
  currentRightArm = THREE.MathUtils.lerp(
    currentRightArm,
    targetRightArm,
    ARM_SMOOTHING
  );

  currentLeftArm = THREE.MathUtils.lerp(
    currentLeftArm,
    targetLeftArm,
    ARM_SMOOTHING
  );

  rightArm.rotation.x =
    rightArmRestX - currentRightArm;

  leftArm.rotation.x =
    leftArmRestX - currentLeftArm;

  // ELBOWS
  currentRightElbow = THREE.MathUtils.lerp(
    currentRightElbow,
    targetRightElbow,
    ELBOW_SMOOTHING
  );

  currentLeftElbow = THREE.MathUtils.lerp(
    currentLeftElbow,
    targetLeftElbow,
    ELBOW_SMOOTHING
  );

  rightForeArm.rotation.z =
    rightForeArmRestZ - currentRightElbow;

  leftForeArm.rotation.z =
    leftForeArmRestZ + currentLeftElbow;

  // SPINE
  currentSpine = THREE.MathUtils.lerp(
    currentSpine,
    targetSpine,
    SPINE_SMOOTHING
  );

  const spinePart = currentSpine * 0.30;
  const spine1Part = currentSpine * 0.35;
  const spine2Part = currentSpine * 0.35;

  spine.rotation.z =
    spineRestZ + spinePart;

  spine1.rotation.z =
    spine1RestZ + spine1Part;

  spine2.rotation.z =
    spine2RestZ + spine2Part;

  // HIPS
  currentRightHip = THREE.MathUtils.lerp(
    currentRightHip,
    targetRightHip,
    HIP_SMOOTHING
  );

  currentLeftHip = THREE.MathUtils.lerp(
    currentLeftHip,
    targetLeftHip,
    HIP_SMOOTHING
  );

  rightUpLeg.rotation.z =
    rightUpLegRestZ - currentRightHip;

  leftUpLeg.rotation.z =
    leftUpLegRestZ - currentLeftHip;

  // KNEES
  currentRightKnee = THREE.MathUtils.lerp(
    currentRightKnee,
    targetRightKnee,
    KNEE_SMOOTHING
  );

  currentLeftKnee = THREE.MathUtils.lerp(
    currentLeftKnee,
    targetLeftKnee,
    KNEE_SMOOTHING
  );

  rightLeg.rotation.z =
    rightLegRestZ - currentRightKnee;

  leftLeg.rotation.z =
    leftLegRestZ + currentLeftKnee;
}

// POSE DETECTION
function detectPose() {
  if (!poseLandmarker) return;
  if (video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;

  lastVideoTime = video.currentTime;

  const result = poseLandmarker.detectForVideo(
    video,
    performance.now()
  );

  if (
    !result.landmarks ||
    result.landmarks.length === 0
  ) {
    status.innerText = '사람을 찾는 중...';
    return;
  }

  const landmarks = result.landmarks[0];

  latestLandmarks = landmarks;

  if (!isCountingDown) {
    status.innerText = hasCalibrated
      ? 'Pose 감지 중 · 보정 완료'
      : 'Pose 감지 중 · 자세 보정을 실행해주세요';
  }

  updateTargets(landmarks);
}

// INIT
async function init() {
  await initMediaPipe();
  await startCamera();
}

init();

// LOOP
function animate() {
  requestAnimationFrame(animate);

  detectPose();
  updateCharacter();

  controls.update();

  renderer.render(
    scene,
    camera
  );
}

animate();

// RESIZE
window.addEventListener('resize', () => {
  camera.aspect =
    (window.innerWidth / 2) /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth / 2,
    window.innerHeight
  );
});