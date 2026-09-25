import type { Priority } from '@/lib/db';
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

export function parseSubtaskTitle(value: unknown): string | null {
    return parseTodoTitle(value);
}

export function parsePriority(value: unknown): Priority | null {
    return typeof value === 'string' && priorities.includes(value as Priority)
        ? value as Priority
        : null;
}

export function parseOptionalDueDate(value: unknown): string | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return undefined;
    const date = parseSingaporeDate(value);
    return Number.isNaN(date.getTime()) ? undefined : value;
}

export function isDueDateAtLeastOneMinuteAway(value: string | null): boolean {
    return value === null || parseSingaporeDate(value).getTime() >= Date.now() + 60_000;
}
