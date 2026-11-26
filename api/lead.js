const { redis, hasDb, body, dk } = require('./_lib');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const b = body(req);
  const clean = (s) => String(s || '').replace(/[<>]/g, '').slice(0, 300);
  const n = clean(b.n), pj = clean(b.pj), d = clean(b.d);
  const p = clean(b.p).replace(/\D/g, '').slice(-10);
  if (!n || p.length !== 10) return res.status(400).json({ ok: false, error: 'invalid' });
  if (process.env.TURNSTILE_SECRET) {
    const t = String(b.ts || '').slice(0, 2100);
    if (!t) return res.status(400).json({ ok: false, error: 'spam check' });
    try {
      const v = await (await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: t }) })).json();
      if (!v.success) return res.status(400).json({ ok: false, error: 'spam check' });
    } catch (e) { return res.status(502).json({ ok: false }); }
  }
  if (hasDb()) {
    try {
      await redis(['LPUSH', dk('leads'), JSON.stringify({ id: 'L' + Date.now(), n, p, pj: pj + (b.src ? ' [' + clean(b.src) + ']' : ''), d })]);
      await redis(['LTRIM', dk('leads'), 0, 999]);
    } catch (e) { console.error('lead store failed'); }
  }
  const key = process.env.RESEND_API_KEY, to = process.env.LEAD_TO_EMAIL;
  if (!key || !to) return res.status(200).json({ ok: true, email: false });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.LEAD_FROM_EMAIL || 'onboarding@resend.dev', to: [to], subject: 'New lead: ' + n + ' - ' + pj, text: 'Name: ' + n + '\nPhone: ' + p + '\nProject: ' + pj + '\nDate: ' + d + '\nSource: ' + clean(b.src) })
  });
  return res.status(200).json({ ok: true, email: r.ok });
};
