import { GoogleGenAI } from "@google/genai";
import { conductCheckin, formatCheckInConversation } from "./tools/conduct-checkin.js";
import { extractSymptoms, formatExtractionSummary } from "./tools/extract-symptoms.js";
import type { CheckInResult } from "@dischargeguard/shared";

const MODEL = "gemini-2.0-flash";

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPT = `You are DischargeGuard's Monitoring Agent — a compassionate post-discharge care assistant.

Your primary tasks:
1. Conduct diagnosis-specific check-ins with patients
2. Extract clinical entities from patient responses
3. Identify red flags that require escalation

When asked to conduct a check-in:
- Parse the patient ID, diagnosis, and day post-discharge from the request
- Generate appropriate check-in questions for the diagnosis
- Present them in a warm, conversational way (Talk output)

When given a patient's response to check-in questions:
- Extract clinical entities (symptoms, medications, red flags)
- Identify medication adherence issues
- Flag any red flags for the risk scoring agent

Always respond with structured JSON at the end of your response in this format:
{
  "patientId": "...",
  "checkinDate": "ISO date",
  "dayPostDischarge": number,
  "diagnosis": "...",
  "questions": ["..."],
  "responses": "patient's response text",
  "extractedEntities": [...],
  "redFlags": ["..."],
  "medicationAdherenceIssues": ["..."]
}`;

export async function runMonitoringAgent(userMessage: string, _sessionId: string): Promise<string> {
  // Parse intent from message
  const lower = userMessage.toLowerCase();

  // Check-in initiation
  const checkinMatch = /(?:check.?in|conduct|start|initiate).+?(?:patient\s+)?(\w+).+?(?:day\s+)?(\d+)/.exec(lower) ??
    /patient\s+(\w+).+?day\s+(\d+)/.exec(lower);

  const diagnosisMatch = /(?:with|for|diagnosis|dx:?)\s+([^,.\n]+)/i.exec(userMessage);
  const diagnosis = diagnosisMatch?.[1]?.trim() ?? "heart failure";

  if (checkinMatch || lower.includes("check") || lower.includes("monitor")) {
    const patientId = checkinMatch?.[1] ?? "demo-patient";
    const dayStr = checkinMatch?.[2] ?? "3";
    const day = parseInt(dayStr, 10);
    const patientName = "Maria Garcia"; // In production, fetch from FHIR

    const checkinQuestions = conductCheckin(diagnosis, day);
    const conversationText = formatCheckInConversation(patientName, checkinQuestions, day);

    // Use Gemini to generate a warmer, more natural version
    let talkOutput = conversationText;
    try {
      const ai = getGenAI();
      const resp = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: `Rewrite this check-in message in a warm, friendly tone for a patient recovering from ${diagnosis}:\n\n${conversationText}` }] }],
        config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.6, maxOutputTokens: 1024 },
      });
      talkOutput = resp.text ?? conversationText;
    } catch {
      // Use original if Gemini fails
    }

    // Check if patient response is included in the message
    const hasResponse = userMessage.includes("response:") || userMessage.includes("patient says") || userMessage.includes("patient responded");
    if (!hasResponse) {
      const result: Partial<CheckInResult> = {
        patientId,
        checkinDate: new Date().toISOString(),
        dayPostDischarge: day,
        diagnosis,
        questions: checkinQuestions.questions,
      };

      return `${talkOutput}\n\n---\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
    }

    // Process patient response
    const responseStart = userMessage.indexOf("response:") !== -1
      ? userMessage.indexOf("response:") + 9
      : userMessage.indexOf("patient says") !== -1
      ? userMessage.indexOf("patient says") + 12
      : userMessage.length / 2;
    const patientResponse = userMessage.slice(responseStart).trim();

    const extraction = await extractSymptoms(patientResponse);
    const extractionSummary = formatExtractionSummary(extraction);

    const result: CheckInResult = {
      patientId,
      checkinDate: new Date().toISOString(),
      dayPostDischarge: day,
      diagnosis,
      questions: checkinQuestions.questions,
      responses: patientResponse,
      extractedEntities: extraction.entities,
      redFlags: extraction.redFlagsDetected,
      medicationAdherenceIssues: extraction.medicationAdherenceIssues,
    };

    return `${talkOutput}\n\n${extractionSummary}\n\n---\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
  }

  // Symptom extraction only
  if (lower.includes("extract") || lower.includes("symptom")) {
    const extraction = await extractSymptoms(userMessage);
    const summary = formatExtractionSummary(extraction);
    return summary;
  }

  // Default: use Gemini to handle freeform question
  try {
    const ai = getGenAI();
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0.5 },
    });
    return resp.text ?? "Unable to process request";
  } catch (err) {
    return `Monitoring Agent error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
