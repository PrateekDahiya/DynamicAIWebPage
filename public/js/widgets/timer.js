function mount(container, props) {
  const initialSeconds = Number(props?.seconds) > 0 ? Number(props.seconds) : 300;
  let remaining = initialSeconds;
  let intervalId = null;

  container.innerHTML = `
    <div class="timer-display" style="font-size:1.8rem;text-align:center;margin-bottom:8px;">--:--</div>
    <div class="timer-controls" style="display:flex;gap:6px;justify-content:center;">
      <button data-action="start">Start</button>
      <button data-action="pause">Pause</button>
      <button data-action="reset">Reset</button>
    </div>
  `;

  const displayEl = container.querySelector(".timer-display");

  function render() {
    const m = Math.floor(remaining / 60).toString().padStart(2, "0");
    const s = Math.floor(remaining % 60).toString().padStart(2, "0");
    displayEl.textContent = `${m}:${s}`;
  }

  container.querySelector('[data-action="start"]').addEventListener("click", () => {
    if (intervalId) return;
    intervalId = setInterval(() => {
      if (remaining <= 0) {
        clearInterval(intervalId);
        intervalId = null;
        return;
      }
      remaining -= 1;
      render();
    }, 1000);
  });

  container.querySelector('[data-action="pause"]').addEventListener("click", () => {
    clearInterval(intervalId);
    intervalId = null;
  });

  container.querySelector('[data-action="reset"]').addEventListener("click", () => {
    clearInterval(intervalId);
    intervalId = null;
    remaining = initialSeconds;
    render();
  });

  render();
}

export const mountTimer = { title: "Timer", mount };
