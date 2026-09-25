import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { subtaskDB, todoDB } from '@/lib/db';
import { parseSubtaskTitle } from '@/lib/validation';

interface RouteContext {
    params: Promise<{ id: string }>;
}

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

// Ownership is inherited from the parent todo; subtask ids aren't scoped to a user directly.
function findOwnedSubtask(id: number, userId: number) {
    const subtask = subtaskDB.findById(id);
    if (!subtask) return null;
    const todo = todoDB.findById(subtask.todo_id);
    if (!todo || todo.user_id !== userId) return null;
    return subtask;
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const subtask = id ? findOwnedSubtask(id, session.userId) : null;
    if (!subtask) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const update: Parameters<typeof subtaskDB.update>[1] = {};
    if (body.title !== undefined) {
        const title = parseSubtaskTitle(body.title);
        if (!title) return NextResponse.json({ error: 'Subtask title is required and must be 500 characters or fewer' }, { status: 400 });
        update.title = title;
    }
    if (body.completed !== undefined) {
        if (typeof body.completed !== 'boolean') return NextResponse.json({ error: 'Completed must be boolean' }, { status: 400 });
        update.completed = body.completed;
    }

    return NextResponse.json(subtaskDB.update(id as number, update));
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const subtask = id ? findOwnedSubtask(id, session.userId) : null;
    if (!subtask) return NextResponse.json({ error: 'Subtask not found' }, { status: 404 });
    subtaskDB.delete(id as number);
    return NextResponse.json({ success: true });
}
