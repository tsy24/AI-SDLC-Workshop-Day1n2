import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function CalendarPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main style={{ padding: 32 }}>
      <h1>Calendar</h1>
      <p>Protected calendar placeholder for Engineer 1.</p>
    </main>
  );
}
