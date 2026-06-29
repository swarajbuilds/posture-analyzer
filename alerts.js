/* ═══════════════════ ALERTS.JS ═══════════════════ */
/* Smart alerts: banners, voice alerts, desktop notifications, break reminder, beep */

const SmartAlerts = (function () {
    'use strict';

    let badPostureStart = 0;
    let lowAttentionStart = 0;
    let breakTimerId = null;
    let alertCount = 0;
    let audioCtx = null;
    let lastBeepTime = 0;
    let lastVoiceTime = 0;
    let notificationsEnabled = false;
    const BEEP_COOLDOWN = 5000;
    const VOICE_COOLDOWN = 12000; // Don't repeat voice within 12s

    /* ── Audio Context ── */
    function getAudioCtx() {
        if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
        return audioCtx;
    }

    function playBeep() {
        const now = Date.now();
        if (now - lastBeepTime < BEEP_COOLDOWN) return;
        lastBeepTime = now;
        try {
            const ctx = getAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) { /* silent fail */ }
    }

    /* ── Voice Alerts (SpeechSynthesis API) ── */
    function speakAlert(message) {
        const now = Date.now();
        if (now - lastVoiceTime < VOICE_COOLDOWN) return;
        if (!('speechSynthesis' in window)) return;
        lastVoiceTime = now;

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        utterance.lang = 'en-US';

        // Try to use a natural-sounding voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
        if (preferred) utterance.voice = preferred;

        window.speechSynthesis.speak(utterance);
    }

    /* ── Desktop Notifications ── */
    function requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                notificationsEnabled = (permission === 'granted');
            });
        } else {
            notificationsEnabled = (Notification.permission === 'granted');
        }
    }

    function sendDesktopNotification(title, body, icon) {
        if (!notificationsEnabled) return;
        if (document.visibilityState === 'visible') return; // Only when tab is not focused
        try {
            const notif = new Notification(title, {
                body: body,
                icon: icon || '◉',
                badge: '◉',
                tag: title, // Prevent duplicate notifications
                renotify: true,
                silent: false
            });
            // Auto-close after 5 seconds
            setTimeout(() => notif.close(), 5000);
        } catch (e) { /* silent fail */ }
    }

    /* ── Alert always sends desktop notification too ── */
    function showBanner(type, message, voiceMsg) {
        const container = document.getElementById('alertBannersContainer');
        if (!container) return;
        // Prevent duplicate banners of the same type
        if (container.querySelector('.alert-banner.' + type)) return;

        const banner = document.createElement('div');
        banner.className = 'alert-banner ' + type;
        banner.innerHTML = '<span class="alert-banner-text">' + message + '</span><button class="alert-dismiss-btn" onclick="this.parentElement.remove()">✕</button>';
        container.appendChild(banner);

        alertCount++;
        const countEl = document.getElementById('valAlertCount');
        if (countEl) countEl.textContent = alertCount;

        // Voice alert
        if (voiceMsg) speakAlert(voiceMsg);

        // Desktop notification
        const notifTitle = type === 'bad-posture' ? '⚠️ Posture Alert' : '👁️ Attention Alert';
        sendDesktopNotification(notifTitle, voiceMsg || message);

        setTimeout(() => {
            banner.classList.add('dismiss');
            setTimeout(() => { banner.remove(); }, 300);
        }, 5000);
    }

    function showBreakReminder() {
        const overlay = document.getElementById('breakPopupOverlay');
        if (overlay) overlay.classList.add('show');

        // Voice + Desktop notification for breaks too
        speakAlert('Time for a break! You have been working for 20 minutes. Stand up and stretch.');
        sendDesktopNotification('☕ Break Time!', 'You\'ve been working for 20 minutes. Stand up, stretch, and rest your eyes.');
    }

    function dismissBreak() {
        const overlay = document.getElementById('breakPopupOverlay');
        if (overlay) overlay.classList.remove('show');
    }

    function startBreakTimer() {
        stopBreakTimer();
        breakTimerId = setInterval(() => {
            showBreakReminder();
        }, 20 * 60 * 1000); // 20 minutes
    }

    function stopBreakTimer() {
        if (breakTimerId) { clearInterval(breakTimerId); breakTimerId = null; }
    }

    /**
     * Called every frame/second with current posture score and attention value.
     * @param {number} postureScore 0-100
     * @param {number} attentionScore 0-100
     */
    function update(postureScore, attentionScore) {
        const now = Date.now();

        // Bad posture for 10 seconds
        if (postureScore < 50) {
            if (badPostureStart === 0) badPostureStart = now;
            if (now - badPostureStart >= 10000) {
                showBanner(
                    'bad-posture',
                    '⚠️ Bad posture detected! Please sit straight.',
                    'Bad posture detected. Please sit up straight and align your shoulders.'
                );
                playBeep();
                badPostureStart = now;
            }
        } else {
            badPostureStart = 0;
        }

        // Attention below 50% for 15 seconds
        if (attentionScore < 50) {
            if (lowAttentionStart === 0) lowAttentionStart = now;
            if (now - lowAttentionStart >= 15000) {
                showBanner(
                    'low-attention',
                    '👁️ Attention dropping! Try to refocus.',
                    'Your attention is dropping. Please refocus on the screen.'
                );
                lowAttentionStart = now;
            }
        } else {
            lowAttentionStart = 0;
        }
    }

    function reset() {
        badPostureStart = 0;
        lowAttentionStart = 0;
        alertCount = 0;
        const countEl = document.getElementById('valAlertCount');
        if (countEl) countEl.textContent = '0';
        stopBreakTimer();
        // Stop any ongoing speech
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function getAlertCount() { return alertCount; }

    // Init
    document.addEventListener('DOMContentLoaded', () => {
        const dismissBtn = document.getElementById('dismissBreakBtn');
        if (dismissBtn) dismissBtn.addEventListener('click', dismissBreak);

        // Request notification permission on dashboard
        requestNotificationPermission();

        // Preload voices for speech synthesis
        if ('speechSynthesis' in window) {
            window.speechSynthesis.getVoices();
            window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
        }
    });

    return { update, startBreakTimer, stopBreakTimer, reset, getAlertCount, playBeep, speakAlert, requestNotificationPermission };
})();
