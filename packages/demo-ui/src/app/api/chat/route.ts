import { NextRequest, NextResponse } from "next/server";

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8004";

export async function POST(req: NextRequest) {
  const { message, sessionId } = (await req.json()) as { message: string; sessionId?: string };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const rpcPayload = {
    jsonrpc: "2.0",
    id: crypto.randomUUID(),
    method: "SendMessage",
    params: {
      message: {
        role: "user",
        parts: [{ text: message }],
      },
      sessionId: sessionId ?? crypto.randomUUID(),
    },
  };

  try {
    const resp = await fetch(`${ORCHESTRATOR_URL}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcPayload),
      signal: AbortSignal.timeout(60_000),
    });

    if (!resp.ok) {
      throw new Error(`Orchestrator returned ${resp.status}`);
    }

    const data = (await resp.json()) as { result?: { output?: string }; error?: { message: string } };

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    return NextResponse.json({ response: data.result?.output ?? "No response from orchestrator" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Return a helpful demo message if orchestrator is not running
    return NextResponse.json({
      response: getDemoResponse(rpcPayload.params.message.parts[0].text),
      demo: true,
      error: `Orchestrator unavailable (${message}) — showing demo response`,
    });
  }
}

function getDemoResponse(input: string): string {
  const lower = input.toLowerCase();

  if (lower.includes("check") || lower.includes("maria") || lower.includes("garcia")) {
    return `## Day-3 Check-In — Maria Garcia

**Monitoring Agent** conducting Heart Failure protocol check-in...

**Reported Symptoms:**
- Weight gain of 3 lbs since yesterday (⚠️ Red Flag)
- Increased ankle swelling — bilateral
- Shortness of breath with minimal activity
- Reports running out of furosemide (Lasix)

**Extracted Clinical Entities:**
- Weight gain (RED FLAG: >2 lbs overnight)
- Peripheral edema, bilateral
- Dyspnea on exertion
- Medication non-adherence: furosemide

---

**Risk Scoring Agent** calculating composite score...

🔴 **CRITICAL** — Composite Score: **78/100**

| Component | Score |
|-----------|-------|
| LACE Index (12/19) | 19 pts |
| Symptom Severity | 32 pts |
| Red Flags (2) | 10 pts |
| Trend (worsening) | 8 pts |

🚨 **ESCALATION TRIGGERED** — Score exceeds threshold (60/100)

---

**Escalation Agent** creating care team task...

### Urgent Care Team Task
**Priority:** URGENT
**Assigned to:** Care Coordinator + PCP
**Due:** Within 4 hours

**Actions Required:**
1. Contact Maria Garcia re: furosemide supply
2. Arrange emergency prescription refill
3. Schedule urgent telehealth visit
4. Consider ED evaluation if edema worsens

**FHIR Communication** sent to Dr. Sarah Chen (PCP) ✓`;
  }

  if (lower.includes("dashboard") || lower.includes("status")) {
    return `## Risk Dashboard — ${new Date().toLocaleDateString()}

**Summary:** 3 patients monitored | 🔴 1 Critical | 🟠 1 High | 🚨 1 Need Escalation

| Patient | Diagnosis | Day | Score | Risk Tier | Trend | Escalation |
|---------|-----------|-----|-------|-----------|-------|------------|
| Maria Garcia | Heart Failure | Day 3 | 78/100 | 🔴 CRITICAL | ⬆️ worsening | 🚨 YES |
| James Wilson | COPD | Day 7 | 52/100 | 🟠 HIGH | ➡️ stable | No |
| Dorothy Patel | Diabetes | Day 14 | 28/100 | 🟡 MEDIUM | ⬇️ improving | No |

---
_Scores: 0-25 Low • 26-50 Medium • 51-75 High • 76-100 Critical | Escalation threshold: ≥60_`;
  }

  return `I'm the DischargeGuard Orchestrator. I coordinate post-discharge patient monitoring across 4 specialized AI agents:

- 🩺 **Monitoring Agent** — Conducts diagnosis-specific check-ins
- 📊 **Risk Scoring Agent** — Calculates LACE + composite readmission risk
- 🚨 **Escalation Agent** — Creates care team tasks and FHIR Communications
- 🎯 **Orchestrator** (this agent) — Routes requests and manages the pipeline

**Try asking:**
- "Conduct day-3 check-in for Maria Garcia"
- "Show risk dashboard"
- "Calculate readmission risk for patient 12345"`;
}
