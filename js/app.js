import { loadBoardState, saveBoardState } from "./db.js";
import { defaultState, createId } from "./state.js";
import {
  HistoryManager,
  AddTaskCommand,
  DeleteTaskCommand,
  EditTaskTitleCommand,
  SetPriorityCommand,
  MoveTaskCommand,
} from "./commands.js";

const boardEl = document.getElementById("board");
const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");
const saveStatusEl = document.getElementById("saveStatus");
const liveRegion = document.getElementById("liveRegion");

let state = null;
let saveTimer = null;

const history = new HistoryManager({
  onChange: ({ canUndo, canRedo }) => {
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
  },
});

let keyboardSession = null;

init();

async function init() {
  try {
    const saved = await loadBoardState();
    state = saved || defaultState();
  } catch (err) {
    console.error("Could not read from IndexedDB, starting fresh.", err);
    state = defaultState();
  }
  render();
  undoBtn.disabled = !history.canUndo();
  redoBtn.disabled = !history.canRedo();

  undoBtn.addEventListener("click", () => doUndo());
  redoBtn.addEventListener("click", () => doRedo());

  document.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      doUndo();
    } else if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) {
      e.preventDefault();
      doRedo();
    }
  });
}

function runCommand(command, announcement) {
  history.execute(command, state);
  render();
  scheduleSave();
  if (announcement) announce(announcement);
}

function doUndo() {
  const command = history.undo(state);
  if (!command) return;
  render();
  scheduleSave();
  announce(`Undid: ${command.describe()}`);
}

function doRedo() {
  const command = history.redo(state);
  if (!command) return;
  render();
  scheduleSave();
  announce(`Redid: ${command.describe()}`);
}

function scheduleSave() {
  saveStatusEl.textContent = "Saving…";
  saveStatusEl.className = "save-status saving";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveBoardState(state);
      saveStatusEl.textContent = "Saved offline";
      saveStatusEl.className = "save-status saved";
    } catch (err) {
      console.error("IndexedDB save failed", err);
      saveStatusEl.textContent = "Save failed — changes are local only";
      saveStatusEl.className = "save-status";
    }
  }, 350);
}

function announce(text) {
  liveRegion.textContent = "";
  // Re-trigger even if the text repeats, so screen readers pick it up.
  requestAnimationFrame(() => {
    liveRegion.textContent = text;
  });
}

function render() {
  const focused = document.activeElement;
  const focusedTaskId = focused && focused.closest ? focused.closest("[data-task-id]")?.dataset.taskId : null;

  boardEl.innerHTML = "";
  state.columns.forEach((column) => {
    boardEl.appendChild(buildColumnElement(column));
  });

  if (focusedTaskId) {
    const el = boardEl.querySelector(`[data-task-id="${focusedTaskId}"]`);
    if (el) el.focus();
  }
}

function buildColumnElement(column) {
  const section = document.createElement("section");
  section.className = "column";
  section.setAttribute("aria-label", column.title);

  const header = document.createElement("div");
  header.className = "column-header";
  header.innerHTML = `<h2>${escapeHtml(column.title)}</h2><span class="column-count">${column.taskIds.length}</span>`;
  section.appendChild(header);

  const list = document.createElement("ul");
  list.className = "card-list";
  list.dataset.columnId = column.id;
  list.setAttribute("role", "list");
  list.setAttribute("aria-label", `${column.title} tasks`);

  column.taskIds.forEach((taskId) => {
    list.appendChild(buildCardElement(state.tasks[taskId], column.id));
  });

  attachListDragHandlers(list);
  section.appendChild(list);

  section.appendChild(buildAddCardControl(column.id));
  return section;
}

function buildCardElement(task, columnId) {
  const li = document.createElement("li");
  li.className = "card";
  li.draggable = true;
  li.tabIndex = 0;
  li.dataset.taskId = task.id;
  li.dataset.columnId = columnId;
  li.dataset.priority = task.priority;
  li.setAttribute("role", "listitem");
  li.setAttribute("aria-roledescription", "draggable task card");
  li.setAttribute("aria-label", `${task.title}, priority ${task.priority}`);

  const top = document.createElement("div");
  top.className = "card-top";

  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = task.title;
  title.addEventListener("dblclick", () => beginEditTitle(title, task, columnId));

  const menu = document.createElement("div");
  menu.className = "card-menu";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "chip-btn";
  editBtn.setAttribute("aria-label", `Rename "${task.title}"`);
  editBtn.textContent = "✎";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    beginEditTitle(title, task, columnId);
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "chip-btn";
  deleteBtn.setAttribute("aria-label", `Delete "${task.title}"`);
  deleteBtn.textContent = "✕";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const index = state.columns.find((c) => c.id === columnId).taskIds.indexOf(task.id);
    runCommand(new DeleteTaskCommand(columnId, task, index), `Deleted "${task.title}"`);
  });

  menu.append(editBtn, deleteBtn);
  top.append(title, menu);

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const select = document.createElement("select");
  select.className = "priority-select";
  select.setAttribute("aria-label", `Priority for "${task.title}"`);
  ["low", "medium", "high"].forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    opt.textContent = p;
    if (p === task.priority) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => {
    runCommand(
      new SetPriorityCommand(task.id, task.priority, select.value),
      `Priority for "${task.title}" set to ${select.value}`
    );
  });
  select.addEventListener("click", (e) => e.stopPropagation());

  const idTag = document.createElement("span");
  idTag.textContent = task.id.split("-")[1] ? `#${task.id.split("-")[1]}` : "";

  meta.append(select, idTag);
  li.append(top, meta);

  attachCardDragHandlers(li, task, columnId);
  attachCardKeyboardHandlers(li, task, columnId);

  return li;
}

function beginEditTitle(titleEl, task, columnId) {
  const original = task.title;
  titleEl.contentEditable = "true";
  titleEl.focus();
  document.execCommand("selectAll", false, null);

  function commit() {
    titleEl.contentEditable = "false";
    const newTitle = titleEl.textContent.trim() || original;
    titleEl.removeEventListener("blur", commit);
    titleEl.removeEventListener("keydown", onKeydown);
    if (newTitle !== original) {
      runCommand(new EditTaskTitleCommand(task.id, original, newTitle), "Task renamed");
    } else {
      render();
    }
  }

  function onKeydown(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      titleEl.blur();
    } else if (e.key === "Escape") {
      titleEl.textContent = original;
      titleEl.blur();
    }
  }

  titleEl.addEventListener("blur", commit);
  titleEl.addEventListener("keydown", onKeydown);
}

function buildAddCardControl(columnId) {
  const wrapper = document.createElement("div");

  const openBtn = document.createElement("button");
  openBtn.type = "button";
  openBtn.className = "add-card-btn";
  openBtn.textContent = "+ Add task";
  openBtn.addEventListener("click", () => {
    wrapper.innerHTML = "";
    wrapper.appendChild(buildNewCardForm(columnId, () => {
      wrapper.innerHTML = "";
      wrapper.appendChild(openBtn);
    }));
    wrapper.querySelector("textarea").focus();
  });

  wrapper.appendChild(openBtn);
  return wrapper;
}

function buildNewCardForm(columnId, onClose) {
  const form = document.createElement("div");
  form.className = "new-card-form";

  const textarea = document.createElement("textarea");
  textarea.placeholder = "Task title…";
  textarea.setAttribute("aria-label", "New task title");

  const actions = document.createElement("div");
  actions.className = "form-actions";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "primary";
  addBtn.textContent = "Add task";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";

  function submit() {
    const title = textarea.value.trim();
    if (!title) {
      onClose();
      return;
    }
    const task = { id: createId(), title, priority: "medium", createdAt: Date.now() };
    const index = state.columns.find((c) => c.id === columnId).taskIds.length;
    runCommand(new AddTaskCommand(columnId, task, index), `Added "${title}"`);
  }

  addBtn.addEventListener("click", submit);
  cancelBtn.addEventListener("click", onClose);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === "Escape") {
      onClose();
    }
  });

  actions.append(addBtn, cancelBtn);
  form.append(textarea, actions);
  return form;
}

let dragState = null; // { taskId, fromColumnId, fromIndex }

function attachCardDragHandlers(cardEl, task, columnId) {
  cardEl.addEventListener("dragstart", (e) => {
    const fromIndex = state.columns.find((c) => c.id === columnId).taskIds.indexOf(task.id);
    dragState = { taskId: task.id, fromColumnId: columnId, fromIndex };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    requestAnimationFrame(() => cardEl.classList.add("dragging"));
  });

  cardEl.addEventListener("dragend", () => {
    cardEl.classList.remove("dragging");
    clearAllIndicators();
    dragState = null;
  });
}

function attachListDragHandlers(listEl) {
  listEl.addEventListener("dragover", (e) => {
    if (!dragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    listEl.classList.add("drag-over");
    const index = getDropIndex(listEl, e.clientY, dragState.taskId);
    showIndicator(listEl, index);
  });

  listEl.addEventListener("dragleave", (e) => {
    if (listEl.contains(e.relatedTarget)) return;
    listEl.classList.remove("drag-over");
    removeIndicator(listEl);
  });

  listEl.addEventListener("drop", (e) => {
    if (!dragState) return;
    e.preventDefault();
    const toColumnId = listEl.dataset.columnId;
    const toIndex = getDropIndex(listEl, e.clientY, dragState.taskId);
    listEl.classList.remove("drag-over");
    removeIndicator(listEl);

    const { taskId, fromColumnId, fromIndex } = dragState;
    dragState = null;

    if (fromColumnId === toColumnId && toIndex === fromIndex) return;

    const task = state.tasks[taskId];
    const toColumn = state.columns.find((c) => c.id === toColumnId);
    runCommand(
      new MoveTaskCommand(taskId, fromColumnId, fromIndex, toColumnId, toIndex),
      `Moved "${task.title}" to ${toColumn.title}`
    );
  });
}

function getDropIndex(listEl, clientY, draggedTaskId) {
  const cards = [...listEl.querySelectorAll(".card")].filter((c) => c.dataset.taskId !== draggedTaskId);
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    if (clientY < midpoint) return i;
  }
  return cards.length;
}

function showIndicator(listEl, index) {
  clearAllIndicators();
  const cards = [...listEl.querySelectorAll(".card")].filter((c) => c.dataset.taskId !== dragState.taskId);
  const indicator = document.createElement("div");
  indicator.className = "drop-indicator";
  indicator.setAttribute("aria-hidden", "true");
  if (index >= cards.length) {
    listEl.appendChild(indicator);
  } else {
    listEl.insertBefore(indicator, cards[index]);
  }
}

function removeIndicator(listEl) {
  listEl.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
}

function clearAllIndicators() {
  document.querySelectorAll(".drop-indicator").forEach((el) => el.remove());
  document.querySelectorAll(".card-list.drag-over").forEach((el) => el.classList.remove("drag-over"));
}

function attachCardKeyboardHandlers(cardEl, task, columnId) {
  cardEl.addEventListener("keydown", (e) => {
    const grabbed = keyboardSession && keyboardSession.taskId === task.id;

    if ((e.key === "Enter" || e.key === " ") && !grabbed && !keyboardSession) {
      e.preventDefault();
      startKeyboardGrab(cardEl, task, columnId);
      return;
    }

    if (grabbed && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      endKeyboardGrab(true);
      return;
    }

    if (grabbed && e.key === "Escape") {
      e.preventDefault();
      endKeyboardGrab(false);
      return;
    }

    if (grabbed && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveGrabbedWithinColumn(e.key === "ArrowUp" ? -1 : 1);
      return;
    }

    if (grabbed && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      moveGrabbedAcrossColumn(e.key === "ArrowLeft" ? -1 : 1);
      return;
    }

    // Plain browsing (not grabbed): arrows move focus between cards.
    if (!keyboardSession && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      e.preventDefault();
      focusNeighbor(cardEl, e.key);
    }
  });
}

function startKeyboardGrab(cardEl, task, columnId) {
  const fromIndex = state.columns.find((c) => c.id === columnId).taskIds.indexOf(task.id);
  keyboardSession = {
    taskId: task.id,
    originColumnId: columnId,
    originIndex: fromIndex,
    currentColumnId: columnId,
    currentIndex: fromIndex,
    steps: 0,
  };
  cardEl.classList.add("keyboard-grabbed");
  cardEl.setAttribute("aria-grabbed", "true");
  announce(`Grabbed "${task.title}". Use arrow keys to move it, Enter to drop, Escape to cancel.`);
}

function endKeyboardGrab(commit) {
  if (!keyboardSession) return;
  const { taskId } = keyboardSession;
  const task = state.tasks[taskId];
  keyboardSession = null;
  render();
  const el = boardEl.querySelector(`[data-task-id="${taskId}"]`);
  if (el) el.focus();
  announce(commit ? `Dropped "${task.title}"` : `Cancelled moving "${task.title}"`);
}

function moveGrabbedWithinColumn(delta) {
  const s = keyboardSession;
  const column = state.columns.find((c) => c.id === s.currentColumnId);
  const newIndex = s.currentIndex + delta;
  if (newIndex < 0 || newIndex >= column.taskIds.length) return;

  history.execute(
    new MoveTaskCommand(s.taskId, s.currentColumnId, s.currentIndex, s.currentColumnId, newIndex),
    state
  );
  s.currentIndex = newIndex;
  s.steps++;
  afterGrabbedMove();
}

function moveGrabbedAcrossColumn(delta) {
  const s = keyboardSession;
  const colIndex = state.columns.findIndex((c) => c.id === s.currentColumnId);
  const newColIndex = colIndex + delta;
  if (newColIndex < 0 || newColIndex >= state.columns.length) return;

  const targetColumn = state.columns[newColIndex];
  const newIndex = Math.min(s.currentIndex, targetColumn.taskIds.length);

  history.execute(
    new MoveTaskCommand(s.taskId, s.currentColumnId, s.currentIndex, targetColumn.id, newIndex),
    state
  );
  s.currentColumnId = targetColumn.id;
  s.currentIndex = newIndex;
  s.steps++;
  afterGrabbedMove();
}

function afterGrabbedMove() {
  scheduleSave();
  render();
  const el = boardEl.querySelector(`[data-task-id="${keyboardSession.taskId}"]`);
  if (el) {
    el.classList.add("keyboard-grabbed");
    el.setAttribute("aria-grabbed", "true");
    el.focus();
    const column = state.columns.find((c) => c.id === keyboardSession.currentColumnId);
    announce(`"${state.tasks[keyboardSession.taskId].title}" now in ${column.title}, position ${keyboardSession.currentIndex + 1} of ${column.taskIds.length}`);
  }
}

function focusNeighbor(cardEl, key) {
  const list = cardEl.closest(".card-list");
  const cards = [...list.querySelectorAll(".card")];
  const idx = cards.indexOf(cardEl);

  if (key === "ArrowUp" && idx > 0) {
    cards[idx - 1].focus();
  } else if (key === "ArrowDown" && idx < cards.length - 1) {
    cards[idx + 1].focus();
  } else if (key === "ArrowLeft" || key === "ArrowRight") {
    const columns = [...boardEl.querySelectorAll(".card-list")];
    const colIdx = columns.indexOf(list);
    const targetColIdx = key === "ArrowLeft" ? colIdx - 1 : colIdx + 1;
    if (targetColIdx < 0 || targetColIdx >= columns.length) return;
    const targetCards = [...columns[targetColIdx].querySelectorAll(".card")];
    if (targetCards.length === 0) return;
    targetCards[Math.min(idx, targetCards.length - 1)].focus();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
