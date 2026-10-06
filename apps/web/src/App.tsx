import { createPortalClient } from '@portal/sdk';
import { useEffect, useState } from 'react';

const api = createPortalClient('/api');

// Milestone 0: proves the web app reaches the API through /api. Sign-in,
// the tap button and the leaderboard arrive in milestones 1 to 3.
export function App() {
  const [status, setStatus] = useState<'checking' | 'up' | 'down'>('checking');

  useEffect(() => {
    api
      .GET('/healthz')
      .then(({ response }) => setStatus(response.ok ? 'up' : 'down'))
      .catch(() => setStatus('down'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 480, margin: '64px auto' }}>
      <h1>Portal</h1>
      <p>API: {status}</p>
    </main>
  );
}
