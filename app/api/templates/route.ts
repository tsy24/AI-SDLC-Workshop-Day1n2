import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';
import { getSingaporeNow, parseSingaporeDate } from '@/lib/timezone';
import {
    isDueDateAtLeastOneMinuteAway,
    parseDueDateOffsetMinutes,
    parseJsonObjectBody,
    parseOptionalDueDate,
    parseOptionalTemplateText,
    parsePriority,
    parseRecurrencePattern,
    parseRecurring,
    parseReminderMinutes,
    parseTemplateName,
    parseTemplateSubtasks,
    parseTodoTitle,
        RequestBodyTooLargeError,
} from '@/lib/validation';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    return NextResponse.json(templateDB.findAllByUser(session.userId));
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
        const payload = await parseJsonObjectBody(request);
        if (!payload) return NextResponse.json({ error: 'JSON body must be an object' }, { status: 400 });
        body = payload;
    } catch (error) {
        if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = parseTemplateName(body.name);
    const title = parseTodoTitle(body.title_template);
    const description = parseOptionalTemplateText(body.description, 2_000);
    const category = parseOptionalTemplateText(body.category, 100);
    const priority = body.priority === undefined ? 'medium' : parsePriority(body.priority);
    const recurring = parseRecurring(body.is_recurring);
    const recurrencePattern = body.recurrence_pattern === undefined ? null : parseRecurrencePattern(body.recurrence_pattern);
    const reminderMinutes = parseReminderMinutes(body.reminder_minutes);
    const subtasks = body.subtasks === undefined ? [] : parseTemplateSubtasks(body.subtasks);

    if (!name || !title) return NextResponse.json({ error: 'Template name and todo title are required and must be 500 characters or fewer' }, { status: 400 });
    if (description === undefined || category === undefined) return NextResponse.json({ error: 'Invalid template description or category' }, { status: 400 });
    if (!priority) return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 });
    if (recurring === null) return NextResponse.json({ error: 'is_recurring must be boolean' }, { status: 400 });
    if (reminderMinutes === undefined) return NextResponse.json({ error: 'Invalid reminder interval' }, { status: 400 });
    if (body.recurrence_pattern !== undefined && !recurrencePattern) return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
    if (!subtasks) return NextResponse.json({ error: 'Subtasks must contain valid titles' }, { status: 400 });
    if (body.due_date !== undefined && body.due_date_offset_minutes !== undefined) {
        return NextResponse.json({ error: 'Provide either a due date or a due date offset, not both' }, { status: 400 });
    }

    let dueDateOffsetMinutes = parseDueDateOffsetMinutes(body.due_date_offset_minutes);
    if (body.due_date !== undefined) {
        const dueDate = parseOptionalDueDate(body.due_date);
        if (dueDate === undefined) return NextResponse.json({ error: 'Due date must be a valid ISO date' }, { status: 400 });
        if (!isDueDateAtLeastOneMinuteAway(dueDate)) return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
            if (dueDate !== null) {
              dueDateOffsetMinutes = parseDueDateOffsetMinutes(Math.max(1, Math.ceil((parseSingaporeDate(dueDate).getTime() - getSingaporeNow().getTime()) / 60_000)));
            }
    }

    if (dueDateOffsetMinutes === undefined) return NextResponse.json({ error: 'Due date offset must be a positive whole number of minutes' }, { status: 400 });
    if (recurring && !recurrencePattern) return NextResponse.json({ error: 'Recurring templates require a recurrence pattern' }, { status: 400 });
    if (recurring && dueDateOffsetMinutes === null) return NextResponse.json({ error: 'Recurring templates require a due date offset' }, { status: 400 });
    if (reminderMinutes !== null && dueDateOffsetMinutes === null) return NextResponse.json({ error: 'Reminder templates require a due date offset' }, { status: 400 });

    const template = templateDB.create({
        user_id: session.userId,
        name,
        description,
        category,
        title_template: title,
        priority,
        is_recurring: recurring,
        recurrence_pattern: recurring ? recurrencePattern : null,
        reminder_minutes: reminderMinutes,
        due_date_offset_minutes: dueDateOffsetMinutes,
        subtasks,
    });
    return NextResponse.json(template, { status: 201 });
}