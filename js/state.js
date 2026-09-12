export function createId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function defaultState() {
  const backlog = [
    makeTask("Sketch column layout on paper first", "low"),
    makeTask("Wire up dragstart / dragover / drop handlers", "high"),
    makeTask("Design the drop-indicator line", "medium"),
  ];
  const inProgress = [makeTask("Build the Command Pattern history stack", "high")];
  const done = [makeTask("Read the project brief", "low")];

  const tasks = {};
  [...backlog, ...inProgress, ...done].forEach((t) => (tasks[t.id] = t));

  return {
    columns: [
      { id: "col-backlog", title: "Backlog", taskIds: backlog.map((t) => t.id) },
      { id: "col-progress", title: "In Progress", taskIds: inProgress.map((t) => t.id) },
      { id: "col-done", title: "Done", taskIds: done.map((t) => t.id) },
    ],
    tasks,
  };
}

function makeTask(title, priority) {
  return { id: createId(), title, priority, createdAt: Date.now() };
}

/** Deep-clone helper — commands mutate state, so the app keeps one live
 *  object and this is only used when a fresh working copy is needed. */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
