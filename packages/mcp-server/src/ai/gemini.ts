import { GoogleGenAI } from "@google/genai";

let genai: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
    genai = new GoogleGenAI({ apiKey });
  }
  return genai;
}

const MODEL = "gemini-2.0-flash";

/**
 * Generate text via Gemini with a system prompt.
 */
export async function generateText(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const ai = getGenAI();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [{ text: userPrompt }] },
    ],
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.4,
      maxOutputTokens: 2048,
    },
  });
  return response.text ?? "";
}

/**
 * Generate discharge instructions at a 6th-grade reading level.
 */
export async function generateDischargeInstructions(
  clinicalSummary: string
): Promise<string> {
  const system = `You are a health educator writing discharge instructions for patients.
Write at a 6th-grade reading level using:
- Short sentences (max 15 words each)
- Simple, everyday words (define any medical term in parentheses)
- Bullet points for lists
- Warm, reassuring tone
- Active voice
Do NOT include complex medical jargon without a plain-language explanation.`;

  const user = `Write clear discharge instructions for this patient:\n\n${clinicalSummary}`;
  return generateText(system, user);
}

/**
 * Generate a patient-friendly medication reconciliation summary.
 */
export async function generateMedicationSummary(
  changes: string
): Promise<string> {
  const system = `You are a pharmacist explaining medication changes to a patient in simple language.
Write at a 6th-grade reading level. For each change, explain:
1. What the medication is for (in plain words)
2. What changed and why (use simple language)
3. What the patient should do

Use bullet points. Keep it reassuring and clear.`;

  const user = `Explain these medication changes to the patient:\n\n${changes}`;
  return generateText(system, user);
}

/**
 * Parse drug interaction information from openFDA label text.
 */
export async function parseInteractionText(
  drug1: string,
  drug2: string,
  labelText: string
): Promise<{ severity: "major" | "moderate" | "minor"; description: string } | null> {
  const system = `You are a clinical pharmacist. Extract drug interaction information.
Respond ONLY with valid JSON: {"found": true/false, "severity": "major"|"moderate"|"minor", "description": "brief plain-language description"}
If no relevant interaction is described, respond: {"found": false}`;

  const user = `Drug 1: ${drug1}\nDrug 2: ${drug2}\n\nDrug label text:\n${labelText.slice(0, 3000)}`;

  try {
    const text = await generateText(system, user);
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      found: boolean;
      severity?: "major" | "moderate" | "minor";
      description?: string;
    };
    if (!parsed.found) return null;
    return {
      severity: parsed.severity ?? "moderate",
      description: parsed.description ?? "Potential interaction found",
    };
  } catch {
    return null;
  }
}
