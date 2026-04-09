import { createA2aServer } from "@dischargeguard/shared";
import { runRiskScoringAgent } from "./agent.js";
import agentCardJson from "../agent.json" with { type: "json" };
import type { AgentCard } from "@dischargeguard/shared";

const PORT = parseInt(process.env.RISK_SCORING_AGENT_PORT ?? "8002", 10);
const agentCard = agentCardJson as AgentCard;

const app = createA2aServer(agentCard, runRiskScoringAgent);

app.listen(PORT, () => {
  console.log(`[Risk Scoring Agent] Running on http://localhost:${PORT}`);
  console.log(`[Risk Scoring Agent] AgentCard: http://localhost:${PORT}/.well-known/agent.json`);
});
