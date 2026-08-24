import {
  getSpineAngle
} from '../utils/poseMath.js';

export function createCalibration() {
  let latestLandmarks = null;

  const state = {
    hasCalibrated: false,
    spineOffset: 0
  };

  let isCountingDown = false;

  // STATUS
  const status =
    document.createElement('div');

  status.innerText = '준비 중...';

  status.style.position = 'absolute';
  status.style.left = '20px';
  status.style.top = '20px';
  status.style.zIndex = '20';
  status.style.padding = '10px 14px';
  status.style.background =
    'rgba(0,0,0,0.65)';
  status.style.color = 'white';
  status.style.fontFamily = 'sans-serif';
  status.style.borderRadius = '8px';

  document.body.appendChild(status);

  // BUTTON
  const button =
    document.createElement('button');

  button.innerText =
    '3초 후 자세 보정';

  button.style.position = 'absolute';
  button.style.left = '20px';
  button.style.top = '70px';
  button.style.zIndex = '20';
  button.style.padding = '10px 16px';
  button.style.border = 'none';
  button.style.borderRadius = '8px';
  button.style.cursor = 'pointer';

  document.body.appendChild(button);

  // COUNTDOWN
  const countdown =
    document.createElement('div');

  countdown.style.position = 'absolute';
  countdown.style.left = '25%';
  countdown.style.top = '50%';

  countdown.style.transform =
    'translate(-50%, -50%)';

  countdown.style.zIndex = '30';
  countdown.style.fontSize = '120px';
  countdown.style.fontWeight = 'bold';
  countdown.style.color = 'white';
  countdown.style.display = 'none';

  document.body.appendChild(countdown);

  function setLandmarks(landmarks) {
    latestLandmarks = landmarks;
  }

  function calibrate() {
    if (!latestLandmarks) {
      status.innerText =
        '사람을 찾지 못했습니다';

      return false;
    }

    const LS =
      latestLandmarks[11];

    const RS =
      latestLandmarks[12];

    const LH =
      latestLandmarks[23];

    const RH =
      latestLandmarks[24];

    if (
      !LS || !RS ||
      !LH || !RH ||
      LS.visibility < 0.5 ||
      RS.visibility < 0.5 ||
      LH.visibility < 0.5 ||
      RH.visibility < 0.5
    ) {
      status.innerText =
        '어깨와 골반이 보이도록 서 주세요';

      return false;
    }

    state.spineOffset =
      getSpineAngle(
        LS,
        RS,
        LH,
        RH
      );

    state.hasCalibrated = true;

    status.innerText =
      '자세 보정 완료!';

    console.log(
      'Calibration 완료'
    );

    return true;
  }

  function startCountdown() {
    if (isCountingDown) return;

    isCountingDown = true;
    button.disabled = true;

    let count = 3;

    countdown.style.display =
      'block';

    countdown.innerText = count;

    status.innerText =
      '정면을 보고 편하게 서 주세요';

    const timer =
      setInterval(() => {
        count -= 1;

        if (count > 0) {
          countdown.innerText =
            count;

          return;
        }

        clearInterval(timer);

        const success =
          calibrate();

        countdown.innerText =
          success ? '✓' : '✕';

        setTimeout(() => {
          countdown.style.display =
            'none';

          button.disabled = false;
          isCountingDown = false;
        }, 700);

      }, 1000);
  }

  button.addEventListener(
    'click',
    startCountdown
  );

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        startCountdown();
      }
    }
  );

  return {
    state,
    status,
    setLandmarks,
    startCountdown,

    isCountingDown() {
      return isCountingDown;
    }
  };
}