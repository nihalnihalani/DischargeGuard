import {
  HEART_FAILURE_PROTOCOL,
  COPD_PROTOCOL,
  PNEUMONIA_PROTOCOL,
  DIABETES_PROTOCOL,
  STROKE_PROTOCOL,
} from "@dischargeguard/shared";

export interface CheckInQuestions {
  diagnosisLabel: string;
  questions: string[];
  redFlagSymptoms: string[];
  measurements: string[];
}

const PROTOCOL_MAP: Record<string, typeof HEART_FAILURE_PROTOCOL> = {
  "heart failure": HEART_FAILURE_PROTOCOL,
  "congestive heart failure": HEART_FAILURE_PROTOCOL,
  chf: HEART_FAILURE_PROTOCOL,
  copd: COPD_PROTOCOL,
  "chronic obstructive pulmonary disease": COPD_PROTOCOL,
  pneumonia: PNEUMONIA_PROTOCOL,
  diabetes: DIABETES_PROTOCOL,
  "type 2 diabetes": DIABETES_PROTOCOL,
  stroke: STROKE_PROTOCOL,
  tia: STROKE_PROTOCOL,
};

function matchProtocol(diagnosis: string) {
  const lower = diagnosis.toLowerCase();
  for (const [key, protocol] of Object.entries(PROTOCOL_MAP)) {
    if (lower.includes(key)) return protocol;
  }
  return HEART_FAILURE_PROTOCOL; // default
}

export function conductCheckin(
  diagnosis: string,
  dayPostDischarge: number
): CheckInQuestions {
  const protocol = matchProtocol(diagnosis);

  const urgencyPrefix = dayPostDischarge <= 3
    ? "Since this is within the first 3 days, "
    : dayPostDischarge <= 7
    ? "As you approach your first week home, "
    : "";

  const questions = [
    `${urgencyPrefix}How are you feeling overall compared to yesterday?`,
    ...protocol.dailySymptoms.slice(0, 4).map((s) => `Are you experiencing: ${s}?`),
    "Are you taking all your medications as prescribed?",
    "Have you had any falls or new injuries?",
    dayPostDischarge === 1 ? "Did you pick up all your prescriptions from the pharmacy?" : "Do you have all your medications at home?",
  ].filter(Boolean);

  return {
    diagnosisLabel: protocol.label,
    questions,
    redFlagSymptoms: protocol.redFlagSymptoms,
    measurements: protocol.measurements,
  };
}

export function formatCheckInConversation(
  patientName: string,
  questions: CheckInQuestions,
  dayPostDischarge: number
): string {
  return `## Post-Discharge Check-In — Day ${dayPostDischarge}

Hello ${patientName}! I'm your DischargeGuard care assistant checking in on your recovery from ${questions.diagnosisLabel}.

**Today's Check-In Questions:**
${questions.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

**Daily Measurements to Track:**
${questions.measurements.map((m) => `- ${m}`).join("\n")}

---
*If you experience any of the following, call your doctor immediately or go to the ER:*
${questions.redFlagSymptoms.map((s) => `🚨 ${s}`).join("\n")}`;
}
