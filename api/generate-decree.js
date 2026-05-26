const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
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

  const combinedInput = `${reality} ${identity} ${action}`;
  if (containsCrisisLanguage(combinedInput)) {
    return res.status(200).json({
      crisis: true,
      message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please dial 988."
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // Removed maxOutputTokens entirely. We will let the prompt's word count rule dictate the length.
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings: safetySettings,
      generationConfig: {
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
    const response = result.response;
    
    const candidate = response.candidates[0];
    const finishReason = candidate.finishReason;

    let rawAIResponse = "";
    if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        rawAIResponse = candidate.content.parts[0].text;
    } else {
        rawAIResponse = `[BLOCKED BY GOOGLE: ${finishReason}]`;
    }

    let cleanText = rawAIResponse.trim();

    if (cleanText === "SAFE_EXIT") {
      return res.status(200).json({
        crisis: true,
        message: "The system is quiet right now. Your word is enough. If you are carrying a weight heavier than stress, please dial 988."
      });
    }

    cleanText = cleanText.replace(/^["']|["']$/g, ''); 
    cleanText = cleanText.replace(/\*\*/g, ''); 
    cleanText = cleanText.replace(/\n/g, ' '); 
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim(); 

    return res.status(200).json({ 
      decree: cleanText,
      diagnostic_data: {
        version: "v9_no_limits",
        untouched_ai_text: rawAIResponse,
        finish_reason: finishReason
      }
    });
    
  } catch (error) {
    console.error("Decree generation error:", error);
    return res.status(500).json({ error: "Failed to generate decree", details: error.message });
  }
};
