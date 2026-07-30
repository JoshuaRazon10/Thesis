<script setup lang="ts">
import { ref, onBeforeUnmount, nextTick, watch } from 'vue';
import { api } from '@/lib/api';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

// State
const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const isRunning = ref(false);
const isRecognizing = ref(false);
const logMode = ref<'IN' | 'OUT'>('IN');
const statusMessage = ref('Initializing camera...');
const statusType = ref<'idle' | 'success' | 'error' | 'loading' | 'spoof'>('loading');
const modelsReady = ref(false);

// Liveness state
const currentStep = ref<'position' | 'challenge' | 'blink' | 'countdown' | 'result'>('position');
const promptMessage = ref('Position your face in camera');
const countdownValue = ref(0);
const currentEar = ref(0);
const challengeType = ref<'left' | 'right'>('left');
const progressPercent = ref(0);

// Match state
const currentMatch = ref<any>(null);
const matchAccuracy = ref('');
const lastLogTime: Record<string, number> = {};
const recentResults = ref<any[]>([]);

// Tracking variables
let stableCount = 0;
let blinkCount = 0;
let eyesWereOpen = false;
let maxEar = 0;
let captureTimer: any = null;
let animFrameId: any = null;
let isDetecting = false;
const spoofDetected = ref(false);
const faceHistory: { x: number; y: number }[] = [];
const HIST_SIZE = 15;

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
    return true;
  } catch (e) {
    console.error('Model load error:', e);
    return false;
  }
};

// Reset liveness state
const resetLiveness = () => {
  if (currentStep.value === 'result' || currentStep.value === 'countdown') return;
  currentStep.value = 'position';
  promptMessage.value = 'Position your face in camera';
  progressPercent.value = 0;
  countdownValue.value = 0;
  currentEar.value = 0;
  maxEar = 0;
  stableCount = 0;
  blinkCount = 0;
  eyesWereOpen = false;
  spoofDetected.value = false;
  faceHistory.length = 0;
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
};

// Start camera when modal opens
watch(() => props.visible, async (val) => {
  if (val) {
    await nextTick();
    await startCamera();
  } else {
    stopCamera();
  }
});

const startCamera = async () => {
  try {
    statusMessage.value = 'Starting camera...';
    statusType.value = 'loading';

    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });
    stream.value = mediaStream;

    await nextTick();
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
      videoRef.value.play().catch(() => {});

      videoRef.value.addEventListener('loadeddata', async () => {
        // Load face-api models
        if (!modelsReady.value) {
          statusMessage.value = 'Loading face detection models...';
          const ok = await loadModels();
          modelsReady.value = ok;
          if (!ok) {
            statusMessage.value = 'Failed to load face models. Please refresh.';
            statusType.value = 'error';
            return;
          }
        }

        isRunning.value = true;
        statusMessage.value = 'Position your face in the camera';
        statusType.value = 'idle';
        resetLiveness();
        detect();
      }, { once: true });
    }
  } catch (err: any) {
    statusMessage.value = 'Camera access denied. Please allow permissions.';
    statusType.value = 'error';
  }
};

const stopCamera = () => {
  isRunning.value = false;
  if (animFrameId !== null) { clearTimeout(animFrameId); animFrameId = null; }
  if (captureTimer) { clearTimeout(captureTimer); captureTimer = null; }
  if (stream.value) { stream.value.getTracks().forEach(t => t.stop()); stream.value = null; }
  currentMatch.value = null;
  currentStep.value = 'position';
  resetLiveness();
};

// Submit frame to CompreFace for recognition
const submitRecognition = async () => {
  if (isRecognizing.value || !videoRef.value) return;
  isRecognizing.value = true;
  statusMessage.value = 'Matching face...';
  statusType.value = 'loading';

  try {
    // Capture frame
    const hiddenCanvas = document.createElement('canvas');
    hiddenCanvas.width = 640;
    hiddenCanvas.height = 480;
    const ctx = hiddenCanvas.getContext('2d')!;
    ctx.translate(640, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.value, 0, 0, 640, 480);
    const base64Image = hiddenCanvas.toDataURL('image/jpeg', 0.85);

    const res = await api.post('/face/recognize', { image: base64Image });
    isRecognizing.value = false;
    currentStep.value = 'result';

    if (res.success && res.match) {
      const match = res.match;
      const accuracy = (match.similarity * 100).toFixed(1);
      matchAccuracy.value = accuracy;
      currentMatch.value = match;
      statusMessage.value = `Recognized: ${match.name}`;
      statusType.value = 'success';
      promptMessage.value = `Access Granted: ${match.name} (${accuracy}%)`;

      // Auto-log attendance (3 min debounce)
      const logKey = `${match.type}_${match.id}`;
      const now = Date.now();
      if (!lastLogTime[logKey] || now - lastLogTime[logKey] > 180000) {
        lastLogTime[logKey] = now;
        const payload: any = { log_type: logMode.value, method: 'face' };
        payload[`${match.type}_id`] = match.id;

        api.post('/attendance/log', payload).then((logRes: any) => {
          if (logRes.success) {
            recentResults.value.unshift({
              name: match.name,
              type: match.type,
              accuracy,
              logType: logMode.value,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            });
            if (recentResults.value.length > 10) recentResults.value.pop();
          }
        }).catch(() => {
          lastLogTime[logKey] = 0;
        });
      }
    } else {
      currentMatch.value = null;
      statusMessage.value = res.message || 'Face not recognized — below 90% threshold';
      statusType.value = 'error';
      promptMessage.value = res.similarity
        ? `No match (${(res.similarity * 100).toFixed(1)}% similarity — need 90%+)`
        : 'Face not found in database';
    }

    // Hold result 5s then reset for next scan
    captureTimer = setTimeout(() => {
      currentMatch.value = null;
      statusMessage.value = 'Position your face in the camera';
      statusType.value = 'idle';
      currentStep.value = 'position';
      resetLiveness();
      if (isRunning.value) detect();
    }, 5000);

  } catch (err) {
    console.error('Recognition error:', err);
    isRecognizing.value = false;
    currentStep.value = 'position';
    resetLiveness();
    if (isRunning.value) detect();
  }
};

// Start countdown after blink detected
const startCountdown = () => {
  if (currentStep.value === 'countdown' || currentStep.value === 'result') return;
  currentStep.value = 'countdown';
  countdownValue.value = 5;
  promptMessage.value = 'Hold still! Scanning in 5...';
  progressPercent.value = 80;

  const tick = () => {
    if (!isRunning.value || currentStep.value !== 'countdown') return;
    countdownValue.value--;
    if (countdownValue.value <= 0) {
      submitRecognition();
    } else {
      promptMessage.value = `Hold still! Scanning in ${countdownValue.value}...`;
      captureTimer = setTimeout(tick, 1000);
    }
  };
  captureTimer = setTimeout(tick, 1000);
};

// Main detection loop with liveness
const detect = async () => {
  if (!isRunning.value || currentStep.value === 'result' || currentStep.value === 'countdown' || isDetecting) return;
  if (!videoRef.value || videoRef.value.readyState < 2) {
    animFrameId = setTimeout(detect, 50);
    return;
  }

  // Draw overlay on canvas
  const video = videoRef.value;
  const canvas = canvasRef.value;
  if (!canvas) { animFrameId = setTimeout(detect, 50); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) { animFrameId = setTimeout(detect, 50); return; }

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
        const result = await fa.detectSingleFace(video, opts);
        if (result) {
          faceBox = result.box;
          const fcx = faceBox.x + faceBox.width / 2;
          const fcy = faceBox.y + faceBox.height / 2;
          isCentered = Math.abs(fcx - cx) < w * 0.32 && Math.abs(fcy - cy) < h * 0.40;
        }
      } else {
        const result = await fa.detectSingleFace(video, opts).withFaceLandmarks();
        if (result) {
          faceBox = result.detection.box;
          const fcx = faceBox.x + faceBox.width / 2;
          const fcy = faceBox.y + faceBox.height / 2;
          isCentered = Math.abs(fcx - cx) < w * 0.32 && Math.abs(fcy - cy) < h * 0.40;

          // Micro-movement tracking
          faceHistory.push({ x: fcx, y: fcy });
          if (faceHistory.length > HIST_SIZE) faceHistory.shift();
          if (faceHistory.length >= HIST_SIZE) {
            const mx = faceHistory.reduce((s, p) => s + p.x, 0) / faceHistory.length;
            const my = faceHistory.reduce((s, p) => s + p.y, 0) / faceHistory.length;
            const v = faceHistory.reduce((s, p) => s + (p.x - mx) ** 2 + (p.y - my) ** 2, 0) / faceHistory.length;
            spoofDetected.value = Math.sqrt(v) < 0.12;
          }

          if (result.landmarks) {
            const pts = result.landmarks.positions;

            // Head turn challenge
            if (currentStep.value === 'challenge') {
              const distLeft = Math.hypot(pts[30].x - pts[2].x, pts[30].y - pts[2].y);
              const distRight = Math.hypot(pts[30].x - pts[14].x, pts[30].y - pts[14].y);
              headTurnRatio = distRight > 0 ? distLeft / distRight : 1.0;
              challengeMet = challengeType.value === 'left' ? headTurnRatio > 1.45 : headTurnRatio < 0.65;
            }

            // Eye aspect ratio
            if (currentStep.value === 'blink') {
              const lH = (Math.abs(pts[41].y - pts[37].y) + Math.abs(pts[40].y - pts[38].y)) / 2;
              const lW = Math.abs(pts[39].x - pts[36].x);
              const lEAR = lW > 0 ? lH / lW : 0;
              const rH = (Math.abs(pts[47].y - pts[43].y) + Math.abs(pts[46].y - pts[44].y)) / 2;
              const rW = Math.abs(pts[45].x - pts[42].x);
              const rEAR = rW > 0 ? rH / rW : 0;
              const ear = (lEAR + rEAR) / 2;
              currentEar.value = ear;
              if (ear > maxEar) maxEar = ear;
              if (maxEar > 0.10) { eyesOpen = ear > maxEar * 0.80; eyesClosed = ear < maxEar * 0.65; }
              else { eyesOpen = ear > 0.15; eyesClosed = ear < 0.10; }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Detection error:', e);
    } finally {
      isDetecting = false;
    }
  }

  // Draw oval overlay
  drawOverlay(ctx, w, h, cx, cy, rx, ry, isCentered);

  // Step machine
  if (!faceBox) {
    resetLiveness();
  } else if (isCentered) {
    stableCount++;

    if (spoofDetected.value && currentStep.value !== 'position') {
      promptMessage.value = 'Static image detected — Move naturally';
      statusMessage.value = 'Spoof attempt blocked';
      statusType.value = 'spoof';
      scheduleNext(); return;
    }

    if (currentStep.value === 'position') {
      progressPercent.value = Math.min(30, (stableCount / 12) * 30);
      promptMessage.value = stableCount < 6 ? 'Face detected! Hold still...' : 'Hold still...';
      if (stableCount >= 12) {
        currentStep.value = 'challenge';
        challengeType.value = Math.random() > 0.5 ? 'left' : 'right';
        faceHistory.length = 0;
        promptMessage.value = challengeType.value === 'left' ? 'Turn your head slightly left' : 'Turn your head slightly right';
        progressPercent.value = 35;
      }
    } else if (currentStep.value === 'challenge') {
      promptMessage.value = challengeType.value === 'left'
        ? `Turn head left (${headTurnRatio.toFixed(2)} / target: >1.45)`
        : `Turn head right (${headTurnRatio.toFixed(2)} / target: <0.65)`;
      if (challengeMet) {
        currentStep.value = 'blink';
        blinkCount = 0; eyesWereOpen = false; maxEar = 0;
        promptMessage.value = 'Blink your eyes!';
        progressPercent.value = 65;
      }
    } else if (currentStep.value === 'blink') {
      blinkCount++;
      if (eyesOpen) eyesWereOpen = true;
      promptMessage.value = `Blink! (${Math.round(currentEar.value * 100)}% / target: ${Math.round(maxEar * 65)}%)`;
      if (eyesWereOpen && eyesClosed) {
        promptMessage.value = 'Blink detected! Get ready...';
        progressPercent.value = 75;
        startCountdown();
        scheduleNext(); return;
      }
    }
  } else {
    stableCount = Math.max(0, stableCount - 1);
    progressPercent.value = Math.max(0, progressPercent.value - 3);
    promptMessage.value = 'Keep your face in the oval';
  }

  scheduleNext();
};

const scheduleNext = () => {
  if (isRunning.value && currentStep.value !== 'result') {
    animFrameId = setTimeout(() => {
      if (isRunning.value && currentStep.value !== 'result') requestAnimationFrame(detect);
    }, 30);
  }
};

// Draw overlay with oval guide
const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  cx: number, cy: number,
  rx: number, ry: number,
  isGood: boolean
) => {
  ctx.save();
  ctx.clearRect(0, 0, w, h);

  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(0, 0, w, h);

  // Cut out oval
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // Oval border
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isGood ? '#f59e0b' : '#c2410c';
  ctx.lineWidth = isGood ? 5 : 4;
  ctx.shadowColor = isGood ? '#f59e0b' : '#c2410c';
  ctx.shadowBlur = isGood ? 16 : 8;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Dashed inner guide
  ctx.beginPath();
  ctx.ellipse(cx, cy - ry * 0.1, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
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

const handleClose = () => {
  stopCamera();
  emit('close');
};

onBeforeUnmount(() => stopCamera());
</script>

<template>
  <Teleport to="body">
    <Transition name="scanner-fade">
      <div v-if="visible" class="scanner-backdrop" @click.self="handleClose">
        <div class="scanner-modal">
          <!-- Header -->
          <div class="scanner-header">
            <div class="scanner-title-group">
              <div class="scanner-icon-badge">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M9 12l2 2 4-4"/>
                </svg>
              </div>
              <div>
                <h2 class="scanner-title">Face Recognition Scanner</h2>
                <p class="scanner-subtitle">Liveness-verified biometric attendance</p>
              </div>
            </div>
            <button class="close-btn" @click="handleClose">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Mode Toggle -->
          <div class="mode-bar">
            <button :class="['mode-btn', { active: logMode === 'IN' }]" @click="logMode = 'IN'">
              Time In
            </button>
            <button :class="['mode-btn mode-out', { active: logMode === 'OUT' }]" @click="logMode = 'OUT'">
              Time Out
            </button>
            <div class="mode-indicator" :class="logMode.toLowerCase()">
              {{ logMode === 'IN' ? 'TIME IN' : 'TIME OUT' }}
            </div>
          </div>

          <!-- Main Content -->
          <div class="scanner-body">
            <!-- Camera Feed -->
            <div class="camera-section">
              <div class="camera-container">
                <video ref="videoRef" autoplay playsinline muted class="camera-feed"></video>
                <canvas ref="canvasRef" class="camera-overlay"></canvas>

                <!-- Liveness Step Banner -->
                <div :class="['liveness-banner', currentStep]">
                  <div class="liveness-step-label">
                    <span v-if="currentStep === 'position'">STEP 1 — CENTER FACE</span>
                    <span v-else-if="currentStep === 'challenge'">STEP 2 — TURN HEAD</span>
                    <span v-else-if="currentStep === 'blink'">STEP 3 — BLINK</span>
                    <span v-else-if="currentStep === 'countdown'">VERIFIED — SCANNING</span>
                    <span v-else-if="currentStep === 'result'">COMPLETE</span>
                  </div>
                  <div class="liveness-step-msg">{{ promptMessage }}</div>
                </div>

                <!-- Countdown Overlay -->
                <div v-if="currentStep === 'countdown' && countdownValue > 0" class="countdown-wrap">
                  <div class="countdown-num">{{ countdownValue }}</div>
                </div>

                <!-- Status pill -->
                <div :class="['status-pill', statusType]">
                  <span class="status-dot"></span>
                  {{ statusMessage }}
                </div>

                <!-- Processing indicator -->
                <div v-if="isRecognizing" class="processing-badge">
                  <div class="pulse-ring"></div>
                  Matching...
                </div>
              </div>
            </div>

            <!-- Right Panel -->
            <div class="info-panel">
              <!-- Match Card -->
              <div v-if="currentMatch" class="match-card match-found">
                <div class="match-header">
                  <div class="match-avatar">
                    <img v-if="currentMatch.face_encoding" :src="currentMatch.face_encoding" alt="Face" />
                    <div v-else class="avatar-placeholder">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>
                    </div>
                  </div>
                  <div class="match-info">
                    <h3 class="match-name">{{ currentMatch.name }}</h3>
                    <span class="match-type-badge">{{ currentMatch.type?.toUpperCase() }}</span>
                  </div>
                </div>
                <div class="match-details">
                  <div v-if="currentMatch.type === 'student'" class="detail-row">
                    <span class="detail-label">Student No</span>
                    <span class="detail-value">{{ currentMatch.student_no }}</span>
                  </div>
                  <div v-if="currentMatch.grade_level" class="detail-row">
                    <span class="detail-label">Grade</span>
                    <span class="detail-value">{{ currentMatch.grade_level }}</span>
                  </div>
                  <div v-if="currentMatch.section" class="detail-row">
                    <span class="detail-label">Section</span>
                    <span class="detail-value">{{ currentMatch.section }}</span>
                  </div>
                  <div class="detail-row accuracy-row">
                    <span class="detail-label">Confidence</span>
                    <span class="detail-value accuracy">{{ matchAccuracy }}%</span>
                  </div>
                </div>
              </div>

              <!-- No Match Card -->
              <div v-else class="match-card no-match">
                <div class="no-match-content">
                  <div class="no-match-icon">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <circle cx="12" cy="8" r="4"/>
                      <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    </svg>
                  </div>
                  <p class="no-match-text">Liveness verification required</p>
                  <p class="no-match-hint">Center face → Turn head → Blink → Auto scan</p>
                </div>
              </div>

              <!-- Recent Activity Log -->
              <div class="activity-section">
                <h4 class="activity-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Recent Logs
                </h4>
                <div v-if="recentResults.length === 0" class="empty-activity">
                  No logs yet — verified faces will be logged here
                </div>
                <div v-else class="activity-list">
                  <div v-for="(r, i) in recentResults" :key="i" class="activity-item">
                    <div :class="['log-badge', r.logType.toLowerCase()]">{{ r.logType }}</div>
                    <div class="activity-details">
                      <span class="activity-name">{{ r.name }}</span>
                      <span class="activity-meta">{{ r.accuracy }}% · {{ r.time }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* ══════════════════════════════════════════
   BACKDROP & MODAL
   ══════════════════════════════════════════ */
.scanner-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(10, 15, 30, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.scanner-modal {
  background: #fff;
  border-radius: 20px;
  width: 100%;
  max-width: 920px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  border: 1px solid #fed7aa;
}

/* ══════════════════════════════════════════
   HEADER — Orange Theme
   ══════════════════════════════════════════ */
.scanner-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #fed7aa;
  background: #fffbf5;
}

.scanner-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
}

.scanner-icon-badge {
  width: 44px; height: 44px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
}

.scanner-title {
  font-size: 17px;
  font-weight: 800;
  color: #9a3412;
  margin: 0;
}

.scanner-subtitle {
  font-size: 12px;
  color: #78716c;
  margin: 2px 0 0;
  font-weight: 500;
}

.close-btn {
  width: 36px; height: 36px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  color: #64748b;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}
.close-btn:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

/* ══════════════════════════════════════════
   MODE BAR — Orange Theme
   ══════════════════════════════════════════ */
.mode-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  background: #fffbf5;
  border-bottom: 1px solid #fed7aa;
}

.mode-btn {
  padding: 8px 18px;
  border-radius: 10px;
  border: 1.5px solid #fed7aa;
  background: #fff;
  font-size: 13px;
  font-weight: 700;
  color: #9a3412;
  cursor: pointer;
  transition: all 0.2s;
  display: flex; align-items: center; gap: 6px;
}
.mode-btn.active {
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  color: #fff;
  border-color: #ea580c;
  box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
}
.mode-btn.mode-out.active {
  background: #dc2626;
  border-color: #dc2626;
  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);
}

.mode-indicator {
  margin-left: auto;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: #ea580c;
}
.mode-indicator.out { color: #dc2626; }

/* ══════════════════════════════════════════
   BODY LAYOUT
   ══════════════════════════════════════════ */
.scanner-body {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 0;
  min-height: 400px;
}

@media (max-width: 768px) {
  .scanner-body {
    grid-template-columns: 1fr;
  }
}

/* ══════════════════════════════════════════
   CAMERA SECTION
   ══════════════════════════════════════════ */
.camera-section {
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-container {
  position: relative;
  width: 100%;
  aspect-ratio: 4/3;
  border-radius: 16px;
  overflow: hidden;
  background: #0a0f1e;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  border: 2px solid #fed7aa;
}

.camera-feed {
  width: 100%; height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}

.camera-overlay {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  transform: scaleX(-1);
}

/* Liveness Step Banner */
.liveness-banner {
  position: absolute;
  top: 10px; left: 10px; right: 10px;
  border-radius: 10px;
  padding: 8px 14px;
  z-index: 10;
  background: linear-gradient(135deg, #c2410c, #ea580c);
  box-shadow: 0 4px 14px rgba(194, 65, 12, 0.3);
}
.liveness-banner.challenge {
  background: linear-gradient(135deg, #c2410c, #ea580c);
}
.liveness-banner.blink {
  background: linear-gradient(135deg, #ea580c, #f59e0b);
}
.liveness-banner.countdown {
  background: linear-gradient(135deg, #16a34a, #22c55e);
}
.liveness-banner.result {
  background: linear-gradient(135deg, #15803d, #22c55e);
}

.liveness-step-label {
  font-size: 9px;
  font-weight: 800;
  color: #fef3c7;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.liveness-step-msg {
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  margin-top: 1px;
}

/* Countdown */
.countdown-wrap {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
}
.countdown-num {
  width: 64px; height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ea580c, #f59e0b);
  color: #fff;
  font-size: 32px; font-weight: 900;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 24px rgba(234, 88, 12, 0.45);
  animation: cd-pulse 1s ease-in-out infinite;
  border: 3px solid rgba(255,255,255,0.3);
}
@keyframes cd-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }

/* Status pill */
.status-pill {
  position: absolute;
  bottom: 10px; left: 50%;
  transform: translateX(-50%);
  padding: 5px 14px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 700;
  z-index: 6;
  display: flex; align-items: center; gap: 8px;
  backdrop-filter: blur(10px);
  white-space: nowrap;
}
.status-pill.idle { background: rgba(20, 30, 50, 0.75); color: #cbd5e1; }
.status-pill.success { background: rgba(22, 163, 74, 0.85); color: #fff; }
.status-pill.error { background: rgba(220, 38, 38, 0.85); color: #fff; }
.status-pill.loading { background: rgba(234, 88, 12, 0.85); color: #fff; }
.status-pill.spoof { background: rgba(220, 38, 38, 0.9); color: #fff; }

.status-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  animation: pulse-dot 1.5s infinite;
}
.idle .status-dot { background: #94a3b8; }
.success .status-dot { background: #4ade80; }
.error .status-dot { background: #f87171; }
.loading .status-dot { background: #fbbf24; }
.spoof .status-dot { background: #f87171; }

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Processing badge */
.processing-badge {
  position: absolute;
  top: 60px; right: 10px;
  padding: 5px 14px;
  border-radius: 20px;
  background: rgba(234, 88, 12, 0.85);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  z-index: 6;
  display: flex; align-items: center; gap: 8px;
  backdrop-filter: blur(6px);
}

.pulse-ring {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: #fbbf24;
  animation: pulse-ring-anim 1s infinite;
}
@keyframes pulse-ring-anim {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(2); opacity: 0; }
}

/* ══════════════════════════════════════════
   INFO PANEL — Orange Theme
   ══════════════════════════════════════════ */
.info-panel {
  padding: 20px;
  border-left: 1px solid #fed7aa;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #fffbf5;
  border-radius: 0 0 20px 0;
}

@media (max-width: 768px) {
  .info-panel { border-left: none; border-top: 1px solid #fed7aa; border-radius: 0 0 20px 20px; }
}

/* Match Card */
.match-card {
  border-radius: 14px;
  padding: 18px;
  transition: all 0.3s;
}

.match-found {
  background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
  border: 1.5px solid #86efac;
  box-shadow: 0 4px 16px rgba(22, 163, 74, 0.1);
}

.no-match {
  background: #fff7ed;
  border: 1.5px dashed #fed7aa;
}

.match-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.match-avatar {
  width: 52px; height: 52px;
  border-radius: 14px;
  overflow: hidden;
  background: #ffedd5;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
}
.match-avatar img { width: 100%; height: 100%; object-fit: cover; }
.avatar-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 24px;
  background: #ffedd5;
  color: #ea580c;
}

.match-name {
  font-size: 16px;
  font-weight: 800;
  color: #15803d;
  margin: 0 0 4px;
}

.match-type-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 20px;
  background: #dcfce7;
  color: #166534;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.match-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
}

.detail-label {
  font-size: 11px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-value {
  font-size: 13px;
  font-weight: 700;
  color: #1a2b4a;
}

.detail-value.accuracy {
  color: #16a34a;
  font-size: 15px;
  font-weight: 900;
}

/* No match */
.no-match-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 0;
  text-align: center;
}
.no-match-icon { color: #ea580c; }
.no-match-text { font-size: 14px; font-weight: 700; color: #9a3412; margin: 0; }
.no-match-hint { font-size: 12px; color: #78716c; margin: 0; }

/* ══════════════════════════════════════════
   ACTIVITY SECTION
   ══════════════════════════════════════════ */
.activity-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.activity-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 800;
  color: #9a3412;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 10px;
}

.empty-activity {
  font-size: 12px;
  color: #78716c;
  text-align: center;
  padding: 20px 10px;
  border: 1.5px dashed #fed7aa;
  border-radius: 10px;
}

.activity-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  max-height: 180px;
}

.activity-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #fed7aa;
  transition: all 0.2s;
}
.activity-item:hover { border-color: #f59e0b; }

.log-badge {
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
.log-badge.in { background: #dcfce7; color: #166534; }
.log-badge.out { background: #fee2e2; color: #991b1b; }

.activity-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.activity-name {
  font-size: 13px;
  font-weight: 700;
  color: #9a3412;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.activity-meta {
  font-size: 11px;
  color: #78716c;
  font-weight: 500;
}

/* ══════════════════════════════════════════
   TRANSITIONS
   ══════════════════════════════════════════ */
.scanner-fade-enter-active, .scanner-fade-leave-active {
  transition: opacity 0.3s ease;
}
.scanner-fade-enter-active .scanner-modal, .scanner-fade-leave-active .scanner-modal {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.scanner-fade-enter-from, .scanner-fade-leave-to {
  opacity: 0;
}
.scanner-fade-enter-from .scanner-modal {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}
.scanner-fade-leave-to .scanner-modal {
  transform: scale(0.95) translateY(20px);
  opacity: 0;
}
</style>
