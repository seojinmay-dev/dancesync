export function findCharacterMotionRoot(
  character
) {
  const hips = character.model.getObjectByName(
    'mixamorigHips'
  );

  if (!hips) {
    throw new Error(
      'mixamorigHips를 찾지 못했습니다.'
    );
  }

  let root = hips;

  while (root.parent) {
    root = root.parent;

    let hasSkinnedMesh = false;

    root.traverse((object) => {
      hasSkinnedMesh ||= object.isSkinnedMesh === true;
    });

    if (hasSkinnedMesh) {
      return root;
    }
  }

  throw new Error(
    'Hips와 SkinnedMesh의 공통 motion root를 찾지 못했습니다.'
  );
}
