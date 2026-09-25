import { z } from 'zod';

import type { RecurrencePattern, Tag, Todo, Subtask } from './db';

export interface TodoExportItem
    extends Omit<Todo, 'id' | 'user_id' | 'updated_at' | 'last_notification_sent'> {
    subtasks: Array<Omit<Subtask, 'id' | 'todo_id' | 'created_at'>>;
    tags: Array<Pick<Tag, 'name' | 'color'>>;
}

export interface TodoExport {
    version: 1;
    exported_at: string;
    todos: TodoExportItem[];
}

export interface ImportResult {
    imported: number;
    tagsCreated: number;
    tagsReused: number;
}

export interface TodoWithRelations extends Todo {
    subtasks: Subtask[];
    tags: Tag[];
}

const reminderSchema = z.union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(120),
    z.literal(1440),
    z.literal(2880),
    z.literal(10080),
]);

function isStrictIsoDateTime(value: string): boolean {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/.exec(value);
    if (!match) return false;
    const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', offsetHourText, offsetMinuteText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const second = Number(secondText);
    const offsetHour = Number(offsetHourText ?? 0);
    const offsetMinute = Number(offsetMinuteText ?? 0);
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1
        && month >= 1 && month <= 12
        && day >= 1 && day <= daysInMonth[month - 1]
        && hour <= 23 && minute <= 59 && second <= 59
        && offsetHour <= 23 && offsetMinute <= 59;
}

const strictDateSchema = z.string().refine(
    isStrictIsoDateTime,
    { message: 'Invalid date' },
);
const optionalDateSchema = strictDateSchema.nullable();

const todoImportSchema = z.object({
    title: z.string().trim().min(1),
    completed: z.boolean(),
    due_date: optionalDateSchema,
    priority: z.enum(['high', 'medium', 'low']),
    is_recurring: z.boolean(),
    recurrence_pattern: z.enum(['daily', 'weekly', 'monthly', 'yearly']).nullable(),
    reminder_minutes: reminderSchema.nullable(),
    created_at: z.string().min(1),
    subtasks: z.array(z.object({
        title: z.string().trim().min(1),
        completed: z.boolean(),
        position: z.number().int(),
    })),
    tags: z.array(z.object({
        name: z.string().trim().min(1),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    })),
}).superRefine((todo, context) => {
    if (todo.is_recurring && (!todo.due_date || !todo.recurrence_pattern)) {
        context.addIssue({ code: 'custom', message: 'Recurring todos require a due date and pattern' });
    }
    if (!todo.is_recurring && todo.recurrence_pattern !== null) {
        context.addIssue({ code: 'custom', message: 'Non-recurring todos cannot have a recurrence pattern' });
    }
    if (todo.reminder_minutes !== null && !todo.due_date) {
        context.addIssue({ code: 'custom', message: 'Reminders require a due date' });
    }
});

export const importSchema = z.object({
    version: z.literal(1),
    exported_at: strictDateSchema,
    todos: z.array(todoImportSchema),
});

export function toExportItem(todo: TodoWithRelations): TodoExportItem {
    return {
        title: todo.title,
        completed: todo.completed,
        due_date: todo.due_date,
        priority: todo.priority,
        is_recurring: todo.is_recurring,
        recurrence_pattern: todo.recurrence_pattern,
        reminder_minutes: todo.reminder_minutes,
        created_at: todo.created_at,
        subtasks: todo.subtasks.map(({ title, completed, position }) => ({ title, completed, position })),
        tags: todo.tags.map(({ name, color }) => ({ name, color })),
    };
}

type CsvTodo = Pick<
    Todo,
    'id' | 'title' | 'completed' | 'due_date' | 'priority' | 'is_recurring' | 'recurrence_pattern' | 'reminder_minutes'
>;

function escapeCsv(value: string | number | boolean | null): string {
    const text = value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(todos: CsvTodo[]): string {
    const header = 'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder';
    const rows = todos.map((todo) => [
        todo.id,
        todo.title,
        todo.completed,
        todo.due_date,
        todo.priority,
        todo.is_recurring,
        todo.recurrence_pattern,
        todo.reminder_minutes,
    ].map(escapeCsv).join(','));
    return [header, ...rows].join('\r\n');
}

export type ValidatedTodoExportItem = z.infer<typeof todoImportSchema> & {
    recurrence_pattern: RecurrencePattern | null;
};