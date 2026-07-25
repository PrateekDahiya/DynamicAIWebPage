import { mountCalculator } from "../widgets/calculator.js";
import { mountTimer } from "../widgets/timer.js";
import { mountTodo } from "../widgets/todo.js";
import { mountChart } from "../widgets/chart.js";
import { mountNotes } from "../widgets/notes.js";
import { mountTicTacToe } from "../games/tictactoe.js";
import { mountSnake } from "../games/snake.js";

const widgetMounters = {
  calculator: mountCalculator,
  timer: mountTimer,
  todo: mountTodo,
  chart: mountChart,
  notes: mountNotes
};

const gameMounters = {
  tictactoe: mountTicTacToe,
  snake: mountSnake
};

function createCard(id, title) {
  const card = document.createElement("div");
  card.className = "widget-card";
  card.dataset.widgetId = id;

  const closeBtn = document.createElement("button");
  closeBtn.className = "widget-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => card.remove();
  card.appendChild(closeBtn);

  if (title) {
    const heading = document.createElement("h3");
    heading.textContent = title;
    card.appendChild(heading);
  }

  const body = document.createElement("div");
  card.appendChild(body);

  return { card, body };
}

export function applyCreateWidget(action) {
  const mounter = widgetMounters[action.widgetId];
  if (!mounter) return;
  const mountPoint = document.querySelector(action.mountPoint) || document.getElementById("widgets");
  const { card, body } = createCard(action.widgetId, mounter.title);
  mounter.mount(body, action.props || {});
  mountPoint.appendChild(card);
}

export function applyStartGame(action) {
  const mounter = gameMounters[action.gameId];
  if (!mounter) return;
  const mountPoint = document.querySelector(action.mountPoint) || document.getElementById("widgets");
  const { card, body } = createCard(action.gameId, mounter.title);
  mounter.mount(body);
  mountPoint.appendChild(card);
}
