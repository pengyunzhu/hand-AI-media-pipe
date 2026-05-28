import { Hands } from 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import { Camera } from 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';
import { drawConnectors, drawLandmarks } from 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js';

const videoElement = document.getElementById('inputVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const gestureText = document.getElementById('gestureText');
const actionText = document.getElementById('actionText');
const fpsText = document.getElementById('fpsText');
const hintText = document.getElementById('hintText');

let currentGesture = '等待中';
let stableGesture = null;
let gestureStartTime = 0;
let lastTriggeredGesture = null;
let lastTriggeredTime = 0;
let lastFrameTime = performance.now();
let fps = 0;

function isFingerOpen(landmarks, fingerIdx, handedness) {
  const tipIds = [4, 8, 12, 16, 20];
  const tipId = tipIds[fingerIdx];
  const pipId = tipId - 2;

  if (!landmarks[tipId] || !landmarks[pipId]) {
    return false;
  }

  if (fingerIdx === 0) {
    if (handedness === 'Right') {
      return landmarks[tipId].x > landmarks[pipId].x;
    }
    return landmarks[tipId].x < landmarks[pipId].x;
  }

  return landmarks[tipId].y < landmarks[pipId].y;
}

function classifyGesture(landmarks, handedness = 'Right') {
  if (!landmarks || landmarks.length === 0) {
    return 'No Gesture';
  }

  const fingers = [0, 1, 2, 3, 4].map((index) => isFingerOpen(landmarks, index, handedness));
  const [thumb, index, middle, ring, pinky] = fingers;

  if (thumb && index && middle && ring && pinky) {
    return 'Open Palm';
  }

  if (!index && !middle && !ring && !pinky && thumb) {
    const thumbTip = landmarks[4];
    const wrist = landmarks[0];
    if (thumbTip.y < wrist.y) {
      return 'Thumbs Up';
    }
  }

  if (!thumb && !index && !middle && !ring && !pinky) {
    return 'Fist';
  }

  if (index && !middle && !ring && !pinky) {
    return 'Pointing Up';
  }

  if (index && middle && !ring && !pinky) {
    return 'Victory';
  }

  return 'Unknown Gesture';
}

function gestureLabel(gestureName) {
  switch (gestureName) {
    case 'Thumbs Up':
      return '👍 (音量增加)';
    case 'Open Palm':
      return '✋ (暫停影片／停止)';
    case 'Fist':
      return '✊ (關閉功能)';
    case 'Pointing Up':
      return '☝️ (下一頁)';
    case 'Victory':
      return '✌️ (播放影片)';
    case 'Unknown Gesture':
      return '無法辨識';
    case 'No Gesture':
      return '請放入手部';
    default:
      return gestureName;
  }
}

function gestureAction(gestureName) {
  const mapping = {
    'Thumbs Up': '音量增加',
    'Open Palm': '暫停影片／停止',
    'Fist': '關閉功能',
    'Pointing Up': '下一頁',
    'Victory': '播放影片',
  };
  return mapping[gestureName] || '無對應功能';
}

function triggerAction(gestureName) {
  const action = gestureAction(gestureName);
  actionText.innerText = action;
  hintText.innerText = `已觸發：${action}`;
  lastTriggeredGesture = gestureName;
  lastTriggeredTime = performance.now();
}

function updateFps() {
  const now = performance.now();
  const delta = (now - lastFrameTime) / 1000;
  lastFrameTime = now;
  fps = delta > 0 ? 1 / delta : 0;
  fpsText.innerText = fps.toFixed(1);
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
});

hands.onResults((results) => {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const handedness = results.multiHandedness && results.multiHandedness[0]
      ? results.multiHandedness[0].classification[0].label
      : 'Right';

    drawConnectors(canvasCtx, landmarks, Hands.HAND_CONNECTIONS, {
      color: '#00ff9d',
      lineWidth: 4,
    });
    drawLandmarks(canvasCtx, landmarks, {
      color: '#ff4d6d',
      lineWidth: 2,
      radius: 5,
    });

    currentGesture = classifyGesture(landmarks, handedness);
  } else {
    currentGesture = 'No Gesture';
  }

  gestureText.innerText = gestureLabel(currentGesture);

  if (currentGesture !== stableGesture) {
    stableGesture = currentGesture;
    gestureStartTime = performance.now();
  } else {
    const elapsed = (performance.now() - gestureStartTime) / 1000;

    if (
      currentGesture !== 'No Gesture' &&
      currentGesture !== 'Unknown Gesture' &&
      elapsed >= 1.0
    ) {
      if (
        currentGesture !== lastTriggeredGesture ||
        performance.now() - lastTriggeredTime > 1500
      ) {
        triggerAction(currentGesture);
      }
    }
  }

  updateFps();
  canvasCtx.restore();
});

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 1280,
  height: 720,
});

camera.start().catch((error) => {
  hintText.innerText = '無法啟動攝影機：請允許攝影機權限，或從本機伺服器開啟此頁面。';
  console.error(error);
});
