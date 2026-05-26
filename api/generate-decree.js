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

    // PASS 1: The Clinical Intake (Sharpening the inputs)
    const preprocessModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings: safetySettings,
      generationConfig: {
        temperature: 0.2, 
        responseMimeType: "application/json"
      }
    });

    let sharpened = { sovereign_reframe: reality, actual_stake: reality };
    
    try {
      const preprocessPrompt = buildPreprocessingPrompt(reality, identity, action);
      const preprocessResult = await preprocessModel.generateContent(preprocessPrompt);
      const rawJson = preprocessResult.response.text();
      sharpened = JSON.parse(rawJson);
    } catch (e) {
      console.warn("Preprocessing failed, falling back to raw inputs.");
    }

    // PASS 2: Generating the actual Decree
    const decreeModel = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      safetySettings: safetySettings,
      generationConfig: {
        temperature: 0.7, 
      }
    });

    const decreePrompt = buildFreeDecreePrompt(
      sharpened.sovereign_reframe, // We feed the sharpened reality in here!
      identity,
      action,
      cardTitle || "",
      parseInt(frictionLevel) || 5
    );

    const decreeResult = await decreeModel.generateContent(decreePrompt);
    let rawAIResponse = decreeResult.response.text();
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
    });
    
  } catch (error) {
    console.error("Decree generation error:", error);
    return res.status(500).json({ error: "Failed to generate decree", details: error.message });
  }
};
