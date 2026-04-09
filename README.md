# DischargeGuard 🏥

> Post-discharge care coordination agent — preventing hospital readmissions with AI

[![Hackathon](https://img.shields.io/badge/Hackathon-Agents%20Assemble-blue)](https://agents-assemble.devpost.com/)
[![Track](https://img.shields.io/badge/Track-MCP%20Server%20%2B%20A2A%20Agents-green)](#architecture)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![FHIR](https://img.shields.io/badge/FHIR-R4-orange)](https://hl7.org/fhir/R4/)

---

## The Problem

**Hospital readmissions within 30 days cost the US healthcare system $26 billion annually.**

- CMS penalizes hospitals **up to 3%** of Medicare reimbursements for excess readmissions (HRRP)
- **27% of readmissions are preventable** with adequate follow-up
- After discharge, patients fall into a "care vacuum" — no systematic monitoring of whether they filled prescriptions, understood wound care, or are developing complications

DischargeGuard closes this gap with an AI-powered coordination system that actively monitors patients for 30 days post-discharge.

---

## Solution

DischargeGuard is a multi-agent healthcare AI system built on **MCP** (Model Context Protocol) and **A2A** (Agent-to-Agent) protocols:

- **MCP Server**: Exposes 3 FHIR-backed clinical tools for discharge planning, risk scoring, and medication reconciliation
- **4 A2A Agents**: Orchestrate patient monitoring, risk assessment, and care team escalation
- **FHIR R4**: Integrates with real healthcare data via HAPI FHIR + Synthea synthetic patients

---

## Architecture

```
User / Demo UI
      |
      | A2A (JSON-RPC)
      v
+------------------------+
| Orchestrator Agent     |  Port 8004
| (Routes workflows)     |
+----+--------+-------+--+
     |        |       |
RemoteA2A  RemoteA2A  RemoteA2A
     |        |       |
+----v--+ +---v---+ +-v--------+
| Mon.  | | Risk  | | Escal.   |
| Agent | | Agent | | Agent    |
| :8001 | | :8002 | | :8003    |
+--+----+ +--+----+ +--+-------+
   |         |         |
   +---------+---------+
             | McpToolset (stdio)
   +---------v-----------+
   | DischargeGuard-MCP  |
   | 3 Clinical Tools    |
   +---------+-----------+
             |
   +---------v-----------+
   | HAPI FHIR Server    |
   | + openFDA + RxNorm  |
   | + Synthea Patients  |
   +---------------------+
```

---

## 5Ts Output Coverage

| Output Type | How DischargeGuard Implements It |
|-------------|----------------------------------|
| **Talk** | Daily patient check-in conversations with diagnosis-specific symptom questions |
| **Template** | Personalized discharge instructions at 6th-grade reading level + medication reconciliation summary |
| **Table** | 30-day risk trajectory dashboard showing patient risk scores and trends |
| **Transaction** | FHIR R4 Communication resource generated for care team escalation |
| **Task** | Actionable care team task with urgency, clinical summary, and recommended actions |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| MCP Server | `@modelcontextprotocol/sdk` v1.9 (TypeScript) |
| A2A Agents | Google ADK pattern (TypeScript + Express) |
| AI Models | Google Gemini 2.0 Flash (via `@google/genai`) |
| Clinical NLP | Amazon Comprehend Medical |
| FHIR Server | HAPI FHIR R4 (Docker) |
| Synthetic Data | Synthea v3 |
| Drug Interactions | openFDA Drug Label API |
| Drug Resolution | RxNav REST API |
| Risk Scoring | LACE Index + Charlson Comorbidity Index |
| Demo UI | Next.js App Router + Tailwind CSS |

---

## Getting Started

### Prerequisites
- Node.js >= 22
- Docker + Docker Compose
- Java 11+ (for Synthea)
- Google AI Studio API key (free at [aistudio.google.com](https://aistudio.google.com))
- AWS credentials (for Comprehend Medical — free tier available)

### 1. Clone & Install

```bash
git clone https://github.com/nihalnihalani/DischargeGuard.git
cd DischargeGuard
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Start HAPI FHIR

```bash
npm run infra:up
# HAPI FHIR available at http://localhost:8080
```

### 4. Generate & Load Synthetic Patients

```bash
# Generate 50 synthetic patients
bash synthea/scripts/generate-patients.sh

# Upload to HAPI FHIR
bash synthea/scripts/upload-to-hapi.sh
```

### 5. Run the MCP Server

```bash
npm run dev:mcp
# DischargeGuard-MCP running on stdio
```

### 6. Run All A2A Agents

Open 4 terminal windows:

```bash
npm run dev:monitoring    # Port 8001 — Patient check-ins
npm run dev:risk          # Port 8002 — Risk scoring
npm run dev:escalation    # Port 8003 — Care team tasks
npm run dev:orchestrator  # Port 8004 — Main entry point
```

### 7. Test the Full Pipeline

```bash
# Test Orchestrator (full check-in pipeline)
curl -X POST http://localhost:8004/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tasks/send",
    "params": {
      "message": {
        "parts": [{"type": "text", "text": "Conduct a day-3 check-in for Maria Garcia with heart failure"}]
      }
    }
  }'
```

---

## MCP Server Tools

### `generate_discharge_plan`
Generates personalized discharge instructions at a 6th-grade reading level with a 30-day monitoring plan.

**Input:** `{ patientId: string, encounterId: string }`

**Output:** Template — discharge instructions + milestone checkpoints at days 1, 3, 7, 14, 30

### `calculate_readmission_risk`
Computes the LACE readmission risk index from FHIR data.

**Input:** `{ patientId: string, encounterId: string }`

**Output:** Table — LACE breakdown (Length of stay, Acuity, Charlson index, ED visits)

| LACE Score | Risk Tier | Monitoring |
|------------|-----------|------------|
| 0-4 | 🟢 Low | Weekly |
| 5-9 | 🟡 Medium | Every 3 days |
| 10+ | 🔴 High | Daily |

### `reconcile_medications`
Compares pre-admission vs discharge medications. Identifies new/stopped/dose-changed meds and checks drug interactions via openFDA.

**Input:** `{ patientId: string, encounterId: string }`

**Output:** Template — patient-friendly medication change summary + interaction warnings

> **Note:** RxNorm Drug Interaction API was discontinued in January 2024. DischargeGuard uses the openFDA Drug Label API + Gemini NLP parsing as the replacement.

---

## A2A Agents

### Monitoring Agent (Port 8001)
Conducts diagnosis-specific patient check-ins using condition-aware question protocols:
- **Heart failure**: daily weight, shortness of breath, edema
- **COPD**: peak flow, cough, shortness of breath
- **Pneumonia**: temperature, breathing difficulty, cough severity
- **Diabetes**: blood sugar, medication adherence, foot checks
- **Stroke/TIA**: speech clarity, arm/leg weakness, balance

Uses Amazon Comprehend Medical to extract clinical entities from patient responses.

### Risk Scoring Agent (Port 8002)
Computes composite risk scores (0-100) from:
- LACE Index (30%) — clinical baseline
- Symptom severity (40%) — current burden
- Red flags (20%) — acute deterioration
- Trend (10%) — change vs previous check-in

**Escalation threshold**: composite score ≥ 60

### Escalation Agent (Port 8003)
Triggers when risk score exceeds threshold:
- **Critical (76-100)**: Emergent Task + STAT FHIR Communication
- **High (51-75)**: Urgent Task + URGENT FHIR Communication
- **Medium (26-50)**: Routine Task for care coordinator

Produces FHIR R4 `Communication` resources (Transaction output).

### Orchestrator Agent (Port 8004)
Single entry point for the DischargeGuard system. Routes requests via A2A protocol:
1. Discovers worker agents via `/.well-known/agent.json` AgentCards
2. Chains monitoring → risk scoring → escalation for check-ins
3. Returns all 5Ts in a single orchestrated response

---

## FHIR Resources Used

| Resource | Usage |
|----------|-------|
| `Patient` | Demographics for personalized instructions |
| `Encounter` | Discharge details, length of stay, acuity |
| `Condition` | Diagnoses for LACE scoring (Charlson) and monitoring protocols |
| `MedicationRequest` | Pre-admission + discharge medications for reconciliation |
| `Procedure` | Procedures performed during stay |
| `Observation` | Vitals and labs for risk scoring |
| `Communication` | Generated escalation messages to care team |

---

## Demo Scenario: Maria Garcia

**Patient**: Maria Garcia, 68, discharged 3 days ago with congestive heart failure

**Setup**: LACE score = 12 (high risk: 5-day hospital stay + emergency admission + CHF + previous ED visit)

1. **Check-in initiated** → Monitoring Agent generates HF-specific questions
2. **Patient response**: "I weigh 158 pounds, up from 155 yesterday. My ankles are more swollen. I ran out of furosemide."
3. **Comprehend Medical extracts**: weight gain (medical condition), edema (medical condition), furosemide (medication, negated/stopped)
4. **Risk scored**: LACE=12 + severe symptoms → **composite score 78/100 = CRITICAL**
5. **Escalation triggered**: Urgent care team Task + STAT FHIR Communication to attending physician
6. **Medication alert**: Furosemide non-adherence — critical for heart failure management

All 5Ts produced in a single orchestrated A2A workflow. ✅

---

## Project Structure

```
dischargeguard/
├── packages/
│   ├── mcp-server/          # DischargeGuard-MCP (3 FHIR tools)
│   ├── agent-monitoring/    # A2A agent: patient check-ins (port 8001)
│   ├── agent-risk-scoring/  # A2A agent: risk assessment (port 8002)
│   ├── agent-escalation/    # A2A agent: care team tasks (port 8003)
│   ├── agent-orchestrator/  # A2A orchestrator (port 8004)
│   ├── shared/              # Types, constants, SNOMED mappings, A2A server
│   └── demo-ui/             # Next.js dashboard (coming in Week 4)
├── synthea/                 # Synthetic patient data generation
├── docker-compose.yml       # HAPI FHIR
└── .env.example
```

---

## Implementation Timeline

| Week | Focus |
|------|-------|
| Week 1 (Apr 8-14) | Repo setup, HAPI FHIR + Synthea, FHIR client, LACE/Charlson |
| Week 2 (Apr 15-21) | MCP tools: discharge plan, risk scoring, medication reconciliation |
| Week 3 (Apr 22-28) | A2A agents + orchestration, full pipeline testing |
| Week 4 (Apr 29-May 11) | Demo UI, 3-min video, README polish, Prompt Opinion submission |

---

## Hackathon

**Competition**: [Agents Assemble — The Healthcare AI Endgame](https://agents-assemble.devpost.com/)

**Tracks**: MCP Server (Superpowers) + A2A Agent (Full Agents)

**Deadline**: May 11, 2026 | **Prize Pool**: $25,000 USD

---

## References

- [CMS Hospital Readmissions Reduction Program (HRRP)](https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps/hospital-readmissions-reduction-program-hrrp)
- [LACE Index Paper (van Walraven et al., 2010)](https://pubmed.ncbi.nlm.nih.gov/20194559/)
- [SHARP on MCP — Healthcare MCP Framework](https://sharponmcp.com/)
- [Google Agent Development Kit (ADK)](https://google.github.io/adk-docs/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [HAPI FHIR Server](https://hapifhir.io/)
- [Synthea Synthetic Patient Generator](https://synthea.mitre.org/)
- [openFDA Drug Label API](https://open.fda.gov/apis/drug/label/)

---

## License

MIT — see [LICENSE](LICENSE)
