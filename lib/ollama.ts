export type AgentLogResponse = {
  logs: string[];
  model: string;
  source: "ollama" | "fallback";
};
