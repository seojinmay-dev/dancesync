export function createCameraView() {
  const video =
    document.createElement('video');

  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;

  video.style.position = 'absolute';
  video.style.left = '0';
  video.style.top = '0';
  video.style.width = '50vw';
  video.style.height = '100vh';
  video.style.objectFit = 'cover';

  // 거울 화면
  video.style.transform = 'scaleX(-1)';

  document.body.appendChild(video);

  return video;
}

export async function startCamera(video) {
  const stream =
    await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720
      },
      audio: false
    });

  video.srcObject = stream;

  await video.play();

  return stream;
}