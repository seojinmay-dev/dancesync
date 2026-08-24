import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadCharacter(scene) {
  const loader = new GLTFLoader();

  const gltf = await loader.loadAsync(
    '/models/xbot.glb'
  );

  const model = gltf.scene;

  scene.add(model);

  const bones = {
    leftArm:
      model.getObjectByName('mixamorigLeftArm'),

    rightArm:
      model.getObjectByName('mixamorigRightArm'),

    leftForeArm:
      model.getObjectByName('mixamorigLeftForeArm'),

    rightForeArm:
      model.getObjectByName('mixamorigRightForeArm'),

    spine:
      model.getObjectByName('mixamorigSpine'),

    spine1:
      model.getObjectByName('mixamorigSpine1'),

    spine2:
      model.getObjectByName('mixamorigSpine2'),

    leftUpLeg:
      model.getObjectByName('mixamorigLeftUpLeg'),

    rightUpLeg:
      model.getObjectByName('mixamorigRightUpLeg'),

    leftLeg:
      model.getObjectByName('mixamorigLeftLeg'),

    rightLeg:
      model.getObjectByName('mixamorigRightLeg')
  };

  for (const [name, bone] of Object.entries(bones)) {
    if (!bone) {
      throw new Error(
        `Bone을 찾지 못했습니다: ${name}`
      );
    }
  }

  const rest = {
    leftArmX:
      bones.leftArm.rotation.x,

    rightArmX:
      bones.rightArm.rotation.x,

    leftForeArmZ:
      bones.leftForeArm.rotation.z,

    rightForeArmZ:
      bones.rightForeArm.rotation.z,

    spineZ:
      bones.spine.rotation.z,

    spine1Z:
      bones.spine1.rotation.z,

    spine2Z:
      bones.spine2.rotation.z,

    leftUpLegZ:
      bones.leftUpLeg.rotation.z,

    rightUpLegZ:
      bones.rightUpLeg.rotation.z,

    leftLegZ:
      bones.leftLeg.rotation.z,

    rightLegZ:
      bones.rightLeg.rotation.z
  };

  console.log('Mixamo 캐릭터 로딩 완료');

  return {
    model,
    bones,
    rest
  };
}