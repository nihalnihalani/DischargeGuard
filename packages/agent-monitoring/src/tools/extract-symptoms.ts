import { extractClinicalEntities } from "@dischargeguard/shared";
import type { ClinicalEntity } from "@dischargeguard/shared";

export interface SymptomExtractionResult {
  entities: ClinicalEntity[];
  symptoms: ClinicalEntity[];
  medications: ClinicalEntity[];
  redFlagsDetected: string[];
  medicationAdherenceIssues: string[];
}

const RED_FLAG_TERMS = [
  "chest pain", "difficulty breathing", "severe shortness of breath",
  "weight gain", "edema", "swelling", "confusion", "fever", "fainting",
  "blood", "unconscious", "severe pain",
];

const NON_ADHERENCE_PATTERNS = [
  "ran out", "out of", "forgot", "missed", "stopped taking",
  "can't afford", "didn't take", "not taking",
];

export async function extractSymptoms(patientText: string): Promise<SymptomExtractionResult> {
  const entities = await extractClinicalEntities(patientText);

  const symptoms = entities.filter((e) => e.category === "MEDICAL_CONDITION" && !e.negated);
  const medications = entities.filter((e) => e.category === "MEDICATION");

  const lower = patientText.toLowerCase();

  // Detect red flags
  const redFlagsDetected = RED_FLAG_TERMS.filter((term) => lower.includes(term));

  // Detect medication non-adherence
  const medicationAdherenceIssues: string[] = [];
  for (const med of medications) {
    const medStart = lower.indexOf(med.text.toLowerCase());
    if (medStart === -1) continue;
    const context = lower.slice(Math.max(0, medStart - 30), medStart + 60);
    if (NON_ADHERENCE_PATTERNS.some((p) => context.includes(p))) {
      medicationAdherenceIssues.push(`${med.text}: non-adherence detected`);
    }
  }
  // Also check top-level for non-adherence mentions
  for (const pattern of NON_ADHERENCE_PATTERNS) {
    if (lower.includes(pattern)) {
      const idx = lower.indexOf(pattern);
      const nearby = lower.slice(Math.max(0, idx - 20), idx + 30);
      if (!medicationAdherenceIssues.some((i) => i.includes(nearby))) {
        medicationAdherenceIssues.push(`Non-adherence pattern detected: "${lower.slice(idx, idx + 30)}"`);
      }
      break;
    }
  }

  return { entities, symptoms, medications, redFlagsDetected, medicationAdherenceIssues };
}

export function formatExtractionSummary(result: SymptomExtractionResult): string {
  const lines: string[] = ["### Clinical Entity Extraction Results"];

  if (result.symptoms.length > 0) {
    lines.push(
      "\n**Symptoms Identified:**\n" +
      result.symptoms.map((s) => `- ${s.text} (confidence: ${(s.score * 100).toFixed(0)}%)`).join("\n")
    );
  }

  if (result.medications.length > 0) {
    lines.push(
      "\n**Medications Mentioned:**\n" +
      result.medications.map((m) => `- ${m.text}${m.negated ? " (NOT taking)" : ""}`).join("\n")
    );
  }

  if (result.redFlagsDetected.length > 0) {
    lines.push(
      "\n🚨 **RED FLAGS DETECTED:**\n" +
      result.redFlagsDetected.map((f) => `- ${f}`).join("\n")
    );
  }

  if (result.medicationAdherenceIssues.length > 0) {
    lines.push(
      "\n⚠️ **Medication Adherence Issues:**\n" +
      result.medicationAdherenceIssues.map((i) => `- ${i}`).join("\n")
    );
  }

  return lines.join("\n");
}
