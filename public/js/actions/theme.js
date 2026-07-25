const root = document.documentElement;
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");

let particles = [];
let currentEffect = "none";
let rafId = null;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

export function applySetTheme(action) {
  if (action.vars) {
    for (const [key, value] of Object.entries(action.vars)) {
      root.style.setProperty(key, value);
    }
  }
  if (action.background) {
    document.body.style.background = action.background.value;
  }
}

function makeParticles(effect, intensity) {
  const count = Math.round(80 * intensity);
  const configs = {
    particles: () => ({ r: Math.random() * 2 + 1, speedY: Math.random() * 0.5 + 0.1, color: "rgba(200,200,255,0.6)" }),
    snow: () => ({ r: Math.random() * 3 + 1, speedY: Math.random() * 1 + 0.5, color: "rgba(255,255,255,0.8)" }),
    stars: () => ({ r: Math.random() * 1.5 + 0.3, speedY: 0, color: "rgba(255,255,255,0.9)", twinkle: Math.random() * Math.PI * 2 }),
    rain: () => ({ r: 1, speedY: Math.random() * 6 + 8, color: "rgba(150,180,255,0.5)", len: Math.random() * 10 + 8 })
  };
  const factory = configs[effect];
  if (!factory) return [];
  return Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    ...factory()
  }));
}

function tick() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentEffect === "gradient-shift") {
    const t = Date.now() / 3000;
    const hue1 = (Math.sin(t) * 60 + 220) % 360;
    const hue2 = (Math.cos(t) * 60 + 280) % 360;
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, `hsl(${hue1}, 60%, 20%)`);
    grad.addColorStop(1, `hsl(${hue2}, 60%, 15%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    for (const p of particles) {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      if (currentEffect === "rain") {
        ctx.strokeStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x, p.y + p.len);
        ctx.stroke();
      } else if (currentEffect === "stars") {
        p.twinkle += 0.02;
        const alpha = 0.5 + Math.sin(p.twinkle) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      p.y += p.speedY;
      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    }
  }

  rafId = requestAnimationFrame(tick);
}

export function applyAnimateElement(action) {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  currentEffect = action.effect;

  if (action.effect === "none") {
    particles = [];
    return;
  }

  particles = makeParticles(action.effect, action.intensity);
  tick();
}
