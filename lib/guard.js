// lib/guard.js — origin allowlist and per-IP rate limit for the API.
// Same pattern as Adaptiv's api/_lib/shared.ts guard().
const ALLOWED_ORIGINS = [
  "https://liveadaptiv.com",
  "https://sovereign.liveadaptiv.com",
  "https://sovereign-blond.vercel.app",
  "http://localhost:3000"
];

// Preview deploys get a generated *.vercel.app hostname; allow those only
// outside production. Any *.vercel.app used to pass, in production too,
// which let any site on vercel.app call these endpoints from its visitors'
// browsers on this project's Gemini key and sending domain.
const ALLOW_VERCEL_PREVIEWS = process.env.VERCEL_ENV !== "production";
const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return ALLOW_VERCEL_PREVIEWS && VERCEL_PREVIEW_RE.test(origin);
}

// Weak per-instance limiter: serverless instances are short-lived, so this
// blunts casual abuse rather than stopping a determined attacker.
function rateLimiter(limit, windowMs) {
  const hits = new Map();
  return function rateLimited(req) {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    const now = Date.now();
    const rec = hits.get(ip);
    if (!rec || now > rec.reset) {
      hits.set(ip, { n: 1, reset: now + windowMs });
      if (hits.size > 5000) hits.clear();
      return false;
    }
    rec.n += 1;
    return rec.n > limit;
  };
}

module.exports = { isOriginAllowed, rateLimiter };
