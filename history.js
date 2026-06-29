/* ═══════════════════ HISTORY.JS ═══════════════════ */
/* Session saving, history display, Chart.js integration */

const SessionHistory = (function () {
    'use strict';

    const SESSION_KEY = 'posture_session';
    const HISTORY_KEY_PREFIX = 'posture_history_';

    function getUserId() {
        try {
            const session = JSON.parse(localStorage.getItem(SESSION_KEY));
            return session ? session.studentId : null;
        } catch { return null; }
    }

    function getHistoryKey() {
        const uid = getUserId();
        return uid ? HISTORY_KEY_PREFIX + uid : null;
    }

    function getHistory() {
        const key = getHistoryKey();
        if (!key) return [];
        try { return JSON.parse(localStorage.getItem(key)) || []; }
        catch { return []; }
    }

    function saveHistory(history) {
        const key = getHistoryKey();
        if (key) localStorage.setItem(key, JSON.stringify(history));
    }

    function saveSession(durationSec, avgScore, alertCount) {
        const history = getHistory();
        history.push({
            date: new Date().toISOString(),
            duration: Math.round(durationSec),
            avgScore: Math.round(avgScore),
            alertCount: alertCount
        });
        saveHistory(history);
    }

    function clearHistory() {
        const key = getHistoryKey();
        if (key) localStorage.removeItem(key);
    }

    function formatDuration(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        if (m === 0) return s + 's';
        return m + 'm ' + s + 's';
    }

    function formatDurationMin(seconds) {
        const m = Math.floor(seconds / 60);
        return m + 'm';
    }

    function getScoreClass(score) {
        if (score >= 71) return 'good';
        if (score >= 41) return 'fair';
        return 'poor';
    }

    function getStatusText(score) {
        if (score >= 71) return '✅ Good';
        if (score >= 41) return '⚠️ Fair';
        return '❌ Poor';
    }

    /* ── Render History Page ── */
    function renderHistoryPage() {
        const history = getHistory();
        const tbody = document.getElementById('historyTableBody');
        const tableNoData = document.getElementById('tableNoData');
        const chartNoData = document.getElementById('chartNoData');
        const chartCanvas = document.getElementById('historyChart');

        // Stats
        const statTotal = document.getElementById('statTotalSessions');
        const statTime = document.getElementById('statTotalTime');
        const statAvg = document.getElementById('statAvgScore');
        const statAlerts = document.getElementById('statTotalAlerts');

        if (statTotal) statTotal.textContent = history.length;
        if (statTime) {
            const totalSec = history.reduce((a, s) => a + s.duration, 0);
            statTime.textContent = formatDurationMin(totalSec);
        }
        if (statAvg) {
            if (history.length > 0) {
                const avg = Math.round(history.reduce((a, s) => a + s.avgScore, 0) / history.length);
                statAvg.textContent = avg;
            } else {
                statAvg.textContent = '--';
            }
        }
        if (statAlerts) {
            statAlerts.textContent = history.reduce((a, s) => a + s.alertCount, 0);
        }

        // Table
        if (tbody) {
            if (history.length === 0) {
                tbody.innerHTML = '';
                if (tableNoData) tableNoData.style.display = 'block';
            } else {
                if (tableNoData) tableNoData.style.display = 'none';
                tbody.innerHTML = history.slice().reverse().map((s, i) => {
                    const date = new Date(s.date);
                    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                    const cls = getScoreClass(s.avgScore);
                    return `<tr>
                        <td style="color:var(--text-muted)">${history.length - i}</td>
                        <td>${dateStr} <span style="color:var(--text-muted);font-size:.8rem">${timeStr}</span></td>
                        <td>${formatDuration(s.duration)}</td>
                        <td><span class="score-badge score-${cls}">${s.avgScore}</span></td>
                        <td>${s.alertCount}</td>
                        <td><span class="status-badge status-${cls}">${getStatusText(s.avgScore)}</span></td>
                    </tr>`;
                }).join('');
            }
        }

        // Chart
        if (chartCanvas) {
            if (typeof Chart === 'undefined') {
                setTimeout(renderHistoryPage, 500);
                return;
            }
            if (history.length === 0) {
                chartCanvas.style.display = 'none';
                if (chartNoData) chartNoData.style.display = 'block';
            } else {
                chartCanvas.style.display = 'block';
                if (chartNoData) chartNoData.style.display = 'none';

                const last7 = history.slice(-7);
                const labels = last7.map(s => {
                    const d = new Date(s.date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                });
                const scores = last7.map(s => s.avgScore);
                const colors = scores.map(s => {
                    if (s >= 71) return 'rgba(34,197,94,0.8)';
                    if (s >= 41) return 'rgba(234,179,8,0.8)';
                    return 'rgba(239,68,68,0.8)';
                });
                const borderColors = scores.map(s => {
                    if (s >= 71) return '#22c55e';
                    if (s >= 41) return '#eab308';
                    return '#ef4444';
                });

                new Chart(chartCanvas, {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Avg Posture Score',
                            data: scores,
                            backgroundColor: colors,
                            borderColor: borderColors,
                            borderWidth: 2,
                            borderRadius: 6,
                            barPercentage: 0.6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(21,27,46,0.95)',
                                titleColor: '#e8eaf0',
                                bodyColor: '#8b92a8',
                                borderColor: 'rgba(255,255,255,0.1)',
                                borderWidth: 1,
                                cornerRadius: 8,
                                padding: 12
                            }
                        },
                        scales: {
                            y: {
                                min: 0, max: 100,
                                grid: { color: 'rgba(255,255,255,0.04)' },
                                ticks: { color: '#5a6178', font: { family: "'JetBrains Mono'" } }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: '#5a6178', font: { family: "'Inter'" } }
                            }
                        }
                    }
                });
            }
        }
    }

    /* ── Init ── */
    document.addEventListener('DOMContentLoaded', () => {
        // Only render on history page
        if (document.getElementById('historyTable')) {
            renderHistoryPage();

            const clearBtn = document.getElementById('clearHistoryBtn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    if (confirm('Are you sure you want to clear all session history?')) {
                        clearHistory();
                        renderHistoryPage();
                    }
                });
            }
        }
    });

    return { saveSession, getHistory, clearHistory, formatDuration };
})();
