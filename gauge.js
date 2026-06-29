/* ═══════════════════ GAUGE.JS ═══════════════════ */
/* Animated circular posture score gauge drawn on canvas */

const PostureGauge = (function () {
    'use strict';

    let canvas, ctx;
    let currentScore = 0;
    let targetScore = 0;
    let animationId = null;

    const CONFIG = {
        lineWidth: 14,
        radius: 78,
        startAngle: 0.75 * Math.PI,
        endAngle: 2.25 * Math.PI,
        bgColor: 'rgba(255,255,255,0.06)',
        animSpeed: 0.08
    };

    function getColor(score) {
        if (score <= 40) return '#ef4444';
        if (score <= 70) return '#eab308';
        return '#22c55e';
    }

    function getLabel(score) {
        if (score <= 40) return 'Poor';
        if (score <= 70) return 'Fair';
        return 'Good';
    }

    function draw() {
        if (!canvas || !ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const r = CONFIG.radius;
        const totalAngle = CONFIG.endAngle - CONFIG.startAngle;

        ctx.clearRect(0, 0, w, h);

        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, r, CONFIG.startAngle, CONFIG.endAngle);
        ctx.strokeStyle = CONFIG.bgColor;
        ctx.lineWidth = CONFIG.lineWidth;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Score arc
        const scoreAngle = CONFIG.startAngle + (currentScore / 100) * totalAngle;
        const color = getColor(currentScore);

        if (currentScore > 0) {
            ctx.beginPath();
            ctx.arc(cx, cy, r, CONFIG.startAngle, scoreAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = CONFIG.lineWidth;
            ctx.lineCap = 'round';
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Update text
        const gaugeValue = document.getElementById('gaugeValue');
        const gaugeLabel = document.getElementById('gaugeLabel');
        if (gaugeValue) {
            gaugeValue.textContent = Math.round(currentScore);
            gaugeValue.style.color = color;
        }
        if (gaugeLabel) {
            gaugeLabel.textContent = getLabel(Math.round(currentScore));
            gaugeLabel.style.color = color;
        }
    }

    function animate() {
        const diff = targetScore - currentScore;
        if (Math.abs(diff) > 0.5) {
            currentScore += diff * CONFIG.animSpeed;
            draw();
            animationId = requestAnimationFrame(animate);
        } else {
            currentScore = targetScore;
            draw();
        }
    }

    function setScore(score) {
        targetScore = Math.max(0, Math.min(100, score));
        if (animationId) cancelAnimationFrame(animationId);
        animate();
    }

    function init() {
        canvas = document.getElementById('postureGauge');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        // Adjust for DPR
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = 200 * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = '200px';
        canvas.style.height = '200px';
        ctx.scale(dpr, dpr);
        // Reset config radius for scaled canvas
        CONFIG.radius = 78;
        draw();
    }

    return { init, setScore, getLabel, getColor };
})();

document.addEventListener('DOMContentLoaded', () => { PostureGauge.init(); });
