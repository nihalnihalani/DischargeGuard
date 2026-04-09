import { createA2aServer } from "@dischargeguard/shared";
import { runOrchestratorAgent } from "./agent.js";
import agentCardJson from "../agent.json" with { type: "json" };
import type { AgentCard } from "@dischargeguard/shared";

const PORT = parseInt(process.env.ORCHESTRATOR_AGENT_PORT ?? "8004", 10);
const agentCard = agentCardJson as AgentCard;

const app = createA2aServer(agentCard, runOrchestratorAgent);

app.listen(PORT, () => {
  console.log(`[Orchestrator Agent] Running on http://localhost:${PORT}`);
  console.log(`[Orchestrator Agent] AgentCard: http://localhost:${PORT}/.well-known/agent.json`);
  console.log("[Orchestrator Agent] Entry point for the DischargeGuard A2A system");
});
