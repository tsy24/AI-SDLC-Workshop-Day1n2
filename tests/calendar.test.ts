import test from 'node:test';
import assert from 'node:assert/strict';

import { generateCalendarGrid } from '../lib/calendar';
import { formatSingaporeDate, getSingaporeNow } from '../lib/timezone';

test('calendar grids always contain six complete weeks', () => {
    const grid = generateCalendarGrid(2026, 9);

    assert.equal(grid.length, 42);
    assert.equal(grid.filter((day) => day.isCurrentMonth).length, 30);
    assert.equal(grid.filter((day) => day.isWeekend).length, 12);
});

test('leap-year February includes February 29 and adjacent dates', () => {
    const grid = generateCalendarGrid(2028, 2);
    const currentMonthDates = grid.filter((day) => day.isCurrentMonth).map((day) => day.date);

    assert.equal(currentMonthDates.length, 29);
    assert.ok(currentMonthDates.includes('2028-02-29'));
    assert.equal(grid[0].date, '2028-01-30');
    assert.equal(grid.at(-1)?.date, '2028-03-11');
});

test('month grids preserve weekday boundaries', () => {
    const sundayStart = generateCalendarGrid(2023, 1);
    const saturdayStart = generateCalendarGrid(2023, 4);

    assert.equal(sundayStart[0].date, '2023-01-01');
    assert.equal(sundayStart.filter((day) => day.isCurrentMonth).length, 31);
    assert.equal(saturdayStart[0].date, '2023-03-26');
    assert.equal(saturdayStart.filter((day) => day.isCurrentMonth).length, 30);
});

test('current Singapore date is marked exactly once in its month grid', () => {
    const now = getSingaporeNow();
    const currentDate = formatSingaporeDate(now, 'yyyy-MM-dd');
    const year = Number(currentDate.slice(0, 4));
    const month = Number(currentDate.slice(5, 7));
    const grid = generateCalendarGrid(year, month);
    const todayCells = grid.filter((day) => day.isToday);

    assert.equal(todayCells.length, 1);
    assert.equal(todayCells[0].date, currentDate);
    assert.equal(todayCells[0].isPast, false);
});
