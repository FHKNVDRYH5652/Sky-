/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WebsiteTemplate {
  name: string;
  description: string;
  category: string;
  files: { [path: string]: string };
}

export const websiteTemplates: WebsiteTemplate[] = [
  {
    name: "Tic-Tac-Toe Game",
    description: "A gorgeous, fully interactive modern Tic-Tac-Toe game with glowing neon grids, scoreboards, and AI opponent.",
    category: "Gaming",
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neon Tic-Tac-Toe</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <header>
      <h1>NEON GRID</h1>
      <p class="subtitle">Multiplayer & AI Arcade Sandbox</p>
    </header>

    <div class="scoreboard">
      <div class="score-card player-x active">
        <span class="label">Player X</span>
        <span class="value" id="scoreX">0</span>
      </div>
      <div class="score-card player-o">
        <span class="label">Player O</span>
        <span class="value" id="scoreO">0</span>
      </div>
    </div>

    <div class="status" id="status">Player X's Turn</div>

    <div class="board" id="board">
      <div class="cell" data-index="0"></div>
      <div class="cell" data-index="1"></div>
      <div class="cell" data-index="2"></div>
      <div class="cell" data-index="3"></div>
      <div class="cell" data-index="4"></div>
      <div class="cell" data-index="5"></div>
      <div class="cell" data-index="6"></div>
      <div class="cell" data-index="7"></div>
      <div class="cell" data-index="8"></div>
    </div>

    <div class="controls">
      <button id="resetBtn" class="btn btn-primary">Reset Round</button>
      <button id="modeBtn" class="btn btn-secondary">Switch to AI Mode</button>
    </div>
  </div>
  <script src="script.js"></script>
</body>
</html>`,

      'style.css': `body {
  margin: 0;
  padding: 0;
  background-color: #020617;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.container {
  text-align: center;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 30px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
}

h1 {
  font-size: 1.8rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  margin: 0 0 5px 0;
  background: linear-gradient(135deg, #38bdf8, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 0.75rem;
  color: #64748b;
  margin: 0 0 25px 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scoreboard {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.score-card {
  flex: 1;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 12px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.score-card.active {
  background: rgba(56, 189, 248, 0.05);
  border-color: rgba(56, 189, 248, 0.3);
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.1);
}

.score-card .label {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
}

.score-card .value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #f1f5f9;
  margin-top: 5px;
}

.status {
  font-size: 0.9rem;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 20px;
}

.board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: rgba(255, 255, 255, 0.02);
  padding: 10px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  margin-bottom: 25px;
}

.cell {
  aspect-ratio: 1;
  background: #0f172a;
  border-radius: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 2.5rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cell:hover {
  background: #1e293b;
  transform: scale(1.02);
}

.cell.x {
  color: #38bdf8;
  text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
}

.cell.o {
  color: #f43f5e;
  text-shadow: 0 0 10px rgba(244, 63, 94, 0.5);
}

.controls {
  display: flex;
  gap: 10px;
}

.btn {
  flex: 1;
  padding: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-primary {
  background: #38bdf8;
  color: #020617;
}

.btn-primary:hover {
  background: #0ea5e9;
  box-shadow: 0 0 15px rgba(56, 189, 248, 0.3);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}`,

      'script.js': `let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let isGameActive = true;
let scoreX = 0;
let scoreO = 0;
let vsAI = false;

const cells = document.querySelectorAll('.cell');
const statusEl = document.getElementById('status');
const resetBtn = document.getElementById('resetBtn');
const modeBtn = document.getElementById('modeBtn');
const scoreXEl = document.getElementById('scoreX');
const scoreOEl = document.getElementById('scoreO');

const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

function handleCellClick(e) {
  const clickedCell = e.target;
  const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

  if (board[clickedCellIndex] !== '' || !isGameActive) return;

  makeMove(clickedCellIndex, currentPlayer);
  checkResult();

  if (vsAI && isGameActive && currentPlayer === 'O') {
    setTimeout(makeAIMove, 400);
  }
}

function makeMove(index, player) {
  board[index] = player;
  const cell = cells[index];
  cell.innerText = player;
  cell.classList.add(player.toLowerCase());
}

function checkResult() {
  let roundWon = false;
  for (let i = 0; i < winningConditions.length; i++) {
    const winCondition = winningConditions[i];
    let a = board[winCondition[0]];
    let b = board[winCondition[1]];
    let c = board[winCondition[2]];
    if (a === '' || b === '' || c === '') continue;
    if (a === b && a === c) {
      roundWon = true;
      break;
    }
  }

  if (roundWon) {
    statusEl.innerText = \`Player \${currentPlayer} Wins!\`;
    isGameActive = false;
    updateScore(currentPlayer);
    return;
  }

  const roundDraw = !board.includes('');
  if (roundDraw) {
    statusEl.innerText = 'Game Ended in a Draw!';
    isGameActive = false;
    return;
  }

  // Switch player
  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  statusEl.innerText = \`Player \${currentPlayer}'s Turn\`;
  
  // Highlight active scoreboard
  document.querySelector('.player-x').classList.toggle('active', currentPlayer === 'X');
  document.querySelector('.player-o').classList.toggle('active', currentPlayer === 'O');
}

function updateScore(winner) {
  if (winner === 'X') {
    scoreX++;
    scoreXEl.innerText = scoreX;
  } else {
    scoreO++;
    scoreOEl.innerText = scoreO;
  }
}

function makeAIMove() {
  // Find empty indexes
  const emptyIndexes = [];
  board.forEach((val, idx) => {
    if (val === '') emptyIndexes.push(idx);
  });

  if (emptyIndexes.length === 0) return;

  // Simple rule: Choose center if free, otherwise random
  let moveIdx;
  if (emptyIndexes.includes(4)) {
    moveIdx = 4;
  } else {
    moveIdx = emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)];
  }

  makeMove(moveIdx, 'O');
  checkResult();
}

function resetGame() {
  board = ['', '', '', '', '', '', '', '', ''];
  isGameActive = true;
  currentPlayer = 'X';
  statusEl.innerText = "Player X's Turn";
  cells.forEach(cell => {
    cell.innerText = '';
    cell.classList.remove('x', 'o');
  });
  document.querySelector('.player-x').classList.add('active');
  document.querySelector('.player-o').classList.remove('active');
}

function toggleMode() {
  vsAI = !vsAI;
  modeBtn.innerText = vsAI ? "Switch to PvP Mode" : "Switch to AI Mode";
  resetGame();
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
resetBtn.addEventListener('click', resetGame);
modeBtn.addEventListener('click', toggleMode);
`
    }
  },
  {
    name: "Sleek Dev Portfolio",
    description: "Elegant layout for programmers and designers featuring rich headers, interactive bento grids, work section, and contact layout.",
    category: "Portfolio",
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alex Carter | Software Engineer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="wrapper">
    <nav>
      <div class="brand">&lt;AC /&gt;</div>
      <div class="nav-links">
        <a href="#about" class="active">About</a>
        <a href="#projects">Work</a>
        <a href="contact.html">Contact</a>
      </div>
    </nav>

    <main class="hero">
      <div class="hero-text">
        <span class="tagline">AVAILABLE FOR PROJECTS</span>
        <h1>Building the Future with Code & Precision</h1>
        <p>I design and code pixel-perfect, highly scalable modern web platforms. Specializing in Node, React, and server-side engineering architectures.</p>
        <div class="btn-group">
          <a href="#projects" class="btn btn-primary">See Selected Works</a>
          <a href="contact.html" class="btn btn-secondary">Get In Touch</a>
        </div>
      </div>
    </main>

    <section id="projects" class="projects">
      <h2>Selected Projects</h2>
      <div class="grid">
        <div class="project-card">
          <span class="p-category">CLOUD ARCHITECTURE</span>
          <h3>Serverless CDN Optimizer</h3>
          <p>Global image processing engine handling millions of weekly assets seamlessly with 99.99% operational uptime.</p>
        </div>
        <div class="project-card">
          <span class="p-category">INTERACTION DESIGN</span>
          <h3>HyperCanvas Studio</h3>
          <p>Collaborative graphic engine with low-latency syncing built entirely on custom HTML5 Canvas APIs.</p>
        </div>
      </div>
    </section>

    <footer>
      <p>&copy; 2026 Alex Carter. Hosted virtually with ZipHost.</p>
    </footer>
  </div>
</body>
</html>`,

      'contact.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Alex Carter</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="wrapper">
    <nav>
      <div class="brand">&lt;AC /&gt;</div>
      <div class="nav-links">
        <a href="index.html">About</a>
        <a href="index.html#projects">Work</a>
        <a href="contact.html" class="active">Contact</a>
      </div>
    </nav>

    <main class="contact-box">
      <h1>Let's Connect</h1>
      <p>Fill out the form below or drop me an email to start building your next concept.</p>
      
      <form id="contactForm" onsubmit="event.preventDefault(); alert('In-browser virtual form submitted! This is perfectly sandboxed.');">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" placeholder="John Doe" required>
        </div>
        <div class="form-group">
          <label>Email Address</label>
          <input type="email" placeholder="john@example.com" required>
        </div>
        <div class="form-group">
          <label>Project Details</label>
          <textarea rows="4" placeholder="Brief overview of what you are building..." required></textarea>
        </div>
        <button type="submit" class="btn btn-primary" style="width: 100%;">Send Message</button>
      </form>
    </main>
  </div>
</body>
</html>`,

      'style.css': `body {
  margin: 0;
  padding: 0;
  background: #090d16;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.wrapper {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
}

nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30px 0;
  border-b: 1px solid rgba(255, 255, 255, 0.05);
}

.brand {
  font-weight: 700;
  font-family: monospace;
  color: #38bdf8;
  font-size: 1.1rem;
}

.nav-links a {
  text-decoration: none;
  color: #64748b;
  margin-left: 20px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-links a:hover, .nav-links a.active {
  color: #f1f5f9;
}

.hero {
  padding: 80px 0 60px 0;
}

.tagline {
  font-size: 0.75rem;
  background: rgba(56, 189, 248, 0.1);
  color: #38bdf8;
  padding: 6px 12px;
  border-radius: 20px;
  font-weight: 600;
  letter-spacing: 0.05em;
}

h1 {
  font-size: 2.8rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  margin: 25px 0 15px 0;
  color: #f8fafc;
}

p {
  color: #94a3b8;
  line-height: 1.6;
  font-size: 1.05rem;
  margin-bottom: 35px;
}

.btn-group {
  display: flex;
  gap: 15px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
}

.btn-primary {
  background: #f1f5f9;
  color: #0f172a;
}

.btn-primary:hover {
  background: #ffffff;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.03);
  color: #f1f5f9;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
}

.projects {
  padding: 60px 0;
}

.projects h2 {
  font-size: 1.4rem;
  margin-bottom: 30px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.project-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 30px;
  border-radius: 16px;
  transition: all 0.2s;
}

.project-card:hover {
  border-color: rgba(56, 189, 248, 0.2);
  transform: translateY(-2px);
}

.p-category {
  font-size: 0.7rem;
  font-weight: 700;
  color: #38bdf8;
  letter-spacing: 0.1em;
}

.project-card h3 {
  margin: 10px 0;
  font-size: 1.2rem;
}

.project-card p {
  font-size: 0.9rem;
  margin: 0;
}

.contact-box {
  max-width: 500px;
  margin: 60px auto;
  padding: 40px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
}

.form-group label {
  display: block;
  font-size: 0.8rem;
  color: #94a3b8;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-group input, .form-group textarea {
  width: 100%;
  padding: 12px;
  background: #04060b;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 0.9rem;
  box-sizing: border-box;
}

footer {
  text-align: center;
  padding: 40px 0;
  font-size: 0.8rem;
  color: #475569;
}`
    }
  }
];
