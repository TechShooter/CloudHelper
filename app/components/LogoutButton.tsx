'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import LoginModal from './LoginModal';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setIsLoggedIn(!!user);
      } catch {
        setIsLoggedIn(false);
      }
      setChecking(false);
    };
    check();
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setIsLoggedIn(false);
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  if (checking) return null;

  if (isLoggedIn) {
    return (
      <button
        onClick={handleLogout}
        className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
      >
        Logout
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLogin(true)}
        className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Login
      </button>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
