import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { type ReminderMinutes, type TemplateSubtask, subtaskDB, templateDB, todoDB } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';
import { parseDueDateOffsetMinutes, parsePriority, parseRecurrencePattern, parseReminderMinutes, parseStoredTemplateSubtasks, parseTodoTitle } from '@/lib/validation';

function parseId(value: string): number | null {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const id = parseId((await params).id);
    const template = id ? templateDB.findById(id, session.userId) : undefined;
    if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

        const title = parseTodoTitle(template.title_template);
        const priority = parsePriority(template.priority);
        const recurrencePattern = template.recurrence_pattern === null ? null : parseRecurrencePattern(template.recurrence_pattern);
        const reminderMinutes = parseReminderMinutes(template.reminder_minutes);
        const dueDateOffsetMinutes = parseDueDateOffsetMinutes(template.due_date_offset_minutes);
        if (!title || !priority || reminderMinutes === undefined || dueDateOffsetMinutes === undefined) {
            return NextResponse.json({ error: 'Template contains invalid data' }, { status: 422 });
        }
        if (template.is_recurring && (!recurrencePattern || dueDateOffsetMinutes === null)) {
            return NextResponse.json({ error: 'Template contains invalid recurrence data' }, { status: 422 });
        }
        if (reminderMinutes !== null && dueDateOffsetMinutes === null) {
            return NextResponse.json({ error: 'Template contains an invalid reminder' }, { status: 422 });
        }

    let subtasks: TemplateSubtask[] = [];
    if (template.subtasks_json) {
        try {
                subtasks = parseStoredTemplateSubtasks(JSON.parse(template.subtasks_json)) ?? [];
        } catch {
            subtasks = [];
        }
    }
    const dueDateValue = dueDateOffsetMinutes === null
        ? null
        : new Date(getSingaporeNow().getTime() + dueDateOffsetMinutes * 60_000);
    if (dueDateValue !== null && Number.isNaN(dueDateValue.getTime())) {
        return NextResponse.json({ error: 'Template has an invalid due date offset' }, { status: 422 });
    }
    const dueDate = dueDateValue?.toISOString() ?? null;
    const todo = todoDB.createWithSubtasks({
        user_id: session.userId,
           title,
        due_date: dueDate,
           priority,
        is_recurring: template.is_recurring,
           recurrence_pattern: template.is_recurring ? recurrencePattern : null,
           reminder_minutes: reminderMinutes as ReminderMinutes | null,
    }, subtasks);
    return NextResponse.json({ todo, subtasks: subtaskDB.findByTodoId(todo.id) }, { status: 201 });
}