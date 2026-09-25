import { db } from '../lib/db';

const holidays = [
    ['2025-01-01', "New Year's Day"],
    ['2025-01-29', 'Chinese New Year'],
    ['2025-01-30', 'Chinese New Year'],
    ['2025-03-31', 'Hari Raya Puasa'],
    ['2025-04-18', 'Good Friday'],
    ['2025-05-01', 'Labour Day'],
    ['2025-05-12', 'Vesak Day'],
    ['2025-06-07', 'Hari Raya Haji'],
    ['2025-08-09', 'National Day'],
    ['2025-10-20', 'Deepavali'],
    ['2025-12-25', 'Christmas Day'],
    ['2026-01-01', "New Year's Day"],
    ['2026-02-17', 'Chinese New Year'],
    ['2026-02-18', 'Chinese New Year'],
    ['2026-03-21', 'Hari Raya Puasa'],
    ['2026-04-03', 'Good Friday'],
    ['2026-05-01', 'Labour Day'],
    ['2026-05-27', 'Hari Raya Haji'],
    ['2026-05-31', 'Vesak Day'],
    ['2026-08-09', 'National Day'],
    ['2026-11-08', 'Deepavali'],
    ['2026-12-25', 'Christmas Day'],
    ['2027-01-01', "New Year's Day"],
    ['2027-02-06', 'Chinese New Year'],
    ['2027-02-07', 'Chinese New Year'],
    ['2027-03-10', 'Hari Raya Puasa'],
    ['2027-03-26', 'Good Friday'],
    ['2027-05-01', 'Labour Day'],
    ['2027-05-17', 'Hari Raya Haji'],
    ['2027-05-20', 'Vesak Day'],
    ['2027-08-09', 'National Day'],
    ['2027-10-29', 'Deepavali'],
    ['2027-12-25', 'Christmas Day'],
] as const;

const insertHoliday = db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)');
const seed = db.transaction(() => {
    for (const holiday of holidays) insertHoliday.run(...holiday);
});

seed();
