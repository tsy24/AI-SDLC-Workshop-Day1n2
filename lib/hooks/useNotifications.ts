'use client';

import { useEffect, useState } from 'react';

import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

interface ReminderTodo {
    id: number;
    title: string;
    due_date: string | null;
}

export function useNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPermission(window.Notification.permission);
        }
    }, []);

    async function requestPermission() {
        if (!('Notification' in window)) return;
        const result = await window.Notification.requestPermission();
        setPermission(result);
    }

    useEffect(() => {
        if (permission !== 'granted') return;

        async function poll() {
            try {
                const response = await fetch('/api/notifications/check');
                if (!response.ok) return;
                const payload = await response.json() as { data: ReminderTodo[] };
                if (window.Notification.permission !== 'granted') {
                    setPermission(window.Notification.permission);
                    return;
                }
                for (const todo of payload.data) {
                    new window.Notification(todo.title, {
                        body: todo.due_date ? `Due ${formatSingaporeDate(todo.due_date, 'yyyy-MM-dd HH:mm')}` : 'Reminder',
                        tag: `todo-${todo.id}`,
                    });
                    await fetch(`/api/todos/${todo.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ last_notification_sent: getSingaporeNow().toISOString() }),
                    });
                }
            } catch {
                // Notification polling is best-effort and should not disrupt the todo page.
            }
        }

        void poll();
        const interval = window.setInterval(() => void poll(), 30_000);
        return () => window.clearInterval(interval);
    }, [permission]);

    return { permission, requestPermission };
}
