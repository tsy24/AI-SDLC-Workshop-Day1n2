import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

export interface CalendarDay {
    date: string;
    isCurrentMonth: boolean;
    isToday: boolean;
    isPast: boolean;
    isWeekend: boolean;
}

function formatUtcDate(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function generateCalendarGrid(year: number, month: number): CalendarDay[] {
    const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
    const startWeekday = firstOfMonth.getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const today = formatSingaporeDate(getSingaporeNow(), 'yyyy-MM-dd');
    const cells: CalendarDay[] = [];

    for (let index = 0; index < 42; index += 1) {
        const dayOffset = index - startWeekday + 1;
        const date = new Date(Date.UTC(year, month - 1, dayOffset));
        const dateString = formatUtcDate(date);
        const weekday = date.getUTCDay();
        cells.push({
            date: dateString,
            isCurrentMonth: dayOffset >= 1 && dayOffset <= daysInMonth,
            isToday: dateString === today,
            isPast: dateString < today,
            isWeekend: weekday === 0 || weekday === 6,
        });
    }

    return cells;
}