const canvas = document.getElementById('mazeCanvas');
const ctx = canvas.getContext('2d');

let cols, rows;
let w = 40; // Default Cell size
let grid = [];
let current;
let stack = [];
let currentQuestion = {
    question: "Pertanyaan default...",
    answers: ["A", "B", "C", "D"],
    correct: "A"
};
let placedAnswers = [];

// KONFIGURASI GPS OPTIMASI
const METERS_PER_CELL = 5;      // 1 Kotak = 5 Meter (Lebih stabil untuk jalan kaki)
const ACCURACY_THRESHOLD = 20;  // Abaikan sinyal jika akurasi > 20 meter
let startLat = null;
let startLon = null;
let watchId = null;

// DATA SOAL DAN JAWABAN DEFAULT
const defaultQuestions = [
    {
        question: "Suara burung adalah...",
        answers: ["berkicau", "menggonggong", "meringkik", "mengembik"],
        correct: "berkicau"
    }
];

let player;

class Player {
    constructor() {
        this.i = 0;
        this.j = 0;
    }

    show() {
        let x = this.i * w + w / 2;
        let y = this.j * w + w / 2;

        ctx.fillStyle = '#ff00ff';
        ctx.beginPath();
        ctx.arc(x, y, w / 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 15;
        ctx.shadowColor = "#ff00ff";
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    move(dir) {
        let currentCell = grid[index(this.i, this.j)];
        let nextI = this.i;
        let nextJ = this.j;

        if (dir === 'up' && !currentCell.walls[0]) nextJ--;
        else if (dir === 'right' && !currentCell.walls[1]) nextI++;
        else if (dir === 'down' && !currentCell.walls[2]) nextJ++;
        else if (dir === 'left' && !currentCell.walls[3]) nextI--;

        if (nextI >= 0 && nextI < cols && nextJ >= 0 && nextJ < rows) {
            this.i = nextI;
            this.j = nextJ;
            checkAnswer();
            draw();
        }
    }
}

function checkAnswer() {
    for (let ans of placedAnswers) {
        if (player.i === ans.i && player.j === ans.j) {
            if (ans.isCorrect) {
                setTimeout(() => {
                    alert("BENAR! Selamat, Anda menemukan jawaban yang tepat.");
                    generateMaze();
                }, 100);
            } else {
                setTimeout(() => {
                    alert("SALAH! Coba cari jalan lain.");
                }, 100);
            }
        }
    }
}

function setup() {
    const wrapper = document.querySelector('.canvas-wrapper');
    const availableHeight = window.innerHeight - 320;
    const availableWidth = wrapper.clientWidth - 20;

    let size = Math.min(availableWidth, availableHeight);
    if (size < 300) size = 300;

    w = (window.innerWidth < 600) ? 40 : 50;

    const adjustedSize = Math.floor(size / w) * w;
    canvas.width = adjustedSize;
    canvas.height = adjustedSize;

    cols = Math.floor(canvas.width / w);
    rows = Math.floor(canvas.height / w);

    grid = [];
    stack = [];

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            grid.push(new Cell(i, j));
        }
    }

    current = grid[0];
    document.getElementById('question-text').innerText = currentQuestion.question;

    while (true) {
        current.visited = true;
        let next = current.checkNeighbors();
        if (next) {
            next.visited = true;
            stack.push(current);
            removeWalls(current, next);
            current = next;
        } else if (stack.length > 0) {
            current = stack.pop();
        } else {
            break;
        }
    }

    placeAnswers();
    player = new Player();
    draw();
}

function updateMazeData() {
    const q = document.getElementById('inputQuestion').value;
    const a = document.getElementById('inputA').value;
    const b = document.getElementById('inputB').value;
    const c = document.getElementById('inputC').value;
    const d = document.getElementById('inputD').value;

    if (q && a && b && c && d) {
        currentQuestion = { question: q, answers: [a, b, c, d], correct: a };
        generateMaze();
    } else {
        alert("Mohon isi semua kolom input!");
    }
}

function generateMaze() {
    setup();
}

function movePlayer(direction) {
    if (player) player.move(direction);
}

// --- LOGIKA OPTICAL FLOW (Kamera Navigasi) ---
let isCameraActive = false;
let videoElement, processCtx, debugDiv;
let prevFrameData = null;
const COMPRESS_W = 40; // Analisis resolusi rendah untuk performa
const COMPRESS_H = 30;
const MOVE_THRESHOLD = 50; // Sensitivitas gerakan (total difference)
const DIR_THRESHOLD = 2; // Ambang batas dx/dy

async function startOpticalTracking() {
    if (isCameraActive) return;

    videoElement = document.getElementById('cameraFeed');
    const canvas = document.getElementById('processCanvas');
    debugDiv = document.getElementById('flow-debug');
    processCtx = canvas.getContext('2d', { willReadFrequently: true }); // Optimasi baca piksel

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment', // Kamera belakang
                width: { ideal: 320 },
                height: { ideal: 240 },
                frameRate: { ideal: 30 }
            }
        });
        videoElement.srcObject = stream;
        isCameraActive = true;

        document.getElementById('startCameraBtn').style.display = 'none';
        document.getElementById('status-text').innerText = "Kamera Aktif & Melacak!";

        alert("Arahkan kamera ke lantai bertekstur/pola.\nGerakkan HP maju/mundur/kiri/kanan.");

        requestAnimationFrame(trackMovement);
    } catch (err) {
        alert("Gagal akses kamera: " + err.message);
        document.getElementById('status-text').innerText = "Error Kamera";
        document.getElementById('status-text').style.color = 'red';
    }
}

function trackMovement() {
    if (!isCameraActive) return;

    // 1. Gambar frame video ke canvas kecil (downscale)
    processCtx.drawImage(videoElement, 0, 0, COMPRESS_W, COMPRESS_H);
    const currentFrameData = processCtx.getImageData(0, 0, COMPRESS_W, COMPRESS_H);

    if (prevFrameData) {
        // 2. Bandingkan frame sekarang dengan frame sebelumnya
        const movement = calculateOpticalFlow(prevFrameData.data, currentFrameData.data);

        // 3. Update Debug Info
        debugDiv.innerText = `dx: ${movement.dx.toFixed(1)}, dy: ${movement.dy.toFixed(1)}`;

        // 4. Gerakkan Player jika threshold terpenuhi
        // Note: Gerakan kamera ke kiri = Lantai bergerak ke kanan = Player gerak ke kiri
        // Jadi arah gerakan sama dengan arah pergeseran kamera (relatif terhadap lantai)

        const SENSITIVITY = 1.0;

        // Batasi frekuensi gerakan agar tidak terlalu cepat
        if (Date.now() - lastMoveTime > 300) {
            let moveDir = "";

            // Prioritaskan sumbu dengan gerakan terbesar
            if (Math.abs(movement.dy) > Math.abs(movement.dx)) {
                // Gerakan Vertikal
                // Kamera maju (atas) -> Image flow ke bawah (dy positif) -> Player maju (Up)
                // Cek ulang logika: Jika kamera maju, lantai di layar turun? Tidak, lantai "mendekat" tapi visual flow tergantung perspektif.
                // Asumsi umum: Flow ke bawah = Kamera Maju. Flow ke atas = Kamera Mundur.
                if (movement.dy > DIR_THRESHOLD) moveDir = 'up';
                else if (movement.dy < -DIR_THRESHOLD) moveDir = 'down';
            } else {
                // Gerakan Horizontal
                // Kamera kiri -> Flow ke kanan (dx positif) -> Player kiri
                if (movement.dx > DIR_THRESHOLD) moveDir = 'left';
                else if (movement.dx < -DIR_THRESHOLD) moveDir = 'right';
            }

            if (moveDir) {
                movePlayer(moveDir);
                lastMoveTime = Date.now();
                // Reset prevFrame agar tidak menumpuk error drift
                // prevFrameData = currentFrameData; 
            }
        }
    }

    prevFrameData = currentFrameData;
    requestAnimationFrame(trackMovement);
}

let lastMoveTime = 0;

// Algoritma Block Matching Sederhana (Hanya Center Block)
function calculateOpticalFlow(oldPixels, newPixels) {
    const W = COMPRESS_W;
    const blockX = 10; // Titik mulai Sample Block
    const blockY = 10;
    const blockSize = 20; // Ukuran Block Sample

    // Ambil sampel blok dari tengah frame lama
    // Cari posisi blok tersebut yang paling cocok di frame baru

    let bestDx = 0;
    let bestDy = 0;
    let minDiff = Infinity;

    const searchRange = 8; // Jarak pencarian (pixel)

    for (let dy = -searchRange; dy <= searchRange; dy++) {
        for (let dx = -searchRange; dx <= searchRange; dx++) {

            let diff = 0;
            // Hitung perbedaan pixel (SAD - Sum of Absolute Differences)
            for (let y = 0; y < blockSize; y++) {
                for (let x = 0; x < blockSize; x++) {
                    const oldIdx = ((blockY + y) * W + (blockX + x)) * 4; // Grayscale check only green channel
                    const newIdx = ((blockY + y + dy) * W + (blockX + x + dx)) * 4;

                    // Simple grayscale SAD (Using Green channel as proxy for luminance)
                    const valOld = oldPixels[oldIdx + 1];
                    const valNew = newPixels[newIdx + 1];

                    diff += Math.abs(valOld - valNew);
                }
            }

            if (diff < minDiff) {
                minDiff = diff;
                bestDx = dx;
                bestDy = dy;
            }
        }
    }

    return { dx: bestDx, dy: bestDy };
}
// --- END LOGIKA OPTICAL FLOW ---
function placeAnswers() {
    placedAnswers = [];
    let possibleCells = grid.filter(c => !(c.i === 0 && c.j === 0));
    possibleCells.sort(() => Math.random() - 0.5);

    let answersToPlace = [...currentQuestion.answers].sort(() => Math.random() - 0.5);

    for (let i = 0; i < answersToPlace.length; i++) {
        if (possibleCells.length > 0) {
            let cell = possibleCells.pop();
            placedAnswers.push({
                text: answersToPlace[i],
                i: cell.i,
                j: cell.j,
                isCorrect: answersToPlace[i] === currentQuestion.correct
            });
        }
    }
}

function index(i, j) {
    if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) return -1;
    return i + j * cols;
}

class Cell {
    constructor(i, j) {
        this.i = i;
        this.j = j;
        this.walls = [true, true, true, true];
        this.visited = false;
    }

    checkNeighbors() {
        let neighbors = [];
        let top = grid[index(this.i, this.j - 1)];
        let right = grid[index(this.i + 1, this.j)];
        let bottom = grid[index(this.i, this.j + 1)];
        let left = grid[index(this.i - 1, this.j)];

        if (top && !top.visited) neighbors.push(top);
        if (right && !right.visited) neighbors.push(right);
        if (bottom && !bottom.visited) neighbors.push(bottom);
        if (left && !left.visited) neighbors.push(left);

        return (neighbors.length > 0) ? neighbors[Math.floor(Math.random() * neighbors.length)] : undefined;
    }

    show() {
        let x = this.i * w;
        let y = this.j * w;
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;

        if (this.walls[0]) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
        if (this.walls[1]) { ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w, y + w); ctx.stroke(); }
        if (this.walls[2]) { ctx.beginPath(); ctx.moveTo(x + w, y + w); ctx.lineTo(x, y + w); ctx.stroke(); }
        if (this.walls[3]) { ctx.beginPath(); ctx.moveTo(x, y + w); ctx.lineTo(x, y); ctx.stroke(); }
    }
}

function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) { a.walls[3] = false; b.walls[1] = false; }
    else if (x === -1) { a.walls[1] = false; b.walls[3] = false; }
    let y = a.j - b.j;
    if (y === 1) { a.walls[0] = false; b.walls[2] = false; }
    else if (y === -1) { a.walls[2] = false; b.walls[0] = false; }
}

function draw() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < grid.length; i++) grid[i].show();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let ans of placedAnswers) {
        let x = ans.i * w + w / 2;
        let y = ans.j * w + w / 2;
        ctx.fillStyle = '#00ffcc';
        let fontSize = (ans.text.length > 8) ? 9 : 12;
        ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
        ctx.fillText(ans.text, x, y);
    }

    ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
    ctx.fillRect(0, 0, w, w);

    if (player) player.show();
}

// Initial Setup
currentQuestion = defaultQuestions[0];
document.getElementById('inputQuestion').value = currentQuestion.question;
document.getElementById('inputA').value = currentQuestion.answers[0];

setTimeout(setup, 100);
window.addEventListener('resize', setup);

// Keyboard support for testing in browser
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp') movePlayer('up');
    if (e.key === 'ArrowDown') movePlayer('down');
    if (e.key === 'ArrowLeft') movePlayer('left');
    if (e.key === 'ArrowRight') movePlayer('right');
});