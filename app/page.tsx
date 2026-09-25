'use client';

import { FormEvent, useEffect, useState } from 'react';
import { formatSingaporeDate, parseSingaporeDate } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';

interface Todo {
    id: number;
    title: string;
    completed: boolean;
    priority: Priority;
    due_date: string | null;
    created_at: string;
}

const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const priorityLabels: Record<Priority, string> = { high: 'High', medium: 'Medium', low: 'Low' };
const priorityColors: Record<Priority, string> = {
    high: '#b91c1c',
    medium: '#a16207',
    low: '#1d4ed8',
};

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
    return !todo.completed && Boolean(todo.due_date && new Date(todo.due_date).getTime() < Date.now());
}

function formatDueDate(value: string | null): string {
    return value ? formatSingaporeDate(value, 'yyyy-MM-dd HH:mm') : 'No due date';
}

export default function HomePage() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [title, setTitle] = useState('');
    const [priority, setPriority] = useState<Priority>('medium');
    const [dueDate, setDueDate] = useState('');
    const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editPriority, setEditPriority] = useState<Priority>('medium');
    const [editDueDate, setEditDueDate] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        loadTodos();
    }, []);

    async function loadTodos() {
        try {
            const response = await fetch('/api/todos');
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to load todos');
            setTodos(payload);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Unable to load todos');
        }
    }

    async function createTodo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        try {
            const response = await fetch('/api/todos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, priority, due_date: dueDate || null }),
            });
            const todo = await response.json();
            if (!response.ok) throw new Error(todo.error ?? 'Unable to create todo');
            setTodos((current) => sortTodos([todo, ...current]));
            setTitle('');
            setDueDate('');
            setPriority('medium');
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : 'Unable to create todo');
        }
    }

    function beginEdit(todo: Todo) {
        setEditingId(todo.id);
        setEditTitle(todo.title);
        setEditPriority(todo.priority);
        setEditDueDate(todo.due_date ? formatSingaporeDate(todo.due_date, 'yyyy-MM-ddTHH:mm') : '');
    }

    async function saveEdit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (editingId === null) return;
        try {
            const response = await fetch(`/api/todos/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: editTitle, priority: editPriority, due_date: editDueDate || null }),
            });
            const todo = await response.json();
            if (!response.ok) throw new Error(todo.error ?? 'Unable to update todo');
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
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error ?? 'Unable to update todo');
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
                <button type="button" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.assign('/login'); }}>Log out</button>
            </header>
            <form onSubmit={createTodo} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 8, margin: '24px 0' }}>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a todo" aria-label="Todo title" />
                <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} aria-label="Priority">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <input type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-label="Due date" />
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
                            <button type="submit">Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                        </form> : <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo)} aria-label={`Complete ${todo.title}`} />
                            <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', flex: 1 }}>{todo.title}</span>
                            <strong style={{ color: priorityColors[todo.priority] }}>{priorityLabels[todo.priority]}</strong>
                            <small>{formatDueDate(todo.due_date)}</small>
                            <button type="button" onClick={() => beginEdit(todo)}>Edit</button>
                            <button type="button" onClick={() => deleteTodo(todo)}>Delete</button>
                        </div>}
                    </li>)}
                </ul>
            </section>)}
        </main>
    );
}
