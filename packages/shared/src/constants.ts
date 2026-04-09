// ─── Ports ───────────────────────────────────────────────────────────────────

export const AGENT_PORTS = {
  MONITORING: parseInt(process.env.MONITORING_AGENT_PORT ?? "8001"),
  RISK_SCORING: parseInt(process.env.RISK_SCORING_AGENT_PORT ?? "8002"),
  ESCALATION: parseInt(process.env.ESCALATION_AGENT_PORT ?? "8003"),
  ORCHESTRATOR: parseInt(process.env.ORCHESTRATOR_AGENT_PORT ?? "8004"),
} as const;

// ─── LACE Scoring Tables ─────────────────────────────────────────────────────

/** Length of stay → LACE L component (0-7) */
export function laceL(daysInHospital: number): number {
  if (daysInHospital < 1) return 0;
  if (daysInHospital === 1) return 1;
  if (daysInHospital === 2) return 2;
  if (daysInHospital === 3) return 3;
  if (daysInHospital <= 6) return 4;
  if (daysInHospital <= 13) return 5;
  return 7; // 14+ days
}

/** Acuity → LACE A component (0 or 3) */
export function laceA(admittedViaEmergency: boolean): number {
  return admittedViaEmergency ? 3 : 0;
}

/** Charlson total → LACE C component (0-5) */
export function laceC(charlsonTotal: number): number {
  if (charlsonTotal <= 0) return 0;
  if (charlsonTotal === 1) return 1;
  if (charlsonTotal === 2) return 2;
  if (charlsonTotal === 3) return 3;
  return 5; // 4+ comorbidities
}

/** ED visits in past 6 months → LACE E component (0-4) */
export function laceE(edVisits: number): number {
  if (edVisits <= 0) return 0;
  if (edVisits === 1) return 1;
  if (edVisits === 2) return 2;
  if (edVisits === 3) return 3;
  return 4; // 4+ visits
}

// ─── Charlson Comorbidity Index — SNOMED CT Mapping ─────────────────────────
// Source: validated Charlson categories mapped to common Synthea SNOMED codes.
// Weight deduplication is by category: count each category at most once.

export interface CharlsonEntry {
  category: string;
  weight: number;
}

export const CHARLSON_SNOMED_MAP: Record<string, CharlsonEntry> = {
  // Myocardial infarction (weight 1)
  "22298006": { category: "myocardial_infarction", weight: 1 },
  "304914007": { category: "myocardial_infarction", weight: 1 },

  // Congestive heart failure (weight 1)
  "42343007": { category: "chf", weight: 1 },
  "88805009": { category: "chf", weight: 1 },
  "84114007": { category: "chf", weight: 1 },

  // Peripheral vascular disease (weight 1)
  "399957001": { category: "pvd", weight: 1 },
  "28189009": { category: "pvd", weight: 1 },
  "40445007": { category: "pvd", weight: 1 },

  // Cerebrovascular disease (weight 1)
  "230690007": { category: "cerebrovascular", weight: 1 },
  "422504002": { category: "cerebrovascular", weight: 1 },
  "444814009": { category: "cerebrovascular", weight: 1 },

  // Dementia (weight 1)
  "26929004": { category: "dementia", weight: 1 },
  "230265002": { category: "dementia", weight: 1 },
  "417396000": { category: "dementia", weight: 1 },

  // COPD (weight 1)
  "185086009": { category: "copd", weight: 1 },
  "13645005": { category: "copd", weight: 1 },
  "40122008": { category: "copd", weight: 1 },

  // Rheumatic disease (weight 1)
  "69896004": { category: "rheumatic", weight: 1 },
  "53120007": { category: "rheumatic", weight: 1 },
  "201791003": { category: "rheumatic", weight: 1 },

  // Peptic ulcer disease (weight 1)
  "128599005": { category: "peptic_ulcer", weight: 1 },
  "51868009": { category: "peptic_ulcer", weight: 1 },

  // Mild liver disease (weight 1)
  "19943007": { category: "liver_mild", weight: 1 },
  "235856003": { category: "liver_mild", weight: 1 },

  // Diabetes without complications (weight 1)
  "44054006": { category: "diabetes", weight: 1 },
  "73211009": { category: "diabetes", weight: 1 },

  // Diabetes with end-organ damage (weight 2)
  "368581000119106": { category: "diabetes_complications", weight: 2 },
  "422034002": { category: "diabetes_complications", weight: 2 },
  "104931000119100": { category: "diabetes_complications", weight: 2 },

  // Hemiplegia or paraplegia (weight 2)
  "128613002": { category: "hemiplegia", weight: 2 },
  "57177007": { category: "hemiplegia", weight: 2 },

  // Moderate/severe renal disease (weight 2)
  "431855005": { category: "renal", weight: 2 },
  "46177005": { category: "renal", weight: 2 },
  "700379002": { category: "renal", weight: 2 },

  // Any malignancy (weight 2)
  "363406005": { category: "malignancy", weight: 2 },
  "93761005": { category: "malignancy", weight: 2 },
  "254837009": { category: "malignancy", weight: 2 },
  "448169003": { category: "malignancy", weight: 2 },

  // Moderate/severe liver disease (weight 3)
  "197295002": { category: "liver_severe", weight: 3 },
  "76260006": { category: "liver_severe", weight: 3 },

  // Metastatic solid tumor (weight 6)
  "94260004": { category: "metastatic", weight: 6 },
  "716891001": { category: "metastatic", weight: 6 },

  // AIDS/HIV (weight 6)
  "62479008": { category: "aids", weight: 6 },
  "86406008": { category: "aids", weight: 6 },
};

// ─── Diagnosis → Monitoring Protocol Mapping ────────────────────────────────

export interface MonitoringProtocol {
  label: string;
  dailySymptoms: string[];
  redFlagSymptoms: string[];
  measurements: string[];
}

export const HEART_FAILURE_PROTOCOL: MonitoringProtocol = {
  label: "Heart Failure",
  dailySymptoms: [
    "Shortness of breath at rest or with minimal activity",
    "Swelling in ankles, feet, or legs (edema)",
    "Sudden weight gain (more than 2 lbs in one day or 5 lbs in one week)",
    "Persistent cough or wheezing",
    "Fatigue or weakness",
    "Reduced ability to exercise",
  ],
  redFlagSymptoms: [
    "Weight gain >2 lbs overnight",
    "Severe shortness of breath",
    "New or worsening edema",
    "Chest pain or pressure",
    "Fainting or near-fainting",
  ],
  measurements: ["Daily weight (same time, same scale)", "Blood pressure if home monitor available"],
};

export const COPD_PROTOCOL: MonitoringProtocol = {
  label: "COPD",
  dailySymptoms: [
    "Shortness of breath compared to yesterday",
    "Cough (frequency and sputum color)",
    "Wheezing",
    "Ability to do normal daily activities",
    "Medication usage (rescue inhaler frequency)",
  ],
  redFlagSymptoms: [
    "Coughing up yellow or green mucus",
    "Significant worsening of breathlessness",
    "Using rescue inhaler more than usual",
    "Confusion or unusual sleepiness",
  ],
  measurements: ["Peak flow reading if meter available", "Oxygen saturation if pulse oximeter available"],
};

export const PNEUMONIA_PROTOCOL: MonitoringProtocol = {
  label: "Pneumonia",
  dailySymptoms: [
    "Temperature reading",
    "Cough severity and any mucus",
    "Breathing difficulty",
    "Chest pain when breathing",
    "Energy level and appetite",
  ],
  redFlagSymptoms: [
    "Fever returning after it was gone",
    "Coughing up blood",
    "Severe difficulty breathing",
    "Confusion or disorientation",
    "Lips or fingertips turning blue",
  ],
  measurements: ["Temperature twice daily for first week"],
};

export const DIABETES_PROTOCOL: MonitoringProtocol = {
  label: "Diabetes",
  dailySymptoms: [
    "Blood sugar readings (fasting and 2 hours after meals)",
    "Signs of low blood sugar: shakiness, sweating, confusion",
    "Signs of high blood sugar: excessive thirst, frequent urination",
    "Foot inspection for cuts, sores, or swelling",
    "Medication adherence",
  ],
  redFlagSymptoms: [
    "Blood sugar below 70 mg/dL or above 300 mg/dL",
    "Persistent vomiting",
    "Confusion or difficulty concentrating",
    "Chest pain",
  ],
  measurements: ["Blood glucose before meals and at bedtime"],
};

export const STROKE_PROTOCOL: MonitoringProtocol = {
  label: "Stroke / TIA",
  dailySymptoms: [
    "Speech clarity and understanding",
    "Arm or leg weakness compared to yesterday",
    "Balance and coordination",
    "Vision changes",
    "Headache severity",
    "Swallowing difficulty",
  ],
  redFlagSymptoms: [
    "Sudden new weakness or numbness",
    "Sudden vision loss or double vision",
    "Sudden severe headache",
    "Sudden difficulty speaking",
    "Loss of balance or coordination",
  ],
  measurements: ["Blood pressure if home monitor available"],
};

/** Maps SNOMED condition codes to monitoring protocols */
export const MONITORING_PROTOCOLS: Record<string, MonitoringProtocol> = {
  // Heart failure
  "42343007": HEART_FAILURE_PROTOCOL,
  "88805009": HEART_FAILURE_PROTOCOL,
  "84114007": HEART_FAILURE_PROTOCOL,

  // COPD
  "185086009": COPD_PROTOCOL,
  "13645005": COPD_PROTOCOL,

  // Pneumonia
  "233604007": PNEUMONIA_PROTOCOL,
  "422805009": PNEUMONIA_PROTOCOL,

  // Diabetes
  "44054006": DIABETES_PROTOCOL,
  "73211009": DIABETES_PROTOCOL,

  // Stroke / cerebrovascular
  "230690007": STROKE_PROTOCOL,
  "422504002": STROKE_PROTOCOL,
};

// ─── Risk Scoring Weights ────────────────────────────────────────────────────

export const COMPOSITE_RISK_WEIGHTS = {
  LACE_SCORE: 0.30,
  SYMPTOM_SEVERITY: 0.40,
  RED_FLAGS: 0.20,
  TREND: 0.10,
} as const;

export const COMPOSITE_RISK_TIERS = {
  LOW: { min: 0, max: 25 },
  MEDIUM: { min: 26, max: 50 },
  HIGH: { min: 51, max: 75 },
  CRITICAL: { min: 76, max: 100 },
} as const;

export const ESCALATION_THRESHOLD = 60; // composite score to trigger escalation

// ─── RxNorm System URI ───────────────────────────────────────────────────────

export const RXNORM_SYSTEM = "http://www.nlm.nih.gov/research/umls/rxnorm";
export const SNOMED_SYSTEM = "http://snomed.info/sct";
export const LOINC_SYSTEM = "http://loinc.org";
