import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { tagDB, todoDB } from '@/lib/db';

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = parseId((await params).id);
    const todo = id ? todoDB.findById(id) : undefined;
    if (id === null || !todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });
    return NextResponse.json(tagDB.findByTodoId(id, session.userId));
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = parseId((await params).id);
    const todo = id ? todoDB.findById(id) : undefined;
    if (id === null || !todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const tagId = typeof body.tag_id === 'number' ? body.tag_id : Number(body.tag_id);
    if (!Number.isInteger(tagId) || tagId <= 0) return NextResponse.json({ error: 'Tag id is required' }, { status: 400 });

    const ok = tagDB.attachToTodo(id, tagId, session.userId);
    if (!ok) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    return NextResponse.json(tagDB.findByTodoId(id, session.userId));
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = parseId((await params).id);
    const todo = id ? todoDB.findById(id) : undefined;
    if (id === null || !todo || todo.user_id !== session.userId) return NextResponse.json({ error: 'Todo not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const tagId = typeof body.tag_id === 'number' ? body.tag_id : Number(body.tag_id);
    if (!Number.isInteger(tagId) || tagId <= 0) return NextResponse.json({ error: 'Tag id is required' }, { status: 400 });

    const ok = tagDB.detachFromTodo(id, tagId, session.userId);
    if (!ok) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    return NextResponse.json(tagDB.findByTodoId(id, session.userId));
}
