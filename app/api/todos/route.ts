import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { todoDB } from '@/lib/db';
import { isDueDateAtLeastOneMinuteAway, parseOptionalDueDate, parsePriority, parseTodoTitle } from '@/lib/validation';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  return NextResponse.json(todoDB.findAllByUser(session.userId));
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const title = parseTodoTitle(body.title);
  const dueDate = parseOptionalDueDate(body.due_date);
  const priority = body.priority === undefined ? 'medium' : parsePriority(body.priority);

  if (!title) return NextResponse.json({ error: 'Title is required and must be 500 characters or fewer' }, { status: 400 });
  if (dueDate === undefined) return NextResponse.json({ error: 'Due date must be a valid ISO date' }, { status: 400 });
  if (!priority) return NextResponse.json({ error: 'Priority must be high, medium, or low' }, { status: 400 });
  if (!isDueDateAtLeastOneMinuteAway(dueDate)) {
    return NextResponse.json({ error: 'Due date must be at least 1 minute in the future' }, { status: 400 });
  }

  return NextResponse.json(todoDB.create({
    user_id: session.userId,
    title,
    due_date: dueDate,
    priority,
  }), { status: 201 });
}
