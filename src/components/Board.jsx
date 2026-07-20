import Column from './Column.jsx';

export default function Board({
  columns,
  tasks,
  labels,
  taskLabels,
  hasActiveFilters,
  onAddTask,
  onOpenTask,
  onMoveTask,
  onReorderTask,
  onMoveColumn,
  onEditColumn,
  onDeleteColumn,
  isBusy,
}) {
  if (columns.length === 0) {
    return (
      <section className="empty-board">
        <h2>No columns yet</h2>
        <p>Add your first column to start building the board.</p>
      </section>
    );
  }

  return (
    <div className="board-wrapper" aria-label="Kanban board horizontal scroll area">
      <section className="board">
        {columns.map((column) => {
          const columnTasks = tasks.filter((task) => task.column_id === column.id);

          return (
            <Column
              key={column.id}
              column={column}
              tasks={columnTasks}
              labels={labels}
              taskLabels={taskLabels}
              hasActiveFilters={hasActiveFilters}
              onAddTask={onAddTask}
              onOpenTask={onOpenTask}
              onMoveTask={onMoveTask}
              onReorderTask={onReorderTask}
              onMoveColumn={onMoveColumn}
              onEditColumn={onEditColumn}
              onDeleteColumn={onDeleteColumn}
              isBusy={isBusy}
            />
          );
        })}
      </section>
    </div>
  );
}
