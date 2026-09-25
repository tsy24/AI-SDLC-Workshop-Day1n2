'use client';

import { FormEvent, useEffect, useState } from 'react';

interface Todo {
    id: number;
    title: string;
    completed: boolean;
    priority: string;
}

export default function HomePage() {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [title, setTitle] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/todos')
            .then(async (response) => {
                if (!response.ok) throw new Error('Unable to load todos');
                return response.json();
            })
            .then(setTodos)
            .catch((loadError: Error) => setError(loadError.message));
    }, []);

    async function createTodo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError('');
        const response = await fetch('/api/todos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
        });
        const todo = await response.json();
        if (!response.ok) {
            setError(todo.error ?? 'Unable to create todo');
            return;
        }
        setTodos((current) => [todo, ...current]);
        setTitle('');
    }

    return (
        <main style={{ padding: 32 }}>
            <h1>Todo App</h1>
            <form onSubmit={createTodo} style={{ display: 'flex', gap: 8, margin: '24px 0' }}>
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a todo" />
                <button type="submit">Add</button>
            </form>
            {error ? <p role="alert">{error}</p> : null}
            <ul>
                {todos.map((todo) => <li key={todo.id}>{todo.title} ({todo.priority})</li>)}
            </ul>
        </main>
    );
}
