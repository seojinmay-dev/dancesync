import * as THREE from 'three';

export const DANCE_SYNC_JOINTS = [
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle'
];

function createBodyFrame(joints) {
  const shoulderRight = joints.rightShoulder
    .clone()
    .sub(joints.leftShoulder)
    .normalize();

  const hipRight = joints.rightHip
    .clone()
    .sub(joints.leftHip)
    .normalize();

  const right = shoulderRight
    .add(hipRight)
    .normalize();

  const shoulderCenter = joints.leftShoulder
    .clone()
    .add(joints.rightShoulder)
    .multiplyScalar(0.5);

  const hipCenter = joints.leftHip
    .clone()
    .add(joints.rightHip)
    .multiplyScalar(0.5);

  const up = shoulderCenter
    .sub(hipCenter)
    .addScaledVector(
      right,
      -shoulderCenter.dot(right)
    )
    .normalize();

  const front = new THREE.Vector3()
    .crossVectors(right, up)
    .normalize();

  up.crossVectors(front, right).normalize();

  const matrix = new THREE.Matrix4().makeBasis(
    right,
    up,
    front
  );

  return {
    right,
    up,
    front,
    quaternion: new THREE.Quaternion()
      .setFromRotationMatrix(matrix),
    matrix
  };
}

export function createDanceSyncPose({
  joints,
  screenJoints = {},
  rootScreenPosition = null,
  timestamp = 0,
  source = 'unknown',
  metadata = {}
}) {
  for (const jointName of DANCE_SYNC_JOINTS) {
    if (!(joints[jointName] instanceof THREE.Vector3)) {
      throw new Error(
        `DanceSyncPose joint가 없거나 Vector3가 아닙니다: ${jointName}`
      );
    }
  }

  const bodyFrame = createBodyFrame(joints);
  const rootPosition = joints.leftHip
    .clone()
    .add(joints.rightHip)
    .multiplyScalar(0.5);

  const leftHipScreen = screenJoints.leftHip;
  const rightHipScreen = screenJoints.rightHip;
  const screenPosition = rootScreenPosition
    ? rootScreenPosition.clone()
    : leftHipScreen && rightHipScreen
      ? leftHipScreen.clone()
          .add(rightHipScreen)
          .multiplyScalar(0.5)
      : null;

  return {
    version: 1,
    source,
    timestamp,
    joints,
    screenJoints,
    root: {
      position: rootPosition,
      screenPosition,
      orientation: bodyFrame.quaternion.clone()
    },
    bodyFrame,
    metadata,

    toJSON() {
      return {
        version: 1,
        source,
        timestamp,
        joints: Object.fromEntries(
          Object.entries(joints).map(
            ([key, value]) => [key, value.toArray()]
          )
        ),
        screenJoints: Object.fromEntries(
          Object.entries(screenJoints).map(
            ([key, value]) => [key, value.toArray()]
          )
        ),
        root: {
          position: rootPosition.toArray(),
          screenPosition: screenPosition?.toArray() ?? null,
          orientation: bodyFrame.quaternion.toArray()
        },
        bodyFrame: {
          right: bodyFrame.right.toArray(),
          up: bodyFrame.up.toArray(),
          front: bodyFrame.front.toArray(),
          quaternion: bodyFrame.quaternion.toArray()
        },
        metadata
      };
    }
  };
}

export function danceSyncPoseFromJSON(data) {
  const joints = Object.fromEntries(
    Object.entries(data.joints).map(
      ([key, value]) => [
        key,
        new THREE.Vector3().fromArray(value)
      ]
    )
  );

  const screenJoints = Object.fromEntries(
    Object.entries(data.screenJoints ?? {}).map(
      ([key, value]) => [
        key,
        new THREE.Vector2().fromArray(value)
      ]
    )
  );

  return createDanceSyncPose({
    joints,
    screenJoints,
    rootScreenPosition: data.root?.screenPosition
      ? new THREE.Vector2().fromArray(
          data.root.screenPosition
        )
      : null,
    timestamp: data.timestamp,
    source: data.source,
    metadata: data.metadata
  });
}
