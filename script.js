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
// --- 音声再生の自動ブロック対策 ---
let beepPrimed = false;
function primeBeepAudio() {
    if (!beepPrimed) {
        const beep = document.getElementById('beep-audio');
        if (beep) {
            beep.volume = 0;
            beep.play().catch(()=>{});
            beep.pause();
            beep.currentTime = 0;
            beep.volume = 1;
            beepPrimed = true;
        }
    }
}

window.addEventListener('click', primeBeepAudio, { once: true });
let countdownInterval;
let countdownTime = 0;
let countdownRemaining = 0;
let countdownRunning = false;

function setCountdown(minutes) {
    countdownTime = minutes * 60 * 1000;
    countdownRemaining = countdownTime;
    updateCountdownDisplay();
}

function setCustomCountdown() {
    const min = parseInt(document.getElementById('custom-minutes').value) || 0;
    const sec = parseInt(document.getElementById('custom-seconds').value) || 0;
    countdownTime = (min * 60 + sec) * 1000;
    countdownRemaining = countdownTime;
    updateCountdownDisplay();
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
            // ビープ音を鳴らす
            const beep = document.getElementById('beep-audio');
            if (beep) {
                beep.currentTime = 0;
                beep.play();
            }
            alert('タイマー終了！');
        } else {
            updateCountdownDisplay();
        }
    }, 10);
}

function stopCountdown() {
    countdownRunning = false;
    clearInterval(countdownInterval);
}

function resetCountdown() {
    countdownRemaining = countdownTime;
    updateCountdownDisplay();
    stopCountdown();
}
