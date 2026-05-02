export const runtime = 'edge';

import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // Redirect immediato server-side a /login se non autenticato
  if (!user) {
    redirect('/login');
  }
  
  // Se autenticato, reindirizza alla chat
  redirect('/chat');
}
