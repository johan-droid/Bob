import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_EXPIRE = '7d';
const TOKEN_PREFIX = 'v1:';
const FERNET_VERSION = 0x80;

function getSecretKey() {
  const secret = process.env.SECRET_KEY;
  if (!secret || secret === 'default-secret-key-change-me-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SECRET_KEY is required in production');
    }
    return 'dev-only-secret-key-not-for-production';
  }
  return secret;
}

function getEncryptionKey() {
  const tokenSecret = process.env.TOKEN_ENCRYPTION_KEY || getSecretKey();
  return crypto.createHash('sha256').update(tokenSecret).digest();
}

function getFernetKeys() {
  const key = getEncryptionKey();
  return {
    signingKey: key.subarray(0, 16),
    encryptionKey: key.subarray(16, 32),
  };
}

function toUrlSafeBase64(buffer: Buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromUrlSafeBase64(value: string) {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function encryptFernetToken(token: string) {
  const { signingKey, encryptionKey } = getFernetKeys();
  const version = Buffer.from([FERNET_VERSION]);
  const timestamp = Buffer.alloc(8);
  timestamp.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const signedPayload = Buffer.concat([version, timestamp, iv, ciphertext]);
  const signature = crypto.createHmac('sha256', signingKey).update(signedPayload).digest();
  return TOKEN_PREFIX + toUrlSafeBase64(Buffer.concat([signedPayload, signature]));
}

function decryptFernetToken(encrypted: string) {
  const { signingKey, encryptionKey } = getFernetKeys();
  const raw = fromUrlSafeBase64(encrypted.slice(TOKEN_PREFIX.length));
  if (raw.length < 1 + 8 + 16 + 32 || raw[0] !== FERNET_VERSION) {
    return null;
  }

  const signedPayload = raw.subarray(0, raw.length - 32);
  const signature = raw.subarray(raw.length - 32);
  const expectedSignature = crypto.createHmac('sha256', signingKey).update(signedPayload).digest();
  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(signature, expectedSignature)) {
    return null;
  }

  const iv = raw.subarray(9, 25);
  const ciphertext = raw.subarray(25, raw.length - 32);
  const decipher = crypto.createDecipheriv('aes-128-cbc', encryptionKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function decryptLegacyAesGcmToken(encrypted: string) {
  const parts = encrypted.split(':');
  if (parts.length !== 3) return null;

  const [ivHex, authTagHex, encryptedText] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encryptedText, 'hex', 'utf8') + decipher.final('utf8');
}

export function encryptToken(token: string): string {
  if (!token) return '';
  try {
    return encryptFernetToken(token);
  } catch (error) {
    console.error('Token encryption failed:', error);
    return '';
  }
}

export function decryptToken(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    if (encrypted.startsWith(TOKEN_PREFIX)) {
      return decryptFernetToken(encrypted);
    }

    const legacyToken = decryptLegacyAesGcmToken(encrypted);
    if (legacyToken) {
      console.warn('Using legacy AES-GCM GitHub token from database; re-authenticate user to rewrite it');
    } else {
      console.warn('Refusing legacy plaintext or invalid GitHub token format from database');
    }
    return legacyToken;
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
    getSecretKey(),
    { expiresIn: JWT_EXPIRE }
  );
}

export function verifySession(token: string): any | null {
  if (!token) return null;
  try {
    return jwt.verify(token, getSecretKey());
  } catch (error) {
    return null;
  }
}
