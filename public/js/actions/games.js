function createLaunchCard(info) {
  const card = document.createElement("div");
  card.className = "widget-card game-launch-card";
  card.dataset.gameId = info.gameId;

  const closeBtn = document.createElement("button");
  closeBtn.className = "widget-close";
  closeBtn.textContent = "×";
  closeBtn.title = "Close (reappears after a chat reset)";
  closeBtn.onclick = () => card.remove();
  card.appendChild(closeBtn);

  const heading = document.createElement("h3");
  heading.textContent = info.title || info.gameId;
  card.appendChild(heading);

  const versionInfo = document.createElement("div");
  versionInfo.className = "game-version-info";
  versionInfo.textContent = `${info.version}${info.label ? " · " + info.label : ""}`;
  card.appendChild(versionInfo);

  const link = document.createElement("a");
  link.href = info.url;
  link.target = "_blank";
  link.rel = "noopener";
  link.className = "game-launch-btn";
  link.textContent = "▶ Play in new tab";
  card.appendChild(link);

  return card;
}

// One card per game — a new/updated version replaces the existing card for that gameId
// instead of stacking duplicates.
export function renderGameCard(info) {
  const mountPoint = document.getElementById("widgets");
  const existing = mountPoint.querySelector(`[data-game-id="${info.gameId}"]`);
  if (existing) existing.remove();
  mountPoint.appendChild(createLaunchCard(info));
}

export function applyStartGame(action) {
  renderGameCard(action);
}

export function applyUpdateGame(action) {
  renderGameCard(action);
}
