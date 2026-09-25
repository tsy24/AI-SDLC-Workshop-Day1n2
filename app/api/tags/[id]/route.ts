import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { tagDB } from '@/lib/db';

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : undefined;
    const color = typeof body.color === 'string' ? body.color : undefined;
    if (name !== undefined && !name) return NextResponse.json({ error: 'Tag name is required' }, { status: 400 });
    if (color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(color)) return NextResponse.json({ error: 'Color must be a valid hex code' }, { status: 400 });

    const existing = tagDB.findById(id, session.userId);
    if (!existing) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });

    try {
        const tag = tagDB.update(id, session.userId, { name, color });
        return NextResponse.json(tag);
    } catch {
        return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
    }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const id = parseId((await params).id);
    if (!id) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });

    const existing = tagDB.findById(id, session.userId);
    if (!existing) return NextResponse.json({ error: 'Tag not found' }, { status: 404 });

    tagDB.delete(id, session.userId);
    return NextResponse.json({ success: true });
}
