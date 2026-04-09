import { RXNORM_SYSTEM } from "@dischargeguard/shared";
import type { FhirMedicationRequest } from "../fhir/types.js";

const RXNAV_BASE = "https://rxnav.nlm.nih.gov/REST";

/** Extract RxNorm CUI from a FHIR MedicationRequest coding */
export function extractRxCui(med: FhirMedicationRequest): string | null {
  const codings = med.medicationCodeableConcept?.coding ?? [];
  const rxnorm = codings.find((c) => c.system === RXNORM_SYSTEM);
  return rxnorm?.code ?? null;
}

/** Extract a human-readable drug name from a MedicationRequest */
export function extractDrugName(med: FhirMedicationRequest): string {
  const text = med.medicationCodeableConcept?.text;
  if (text) return text;
  const codings = med.medicationCodeableConcept?.coding ?? [];
  const first = codings[0];
  return first?.display ?? first?.code ?? "Unknown medication";
}

/** Resolve a drug name to an RxNorm CUI via the RxNav API */
export async function resolveRxCui(drugName: string): Promise<string | null> {
  try {
    const url = `${RXNAV_BASE}/rxcui.json?name=${encodeURIComponent(drugName)}&search=1`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as {
      idGroup?: { rxnormId?: string[] };
    };
    return data.idGroup?.rxnormId?.[0] ?? null;
  } catch {
    return null;
  }
}
