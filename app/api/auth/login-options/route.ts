import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';

import { authenticatorDB, challengeDB, userDB } from '@/lib/db';
import { getWebAuthnConfig } from '@/lib/config';
import { readJsonObject } from '@/lib/request';
import { parseUsername } from '@/lib/validation';

export async function POST(request: NextRequest) {
    const body = await readJsonObject(request);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const { username } = body;
    const trimmed = parseUsername(username);

    if (!trimmed) {
        return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
    }

    const user = userDB.findByUsername(trimmed);
    if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { rpId } = getWebAuthnConfig();
    const options = await generateAuthenticationOptions({
        rpID: rpId,
        allowCredentials: authenticatorDB.findByUserId(user.id).map((authenticator) => ({
            id: authenticator.credential_id,
            type: 'public-key',
        })),
    });
    challengeDB.save(user.username, 'authentication', options.challenge, Date.now() + 5 * 60 * 1000);
    return NextResponse.json(options);
}
