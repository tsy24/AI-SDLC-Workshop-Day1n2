import type { RecurrencePattern } from '@/lib/db';

interface SingaporeParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
}

function parseParts(value: string): SingaporeParts {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) throw new Error('Invalid Singapore due date');
    return {
        year: Number(match[1]),
        month: Number(match[2]),
        day: Number(match[3]),
        hour: Number(match[4]),
        minute: Number(match[5]),
    };
}

function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatParts(parts: SingaporeParts): string {
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:00+08:00`;
}

function addDays(parts: SingaporeParts, days: number): SingaporeParts {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
    return { ...parts, year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function calculateNextDueDate(currentDueDate: string, pattern: RecurrencePattern): string {
    const current = parseParts(currentDueDate);
    if (pattern === 'daily') return formatParts(addDays(current, 1));
    if (pattern === 'weekly') return formatParts(addDays(current, 7));
    if (pattern === 'monthly') {
        const year = current.month === 12 ? current.year + 1 : current.year;
        const month = current.month === 12 ? 1 : current.month + 1;
        return formatParts({ ...current, year, month, day: Math.min(current.day, daysInMonth(year, month)) });
    }
    const year = current.year + 1;
    return formatParts({ ...current, year, day: Math.min(current.day, daysInMonth(year, current.month)) });
}
