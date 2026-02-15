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

// DATA SOAL DAN JAWABAN DEFAULT
const defaultQuestions = [
    {
        question: "Suara burung adalah...",
        answers: ["berkicau", "menggonggong", "meringkik", "mengembik"],
        correct: "berkicau"
    }
];


// Start everything
let player;

class Player {
    constructor() {
        this.i = 0;
        this.j = 0;
    }

    show() {
        let x = this.i * w + w / 2;
        let y = this.j * w + w / 2;

        ctx.fillStyle = '#ff00ff'; // Player color (Magenta)
        ctx.beginPath();
        ctx.arc(x, y, w / 3, 0, Math.PI * 2);
        ctx.fill();

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = "#ff00ff";
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    move(dir) {
        let currentCell = grid[index(this.i, this.j)];
        let nextI = this.i;
        let nextJ = this.j;

        if (dir === 'up') {
            if (!currentCell.walls[0]) {
                nextJ--;
            }
        } else if (dir === 'right') {
            if (!currentCell.walls[1]) {
                nextI++;
            }
        } else if (dir === 'down') {
            if (!currentCell.walls[2]) {
                nextJ++;
            }
        } else if (dir === 'left') {
            if (!currentCell.walls[3]) {
                nextI--;
            }
        }

        // Check bounds (should be handled by walls, but safety check)
        if (nextI >= 0 && nextI < cols && nextJ >= 0 && nextJ < rows) {
            this.i = nextI;
            this.j = nextJ;
            console.log("Moved to", this.i, this.j);
            checkAnswer();
            draw();
        }
    }
}

function checkAnswer() {
    // Check if player is on a cell with an answer
    for (let ans of placedAnswers) {
        if (player.i === ans.i && player.j === ans.j) {
            if (ans.isCorrect) {
                // Delay slightly to render the move first
                setTimeout(() => {
                    alert("BENAR! Selamat, Anda menemukan jawaban yang tepat.");
                    generateMaze(); // New maze
                }, 100);
            } else {
                setTimeout(() => {
                    alert("SALAH! Coba cari jalan lain.");
                    // Optional: Reset player position to start?
                    // player.i = 0; 
                    // player.j = 0;
                    // draw();
                }, 100);
            }
        }
    }
}


function setup() {
    // 1. Get available space from the parent container (.canvas-wrapper)
    const wrapper = document.querySelector('.canvas-wrapper');
    // We want the maze to fit within the viewport height mostly, minus header/footer
    // const headerHeight = document.querySelector('header').offsetHeight; // Removed header height calculation as it might vary
    const footerHeight = 50;
    const questionHeight = document.getElementById('question-container').offsetHeight;

    // Available height calculation (approximate padding)
    const availableHeight = window.innerHeight - 300; // Rough estimate for header + footer + padding
    const availableWidth = wrapper.clientWidth - 20;

    // Choose the smaller dimension to keep it square and fitting
    let size = Math.min(availableWidth, availableHeight);

    // Min size check
    if (size < 300) size = 300;

    // Adjust cell size w based on maze size to keep complexity reasonable
    // Let's make grid relatively dense but readable
    // If screen is small, reduce density (larger cells)
    if (window.innerWidth < 600) {
        w = 40; // Mobile
    } else {
        w = 50; // Desktop
    }

    // Ensure size is a multiple of w
    const adjustedSize = Math.floor(size / w) * w;

    canvas.width = adjustedSize;
    canvas.height = adjustedSize;

    cols = Math.floor(canvas.width / w);
    rows = Math.floor(canvas.height / w);

    grid = [];
    stack = [];

    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            let cell = new Cell(i, j);
            grid.push(cell);
        }
    }

    current = grid[0];

    // Update Question Display
    document.getElementById('question-text').innerText = currentQuestion.question;

    // Generate maze instantly
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

    // Create Player
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
        currentQuestion = {
            question: q,
            answers: [a, b, c, d],
            correct: a // Asumsi Input A selalu jawaban benar sesuai label
        };
        // Shuffle answers for display so "A" isn't always correct positionally?
        // But for placement logic we just need the string.
        generateMaze();
    } else {
        alert("Mohon isi semua kolom input!");
    }
}

function generateMaze() {
    setup();
}

function movePlayer(direction) {
    if (player) {
        player.move(direction);
    }
}

// Keyboard controls
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            movePlayer('up');
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            movePlayer('right');
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            movePlayer('down');
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            movePlayer('left');
            break;
    }
});


function placeAnswers() {
    placedAnswers = [];
    let possibleCells = [...grid];
    possibleCells = possibleCells.filter(c => !(c.i === 0 && c.j === 0) && !(c.i === cols - 1 && c.j === rows - 1));

    // Shuffle possible cells
    possibleCells.sort(() => Math.random() - 0.5);

    // Prepare answers (shuffle them so the 'correct' one isn't always first in the array if we iterate)
    let answersToPlace = [...currentQuestion.answers];
    answersToPlace.sort(() => Math.random() - 0.5);

    // Place each answer
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
    if (i < 0 || j < 0 || i > cols - 1 || j > rows - 1) {
        return -1;
    }
    return i + j * cols;
}

class Cell {
    constructor(i, j) {
        this.i = i;
        this.j = j;
        this.walls = [true, true, true, true]; // top, right, bottom, left
        this.visited = false;
    }

    checkNeighbors() {
        let neighbors = [];
        let top = grid[index(this.i, this.j - 1)];
        let right = grid[index(this.i + 1, this.j)];
        let bottom = grid[index(this.i, this.j + 1)];
        let left = grid[index(this.i - 1, this.j)];

        if (top && !top.visited) {
            neighbors.push(top);
        }
        if (right && !right.visited) {
            neighbors.push(right);
        }
        if (bottom && !bottom.visited) {
            neighbors.push(bottom);
        }
        if (left && !left.visited) {
            neighbors.push(left);
        }

        if (neighbors.length > 0) {
            let r = Math.floor(Math.random() * neighbors.length);
            return neighbors[r];
        } else {
            return undefined;
        }
    }

    highlight() {
        let x = this.i * w;
        let y = this.j * w;
        ctx.fillStyle = '#00ffcc';
        ctx.fillRect(x, y, w, w);
    }

    show() {
        let x = this.i * w;
        let y = this.j * w;
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;

        if (this.walls[0]) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + w, y);
            ctx.stroke();
        }
        if (this.walls[1]) {
            ctx.beginPath();
            ctx.moveTo(x + w, y);
            ctx.lineTo(x + w, y + w);
            ctx.stroke();
        }
        if (this.walls[2]) {
            ctx.beginPath();
            ctx.moveTo(x + w, y + w);
            ctx.lineTo(x, y + w);
            ctx.stroke();
        }
        if (this.walls[3]) {
            ctx.beginPath();
            ctx.moveTo(x, y + w);
            ctx.lineTo(x, y);
            ctx.stroke();
        }

        if (this.visited) {
            // Draw background for visited cells (optional, maybe distinct from unvisited)
            // ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            // ctx.fillRect(x, y, w, w);
        }
    }
}

function removeWalls(a, b) {
    let x = a.i - b.i;
    if (x === 1) {
        a.walls[3] = false;
        b.walls[1] = false;
    } else if (x === -1) {
        a.walls[1] = false;
        b.walls[3] = false;
    }
    let y = a.j - b.j;
    if (y === 1) {
        a.walls[0] = false;
        b.walls[2] = false;
    } else if (y === -1) {
        a.walls[2] = false;
        b.walls[0] = false;
    }
}

function draw() {
    // Clear background
    ctx.fillStyle = '#1a1a1a'; // Match CSS bg-color
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw all cells
    for (let i = 0; i < grid.length; i++) {
        grid[i].show();
    }

    // Draw answers
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let ans of placedAnswers) {
        let x = ans.i * w + w / 2;
        let y = ans.j * w + w / 2;

        ctx.fillStyle = '#00ffcc'; // Text color

        // Dynamic Font Size based on text length
        let fontSize = 12;
        ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;

        // Simple fitting
        if (ctx.measureText(ans.text).width > w - 4) {
            fontSize = 9;
            ctx.font = `bold ${fontSize}px "Outfit", sans-serif`;
        }

        ctx.fillText(ans.text, x, y);
    }

    // Start
    ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.fillRect(0, 0, w, w);

    // Player
    if (player) {
        player.show();
    }
}

// Initial Setup
currentQuestion = defaultQuestions[0];
document.getElementById('inputQuestion').value = currentQuestion.question;
document.getElementById('inputA').value = currentQuestion.answers[0];

setTimeout(setup, 100);

// Resize listener
window.addEventListener('resize', setup);
