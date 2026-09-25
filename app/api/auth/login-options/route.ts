import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

import { authenticatorDB, challengeDB, userDB } from '@/lib/db';
import { parseUsername } from '@/lib/validation';

export async function POST(request: NextRequest) {
    const { username } = await request.json();
    const trimmed = parseUsername(username);

    if (!trimmed) {
        return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }

    const user = userDB.findByUsername(trimmed);
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const options = await generateAuthenticationOptions({
        rpID: process.env.RP_ID ?? 'localhost',
        allowCredentials: authenticatorDB.findByUserId(user.id).map((authenticator) => ({
            id: authenticator.credential_id,
            type: 'public-key',
        })),
    });
    challengeDB.save(user.username, 'authentication', options.challenge, Date.now() + 5 * 60 * 1000);
    return NextResponse.json(options);
}
