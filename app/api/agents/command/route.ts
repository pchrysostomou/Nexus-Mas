import { NextResponse } from "next/server";
import type { CommandPlan, CommandRequest } from "@/lib/commands";

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:latest";
const PYTHON_MAS_URL = process.env.PYTHON_MAS_URL ?? "http://127.0.0.1:5055";

export async function POST(request: Request) {
  const payload = (await request.json()) as CommandRequest;
  const command = payload.command?.trim();

  if (!command) {
    return NextResponse.json({ error: "Command is required" }, { status: 400 });
  }

  const pythonPlan = await tryPythonMas({ ...payload, command });
  if (pythonPlan) {
    return NextResponse.json(pythonPlan);
  }

  const prompt = [
    "You are the Commander planner for a local multi-agent dashboard.",
    "Split the user command into focused assignments for the available agents.",
    "Return only valid compact JSON matching this TypeScript shape:",
    '{"command":"string","summary":"string","assignments":[{"agentId":"string","task":"string","priority":"low|medium|high","expectedOutput":"string","logs":["string","string","string"]}]}',
    "Use only agentId values from the available agents.",
    "Keep each task under 90 characters and each log under 70 characters.",
    `Available agents: ${JSON.stringify(payload.agents)}`,
    `User command: ${command}`
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
        format: "json",
        options: {
          num_predict: 420,
          temperature: 0.35,
          top_p: 0.85
        }
      }),
      signal: AbortSignal.timeout(35000)
    });

    if (!response.ok) {
      return NextResponse.json(buildFallbackPlan(command, payload), { status: 200 });
    }

    const data = (await response.json()) as { response?: string };
    const plan = parsePlan(data.response, command, payload);

    return NextResponse.json({ ...plan, source: "next-ollama" });
  } catch {
    return NextResponse.json(buildFallbackPlan(command, payload), { status: 200 });
  }
}

async function tryPythonMas(payload: CommandRequest): Promise<CommandPlan | null> {
  try {
    const response = await fetch(`${PYTHON_MAS_URL}/api/run-agents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      return null;
    }

    const plan = (await response.json()) as CommandPlan;
    if (!plan.assignments?.length) {
      return null;
    }

    return plan;
  } catch {
    return null;
  }
}

function parsePlan(response: string | undefined, command: string, payload: CommandRequest): CommandPlan {
  if (!response) {
    return buildFallbackPlan(command, payload);
  }

  try {
    const parsed = JSON.parse(response) as Partial<CommandPlan>;
    const validAgentIds = new Set(payload.agents.map((agent) => agent.id));
    const assignments = parsed.assignments
      ?.filter((assignment) => assignment.agentId && validAgentIds.has(assignment.agentId))
      .slice(0, Math.max(1, payload.agents.length))
      .map((assignment) => ({
        agentId: assignment.agentId,
        task: assignment.task || "Review commander request and report findings",
        priority: assignment.priority || "medium",
        expectedOutput: assignment.expectedOutput || "Concise status report",
        logs: assignment.logs?.filter(Boolean).slice(0, 4) ?? ["accepting commander task", "building work plan"]
      }));

    if (!assignments?.length) {
      return buildFallbackPlan(command, payload);
    }

  return {
    command,
    summary: parsed.summary || "Command converted into agent assignments.",
    source: "next-ollama",
    assignments
  };
  } catch {
    return buildFallbackPlan(command, payload);
  }
}

function buildFallbackPlan(command: string, payload: CommandRequest): CommandPlan {
  const shortCommand = command.slice(0, 54);
  const templates = {
    analysis: ["Analyze current task priority and ledger metrics", "Priority map", "medium"],
    build: ["Prepare implementation steps for approved changes", "Build checklist", "medium"],
    design: ["Translate objective into dashboard interaction changes", "Interaction sketch", "medium"],
    qa: ["Validate command result and report broken flows", "Validation report", "high"],
    research: [`Break down command: ${shortCommand}`, "Research brief", "high"],
    security: ["Check local execution boundaries and endpoint safety", "Safety note", "medium"]
  } as const;

  return {
    command,
    summary: "Command queued with local fallback planner.",
    source: "fallback",
    assignments: payload.agents.slice(0, 6).map((agent) => {
      const [task, expectedOutput, priority] = templates[agent.role as keyof typeof templates] ?? [
        `Process commander objective: ${shortCommand}`,
        "Agent report",
        "medium"
      ];

      return {
        agentId: agent.id,
        task,
        priority,
        expectedOutput,
        logs: ["receiving commander objective", "allocating local work packet", "recording fallback event"]
      };
    })
  };
}
