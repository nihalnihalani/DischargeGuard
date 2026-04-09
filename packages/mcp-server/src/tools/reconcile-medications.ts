import { z } from "zod";
import {
  getEncounter,
  getMedicationRequestsByEncounter,
  getMedicationRequestsByPatient,
} from "../fhir/queries.js";
import { extractRxCui, extractDrugName } from "../drugs/rxnorm-lookup.js";
import { checkDrugInteractions } from "../drugs/interaction-checker.js";
import { generateMedicationSummary } from "../ai/gemini.js";
import type { MedicationSummary, DrugInteraction } from "@dischargeguard/shared";

export const reconcileMedicationsSchema = z.object({
  patientId: z.string().describe("FHIR Patient resource ID"),
  encounterId: z.string().describe("FHIR Encounter resource ID for the discharge encounter"),
});

export type ReconcileMedicationsInput = z.infer<typeof reconcileMedicationsSchema>;

export interface MedicationReconciliationResult {
  patientId: string;
  encounterId: string;
  preAdmission: MedicationSummary[];
  discharge: MedicationSummary[];
  changes: {
    new: MedicationSummary[];
    stopped: MedicationSummary[];
    doseChanged: MedicationSummary[];
    unchanged: MedicationSummary[];
  };
  interactions: DrugInteraction[];
  patientSummary: string;
}

export async function reconcileMedications(input: ReconcileMedicationsInput): Promise<{
  content: Array<{ type: "text"; text: string }>;
  structuredContent: MedicationReconciliationResult;
}> {
  const { patientId, encounterId } = input;

  const encounter = await getEncounter(encounterId);
  const admissionDate = encounter.period?.start ?? new Date().toISOString();

  const [dischargeMeds, allPatientMeds] = await Promise.all([
    getMedicationRequestsByEncounter(encounterId),
    getMedicationRequestsByPatient(patientId, "active"),
  ]);

  // Pre-admission = active meds authored before admission date, not from this encounter
  const preAdmissionMeds = allPatientMeds.filter((m) => {
    const authored = m.authoredOn ?? "";
    const isBeforeAdmission = authored < admissionDate;
    const isNotThisEncounter =
      !m.encounter?.reference?.endsWith(encounterId);
    return isBeforeAdmission && isNotThisEncounter;
  });

  // Build summaries
  const toSummary = (m: (typeof dischargeMeds)[0], status: MedicationSummary["status"]): MedicationSummary => ({
    id: m.id,
    name: extractDrugName(m),
    rxNormCode: extractRxCui(m) ?? undefined,
    dose: m.dosageInstruction?.[0]?.text ??
      (m.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity
        ? `${m.dosageInstruction[0].doseAndRate[0].doseQuantity.value} ${m.dosageInstruction[0].doseAndRate[0].doseQuantity.unit}`
        : undefined),
    frequency: m.dosageInstruction?.[0]?.timing?.repeat
      ? `${m.dosageInstruction[0].timing.repeat.frequency}x/${m.dosageInstruction[0].timing.repeat.periodUnit}`
      : undefined,
    status,
  });

  const preAdmissionSummaries = preAdmissionMeds.map((m) => toSummary(m, "unchanged"));
  const dischargeSummaries = dischargeMeds.map((m) => toSummary(m, "unchanged"));

  // Reconcile: compare by RxNorm code or name
  const preAdmissionKeys = new Map<string, MedicationSummary>(
    preAdmissionSummaries.map((m) => [m.rxNormCode ?? m.name.toLowerCase(), m])
  );
  const dischargeKeys = new Map<string, MedicationSummary>(
    dischargeSummaries.map((m) => [m.rxNormCode ?? m.name.toLowerCase(), m])
  );

  const newMeds: MedicationSummary[] = [];
  const stoppedMeds: MedicationSummary[] = [];
  const doseChangedMeds: MedicationSummary[] = [];
  const unchangedMeds: MedicationSummary[] = [];

  for (const [key, dMed] of dischargeKeys) {
    if (!preAdmissionKeys.has(key)) {
      newMeds.push({ ...dMed, status: "new" });
    } else {
      const pMed = preAdmissionKeys.get(key)!;
      if (pMed.dose !== dMed.dose || pMed.frequency !== dMed.frequency) {
        doseChangedMeds.push({
          ...dMed,
          status: "dose-changed",
          changeDescription: `Changed from ${pMed.dose ?? "unknown"} ${pMed.frequency ?? ""} to ${dMed.dose ?? "unknown"} ${dMed.frequency ?? ""}`,
        });
      } else {
        unchangedMeds.push({ ...dMed, status: "unchanged" });
      }
    }
  }

  for (const [key, pMed] of preAdmissionKeys) {
    if (!dischargeKeys.has(key)) {
      stoppedMeds.push({ ...pMed, status: "stopped" });
    }
  }

  // Drug interaction check on discharge medications
  const interactions = await checkDrugInteractions(
    dischargeSummaries.map((m) => ({ name: m.name, rxcui: m.rxNormCode }))
  );

  // Generate patient-friendly summary via Gemini
  const changeDescription = [
    newMeds.length > 0 ? `NEW medications: ${newMeds.map((m) => `${m.name} (${m.dose})`).join(", ")}` : "",
    stoppedMeds.length > 0 ? `STOPPED medications: ${stoppedMeds.map((m) => m.name).join(", ")}` : "",
    doseChangedMeds.length > 0
      ? `DOSE CHANGES: ${doseChangedMeds.map((m) => `${m.name} — ${m.changeDescription}`).join("; ")}`
      : "",
    interactions.length > 0
      ? `DRUG INTERACTIONS to watch: ${interactions.map((i) => `${i.drug1} + ${i.drug2} (${i.severity})`).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const patientSummary =
    changeDescription.length > 0
      ? await generateMedicationSummary(changeDescription)
      : "Your medications remain the same as before your hospital stay. Please continue taking them as directed.";

  const result: MedicationReconciliationResult = {
    patientId,
    encounterId,
    preAdmission: preAdmissionSummaries,
    discharge: dischargeSummaries,
    changes: {
      new: newMeds,
      stopped: stoppedMeds,
      doseChanged: doseChangedMeds,
      unchanged: unchangedMeds,
    },
    interactions,
    patientSummary,
  };

  const text = formatMedReconciliationMarkdown(result);

  return { content: [{ type: "text", text }], structuredContent: result };
}

function formatMedReconciliationMarkdown(r: MedicationReconciliationResult): string {
  const sections: string[] = ["## Medication Reconciliation Summary\n"];

  if (r.changes.new.length > 0) {
    sections.push(
      "### 🆕 New Medications\n" +
      r.changes.new.map((m) => `- **${m.name}** — ${m.dose ?? "as directed"} ${m.frequency ?? ""}`).join("\n")
    );
  }
  if (r.changes.stopped.length > 0) {
    sections.push(
      "### 🛑 Stopped Medications\n" +
      r.changes.stopped.map((m) => `- ${m.name}`).join("\n")
    );
  }
  if (r.changes.doseChanged.length > 0) {
    sections.push(
      "### 📊 Dose Changes\n" +
      r.changes.doseChanged.map((m) => `- **${m.name}**: ${m.changeDescription}`).join("\n")
    );
  }
  if (r.changes.unchanged.length > 0) {
    sections.push(
      "### ✅ Unchanged Medications\n" +
      r.changes.unchanged.map((m) => `- ${m.name} — ${m.dose ?? "as before"}`).join("\n")
    );
  }
  if (r.interactions.length > 0) {
    sections.push(
      "### ⚠️ Drug Interactions\n" +
      r.interactions
        .map(
          (i) =>
            `- **${i.severity.toUpperCase()}**: ${i.drug1} + ${i.drug2} — ${i.description}`
        )
        .join("\n")
    );
  }

  sections.push("### Patient Instructions\n" + r.patientSummary);

  return sections.join("\n\n");
}
