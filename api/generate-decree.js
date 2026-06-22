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

    let sharpened = { sovereign_reframe: reality, actual_stake: reality };

    try {
      const preprocessPrompt = buildPreprocessingPrompt(reality, identity, action);
      const preprocessResult = await preprocessModel.generateContent(preprocessPrompt);
      
      // FIX: Strip rogue markdown ticks from Gemini's JSON before parsing
      let rawJson = preprocessResult.response.text();
      rawJson = rawJson.replace(/```json/gi, '').replace(/```/gi, '').trim();
      
      sharpened = JSON.parse(rawJson);
    } catch (e) {
      console.warn("Preprocessing failed — falling back to raw inputs:", e?.message);
    }

    // ── PASS 2: Generate the Decree ───────────────────────────────
    const decreeModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings,
      generationConfig: {
        temperature: 0.7,
        // FIX: Removed maxOutputTokens. Let the prompt handle the length.
      }
    });

    const decreePrompt = buildFreeDecreePrompt(
      sharpened.sovereign_reframe,
      identity,
      action,
      cardTitle || "",
      parseInt(frictionLevel) || 5
    );

    const decreeResult = await decreeModel.generateContent(decreePrompt);
    let rawText = decreeResult.response.text().trim();

    // Handle AI-triggered safe exit
    if (rawText === "SAFE_EXIT") {
      console.warn("AI triggered SAFE_EXIT");
      return res.status(200).json({
        crisis: true,
        message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please reach out to someone you trust — or dial 988."
      });
    }

    // Clean formatting artifacts
    let cleanText = rawText
      .replace(/^["']|["']$/g, '') // strip wrapping quotes
      .replace(/\*\*/g, '') // strip markdown bold
      .replace(/\n/g, ' ') // flatten line breaks
      .replace(/\s{2,}/g, ' ') // collapse whitespace
      .trim();

    // Post-process: word cap + consecutive I-fix
    cleanText = postProcess(cleanText);

    return res.status(200).json({ decree: cleanText });

  } catch (error) {
    console.error("Decree generation error:", error?.message || error);

    // Friction-matched fallback decrees in Alex voice
    const fl = parseInt(frictionLevel) || 5;
    const fallbacks = {
      high: [
        "The system is under load. That is the data, not the verdict. I chose to stay clear anyway. One action, then the next. That is the architecture.",
        "The pressure is real. So is the choice. I am not what this moment is demanding — I am what I bring to it. Closing the loop now.",
        "This is friction, not failure. I carry it without becoming it. My next move is small and deliberate."
      ],
      mid: [
        "The weight is present. I named it. That is the first move. Now I choose who I am being while I carry it forward.",
        "Something tightened today. I noticed before it accumulated. That is the protocol working. One action, then rest.",
        "The friction is information. I read it. I chose my response. The decree stands."
      ],
      low: [
        "The system is clear. The work is here. I show up with what I have and let that be enough.",
        "Clarity is its own kind of courage. I am in it today. One deliberate action seals the session.",
        "The load is light. I use the space well. Presence is the practice."
      ]
    };

    const range = fl >= 7 ? 'high' : fl >= 4 ? 'mid' : 'low';
    const options = fallbacks[range];
    const fallback = options[Math.floor(Math.random() * options.length)];

    console.warn("Using fallback decree for range:", range);
    return res.status(200).json({ decree: fallback, fallback: true });
  }
};
