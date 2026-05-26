const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildFreeDecreePrompt, containsCrisisLanguage } = require("../lib/adaptiv-mind");

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
    return res.status(200).json({
      crisis: true,
      message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please dial 988."
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        maxOutputTokens: 250, // Full runway
        temperature: 0.7, // Balanced precision
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
    let rawText = result.response.text().trim();

    // 2. AI crisis exit check
    if (rawText === "SAFE_EXIT") {
      return res.status(200).json({
        crisis: true,
        message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please dial 988."
      });
    }

    // 3. Clean format (strip stray quotes/markdown, but DO NOT slice the text)
    rawText = rawText.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();

    // 4. Send the complete, untouched paragraph to the browser
    return res.status(200).json({ decree: rawText });
    
  } catch (error) {
    console.error("Decree generation error:", error);
    return res.status(500).json({ error: "Failed to generate decree" });
  }
};
