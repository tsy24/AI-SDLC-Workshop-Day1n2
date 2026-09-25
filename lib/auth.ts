import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export interface Session {
    userId: number;
    username: string;
}

export interface UserRecord {
    id: number;
    username: string;
    created_at: string;
}

const SESSION_COOKIE = 'session';
const configuredSecret = process.env.JWT_SECRET;
if (!configuredSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
}
const secret = new TextEncoder().encode(configuredSecret ?? 'dev-secret-change-me');

export async function createSession(user: UserRecord): Promise<void> {
    const token = await new SignJWT({
        userId: user.id,
        username: user.username,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(secret);

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
}

export async function getSession(): Promise<Session | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (!token) {
        return null;
    }

    try {
        const { payload } = await jwtVerify(token, secret);

        if (typeof payload.userId !== 'number' || typeof payload.username !== 'string') {
            return null;
        }

        return {
            userId: Number(payload.userId),
            username: payload.username,
        };
    } catch {
        return null;
    }
}

export async function deleteSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE);
}
