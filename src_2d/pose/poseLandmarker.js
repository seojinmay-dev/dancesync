import {
  FilesetResolver,
  PoseLandmarker
} from '@mediapipe/tasks-vision';

export async function createPoseLandmarker() {
  const vision =
    await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );

  return await PoseLandmarker.createFromOptions(
    vision,
    {
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
    }
  );
}