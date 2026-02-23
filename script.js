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
let timerInterval = null;
let elapsed = 0;
let running = false;

function formatTime(sec) {
    const h = String(Math.floor(sec / 3600)).padStart(2, '0');
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateTimer() {
    document.getElementById('timer').textContent = formatTime(elapsed);
}

function startTimer() {
    if (!running) {
        running = true;
        timerInterval = setInterval(() => {
            elapsed++;
            updateTimer();
        }, 1000);
    }
}

function stopTimer() {
    if (running) {
        running = false;
        clearInterval(timerInterval);
    }
}

function resetTimer() {
    stopTimer();
    elapsed = 0;
    updateTimer();
}

document.getElementById('start').addEventListener('click', startTimer);
document.getElementById('stop').addEventListener('click', stopTimer);
document.getElementById('reset').addEventListener('click', resetTimer);

updateTimer();
