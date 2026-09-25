'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Subtask } from '@/lib/db';
import { calculateProgress } from '@/lib/subtasks';
import { formatSingaporeDate, parseSingaporeDate } from '@/lib/timezone';
import { useNotifications } from '@/lib/hooks/useNotifications';

type Priority = 'high' | 'medium' | 'low';
type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

interface Todo {
    id: number;
    title: string;
    completed: boolean;
    priority: Priority;
    due_date: string | null;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: ReminderMinutes | null;
    created_at: string;
}

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const priorityLabels: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const priorityColors: Record<Priority, string> = {
    high: '#b91c1c',
    medium: '#a16207',
    low: '#1d4ed8',
};
const reminderLabels: Record<ReminderMinutes, string> = { 15: '15m', 30: '30m', 60: '1h', 120: '2h', 1440: '1d', 2880: '2d', 10080: '1w' };

function sortTodos(todos: Todo[]): Todo[] {
    return [...todos].sort((first, second) => {
        if (first.completed !== second.completed) return first.completed ? 1 : -1;
        if (!first.completed && first.priority !== second.priority) {
            return priorityOrder[first.priority] - priorityOrder[second.priority];
        }
        if (!first.completed) {
            if (first.due_date && second.due_date) {
                const dueDifference = parseSingaporeDate(first.due_date).getTime() - parseSingaporeDate(second.due_date).getTime();
                if (dueDifference !== 0) return dueDifference;
            } else if (first.due_date) {
                return -1;
            } else if (second.due_date) {
                return 1;
            }
        }
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    });
}

function isOverdue(todo: Todo): boolean {
    return !todo.completed && Boolean(todo.due_date && parseSingaporeDate(todo.due_date).getTime() < Date.now());
}

function formatDueDate(value: string | null): string {
    return value ? formatSingaporeDate(value, 'yyyy-MM-dd HH:mm') : 'No due date';
}

interface SubtaskSectionProps {
    todo: Todo;
    subtasks: Subtask[];
    expanded: boolean;
    newTitle: string;
    onToggleExpanded: () => void;
    onNewTitleChange: (value: string) => void;
    onAdd: () => void;
    onToggleSubtask: (subtask: Subtask) => void;
    onDeleteSubtask: (subtaskId: number) => void;
}

function SubtaskSection({
    todo,
    subtasks,
    expanded,
    newTitle,
    onToggleExpanded,
    onNewTitleChange,
    onAdd,
    onToggleSubtask,
    onDeleteSubtask,
}: SubtaskSectionProps) {
    const { completed, total, percent } = calculateProgress(subtasks);

    return (
        <div style={{ marginTop: 8 }}>
            {total > 0 ? <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                    <span>{completed}/{total} subtasks</span>
                    <span>{percent}%</span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#16a34a' : '#2563eb' }} />
                </div>
            </div> : null}
            <button type="button" onClick={onToggleExpanded} style={{ fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                {expanded ? '▼' : '▶'} Subtasks
            </button>
            {expanded ? <div style={{ marginTop: 6, paddingLeft: 16 }}>
                {subtasks.map((subtask) => (
                    <div key={subtask.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                        <input
                            type="checkbox"
                            checked={subtask.completed}
                            onChange={() => onToggleSubtask(subtask)}
                            aria-label={`Complete subtask ${subtask.title}`}
                        />
                        <span style={{ textDecoration: subtask.completed ? 'line-through' : 'none', color: subtask.completed ? '#9ca3af' : 'inherit', flex: 1 }}>
                            {subtask.title}
                        </span>
                        <button type="button" onClick={() => onDeleteSubtask(subtask.id)} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <input
                        type="text"
                        value={newTitle}
                        onChange={(event) => onNewTitleChange(event.target.value)}
                        onKeyDown={(event) => { if (event.key === 'Enter') onAdd(); }}
                        placeholder="Add subtask..."
                        aria-label={`Add subtask to ${todo.title}`}
                    />
                    <button type="button" onClick={onAdd}>Add</button>
                </div>
            </div> : null}
        </div>
    );
}

export default function HomePage() {
    const { permission, requestPermission } = useNotifications();
    const [todos, setTodos] = useState<Todo[]>([]);
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<Priority>('medium');
    const [dueDate, setDueDate] = useState('');
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>('daily');
    const [reminderMinutes, setReminderMinutes] = useState<ReminderMinutes | null>(null);
    const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editPriority, setEditPriority] = useState<Priority>('medium');
    const [editDueDate, setEditDueDate] = useState('');
    const [editRecurring, setEditRecurring] = useState(false);
    const [editRecurrencePattern, setEditRecurrencePattern] = useState<RecurrencePattern>('daily');
    const [editReminderMinutes, setEditReminderMinutes] = useState<ReminderMinutes | null>(null);
    const [error, setError] = useState('');
    const [subtasksByTodo, setSubtasksByTodo] = useState<Record<number, Subtask[]>>({});
    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<number, boolean>>({});
    const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<number, string>>({});

    useEffect(() => {
        loadTodos();
    }, []);

    async function loadTodos() {
        try {
            const response = await fetch('/api/todos');
            const payload = (await response.json()) as Todo[] | { error: string };
            if (!response.ok) throw new Error((payload as { error: string }).error ?? 'Unable to load todos');
            const loadedTodos = payload as Todo[];
            setTodos(loadedTodos);
            // preload so progress bars are visible even before a checklist is expanded
            await Promise.all(loadedTodos.map((todo) => loadSubtasks(todo.id)));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load todos');
        }
    }

    async function loadSubtasks(todoId: number) {
        try {
            const response = await fetch(`/api/todos/${todoId}/subtasks`);
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to load subtasks');
            setSubtasksByTodo((current) => ({ ...current, [todoId]: payload }));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load subtasks');
        }
    }

    function toggleSubtasksExpanded(todoId: number) {
        setExpandedSubtasks((current) => ({ ...current, [todoId]: !current[todoId] }));
    }

    async function addSubtask(todoId: number) {
        const title = (newSubtaskTitle[todoId] ?? '').trim();
        if (!title) return;
        try {
            const response = await fetch(`/api/todos/${todoId}/subtasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to add subtask');
            setSubtasksByTodo((current) => ({ ...current, [todoId]: [...(current[todoId] ?? []), payload] }));
            setNewSubtaskTitle((current) => ({ ...current, [todoId]: '' }));
        } catch (addError) {
            setError(addError instanceof Error ? addError.message : 'Unable to add subtask');
        }
    }

    async function toggleSubtask(todoId: number, subtask: Subtask) {
        const previous = subtasksByTodo[todoId] ?? [];
        const optimistic = previous.map((item) => item.id === subtask.id ? { ...item, completed: !item.completed } : item);
        setSubtasksByTodo((current) => ({ ...current, [todoId]: optimistic }));
        try {
            const response = await fetch(`/api/subtasks/${subtask.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !subtask.completed }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to update subtask');
        } catch (toggleError) {
            setSubtasksByTodo((current) => ({ ...current, [todoId]: previous }));
            setError(toggleError instanceof Error ? toggleError.message : 'Unable to update subtask');
        }
    }

    async function deleteSubtask(todoId: number, subtaskId: number) {
        const previous = subtasksByTodo[todoId] ?? [];
        setSubtasksByTodo((current) => ({ ...current, [todoId]: previous.filter((item) => item.id !== subtaskId) }));
        try {
            const response = await fetch(`/api/subtasks/${subtaskId}`, { method: 'DELETE' });
            if (!response.ok) {
                const payload = await response.json();
                throw new Error(payload.error ?? 'Unable to delete subtask');
            }
        } catch (deleteError) {
            setSubtasksByTodo((current) => ({ ...current, [todoId]: previous }));
            setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete subtask');
        }
    }

    async function createTodo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, priority, due_date: dueDate || null, is_recurring: isRecurring, recurrence_pattern: recurrencePattern, reminder_minutes: reminderMinutes }),
            });
            const todo = await response.json();
            if (!response.ok) throw new Error(todo.error ?? 'Unable to create todo');
            setTodos((current) => sortTodos([todo, ...current]));
            setTitle('');
            setDueDate('');
            setPriority('medium');
            setIsRecurring(false);
            setReminderMinutes(null);
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : 'Unable to create todo');
        }
    }

    function beginEdit(todo: Todo) {
        setEditingId(todo.id);
        setEditTitle(todo.title);
        setEditPriority(todo.priority);
        setEditDueDate(todo.due_date ? formatSingaporeDate(todo.due_date, 'yyyy-MM-ddTHH:mm') : '');
        setEditRecurring(todo.is_recurring);
        setEditRecurrencePattern(todo.recurrence_pattern ?? 'daily');
        setEditReminderMinutes(todo.reminder_minutes);
    }

    async function saveEdit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (editingId === null) return;
        try {
            const response = await fetch(`/api/todos/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle, priority: editPriority, due_date: editDueDate || null, is_recurring: editRecurring, recurrence_pattern: editRecurrencePattern, reminder_minutes: editReminderMinutes }),
            });
            const payload = await response.json() as Todo | { todo: Todo; nextInstance?: Todo };
            if (!response.ok) throw new Error('Unable to update todo');
            const todo = 'todo' in payload ? payload.todo : payload;
            setTodos((current) => sortTodos(current.map((item) => item.id === todo.id ? todo : item)));
            setEditingId(null);
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Unable to update todo');
        }
    }

    async function toggleTodo(todo: Todo) {
        const updated = { ...todo, completed: !todo.completed };
        setTodos((current) => sortTodos(current.map((item) => item.id === todo.id ? updated : item)));
        try {
            const response = await fetch(`/api/todos/${todo.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: updated.completed }),
            });
            const payload = await response.json() as Todo | { todo: Todo; nextInstance?: Todo };
            if (!response.ok) throw new Error('Unable to update todo');
            const updatedTodo = 'todo' in payload ? payload.todo : payload;
            const nextInstance = 'nextInstance' in payload ? payload.nextInstance : undefined;
            setTodos((current) => sortTodos([...current.map((item) => item.id === todo.id ? updatedTodo : item), ...(nextInstance ? [nextInstance] : [])]));
        } catch (toggleError) {
            setTodos((current) => current.map((item) => item.id === todo.id ? todo : item));
            setError(toggleError instanceof Error ? toggleError.message : 'Unable to update todo');
        }
    }

    async function deleteTodo(todo: Todo) {
        const previousTodos = todos;
        setTodos((current) => current.filter((item) => item.id !== todo.id));
        try {
            const response = await fetch(`/api/todos/${todo.id}`, { method: 'DELETE' });
            if (!response.ok) {
                const payload = await response.json();
                throw new Error(payload.error ?? 'Unable to delete todo');
            }
            setSubtasksByTodo((current) => { const { [todo.id]: _removed, ...rest } = current; return rest; });
            setExpandedSubtasks((current) => { const { [todo.id]: _removed, ...rest } = current; return rest; });
            setNewSubtaskTitle((current) => { const { [todo.id]: _removed, ...rest } = current; return rest; });
        } catch (deleteError) {
            setTodos(previousTodos);
            setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete todo');
        }
    }

    const visibleTodos = sortTodos(todos.filter((todo) => priorityFilter === 'all' || todo.priority === priorityFilter));
    const sections = [
        { key: 'overdue', label: 'Overdue', items: visibleTodos.filter(isOverdue) },
        { key: 'pending', label: 'Pending', items: visibleTodos.filter((todo) => !todo.completed && !isOverdue(todo)) },
        { key: 'completed', label: 'Completed', items: visibleTodos.filter((todo) => todo.completed) },
    ];

    return (
        <main style={{ maxWidth: 900, padding: 32 }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Todo App</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => void requestPermission()} disabled={permission === 'granted'}>
                        {permission === 'granted' ? 'Notifications On' : 'Enable Notifications'}
                    </button>
                    <button type="button" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }}>Log out</button>
                </div>
            </header>
            <form onSubmit={createTodo} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, margin: '24px 0' }}>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a todo" aria-label="Todo title" />
                <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} aria-label="Priority">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <input type="datetime-local" value={dueDate} onChange={(event) => { const value = event.target.value; setDueDate(value); if (!value) { setIsRecurring(false); setReminderMinutes(null); } }} aria-label="Due date" />
                <label><input type="checkbox" checked={isRecurring} disabled={!dueDate} onChange={(event) => setIsRecurring(event.target.checked)} /> Repeat</label>
                {isRecurring ? <select value={recurrencePattern} onChange={(event) => setRecurrencePattern(event.target.value as RecurrencePattern)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select> : null}
                <select value={reminderMinutes ?? ''} disabled={!dueDate} onChange={(event) => setReminderMinutes(event.target.value ? Number(event.target.value) as ReminderMinutes : null)}><option value="">No reminder</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="1440">1 day</option><option value="2880">2 days</option><option value="10080">1 week</option></select>
                <button type="submit">Add</button>
            </form>
            <label>Filter priority: <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | 'all')}>
                <option value="all">All priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
            </select></label>
            {error ? <p role="alert">{error}</p> : null}
            {sections.map((section) => <section key={section.key} style={{ marginTop: 28 }}>
                <h2>{section.label} ({section.items.length})</h2>
                <ul style={{ padding: 0, listStyle: 'none' }}>
                    {section.items.map((todo) => <li key={todo.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
                        {editingId === todo.id ? <form onSubmit={saveEdit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Edit todo title" />
                            <select value={editPriority} onChange={(event) => setEditPriority(event.target.value as Priority)} aria-label="Edit priority">
                                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                            </select>
                            <input type="datetime-local" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} aria-label="Edit due date" />
                            <label><input type="checkbox" checked={editRecurring} disabled={!editDueDate} onChange={(event) => setEditRecurring(event.target.checked)} /> Repeat</label>
                            {editRecurring ? <select value={editRecurrencePattern} onChange={(event) => setEditRecurrencePattern(event.target.value as RecurrencePattern)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select> : null}
                            <select value={editReminderMinutes ?? ''} disabled={!editDueDate} onChange={(event) => setEditReminderMinutes(event.target.value ? Number(event.target.value) as ReminderMinutes : null)}><option value="">No reminder</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="1440">1 day</option><option value="2880">2 days</option><option value="10080">1 week</option></select>
                            <button type="submit">Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </form> : <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} aria-label={`Complete ${todo.title}`} />
                            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', flex: 1 }}>{todo.title}</span>
                            <strong style={{ color: priorityColors[todo.priority] }}>{priorityLabels[todo.priority]}</strong>
                            {todo.is_recurring && todo.recurrence_pattern ? <strong>↻ {todo.recurrence_pattern}</strong> : null}
                            {todo.reminder_minutes ? <strong>Bell {reminderLabels[todo.reminder_minutes]}</strong> : null}
                            <small>{formatDueDate(todo.due_date)}</small>
                            <button type="button" onClick={() => beginEdit(todo)}>Edit</button>
                            <button type="button" onClick={() => deleteTodo(todo)}>Delete</button>
                        </div>}
                        <SubtaskSection
                            todo={todo}
                            subtasks={subtasksByTodo[todo.id] ?? []}
                            expanded={Boolean(expandedSubtasks[todo.id])}
                            newTitle={newSubtaskTitle[todo.id] ?? ''}
                            onToggleExpanded={() => toggleSubtasksExpanded(todo.id)}
                            onNewTitleChange={(value) => setNewSubtaskTitle((current) => ({ ...current, [todo.id]: value }))}
                            onAdd={() => addSubtask(todo.id)}
                            onToggleSubtask={(subtask) => toggleSubtask(todo.id, subtask)}
                            onDeleteSubtask={(subtaskId) => deleteSubtask(todo.id, subtaskId)}
                        />
                    </li>)}
                </ul>
            </section>)}
        </main>
    );
}
