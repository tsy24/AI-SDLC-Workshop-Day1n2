'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then((response) => {
      if (response.ok) router.replace('/');
    });
  }, [router]);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
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
    try {
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
    try {
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
    <main style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
      <h1>Login</h1>
      <form onSubmit={handleRegister}>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Username"
          style={{ width: '100%', padding: 10, marginBottom: 12 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit">Register with passkey</button>
          <button type="button" onClick={handleLogin}>Login with passkey</button>
        </div>
      </form>
      {message ? <p>{message}</p> : null}
    </main>
  );
}
