import { createA2aServer } from "@dischargeguard/shared";
import { runMonitoringAgent } from "./agent.js";
import agentCardJson from "../agent.json" with { type: "json" };
import type { AgentCard } from "@dischargeguard/shared";

const PORT = parseInt(process.env.MONITORING_AGENT_PORT ?? "8001", 10);
const agentCard = agentCardJson as AgentCard;

const app = createA2aServer(agentCard, runMonitoringAgent);

app.listen(PORT, () => {
  console.log(`[Monitoring Agent] Running on http://localhost:${PORT}`);
  console.log(`[Monitoring Agent] AgentCard: http://localhost:${PORT}/.well-known/agent.json`);
});
