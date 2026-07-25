export function mount(container, { mode, config }) {
  const size = config.boardSize || 3;
  const winLength = Math.min(config.winLength || 3, size);
  const vsBot = mode === "bot";
  const botPlayer = "O";

  let board = Array(size * size).fill(null);
  let current = "X";
  let winner = null;

  const wrapper = document.createElement("div");
  const status = document.createElement("div");
  status.className = "ttt-status";
  const grid = document.createElement("div");
  grid.className = "ttt-grid";
  grid.style.gridTemplateColumns = `repeat(${size}, 48px)`;
  grid.style.gridTemplateRows = `repeat(${size}, 48px)`;

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Restart";
  resetBtn.className = "ttt-reset";

  const cells = [];
  for (let i = 0; i < size * size; i++) {
    const cell = document.createElement("button");
    cell.className = "ttt-cell";
    cell.addEventListener("click", () => handleMove(i));
    grid.appendChild(cell);
    cells.push(cell);
  }

  wrapper.append(status, grid, resetBtn);
  container.appendChild(wrapper);

  const winLines = buildWinLines();

  function buildWinLines() {
    const result = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - winLength; c++) {
        result.push(Array.from({ length: winLength }, (_, k) => r * size + c + k));
      }
    }
    for (let c = 0; c < size; c++) {
      for (let r = 0; r <= size - winLength; r++) {
        result.push(Array.from({ length: winLength }, (_, k) => (r + k) * size + c));
      }
    }
    for (let r = 0; r <= size - winLength; r++) {
      for (let c = 0; c <= size - winLength; c++) {
        result.push(Array.from({ length: winLength }, (_, k) => (r + k) * size + c + k));
        result.push(Array.from({ length: winLength }, (_, k) => (r + k) * size + (c + winLength - 1 - k)));
      }
    }
    return result;
  }

  function checkWinner(b) {
    for (const line of winLines) {
      const symbols = line.map((i) => b[i]);
      if (symbols[0] && symbols.every((s) => s === symbols[0])) return symbols[0];
    }
    return b.every(Boolean) ? "draw" : null;
  }

  function emptyCells(b) {
    return b.map((v, i) => (v ? null : i)).filter((i) => i !== null);
  }

  function findImmediateMove(b, symbol) {
    for (const i of emptyCells(b)) {
      const copy = b.slice();
      copy[i] = symbol;
      if (checkWinner(copy) === symbol) return i;
    }
    return null;
  }

  function minimax(b, player) {
    const result = checkWinner(b);
    if (result === botPlayer) return { score: 10 };
    if (result && result !== "draw") return { score: -10 };
    if (result === "draw") return { score: 0 };

    const moves = emptyCells(b).map((i) => {
      const copy = b.slice();
      copy[i] = player;
      return { index: i, score: minimax(copy, player === "X" ? "O" : "X").score };
    });

    return player === botPlayer
      ? moves.reduce((best, m) => (m.score > best.score ? m : best))
      : moves.reduce((best, m) => (m.score < best.score ? m : best));
  }

  function pickBotMove() {
    const empty = emptyCells(board);
    if (!empty.length) return null;
    const difficulty = config.botDifficulty || "medium";
    const opponent = botPlayer === "X" ? "O" : "X";

    if (difficulty === "hard" && size === 3 && winLength === 3) {
      return minimax(board, botPlayer).index;
    }

    if (difficulty !== "easy") {
      const winMove = findImmediateMove(board, botPlayer);
      if (winMove != null) return winMove;
      const blockMove = findImmediateMove(board, opponent);
      if (blockMove != null) return blockMove;
    }

    return empty[Math.floor(Math.random() * empty.length)];
  }

  function render() {
    cells.forEach((cell, i) => {
      cell.textContent = board[i] || "";
      cell.disabled = !!board[i] || !!winner;
    });
    if (winner === "draw") status.textContent = "It's a draw!";
    else if (winner) status.textContent = `${winner} wins!`;
    else status.textContent = vsBot && current === botPlayer ? "Bot is thinking…" : `${current}'s turn`;
  }

  function handleMove(i) {
    if (winner || board[i]) return;
    board[i] = current;
    winner = checkWinner(board);
    current = current === "X" ? "O" : "X";
    render();
    if (!winner && vsBot && current === botPlayer) {
      setTimeout(botMove, 300);
    }
  }

  function botMove() {
    if (winner) return;
    const i = pickBotMove();
    if (i != null) handleMove(i);
  }

  resetBtn.addEventListener("click", () => {
    board = Array(size * size).fill(null);
    current = "X";
    winner = null;
    render();
  });

  render();
}
