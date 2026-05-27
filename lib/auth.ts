import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const SECRET_KEY = process.env.SECRET_KEY || 'default-secret-key-change-me-in-production';
const JWT_EXPIRE = '7d';

// Derive a 32-byte key from the SECRET_KEY for AES-256
const ENCRYPTION_KEY = crypto.createHash('sha256').update(SECRET_KEY).digest();
const IV_LENGTH = 12; // For AES-GCM

export function encryptToken(token: string): string {
  if (!token) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Token encryption failed:', error);
    return '';
  }
}

export function decryptToken(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) {
      // Not in our Node.js AES-GCM format (might be legacy Python Fernet token)
      console.warn('Legacy token format or invalid encryption format. Re-authentication required.');
      return null;
    }
    
    const [ivHex, authTagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Token decryption failed:', error);
    return null;
  }
}

export function signSession(user: { id: number; github_id: number; username: string; avatar?: string; name?: string; email?: string }): string {
  return jwt.sign(
    { 
      db_id: user.id, 
      id: user.github_id, 
      username: user.username,
      avatar: user.avatar,
      name: user.name,
      email: user.email
    },
    SECRET_KEY,
    { expiresIn: JWT_EXPIRE }
  );
}

export function verifySession(token: string): any | null {
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (error) {
    return null;
  }
}
