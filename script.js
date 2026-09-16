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
    clearInterval(flashInterval);
    flashInterval = setInterval(() => {
        area.style.background = on ? '#ffe600' : '';
        // 黄色の間は文字を濃色にして読めるようにする
        document.body.classList.toggle('flash-on', on);
        on = !on;
    }, 300);
}
function stopFlash() {
    clearInterval(flashInterval);
    flashInterval = null;
    const area = document.getElementById('countdown-timer');
    if (area) area.style.background = '';
    document.body.classList.remove('flash-on');
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

    // ビープ音パターン: やさしいトーンを3回 … 繰り返す
    function scheduleBeepGroup(startTime) {
        const notes = [660, 880, 660]; // 柔らかいメロディ風
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = notes[i];
            // フェードイン・フェードアウトで耳あたりをやさしく
            const noteStart = startTime + i * 0.2;
            gain.gain.setValueAtTime(0, noteStart);
            gain.gain.linearRampToValueAtTime(0.25, noteStart + 0.04);
            gain.gain.linearRampToValueAtTime(0, noteStart + 0.16);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(noteStart);
            osc.stop(noteStart + 0.18);
        }
    }

    // 最初のグループをすぐ再生
    scheduleBeepGroup(t);

    // 1秒ごとに繰り返し（間隔をゆったり）
    alarmInterval = setInterval(() => {
        if (alarmAudioCtx && alarmAudioCtx.state === 'running') {
            scheduleBeepGroup(alarmAudioCtx.currentTime);
        }
    }, 1000);
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

// アラーム停止ボタンの表示（本体・ミニタイマーの両方をまとめて切り替える）
let alarmButtonVisible = false;
function showAlarmButton(show) {
    alarmButtonVisible = !!show;
    const area = document.getElementById('sound-btn-area');
    if (area) area.style.display = show ? '' : 'none';
}

// アラームを止めて後片付け（本体ボタン・ミニタイマー共通）
function stopAlarmAndHide() {
    stopAllAlarm();
    releaseWakeLock();
    showAlarmButton(false);
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

function setCountdownSeconds(totalSeconds) {
    countdownTime = totalSeconds * 1000;
    countdownRemaining = countdownTime;
    countdownRunning = false;
    clearInterval(countdownInterval);
    updateCountdownDisplay();
    showAlarmButton(false);
}

function setCountdown(minutes) {
    setCountdownSeconds(minutes * 60);
}

function readCustomInputSeconds() {
    const min = parseInt(document.getElementById('custom-minutes').value, 10) || 0;
    const sec = parseInt(document.getElementById('custom-seconds').value, 10) || 0;
    return min * 60 + sec;
}

function setCustomCountdown() {
    setCountdownSeconds(readCustomInputSeconds());
}

function updateCountdownDisplay() {
    let ms = Math.max(0, Math.floor(countdownRemaining));
    let min = Math.floor(ms / 60000);
    let sec = Math.floor((ms % 60000) / 1000);
    let milli = ms % 1000;
    const text = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
    const main = document.getElementById('countdown-display');
    if (main) main.textContent = text;
}

function startCountdown() {
    if (countdownRunning || countdownRemaining <= 0) return;
    clearInterval(countdownInterval); // 取りこぼしたタイマーが二重に走らないように
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
            showAlarmButton(true);
            triggerAlarm();
        } else {
            updateCountdownDisplay();
        }
    }, 10);
}

// --- プリセット（ユーザーが自由に登録できる） ---
const DEFAULT_PRESETS = [60, 180, 300]; // 1分 / 3分 / 5分
const MAX_PRESETS = 10;
const PRESETS_STORAGE_KEY = 'timerPresets';

let presets = DEFAULT_PRESETS.slice();
let presetEditMode = false;
let presetMessageTimer = null;

function loadPresets() {
    let loaded = null;
    try {
        const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                loaded = parsed
                    .map((v) => parseInt(v, 10))
                    .filter((v) => Number.isFinite(v) && v > 0 && v <= 24 * 3600);
            }
        }
    } catch (e) {
        console.warn('プリセットの読み込みに失敗:', e);
    }
    presets = (loaded && loaded.length) ? loaded : DEFAULT_PRESETS.slice();
}

function savePresets() {
    try {
        localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
    } catch (e) {
        console.warn('プリセットの保存に失敗:', e);
    }
}

function formatPresetLabel(totalSeconds) {
    const min = Math.floor(totalSeconds / 60);
    const sec = totalSeconds % 60;
    if (min && sec) return `${min}分${sec}秒`;
    if (min) return `${min}分`;
    return `${sec}秒`;
}

function showPresetMessage(text) {
    const el = document.getElementById('preset-message');
    if (!el) return;
    el.textContent = text;
    clearTimeout(presetMessageTimer);
    if (text) {
        presetMessageTimer = setTimeout(() => { el.textContent = ''; }, 3000);
    }
}

function addPresetFromInput() {
    const total = readCustomInputSeconds();
    if (total <= 0) {
        showPresetMessage('分または秒を入力してください');
        return;
    }
    if (presets.includes(total)) {
        showPresetMessage(`${formatPresetLabel(total)} はすでに登録されています`);
        return;
    }
    if (presets.length >= MAX_PRESETS) {
        showPresetMessage(`プリセットは${MAX_PRESETS}個までです`);
        return;
    }
    presets.push(total);
    presets.sort((a, b) => a - b);
    savePresets();
    renderPresets();
    showPresetMessage(`${formatPresetLabel(total)} を追加しました`);
}

function removePreset(totalSeconds) {
    presets = presets.filter((v) => v !== totalSeconds);
    savePresets();
    renderPresets();
    showPresetMessage(`${formatPresetLabel(totalSeconds)} を削除しました`);
}

function resetPresets() {
    presets = DEFAULT_PRESETS.slice();
    savePresets();
    renderPresets();
    showPresetMessage('初期値に戻しました');
}

function setPresetEditMode(on) {
    presetEditMode = !!on;
    const toggle = document.getElementById('preset-edit-toggle');
    const reset = document.getElementById('preset-reset');
    if (toggle) toggle.textContent = presetEditMode ? '✅ 編集を終わる' : '✏️ プリセットを編集';
    if (reset) reset.style.display = presetEditMode ? '' : 'none';
    renderPresets();
}

// 本体側のプリセットボタンを描画
function renderMainPresets() {
    const box = document.getElementById('preset-buttons');
    if (!box) return;
    box.textContent = '';

    if (!presets.length) {
        const empty = document.createElement('span');
        empty.id = 'preset-empty';
        empty.textContent = 'プリセットがありません（下で追加できます）';
        box.appendChild(empty);
        return;
    }

    presets.forEach((sec) => {
        const item = document.createElement('span');
        item.className = 'preset-item';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = formatPresetLabel(sec);
        btn.addEventListener('click', () => setCountdownSeconds(sec));
        item.appendChild(btn);

        if (presetEditMode) {
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'preset-delete';
            del.textContent = '×';
            del.title = `${formatPresetLabel(sec)} を削除`;
            del.addEventListener('click', () => removePreset(sec));
            item.appendChild(del);
        }

        box.appendChild(item);
    });
}

function renderPresets() {
    renderMainPresets();
}

// --- コンパクト表示（アプリのウィンドウ自体を小さなタイマーにする） ---
// 別ウィンドウを増やさずに済むよう、同じページの表示を切り替える方式。
// インストール済み PWA の場合はウィンドウのサイズ・位置も合わせて変更する。
const COMPACT_STORAGE_KEY = 'compactMode';
const COMPACT_WINDOW = { w: 340, h: 330 };
let compactMode = false;
let savedWindowRect = null;
let awaitingUnmaximize = false;

// 最大化中かどうか。ウィンドウ枠のぶん実測値は画面サイズより少し小さいので割合で判定する。
function isWindowMaximized() {
    const availW = window.screen.availWidth || 0;
    const availH = window.screen.availHeight || 0;
    if (!availW || !availH) return false;
    return window.outerWidth >= availW * 0.97 && window.outerHeight >= availH * 0.93;
}

function isCompactWindowSize() {
    return window.outerWidth <= COMPACT_WINDOW.w + 60;
}

// kind: null（非表示） / 'maximized' / 'unsupported'
function showCompactHint(kind) {
    const box = document.getElementById('compact-hint');
    if (!box) return;
    box.style.display = kind ? '' : 'none';
    box.querySelectorAll('[data-hint]').forEach((el) => {
        el.style.display = el.dataset.hint === kind ? '' : 'none';
    });
}

// 縮められるようになるまで一定間隔で試し続ける
const UNMAXIMIZE_WATCH_INTERVAL = 500;
const UNMAXIMIZE_WATCH_MAX_TRIES = 40; // 約20秒であきらめる
const HINT_AFTER_ATTEMPTS = 3; // 数回試してもダメなときだけ注意書きを出す
let unmaximizeWatcher = null;
let unmaximizeTries = 0;
let compactResizeAttempts = 0;

function stopUnmaximizeWatch() {
    if (unmaximizeWatcher) {
        clearInterval(unmaximizeWatcher);
        unmaximizeWatcher = null;
    }
    awaitingUnmaximize = false;
}

function startUnmaximizeWatch() {
    if (unmaximizeWatcher) return;
    awaitingUnmaximize = true;
    unmaximizeTries = 0;
    unmaximizeWatcher = setInterval(() => {
        if (!compactMode) {
            stopUnmaximizeWatch();
            showCompactHint(null);
            return;
        }
        if (isCompactWindowSize()) {
            stopUnmaximizeWatch();
            showCompactHint(null);
            return;
        }
        if (++unmaximizeTries > UNMAXIMIZE_WATCH_MAX_TRIES) {
            stopUnmaximizeWatch();
            return;
        }
        tryResizeToCompact();
    }, UNMAXIMIZE_WATCH_INTERVAL);
}

// リサイズを試し、実際に縮んだかを後から検証する
function tryResizeToCompact() {
    compactResizeAttempts++;
    try {
        window.resizeTo(COMPACT_WINDOW.w, COMPACT_WINDOW.h);
        window.moveTo(
            Math.max(0, (window.screen.availWidth || 1280) - COMPACT_WINDOW.w - 24),
            Math.max(0, (window.screen.availHeight || 720) - COMPACT_WINDOW.h - 24)
        );
    } catch (e) {
        console.info('ウィンドウのリサイズは利用できません:', e);
    }
    // ウィンドウマネージャへの反映は非同期なので少し待ってから確認する
    setTimeout(() => {
        if (!compactMode) return;
        if (isCompactWindowSize()) {
            stopUnmaximizeWatch();
            showCompactHint(null);
        } else {
            // すぐ成功することもあるので、数回失敗してから注意書きを出す
            if (compactResizeAttempts >= HINT_AFTER_ATTEMPTS) {
                // 最大化中なら解除待ち、そうでなければウィンドウ操作自体が不可（タブ表示）
                showCompactHint(isWindowMaximized() ? 'maximized' : 'unsupported');
            }
            startUnmaximizeWatch();
        }
    }, 250);
}

async function applyCompactWindowSize() {
    compactResizeAttempts = 0;
    savedWindowRect = {
        x: window.screenX,
        y: window.screenY,
        w: window.outerWidth,
        h: window.outerHeight
    };
    // F11 などのフルスクリーン中はまず解除する
    if (document.fullscreenElement) {
        try {
            await document.exitFullscreen();
        } catch (e) {
            console.info('フルスクリーンの解除に失敗:', e);
        }
    }
    tryResizeToCompact();
}

function restoreWindowSize() {
    stopUnmaximizeWatch();
    showCompactHint(null);
    if (!savedWindowRect) return;
    try {
        window.resizeTo(savedWindowRect.w, savedWindowRect.h);
        window.moveTo(savedWindowRect.x, savedWindowRect.y);
    } catch (e) {
        console.info('ウィンドウの復帰に失敗:', e);
    }
    savedWindowRect = null;
}

function setCompactMode(on) {
    compactMode = !!on;
    document.body.classList.toggle('compact', compactMode);
    try {
        localStorage.setItem(COMPACT_STORAGE_KEY, compactMode ? 'true' : 'false');
    } catch (e) {
        console.warn('表示モードの保存に失敗:', e);
    }
    if (compactMode) {
        applyCompactWindowSize();
    } else {
        restoreWindowSize();
    }
}

// --- 起動パラメータ（Windows ウィジェット／ジャンプリストからの起動） ---
// 例: ./?m=3&autostart=1  → 3分にセットして即スタート
function applyLaunchParams() {
    const params = new URLSearchParams(location.search);
    const rawMin = params.get('m') ?? params.get('minutes');
    const rawSec = params.get('s') ?? params.get('seconds');
    if (rawMin === null && rawSec === null) return;

    const min = parseInt(rawMin, 10) || 0;
    const sec = parseInt(rawSec, 10) || 0;
    const totalSec = min * 60 + sec;
    if (totalSec <= 0) return;

    // 入力欄にも反映しておく
    const minEl = document.getElementById('custom-minutes');
    const secEl = document.getElementById('custom-seconds');
    if (minEl) minEl.value = min || '';
    if (secEl) secEl.value = sec || '';

    countdownTime = totalSec * 1000;
    countdownRemaining = countdownTime;
    countdownRunning = false;
    clearInterval(countdownInterval);
    updateCountdownDisplay();

    const autostart = params.get('autostart');
    if (autostart === '1' || autostart === 'true') {
        // インストール済みPWAでは自動再生が許可されることが多いが、
        // ブロックされてもカウントダウン自体は続行する
        try { ensureAudioContext(); } catch (e) { /* noop */ }
        startCountdown();
    }
}

// 初期化
window.addEventListener('DOMContentLoaded', () => {
    // アラーム停止ボタン
    const btn = document.getElementById('play-sound-btn');
    if (btn) {
        btn.addEventListener('click', stopAlarmAndHide);
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

    // プリセット（localStorage から復元して描画）
    loadPresets();
    renderPresets();

    const addPresetBtn = document.getElementById('add-preset-btn');
    if (addPresetBtn) addPresetBtn.addEventListener('click', addPresetFromInput);

    const presetToggle = document.getElementById('preset-edit-toggle');
    if (presetToggle) presetToggle.addEventListener('click', () => setPresetEditMode(!presetEditMode));

    const presetResetBtn = document.getElementById('preset-reset');
    if (presetResetBtn) presetResetBtn.addEventListener('click', resetPresets);

    // コンパクト表示の切り替え
    const compactBtn = document.getElementById('compact-btn');
    if (compactBtn) compactBtn.addEventListener('click', () => setCompactMode(true));

    const expandBtn = document.getElementById('expand-btn');
    if (expandBtn) expandBtn.addEventListener('click', () => setCompactMode(false));

    // 前回コンパクト表示で終了していたら、その状態で開き直す
    try {
        if (localStorage.getItem(COMPACT_STORAGE_KEY) === 'true') {
            setCompactMode(true);
        }
    } catch (e) {
        console.warn('表示モードの復元に失敗:', e);
    }

    // ウィジェット等からの起動指定を反映（最後に実行）
    applyLaunchParams();
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
    showAlarmButton(false);
}
