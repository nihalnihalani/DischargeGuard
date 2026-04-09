import { fetchAgentCard, callRemoteAgent } from "@dischargeguard/shared";
import type { AgentCard } from "@dischargeguard/shared";
import { AGENT_PORTS } from "@dischargeguard/shared";

export interface DiscoveredAgents {
  monitoring: AgentCard | null;
  riskScoring: AgentCard | null;
  escalation: AgentCard | null;
}

const AGENT_URLS = {
  monitoring: `http://localhost:${AGENT_PORTS.MONITORING}`,
  riskScoring: `http://localhost:${AGENT_PORTS.RISK_SCORING}`,
  escalation: `http://localhost:${AGENT_PORTS.ESCALATION}`,
};

/** Discover all worker agents via their AgentCards */
export async function discoverAgents(): Promise<DiscoveredAgents> {
  const results = await Promise.allSettled([
    fetchAgentCard(AGENT_URLS.monitoring),
    fetchAgentCard(AGENT_URLS.riskScoring),
    fetchAgentCard(AGENT_URLS.escalation),
  ]);

  const discovered: DiscoveredAgents = {
    monitoring: results[0].status === "fulfilled" ? results[0].value : null,
    riskScoring: results[1].status === "fulfilled" ? results[1].value : null,
    escalation: results[2].status === "fulfilled" ? results[2].value : null,
  };

  const found = Object.entries(discovered)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v?.name}`);

  console.log(`[Orchestrator] Discovered agents: ${found.join(", ") || "none"}`);
  return discovered;
}

/** Call the Monitoring Agent */
export async function callMonitoringAgent(message: string, sessionId?: string): Promise<string> {
  return callRemoteAgent(AGENT_URLS.monitoring, message, sessionId);
}

/** Call the Risk Scoring Agent */
export async function callRiskScoringAgent(message: string, sessionId?: string): Promise<string> {
  return callRemoteAgent(AGENT_URLS.riskScoring, message, sessionId);
}

/** Call the Escalation Agent */
export async function callEscalationAgent(message: string, sessionId?: string): Promise<string> {
  return callRemoteAgent(AGENT_URLS.escalation, message, sessionId);
}
