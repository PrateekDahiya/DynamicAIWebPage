function mount(container, props) {
  const textarea = document.createElement("textarea");
  textarea.value = typeof props?.text === "string" ? props.text : "";
  textarea.placeholder = "Jot something down...";
  textarea.style.width = "220px";
  textarea.style.height = "120px";
  textarea.style.resize = "vertical";
  container.appendChild(textarea);
}

export const mountNotes = { title: "Notes", mount };
