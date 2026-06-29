/* ═══════════════════ SCRIPT.JS ═══════════════════ */
/* Main dashboard logic: MediaPipe integration, session timer, wiring all modules */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    /* ── Navbar scroll ── */
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 30);
        });
    }

    /* ── Guard: only run detection logic on dashboard ── */
    const startCamBtn = document.getElementById('startCamBtn');
    if (!startCamBtn) return;

    /* ── DOM refs ── */
    const webcamVideo = document.getElementById('webcamVideo');
    const outputCanvas = document.getElementById('outputCanvas');
    const startOverlay = document.getElementById('startOverlay');
    const stopOverlay = document.getElementById('stopOverlay');
    const systemStatus = document.getElementById('systemStatus');
    const toggleCamBtn = document.getElementById('toggleCamBtn');
    const toggleBtnIcon = document.getElementById('toggleBtnIcon');
    const toggleBtnText = document.getElementById('toggleBtnText');
    const stopCamBtn = document.getElementById('stopCamBtn');
    const valEmotion = document.getElementById('valEmotion');
    const valBlinks = document.getElementById('valBlinks');
    const valAttention = document.getElementById('valAttention');
    const timerValue = document.getElementById('timerValue');

    /* ── State ── */
    let isRunning = false;
    let camera = null;
    let holistic = null;
    let isBlinking = false;
    let blinkCount = 0;
    let sessionStartTime = 0;
    let timerInterval = null;
    let postureScores = [];
    let currentPostureScore = 0;
    let currentAttentionScore = 0;
    let currentPostureIssue = 'good';
    let lastGraphUpdate = 0;
    const GRAPH_INTERVAL = 1000; // Feed graph once per second

    const getDist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    /* Dashed line drawing helper for biomechanical vectors */
    function drawDashedLine(ctx, x1, y1, x2, y2, color = 'rgba(255,255,255,0.4)', lineWidth = 1, lineDash = [4, 4]) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(lineDash);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
    }

    /* ── Session Timer ── */
    function startTimer() {
        sessionStartTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
            const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
            const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
            const s = String(elapsed % 60).padStart(2, '0');
            if (timerValue) timerValue.textContent = h + ':' + m + ':' + s;
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }

    function getSessionDuration() {
        return sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0;
    }

    /* ── MediaPipe Results Handler ── */
    function onResults(results) {
        currentPostureIssue = 'good'; // Reset issue state for this frame

        const ctx = outputCanvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);

        let ear = 0.3;
        let isHeadTilt = false;
        let isNeckForward = false;
        
        let headAngleVal = null;
        let shoulderAngleVal = null;
        let neckAngleVal = null;
        let shoulderDiff = 0.0;

        /* Face Mesh */
        if (results.faceLandmarks) {
            window.drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_TESSELATION, { color: 'rgba(0,212,255,0.15)', lineWidth: 1 });
            window.drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_RIGHT_EYE, { color: '#22c55e', lineWidth: 2 });
            window.drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_LEFT_EYE, { color: '#22c55e', lineWidth: 2 });

            const face = results.faceLandmarks;

            // Blinks (EAR)
            const leftEyeH = getDist(face[159], face[145]);
            const rightEyeH = getDist(face[386], face[374]);
            const eyeWidth = getDist(face[33], face[133]);
            ear = (leftEyeH + rightEyeH) / (2 * eyeWidth);
            if (ear < 0.16) {
                if (!isBlinking) { blinkCount++; if (valBlinks) valBlinks.textContent = blinkCount; isBlinking = true; }
            } else { isBlinking = false; }

            // Emotion
            const mouthW = getDist(face[61], face[291]);
            const mouthH = getDist(face[13], face[14]);
            const mar = mouthH / mouthW;
            const faceW = getDist(face[234], face[454]);
            if (mar > 0.4) {
                if (valEmotion) { valEmotion.textContent = '😮 Surprised'; valEmotion.style.color = '#eab308'; }
            } else if (mouthW > 0.4 * faceW) {
                if (valEmotion) { valEmotion.textContent = '🙂 Happy'; valEmotion.style.color = '#22c55e'; }
            } else {
                if (valEmotion) { valEmotion.textContent = '😐 Neutral'; valEmotion.style.color = 'var(--text-primary)'; }
            }

            // Attention (gaze)
            const noseX = face[1].x;
            const noseY = face[1].y;
            if (noseX > 0.35 && noseX < 0.65 && noseY > 0.3 && noseY < 0.75) {
                currentAttentionScore = 75 + Math.floor(Math.random() * 20);
            } else {
                currentAttentionScore = 20 + Math.floor(Math.random() * 25);
            }
            if (valAttention) {
                valAttention.textContent = currentAttentionScore + '%';
                valAttention.style.color = currentAttentionScore >= 50 ? '#22c55e' : '#ef4444';
            }

            // Head tilt detection
            const leftEar = face[234];
            const rightEar = face[454];
            const headTilt = Math.abs(leftEar.y - rightEar.y);
            if (headTilt > 0.04) {
                currentPostureIssue = 'headTilt';
                isHeadTilt = true;
            }

            // Forward head detection (nose significantly ahead of ears in z)
            const noseZ = face[1].z || 0;
            const earZ = (face[234].z + face[454].z) / 2 || 0;
            if (noseZ < earZ - 0.06) {
                currentPostureIssue = 'forwardHead';
                isNeckForward = true;
            }

            // Save pixel coordinates for computing head tilt angle (No screen drawing!)
            const le_x = leftEar.x * outputCanvas.width;
            const le_y = leftEar.y * outputCanvas.height;
            const re_x = rightEar.x * outputCanvas.width;
            const re_y = rightEar.y * outputCanvas.height;
            
            const dx_hd = re_x - le_x;
            const dy_hd = re_y - le_y;
            headAngleVal = Math.abs(Math.atan2(dy_hd, dx_hd) * 180 / Math.PI);
        } else {
            if (valAttention) { valAttention.textContent = '--'; valAttention.style.color = 'var(--text-primary)'; }
            if (valEmotion) { valEmotion.textContent = '😐 Neutral'; valEmotion.style.color = 'var(--text-primary)'; }
        }

        /* Pose */
        if (results.poseLandmarks) {
            window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: 'rgba(168,85,247,0.3)', lineWidth: 3 });
            window.drawLandmarks(ctx, results.poseLandmarks, { color: '#00d4ff', lineWidth: 2, radius: 3 });

            const pose = results.poseLandmarks;
            const sl = pose[11];
            const sr = pose[12];
            
            const sl_x = sl.x * outputCanvas.width;
            const sl_y = sl.y * outputCanvas.height;
            const sr_x = sr.x * outputCanvas.width;
            const sr_y = sr.y * outputCanvas.height;

            shoulderDiff = Math.abs(sl.y - sr.y);
            let score = 100 - Math.floor(shoulderDiff * 800);
            score = Math.max(0, Math.min(100, score));
            currentPostureScore = score;

            // Slouching detection
            if (score < 60) {
                currentPostureIssue = 'slouching';
            }

            postureScores.push(score);

            // Calculate Shoulder Angle (No screen drawing!)
            const dx_sh = sr_x - sl_x;
            const dy_sh = sr_y - sl_y;
            shoulderAngleVal = Math.abs(Math.atan2(dy_sh, dx_sh) * 180 / Math.PI);

            // Calculate Head-Neck Angle (No screen drawing!)
            const mid_sh_x = (sl_x + sr_x) / 2;
            const mid_sh_y = (sl_y + sr_y) / 2;
            const nose_pose = pose[0];
            const nose_x = nose_pose.x * outputCanvas.width;
            const nose_y = nose_pose.y * outputCanvas.height;

            const dx_nk = nose_x - mid_sh_x;
            const dy_nk = mid_sh_y - nose_y; // upward positive
            neckAngleVal = Math.abs(Math.atan2(dx_nk, dy_nk) * 180 / Math.PI);

            // Update gauge
            if (typeof PostureGauge !== 'undefined') PostureGauge.setScore(score);

            // Update alerts
            if (typeof SmartAlerts !== 'undefined') SmartAlerts.update(score, currentAttentionScore);

            // Feed real-time posture graph (throttled to 1/sec)
            const now = Date.now();
            if (now - lastGraphUpdate >= GRAPH_INTERVAL) {
                lastGraphUpdate = now;
                if (typeof PostureGraph !== 'undefined') PostureGraph.addScore(score);
            }
        }

        // ── Update Posture Angles Telemetry DOM Boxes (NEW!) ──
        const valShoulderAngle = document.getElementById('valShoulderAngle');
        const valNeckAngle = document.getElementById('valNeckAngle');
        const valHeadAngle = document.getElementById('valHeadAngle');

        if (valShoulderAngle) {
            if (shoulderAngleVal !== null) {
                const isShoulderSlant = shoulderDiff > 0.04;
                valShoulderAngle.textContent = shoulderAngleVal.toFixed(1) + "°";
                valShoulderAngle.style.color = isShoulderSlant ? '#ef4444' : '#22c55e';
            } else {
                valShoulderAngle.textContent = isRunning ? "Out of Frame" : "--";
                valShoulderAngle.style.color = 'var(--text-muted)';
            }
        }

        if (valNeckAngle) {
            if (neckAngleVal !== null) {
                valNeckAngle.textContent = neckAngleVal.toFixed(1) + "°";
                valNeckAngle.style.color = isNeckForward ? '#ef4444' : '#22c55e';
            } else {
                valNeckAngle.textContent = isRunning ? "Out of Frame" : "--";
                valNeckAngle.style.color = 'var(--text-muted)';
            }
        }

        if (valHeadAngle) {
            if (headAngleVal !== null) {
                valHeadAngle.textContent = headAngleVal.toFixed(1) + "°";
                valHeadAngle.style.color = isHeadTilt ? '#ef4444' : '#22c55e';
            } else {
                valHeadAngle.textContent = isRunning ? "Out of Frame" : "--";
                valHeadAngle.style.color = 'var(--text-muted)';
            }
        }

        ctx.restore();
    }

    /* ── Start Camera ── */
    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const camWidth = isMobile ? 320 : 640;
    const camHeight = isMobile ? 240 : 480;

    async function startCamera() {
        try {
            startOverlay.innerHTML = '<div class="start-content"><div class="cam-icon-big" style="animation:pulse 1.5s infinite">⏳</div><p>Loading AI models...</p><p style="font-size:.75rem;color:var(--text-muted);margin-top:.5rem">' + (isMobile ? 'Mobile detected — using lite mode' : 'Desktop mode') + '</p></div>';

            holistic = new window.Holistic({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
            });
            holistic.setOptions({
                modelComplexity: isMobile ? 0 : 1,
                smoothLandmarks: true,
                enableSegmentation: false,
                smoothSegmentation: false,
                refineFaceLandmarks: !isMobile,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            holistic.onResults(onResults);

            camera = new window.Camera(webcamVideo, {
                onFrame: async () => { await holistic.send({ image: webcamVideo }); },
                width: camWidth,
                height: camHeight,
                facingMode: 'user'
            });

            await camera.start();

            startOverlay.classList.add('hidden');
            webcamVideo.classList.add('active');
            outputCanvas.width = camWidth;
            outputCanvas.height = camHeight;

            isRunning = true;
            systemStatus.classList.add('active');
            systemStatus.innerHTML = '<span class="status-dot"></span><span>Active</span>';

            toggleCamBtn.disabled = false;
            toggleBtnIcon.textContent = '⏹';
            toggleBtnText.textContent = 'Stop';

            startTimer();
            SmartAlerts.startBreakTimer();

        } catch (err) {
            console.error('Camera error:', err);
            startOverlay.innerHTML = '<div class="start-content"><div class="cam-icon-big">❌</div><p>Camera access denied.</p><button onclick="window.location.reload()" class="btn btn-outline btn-sm" style="margin-top:1rem">Refresh</button></div>';
        }
    }

    /* ── Stop Camera ── */
    function stopCamera() {
        if (camera) {
            camera.stop();
            camera = null;
        }

        const stream = webcamVideo.srcObject;
        if (stream) {
            stream.getTracks().forEach(t => t.stop());
            webcamVideo.srcObject = null;
        }

        webcamVideo.classList.remove('active');
        isRunning = false;

        systemStatus.classList.remove('active');
        systemStatus.innerHTML = '<span class="status-dot"></span><span>Inactive</span>';

        toggleCamBtn.disabled = true;
        toggleBtnIcon.textContent = '▶';
        toggleBtnText.textContent = 'Start';

        // Save session
        const duration = getSessionDuration();
        const avgScore = postureScores.length > 0
            ? Math.round(postureScores.reduce((a, b) => a + b, 0) / postureScores.length)
            : 0;
        const alertCount = typeof SmartAlerts !== 'undefined' ? SmartAlerts.getAlertCount() : 0;

        if (duration > 3 && typeof SessionHistory !== 'undefined') {
            SessionHistory.saveSession(duration, avgScore, alertCount);
        }

        stopTimer();
        SmartAlerts.stopBreakTimer();

        // Reset Posture Telemetry boxes to horizontal line/dashes (NEW!)
        const valShoulderAngle = document.getElementById('valShoulderAngle');
        const valNeckAngle = document.getElementById('valNeckAngle');
        const valHeadAngle = document.getElementById('valHeadAngle');
        if (valShoulderAngle) { valShoulderAngle.textContent = "--"; valShoulderAngle.style.color = 'var(--text-muted)'; }
        if (valNeckAngle) { valNeckAngle.textContent = "--"; valNeckAngle.style.color = 'var(--text-muted)'; }
        if (valHeadAngle) { valHeadAngle.textContent = "--"; valHeadAngle.style.color = 'var(--text-muted)'; }

        // Reset state
        postureScores = [];
        blinkCount = 0;
        currentPostureScore = 0;
        currentAttentionScore = 0;
        currentPostureIssue = 'good';
        lastGraphUpdate = 0;

        // Reset graph
        if (typeof PostureGraph !== 'undefined') PostureGraph.reset();

        // Show restart overlay
        startOverlay.classList.remove('hidden');
        startOverlay.innerHTML = '<div class="start-content"><div class="cam-icon-big">📷</div><p>Session ended. Click to start again.</p><button id="restartCamBtn" class="btn btn-primary glow-btn">Restart Camera</button></div>';
        document.getElementById('restartCamBtn').addEventListener('click', startCamera);

        // Clear canvas
        const ctx = outputCanvas.getContext('2d');
        ctx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
    }

    /* ── Event Listeners ── */
    startCamBtn.addEventListener('click', startCamera);

    toggleCamBtn.addEventListener('click', () => {
        if (isRunning) stopCamera();
    });

    if (stopCamBtn) {
        stopCamBtn.addEventListener('click', stopCamera);
    }

    /* ── Notification Toggle Button ── */
    const notifToggleBtn = document.getElementById('notifToggleBtn');
    if (notifToggleBtn) {
        // Check current state
        if ('Notification' in window && Notification.permission === 'granted') {
            notifToggleBtn.classList.add('notif-active');
            notifToggleBtn.innerHTML = '🔔 Notifications On';
        }
        notifToggleBtn.addEventListener('click', () => {
            if (!('Notification' in window)) {
                alert('Your browser does not support desktop notifications.');
                return;
            }
            if (Notification.permission === 'granted') {
                notifToggleBtn.classList.toggle('notif-active');
                const isActive = notifToggleBtn.classList.contains('notif-active');
                notifToggleBtn.innerHTML = isActive ? '🔔 Notifications On' : '🔕 Notifications Off';
            } else if (Notification.permission === 'default') {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        notifToggleBtn.classList.add('notif-active');
                        notifToggleBtn.innerHTML = '🔔 Notifications On';
                        new Notification('Posture System', { body: 'Desktop notifications enabled! You\'ll be alerted even when this tab is in the background.' });
                    }
                });
            } else {
                alert('Notifications are blocked. Please enable them in your browser settings.');
            }
        });
    }
});
