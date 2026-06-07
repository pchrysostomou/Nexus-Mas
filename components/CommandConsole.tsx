"use client";

import { Loader2, SendHorizonal, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import type { Agent } from "@/lib/agents";
import type { AgentAssignment, CommandPlan } from "@/lib/commands";

type CommandConsoleProps = {
  agents: Agent[];
  isDispatching: boolean;
  lastPlan: CommandPlan | null;
  onPlan: (plan: CommandPlan) => void;
};

export function CommandConsole({ agents, isDispatching, lastPlan, onPlan }: CommandConsoleProps) {
  const [command, setCommand] = useState("Build a status report for the current multi-agent dashboard.");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [status, setStatus] = useState("");
  const requestIdRef = useRef(0);

  async function submitCommand() {
    const trimmed = command.trim();

    if (!trimmed || isDispatching || isSending) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setError("");
    setStatus("Local dispatch applied. Python MAS is checking Ollama...");
    setIsSending(true);
    setIsRefining(true);
    onPlan(buildImmediatePlan(trimmed, agents));
    window.setTimeout(() => setIsSending(false), 650);

    try {
      const response = await fetch("/api/agents/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          command: trimmed,
          agents: agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            task: agent.task,
            status: agent.status
          }))
        })
      });

      if (!response.ok) {
        throw new Error("Command planner rejected the request");
      }

      const plan = (await response.json()) as CommandPlan;
      if (requestIdRef.current !== requestId) {
        return;
      }
      onPlan(plan);
      setStatus(`${formatPlanSource(plan.source)} plan applied${plan.logsStored ? " and logs stored" : ""}`);
    } catch {
      if (requestIdRef.current !== requestId) {
        return;
      }
      setError("Python/Ollama slow. Local workers keep running.");
      setStatus("Fallback plan active");
    } finally {
      if (requestIdRef.current === requestId) {
        setIsRefining(false);
      }
    }
  }

  return (
    <section className="rounded-lg border border-fuchsia-300/20 bg-slate-950/62 p-3 shadow-neon-purple backdrop-blur-xl">
      <div className="flex flex-col gap-3 xl:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-200/75">
            <Sparkles className="h-4 w-4 text-fuchsia-300" />
            Commander Input
          </div>
          <textarea
            className="min-h-20 w-full resize-none rounded-md border border-cyan-300/18 bg-[#030711]/82 px-3 py-2 text-sm leading-6 text-cyan-50 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/55 focus:shadow-neon-cyan"
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void submitCommand();
              }
            }}
            onChange={(event) => setCommand(event.target.value)}
            value={command}
          />
        </div>

        <div className="flex w-full flex-col justify-between gap-3 xl:w-64">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/35 bg-cyan-300/12 px-4 text-sm font-semibold text-cyan-50 shadow-neon-cyan transition hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={isDispatching || isSending || !command.trim()}
            onClick={submitCommand}
            type="button"
          >
            {isDispatching || isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            {isSending ? "Sent" : "Dispatch"}
          </button>

          <div className="rounded-md border border-white/10 bg-white/[0.035] px-3 py-2">
            <p className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Last Plan
              {isRefining ? <span className="text-cyan-200">python working</span> : null}
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-300">
              {status || error || lastPlan?.summary || "Ready for command"}
            </p>
            {lastPlan ? (
              <p className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-cyan-200/70">
                {formatPlanSource(lastPlan.source)} route / {lastPlan.assignments.length} work packets
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatPlanSource(source: CommandPlan["source"]) {
  if (source === "local") {
    return "Local dispatch";
  }

  if (source === "python-mas") {
    return "Python MAS";
  }

  if (source === "next-ollama") {
    return "Ollama";
  }

  return "Fallback";
}

function buildImmediatePlan(command: string, agents: Agent[]): CommandPlan {
  const activeAgents = pickAgents(agents);

  return {
    command,
    summary: "Local dispatch applied. Agents are receiving task packets.",
    source: "local",
    assignments: activeAgents.map((agent, index) => ({
      agentId: agent.id,
      task: buildTaskForAgent(agent, command),
      priority: index === 0 ? "high" : "medium",
      expectedOutput: buildExpectedOutput(agent),
      logs: [
        "command packet received",
        "allocating room workers",
        "opening local context buffer",
        "awaiting ollama refinement"
      ]
    }))
  };
}

function pickAgents(agents: Agent[]) {
  const preferred = ["researcher", "designer", "analyst", "builder", "qa", "security"];
  const picked = preferred
    .map((id) => agents.find((agent) => agent.id === id))
    .filter((agent): agent is Agent => Boolean(agent));

  return picked.length > 0 ? picked : agents.slice(0, 4);
}

function buildTaskForAgent(agent: Agent, command: string) {
  const shortCommand = command.length > 54 ? `${command.slice(0, 54)}...` : command;
  const taskByRole: Partial<Record<Agent["role"], string>> = {
    research: `Research objective: ${shortCommand}`,
    design: `Design room workflow for: ${shortCommand}`,
    build: `Prepare implementation path for: ${shortCommand}`,
    qa: `Validate command result for: ${shortCommand}`,
    analysis: `Analyze task risk for: ${shortCommand}`,
    security: `Check local execution boundaries for: ${shortCommand}`
  };

  return taskByRole[agent.role] ?? `Process commander objective: ${shortCommand}`;
}

function buildExpectedOutput(agent: Agent): AgentAssignment["expectedOutput"] {
  const outputByRole: Partial<Record<Agent["role"], string>> = {
    research: "Research brief",
    design: "Design decision list",
    build: "Implementation checklist",
    qa: "Validation report",
    analysis: "Risk and priority map",
    security: "Execution safety note"
  };

  return outputByRole[agent.role] ?? "Agent status report";
}
