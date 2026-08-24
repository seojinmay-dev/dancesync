import * as THREE from 'three';

export function createRetargeter(
  character
) {
  const { bones, rest } = character;

  const current = {
    leftArm: 0,
    rightArm: 0,

    leftElbow: 0,
    rightElbow: 0,

    spine: 0,

    leftHip: 0,
    rightHip: 0,

    leftKnee: 0,
    rightKnee: 0
  };

  const target = {
    ...current
  };

  const smoothing = {
    arm: 0.06,
    elbow: 0.08,
    spine: 0.12,
    hip: 0.05,
    knee: 0.07
  };

  function setPose(pose) {
    for (
      const [key, value]
      of Object.entries(pose)
    ) {
      if (value !== undefined) {
        target[key] = value;
      }
    }
  }

  function update() {
    // ARMS
    current.rightArm =
      THREE.MathUtils.lerp(
        current.rightArm,
        target.rightArm,
        smoothing.arm
      );

    current.leftArm =
      THREE.MathUtils.lerp(
        current.leftArm,
        target.leftArm,
        smoothing.arm
      );

    bones.rightArm.rotation.x =
      rest.rightArmX -
      current.rightArm;

    bones.leftArm.rotation.x =
      rest.leftArmX -
      current.leftArm;

    // ELBOW
    current.rightElbow =
      THREE.MathUtils.lerp(
        current.rightElbow,
        target.rightElbow,
        smoothing.elbow
      );

    current.leftElbow =
      THREE.MathUtils.lerp(
        current.leftElbow,
        target.leftElbow,
        smoothing.elbow
      );

    bones.rightForeArm.rotation.z =
      rest.rightForeArmZ -
      current.rightElbow;

    bones.leftForeArm.rotation.z =
      rest.leftForeArmZ +
      current.leftElbow;

    // SPINE
    current.spine =
      THREE.MathUtils.lerp(
        current.spine,
        target.spine,
        smoothing.spine
      );

    const spine0 =
      current.spine * 0.30;

    const spine1 =
      current.spine * 0.35;

    const spine2 =
      current.spine * 0.35;

    bones.spine.rotation.z =
      rest.spineZ + spine0;

    bones.spine1.rotation.z =
      rest.spine1Z + spine1;

    bones.spine2.rotation.z =
      rest.spine2Z + spine2;

    // HIPS
    current.rightHip =
      THREE.MathUtils.lerp(
        current.rightHip,
        target.rightHip,
        smoothing.hip
      );

    current.leftHip =
      THREE.MathUtils.lerp(
        current.leftHip,
        target.leftHip,
        smoothing.hip
      );

    bones.rightUpLeg.rotation.z =
      rest.rightUpLegZ -
      current.rightHip;

    bones.leftUpLeg.rotation.z =
      rest.leftUpLegZ -
      current.leftHip;

    // KNEES
    current.rightKnee =
      THREE.MathUtils.lerp(
        current.rightKnee,
        target.rightKnee,
        smoothing.knee
      );

    current.leftKnee =
      THREE.MathUtils.lerp(
        current.leftKnee,
        target.leftKnee,
        smoothing.knee
      );

    bones.rightLeg.rotation.z =
      rest.rightLegZ -
      current.rightKnee;

    bones.leftLeg.rotation.z =
      rest.leftLegZ +
      current.leftKnee;
  }

  return {
    setPose,
    update
  };
}