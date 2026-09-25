export function getSingaporeNow(): Date {
    return new Date();
}

export function formatSingaporeDate(date: Date | string, pattern = 'yyyy-MM-dd HH:mm:ss'): string {
    const current = typeof date === 'string' ? parseSingaporeDate(date) : date;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Singapore',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(current).reduce<Record<string, string>>((values, part) => {
        values[part.type] = part.value;
        return values;
    }, {});

    return pattern
        .replace(/yyyy/g, parts.year)
        .replace(/MM/g, parts.month)
        .replace(/dd/g, parts.day)
        .replace(/HH/g, parts.hour)
        .replace(/mm/g, parts.minute)
        .replace(/ss/g, parts.second);
}

export function parseSingaporeDate(value: string): Date {
    const singaporeLocalValue = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)
        ? `${value.length === 16 ? `${value}:00` : value}+08:00`
        : value;
    return new Date(singaporeLocalValue);
}
