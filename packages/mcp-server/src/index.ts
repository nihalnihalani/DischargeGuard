#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  generateDischargePlanSchema,
  generateDischargePlan,
} from "./tools/generate-discharge-plan.js";
import {
  calculateReadmissionRiskSchema,
  calculateReadmissionRisk,
} from "./tools/calculate-readmission-risk.js";
import {
  reconcileMedicationsSchema,
  reconcileMedications,
} from "./tools/reconcile-medications.js";

const server = new McpServer({
  name: "DischargeGuard-MCP",
  version: "1.0.0",
});

// ─── Tool: generate_discharge_plan ──────────────────────────────────────────
server.registerTool(
  "generate_discharge_plan",
  {
    title: "Generate Discharge Plan",
    description:
      "Generate a personalized discharge plan including plain-language instructions (6th-grade reading level) " +
      "and a 30-day monitoring schedule based on the patient's diagnoses. " +
      "Output: Template — personalized discharge instructions + milestone checkpoints.",
    inputSchema: generateDischargePlanSchema,
  },
  async (input) => {
    const result = await generateDischargePlan(input);
    return result;
  }
);

// ─── Tool: calculate_readmission_risk ────────────────────────────────────────
server.registerTool(
  "calculate_readmission_risk",
  {
    title: "Calculate Readmission Risk (LACE Index)",
    description:
      "Calculate the LACE readmission risk index for a patient based on: Length of stay, " +
      "Acuity of admission, Charlson Comorbidity Index, and ED visits in the past 6 months. " +
      "Stratifies patient into low/medium/high risk tiers with monitoring intensity. " +
      "Output: Table — LACE breakdown and risk dashboard.",
    inputSchema: calculateReadmissionRiskSchema,
  },
  async (input) => {
    const result = await calculateReadmissionRisk(input);
    return result;
  }
);

// ─── Tool: reconcile_medications ─────────────────────────────────────────────
server.registerTool(
  "reconcile_medications",
  {
    title: "Reconcile Medications",
    description:
      "Compare pre-admission, inpatient, and discharge medication lists to identify new medications, " +
      "stopped medications, and dose changes. Checks for drug interactions via openFDA. " +
      "Generates a patient-friendly medication change summary. " +
      "Output: Template — medication reconciliation with interaction warnings.",
    inputSchema: reconcileMedicationsSchema,
  },
  async (input) => {
    const result = await reconcileMedications(input);
    return result;
  }
);

// ─── Start server ─────────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[DischargeGuard-MCP] Server running on stdio");
}

main().catch((err) => {
  console.error("[DischargeGuard-MCP] Fatal error:", err);
  process.exit(1);
});
