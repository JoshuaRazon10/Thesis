<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
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

// Steps: 'position' → 'challenge' → 'blink' → 'countdown' → 'capturing' → 'done'
const currentStep = ref<'position' | 'challenge' | 'blink' | 'countdown' | 'capturing' | 'done'>('position');
const promptMessage = ref('Position your face inside the oval');
const progressPercent = ref(0);
const isFlashing = ref(false);
const countdownValue = ref(0);
const currentEar = ref(0);

// Challenge Settings
const challengeType = ref<'left' | 'right'>('left');
const challengeCompleted = ref(false);

// Anti-Spoofing & Liveness buffers
const faceCenterHistory: { x: number; y: number }[] = [];
const maxHistorySize = 15;
const spoofDetected = ref(false);

// Tracking
let stableFramesCount = 0;
let blinkFrameCount = 0;
let eyesWereOpen = false;
let maxEar = 0;
let captureTimer: any = null;
let animFrameId: any = null;
let isDetecting = false;
let lastFaceBox: any = null;
let lastIsCentered = false;

const fapi = () => (window as any).faceapi;

// Load face-api.js models
const loadModels = async (): Promise<boolean> => {
  try {
    const fa = fapi();
    if (!fa) return false;
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri('/models'),
      fa.nets.faceLandmark68Net.loadFromUri('/models'),
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
  countdownValue.value = 0;
  currentEar.value = 0;
  maxEar = 0;
  stableFramesCount = 0;
  blinkFrameCount = 0;
  eyesWereOpen = false;
  lastFaceBox = null;
  challengeCompleted.value = false;
  faceCenterHistory.length = 0;
  spoofDetected.value = false;
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
};

// Start countdown after blink
const startCountdown = () => {
  if (currentStep.value === 'countdown' || currentStep.value === 'capturing' || currentStep.value === 'done') return;
  currentStep.value = 'countdown';
  countdownValue.value = 5;
  promptMessage.value = 'Hold still! Capturing in 5...';
  progressPercent.value = 75;

  const tick = () => {
    if (!isActive.value || currentStep.value !== 'countdown') return;
    countdownValue.value--;
    if (countdownValue.value <= 0) {
      triggerCapture();
    } else {
      promptMessage.value = `Hold still! Capturing in ${countdownValue.value}...`;
      captureTimer = setTimeout(tick, 1000);
    }
  };
  captureTimer = setTimeout(tick, 1000);
};

// Flash → capture
const triggerCapture = () => {
  if (currentStep.value === 'done') return;
  if (!lastIsCentered || !lastFaceBox) {
    resetVerification();
    return;
  }
  currentStep.value = 'capturing';
  progressPercent.value = 100;
  promptMessage.value = 'Capturing...';
  countdownValue.value = 0;

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
  if (!isActive.value || currentStep.value === 'done' || currentStep.value === 'countdown' || isDetecting) return;
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
  const rx = w * 0.22, ry = h * 0.38;

  let faceBox: any = null;
  let isCentered = false;
  let eyesOpen = false;
  let eyesClosed = false;
  let challengeMet = false;
  let headTurnRatio = 1.0;

  if (modelsReady.value) {
    isDetecting = true;
    try {
      const fa = fapi();
      const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.35 });

      if (currentStep.value === 'position') {
        // Fast detection only (no landmarks)
        const result = await fa.detectSingleFace(video, opts);
        if (result) {
          faceBox = result.box;
          const faceCx = faceBox.x + faceBox.width / 2;
          const faceCy = faceBox.y + faceBox.height / 2;
          isCentered = Math.abs(faceCx - cx) < w * 0.32 && Math.abs(faceCy - cy) < h * 0.40;
        }
      } else {
        // Run full landmarks for challenge-response or blink checks
        const result = await fa.detectSingleFace(video, opts)
          .withFaceLandmarks();

        if (result) {
          faceBox = result.detection.box;
          const faceCx = faceBox.x + faceBox.width / 2;
          const faceCy = faceBox.y + faceBox.height / 2;
          isCentered = Math.abs(faceCx - cx) < w * 0.32 && Math.abs(faceCy - cy) < h * 0.40;

          // Micro-movement tracking (Printed Photo Rejection)
          faceCenterHistory.push({ x: faceCx, y: faceCy });
          if (faceCenterHistory.length > maxHistorySize) {
            faceCenterHistory.shift();
          }

          if (faceCenterHistory.length >= maxHistorySize) {
            const meanX = faceCenterHistory.reduce((sum, p) => sum + p.x, 0) / faceCenterHistory.length;
            const meanY = faceCenterHistory.reduce((sum, p) => sum + p.y, 0) / faceCenterHistory.length;
            const variance = faceCenterHistory.reduce((sum, p) => sum + Math.pow(p.x - meanX, 2) + Math.pow(p.y - meanY, 2), 0) / faceCenterHistory.length;
            const stdDev = Math.sqrt(variance);

            // Rejects static photos / rigid prints (stdDev is < 0.12 pixels over 15 frames)
            if (stdDev < 0.12) {
              spoofDetected.value = true;
            } else {
              spoofDetected.value = false;
            }
          }

          if (result.landmarks) {
            const pts = result.landmarks.positions;

            // Head Turn Challenge calculations
            if (currentStep.value === 'challenge') {
              const distLeft = Math.hypot(pts[30].x - pts[2].x, pts[30].y - pts[2].y);
              const distRight = Math.hypot(pts[30].x - pts[14].x, pts[30].y - pts[14].y);
              headTurnRatio = distRight > 0 ? distLeft / distRight : 1.0;

              if (challengeType.value === 'left') {
                challengeMet = headTurnRatio > 1.45;
              } else {
                challengeMet = headTurnRatio < 0.65;
              }
            }

            // Eye Aspect Ratio calculations
            if (currentStep.value === 'blink') {
              const leftH = (Math.abs(pts[41].y - pts[37].y) + Math.abs(pts[40].y - pts[38].y)) / 2;
              const leftW = Math.abs(pts[39].x - pts[36].x);
              const leftEAR = leftW > 0 ? leftH / leftW : 0;

              const rightH = (Math.abs(pts[47].y - pts[43].y) + Math.abs(pts[46].y - pts[44].y)) / 2;
              const rightW = Math.abs(pts[45].x - pts[42].x);
              const rightEAR = rightW > 0 ? rightH / rightW : 0;

              const ear = (leftEAR + rightEAR) / 2;
              currentEar.value = ear;

              // Auto-calibrate open eyes max EAR
              if (ear > maxEar) {
                maxEar = ear;
              }

              // Adaptive thresholding
              if (maxEar > 0.10) {
                eyesOpen = ear > maxEar * 0.80;
                eyesClosed = ear < maxEar * 0.65;
              } else {
                eyesOpen = ear > 0.15;
                eyesClosed = ear < 0.10;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Face landmark error:', err);
    } finally {
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

    // Check anti-spoof state
    if (spoofDetected.value && currentStep.value !== 'position') {
      promptMessage.value = 'Static frame detected. Please move naturally.';
      scheduleNext();
      return;
    }

    if (currentStep.value === 'position') {
      progressPercent.value = Math.min(30, (stableFramesCount / 12) * 30);
      promptMessage.value = stableFramesCount < 6 ? 'Face detected! Hold still...' : 'Hold still...';

      if (stableFramesCount >= 12) {
        // Advance to randomized head turn challenge
        currentStep.value = 'challenge';
        challengeType.value = Math.random() > 0.5 ? 'left' : 'right';
        challengeCompleted.value = false;
        faceCenterHistory.length = 0; // reset buffer for liveness checks
        promptMessage.value = challengeType.value === 'left' ? 'Turn your head slightly left' : 'Turn your head slightly right';
        progressPercent.value = 35;
      }

    } else if (currentStep.value === 'challenge') {
      // Prompt head turns
      promptMessage.value = challengeType.value === 'left' 
        ? `Turn head slightly left (Ratio: ${headTurnRatio.toFixed(2)} / Target: >1.45)` 
        : `Turn head slightly right (Ratio: ${headTurnRatio.toFixed(2)} / Target: <0.65)`;

      if (challengeMet) {
        challengeCompleted.value = true;
        currentStep.value = 'blink';
        blinkFrameCount = 0;
        eyesWereOpen = false;
        maxEar = 0;
        promptMessage.value = 'Blink your eyes to capture!';
        progressPercent.value = 65;
      }

    } else if (currentStep.value === 'blink') {
      blinkFrameCount++;

      if (eyesOpen) {
        eyesWereOpen = true;
      }

      promptMessage.value = `Blink your eyes! (Eye Openness: ${Math.round(currentEar.value * 100)}% / Target: ${Math.round(maxEar * 65)}%)`;

      if (eyesWereOpen && eyesClosed) {
        promptMessage.value = 'Blink detected! Get ready...';
        progressPercent.value = 75;
        startCountdown();
        scheduleNext();
        return;
      }
    }

  } else {
    // Face outside oval
    if (currentStep.value !== 'capturing') {
      lastIsCentered = false;
      stableFramesCount = Math.max(0, stableFramesCount - 1);
      progressPercent.value = Math.max(0, progressPercent.value - 3);
      promptMessage.value = 'Keep your face inside the oval';
    }
  }

  scheduleNext();
};

const scheduleNext = () => {
  if (isActive.value && currentStep.value !== 'done') {
    animFrameId = setTimeout(() => {
      if (isActive.value && currentStep.value !== 'done') requestAnimationFrame(detect);
    }, 30);
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

  // Oval border — orange theme
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isGood ? '#f59e0b' : '#c2410c';
  ctx.lineWidth = isGood ? 5 : 4;
  ctx.shadowColor = isGood ? '#f59e0b' : '#c2410c';
  ctx.shadowBlur = isGood ? 16 : 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dashed inner head guide
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.1, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isGood ? 'rgba(245,158,11,0.5)' : 'rgba(194,65,12,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Shoulder guide
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.95, cy + ry * 0.85);
  ctx.quadraticCurveTo(cx - rx * 0.4, cy + ry * 0.55, cx, cy + ry * 0.55);
  ctx.quadraticCurveTo(cx + rx * 0.4, cy + ry * 0.55, cx + rx * 0.95, cy + ry * 0.85);
  ctx.strokeStyle = isGood ? 'rgba(245,158,11,0.5)' : 'rgba(194,65,12,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Progress arc
  if (progressPercent.value > 0) {
    const endAngle = (progressPercent.value / 100) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx + 8, ry + 8, 0, -Math.PI / 2, endAngle);
    ctx.strokeStyle = isGood ? '#f59e0b' : '#c2410c';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.shadowColor = isGood ? '#f59e0b' : '#c2410c';
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }



  ctx.restore();
};

// ============================================================
// Capture — crops oval area, emits image + descriptor
// ============================================================
const performCapture = () => {
  if (!videoRef.value || !captureCanvasRef.value) return;

  // Face MUST be inside oval
  if (!lastIsCentered || !lastFaceBox) {
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
  const rx = vw * 0.22, ry = vh * 0.38;
  const padX = rx * 0.15, padY = ry * 0.08;
  const cropX = Math.max(0, Math.round(cx - rx - padX));
  const cropY = Math.max(0, Math.round(cy - ry - padY));
  const cropW = Math.min(vw - cropX, Math.round((rx + padX) * 2));
  const cropH = Math.min(vh - cropY, Math.round((ry + padY) * 2));

  canvas.width = 320;
  canvas.height = 320;
  
  // Mirror the canvas context so the saved image matches the live preview
  ctx.save();
  ctx.translate(320, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, 320, 320);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

  // Emit image
  emit('update:modelValue', dataUrl);

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
      <button type="button" @click="() => { emit('update:modelValue', ''); }" class="retake-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: auto;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        <span>Retake Photo</span>
      </button>
    </div>

    <!-- Idle / Start State -->
    <div v-else-if="!isActive" class="idle-card card-frame">
      <div class="webcam-placeholder">
        <div class="kyc-icon-ring">
          <span class="camera-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg></span>
        </div>
        <span class="placeholder-title">Automated Biometric Verification</span>
        <span class="placeholder-steps">
          <span class="step-pill">1. Center face in oval</span>
          <span class="step-arrow">—</span>
          <span class="step-pill">2. Turn head</span>
          <span class="step-arrow">—</span>
          <span class="step-pill">3. Blink eyes</span>
          <span class="step-arrow">—</span>
          <span class="step-pill">4. Auto capture</span>
        </span>
        <span v-if="error" class="error-msg">{{ error }}</span>
      </div>
      <button type="button" @click="startWebcam" class="start-btn">
        Start Face Verification
      </button>
    </div>

    <!-- Active Camera Modal Overlay -->
    <Teleport to="body">
      <div v-if="isActive" class="biometric-modal-backdrop" @click.self="stopWebcam">
        <div class="biometric-modal-card">
          <!-- Header -->
          <div class="modal-header">
            <div class="modal-title-group">
              <div class="modal-icon-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
              <div>
                <h3 class="modal-title">Biometric Face Verification</h3>
                <p class="modal-sub">Position face inside oval & blink to capture</p>
              </div>
            </div>
            <button type="button" @click="stopWebcam" class="modal-close-btn">✕</button>
          </div>

          <!-- Step Instruction Banner -->
          <div class="kyc-instruction-banner" :class="currentStep">
            <div class="banner-text">
              <div class="step-title">
                <span v-if="currentStep === 'position'">STEP 1 — CENTER FACE</span>
                <span v-else-if="currentStep === 'challenge'">STEP 2 — TURN HEAD</span>
                <span v-else-if="currentStep === 'blink'">STEP 3 — BLINK TO CAPTURE</span>
                <span v-else-if="currentStep === 'countdown'">GET READY</span>
                <span v-else-if="currentStep === 'capturing'">CAPTURING...</span>
              </div>
              <div class="step-desc">{{ promptMessage }}</div>
            </div>
          </div>

          <!-- Countdown Overlay -->
          <div v-if="currentStep === 'countdown' && countdownValue > 0" class="countdown-overlay">
            <div class="countdown-number">{{ countdownValue }}</div>
          </div>

          <!-- Video + Overlay Container -->
          <div class="camera-viewport">
            <div v-if="isFlashing" class="camera-flash"></div>
            <video ref="videoRef" autoplay playsinline muted class="video-preview"></video>
            <canvas ref="overlayCanvasRef" class="detection-overlay"></canvas>
            <div v-if="cvLoading" class="loading-badge">
              Loading face detection...
            </div>
          </div>

          <!-- Modal Footer Actions -->
          <div class="modal-footer">
            <button type="button" @click="stopWebcam" class="cancel-camera-btn">
              Cancel Camera
            </button>
          </div>
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
  border: 1.5px solid #fed7aa;
  background: #fffbf5;
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
  border: 2px solid #c2410c;
  display: flex; align-items: center; justify-content: center;
  background: rgba(194,65,12,0.06);
  color: #c2410c;
}
.camera-icon { font-size: 32px; color: #c2410c; }
.placeholder-title { font-weight: 700; font-size: 15px; color: #9a3412; }
.placeholder-steps {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
}
.step-pill {
  background: #ffedd5;
  color: #9a3412;
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
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  box-shadow: 0 4px 14px rgba(234, 88, 12, 0.3);
}
.start-btn:hover { background: linear-gradient(135deg, #c2410c, #d97706); transform: translateY(-1px); }

/* Modern Modal Backdrop */
.biometric-modal-backdrop {
  position: fixed; inset: 0; z-index: 999999;
  background: rgba(10, 15, 30, 0.72);
  backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
}

/* Modal Card */
.biometric-modal-card {
  background: #ffffff;
  border-radius: 20px;
  width: 100%; max-width: 580px;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.35);
  display: flex; flex-direction: column;
  overflow: hidden;
  position: relative;
  border: 1px solid #fed7aa;
}

/* Modal Header */
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid #fed7aa;
  background: #fffbf5;
}
.modal-title-group {
  display: flex; align-items: center; gap: 12px;
}
.modal-icon-badge {
  width: 38px; height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px;
  box-shadow: 0 4px 10px rgba(234, 88, 12, 0.25);
}
.modal-title {
  font-size: 16px; font-weight: 800; color: #9a3412; margin: 0;
}
.modal-sub {
  font-size: 12px; color: #78716c; margin: 2px 0 0; font-weight: 500;
}
.modal-close-btn {
  width: 32px; height: 32px;
  border-radius: 8px; border: 1px solid #e2e8f0;
  background: #f8fafc; color: #64748b;
  font-weight: 700; cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center; justify-content: center;
}
.modal-close-btn:hover {
  background: #fee2e2; color: #dc2626; border-color: #fecaca;
}

/* Instruction Banner */
.kyc-instruction-banner {
  margin: 14px 20px 0;
  display: flex; align-items: center; gap: 12px;
  background: linear-gradient(135deg, #c2410c, #ea580c);
  border-radius: 14px;
  padding: 10px 18px;
  box-shadow: 0 4px 14px rgba(194, 65, 12, 0.25);
}
.kyc-instruction-banner.challenge {
  background: linear-gradient(135deg, #c2410c, #ea580c);
  box-shadow: 0 4px 14px rgba(194, 65, 12, 0.25);
}
.kyc-instruction-banner.blink {
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);
}
.kyc-instruction-banner.countdown {
  background: linear-gradient(135deg, #16a34a, #22c55e);
  box-shadow: 0 4px 14px rgba(22, 163, 74, 0.3);
}
.banner-text { display: flex; flex-direction: column; }
.step-title { font-size: 10px; font-weight: 800; color: #fef3c7; letter-spacing: 0.08em; }
.step-desc { font-size: 13.5px; font-weight: 600; color: #fff; }

/* Camera Viewport */
.camera-viewport {
  position: relative;
  width: calc(100% - 40px);
  margin: 14px 20px;
  aspect-ratio: 4/3;
  border-radius: 16px;
  overflow: hidden;
  background: #0a0f1e;
  box-shadow: inset 0 0 20px rgba(0,0,0,0.4);
}
.video-preview { 
  width: 100%; height: 100%; 
  object-fit: cover; 
  transform: scaleX(-1);
}
.detection-overlay {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  transform: scaleX(-1);
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
  background: rgba(194,65,12,0.85);
  color: #fff;
  padding: 10px 20px;
  border-radius: 20px;
  font-size: 13px; font-weight: 600;
  z-index: 10;
}

/* Countdown Overlay */
.countdown-overlay {
  position: absolute;
  top: 14px; left: 50%;
  transform: translateX(-50%);
  z-index: 20;
}
.countdown-number {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  color: #fff;
  font-size: 32px;
  font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 24px rgba(234, 88, 12, 0.45);
  animation: countdown-pulse 1s ease-in-out infinite;
  border: 3px solid rgba(255,255,255,0.3);
}
@keyframes countdown-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

/* Modal Footer */
.modal-footer {
  padding: 12px 20px 16px;
  border-top: 1px solid #fed7aa;
  display: flex; justify-content: flex-end;
  background: #fffbf5;
}
.cancel-camera-btn {
  padding: 8px 20px;
  border-radius: 10px;
  font-size: 13px; font-weight: 700;
  cursor: pointer; border: 1.5px solid #cbd5e1;
  background: #ffffff; color: #475569;
  transition: all 0.2s;
}
.cancel-camera-btn:hover {
  background: #f1f5f9; color: #1e293b; border-color: #94a3b8;
}
</style>
