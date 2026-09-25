export function getSingaporeNow(): Date {
    const now = new Date();
    const singaporeOffsetMinutes = 8 * 60;
    const localOffsetMinutes = now.getTimezoneOffset();
    return new Date(now.getTime() + (singaporeOffsetMinutes + localOffsetMinutes) * 60_000);
}

export function formatSingaporeDate(date: Date | string, pattern = 'yyyy-MM-dd HH:mm:ss'): string {
    const current = typeof date === 'string' ? new Date(date) : date;
    const singaporeDate = new Date(
        current.getTime() + (8 * 60 - current.getTimezoneOffset()) * 60_000,
    );

    const year = singaporeDate.getFullYear();
    const month = String(singaporeDate.getMonth() + 1).padStart(2, '0');
    const day = String(singaporeDate.getDate()).padStart(2, '0');
    const hours = String(singaporeDate.getHours()).padStart(2, '0');
    const minutes = String(singaporeDate.getMinutes()).padStart(2, '0');
    const seconds = String(singaporeDate.getSeconds()).padStart(2, '0');

    return pattern
        .replace(/yyyy/g, String(year))
        .replace(/MM/g, month)
        .replace(/dd/g, day)
        .replace(/HH/g, hours)
        .replace(/mm/g, minutes)
        .replace(/ss/g, seconds);
}
