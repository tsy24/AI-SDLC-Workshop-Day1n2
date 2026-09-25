'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        void fetch('/api/auth/me')
            .then((response) => {
                if (response.ok) router.replace('/');
            })
            .catch(() => undefined);
    }, [router]);

    async function handleRegister(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage('');
        try {
            const response = await fetch('/api/auth/register-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const options = await response.json();
            if (!response.ok) {
                setMessage(options.error ?? 'Unable to register');
                return;
            }
            const credential = await startRegistration({ optionsJSON: options });
            const verification = await fetch('/api/auth/register-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, response: credential }),
            });
            if (!verification.ok) throw new Error((await verification.json()).error ?? 'Registration failed');
            router.replace('/');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Registration cancelled');
        }
    }

    async function handleLogin() {
        setMessage('');
        try {
            const response = await fetch('/api/auth/login-options', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const options = await response.json();
            if (!response.ok) {
                setMessage(options.error ?? 'Unable to log in');
                return;
            }
            const credential = await startAuthentication({ optionsJSON: options });
            const verification = await fetch('/api/auth/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, response: credential }),
            });
            if (!verification.ok) throw new Error((await verification.json()).error ?? 'Login failed');
            router.replace('/');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Login cancelled');
        }
    }

    return (
        <main className="auth-shell">
            <div className="auth-card">
                <p className="eyebrow">Todo App · Singapore time</p>
                <h1>Keep your focus close.</h1>
                <p className="auth-copy">Use a passkey to enter your personal command center. No passwords to remember.</p>
                <form onSubmit={handleRegister}>
                    <input
                        value={username}
                        onChange={(event) => setUsername(event.target.value)}
                        placeholder="Username"
                        style={{ width: '100%', padding: 10, marginBottom: 12 }}
                    />
                    <div className="auth-actions" style={{ display: 'flex', gap: 8 }}>
                        <button className="primary-button" type="submit">Create passkey</button>
                        <button className="secondary-button" type="button" onClick={handleLogin}>Use existing passkey</button>
                    </div>
                </form>
                {message ? <p className="error-banner" role="alert">{message}</p> : null}
            </div>
        </main>
    );
}
