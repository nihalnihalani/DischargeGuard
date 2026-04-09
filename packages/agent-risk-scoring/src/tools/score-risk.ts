import {
  COMPOSITE_RISK_WEIGHTS,
  COMPOSITE_RISK_TIERS,
  ESCALATION_THRESHOLD,
} from "@dischargeguard/shared";
import type { CheckInResult, RiskAssessment, CompositeRiskTier } from "@dischargeguard/shared";

// Simple in-memory store for trend tracking (production: use DB)
const previousScores = new Map<string, number>();

function getCompositeRiskTier(score: number): CompositeRiskTier {
  if (score <= COMPOSITE_RISK_TIERS.LOW.max) return "low";
  if (score <= COMPOSITE_RISK_TIERS.MEDIUM.max) return "medium";
  if (score <= COMPOSITE_RISK_TIERS.HIGH.max) return "high";
  return "critical";
}

function calculateSymptomSeverity(checkin: CheckInResult): number {
  // 0-100 score based on red flags and entity count
  const redFlagScore = Math.min(checkin.redFlags.length * 20, 60);
  const symptomScore = Math.min(checkin.extractedEntities.filter(e => e.category === "MEDICAL_CONDITION" && !e.negated).length * 10, 30);
  const adherenceScore = checkin.medicationAdherenceIssues.length > 0 ? 10 : 0;
  return Math.min(redFlagScore + symptomScore + adherenceScore, 100);
}

function calculateRedFlagScore(checkin: CheckInResult): number {
  return Math.min(checkin.redFlags.length * 25, 100);
}

function calculateTrendScore(patientId: string, currentComposite: number): {
  score: number;
  trend: RiskAssessment["trend"];
} {
  const previous = previousScores.get(patientId);
  previousScores.set(patientId, currentComposite);

  if (!previous) return { score: 50, trend: "stable" };

  const delta = currentComposite - previous;
  if (delta > 10) return { score: 80, trend: "worsening" };
  if (delta < -10) return { score: 20, trend: "improving" };
  return { score: 50, trend: "stable" };
}

export function scoreRisk(
  checkin: CheckInResult,
  laceScore: number,
  patientName: string
): RiskAssessment {
  // Normalize LACE (0-19) to 0-100
  const laceNormalized = (laceScore / 19) * 100;

  const symptomSeverity = calculateSymptomSeverity(checkin);
  const redFlagScore = calculateRedFlagScore(checkin);
  const { score: trendScore, trend } = calculateTrendScore(
    checkin.patientId,
    laceNormalized * COMPOSITE_RISK_WEIGHTS.LACE_SCORE +
    symptomSeverity * COMPOSITE_RISK_WEIGHTS.SYMPTOM_SEVERITY
  );

  const compositeScore = Math.round(
    laceNormalized * COMPOSITE_RISK_WEIGHTS.LACE_SCORE +
    symptomSeverity * COMPOSITE_RISK_WEIGHTS.SYMPTOM_SEVERITY +
    redFlagScore * COMPOSITE_RISK_WEIGHTS.RED_FLAGS +
    trendScore * COMPOSITE_RISK_WEIGHTS.TREND
  );

  const compositeRiskTier = getCompositeRiskTier(compositeScore);

  const keyFactors: string[] = [];
  if (laceScore >= 10) keyFactors.push(`High LACE score (${laceScore}/19)`);
  if (checkin.redFlags.length > 0) keyFactors.push(`Red flags: ${checkin.redFlags.join(", ")}`);
  if (checkin.medicationAdherenceIssues.length > 0) keyFactors.push("Medication adherence issues");
  if (trend === "worsening") keyFactors.push("Worsening trend since last check-in");

  return {
    patientId: checkin.patientId,
    patientName,
    diagnosis: checkin.diagnosis,
    dayPostDischarge: checkin.dayPostDischarge,
    compositeScore,
    compositeRiskTier,
    laceScore,
    laceRiskTier: laceScore <= 4 ? "low" : laceScore <= 9 ? "medium" : "high",
    symptomSeverityScore: symptomSeverity,
    redFlagCount: checkin.redFlags.length,
    trend,
    escalationNeeded: compositeScore >= ESCALATION_THRESHOLD,
    keyFactors,
    assessedAt: new Date().toISOString(),
  };
}
