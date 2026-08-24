import * as THREE from 'three';

import {
  DANCE_SYNC_JOINTS,
  createDanceSyncPose
} from '../danceSyncPose.js';

export function createAISTPoseAdapter(
  jointMap
) {
  function convert(frame, timestamp = 0) {
    if (!frame?.joints) return null;

    const joints = {};

    for (const name of DANCE_SYNC_JOINTS) {
      const sourceName = jointMap?.[name] ?? name;
      const value = frame.joints[sourceName];

      if (!value) return null;

      joints[name] = value.isVector3
        ? value.clone()
        : new THREE.Vector3(
            value.x ?? value[0],
            value.y ?? value[1],
            value.z ?? value[2]
          );
    }

    return createDanceSyncPose({
      joints,
      rootScreenPosition: frame.rootScreenPosition
        ? new THREE.Vector2(
            frame.rootScreenPosition.x ?? frame.rootScreenPosition[0],
            frame.rootScreenPosition.y ?? frame.rootScreenPosition[1]
          )
        : null,
      timestamp,
      source: 'aist++',
      metadata: frame.metadata ?? {}
    });
  }

  return { convert };
}
