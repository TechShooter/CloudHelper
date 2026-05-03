'use client';

import { useEffect } from 'react';

export const runtime = 'edge';

export default function Home() {
  useEffect(() => {
    // Dynamic import per caricare Supabase solo quando serve
    const checkAuth = async () => {
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        window.location.href = '/chat';
      } else {
        window.location.href = '/login';
      }
    };
    
    checkAuth();
  }, []);

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#111827'
    }}>
      <div style={{ color: '#9CA3AF' }}>Caricamento...</div>
    </div>
  );
}
