function mount(container) {
  const size = 15;
  const cellPx = 16;

  const canvas = document.createElement("canvas");
  canvas.width = size * cellPx;
  canvas.height = size * cellPx;
  canvas.tabIndex = 0;
  canvas.style.outline = "none";
  canvas.style.background = "#0d0f16";

  const status = document.createElement("div");
  status.style.marginBottom = "6px";
  status.style.fontSize = "0.85rem";

  container.append(status, canvas);

  const ctx = canvas.getContext("2d");
  let snake = [{ x: 7, y: 7 }];
  let dir = { x: 1, y: 0 };
  let nextDir = dir;
  let food = randomFood();
  let score = 0;
  let alive = true;
  let intervalId = null;

  function randomFood() {
    return { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
  }

  function tick() {
    if (!alive) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= size || head.y >= size;
    const hitSelf = snake.some((seg) => seg.x === head.x && seg.y === head.y);

    if (hitWall || hitSelf) {
      alive = false;
      clearInterval(intervalId);
      status.textContent = `Game over! Score: ${score}`;
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 1;
      food = randomFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#39ff14";
    snake.forEach((seg) => ctx.fillRect(seg.x * cellPx, seg.y * cellPx, cellPx - 1, cellPx - 1));
    ctx.fillStyle = "#ff5050";
    ctx.fillRect(food.x * cellPx, food.y * cellPx, cellPx - 1, cellPx - 1);
    status.textContent = `Score: ${score}`;
  }

  canvas.addEventListener("keydown", (e) => {
    const map = {
      ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }
    };
    const next = map[e.key];
    if (!next) return;
    e.preventDefault();
    if (next.x === -dir.x && next.y === -dir.y) return;
    nextDir = next;
  });

  canvas.addEventListener("click", () => canvas.focus());

  draw();
  intervalId = setInterval(tick, 150);
}

export const mountSnake = { title: "Snake (click, then arrow keys)", mount };
