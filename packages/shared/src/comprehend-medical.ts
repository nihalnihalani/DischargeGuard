import {
  ComprehendMedicalClient,
  DetectEntitiesV2Command,
} from "@aws-sdk/client-comprehendmedical";
import type { ClinicalEntity } from "./types.js";

let client: ComprehendMedicalClient | null = null;

function getClient(): ComprehendMedicalClient {
  if (!client) {
    client = new ComprehendMedicalClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: process.env.AWS_ACCESS_KEY_ID
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
          }
        : undefined,
    });
  }
  return client;
}

/**
 * Extract clinical entities from free-text patient input.
 * Uses Amazon Comprehend Medical DetectEntitiesV2.
 * Free tier: 85,000 units in first month.
 */
export async function extractClinicalEntities(text: string): Promise<ClinicalEntity[]> {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    // Return mock entities when AWS is not configured (development mode)
    return extractMockEntities(text);
  }

  try {
    const command = new DetectEntitiesV2Command({ Text: text });
    const response = await getClient().send(command);

    const entities: ClinicalEntity[] = (response.Entities ?? []).map((e) => ({
      text: e.Text ?? "",
      category: mapCategory(e.Category ?? ""),
      score: e.Score ?? 0,
      negated: e.Traits?.some((t) => t.Name === "NEGATION") ?? false,
    }));

    return entities;
  } catch (err) {
    console.error("[ComprehendMedical] Error extracting entities:", err);
    return extractMockEntities(text);
  }
}

function mapCategory(cat: string): ClinicalEntity["category"] {
  const map: Record<string, ClinicalEntity["category"]> = {
    MEDICAL_CONDITION: "MEDICAL_CONDITION",
    MEDICATION: "MEDICATION",
    ANATOMY: "ANATOMY",
    TEST_TREATMENT_PROCEDURE: "TEST_TREATMENT_PROCEDURE",
    DOSAGE: "DOSAGE",
  };
  return map[cat] ?? "OTHER";
}

/** Simple regex-based fallback for development/demo without AWS credentials */
function extractMockEntities(text: string): ClinicalEntity[] {
  const entities: ClinicalEntity[] = [];
  const lower = text.toLowerCase();

  const conditions = [
    "shortness of breath", "chest pain", "swelling", "edema",
    "weight gain", "fever", "cough", "fatigue", "dizziness",
    "nausea", "vomiting", "pain", "headache", "confusion",
  ];
  const medications = [
    "furosemide", "lisinopril", "metoprolol", "warfarin", "aspirin",
    "metformin", "insulin", "atorvastatin", "amlodipine",
  ];

  for (const cond of conditions) {
    if (lower.includes(cond)) {
      const negated = lower.includes(`no ${cond}`) || lower.includes(`without ${cond}`);
      entities.push({ text: cond, category: "MEDICAL_CONDITION", score: 0.85, negated });
    }
  }
  for (const med of medications) {
    if (lower.includes(med)) {
      const negated = lower.includes(`no ${med}`) || lower.includes(`ran out of ${med}`) || lower.includes(`out of ${med}`);
      entities.push({ text: med, category: "MEDICATION", score: 0.90, negated });
    }
  }

  return entities;
}
