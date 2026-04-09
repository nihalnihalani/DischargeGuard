import { laceL, laceA, laceC, laceE } from "@dischargeguard/shared";
import type { ReadmissionRisk, RiskTier, MonitoringFrequency } from "@dischargeguard/shared";
import type { FhirEncounter, FhirCondition } from "../fhir/types.js";
import { calculateCharlson } from "./charlson.js";
import { getEmergencyEncountersSince } from "../fhir/queries.js";

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function riskTierFromLace(lace: number): RiskTier {
  if (lace <= 4) return "low";
  if (lace <= 9) return "medium";
  return "high";
}

function monitoringFrequencyFromTier(tier: RiskTier): MonitoringFrequency {
  if (tier === "low") return "weekly";
  if (tier === "medium") return "every-3-days";
  return "daily";
}

/**
 * Calculate the LACE readmission risk index.
 * Returns a structured breakdown with all components.
 */
export async function calculateLaceIndex(
  encounter: FhirEncounter,
  conditions: FhirCondition[],
  patientId: string
): Promise<ReadmissionRisk> {
  // L — Length of stay
  const start = encounter.period?.start ?? new Date().toISOString();
  const end = encounter.period?.end ?? new Date().toISOString();
  const los = daysBetween(start, end);
  const L = laceL(los);

  // A — Acuity (admitted via emergency)
  const admittedViaEmergency = encounter.class?.code === "EMER";
  const A = laceA(admittedViaEmergency);

  // C — Charlson comorbidity index
  const charlson = calculateCharlson(conditions);
  const C = laceC(charlson.total);

  // E — ED visits in past 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const edEncounters = await getEmergencyEncountersSince(patientId, sixMonthsAgo);
  // Exclude the current encounter
  const edCount = edEncounters.filter((e) => e.id !== encounter.id).length;
  const E = laceE(edCount);

  const total = L + A + C + E;
  const riskTier = riskTierFromLace(total);
  const monitoringFrequency = monitoringFrequencyFromTier(riskTier);

  return {
    laceScore: total,
    breakdown: { L, A, C, E, total },
    riskTier,
    monitoringFrequency,
    charlsonDetails: charlson.details,
    edVisitsLast6Months: edCount,
    lengthOfStayDays: los,
  };
}
