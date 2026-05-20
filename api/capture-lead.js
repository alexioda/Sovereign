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

module.exports = async (req, res) => {
  const origin = req.headers.origin || "";
  
  if (!isOriginAllowed(origin)) {
    return res.status(403).json({ error: "Forbidden. Invalid Origin." });
  }
  res.setHeader("Access-Control-Allow-Origin", origin);

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, decree, reality, identity, action, cardTitle, frictionLevel } = req.body;

  if (!email || !decree) {
    return res.status(400).json({ error: "Missing email or decree" });
  }

  if (!process.env.RESEND_API_KEY || !process.env.NOTIFY_EMAIL) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  
  // NOTE: Ensure this matches your verified Resend subdomain exactly
  const senderEmail = "Adaptiv <decree@send.liveadaptiv.com>";

  try {
    // 1. Notification to You
    await resend.emails.send({
      from: senderEmail,
      to: process.env.NOTIFY_EMAIL,
      subject: `New Sovereign Decree — ${email}`,
      html: `
        <h2>New Lead from Sovereign Command</h2>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Reality:</strong> ${reality}</p>
        <p><strong>Identity:</strong> ${identity}</p>
        <p><strong>Action:</strong> ${action}</p>
        <p><strong>Protocol:</strong> ${cardTitle}</p>
        <p><strong>Friction Level:</strong> ${frictionLevel}</p>
        <hr>
        <h3>Decree:</h3>
        <blockquote style="font-style:italic;font-size:1.1em;">${decree}</blockquote>
      `
    });

    // 2. Email to the User
    await resend.emails.send({
      from: senderEmail,
      to: email,
      subject: "Your Sovereign Decree",
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:Georgia,serif;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#b2945e;">LiveAdaptiv — Sovereign Command</p>
          <h2>Your Decree</h2>
          <blockquote style="font-size:1.2em;font-style:italic;padding:20px;background:#f9f8f6;border-left:3px solid #b2945e;">
            ${decree}
          </blockquote>
          <p style="color:#666;font-size:14px;">This was forged from your reality: <em>${reality}</em><br>
          Your chosen identity: <em>${identity}</em><br>
          Your commitment: <em>${action}</em></p>
          <p style="margin-top:30px;font-size:14px;">You are ready for the full Adaptiv mind.<br>
          <a href="https://liveadaptiv.com" style="color:#b2945e;font-weight:bold;">Start your 7-day free trial →</a></p>
          <p style="font-size:11px;color:#aaa;margin-top:20px;">LiveAdaptiv — The anti-hustle AI coach</p>
        </div>
      `
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Lead capture error:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
};
