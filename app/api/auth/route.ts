import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, setAuthCookie, clearAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, action } = await req.json();

    if (action === 'logout') {
      await clearAuthCookie();
      return NextResponse.json({ success: true, message: 'Logged out' });
    }

    if (action === 'login') {
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Email and password required' },
          { status: 400 }
        );
      }

      // Verifica credenziali
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

      console.log('=== LOGIN DEBUG ===');
      console.log('Email provided:', email);
      console.log('Email expected:', adminEmail);
      console.log('Hash present:', !!adminPasswordHash);
      console.log('Hash length:', adminPasswordHash?.length);
      console.log('Hash raw value:', JSON.stringify(adminPasswordHash));
      console.log('Hash char codes (first 10):', adminPasswordHash?.split('').slice(0, 10).map(c => c.charCodeAt(0)));


      if (!adminEmail || !adminPasswordHash) {
        console.error('Server config missing:', { hasEmail: !!adminEmail, hasHash: !!adminPasswordHash });
        return NextResponse.json(
          { error: 'Server not configured' },
          { status: 500 }
        );
      }

      // Check email
      if (email !== adminEmail) {
        console.log('Email mismatch:', { provided: email, expected: adminEmail });
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      console.log('Email matched!');

      // Check password
      console.log('Checking password...');
      console.log('Password provided length:', password.length);
      console.log('Hash format check - starts with $2b$10$:', adminPasswordHash.startsWith('$2b$10$'));
      console.log('Hash first 20 chars:', adminPasswordHash.substring(0, 20));
      console.log('Hash last 10 chars:', adminPasswordHash.substring(adminPasswordHash.length - 10));
      
      try {
        console.log('Calling bcrypt.compare...');
        const isValidPassword = await verifyPassword(password, adminPasswordHash);
        console.log('bcrypt.compare returned:', isValidPassword);
        
        if (!isValidPassword) {
          console.log('Password mismatch: bcrypt returned false');
          console.log('This could mean:');
          console.log('1. Wrong password provided');
          console.log('2. Hash is corrupted or truncated');
          console.log('3. Hash contains quotes or special characters');
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }
      } catch (passwordError: any) {
        console.error('Password verification error:', passwordError.message);
        console.error('Error stack:', passwordError.stack);
        return NextResponse.json(
          { error: `Password check error: ${passwordError.message}` },
          { status: 500 }
        );
      }

      console.log('Login successful!');

      // Login successful, set cookie
      await setAuthCookie(email);

      return NextResponse.json({
        success: true,
        message: 'Login successful',
        email
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
