import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { toCsv, toExportItem, type TodoExport } from '@/lib/export-import';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const format = request.nextUrl.searchParams.get('format') ?? 'json';
    if (format !== 'json' && format !== 'csv') {
        return NextResponse.json({ error: 'Format must be json or csv' }, { status: 400 });
    }

    const now = getSingaporeNow();
    const date = formatSingaporeDate(now, 'yyyy-MM-dd');
    const todos = todoDB.findAllWithRelations(session.userId);
    const headers = {
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="todos-${date}.${format}"`,
    };

    if (format === 'csv') {
        return new NextResponse(toCsv(todos), {
            headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
        });
    }

    const payload: TodoExport = {
        version: 1,
        exported_at: now.toISOString(),
        todos: todos.map(toExportItem),
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
    });
}