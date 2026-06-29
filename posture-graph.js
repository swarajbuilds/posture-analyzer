/* ═══════════════════ POSTURE-GRAPH.JS ═══════════════════ */
/* Real-time scrolling line chart of posture score over time */

const PostureGraph = (function () {
    'use strict';

    let chart = null;
    const MAX_POINTS = 60; // Show last 60 data points (1 per second = 60 seconds)
    const dataPoints = [];
    const timeLabels = [];
    let startTime = 0;

    function getGradient(ctx, chartArea) {
        const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(0, 'rgba(0, 212, 255, 0.0)');
        gradient.addColorStop(0.4, 'rgba(0, 212, 255, 0.08)');
        gradient.addColorStop(1, 'rgba(0, 212, 255, 0.25)');
        return gradient;
    }

    function getPointColor(score) {
        if (score <= 40) return '#ef4444';
        if (score <= 70) return '#eab308';
        return '#22c55e';
    }

    function getBorderColor(score) {
        if (score <= 40) return 'rgba(239, 68, 68, 0.9)';
        if (score <= 70) return 'rgba(234, 179, 8, 0.9)';
        return 'rgba(34, 197, 94, 0.9)';
    }

    function init() {
        const canvas = document.getElementById('realtimePostureChart');
        if (!canvas || typeof Chart === 'undefined') return;

        const ctx = canvas.getContext('2d');

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Posture Score',
                    data: [],
                    borderColor: '#00d4ff',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#00d4ff',
                    pointHoverBorderColor: '#fff',
                    pointHoverBorderWidth: 2,
                    tension: 0.35,
                    fill: true,
                    backgroundColor: function (context) {
                        const chart = context.chart;
                        const { ctx: c, chartArea } = chart;
                        if (!chartArea) return 'rgba(0,212,255,0.1)';
                        return getGradient(c, chartArea);
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(21, 27, 46, 0.95)',
                        titleColor: '#e8eaf0',
                        bodyColor: '#8b92a8',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        padding: 10,
                        displayColors: false,
                        callbacks: {
                            title: function (items) {
                                return items[0].label;
                            },
                            label: function (item) {
                                const score = item.raw;
                                const label = score <= 40 ? 'Poor' : score <= 70 ? 'Fair' : 'Good';
                                return 'Score: ' + score + ' (' + label + ')';
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        min: 0,
                        max: 100,
                        grid: {
                            color: 'rgba(255,255,255,0.04)',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#5a6178',
                            font: { family: "'JetBrains Mono'", size: 11 },
                            stepSize: 25,
                            callback: function (val) {
                                if (val === 0) return '0';
                                if (val === 25) return '25';
                                if (val === 50) return '50';
                                if (val === 75) return '75';
                                if (val === 100) return '100';
                                return '';
                            }
                        },
                        border: { display: false }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: '#5a6178',
                            font: { family: "'Inter'", size: 10 },
                            maxRotation: 0,
                            maxTicksLimit: 8
                        },
                        border: { display: false }
                    }
                }
            },
            plugins: [{
                id: 'thresholdLines',
                beforeDraw: function (chart) {
                    const { ctx, chartArea, scales } = chart;
                    if (!chartArea) return;

                    // Draw threshold zones
                    const y40 = scales.y.getPixelForValue(40);
                    const y70 = scales.y.getPixelForValue(70);

                    // Poor zone line
                    ctx.save();
                    ctx.setLineDash([4, 4]);
                    ctx.lineWidth = 1;

                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
                    ctx.beginPath();
                    ctx.moveTo(chartArea.left, y40);
                    ctx.lineTo(chartArea.right, y40);
                    ctx.stroke();

                    ctx.strokeStyle = 'rgba(234, 179, 8, 0.2)';
                    ctx.beginPath();
                    ctx.moveTo(chartArea.left, y70);
                    ctx.lineTo(chartArea.right, y70);
                    ctx.stroke();

                    ctx.restore();
                }
            }]
        });

        startTime = Date.now();
    }

    function addScore(score) {
        if (!chart) {
            init();
            if (!chart) return;
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        const label = (mins > 0 ? mins + ':' : '') + String(secs).padStart(2, '0') + 's';

        dataPoints.push(score);
        timeLabels.push(label);

        // Keep only last MAX_POINTS
        if (dataPoints.length > MAX_POINTS) {
            dataPoints.shift();
            timeLabels.shift();
        }

        // Dynamically color the line based on latest score
        const latestColor = getBorderColor(score);
        chart.data.labels = [...timeLabels];
        chart.data.datasets[0].data = [...dataPoints];
        chart.data.datasets[0].borderColor = latestColor;

        // Update segment coloring for multi-color line
        chart.data.datasets[0].segment = {
            borderColor: function (ctx) {
                return getBorderColor(ctx.p1.parsed.y);
            }
        };

        chart.update('none'); // 'none' prevents full animation on each update

        // Update time label
        const timeLabel = document.getElementById('graphTimeLabel');
        if (timeLabel) {
            const showing = Math.min(dataPoints.length, MAX_POINTS);
            timeLabel.textContent = 'Last ' + showing + ' seconds';
        }
    }

    function reset() {
        dataPoints.length = 0;
        timeLabels.length = 0;
        startTime = Date.now();
        if (chart) {
            chart.data.labels = [];
            chart.data.datasets[0].data = [];
            chart.update('none');
        }
        const timeLabel = document.getElementById('graphTimeLabel');
        if (timeLabel) timeLabel.textContent = 'Last 60 seconds';
    }

    function destroy() {
        if (chart) {
            chart.destroy();
            chart = null;
        }
        dataPoints.length = 0;
        timeLabels.length = 0;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('realtimePostureChart')) {
            init();
        }
    });

    return { init, addScore, reset, destroy };
})();
