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

// --- LOGIKA GPS TEROPTIMASI ---
function startGPS() {
    if (!navigator.geolocation) {
        alert("Browser tidak mendukung Geolocation.");
        return;
    }

    const statusText = document.getElementById('status-text');
    if (statusText) statusText.innerText = "Meminta Izin...";

    const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
    };

    watchId = navigator.geolocation.watchPosition(gpsSuccess, gpsError, options);
}

function gpsSuccess(pos) {
    const crd = pos.coords;
    const statusText = document.getElementById('status-text');
    const accText = document.getElementById('accuracy-text');

    // 1. Tampilkan Akurasi
    if (accText) accText.innerText = Math.round(crd.accuracy);

    // 2. Filter Akurasi (Abaikan jika sinyal buruk/loncat-loncat)
    if (crd.accuracy > ACCURACY_THRESHOLD) {
        if (statusText) {
            statusText.innerText = "Sinyal Lemah...";
            statusText.style.color = "orange";
        }
        return; 
    }

    if (statusText) {
        statusText.innerText = "Lacak Aktif (Presisi)";
        statusText.style.color = "#00ffcc";
    }

    // 3. Set Titik Awal (Hanya sekali klik)
    if (startLat === null) {
        startLat = crd.latitude;
        startLon = crd.longitude;
        alert("Titik Awal Terkunci! Silakan berjalan minimal 5 meter.");
        return;
    }

    // 4. Kalkulasi Jarak (Haversine Approximation)
    const dLatMeters = (crd.latitude - startLat) * 111320;
    const dLonMeters = (crd.longitude - startLon) * 111320 * Math.cos(startLat * Math.PI / 180);

    // 5. Konversi ke Grid (Gunakan pembulatan untuk smoothing)
    let gridChangeX = Math.round(dLonMeters / METERS_PER_CELL);
    let gridChangeY = Math.round(-dLatMeters / METERS_PER_CELL);

    // 6. Update Posisi Pemain (Clamp agar tidak keluar labirin)
    let newX = Math.max(0, Math.min(gridChangeX, cols - 1));
    let newY = Math.max(0, Math.min(gridChangeY, rows - 1));

    if (player && (player.i !== newX || player.j !== newY)) {
        player.i = newX;
        player.j = newY;
        console.log(`GPS Move: ${player.i}, ${player.j}`);
        checkAnswer();
        draw();
    }
}

function gpsError(err) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.style.color = "red";
        statusText.innerText = "GPS Error: " + err.message;
    }
}
// --- END LOGIKA GPS ---

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