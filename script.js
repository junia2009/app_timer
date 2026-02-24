// 日本標準時の現在時刻表示
function updateJST() {
    const now = new Date();
    // JSTで表示
    const timeStr = now.toLocaleTimeString('ja-JP', { hour12: false, timeZone: 'Asia/Tokyo' });
    document.getElementById('current-time').textContent = timeStr;
}
setInterval(updateJST, 1000);
updateJST();

// タイマー機能


// カウントダウンタイマー
// 点滅用
let flashInterval = null;
function startFlash() {
    const area = document.getElementById('countdown-timer');
    if (!area) return;
    let on = false;
    flashInterval = setInterval(() => {
        area.style.background = on ? '#ffe600' : '#232526';
        on = !on;
    }, 300);
}
function stopFlash() {
    clearInterval(flashInterval);
    const area = document.getElementById('countdown-timer');
    if (area) area.style.background = '#232526';
}

// --- Web Audio API によるアラーム音 ---
let alarmAudioCtx = null;
let alarmInterval = null;
let alarmGain = null;

// ブラウザの自動再生ブロック対策: ユーザー操作時に AudioContext を作成
function ensureAudioContext() {
    if (!alarmAudioCtx || alarmAudioCtx.state === 'closed') {
        alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (alarmAudioCtx.state === 'suspended') {
        alarmAudioCtx.resume();
    }
}
window.addEventListener('click', ensureAudioContext, { once: true });
window.addEventListener('touchstart', ensureAudioContext, { once: true });

function playAlarmBeep() {
    if (!alarmAudioCtx) {
        alarmAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (alarmAudioCtx.state === 'suspended') {
        alarmAudioCtx.resume();
    }
    const ctx = alarmAudioCtx;
    const t = ctx.currentTime;

    // ビープ音パターン: ピピピッ … ピピピッ … を繰り返す
    function scheduleBeepGroup(startTime) {
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = 1200;
            gain.gain.setValueAtTime(0.35, startTime + i * 0.12);
            gain.gain.setValueAtTime(0, startTime + i * 0.12 + 0.09);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime + i * 0.12);
            osc.stop(startTime + i * 0.12 + 0.09);
        }
    }

    // 最初のグループをすぐ再生
    scheduleBeepGroup(t);

    // 0.7秒ごとに繰り返し
    alarmInterval = setInterval(() => {
        if (alarmAudioCtx && alarmAudioCtx.state === 'running') {
            scheduleBeepGroup(alarmAudioCtx.currentTime);
        }
    }, 700);
}

function stopAlarm() {
    if (alarmInterval) {
        clearInterval(alarmInterval);
        alarmInterval = null;
    }
    stopVibration();
}

// --- バイブレーション ---
let vibrationInterval = null;
function startVibration() {
    if (!navigator.vibrate) return; // 非対応ブラウザはスキップ
    // パターン: 振動200ms → 休止300ms → 振動200ms → 休止300ms → 振動200ms → 休止700ms を繰り返す
    navigator.vibrate([200, 300, 200, 300, 200, 700]);
    vibrationInterval = setInterval(() => {
        navigator.vibrate([200, 300, 200, 300, 200, 700]);
    }, 1900);
}
function stopVibration() {
    if (vibrationInterval) {
        clearInterval(vibrationInterval);
        vibrationInterval = null;
    }
    if (navigator.vibrate) navigator.vibrate(0);
}

// --- イヤホンモード ---
let earphoneMode = false;

function updateEarphoneLabel() {
    const label = document.getElementById('earphone-mode-label');
    if (!label) return;
    if (earphoneMode) {
        label.textContent = '🎧 イヤホンモード（音あり）';
        label.style.color = '#4fc3f7';
    } else {
        label.textContent = '🔇 スピーカーOFF（振動のみ）';
        label.style.color = '#b0b0b0';
    }
}

function triggerAlarm() {
    startFlash();
    startVibration();
    if (earphoneMode) {
        playAlarmBeep();
    }
}

function stopAllAlarm() {
    stopAlarm();
    stopFlash();
    stopVibration();
}

// --- Wake Lock API（画面スリープ防止） ---
let wakeLock = null;

async function requestWakeLock() {
    if (!('wakeLock' in navigator)) {
        updateWakeLockStatus('非対応');
        return;
    }
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        updateWakeLockStatus('ON');
        // タブが再表示されたら自動で再取得
        wakeLock.addEventListener('release', () => {
            updateWakeLockStatus('OFF');
            wakeLock = null;
        });
    } catch (e) {
        updateWakeLockStatus('OFF');
        console.warn('Wake Lock 取得失敗:', e);
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
        updateWakeLockStatus('OFF');
    }
}

function updateWakeLockStatus(status) {
    const el = document.getElementById('wakelock-status');
    if (!el) return;
    if (status === 'ON') {
        el.textContent = '☀️ 画面スリープ防止: ON';
        el.style.color = '#66bb6a';
    } else if (status === '非対応') {
        el.textContent = '⚠️ スリープ防止: このブラウザでは非対応';
        el.style.color = '#ff9800';
    } else {
        el.textContent = '💤 画面スリープ防止: OFF';
        el.style.color = '#888';
    }
}

// タブが再表示された時にWake Lockを再取得
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && countdownRunning && !wakeLock) {
        await requestWakeLock();
    }
});

let countdownInterval;
let countdownTime = 0;
let countdownRemaining = 0;
let countdownRunning = false;

function setCountdown(minutes) {
    countdownTime = minutes * 60 * 1000;
    countdownRemaining = countdownTime;
    countdownRunning = false;
    clearInterval(countdownInterval);
    updateCountdownDisplay();
    // 音ボタン非表示
    const area = document.getElementById('sound-btn-area');
    if (area) area.style.display = 'none';
}

function setCustomCountdown() {
    const min = parseInt(document.getElementById('custom-minutes').value) || 0;
    const sec = parseInt(document.getElementById('custom-seconds').value) || 0;
    countdownTime = (min * 60 + sec) * 1000;
    countdownRemaining = countdownTime;
    countdownRunning = false;
    clearInterval(countdownInterval);
    updateCountdownDisplay();
    // 音ボタン非表示
    const area = document.getElementById('sound-btn-area');
    if (area) area.style.display = 'none';
}

function updateCountdownDisplay() {
    let ms = Math.max(0, Math.floor(countdownRemaining));
    let min = Math.floor(ms / 60000);
    let sec = Math.floor((ms % 60000) / 1000);
    let milli = ms % 1000;
    document.getElementById('countdown-display').textContent =
        `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

function startCountdown() {
    if (countdownRunning || countdownRemaining <= 0) return;
    countdownRunning = true;
    requestWakeLock();
    let last = performance.now();
    countdownInterval = setInterval(() => {
        let now = performance.now();
        let elapsed = now - last;
        last = now;
        countdownRemaining -= elapsed;
        if (countdownRemaining <= 0) {
            countdownRemaining = 0;
            updateCountdownDisplay();
            stopCountdown();
            // アラーム通知開始、停止ボタン表示
            const area = document.getElementById('sound-btn-area');
            if (area) area.style.display = '';
            triggerAlarm();
        } else {
            updateCountdownDisplay();
        }
    }, 10);
}

// 初期化
window.addEventListener('DOMContentLoaded', () => {
    // アラーム停止ボタン
    const btn = document.getElementById('play-sound-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            stopAllAlarm();
            releaseWakeLock();
            const area = document.getElementById('sound-btn-area');
            if (area) area.style.display = 'none';
        });
    }

    // Wake Lock 初期表示
    updateWakeLockStatus('OFF');

    // イヤホンモード トグル
    const toggle = document.getElementById('earphone-mode-toggle');
    if (toggle) {
        // localStorageから復元
        const saved = localStorage.getItem('earphoneMode');
        if (saved === 'true') {
            earphoneMode = true;
            toggle.checked = true;
        }
        updateEarphoneLabel();

        toggle.addEventListener('change', () => {
            earphoneMode = toggle.checked;
            localStorage.setItem('earphoneMode', earphoneMode);
            updateEarphoneLabel();
            // トグル操作時に AudioContext を準備
            if (earphoneMode) ensureAudioContext();
        });
    }
});

function stopCountdown() {
    countdownRunning = false;
    clearInterval(countdownInterval);
}

function resetCountdown() {
    countdownRemaining = countdownTime;
    updateCountdownDisplay();
    stopCountdown();
    releaseWakeLock();
    stopAllAlarm();
    const area = document.getElementById('sound-btn-area');
    if (area) area.style.display = 'none';
}
