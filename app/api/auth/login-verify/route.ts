import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

import { createSession } from '@/lib/auth';
import { authenticatorDB, challengeDB, userDB } from '@/lib/db';
import { parseUsername } from '@/lib/validation';

export async function POST(request: NextRequest) {
  const { username, response } = await request.json();
  const trimmed = parseUsername(username);

  if (!trimmed) {
    return NextResponse.json({ error: 'Invalid username' }, { status: 400 });
  }

  const user = userDB.findByUsername(trimmed);
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!response || typeof response.id !== 'string') {
    return NextResponse.json({ error: 'Authenticator response is required' }, { status: 400 });
  }
  const authenticator = authenticatorDB.findByCredentialId(response.id);
  if (!authenticator || authenticator.user_id !== user.id) {
    return NextResponse.json({ error: 'Authenticator not recognized' }, { status: 401 });
  }
  const expectedChallenge = challengeDB.find(trimmed, 'authentication');
  if (!expectedChallenge) {
    return NextResponse.json({ error: 'Login challenge expired' }, { status: 401 });
  }
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: process.env.RP_ORIGIN ?? 'http://localhost:3000',
    expectedRPID: process.env.RP_ID ?? 'localhost',
    authenticator: {
      credentialID: isoBase64URL.toBuffer(authenticator.credential_id),
      credentialPublicKey: authenticator.credential_public_key,
      counter: authenticator.counter ?? 0,
    },
  });
  if (!verification.verified) {
    return NextResponse.json({ error: 'Login verification failed' }, { status: 401 });
  }
  challengeDB.delete(trimmed, 'authentication');
  authenticatorDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0);
  await createSession(user);

  return NextResponse.json({ success: true, user });
}
