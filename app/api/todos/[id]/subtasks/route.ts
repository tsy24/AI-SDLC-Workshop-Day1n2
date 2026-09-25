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

export async function GET(_request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    const todo = todoDB.findById(id);
    if (!todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    return NextResponse.json(subtaskDB.findByTodoId(id));
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    const todo = todoDB.findById(id);
    if (!todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const title = parseSubtaskTitle(body.title);
    if (!title) return NextResponse.json({ error: 'Subtask title is required and must be 500 characters or fewer' }, { status: 400 });

    return NextResponse.json(subtaskDB.create(id, { title }), { status: 201 });
}
