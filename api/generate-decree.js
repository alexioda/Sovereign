const { GoogleGenerativeAI } = require("@google/generative-ai");
const { buildFreeDecreePrompt } = require("../lib/adaptiv-mind");

const ALLOWED_ORIGINS = [
  "https://liveadaptiv.com",
  "https://sovereign.liveadaptiv.com",
  "http://localhost:3000"
];

function isOriginAllowed(origin) {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (origin.endsWith(".vercel.app")) return true; // Allows Vercel preview branches
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

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const prompt = buildFreeDecreePrompt(
      reality || "the friction I carried",
      identity || "sovereign",
      action || "close this loop",
      cardTitle || "",
      parseInt(frictionLevel) || 5
    );

    const result = await model.generateContent(prompt);
    const decree = result.response.text().trim();

    return res.status(200).json({ decree });
  } catch (error) {
    console.error("Decree generation error:", error);
    return res.status(500).json({ error: "Failed to generate decree" });
  }
};
