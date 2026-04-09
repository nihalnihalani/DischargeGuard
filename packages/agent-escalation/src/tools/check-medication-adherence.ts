/**
 * Check medication adherence for a patient.
 * Queries FHIR MedicationRequest resources and identifies potential adherence issues
 * based on last dispense dates, refill patterns, and patient-reported issues.
 */

const FHIR_BASE_URL = process.env.FHIR_BASE_URL ?? "http://localhost:8080/fhir";

export interface MedicationAdherenceReport {
  patientId: string;
  patientName: string;
  checkedAt: string;
  totalMedications: number;
  adherenceIssues: AdherenceIssue[];
  overallAdherenceStatus: "good" | "concerning" | "poor";
  recommendations: string[];
}

export interface AdherenceIssue {
  medicationName: string;
  rxNormCode?: string;
  issueType: "overdue_refill" | "no_dispense_record" | "patient_reported" | "high_risk_missed";
  severity: "low" | "medium" | "high";
  details: string;
  actionRequired: string;
}

interface FhirMedicationRequest {
  resourceType: string;
  id: string;
  status: string;
  medicationCodeableConcept?: {
    coding: Array<{ system: string; code: string; display: string }>;
    text?: string;
  };
  authoredOn?: string;
  dispenseRequest?: {
    expectedSupplyDuration?: { value: number; unit: string };
    numberOfRepeatsAllowed?: number;
  };
  dosageInstruction?: Array<{ text?: string }>;
}

interface FhirBundle {
  entry?: Array<{ resource: FhirMedicationRequest }>;
}

async function fetchDischargeMedications(patientId: string, encounterId?: string): Promise<FhirMedicationRequest[]> {
  const params = new URLSearchParams({
    patient: patientId,
    status: "active",
    _count: "50",
    _sort: "-authoredon",
  });
  if (encounterId) params.set("encounter", encounterId);

  const url = `${FHIR_BASE_URL}/MedicationRequest?${params}`;
  try {
    const resp = await fetch(url, { headers: { Accept: "application/fhir+json" } });
    if (!resp.ok) return [];
    const bundle: FhirBundle = await resp.json() as FhirBundle;
    return (bundle.entry ?? []).map((e) => e.resource);
  } catch {
    return [];
  }
}

function getMedicationName(med: FhirMedicationRequest): string {
  return (
    med.medicationCodeableConcept?.text ??
    med.medicationCodeableConcept?.coding?.[0]?.display ??
    "Unknown Medication"
  );
}

function getRxNormCode(med: FhirMedicationRequest): string | undefined {
  return med.medicationCodeableConcept?.coding?.find(
    (c) => c.system === "http://www.nlm.nih.gov/research/umls/rxnorm"
  )?.code;
}

const HIGH_RISK_MEDICATIONS = [
  "warfarin", "coumadin", "digoxin", "lanoxin", "furosemide", "lasix",
  "metformin", "insulin", "lisinopril", "metoprolol", "atorvastatin",
  "amlodipine", "levothyroxine", "sertraline", "escitalopram",
];

function isHighRiskMedication(name: string): boolean {
  const lower = name.toLowerCase();
  return HIGH_RISK_MEDICATIONS.some((hrm) => lower.includes(hrm));
}

/**
 * Check medication adherence for a patient.
 * @param patientId FHIR patient ID
 * @param patientName Display name for report
 * @param patientReportedIssues Medications the patient mentioned running out of or missing
 * @param encounterId Optional discharge encounter ID
 */
export async function checkMedicationAdherence(
  patientId: string,
  patientName: string,
  patientReportedIssues: string[] = [],
  encounterId?: string
): Promise<MedicationAdherenceReport> {
  const medications = await fetchDischargeMedications(patientId, encounterId);

  const issues: AdherenceIssue[] = [];
  const now = new Date();

  for (const med of medications) {
    const name = getMedicationName(med);
    const rxNorm = getRxNormCode(med);
    const isHighRisk = isHighRiskMedication(name);

    // Check if patient reported issues with this medication
    const patientReported = patientReportedIssues.some(
      (issue) => name.toLowerCase().includes(issue.toLowerCase()) ||
                 issue.toLowerCase().includes(name.toLowerCase())
    );

    if (patientReported) {
      issues.push({
        medicationName: name,
        rxNormCode: rxNorm,
        issueType: "patient_reported",
        severity: isHighRisk ? "high" : "medium",
        details: `Patient reported difficulty obtaining or taking ${name}`,
        actionRequired: isHighRisk
          ? `URGENT: ${name} is a high-risk medication. Contact pharmacy immediately to arrange refill and verify patient has adequate supply.`
          : `Follow up with patient about ${name} access and adherence barriers.`,
      });
      continue;
    }

    // Check supply duration — if authored >30 days ago with 30-day supply, refill may be overdue
    if (med.authoredOn) {
      const authoredDate = new Date(med.authoredOn);
      const daysSinceAuthored = Math.floor((now.getTime() - authoredDate.getTime()) / (1000 * 60 * 60 * 24));
      const supplyDays = med.dispenseRequest?.expectedSupplyDuration?.value ?? 30;

      if (daysSinceAuthored > supplyDays * 0.9 && isHighRisk) {
        issues.push({
          medicationName: name,
          rxNormCode: rxNorm,
          issueType: "overdue_refill",
          severity: "high",
          details: `${name} prescription was issued ${daysSinceAuthored} days ago with ${supplyDays}-day supply`,
          actionRequired: `Verify patient has refilled ${name}. Contact patient or pharmacy if refill is overdue.`,
        });
      }
    }
  }

  // Determine overall status
  const highSeverityCount = issues.filter((i) => i.severity === "high").length;
  const mediumSeverityCount = issues.filter((i) => i.severity === "medium").length;

  let overallAdherenceStatus: MedicationAdherenceReport["overallAdherenceStatus"] = "good";
  if (highSeverityCount > 0) overallAdherenceStatus = "poor";
  else if (mediumSeverityCount > 0) overallAdherenceStatus = "concerning";

  // Build recommendations
  const recommendations: string[] = [];
  if (issues.some((i) => i.issueType === "patient_reported")) {
    recommendations.push("Schedule medication review call with clinical pharmacist");
    recommendations.push("Assess financial barriers — connect with social work if cost is a factor");
  }
  if (issues.some((i) => i.issueType === "overdue_refill")) {
    recommendations.push("Arrange 90-day supply or medication synchronization to reduce refill burden");
  }
  if (overallAdherenceStatus === "good" && medications.length > 0) {
    recommendations.push("Continue current medication routine");
    recommendations.push("Remind patient of importance of adherence at next check-in");
  }
  if (medications.length === 0) {
    recommendations.push("No active medications found in FHIR — verify medication reconciliation was completed at discharge");
  }

  return {
    patientId,
    patientName,
    checkedAt: now.toISOString(),
    totalMedications: medications.length,
    adherenceIssues: issues,
    overallAdherenceStatus,
    recommendations,
  };
}

export function formatAdherenceMarkdown(report: MedicationAdherenceReport): string {
  const statusEmoji = {
    good: "✅",
    concerning: "⚠️",
    poor: "🚨",
  }[report.overallAdherenceStatus];

  const lines = [
    `### Medication Adherence Report — ${report.patientName}`,
    "",
    `${statusEmoji} **Overall Status: ${report.overallAdherenceStatus.toUpperCase()}**`,
    `- Total Medications: ${report.totalMedications}`,
    `- Issues Identified: ${report.adherenceIssues.length}`,
    "",
  ];

  if (report.adherenceIssues.length > 0) {
    lines.push("**Issues:**");
    for (const issue of report.adherenceIssues) {
      const sevEmoji = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
      lines.push(`- ${sevEmoji} **${issue.medicationName}**: ${issue.details}`);
      lines.push(`  → ${issue.actionRequired}`);
    }
    lines.push("");
  }

  if (report.recommendations.length > 0) {
    lines.push("**Recommendations:**");
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`);
    }
  }

  return lines.join("\n");
}
