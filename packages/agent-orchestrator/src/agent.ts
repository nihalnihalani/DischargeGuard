import { GoogleGenAI } from "@google/genai";
import {
  discoverAgents,
  callMonitoringAgent,
  callRiskScoringAgent,
  callEscalationAgent,
} from "./remote-agents.js";
import type { DiscoveredAgents } from "./remote-agents.js";
import { v4 as uuidv4 } from "uuid";

const MODEL = "gemini-2.0-flash";

let discoveredAgents: DiscoveredAgents | null = null;

function getGenAI(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

type Intent = "full_checkin" | "dashboard" | "discharge_plan" | "unknown";

function classifyIntent(message: string): Intent {
  const lower = message.toLowerCase();
  if (/check.?in|conduct|monitor|symptom|how.*patient|day.*post/.test(lower)) return "full_checkin";
  if (/dashboard|all.?patient|risk.?overview|status.?all/.test(lower)) return "dashboard";
  if (/discharge.?plan|generate.?plan|medication.?reconcil/.test(lower)) return "discharge_plan";
  return "unknown";
}

function extractEscalationNeeded(agentResponse: string): boolean {
  if (/escalation.?required|escalation.?needed|escalationNeeded":\s*true/i.test(agentResponse)) return true;
  if (/critical|🔴|🚨/.test(agentResponse)) return true;
  const scoreMatch = /"compositeScore":\s*(\d+)/.exec(agentResponse);
  if (scoreMatch && parseInt(scoreMatch[1], 10) >= 60) return true;
  return false;
}

export async function runOrchestratorAgent(userMessage: string, sessionId: string): Promise<string> {
  // Discover agents on first run
  if (!discoveredAgents) {
    discoveredAgents = await discoverAgents();
  }

  const intent = classifyIntent(userMessage);
  const sessionNote = `[Session: ${sessionId}]`;

  console.log(`[Orchestrator] ${sessionNote} Intent: ${intent} | Message: "${userMessage.slice(0, 60)}..."`);

  if (intent === "dashboard") {
    console.log("[Orchestrator] → Routing to Risk Scoring Agent (dashboard)");
    const result = await callRiskScoringAgent("Show risk dashboard", sessionId);
    return formatOrchestratorResponse("Risk Dashboard", result, ["Risk Scoring Agent"]);
  }

  if (intent === "full_checkin") {
    const outputs: string[] = [];
    const agentsUsed: string[] = [];

    // Step 1: Monitoring Agent
    console.log("[Orchestrator] → Step 1: Routing to Monitoring Agent");
    outputs.push("## Step 1: Patient Check-In (Monitoring Agent)\n");
    const monitoringResult = await callMonitoringAgent(userMessage, sessionId);
    outputs.push(monitoringResult);
    agentsUsed.push("Monitoring Agent");

    // Step 2: Risk Scoring Agent
    console.log("[Orchestrator] → Step 2: Routing to Risk Scoring Agent");
    outputs.push("\n---\n## Step 2: Risk Assessment (Risk Scoring Agent)\n");
    const riskMessage = `${userMessage}\n\nMonitoring results:\n${monitoringResult}`;
    const riskResult = await callRiskScoringAgent(riskMessage, sessionId);
    outputs.push(riskResult);
    agentsUsed.push("Risk Scoring Agent");

    // Step 3: Escalation Agent (if needed)
    const needsEscalation = extractEscalationNeeded(riskResult);
    if (needsEscalation) {
      console.log("[Orchestrator] → Step 3: Escalation triggered! Routing to Escalation Agent");
      outputs.push("\n---\n## Step 3: Care Team Escalation (Escalation Agent)\n");
      const escalationMessage = `Escalate patient based on risk assessment:\n\n${riskResult}`;
      const escalationResult = await callEscalationAgent(escalationMessage, sessionId);
      outputs.push(escalationResult);
      agentsUsed.push("Escalation Agent");
    } else {
      outputs.push("\n---\n✅ **No escalation required** — risk within acceptable thresholds.");
    }

    return formatOrchestratorResponse("Full Check-In Pipeline", outputs.join("\n"), agentsUsed);
  }

  if (intent === "discharge_plan") {
    // For discharge plans, guide user to provide patient/encounter IDs
    return `To generate a discharge plan, I'll need you to provide:
1. **Patient ID** (FHIR Patient resource ID from HAPI FHIR)
2. **Encounter ID** (FHIR Encounter resource ID for the discharge encounter)

You can use the MCP tools directly:
- \`generate_discharge_plan\` — Personalized instructions + 30-day monitoring plan
- \`calculate_readmission_risk\` — LACE index risk score
- \`reconcile_medications\` — Medication changes + drug interactions

Example: "Generate discharge plan for patientId: abc123, encounterId: xyz456"`;
  }

  // Unknown intent: use Gemini to route intelligently
  try {
    const ai = getGenAI();

    const agentDescriptions = Object.entries(discoveredAgents ?? {})
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `- ${k}: ${(v as { name: string; description: string }).description}`)
      .join("\n");

    const systemPrompt = `You are DischargeGuard's Orchestrator Agent. You coordinate post-discharge patient care.

Available sub-agents (discovered via A2A protocol):
${agentDescriptions}

Available MCP tools:
- generate_discharge_plan: Personalized discharge instructions
- calculate_readmission_risk: LACE risk score
- reconcile_medications: Medication changes + drug interactions

Route requests to the appropriate agent and provide helpful guidance.`;

    const resp = await ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      config: { systemInstruction: systemPrompt, temperature: 0.5 },
    });

    return resp.text ?? "Unable to process request";
  } catch (err) {
    return `Orchestrator error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function formatOrchestratorResponse(
  workflow: string,
  content: string,
  agentsUsed: string[]
): string {
  return `# DischargeGuard — ${workflow}

${content}

---
*Orchestrated by DischargeGuard Orchestrator | A2A Protocol | Agents used: ${agentsUsed.join(" → ")}*`;
}

// Initialize agent discovery on startup
discoverAgents()
  .then((agents) => {
    discoveredAgents = agents;
  })
  .catch((err) => {
    console.warn("[Orchestrator] Initial agent discovery failed (agents may not be running yet):", err.message);
  });
