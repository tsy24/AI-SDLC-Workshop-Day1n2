import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { type ReminderMinutes, todoDB } from '@/lib/db';
import { calculateNextDueDate } from '@/lib/recurrence';
import { isDueDateAtLeastOneMinuteAway, parseOptionalDueDate, parsePriority, parseRecurrencePattern, parseReminderMinutes, parseRecurring, parseTodoTitle } from '@/lib/validation';

interface RouteContext {
    params: Promise<{ id: string }>;
}

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const todo = id ? todoDB.findById(id) : undefined;
    if (!todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    return NextResponse.json(todo);
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const existing = id ? todoDB.findById(id) : undefined;
    if (!existing || existing.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const update: Parameters<typeof todoDB.update>[1] = {};
    const recurring = body.is_recurring === undefined ? existing.is_recurring : parseRecurring(body.is_recurring);
    if (recurring === null) return NextResponse.json({ error: 'is_recurring must be boolean' }, { status: 400 });
    const dueDate = body.due_date === undefined ? existing.due_date : parseOptionalDueDate(body.due_date);
    if (dueDate === undefined) return NextResponse.json({ error: 'Due date must be a valid ISO date' }, { status: 400 });
    const recurrencePattern = body.recurrence_pattern === undefined
        ? existing.recurrence_pattern
        : parseRecurrencePattern(body.recurrence_pattern);
    const reminderMinutes = body.reminder_minutes === undefined
        ? existing.reminder_minutes
        : parseReminderMinutes(body.reminder_minutes);
    if (reminderMinutes === undefined) return NextResponse.json({ error: 'Invalid reminder interval' }, { status: 400 });
    if (recurring && !dueDate) return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
    if (recurring && !recurrencePattern) return NextResponse.json({ error: 'Recurring todos require a valid recurrence pattern' }, { status: 400 });
    if (reminderMinutes !== null && !dueDate) return NextResponse.json({ error: 'Reminders require a due date' }, { status: 400 });
    if (body.is_recurring !== undefined) update.is_recurring = recurring;
    if (body.recurrence_pattern !== undefined || (body.is_recurring === false && existing.recurrence_pattern !== null)) {
        update.recurrence_pattern = recurring ? recurrencePattern : null;
    }
    if (body.title !== undefined) {
        const title = parseTodoTitle(body.title);
        if (!title) return NextResponse.json({ error: 'Title is required and must be 500 characters or fewer' }, { status: 400 });
        update.title = title;
    }
    if (body.due_date !== undefined) {
        if (!isDueDateAtLeastOneMinuteAway(dueDate)) return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
        update.due_date = dueDate;
    }
    if (body.priority !== undefined) {
        const priority = parsePriority(body.priority);
        if (!priority) return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 });
        update.priority = priority;
    }
    if (body.completed !== undefined) {
        if (typeof body.completed !== 'boolean') return NextResponse.json({ error: 'Completed must be boolean' }, { status: 400 });
        update.completed = body.completed;
    }
    if (body.reminder_minutes !== undefined) update.reminder_minutes = (reminderMinutes ?? null) as typeof update.reminder_minutes;
    if (body.last_notification_sent !== undefined) {
        if (typeof body.last_notification_sent !== 'string' || Number.isNaN(Date.parse(body.last_notification_sent))) {
            return NextResponse.json({ error: 'Invalid notification timestamp' }, { status: 400 });
        }
        update.last_notification_sent = body.last_notification_sent;
    }

    const justCompleted = body.completed === true && !existing.completed;
    if (justCompleted && recurring && recurrencePattern && dueDate) {
        const nextDueDate = calculateNextDueDate(dueDate, recurrencePattern);
        const result = todoDB.completeAndCreateNext(id as number, {
            ...update,
            is_recurring: true,
            recurrence_pattern: recurrencePattern,
            reminder_minutes: reminderMinutes === null || reminderMinutes === undefined ? null : reminderMinutes as ReminderMinutes,
            completed: true,
        }, nextDueDate);
        return NextResponse.json(result);
    }

    return NextResponse.json(todoDB.update(id as number, update));
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const todo = id ? todoDB.findById(id) : undefined;
    if (!todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    todoDB.delete(id as number);
    return NextResponse.json({ success: true });
}
