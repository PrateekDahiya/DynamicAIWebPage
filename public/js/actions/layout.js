export function applyUpdateLayout(action) {
  const el = document.querySelector(action.target);
  if (!el || !action.style) return;
  Object.assign(el.style, action.style);
}

export function applyRemoveWidget(action) {
  let el = null;
  if (action.mountPoint) el = document.querySelector(action.mountPoint);
  if (!el && action.widgetId) el = document.querySelector(`[data-widget-id="${action.widgetId}"]`);
  if (el && el.dataset && el.dataset.widgetId) {
    el.remove();
  } else if (el) {
    el.innerHTML = "";
  }
}
