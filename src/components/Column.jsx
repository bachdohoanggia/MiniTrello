import { useRef, useState } from 'react';
import TaskCard from './TaskCard.jsx';

function readDragData(event) {
  try {
    const rawData = event.dataTransfer.getData('application/taskflow') || event.dataTransfer.getData('text/plain');
    if (!rawData) return null;

    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

function findColumnIdAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest?.('[data-column-id]')?.dataset?.columnId || null;
}

export default function Column({
  column,
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
  const [isDragOver, setIsDragOver] = useState(false);
  const columnRef = useRef(null);
  const touchColumnDragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    isDragging: false,
  });

  function handleColumnDragStart(event) {
    if (isBusy) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/taskflow', JSON.stringify({ type: 'column', columnId: column.id }));
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.closest('.kanban-column')?.classList.add('is-column-dragging');
  }

  function handleColumnDragEnd(event) {
    event.currentTarget.closest('.kanban-column')?.classList.remove('is-column-dragging');
  }

  function handleColumnPointerDown(event) {
    if (event.pointerType === 'mouse' || isBusy) return;

    touchColumnDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleColumnPointerMove(event) {
    const dragState = touchColumnDragRef.current;
    if (event.pointerType === 'mouse' || isBusy || dragState.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.isDragging && distance > 10) {
      dragState.isDragging = true;
      columnRef.current?.classList.add('is-touch-column-dragging');
      document.body.classList.add('is-touch-dragging');
    }

    if (dragState.isDragging) {
      event.preventDefault();
      const targetColumnId = findColumnIdAtPoint(event.clientX, event.clientY);
      document.querySelectorAll('.kanban-column.is-touch-drop-target').forEach((item) => {
        item.classList.remove('is-touch-drop-target');
      });

      if (targetColumnId && targetColumnId !== column.id) {
        document.querySelector(`[data-column-id="${targetColumnId}"]`)?.classList.add('is-touch-drop-target');
      }
    }
  }

  function handleColumnPointerUp(event) {
    const dragState = touchColumnDragRef.current;
    if (event.pointerType === 'mouse' || isBusy || dragState.pointerId !== event.pointerId) return;

    if (dragState.isDragging) {
      event.preventDefault();
      const targetColumnId = findColumnIdAtPoint(event.clientX, event.clientY);
      if (targetColumnId && targetColumnId !== column.id) {
        onMoveColumn(column.id, targetColumnId);
      }
    }

    columnRef.current?.classList.remove('is-touch-column-dragging');
    document.body.classList.remove('is-touch-dragging');
    document.querySelectorAll('.kanban-column.is-touch-drop-target').forEach((item) => {
      item.classList.remove('is-touch-drop-target');
    });

    touchColumnDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      isDragging: false,
    };
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setIsDragOver(false);
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragOver(false);

    const dragData = readDragData(event);
    if (!dragData) return;

    if (dragData.type === 'task') {
      const draggedTask = tasks.find((task) => task.id === dragData.taskId);
      if (draggedTask && draggedTask.column_id === column.id) return;
      if (!isBusy) onMoveTask(dragData.taskId, column.id);
      return;
    }

    if (dragData.type === 'column' && dragData.columnId !== column.id) {
      if (!isBusy) onMoveColumn(dragData.columnId, column.id);
    }
  }

  const emptyText = hasActiveFilters
    ? 'No matching tasks in this column.'
    : 'Drop a task here or add a new one.';

  return (
    <article
      ref={columnRef}
      className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
      data-column-id={column.id}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="column-header">
        <div className="column-title-area">
          <button
            type="button"
            className="column-drag-handle"
            draggable="true"
            disabled={isBusy}
            onDragStart={handleColumnDragStart}
            onDragEnd={handleColumnDragEnd}
            onPointerDown={handleColumnPointerDown}
            onPointerMove={handleColumnPointerMove}
            onPointerUp={handleColumnPointerUp}
            onPointerCancel={handleColumnPointerUp}
            title="Drag to move column"
            aria-label={`Drag ${column.name} column`}
          >
            ⋮⋮
          </button>
          <div>
            <h2>{column.name}</h2>
            <span className="task-count">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="column-actions">
          <button className="icon-button" onClick={() => onEditColumn(column)} title="Edit column" disabled={isBusy}>
            Edit
          </button>
          <button className="icon-button danger" onClick={() => onDeleteColumn(column)} title="Delete column" disabled={isBusy}>
            Delete
          </button>
        </div>
      </div>

      <button className="add-task-button" onClick={() => onAddTask(column.id)} disabled={isBusy}>
        + Add Task
      </button>

      <div className="task-list">
        {tasks.length === 0 ? (
          <p className="empty-column">{emptyText}</p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              labels={labels}
              taskLabels={taskLabels}
              onOpenTask={onOpenTask}
              onMoveTask={onMoveTask}
              onReorderTask={onReorderTask}
              isBusy={isBusy}
            />
          ))
        )}
      </div>
    </article>
  );
}
