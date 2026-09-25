import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';

import { createSession } from '@/lib/auth';
import { authenticatorDB, challengeDB, userDB } from '@/lib/db';
import { getWebAuthnConfig } from '@/lib/config';
import { readJsonObject } from '@/lib/request';
import { parseUsername } from '@/lib/validation';

export async function POST(request: NextRequest) {
    const body = await readJsonObject(request);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { username, response } = body;
    const trimmed = parseUsername(username);

    if (!trimmed) {
        return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }

    if (!response || typeof response !== 'object') {
        return NextResponse.json({ error: 'Authenticator response is required' }, { status: 400 });
    }

    const expectedChallenge = challengeDB.find(trimmed, 'registration');
    if (!expectedChallenge) {
        return NextResponse.json({ error: 'Registration challenge expired' }, { status: 401 });
    }

    const { rpId, rpOrigin } = getWebAuthnConfig();
    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: response as Parameters<typeof verifyRegistrationResponse>[0]['response'],
            expectedChallenge,
            expectedOrigin: rpOrigin,
            expectedRPID: rpId,
        });
    } catch {
        return NextResponse.json({ error: 'Registration verification failed' }, { status: 401 });
    }
    if (!verification.verified || !verification.registrationInfo) {
        return NextResponse.json({ error: 'Registration verification failed' }, { status: 401 });
    }
    challengeDB.delete(trimmed, 'registration');

    const existing = userDB.findByUsername(trimmed);
    if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    const user = userDB.create(trimmed);
    const { credential } = verification.registrationInfo;
    authenticatorDB.create(user.id, credential.id, Buffer.from(credential.publicKey), credential.counter ?? 0);
    await createSession(user);

    return NextResponse.json({ success: true, user });
}
