'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.href = '/chat';
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#111827'
    }}>
      <div style={{ color: '#9CA3AF' }}>Redirecting...</div>
    </div>
  );
}
