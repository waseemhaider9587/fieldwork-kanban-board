// commands.js — Command Pattern state history.
//
// Every mutation to the board (create, move, rename, re-prioritize, delete)
// is expressed as a Command object with execute()/undo(). The HistoryManager
// keeps two stacks — past and future — so the app can undo and redo any
// number of steps without special-casing each action type.

export class AddTaskCommand {
  constructor(columnId, task, index = 0) {
    this.columnId = columnId;
    this.task = task;
    this.index = index;
  }
  execute(state) {
    state.tasks[this.task.id] = this.task;
    state.columns.find((c) => c.id === this.columnId).taskIds.splice(this.index, 0, this.task.id);
  }
  undo(state) {
    state.columns.find((c) => c.id === this.columnId).taskIds =
      state.columns.find((c) => c.id === this.columnId).taskIds.filter((id) => id !== this.task.id);
    delete state.tasks[this.task.id];
  }
  describe() {
    return `Add "${this.task.title}"`;
  }
}

export class DeleteTaskCommand {
  constructor(columnId, task, index) {
    this.columnId = columnId;
    this.task = task;
    this.index = index;
  }
  execute(state) {
    const col = state.columns.find((c) => c.id === this.columnId);
    col.taskIds = col.taskIds.filter((id) => id !== this.task.id);
    delete state.tasks[this.task.id];
  }
  undo(state) {
    state.tasks[this.task.id] = this.task;
    state.columns.find((c) => c.id === this.columnId).taskIds.splice(this.index, 0, this.task.id);
  }
  describe() {
    return `Delete "${this.task.title}"`;
  }
}

export class EditTaskTitleCommand {
  constructor(taskId, oldTitle, newTitle) {
    this.taskId = taskId;
    this.oldTitle = oldTitle;
    this.newTitle = newTitle;
  }
  execute(state) {
    state.tasks[this.taskId].title = this.newTitle;
  }
  undo(state) {
    state.tasks[this.taskId].title = this.oldTitle;
  }
  describe() {
    return `Rename task`;
  }
}

export class SetPriorityCommand {
  constructor(taskId, oldPriority, newPriority) {
    this.taskId = taskId;
    this.oldPriority = oldPriority;
    this.newPriority = newPriority;
  }
  execute(state) {
    state.tasks[this.taskId].priority = this.newPriority;
  }
  undo(state) {
    state.tasks[this.taskId].priority = this.oldPriority;
  }
  describe() {
    return `Change priority`;
  }
}

export class MoveTaskCommand {
  constructor(taskId, fromColumnId, fromIndex, toColumnId, toIndex) {
    this.taskId = taskId;
    this.fromColumnId = fromColumnId;
    this.fromIndex = fromIndex;
    this.toColumnId = toColumnId;
    this.toIndex = toIndex;
  }
  execute(state) {
    const from = state.columns.find((c) => c.id === this.fromColumnId);
    from.taskIds.splice(from.taskIds.indexOf(this.taskId), 1);
    const to = state.columns.find((c) => c.id === this.toColumnId);
    to.taskIds.splice(this.toIndex, 0, this.taskId);
  }
  undo(state) {
    const to = state.columns.find((c) => c.id === this.toColumnId);
    to.taskIds.splice(to.taskIds.indexOf(this.taskId), 1);
    const from = state.columns.find((c) => c.id === this.fromColumnId);
    from.taskIds.splice(this.fromIndex, 0, this.taskId);
  }
  describe() {
    return `Move task`;
  }
}

export class HistoryManager {
  constructor({ onChange } = {}) {
    this.past = [];
    this.future = [];
    this.onChange = onChange || (() => {});
  }

  /** Run a command against state, record it, and clear the redo stack. */
  execute(command, state) {
    command.execute(state);
    this.past.push(command);
    this.future = [];
    this.onChange({ canUndo: this.canUndo(), canRedo: this.canRedo(), command, direction: "do" });
  }

  undo(state) {
    if (!this.canUndo()) return null;
    const command = this.past.pop();
    command.undo(state);
    this.future.push(command);
    this.onChange({ canUndo: this.canUndo(), canRedo: this.canRedo(), command, direction: "undo" });
    return command;
  }

  redo(state) {
    if (!this.canRedo()) return null;
    const command = this.future.pop();
    command.execute(state);
    this.past.push(command);
    this.onChange({ canUndo: this.canUndo(), canRedo: this.canRedo(), command, direction: "redo" });
    return command;
  }

  canUndo() {
    return this.past.length > 0;
  }

  canRedo() {
    return this.future.length > 0;
  }
}
