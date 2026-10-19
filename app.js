/**
 * Motion Detection Spy Cam (PWA)
 * 100% Pure Vanilla JavaScript - Offline Capable - Zero Dependencies
 * Published Ready for GitHub Pages
 */

// Application State
const state = {
  isStreaming: false,
  isArmed: false,
  facingMode: 'environment', // Default rear camera
  stream: null,
  sensitivity: 20, // Default 20%
  motionCount: 0,
  lastTriggerTime: 0,
  cooldownMs: 2500, // Debounce interval between snapshots
  previousFrameData: null,
  detectionIntervalId: null,
  audioCtx: null,
  activeSirenNodes: null,
  isTestingAlarm: false,
  evidence: []
};

// DOM Elements
const videoEl = document.getElementById('cameraFeed');
const motionCanvas = document.getElementById('motionCanvas');
const motionCtx = motionCanvas.getContext('2d', { willReadFrequently: true });
const snapshotCanvas = document.getElementById('snapshotCanvas');
const snapshotCtx = snapshotCanvas.getContext('2d');

const statusBanner = document.getElementById('statusBanner');
const statusMainText = document.getElementById('statusMainText');
const statusSubText = document.getElementById('statusSubText');
const motionCountHUD = document.getElementById('motionCountHUD');

const btnToggleCamera = document.getElementById('btnToggleCamera');
const txtToggleCamera = document.getElementById('txtToggleCamera');
const btnToggleArm = document.getElementById('btnToggleArm');
const txtToggleArm = document.getElementById('txtToggleArm');
const btnSwitchCamera = document.getElementById('btnSwitchCamera');
const btnTestAlarm = document.getElementById('btnTestAlarm');
const txtTestAlarm = document.getElementById('txtTestAlarm');

const liveRecBadge = document.getElementById('liveRecBadge');
const cameraEmptyState = document.getElementById('cameraEmptyState');
const camFacingHUD = document.getElementById('camFacingHUD');
const fpsHUD = document.getElementById('fpsHUD');
const alarmOverlay = document.getElementById('alarmOverlay');
const screenFlash = document.getElementById('screenFlash');

const meterFill = document.getElementById('meterFill');
const thresholdMarker = document.getElementById('thresholdMarker');
const currentMotionVal = document.getElementById('currentMotionVal');
const thresholdVal = document.getElementById('thresholdVal');
const sensitivitySlider = document.getElementById('sensitivitySlider');
const presetButtons = document.querySelectorAll('.btn-preset');

const galleryGrid = document.getElementById('galleryGrid');
const galleryEmptyState = document.getElementById('galleryEmptyState');
const evidenceCountBadge = document.getElementById('evidenceCountBadge');
const btnClearEvidence = document.getElementById('btnClearEvidence');

const lightboxModal = document.getElementById('lightboxModal');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxInfo = document.getElementById('lightboxInfo');
const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');

const liveClockHUD = document.getElementById('liveClockHUD');
const btnPWAInstall = document.getElementById('btnPWAInstall');
const iosInstallModal = document.getElementById('iosInstallModal');
const closeIosGuideBtn = document.getElementById('closeIosGuideBtn');
const offlineToast = document.getElementById('offlineToast');

// Analysis resolution for fast, lag-free motion calculation
const ANALYSIS_WIDTH = 96;
const ANALYSIS_HEIGHT = 72;
motionCanvas.width = ANALYSIS_WIDTH;
motionCanvas.height = ANALYSIS_HEIGHT;

/**
 * 1. Initialize PWA & Offline Support
 */
function initPWA() {
  // Register Service Worker using relative path
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[PWA] Service Worker registered with scope:', reg.scope))
        .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
    });
  }

  // Handle Online/Offline Status
  const updateOnlineStatus = () => {
    if (!navigator.onLine) {
      offlineToast.style.display = 'flex';
    } else {
      offlineToast.style.display = 'none';
    }
  };
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // In-App Install Prompt Handling
  let deferredPrompt = null;
  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

  if (!isStandalone) {
    if (isIOS) {
      btnPWAInstall.style.display = 'inline-flex';
      btnPWAInstall.addEventListener('click', () => {
        iosInstallModal.style.display = 'flex';
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      btnPWAInstall.style.display = 'inline-flex';
    });

    btnPWAInstall.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          btnPWAInstall.style.display = 'none';
        }
        deferredPrompt = null;
      }
    });

    window.addEventListener('appinstalled', () => {
      btnPWAInstall.style.display = 'none';
      deferredPrompt = null;
    });
  }

  closeIosGuideBtn.addEventListener('click', () => {
    iosInstallModal.style.display = 'none';
  });
}

/**
 * 2. Live Clock & HUD
 */
function startLiveClock() {
  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    liveClockHUD.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

/**
 * 3. Web Audio API Alarm Siren
 */
function initAudio() {
  if (!state.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      state.audioCtx = new AudioContextClass();
    }
  }
  if (state.audioCtx && state.audioCtx.state === 'suspended') {
    state.audioCtx.resume();
  }
}

function playSirenSound(durationSeconds = 2.4) {
  try {
    initAudio();
    if (!state.audioCtx) return;

    // Stop existing siren if active
    stopSirenSound();

    const ctx = state.audioCtx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Frequency sweep oscillation: low 600Hz to high 1300Hz
    osc.frequency.setValueAtTime(600, now);

    const cycles = Math.floor(durationSeconds / 0.35);
    for (let i = 0; i < cycles; i++) {
      const step = now + i * 0.35;
      osc.frequency.linearRampToValueAtTime(1300, step + 0.17);
      osc.frequency.linearRampToValueAtTime(600, step + 0.35);
    }

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain.gain.setValueAtTime(0.4, now + durationSeconds - 0.1);
    gain.gain.linearRampToValueAtTime(0, now + durationSeconds);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSeconds);

    state.activeSirenNodes = { osc, gain };

    osc.onended = () => {
      state.activeSirenNodes = null;
      if (state.isTestingAlarm) {
        state.isTestingAlarm = false;
        txtTestAlarm.textContent = 'Test Siren Alarm';
      }
    };
  } catch (err) {
    console.warn('[Audio] Failed to play siren:', err);
  }
}

function stopSirenSound() {
  if (state.activeSirenNodes) {
    try {
      state.activeSirenNodes.gain.gain.linearRampToValueAtTime(0, state.audioCtx.currentTime + 0.05);
      state.activeSirenNodes.osc.stop(state.audioCtx.currentTime + 0.06);
    } catch (_) {}
    state.activeSirenNodes = null;
  }
}

/**
 * 4. Camera Stream Management
 */
async function startCamera() {
  try {
    initAudio();
    if (state.stream) {
      stopCameraTracks();
    }

    const constraints = {
      video: {
        facingMode: state.facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = mediaStream;
    videoEl.srcObject = mediaStream;

    await new Promise((resolve) => {
      videoEl.onloadedmetadata = () => {
        videoEl.play();
        resolve(true);
      };
    });

    state.isStreaming = true;
    cameraEmptyState.style.display = 'none';
    liveRecBadge.style.display = 'inline-flex';
    camFacingHUD.textContent = state.facingMode === 'environment' ? 'CAM: REAR' : 'CAM: FRONT';
    txtToggleCamera.textContent = 'Stop Camera';
    btnToggleCamera.classList.remove('btn-start-camera');
    btnToggleCamera.classList.add('btn-stop-camera');

    // Enable Arm button
    btnToggleArm.disabled = false;
    btnToggleArm.style.opacity = '1';
    btnToggleArm.style.cursor = 'pointer';

    updateStatusUI();
    startMotionDetection();
  } catch (error) {
    console.error('Camera access error:', error);
    alert('Unable to access device camera. Please make sure camera permissions are allowed in your browser settings.');
    stopCamera();
  }
}

function stopCameraTracks() {
  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }
}

function stopCamera() {
  stopMotionDetection();
  stopCameraTracks();

  if (videoEl.srcObject) {
    videoEl.srcObject = null;
  }

  state.isStreaming = false;
  state.isArmed = false;
  state.previousFrameData = null;

  cameraEmptyState.style.display = 'flex';
  liveRecBadge.style.display = 'none';
  fpsHUD.textContent = 'FPS: 0';
  txtToggleCamera.textContent = 'Start Camera';
  btnToggleCamera.classList.remove('btn-stop-camera');
  btnToggleCamera.classList.add('btn-start-camera');

  btnToggleArm.disabled = true;
  btnToggleArm.style.opacity = '0.6';
  btnToggleArm.style.cursor = 'not-allowed';
  btnToggleArm.classList.remove('btn-disarm');
  btnToggleArm.classList.add('btn-arm');
  txtToggleArm.textContent = 'Arm System (ARM)';

  hideAlarmUI();
  updateStatusUI();
}

/**
 * 5. Arm / Disarm Toggle
 */
function toggleArmSystem() {
  if (!state.isStreaming) return;
  initAudio();

  state.isArmed = !state.isArmed;

  if (state.isArmed) {
    btnToggleArm.classList.remove('btn-arm');
    btnToggleArm.classList.add('btn-disarm');
    txtToggleArm.textContent = 'Disarm System (DISARM)';
  } else {
    btnToggleArm.classList.remove('btn-disarm');
    btnToggleArm.classList.add('btn-arm');
    txtToggleArm.textContent = 'Arm System (ARM)';
    hideAlarmUI();
  }

  updateStatusUI();
}

/**
 * 6. Motion Detection Engine
 */
function startMotionDetection() {
  stopMotionDetection();

  let frameCount = 0;
  let lastFpsCalc = Date.now();

  state.detectionIntervalId = setInterval(() => {
    if (!state.isStreaming || videoEl.readyState < 2) return;

    // Draw current frame to hidden analysis canvas
    motionCtx.drawImage(videoEl, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
    const currentFrame = motionCtx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);

    // Live FPS counter
    frameCount++;
    const now = Date.now();
    if (now - lastFpsCalc >= 1000) {
      fpsHUD.textContent = `FPS: ${frameCount}`;
      frameCount = 0;
      lastFpsCalc = now;
    }

    if (!state.previousFrameData) {
      state.previousFrameData = currentFrame;
      return;
    }

    // Motion Differencing Algorithm
    const prevData = state.previousFrameData.data;
    const currData = currentFrame.data;
    const totalPixels = ANALYSIS_WIDTH * ANALYSIS_HEIGHT;
    let changedPixels = 0;

    // Pixel diff threshold (detects meaningful physical change, ignores camera noise)
    const PIXEL_DELTA_THRESHOLD = 32;

    for (let i = 0; i < currData.length; i += 4) {
      const rDiff = Math.abs(currData[i] - prevData[i]);
      const gDiff = Math.abs(currData[i + 1] - prevData[i + 1]);
      const bDiff = Math.abs(currData[i + 2] - prevData[i + 2]);

      const delta = (rDiff + gDiff + bDiff) / 3;
      if (delta > PIXEL_DELTA_THRESHOLD) {
        changedPixels++;
      }
    }

    // Save previous frame
    state.previousFrameData = currentFrame;

    // Calculate motion percentage (0 - 100%)
    const motionPercent = Math.min(100, Math.round((changedPixels / totalPixels) * 100));

    // Update real-time HUD meter
    updateMotionMeter(motionPercent);

    // Check Trigger Threshold
    if (state.isArmed && motionPercent >= state.sensitivity) {
      triggerMotionEvent(motionPercent);
    }
  }, 280); // Sample every ~280ms
}

function stopMotionDetection() {
  if (state.detectionIntervalId) {
    clearInterval(state.detectionIntervalId);
    state.detectionIntervalId = null;
  }
}

function updateMotionMeter(motionPercent) {
  meterFill.style.width = `${motionPercent}%`;
  currentMotionVal.textContent = `${motionPercent}%`;

  if (motionPercent >= state.sensitivity) {
    currentMotionVal.style.color = 'var(--color-crimson)';
  } else {
    currentMotionVal.style.color = 'var(--color-emerald)';
  }
}

/**
 * 7. Trigger Motion Event & Evidence Capture
 */
function triggerMotionEvent(motionPercent) {
  const now = Date.now();
  if (now - state.lastTriggerTime < state.cooldownMs) {
    return; // Inside cooldown period
  }

  state.lastTriggerTime = now;
  state.motionCount++;
  motionCountHUD.textContent = `Events: ${state.motionCount}`;

  // 1. Audio Siren
  playSirenSound(2.5);

  // 2. Visual Alert (Red Screen Flash & Prominent Banner)
  showAlarmUI();

  // 3. Capture Snapshot
  captureEvidenceSnapshot(motionPercent);

  // 4. Update Status Banner to Alarm state
  updateStatusUI(true);

  // Auto clear flashing alarm after 2.5s
  setTimeout(() => {
    hideAlarmUI();
    if (state.isArmed) {
      updateStatusUI();
    }
  }, 2500);
}

function showAlarmUI() {
  alarmOverlay.style.display = 'block';
  screenFlash.classList.add('flash-active');
  setTimeout(() => {
    screenFlash.classList.remove('flash-active');
  }, 350);
}

function hideAlarmUI() {
  alarmOverlay.style.display = 'none';
  screenFlash.classList.remove('flash-active');
}

/**
 * 8. Evidence Snapshot Capture & Forensic Stamping
 */
function captureEvidenceSnapshot(motionPercent) {
  if (!videoEl.videoWidth || !videoEl.videoHeight) return;

  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  snapshotCanvas.width = w;
  snapshotCanvas.height = h;

  // Render high-res video frame
  snapshotCtx.drawImage(videoEl, 0, 0, w, h);

  // Forensic Watermark Bar
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
  const watermarkText = `[SPYCAM EVIDENCE #${state.motionCount}] ${dateStr} ${timeStr} | MOTION: ${motionPercent}%`;

  const barHeight = Math.max(34, Math.floor(h * 0.06));
  snapshotCtx.fillStyle = 'rgba(7, 11, 18, 0.85)';
  snapshotCtx.fillRect(0, h - barHeight, w, barHeight);

  snapshotCtx.fillStyle = '#ff3344';
  snapshotCtx.font = `bold ${Math.floor(barHeight * 0.45)}px monospace`;
  snapshotCtx.textBaseline = 'middle';
  snapshotCtx.fillText(watermarkText, 16, h - (barHeight / 2));

  // Timestamp on top corner
  snapshotCtx.fillStyle = 'rgba(0, 255, 136, 0.9)';
  snapshotCtx.font = `bold ${Math.floor(barHeight * 0.4)}px monospace`;
  snapshotCtx.fillText(timeStr, w - 120, h - (barHeight / 2));

  const dataUrl = snapshotCanvas.toDataURL('image/jpeg', 0.88);
  const evidenceItem = {
    id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    dataUrl,
    timestamp: timeStr,
    fullDate: `${dateStr} ${timeStr}`,
    motionPercent,
    index: state.motionCount
  };

  state.evidence.unshift(evidenceItem);
  saveEvidenceToStorage();
  renderEvidenceGallery();
}

/**
 * 9. Evidence Gallery Rendering
 */
function renderEvidenceGallery() {
  evidenceCountBadge.textContent = `${state.evidence.length} Snapshots`;

  if (state.evidence.length === 0) {
    galleryEmptyState.style.display = 'flex';
    galleryGrid.innerHTML = '';
    return;
  }

  galleryEmptyState.style.display = 'none';
  galleryGrid.innerHTML = '';

  state.evidence.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'evidence-item';

    card.innerHTML = `
      <div class="evidence-thumb-wrap" data-id="${item.id}">
        <img class="evidence-thumb" src="${item.dataUrl}" alt="Evidence #${item.index}" loading="lazy" />
        <div class="evidence-overlay-tag">Motion: ${item.motionPercent}%</div>
      </div>
      <div class="evidence-details">
        <div class="evidence-time">#${item.index} • ${item.timestamp}</div>
        <div class="evidence-buttons">
          <a class="btn-download-item" href="${item.dataUrl}" download="spycam-evidence-${item.index}-${Date.now()}.jpg" title="Download Snapshot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Download</span>
          </a>
          <button class="btn-delete-item" data-delete-id="${item.id}" title="Delete Snapshot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Click to view fullscreen lightbox
    card.querySelector('.evidence-thumb-wrap').addEventListener('click', () => {
      openLightbox(item);
    });

    // Delete item
    card.querySelector('.btn-delete-item').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteEvidenceItem(item.id);
    });

    galleryGrid.appendChild(card);
  });
}

function deleteEvidenceItem(id) {
  state.evidence = state.evidence.filter((item) => item.id !== id);
  saveEvidenceToStorage();
  renderEvidenceGallery();
}

function clearAllEvidence() {
  if (state.evidence.length === 0) return;
  if (confirm('Are you sure you want to clear all captured snapshots?')) {
    state.evidence = [];
    saveEvidenceToStorage();
    renderEvidenceGallery();
  }
}

function openLightbox(item) {
  lightboxImg.src = item.dataUrl;
  lightboxInfo.textContent = `Evidence #${item.index} | Time: ${item.fullDate} | Motion Activity: ${item.motionPercent}%`;
  lightboxDownloadBtn.href = item.dataUrl;
  lightboxDownloadBtn.download = `spycam-evidence-${item.index}.jpg`;
  lightboxModal.classList.add('active');
}

function closeLightbox() {
  lightboxModal.classList.remove('active');
  lightboxImg.src = '';
}

/**
 * 10. Local Storage Persistence
 */
function saveEvidenceToStorage() {
  try {
    // Keep max 25 recent snapshots in storage to prevent quota limits
    const trimmed = state.evidence.slice(0, 25);
    localStorage.setItem('spycam_evidence_store', JSON.stringify(trimmed));
  } catch (err) {
    console.warn('[Storage] LocalStorage quota exceeded, storing in memory:', err);
  }
}

function loadEvidenceFromStorage() {
  try {
    const raw = localStorage.getItem('spycam_evidence_store');
    if (raw) {
      state.evidence = JSON.parse(raw);
      state.motionCount = state.evidence.length;
      motionCountHUD.textContent = `Events: ${state.motionCount}`;
      renderEvidenceGallery();
    }
  } catch (err) {
    console.warn('[Storage] Failed to read evidence from storage:', err);
  }
}

/**
 * 11. Status Banner UI Updates
 */
function updateStatusUI(isAlarming = false) {
  statusBanner.className = 'status-banner';

  if (isAlarming) {
    statusBanner.classList.add('status-alarm');
    statusMainText.textContent = '🚨 MOTION DETECTED!';
    statusSubText.textContent = 'Siren alarm activated and snapshot saved to Evidence Gallery.';
    return;
  }

  if (state.isArmed) {
    statusBanner.classList.add('status-armed');
    statusMainText.textContent = '🟢 SYSTEM ARMED & MONITORING';
    statusSubText.textContent = `Actively watching for movement exceeding ${state.sensitivity}% activity.`;
  } else {
    statusBanner.classList.add('status-disarmed');
    if (state.isStreaming) {
      statusMainText.textContent = '⚪ CAMERA LIVE — SYSTEM DISARMED';
      statusSubText.textContent = 'Click "Arm System (ARM)" to activate motion alerts and alarms.';
    } else {
      statusMainText.textContent = 'SYSTEM DISARMED';
      statusSubText.textContent = "Camera offline. Click 'Start Camera' then 'Arm System'.";
    }
  }
}

/**
 * 12. Sensitivity Adjustments & Presets
 */
function setSensitivity(val, activePreset = null) {
  state.sensitivity = parseInt(val, 10);
  sensitivitySlider.value = state.sensitivity;
  thresholdVal.textContent = `${state.sensitivity}%`;
  thresholdMarker.style.left = `${state.sensitivity}%`;

  presetButtons.forEach((btn) => btn.classList.remove('active'));
  if (activePreset) {
    activePreset.classList.add('active');
  } else {
    // Match closest preset if slider moved manually
    if (state.sensitivity === 10) presetButtons[0]?.classList.add('active');
    else if (state.sensitivity === 20) presetButtons[1]?.classList.add('active');
    else if (state.sensitivity === 35) presetButtons[2]?.classList.add('active');
  }

  if (state.isArmed) {
    updateStatusUI();
  }
}

/**
 * 13. Event Listeners & Wiring
 */
function setupEventListeners() {
  // Camera Start / Stop
  btnToggleCamera.addEventListener('click', () => {
    if (state.isStreaming) {
      stopCamera();
    } else {
      startCamera();
    }
  });

  // Arm / Disarm System
  btnToggleArm.addEventListener('click', toggleArmSystem);

  // Switch Camera Front / Back
  btnSwitchCamera.addEventListener('click', async () => {
    state.facingMode = state.facingMode === 'environment' ? 'user' : 'environment';
    if (state.isStreaming) {
      await startCamera();
    } else {
      camFacingHUD.textContent = state.facingMode === 'environment' ? 'CAM: REAR' : 'CAM: FRONT';
    }
  });

  // Test Siren Audio Button
  btnTestAlarm.addEventListener('click', () => {
    initAudio();
    if (state.isTestingAlarm) {
      stopSirenSound();
      state.isTestingAlarm = false;
      txtTestAlarm.textContent = 'Test Siren Alarm';
    } else {
      state.isTestingAlarm = true;
      txtTestAlarm.textContent = 'Stop Test Siren';
      playSirenSound(3.0);
    }
  });

  // Sensitivity Presets
  presetButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const level = btn.getAttribute('data-level');
      if (level === 'high') setSensitivity(10, btn);
      else if (level === 'medium') setSensitivity(20, btn);
      else if (level === 'low') setSensitivity(35, btn);
    });
  });

  // Sensitivity Slider
  sensitivitySlider.addEventListener('input', (e) => {
    setSensitivity(e.target.value);
  });

  // Clear Evidence Gallery
  btnClearEvidence.addEventListener('click', clearAllEvidence);

  // Lightbox Close Handlers
  lightboxCloseBtn.addEventListener('click', closeLightbox);
  lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeLightbox();
  });
}

// Bootstrap Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initPWA();
  startLiveClock();
  setupEventListeners();
  loadEvidenceFromStorage();
  setSensitivity(20);
  updateStatusUI();
});
