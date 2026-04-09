import { GoogleGenAI } from "@google/genai";
import { scoreRisk } from "./tools/score-risk.js";
import type { CheckInResult, RiskAssessment } from "@dischargeguard/shared";

const MODEL = "gemini-2.0-flash";

// In-memory risk dashboard (production: persistent store)
const riskDashboard = new Map<string, RiskAssessment>();

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function formatRiskDashboard(): string {
  if (riskDashboard.size === 0) {
    return "No patients currently being monitored.";
  }

  const tierEmoji: Record<string, string> = {
    low: "🟢", medium: "🟡", high: "🟠", critical: "🔴"
  };
  const trendEmoji: Record<string, string> = {
    improving: "⬇️", stable: "➡️", worsening: "⬆️"
  };

  const rows = Array.from(riskDashboard.values())
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .map((r) =>
      `| ${r.patientName} | ${r.diagnosis} | Day ${r.dayPostDischarge} | ${tierEmoji[r.compositeRiskTier]} ${r.compositeScore}/100 | ${trendEmoji[r.trend]} ${r.trend} | ${r.escalationNeeded ? "🚨 YES" : "No"} |`
    );

  return `## Risk Dashboard — ${new Date().toLocaleDateString()}

| Patient | Diagnosis | Day | Risk Score | Trend | Escalation |
|---------|-----------|-----|------------|-------|------------|
${rows.join("\n")}`;
}

export async function runRiskScoringAgent(userMessage: string, _sessionId: string): Promise<string> {
  const lower = userMessage.toLowerCase();

  // Dashboard request
  if (lower.includes("dashboard") || lower.includes("all patients") || lower.includes("status")) {
    return formatRiskDashboard();
  }

  // Try to parse check-in data from message
  const jsonMatch = /```json\n([\s\S]+?)\n```/.exec(userMessage);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]) as CheckInResult;

      // Get LACE score from message context or use default
      const laceMatch = /lace[:\s]+(\d+)/i.exec(userMessage);
      const laceScore = laceMatch ? parseInt(laceMatch[1], 10) : 10;

      const patientName = /patient.?name[:\s]+([^\n,]+)/i.exec(userMessage)?.[1]?.trim() ?? "Unknown Patient";

      const assessment = scoreRisk(parsed, laceScore, patientName);
      riskDashboard.set(parsed.patientId, assessment);

      const tierEmoji: Record<string, string> = {
        low: "🟢", medium: "🟡", high: "🟠", critical: "🔴"
      };

      const summary = `## Risk Assessment — ${patientName}

${tierEmoji[assessment.compositeRiskTier]} **Risk Tier: ${assessment.compositeRiskTier.toUpperCase()}** (Score: ${assessment.compositeScore}/100)

| Component | Score |
|-----------|-------|
| LACE Index (30%) | ${assessment.laceScore}/19 → ${Math.round((assessment.laceScore / 19) * 100 * 0.3)} pts |
| Symptom Severity (40%) | ${assessment.symptomSeverityScore}/100 → ${Math.round(assessment.symptomSeverityScore * 0.4)} pts |
| Red Flags (20%) | ${assessment.redFlagCount} flags → ${Math.round(Math.min(assessment.redFlagCount * 25, 100) * 0.2)} pts |
| Trend (10%) | ${assessment.trend} |

**Key Factors:**
${assessment.keyFactors.map((f) => `- ${f}`).join("\n") || "- None identified"}

${assessment.escalationNeeded ? "🚨 **ESCALATION REQUIRED** — Risk score exceeds threshold (60/100)" : "✅ No escalation needed at this time"}

---
\`\`\`json
${JSON.stringify(assessment, null, 2)}
\`\`\``;

      return summary;
    } catch (err) {
      // Fall through to Gemini
    }
  }

  // Use Gemini for freeform risk analysis
  try {
    const ai = getGenAI();
    const systemPrompt = `You are DischargeGuard's Risk Scoring Agent. You analyze patient check-in data and calculate readmission risk scores.

Risk scoring components:
- LACE Index (30%): Clinical baseline risk
- Symptom Severity (40%): Current symptom burden
- Red Flags (20%): Acute deterioration indicators
- Trend (10%): Direction of change

Escalation threshold: composite score >= 60/100

Always provide structured JSON assessment in your response.`;

    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: { systemInstruction: systemPrompt, temperature: 0.3 },
    });

    return resp.text ?? "Unable to process risk scoring request";
  } catch (err) {
    return `Risk Scoring Agent error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
