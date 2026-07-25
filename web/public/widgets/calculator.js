export function mount(container) {
  container.innerHTML = `
    <div class="calc">
      <input class="calc-display" type="text" readonly value="0" />
      <div class="calc-grid"></div>
    </div>
  `;

  const display = container.querySelector(".calc-display");
  const grid = container.querySelector(".calc-grid");
  const keys = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+","C"];

  let expr = "";

  Object.assign(grid.style, { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px", marginTop: "6px" });
  Object.assign(display.style, { width: "100%", padding: "8px", marginBottom: "0", boxSizing: "border-box", fontSize: "1.1rem" });

  keys.forEach((key) => {
    const btn = document.createElement("button");
    btn.textContent = key;
    btn.style.padding = "8px";
    btn.style.cursor = "pointer";
    if (key === "C") btn.style.gridColumn = "span 2";
    btn.addEventListener("click", () => {
      if (key === "C") {
        expr = "";
      } else if (key === "=") {
        try {
          expr = String(Function(`"use strict"; return (${expr})`)());
        } catch {
          expr = "Error";
        }
      } else {
        expr += key;
      }
      display.value = expr || "0";
    });
    grid.appendChild(btn);
  });
}
