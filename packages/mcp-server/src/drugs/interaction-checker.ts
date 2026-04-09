import { parseInteractionText } from "../ai/gemini.js";
import type { DrugInteraction } from "@dischargeguard/shared";

const OPENFDA_BASE = "https://api.fda.gov/drug/label.json";

interface OpenFdaLabelResult {
  results?: Array<{
    drug_interactions?: string[];
    openfda?: {
      brand_name?: string[];
      generic_name?: string[];
      rxcui?: string[];
    };
  }>;
}

/** Fetch the drug label from openFDA by RxNorm CUI */
async function fetchDrugLabel(rxcui: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENFDA_API_KEY;
    const keyParam = apiKey ? `&api_key=${apiKey}` : "";
    const url = `${OPENFDA_BASE}?search=openfda.rxcui:"${rxcui}"&limit=1${keyParam}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as OpenFdaLabelResult;
    const interactions = data.results?.[0]?.drug_interactions;
    return interactions?.join(" ") ?? null;
  } catch {
    return null;
  }
}

/** Fetch drug label by name as fallback */
async function fetchDrugLabelByName(drugName: string): Promise<string | null> {
  try {
    const apiKey = process.env.OPENFDA_API_KEY;
    const keyParam = apiKey ? `&api_key=${apiKey}` : "";
    const encodedName = encodeURIComponent(drugName);
    const url = `${OPENFDA_BASE}?search=openfda.generic_name:"${encodedName}"&limit=1${keyParam}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as OpenFdaLabelResult;
    const interactions = data.results?.[0]?.drug_interactions;
    return interactions?.join(" ") ?? null;
  } catch {
    return null;
  }
}

export interface MedInfo {
  name: string;
  rxcui?: string | null;
}

/**
 * Check drug interactions for a list of medications.
 * Uses openFDA drug label API + Gemini to parse interaction text.
 * Checks all pairs — O(n²) but n is small for typical discharge med lists.
 */
export async function checkDrugInteractions(
  medications: MedInfo[]
): Promise<DrugInteraction[]> {
  if (medications.length < 2) return [];

  // Fetch labels for all meds in parallel
  const labels = await Promise.all(
    medications.map(async (med) => {
      const label = med.rxcui
        ? await fetchDrugLabel(med.rxcui)
        : await fetchDrugLabelByName(med.name);
      return { med, label };
    })
  );

  // Check each pair
  const interactions: DrugInteraction[] = [];
  const pairs = new Set<string>();

  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const key = [labels[i].med.name, labels[j].med.name].sort().join("|");
      if (pairs.has(key)) continue;
      pairs.add(key);

      const { med: med1, label: label1 } = labels[i];
      const { med: med2, label: label2 } = labels[j];

      // Check label of drug1 for mentions of drug2, and vice versa
      const combinedLabel = [label1, label2].filter(Boolean).join(" ");
      if (!combinedLabel) continue;

      const result = await parseInteractionText(med1.name, med2.name, combinedLabel);
      if (result) {
        interactions.push({
          drug1: med1.name,
          drug2: med2.name,
          severity: result.severity,
          description: result.description,
        });
      }
    }
  }

  return interactions;
}
