const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { type, text, screenshot, lang, userAgent } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message' });

  const typeLabels = {
    bug: '🐛 Bug Report',
    suggest: '💡 Feature Request',
  };

  const langLabels = { en: 'English', de: 'Deutsch', ru: 'Русский', uk: 'Українська' };

  // Build email via Resend API (free tier: 100 emails/day)
  const resendKey = process.env.RESEND_API_KEY;

  let htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#b8860b">${typeLabels[type] || '📩 Feedback'} — HearingAI</h2>
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:6px;color:#666;width:120px">Language:</td>
            <td style="padding:6px">${langLabels[lang] || lang || '—'}</td></tr>
        <tr><td style="padding:6px;color:#666">Device:</td>
            <td style="padding:6px;font-size:12px">${(userAgent||'').slice(0,80)}</td></tr>
        <tr><td style="padding:6px;color:#666">Time:</td>
            <td style="padding:6px">${new Date().toLocaleString('ru-RU', {timeZone:'Europe/Berlin'})}</td></tr>
      </table>
      <div style="background:#f5f5f5;border-left:4px solid #b8860b;padding:16px;border-radius:4px;white-space:pre-wrap">${text}</div>
      ${screenshot ? `<div style="margin-top:16px"><p style="color:#666;margin-bottom:8px">Screenshot attached:</p><img src="${screenshot}" style="max-width:100%;border-radius:8px;border:1px solid #ddd"/></div>` : ''}
    </div>`;

  if (!resendKey) {
    // Fallback: log to console (visible in Vercel logs)
    console.log('FEEDBACK:', JSON.stringify({ type, lang, text: text.slice(0, 200) }));
    return res.status(200).json({ ok: true, method: 'logged' });
  }

  const emailPayload = JSON.stringify({
    from: 'HearingAI Feedback <feedback@hearingai.app>',
    to: ['alexey.petruchenko@gmail.com'],
    subject: `${typeLabels[type] || 'Feedback'} from HearingAI`,
    html: htmlBody,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendKey}`,
        'Content-Length': Buffer.byteLength(emailPayload),
      },
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log('Resend response:', response.statusCode, data.slice(0, 100));
        res.status(response.statusCode < 300 ? 200 : 500).json(
          response.statusCode < 300 ? { ok: true } : { error: 'Email send failed' }
        );
        resolve();
      });
    });

    request.on('error', (err) => {
      console.error('Email error:', err.message);
      res.status(500).json({ error: err.message });
      resolve();
    });

    request.write(emailPayload);
    request.end();
  });
};
