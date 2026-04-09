import { z } from "zod";
import { generateDischargeInstructions } from "../ai/gemini.js";
import {
  getPatient, getEncounter, getConditionsByEncounter,
  getMedicationRequestsByEncounter, getProceduresByEncounter,
} from "../fhir/queries.js";
import { MONITORING_PROTOCOLS, HEART_FAILURE_PROTOCOL } from "@dischargeguard/shared";
import { SNOMED_SYSTEM } from "@dischargeguard/shared";
import type { DischargePlan, MonitoringMilestone, MonitoringFrequency } from "@dischargeguard/shared";

export const generateDischargePlanSchema = z.object({
  patientId: z.string().describe("FHIR Patient resource ID"),
  encounterId: z.string().describe("FHIR Encounter resource ID for the discharge encounter"),
});

export type GenerateDischargePlanInput = z.infer<typeof generateDischargePlanSchema>;

export async function generateDischargePlan(
  input: GenerateDischargePlanInput
): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: DischargePlan }> {
  const { patientId, encounterId } = input;

  const [patient, encounter, conditions, medications, procedures] = await Promise.all([
    getPatient(patientId),
    getEncounter(encounterId),
    getConditionsByEncounter(encounterId),
    getMedicationRequestsByEncounter(encounterId),
    getProceduresByEncounter(encounterId),
  ]);

  // Patient name
  const nameEntry = patient.name?.[0];
  const patientName = nameEntry?.text ??
    [nameEntry?.given?.join(" "), nameEntry?.family].filter(Boolean).join(" ") ??
    "Patient";

  // Primary diagnosis
  const primaryCondition = conditions[0];
  const diagnosis = primaryCondition?.code?.text ??
    primaryCondition?.code?.coding?.[0]?.display ?? "discharge";

  // Condition list for instructions
  const conditionList = conditions.map((c) => ({
    code: c.code?.coding?.find((x) => x.system === SNOMED_SYSTEM)?.code ?? "",
    display: c.code?.text ?? c.code?.coding?.[0]?.display ?? "Unknown condition",
  }));

  // Medication list
  const medList = medications.map((m) => {
    const name = m.medicationCodeableConcept?.text ??
      m.medicationCodeableConcept?.coding?.[0]?.display ?? "Unknown";
    const dosage = m.dosageInstruction?.[0];
    const dose = dosage?.doseAndRate?.[0]?.doseQuantity
      ? `${dosage.doseAndRate[0].doseQuantity.value} ${dosage.doseAndRate[0].doseQuantity.unit}`
      : dosage?.text ?? "as directed";
    const freq = dosage?.timing?.repeat
      ? `${dosage.timing.repeat.frequency}x daily`
      : "as directed";
    return { name, dose, frequency: freq, purpose: "" };
  });

  // Procedure list for context
  const procedureList = procedures.map((p) =>
    p.code?.text ?? p.code?.coding?.[0]?.display ?? "Procedure"
  );

  // Determine monitoring protocol based on primary condition codes
  let protocol = HEART_FAILURE_PROTOCOL; // default
  for (const cond of conditions) {
    for (const coding of cond.code?.coding ?? []) {
      if (coding.code && MONITORING_PROTOCOLS[coding.code]) {
        protocol = MONITORING_PROTOCOLS[coding.code];
        break;
      }
    }
  }

  // LACE-based monitoring frequency (this tool uses encounter context)
  // Default to "every-3-days"; agents call calculate_readmission_risk for exact frequency
  const checkInFrequency: MonitoringFrequency = "every-3-days";

  // Build 30-day milestones
  const milestones: MonitoringMilestone[] = [
    {
      day: 1,
      tasks: ["Call your doctor's office to confirm follow-up appointment", "Review your medications", "Weigh yourself"],
      symptomsToWatch: protocol.redFlagSymptoms.slice(0, 3),
    },
    {
      day: 3,
      tasks: ["Check-in call with care coordinator", "Review wound/symptom status if applicable"],
      symptomsToWatch: protocol.dailySymptoms.slice(0, 3),
    },
    {
      day: 7,
      tasks: ["Follow-up appointment with primary care doctor", "Review all medications with doctor"],
      symptomsToWatch: protocol.redFlagSymptoms,
    },
    {
      day: 14,
      tasks: ["Second follow-up if indicated", "Check on specialist referrals"],
      symptomsToWatch: protocol.dailySymptoms,
    },
    {
      day: 30,
      tasks: ["30-day follow-up visit", "Review progress and adjust care plan"],
      symptomsToWatch: protocol.dailySymptoms,
    },
  ];

  // Build clinical summary for Gemini
  const clinicalSummary = `
Patient: ${patientName}
Diagnosis: ${conditionList.map((c) => c.display).join(", ")}
Procedures: ${procedureList.join(", ") || "None"}
Discharge medications: ${medList.map((m) => `${m.name} ${m.dose} ${m.frequency}`).join(", ")}
Symptoms to monitor: ${protocol.dailySymptoms.join(", ")}
Red flag symptoms (call doctor immediately): ${protocol.redFlagSymptoms.join(", ")}
Follow-up: See your doctor within 7 days of discharge.
`.trim();

  const instructions = await generateDischargeInstructions(clinicalSummary);

  const plan: DischargePlan = {
    patientId,
    encounterId,
    patientName,
    diagnosis,
    instructions,
    monitoringPlan: { milestones, checkInFrequency },
    conditions: conditionList,
    medications: medList,
  };

  // Format as readable Template output
  const text = formatDischargePlanMarkdown(plan);

  return {
    content: [{ type: "text", text }],
    structuredContent: plan,
  };
}

function formatDischargePlanMarkdown(plan: DischargePlan): string {
  return `# Discharge Plan for ${plan.patientName}

**Diagnosis:** ${plan.diagnosis}
**Monitoring Frequency:** Check-ins ${plan.monitoringPlan.checkInFrequency}

## Your Instructions
${plan.instructions}

## Your Medications
${plan.medications.map((m) => `- **${m.name}** — ${m.dose}, ${m.frequency}`).join("\n")}

## Your 30-Day Schedule
${plan.monitoringPlan.milestones
  .map(
    (m) =>
      `### Day ${m.day}\n**Tasks:** ${m.tasks.join("; ")}\n**Watch for:** ${m.symptomsToWatch.join("; ")}`
  )
  .join("\n\n")}

## When to Call 911 or Go to the ER
If you experience: ${plan.conditions
    .map((_c) => "sudden severe shortness of breath, chest pain, or loss of consciousness")
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(", ")}
`;
}
