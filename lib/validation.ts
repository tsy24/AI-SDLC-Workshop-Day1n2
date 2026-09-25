import type { Priority, RecurrencePattern, ReminderMinutes } from '@/lib/db';
import { parseSingaporeDate } from '@/lib/timezone';

const priorities: Priority[] = ['high', 'medium', 'low'];
const maximumTemplateDueDateOffsetMinutes = 52_560_000;
const maximumJsonBodyBytes = 1_000_000;

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class RequestBodyTooLargeError extends Error {}

export async function parseJsonObjectBody(request: Request): Promise<Record<string, unknown> | undefined> {
    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > maximumJsonBodyBytes) throw new RequestBodyTooLargeError();
    if (!request.body) return undefined;

    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let text = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maximumJsonBodyBytes) {
            await reader.cancel();
            throw new RequestBodyTooLargeError();
        }
        text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    try {
        const payload: unknown = JSON.parse(text);
        return isRecord(payload) ? payload : undefined;
    } catch {
        return undefined;
    }
}

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

export function parseTemplateName(value: unknown): string | null {
    return parseTodoTitle(value);
}

export function parseOptionalTemplateText(value: unknown, maximumLength: number): string | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') return undefined;
    const text = value.trim();
    return text.length <= maximumLength ? text || null : undefined;
}

export function parseDueDateOffsetMinutes(value: unknown): number | null | undefined {
    if (value === undefined || value === null || value === '') return null;
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= maximumTemplateDueDateOffsetMinutes
        ? value
        : undefined;
}

export function parseTemplateSubtasks(value: unknown): Array<{ title: string; position: number }> | undefined {
    if (!Array.isArray(value)) return undefined;
    const subtasks = value.map((subtask, position) => {
        if (!subtask || typeof subtask !== 'object') return null;
        const title = parseSubtaskTitle((subtask as Record<string, unknown>).title);
        return title ? { title, position } : null;
    });
    return subtasks.every((subtask) => subtask !== null)
        ? subtasks as Array<{ title: string; position: number }>
        : undefined;
}

    export function parseStoredTemplateSubtasks(value: unknown): Array<{ title: string; position: number }> | undefined {
        if (!Array.isArray(value)) return undefined;
        const subtasks = value.map((subtask) => {
            if (!isRecord(subtask)) return null;
            const title = parseSubtaskTitle(subtask.title);
            const position = subtask.position;
            return title && typeof position === 'number' && Number.isSafeInteger(position) && position >= 0
                ? { title, position }
                : null;
        });
        return subtasks.every((subtask) => subtask !== null)
            ? subtasks as Array<{ title: string; position: number }>
            : undefined;
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
