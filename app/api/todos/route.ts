import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { PRIORITY_VALUES, todoDB } from '@/lib/db';
import { isDueDateAtLeastOneMinuteAway, parseOptionalDueDate, parsePriority, parseRecurrencePattern, parseReminderMinutes, parseRecurring, parseTodoTitle } from '@/lib/validation';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const requestedPriority = request.nextUrl.searchParams.get('priority');
    if (requestedPriority && !PRIORITY_VALUES.includes(requestedPriority as typeof PRIORITY_VALUES[number])) {
        return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 });
    }
    return NextResponse.json(todoDB.findAllByUser(session.userId, requestedPriority as typeof PRIORITY_VALUES[number] | undefined));
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const title = parseTodoTitle(body.title);
    const dueDate = parseOptionalDueDate(body.due_date);
    const priority = body.priority === undefined ? 'medium' : parsePriority(body.priority);
    const recurring = parseRecurring(body.is_recurring);
    const recurrencePattern = body.recurrence_pattern === undefined ? null : parseRecurrencePattern(body.recurrence_pattern);
    const reminderMinutes = parseReminderMinutes(body.reminder_minutes);

    if (!title) return NextResponse.json({ error: 'Title is required and must be 500 characters or fewer' }, { status: 400 });
    if (dueDate === undefined) return NextResponse.json({ error: 'Due date must be a valid ISO date' }, { status: 400 });
    if (!priority) return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 });
    if (recurring === null) return NextResponse.json({ error: 'is_recurring must be boolean' }, { status: 400 });
    if (reminderMinutes === undefined) return NextResponse.json({ error: 'Invalid reminder interval' }, { status: 400 });
    if (recurring && !dueDate) return NextResponse.json({ error: 'Recurring todos require a due date' }, { status: 400 });
    if (recurring && !recurrencePattern) return NextResponse.json({ error: 'Recurring todos require a valid recurrence pattern' }, { status: 400 });
    if (reminderMinutes !== null && !dueDate) return NextResponse.json({ error: 'Reminders require a due date' }, { status: 400 });
    if (!isDueDateAtLeastOneMinuteAway(dueDate)) {
        return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
    }

    return NextResponse.json(todoDB.create({
        user_id: session.userId,
        title,
        due_date: dueDate,
        priority,
        is_recurring: recurring,
        recurrence_pattern: recurring ? recurrencePattern : null,
        reminder_minutes: reminderMinutes,
    }), { status: 201 });
}
