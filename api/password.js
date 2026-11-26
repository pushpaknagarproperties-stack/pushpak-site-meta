const { redis, hasDb, verify, body, clean, getAuth, hashOf, sameHash, dk } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!hasDb()) return res.status(503).json({ ok: false, error: 'database not connected' });
  const s = verify((req.headers.authorization || '').replace('Bearer ', ''));
  const au = await getAuth();
  if (!s || (s.v || 0) !== (au.ver || 0)) return res.status(401).json({ ok: false });
  const b = body(req);
  if (b.action === 'revoke') {
    if (s.role !== 'Super Admin') return res.status(403).json({ ok: false });
    au.ver = Date.now();
    await redis(['SET', dk('auth'), JSON.stringify(au)]);
    return res.status(200).json({ ok: true });
  }
  const acct = b.account === 'editor' ? 'editor' : 'superadmin';
  if (s.role !== 'Super Admin' && !(acct === 'editor' && s.u === 'editor')) return res.status(403).json({ ok: false });
  const cur = clean(au[acct] || (acct === 'superadmin' ? process.env.SUPER_HASH : process.env.EDITOR_HASH));
  const nw = String(b.new || '');
  if (!sameHash(hashOf(String(b.old || '')), cur)) { await new Promise((r) => setTimeout(r, 500)); return res.status(400).json({ ok: false, error: 'old' }); }
  if (nw.length < 10 || nw.length > 100) return res.status(400).json({ ok: false, error: 'short' });
  au[acct] = hashOf(nw);
  au.ver = Date.now();
  await redis(['SET', dk('auth'), JSON.stringify(au)]);
  return res.status(200).json({ ok: true, relogin: true });
};
