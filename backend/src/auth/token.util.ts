import { createHmac } from 'crypto';

const SECRET = process.env.WEB_ENTRY_SECRET || 'change_this_secret';
const SEP = '.';

export function signPayload(payload: object, ttlSeconds = 60 * 60 * 24 * 7) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const p = { ...payload, exp: expires };
  const json = JSON.stringify(p);
  const b = Buffer.from(json).toString('base64');
  const sig = createHmac('sha256', SECRET).update(b).digest('base64');
  return `${b}${SEP}${sig}`;
}

export function verifyToken(token: string) {
  try {
    const [b, sig] = token.split(SEP);
    if (!b || !sig) return null;
    const expect = createHmac('sha256', SECRET).update(b).digest('base64');
    if (expect !== sig) return null;
    const json = Buffer.from(b, 'base64').toString('utf8');
    const obj = JSON.parse(json);
    if (obj.exp && Math.floor(Date.now() / 1000) > obj.exp) return null;
    return obj;
  } catch (err) {
    return null;
  }
}
