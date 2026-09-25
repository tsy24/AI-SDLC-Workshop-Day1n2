import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';

import { challengeDB, userDB } from '@/lib/db';
import { parseUsername } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const { username } = await request.json();
  const trimmed = parseUsername(username);

  if (!trimmed) {
    return NextResponse.json({ error: 'Username must be 3-40 letters, numbers, underscores, or hyphens' }, { status: 400 });
  }

  if (userDB.findByUsername(trimmed)) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
  }

  const options = await generateRegistrationOptions({
    rpName: process.env.RP_NAME ?? 'Todo App',
    rpID: process.env.RP_ID ?? 'localhost',
    userName: trimmed,
    attestationType: 'none',
  });
  challengeDB.save(trimmed, 'registration', options.challenge, Date.now() + 5 * 60 * 1000);
  return NextResponse.json(options);
}
