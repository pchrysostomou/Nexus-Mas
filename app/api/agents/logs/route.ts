import { NextResponse } from "next/server";

type AgentLogRequest = {
  agentId?: string;
  agentName?: string;
  callsign?: string;
  task?: string;
  seedLogs?: string[];
};

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:latest";

export async function POST(request: Request) {
  const payload = (await request.json()) as AgentLogRequest;
  const agentName = payload.agentName ?? "Agent";
  const callsign = payload.callsign ?? "AG-00";
  const task = payload.task ?? "Monitoring the local multi-agent system";
  const seedLogs = payload.seedLogs?.slice(-4).join("\n") ?? "No previous logs.";

  const prompt = [
    `You are ${agentName}, callsign ${callsign}, inside a local multi-agent system dashboard.`,
    `Current task: ${task}`,
    "Recent terminal context:",
    seedLogs,
    "Return exactly 4 short terminal log lines.",
    "Rules: no markdown, no numbering, no quotes, max 12 words per line, present tense."
  ].join("\n");

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          num_predict: 48,
          temperature: 0.55,
          top_p: 0.9
        }
      }),
      signal: AbortSignal.timeout(25000)
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `Ollama returned ${response.status}`,
          logs: buildFallbackLogs(agentName, task),
          model: OLLAMA_MODEL,
          source: "fallback"
        },
        { status: 200 }
      );
    }

    const data = (await response.json()) as { response?: string; model?: string };
    const logs = parseLogLines(data.response);

    return NextResponse.json({
      logs: logs.length > 0 ? logs : buildFallbackLogs(agentName, task),
      model: data.model ?? OLLAMA_MODEL,
      source: logs.length > 0 ? "ollama" : "fallback"
    });
  } catch {
    return NextResponse.json({
      logs: buildFallbackLogs(agentName, task),
      model: OLLAMA_MODEL,
      source: "fallback"
    });
  }
}

function parseLogLines(response?: string) {
  if (!response) {
    return [];
  }

  return response
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

function buildFallbackLogs(agentName: string, task: string) {
  return [
    `${agentName.toLowerCase()} local reasoning channel pending`,
    "ollama bridge will retry on next cycle",
    `tracking task context: ${task.slice(0, 42)}`,
    "mock telemetry remains online"
  ];
}
