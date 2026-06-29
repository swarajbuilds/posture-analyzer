/* ═══════════════════ AUTH.JS ═══════════════════ */
/* Login, Signup, and Session Management */

(function () {
    'use strict';

    const USERS_KEY = 'posture_users';
    const SESSION_KEY = 'posture_session';

    /* ── Helpers ── */
    function getUsers() {
        try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
        catch { return []; }
    }
    function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
    function getSession() {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
        catch { return null; }
    }
    function setSession(user) { localStorage.setItem(SESSION_KEY, JSON.stringify({ studentId: user.studentId, name: user.name, loggedInAt: Date.now() })); }
    function clearSession() { localStorage.removeItem(SESSION_KEY); }

    function showAlert(el, msg, type) {
        if (!el) return;
        el.textContent = msg;
        el.className = 'auth-alert show ' + type;
        setTimeout(() => { el.classList.remove('show'); }, 4000);
    }

    /* ── Auth Guard ── */
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const protectedPages = ['dashboard.html', 'history.html'];
    const authPages = ['index.html', 'signup.html', ''];

    const session = getSession();

    if (protectedPages.includes(page) && !session) {
        window.location.href = 'index.html';
        return;
    }
    if (authPages.includes(page) && session) {
        window.location.href = 'dashboard.html';
        return;
    }

    /* ── Populate nav welcome & logout ── */
    document.addEventListener('DOMContentLoaded', () => {
        const navWelcome = document.getElementById('navWelcome');
        const logoutBtn = document.getElementById('logoutBtn');
        const dashboardUserName = document.getElementById('dashboardUserName');
        const dashboardDate = document.getElementById('dashboardDate');

        if (session && navWelcome) navWelcome.textContent = 'Hi, ' + session.name.split(' ')[0];
        if (session && dashboardUserName) dashboardUserName.textContent = session.name;
        if (dashboardDate) {
            dashboardDate.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => { clearSession(); window.location.href = 'index.html'; });
        }

        /* ── Hamburger toggle ── */
        const hamburger = document.getElementById('hamburger');
        const navLinks = document.getElementById('navLinks');
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', () => { navLinks.classList.toggle('active'); });
        }

        /* ── Signup Form ── */
        const signupForm = document.getElementById('signupForm');
        if (signupForm) {
            const alertEl = document.getElementById('signupAlert');
            signupForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('signupName').value.trim();
                const studentId = document.getElementById('signupStudentId').value.trim();
                const password = document.getElementById('signupPassword').value;
                const confirm = document.getElementById('signupConfirmPassword').value;

                if (!name || !studentId || !password || !confirm) { showAlert(alertEl, 'Please fill all fields.', 'error'); return; }
                if (password.length < 6) { showAlert(alertEl, 'Password must be at least 6 characters.', 'error'); return; }
                if (password !== confirm) { showAlert(alertEl, 'Passwords do not match.', 'error'); return; }

                const users = getUsers();
                if (users.find(u => u.studentId === studentId)) { showAlert(alertEl, 'Student ID already registered.', 'error'); return; }

                users.push({ name, studentId, password });
                saveUsers(users);
                showAlert(alertEl, 'Account created! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'index.html'; }, 1200);
            });
        }

        /* ── Login Form ── */
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            const alertEl = document.getElementById('loginAlert');
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const studentId = document.getElementById('loginStudentId').value.trim();
                const password = document.getElementById('loginPassword').value;

                if (!studentId || !password) { showAlert(alertEl, 'Please fill all fields.', 'error'); return; }

                const users = getUsers();
                const user = users.find(u => u.studentId === studentId && u.password === password);
                if (!user) { showAlert(alertEl, 'Invalid Student ID or password.', 'error'); return; }

                setSession(user);
                showAlert(alertEl, 'Login successful! Redirecting...', 'success');
                setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
            });
        }
    });
})();
