import { useRef } from 'react';
import { getLabelStyle } from '../utils/labelStyles.js';

function formatDueDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function getPriorityLabel(priority) {
  if (!priority) return null;
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getLabelsForTask(task, labels, taskLabels) {
  const assignedLabelIds = new Set(
    taskLabels
      .filter((item) => item.task_id === task.id)
      .map((item) => item.label_id)
  );

  return labels.filter((label) => assignedLabelIds.has(label.id));
}

function findColumnIdAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest?.('[data-column-id]')?.dataset?.columnId || null;
}

function findTaskIdAtPoint(x, y) {
  const element = document.elementFromPoint(x, y);
  return element?.closest?.('[data-task-id]')?.dataset?.taskId || null;
}

export default function TaskCard({ task, labels, taskLabels, onOpenTask, onMoveTask, onReorderTask, isBusy }) {
  const priorityLabel = getPriorityLabel(task.priority);
  const dueDate = formatDueDate(task.due_date);
  const assignedLabels = getLabelsForTask(task, labels, taskLabels);
  const cardRef = useRef(null);
  const ignoreNextClickRef = useRef(false);
  const touchDragRef = useRef({
    pointerId: null,
    startX: 0,
    startY: 0,
    isDragging: false,
  });

  function handleDragStart(event) {
    if (isBusy) {
      event.preventDefault();
      return;
    }
    event.stopPropagation();
    event.dataTransfer.setData('application/taskflow', JSON.stringify({ type: 'task', taskId: task.id }));
    event.dataTransfer.effectAllowed = 'move';
    event.currentTarget.classList.add('is-dragging');
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!isBusy) event.currentTarget.classList.add('is-task-drop-target');
  }

  function handleDragLeave(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      event.currentTarget.classList.remove('is-task-drop-target');
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.classList.remove('is-task-drop-target');
    if (isBusy) return;

    try {
      const rawData = event.dataTransfer.getData('application/taskflow') || event.dataTransfer.getData('text/plain');
      const dragData = rawData ? JSON.parse(rawData) : null;
      if (dragData?.type === 'task' && dragData.taskId !== task.id) {
        onReorderTask(dragData.taskId, task.id, task.column_id);
      }
    } catch {
      // Ignore malformed drag data from outside the board.
    }
  }

  function handleDragEnd(event) {
    event.currentTarget.classList.remove('is-dragging');
  }

  function clearTouchDragStyles() {
    cardRef.current?.classList.remove('is-touch-dragging');
    document.body.classList.remove('is-touch-dragging');
    document.querySelectorAll('.kanban-column.is-touch-drop-target').forEach((item) => {
      item.classList.remove('is-touch-drop-target');
    });
    document.querySelectorAll('.task-card.is-task-drop-target').forEach((item) => {
      item.classList.remove('is-task-drop-target');
    });
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' || isBusy) return;

    touchDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      isDragging: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event) {
    const dragState = touchDragRef.current;
    if (event.pointerType === 'mouse' || isBusy || dragState.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.isDragging && distance > 10) {
      dragState.isDragging = true;
      cardRef.current?.classList.add('is-touch-dragging');
      document.body.classList.add('is-touch-dragging');
    }

    if (dragState.isDragging) {
      event.preventDefault();
      const targetColumnId = findColumnIdAtPoint(event.clientX, event.clientY);
      const targetTaskId = findTaskIdAtPoint(event.clientX, event.clientY);
      document.querySelectorAll('.kanban-column.is-touch-drop-target').forEach((item) => {
        item.classList.remove('is-touch-drop-target');
      });

      if (targetColumnId && targetColumnId !== task.column_id) {
        document.querySelector(`[data-column-id="${targetColumnId}"]`)?.classList.add('is-touch-drop-target');
      }
      if (targetTaskId && targetTaskId !== task.id) {
        document.querySelector(`[data-task-id="${targetTaskId}"]`)?.classList.add('is-task-drop-target');
      }
    }
  }

  function handlePointerUp(event) {
    const dragState = touchDragRef.current;
    if (event.pointerType === 'mouse' || isBusy || dragState.pointerId !== event.pointerId) return;

    if (dragState.isDragging) {
      event.preventDefault();
      ignoreNextClickRef.current = true;
      const targetColumnId = findColumnIdAtPoint(event.clientX, event.clientY);
      const targetTaskId = findTaskIdAtPoint(event.clientX, event.clientY);
      if (targetTaskId && targetTaskId !== task.id && targetColumnId) {
        onReorderTask(task.id, targetTaskId, targetColumnId);
      } else if (targetColumnId && targetColumnId !== task.column_id) {
        onMoveTask(task.id, targetColumnId);
      }
    } else {
      ignoreNextClickRef.current = true;
      onOpenTask(task);
    }

    clearTouchDragStyles();
    touchDragRef.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      isDragging: false,
    };

    window.setTimeout(() => {
      ignoreNextClickRef.current = false;
    }, 0);
  }

  function handleClick(event) {
    if (ignoreNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onOpenTask(task);
  }

  return (
    <article
      ref={cardRef}
      className="task-card"
      data-task-card="true"
      data-task-id={task.id}
      draggable={!isBusy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      title="Click to open details. Hold and drag to move."
    >
      <div className="task-title-row">
        <h3>{task.title}</h3>
        {priorityLabel && <span className={`priority-pill priority-${task.priority}`}>{priorityLabel}</span>}
      </div>

      {assignedLabels.length > 0 && (
        <div className="task-label-row" aria-label="Task labels">
          {assignedLabels.map((label) => (
            <span key={label.id} className="task-label-pill" style={getLabelStyle(label.color)}>
              {label.name}
            </span>
          ))}
        </div>
      )}

      {(dueDate || task.description) && (
        <div className="task-card-footer">
          {dueDate && <span className="due-pill">Due {dueDate}</span>}
          {task.description && <span className="description-dot">Description</span>}
        </div>
      )}
    </article>
  );
}
