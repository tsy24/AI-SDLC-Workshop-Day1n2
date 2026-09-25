import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { holidayDB } from '@/lib/db';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const year = Number(request.nextUrl.searchParams.get('year'));
    const month = Number(request.nextUrl.searchParams.get('month'));
    const hasMonth = Number.isInteger(year) && year >= 1900 && year <= 2200 && Number.isInteger(month) && month >= 1 && month <= 12;
    return NextResponse.json({ holidays: hasMonth ? holidayDB.findByMonth(year, month) : holidayDB.findAll() });
}