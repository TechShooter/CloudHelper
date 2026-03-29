import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = (process.env.JWT_SECRET || 'default-secret-change-in-production') as string;
const COOKIE_NAME = 'auth-token';

interface TokenPayload {
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(email: string, expiresIn: string | number = '7d'): string {
  const payload = { email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as any);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Set auth cookie (server-side)
 */
export async function setAuthCookie(email: string): Promise<string> {
  const { cookies } = await import('next/headers');
  const token = generateToken(email);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  return token;
}

/**
 * Clear auth cookie (server-side)
 */
export async function clearAuthCookie(): Promise<void> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Get token from cookies (server-side)
 */
export async function getAuthToken(): Promise<string | null> {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME);
  return token?.value || null;
}

/**
 * Get current user from token in cookies
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}
