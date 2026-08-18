const { Resend } = require("resend");

const ALLOWED_ORIGINS = [
  "https://liveadaptiv.com",
  "https://sovereign.liveadaptiv.com",
  "http://localhost:3000"
];

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true;
  return false;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// User-supplied text (reality/identity/action/cardTitle/decree, and email
// as a defense-in-depth measure) is interpolated directly into HTML email
// templates below — escape it so markup in a journal entry can't inject
// content into the admin notification or the user's own email.
function escHtml(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function syncToMailerLite(email) {
  const API_KEY = process.env.MAILERLITE_API_KEY;
  const GROUP_ID = '196088983780853464'; // Sovereign Command Center Users

  if (!API_KEY) {
    console.error('MAILERLITE_API_KEY missing — skipping MailerLite sync.');
    return;
  }

  try {
    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        email,
        groups: [GROUP_ID],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('MailerLite sync failed:', res.status, body);
    }
  } catch (err) {
    console.error('MailerLite sync request failed:', err);
  }
}

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";

  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: "Forbidden. Invalid Origin." });
  }
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, decree, reality, identity, action, cardTitle, frictionLevel } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "Valid email required." });
  }

  if (!decree) {
    return res.status(400).json({ error: "Missing decree." });
  }

  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const senderEmail = "Adaptiv <decree@send.liveadaptiv.com>";

  try {
    const [notifyResult, decreeResult] = await Promise.allSettled([
      // ── 1. Notification to Alex ───────────────────────────────────
      resend.emails.send({
      from: senderEmail,
      to: process.env.NOTIFY_EMAIL,
      subject: `New Sovereign Decree — ${email}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:520px;margin:0 auto;color:#1c1917;">
          <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#b2945e;margin-bottom:4px;">
            LiveAdaptiv — New Lead
          </p>
          <h2 style="font-weight:400;font-size:1.4rem;margin-bottom:20px;">Sovereign Command Session</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="border-bottom:1px solid #e7e5e4;">
              <td style="padding:8px 0;color:#78716c;width:120px;">Email</td>
              <td style="padding:8px 0;">${escHtml(email)}</td>
            </tr>
            <tr style="border-bottom:1px solid #e7e5e4;">
              <td style="padding:8px 0;color:#78716c;">Time</td>
              <td style="padding:8px 0;">${escHtml(new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }))} UTC</td>
            </tr>
            <tr>
              <td style="padding:8px 0;color:#78716c;">Protocol</td>
              <td style="padding:8px 0;">${escHtml(cardTitle) || '—'}</td>
            </tr>
          </table>
        </div>
      `
      }),

      // ── 2. Decree delivery to user ────────────────────────────────
      resend.emails.send({
      from: senderEmail,
      to: email,
      subject: "Your Sovereign Decree",
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:Georgia,serif;color:#1c1917;padding:40px 20px;">

          <p style="font-size:10px;font-family:Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#b2945e;margin:0 0 32px 0;">
            LiveAdaptiv — Sovereign Command
          </p>

          <h1 style="font-weight:400;font-size:1.8rem;font-style:italic;margin:0 0 8px 0;line-height:1.2;">
            Your Decree
          </h1>

          <p style="font-size:13px;color:#78716c;margin:0 0 28px 0;font-family:Arial,sans-serif;">
            Forged ${new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </p>

          <div style="background:#f9f8f6;border-left:3px solid #b2945e;padding:24px 28px;border-radius:4px;margin-bottom:32px;">
            <p style="font-style:italic;font-size:1.2rem;line-height:1.7;margin:0;color:#1c1917;">
              ${escHtml(decree)}
            </p>
          </div>

          <div style="border-top:1px solid #e7e5e4;padding-top:24px;margin-bottom:32px;">
            <p style="font-size:12px;color:#a8a29e;line-height:1.6;margin:0;font-family:Arial,sans-serif;">
              <em>Built from:</em><br>
              ${reality ? `Reality: ${escHtml(reality)}<br>` : ''}
              ${identity ? `Identity: ${escHtml(identity)}<br>` : ''}
              ${action ? `Action: ${escHtml(action)}` : ''}
            </p>
          </div>

          <div style="background:#1c1917;border-radius:16px;padding:28px;margin-bottom:32px;">
            <p style="font-size:12px;font-family:Arial,sans-serif;color:#a8a29e;margin:0 0 12px 0;letter-spacing:1px;text-transform:uppercase;">
              What this is
            </p>
            <p style="font-size:14px;color:#e7e5e4;line-height:1.7;margin:0 0 20px 0;font-family:Arial,sans-serif;">
              The Sovereign Command Center is a daily protocol — a 90-second nervous system reset at its center, with a full session available when you have the time. Built for the person who needs architecture, not inspiration.
            </p>
            <a href="https://sovereign.liveadaptiv.com"
              style="display:inline-block;background:#b2945e;color:white;text-decoration:none;padding:12px 24px;border-radius:100px;font-size:10px;font-family:Arial,sans-serif;font-weight:700;letter-spacing:2px;text-transform:uppercase;">
              Return to Sovereign Command →
            </a>
          </div>

          <div style="border:1px solid #e7e5e4;border-radius:12px;padding:20px;margin-bottom:32px;">
            <p style="font-size:12px;font-family:Arial,sans-serif;color:#78716c;margin:0 0 12px 0;line-height:1.6;">
              If the session landed — the Kinetic Blueprint goes one layer deeper. It measures the internal load that precedes the behavioral shift. Three minutes. Free.
            </p>
            <a href="https://blueprint.liveadaptiv.com?utm_source=scc&utm_medium=email&utm_campaign=decree_followup"
              style="font-size:11px;color:#b2945e;font-family:Arial,sans-serif;font-weight:700;letter-spacing:1px;text-transform:uppercase;text-decoration:none;">
              Take the Kinetic Blueprint →
            </a>
          </div>

          <p style="font-size:11px;color:#d4cdc5;font-family:Arial,sans-serif;margin:0;line-height:1.6;">
            LiveAdaptiv — Architecture for the Modern Soul<br>
            <a href="https://liveadaptiv.com" style="color:#b2945e;text-decoration:none;">liveadaptiv.com</a>
          </p>

        </div>
      `
      }),

      // ── 3. Sync to MailerLite (non-blocking; never rejects) ────────
      syncToMailerLite(email),
    ]);

    if (notifyResult.status === "rejected") {
      console.error("Admin notification email failed:", notifyResult.reason);
    }

    if (decreeResult.status === "rejected") {
      console.error("Decree email failed:", decreeResult.reason);
      return res.status(500).json({ error: "Failed to send email. Please try again." });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("Lead capture error:", error);
    return res.status(500).json({ error: "Failed to send email. Please try again." });
  }
};
