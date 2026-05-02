import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CloudHelper - Your AI Assistant",
  description: "CloudHelper - Intelligent AI assistant for nutrition tracking, meal planning, and personal goal management",
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/cloudhelper-icon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 0.5,
  maximumScale: 5,
  userScalable: true,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Check auth on server side
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  // If not logged in, this will be handled by client-side check
  // We pass user info to children via headers or context if needed
  
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
