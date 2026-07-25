export function mount(container) {
  container.innerHTML = `
    <form class="todo-form" style="display:flex;gap:4px;margin-bottom:6px;">
      <input class="todo-input" type="text" placeholder="Add a task..." style="flex:1;" />
      <button type="submit">Add</button>
    </form>
    <ul class="todo-list" style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px;"></ul>
  `;

  const form = container.querySelector(".todo-form");
  const input = container.querySelector(".todo-input");
  const list = container.querySelector(".todo-list");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    const li = document.createElement("li");
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.gap = "6px";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.addEventListener("change", () => {
      label.style.textDecoration = checkbox.checked ? "line-through" : "none";
      label.style.opacity = checkbox.checked ? "0.5" : "1";
    });

    const label = document.createElement("span");
    label.textContent = text;
    label.style.flex = "1";

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", () => li.remove());

    li.append(checkbox, label, removeBtn);
    list.appendChild(li);
    input.value = "";
  });
}
