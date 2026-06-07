import type { Agent } from "@/lib/agents";

export type AgentAssignment = {
  agentId: Agent["id"];
  task: string;
  priority: "low" | "medium" | "high";
  expectedOutput: string;
  logs: string[];
  tool?: {
    tool: string;
    ok: boolean;
    summary: string;
    durationMs?: number;
    exitCode?: number | null;
    details?: string[];
  };
};

export type CommandPlan = {
  command: string;
  summary: string;
  assignments: AgentAssignment[];
  source?: "local" | "next-ollama" | "python-mas" | "fallback";
  runId?: string;
  logsStored?: boolean;
};

export type CommandRequest = {
  command: string;
  agents: Array<Pick<Agent, "id" | "name" | "role" | "task" | "status">>;
};
