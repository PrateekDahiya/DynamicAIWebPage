function createLaunchCard(action) {
  const card = document.createElement("div");
  card.className = "widget-card game-launch-card";
  card.dataset.widgetId = `game-${action.gameId}`;

  const closeBtn = document.createElement("button");
  closeBtn.className = "widget-close";
  closeBtn.textContent = "×";
  closeBtn.onclick = () => card.remove();
  card.appendChild(closeBtn);

  const heading = document.createElement("h3");
  heading.textContent = action.title || action.gameId;
  card.appendChild(heading);

  const versionInfo = document.createElement("div");
  versionInfo.className = "game-version-info";
  versionInfo.textContent = `${action.version}${action.label ? " · " + action.label : ""}`;
  card.appendChild(versionInfo);

  const link = document.createElement("a");
  link.href = action.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.className = "game-launch-btn";
  link.textContent = "▶ Play in new tab";
  card.appendChild(link);

  return card;
}

function renderLaunchCard(action) {
  const mountPoint = document.getElementById("widgets");
  mountPoint.appendChild(createLaunchCard(action));
}

export function applyStartGame(action) {
  renderLaunchCard(action);
}

export function applyUpdateGame(action) {
  renderLaunchCard(action);
}
