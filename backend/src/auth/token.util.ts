import { createHmac } from 'crypto';

const SECRET = process.env.WEB_ENTRY_SECRET || 'default-secret-change-in-production';
const SEP = '.';

// URL-safe base64 encoding (like JWT does)
function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padding = str.length % 4;
  if (padding) {
    str += '='.repeat(4 - padding);
  }
  return Buffer.from(str, 'base64').toString('utf8');
}

export function signPayload(payload: object, ttlSeconds = 60 * 60 * 24 * 7) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const p = { ...payload, exp: expires };
  const json = JSON.stringify(p);
  const b = base64UrlEncode(json);
  const sig = createHmac('sha256', SECRET).update(b).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `${b}${SEP}${sig}`;
}

export function verifyToken(token: string) {
  try {
    const parts = token.split(SEP);
    
    const [b, sig] = parts;
    if (!b || !sig) return null;
    
    const expect = createHmac('sha256', SECRET).update(b).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    if (expect !== sig) return null;
    
    const json = base64UrlDecode(b);
    const obj = JSON.parse(json);
    
    const now = Math.floor(Date.now() / 1000);
    if (obj.exp && now > obj.exp) return null;
    
    return obj;
  } catch (err: any) {
    return null;
  }
}
