import { GoogleGenAI } from "@google/genai";
import { createCareTeamTask, formatTaskMarkdown } from "./tools/create-care-team-task.js";
import { generateFhirCommunication, formatFhirCommunicationMarkdown } from "./tools/generate-fhir-communication.js";
import type { RiskAssessment, EscalationResult } from "@dischargeguard/shared";

const MODEL = "gemini-2.0-flash";

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

export async function runEscalationAgent(userMessage: string, _sessionId: string): Promise<string> {
  const lower = userMessage.toLowerCase();

  // Parse risk assessment from JSON block
  const jsonMatch = /```json\n([\s\S]+?)\n```/.exec(userMessage);
  if (jsonMatch) {
    try {
      const assessment = JSON.parse(jsonMatch[1]) as RiskAssessment;

      if (!assessment.escalationNeeded) {
        return `✅ No escalation required for ${assessment.patientName}. Risk score: ${assessment.compositeScore}/100 (${assessment.compositeRiskTier}).`;
      }

      const task = createCareTeamTask(assessment);
      const comm = generateFhirCommunication(task);

      // Detect medication adherence issues
      const medAlerts: string[] = [];
      if (assessment.keyFactors.some((f) => f.toLowerCase().includes("adherence"))) {
        medAlerts.push("Patient reported medication adherence issues — verify prescription access and understand barriers");
      }

      const result: EscalationResult = {
        task,
        fhirCommunication: comm,
        medicationAlerts: medAlerts,
      };

      const output = [
        `# Escalation Triggered — ${assessment.patientName}`,
        "",
        formatTaskMarkdown(task),
        "",
        formatFhirCommunicationMarkdown(comm),
        "",
        medAlerts.length > 0
          ? `### ⚠️ Medication Alerts\n${medAlerts.map((a) => `- ${a}`).join("\n")}`
          : "",
        "",
        "---",
        "```json",
        JSON.stringify(result, null, 2),
        "```",
      ]
        .filter((l) => l !== undefined)
        .join("\n");

      return output;
    } catch {
      // Fall through
    }
  }

  // Manual escalation request
  if (lower.includes("escalat") || lower.includes("alert") || lower.includes("task")) {
    // Build a synthetic assessment for demo
    const patientName = /patient\s+(\w+\s?\w+)/i.exec(userMessage)?.[1] ?? "Unknown Patient";
    const scoreMatch = /score[:\s]+(\d+)/i.exec(userMessage);
    const compositeScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 75;

    const syntheticAssessment: RiskAssessment = {
      patientId: "demo-patient",
      patientName,
      diagnosis: "Heart Failure",
      dayPostDischarge: 3,
      compositeScore,
      compositeRiskTier: compositeScore >= 76 ? "critical" : compositeScore >= 51 ? "high" : "medium",
      laceScore: 12,
      laceRiskTier: "high",
      symptomSeverityScore: 70,
      redFlagCount: 2,
      trend: "worsening",
      escalationNeeded: true,
      keyFactors: ["High LACE score (12/19)", "Red flags: weight gain, edema", "Medication adherence issues"],
      assessedAt: new Date().toISOString(),
    };

    const task = createCareTeamTask(syntheticAssessment);
    const comm = generateFhirCommunication(task);

    return [
      formatTaskMarkdown(task),
      "",
      formatFhirCommunicationMarkdown(comm),
    ].join("\n");
  }

  // Default: Gemini
  try {
    const ai = getGenAI();
    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: {
        systemInstruction:
          "You are DischargeGuard's Escalation Agent. You create care team tasks and FHIR Communication resources when patients are at high risk of readmission.",
        temperature: 0.3,
      },
    });
    return resp.text ?? "Unable to process escalation request";
  } catch (err) {
    return `Escalation Agent error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
