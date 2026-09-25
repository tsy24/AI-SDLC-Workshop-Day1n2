'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Subtask, Tag } from '@/lib/db';
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
    tags?: Tag[];
}

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const priorityLabels: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const priorityColors: Record<Priority, string> = { high: '#b91c1c', medium: '#a16207', low: '#1d4ed8' };
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

function TagPill({ tag, selected, onClick }: { tag: Tag; selected?: boolean; onClick?: (tag: Tag) => void }) {
    return (
        <button
            type="button"
            onClick={() => onClick?.(tag)}
            style={{
                background: selected ? tag.color : '#f3f4f6',
                color: selected ? '#ffffff' : '#374151',
                border: `1px solid ${selected ? tag.color : '#d1d5db'}`,
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
            }}
        >
            {selected ? '✓' : null}
            {tag.name}
        </button>
    );
}

function ManageTagsModal({
    tags,
    onClose,
    onCreate,
    onUpdate,
    onDelete,
}: {
    tags: Tag[];
    onClose: () => void;
    onCreate: (input: { name: string; color: string }) => Promise<void>;
    onUpdate: (id: number, input: { name: string; color: string }) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#3B82F6');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingColor, setEditingColor] = useState('#3B82F6');

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ background: '#fff', width: 420, maxWidth: '90vw', borderRadius: 12, padding: 20, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h2 style={{ margin: 0 }}>Manage Tags</h2>
                    <button type="button" onClick={onClose}>Close</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tag name" aria-label="Tag name" style={{ flex: 1 }} />
                    <input type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Tag color" />
                    <button type="button" onClick={async () => { await onCreate({ name, color }); setName(''); setColor('#3B82F6'); }}>Create</button>
                </div>
                <div style={{ display: 'grid', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                    {tags.map((tag) => (
                        <div key={tag.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}>
                            {editingId === tag.id ? (
                                <>
                                    <input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label={`Edit tag ${tag.name}`} />
                                    <input type="color" value={editingColor} onChange={(event) => setEditingColor(event.target.value)} aria-label={`Edit tag color ${tag.name}`} />
                                    <button type="button" onClick={async () => { await onUpdate(tag.id, { name: editingName, color: editingColor }); setEditingId(null); }}>Save</button>
                                    <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                                </>
                            ) : (
                                <>
                                    <TagPill tag={tag} selected />
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button type="button" onClick={() => { setEditingId(tag.id); setEditingName(tag.name); setEditingColor(tag.color); }}>Edit</button>
                                        <button type="button" onClick={() => void onDelete(tag.id)} style={{ color: '#dc2626' }}>Delete</button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
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
        <div className="subtask-panel" style={{ marginTop: 8 }}>
            {total > 0 ? <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
                    <span>{completed}/{total} subtasks</span>
                    <span>{percent}%</span>
                </div>
                <div className="progress-track" style={{ width: '100%', height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#16a34a' : '#2563eb' }} />
                </div>
            </div> : null}
            <button className="subtask-toggle" type="button" onClick={onToggleExpanded} style={{ fontSize: 13, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
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
                        <button className="icon-button danger" type="button" onClick={() => onDeleteSubtask(subtask.id)} aria-label={`Delete subtask ${subtask.title}`} style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
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
    const [tags, setTags] = useState<Tag[]>([]);
    const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
    const [showTagModal, setShowTagModal] = useState(false);
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
    const [editTagIds, setEditTagIds] = useState<number[]>([]);
    const [error, setError] = useState('');
    const [subtasksByTodo, setSubtasksByTodo] = useState<Record<number, Subtask[]>>({});
    const [todoTagsByTodo, setTodoTagsByTodo] = useState<Record<number, Tag[]>>({});
    const [expandedSubtasks, setExpandedSubtasks] = useState<Record<number, boolean>>({});
    const [newSubtaskTitle, setNewSubtaskTitle] = useState<Record<number, string>>({});

    useEffect(() => {
        void loadTodos();
        void loadTags();
    }, []);

    async function loadTodos() {
        try {
            const response = await fetch('/api/todos');
            const payload = (await response.json()) as Todo[] | { error: string };
            if (!response.ok) throw new Error((payload as { error: string }).error ?? 'Unable to load todos');
            const loadedTodos = payload as Todo[];
            setTodos(loadedTodos);
            await Promise.all(loadedTodos.map((todo) => loadSubtasks(todo.id)));
            await Promise.all(loadedTodos.map((todo) => loadTodoTags(todo.id)));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load todos');
        }
    }

    async function loadTags() {
        try {
            const response = await fetch('/api/tags');
            const payload = (await response.json()) as Tag[] | { error: string };
            if (!response.ok) throw new Error((payload as { error: string }).error ?? 'Unable to load tags');
            setTags(payload as Tag[]);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load tags');
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

    async function loadTodoTags(todoId: number) {
        try {
            const response = await fetch(`/api/todos/${todoId}/tags`);
            const payload = (await response.json()) as Tag[] | { error: string };
            if (!response.ok) throw new Error((payload as { error: string }).error ?? 'Unable to load tags');
            setTodoTagsByTodo((current) => ({ ...current, [todoId]: payload as Tag[] }));
            setTodos((current) => current.map((todo) => todo.id === todoId ? { ...todo, tags: payload as Tag[] } : todo));
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load todo tags');
        }
    }

    function toggleTagSelection(tagId: number) {
        setSelectedTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
    }

    function toggleEditTagSelection(tagId: number) {
        setEditTagIds((current) => current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]);
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
        const originalTitle = title;
        const originalDueDate = dueDate;
        const originalPriority = priority;
        const originalRecurring = isRecurring;
        const originalReminder = reminderMinutes;
        const originalTagIds = [...selectedTagIds];
        const temporaryId = -Date.now();
        const optimisticTodo: Todo = {
            id: temporaryId,
            title: originalTitle.trim(),
            completed: false,
            priority: originalPriority,
            due_date: originalDueDate || null,
            is_recurring: originalRecurring,
            recurrence_pattern: originalRecurring ? recurrencePattern : null,
            reminder_minutes: originalReminder,
            created_at: new Date().toISOString(),
            tags: tags.filter((tag) => originalTagIds.includes(tag.id)),
        };
        setTodos((current) => sortTodos([optimisticTodo, ...current]));
        setSelectedTagIds([]);
        setTitle('');
        setDueDate('');
        setPriority('medium');
        setIsRecurring(false);
        setReminderMinutes(null);
        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    priority,
                    due_date: dueDate || null,
                    is_recurring: isRecurring,
                    recurrence_pattern: recurrencePattern,
                    reminder_minutes: reminderMinutes,
                    tag_ids: selectedTagIds,
                }),
            });
            const todo = await response.json();
            if (!response.ok) throw new Error(todo.error ?? 'Unable to create todo');
            setTodos((current) => sortTodos(current.map((item) => item.id === temporaryId ? todo : item)));
        } catch (createError) {
            setTodos((current) => current.filter((item) => item.id !== temporaryId));
            setTitle(originalTitle);
            setDueDate(originalDueDate);
            setPriority(originalPriority);
            setIsRecurring(originalRecurring);
            setReminderMinutes(originalReminder);
            setSelectedTagIds(originalTagIds);
            setError(createError instanceof Error ? createError.message : 'Unable to create todo');
        }
    }

    async function createTag(input: { name: string; color: string }) {
        const trimmed = input.name.trim();
        if (!trimmed) {
            setError('Tag name is required');
            return;
        }
        try {
            const response = await fetch('/api/tags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, color: input.color }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to create tag');
            setTags((current) => [...current, payload].sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })));
            setError('');
        } catch (createTagError) {
            setError(createTagError instanceof Error ? createTagError.message : 'Unable to create tag');
        }
    }

    async function updateTag(id: number, input: { name: string; color: string }) {
        const trimmed = input.name.trim();
        if (!trimmed) {
            setError('Tag name is required');
            return;
        }
        try {
            const response = await fetch(`/api/tags/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: trimmed, color: input.color }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to update tag');
            setTags((current) => current.map((tag) => tag.id === id ? payload : tag).sort((first, second) => first.name.localeCompare(second.name, undefined, { sensitivity: 'base' })));
            setTodos((current) => current.map((todo) => ({ ...todo, tags: (todo.tags ?? []).map((tag) => tag.id === id ? payload : tag) })));
            setError('');
        } catch (updateTagError) {
            setError(updateTagError instanceof Error ? updateTagError.message : 'Unable to update tag');
        }
    }

    async function deleteTag(id: number) {
        try {
            const response = await fetch(`/api/tags/${id}`, { method: 'DELETE' });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to delete tag');
            setTags((current) => current.filter((tag) => tag.id !== id));
            setSelectedTagIds((current) => current.filter((tagId) => tagId !== id));
            setEditTagIds((current) => current.filter((tagId) => tagId !== id));
            setTodos((current) => current.map((todo) => ({ ...todo, tags: (todo.tags ?? []).filter((tag) => tag.id !== id) })));
            setError('');
        } catch (deleteTagError) {
            setError(deleteTagError instanceof Error ? deleteTagError.message : 'Unable to delete tag');
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
        setEditTagIds((todo.tags ?? []).map((tag) => tag.id));
    }

    async function saveEdit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (editingId === null) return;
        const originalTodo = todos.find((todo) => todo.id === editingId);
        if (!originalTodo) return;
        const optimisticTodo: Todo = {
            ...originalTodo,
            title: editTitle.trim(),
            priority: editPriority,
            due_date: editDueDate || null,
            is_recurring: editRecurring,
            recurrence_pattern: editRecurring ? editRecurrencePattern : null,
            reminder_minutes: editReminderMinutes,
            tags: tags.filter((tag) => editTagIds.includes(tag.id)),
        };
        setTodos((current) => sortTodos(current.map((todo) => todo.id === editingId ? optimisticTodo : todo)));
        try {
            const response = await fetch(`/api/todos/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: editTitle,
                    priority: editPriority,
                    due_date: editDueDate || null,
                    is_recurring: editRecurring,
                    recurrence_pattern: editRecurrencePattern,
                    reminder_minutes: editReminderMinutes,
                    tag_ids: editTagIds,
                }),
            });
            const payload = await response.json() as Todo | { todo: Todo; nextInstance?: Todo };
            if (!response.ok) throw new Error('Unable to update todo');
            const todo = 'todo' in payload ? payload.todo : payload;
            const updatedTodo = { ...(todo as Todo), tags: todoTagsByTodo[todo.id] ?? (todo as Todo).tags ?? [] };
            setTodos((current) => sortTodos(current.map((item) => item.id === todo.id ? updatedTodo : item)));
            setEditingId(null);
            await loadTodoTags(todo.id);
        } catch (updateError) {
            setTodos((current) => current.map((todo) => todo.id === originalTodo.id ? originalTodo : todo));
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
        if (!window.confirm(`Delete "${todo.title}"? This cannot be undone.`)) return;
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
            setTodoTagsByTodo((current) => { const { [todo.id]: _removed, ...rest } = current; return rest; });
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
        <main className="app-shell" style={{ maxWidth: 900, padding: 32 }}>
            <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p className="eyebrow">Singapore time · Personal command center</p>
                    <h1>Make room for what matters.</h1>
                    <p className="header-copy">A calm place to capture, prioritize, and finish today&apos;s work.</p>
                </div>
                <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
                    <a className="calendar-link" href="/calendar" aria-label="Open calendar month view">
                        <span className="calendar-link-icon" aria-hidden="true">▦</span>
                        <span className="calendar-link-copy"><strong>Calendar</strong><small>Month view</small></span>
                    </a>
                    <button className="secondary-button" type="button" onClick={() => void requestPermission()} disabled={permission === 'granted'}>
                        {permission === 'granted' ? 'Notifications On' : 'Enable Notifications'}
                    </button>
                    <button className="ghost-button" type="button" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }}>Log out</button>
                </div>
            </header>
            <form className="quick-add-card" onSubmit={createTodo} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, margin: '24px 0' }}>
                <div className="quick-add-heading">
                    <span className="section-kicker">Quick capture</span>
                    <strong>What needs your attention?</strong>
                </div>
                <input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a todo" aria-label="Todo title" />
                <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} aria-label="Priority">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <input type="datetime-local" value={dueDate} onChange={(event) => { const value = event.target.value; setDueDate(value); if (!value) { setIsRecurring(false); setReminderMinutes(null); } }} aria-label="Due date" />
                <label><input type="checkbox" checked={isRecurring} disabled={!dueDate} onChange={(event) => setIsRecurring(event.target.checked)} /> Repeat</label>
                {isRecurring ? <select value={recurrencePattern} onChange={(event) => setRecurrencePattern(event.target.value as RecurrencePattern)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select> : null}
                <select value={reminderMinutes ?? ''} disabled={!dueDate} onChange={(event) => setReminderMinutes(event.target.value ? Number(event.target.value) as ReminderMinutes : null)}><option value="">No reminder</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="1440">1 day</option><option value="2880">2 days</option><option value="10080">1 week</option></select>
                <button className="primary-button" type="submit">Add task</button>
            </form>
            <div className="list-toolbar">
                <div>
                    <span className="section-kicker">Your list</span>
                    <strong>{todos.filter((todo) => !todo.completed).length} open tasks</strong>
                </div>
                <label>Priority <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | 'all')}>
                    <option value="all">All priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select></label>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <button type="button" onClick={() => setShowTagModal(true)}>+ Manage Tags</button>
                {tags.map((tag) => (
                    <TagPill key={tag.id} tag={tag} selected={selectedTagIds.includes(tag.id)} onClick={() => toggleTagSelection(tag.id)} />
                ))}
            </div>
            {error ? <p className="error-banner" role="alert">{error}</p> : null}
            {showTagModal ? <ManageTagsModal tags={tags} onClose={() => setShowTagModal(false)} onCreate={createTag} onUpdate={updateTag} onDelete={deleteTag} /> : null}
            {sections.map((section) => <section key={section.key} style={{ marginTop: 28 }}>
                <div className="section-heading"><h2>{section.label}</h2><span>{section.items.length}</span></div>
                <ul style={{ padding: 0, listStyle: 'none' }}>
                    {section.items.map((todo) => <li className={`todo-card priority-${todo.priority} ${todo.completed ? 'is-complete' : ''}`} key={todo.id} style={{ borderBottom: '1px solid #ddd', padding: '12px 0' }}>
                        {editingId === todo.id ? <form className="edit-form" onSubmit={saveEdit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Edit todo title" />
                            <select value={editPriority} onChange={(event) => setEditPriority(event.target.value as Priority)} aria-label="Edit priority">
                                <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                            </select>
                            <input type="datetime-local" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} aria-label="Edit due date" />
                            <label><input type="checkbox" checked={editRecurring} disabled={!editDueDate} onChange={(event) => setEditRecurring(event.target.checked)} /> Repeat</label>
                            {editRecurring ? <select value={editRecurrencePattern} onChange={(event) => setEditRecurrencePattern(event.target.value as RecurrencePattern)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select> : null}
                            <select value={editReminderMinutes ?? ''} disabled={!editDueDate} onChange={(event) => setEditReminderMinutes(event.target.value ? Number(event.target.value) as ReminderMinutes : null)}><option value="">No reminder</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option><option value="120">2 hours</option><option value="1440">1 day</option><option value="2880">2 days</option><option value="10080">1 week</option></select>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', width: '100%' }}>
                                {tags.map((tag) => (
                                    <TagPill key={tag.id} tag={tag} selected={editTagIds.includes(tag.id)} onClick={() => toggleEditTagSelection(tag.id)} />
                                ))}
                            </div>
                            <button type="submit">Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </form> : <div className="todo-row" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input className="todo-checkbox" type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} aria-label={`Complete ${todo.title}`} />
                            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', flex: 1 }}>{todo.title}</span>
                            <strong className="priority-badge" style={{ color: priorityColors[todo.priority] }}>{priorityLabels[todo.priority]}</strong>
                            {todo.is_recurring && todo.recurrence_pattern ? <strong className="meta-badge">↻ {todo.recurrence_pattern}</strong> : null}
                            {todo.reminder_minutes ? <strong className="meta-badge">Bell {reminderLabels[todo.reminder_minutes]}</strong> : null}
                            {(todo.tags ?? []).map((tag) => <TagPill key={tag.id} tag={tag} selected />)}
                            <small className="due-date">{formatDueDate(todo.due_date)}</small>
                            <div className="row-actions"><button className="ghost-button" type="button" onClick={() => beginEdit(todo)}>Edit</button>
                                <button className="ghost-button danger" type="button" onClick={() => deleteTodo(todo)}>Delete</button></div>
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
