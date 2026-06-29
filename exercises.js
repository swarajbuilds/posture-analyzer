/* ═══════════════════ EXERCISES.JS ═══════════════════ */
/* Context-aware exercise suggestions based on detected posture issues */

const ExerciseSuggestions = (function () {
    'use strict';

    const exercises = {
        slouching: {
            emoji: '🔄',
            name: 'Shoulder Roll',
            desc: 'Loosen up tight shoulders from slouching.',
            steps: [
                'Sit up straight with feet flat on the floor.',
                'Roll both shoulders forward in a circular motion 5 times.',
                'Reverse direction and roll backward 5 times.',
                'Squeeze shoulder blades together, hold 5 seconds, release.'
            ]
        },
        headTilt: {
            emoji: '🧘',
            name: 'Neck Stretch',
            desc: 'Release tension from tilting your head to one side.',
            steps: [
                'Sit upright and look straight ahead.',
                'Slowly tilt your head toward your right shoulder.',
                'Hold for 15 seconds, feeling the stretch on the left side.',
                'Return to center and repeat on the left side.'
            ]
        },
        forwardHead: {
            emoji: '💪',
            name: 'Chin Tuck',
            desc: 'Correct forward head posture and strengthen neck muscles.',
            steps: [
                'Sit or stand with your back straight.',
                'Gently tuck your chin toward your chest (make a double chin).',
                'Hold for 5 seconds, feeling a stretch at the back of your neck.',
                'Release and repeat 10 times.'
            ]
        }
    };

    const tips = [
        { emoji: '🌟', text: 'Great posture!', sub: 'Keep it up — your spine thanks you!' },
        { emoji: '💯', text: 'Looking good!', sub: 'Maintaining alignment like a pro.' },
        { emoji: '🏆', text: 'Excellent form!', sub: 'Consistent posture builds lasting habits.' },
        { emoji: '✨', text: 'Perfect posture!', sub: "You're setting a great example." },
        { emoji: '🎯', text: 'On target!', sub: 'Stay relaxed and keep your shoulders down.' }
    ];

    let lastIssue = '';
    let tipIndex = 0;

    function createExerciseHTML(ex) {
        const stepsHTML = ex.steps.map((s, i) =>
            `<div class="exercise-step"><span class="exercise-step-num">${i + 1}.</span><span>${s}</span></div>`
        ).join('');

        return `
            <div class="exercise-item">
                <div class="exercise-header">
                    <span class="exercise-emoji">${ex.emoji}</span>
                    <span class="exercise-name">${ex.name}</span>
                </div>
                <p class="exercise-desc">${ex.desc}</p>
                <div class="exercise-steps">${stepsHTML}</div>
                <button class="exercise-done-btn" onclick="ExerciseSuggestions.markDone(this)">✅ Done</button>
            </div>
        `;
    }

    function createTipHTML(tip) {
        return `
            <div class="motivational-tip">
                <span class="tip-emoji">${tip.emoji}</span>
                <div class="tip-text">${tip.text}</div>
                <div class="tip-sub">${tip.sub}</div>
            </div>
        `;
    }

    /**
     * @param {string} issue - 'slouching' | 'headTilt' | 'forwardHead' | 'good'
     */
    function update(issue) {
        const container = document.getElementById('exerciseContent');
        if (!container) return;

        // Avoid re-rendering the same suggestion
        if (issue === lastIssue) return;
        lastIssue = issue;

        if (issue === 'good') {
            const tip = tips[tipIndex % tips.length];
            tipIndex++;
            container.innerHTML = createTipHTML(tip);
        } else if (exercises[issue]) {
            container.innerHTML = createExerciseHTML(exercises[issue]);
        }
    }

    function markDone(btn) {
        btn.textContent = '✅ Completed!';
        btn.classList.add('completed');
    }

    function reset() {
        lastIssue = '';
        const container = document.getElementById('exerciseContent');
        if (container) {
            container.innerHTML = `
                <div class="exercise-placeholder">
                    <span class="exercise-placeholder-icon">🧘</span>
                    <p>Start detection to receive personalized exercise suggestions</p>
                </div>
            `;
        }
    }

    return { update, markDone, reset };
})();
