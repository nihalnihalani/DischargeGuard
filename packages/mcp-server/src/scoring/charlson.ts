import { CHARLSON_SNOMED_MAP, SNOMED_SYSTEM } from "@dischargeguard/shared";
import type { FhirCondition } from "../fhir/types.js";

export interface CharlsonResult {
  total: number;
  details: Array<{ category: string; weight: number; conditions: string[] }>;
}

/**
 * Calculate the Charlson Comorbidity Index from a list of FHIR Conditions.
 * Only active, confirmed conditions are scored.
 * Each category counted at most once (deduplication by category).
 */
export function calculateCharlson(conditions: FhirCondition[]): CharlsonResult {
  const active = conditions.filter((c) => {
    const status = c.clinicalStatus?.coding?.[0]?.code;
    const verification = c.verificationStatus?.coding?.[0]?.code;
    return status === "active" && (verification === "confirmed" || verification === undefined);
  });

  // category → { weight, conditions[] }
  const byCategory = new Map<string, { weight: number; conditions: string[] }>();

  for (const cond of active) {
    const codings = cond.code?.coding ?? [];
    for (const coding of codings) {
      if (coding.system !== SNOMED_SYSTEM && coding.system !== undefined) continue;
      const code = coding.code ?? "";
      const entry = CHARLSON_SNOMED_MAP[code];
      if (!entry) continue;

      const { category, weight } = entry;
      const existing = byCategory.get(category);
      const display = coding.display ?? cond.code?.text ?? code;

      if (!existing || existing.weight < weight) {
        // Keep highest weight if same category maps at different weights
        byCategory.set(category, {
          weight,
          conditions: [...(existing?.conditions ?? []), display],
        });
      } else {
        existing.conditions.push(display);
      }
    }
  }

  const details = Array.from(byCategory.entries()).map(([category, { weight, conditions }]) => ({
    category,
    weight,
    conditions,
  }));

  const total = details.reduce((sum, d) => sum + d.weight, 0);

  return { total, details };
}
