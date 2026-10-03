// lib/crisis.js — the crisis screen, ported from the Adaptiv app.
// ─────────────────────────────────────────────────────────────
// Same patterns and contraction handling as Adaptiv's api/_lib/crisis.ts,
// which is the source of truth and carries the test suite
// (npm run test:crisis there). Keep the two in step: a pattern tuned in
// one product should be tuned in the other.
//
// The old check here was seven regexes and missed "I want to die",
// "end my life", "better off dead" and every contraction variant.
// ─────────────────────────────────────────────────────────────

const CONTRACTIONS = [
  [/\bcan'?t\b/g, 'cannot'],
  [/\bcannot\b/g, 'cannot'],
  [/\bwon'?t\b/g, 'will not'],
  [/\bdon'?t\b/g, 'do not'],
  [/\bdoesn'?t\b/g, 'does not'],
  [/\bdidn'?t\b/g, 'did not'],
  [/\bisn'?t\b/g, 'is not'],
  [/\bain'?t\b/g, 'is not'],
  [/\baren'?t\b/g, 'are not'],
  [/\bwasn'?t\b/g, 'was not'],
  [/\bhaven'?t\b/g, 'have not'],
  [/\bhasn'?t\b/g, 'has not'],
  [/\bwouldn'?t\b/g, 'would not'],
  [/\bcouldn'?t\b/g, 'could not'],
  [/\bwanna\b/g, 'want to'],
  [/\bgonna\b/g, 'going to'],
  [/\bi'?d\b/g, 'i would'],
  [/\b(they|we|you|he|she)'d\b/g, '$1 would'],
  [/\btheyd\b/g, 'they would'],
];

function normalizeForScreening(text) {
  let out = String(text).toLowerCase().replace(/[\u2018\u2019\u02BC]/g, "'");
  for (const [re, sub] of CONTRACTIONS) out = out.replace(re, sub);
  return out.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const CRISIS_PATTERNS = [
  // explicit intent
  'kill (myself|my self)', 'killing myself',
  'suicid(e|al)', 'take my (own )?life',
  'end (my life|it all)', 'ending my life',
  // ideation
  // "die on that hill" is a business idiom, never a crisis statement.
  'want to die(?!\\s+on (that|this) hill)',
  'wish (i was|i were|i am) dead', 'better off dead',
  'do not want to (be here|live|wake up|exist|be alive)',
  'no longer want to (be here|live|be alive)',
  'nothing (left )?to live for', 'no reason to (live|go on)',
  'no point (in )?(living|being alive|going on)',
  'tired of (living|being alive)',
  // "cannot go on with the vendor" is a work sentence, not a crisis one —
  // the lookahead keeps the phrase without catching ordinary complaints.
  'cannot go on(?!\\s+(with|about|for|to|without))',
  'cannot do this anymore', 'cannot keep going',
  // indirect ideation. Each is anchored to a wording that only reads one
  // way: "disappear forever", not "disappear into a book"; "sleep and
  // never wake up", not "I never wake up on time"; a person or group
  // "better off without me", not "the project is better without me".
  'disappear (forever|for good|permanently)',
  'sleep and (never|not) wake( up)?',
  '(never|not) wake up again',
  '(everyone|everybody|they|people|the world|my family|my kids|my children|my wife|my husband|my partner)( would| will)?( be| is| are)? better (off )?without me',
  // self-harm
  'self harm', 'harm(ing)? myself', 'hurt(ing)? myself',
  // "cut myself some slack" is self-kindness, not self-harm.
  'cut(ting)? myself(?!\\s+(some )?slack)', 'overdose',
];

const CRISIS_RE = new RegExp(CRISIS_PATTERNS.join('|'), 'i');

function screenForCrisis(...fields) {
  const raw = fields.filter(f => typeof f === 'string').join(' . ');
  return CRISIS_RE.test(normalizeForScreening(raw));
}

module.exports = { screenForCrisis };
