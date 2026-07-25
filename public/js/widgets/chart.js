function mount(container, props) {
  const labels = Array.isArray(props?.labels) && props.labels.length ? props.labels : ["A", "B", "C", "D"];
  const values = Array.isArray(props?.values) && props.values.length === labels.length
    ? props.values.map(Number)
    : labels.map(() => Math.round(Math.random() * 80 + 10));

  const canvas = document.createElement("canvas");
  canvas.width = 240;
  canvas.height = 160;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const max = Math.max(...values, 1);
  const barWidth = canvas.width / values.length;

  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#8ecbff";

  values.forEach((v, i) => {
    const barHeight = (v / max) * (canvas.height - 24);
    const x = i * barWidth + 4;
    const y = canvas.height - barHeight - 16;
    ctx.fillRect(x, y, barWidth - 8, barHeight);
    ctx.fillStyle = "#e6e6f0";
    ctx.fillText(String(labels[i]), x, canvas.height - 4);
    ctx.fillText(String(v), x, y - 4);
    ctx.fillStyle = "#8ecbff";
  });
}

export const mountChart = { title: "Chart", mount };
