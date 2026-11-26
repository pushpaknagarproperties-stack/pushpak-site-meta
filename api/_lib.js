const crypto = require('crypto');
// Finds the database keys even if Vercel added a custom prefix to their names.
const pick = (re, ex) => { const k = Object.keys(process.env).find((n) => re.test(n) && !(ex && ex.test(n))); return k ? process.env[k] : undefined; };
const URL_ = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || pick(/REST_API_URL$|REDIS_REST_URL$/);
const TOK = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || pick(/REST_API_TOKEN$|REDIS_REST_TOKEN$/, /READ_ONLY/);
// SAFETY: a Vercel preview (staging) deployment without DB_PREFIX would touch the LIVE data, so it is blocked.
const unsafePreview = () => process.env.VERCEL_ENV === 'preview' && !process.env.DB_PREFIX;
const hasDb = () => !!(URL_() && TOK()) && !unsafePreview();
const prefix = () => String(process.env.DB_PREFIX || '');
const dk = (n) => prefix() + 'pnp:' + n;
async function redis(cmd) {
  if (unsafePreview()) throw new Error('staging needs DB_PREFIX');
  const r = await fetch(URL_(), { method: 'POST', headers: { Authorization: 'Bearer ' + TOK() }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const secret = () => process.env.SESSION_SECRET || '';
const mac = (b) => crypto.createHmac('sha256', secret()).update(b).digest('base64url');
function sign(o) { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); return b + '.' + mac(b); }
function verify(t) {
  if (!t || !secret()) return null;
  const [b, s] = String(t).split('.');
  if (!b || !s) return null;
  const e = mac(b);
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  try { const o = JSON.parse(Buffer.from(b, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch (x) { return null; }
}
function body(req) { let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } return b || {}; }
const clean = (v) => String(v || '').trim().replace(/^["']|["']$/g, '').trim().toLowerCase();
async function getAuth() { if (!hasDb()) return {}; try { const r = await redis(['GET', dk('auth')]); return r ? JSON.parse(r) : {}; } catch (e) { return {}; } }
const hashOf = (p) => crypto.createHash('sha256').update('pnp::' + p).digest('hex');
const sameHash = (x, y) => !!x && !!y && x.length === y.length && crypto.timingSafeEqual(Buffer.from(x), Buffer.from(y));
module.exports = { redis, hasDb, sign, verify, body, crypto, clean, getAuth, hashOf, sameHash, dk, prefix, unsafePreview };
