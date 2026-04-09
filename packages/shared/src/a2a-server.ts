/**
 * Shared A2A server factory.
 * Each agent calls createA2aServer() to get an Express app that implements
 * the A2A JSON-RPC protocol.
 */
import express, { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { AgentCard, A2ATask, JsonRpcRequest, JsonRpcResponse } from "./types.js";

export type TaskHandler = (
  message: string,
  sessionId: string
) => Promise<string>;

export function createA2aServer(
  agentCard: AgentCard,
  handleTask: TaskHandler
): express.Application {
  const app = express();
  app.use(express.json());

  // A2A Discovery endpoint
  app.get("/.well-known/agent.json", (_req: Request, res: Response) => {
    res.json(agentCard);
  });

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", agent: agentCard.name });
  });

  // A2A JSON-RPC endpoint
  app.post("/rpc", async (req: Request, res: Response) => {
    const body = req.body as JsonRpcRequest;
    const { id, method, params } = body;

    try {
      if (method === "tasks/send") {
        const p = params as { message?: { parts?: Array<{ text?: string }> }; sessionId?: string };
        const userText = p?.message?.parts?.[0]?.text ?? "";
        const sessionId = p?.sessionId ?? uuidv4();

        const result = await handleTask(userText, sessionId);

        const task: A2ATask = {
          id: uuidv4(),
          sessionId,
          status: {
            state: "completed",
            message: {
              role: "agent",
              parts: [{ type: "text", text: result }],
            },
            timestamp: new Date().toISOString(),
          },
        };

        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id,
          result: task,
        };
        res.json(response);
      } else {
        res.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        } satisfies JsonRpcResponse);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      res.status(500).json({
        jsonrpc: "2.0",
        id,
        error: { code: -32603, message },
      } satisfies JsonRpcResponse);
    }
  });

  return app;
}

/** Send a message to a remote A2A agent and get the text response */
export async function callRemoteAgent(
  agentUrl: string,
  message: string,
  sessionId?: string
): Promise<string> {
  const response = await fetch(`${agentUrl}/rpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: uuidv4(),
      method: "tasks/send",
      params: {
        message: { parts: [{ type: "text", text: message }] },
        sessionId: sessionId ?? uuidv4(),
      },
    } satisfies JsonRpcRequest),
  });

  if (!response.ok) {
    throw new Error(`Remote agent call failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as JsonRpcResponse;
  if (data.error) throw new Error(data.error.message);

  const task = data.result as A2ATask;
  return task.status.message?.parts?.[0]?.text ?? "";
}

/** Fetch and return an agent's AgentCard */
export async function fetchAgentCard(agentUrl: string): Promise<AgentCard> {
  const response = await fetch(`${agentUrl}/.well-known/agent.json`);
  if (!response.ok) {
    throw new Error(`Failed to fetch AgentCard from ${agentUrl}: ${response.status}`);
  }
  return response.json() as Promise<AgentCard>;
}
