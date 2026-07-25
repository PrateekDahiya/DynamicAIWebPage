export function mount(container, { mode, config }) {
  const size = config.boardSize || 15;
  const cellPx = 18;
  const speedMs = config.speedMs || 150;
  const theme = config.theme || {};

  const status = document.createElement("div");
  status.className = "snake-status";
  const hint = document.createElement("div");
  hint.className = "snake-hint";
  hint.textContent =
    mode === "multiplayer" ? "P1: Arrow keys · P2: WASD" : "Arrow keys to move · racing the bot";

  const canvas = document.createElement("canvas");
  canvas.width = size * cellPx;
  canvas.height = size * cellPx;
  canvas.tabIndex = 0;
  canvas.className = "snake-canvas";

  container.append(status, hint, canvas);
  canvas.focus();

  const ctx = canvas.getContext("2d");

  function randomCell() {
    return { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
  }

  function makeSnake(start, dir, color, isSecondHuman, isBot) {
    return { color, isBot, segments: [start], dir, nextDir: dir, alive: true, score: 0, isSecondHuman };
  }

  const players = [makeSnake({ x: Math.floor(size / 4), y: Math.floor(size / 2) }, { x: 1, y: 0 }, theme.snake || "#39ff14")];

  if (mode === "multiplayer") {
    players.push(
      makeSnake({ x: Math.floor((size * 3) / 4), y: Math.floor(size / 2) }, { x: -1, y: 0 }, theme.bot || "#ff9f40", true, false)
    );
  } else {
    players.push(
      makeSnake({ x: Math.floor((size * 3) / 4), y: Math.floor(size / 2) }, { x: -1, y: 0 }, theme.bot || "#ff9f40", false, true)
    );
  }

  let food = randomCell();
  let running = true;
  let intervalId = null;

  const keyMapP1 = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } };
  const keyMapP2 = { w: { x: 0, y: -1 }, s: { x: 0, y: 1 }, a: { x: -1, y: 0 }, d: { x: 1, y: 0 } };

  canvas.addEventListener("keydown", (e) => {
    const p1 = players[0];
    const p2 = players[1];
    let handled = false;

    if (keyMapP1[e.key] && p1?.alive) {
      const next = keyMapP1[e.key];
      if (!(next.x === -p1.dir.x && next.y === -p1.dir.y)) {
        p1.nextDir = next;
        handled = true;
      }
    }
    if (p2?.isSecondHuman && p2.alive && keyMapP2[e.key]) {
      const next = keyMapP2[e.key];
      if (!(next.x === -p2.dir.x && next.y === -p2.dir.y)) {
        p2.nextDir = next;
        handled = true;
      }
    }
    if (handled) e.preventDefault();
  });
  canvas.addEventListener("click", () => canvas.focus());

  function isOccupied(x, y) {
    return players.some((p) => p.alive && p.segments.some((s) => s.x === x && s.y === y));
  }

  function botDecide(snake) {
    const head = snake.segments[0];
    const difficulty = config.botDifficulty || "medium";
    const candidates = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ].filter((d) => !(d.x === -snake.dir.x && d.y === -snake.dir.y));

    const safe = candidates.filter((d) => {
      const nx = head.x + d.x;
      const ny = head.y + d.y;
      return nx >= 0 && ny >= 0 && nx < size && ny < size && !isOccupied(nx, ny);
    });

    if (!safe.length) return snake.dir;
    if (difficulty === "easy") return safe[Math.floor(Math.random() * safe.length)];

    safe.sort((a, b) => {
      const da = Math.abs(head.x + a.x - food.x) + Math.abs(head.y + a.y - food.y);
      const db = Math.abs(head.x + b.x - food.x) + Math.abs(head.y + b.y - food.y);
      return da - db;
    });

    if (difficulty === "hard") return safe[0];
    return Math.random() < 0.8 ? safe[0] : safe[Math.floor(Math.random() * safe.length)];
  }

  function tick() {
    if (!running) return;

    for (const snake of players) {
      if (!snake.alive) continue;
      if (snake.isBot) snake.nextDir = botDecide(snake);
      snake.dir = snake.nextDir;
    }

    for (const snake of players) {
      if (!snake.alive) continue;
      const head = { x: snake.segments[0].x + snake.dir.x, y: snake.segments[0].y + snake.dir.y };
      const hitWall = head.x < 0 || head.y < 0 || head.x >= size || head.y >= size;
      const hitAny = isOccupied(head.x, head.y);

      if (hitWall || hitAny) {
        snake.alive = false;
        continue;
      }

      snake.segments.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        snake.score += 1;
        food = randomCell();
      } else {
        snake.segments.pop();
      }
    }

    draw();

    if (players.every((p) => !p.alive)) {
      running = false;
      clearInterval(intervalId);
    }
  }

  function draw() {
    ctx.fillStyle = theme.bg || "#0d0f16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const snake of players) {
      ctx.fillStyle = snake.alive ? snake.color : "#555";
      snake.segments.forEach((s) => ctx.fillRect(s.x * cellPx, s.y * cellPx, cellPx - 1, cellPx - 1));
    }

    ctx.fillStyle = theme.food || "#ff5050";
    ctx.fillRect(food.x * cellPx, food.y * cellPx, cellPx - 1, cellPx - 1);

    const [p1, p2] = players;
    const p1Label = mode === "multiplayer" ? "P1" : "You";
    const p2Label = mode === "multiplayer" ? "P2" : "Bot";
    status.textContent = `${p1Label}: ${p1.score}${p1.alive ? "" : " (out)"}   ${p2Label}: ${p2.score}${p2.alive ? "" : " (out)"}`;
  }

  draw();
  intervalId = setInterval(tick, speedMs);
}
