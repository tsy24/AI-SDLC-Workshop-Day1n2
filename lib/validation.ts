import type { Priority, RecurrencePattern, ReminderMinutes } from '@/lib/db';
import { parseSingaporeDate } from '@/lib/timezone';

const priorities: Priority[] = ['high', 'medium', 'low'];

export function parseUsername(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const username = value.trim();
    return /^[a-zA-Z0-9_-]{3,40}$/.test(username) ? username : null;
}

export function parseTodoTitle(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const title = value.trim();
    return title.length >= 1 && title.length <= 500 ? title : null;
}

export function parsePriority(value: unknown): Priority | null {
    return typeof value === 'string' && priorities.includes(value as Priority)
        ? value as Priority
        : null;
}

export function parseRecurrencePattern(value: unknown): RecurrencePattern | null {
    return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly'
        ? value
        : null;
}

export function parseRecurring(value: unknown): boolean | null {
    return value === undefined ? false : typeof value === 'boolean' ? value : null;
}

export function parseReminderMinutes(value: unknown): ReminderMinutes | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    return [15, 30, 60, 120, 1440, 2880, 10080].includes(value as number)
        ? value as ReminderMinutes
        : undefined;
}

export function parseOptionalDueDate(value: unknown): string | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
    const date = parseSingaporeDate(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
        ? `${value.length === 16 ? `${value}:00` : value}+08:00`
        : value;
}

export function isDueDateAtLeastOneMinuteAway(value: string | null): boolean {
    return value === null || parseSingaporeDate(value).getTime() >= Date.now() + 60_000;
}
