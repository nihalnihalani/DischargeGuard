/**
 * Get the multi-patient risk dashboard.
 * Returns a formatted Table showing all monitored patients sorted by risk score.
 */

import type { RiskAssessment } from "@dischargeguard/shared";

// Shared in-memory dashboard (exported so agent.ts can populate it)
export const riskDashboardStore = new Map<string, RiskAssessment>();

const TIER_EMOJI: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  critical: "🔴",
};

const TREND_EMOJI: Record<string, string> = {
  improving: "⬇️",
  stable: "➡️",
  worsening: "⬆️",
};

export function upsertPatientRisk(assessment: RiskAssessment): void {
  riskDashboardStore.set(assessment.patientId, assessment);
}

export function getRiskDashboard(): string {
  if (riskDashboardStore.size === 0) {
    return `## Risk Dashboard — ${new Date().toLocaleDateString()}

_No patients currently being monitored._

Start a check-in by sending: \`conduct day-N check-in for [patient name]\``;
  }

  const sorted = Array.from(riskDashboardStore.values()).sort(
    (a, b) => b.compositeScore - a.compositeScore
  );

  const rows = sorted.map((r) => {
    const tierCell = `${TIER_EMOJI[r.compositeRiskTier] ?? "⚪"} ${r.compositeRiskTier.toUpperCase()}`;
    const trendCell = `${TREND_EMOJI[r.trend] ?? "➡️"} ${r.trend}`;
    const escalation = r.escalationNeeded ? "🚨 YES" : "No";
    return `| ${r.patientName} | ${r.diagnosis} | Day ${r.dayPostDischarge} | ${r.compositeScore}/100 | ${tierCell} | ${trendCell} | ${escalation} |`;
  });

  const criticalCount = sorted.filter((r) => r.compositeRiskTier === "critical").length;
  const highCount = sorted.filter((r) => r.compositeRiskTier === "high").length;
  const escalationCount = sorted.filter((r) => r.escalationNeeded).length;

  return `## Risk Dashboard — ${new Date().toLocaleDateString()}

**Summary:** ${sorted.length} patients monitored | 🔴 ${criticalCount} Critical | 🟠 ${highCount} High | 🚨 ${escalationCount} Need Escalation

| Patient | Diagnosis | Day Post-Discharge | Score | Risk Tier | Trend | Escalation |
|---------|-----------|-------------------|-------|-----------|-------|------------|
${rows.join("\n")}

---
_Scores: 0-25 Low • 26-50 Medium • 51-75 High • 76-100 Critical | Escalation threshold: ≥60_`;
}

export function getPatientRisk(patientId: string): RiskAssessment | undefined {
  return riskDashboardStore.get(patientId);
}

export function getRiskSummaryJson(): RiskAssessment[] {
  return Array.from(riskDashboardStore.values()).sort(
    (a, b) => b.compositeScore - a.compositeScore
  );
}
