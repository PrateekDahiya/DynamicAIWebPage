function mount(container) {
  let board = Array(9).fill(null);
  let turn = "X";
  let winner = null;

  const grid = document.createElement("div");
  Object.assign(grid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(3, 48px)",
    gridTemplateRows: "repeat(3, 48px)",
    gap: "4px"
  });

  const status = document.createElement("div");
  status.style.marginBottom = "6px";
  status.style.fontSize = "0.85rem";

  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Reset";
  resetBtn.style.marginTop = "8px";
  resetBtn.addEventListener("click", () => {
    board = Array(9).fill(null);
    turn = "X";
    winner = null;
    render();
  });

  const cells = Array.from({ length: 9 }, (_, i) => {
    const cell = document.createElement("button");
    Object.assign(cell.style, { fontSize: "1.4rem", cursor: "pointer" });
    cell.addEventListener("click", () => {
      if (winner || board[i]) return;
      board[i] = turn;
      winner = checkWinner(board);
      turn = turn === "X" ? "O" : "X";
      render();
    });
    grid.appendChild(cell);
    return cell;
  });

  function checkWinner(b) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, c, d] of lines) {
      if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
    }
    return b.every(Boolean) ? "draw" : null;
  }

  function render() {
    cells.forEach((cell, i) => { cell.textContent = board[i] || ""; });
    if (winner === "draw") status.textContent = "It's a draw!";
    else if (winner) status.textContent = `${winner} wins!`;
    else status.textContent = `${turn}'s turn`;
  }

  container.append(status, grid, resetBtn);
  render();
}

export const mountTicTacToe = { title: "Tic Tac Toe", mount };
