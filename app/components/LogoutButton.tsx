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
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
      setChecking(false);
    });

    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
      setChecking(false);
    }).catch(() => {
      setIsLoggedIn(false);
      setChecking(false);
    });

    return () => subscription?.unsubscribe();
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
        className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
      >
        Logout
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowLogin(true)}
        className="rounded-lg bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 hover:text-white sm:px-3 sm:py-2 sm:text-sm"
      >
        Login
      </button>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
