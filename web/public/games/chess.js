const PIECE_VALUES = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
const UNICODE = {
  w: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  b: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" }
};
const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function idx(row, col) {
  return row * 8 + col;
}
function rowOf(i) {
  return i >> 3;
}
function colOf(i) {
  return i & 7;
}
function inBounds(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}
function opponent(color) {
  return color === "w" ? "b" : "w";
}

function createInitialState() {
  const board = Array(64).fill(null);
  const backRank = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let c = 0; c < 8; c++) {
    board[idx(0, c)] = { color: "b", type: backRank[c] };
    board[idx(1, c)] = { color: "b", type: "P" };
    board[idx(6, c)] = { color: "w", type: "P" };
    board[idx(7, c)] = { color: "w", type: backRank[c] };
  }
  return {
    board,
    turn: "w",
    enPassant: null,
    kingMoved: { w: false, b: false },
    rookMoved: { w0: false, w7: false, b0: false, b7: false } // 0 = a-file (queenside), 7 = h-file (kingside)
  };
}

function cloneState(state) {
  return {
    board: state.board.slice(),
    turn: state.turn,
    enPassant: state.enPassant,
    kingMoved: { ...state.kingMoved },
    rookMoved: { ...state.rookMoved }
  };
}

function kingSquare(board, color) {
  return board.findIndex((p) => p && p.color === color && p.type === "K");
}

function isSquareAttacked(board, square, bySide) {
  const r = rowOf(square);
  const c = colOf(square);

  const pawnRow = bySide === "w" ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    const pc = c + dc;
    if (inBounds(pawnRow, pc)) {
      const p = board[idx(pawnRow, pc)];
      if (p && p.color === bySide && p.type === "P") return true;
    }
  }

  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p && p.color === bySide && p.type === "N") return true;
    }
  }

  for (const [dr, dc] of KING_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p && p.color === bySide && p.type === "K") return true;
    }
  }

  for (const [dr, dc] of BISHOP_DIRS) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p) {
        if (p.color === bySide && (p.type === "B" || p.type === "Q")) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  for (const [dr, dc] of ROOK_DIRS) {
    let nr = r + dr;
    let nc = c + dc;
    while (inBounds(nr, nc)) {
      const p = board[idx(nr, nc)];
      if (p) {
        if (p.color === bySide && (p.type === "R" || p.type === "Q")) return true;
        break;
      }
      nr += dr;
      nc += dc;
    }
  }

  return false;
}

function isInCheck(state, color) {
  const ks = kingSquare(state.board, color);
  if (ks === -1) return false;
  return isSquareAttacked(state.board, ks, opponent(color));
}

function addCastlingMoves(state, kingSq, moves) {
  const piece = state.board[kingSq];
  const color = piece.color;
  const homeRow = color === "w" ? 7 : 0;
  if (kingSq !== idx(homeRow, 4)) return;
  if (state.kingMoved[color]) return;
  if (isSquareAttacked(state.board, kingSq, opponent(color))) return;

  const rookKeySide = color === "w" ? "w7" : "b7";
  const rookKeyQueen = color === "w" ? "w0" : "b0";

  if (!state.rookMoved[rookKeySide]) {
    const rook = state.board[idx(homeRow, 7)];
    if (rook && rook.type === "R" && rook.color === color) {
      const f = idx(homeRow, 5);
      const g = idx(homeRow, 6);
      if (
        !state.board[f] &&
        !state.board[g] &&
        !isSquareAttacked(state.board, f, opponent(color)) &&
        !isSquareAttacked(state.board, g, opponent(color))
      ) {
        moves.push({ from: kingSq, to: g, isCastle: "kingside" });
      }
    }
  }

  if (!state.rookMoved[rookKeyQueen]) {
    const rook = state.board[idx(homeRow, 0)];
    if (rook && rook.type === "R" && rook.color === color) {
      const b = idx(homeRow, 1);
      const c2 = idx(homeRow, 2);
      const d = idx(homeRow, 3);
      if (
        !state.board[b] &&
        !state.board[c2] &&
        !state.board[d] &&
        !isSquareAttacked(state.board, d, opponent(color)) &&
        !isSquareAttacked(state.board, c2, opponent(color))
      ) {
        moves.push({ from: kingSq, to: c2, isCastle: "queenside" });
      }
    }
  }
}

function pseudoMovesForSquare(state, square) {
  const piece = state.board[square];
  if (!piece) return [];
  const { board } = state;
  const r = rowOf(square);
  const c = colOf(square);
  const moves = [];

  function addIfLegalTarget(nr, nc) {
    if (!inBounds(nr, nc)) return;
    const target = board[idx(nr, nc)];
    if (target && target.color === piece.color) return;
    moves.push({ from: square, to: idx(nr, nc) });
  }

  if (piece.type === "P") {
    const dir = piece.color === "w" ? -1 : 1;
    const startRow = piece.color === "w" ? 6 : 1;
    const promoteRow = piece.color === "w" ? 0 : 7;
    const oneRow = r + dir;

    if (inBounds(oneRow, c) && !board[idx(oneRow, c)]) {
      moves.push({ from: square, to: idx(oneRow, c), promotion: oneRow === promoteRow ? "Q" : undefined });
      const twoRow = r + dir * 2;
      if (r === startRow && !board[idx(twoRow, c)]) {
        moves.push({ from: square, to: idx(twoRow, c), doubleStep: true });
      }
    }

    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (!inBounds(oneRow, nc)) continue;
      const target = board[idx(oneRow, nc)];
      if (target && target.color !== piece.color) {
        moves.push({ from: square, to: idx(oneRow, nc), promotion: oneRow === promoteRow ? "Q" : undefined });
      } else if (state.enPassant === idx(oneRow, nc)) {
        moves.push({ from: square, to: idx(oneRow, nc), isEnPassant: true });
      }
    }
  } else if (piece.type === "N") {
    for (const [dr, dc] of KNIGHT_OFFSETS) addIfLegalTarget(r + dr, c + dc);
  } else if (piece.type === "K") {
    for (const [dr, dc] of KING_OFFSETS) addIfLegalTarget(r + dr, c + dc);
    addCastlingMoves(state, square, moves);
  } else {
    const dirs = piece.type === "B" ? BISHOP_DIRS : piece.type === "R" ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        const target = board[idx(nr, nc)];
        if (target) {
          if (target.color !== piece.color) moves.push({ from: square, to: idx(nr, nc) });
          break;
        }
        moves.push({ from: square, to: idx(nr, nc) });
        nr += dr;
        nc += dc;
      }
    }
  }

  return moves;
}

function applyMove(state, move) {
  const next = cloneState(state);
  const piece = next.board[move.from];
  const color = piece.color;
  const homeRow = color === "w" ? 7 : 0;

  next.enPassant = null;

  if (move.isEnPassant) {
    next.board[idx(rowOf(move.from), colOf(move.to))] = null;
  }

  if (move.doubleStep) {
    next.enPassant = idx((rowOf(move.from) + rowOf(move.to)) / 2, colOf(move.from));
  }

  next.board[move.to] = move.promotion ? { color, type: move.promotion } : piece;
  next.board[move.from] = null;

  if (move.isCastle === "kingside") {
    const rookFrom = idx(homeRow, 7);
    const rookTo = idx(homeRow, 5);
    next.board[rookTo] = next.board[rookFrom];
    next.board[rookFrom] = null;
  } else if (move.isCastle === "queenside") {
    const rookFrom = idx(homeRow, 0);
    const rookTo = idx(homeRow, 3);
    next.board[rookTo] = next.board[rookFrom];
    next.board[rookFrom] = null;
  }

  if (piece.type === "K") next.kingMoved[color] = true;
  if (move.from === idx(homeRow, 0)) next.rookMoved[color + "0"] = true;
  if (move.from === idx(homeRow, 7)) next.rookMoved[color + "7"] = true;
  if (move.to === idx(0, 0)) next.rookMoved.b0 = true;
  if (move.to === idx(0, 7)) next.rookMoved.b7 = true;
  if (move.to === idx(7, 0)) next.rookMoved.w0 = true;
  if (move.to === idx(7, 7)) next.rookMoved.w7 = true;

  next.turn = opponent(color);
  return next;
}

function generateLegalMoves(state, square) {
  const piece = state.board[square];
  if (!piece || piece.color !== state.turn) return [];
  return pseudoMovesForSquare(state, square).filter((move) => {
    const next = applyMove(state, move);
    return !isInCheck(next, piece.color);
  });
}

function generateAllLegalMoves(state, color) {
  const moves = [];
  const forcedTurnState = { ...state, turn: color };
  for (let i = 0; i < 64; i++) {
    const piece = state.board[i];
    if (piece && piece.color === color) {
      moves.push(...generateLegalMoves(forcedTurnState, i));
    }
  }
  return moves;
}

function getStatus(state) {
  const inCheck = isInCheck(state, state.turn);
  const hasMoves = generateAllLegalMoves(state, state.turn).length > 0;
  if (!hasMoves) return inCheck ? "checkmate" : "stalemate";
  return inCheck ? "check" : "playing";
}

function evaluateMaterial(state, color) {
  let score = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    score += piece.color === color ? PIECE_VALUES[piece.type] : -PIECE_VALUES[piece.type];
  }
  return score;
}

function pickBotMove(state, botColor, difficulty) {
  const moves = generateAllLegalMoves(state, botColor);
  if (!moves.length) return null;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === "medium") {
    const scored = moves.map((m) => ({ move: m, score: evaluateMaterial(applyMove(state, m), botColor) }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter((s) => s.score === scored[0].score);
    return top[Math.floor(Math.random() * top.length)].move;
  }

  // hard: 2-ply minimax on material, with a strong bonus for delivering checkmate
  const opp = opponent(botColor);
  let best = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const afterBot = applyMove(state, move);
    const replies = generateAllLegalMoves(afterBot, opp);
    let worst;
    if (!replies.length) {
      worst = isInCheck(afterBot, opp) ? 1000 : 0;
    } else {
      worst = Math.min(...replies.map((r) => evaluateMaterial(applyMove(afterBot, r), botColor)));
    }
    if (worst > bestScore) {
      bestScore = worst;
      best = move;
    }
  }
  return best;
}

export function mount(container, { mode, config }) {
  let state = createInitialState();
  let selected = null;
  let legalTargets = [];
  let gameOver = false;
  const vsBot = mode === "bot";
  const botColor = "b";
  const difficulty = config.botDifficulty || "medium";

  const boardCol = document.createElement("div");
  boardCol.className = "game-board-col";
  const status = document.createElement("div");
  status.className = "ttt-status";
  const boardEl = document.createElement("div");
  boardEl.className = "chess-board";
  const resetBtn = document.createElement("button");
  resetBtn.textContent = "Restart";
  resetBtn.className = "ttt-reset";

  const squares = [];
  for (let i = 0; i < 64; i++) {
    const sq = document.createElement("div");
    const r = rowOf(i);
    const c = colOf(i);
    sq.className = `chess-square ${(r + c) % 2 === 0 ? "light" : "dark"}`;
    sq.addEventListener("click", () => handleSquareClick(i));
    boardEl.appendChild(sq);
    squares.push(sq);
  }

  boardCol.append(status, boardEl, resetBtn);

  const sidePanel = document.createElement("div");
  sidePanel.className = "game-side-panel";
  sidePanel.innerHTML = `
    <h4>Match info</h4>
    <div>Mode: ${vsBot ? "vs Bot" : "Multiplayer"}</div>
    ${
      vsBot
        ? `<div>Bot difficulty: ${difficulty}</div><div>You play White, bot plays Black.</div>`
        : "<div>Hotseat: take turns as White and Black.</div>"
    }
    <div style="opacity:.6;font-size:.8rem;">Pawns auto-promote to Queen.</div>
  `;

  container.append(boardCol, sidePanel);

  function render() {
    for (let i = 0; i < 64; i++) {
      const piece = state.board[i];
      squares[i].textContent = piece ? UNICODE[piece.color][piece.type] : "";
      squares[i].classList.toggle("selected", selected === i);
      squares[i].classList.toggle("legal-move", legalTargets.includes(i));
      squares[i].classList.toggle("white-piece", !!piece && piece.color === "w");
      squares[i].classList.toggle("black-piece", !!piece && piece.color === "b");
    }

    if (gameOver) return;
    const s = getStatus(state);
    const sideLabel = state.turn === "w" ? "White" : "Black";
    if (s === "checkmate") {
      status.textContent = `Checkmate — ${state.turn === "w" ? "Black" : "White"} wins!`;
      gameOver = true;
    } else if (s === "stalemate") {
      status.textContent = "Stalemate — draw!";
      gameOver = true;
    } else if (vsBot && state.turn === botColor) {
      status.textContent = "Bot is thinking…";
    } else {
      status.textContent = s === "check" ? `${sideLabel} is in check` : `${sideLabel} to move`;
    }
  }

  function handleSquareClick(i) {
    if (gameOver) return;
    if (vsBot && state.turn === botColor) return;

    const piece = state.board[i];

    if (selected !== null && legalTargets.includes(i)) {
      const move = generateLegalMoves(state, selected).find((m) => m.to === i);
      selected = null;
      legalTargets = [];
      if (move) makeMove(move);
      else render();
      return;
    }

    if (piece && piece.color === state.turn) {
      selected = i;
      legalTargets = generateLegalMoves(state, i).map((m) => m.to);
    } else {
      selected = null;
      legalTargets = [];
    }
    render();
  }

  function makeMove(move) {
    state = applyMove(state, move);
    render();
    if (!gameOver && vsBot && state.turn === botColor) {
      setTimeout(botTurn, 350);
    }
  }

  function botTurn() {
    if (gameOver) return;
    const move = pickBotMove(state, botColor, difficulty);
    if (move) makeMove(move);
  }

  resetBtn.addEventListener("click", () => {
    state = createInitialState();
    selected = null;
    legalTargets = [];
    gameOver = false;
    render();
  });

  render();
}
