import cv2
import streamlit as st
import mediapipe as mp
import numpy as np
import time
import json
import os
from collections import deque

# ── PAGE CONFIG & CUSTOM PREMIUM CSS ──────────────────────────────────────────
st.set_page_config(page_title="Posture AI Analyzer", layout="wide", page_icon="🧍")

# Inject premium dark theme glassmorphic styling
st.markdown("""
<style>
    /* Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');
    
    html, body, [data-testid="stAppViewContainer"] {
        font-family: 'Inter', sans-serif;
        background-color: #080c14 !important;
        color: #e8eaf0 !important;
    }
    
    /* Header styling */
    .main-title {
        font-weight: 900;
        font-size: 2.8rem;
        background: linear-gradient(135deg, #00d4ff, #a855f7);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-align: center;
        margin-bottom: 0.1rem;
        letter-spacing: -0.03em;
        text-shadow: 0 0 40px rgba(0, 212, 255, 0.1);
    }
    
    .main-subtitle {
        text-align: center;
        color: #8b92a8;
        font-size: 1rem;
        margin-bottom: 2rem;
    }
    
    /* Sidebar styling */
    div[data-testid="stSidebar"] {
        background-color: #0c101d !important;
        border-right: 1px solid rgba(255, 255, 255, 0.05);
    }
    
    /* Tabs custom styling */
    .stTabs [data-baseweb="tab-list"] {
        gap: 14px;
        background-color: #0f1424;
        padding: 10px 20px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.04);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    
    .stTabs [data-baseweb="tab"] {
        height: 48px;
        background-color: transparent;
        border-radius: 10px;
        color: #8b92a8;
        font-weight: 600;
        font-size: 0.95rem;
        border: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        padding: 0 24px;
    }
    
    .stTabs [aria-selected="true"] {
        background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(168, 85, 247, 0.15)) !important;
        color: #00d4ff !important;
        border: 1px solid rgba(0, 212, 255, 0.3) !important;
        box-shadow: 0 0 15px rgba(0, 212, 255, 0.15);
    }
    
    /* Premium components */
    .premium-card {
        background: rgba(21, 27, 46, 0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 18px;
        padding: 1.25rem 1.5rem;
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        margin-bottom: 1.25rem;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .premium-card:hover {
        border-color: rgba(0, 212, 255, 0.25);
        box-shadow: 0 10px 35px rgba(0, 212, 255, 0.08);
    }
    
    .metric-title {
        font-size: 0.75rem;
        font-family: 'JetBrains Mono', monospace;
        color: #00d4ff;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.5rem;
    }
    
    .metric-value {
        font-size: 1.9rem;
        font-weight: 800;
        color: #e8eaf0;
        line-height: 1.2;
    }
    
    .metric-subtitle {
        font-size: 0.85rem;
        color: #8b92a8;
        margin-top: 0.2rem;
    }
    
    /* Alert Banners */
    .custom-alert {
        padding: 1.1rem 1.5rem;
        border-radius: 14px;
        font-weight: 800;
        text-align: center;
        font-size: 1.15rem;
        margin-top: 1rem;
        box-shadow: 0 8px 25px rgba(0,0,0,0.45);
        animation: pulseAlert 2s infinite ease-in-out;
    }
    @keyframes pulseAlert {
        0% { transform: scale(1); }
        50% { transform: scale(1.02); }
        100% { transform: scale(1); }
    }
    .alert-red {
        background: rgba(239, 68, 68, 0.18);
        border: 1px solid rgba(239, 68, 68, 0.4);
        color: #ff8888;
        box-shadow: 0 0 20px rgba(239, 68, 68, 0.25);
    }
    .alert-orange {
        background: rgba(249, 115, 22, 0.18);
        border: 1px solid rgba(249, 115, 22, 0.4);
        color: #ffaa66;
        box-shadow: 0 0 20px rgba(249, 115, 22, 0.25);
    }
</style>
""", unsafe_allow_html=True)

st.markdown("<h1 class='main-title'>🧍 Posture AI Analyzer</h1>", unsafe_allow_html=True)
st.markdown("<p class='main-subtitle'>Real-time posture · attention · emotion detection with dynamic calibration</p>", unsafe_allow_html=True)

# ── HISTORY MANAGEMENT HELPERS ────────────────────────────────────────────────
HISTORY_FILE = "posture_history.json"

def load_history():
    if not os.path.exists(HISTORY_FILE):
        return []
    try:
        with open(HISTORY_FILE, "r") as f:
            return json.load(f)
    except:
        return []

def save_session_history(duration, avg_score, alerts):
    if duration < 5:  # Don't save very short accidental runs
        return
    history = load_history()
    history.append({
        "date": time.strftime("%Y-%m-%d %H:%M:%S"),
        "duration": int(duration),
        "avg_score": int(avg_score),
        "alerts": int(alerts)
    })
    try:
        with open(HISTORY_FILE, "w") as f:
            json.dump(history, f, indent=4)
    except:
        pass

def clear_session_history():
    if os.path.exists(HISTORY_FILE):
        try:
            os.remove(HISTORY_FILE)
        except:
            pass

# ── WEBAUDIO BEEP TRIGGER ─────────────────────────────────────────────────────
def trigger_audio_alert():
    sound_js = """
    <script>
    (function() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880 Hz Tone
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    })();
    </script>
    """
    st.components.v1.html(sound_js, height=0, width=0)

# ── SIDEBAR SETTINGS & CONTROLS ───────────────────────────────────────────────
st.sidebar.markdown("<h2 style='text-align: center; color: #00d4ff;'>⚙️ Controls</h2>", unsafe_allow_html=True)
start = st.sidebar.button("▶️ Start Webcam", use_container_width=True)
stop  = st.sidebar.button("⏹️ Stop Webcam", use_container_width=True)
st.sidebar.markdown("---")

st.sidebar.markdown("<h3 style='color: #00d4ff;'>📈 Calibration & Thresholds</h3>", unsafe_allow_html=True)
SLOUCH_THRESHOLD = st.sidebar.slider("Slouching Alert Threshold", 30, 90, 60, 5)
ATTENTION_THRESHOLD = st.sidebar.slider("Attention Warning Threshold", 20, 70, 50, 5)
EAR_THRESHOLD = st.sidebar.slider("Eye Aspect Ratio (Blink)", 0.15, 0.30, 0.21, 0.01)
SOUND_ALERTS = st.sidebar.checkbox("Enable Beep Audio Alerts", value=True)

st.sidebar.markdown("---")
st.sidebar.markdown("<h3 style='color: #00d4ff;'>🌐 Live Web Portal</h3>", unsafe_allow_html=True)
st.sidebar.markdown(
    '<a href="https://posture-ai-frontend-z6okzblb5a-uc.a.run.app" target="_blank" '
    'style="display: inline-block; width: 100%; text-align: center; padding: 12px; '
    'background: linear-gradient(135deg, #00d4ff, #a855f7); color: white; '
    'border-radius: 10px; font-weight: 700; text-decoration: none; box-shadow: 0 4px 15px rgba(0,212,255,0.25);">'
    '🚀 Visit Live Web Portal</a>',
    unsafe_allow_html=True
)

# ── SESSION STATE INITIALIZATION ──────────────────────────────────────────────
defaults = {
    "run": False, "last_alert_time": 0, "cap": None,
    "blink_count": 0, "blink_consec": 0,
    "blink_timestamps": deque(maxlen=200),
    "posture_scores": [], "alert_count": 0, "session_start_time": 0,
    "calibrated": False, "base_shoulder_slope": 0.0, "base_nose_centering": 0.0,
    "trigger_calibrate": False,
    "slouching_count": 0, "head_tilt_count": 0, "forward_head_count": 0, "uneven_shoulders_count": 0,
    "total_frame_count": 0, "live_graph_data": deque(maxlen=60), "last_graph_time": 0.0
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# Handle start trigger
if start:
    st.session_state.run = True
    st.session_state.blink_count = 0
    st.session_state.blink_consec = 0
    st.session_state.posture_scores = []
    st.session_state.alert_count = 0
    st.session_state.session_start_time = time.time()
    st.session_state.blink_timestamps = deque(maxlen=200)
    st.session_state.slouching_count = 0
    st.session_state.head_tilt_count = 0
    st.session_state.forward_head_count = 0
    st.session_state.uneven_shoulders_count = 0
    st.session_state.total_frame_count = 0
    st.session_state.live_graph_data = deque(maxlen=60)
    st.session_state.last_graph_time = time.time()
    if st.session_state.cap is None or not st.session_state.cap.isOpened():
        st.session_state.cap = cv2.VideoCapture(0)

# Handle stop trigger
if stop:
    if st.session_state.run:
        st.session_state.run = False
        duration = time.time() - st.session_state.session_start_time
        if st.session_state.posture_scores:
            avg_score = int(sum(st.session_state.posture_scores) / len(st.session_state.posture_scores))
            save_session_history(duration, avg_score, st.session_state.alert_count)
            st.sidebar.success(f"💾 Session saved! Avg score: {avg_score}")
    if st.session_state.cap is not None:
        st.session_state.cap.release()
        st.session_state.cap = None

# ── MEDIAPIPE INITIALIZATION ──────────────────────────────────────────────────
mp_pose    = mp.solutions.pose
mp_hands   = mp.solutions.hands
mp_face    = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

for name, cls, kwargs in [
    ("pose_detector", mp_pose.Pose,     dict(min_detection_confidence=0.5, min_tracking_confidence=0.5)),
    ("hand_detector", mp_hands.Hands,   dict(max_num_hands=2, min_detection_confidence=0.5, min_tracking_confidence=0.5)),
    ("face_detector", mp_face.FaceMesh, dict(max_num_faces=1, refine_landmarks=True,
                                              min_detection_confidence=0.5, min_tracking_confidence=0.5)),
]:
    if name not in st.session_state:
        st.session_state[name] = cls(**kwargs)

LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

# ── ANALYSIS HELPERS ──────────────────────────────────────────────────────────
def draw_dashed_line(img, pt1, pt2, color, thickness=1, gap=6):
    dist = np.hypot(pt2[0] - pt1[0], pt2[1] - pt1[1])
    if dist == 0:
        return
    dx = (pt2[0] - pt1[0]) / dist
    dy = (pt2[1] - pt1[1]) / dist
    for i in range(0, int(dist), gap * 2):
        start = (int(pt1[0] + dx * i), int(pt1[1] + dy * i))
        end = (int(pt1[0] + dx * min(i + gap, dist)), int(pt1[1] + dy * min(i + gap, dist)))
        cv2.line(img, start, end, color, thickness)

def eye_aspect_ratio(lm, indices):
    pts = [np.array([lm[i].x, lm[i].y]) for i in indices]
    v1 = np.linalg.norm(pts[1] - pts[5])
    v2 = np.linalg.norm(pts[2] - pts[4])
    h  = np.linalg.norm(pts[0] - pts[3])
    return (v1 + v2) / (2.0 * h + 1e-6)

def blinks_per_minute():
    now = time.time()
    return len([t for t in st.session_state.blink_timestamps if t > now - 60])

def attention_score(bpm, ear):
    if 12 <= bpm <= 20:
        blink_s = 100
    elif bpm < 12:
        blink_s = max(0, int(bpm / 12 * 100))
    else:
        blink_s = max(0, int(100 - (bpm - 20) * 4))
    ear_s = int(min(100, max(0, (ear - 0.15) / 0.15 * 100)))
    return int(blink_s * 0.55 + ear_s * 0.45)

def attention_label(score):
    if score >= 75: return "🟢 Excellent"
    if score >= 50: return "🟡 Good"
    return "🔴 Poor"

def posture_score(landmarks, base_slope=0.0, base_centering=0.0):
    ls   = landmarks[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
    rs   = landmarks[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
    nose = landmarks[mp_pose.PoseLandmark.NOSE.value]
    
    current_slope = ls.y - rs.y
    current_centering = nose.x - (ls.x + rs.x) / 2
    
    # Calculate posture score deviance based on calibrated baseline
    s = max(0, 1 - abs(current_slope - base_slope) * 10)
    h = max(0, 1 - abs(current_centering - base_centering) * 8)
    return int(max(0, min(100, (s * 0.4 + h * 0.6) * 100)))

def is_hand_near_face(hand_results, pose_landmarks, thr=0.15):
    if not hand_results.multi_hand_landmarks or not pose_landmarks:
        return False
    nose = pose_landmarks.landmark[mp_pose.PoseLandmark.NOSE.value]
    for hl in hand_results.multi_hand_landmarks:
        for lm in hl.landmark:
            if np.hypot(lm.x - nose.x, lm.y - nose.y) < thr:
                return True
    return False

def dist(lm, a, b):
    return np.linalg.norm(np.array([lm[a].x, lm[a].y]) - np.array([lm[b].x, lm[b].y]))

def detect_emotion(face_results, ear):
    if not face_results.multi_face_landmarks:
        return "😶 No face"
    lm = face_results.multi_face_landmarks[0].landmark

    mouth_w     = dist(lm, 61, 291)
    mouth_open  = dist(lm, 13, 14)
    mouth_ratio = mouth_open / (mouth_w + 1e-6)
    smile_curve = (lm[61].y + lm[291].y) / 2 - (lm[13].y + lm[14].y) / 2
    brow_lower  = ((lm[159].y - lm[105].y) + (lm[386].y - lm[334].y)) / 2
    brow_furrow = dist(lm, 107, 336)
    nose_flare  = dist(lm, 129, 358) / (dist(lm, 168, 6) + 1e-6)

    if ear < 0.17:                                                         return "😴 Drowsy"
    if smile_curve < -0.008:
        return "😄 Laughing" if mouth_ratio > 0.3 else                    "😊 Happy"
    if brow_lower < 0.025 and mouth_ratio > 0.25:                         return "😮 Surprised"
    if brow_lower > 0.055 and brow_furrow < 0.045 and mouth_ratio < 0.15: return "😠 Angry"
    if nose_flare > 1.7 and brow_lower > 0.04:                            return "🤢 Disgusted"
    if smile_curve > 0.012:
        return "😭 Crying" if mouth_ratio > 0.18 else                     "😢 Sad"
    if ear > 0.30 and brow_lower < 0.035 and mouth_ratio > 0.20:          return "😨 Fearful"
    if brow_lower > 0.04 and mouth_ratio < 0.12:                          return "🤔 Focused"
    return "😐 Neutral"

# ── APPLICATION VIEW LAYOUT ───────────────────────────────────────────────────
tab_live, tab_history, tab_settings = st.tabs([
    "🖥️ Live Monitor", "📊 Session History", "⚙️ Calibration & Settings"
])

# ── TAB 1: LIVE MONITOR ───────────────────────────────────────────────────────
with tab_live:
    if st.session_state.run and st.session_state.cap is not None:
        col_video, col_stats = st.columns([1.3, 1])
        
        frame_window = col_video.image([])
        
        # Real-time metrics in Col 2
        with col_stats:
            st.markdown("<div class='premium-card'><div class='metric-title'>🎯 Posture Score</div>", unsafe_allow_html=True)
            posture_val_ph = st.empty()
            posture_bar_ph = st.empty()
            st.markdown("</div>", unsafe_allow_html=True)
            
            col_metric_1, col_metric_2 = st.columns(2)
            with col_metric_1:
                st.markdown("<div class='premium-card'><div class='metric-title'>🧠 Attention Level</div>", unsafe_allow_html=True)
                attention_ph = st.empty()
                st.markdown("</div>", unsafe_allow_html=True)
                
                st.markdown("<div class='premium-card'><div class='metric-title'>😐 Emotion</div>", unsafe_allow_html=True)
                emotion_ph = st.empty()
                st.markdown("</div>", unsafe_allow_html=True)
                
            with col_metric_2:
                st.markdown("<div class='premium-card'><div class='metric-title'>👁️ Blinks Tracker</div>", unsafe_allow_html=True)
                blink_ph = st.empty()
                st.markdown("</div>", unsafe_allow_html=True)
                
                st.markdown("<div class='premium-card'><div class='metric-title'>🔔 Alerts Triggered</div>", unsafe_allow_html=True)
                alerts_ph = st.empty()
                st.markdown("</div>", unsafe_allow_html=True)
            
            # Diagnostics Dashboard (NEW!)
            st.markdown("<div class='premium-card'><div class='metric-title'>🔍 Posture Diagnostics</div>", unsafe_allow_html=True)
            diagnostics_ph = st.empty()
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Live Trend Graph (NEW!)
            st.markdown("<div class='premium-card'><div class='metric-title'>📈 Active Session Trend</div>", unsafe_allow_html=True)
            graph_ph = st.empty()
            st.markdown("</div>", unsafe_allow_html=True)
            
            # Stretch Break Suggestions (NEW!)
            st.markdown("<div class='premium-card'><div class='metric-title'>🧘 Context-Aware Stretches</div>", unsafe_allow_html=True)
            recommendations_ph = st.empty()
            st.markdown("</div>", unsafe_allow_html=True)
            
            alert_ph = st.empty()

        # Capture loop
        cap = st.session_state.cap
        if not cap.isOpened():
            st.error("❌ Camera not accessible. Please ensure permissions are granted.")
            st.session_state.run = False
        else:
            while st.session_state.run:
                ret, frame = cap.read()
                if not ret:
                    st.error("❌ Failed to read from webcam.")
                    break

                frame = cv2.flip(frame, 1)
                rgb   = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

                pose_results = st.session_state.pose_detector.process(rgb)
                hand_results = st.session_state.hand_detector.process(rgb)
                face_results = st.session_state.face_detector.process(rgb)

                # Process blinks and EAR
                ear = 0.3
                head_tilt = 0.0
                nose_z = 0.0
                ear_z = 0.0
                
                if face_results.multi_face_landmarks:
                    lm  = face_results.multi_face_landmarks[0].landmark
                    ear = (eye_aspect_ratio(lm, LEFT_EYE) + eye_aspect_ratio(lm, RIGHT_EYE)) / 2
                    
                    # Head Tilt
                    if len(lm) > 454:
                        left_ear_lm = lm[234]
                        right_ear_lm = lm[454]
                        head_tilt = abs(left_ear_lm.y - right_ear_lm.y)
                        
                        # Forward head components
                        nose_z = lm[1].z
                        ear_z = (left_ear_lm.z + right_ear_lm.z) / 2

                if ear < EAR_THRESHOLD:
                    st.session_state.blink_consec += 1
                else:
                    if st.session_state.blink_consec >= 2:
                        st.session_state.blink_count += 1
                        st.session_state.blink_timestamps.append(time.time())
                    st.session_state.blink_consec = 0

                bpm     = blinks_per_minute()
                att_s   = attention_score(bpm, ear)
                att_l   = attention_label(att_s)
                emotion = detect_emotion(face_results, ear)

                # Posture checking
                p_score      = 0
                hand_on_face = is_hand_near_face(hand_results, pose_results.pose_landmarks)
                
                # Default posture issues as False
                slouching_active = False
                forward_head_active = False
                head_tilt_active = False
                shoulder_slant_active = False
                
                # Active degree telemetries (Option 1 Upgrade!)
                shoulder_angle_deg = 0.0
                neck_angle_deg = 0.0
                head_angle_deg = 0.0

                h_dim, w_dim, _ = frame.shape

                # Calibration trigger frame processing
                if st.session_state.trigger_calibrate and pose_results.pose_landmarks:
                    lm = pose_results.pose_landmarks.landmark
                    ls = lm[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
                    rs = lm[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
                    nose = lm[mp_pose.PoseLandmark.NOSE.value]
                    st.session_state.base_shoulder_slope = ls.y - rs.y
                    st.session_state.base_nose_centering = nose.x - (ls.x + rs.x) / 2
                    st.session_state.calibrated = True
                    st.session_state.trigger_calibrate = False

                if hand_results.multi_hand_landmarks:
                    for hl in hand_results.multi_hand_landmarks:
                        mp_drawing.draw_landmarks(frame, hl, mp_hands.HAND_CONNECTIONS)

                # Calculate head tilt telemetry if face mesh active
                if face_results.multi_face_landmarks and len(lm) > 454:
                    le_x, le_y = int(left_ear_lm.x * w_dim), int(left_ear_lm.y * h_dim)
                    re_x, re_y = int(right_ear_lm.x * w_dim), int(right_ear_lm.y * h_dim)
                    
                    # Draw horizontal reference baseline
                    draw_dashed_line(frame, (le_x, le_y), (re_x, le_y), (100, 100, 100), thickness=1, gap=6)
                    
                    dx_hd = re_x - le_x
                    dy_hd = re_y - le_y
                    head_angle_deg = abs(np.degrees(np.arctan2(dy_hd, dx_hd)))
                    
                    if head_tilt > 0.04:
                        head_tilt_active = True
                        
                    # Draw ear alignment vector
                    color_hd = (34, 197, 94) if not head_tilt_active else (68, 68, 239)
                    cv2.line(frame, (le_x, le_y), (re_x, re_y), color_hd, 2, cv2.LINE_AA)
                    cv2.putText(frame, f"Head: {head_angle_deg:.1f} deg", (le_x - 10, le_y - 12),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, color_hd, 1, cv2.LINE_AA)

                if pose_results.pose_landmarks:
                    mp_drawing.draw_landmarks(frame, pose_results.pose_landmarks, mp_pose.POSE_CONNECTIONS)
                    
                    # Compute uneven shoulders slope slant
                    lm_pose = pose_results.pose_landmarks.landmark
                    ls_pose = lm_pose[mp_pose.PoseLandmark.LEFT_SHOULDER.value]
                    rs_pose = lm_pose[mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
                    current_shoulder_slope = ls_pose.y - rs_pose.y
                    
                    ls_x, ls_y = int(ls_pose.x * w_dim), int(ls_pose.y * h_dim)
                    rs_x, rs_y = int(rs_pose.x * w_dim), int(rs_pose.y * h_dim)
                    
                    # Draw horizontal shoulder reference baseline
                    draw_dashed_line(frame, (ls_x, ls_y), (rs_x, ls_y), (100, 100, 100), thickness=1, gap=6)
                    
                    dx_sh = rs_x - ls_x
                    dy_sh = rs_y - ls_y
                    shoulder_angle_deg = abs(np.degrees(np.arctan2(dy_sh, dx_sh)))
                    
                    if abs(current_shoulder_slope - st.session_state.base_shoulder_slope) > 0.04:
                        shoulder_slant_active = True
                        
                    # Draw shoulder vector line
                    color_sh = (0, 212, 255) if not shoulder_slant_active else (68, 68, 239)
                    cv2.line(frame, (ls_x, ls_y), (rs_x, rs_y), color_sh, 2, cv2.LINE_AA)
                    cv2.putText(frame, f"Shoulder: {shoulder_angle_deg:.1f} deg", (ls_x + 15, ls_y - 12),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, color_sh, 1, cv2.LINE_AA)
                                
                    # Calculate Head-Neck Alignment Vector
                    mid_sh_x = (ls_x + rs_x) // 2
                    mid_sh_y = (ls_y + rs_y) // 2
                    nose_lm = lm_pose[mp_pose.PoseLandmark.NOSE.value]
                    nose_x, nose_y = int(nose_lm.x * w_dim), int(nose_lm.y * h_dim)
                    
                    # Draw vertical alignment baseline
                    draw_dashed_line(frame, (mid_sh_x, mid_sh_y), (mid_sh_x, nose_y), (100, 100, 100), thickness=1, gap=6)
                    
                    dx_nk = nose_x - mid_sh_x
                    dy_nk = mid_sh_y - nose_y
                    neck_angle_deg = abs(np.degrees(np.arctan2(dx_nk, dy_nk)))
                    
                    if (ear_z - nose_z) > 0.06:
                        forward_head_active = True
                        
                    # Draw neck alignment vector
                    color_nk = (240, 85, 168) if not forward_head_active else (68, 68, 239)
                    cv2.line(frame, (mid_sh_x, mid_sh_y), (nose_x, nose_y), color_nk, 2, cv2.LINE_AA)
                    cv2.putText(frame, f"Neck: {neck_angle_deg:.1f} deg", (nose_x + 15, nose_y + 15),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, color_nk, 1, cv2.LINE_AA)
                    
                    if not hand_on_face:
                        p_score = posture_score(
                            pose_results.pose_landmarks.landmark,
                            base_slope=st.session_state.base_shoulder_slope,
                            base_centering=st.session_state.base_nose_centering
                        )
                        st.session_state.posture_scores.append(p_score)
                        
                        # Set active diagnostic issues
                        if p_score < SLOUCH_THRESHOLD and p_score > 0:
                            slouching_active = True
                        
                        color = (34, 197, 94) if p_score > 75 else ((234, 179, 8) if p_score > 55 else (239, 68, 68))
                        cv2.putText(frame, f"Posture Score: {p_score}", (20, 50),
                                    cv2.FONT_HERSHEY_SIMPLEX, 1, (color[2], color[1], color[0]), 3)

                # Track diagnostic history counts for stretch breaks
                st.session_state.total_frame_count += 1
                if slouching_active: st.session_state.slouching_count += 1
                if head_tilt_active: st.session_state.head_tilt_count += 1
                if forward_head_active: st.session_state.forward_head_count += 1
                if shoulder_slant_active: st.session_state.uneven_shoulders_count += 1

                # Render dynamic metrics
                if hand_on_face:
                    posture_val_ph.markdown("<div class='metric-value' style='color:#eab308;'>✋ Hand Near Face</div>", unsafe_allow_html=True)
                    posture_bar_ph.progress(0)
                else:
                    status_text = "Good" if p_score > 75 else ("Fair" if p_score > 55 else "Poor! Sit Straight")
                    color_hex = "#22c55e" if p_score > 75 else ("#eab308" if p_score > 55 else "#ef4444")
                    posture_val_ph.markdown(f"<div class='metric-value' style='color:{color_hex};'>{p_score} <span style='font-size:1.1rem; font-weight:500;'>({status_text})</span></div>", unsafe_allow_html=True)
                    posture_bar_ph.progress(p_score / 100.0)

                attention_ph.markdown(f"<div class='metric-value'>{att_s}%</div><div class='metric-subtitle'>{att_l}</div>", unsafe_allow_html=True)
                emotion_ph.markdown(f"<div class='metric-value'>{emotion}</div>", unsafe_allow_html=True)
                blink_ph.markdown(f"<div class='metric-value'>{st.session_state.blink_count}</div><div class='metric-subtitle'>{bpm} / min</div>", unsafe_allow_html=True)
                alerts_ph.markdown(f"<div class='metric-value'>{st.session_state.alert_count}</div>", unsafe_allow_html=True)

                # Render live diagnostics statuses (NEW!)
                diag_html = f"""
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 5px;">
                    <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid {'rgba(239,68,68,0.3)' if slouching_active else 'rgba(34,197,94,0.1)'};">
                        <span style="font-size: 0.8rem; color: #8b92a8; font-family: 'JetBrains Mono';">Slouching</span><br>
                        <span style="font-weight: 700; color: {'#ef4444' if slouching_active else '#22c55e'};">{'🔴 Active' if slouching_active else '🟢 Normal'}</span>
                    </div>
                    <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid {'rgba(239,68,68,0.3)' if forward_head_active else 'rgba(34,197,94,0.1)'};">
                        <span style="font-size: 0.8rem; color: #8b92a8; font-family: 'JetBrains Mono';">Forward Head</span><br>
                        <span style="font-weight: 700; color: {'#ef4444' if forward_head_active else '#22c55e'};">{f'🔴 {neck_angle_deg:.1f}° Dev' if forward_head_active else f'🟢 {neck_angle_deg:.1f}° Dev'}</span>
                    </div>
                    <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid {'rgba(239,68,68,0.3)' if head_tilt_active else 'rgba(34,197,94,0.1)'};">
                        <span style="font-size: 0.8rem; color: #8b92a8; font-family: 'JetBrains Mono';">Head Tilt</span><br>
                        <span style="font-weight: 700; color: {'#ef4444' if head_tilt_active else '#22c55e'};">{f'🔴 {head_angle_deg:.1f}°' if head_tilt_active else f'🟢 {head_angle_deg:.1f}°'}</span>
                    </div>
                    <div style="padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid {'rgba(239,68,68,0.3)' if shoulder_slant_active else 'rgba(34,197,94,0.1)'};">
                        <span style="font-size: 0.8rem; color: #8b92a8; font-family: 'JetBrains Mono';">Shoulder Slant</span><br>
                        <span style="font-weight: 700; color: {'#ef4444' if shoulder_slant_active else '#22c55e'};">{f'🔴 {shoulder_angle_deg:.1f}°' if shoulder_slant_active else f'🟢 {shoulder_angle_deg:.1f}°'}</span>
                    </div>
                </div>
                """
                diagnostics_ph.markdown(diag_html, unsafe_allow_html=True)

                # Live trend graph updater (NEW!)
                now = time.time()
                if now - st.session_state.last_graph_time >= 1.0:
                    st.session_state.last_graph_time = now
                    st.session_state.live_graph_data.append(p_score)
                    graph_ph.line_chart(list(st.session_state.live_graph_data))

                # Render dynamic stretch break recommendations (NEW!)
                counts = {
                    "slouching": st.session_state.slouching_count,
                    "forward_head": st.session_state.forward_head_count,
                    "head_tilt": st.session_state.head_tilt_count,
                    "uneven_shoulders": st.session_state.uneven_shoulders_count
                }
                max_issue = max(counts, key=counts.get)
                max_val = counts[max_issue]

                if max_val < st.session_state.total_frame_count * 0.1 or st.session_state.total_frame_count == 0:
                    stretch_html = """
                    <div style="text-align: center; padding: 10px;">
                        <span style="font-size: 2.2rem; display: block; margin-bottom: 5px;">🌟</span>
                        <span style="font-weight: 700; color: #22c55e; font-size: 1rem; display: block;">Great Posture!</span>
                        <p style="color: #8b92a8; font-size: 0.85rem; margin-top: 5px; margin-bottom: 0;">Keep it up — your spine thanks you!</p>
                    </div>
                    """
                elif max_issue == "slouching":
                    stretch_html = """
                    <div style="border-left: 3px solid #00d4ff; padding-left: 12px;">
                        <span style="font-size: 1.5rem; vertical-align: middle; margin-right: 5px;">🔄</span>
                        <span style="font-weight: 700; color: #00d4ff; font-size: 1rem;">Shoulder Roll Stretch</span>
                        <p style="color: #8b92a8; font-size: 0.85rem; margin-top: 4px; margin-bottom: 8px;">Loosen up tight shoulders from slouching.</p>
                        <div style="font-size: 0.85rem; line-height: 1.4; color: #e8eaf0;">
                            1. Sit up straight with feet flat on the floor.<br>
                            2. Roll both shoulders forward in circles 5 times.<br>
                            3. Roll backward 5 times.<br>
                            4. Squeeze shoulder blades, hold 5s, release.
                        </div>
                    </div>
                    """
                elif max_issue == "forward_head":
                    stretch_html = """
                    <div style="border-left: 3px solid #00d4ff; padding-left: 12px;">
                        <span style="font-size: 1.5rem; vertical-align: middle; margin-right: 5px;">💪</span>
                        <span style="font-weight: 700; color: #00d4ff; font-size: 1rem;">Chin Tuck Exercise</span>
                        <p style="color: #8b92a8; font-size: 0.85rem; margin-top: 4px; margin-bottom: 8px;">Correct forward head posture and strengthen neck muscles.</p>
                        <div style="font-size: 0.85rem; line-height: 1.4; color: #e8eaf0;">
                            1. Sit or stand with your back straight.<br>
                            2. Gently tuck your chin toward your chest (make a double chin).<br>
                            3. Hold for 5 seconds, feeling a stretch in the back of your neck.<br>
                            4. Repeat 10 times.
                        </div>
                    </div>
                    """
                else:  # head_tilt or uneven_shoulders
                    stretch_html = """
                    <div style="border-left: 3px solid #00d4ff; padding-left: 12px;">
                        <span style="font-size: 1.5rem; vertical-align: middle; margin-right: 5px;">🧘</span>
                        <span style="font-weight: 700; color: #00d4ff; font-size: 1rem;">Neck Stretch</span>
                        <p style="color: #8b92a8; font-size: 0.85rem; margin-top: 4px; margin-bottom: 8px;">Release tension from tilting your head or shoulders.</p>
                        <div style="font-size: 0.85rem; line-height: 1.4; color: #e8eaf0;">
                            1. Sit upright and look straight ahead.<br>
                            2. Slowly tilt your head toward your right shoulder.<br>
                            3. Hold for 15 seconds, feeling the side stretch.<br>
                            4. Repeat on the left side.
                        </div>
                    </div>
                    """
                recommendations_ph.markdown(stretch_html, unsafe_allow_html=True)

                # Display raw frame
                frame_window.image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

                # Process alerts
                if slouching_active and not hand_on_face:
                    alert_ph.markdown(
                        "<div class='custom-alert alert-red'>⚠️ BAD POSTURE — SIT UP STRAIGHT!</div>",
                        unsafe_allow_html=True
                    )
                    if time.time() - st.session_state.last_alert_time > 6:
                        st.session_state.last_alert_time = time.time()
                        st.session_state.alert_count += 1
                        if SOUND_ALERTS:
                            trigger_audio_alert()
                elif att_s < ATTENTION_THRESHOLD:
                    alert_ph.markdown(
                        "<div class='custom-alert alert-orange'>👁️ LOW ATTENTION — REFOCUS!</div>",
                        unsafe_allow_html=True
                    )
                else:
                    alert_ph.empty()

                time.sleep(0.01)
    else:
        st.markdown("""
        <div class="premium-card" style="text-align: center; padding: 4rem 2rem;">
            <span style="font-size: 4rem;">📷</span>
            <h3 style="margin-top: 1rem; font-weight: 700;">Camera is Inactive</h3>
            <p style="color: #8b92a8; max-width: 500px; margin: 0.5rem auto 1.5rem auto;">
                Start the webcam from the sidebar to begin monitoring your posture, tracking blinking habits, attention level, and emotional indicators in real time.
            </p>
        </div>
        """, unsafe_allow_html=True)

# ── TAB 2: SESSION HISTORY ────────────────────────────────────────────────────
with tab_history:
    st.markdown("<h3 style='color:#00d4ff;'>📊 Monitoring Session History</h3>", unsafe_allow_html=True)
    history = load_history()
    
    if not history:
        st.info("📋 No session data recorded yet. Complete a webcam session and stop the webcam to save your stats.")
    else:
        # Calculate summaries
        total_sessions = len(history)
        total_duration_sec = sum(s["duration"] for s in history)
        avg_score = int(sum(s["avg_score"] for s in history) / total_sessions)
        total_alerts = sum(s["alerts"] for s in history)
        
        m_col1, m_col2, m_col3, m_col4 = st.columns(4)
        with m_col1:
            st.markdown(f"<div class='premium-card'><div class='metric-title'>📊 Total Sessions</div><div class='metric-value'>{total_sessions}</div></div>", unsafe_allow_html=True)
        with m_col2:
            st.markdown(f"<div class='premium-card'><div class='metric-title'>⏱️ Total Time</div><div class='metric-value'>{total_duration_sec // 60}m {total_duration_sec % 60}s</div></div>", unsafe_allow_html=True)
        with m_col3:
            color_hex = "#22c55e" if avg_score > 75 else ("#eab308" if avg_score > 55 else "#ef4444")
            st.markdown(f"<div class='premium-card'><div class='metric-title'>🎯 Avg Score</div><div class='metric-value' style='color:{color_hex};'>{avg_score}</div></div>", unsafe_allow_html=True)
        with m_col4:
            st.markdown(f"<div class='premium-card'><div class='metric-title'>🔔 Total Alerts</div><div class='metric-value'>{total_alerts}</div></div>", unsafe_allow_html=True)
            
        # Graph of last 7 sessions
        last_7 = history[-7:]
        dates = [s["date"].split(" ")[0] + " " + s["date"].split(" ")[1][:5] for s in last_7]
        scores = [s["avg_score"] for s in last_7]
        
        st.markdown("<div class='premium-card'><div class='metric-title'>📈 Last 7 Sessions Trend</div>", unsafe_allow_html=True)
        st.bar_chart(data=dict(zip(dates, scores)))
        st.markdown("</div>", unsafe_allow_html=True)
        
        # Details log
        st.markdown("<div class='premium-card'><div class='metric-title'>📋 All Logged Sessions</div>", unsafe_allow_html=True)
        formatted_history = []
        for i, s in enumerate(reversed(history)):
            formatted_history.append({
                "#": total_sessions - i,
                "Date & Time": s["date"],
                "Duration": f"{s['duration'] // 60}m {s['duration'] % 60}s",
                "Average Score": f"{s['avg_score']}/100",
                "Alerts Triggered": s["alerts"]
            })
        st.table(formatted_history)
        st.markdown("</div>", unsafe_allow_html=True)
        
        if st.button("🗑️ Clear All Session History", use_container_width=True):
            clear_session_history()
            st.success("Session history cleared successfully!")
            time.sleep(1)
            st.rerun()

# ── TAB 3: CALIBRATION & SETTINGS ─────────────────────────────────────────────
with tab_settings:
    st.markdown("<h3 style='color:#00d4ff;'>⚖️ Camera & Posture Calibration</h3>", unsafe_allow_html=True)
    st.markdown("""
    Posture scores are by default measured against standard horizontal shoulder alignment. 
    However, if your camera is placed slightly to the side or at an angle, you should calibrate a custom posture baseline.
    """)
    
    st.markdown("<div class='premium-card'>", unsafe_allow_html=True)
    col_c1, col_c2 = st.columns([2, 1])
    with col_c1:
        st.markdown("##### How to Calibrate:")
        st.markdown("""
        1. Click **Start Webcam** in the sidebar.
        2. Sit comfortably in your perfect upright posture.
        3. Click the **Calibrate Posture** button below.
        4. The system will save your custom baseline values to compute accurate deviation scores.
        """)
        if st.button("⚖️ Calibrate Posture Baseline", use_container_width=True):
            if st.session_state.run:
                st.session_state.trigger_calibrate = True
                st.info("Calibrating on next video frame...")
            else:
                st.warning("⚠️ Please turn on the webcam first before calibrating.")
    with col_c2:
        st.markdown("##### Current Calibration Values:")
        if st.session_state.calibrated:
            st.success("🟢 Calibrated Baseline Active")
            st.metric("Shoulder Slope Offset", f"{st.session_state.base_shoulder_slope:.4f}")
            st.metric("Nose Centering Offset", f"{st.session_state.base_nose_centering:.4f}")
            if st.button("Reset Calibration to Standard"):
                st.session_state.calibrated = False
                st.session_state.base_shoulder_slope = 0.0
                st.session_state.base_nose_centering = 0.0
                st.rerun()
        else:
            st.warning("⚪ Standard Baseline (Uncalibrated)")
            st.info("Aligned with default horizontal layout.")
    st.markdown("</div>", unsafe_allow_html=True)