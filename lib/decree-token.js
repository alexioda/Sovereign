// lib/decree-token.js — proves a decree came from api/generate-decree.
// ─────────────────────────────────────────────────────────────
// api/capture-lead emails the decree (and the reality / identity / action
// it was built from) to the address in the request. Without a check, any
// caller could put any text in that email and send it from
// send.liveadaptiv.com. generate-decree now returns a token that signs the
// exact text it produced; capture-lead sends only text the token covers.
//
// Key: DECREE_SIGNING_SECRET if set, otherwise derived from RESEND_API_KEY
// (which capture-lead already needs, so no new setting is required).
// ─────────────────────────────────────────────────────────────
const crypto = require("crypto");

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function key() {
  if (process.env.DECREE_SIGNING_SECRET) return process.env.DECREE_SIGNING_SECRET;
  if (process.env.RESEND_API_KEY) {
    return crypto.createHash("sha256").update(`sovereign-decree-token|${process.env.RESEND_API_KEY}`).digest("hex");
  }
  return null;
}

function payload(fields) {
  const f = fields || {};
  return JSON.stringify([f.decree, f.reality, f.identity, f.action, f.cardTitle].map(v => String(v ?? "")));
}

function mac(k, issuedAt, fields) {
  return crypto.createHmac("sha256", k).update(`${issuedAt}.${payload(fields)}`).digest("hex");
}

// Returns null when no key is configured; capture-lead then refuses to send.
function signDecree(fields) {
  const k = key();
  if (!k) return null;
  const issuedAt = Date.now();
  return `${issuedAt}.${mac(k, issuedAt, fields)}`;
}

function verifyDecree(token, fields) {
  const k = key();
  if (!k || typeof token !== "string") return false;
  const [issuedAt, sig] = token.split(".");
  if (!/^\d+$/.test(issuedAt || "") || !/^[0-9a-f]{64}$/.test(sig || "")) return false;
  const age = Date.now() - Number(issuedAt);
  if (age < 0 || age > MAX_AGE_MS) return false;
  const expected = Buffer.from(mac(k, issuedAt, fields), "hex");
  const given = Buffer.from(sig, "hex");
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

module.exports = { signDecree, verifyDecree };
