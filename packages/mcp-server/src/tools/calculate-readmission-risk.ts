import { z } from "zod";
import { getEncounter, getActiveConditionsByPatient } from "../fhir/queries.js";
import { calculateLaceIndex } from "../scoring/lace-index.js";
import type { ReadmissionRisk } from "@dischargeguard/shared";

export const calculateReadmissionRiskSchema = z.object({
  patientId: z.string().describe("FHIR Patient resource ID"),
  encounterId: z.string().describe("FHIR Encounter resource ID for the discharge encounter"),
});

export type CalculateReadmissionRiskInput = z.infer<typeof calculateReadmissionRiskSchema>;

export async function calculateReadmissionRisk(
  input: CalculateReadmissionRiskInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: ReadmissionRisk }> {
  const { patientId, encounterId } = input;

  const [encounter, conditions] = await Promise.all([
    getEncounter(encounterId),
    getActiveConditionsByPatient(patientId),
  ]);

  const risk = await calculateLaceIndex(encounter, conditions, patientId);

  const text = formatRiskTable(risk);

  return {
    content: [{ type: "text", text }],
    structuredContent: risk,
  };
}

function formatRiskTable(risk: ReadmissionRisk): string {
  const tierEmoji = { low: "🟢", medium: "🟡", high: "🔴" }[risk.riskTier];
  const rows = [
    ["Component", "Value", "Score"],
    ["─────────────────", "────────────────────", "──────"],
    ["L — Length of stay", `${risk.lengthOfStayDays} day(s)`, String(risk.breakdown.L)],
    ["A — Acuity (emergency?)", risk.breakdown.A === 3 ? "Yes (Emergency)" : "No", String(risk.breakdown.A)],
    ["C — Charlson index", `${risk.charlsonDetails.map((d) => d.category).join(", ") || "None"}`, String(risk.breakdown.C)],
    ["E — ED visits (6mo)", String(risk.edVisitsLast6Months), String(risk.breakdown.E)],
    ["─────────────────", "────────────────────", "──────"],
    ["**LACE TOTAL**", "", `**${risk.laceScore}/19**`],
  ];

  const table = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");

  return `## Readmission Risk Assessment

| LACE Score | Risk Tier | Monitoring |
|------------|-----------|------------|
| ${risk.laceScore}/19 | ${tierEmoji} **${risk.riskTier.toUpperCase()}** | ${risk.monitoringFrequency} |

### LACE Breakdown

${table}

### Comorbidities (Charlson Index = ${risk.charlsonDetails.reduce((s, d) => s + d.weight, 0)})
${risk.charlsonDetails.length > 0
  ? risk.charlsonDetails
      .map((d) => `- **${d.category}** (weight ${d.weight}): ${d.conditions.join(", ")}`)
      .join("\n")
  : "- None identified"}

### Recommended Action
${risk.riskTier === "high"
  ? "⚠️ **HIGH RISK** — Daily check-ins required. Consider proactive care coordinator outreach."
  : risk.riskTier === "medium"
  ? "⚡ **MEDIUM RISK** — Check-ins every 3 days. Monitor for deterioration closely."
  : "✅ **LOW RISK** — Weekly check-ins sufficient. Standard follow-up protocol."}
`;
}
