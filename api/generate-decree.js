const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildFreeDecreePrompt, containsCrisisLanguage } = require("../lib/adaptiv-mind");

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

// Post-process: enforce word limit & avoid consecutive I-starts
function postProcess(text) {
  // Hard word count enforcement (under 55 words)
  const words = text.split(/\s+/);
  if (words.length > 55) {
    // Truncate to the last sentence break within 50 words
    const truncated = words.slice(0, 50).join(' ');
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > 0) return truncated.slice(0, lastPeriod + 1);
    return truncated;
  }
  
  // Avoid two consecutive sentences starting with "I"
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g);
  if (sentences && sentences.length >= 2) {
    for (let i = 0; i < sentences.length - 1; i++) {
      const curr = sentences[i].trim();
      const next = sentences[i + 1].trim();
      if (curr.startsWith('I ') && next.startsWith('I ')) {
        // Rewrite the second sentence by removing the "I " prefix
        const rest = next.slice(2);
        sentences[i + 1] = 'It is ' + rest.charAt(0).toLowerCase() + rest.slice(1);
      }
    }
    return sentences.join('');
  }
  
  return text;
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

  const { reality, identity, action, cardTitle, frictionLevel } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  // 1. Crisis pre-check on user inputs
  const combinedInput = `${reality} ${identity} ${action}`;
  if (containsCrisisLanguage(combinedInput)) {
    console.warn("Crisis language detected, returning safe exit.");
    return res.status(200).json({
      crisis: true,
      message: "If you're in distress, help is available.\nCall or text 988 (US) for 24/7 confidential support."
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 70,   // 70 tokens ≈ ~50 words
        temperature: 0.7,
      }
    });

    const prompt = buildFreeDecreePrompt(
      reality || "the friction I carried",
      identity || "sovereign",
      action || "close this loop",
      cardTitle || "",
      parseInt(frictionLevel) || 5
    );

    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();

    // 2. AI crisis exit check
    if (rawText === "SAFE_EXIT") {
      console.warn("AI returned SAFE_EXIT, sending crisis response.");
      return res.status(200).json({
        crisis: true,
        message: "If you're in distress, help is available.\nCall or text 988 (US) for 24/7 confidential support."
      });
    }

    const decree = postProcess(rawText);
    return res.status(200).json({ decree });
  } catch (error) {
    console.error("Decree generation error:", error);
    console.warn("Fallback triggered due to API failure.");
    return res.status(500).json({ error: "Failed to generate decree" });
  }
};
