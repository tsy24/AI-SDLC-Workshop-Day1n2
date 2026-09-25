import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { holidayDB } from '@/lib/db';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const yearParam = request.nextUrl.searchParams.get('year');
    const monthParam = request.nextUrl.searchParams.get('month');
    const hasYear = yearParam !== null;
    const hasMonth = monthParam !== null;
    if (hasYear !== hasMonth) return NextResponse.json({ error: 'year and month must be provided together' }, { status: 400 });
    const year = Number(yearParam);
    const month = Number(monthParam);
    if (hasYear && (!Number.isInteger(year) || year < 1900 || year > 2200 || !Number.isInteger(month) || month < 1 || month > 12)) {
        return NextResponse.json({ error: 'Invalid year or month' }, { status: 400 });
    }
    const hasMonthQuery = hasYear && hasMonth;
    return NextResponse.json({ holidays: hasMonthQuery ? holidayDB.findByMonth(year, month) : holidayDB.findAll() });
}