'use server';

import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verifica autenticazione lato server
  const user = await getCurrentUser();
  
  if (!user) {
    // Se non autenticato, redirect a login
    redirect('/login');
  }

  return children;
}
