import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { importSchema } from '@/lib/export-import';

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: 'Failed to import todos. Please check the file format.' },
            { status: 400 },
        );
    }

    try {
        const result = todoDB.importAll(session.userId, parsed.data.todos);
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        console.error('Import failed:', error);
        return NextResponse.json({ error: 'Failed to import todos' }, { status: 500 });
    }
}