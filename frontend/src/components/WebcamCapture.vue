<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'face-descriptor', value: number[]): void;
}>();

// Refs
const videoRef = ref<HTMLVideoElement | null>(null);
const overlayCanvasRef = ref<HTMLCanvasElement | null>(null);
const captureCanvasRef = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const isActive = ref(false);
const error = ref('');
const cvLoading = ref(false);
const modelsReady = ref(false);

// Steps: 'position' → 'blink' → 'capturing' → 'done'
const currentStep = ref<'position' | 'blink' | 'capturing' | 'done'>('position');
const promptMessage = ref('Position your face inside the oval');
const progressPercent = ref(0);
const isFlashing = ref(false);

// Tracking
let stableFramesCount = 0;
let blinkFrameCount = 0;
let eyesWereOpen = false;
let captureTimer: any = null;
let animFrameId: any = null;
let isDetecting = false;
let lastFaceDescriptor: number[] | null = null;
let lastFaceBox: any = null;
let lastIsCentered = false;
let collectedDescriptors: number[][] = [];

const fapi = () => (window as any).faceapi;

// Load face-api.js models
const loadModels = async (): Promise<boolean> => {
  try {
    const fa = fapi();
    if (!fa) return false;
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri('/models'),
      fa.nets.faceLandmark68Net.loadFromUri('/models'),
      fa.nets.faceRecognitionNet.loadFromUri('/models'),
    ]);
    console.log('✅ face-api.js models loaded');
    return true;
  } catch (e) {
    console.error('Model load error:', e);
    return false;
  }
};

// Reset all state
const resetVerification = () => {
  currentStep.value = 'position';
  promptMessage.value = 'Position your face inside the oval';
  progressPercent.value = 0;
  isFlashing.value = false;
  stableFramesCount = 0;
  blinkFrameCount = 0;
  eyesWereOpen = false;
  lastFaceBox = null;
  lastIsCentered = false;
  lastFaceDescriptor = null;
  collectedDescriptors = [];
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
};

// Flash → capture immediately (no countdown)
const triggerCapture = () => {
  if (currentStep.value === 'capturing' || currentStep.value === 'done') return;
  if (!lastIsCentered || !lastFaceBox || !lastFaceDescriptor) {
    resetVerification();
    return;
  }
  currentStep.value = 'capturing';
  progressPercent.value = 100;
  promptMessage.value = '📸 Capturing...';

  isFlashing.value = true;
  captureTimer = setTimeout(() => {
    isFlashing.value = false;
    performCapture();
  }, 220);
};

// ============================================================
// MAIN DETECTION LOOP
// Flow: face in oval → fill arc (position) → blink → flash capture
// ============================================================
const detect = async () => {
  if (!isActive.value || currentStep.value === 'done' || isDetecting) return;
  if (!videoRef.value || !overlayCanvasRef.value) return;

  const video = videoRef.value;
  const canvas = overlayCanvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx || video.readyState < 2) { scheduleNext(); return; }

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const cx = w / 2, cy = h / 2;
  const rx = w * 0.13, ry = h * 0.42;

  let faceBox: any = null;
  let isCentered = false;
  let eyesOpen = false;
  let descriptor: number[] | null = null;

  if (modelsReady.value) {
    isDetecting = true;
    try {
      const fa = fapi();
      const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });

      if (currentStep.value === 'position') {
        // Fast detection only (no descriptor yet)
        const result = await fa.detectSingleFace(video, opts);
        if (result) {
          faceBox = result.box;
          const faceCx = faceBox.x + faceBox.width / 2;
          const faceCy = faceBox.y + faceBox.height / 2;
          isCentered = Math.abs(faceCx - cx) < w * 0.32 && Math.abs(faceCy - cy) < h * 0.40;
        }
      } else if (currentStep.value === 'blink') {
        // Full pipeline: detect + landmarks + descriptor for blink + descriptor extraction
        const result = await fa.detectSingleFace(video, opts)
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (result) {
          faceBox = result.detection.box;
          const faceCx = faceBox.x + faceBox.width / 2;
          const faceCy = faceBox.y + faceBox.height / 2;
          isCentered = Math.abs(faceCx - cx) < w * 0.32 && Math.abs(faceCy - cy) < h * 0.40;

          // Eye Aspect Ratio blink detection
          if (result.landmarks) {
            const pts = result.landmarks.positions;
            const leftH  = Math.abs(pts[41].y - pts[37].y);
            const leftW  = Math.abs(pts[39].x - pts[36].x);
            const rightH = Math.abs(pts[47].y - pts[43].y);
            const rightW = Math.abs(pts[45].x - pts[42].x);
            const ear = ((leftW > 0 ? leftH / leftW : 0) + (rightW > 0 ? rightH / rightW : 0)) / 2;
            eyesOpen = ear > 0.22;
          }

          descriptor = Array.from(result.descriptor);
          if (isCentered) {
            collectedDescriptors.push(descriptor);
          }
        }
      }
    } catch { /* silent */ } finally {
      isDetecting = false;
    }
  }

  // Draw overlay
  drawOverlay(ctx, w, h, cx, cy, rx, ry, isCentered, faceBox);

  // ── Step Machine ──
  if (!faceBox) {
    if (currentStep.value !== 'capturing') resetVerification();

  } else if (isCentered) {
    stableFramesCount++;
    lastFaceBox = faceBox;
    lastIsCentered = true;

    if (currentStep.value === 'position') {
      progressPercent.value = Math.min(50, (stableFramesCount / 12) * 50);
      promptMessage.value = stableFramesCount < 6 ? 'Face detected! Hold still...' : '✅ Hold still...';

      if (stableFramesCount >= 12) {
        // Advance to blink step
        currentStep.value = 'blink';
        blinkFrameCount = 0;
        eyesWereOpen = false;
        promptMessage.value = '😉 Now blink your eyes!';
        progressPercent.value = 50;
      }

    } else if (currentStep.value === 'blink') {
      blinkFrameCount++;

      if (descriptor) lastFaceDescriptor = descriptor;

      // Blink detection
      if (eyesOpen) {
        eyesWereOpen = true;
      } else if (eyesWereOpen && !eyesOpen) {
        // Eyes just closed — BLINK detected!
        promptMessage.value = '✅ Blink detected! Capturing...';
        progressPercent.value = 100;
        triggerCapture();
        scheduleNext();
        return;
      }

      // Fallback: after 5 seconds of holding still, just capture anyway
      if (blinkFrameCount > 50 && lastFaceDescriptor) {
        promptMessage.value = '📸 Capturing...';
        progressPercent.value = 100;
        triggerCapture();
        scheduleNext();
        return;
      }

      promptMessage.value = '😉 Blink your eyes to capture!';
    }

  } else {
    // Face outside oval
    if (currentStep.value !== 'capturing') {
      lastIsCentered = false;
      stableFramesCount = Math.max(0, stableFramesCount - 1);
      progressPercent.value = Math.max(0, progressPercent.value - 3);
      promptMessage.value = '⚠️ Keep your face inside the oval';
    }
  }

  scheduleNext();
};

const scheduleNext = () => {
  if (isActive.value && currentStep.value !== 'done') {
    animFrameId = setTimeout(() => {
      if (isActive.value && currentStep.value !== 'done') requestAnimationFrame(detect);
    }, 100);
  }
};

// ============================================================
// Draw overlay canvas
// ============================================================
const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  cx: number, cy: number,
  rx: number, ry: number,
  isGood: boolean, face: any
) => {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Solid white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  // Cut out oval to show live camera
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Oval border — navy blue or green
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isGood ? '#00c47a' : '#1e3a6e';
  ctx.lineWidth = isGood ? 5 : 4;
  ctx.shadowColor = isGood ? '#00c47a' : '#1e3a6e';
  ctx.shadowBlur = isGood ? 16 : 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dashed inner head guide
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.1, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isGood ? 'rgba(0,196,122,0.5)' : 'rgba(30,58,110,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Shoulder guide
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.95, cy + ry * 0.85);
  ctx.quadraticCurveTo(cx - rx * 0.4, cy + ry * 0.55, cx, cy + ry * 0.55);
  ctx.quadraticCurveTo(cx + rx * 0.4, cy + ry * 0.55, cx + rx * 0.95, cy + ry * 0.85);
  ctx.strokeStyle = isGood ? 'rgba(0,196,122,0.5)' : 'rgba(30,58,110,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Progress arc
  if (progressPercent.value > 0) {
    const endAngle = (progressPercent.value / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 8, ry + 8, 0, -Math.PI / 2, endAngle);
    ctx.strokeStyle = isGood ? '#00c47a' : '#1e3a6e';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = isGood ? '#00c47a' : '#1e3a6e';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Green corner brackets on detected face
  if (face) {
    const pad = 8;
    const fx = face.x - pad, fy = face.y - pad;
    const fw = face.width + pad * 2, fh = face.height + pad * 2;
    const cl = Math.min(fw, fh) * 0.22;

    ctx.strokeStyle = '#00c47a';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#00c47a';
    ctx.shadowBlur = 12;
    ctx.lineCap = 'round';

    [[fx, fy, fx + cl, fy, fx, fy + cl],
     [fx + fw - cl, fy, fx + fw, fy, fx + fw, fy + cl],
     [fx, fy + fh - cl, fx, fy + fh, fx + cl, fy + fh],
     [fx + fw - cl, fy + fh, fx + fw, fy + fh, fx + fw, fy + fh - cl]
    ].forEach(([x1, y1, x2, y2, x3, y3]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  ctx.restore();
};

// ============================================================
// Capture — crops oval area, emits image + descriptor
// ============================================================
const performCapture = () => {
  if (!videoRef.value || !captureCanvasRef.value) return;

  // Face MUST be inside oval and descriptor must exist
  if (!lastIsCentered || !lastFaceBox || !lastFaceDescriptor) {
    resetVerification();
    return;
  }

  const video = videoRef.value;
  const canvas = captureCanvasRef.value;
  const ctx = canvas.getContext('2d')!;
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  // Crop around oval bounding area
  const cx = vw / 2, cy = vh / 2;
  const rx = vw * 0.13, ry = vh * 0.42;
  const padX = rx * 0.15, padY = ry * 0.08;
  const cropX = Math.max(0, Math.round(cx - rx - padX));
  const cropY = Math.max(0, Math.round(cy - ry - padY));
  const cropW = Math.min(vw - cropX, Math.round((rx + padX) * 2));
  const cropH = Math.min(vh - cropY, Math.round((ry + padY) * 2));

  canvas.width = 320;
  canvas.height = 320;
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 320, 320);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  // Average the collected face descriptors for maximum recognition accuracy
  let finalDescriptor = lastFaceDescriptor;
  if (collectedDescriptors.length > 0) {
    const len = collectedDescriptors[0].length;
    const avg = new Array(len).fill(0);
    for (const d of collectedDescriptors) {
      for (let i = 0; i < len; i++) {
        avg[i] += d[i];
      }
    }
    for (let i = 0; i < len; i++) {
      avg[i] /= collectedDescriptors.length;
    }
    finalDescriptor = avg;
  }

  // Emit both image and 128-d face descriptor
  emit('update:modelValue', dataUrl);
  if (finalDescriptor) {
    emit('face-descriptor', finalDescriptor);
  }

  currentStep.value = 'done';
  stopWebcam();
};

// Start webcam
const startWebcam = async () => {
  error.value = '';
  cvLoading.value = true;
  resetVerification();

  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });
    stream.value = mediaStream;
    isActive.value = true;
    await nextTick();
    await nextTick();

    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
      videoRef.value.play().catch(() => {});
    }

    // Load models if needed
    if (!modelsReady.value) {
      const ok = await loadModels();
      modelsReady.value = ok;
      if (!ok) {
        error.value = 'Failed to load face detection models. Please refresh.';
        cvLoading.value = false;
        return;
      }
    }

    cvLoading.value = false;

    const startDetection = () => { if (isActive.value) detect(); };
    if (videoRef.value) {
      if (videoRef.value.readyState >= 2) startDetection();
      else videoRef.value.addEventListener('loadeddata', startDetection, { once: true });
    }
  } catch (err: any) {
    error.value = 'Failed to access camera. Please allow camera permission.';
    cvLoading.value = false;
  }
};

// Stop webcam
const stopWebcam = () => {
  if (animFrameId !== null) { clearTimeout(animFrameId); animFrameId = null; }
  if (captureTimer)         { clearTimeout(captureTimer); captureTimer = null; }
  if (stream.value) { stream.value.getTracks().forEach(t => t.stop()); stream.value = null; }
  isActive.value = false;
  resetVerification();
};

onBeforeUnmount(() => stopWebcam());
</script>

<template>
  <div class="webcam-wrapper">
    <!-- Captured Image Preview -->
    <div v-if="modelValue && !isActive" class="captured-card card-frame">
      <img :src="modelValue" alt="Captured face" class="captured-image" />
      <button type="button" @click="() => { emit('update:modelValue', ''); emit('face-descriptor', []); }" class="retake-btn">
        🔄 Retake Photo
      </button>
    </div>

    <!-- Idle / Start State -->
    <div v-else-if="!isActive" class="idle-card card-frame">
      <div class="webcam-placeholder">
        <div class="kyc-icon-ring">
          <span class="camera-icon">👤</span>
        </div>
        <span class="placeholder-title">Automated Biometric Verification</span>
        <span class="placeholder-steps">
          <span class="step-pill">① Center face in oval</span>
          <span class="step-arrow">→</span>
          <span class="step-pill">② Blink eyes</span>
          <span class="step-arrow">→</span>
          <span class="step-pill">③ Auto capture</span>
        </span>
        <span v-if="error" class="error-msg">⚠️ {{ error }}</span>
      </div>
      <button type="button" @click="startWebcam" class="start-btn">
        🚀 Start Face Verification
      </button>
    </div>

    <!-- Active Camera Fullscreen Overlay -->
    <Teleport to="body">
      <div v-if="isActive" class="biometric-fullscreen-overlay">
        <!-- Camera Flash -->
        <div v-if="isFlashing" class="camera-flash"></div>

        <!-- Video + Overlay -->
        <div class="camera-viewport">
          <video ref="videoRef" autoplay playsinline muted class="video-preview"></video>
          <canvas ref="overlayCanvasRef" class="detection-overlay"></canvas>
        </div>

        <!-- Loading indicator -->
        <div v-if="cvLoading" class="loading-badge">
          ⏳ Loading face detection...
        </div>

        <!-- Step Banner -->
        <div class="kyc-instruction-banner" :class="currentStep">
          <div class="banner-icon">
            <span v-if="currentStep === 'position'">🎯</span>
            <span v-else-if="currentStep === 'blink'">😉</span>
            <span v-else-if="currentStep === 'capturing'">📸</span>
          </div>
          <div class="banner-text">
            <div class="step-title">
              <span v-if="currentStep === 'position'">STEP 1 — CENTER FACE</span>
              <span v-else-if="currentStep === 'blink'">STEP 2 — BLINK TO CAPTURE</span>
              <span v-else-if="currentStep === 'capturing'">CAPTURING...</span>
            </div>
            <div class="step-desc">{{ promptMessage }}</div>
          </div>
        </div>

        <!-- Exit Button -->
        <div class="controls-overlay">
          <button type="button" @click="stopWebcam" class="action-btn stop-btn">
            ✕ Exit Camera
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Hidden capture canvas -->
    <canvas ref="captureCanvasRef" style="display: none;"></canvas>
  </div>
</template>

<style scoped>
.webcam-wrapper { width: 100%; }

.card-frame {
  width: 100%;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
  background: #f8fafc;
  overflow: hidden;
  position: relative;
  aspect-ratio: 4 / 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.captured-image { width: 100%; height: 100%; object-fit: cover; }

.retake-btn {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.55);
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 6px 18px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.retake-btn:hover { background: rgba(0,0,0,0.75); }

/* Idle card */
.webcam-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 20px;
  text-align: center;
}
.kyc-icon-ring {
  width: 72px; height: 72px;
  border-radius: 50%;
  border: 2px solid #1e3a6e;
  display: flex; align-items: center; justify-content: center;
  background: rgba(30,58,110,0.06);
}
.camera-icon { font-size: 32px; }
.placeholder-title { font-weight: 700; font-size: 15px; color: #1e3a6e; }
.placeholder-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.step-pill {
  background: #e0e7ff;
  color: #1e3a6e;
  border-radius: 20px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
}
.step-arrow { color: #94a3b8; font-size: 14px; }
.error-msg { font-size: 12px; color: #ef4444; }

.start-btn {
  margin-top: 4px;
  padding: 10px 28px;
  border-radius: 24px;
  background: #1e3a6e;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
}
.start-btn:hover { background: #162d55; transform: translateY(-1px); }

/* Fullscreen Overlay */
.biometric-fullscreen-overlay {
  position: fixed; inset: 0; z-index: 999999;
  background: #ffffff;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  overflow: hidden;
}

.camera-viewport {
  position: relative;
  width: 100vw; height: 100vh;
}
.video-preview { width: 100%; height: 100%; object-fit: cover; }
.detection-overlay {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

.camera-flash {
  position: absolute; inset: 0;
  background: white; z-index: 1000000;
  animation: flash-fade 0.3s ease-out forwards;
}
@keyframes flash-fade {
  from { opacity: 1; }
  to   { opacity: 0; }
}

.loading-badge {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(30,58,110,0.85);
  color: #fff;
  padding: 12px 24px;
  border-radius: 24px;
  font-size: 14px; font-weight: 600;
  z-index: 10;
}

.kyc-instruction-banner {
  position: absolute;
  top: 24px; left: 50%;
  transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px;
  background: rgba(20, 30, 60, 0.88);
  border-radius: 28px;
  padding: 10px 22px;
  backdrop-filter: blur(8px);
  z-index: 10;
  min-width: 280px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.18);
}
.kyc-instruction-banner.blink {
  background: rgba(0, 100, 60, 0.9);
}
.banner-icon { font-size: 20px; }
.banner-text { display: flex; flex-direction: column; }
.step-title { font-size: 10px; font-weight: 700; color: #7dd3fc; letter-spacing: 0.08em; }
.step-desc { font-size: 14px; font-weight: 500; color: #fff; }

.controls-overlay {
  position: absolute;
  bottom: 36px; left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}
.action-btn {
  padding: 10px 28px;
  border-radius: 24px;
  font-size: 14px; font-weight: 600;
  cursor: pointer; border: none;
  transition: all 0.2s;
}
.stop-btn {
  background: rgba(255,255,255,0.15);
  color: #1e3a6e;
  border: 1.5px solid #1e3a6e;
  backdrop-filter: blur(8px);
}
.stop-btn:hover { background: rgba(30,58,110,0.1); }
</style>
