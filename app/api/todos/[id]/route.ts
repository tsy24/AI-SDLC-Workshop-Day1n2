import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { isDueDateAtLeastOneMinuteAway, parseOptionalDueDate, parsePriority, parseTodoTitle } from '@/lib/validation';

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
    if (body.title !== undefined) {
        const title = parseTodoTitle(body.title);
        if (!title) return NextResponse.json({ error: 'Title is required and must be 500 characters or fewer' }, { status: 400 });
        update.title = title;
    }
    if (body.due_date !== undefined) {
        const dueDate = parseOptionalDueDate(body.due_date);
        if (dueDate === undefined) return NextResponse.json({ error: 'Due date must be a valid ISO date' }, { status: 400 });
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
