const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { buildFreeDecreePrompt, buildPreprocessingPrompt, containsCrisisLanguage } = require("../lib/adaptiv-mind");

const ALLOWED_ORIGINS = [
  "https://liveadaptiv.com",
  "https://sovereign.liveadaptiv.com",
  "http://localhost:3000"
];

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin && origin.endsWith(".vercel.app")) return true;
  return false;
}

function validateInputs(reality, identity, action) {
  const errors = [];
  if (!reality || reality.trim().length < 10)
    errors.push('Name the friction more specifically — what is the actual situation?');
  if (!identity || identity.trim().length < 2)
    errors.push('Who are you being? Give it a name.');
  if (!action || action.trim().length < 8)
    errors.push('Make the action concrete — what exactly are you doing today?');
  return errors;
}

// Post-process decree — fix consecutive I-starts, enforce word limit
function postProcess(text) {
  if (!text) return text;

  // Hard cap at 65 words
  const words = text.split(/\s+/);
  const capped = words.length > 65
    ? words.slice(0, 65).join(' ').replace(/[,;]$/, '') + '.'
    : text;

  // Fix consecutive sentences starting with "I"
  const sentences = capped.split(/(?<=[.!?])\s+/);
  const fixed = sentences.map((sentence, i) => {
    if (i === 0) return sentence;
    const prev = sentences[i - 1];
    if (prev && /^I\b/.test(prev.trim()) && /^I\b/.test(sentence.trim())) {
      return sentence.replace(/^I\b/, 'That means I');
    }
    return sentence;
  }).join(' ');

  return fixed.trim();
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

  const { reality, identity, action, cardTitle, frictionLevel } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Crisis check before anything touches the AI
  const combinedInput = `${reality || ''} ${identity || ''} ${action || ''}`;
  if (containsCrisisLanguage(combinedInput)) {
    console.warn("Crisis language detected — safe exit triggered");
    return res.status(200).json({
      crisis: true,
      message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please reach out to someone you trust — or dial 988."
    });
  }

  const inputErrors = validateInputs(reality, identity, action);
  if (inputErrors.length > 0) {
    return res.status(400).json({ errors: inputErrors });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // ── PASS 1: Clinical Intake — sharpen the inputs ──────────────
    const preprocessModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json"
      }
    });
