<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue';

const props = defineProps<{
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const isActive = ref(false);
const error = ref('');

const startWebcam = async () => {
  error.value = '';
  try {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: 'user' },
      audio: false
    });
    stream.value = mediaStream;
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream;
    }
    isActive.value = true;
  } catch (err: any) {
    console.error('Webcam access error:', err);
    error.value = 'Failed to access webcam. Please ensure camera permissions are granted.';
  }
};

const stopWebcam = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    stream.value = null;
  }
  isActive.value = false;
};

const capture = () => {
  if (videoRef.value && canvasRef.value) {
    const video = videoRef.value;
    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      emit('update:modelValue', dataUrl);
      stopWebcam();
    }
  }
};

const retake = () => {
  emit('update:modelValue', '');
  startWebcam();
};

onBeforeUnmount(() => {
  stopWebcam();
});
</script>

<template>
  <div class="webcam-capture">
    <!-- Image Preview State -->
    <div v-if="modelValue" class="preview-container">
      <img :src="modelValue" alt="Captured Face" class="captured-image" />
      <div class="controls-overlay">
        <button type="button" @click="retake" class="action-btn retake-btn">
          🔄 Retake Photo
        </button>
      </div>
    </div>

    <!-- Active Webcam Stream State -->
    <div v-else-if="isActive" class="stream-container">
      <video ref="videoRef" autoplay playsinline class="video-preview"></video>
      <div class="controls-overlay">
        <button type="button" @click="capture" class="action-btn capture-btn">
          📸 Take Photo
        </button>
        <button type="button" @click="stopWebcam" class="action-btn stop-btn">
          ✕ Cancel
        </button>
      </div>
    </div>

    <!-- Closed/Idle State -->
    <div v-else class="idle-container">
      <div class="webcam-placeholder">
        <span class="camera-icon">📷</span>
        <span class="placeholder-text">Camera stream is inactive</span>
        <span v-if="error" class="error-msg">⚠️ {{ error }}</span>
      </div>
      <button type="button" @click="startWebcam" class="start-btn">
        🚀 Start Camera
      </button>
    </div>

    <!-- Hidden canvas for processing snapshots -->
    <canvas ref="canvasRef" style="display: none;"></canvas>
  </div>
</template>

<style scoped>
.webcam-capture {
  width: 100%;
  border-radius: var(--radius-lg);
  border: 1.5px solid var(--divider);
  background: #f8fafc;
  overflow: hidden;
  position: relative;
  aspect-ratio: 4 / 3;
}

.preview-container, .stream-container, .idle-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.captured-image, .video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.controls-overlay {
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 12px;
  z-index: 10;
}

.action-btn {
  padding: 10px 18px;
  border-radius: 9999px;
  font-family: inherit;
  font-weight: 700;
  font-size: 13.5px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
  transition: var(--transition);
}

.capture-btn {
  background: var(--accent);
  color: var(--primary-dark);
}

.capture-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 16px rgba(245, 166, 35, 0.3);
}

.retake-btn, .stop-btn {
  background: white;
  color: var(--text-main);
}

.retake-btn:hover, .stop-btn:hover {
  background: #f1f5f9;
  transform: scale(1.05);
}

.webcam-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}

.camera-icon {
  font-size: 48px;
}

.placeholder-text {
  font-weight: 600;
  font-size: 14.5px;
  color: var(--text-muted);
}

.error-msg {
  color: var(--danger);
  font-weight: 700;
  font-size: 13px;
  text-align: center;
  max-width: 80%;
  margin-top: 8px;
}

.start-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 9999px;
  font-family: inherit;
  font-weight: 700;
  font-size: 14.5px;
  cursor: pointer;
  box-shadow: var(--shadow-primary);
  transition: var(--transition);
}

.start-btn:hover {
  transform: translateY(-2px);
  background: var(--primary-light);
  box-shadow: 0 6px 16px rgba(30, 58, 95, 0.3);
}
</style>
