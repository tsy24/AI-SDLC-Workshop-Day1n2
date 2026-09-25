import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { templateDB } from '@/lib/db';
import {
    parseDueDateOffsetMinutes,
    parseJsonObjectBody,
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

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const existing = id ? templateDB.findById(id, session.userId) : undefined;
    if (!existing) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

    let body: Record<string, unknown>;
    try {
            const payload = await parseJsonObjectBody(request);
            if (!payload) return NextResponse.json({ error: 'JSON body must be an object' }, { status: 400 });
            body = payload;
        } catch (error) {
            if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: 'Request body is too large' }, { status: 413 });
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const update: Parameters<typeof templateDB.update>[2] = {};
    if (Object.hasOwn(body, 'name')) {
        const name = parseTemplateName(body.name);
        if (!name) return NextResponse.json({ error: 'Template name is required and must be 500 characters or fewer' }, { status: 400 });
        update.name = name;
    }
    if (Object.hasOwn(body, 'title_template')) {
        const title = parseTodoTitle(body.title_template);
        if (!title) return NextResponse.json({ error: 'Todo title is required and must be 500 characters or fewer' }, { status: 400 });
        update.title_template = title;
    }
    if (Object.hasOwn(body, 'description')) {
        const description = parseOptionalTemplateText(body.description, 2_000);
        if (description === undefined) return NextResponse.json({ error: 'Invalid template description' }, { status: 400 });
        update.description = description;
    }
    if (Object.hasOwn(body, 'category')) {
        const category = parseOptionalTemplateText(body.category, 100);
        if (category === undefined) return NextResponse.json({ error: 'Invalid template category' }, { status: 400 });
        update.category = category;
    }
    if (Object.hasOwn(body, 'priority')) {
        const priority = parsePriority(body.priority);
        if (!priority) return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 });
        update.priority = priority;
    }
    if (Object.hasOwn(body, 'is_recurring')) {
        const recurring = parseRecurring(body.is_recurring);
        if (recurring === null) return NextResponse.json({ error: 'is_recurring must be boolean' }, { status: 400 });
        update.is_recurring = recurring;
        if (!recurring) update.recurrence_pattern = null;
    }
    if (Object.hasOwn(body, 'recurrence_pattern')) {
        if (body.recurrence_pattern === null) {
            update.recurrence_pattern = null;
        } else {
            const recurrencePattern = parseRecurrencePattern(body.recurrence_pattern);
            if (!recurrencePattern) return NextResponse.json({ error: 'Invalid recurrence pattern' }, { status: 400 });
            update.recurrence_pattern = recurrencePattern;
        }
    }
    if (Object.hasOwn(body, 'reminder_minutes')) {
        const reminderMinutes = parseReminderMinutes(body.reminder_minutes);
        if (reminderMinutes === undefined) return NextResponse.json({ error: 'Invalid reminder interval' }, { status: 400 });
        update.reminder_minutes = reminderMinutes;
    }
    if (Object.hasOwn(body, 'due_date_offset_minutes')) {
        const offset = parseDueDateOffsetMinutes(body.due_date_offset_minutes);
        if (offset === undefined) return NextResponse.json({ error: 'Due date offset must be a positive whole number of minutes' }, { status: 400 });
        update.due_date_offset_minutes = offset;
    }
    if (Object.hasOwn(body, 'subtasks')) {
        const subtasks = parseTemplateSubtasks(body.subtasks);
        if (!subtasks) return NextResponse.json({ error: 'Subtasks must contain valid titles' }, { status: 400 });
        update.subtasks = subtasks;
    }

    const recurring = update.is_recurring ?? existing.is_recurring;
    if (!recurring) update.recurrence_pattern = null;
    const recurrencePattern = update.recurrence_pattern === undefined ? existing.recurrence_pattern : update.recurrence_pattern;
    const reminderMinutes = update.reminder_minutes === undefined ? existing.reminder_minutes : update.reminder_minutes;
    const dueDateOffsetMinutes = update.due_date_offset_minutes === undefined ? existing.due_date_offset_minutes : update.due_date_offset_minutes;
    if (recurring && !recurrencePattern) return NextResponse.json({ error: 'Recurring templates require a recurrence pattern' }, { status: 400 });
    if (recurring && dueDateOffsetMinutes === null) return NextResponse.json({ error: 'Recurring templates require a due date offset' }, { status: 400 });
    if (reminderMinutes !== null && dueDateOffsetMinutes === null) return NextResponse.json({ error: 'Reminder templates require a due date offset' }, { status: 400 });

    return NextResponse.json(templateDB.update(id as number, session.userId, update));
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    if (!id || !templateDB.delete(id, session.userId)) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    return NextResponse.json({ success: true });
}